import { defined } from "@cesium/core";

/**
 * 节点统计更新阶段会更新模型的内存使用统计信息。
 * 在节点级别进行。这统计了模型生命周期内存在的二进制资源。
 * 例如，GltfLoader加载的属性。它不统计每次运行管道时创建的资源。
 * 也不统计每次运行管道时生成的资源。
 * 各个管道阶段负责记录它们所分配的任何额外内存。
 * additional memory they allocate.
 *
 * @namespace NodeStatisticsPipelineStage
 *
 * @private
 */
const NodeStatisticsPipelineStage = {
  name: "NodeStatisticsPipelineStage", // Helps with debugging

  // Expose some methods for testing
  _countInstancingAttributes: countInstancingAttributes,
  _countGeneratedBuffers: countGeneratedBuffers,
};

NodeStatisticsPipelineStage.process = function (
  renderResources,
  node,
  frameState,
) {
  const statistics = renderResources.model.statistics;
  const instances = node.instances;
  const runtimeNode = renderResources.runtimeNode;

  countInstancingAttributes(statistics, instances);
  countGeneratedBuffers(statistics, runtimeNode);
};

function countInstancingAttributes(statistics, instances) {
  if (!defined(instances)) {
    return;
  }

  const attributes = instances.attributes;
  const length = attributes.length;
  for (let i = 0; i < length; i++) {
    const attribute = attributes[i];
    if (defined(attribute.buffer)) {
      // Any typed arrays should have been unloaded before this stage.
      const hasCpuCopy = false;
      statistics.addBuffer(attribute.buffer, hasCpuCopy);
    }
  }
}

function countGeneratedBuffers(statistics, runtimeNode) {
  if (defined(runtimeNode.instancingTransformsBuffer)) {
    // The typed array containing the computed transforms isn't saved
    // after the buffer is created.
    const hasCpuCopy = false;
    statistics.addBuffer(runtimeNode.instancingTransformsBuffer, hasCpuCopy);
  }
  if (defined(runtimeNode.instancingTransformsBuffer2D)) {
    // The typed array containing the computed 2D transforms isn't saved
    // after the buffer is created.
    const hasCpuCopy = false;
    statistics.addBuffer(runtimeNode.instancingTransformsBuffer2D, hasCpuCopy);
  }

  if (defined(runtimeNode.instancingTranslationBuffer2D)) {
    // The typed array containing the computed 2D translations isn't saved
    // after the buffer is created.
    const hasCpuCopy = false;
    statistics.addBuffer(runtimeNode.instancingTranslationBuffer2D, hasCpuCopy);
  }
}

export default NodeStatisticsPipelineStage;
