import { Check } from "@cesium/core";
import ModelAlphaOptions from "./ModelAlphaOptions.js";
import RenderState from "../../Renderer/RenderState.js";
import ShaderBuilder from "../../Renderer/ShaderBuilder.js";
import DepthFunction from "../DepthFunction.js";

/**
 * 模型渲染资源用于设置在整个模型中保持一致的细节。
 * 整个模型。
 *
 * @constructor
 * @param {Model} model 将被渲染的模型。
 *
 * @private
 */
function ModelRenderResources(model) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("model", model);
  //>>includeEnd('debug');

  /**
   * 用于逐步构建着色器的对象。每个管道阶段
   * 都可能向该对象添加着色器代码行。
   *
   * @type {ShaderBuilder}
   * @readonly
   *
   * @ignore
   */
  this.shaderBuilder = new ShaderBuilder();

  /**
   * 对模型的引用。
   *
   * @type {Model}
   * @readonly
   *
   * @private
   */
  this.model = model;

  /**
   * 将统一名称与返回该统一值的函数进行映射的字典。
   * 配置 alpha 阶段的选项，如通道和 alpha 截断值。
   *
   * @type {Object<string, Function>}
   *
   * @ignore
   */
  this.uniformMap = {};

  /**
   * 用于创建 {@link RenderState} 的选项对象。
   *
   * @type {ModelAlphaOptions}
   * @readonly
   *
   * @private
   */
  this.alphaOptions = new ModelAlphaOptions();

  /**
   * An object storing options for creating a {@link RenderState}.
   * 管道阶段仅设置选项，而渲染状态在
   * 构建 {@link DrawCommand} 时创建。
   *
   * @type {object}
   * @readonly
   *
   * @private
   */
  this.renderStateOptions = RenderState.getState(
    RenderState.fromCache({
      depthTest: {
        enabled: true,
        func: DepthFunction.LESS_OR_EQUAL,
      },
    }),
  );

  /**
   * 模型是否具有轮廓。该值指示需要哪些绘制命令，并由 ModelSilhouettePipelineStage 设置。
   * 模型是否是使用 skipLevelOfDetail
   *
   * @type {boolean}
   * @default false
   *
   * @private
   */
  this.hasSilhouette = false;

  /**
   * 优化的 tileset 的一部分。该值指示需要哪些绘制命令，并由 TilesetPipelineStage 设置。
   * 场景图的节点对应的 NodeRenderResources。
   * 请注意，当某个节点没有运行时节点时，该数组中的元素可能为 <code>undefined</code>。
   *
   * @type {boolean}
   * @default false
   *
   * @private
   */
  this.hasSkipLevelOfDetail = false;

  /**
   * The NodeRenderResources for the nodes of the scene graph.
   *
   * Note that elements of this array may be <code>undefined</code> when
   * there was no runtime node for a certain node.
   *
   * @type {NodeRenderResources[]}
   * @default []
   *
   * @private
   */
  this.nodeRenderResources = [];
}

export default ModelRenderResources;
