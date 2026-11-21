import { DeveloperError, Frozen, defined } from "@cesium/core";
import PerformanceWatchdog from "../PerformanceWatchdog/PerformanceWatchdog.js";

/**
 * 一个混入类，用于将 {@link PerformanceWatchdog} 控件添加到 {@link Viewer} 控件中。
 * 通常不是直接调用此函数，而是将其作为参数传递给
 * {@link Viewer#extend} 方法，如下例所示。
 * @function
 *
 * @param {Viewer} viewer 查看器实例。
 * @param {object} [options] 具有属性的对象。
 * @param {string} [options.lowFrameRateMessage='This application appears to be performing poorly on your system.  Please try using a different web browser or updating your video drivers.'] 当检测到低帧率时显示的
 * 消息。该消息被解析为 HTML 格式，因此请确保其来自可信来源，以避免应用程序受到跨站脚本攻击。
 * 是必需的。
 *
 * @exception {DeveloperError} viewer const viewer = new Cesium.Viewer('cesiumContainer');
 *
 * @example
 * viewer.extend(Cesium.viewerPerformanceWatchdogMixin, {
 * lowFrameRateMessage : '为什么这个运行如此 <em>缓慢</em>？'
 * lowFrameRateMessage : 'Why is this going so <em>slowly</em>?'
 * });
 */
function viewerPerformanceWatchdogMixin(viewer, options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(viewer)) {
    throw new DeveloperError("viewer is required.");
  }
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;

  const performanceWatchdog = new PerformanceWatchdog({
    scene: viewer.scene,
    container: viewer.bottomContainer,
    lowFrameRateMessage: options.lowFrameRateMessage,
  });

  Object.defineProperties(viewer, {
    performanceWatchdog: {
      get: function () {
        return performanceWatchdog;
      },
    },
  });
}
export default viewerPerformanceWatchdogMixin;
