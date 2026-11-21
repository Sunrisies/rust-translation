import { Color, Event, JulianDate, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";

/**
 * 一个映射到纯色 {@link Material} 统一变量的 {@link MaterialProperty}。
 *
 * @param {Property|Color} [color=Color.WHITE] 要使用的 {@link Color} 属性。
 *
 * @alias ColorMaterialProperty
 * @constructor
 */
function ColorMaterialProperty(color) {
  this._definitionChanged = new Event();
  this._color = undefined;
  this._colorSubscription = undefined;

  this.color = color;
}

Object.defineProperties(ColorMaterialProperty.prototype, {
  /**
   * 获取一个值以指示该属性是否为常量。如果`getValue` 总是返回相同的结果，则该属性被视为
   * 常量。
   * @memberof ColorMaterialProperty.prototype
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
   * 当该属性的定义发生变化时触发事件。
   * 如果调用`getValue` 会返回
   * 相同时间内的不同结果，则认为定义已改变。
   * @memberof ColorMaterialProperty.prototype
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
   * 获取或设置 {@link Color} {@link Property}。
   * @memberof ColorMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  color: createPropertyDescriptor("color"),
});

/**
 * 在指定时间获取 {@link Material} 类型。
 *
 * @param {JulianDate} time 检索类型的持续时间。
 * @returns {string} The 材料类型。
 */
ColorMaterialProperty.prototype.getType = function (time) {
  return "Color";
};

const timeScratch = new JulianDate();

/**
 * 在指定时间获取属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的持续时间。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
ColorMaterialProperty.prototype.getValue = function (time, result) {
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
 * 比较该属性与提供的属性，如果相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
ColorMaterialProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof ColorMaterialProperty && //
      Property.equals(this._color, other._color))
  );
};
export default ColorMaterialProperty;
