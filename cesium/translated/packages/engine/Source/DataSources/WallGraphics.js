import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} WallGraphics.ConstructorOptions
 *
 * WallGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定墙的可见性。
 * @property {Property | Cartesian3[]} [positions] 一个属性，指定定义墙顶部的 {@link Cartesian3} 位置数组。
 * @property {Property | number[]} [minimumHeights] 一个属性，指定用于墙底部的高程数组，以替代地球表面高度。
 * @property {Property | number[]} [maximumHeights] 一个属性，指定用于墙顶部的高程数组，以替代每个位置的高度。
 * @property {Property | number} [granularity=Cesium.Math.RADIANS_PER_DEGREE] 一个数值属性，指定每个经纬度点之间的角度距离。
 * @property {Property | boolean} [fill=true] 一个布尔属性，指定墙是否由提供的材料填充。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 一个属性，指定用于填充墙的材料。
 * @property {Property | boolean} [outline=false] 一个布尔属性，指定墙是否有轮廓线。
 * @property {Property | Color} [outlineColor=Color.BLACK] 一个属性，指定轮廓线的 {@link Color}。
 * @property {Property | number} [outlineWidth=1.0] 一个数值属性，指定轮廓线的宽度。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 一个枚举属性，指定墙是反射还是接收光源的阴影。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定墙在距离相机多远的位置显示。
 */

/**
 * 描述了一个二维墙，由线条条定义，并可选指定最高和最低高度。
 * 墙符合地球的曲率，可以放置在表面或高度处。
 *
 * @alias WallGraphics
 * @constructor
 *
 * @param {WallGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @see Entity
 * @demo {@link https://sandcastle.cesium.com/index.html?id=wall|Cesium Sandcastle Wall Demo}
 */
function WallGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._positions = undefined;
  this._positionsSubscription = undefined;
  this._minimumHeights = undefined;
  this._minimumHeightsSubscription = undefined;
  this._maximumHeights = undefined;
  this._maximumHeightsSubscription = undefined;
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
  this._distanceDisplayConditionSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(WallGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof WallGraphics.prototype
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
   * 获取或设置指定墙可见性的布尔属性。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置定义墙顶部的 {@link Cartesian3} 位置数组的属性。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   */
  positions: createPropertyDescriptor("positions"),

  /**
   * 获取或设置用于墙底部的高程数组，以替代地球表面高度的属性。
   * 如果定义，该数组的长度必须与 {@link Wall#positions} 相同。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   */
  minimumHeights: createPropertyDescriptor("minimumHeights"),

  /**
   * 获取或设置用于墙顶部的高程数组，以替代每个位置的高度的属性。
   * 如果定义，该数组的长度必须与 {@link Wall#positions} 相同。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   */
  maximumHeights: createPropertyDescriptor("maximumHeights"),

  /**
   * 获取或设置指定墙上点之间的角度距离的数值属性。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   * @default {CesiumMath.RADIANS_PER_DEGREE}
   */
  granularity: createPropertyDescriptor("granularity"),

  /**
   * 获取或设置指定墙是否由提供的材料填充的布尔属性。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  fill: createPropertyDescriptor("fill"),

  /**
   * 获取或设置用于填充墙的材料的属性。
   * @memberof WallGraphics.prototype
   * @type {MaterialProperty}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定墙是否有轮廓线的属性。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  outline: createPropertyDescriptor("outline"),

  /**
   * 获取或设置指定轮廓 {@link Color} 的属性。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置指定轮廓宽度的数值属性。
   * <p>
   * 注意：在 Windows 平台的所有主流浏览器中，此属性将被忽略。详情请参见 (@link https://github.com/CesiumGS/cesium/issues/40)。
   * </p>
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置枚举属性，指定墙壁
   * 是否投射或接收光源的阴影。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 获取或设置 {@link DistanceDisplayCondition} 属性，指定该墙壁在距相机多远的距离下显示。
   * @memberof WallGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),
});

/**
 * 复制此实例。
 *
 * @param {WallGraphics} [result] 用于存储结果的对象。
 * @returns {WallGraphics} The 修改结果参数或提供一个新实例（如果未提供）。
 */
WallGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new WallGraphics(this);
  }
  result.show = this.show;
  result.positions = this.positions;
  result.minimumHeights = this.minimumHeights;
  result.maximumHeights = this.maximumHeights;
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
 * @param {WallGraphics} source 要合并到此对象的对象。
 */
WallGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.positions = this.positions ?? source.positions;
  this.minimumHeights = this.minimumHeights ?? source.minimumHeights;
  this.maximumHeights = this.maximumHeights ?? source.maximumHeights;
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
export default WallGraphics;
