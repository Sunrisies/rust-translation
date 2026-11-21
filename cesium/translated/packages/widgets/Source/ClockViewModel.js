import {
  Clock,
  EventHelper,
  JulianDate,
  defined,
  destroyObject,
} from "@cesium/core";
import knockout from "./ThirdParty/knockout.js";

/**
 * 一个视图模型，用于向用户界面提供 {@link Clock} 功能。
 * @alias ClockViewModel
 * @constructor
 *
 * @param {Clock} [clock] 由该视图模型封装的时钟对象，如果未定义则会创建新实例。
 *
 * @see Clock
 */
function ClockViewModel(clock) {
  if (!defined(clock)) {
    clock = new Clock();
  }
  this._clock = clock;

  this._eventHelper = new EventHelper();
  this._eventHelper.add(clock.onTick, this.synchronize, this);

  /**
   * 获取当前系统时间。
   * 此属性是可观察的。
   * @type {JulianDate}
   */
  this.systemTime = knockout.observable(JulianDate.now());
  this.systemTime.equalityComparer = JulianDate.equals;

  /**
   * 获取或设置时钟的起始时间。
   * 参见 {@link Clock#startTime}。
   * 此属性是可观察的。
   * @type {JulianDate}
   */
  this.startTime = knockout.observable(clock.startTime);
  this.startTime.equalityComparer = JulianDate.equals;
  this.startTime.subscribe(function (value) {
    clock.startTime = value;
    this.synchronize();
  }, this);

  /**
   * 获取或设置时钟的停止时间。
   * 参见 {@link Clock#stopTime}。
   * 此属性是可观察的。
   * @type {JulianDate}
   */
  this.stopTime = knockout.observable(clock.stopTime);
  this.stopTime.equalityComparer = JulianDate.equals;
  this.stopTime.subscribe(function (value) {
    clock.stopTime = value;
    this.synchronize();
  }, this);

  /**
   * 获取或设置当前时间。
   * 参见 {@link Clock#currentTime}。
   * 此属性是可观察的。
   * @type {JulianDate}
   */
  this.currentTime = knockout.observable(clock.currentTime);
  this.currentTime.equalityComparer = JulianDate.equals;
  this.currentTime.subscribe(function (value) {
    clock.currentTime = value;
    this.synchronize();
  }, this);

  /**
   * 获取或设置时钟乘数。
   * 参见 {@link Clock#multiplier}。
   * 此属性是可观察的。
   * @type {number}
   */
  this.multiplier = knockout.observable(clock.multiplier);
  this.multiplier.subscribe(function (value) {
    clock.multiplier = value;
    this.synchronize();
  }, this);

  /**
   * 获取或设置时钟步长设置。
   * 参见 {@link Clock#clockStep}。
   * 此属性是可观察的。
   * @type {ClockStep}
   */
  this.clockStep = knockout.observable(clock.clockStep);
  this.clockStep.subscribe(function (value) {
    clock.clockStep = value;
    this.synchronize();
  }, this);

  /**
   * 获取或设置时钟范围设置。
   * 参见 {@link Clock#clockRange}。
   * 此属性是可观察的。
   * @type {ClockRange}
   */
  this.clockRange = knockout.observable(clock.clockRange);
  this.clockRange.subscribe(function (value) {
    clock.clockRange = value;
    this.synchronize();
  }, this);

  /**
   * 获取或设置时钟是否可动画化。
   * 参见 {@link Clock#canAnimate}。
   * 此属性是可观察的。
   * @type {boolean}
   */
  this.canAnimate = knockout.observable(clock.canAnimate);
  this.canAnimate.subscribe(function (value) {
    clock.canAnimate = value;
    this.synchronize();
  }, this);

  /**
   * 获取或设置时钟是否应动画化。
   * 参见 {@link Clock#shouldAnimate}。
   * 此属性是可观察的。
   * @type {boolean}
   */
  this.shouldAnimate = knockout.observable(clock.shouldAnimate);
  this.shouldAnimate.subscribe(function (value) {
    clock.shouldAnimate = value;
    this.synchronize();
  }, this);

  knockout.track(this, [
    "systemTime",
    "startTime",
    "stopTime",
    "currentTime",
    "multiplier",
    "clockStep",
    "clockRange",
    "canAnimate",
    "shouldAnimate",
  ]);
}

Object.defineProperties(ClockViewModel.prototype, {
  /**
   * 获取底层 Clock 对象。
   * @memberof ClockViewModel.prototype
   * @type {Clock}
   */
  clock: {
    get: function () {
      return this._clock;
    },
  },
});

/**
 * 使用底层时钟的内容更新视图模型。
 * 如果底层时钟已更改且 <code>Clock.tick</code> 尚未调用，可调用此方法来强制更新 viewModel。
 * 如果对象已被销毁，则为 false，否则为 true。
 */
ClockViewModel.prototype.synchronize = function () {
  const clock = this._clock;

  this.systemTime = JulianDate.now();
  this.startTime = clock.startTime;
  this.stopTime = clock.stopTime;
  this.currentTime = clock.currentTime;
  this.multiplier = clock.multiplier;
  this.clockStep = clock.clockStep;
  this.clockRange = clock.clockRange;
  this.canAnimate = clock.canAnimate;
  this.shouldAnimate = clock.shouldAnimate;
};

/**
 * @returns {boolean} true if the object has been destroyed, false otherwise.
 */
ClockViewModel.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁视图模型。应在不再需要时调用以
 * 正确清理视图模型。
 */
ClockViewModel.prototype.destroy = function () {
  this._eventHelper.removeAll();

  destroyObject(this);
};
export default ClockViewModel;
