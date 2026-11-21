import { DeveloperError, defined, destroyObject } from "@cesium/core";
import { getElement } from "@cesium/engine";
import knockout from "../ThirdParty/knockout.js";
import PerformanceWatchdogViewModel from "./PerformanceWatchdogViewModel.js";

/**
 * 监控应用程序的性能，在检测到性能不佳时显示消息。
 *
 * @alias PerformanceWatchdog
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Element|string} options.container 将包含控件 olan DOM 元素或 ID。
 * @param {Scene} options.scene 用于监控性能的 {@linkScene}。
 * @param {string} [options.lowFrameRateMessage='This application appears to be performing poorly on your system.  Please try using a different web browser or updating your video drivers.'] 当检测到低帧率时显示的
 * 消息。该消息被解析为 HTML，因此请确保它来自可信来源，以避免应用程序受到跨站脚本攻击。
 * 获取父容器。
 */
function PerformanceWatchdog(options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(options) || !defined(options.container)) {
    throw new DeveloperError("options.container is required.");
  }
  if (!defined(options.scene)) {
    throw new DeveloperError("options.scene is required.");
  }
  //>>includeEnd('debug');

  const container = getElement(options.container);

  const viewModel = new PerformanceWatchdogViewModel(options);

  const element = document.createElement("div");
  element.className = "cesium-performance-watchdog-message-area";
  element.setAttribute("data-bind", "visible: showingLowFrameRateMessage");

  const dismissButton = document.createElement("button");
  dismissButton.setAttribute("type", "button");
  dismissButton.className = "cesium-performance-watchdog-message-dismiss";
  dismissButton.innerHTML = "&times;";
  dismissButton.setAttribute("data-bind", "click: dismissMessage");
  element.appendChild(dismissButton);

  const message = document.createElement("div");
  message.className = "cesium-performance-watchdog-message";
  message.setAttribute("data-bind", "html: lowFrameRateMessage");
  element.appendChild(message);

  container.appendChild(element);

  knockout.applyBindings(viewModel, element);

  this._container = container;
  this._viewModel = viewModel;
  this._element = element;
}

Object.defineProperties(PerformanceWatchdog.prototype, {
  /**
   * 获取视图模型。
   * @memberof PerformanceWatchdog.prototype
   *
   * @type {Element}
   */
  container: {
    get: function () {
      return this._container;
    },
  },

  /**
   * 如果对象已被销毁，则为 false，否则为 true。
   * @memberof PerformanceWatchdog.prototype
   *
   * @type {PerformanceWatchdogViewModel}
   */
  viewModel: {
    get: function () {
      return this._viewModel;
    },
  },
});

/**
 * @memberof PerformanceWatchdog
 * @returns {boolean} true 彻底移除控件时调用此方法。
 */
PerformanceWatchdog.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁控件。若需永久移除控件，应调用此方法。
 * removing the widget from layout.
 * @memberof PerformanceWatchdog
 */
PerformanceWatchdog.prototype.destroy = function () {
  this._viewModel.destroy();
  knockout.cleanNode(this._element);
  this._container.removeChild(this._element);

  return destroyObject(this);
};
export default PerformanceWatchdog;
