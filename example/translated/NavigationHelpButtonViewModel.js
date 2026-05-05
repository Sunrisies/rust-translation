import knockout from "../ThirdParty/knockout.js";
import createCommand from "../createCommand.js";

/**
 * {@link NavigationHelpButton} 的视图模型。
 * @alias NavigationHelpButtonViewModel
 * @constructor
 */
function NavigationHelpButtonViewModel() {
  /**
   * 获取或设置当前是否显示这些指令。此属性是可观察的。
   * @type {boolean}
   * @default false
   */
  this.showInstructions = false;

  const that = this;
  this._command = createCommand(function () {
    that.showInstructions = !that.showInstructions;
  });
  this._showClick = createCommand(function () {
    that._touch = false;
  });
  this._showTouch = createCommand(function () {
    that._touch = true;
  });

  this._touch = false;

  /**
   * 获取或设置工具提示。此属性是可观察的。
   *
   * @type {string}
   */
  this.tooltip = "Navigation Instructions";

  knockout.track(this, ["tooltip", "showInstructions", "_touch"]);
}

Object.defineProperties(NavigationHelpButtonViewModel.prototype, {
  /**
   * 获取当按钮被点击时执行的命令。
   * @memberof NavigationHelpButtonViewModel.prototype
   *
   * @type {Command}
   */
  command: {
    get: function () {
      return this._command;
    },
  },

  /**
   * 获取在显示鼠标指令时应执行的命令。
   * @memberof NavigationHelpButtonViewModel.prototype
   *
   * @type {Command}
   */
  showClick: {
    get: function () {
      return this._showClick;
    },
  },

  /**
   * 获取在显示触摸指令时应执行的命令。
   * @memberof NavigationHelpButtonViewModel.prototype
   *
   * @type {Command}
   */
  showTouch: {
    get: function () {
      return this._showTouch;
    },
  },
});
export default NavigationHelpButtonViewModel;
