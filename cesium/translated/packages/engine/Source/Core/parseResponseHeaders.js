/**
 * 将 XMLHttpRequest 的 getAllResponseHeaders() 方法的返回值解析为
 * 一个字典。
 *
 * @function parseResponseHeaders
 *
 * @param {string} headerString 由 getAllResponseHeaders() 返回的头部字符串。其格式如下：
 * 参见 http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders()-method
 * @returns {object} A 键值对字典，其中每个键是头部的名称，对应的值则是该头部的值。
 * 
 *
 * @private
 */
function parseResponseHeaders(headerString) {
  const headers = {};

  if (!headerString) {
    return headers;
  }

  const headerPairs = headerString.split("\u000d\u000a");

  for (let i = 0; i < headerPairs.length; ++i) {
    const headerPair = headerPairs[i];
    // Can't use split() here because it does the wrong thing
    // if the header value has the string ": " in it.
    const index = headerPair.indexOf("\u003a\u0020");
    if (index > 0) {
      const key = headerPair.substring(0, index);
      const val = headerPair.substring(index + 2);
      headers[key] = val;
    }
  }

  return headers;
}
export default parseResponseHeaders;
