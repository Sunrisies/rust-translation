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

const defaultRepeat = new Cartesian2(1, 1);
const defaultTransparent = false;
const defaultColor = Color.WHITE;

/**
 * 一个映射至影像 {@link Material} 统一变量的 {@link MaterialProperty}。
 * @alias ImageMaterialProperty
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Property|string|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} [options.image] 指定影像、URL、Canvas 或 Video 的属性。
 * @param {Property|Cartesian2} [options.repeat=new Cartesian2(1.0, 1.0)] 指定图像在每个方向上重复次数的 {@link Cartesian2} 属性。
 * @param {Property|Color} [options.color=Color.WHITE] 应用于图像的颜色。
 * @param {Property|boolean} [options.transparent=false] 当图像具有透明度时设为 true（例如，当 PNG 包含透明部分时）。
 */
function ImageMaterialProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._definitionChanged = new Event();
  this._image = undefined;
  this._imageSubscription = undefined;
  this._repeat = undefined;
  this._repeatSubscription = undefined;
  this._color = undefined;
  this._colorSubscription = undefined;
  this._transparent = undefined;
  this._transparentSubscription = undefined;

  this.image = options.image;
  this.repeat = options.repeat;
  this.color = options.color;
  this.transparent = options.transparent;
}

Object.defineProperties(ImageMaterialProperty.prototype, {
  /**
   * 获取指示该属性是否为常量的值。如果`getValue`始终返回相同的结果，则认为该属性为常量。
   * 当调用`getValue`返回不同结果时，认为该定义已改变。
   * @memberof ImageMaterialProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        Property.isConstant(this._image) && Property.isConstant(this._repeat)
      );
    },
  },

  /**
   * 当该属性的定义发生变化时引发的事件。
   * 如果调用`getValue`在不同时间返回不同结果，则认为该定义已改变。
   * 指定要使用的影像、URL、Canvas 或 Video 的属性。
   * @memberof ImageMaterialProperty.prototype
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
   * 指定图像在每个方向上重复次数的 {@link Cartesian2} 属性。
   * @memberof ImageMaterialProperty.prototype
   * @type {Property|undefined}
   */
  image: createPropertyDescriptor("image"),

  /**
   * Gets or sets the {@link Cartesian2} Property specifying the number of times the image repeats in each direction.
   * @memberof ImageMaterialProperty.prototype
   * @type {Property|undefined}
   * @default new Cartesian2(1, 1)
   */
  repeat: createPropertyDescriptor("repeat"),

  /**
   * 指定应用于图像的所需颜色的颜色属性。
   * @memberof ImageMaterialProperty.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  color: createPropertyDescriptor("color"),

  /**
   * 指定图像是否具有透明度的布尔属性。
   * @memberof ImageMaterialProperty.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  transparent: createPropertyDescriptor("transparent"),
});

/**
 * 在指定时间获取 {@link Material} 类型。
 *
 * @param {JulianDate} time 用于检索类型的时长。
 * @returns {string} The 材料的类型。
 */
ImageMaterialProperty.prototype.getType = function (time) {
  return "Image";
};

const timeScratch = new JulianDate();

/**
 * 在指定时间获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 用于检索值的时长。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的目标对象。如果省略，将创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
ImageMaterialProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }

  if (!defined(result)) {
    result = {};
  }

  result.image = Property.getValueOrUndefined(this._image, time);
  result.repeat = Property.getValueOrClonedDefault(
    this._repeat,
    time,
    defaultRepeat,
    result.repeat,
  );
  result.color = Property.getValueOrClonedDefault(
    this._color,
    time,
    defaultColor,
    result.color,
  );
  if (Property.getValueOrDefault(this._transparent, time, defaultTransparent)) {
    result.color.alpha = Math.min(0.99, result.color.alpha);
  }

  return result;
};

/**
 * 比较该属性与提供的属性，如果相等则返回<code>true</code>，否则返回<code>false</code>。
 * <code>true</code> 如果它们相等，<code>false</code> 否则。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回<code>false</code> 否则。
 */
ImageMaterialProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof ImageMaterialProperty &&
      Property.equals(this._image, other._image) &&
      Property.equals(this._repeat, other._repeat) &&
      Property.equals(this._color, other._color) &&
      Property.equals(this._transparent, other._transparent))
  );
};
export default ImageMaterialProperty;