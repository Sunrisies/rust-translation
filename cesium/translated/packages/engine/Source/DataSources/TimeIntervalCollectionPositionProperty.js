import {
  DeveloperError,
  Event,
  JulianDate,
  ReferenceFrame,
  TimeIntervalCollection,
  defined,
} from "@cesium/core";
import PositionProperty from "./PositionProperty.js";
import Property from "./Property.js";

/**
 * 一个也是 {@link PositionProperty} 的 {@link TimeIntervalCollectionProperty}。
 *
 * @alias TimeIntervalCollectionPositionProperty
 * @constructor
 *
 * @param {ReferenceFrame} [referenceFrame=ReferenceFrame.FIXED] 定义位置所采用的参考框架。
 */
function TimeIntervalCollectionPositionProperty(referenceFrame) {
  this._definitionChanged = new Event();
  this._intervals = new TimeIntervalCollection();
  this._intervals.changedEvent.addEventListener(
    TimeIntervalCollectionPositionProperty.prototype._intervalsChanged,
    this,
  );
  this._referenceFrame = referenceFrame ?? ReferenceFrame.FIXED;
}

Object.defineProperties(TimeIntervalCollectionPositionProperty.prototype, {
  /**
   * 获取一个值，指示该属性是否为常量。如果`getValue`总是返回相同的结果，则该属性被视为
   * 常量。
   * @memberof TimeIntervalCollectionPositionProperty.prototype
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
   * 获取当该属性的定义发生变化时引发的事件。
   * 如果调用`getValue`在相同时间返回不同的结果，则认为定义已改变。
   * 获取间隔集合。
   * @memberof TimeIntervalCollectionPositionProperty.prototype
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
   * 获取定义位置所采用的参考框架。
   * @memberof TimeIntervalCollectionPositionProperty.prototype
   * @type {TimeIntervalCollection}
   * @readonly
   */
  intervals: {
    get: function () {
      return this._intervals;
    },
  },
  /**
   * 获取定义位置所采用的参考框架。
   * @memberof TimeIntervalCollectionPositionProperty.prototype
   * @type {ReferenceFrame}
   * @readonly
   * @default ReferenceFrame.FIXED;
   */
  referenceFrame: {
    get: function () {
      return this._referenceFrame;
    },
  },
});

const timeScratch = new JulianDate();

/**
 * 获取在固定参考框架中指定时间下的属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的持续时间。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
TimeIntervalCollectionPositionProperty.prototype.getValue = function (
  time,
  result,
) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return this.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
};

/**
 * 获取在指定时间和指定参考框架下的属性值。
 *
 * @param {JulianDate} time 检索值的持续时间。
 * @param {ReferenceFrame} referenceFrame 期望的结果参考框架。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
TimeIntervalCollectionPositionProperty.prototype.getValueInReferenceFrame =
  function (time, referenceFrame, result) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(time)) {
      throw new DeveloperError("time is required.");
    }
    if (!defined(referenceFrame)) {
      throw new DeveloperError("referenceFrame is required.");
    }
    //>>includeEnd('debug');

    const position = this._intervals.findDataForIntervalContainingDate(time);
    if (defined(position)) {
      return PositionProperty.convertToReferenceFrame(
        time,
        position,
        this._referenceFrame,
        referenceFrame,
        result,
      );
    }
    return undefined;
  };

/**
 * 比较该属性和提供的属性，如果相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>false</code>。
 */
TimeIntervalCollectionPositionProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof TimeIntervalCollectionPositionProperty && //
      this._intervals.equals(other._intervals, Property.equals) && //
      this._referenceFrame === other._referenceFrame)
  );
};

/**
 * @private
 */
TimeIntervalCollectionPositionProperty.prototype._intervalsChanged =
  function () {
    this._definitionChanged.raiseEvent(this);
  };
export default TimeIntervalCollectionPositionProperty;
