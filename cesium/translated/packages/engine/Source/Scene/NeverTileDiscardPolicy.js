/**
 * 一个指定 tiles 图像绝不能被丢弃的 {@link TileDiscardPolicy}。
 *
 * @alias NeverTileDiscardPolicy
 * @constructor
 *
 * @see DiscardMissingTileImagePolicy
 */
function NeverTileDiscardPolicy(options) {}

/**
 * 决定丢弃策略是否准备好处理图像。
 * @returns {boolean} True 如果丢弃策略准备好处理图像，则返回 true；否则返回 false。
 */
NeverTileDiscardPolicy.prototype.isReady = function () {
  return true;
};

/**
 * 针对一个 tiles 图像，判断是否应将其丢弃。
 *
 * @param {HTMLImageElement} image 用于测试的图像。
 * @returns {boolean} True 如果图像应被丢弃，则返回 true；否则返回 false。
 */
NeverTileDiscardPolicy.prototype.shouldDiscardImage = function (image) {
  return false;
};
export default NeverTileDiscardPolicy;
