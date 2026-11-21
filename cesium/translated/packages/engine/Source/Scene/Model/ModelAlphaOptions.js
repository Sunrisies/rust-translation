/**
 * 配置 {@link AlphaPipelineStage} 的选项
 *
 * @alias ModelAlphaOptions
 * @constructor
 *
 * @private
 */
function ModelAlphaOptions() {
  /**
   * 将渲染模型使用的渲染通道
   *
   * @type {Pass}
   * @private
   */
  this.pass = undefined;
  /**
   * 确定 alpha 阈值，低于此阈值的碎片将被丢弃
   *
   * @type {number}
   * @private
   */
  this.alphaCutoff = undefined;
}

export default ModelAlphaOptions;
