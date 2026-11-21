import {
  DeveloperError,
  Event,
  TimeConstants,
  defined,
  destroyObject,
  getTimestamp,
} from "@cesium/core";

/**
 * 监控 {@link Scene} 中的帧率（每秒帧数），如果帧率低于阈值，则触发事件。
 * 之后，如果帧率恢复到要求的水平，则再次触发事件。
 * 为了避免为同一个 {@link Scene} 创建多个 FrameRateMonitors，应使用 {@link FrameRateMonitor.fromScene}
 * 而不是显式构造实例。
 *
 * @alias FrameRateMonitor
 * @constructor
 *
 * @param {object} [options] 该对象包含以下属性：
 * @param {Scene} options.scene 用于监控性能的 Scene 实例。
 * @param {number} [options.samplingWindow=5.0] 计算平均帧率时使用的滑动窗口长度，以秒为单位。
 * @param {number} [options.quietPeriod=2.0] 在启动时以及页面每次变得可见（即用户
 * 返回到标签页时）等待的时间长度，以秒为单位，用于开始性能测量。
 * @param {number} [options.warmupPeriod=5.0] 预热期的长度，以秒为单位。在预热期间，需要较低的
 * 帧率。
 * @param {number} [options.minimumFrameRateDuringWarmup=4] 在预热期间，达到可接受性能所需的最小每秒帧数。如果在预热期间的任何 <code>samplingWindow</code> 内平均帧率低于此值，则触发 <code>lowFrameRate</code> 事件，页面将重定向到 <code>redirectOnLowFrameRateUrl</code>（如果存在的话）。
 * the warmup period.  If the frame rate averages less than this during any samplingWindow during the warmupPeriod, the
 * lowFrameRate event will be raised and the page will redirect to the redirectOnLowFrameRateUrl, if any.
 * @param {number} [options.minimumFrameRateAfterWarmup=8] 在预热期结束后，达到可接受性能所需的最小每秒帧数。如果在预热期后的任何 <code>samplingWindow</code> 内平均帧率低于此值，则触发 <code>lowFrameRate</code> 事件，页面将重定向到 <code>redirectOnLowFrameRateUrl</code>（如果存在的话）。
 * the end of the warmup period.  If the frame rate averages less than this during any samplingWindow after the warmupPeriod, the
 * lowFrameRate event will be raised and the page will redirect to the redirectOnLowFrameRateUrl, if any.
 */
function FrameRateMonitor(options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(options) || !defined(options.scene)) {
    throw new DeveloperError("options.scene is required.");
  }
  //>>includeEnd('debug');

  this._scene = options.scene;

  /**
   * 用于计算平均帧率时使用的滑动窗口长度，以秒为单位。
   * @type {number}
   */
  this.samplingWindow =
    options.samplingWindow ?? FrameRateMonitor.defaultSettings.samplingWindow;

  /**
   * 用于启动时以及页面每次变得可见（即用户
   * 返回到标签页时）等待的时间长度，以秒为单位，用于开始性能测量。
   * @type {number}
   */
  this.quietPeriod =
    options.quietPeriod ?? FrameRateMonitor.defaultSettings.quietPeriod;

  /**
   * 用于预热期的长度，以秒为单位。在预热期间，需要较低的
   * 帧率。
   * @type {number}
   */
  this.warmupPeriod =
    options.warmupPeriod ?? FrameRateMonitor.defaultSettings.warmupPeriod;

  /**
   * 在预热期间，达到可接受性能所需的最小每秒帧数。如果在 <code>warmupPeriod</code> 内的任何 <code>samplingWindow</code> 中平均帧率低于此值，则触发
   * <code>lowFrameRate</code> 事件，页面将重定向到 <code>redirectOnLowFrameRateUrl</code>（如果存在的话）。
   * <code>lowFrameRate</code> 事件将被触发，页面将重定向到 <code>redirectOnLowFrameRateUrl</code>（如果存在的话）。
   * @type {number}
   */
  this.minimumFrameRateDuringWarmup =
    options.minimumFrameRateDuringWarmup ??
    FrameRateMonitor.defaultSettings.minimumFrameRateDuringWarmup;

  /**
   * 获取或设置在热身期结束后实现可接受性能所需的最小帧率。
   * 如果在 <code>warmupPeriod</code> 之后的任何 <code>samplingWindow</code> 期间平均帧率低于此值，则将触发 <code>lowFrameRate</code> 事件，页面将重定向至 <code>redirectOnLowFrameRateUrl</code>（如果存在的话）。
   * 这是默认帧率监控设置。当 {@link FrameRateMonitor.fromScene} 需要创建新的帧率监控器，或对于未传递给 {@link FrameRateMonitor} 构造函数设置的参数时，将使用这些设置。
   * @type {number}
   */
  this.minimumFrameRateAfterWarmup =
    options.minimumFrameRateAfterWarmup ??
    FrameRateMonitor.defaultSettings.minimumFrameRateAfterWarmup;

  this._lowFrameRate = new Event();
  this._nominalFrameRate = new Event();

  this._frameTimes = [];
  this._needsQuietPeriod = true;
  this._quietPeriodEndTime = 0.0;
  this._warmupPeriodEndTime = 0.0;
  this._frameRateIsLow = false;
  this._lastFramesPerSecond = undefined;
  this._pauseCount = 0;

  const that = this;
  this._preUpdateRemoveListener = this._scene.preUpdate.addEventListener(
    function (scene, time) {
      update(that, time);
    },
  );

  this._hiddenPropertyName =
    document.hidden !== undefined
      ? "hidden"
      : document.mozHidden !== undefined
        ? "mozHidden"
        : document.msHidden !== undefined
          ? "msHidden"
          : document.webkitHidden !== undefined
            ? "webkitHidden"
            : undefined;

  const visibilityChangeEventName =
    document.hidden !== undefined
      ? "visibilitychange"
      : document.mozHidden !== undefined
        ? "mozvisibilitychange"
        : document.msHidden !== undefined
          ? "msvisibilitychange"
          : document.webkitHidden !== undefined
            ? "webkitvisibilitychange"
            : undefined;

  function visibilityChangeListener() {
    visibilityChanged(that);
  }

  this._visibilityChangeRemoveListener = undefined;
  if (defined(visibilityChangeEventName)) {
    document.addEventListener(
      visibilityChangeEventName,
      visibilityChangeListener,
      false,
    );

    this._visibilityChangeRemoveListener = function () {
      document.removeEventListener(
        visibilityChangeEventName,
        visibilityChangeListener,
        false,
      );
    };
  }
}

/**
 * 获取给定场景的 {@link FrameRateMonitor}。如果场景尚未拥有
 * {@link FrameRateMonitor}，则使用 {@link FrameRateMonitor.defaultSettings} 创建。
 * 获取用于监控性能的 {@link Scene} 实例。
 *
 * @memberof FrameRateMonitor
 * @type {object}
 */
FrameRateMonitor.defaultSettings = {
  samplingWindow: 5.0,
  quietPeriod: 2.0,
  warmupPeriod: 5.0,
  minimumFrameRateDuringWarmup: 4,
  minimumFrameRateAfterWarmup: 8,
};

/**
 * 获取给定场景的 {@link FrameRateMonitor}。如果场景尚未拥有
 * {@link FrameRateMonitor}，则使用 {@link FrameRateMonitor.defaultSettings} 创建。
 *
 * @param {Scene} scene 用于获取 {@link FrameRateMonitor} 的场景。
 * @returns {FrameRateMonitor} The 场景的 {@link FrameRateMonitor}。
 */
FrameRateMonitor.fromScene = function (scene) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(scene)) {
    throw new DeveloperError("scene is required.");
  }
  //>>includeEnd('debug');

  if (
    !defined(scene._frameRateMonitor) ||
    scene._frameRateMonitor.isDestroyed()
  ) {
    scene._frameRateMonitor = new FrameRateMonitor({
      scene: scene,
    });
  }

  return scene._frameRateMonitor;
};

Object.defineProperties(FrameRateMonitor.prototype, {
  /**
   * 获取用于监控性能的 {@link Scene} 实例。
   * @memberof FrameRateMonitor.prototype
   * @type {Scene}
   */
  scene: {
    get: function () {
      return this._scene;
    },
  },

  /**
   * 获取检测到低帧率时触发的事件。该函数将接收
   * {@link Scene} 实例作为其第一个参数，以及采样窗口内的平均每秒帧数作为其第二个参数。
   * 作为第二个参数。
   * @memberof FrameRateMonitor.prototype
   * @type {Event}
   */
  lowFrameRate: {
    get: function () {
      return this._lowFrameRate;
    },
  },

  /**
   * 获取帧率恢复至正常水平时触发的事件。该函数将接收
   * {@link Scene} 实例作为其第一个参数，以及采样窗口内的平均
   * 每秒帧数作为其第二个参数。
   * @memberof FrameRateMonitor.prototype
   * @type {Event}
   */
  nominalFrameRate: {
    get: function () {
      return this._nominalFrameRate;
    },
  },

  /**
   * 获取过去 <code>samplingWindow</code> 内最近计算出的平均每秒帧数。
   * 如果尚未计算帧率，则此属性可能未定义。
   * @memberof FrameRateMonitor.prototype
   * @type {number}
   */
  lastFramesPerSecond: {
    get: function () {
      return this._lastFramesPerSecond;
    },
  },
});

/**
 * 暂停帧率监控。要恢复监控，必须针对每次调用该函数调用 {@link FrameRateMonitor#unpause}。
 * 一次。
 * @memberof FrameRateMonitor
 */
FrameRateMonitor.prototype.pause = function () {
  ++this._pauseCount;
  if (this._pauseCount === 1) {
    this._frameTimes.length = 0;
    this._lastFramesPerSecond = undefined;
  }
};

/**
 * 恢复帧率监控。如果多次调用 {@link FrameRateMonitor#pause}，则必须同样次数地调用此函数以
 * 实际恢复监控。
 * 恢复监控。
 * @memberof FrameRateMonitor
 */
FrameRateMonitor.prototype.unpause = function () {
  --this._pauseCount;
  if (this._pauseCount <= 0) {
    this._pauseCount = 0;
    this._needsQuietPeriod = true;
  }
};

/**
 * 如果对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 *
 * @memberof FrameRateMonitor
 *
 * @returns {boolean} True 否则返回 false。
 *
 * @see FrameRateMonitor#destroy
 */
FrameRateMonitor.prototype.isDestroyed = function () {
  return false;
};

/**
 * 取消此实例对它所监听的所有事件的订阅。
 * 当一个对象被销毁后，不应再使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给该对象，如示例中所做的那样。
 *
 * @memberof FrameRateMonitor
 *
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 *
 * @see FrameRateMonitor#isDestroyed
 */
FrameRateMonitor.prototype.destroy = function () {
  this._preUpdateRemoveListener();

  if (defined(this._visibilityChangeRemoveListener)) {
    this._visibilityChangeRemoveListener();
  }

  return destroyObject(this);
};

function update(monitor, time) {
  if (monitor._pauseCount > 0) {
    return;
  }

  const timeStamp = getTimestamp();

  if (monitor._needsQuietPeriod) {
    monitor._needsQuietPeriod = false;
    monitor._frameTimes.length = 0;
    monitor._quietPeriodEndTime =
      timeStamp + monitor.quietPeriod / TimeConstants.SECONDS_PER_MILLISECOND;
    monitor._warmupPeriodEndTime =
      monitor._quietPeriodEndTime +
      (monitor.warmupPeriod + monitor.samplingWindow) /
        TimeConstants.SECONDS_PER_MILLISECOND;
  } else if (timeStamp >= monitor._quietPeriodEndTime) {
    monitor._frameTimes.push(timeStamp);

    const beginningOfWindow =
      timeStamp -
      monitor.samplingWindow / TimeConstants.SECONDS_PER_MILLISECOND;

    if (
      monitor._frameTimes.length >= 2 &&
      monitor._frameTimes[0] <= beginningOfWindow
    ) {
      while (
        monitor._frameTimes.length >= 2 &&
        monitor._frameTimes[1] < beginningOfWindow
      ) {
        monitor._frameTimes.shift();
      }

      const averageTimeBetweenFrames =
        (timeStamp - monitor._frameTimes[0]) / (monitor._frameTimes.length - 1);

      monitor._lastFramesPerSecond = 1000.0 / averageTimeBetweenFrames;

      const maximumFrameTime =
        1000.0 /
        (timeStamp > monitor._warmupPeriodEndTime
          ? monitor.minimumFrameRateAfterWarmup
          : monitor.minimumFrameRateDuringWarmup);
      if (averageTimeBetweenFrames > maximumFrameTime) {
        if (!monitor._frameRateIsLow) {
          monitor._frameRateIsLow = true;
          monitor._needsQuietPeriod = true;
          monitor.lowFrameRate.raiseEvent(
            monitor.scene,
            monitor._lastFramesPerSecond,
          );
        }
      } else if (monitor._frameRateIsLow) {
        monitor._frameRateIsLow = false;
        monitor._needsQuietPeriod = true;
        monitor.nominalFrameRate.raiseEvent(
          monitor.scene,
          monitor._lastFramesPerSecond,
        );
      }
    }
  }
}

function visibilityChanged(monitor) {
  if (document[monitor._hiddenPropertyName]) {
    monitor.pause();
  } else {
    monitor.unpause();
  }
}
export default FrameRateMonitor;
