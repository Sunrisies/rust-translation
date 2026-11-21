import { Check, clone } from "@cesium/core";

/**
 * 模型由场景图中的一个或多个节点组成。某些细节，
 * 例如实例化，是按节点分别计算的。此类提供了
 * 存储这些细节的容器。它还从
 * 模型渲染资源中继承了一些属性。
 *
 * @constructor
 *
 * @param {ModelRenderResources} modelRenderResources 要继承的模型资源
 * @param {ModelRuntimeNode} runtimeNode 场景图节点的内存表示形式。
 *
 * @private
 */
function NodeRenderResources(modelRenderResources, runtimeNode) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("modelRenderResources", modelRenderResources);
  Check.typeOf.object("runtimeNode", runtimeNode);
  //>>includeEnd('debug');

  // Properties inherited from the ModelRenderResources.
  /**
   * 对模型的引用。从模型渲染资源中继承。
   *
   * @type {Model}
   * @readonly
   *
   * @private
   */
  this.model = modelRenderResources.model;
  /**
   * 用于逐步构建着色器的对象。该对象从
   * 模型渲染资源中克隆而来，因为每个节点可以计算不同的着色器。
   *
   * @type {ShaderBuilder}
   * @readonly
   *
   * @private
   */
  this.shaderBuilder = modelRenderResources.shaderBuilder.clone();

  /**
   * 将统一名称映射到返回该值的函数的字典。
   * 从模型渲染资源中继承。
   *
   * @type {Object<string, Function>}
   * @readonly
   *
   * @private
   */
  this.uniformMap = clone(modelRenderResources.uniformMap);

  /**
   * 配置 alpha 阶段的选项，如通道和 alpha 截断值。
   * 从模型渲染资源中继承。
   *
   * @type {ModelAlphaOptions}
   * @readonly
   *
   * @private
   */
  this.alphaOptions = clone(modelRenderResources.alphaOptions);

  /**
   * 存储创建 {@link RenderState} 选项的对象。
   * 管道阶段仅设置选项，渲染状态在
   * 构建 {@link DrawCommand} 时创建。从模型
   * 渲染资源中继承。
   *
   * @type {object}
   * @readonly
   *
   * @private
   */
  this.renderStateOptions = clone(
    modelRenderResources.renderStateOptions,
    true,
  );

  /**
   * 模型是否具有轮廓。该值指示需要哪些绘制命令。
   * 从模型渲染资源中继承。
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  this.hasSilhouette = modelRenderResources.hasSilhouette;

  /**
   * 模型是否是使用 skipLevelOfDetail
   * 优化的 tileset 的一部分。该值指示需要哪些绘制命令。
   * 从模型渲染资源中继承。
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  this.hasSkipLevelOfDetail = modelRenderResources.hasSkipLevelOfDetail;

  // Other properties.
  /**
   * 对运行时节点的引用
   *
   * @type {ModelRuntimeNode}
   * @readonly
   *
   * @private
   */
  this.runtimeNode = runtimeNode;

  /**
   * 描述顶点属性的对象数组，这些属性最终将用于创建
   * 用于绘制命令的 {@link VertexArray}。在节点级别可能需要
   * 如 EXT_mesh_gpu_instancing 这样的扩展属性。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this.attributes = [];

  /**
   * 用于向属性数组中的下一个顶点属性分配的索引。
   * POSITION 占用索引 0。
   *
   * @type {number}
   *
   * @private
   */
  this.attributeIndex = 1;

  /**
   * 用于分配给由 feature ID 属性中的
   * 偏移/重复产生的特征 ID 顶点属性的设置索引。
   *
   * @type {number}
   * @default 0
   *
   * @private
   */
  this.featureIdVertexAttributeSetIndex = 0;

  /**
   * 实例数量。该值由 InstancingPipelineStage 设置。
   *
   * @type {number}
   * @default 0
   *
   * @private
   */
  this.instanceCount = 0;

  /**
   * 节点中基元的 PrimitiveRenderResources。
   *
   * @type {PrimitiveRenderResources[]}
   * @default []
   *
   * @private
   */
  this.primitiveRenderResources = [];
}

export default NodeRenderResources;
