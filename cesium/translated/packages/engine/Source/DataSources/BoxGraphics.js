import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} BoxGraphics.ConstructorOptions
 *
 * BoxGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定盒子的可见性。
 * @property {Property | Cartesian3} [dimensions] 一个 {@link Cartesian3} 属性，指定盒子的长度、宽度和高度。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 一个属性，指定实体位置的高度相对于什么。
 * @property {Property | boolean} [fill=true] 一个布尔属性，指定盒子是否填充了提供的材质。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 一个属性，指定用于填充盒子的材质。
 * @property {Property | boolean} [outline=false] 一个布尔属性，指定盒子是否有轮廓。
 * @property {Property | Color} [outlineColor=Color.BLACK] 一个属性，指定轮廓的 {@link Color} 值。
 * @property {Property | number} [outlineWidth=1.0] 一个数值属性，指定轮廓的宽度。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 一个枚举属性，指定盒子是投射还是接收光源阴影。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定该盒子在距离相机多远的位置显示。
 *
 */

/**
 * 描述一个盒子。其中心位置和方向由包含的 {@link Entity} 决定。
 *
 * @alias BoxGraphics
 * @constructor
 *
 * @param {BoxGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=box|Cesium Sandcastle Box Demo}
 */
function BoxGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._dimensions = undefined;
  this._dimensionsSubscription = undefined;
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
  this._shadows = undefined;
  this._shadowsSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(BoxGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof BoxGraphics.prototype
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },

  /**
   * 获取或设置指定盒子可见性的布尔属性。
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定盒子长度、宽度和高度的 {@link Cartesian3} 属性。
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   */
  dimensions: createPropertyDescriptor("dimensions"),

  /**
   * 获取或设置指定 {@link HeightReference} 的属性。
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * 获取或设置指定盒子是否填充了提供材质的布尔属性。
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  fill: createPropertyDescriptor("fill"),

  /**
   * 获取或设置用于填充盒子的材质。
   * @memberof BoxGraphics.prototype
   * @type {MaterialProperty|undefined}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定盒子是否有轮廓的属性。
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  outline: createPropertyDescriptor("outline"),

  /**
   * 获取或设置指定轮廓 {@link Color} 的值。
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置指定轮廓宽度的数值属性。
   * <p>
   * 注意：在 Windows 平台的所有主要浏览器上，此属性将被忽略。详情请参见 (@link https://github.com/CesiumGS/cesium/issues/40)。
   * </p>
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置枚举属性，指定盒子是投射还是接收光源阴影。
   * 获取或设置指定盒子在距离相机多远的位置显示 {@link DistanceDisplayCondition} 属性。
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 复制此实例。
   * @memberof BoxGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),
});

/**
 * 存储结果的对象。
 *
 * @param {BoxGraphics} [result] 存储结果的对象。如果未提供结果参数，则创建新实例。
 * @returns {BoxGraphics} The 将此对象上所有未分配的属性值分配给提供源对象上相同属性的值。
 */
BoxGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new BoxGraphics(this);
  }
  result.show = this.show;
  result.dimensions = this.dimensions;
  result.heightReference = this.heightReference;
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
 * Assigns each unassigned property on this object to the value
 * of the same property on the provided source object.
 *
 * @param {BoxGraphics} source 要合并到该对象的实体。
 */
BoxGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.dimensions = this.dimensions ?? source.dimensions;
  this.heightReference = this.heightReference ?? source.heightReference;
  this.fill = this.fill ?? source.fill;
  this.material = this.material ?? source.material;
  this.outline = this.outline ?? source.outline;
  this.outlineColor = this.outlineColor ?? source.outlineColor;
  this.outlineWidth = this.outlineWidth ?? source.outlineWidth;
  this.shadows = this.shadows ?? source.shadows;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
};
export default BoxGraphics;
