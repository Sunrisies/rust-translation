import { Check } from "@cesium/core";
import Resource from "./Resource.js";
import KTX2Transcoder from "./KTX2Transcoder.js";

/**
 * 存储 KTX2 可转码支持的格式。在创建上下文时调用。
 *
 * @param {boolean} s3tc 是否支持 S3TC 格式
 * @param {boolean} pvrtc 是否支持 PVRTC 格式
 * @param {boolean} astc 是否支持 ASTC 格式
 * @param {boolean} etc 是否支持 ETC 格式
 * @param {boolean} etc1 是否支持 ETC1 格式
 * @param {boolean} bc7 是否支持 BC7 格式
 * @private
 */
let supportedTranscoderFormats;

loadKTX2.setKTX2SupportedFormats = function (
  s3tc,
  pvrtc,
  astc,
  etc,
  etc1,
  bc7,
) {
  supportedTranscoderFormats = {
    s3tc: s3tc,
    pvrtc: pvrtc,
    astc: astc,
    etc: etc,
    etc1: etc1,
    bc7: bc7,
  };
};

/**
 * 异步加载并解析给定 URL 为 KTX2 文件，或解析 KTX2 文件的原始二进制数据。
 * 返回一个承诺，在数据加载完成后将返回一个包含图像缓冲区、宽度、高度和格式的对象，
 * 如果 URL 无法加载或无法解析数据，则拒绝承诺。数据通过 XMLHttpRequest 加载，这意味着向其他源发送请求时，
 * using XMLHttpRequest, which means that in order to make requests to another origin,
 * 服务器必须启用跨源资源共享 (CORS) 头。
 * <p>
 * 以下属于 KTX2 格式规范的一部分，但不被支持：
 * <ul>
 * <li>元数据</li>
 * <li>3D 纹理</li>
 * <li>纹理数组</li>
 * <li>视频</li>
 * </ul>
 * </p>
 *
 * @function loadKTX2
 *
 * @param {Resource|string|ArrayBuffer} resourceOrUrlOrBuffer 二进制数据的 URL 或 ArrayBuffer。
 * @returns {Promise<CompressedTextureBuffer>|undefined} A 返回一个承诺，在数据加载完成后将返回请求的数据。如果 <code>request.throttle</code> 为 true 且请求优先级不够高，则返回 undefined。
 *
 * @exception {RuntimeError} Invalid KTX2 文件。
 * @exception {RuntimeError} KTX2 不支持纹理数组。
 * @exception {RuntimeError} KTX2 不支持 3D 纹理。
 * @exception {RuntimeError} No 适用于 ETC1S 压缩 KTX2S 的转码格式目标。
 * @exception {RuntimeError} No 适用于 UASTC 压缩 KTX2S 的转码格式目标。
 * @exception {RuntimeError} startTranscoding() 失败。
 * @exception {RuntimeError} transcodeImage() 失败。
 *
 * @example
 * // 异步加载单个 URL
 * Cesium.loadKTX2('some/url').then(function (ktx2Data) {
 * const width = ktx2Data.width;
 * const height = ktx2Data.height;
 * const format = ktx2Data.internalFormat;
 * const arrayBufferView = ktx2Data.bufferView;
 * // 使用数据创建纹理
 * }).catch(function (error) {
 * // 发生错误。
 * });
 *
 * @see {@link https://github.com/KhronosGroup/KTX-Specification|KTX file format}
 * @see {@link http://www.w3.org/TR/cors/|Cross-Origin Resource Sharing}
 * @see {@link http://wiki.commonjs.org/wiki/Promises/A|CommonJS Promises/A}
 * @private
 */
function loadKTX2(resourceOrUrlOrBuffer) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("resourceOrUrlOrBuffer", resourceOrUrlOrBuffer);
  //>>includeEnd('debug');

  let loadPromise;
  if (
    resourceOrUrlOrBuffer instanceof ArrayBuffer ||
    ArrayBuffer.isView(resourceOrUrlOrBuffer)
  ) {
    loadPromise = Promise.resolve(resourceOrUrlOrBuffer);
  } else {
    const resource = Resource.createIfNeeded(resourceOrUrlOrBuffer);
    loadPromise = resource.fetchArrayBuffer();
  }

  // load module then return
  return loadPromise.then(function (data) {
    return KTX2Transcoder.transcode(data, supportedTranscoderFormats);
  });
}

export default loadKTX2;
