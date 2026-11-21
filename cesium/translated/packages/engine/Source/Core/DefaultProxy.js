/**
 * 一个简单的代理，将所需资源作为唯一的查询参数附加到指定代理 URL 上。
 * 以请求所有资源。
 *
 * @alias DefaultProxy
 * @constructor
 * @extends {Proxy}
 *
 * @param {string} proxy 用于请求所有资源的代理 URL。
 */
function DefaultProxy(proxy) {
  this.proxy = proxy;
}

/**
 * 获取用于请求特定资源的最终 URL。
 *
 * @param {string} resource 要请求的资源。
 * @returns {string} proxied 资源
 */
DefaultProxy.prototype.getURL = function (resource) {
  const prefix = this.proxy.indexOf("?") === -1 ? "?" : "";
  return this.proxy + prefix + encodeURIComponent(resource);
};

export default DefaultProxy;
