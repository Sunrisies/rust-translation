import { defined } from "@cesium/core";

let a;

/**
 * 给定一个 URL，判断该 URL 是否对当前页面属于跨域请求。
 *
 * @private
 */
function isCrossOriginUrl(url) {
  if (!defined(a)) {
    a = document.createElement("a");
  }

  // copy window location into the anchor to get consistent results
  // when the port is default for the protocol (e.g. 80 for HTTP)
  a.href = window.location.href;

  // host includes both hostname and port if the port is not standard
  const host = a.host;
  const protocol = a.protocol;

  a.href = url;
  // IE only absolutizes href on get, not set
  // eslint-disable-next-line no-self-assign
  a.href = a.href;

  return protocol !== a.protocol || host !== a.host;
}
export default isCrossOriginUrl;
