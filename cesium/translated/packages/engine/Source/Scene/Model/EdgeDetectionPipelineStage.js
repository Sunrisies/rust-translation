import EdgeDetectionStageFS from "../../Shaders/Model/EdgeDetectionStageFS.js";

/**
 * 执行屏幕空间边缘可见性/合成阶段。此阶段不
 * 构建边缘几何本身；该工作由 {@link EdgeVisibilityPipelineStage} 处理，
 * 该阶段提取独特的模型边缘，并在专门的边缘渲染阶段将其写入
 * 边缘 ID / 颜色目标中。此处添加的片段逻辑如下：
 * <ul>
 * <li>采样边缘渲染目标（边缘颜色 + 每边缘特征 ID）</li>
 * <li>将每边缘特征 ID 与底层表面特征 ID 进行比较，以排除
 * 属于被过滤或隐藏特征的边缘</li>
 * <li>执行基于深度的测试（例如，与地球或场景深度对比），以剔除
 * 被遮挡的边缘</li>
 * </ul>
 * 总结：EdgeVisibilityPipelineStage = 生成与编码边缘；此阶段 = 决定
 * 哪些编码后的边缘在最终帧中真正可见，并对它们进行合成。
 *
 * @namespace EdgeDetectionPipelineStage
 * @private
 */
const EdgeDetectionPipelineStage = {
  name: "EdgeDetectionPipelineStage",
};

/**
 * 通过注入片段着色器逻辑来处理基元，该逻辑消耗由边缘几何阶段产生的
 * 中间边缘缓冲区。它添加了以下代码：
 * <ul>
 * <li>读取边缘颜色 / 边缘 ID MRT 输出</li>
 * <li>应用基于深度与特征 ID 的排除机制</li>
 * <li>输出最终边缘颜色用于合成</li>
 * </ul>
 * @param {PrimitiveRenderResources} renderResources 基元的渲染资源
 * @private
 */
EdgeDetectionPipelineStage.process = function (renderResources) {
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addFragmentLines([EdgeDetectionStageFS]);
};

export default EdgeDetectionPipelineStage;
