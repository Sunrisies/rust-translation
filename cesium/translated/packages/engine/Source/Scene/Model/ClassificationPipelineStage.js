import { RuntimeError, defined } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";
import ModelUtility from "./ModelUtility.js";

/**
 * 分类处理阶段负责将特征批量处理。
 * 并由 {@linkClassificationModelDrawCommand} 进行渲染。
 *
 * @namespace ClassificationPipelineStage
 *
 * @private
 */
const ClassificationPipelineStage = {
  name: "ClassificationPipelineStage", // Helps with debugging
};

/**
 * 处理基本体。这会修改渲染资源的以下部分：
 *
 * <ul>
 * <li>在着色器中添加定义，以表明该基本体可以分类其他资源</li>
 * <li>在基本体的资源中添加包含批量长度和偏移量的数组</li>
 * </ul>
 *
 * <p>
 * 关于批量偏移量和长度的用法，请参阅 {@linkClassificationModelDrawCommand}。
 * </p>
 *
 * @param {PrimitiveRenderResources} renderResources 该基本体的渲染资源。
 * @param {ModelComponents.Primitive} primitive 该基本体本身。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
ClassificationPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addDefine(
    "HAS_CLASSIFICATION",
    undefined,
    ShaderDestination.BOTH,
  );

  const runtimePrimitive = renderResources.runtimePrimitive;

  if (!defined(runtimePrimitive.batchLengths)) {
    createClassificationBatches(primitive, runtimePrimitive);
  }
};

function createClassificationBatches(primitive, runtimePrimitive) {
  const positionAttribute = ModelUtility.getAttributeBySemantic(
    primitive,
    VertexAttributeSemantic.POSITION,
  );

  if (!defined(positionAttribute)) {
    throw new RuntimeError(
      "Primitives must have a position attribute to be used for classification.",
    );
  }

  let indicesArray;
  const indices = primitive.indices;
  const hasIndices = defined(indices);
  if (hasIndices) {
    indicesArray = indices.typedArray;
    // Unload the typed array. This is just a pointer to the array in
    // the index buffer loader.
    indices.typedArray = undefined;
  }

  const count = hasIndices ? indices.count : positionAttribute.count;
  const featureIdAttribute = ModelUtility.getAttributeBySemantic(
    primitive,
    VertexAttributeSemantic.FEATURE_ID,
    0,
  );

  // If there are no feature IDs, render the primitive in a single batch.
  if (!defined(featureIdAttribute)) {
    runtimePrimitive.batchLengths = [count];
    runtimePrimitive.batchOffsets = [0];

    return;
  }

  const featureIds = featureIdAttribute.typedArray;
  // Unload the typed array. This is just a pointer to the array in
  // the vertex buffer loader, so if the typed array is shared by
  // multiple primitives (i.e. multiple instances of the same mesh),
  // this will not affect the other primitives.
  featureIdAttribute.typedArray = undefined;

  const batchLengths = [];
  const batchOffsets = [0];

  const firstIndex = hasIndices ? indicesArray[0] : 0;
  let currentBatchId = featureIds[firstIndex];
  let currentOffset = 0;

  for (let i = 1; i < count; i++) {
    const index = hasIndices ? indicesArray[i] : i;
    const batchId = featureIds[index];

    if (batchId !== currentBatchId) {
      // Store the length of this batch and begin counting the next one.
      const batchLength = i - currentOffset;
      const newOffset = i;

      batchLengths.push(batchLength);
      batchOffsets.push(newOffset);

      currentOffset = newOffset;
      currentBatchId = batchId;
    }
  }

  const finalBatchLength = count - currentOffset;
  batchLengths.push(finalBatchLength);

  runtimePrimitive.batchLengths = batchLengths;
  runtimePrimitive.batchOffsets = batchOffsets;
}

export default ClassificationPipelineStage;
