import { Check, DeveloperError, defined } from "@cesium/core";
import Resource from "../Core/Resource.js";
import CubeMap from "./CubeMap.js";

/**
 * 异步加载六张图像并创建立方体映射。返回一个承诺，
 * 在加载完成后将解析为 {@link CubeMap}，如果任何图像无法加载则拒绝。
 *
 * @function loadCubeMap
 *
 * @param {Context} context 用于创建立方体映射的上下文。
 * @param {object} urls 每张图像的源 URL。请参见下面的示例。
 * @param {boolean} [skipColorSpaceConversion=false] 如果为 true，图像中的自定义伽马或颜色配置文件将被忽略。
 * @returns {Promise<CubeMap>} a 承诺在加载完成后解析为请求的 {@link CubeMap}。
 *
 * @exception {DeveloperError} context 是必需的。
 * @exception {DeveloperError} urls 是必需的，且必须具有 positiveX、negativeX、positiveY、negativeY、positiveZ 和 negativeZ 属性。
 *
 *
 * @example
 * Cesium.loadCubeMap(context, {
 * positiveX : 'skybox_px.png',
 * negativeX : 'skybox_nx.png',
 * positiveY : 'skybox_py.png',
 * negativeY : 'skybox_ny.png',
 * positiveZ : 'skybox_pz.png',
 * negativeZ : 'skybox_nz.png'
 * }).then(function(cubeMap) {
 * // 使用立方体映射
 * }).catch(function(error) {
 * // 发生错误
 * });
 *
 * @see {@link http://www.w3.org/TR/cors/|Cross-Origin Resource Sharing}
 * @see {@link http://wiki.commonjs.org/wiki/Promises/A|CommonJS Promises/A}
 *
 * @private
 */
function loadCubeMap(context, urls, skipColorSpaceConversion) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("context", context);
  Check.defined("urls", urls);
  if (
    Object.values(CubeMap.FaceName).some((faceName) => !defined(urls[faceName]))
  ) {
    throw new DeveloperError(
      "urls must have positiveX, negativeX, positiveY, negativeY, positiveZ, and negativeZ properties.",
    );
  }
  //>>includeEnd('debug');

  // PERFORMANCE_IDEA: Given the size of some cube maps, we should consider tiling them, which
  // would prevent hiccups when uploading, for example, six 4096x4096 textures to the GPU.
  //
  // Also, it is perhaps acceptable to use the context here in the callbacks, but
  // ideally, we would do it in the primitive's update function.
  const flipOptions = {
    flipY: true,
    skipColorSpaceConversion: skipColorSpaceConversion,
    preferImageBitmap: true,
  };

  const facePromises = [
    Resource.createIfNeeded(urls.positiveX).fetchImage(flipOptions),
    Resource.createIfNeeded(urls.negativeX).fetchImage(flipOptions),
    Resource.createIfNeeded(urls.positiveY).fetchImage(flipOptions),
    Resource.createIfNeeded(urls.negativeY).fetchImage(flipOptions),
    Resource.createIfNeeded(urls.positiveZ).fetchImage(flipOptions),
    Resource.createIfNeeded(urls.negativeZ).fetchImage(flipOptions),
  ];

  return Promise.all(facePromises).then(function (images) {
    return new CubeMap({
      context: context,
      source: {
        positiveX: images[0],
        negativeX: images[1],
        positiveY: images[2],
        negativeY: images[3],
        positiveZ: images[4],
        negativeZ: images[5],
      },
    });
  });
}
export default loadCubeMap;
