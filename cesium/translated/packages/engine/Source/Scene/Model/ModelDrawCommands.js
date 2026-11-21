import {
  BoundingSphere,
  DeveloperError,
  Matrix4,
  clone,
  defined,
} from "@cesium/core";
import DrawCommand from "../../Renderer/DrawCommand.js";
import RenderState from "../../Renderer/RenderState.js";
import SceneMode from "../SceneMode.js";
import ShadowMode from "../ShadowMode.js";
import ClassificationModelDrawCommand from "./ClassificationModelDrawCommand.js";
import ModelDrawCommand from "./ModelDrawCommand.js";
import VertexArray from "../../Renderer/VertexArray.js";
import ModelVS from "../../Shaders/Model/ModelVS.js";
import ModelFS from "../../Shaders/Model/ModelFS.js";
import ModelUtility from "./ModelUtility.js";

/**
 * 用于构建模型绘制命令的内部函数。
 *
 * (这些函数的核心内容来自 `buildDrawCommand.js`，
 * 截至提交哈希 7b93161da1cc03bdc796b204e7aa51fb7acebf04)
 *
 * @private
 */
function ModelDrawCommands() {}

/**
 * 为 {@link ModelRuntimePrimitive} 构建 {@link ModelDrawCommand}
 * 并使用其渲染资源。如果模型包含其他资产，则
 * 改为构建 {@link ClassificationModelDrawCommand}。
 *
 * @param {PrimitiveRenderResources} primitiveRenderResources primitive 的渲染资源。
 * @param {FrameState} frameState 用于创建 GPU 资源的帧状态。
 * @returns {ModelDrawCommand|ClassificationModelDrawCommand} The 生成的 ModelDrawCommand 或 ClassificationModelDrawCommand。
 *
 * @private
 */
ModelDrawCommands.buildModelDrawCommand = function (
  primitiveRenderResources,
  frameState,
) {
  const shaderBuilder = primitiveRenderResources.shaderBuilder;
  const shaderProgram = createShaderProgram(
    primitiveRenderResources,
    shaderBuilder,
    frameState,
  );

  const command = buildDrawCommandForModel(
    primitiveRenderResources,
    shaderProgram,
    frameState,
  );

  const model = primitiveRenderResources.model;
  const hasClassification = defined(model.classificationType);
  if (hasClassification) {
    return new ClassificationModelDrawCommand({
      primitiveRenderResources: primitiveRenderResources,
      command: command,
    });
  }

  return new ModelDrawCommand({
    primitiveRenderResources: primitiveRenderResources,
    command: command,
  });
};

/**
 * @private
 */
function createShaderProgram(
  primitiveRenderResources,
  shaderBuilder,
  frameState,
) {
  shaderBuilder.addVertexLines(ModelVS);
  shaderBuilder.addFragmentLines(ModelFS);

  const model = primitiveRenderResources.model;
  const shaderProgram = shaderBuilder.buildShaderProgram(frameState.context);
  model._pipelineResources.push(shaderProgram);
  return shaderProgram;
}

/**
 * Builds the {@link DrawCommand} that serves as the basis for either creating
 * {@link ModelDrawCommand} 或 {@link ModelRuntimePrimitive}
 *
 * @param {PrimitiveRenderResources} primitiveRenderResources primitive 的渲染资源的基础的 {@link DrawCommand}。
 * @param {ShaderProgram} shaderProgram 着色器程序。
 * @param {FrameState} frameState 用于创建 GPU 资源的帧状态。
 *
 * @returns {DrawCommand} The 生成的 DrawCommand，将传递给
 * {@link ModelDrawCommand} 或 {@link ClassificationModelDrawCommand}
 *
 * @private
 */
function buildDrawCommandForModel(
  primitiveRenderResources,
  shaderProgram,
  frameState,
) {
  const indexBuffer = getIndexBuffer(primitiveRenderResources);

  const vertexArray = new VertexArray({
    context: frameState.context,
    indexBuffer: indexBuffer,
    attributes: primitiveRenderResources.attributes,
  });

  const model = primitiveRenderResources.model;
  model._pipelineResources.push(vertexArray);

  const pass = primitiveRenderResources.alphaOptions.pass;
  const sceneGraph = model.sceneGraph;

  const is3D = frameState.mode === SceneMode.SCENE3D;
  let modelMatrix, boundingSphere;

  if (!is3D && !frameState.scene3DOnly && model._projectTo2D) {
    modelMatrix = Matrix4.multiplyTransformation(
      sceneGraph._computedModelMatrix,
      primitiveRenderResources.runtimeNode.computedTransform,
      new Matrix4(),
    );

    const runtimePrimitive = primitiveRenderResources.runtimePrimitive;
    boundingSphere = runtimePrimitive.boundingSphere2D;
  } else {
    const computedModelMatrix = is3D
      ? sceneGraph._computedModelMatrix
      : sceneGraph._computedModelMatrix2D;

    modelMatrix = Matrix4.multiplyTransformation(
      computedModelMatrix,
      primitiveRenderResources.runtimeNode.computedTransform,
      new Matrix4(),
    );

    boundingSphere = BoundingSphere.transform(
      primitiveRenderResources.boundingSphere,
      modelMatrix,
    );
  }

  // Initialize render state with default values
  let renderState = clone(
    RenderState.fromCache(primitiveRenderResources.renderStateOptions),
    true,
  );

  renderState.cull.face = ModelUtility.getCullFace(
    modelMatrix,
    primitiveRenderResources.primitiveType,
  );
  renderState = RenderState.fromCache(renderState);

  const hasClassification = defined(model.classificationType);
  const castShadows = hasClassification
    ? false
    : ShadowMode.castShadows(model.shadows);
  const receiveShadows = hasClassification
    ? false
    : ShadowMode.receiveShadows(model.shadows);
  // Pick IDs are only added to specific draw commands for classification.
  // This behavior is handled by ClassificationModelDrawCommand.
  const pickId = hasClassification
    ? undefined
    : primitiveRenderResources.pickId;
  const snapId = hasClassification
    ? undefined
    : primitiveRenderResources.snapId;

  const command = new DrawCommand({
    boundingVolume: boundingSphere,
    modelMatrix: modelMatrix,
    uniformMap: primitiveRenderResources.uniformMap,
    renderState: renderState,
    vertexArray: vertexArray,
    shaderProgram: shaderProgram,
    cull: model.cull,
    pass: pass,
    count: primitiveRenderResources.count,
    owner: model,
    pickId: pickId,
    snapId: snapId,
    pickMetadataAllowed: true,
    instanceCount: primitiveRenderResources.instanceCount,
    primitiveType: primitiveRenderResources.primitiveType,
    debugShowBoundingVolume: model.debugShowBoundingVolume,
    castShadows: castShadows,
    receiveShadows: receiveShadows,
  });
  return command;
}

/**
 * @private
 */
function getIndexBuffer(primitiveRenderResources) {
  const wireframeIndexBuffer = primitiveRenderResources.wireframeIndexBuffer;
  if (defined(wireframeIndexBuffer)) {
    return wireframeIndexBuffer;
  }

  const indices = primitiveRenderResources.indices;
  if (!defined(indices)) {
    return undefined;
  }

  //>>includeStart('debug', pragmas.debug);
  if (!defined(indices.buffer)) {
    throw new DeveloperError("Indices must be provided as a Buffer");
  }
  //>>includeEnd('debug');

  return indices.buffer;
}

export default ModelDrawCommands;