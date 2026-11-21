import { IndexDatatype, PrimitiveType, defined } from "@cesium/core";
import Buffer from "../../Renderer/Buffer.js";
import BufferUsage from "../../Renderer/BufferUsage.js";
import ModelUtility from "./ModelUtility.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";
import WireframeIndexGenerator from "../../Core/WireframeIndexGenerator.js";

/**
 * 线框管线阶段会生成一个新的索引缓冲区，用于使用 gl.LINES 渲染网格结构。
 * 处理基本体。这会对渲染资源进行以下修改：
 *
 * @namespace WireframePipelineStage
 * @private
 */
const WireframePipelineStage = {
  name: "WireframePipelineStage", // Helps with debugging
};

/**
 * <li>在片段着色器中添加定义，以防止线条被额外着色。</li>
 * <ul>
 * <li>添加单独的索引缓冲区用于线框索引。</li>
 * <li>更新基本体类型和数量，以便使用 gl.LINES 进行渲染。</li>
 * 此节点的渲染资源
 * </ul>
 *
 * @param {PrimitiveRenderResources} renderResources 基本体
 * @param {ModelComponents.primitive} primitive 帧状态
 * @param {FrameState} frameState The frame state
 */
WireframePipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  // Applying normal mapping to the lines will result in rendering
  // errors on Linux. This define is added to disable normal
  // mapping in the shader.
  const shaderBuilder = renderResources.shaderBuilder;
  shaderBuilder.addDefine(
    "HAS_WIREFRAME",
    undefined,
    ShaderDestination.FRAGMENT,
  );

  const model = renderResources.model;
  const wireframeIndexBuffer = createWireframeIndexBuffer(
    primitive,
    renderResources.indices,
    frameState,
  );
  model._pipelineResources.push(wireframeIndexBuffer);
  renderResources.wireframeIndexBuffer = wireframeIndexBuffer;

  // We only need to count memory for the generated buffer. In WebGL 1, the CPU
  // copy of the original indices is already counted in the geometry stage,
  // and in WebGL 2, the CPU copy of the original indices (generated from the
  // data of the original buffer) is discarded after generating the wireframe
  // indices.
  const hasCpuCopy = false;
  model.statistics.addBuffer(wireframeIndexBuffer, hasCpuCopy);

  // Update render resources so we render LINES with the correct index count
  const originalPrimitiveType = renderResources.primitiveType;
  const originalCount = renderResources.count;
  renderResources.primitiveType = PrimitiveType.LINES;
  renderResources.count = WireframeIndexGenerator.getWireframeIndicesCount(
    originalPrimitiveType,
    originalCount,
  );
};

function createWireframeIndexBuffer(primitive, indices, frameState) {
  const positionAttribute = ModelUtility.getAttributeBySemantic(
    primitive,
    VertexAttributeSemantic.POSITION,
  );
  const vertexCount = positionAttribute.count;
  const webgl2 = frameState.context.webgl2;

  let originalIndices;
  if (defined(indices)) {
    const indicesBuffer = indices.buffer;
    const indicesCount = indices.count;
    if (defined(indicesBuffer) && webgl2) {
      const useUint8Array = indicesBuffer.sizeInBytes === indicesCount;
      originalIndices = useUint8Array
        ? new Uint8Array(indicesCount)
        : IndexDatatype.createTypedArray(vertexCount, indicesCount);

      indicesBuffer.getBufferData(originalIndices);
    } else {
      originalIndices = indices.typedArray;
    }
  }

  const primitiveType = primitive.primitiveType;
  const wireframeIndices = WireframeIndexGenerator.createWireframeIndices(
    primitiveType,
    vertexCount,
    originalIndices,
  );
  const indexDatatype = IndexDatatype.fromSizeInBytes(
    wireframeIndices.BYTES_PER_ELEMENT,
  );

  return Buffer.createIndexBuffer({
    context: frameState.context,
    typedArray: wireframeIndices,
    usage: BufferUsage.STATIC_DRAW,
    indexDatatype: indexDatatype,
  });
}

export default WireframePipelineStage;
