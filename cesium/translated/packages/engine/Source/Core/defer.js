/**
 * 用于在完成时解析承诺的函数。
 * @callback defer.resolve
 *
 * @param {*} value 结果值。
 */

/**
 * 用于在失败时拒绝承诺的函数。
 * @callback defer.reject
 *
 * @param {*} error 错误信息。
 */

/**
 * 包含承诺对象的对象，用于解析或拒绝承诺。
 *
 * @typedef {object} defer.deferred
 * @property {defer.resolve} resolve 调用时解析承诺。
 * @property {defer.reject} reject 调用时拒绝承诺。
 * @property {Promise} promise 承诺对象。
 */

/**
 * 创建一个延迟对象，包含承诺对象，用于解析或拒绝承诺。
 * @returns {defer.deferred}
 * @private
 */
function defer() {
  let resolve;
  let reject;
  const promise = new Promise(function (res, rej) {
    resolve = res;
    reject = rej;
  });

  return {
    resolve: resolve,
    reject: reject,
    promise: promise,
  };
}

export default defer;
