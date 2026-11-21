import {
  DeveloperError,
  Event,
  JulianDate,
  ReferenceFrame,
  defined,
} from "@cesium/core";
import CompositeProperty from "./CompositeProperty.js";
import Property from "./Property.js";

/**
 * 一个也是 {@link PositionProperty} 的 {@link CompositeProperty}。
 *
 * @alias CompositePositionProperty
 * @constructor
 *
 * @param {ReferenceFrame} [referenceFrame=ReferenceFrame.FIXED] 定义位置所采用的参考框架。
 */
function CompositePositionProperty(referenceFrame) {
  this._referenceFrame = referenceFrame ?? ReferenceFrame.FIXED;
  this._definitionChanged = new Event();
  this._composite = new CompositeProperty();
  this._composite.definitionChanged.addEventListener(
    CompositePositionProperty.prototype._raiseDefinitionChanged,
    this,
  );
}

Object.defineProperties(CompositePositionProperty.prototype, {
  /**
   * 获取一个值，指示该属性是否为常量。如果 <code>getValue</code> 总是返回相同的结果，则该属性被视为
   * 常量。
   * @memberof CompositePositionProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return this._composite.isConstant;
    },
  },
  /**
   * 当该属性的定义发生变化时引发的事件。
   * 当使用与当前值不同的数据调用 <code>setValue</code> 时，定义会被更改。
   * 该属性所呈现的参考框架。
   * @memberof CompositePositionProperty.prototype
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
   * 获取间隔集合。
   * @memberof CompositePositionProperty.prototype
   *
   * @type {TimeIntervalCollection}
   */
  intervals: {
    get: function () {
      return this._composite.intervals;
    },
  },
  /**
   * 获取或设置该位置所采用的参考框架。
   * 构成此对象的每个 <code>PositionProperty</code> 都有自己的参考框架，
   * 因此该属性只是为客户端提供“首选”的参考框架。
   * 供其使用。
   * @memberof CompositePositionProperty.prototype
   *
   * @type {ReferenceFrame}
   */
  referenceFrame: {
    get: function () {
      return this._referenceFrame;
    },
    set: function (value) {
      this._referenceFrame = value;
    },
  },
});

const timeScratch = new JulianDate();

/**
 * 在固定框架中提供的时间点获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的时间点。如果省略，则使用当前系统时间。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
CompositePositionProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return this.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
};

/**
 * 在提供的时间点和提供的参考框架中获取该属性的值。
 *
 * @param {JulianDate} time 检索值的时间点。
 * @param {ReferenceFrame} referenceFrame 结果的期望参考框架。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
CompositePositionProperty.prototype.getValueInReferenceFrame = function (
  time,
  referenceFrame,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(time)) {
    throw new DeveloperError("time is required.");
  }
  if (!defined(referenceFrame)) {
    throw new DeveloperError("referenceFrame is required.");
  }
  //>>includeEnd('debug');

  const innerProperty =
    this._composite._intervals.findDataForIntervalContainingDate(time);
  if (defined(innerProperty)) {
    return innerProperty.getValueInReferenceFrame(time, referenceFrame, result);
  }
  return undefined;
};

/**
 * 比较该属性与提供的属性，并返回
 * 如果它们相等则返回 <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等则返回 <code>false</code>，否则返回 <code>true</code>。
 */
CompositePositionProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof CompositePositionProperty && //
      this._referenceFrame === other._referenceFrame && //
      this._composite.equals(other._composite, Property.equals))
  );
};

/**
 * @private
 */
CompositePositionProperty.prototype._raiseDefinitionChanged = function () {
  this._definitionChanged.raiseEvent(this);
};
export default CompositePositionProperty;
