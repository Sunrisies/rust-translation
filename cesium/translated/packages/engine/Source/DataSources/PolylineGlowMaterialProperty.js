import { Color, Event, Frozen, JulianDate, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";

const defaultColor = Color.WHITE;
const defaultGlowPower = 0.25;
const defaultTaperPower = 1.0;

/**
 * 一个映射至多段线发光 {@link Material} 统一变量的 <code>...</code>、{@link ...}、反引号 `...` 内的内容。
 * @alias PolylineGlowMaterialProperty
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Property|Color} [options.color=Color.WHITE] 指定线的 {@link Color} 的属性。
 * @param {Property|number} [options.glowPower=0.25] 指定发光的强度作为总线宽百分比的数值属性。
 * @param {Property|number} [options.taperPower=1.0] 指定锥形效果的强度作为总线长百分比的数值属性。如果为 1.0 或更高，则不使用锥形效果。
 */
function PolylineGlowMaterialProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._definitionChanged = new Event();
  this._color = undefined;
  this._colorSubscription = undefined;
  this._glowPower = undefined;
  this._glowPowerSubscription = undefined;
  this._taperPower = undefined;
  this._taperPowerSubscription = undefined;

  this.color = options.color;
  this.glowPower = options.glowPower;
  this.taperPower = options.taperPower;
}

Object.defineProperties(PolylineGlowMaterialProperty.prototype, {
  /**
   * 获取一个值以指示该属性是否为常数。如果 <code>getValue</code> 始终返回相同的结果，则该属性被视为常数。
   * 当该属性的定义发生变化时触发事件。
   * @memberof PolylineGlowMaterialProperty.prototype
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        Property.isConstant(this._color) && Property.isConstant(this._glow)
      );
    },
  },
  /**
   * 当调用 <code>getValue</code> 时，如果返回的结果不同，则认为该定义已改变。
   * 如果调用 <code>getValue</code> 时返回的结果不同，则认为该定义已改变。
   * 获取或设置指定线的 {@link Color} 的属性。
   * @memberof PolylineGlowMaterialProperty.prototype
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
  /**
   * 获取或设置指定发光的强度作为总线宽百分比的数值属性（小于 1.0）。
   * @memberof PolylineGlowMaterialProperty.prototype
   * @type {Property|undefined}
   */
  color: createPropertyDescriptor("color"),

  /**
   * 获取或设置指定锥形效果的强度作为总线长百分比的数值属性。如果为 1.0 或更高，则不使用锥形效果。
   * @memberof PolylineGlowMaterialProperty.prototype
   * @type {Property|undefined}
   */
  glowPower: createPropertyDescriptor("glowPower"),

  /**
   * 获取或设置指定锥形效果的强度作为总线长百分比的数值属性。如果为 1.0 或更高，则不使用锥形效果。
   * @memberof PolylineGlowMaterialProperty.prototype
   * @type {Property|undefined}
   */
  taperPower: createPropertyDescriptor("taperPower"),
});

/**
 * 在提供的时间获取 {@link Material} 类型。
 *
 * @param {JulianDate} time 用于检索类型的时长。
 * @returns {string} The 材料的类型。
 */
PolylineGlowMaterialProperty.prototype.getType = function (time) {
  return "PolylineGlow";
};

const timeScratch = new JulianDate();

/**
 * 在提供的时间获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 用于检索值的时长。如果省略，则使用当前系统时间。
 * @param {object} [result] 用于存储值的对象。如果省略，则创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
PolylineGlowMaterialProperty.prototype.getValue = function (time, result) {
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
  result.glowPower = Property.getValueOrDefault(
    this._glowPower,
    time,
    defaultGlowPower,
    result.glowPower,
  );
  result.taperPower = Property.getValueOrDefault(
    this._taperPower,
    time,
    defaultTaperPower,
    result.taperPower,
  );
  return result;
};

/**
 * 比较该属性与提供的属性，如果相等则返回 <code>true</code>，否则返回 <code>false</code>。
 * 另一个属性。
 *
 * @param {Property} [other] 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
 */
PolylineGlowMaterialProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof PolylineGlowMaterialProperty &&
      Property.equals(this._color, other._color) &&
      Property.equals(this._glowPower, other._glowPower) &&
      Property.equals(this._taperPower, other._taperPower))
  );
};
export default PolylineGlowMaterialProperty;
