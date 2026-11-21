import { Frozen } from "@cesium/core";

/**
 * 浏览器支持的图片格式。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.webp=false] 浏览器是否支持 WebP 图片。
 * @param {boolean} [options.basis=false] 浏览器是否支持用于查看 KTX2 + Basis Universal 图片的压缩纹理。
 *
 * @private
 */
function SupportedImageFormats(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  this.webp = options.webp ?? false;
  this.basis = options.basis ?? false;
}

export default SupportedImageFormats;
