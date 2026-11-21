import { Color, Event, JulianDate, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";

/**
 * 一个映射到 PolylineArrow {@link Material} 统一格式的 {@link MaterialProperty}。
 *
 * @param {Property|Color} [color=Color.WHITE] 要使用的 {@link Color} 属性。
 *
 * @alias PolylineArrowMaterialProperty
 * @constructor
 */
function PolylineArrowMaterialProperty(color) {
  this._definitionChanged = new Event();
  this._color = undefined;
  this._colorSubscription = undefined;

  this.color = color;
}

Object.defineProperties(PolylineArrowMaterialProperty.prototype, {
  /**
   * 获取一个值以指示该属性是否为常量。如果对于当前定义，getValue 总是返回相同的结果，则该属性被视为常量。
   * 当调用 getValue 返回不同结果时，认为该定义已改变。
   * @memberof PolylineArrowMaterialProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return Property.isConstant(this._color);
    },
  },
  /**
   * 当该属性的定义发生变化时引发的事件。
   * 如果调用 getValue 返回不同结果，则认为该定义已改变。
   * 获取或设置 {@link Color} {@link Property} 的值。
   * @memberof PolylineArrowMaterialProperty.prototype
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
   * Gets or sets the {@link Color} {@link Property}.
   * @memberof PolylineArrowMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  color: createPropertyDescriptor("color"),
});

/**
 * Gets the {@link Material} type at the provided time.
 *
 * @param {JulianDate} time 检索类型所持续的时间。
 * @returns {string} The 材料的类型。
 */
PolylineArrowMaterialProperty.prototype.getType = function (time) {
  return "PolylineArrow";
};

const timeScratch = new JulianDate();

/**
 * 在指定时间获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值所持续的时间。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
PolylineArrowMaterialProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  if (!defined(result)) {
    result = {};
  }
  result.color = Property.getValueOrClonedDefault(
    this._color,
    time,
    Color.WHITE,
    result.color,
  );
  return result;
};

/**
 * 比较该属性与提供的属性，如果相等则返回 <code>true</code>，否则返回 <code>false</code>。
 * 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
PolylineArrowMaterialProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof PolylineArrowMaterialProperty && //
      Property.equals(this._color, other._color))
  );
};
export default PolylineArrowMaterialProperty;