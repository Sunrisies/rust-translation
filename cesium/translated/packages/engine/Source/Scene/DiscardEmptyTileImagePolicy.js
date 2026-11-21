import { defined } from "@cesium/core";

/**
 * 一种用于丢弃不含数据的瓦片图像的策略（因此实际上不是图像）。
 * 该策略会丢弃 {@link DiscardEmptyTileImagePolicy.EMPTY_IMAGE}，该策略
 * 预期被图像加载代码用来替代任何空的瓦片图像。
 *
 * @alias DiscardEmptyTileImagePolicy
 * @constructor
 *
 * @see DiscardMissingTileImagePolicy
 */
function DiscardEmptyTileImagePolicy(options) {}

/**
 * 决定丢弃策略是否准备好处理图像。
 * @returns {boolean} True 如果丢弃策略准备好处理图像，则返回 true；否则返回 false。
 */
DiscardEmptyTileImagePolicy.prototype.isReady = function () {
  return true;
};

/**
 * 针对一个瓦片图像，判断是否应将其丢弃。
 *
 * @param {HTMLImageElement} image 要测试的图像。
 * @returns {boolean} True 如果图像应被丢弃，则返回 true；否则返回 false。
 */
DiscardEmptyTileImagePolicy.prototype.shouldDiscardImage = function (image) {
  return DiscardEmptyTileImagePolicy.EMPTY_IMAGE === image;
};

let emptyImage;

Object.defineProperties(DiscardEmptyTileImagePolicy, {
  /**
   * 表示空图像的默认值。
   * @type {HTMLImageElement}
   * @readonly
   * @memberof DiscardEmptyTileImagePolicy
   */
  EMPTY_IMAGE: {
    get: function () {
      if (!defined(emptyImage)) {
        emptyImage = new Image();
        // load a blank data URI with a 1x1 transparent pixel.
        emptyImage.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      }
      return emptyImage;
    },
  },
});
export default DiscardEmptyTileImagePolicy;
