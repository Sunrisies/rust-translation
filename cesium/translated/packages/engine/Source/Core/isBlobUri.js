import { Check } from "@cesium/core";

const blobUriRegex = /^blob:/i;

/**
 * 确定指定的 URI 是否为 Blob URI。
 *
 * @function isBlobUri
 *
 * @param {string} uri 要测试的 URI。
 * @returns {boolean} true 当 URI 为 Blob URI 时返回 true；否则返回 false。
 *
 * @private
 */
function isBlobUri(uri) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("uri", uri);
  //>>includeEnd('debug');

  return blobUriRegex.test(uri);
}
export default isBlobUri;
