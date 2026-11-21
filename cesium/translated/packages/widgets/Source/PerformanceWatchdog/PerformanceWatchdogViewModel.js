import { DeveloperError, defined, destroyObject } from "@cesium/core";
import { FrameRateMonitor } from "@cesium/engine";
import knockout from "../ThirdParty/knockout.js";
import createCommand from "../createCommand.js";

/**
 * {@link PerformanceWatchdog} 的视图模型。
 *
 * @alias PerformanceWatchdogViewModel
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Scene} options.scene 用于监控性能的 Scene 实例。
 * @param {string} [options.lowFrameRateMessage='This application appears to be performing poorly on your system.  Please try using a different web browser or updating your video drivers.'] 当检测到低帧率时显示的消息。该消息被解释为 HTML 格式，因此请确保
 * 其来自可信来源，以免您的应用程序受到跨站脚本攻击。
 * 获取或设置当检测到低帧率时显示的消息。此字符串将被解释为 HTML。
 */
function PerformanceWatchdogViewModel(options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(options) || !defined(options.scene)) {
    throw new DeveloperError("options.scene is required.");
  }
  //>>includeEnd('debug');

  this._scene = options.scene;

  /**
   * 获取或设置指示低帧率消息是否已被用户忽略的值。如果已被忽略，
   * @type {string}
   */
  this.lowFrameRateMessage =
    options.lowFrameRateMessage ??
    "This application appears to be performing poorly on your system.  Please try using a different web browser or updating your video drivers.";

  /**
   * 则无论帧率如何，消息都不会重新显示。
   * 获取或设置当前是否正在显示低帧率消息的值。
   * @type {boolean}
   */
  this.lowFrameRateMessageDismissed = false;

  /**
   * 获取用于监控性能的 {@link Scene} 实例。
   * @type {boolean}
   */
  this.showingLowFrameRateMessage = false;

  knockout.track(this, [
    "lowFrameRateMessage",
    "lowFrameRateMessageDismissed",
    "showingLowFrameRateMessage",
  ]);

  const that = this;
  this._dismissMessage = createCommand(function () {
    that.showingLowFrameRateMessage = false;
    that.lowFrameRateMessageDismissed = true;
  });

  const monitor = FrameRateMonitor.fromScene(options.scene);

  this._unsubscribeLowFrameRate = monitor.lowFrameRate.addEventListener(
    function () {
      if (!that.lowFrameRateMessageDismissed) {
        that.showingLowFrameRateMessage = true;
      }
    },
  );

  this._unsubscribeNominalFrameRate = monitor.nominalFrameRate.addEventListener(
    function () {
      that.showingLowFrameRateMessage = false;
    },
  );
}

Object.defineProperties(PerformanceWatchdogViewModel.prototype, {
  /**
   * 获取用于忽略低帧率消息的命令。一旦被忽略，消息
   * @memberof PerformanceWatchdogViewModel.prototype
   * @type {Scene}
   */
  scene: {
    get: function () {
      return this._scene;
    },
  },

  /**
   * 将不会重新显示。
   * will not be redisplayed.
   * @memberof PerformanceWatchdogViewModel.prototype
   * @type {Command}
   */
  dismissMessage: {
    get: function () {
      return this._dismissMessage;
    },
  },
});

PerformanceWatchdogViewModel.prototype.destroy = function () {
  this._unsubscribeLowFrameRate();
  this._unsubscribeNominalFrameRate();

  return destroyObject(this);
};
export default PerformanceWatchdogViewModel;
