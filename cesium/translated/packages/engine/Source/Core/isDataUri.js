import { Check } from "@cesium/core";

const dataUriRegex = /^data:/i;

/**
 * 确定指定的 URI 是否为数据 URI。
 *
 * @function isDataUri
 *
 * @param {string} uri 要测试的 URI。
 * @returns {boolean} true 当 URI 为数据 URI 时返回 true；否则返回 false。
 *
 * @private
 */
function isDataUri(uri) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("uri", uri);
  //>>includeEnd('debug');

  return dataUriRegex.test(uri);
}
export default isDataUri;
