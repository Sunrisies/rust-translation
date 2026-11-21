import {
  BoundingSphere,
  Cartesian3,
  Check,
  clone,
  defined,
} from "@cesium/core";
import ModelUtility from "./ModelUtility.js";
import ModelLightingOptions from "./ModelLightingOptions.js";

/**
 * 每个节点可能包含多个网格基本体。大多数模型管道阶段都在基本体级别操作。
 * 同样，属性是从父节点继承的。
 *
 * @param {NodeRenderResources} nodeRenderResources 要继承的节点资源
 * @param {ModelRuntimePrimitive} runtimePrimitive 基本体本身。
 *
 * @private
 */
function PrimitiveRenderResources(nodeRenderResources, runtimePrimitive) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("nodeRenderResources", nodeRenderResources);
  Check.typeOf.object("runtimePrimitive", runtimePrimitive);
  //>>includeEnd('debug');

  // Properties inherited from NodeRenderResources.
  /**
   * 对模型的引用。从节点渲染资源继承而来。
   *
   * @type {Model}
   * @readonly
   *
   * @private
   */
  this.model = nodeRenderResources.model;

  /**
   * 对运行时节点的引用。从节点渲染资源继承而来。
   *
   * @type {ModelRuntimeNode}
   * @readonly
   *
   * @private
   */
  this.runtimeNode = nodeRenderResources.runtimeNode;

  /**
   * 顶点属性。这是从节点渲染资源浅层克隆而来的，而基本体会添加额外的属性。
   * 为下一个顶点属性添加的索引。POSITION 取索引 0，从节点渲染资源继承而来。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this.attributes = nodeRenderResources.attributes.slice();

  /**
   * 用于分配给特征 ID 顶点属性的集合索引。
   * 数组。POSITION 取索引 0。从节点渲染资源继承而来。
   *
   * @type {number}
   *
   * @private
   */
  this.attributeIndex = nodeRenderResources.attributeIndex;

  /**
   * 用于分配给由特征 ID 属性中的偏移/重复产生的特征 ID 顶点属性的集合索引。从节点渲染资源继承而来。
   * 节点渲染资源。
   * 将统一名称映射到返回该值的函数的字典。
   *
   * @type {number}
   *
   * @private
   */
  this.featureIdVertexAttributeSetIndex =
    nodeRenderResources.featureIdVertexAttributeSetIndex;

  /**
   * 返回统一值的函数。从节点渲染资源继承而来。
   * 配置 alpha 阶段的选项，如通过度和 alpha 截断值。从节点渲染资源继承而来。
   *
   * @type {Object<string, Function>}
   * @readonly
   *
   * @private
   */
  this.uniformMap = clone(nodeRenderResources.uniformMap);

  /**
   * 用于创建 {@link RenderState} 的选项。
   * 管道阶段仅设置选项；实际的渲染状态是在构建 {@link DrawCommand} 时创建的。从节点渲染资源继承而来。
   *
   * @type {ModelAlphaOptions}
   * @readonly
   *
   * @private
   */
  this.alphaOptions = clone(nodeRenderResources.alphaOptions);

  /**
   * 用于创建 {@link RenderState} 的选项对象。
   * 管道阶段仅设置选项；实际的渲染状态是在构建 {@link DrawCommand} 时创建的。从节点渲染资源继承而来。
   * is created when the {@link DrawCommand} is constructed. Inherited from
   * 模型是否属于使用 skipLevelOfDetail 优化的 tileset。该值指示需要哪些绘制命令。从节点渲染资源继承而来。
   *
   * @type {object}
   * @readonly
   *
   * @private
   */
  this.renderStateOptions = clone(nodeRenderResources.renderStateOptions, true);

  /**
   * 模型是否有轮廓。该值指示需要哪些绘制命令。从节点渲染资源继承而来。
   * 模型是否属于使用 skipLevelOfDetail 优化的 tileset。该值指示需要哪些绘制命令。从节点渲染资源继承而来。
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  this.hasSilhouette = nodeRenderResources.hasSilhouette;

  /**
   * 模型是否属于使用 skipLevelOfDetail 优化的 tileset。该值指示需要哪些绘制命令。从节点渲染资源继承而来。
   * 此基本体是否将其特征 ID 写入 planar fill ID 纹理中。由非背景 planar fill 基本体的材料管道阶段设置，以便背景填充可以测试同一对象的共面性。该值指示需要哪些绘制命令。
   * 用于逐步构建着色器的对象。这是从节点渲染资源克隆而来的，因为每个基本体可以计算不同的着色器。
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  this.hasSkipLevelOfDetail = nodeRenderResources.hasSkipLevelOfDetail;

  /**
   * 实例数量。如果不使用 instancing，则默认为 0。
   * 运行时基本体的引用。
   * 与渲染资源相关的基本体。
   * 基本体中的索引数量。对此的解释
   * what draw commands are needed.
   *
   * @type {boolean}
   *
   * @private
   */
  this.planarFillIdPass = false;

  /**
   * An object used to build a shader incrementally. This is cloned from the
   * node render resources because each primitive can compute a different shader.
   *
   * @type {ShaderBuilder}
   * @readonly
   *
   * @private
   */
  this.shaderBuilder = nodeRenderResources.shaderBuilder.clone();

  /**
   * The number of instances. Default is 0, if instancing is not used.
   * Inherited from the node render resources.
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  this.instanceCount = nodeRenderResources.instanceCount;

  // Other properties
  /**
   * A reference to the runtime primitive.
   *
   * @type {ModelRuntimePrimitive}
   * @readonly
   *
   * @private
   */
  this.runtimePrimitive = runtimePrimitive;

  /**
   * The primitive associated with the render resources.
   *
   * @type {ModelComponents.Primitive}
   * @readonly
   *
   * @private
   */
  const primitive = runtimePrimitive.primitive;

  /**
   * The number of indices in the primitive. The interpretation of this
   * 取决于原始类型。
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  this.count = defined(primitive.indices)
    ? primitive.indices.count
    : ModelUtility.getAttributeBySemantic(primitive, "POSITION").count;

  /**
   * 该原始类型是否拥有用于存储元数据的属性表。
   * 当启用时，选择与样式设置会使用此值。该值由
   * SelectedFeatureIdPipelineStage 设置。
   *
   * @type {boolean}
   * @default false
   *
   * @private
   */
  this.hasPropertyTable = false;

  /**
   * 该原始类型的索引。
   *
   * @type {ModelComponents.Indices}
   * @readonly
   *
   * @private
   */
  this.indices = primitive.indices;

  /**
   * 线框模式下的额外索引缓冲区（如果启用）。该值由
   * WireframePipelineStage 设置。
   *
   * @type {Buffer}
   * @readonly
   *
   * @private
   */
  this.wireframeIndexBuffer = undefined;

  /**
   * 如 TRIANGLES 或 POINTS 这样的原始类型。
   *
   * @type {PrimitiveType}
   * @readonly
   *
   * @private
   */
  this.primitiveType = primitive.primitiveType;

  const positionMinMax = ModelUtility.getPositionMinMax(
    primitive,
    this.runtimeNode.instancingTranslationMin,
    this.runtimeNode.instancingTranslationMax,
  );

  /**
   * 该原始类型的最小位置值。
   *
   * @type {Cartesian3}
   * @readonly
   *
   * @private
   */
  this.positionMin = Cartesian3.clone(positionMinMax.min, new Cartesian3());

  /**
   * 该原始类型的最大位置值。
   *
   * @type {Cartesian3}
   * @readonly
   *
   * @private
   */
  this.positionMax = Cartesian3.clone(positionMinMax.max, new Cartesian3());

  /**
   * 包含该原始类型所有顶点的边界球体。
   *
   * @type {BoundingSphere}
   * @readonly
   *
   * @private
   */
  this.boundingSphere = BoundingSphere.fromCornerPoints(
    this.positionMin,
    this.positionMax,
    new BoundingSphere(),
  );

  /**
   * 配置光照阶段的选项，例如选择
   * 无光照与 PBR 着色方式。
   *
   * @type {ModelLightingOptions}
   * @readonly
   *
   * @private
   */
  this.lightingOptions = new ModelLightingOptions();

  /**
   * 用于选择的着色器变量。如果启用选择功能，该值由
   * PickingPipelineStage 设置。
   *
   * @type {string|undefined}
   *
   * @private
   */
  this.pickId = undefined;

  /**
   * 在捕捉过程中写入的 float snap 载荷的着色器表达式，
   * 在 Scene#snap 中查看。如果启用选择功能，该值由
   * PickingPipelineStage 设置。
   *
   * @type {string|undefined}
   *
   * @private
   */
  this.snapId = undefined;
}

export default PrimitiveRenderResources;