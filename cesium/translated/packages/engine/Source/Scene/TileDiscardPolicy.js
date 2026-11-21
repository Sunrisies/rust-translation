import { DeveloperError } from "@cesium/core";

/**
 * 一种根据特定标准丢弃瓦片图像的策略。此类型描述了一个接口，不可直接实例化。
 * 决定丢弃策略是否准备好处理图像。
 *
 * @alias TileDiscardPolicy
 * @constructor
 *
 * @see DiscardMissingTileImagePolicy
 * @see NeverTileDiscardPolicy
 */
function TileDiscardPolicy(options) {
  DeveloperError.throwInstantiationError();
}

/**
 * 如果丢弃策略准备好处理图像，则返回 true；否则返回 false。
 * @function
 *
 * @returns {boolean} True 如果丢弃策略准备好处理图像，则返回 true；否则返回 false。
 */
TileDiscardPolicy.prototype.isReady = DeveloperError.throwInstantiationError;

/**
 * 给定一张瓦片图像，决定是否应丢弃该图像。
 * @function
 *
 * @param {HTMLImageElement} image 要测试的图像。
 * @returns {boolean} True 如果图像应被丢弃，则返回 true；否则返回 false。
 */
TileDiscardPolicy.prototype.shouldDiscardImage =
  DeveloperError.throwInstantiationError;
export default TileDiscardPolicy;
