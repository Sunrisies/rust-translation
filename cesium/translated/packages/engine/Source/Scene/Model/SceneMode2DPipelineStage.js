import {
  BoundingSphere,
  Cartesian3,
  Matrix4,
  clone,
  combine,
  defined,
} from "@cesium/core";
import Buffer from "../../Renderer/Buffer.js";
import BufferUsage from "../../Renderer/BufferUsage.js";
import ModelUtility from "./ModelUtility.js";
import SceneMode from "../SceneMode.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";
import SceneTransforms from "../SceneTransforms.js";

const scratchModelMatrix = new Matrix4();
const scratchModelView2D = new Matrix4();

/**
 * 场景模式 2D 阶段负责生成在 2D / CV 模式下渲染基本体所需的资源。
 *
 * @namespace SceneMode2DPipelineStage
 *
 * @private
 */
const SceneMode2DPipelineStage = {
  name: "SceneMode2DPipelineStage", // Helps with debugging
};

/**
 * 此管道阶段处理基本体的位置属性，并向着色器添加相关的
 * 定义矩阵和统一矩阵。同时为基本体生成新的资源，这些资源会保留在运行时基本体中，以便用于存储位置数据的类型数组可以被释放。
 * 2D 版本的资源。这些资源会保留在运行时基本体中，从而可以释放用于存储位置数据的类型数组。
 * 此阶段必须在基本体管道中的 GeometryPipelineStage 之前执行。
 *
 * 此阶段必须在基本体管道中的 GeometryPipelineStage 之前执行。
 *
 * 处理基本体。此阶段会修改渲染资源的以下部分：
 * <ul>
 * <li> 创建用于 2D 投影的基本体位置的顶点缓冲区
 * <li> 创建基本体的 2D 边界球体
 * <li> 在着色器中添加标志以使用 2D 位置
 * <li> 添加 2D 视图模型矩阵的统一变量
 * </ul>
 *
 * @param {PrimitiveRenderResources} renderResources 此基本体的渲染资源。
 * @param {ModelComponents.Primitive} primitive 该基本体。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */

SceneMode2DPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const positionAttribute = ModelUtility.getAttributeBySemantic(
    primitive,
    VertexAttributeSemantic.POSITION,
  );

  const shaderBuilder = renderResources.shaderBuilder;
  const model = renderResources.model;
  const modelMatrix = model.sceneGraph.computedModelMatrix;
  const nodeComputedTransform = renderResources.runtimeNode.computedTransform;
  const computedModelMatrix = Matrix4.multiplyTransformation(
    modelMatrix,
    nodeComputedTransform,
    scratchModelMatrix,
  );

  const boundingSphere2D = computeBoundingSphere2D(
    renderResources,
    computedModelMatrix,
    frameState,
  );

  const runtimePrimitive = renderResources.runtimePrimitive;
  runtimePrimitive.boundingSphere2D = boundingSphere2D;

  // If the model is instanced, 2D projection will be handled in the
  // InstancingPipelineStage.
  const instances = renderResources.runtimeNode.node.instances;
  if (defined(instances)) {
    return;
  }

  // If the typed array of the position attribute exists, then
  // the positions haven't been projected to 2D yet.
  if (defined(positionAttribute.typedArray)) {
    const buffer2D = createPositionBufferFor2D(
      positionAttribute,
      computedModelMatrix,
      boundingSphere2D,
      frameState,
    );

    // Since this buffer will persist even if the pipeline is re-run,
    // its memory will be counted in PrimitiveStatisticsPipelineStage
    runtimePrimitive.positionBuffer2D = buffer2D;
    model._modelResources.push(buffer2D);

    // Unload the typed array. This is just a pointer to the array in
    // the vertex buffer loader, so if the typed array is shared by
    // multiple primitives (i.e. multiple instances of the same mesh),
    // this will not affect the other primitives.
    positionAttribute.typedArray = undefined;
  }

  shaderBuilder.addDefine(
    "USE_2D_POSITIONS",
    undefined,
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addUniform("mat4", "u_modelView2D", ShaderDestination.VERTEX);

  const modelMatrix2D = Matrix4.fromTranslation(
    boundingSphere2D.center,
    new Matrix4(),
  );

  const context = frameState.context;
  const uniformMap = {
    u_modelView2D: function () {
      return Matrix4.multiplyTransformation(
        context.uniformState.view,
        modelMatrix2D,
        scratchModelView2D,
      );
    },
  };

  renderResources.uniformMap = combine(uniformMap, renderResources.uniformMap);
};

const scratchProjectedMin = new Cartesian3();
const scratchProjectedMax = new Cartesian3();

function computeBoundingSphere2D(renderResources, modelMatrix, frameState) {
  // Compute the bounding sphere in 2D.
  const transformedPositionMin = Matrix4.multiplyByPoint(
    modelMatrix,
    renderResources.positionMin,
    scratchProjectedMin,
  );

  const projectedMin = SceneTransforms.computeActualEllipsoidPosition(
    frameState,
    transformedPositionMin,
    transformedPositionMin,
  );

  const transformedPositionMax = Matrix4.multiplyByPoint(
    modelMatrix,
    renderResources.positionMax,
    scratchProjectedMax,
  );

  const projectedMax = SceneTransforms.computeActualEllipsoidPosition(
    frameState,
    transformedPositionMax,
    transformedPositionMax,
  );

  return BoundingSphere.fromCornerPoints(
    projectedMin,
    projectedMax,
    new BoundingSphere(),
  );
}

const scratchPosition = new Cartesian3();

function dequantizePositionsTypedArray(typedArray, quantization) {
  // Draco compression is normally handled in the dequantization stage
  // in the shader, but it must be decoded here in order to project
  // the positions to 2D / CV.
  const length = typedArray.length;
  const dequantizedArray = new Float32Array(length);
  const quantizedVolumeOffset = quantization.quantizedVolumeOffset;
  const quantizedVolumeStepSize = quantization.quantizedVolumeStepSize;
  for (let i = 0; i < length; i += 3) {
    const initialPosition = Cartesian3.fromArray(
      typedArray,
      i,
      scratchPosition,
    );
    const scaledPosition = Cartesian3.multiplyComponents(
      initialPosition,
      quantizedVolumeStepSize,
      initialPosition,
    );
    const dequantizedPosition = Cartesian3.add(
      scaledPosition,
      quantizedVolumeOffset,
      scaledPosition,
    );

    dequantizedArray[i] = dequantizedPosition.x;
    dequantizedArray[i + 1] = dequantizedPosition.y;
    dequantizedArray[i + 2] = dequantizedPosition.z;
  }

  return dequantizedArray;
}

function createPositionsTypedArrayFor2D(
  attribute,
  modelMatrix,
  referencePoint,
  frameState,
) {
  let result;
  if (defined(attribute.quantization)) {
    // Dequantize the positions if necessary.
    result = dequantizePositionsTypedArray(
      attribute.typedArray,
      attribute.quantization,
    );
  } else {
    result = attribute.typedArray.slice();
  }

  const startIndex = attribute.byteOffset / Float32Array.BYTES_PER_ELEMENT;
  const length = result.length;
  const stride = defined(attribute.byteStride)
    ? attribute.byteStride / Float32Array.BYTES_PER_ELEMENT
    : 3;

  for (let i = startIndex; i < length; i += stride) {
    const initialPosition = Cartesian3.fromArray(result, i, scratchPosition);
    if (
      isNaN(initialPosition.x) ||
      isNaN(initialPosition.y) ||
      isNaN(initialPosition.z)
    ) {
      continue;
    }

    const transformedPosition = Matrix4.multiplyByPoint(
      modelMatrix,
      initialPosition,
      initialPosition,
    );

    const projectedPosition = SceneTransforms.computeActualEllipsoidPosition(
      frameState,
      transformedPosition,
      transformedPosition,
    );

    const relativePosition = Cartesian3.subtract(
      projectedPosition,
      referencePoint,
      projectedPosition,
    );

    result[i] = relativePosition.x;
    result[i + 1] = relativePosition.y;
    result[i + 2] = relativePosition.z;
  }

  return result;
}

function createPositionBufferFor2D(
  positionAttribute,
  modelMatrix,
  boundingSphere2D,
  frameState,
) {
  // Force the scene mode to be CV. In 2D, projected positions will have
  // an x-coordinate of 0, which eliminates the height data that is
  // necessary for rendering in CV mode.
  const frameStateCV = clone(frameState);
  frameStateCV.mode = SceneMode.COLUMBUS_VIEW;

  // To prevent jitter, the positions are defined relative to a common
  // reference point. For convenience, this is the center of the
  // primitive's bounding sphere in 2D.
  const referencePoint = boundingSphere2D.center;
  const projectedPositions = createPositionsTypedArrayFor2D(
    positionAttribute,
    modelMatrix,
    referencePoint,
    frameStateCV,
  );

  // Put the resulting data in a GPU buffer.
  const buffer = Buffer.createVertexBuffer({
    context: frameState.context,
    typedArray: projectedPositions,
    usage: BufferUsage.STATIC_DRAW,
  });
  buffer.vertexArrayDestroyable = false;

  return buffer;
}

export default SceneMode2DPipelineStage;
