import { DeveloperError, Event, JulianDate, defined } from "@cesium/core";
import CompositeProperty from "./CompositeProperty.js";
import Property from "./Property.js";

/**
 * 一个也是一个 {@link MaterialProperty}的 {@link CompositeProperty}。
 *
 * @alias CompositeMaterialProperty
 * @constructor
 */
function CompositeMaterialProperty() {
  this._definitionChanged = new Event();
  this._composite = new CompositeProperty();
  this._composite.definitionChanged.addEventListener(
    CompositeMaterialProperty.prototype._raiseDefinitionChanged,
    this,
  );
}

Object.defineProperties(CompositeMaterialProperty.prototype, {
  /**
   * 获取一个值，表示该属性是否为常量。如果属性在调用`getValue`时总是返回相同的结果，则视为常量。
   * 常量。
   * @memberof CompositeMaterialProperty.prototype
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
   * 当该属性的定义发生变化时，触发此事件。
   * 当使用与当前值不同的数据调用`setValue`时，定义会发生变化。
   * 定义会发生变化。
   * @memberof CompositeMaterialProperty.prototype
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
   * @memberof CompositeMaterialProperty.prototype
   *
   * @type {TimeIntervalCollection}
   */
  intervals: {
    get: function () {
      return this._composite._intervals;
    },
  },
});

/**
 * 在指定时间获取 {@link Material}类型。
 *
 * @param {JulianDate} time 获取类型的时间长度。
 * @returns {string} The 材料的类型。
 */
CompositeMaterialProperty.prototype.getType = function (time) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(time)) {
    throw new DeveloperError("time is required");
  }
  //>>includeEnd('debug');

  const innerProperty =
    this._composite._intervals.findDataForIntervalContainingDate(time);
  if (defined(innerProperty)) {
    return innerProperty.getType(time);
  }
  return undefined;
};

const timeScratch = new JulianDate();

/**
 * 在指定时间获取属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 获取值的时间长度。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
CompositeMaterialProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }

  const innerProperty =
    this._composite._intervals.findDataForIntervalContainingDate(time);
  if (defined(innerProperty)) {
    return innerProperty.getValue(time, result);
  }
  return undefined;
};

/**
 * 比较该属性与提供的属性，如果相等则返回<code>true</code>，否则返回<code>false</code>。
 * 另一个属性。
 *
 * @param {Property} [other] 如果左右两边相等，返回<code>false</code>，否则返回<code>true</code>。
 * @returns {boolean} <code>true</code> 如果左右两边相等，返回<code>false</code>，否则返回<code>true</code>。
 */
CompositeMaterialProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof CompositeMaterialProperty && //
      this._composite.equals(other._composite, Property.equals))
  );
};

/**
 * @private
 */
CompositeMaterialProperty.prototype._raiseDefinitionChanged = function () {
  this._definitionChanged.raiseEvent(this);
};
export default CompositeMaterialProperty;
