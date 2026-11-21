import { DeveloperError, defined } from "@cesium/core";
import knockout from "../ThirdParty/knockout.js";
import createCommand from "../createCommand.js";

/**
 * {@link HomeButton} 的视图模型。
 * @alias HomeButtonViewModel
 * @constructor
 *
 * @param {Scene} scene 要使用的场景实例。
 * @param {number} [duration] 相机飞行持续时间（单位：秒）。
 */
function HomeButtonViewModel(scene, duration) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(scene)) {
    throw new DeveloperError("scene is required.");
  }
  //>>includeEnd('debug');

  this._scene = scene;
  this._duration = duration;

  const that = this;
  this._command = createCommand(function () {
    that._scene.camera.flyHome(that._duration);
  });

  /**
   * 获取或设置工具提示。此属性可观察。
   *
   * @type {string}
   */
  this.tooltip = "View Home";

  knockout.track(this, ["tooltip"]);
}

Object.defineProperties(HomeButtonViewModel.prototype, {
  /**
   * 获取要控制的场景。
   * @memberof HomeButtonViewModel.prototype
   *
   * @type {Scene}
   */
  scene: {
    get: function () {
      return this._scene;
    },
  },

  /**
   * 获取按钮被点击时执行的命令。
   * @memberof HomeButtonViewModel.prototype
   *
   * @type {Command}
   */
  command: {
    get: function () {
      return this._command;
    },
  },

  /**
   * 获取或设置相机飞行持续时间（单位：秒）。
   * 值为零时，相机将立即切换至主页视图。
   * 未定义时，持续时间将根据距离计算。
   * @memberof HomeButtonViewModel.prototype
   *
   * @type {number|undefined}
   */
  duration: {
    get: function () {
      return this._duration;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value < 0) {
        throw new DeveloperError("value must be positive.");
      }
      //>>includeEnd('debug');

      this._duration = value;
    },
  },
});
export default HomeButtonViewModel;
