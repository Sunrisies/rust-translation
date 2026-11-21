import { DeveloperError, Event, defined } from "@cesium/core";
import knockout from "./ThirdParty/knockout.js";

/**
 * 从给定函数创建一个 Command，用于与 ViewModel 一起使用。
 *
 * Command 是一个带有额外 <code>canExecute</code> 观察器属性的函数，用于确定
 * 该命令是否可以被执行。当被执行时，Command 函数会检查
 * <code>canExecute</code> 的值，如果为 false 则抛出异常。它还提供事件，在
 * 命令已执行或即将执行时触发。
 *
 * @function
 *
 * @param {Function} func 要执行的函数。
 * @param {boolean} [canExecute=true] 一个布尔值，表示该函数当前是否可以被执行。
 */
function createCommand(func, canExecute) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(func)) {
    throw new DeveloperError("func is required.");
  }
  //>>includeEnd('debug');

  canExecute = canExecute ?? true;

  const beforeExecute = new Event();
  const afterExecute = new Event();

  function command() {
    //>>includeStart('debug', pragmas.debug);
    if (!command.canExecute) {
      throw new DeveloperError("Cannot execute command, canExecute is false.");
    }
    //>>includeEnd('debug');

    const commandInfo = {
      args: arguments,
      cancel: false,
    };

    let result;
    beforeExecute.raiseEvent(commandInfo);
    if (!commandInfo.cancel) {
      result = func.apply(null, arguments);
      afterExecute.raiseEvent(result);
    }
    return result;
  }

  command.canExecute = canExecute;
  knockout.track(command, ["canExecute"]);

  Object.defineProperties(command, {
    beforeExecute: {
      value: beforeExecute,
    },
    afterExecute: {
      value: afterExecute,
    },
  });

  return command;
}
export default createCommand;
