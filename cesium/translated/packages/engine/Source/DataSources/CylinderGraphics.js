import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} CylinderGraphics.ConstructorOptions
 *
 * CylinderGraphics构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定圆柱体的可见性。
 * @property {Property | number} [length] 一个数值属性，指定圆柱体的长度。
 * @property {Property | number} [topRadius] 一个数值属性，指定圆柱体顶部的半径。
 * @property {Property | number} [bottomRadius] 一个数值属性，指定圆柱体底部的半径。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 一个属性，指定从实体位置起的高度参照对象。
 * @property {Property | boolean} [fill=true] 一个布尔属性，指定圆柱体是否填充所提供的材质。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 一个属性，指定用于填充圆柱体的材质。
 * @property {Property | boolean} [outline=false] 一个布尔属性，指定圆柱体是否有轮廓线。
 * @property {Property | Color} [outlineColor=Color.BLACK] 一个属性，指定轮廓线的 {@link Color}。
 * @property {Property | number} [outlineWidth=1.0] 一个数值属性，指定轮廓线的宽度。
 * @property {Property | number} [numberOfVerticalLines=16] 一个数值属性，指定为绘制轮廓线沿边缘的垂直线数。
 * @property {Property | number} [slices=128] 圆柱体边缘的边数。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 一个枚举属性，指定圆柱体是投射还是接收光源的阴影。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定圆柱体在距离相机多远的位置显示。
 */

/**
 * 描述由长度、顶部半径和底部半径定义的圆柱体、截断圆锥体或圆锥体。
 * 中心位置和方向由包含的 {@link Entity} 决定。
 *
 * @alias CylinderGraphics
 * @constructor
 *
 * @param {CylinderGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 */
function CylinderGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._length = undefined;
  this._lengthSubscription = undefined;
  this._topRadius = undefined;
  this._topRadiusSubscription = undefined;
  this._bottomRadius = undefined;
  this._bottomRadiusSubscription = undefined;
  this._heightReference = undefined;
  this._heightReferenceSubscription = undefined;
  this._fill = undefined;
  this._fillSubscription = undefined;
  this._material = undefined;
  this._materialSubscription = undefined;
  this._outline = undefined;
  this._outlineSubscription = undefined;
  this._outlineColor = undefined;
  this._outlineColorSubscription = undefined;
  this._outlineWidth = undefined;
  this._outlineWidthSubscription = undefined;
  this._numberOfVerticalLines = undefined;
  this._numberOfVerticalLinesSubscription = undefined;
  this._slices = undefined;
  this._slicesSubscription = undefined;
  this._shadows = undefined;
  this._shadowsSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(CylinderGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof CylinderGraphics.prototype
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
   * 获取或设置指定圆柱体可见性的布尔属性。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定圆柱体长度的数值属性。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   */
  length: createPropertyDescriptor("length"),

  /**
   * 获取或设置指定圆柱体顶部的半径的数值属性。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   */
  topRadius: createPropertyDescriptor("topRadius"),

  /**
   * 获取或设置指定圆柱体底部的半径的数值属性。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   */
  bottomRadius: createPropertyDescriptor("bottomRadius"),

  /**
   * 获取或设置指定 {@link HeightReference} 的属性。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * 获取或设置指定圆柱体是否填充所提供材质的布尔属性。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  fill: createPropertyDescriptor("fill"),

  /**
   * 获取或设置用于填充圆柱体的材质属性。
   * @memberof CylinderGraphics.prototype
   * @type {MaterialProperty|undefined}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定圆柱体是否有轮廓线的布尔属性。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  outline: createPropertyDescriptor("outline"),

  /**
   * 获取或设置轮廓线的 {@link Color} 属性。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置轮廓线的宽度数值属性。
   * <p>
   * 注意：此属性在Windows平台的所有主要浏览器上将被忽略。详情请参见 (@link https://github.com/CesiumGS/cesium/issues/40})。
   * </p>
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置属性，指定轮廓沿边缘绘制的垂直线数。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default 16
   */
  numberOfVerticalLines: createPropertyDescriptor("numberOfVerticalLines"),

  /**
   * 获取或设置属性，指定圆柱体的边缘数量。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default 128
   */
  slices: createPropertyDescriptor("slices"),

  /**
   * 获取或设置枚举属性，指定圆柱体是否
   * 投射或接收来自光源的阴影。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 获取或设置 {@link DistanceDisplayCondition} 属性，指定该圆柱体在距相机多远的位置显示。
   * @memberof CylinderGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),
});

/**
 * 复制此实例。
 *
 * @param {CylinderGraphics} [result] 存储结果的对象。
 * @returns {CylinderGraphics} The 修改结果参数或提供一个新实例（如果未提供）。
 */
CylinderGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new CylinderGraphics(this);
  }
  result.show = this.show;
  result.length = this.length;
  result.topRadius = this.topRadius;
  result.bottomRadius = this.bottomRadius;
  result.heightReference = this.heightReference;
  result.fill = this.fill;
  result.material = this.material;
  result.outline = this.outline;
  result.outlineColor = this.outlineColor;
  result.outlineWidth = this.outlineWidth;
  result.numberOfVerticalLines = this.numberOfVerticalLines;
  result.slices = this.slices;
  result.shadows = this.shadows;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  return result;
};

/**
 * 将此对象上所有未分配的属性赋值给
 * 提供的源对象上相同属性的值。
 *
 * @param {CylinderGraphics} source 要合并到此对象的对象。
 */
CylinderGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.length = this.length ?? source.length;
  this.topRadius = this.topRadius ?? source.topRadius;
  this.bottomRadius = this.bottomRadius ?? source.bottomRadius;
  this.heightReference = this.heightReference ?? source.heightReference;
  this.fill = this.fill ?? source.fill;
  this.material = this.material ?? source.material;
  this.outline = this.outline ?? source.outline;
  this.outlineColor = this.outlineColor ?? source.outlineColor;
  this.outlineWidth = this.outlineWidth ?? source.outlineWidth;
  this.numberOfVerticalLines =
    this.numberOfVerticalLines ?? source.numberOfVerticalLines;
  this.slices = this.slices ?? source.slices;
  this.shadows = this.shadows ?? source.shadows;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
};
export default CylinderGraphics;
