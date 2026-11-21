import { DeveloperError, Frozen, defined } from "@cesium/core";
import knockout from "./ThirdParty/knockout.js";

/**
 * 一个展示切换按钮属性的视图模型。
 * @alias ToggleButtonViewModel
 * @constructor
 *
 * @param {Command} command 当按钮被切换时将被执行的命令。
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.toggled=false] 指示按钮是否应初始处于切换状态的布尔值。
 * @param {string} [options.tooltip=''] 包含按钮工具提示的字符串。
 */
function ToggleButtonViewModel(command, options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(command)) {
    throw new DeveloperError("command is required.");
  }
  //>>includeEnd('debug');

  this._command = command;

  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 获取或设置按钮当前是否处于切换状态。该属性可观察。
   * @type {boolean}
   * @default false
   */
  this.toggled = options.toggled ?? false;

  /**
   * 获取或设置按钮的工具提示。该属性可观察。
   * @type {string}
   * @default ''
   */
  this.tooltip = options.tooltip ?? "";

  knockout.track(this, ["toggled", "tooltip"]);
}

Object.defineProperties(ToggleButtonViewModel.prototype, {
  /**
   * 获取当按钮被切换时将被执行的命令。
   * @memberof ToggleButtonViewModel.prototype
   * @type {Command}
   */
  command: {
    get: function () {
      return this._command;
    },
  },
});
export default ToggleButtonViewModel;
