import { Check, defined } from "@cesium/core";
import Resource from "./Resource.js";

/**
 * 从类型数组中加载图像。
 * @param {object} options 一个包含以下属性的对象：
 * @param {Uint8Array} options.uint8Array 包含图像数据的类型数组。
 * @param {string} options.format 图像的 MIME 格式（例如，“image/png”）。
 * @param {Request} [options.request] 用于获取图像的请求对象。
 * @param {boolean} [options.flipY=false] 是否垂直翻转图像。
 * @param {boolean} [options.skipColorSpaceConversion=false] 是否跳过颜色空间转换。
 * @returns {Promise<HTMLImageElement|HTMLCanvasElement|ImageBitmap>|undefined} A 解析后得到的加载图像的结果。如果 <code>request.throttle</code> 为 true 且请求优先级不足，则返回 undefined。
 * @private
 */
function loadImageFromTypedArray(options) {
  const { uint8Array, format, request } = options;
  const flipY = options.flipY ?? false;
  const skipColorSpaceConversion = options.skipColorSpaceConversion ?? false;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("uint8Array", uint8Array);
  Check.typeOf.string("format", format);
  //>>includeEnd('debug');

  const blob = new Blob([uint8Array], {
    type: format,
  });

  let blobUrl;
  return Resource.supportsImageBitmapOptions()
    .then(function (result) {
      if (result) {
        return Promise.resolve(
          Resource.createImageBitmapFromBlob(blob, {
            flipY: flipY,
            premultiplyAlpha: false,
            skipColorSpaceConversion: skipColorSpaceConversion,
          }),
        );
      }

      blobUrl = window.URL.createObjectURL(blob);
      const resource = new Resource({
        url: blobUrl,
        request: request,
      });

      return resource.fetchImage({
        flipY: flipY,
        skipColorSpaceConversion: skipColorSpaceConversion,
      });
    })
    .then(function (result) {
      if (defined(blobUrl)) {
        window.URL.revokeObjectURL(blobUrl);
      }
      return result;
    })
    .catch(function (error) {
      if (defined(blobUrl)) {
        window.URL.revokeObjectURL(blobUrl);
      }
      return Promise.reject(error);
    });
}
export default loadImageFromTypedArray;
