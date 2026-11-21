import { defined } from "@cesium/core";
import ImageryState from "./ImageryState.js";

/**
 * 地形瓦片与影像瓦片之间的关联。
 *
 * @alias TileImagery
 * @private
 *
 * @param {Imagery} imagery 影像瓦片。
 * @param {Cartesian4} textureCoordinateRectangle 被影像覆盖的瓦片纹理矩形。
 * 其中 X=西，Y=南，Z=东，W=北。
 * @param {boolean} useWebMercatorT 为使用该影像瓦片的 Web Mercator 纹理坐标设定为 true。
 */
function TileImagery(imagery, textureCoordinateRectangle, useWebMercatorT) {
  this.readyImagery = undefined;
  this.loadingImagery = imagery;
  this.textureCoordinateRectangle = textureCoordinateRectangle;
  this.textureTranslationAndScale = undefined;
  this.useWebMercatorT = useWebMercatorT;
}

/**
 * 释放此实例所持有的资源。
 */
TileImagery.prototype.freeResources = function () {
  if (defined(this.readyImagery)) {
    this.readyImagery.releaseReference();
  }

  if (defined(this.loadingImagery)) {
    this.loadingImagery.releaseReference();
  }
};

/**
 * 处理此实例的加载状态机。
 *
 * @param {QuadtreeTile} tile 此实例所属的瓦片。
 * @param {FrameState} frameState frameState。
 * @param {boolean} skipLoading 设为 true 可跳过加载，例如新请求或纹理创建。此函数将
 * 仍然同步处理已经大部分准备就绪的影像，例如使用已在祖先瓦片上加载的纹理。
 * 如果此实例已完成加载；否则为 false。
 * @returns {boolean} True if this instance is done loading; otherwise, false.
 */
TileImagery.prototype.processStateMachine = function (
  tile,
  frameState,
  skipLoading,
) {
  const loadingImagery = this.loadingImagery;
  const imageryLayer = loadingImagery.imageryLayer;

  loadingImagery.processStateMachine(
    frameState,
    !this.useWebMercatorT,
    skipLoading,
  );

  if (loadingImagery.state === ImageryState.READY) {
    if (defined(this.readyImagery)) {
      this.readyImagery.releaseReference();
    }
    this.readyImagery = this.loadingImagery;
    this.loadingImagery = undefined;
    this.textureTranslationAndScale =
      imageryLayer._calculateTextureTranslationAndScale(tile, this);
    return true; // done loading
  }

  // Find some ancestor imagery we can use while this imagery is still loading.
  let ancestor = loadingImagery.parent;
  let closestAncestorThatNeedsLoading;
  while (
    defined(ancestor) &&
    (ancestor.state !== ImageryState.READY ||
      (!this.useWebMercatorT && !defined(ancestor.texture)))
  ) {
    if (
      ancestor.state !== ImageryState.FAILED &&
      ancestor.state !== ImageryState.INVALID
    ) {
      // ancestor is still loading
      closestAncestorThatNeedsLoading =
        closestAncestorThatNeedsLoading || ancestor;
    }
    ancestor = ancestor.parent;
  }

  if (this.readyImagery !== ancestor) {
    if (defined(this.readyImagery)) {
      this.readyImagery.releaseReference();
    }

    this.readyImagery = ancestor;

    if (defined(ancestor)) {
      ancestor.addReference();
      this.textureTranslationAndScale =
        imageryLayer._calculateTextureTranslationAndScale(tile, this);
    }
  }

  if (
    loadingImagery.state === ImageryState.FAILED ||
    loadingImagery.state === ImageryState.INVALID
  ) {
    // The imagery tile is failed or invalid, so we'd like to use an ancestor instead.
    if (defined(closestAncestorThatNeedsLoading)) {
      // Push the ancestor's load process along a bit.  This is necessary because some ancestor imagery
      // tiles may not be attached directly to a terrain tile.  Such tiles will never load if
      // we don't do it here.
      closestAncestorThatNeedsLoading.processStateMachine(
        frameState,
        !this.useWebMercatorT,
        skipLoading,
      );
      return false; // not done loading
    }
    // This imagery tile is failed or invalid, and we have the "best available" substitute.
    return true; // done loading
  }

  return false; // not done loading
};
export default TileImagery;
