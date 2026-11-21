import { Frozen, defined } from "@cesium/core";
import RequestState from "./RequestState.js";
import RequestType from "./RequestType.js";

/**
 * 存储用于发起请求的信息。通常无需直接构建。
 *
 * @alias Request
 * @constructor

 * @param {object} [options] 具有以下属性的对象：
 * @param {string} [options.url] 发起请求的 URL。
 * @param {Request.RequestCallback} [options.requestFunction] 发起实际数据请求的函数。
 * @param {Request.CancelCallback} [options.cancelFunction] 请求被取消时调用的函数。
 * @param {Request.PriorityCallback} [options.priorityFunction] 每帧调用一次以更新请求优先级的函数。
 * @param {number} [options.priority=0.0] 请求的初始优先级。
 * @param {boolean} [options.throttle=false] 是否对请求进行节流并设定优先级。若设为 false，请求将立即发送；若设为 true，则根据优先级对请求进行节流和发送。
 * @param {boolean} [options.throttleByServer=false] 是否由服务器对请求进行节流。
 * @param {RequestType} [options.type=RequestType.OTHER] 请求的类型。
 * @param {string} [options.serverKey] 用于标识请求将发送至的服务器的键。
 */
function Request(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const throttleByServer = options.throttleByServer ?? false;
  const throttle = options.throttle ?? false;

  /**
   * 发起请求的 URL。
   *
   * @type {string}
   */
  this.url = options.url;

  /**
   * 发起实际数据请求的函数。
   *
   * @type {Request.RequestCallback}
   */
  this.requestFunction = options.requestFunction;

  /**
   * 请求被取消时调用的函数。
   *
   * @type {Request.CancelCallback}
   */
  this.cancelFunction = options.cancelFunction;

  /**
   * 每帧调用一次以更新请求优先级的函数。
   *
   * @type {Request.PriorityCallback}
   */
  this.priorityFunction = options.priorityFunction;

  /**
   * 优先级为无单位值，数值越小表示优先级越高。
   * 对于基于世界的对象，这通常是与相机的距离。
   * 没有优先级函数的请求默认优先级为 0。
   *
   * 若定义了 priorityFunction，此值将随该调用的结果在每帧更新。
   *
   * @type {number}
   * @default 0.0
   */
  this.priority = options.priority ?? 0.0;

  /**
   * 是否对请求进行节流并设定优先级。若设为 false，请求将立即发送；若设为 true，则
   * 请求将根据优先级进行节流和发送。
   *
   * @type {boolean}
   * @readonly
   *
   * @default false
   */
  this.throttle = throttle;

  /**
   * 是否由服务器对请求进行节流。浏览器通常支持约 6-8 个并行连接
   * 对于 HTTP/1 服务器，以及 HTTP/2 服务器可支持无限数量的连接。将此值设为 <code>true</code>
   * 对于通过 HTTP/1 服务器发送的请求更为合适。
   *
   * @type {boolean}
   * @readonly
   *
   * @default false
   */
  this.throttleByServer = throttleByServer;

  /**
   * 请求的类型。
   *
   * @type {RequestType}
   * @readonly
   *
   * @default RequestType.OTHER
   */
  this.type = options.type ?? RequestType.OTHER;

  /**
   * 用于标识请求将发送至的服务器的键。它源自 URL 的 authority 和 scheme。
   *
   * @type {string}
   *
   * @private
   */
  this.serverKey = options.serverKey;

  /**
   * 请求的当前状态。
   *
   * @type {RequestState}
   * @readonly
   */
  this.state = RequestState.UNISSUED;

  /**
   * 请求的 deferred promise。
   *
   * @type {object}
   *
   * @private
   */
  this.deferred = undefined;

  /**
   * 请求是否被明确取消。
   *
   * @type {boolean}
   *
   * @private
   */
  this.cancelled = false;
}

/**
 * 将请求标记为已取消。
 *
 * @private
 */
Request.prototype.cancel = function () {
  this.cancelled = true;
};

/**
 * 复制 Request 实例。
 *
 * @param {Request} [result] 存储结果的对象。
 *
 * @returns {Request} The 修改后的结果参数，或若未提供则创建新的 Resource 实例。
 */
Request.prototype.clone = function (result) {
  if (!defined(result)) {
    return new Request(this);
  }

  result.url = this.url;
  result.requestFunction = this.requestFunction;
  result.cancelFunction = this.cancelFunction;
  result.priorityFunction = this.priorityFunction;
  result.priority = this.priority;
  result.throttle = this.throttle;
  result.throttleByServer = this.throttleByServer;
  result.type = this.type;
  result.serverKey = this.serverKey;

  // These get defaulted because the cloned request hasn't been issued
  result.state = RequestState.UNISSUED;
  result.deferred = undefined;
  result.cancelled = false;

  return result;
};

/**
 * 发起实际数据请求的函数。
 * @callback Request.RequestCallback
 * @returns {Promise<void>} A 请求数据的 promise。
 */

/**
 * 请求被取消时调用的函数。
 * @callback Request.CancelCallback
 */

/**
 * 每帧调用一次以更新请求优先级的函数。
 * @callback Request.PriorityCallback
 * @returns {number} The 更新的优先级值。
 */
export default Request;
