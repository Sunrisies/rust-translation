import {
  Cartesian2,
  Color,
  Event,
  Frozen,
  JulianDate,
  defined,
} from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";

const defaultEvenColor = Color.WHITE;
const defaultOddColor = Color.BLACK;
const defaultRepeat = new Cartesian2(2.0, 2.0);

/**
 * 一个映射至棋盘式 {@link Material} 统一体的 {@link MaterialProperty}。
 * @alias CheckerboardMaterialProperty
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Property|Color} [options.evenColor=Color.WHITE] 指定第一个 {@link Color} 的属性。
 * @param {Property|Color} [options.oddColor=Color.BLACK] 指定第二个 {@link Color} 的属性。
 * @param {Property|Cartesian2} [options.repeat=new Cartesian2(2.0, 2.0)] 指定每个方向上瓦片重复次数的 {@link Cartesian2} 属性。
 */
function CheckerboardMaterialProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._definitionChanged = new Event();
  this._evenColor = undefined;
  this._evenColorSubscription = undefined;
  this._oddColor = undefined;
  this._oddColorSubscription = undefined;
  this._repeat = undefined;
  this._repeatSubscription = undefined;

  this.evenColor = options.evenColor;
  this.oddColor = options.oddColor;
  this.repeat = options.repeat;
}

Object.defineProperties(CheckerboardMaterialProperty.prototype, {
  /**
   * 获取一个值以指示该属性是否为常量。如果`getValue` 始终返回相同的结果，则该属性被视为
   * 常量。
   * @memberof CheckerboardMaterialProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        Property.isConstant(this._evenColor) && //
        Property.isConstant(this._oddColor) && //
        Property.isConstant(this._repeat)
      );
    },
  },

  /**
   * 当该属性的定义发生变化时引发的事件。
   * 如果调用`getValue` 在相同时间内返回不同的结果，则认为定义已改变。
   * 指定第一个 {@link Color} 的属性。
   * @memberof CheckerboardMaterialProperty.prototype
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
   * 指定第二个 {@link Color} 的属性。
   * @memberof CheckerboardMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  evenColor: createPropertyDescriptor("evenColor"),

  /**
   * 指定第二个 {@link Color} 的属性。
   * @memberof CheckerboardMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  oddColor: createPropertyDescriptor("oddColor"),

  /**
   * 指定每个方向上瓦片重复次数的 {@link Cartesian2} 属性。
   * @memberof CheckerboardMaterialProperty.prototype
   * @type {Property|undefined}
   * @default new Cartesian2(2.0, 2.0)
   */
  repeat: createPropertyDescriptor("repeat"),
});

/**
 * 在提供的时间获取 {@link Material} 类型。
 *
 * @param {JulianDate} time 用于检索类型的时长。
 * @returns {string} The 材料类型。
 */
CheckerboardMaterialProperty.prototype.getType = function (time) {
  return "Checkerboard";
};

const timeScratch = new JulianDate();

/**
 * 在提供的时间获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 用于检索值的时长。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的目标对象。如果省略，将创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
CheckerboardMaterialProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  if (!defined(result)) {
    result = {};
  }
  result.lightColor = Property.getValueOrClonedDefault(
    this._evenColor,
    time,
    defaultEvenColor,
    result.lightColor,
  );
  result.darkColor = Property.getValueOrClonedDefault(
    this._oddColor,
    time,
    defaultOddColor,
    result.darkColor,
  );
  result.repeat = Property.getValueOrDefault(this._repeat, time, defaultRepeat);
  return result;
};

/**
 * 比较该属性与提供的属性，如果相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
CheckerboardMaterialProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof CheckerboardMaterialProperty && //
      Property.equals(this._evenColor, other._evenColor) && //
      Property.equals(this._oddColor, other._oddColor) && //
      Property.equals(this._repeat, other._repeat))
  );
};
export default CheckerboardMaterialProperty;
