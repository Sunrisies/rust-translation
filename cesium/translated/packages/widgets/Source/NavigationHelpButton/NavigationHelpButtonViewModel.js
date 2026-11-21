import knockout from "../ThirdParty/knockout.js";
import createCommand from "../createCommand.js";

/**
 * {@link NavigationHelpButton} 的视图模型。
 * @alias NavigationHelpButtonViewModel
 * @constructor
 */
function NavigationHelpButtonViewModel() {
  /**
   * 获取或设置是否当前显示说明文字。此属性可观察。
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
   * 获取或设置工具提示。此属性可观察。
   *
   * @type {string}
   */
  this.tooltip = "Navigation Instructions";

  knockout.track(this, ["tooltip", "showInstructions", "_touch"]);
}

Object.defineProperties(NavigationHelpButtonViewModel.prototype, {
  /**
   * 获取点击按钮时执行的命令。
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
   * 获取鼠标说明应显示时执行的命令。
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
   * 获取触摸说明应显示时执行的命令。
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
