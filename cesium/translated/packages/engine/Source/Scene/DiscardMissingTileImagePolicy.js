import { DeveloperError, Frozen, defined } from "@cesium/core";
import getImagePixels from "../Core/getImagePixels.js";
import Resource from "../Core/Resource.js";

/**
 * 一种用于丢弃与已知缺失图像匹配的瓦片图像的策略。
 * “缺失”图像。
 *
 * @alias DiscardMissingTileImagePolicy
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Resource|string} options.missingImageUrl 已知缺失图像的URL。
 * @param {Cartesian2[]} options.pixelsToCheck 一组 {@link Cartesian2} 像素位置数组，用于与缺失图像进行比对。
 * 如果为 true，则丢弃检查将被禁用，
 * @param {boolean} [options.disableCheckIfAllPixelsAreTransparent=false] 当缺失ImageUrl 中的所有像素都具有 alpha 值为 0 时。如果为 false，
 * 则无论 pixelsToCheck 的值如何，丢弃检查仍将继续进行。
 * 决定丢弃策略是否准备好处理图像。
 */
function DiscardMissingTileImagePolicy(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(options.missingImageUrl)) {
    throw new DeveloperError("options.missingImageUrl is required.");
  }

  if (!defined(options.pixelsToCheck)) {
    throw new DeveloperError("options.pixelsToCheck is required.");
  }
  //>>includeEnd('debug');

  this._pixelsToCheck = options.pixelsToCheck;
  this._missingImagePixels = undefined;
  this._missingImageByteLength = undefined;
  this._isReady = false;

  const resource = Resource.createIfNeeded(options.missingImageUrl);

  const that = this;

  function success(image) {
    if (defined(image.blob)) {
      that._missingImageByteLength = image.blob.size;
    }

    let pixels = getImagePixels(image);

    if (options.disableCheckIfAllPixelsAreTransparent) {
      let allAreTransparent = true;
      const width = image.width;

      const pixelsToCheck = options.pixelsToCheck;
      for (
        let i = 0, len = pixelsToCheck.length;
        allAreTransparent && i < len;
        ++i
      ) {
        const pos = pixelsToCheck[i];
        const index = pos.x * 4 + pos.y * width;
        const alpha = pixels[index + 3];

        if (alpha > 0) {
          allAreTransparent = false;
        }
      }

      if (allAreTransparent) {
        pixels = undefined;
      }
    }

    that._missingImagePixels = pixels;
    that._isReady = true;
  }

  function failure() {
    // Failed to download "missing" image, so assume that any truly missing tiles
    // will also fail to download and disable the discard check.
    that._missingImagePixels = undefined;
    that._isReady = true;
  }

  resource
    .fetchImage({
      preferBlob: true,
      preferImageBitmap: true,
      flipY: true,
    })
    .then(success)
    .catch(failure);
}

/**
 * Determines if the discard policy is ready to process images.
 * @returns {boolean} True 如果丢弃策略准备好处理图像，则返回 true；否则返回 false。
 */
DiscardMissingTileImagePolicy.prototype.isReady = function () {
  return this._isReady;
};

/**
 * 针对一个瓦片图像，决定是否将其丢弃。
 *
 * @param {HTMLImageElement} image 要测试的图像。
 * @returns {boolean} True 如果应丢弃该图像，则返回 true；否则返回 false。
 *
 * @exception {DeveloperError} <code>shouldDiscardImage</code> 在丢弃策略准备好之前不得调用此函数。
 */
DiscardMissingTileImagePolicy.prototype.shouldDiscardImage = function (image) {
  //>>includeStart('debug', pragmas.debug);
  if (!this._isReady) {
    throw new DeveloperError(
      "shouldDiscardImage must not be called before the discard policy is ready.",
    );
  }
  //>>includeEnd('debug');

  const pixelsToCheck = this._pixelsToCheck;
  const missingImagePixels = this._missingImagePixels;

  // If missingImagePixels is undefined, it indicates that the discard check has been disabled.
  if (!defined(missingImagePixels)) {
    return false;
  }

  if (defined(image.blob) && image.blob.size !== this._missingImageByteLength) {
    return false;
  }

  const pixels = getImagePixels(image);
  const width = image.width;

  for (let i = 0, len = pixelsToCheck.length; i < len; ++i) {
    const pos = pixelsToCheck[i];
    const index = pos.x * 4 + pos.y * width;
    for (let offset = 0; offset < 4; ++offset) {
      const pixel = index + offset;
      if (pixels[pixel] !== missingImagePixels[pixel]) {
        return false;
      }
    }
  }
  return true;
};
export default DiscardMissingTileImagePolicy;
