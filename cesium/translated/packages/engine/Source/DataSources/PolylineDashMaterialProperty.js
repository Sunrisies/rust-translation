import { Color, Event, Frozen, JulianDate, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";

const defaultColor = Color.WHITE;
const defaultGapColor = Color.TRANSPARENT;
const defaultDashLength = 16.0;
const defaultDashPattern = 255.0;

/**
 * 一个映射为折线线宽 {@link Material} 值的 {@link MaterialProperty}。
 * @alias PolylineDashMaterialProperty
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Property|Color} [options.color=Color.WHITE] 指定线条 {@link Color} 的属性。
 * @param {Property|Color} [options.gapColor=Color.TRANSPARENT] 指定线条间隙 {@link Color} 的属性。
 * @param {Property|number} [options.dashLength=16.0] 指定线宽模式长度（以像素为单位）的数值属性。
 * @param {Property|number} [options.dashPattern=255.0] 指定线宽 16 位模式的数值属性。
 */
function PolylineDashMaterialProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._definitionChanged = new Event();
  this._color = undefined;
  this._colorSubscription = undefined;
  this._gapColor = undefined;
  this._gapColorSubscription = undefined;
  this._dashLength = undefined;
  this._dashLengthSubscription = undefined;
  this._dashPattern = undefined;
  this._dashPatternSubscription = undefined;

  this.color = options.color;
  this.gapColor = options.gapColor;
  this.dashLength = options.dashLength;
  this.dashPattern = options.dashPattern;
}

Object.defineProperties(PolylineDashMaterialProperty.prototype, {
  /**
   * 获取一个值，指示该属性是否为常量。如果`getValue` 始终返回相同的结果，则认为该属性为常量。
   * 当调用`getValue` 返回不同结果时，认为该定义已改变。
   * @memberof PolylineDashMaterialProperty.prototype
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        Property.isConstant(this._color) &&
        Property.isConstant(this._gapColor) &&
        Property.isConstant(this._dashLength) &&
        Property.isConstant(this._dashPattern)
      );
    },
  },
  /**
   * 当该属性的定义发生变化时引发的事件。
   * 如果调用`getValue` 返回不同结果，则认为该定义已改变。
   * 在相同时间内返回不同结果时，认为该定义已改变。
   * @memberof PolylineDashMaterialProperty.prototype
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
  /**
   * 获取或设置指定线条 {@link Color} 的属性。
   * @memberof PolylineDashMaterialProperty.prototype
   * @type {Property|undefined}
   */
  color: createPropertyDescriptor("color"),

  /**
   * 获取或设置指定线条间隙 {@link Color} 的属性。
   * @memberof PolylineDashMaterialProperty.prototype
   * @type {Property|undefined}
   */
  gapColor: createPropertyDescriptor("gapColor"),

  /**
   * 获取或设置指定线周期长度的数值属性。
   * @memberof PolylineDashMaterialProperty.prototype
   * @type {Property|undefined}
   */
  dashLength: createPropertyDescriptor("dashLength"),

  /**
   * 获取或设置线模式数值属性。
   * @memberof PolylineDashMaterialProperty.prototype
   * @type {Property|undefined}
   */
  dashPattern: createPropertyDescriptor("dashPattern"),
});

/**
 * 在指定时间获取 {@link Material} 类型。
 *
 * @param {JulianDate} time 用于检索类型的时长。
 * @returns {string} The 材料的类型。
 */
PolylineDashMaterialProperty.prototype.getType = function (time) {
  return "PolylineDash";
};

const timeScratch = new JulianDate();

/**
 * 在指定时间获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 用于检索值的时长。如果省略，则使用当前系统时间。
 * @param {object} [result] 用于存储值的对象。如果省略，则创建并返回新实例。
 * @returns {object} The 修改后结果参数或新实例，如果未提供结果参数。
 */
PolylineDashMaterialProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  if (!defined(result)) {
    result = {};
  }
  result.color = Property.getValueOrClonedDefault(
    this._color,
    time,
    defaultColor,
    result.color,
  );
  result.gapColor = Property.getValueOrClonedDefault(
    this._gapColor,
    time,
    defaultGapColor,
    result.gapColor,
  );
  result.dashLength = Property.getValueOrDefault(
    this._dashLength,
    time,
    defaultDashLength,
    result.dashLength,
  );
  result.dashPattern = Property.getValueOrDefault(
    this._dashPattern,
    time,
    defaultDashPattern,
    result.dashPattern,
  );
  return result;
};

/**
 * 比较该属性与提供的属性，如果相等则返回<code>true</code>，否则返回<code>false</code>。
 * 另一个属性。
 *
 * @param {Property} [other] The other property.
 * @returns {boolean} <code>true</code> 如果左右值相等，返回<code>false</code>，否则返回<code>false</code>。
 */
PolylineDashMaterialProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof PolylineDashMaterialProperty &&
      Property.equals(this._color, other._color) &&
      Property.equals(this._gapColor, other._gapColor) &&
      Property.equals(this._dashLength, other._dashLength) &&
      Property.equals(this._dashPattern, other._dashPattern))
  );
};
export default PolylineDashMaterialProperty;
