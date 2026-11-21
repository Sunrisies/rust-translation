import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} PlaneGraphics.ConstructorOptions
 *
 * PlaneGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定平面的可见性。
 * @property {Property | Plane} [plane] 一个 {@link Plane} 属性，指定平面的法线和距离。
 * @property {Property | Cartesian2} [dimensions] 一个 {@link Cartesian2} 属性，指定平面的宽度和高度。
 * @property {Property | boolean} [fill=true] 一个布尔属性，指定平面是否填充提供的材质。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 一个属性，指定用于填充平面的材质。
 * @property {Property | boolean} [outline=false] 一个布尔属性，指定平面是否有轮廓。
 * @property {Property | Color} [outlineColor=Color.BLACK] 一个属性，指定轮廓的 {@link Color}。
 * @property {Property | number} [outlineWidth=1.0] 一个数值属性，指定轮廓的宽度。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 一个枚举属性，指定平面是投射还是接收光源阴影。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定平面在距离相机多远的位置显示。
 */

/**
 * 描述一个平面。其中心位置和方向由包含的 {@link Entity} 决定。
 *
 * @alias PlaneGraphics
 * @constructor
 *
 * @param {PlaneGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=plane|Cesium Sandcastle Plane Demo}
 */
function PlaneGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._plane = undefined;
  this._planeSubscription = undefined;
  this._dimensions = undefined;
  this._dimensionsSubscription = undefined;
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

Object.defineProperties(PlaneGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof PlaneGraphics.prototype
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },

  /**
   * 获取或设置指定平面可见性的布尔属性。
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定平面的法线和距离的 {@link Plane} 属性。
   *
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   */
  plane: createPropertyDescriptor("plane"),

  /**
   * 获取或设置指定平面的宽度和高度的 {@link Cartesian2} 属性。
   *
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   */
  dimensions: createPropertyDescriptor("dimensions"),

  /**
   * 获取或设置指定平面是否填充提供的材质的布尔属性。
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  fill: createPropertyDescriptor("fill"),

  /**
   * 获取或设置用于填充平面的材质。
   * @memberof PlaneGraphics.prototype
   * @type {MaterialProperty}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定平面是否有轮廓的属性。
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  outline: createPropertyDescriptor("outline"),

  /**
   * 获取或设置指定轮廓的 {@link Color} 的属性。
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置指定轮廓宽度的数值属性。
   * <p>
   * 注意：在 Windows 平台的所有主要浏览器上，此属性将被忽略。详情请参见 (@link https://github.com/CesiumGS/cesium/issues/40)。
   * </p>
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置指定平面
   * 是投射还是接收光源阴影的枚举属性。
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 获取或设置指定平面在距离相机多远的位置显示的 {@link DistanceDisplayCondition} 属性。
   * @memberof PlaneGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),
});

/**
 * 复制此实例。
 *
 * @param {PlaneGraphics} [result] 用于存储结果的对象。
 * @returns {PlaneGraphics} The 修改结果参数或如果未提供则创建新实例。
 */
PlaneGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new PlaneGraphics(this);
  }
  result.show = this.show;
  result.plane = this.plane;
  result.dimensions = this.dimensions;
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
 * 将此对象上每个未分配的属性赋值给
 * 提供源对象上相同属性的值。
 *
 * @param {PlaneGraphics} source 要合并到该对象的实体。
 */
PlaneGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.plane = this.plane ?? source.plane;
  this.dimensions = this.dimensions ?? source.dimensions;
  this.fill = this.fill ?? source.fill;
  this.material = this.material ?? source.material;
  this.outline = this.outline ?? source.outline;
  this.outlineColor = this.outlineColor ?? source.outlineColor;
  this.outlineWidth = this.outlineWidth ?? source.outlineWidth;
  this.shadows = this.shadows ?? source.shadows;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
};
export default PlaneGraphics;
