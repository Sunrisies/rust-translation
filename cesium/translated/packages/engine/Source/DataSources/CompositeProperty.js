import {
  Event,
  EventHelper,
  JulianDate,
  TimeIntervalCollection,
  defined,
} from "@cesium/core";
import Property from "./Property.js";

function subscribeAll(property, eventHelper, definitionChanged, intervals) {
  function callback() {
    definitionChanged.raiseEvent(property);
  }
  const items = [];
  eventHelper.removeAll();
  const length = intervals.length;
  for (let i = 0; i < length; i++) {
    const interval = intervals.get(i);
    if (defined(interval.data) && items.indexOf(interval.data) === -1) {
      eventHelper.add(interval.data.definitionChanged, callback);
    }
  }
}

/**
 * 一个由 {@link TimeIntervalCollection} 定义的 {@link Property}，其中
 * 每个 {@link TimeInterval} 的 data 属性是另一个 Property 实例，该实例在
 * 提供的时间点被评估。
 *
 * @alias CompositeProperty
 * @constructor
 *
 *
 * @example
 * const constantProperty = ...;
 * const sampledProperty = ...;
 *
 * //从两个已定义的属性创建复合属性
 * //该属性在2012年8月1日有效，使用常量值
 * //上午的属性和
 * //下午的采样属性。
 * const composite = new Cesium.CompositeProperty();
 * composite.intervals.addInterval(Cesium.TimeInterval.fromIso8601({
 * iso8601 : '2012-08-01T00:00:00.00Z/2012-08-01T12:00:00.00Z',
 * data : constantProperty
 * }));
 * composite.intervals.addInterval(Cesium.TimeInterval.fromIso8601({
 * iso8601 : '2012-08-01T12:00:00.00Z/2012-08-02T00:00:00.00Z',
 * isStartIncluded : false,
 * isStopIncluded : false,
 * data : sampledProperty
 * }));
 *
 * @see CompositeMaterialProperty
 * @see CompositePositionProperty
 */
function CompositeProperty() {
  this._eventHelper = new EventHelper();
  this._definitionChanged = new Event();
  this._intervals = new TimeIntervalCollection();
  this._intervals.changedEvent.addEventListener(
    CompositeProperty.prototype._intervalsChanged,
    this,
  );
}

Object.defineProperties(CompositeProperty.prototype, {
  /**
   * 获取一个值，指示该属性是否为常量。如果
   * 对于当前定义，getValue 始终返回相同的结果，则该属性被视为
   * @memberof CompositeProperty.prototype
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
   * 当该属性的定义发生变化时引发的事件。
   * 当调用 setValue 并传入与当前值不同的数据时，定义会发生变化。
   * 获取间隔集合。
   * @memberof CompositeProperty.prototype
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
   * 获取提供时间点的属性值。
   * @memberof CompositeProperty.prototype
   *
   * @type {TimeIntervalCollection}
   */
  intervals: {
    get: function () {
      return this._intervals;
    },
  },
});

const timeScratch = new JulianDate();

/**
 * 检索值的时间长度。如果省略，则使用当前系统时间。
 *
 * @param {JulianDate} [time=JulianDate.now()] 存储值的对象。如果省略，将创建并返回新实例。
 * @param {object} [result] 修改后的结果参数或新实例（如果未提供结果参数）。
 * @returns {object} The 比较该属性和提供属性，如果相等则返回
 */
CompositeProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }

  const innerProperty = this._intervals.findDataForIntervalContainingDate(time);
  if (defined(innerProperty)) {
    return innerProperty.getValue(time, result);
  }
  return undefined;
};

/**
 * Compares this property to the provided property and returns
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
CompositeProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof CompositeProperty && //
      this._intervals.equals(other._intervals, Property.equals))
  );
};

/**
 * @private
 */
CompositeProperty.prototype._intervalsChanged = function () {
  subscribeAll(
    this,
    this._eventHelper,
    this._definitionChanged,
    this._intervals,
  );
  this._definitionChanged.raiseEvent(this);
};
export default CompositeProperty;
