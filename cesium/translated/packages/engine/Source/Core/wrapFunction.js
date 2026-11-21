import { DeveloperError } from "@cesium/core";

/**
 * 在提供的对象上封装一个函数，并在该对象的上下文中调用另一个函数，从而确保新函数总是优先被调用。
 * 使得旧函数总是在新函数之前执行。
 * before the old one.
 *
 * @internal
 */
function wrapFunction(obj, oldFunction, newFunction) {
  //>>includeStart('debug', pragmas.debug);
  if (typeof oldFunction !== "function") {
    throw new DeveloperError("oldFunction is required to be a function.");
  }

  if (typeof newFunction !== "function") {
    throw new DeveloperError("oldFunction is required to be a function.");
  }
  //>>includeEnd('debug');

  return function () {
    newFunction.apply(obj, arguments);
    oldFunction.apply(obj, arguments);
  };
}
export default wrapFunction;
