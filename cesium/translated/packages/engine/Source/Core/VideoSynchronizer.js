import {
  Frozen,
  Iso8601,
  JulianDate,
  defined,
  destroyObject,
} from "@cesium/core";

/**
 * 将视频元素与模拟时钟同步。
 *
 * @alias VideoSynchronizer
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Clock} [options.clock] 用于驱动视频的时钟实例。
 * @param {HTMLVideoElement} [options.element] 需要同步的视频元素。
 * @param {JulianDate} [options.epoch=Iso8601.MINIMUM_VALUE] 标记视频开始时的模拟时间。
 * @param {number} [options.tolerance=1.0] 时钟与视频可能偏离的最大时间，以秒为单位。
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=video|Video Material Demo}
 */
function VideoSynchronizer(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._clock = undefined;
  this._element = undefined;
  this._clockSubscription = undefined;
  this._seekFunction = undefined;
  this._lastPlaybackRate = undefined;

  this.clock = options.clock;
  this.element = options.element;

  /**
   * 获取或设置标记视频开始的模拟时间。
   * @type {JulianDate}
   * @default Iso8601.MINIMUM_VALUE
   */
  this.epoch = options.epoch ?? Iso8601.MINIMUM_VALUE;

  /**
   * 获取或设置视频的 currentTime 与时钟的 currentTime 在视频Seek操作前可以偏离的时间量，以秒为单位。
   * 较低的值使同步更精确，但视频性能可能会下降。较高的值则能提供更好的性能，但会牺牲精度。
   * 较低的值使同步更精确，但视频性能可能会下降。较高的值则能提供更好的性能，但会牺牲精度。
   * 获取或设置用于驱动视频元素的时钟。
   * 获取或设置要同步的视频元素。
   * @type {number}
   * @default 1.0
   */
  this.tolerance = options.tolerance ?? 1.0;

  this._seeking = false;
  this._seekFunction = undefined;
  this._firstTickAfterSeek = false;
}

Object.defineProperties(VideoSynchronizer.prototype, {
  /**
   * 销毁对象及其使用的资源。一旦对象被销毁，就不应再使用它。
   *
   * @memberof VideoSynchronizer.prototype
   * @type {Clock}
   */
  clock: {
    get: function () {
      return this._clock;
    },
    set: function (value) {
      const oldValue = this._clock;

      if (oldValue === value) {
        return;
      }

      if (defined(oldValue)) {
        this._clockSubscription();
        this._clockSubscription = undefined;
      }

      if (defined(value)) {
        this._clockSubscription = value.onTick.addEventListener(
          VideoSynchronizer.prototype._onTick,
          this,
        );
      }

      this._clock = value;
    },
  },
  /**
   * 表示对象已被销毁，即调用了 destroy() 方法。
   *
   * @memberof VideoSynchronizer.prototype
   * @type {HTMLVideoElement}
   */
  element: {
    get: function () {
      return this._element;
    },
    set: function (value) {
      const oldValue = this._element;

      if (oldValue === value) {
        return;
      }

      if (defined(oldValue)) {
        oldValue.removeEventListener("seeked", this._seekFunction, false);
      }

      if (defined(value)) {
        this._seeking = false;
        this._seekFunction = createSeekFunction(this);
        value.addEventListener("seeked", this._seekFunction, false);
      }

      this._element = value;
      this._seeking = false;
      this._firstTickAfterSeek = false;
    },
  },
});

/**
 * 返回该对象是否被销毁，为 true 则返回 true，否则返回 false。
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 */
VideoSynchronizer.prototype.destroy = function () {
  this.element = undefined;
  this.clock = undefined;
  return destroyObject(this);
};

/**
 * Returns true if this object was destroyed; otherwise, false.
 *
 * @returns {boolean} True if this object was destroyed; otherwise, false.
 */
VideoSynchronizer.prototype.isDestroyed = function () {
  return false;
};

VideoSynchronizer.prototype._trySetPlaybackRate = function (clock) {
  if (this._lastPlaybackRate === clock.multiplier) {
    return;
  }

  const element = this._element;
  try {
    element.playbackRate = clock.multiplier;
  } catch (error) {
    // Seek manually for unsupported playbackRates.
    element.playbackRate = 0.0;
  }
  this._lastPlaybackRate = clock.multiplier;
};

VideoSynchronizer.prototype._onTick = function (clock) {
  const element = this._element;
  if (!defined(element) || element.readyState < 2) {
    return;
  }

  const paused = element.paused;
  const shouldAnimate = clock.shouldAnimate;
  if (shouldAnimate === paused) {
    if (shouldAnimate) {
      element.play();
    } else {
      element.pause();
    }
  }

  //We need to avoid constant seeking or the video will
  //never contain a complete frame for us to render.
  //So don't do anything if we're seeing or on the first
  //tick after a seek (the latter of which allows the frame
  //to actually be rendered.
  if (this._seeking || this._firstTickAfterSeek) {
    this._firstTickAfterSeek = false;
    return;
  }

  this._trySetPlaybackRate(clock);

  const clockTime = clock.currentTime;
  const epoch = this.epoch ?? Iso8601.MINIMUM_VALUE;
  let videoTime = JulianDate.secondsDifference(clockTime, epoch);

  const duration = element.duration;
  let desiredTime;
  const currentTime = element.currentTime;
  if (element.loop) {
    videoTime = videoTime % duration;
    if (videoTime < 0.0) {
      videoTime = duration - videoTime;
    }
    desiredTime = videoTime;
  } else if (videoTime > duration) {
    desiredTime = duration;
  } else if (videoTime < 0.0) {
    desiredTime = 0.0;
  } else {
    desiredTime = videoTime;
  }

  //If the playing video's time and the scene's clock time
  //ever drift too far apart, we want to set the video to match
  const tolerance = shouldAnimate ? (this.tolerance ?? 1.0) : 0.001;
  if (Math.abs(desiredTime - currentTime) > tolerance) {
    this._seeking = true;
    element.currentTime = desiredTime;
  }
};

function createSeekFunction(that) {
  return function () {
    that._seeking = false;
    that._firstTickAfterSeek = true;
  };
}
export default VideoSynchronizer;
