import {
  Event,
  JulianDate,
  TimeIntervalCollection,
  defined,
} from "@cesium/core";
import Property from "./Property.js";

/**
 * 一个由 {@link TimeIntervalCollection} 定义的 {@link Property}，其中
 * 每个 {@link TimeInterval} 的 data 属性表示时间值。
 *
 * @alias TimeIntervalCollectionProperty
 * @constructor
 *
 * @example
 * //创建一个包含 2012 年 8 月 1 日数据的 Cartesian2 间隔属性
 * //并且每 6 小时使用不同的数值。
 * const composite = new Cesium.TimeIntervalCollectionProperty();
 * composite.intervals.addInterval(Cesium.TimeInterval.fromIso8601({
 * iso8601 : '2012-08-01T00:00:00.00Z/2012-08-01T06:00:00.00Z',
 * isStartIncluded : true,
 * isStopIncluded : false,
 * data : new Cesium.Cartesian2(2.0, 3.4)
 * }));
 * composite.intervals.addInterval(Cesium.TimeInterval.fromIso8601({
 * iso8601 : '2012-08-01T06:00:00.00Z/2012-08-01T12:00:00.00Z',
 * isStartIncluded : true,
 * isStopIncluded : false,
 * data : new Cesium.Cartesian2(12.0, 2.7)
 * }));
 * composite.intervals.addInterval(Cesium.TimeInterval.fromIso8601({
 * iso8601 : '2012-08-01T12:00:00.00Z/2012-08-01T18:00:00.00Z',
 * isStartIncluded : true,
 * isStopIncluded : false,
 * data : new Cesium.Cartesian2(5.0, 12.4)
 * }));
 * composite.intervals.addInterval(Cesium.TimeInterval.fromIso8601({
 * iso8601 : '2012-08-01T18:00:00.00Z/2012-08-02T00:00:00.00Z',
 * isStartIncluded : true,
 * isStopIncluded : true,
 * data : new Cesium.Cartesian2(85.0, 4.1)
 * }));
 */
function TimeIntervalCollectionProperty() {
  this._definitionChanged = new Event();
  this._intervals = new TimeIntervalCollection();
  this._intervals.changedEvent.addEventListener(
    TimeIntervalCollectionProperty.prototype._intervalsChanged,
    this,
  );
}

Object.defineProperties(TimeIntervalCollectionProperty.prototype, {
  /**
   * 获取表示该属性是否恒定的值。如果
   * 对于当前定义，getValue 始终返回相同的结果，则该属性被视为恒定。
   * @memberof TimeIntervalCollectionProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return this._intervals.isEmpty;
    },
  },
  /**
   * 当该属性的定义发生变化时，会触发此事件。
   * 当调用 setValue 并传入与当前值不同的数据时，定义会发生变化。
   * 获取间隔集合。
   * @memberof TimeIntervalCollectionProperty.prototype
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
   * Gets the interval collection.
   * @memberof TimeIntervalCollectionProperty.prototype
   *
   * @type {TimeIntervalCollection}
   * @readonly
   */
  intervals: {
    get: function () {
      return this._intervals;
    },
  },
});

const timeScratch = new JulianDate();

/**
 * 获取指定时间下的属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的时长。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
TimeIntervalCollectionProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }

  const value = this._intervals.findDataForIntervalContainingDate(time);
  if (defined(value) && typeof value.clone === "function") {
    return value.clone(result);
  }
  return value;
};

/**
 * 比较此属性与提供的属性，如果相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
TimeIntervalCollectionProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof TimeIntervalCollectionProperty && //
      this._intervals.equals(other._intervals, Property.equals))
  );
};

/**
 * @private
 */
TimeIntervalCollectionProperty.prototype._intervalsChanged = function () {
  this._definitionChanged.raiseEvent(this);
};
export default TimeIntervalCollectionProperty;
