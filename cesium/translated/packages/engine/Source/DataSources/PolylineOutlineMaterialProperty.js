import { Color, Event, Frozen, JulianDate, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";

const defaultColor = Color.WHITE;
const defaultOutlineColor = Color.BLACK;
const defaultOutlineWidth = 1.0;

/**
 * A {@link MaterialProperty} that maps to polyline outline {@link Material} uniforms.
 * @alias PolylineOutlineMaterialProperty
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Property|Color} [options.color=Color.WHITE] 指定线的 {@link Color} 的属性。
 * @param {Property|Color} [options.outlineColor=Color.BLACK] 指定轮廓的 {@link Color} 的属性。
 * @param {Property|number} [options.outlineWidth=1.0] 指定轮廓宽度的数值属性，单位为像素。
 */
function PolylineOutlineMaterialProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._definitionChanged = new Event();
  this._color = undefined;
  this._colorSubscription = undefined;
  this._outlineColor = undefined;
  this._outlineColorSubscription = undefined;
  this._outlineWidth = undefined;
  this._outlineWidthSubscription = undefined;

  this.color = options.color;
  this.outlineColor = options.outlineColor;
  this.outlineWidth = options.outlineWidth;
}

Object.defineProperties(PolylineOutlineMaterialProperty.prototype, {
  /**
   * 获取一个值以指示该属性是否为常量。如果 <code>getValue</code> 总是返回相同的结果，则该属性被视为
   * 常量。
   * @memberof PolylineOutlineMaterialProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        Property.isConstant(this._color) &&
        Property.isConstant(this._outlineColor) &&
        Property.isConstant(this._outlineWidth)
      );
    },
  },
  /**
   * 当该属性的定义发生变化时引发的事件。
   * 如果调用 <code>getValue</code> 在相同时间内返回不同的结果，则认为定义已改变。
   * 指定线的 {@link Color} 的属性。
   * @memberof PolylineOutlineMaterialProperty.prototype
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
   * 指定轮廓的 {@link Color} 的属性。
   * @memberof PolylineOutlineMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  color: createPropertyDescriptor("color"),

  /**
   * 指定轮廓的 {@link Color} 的属性。
   * @memberof PolylineOutlineMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 指定轮廓宽度的数值属性。
   * @memberof PolylineOutlineMaterialProperty.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),
});

/**
 * 在提供的时间获取 {@link Material} 类型。
 *
 * @param {JulianDate} time 检索类型所使用的时间。
 * @returns {string} The 材料的类型。
 */
PolylineOutlineMaterialProperty.prototype.getType = function (time) {
  return "PolylineOutline";
};

const timeScratch = new JulianDate();

/**
 * 在提供的时间获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值所使用的时间。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，则创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
PolylineOutlineMaterialProperty.prototype.getValue = function (time, result) {
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
  result.outlineColor = Property.getValueOrClonedDefault(
    this._outlineColor,
    time,
    defaultOutlineColor,
    result.outlineColor,
  );
  result.outlineWidth = Property.getValueOrDefault(
    this._outlineWidth,
    time,
    defaultOutlineWidth,
  );
  return result;
};

/**
 * 比较该属性与提供的属性，如果相等则返回 <code>true</code>，否则返回 <code>false</code>。
 * 另一个属性。
 *
 * @param {Property} [other] 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
PolylineOutlineMaterialProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof PolylineOutlineMaterialProperty && //
      Property.equals(this._color, other._color) && //
      Property.equals(this._outlineColor, other._outlineColor) && //
      Property.equals(this._outlineWidth, other._outlineWidth))
  );
};
export default PolylineOutlineMaterialProperty;