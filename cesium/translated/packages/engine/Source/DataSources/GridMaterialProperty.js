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

const defaultColor = Color.WHITE;
const defaultCellAlpha = 0.1;
const defaultLineCount = new Cartesian2(8, 8);
const defaultLineOffset = new Cartesian2(0, 0);
const defaultLineThickness = new Cartesian2(1, 1);

/**
 * A {@link MaterialProperty} that maps to grid {@link Material} uniforms.
 * @alias GridMaterialProperty
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Property|Color} [options.color=Color.WHITE] 指定网格 {@link Color} 的属性。
 * @param {Property|number} [options.cellAlpha=0.1] 指定单元格 alpha 值的数值属性。
 * @param {Property|Cartesian2} [options.lineCount=new Cartesian2(8, 8)] A {@link Cartesian2} Property specifying the number of grid lines along each axis.
 * @param {Property|Cartesian2} [options.lineThickness=new Cartesian2(1.0, 1.0)] A {@link Cartesian2} Property specifying the thickness of grid lines along each axis.
 * @param {Property|Cartesian2} [options.lineOffset=new Cartesian2(0.0, 0.0)] A {@link Cartesian2} Property specifying starting offset of grid lines along each axis.
 *
 * @constructor
 */
function GridMaterialProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._definitionChanged = new Event();
  this._color = undefined;
  this._colorSubscription = undefined;
  this._cellAlpha = undefined;
  this._cellAlphaSubscription = undefined;
  this._lineCount = undefined;
  this._lineCountSubscription = undefined;
  this._lineThickness = undefined;
  this._lineThicknessSubscription = undefined;
  this._lineOffset = undefined;
  this._lineOffsetSubscription = undefined;

  this.color = options.color;
  this.cellAlpha = options.cellAlpha;
  this.lineCount = options.lineCount;
  this.lineThickness = options.lineThickness;
  this.lineOffset = options.lineOffset;
}

Object.defineProperties(GridMaterialProperty.prototype, {
  /**
   * 获取一个值以指示该属性是否为常量。如果 <code>getValue</code> 始终返回相同的结果，则属性被视为
   * 常量。
   * @memberof GridMaterialProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        Property.isConstant(this._color) &&
        Property.isConstant(this._cellAlpha) &&
        Property.isConstant(this._lineCount) &&
        Property.isConstant(this._lineThickness) &&
        Property.isConstant(this._lineOffset)
      );
    },
  },

  /**
   * 当该属性的定义发生变化时引发的事件。
   * 如果调用 <code>getValue</code> 会返回
   * 不同的结果，则认为定义已改变。
   * @memberof GridMaterialProperty.prototype
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
   * 获取或设置指定网格 {@link Color} 的属性。
   * @memberof GridMaterialProperty.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  color: createPropertyDescriptor("color"),

  /**
   * 获取或设置指定单元格 alpha 值的数值属性。
   * @memberof GridMaterialProperty.prototype
   * @type {Property|undefined}
   * @default 0.1
   */
  cellAlpha: createPropertyDescriptor("cellAlpha"),

  /**
   * Gets or sets the {@link Cartesian2} Property specifying the number of grid lines along each axis.
   * @memberof GridMaterialProperty.prototype
   * @type {Property|undefined}
   * @default new <code>Cartesian2</code>(8.0, 8.0)
   */
  lineCount: createPropertyDescriptor("lineCount"),

  /**
   * Gets or sets the {@link Cartesian2} Property specifying the thickness of grid lines along each axis.
   * @memberof GridMaterialProperty.prototype
   * @type {Property|undefined}
   * @default new <code>Cartesian2</code>(1.0, 1.0)
   */
  lineThickness: createPropertyDescriptor("lineThickness"),

  /**
   * Gets or sets the {@link Cartesian2} Property specifying the starting offset of grid lines along each axis.
   * @memberof GridMaterialProperty.prototype
   * @type {Property|undefined}
   * @default new <code>Cartesian2</code>(0.0, 0.0)
   */
  lineOffset: createPropertyDescriptor("lineOffset"),
});

/**
 * 在给定时间获取的 {@link Material} 类型。
 *
 * @param {JulianDate} time 获取类型的时间。
 * @returns {string} The 材料的类型。
 */
GridMaterialProperty.prototype.getType = function (time) {
  return "Grid";
};

const timeScratch = new JulianDate();

/**
 * 在给定时间获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 获取值的时间。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，则创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
GridMaterialProperty.prototype.getValue = function (time, result) {
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
  result.cellAlpha = Property.getValueOrDefault(
    this._cellAlpha,
    time,
    defaultCellAlpha,
  );
  result.lineCount = Property.getValueOrClonedDefault(
    this._lineCount,
    time,
    defaultLineCount,
    result.lineCount,
  );
  result.lineThickness = Property.getValueOrClonedDefault(
    this._lineThickness,
    time,
    defaultLineThickness,
    result.lineThickness,
  );
  result.lineOffset = Property.getValueOrClonedDefault(
    this._lineOffset,
    time,
    defaultLineOffset,
    result.lineOffset,
  );
  return result;
};

/**
 * 比较此属性与提供的属性，如果相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
GridMaterialProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof GridMaterialProperty && //
      Property.equals(this._color, other._color) && //
      Property.equals(this._cellAlpha, other._cellAlpha) && //
      Property.equals(this._lineCount, other._lineCount) && //
      Property.equals(this._lineThickness, other._lineThickness) && //
      Property.equals(this._lineOffset, other._lineOffset))
  );
};
export default GridMaterialProperty;