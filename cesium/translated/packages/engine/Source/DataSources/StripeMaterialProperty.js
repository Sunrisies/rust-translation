import { Color, Event, Frozen, JulianDate, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";
import StripeOrientation from "./StripeOrientation.js";

const defaultOrientation = StripeOrientation.HORIZONTAL;
const defaultEvenColor = Color.WHITE;
const defaultOddColor = Color.BLACK;
const defaultOffset = 0;
const defaultRepeat = 1;

/**
 * A {@link MaterialProperty} that maps to stripe {@link Material} uniforms.
 * @alias StripeMaterialProperty
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Property|StripeOrientation} [options.orientation=StripeOrientation.HORIZONTAL] 指定 {@link StripeOrientation} 的属性。
 * @param {Property|Color} [options.evenColor=Color.WHITE] 指定第一个 {@link Color} 的属性。
 * @param {Property|Color} [options.oddColor=Color.BLACK] 指定第二个 {@link Color} 的属性。
 * @param {Property|number} [options.offset=0] 指定开始绘制材料在图案中起始位置的数值属性。
 * @param {Property|number} [options.repeat=1] 指定条纹重复次数的数值属性。
 */
function StripeMaterialProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._definitionChanged = new Event();
  this._orientation = undefined;
  this._orientationSubscription = undefined;
  this._evenColor = undefined;
  this._evenColorSubscription = undefined;
  this._oddColor = undefined;
  this._oddColorSubscription = undefined;
  this._offset = undefined;
  this._offsetSubscription = undefined;
  this._repeat = undefined;
  this._repeatSubscription = undefined;

  this.orientation = options.orientation;
  this.evenColor = options.evenColor;
  this.oddColor = options.oddColor;
  this.offset = options.offset;
  this.repeat = options.repeat;
}

Object.defineProperties(StripeMaterialProperty.prototype, {
  /**
   * 获取表示该属性是否为常量的值。如果 <code>getValue</code> 始终返回相同的结果，则视为常量。
   * 当该属性的定义发生变化时触发事件。
   * @memberof StripeMaterialProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        Property.isConstant(this._orientation) && //
        Property.isConstant(this._evenColor) && //
        Property.isConstant(this._oddColor) && //
        Property.isConstant(this._offset) && //
        Property.isConstant(this._repeat)
      );
    },
  },
  /**
   * Gets the event that is raised whenever the definition of this property changes.
   * 如果调用 <code>getValue</code> 在相同时间内返回不同的结果，则认为定义已改变。
   * 获取或设置指定 {@link StripeOrientation} 的属性。
   * @memberof StripeMaterialProperty.prototype
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
   * 获取或设置指定第一个 {@link Color} 的属性。
   * @memberof StripeMaterialProperty.prototype
   * @type {Property|undefined}
   * @default StripeOrientation.HORIZONTAL
   */
  orientation: createPropertyDescriptor("orientation"),

  /**
   * 获取或设置指定第二个 {@link Color} 的属性。
   * @memberof StripeMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  evenColor: createPropertyDescriptor("evenColor"),

  /**
   * 获取或设置指定第二个 {@link Color} 的属性。
   * @memberof StripeMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  oddColor: createPropertyDescriptor("oddColor"),

  /**
   * 获取或设置指定绘制起始点的数值属性。
   * 0.0 表示偶数颜色的起始点，1.0 表示奇数颜色的起始点，2.0 再次表示偶数颜色，任何倍数或分数值均表示中间状态。
   * 获取或设置条纹重复次数的数值属性。
   * 获取在给定时间下的 {@link Material} 类型。
   * @memberof StripeMaterialProperty.prototype
   * @type {Property|undefined}
   * @default 0.0
   */
  offset: createPropertyDescriptor("offset"),

  /**
   * 用于检索类型的时间。
   * @memberof StripeMaterialProperty.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  repeat: createPropertyDescriptor("repeat"),
});

/**
 * Gets the {@link Material} type at the provided time.
 *
 * @param {JulianDate} time 用于获取类型的时间。
 * @returns {string} The 材料的类型。
 */
StripeMaterialProperty.prototype.getType = function (time) {
  return "Stripe";
};

const timeScratch = new JulianDate();

/**
 * 获取在给定时间下的属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 用于获取值的时间。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，则创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
StripeMaterialProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  if (!defined(result)) {
    result = {};
  }
  result.horizontal =
    Property.getValueOrDefault(this._orientation, time, defaultOrientation) ===
    StripeOrientation.HORIZONTAL;
  result.evenColor = Property.getValueOrClonedDefault(
    this._evenColor,
    time,
    defaultEvenColor,
    result.evenColor,
  );
  result.oddColor = Property.getValueOrClonedDefault(
    this._oddColor,
    time,
    defaultOddColor,
    result.oddColor,
  );
  result.offset = Property.getValueOrDefault(this._offset, time, defaultOffset);
  result.repeat = Property.getValueOrDefault(this._repeat, time, defaultRepeat);
  return result;
};

/**
 * 比较该属性与提供的属性，如果相等则返回 <code>true</code>，否则返回 <code>false</code>。
 * 如果左右值相等，则返回 <code>false</code>，否则返回另一个属性。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
 */
StripeMaterialProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof StripeMaterialProperty && //
      Property.equals(this._orientation, other._orientation) && //
      Property.equals(this._evenColor, other._evenColor) && //
      Property.equals(this._oddColor, other._oddColor) && //
      Property.equals(this._offset, other._offset) && //
      Property.equals(this._repeat, other._repeat))
  );
};
export default StripeMaterialProperty;