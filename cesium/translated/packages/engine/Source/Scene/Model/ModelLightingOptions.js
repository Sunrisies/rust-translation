import { Frozen } from "@cesium/core";
import LightingModel from "./LightingModel.js";

/**
 * 配置 {@link LightingPipelineStage} 的选项
 *
 * @param {object} options 包含以下选项的对象
 * @param {LightingModel} [options.lightingModel=LightingModel.UNLIT] 要使用的照明模型
 *
 * @alias ModelLightingOptions
 * @constructor
 *
 * @private
 */
function ModelLightingOptions(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 要使用的照明模型，例如 UNLIT 或 PBR。此选择由
   * 基元的材质决定。
   *
   * @type {LightingModel}
   *
   * @private
   */
  this.lightingModel = options.lightingModel ?? LightingModel.UNLIT;
}

export default ModelLightingOptions;
