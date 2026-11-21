import { DeveloperError } from "@cesium/core";

/**
 * 用于代理请求的资源类基类。{@link Resource}
 *
 * @alias Proxy
 * @constructor
 *
 * @see DefaultProxy
 */
function Proxy() {
  DeveloperError.throwInstantiationError();
}

/**
 * 获取用于请求特定资源的最终 URL。
 *
 * @param {string} resource 要请求的资源。
 * @returns {string} proxied 资源
 * @function
 */
Proxy.prototype.getURL = DeveloperError.throwInstantiationError;

export default Proxy;
