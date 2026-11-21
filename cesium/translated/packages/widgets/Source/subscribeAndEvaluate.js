import knockout from "./ThirdParty/knockout.js";

/**
 * 订阅 Knockout observable ES5 属性，并立即触发回调。
 * 传递该属性的当前值。
 *
 * @private
 *
 * @function subscribeAndEvaluate
 *
 * @param {object} owner 包含 observable 属性的对象。
 * @param {string} observablePropertyName observable 属性的名称。
 * @param {Function} callback 回调函数。
 * @param {object} [target] 回调函数中此参数的值。
 * @param {string} [event='change'] 要接收通知的事件名称。
 * @returns The 来自 Knockout 的订阅对象，可用于之后取消订阅。
 */
function subscribeAndEvaluate(
  owner,
  observablePropertyName,
  callback,
  target,
  event,
) {
  callback.call(target, owner[observablePropertyName]);
  return knockout
    .getObservable(owner, observablePropertyName)
    .subscribe(callback, target, event);
}
export default subscribeAndEvaluate;
