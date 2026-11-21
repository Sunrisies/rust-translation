import { DeveloperError } from "@cesium/core";

/**
 * 命令是一个具有额外 <code>canExecute</code> 可观察属性的函数，用于确定
 * 该命令是否可以被执行。当被执行时，命令函数会检查
 * <code>canExecute</code> 的值，如果为 false 则抛出异常。
 *
 * 这种类型描述了一个接口，不打算直接实例化。
 * 请参阅 {@link createCommand} 从函数创建命令。
 *
 * @alias Command
 * @constructor
 */
function Command() {
  /**
   * 获取当前该命令是否可以被执行。此属性是可观察的。
   * @type {boolean}
   * @default undefined
   */
  this.canExecute = undefined;

  /**
   * 获取在命令执行前引发的事件，该事件
   * 以一个包含两个属性的对象触发：一个 <code>cancel</code> 属性，
   * 如果监听器将它设置为 false，则阻止命令被执行；以及一个 <code>args</code> 属性，即传递给命令的参数数组。
   * 获取在命令执行后引发的事件，该事件
   * @type {Event}
   * @default undefined
   */
  this.beforeExecute = undefined;

  /**
   * 以一个命令的返回值作为唯一参数来触发。
   * is raised with the return value of the command as its only parameter.
   * @type {Event}
   * @default undefined
   */
  this.afterExecute = undefined;

  DeveloperError.throwInstantiationError();
}
export default Command;
