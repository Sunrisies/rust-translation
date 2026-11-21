import {
  Clock,
  DeveloperError,
  Event,
  JulianDate,
  defined,
} from "@cesium/core";
import createRawPropertyDescriptor from "./createRawPropertyDescriptor.js";

/**
 * 表示特定 {@link DataSource} 所需的时钟设置。这些设置可以在
 * DataSource 加载时应用于 {@link Clock}。
 *
 * @alias DataSourceClock
 * @constructor
 */
function DataSourceClock() {
  this._definitionChanged = new Event();
  this._startTime = undefined;
  this._stopTime = undefined;
  this._currentTime = undefined;
  this._clockRange = undefined;
  this._clockStep = undefined;
  this._multiplier = undefined;
}

Object.defineProperties(DataSourceClock.prototype, {
  /**
   * 获取每当分配新属性时引发的事件。
   * @memberof DataSourceClock.prototype
   *
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },

  /**
   * 获取或设置期望的时钟开始时间。
   * 参见 {@link Clock#startTime}。
   * @memberof DataSourceClock.prototype
   * @type {JulianDate}
   */
  startTime: createRawPropertyDescriptor("startTime"),

  /**
   * 获取或设置期望的时钟结束时间。
   * 参见 {@link Clock#stopTime}。
   * @memberof DataSourceClock.prototype
   * @type {JulianDate}
   */
  stopTime: createRawPropertyDescriptor("stopTime"),

  /**
   * 获取或设置此 DataSource 加载时的期望当前时间。
   * 参见 {@link Clock#currentTime}。
   * @memberof DataSourceClock.prototype
   * @type {JulianDate}
   */
  currentTime: createRawPropertyDescriptor("currentTime"),

  /**
   * 获取或设置期望的时钟范围设置。
   * 参见 {@link Clock#clockRange}。
   * @memberof DataSourceClock.prototype
   * @type {ClockRange}
   */
  clockRange: createRawPropertyDescriptor("clockRange"),

  /**
   * 获取或设置期望的时钟步长设置。
   * 参见 {@link Clock#clockStep}。
   * @memberof DataSourceClock.prototype
   * @type {ClockStep}
   */
  clockStep: createRawPropertyDescriptor("clockStep"),

  /**
   * 获取或设置期望的时钟乘数。
   * 参见 {@link Clock#multiplier}。
   * @memberof DataSourceClock.prototype
   * @type {number}
   */
  multiplier: createRawPropertyDescriptor("multiplier"),
});

/**
 * 复制一个 DataSourceClock 实例。
 *
 * @param {DataSourceClock} [result] 用于存储结果的对象。
 * @returns {DataSourceClock} The 修改的结果参数或新实例（如果未提供）。
 */
DataSourceClock.prototype.clone = function (result) {
  if (!defined(result)) {
    result = new DataSourceClock();
  }
  result.startTime = this.startTime;
  result.stopTime = this.stopTime;
  result.currentTime = this.currentTime;
  result.clockRange = this.clockRange;
  result.clockStep = this.clockStep;
  result.multiplier = this.multiplier;
  return result;
};

/**
 * 如果此 DataSourceClock 与另一
 *
 * @param {DataSourceClock} [other] 要比较的 DataSourceClock 相等，则返回 true；否则返回 <code>false</code>。
 * @returns {boolean} <code>true</code> 返回 true，前提是这两个 DataSourceClock 相等；否则返回 <code>false</code>。
 */
DataSourceClock.prototype.equals = function (other) {
  return (
    this === other ||
    (defined(other) &&
      JulianDate.equals(this.startTime, other.startTime) &&
      JulianDate.equals(this.stopTime, other.stopTime) &&
      JulianDate.equals(this.currentTime, other.currentTime) &&
      this.clockRange === other.clockRange &&
      this.clockStep === other.clockStep &&
      this.multiplier === other.multiplier)
  );
};

/**
 * 将此对象上未分配的属性值分配给
 * 提供源对象上相同属性的值。
 *
 * @param {DataSourceClock} source 要合并到此对象的对象。
 */
DataSourceClock.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.startTime = this.startTime ?? source.startTime;
  this.stopTime = this.stopTime ?? source.stopTime;
  this.currentTime = this.currentTime ?? source.currentTime;
  this.clockRange = this.clockRange ?? source.clockRange;
  this.clockStep = this.clockStep ?? source.clockStep;
  this.multiplier = this.multiplier ?? source.multiplier;
};

/**
 * 获取此时钟实例的值作为 {@link Clock} 对象。
 *
 * @returns {Clock} The 修改的结果参数或新实例（如果未提供）。
 */
DataSourceClock.prototype.getValue = function (result) {
  if (!defined(result)) {
    result = new Clock();
  }
  result.startTime = this.startTime ?? result.startTime;
  result.stopTime = this.stopTime ?? result.stopTime;
  result.currentTime = this.currentTime ?? result.currentTime;
  result.clockRange = this.clockRange ?? result.clockRange;
  result.multiplier = this.multiplier ?? result.multiplier;
  result.clockStep = this.clockStep ?? result.clockStep;
  return result;
};
export default DataSourceClock;
