import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} PolylineVolumeGraphics.ConstructorOptions
 *
 * PolylineVolumeGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定体积的可见性。
 * @property {Property | Cartesian3[]} [positions] 一个属性，指定定义线条带子的 {@link Cartesian3} 位置数组。
 * @property {Property | Cartesian2[]} [shape] 一个属性，指定定义要拉伸的形状的 {@link Cartesian2} 位置数组。
 * @property {Property | CornerType} [cornerType=CornerType.ROUNDED] 一个 {@link CornerType} 属性，指定角的样式。
 * @property {Property | number} [granularity=Cesium.Math.RADIANS_PER_DEGREE] 一个数值属性，指定每个经纬度点之间的角度距离。
 * @property {Property | boolean} [fill=true] 一个布尔属性，指定体积是否由提供的材料填充。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 一个属性，指定用于填充体积的材料。
 * @property {Property | boolean} [outline=false] 一个布尔属性，指定体积是否带有轮廓。
 * @property {Property | Color} [outlineColor=Color.BLACK] 一个属性，指定轮廓的 {@link Color}。
 * @property {Property | number} [outlineWidth=1.0] 一个数值属性，指定轮廓的宽度。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 一个枚举属性，指定体积是否投射或接收光源的阴影。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定该体积在距离相机多远的位置显示。
 */

/**
 * 描述了一个作为线条带子并沿其拉伸的二维形状定义的折线体积。
 * 生成的体积符合地球曲率。
 *
 * @alias PolylineVolumeGraphics
 * @constructor
 *
 * @param {PolylineVolumeGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @see Entity
 * @demo {@link https://sandcastle.cesium.com/index.html?id=polyline-volume|Cesium Sandcastle Polyline Volume Demo}
 */
function PolylineVolumeGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._positions = undefined;
  this._positionsSubscription = undefined;
  this._shape = undefined;
  this._shapeSubscription = undefined;
  this._cornerType = undefined;
  this._cornerTypeSubscription = undefined;
  this._granularity = undefined;
  this._granularitySubscription = undefined;
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
  this._shadows = undefined;
  this._shadowsSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubsription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(PolylineVolumeGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof PolylineVolumeGraphics.prototype
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
   * 获取或设置指定体积可见性的布尔属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定定义线条带子的 {@link Cartesian3} 位置数组的属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   */
  positions: createPropertyDescriptor("positions"),

  /**
   * 获取或设置指定定义要拉伸的形状的 {@link Cartesian2} 位置数组的属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   */
  shape: createPropertyDescriptor("shape"),

  /**
   * 获取或设置指定角样式的 {@link CornerType} 属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   * @default CornerType.ROUNDED
   */
  cornerType: createPropertyDescriptor("cornerType"),

  /**
   * 获取或设置指定体积上点之间的角度距离的数值属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   * @default {CesiumMath.RADIANS_PER_DEGREE}
   */
  granularity: createPropertyDescriptor("granularity"),

  /**
   * 获取或设置指定体积是否由提供的材料填充的布尔属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  fill: createPropertyDescriptor("fill"),

  /**
   * 获取或设置用于填充体积的材料的属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {MaterialProperty}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定体积是否带有轮廓的属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  outline: createPropertyDescriptor("outline"),

  /**
   * 获取或设置轮廓的 {@link Color} 属性。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置轮廓宽度的数值属性。
   * <p>
   * 注意：此属性在 Windows 平台的所有主流浏览器上将被忽略。详情请参见 (@link https://github.com/CesiumGS/cesium/issues/40})。
   * </p>
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置枚举属性，指定该体积是否
   * 从光源投射或接收阴影。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 获取或设置 {@link DistanceDisplayCondition} 属性，指定该体积在距相机多远的距离下显示。
   * @memberof PolylineVolumeGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),
});

/**
 * 复制此实例。
 *
 * @param {PolylineVolumeGraphics} [result] 用于存储结果的对象。
 * @returns {PolylineVolumeGraphics} The 修改结果参数，或如果未提供则创建新实例。
 */
PolylineVolumeGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new PolylineVolumeGraphics(this);
  }
  result.show = this.show;
  result.positions = this.positions;
  result.shape = this.shape;
  result.cornerType = this.cornerType;
  result.granularity = this.granularity;
  result.fill = this.fill;
  result.material = this.material;
  result.outline = this.outline;
  result.outlineColor = this.outlineColor;
  result.outlineWidth = this.outlineWidth;
  result.shadows = this.shadows;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  return result;
};

/**
 * 将此对象上所有未分配的属性赋值给
 * 提供的源对象上相同属性的值。
 *
 * @param {PolylineVolumeGraphics} source 将被合并到此对象的对象。
 */
PolylineVolumeGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.positions = this.positions ?? source.positions;
  this.shape = this.shape ?? source.shape;
  this.cornerType = this.cornerType ?? source.cornerType;
  this.granularity = this.granularity ?? source.granularity;
  this.fill = this.fill ?? source.fill;
  this.material = this.material ?? source.material;
  this.outline = this.outline ?? source.outline;
  this.outlineColor = this.outlineColor ?? source.outlineColor;
  this.outlineWidth = this.outlineWidth ?? source.outlineWidth;
  this.shadows = this.shadows ?? source.shadows;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
};
export default PolylineVolumeGraphics;
