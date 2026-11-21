import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} PathGraphics.ConstructorOptions
 *
 * PathGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 指定路径可见性的布尔属性。
 * @property {Property | number} [leadTime] 指定对象前方显示秒数的属性。
 * @property {Property | number} [trailTime] 指定对象后方显示秒数的属性。
 * @property {Property | number} [width=1.0] 指定像素宽度的数值属性。
 * @property {Property | number} [resolution=60] 指定采样位置时最大步长秒数的数值属性。允许使用正分数值；在 PORTIONS 材质模式下，非正数值将回退到默认分辨率 60 秒。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 指定绘制路径所用材质的属性。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 指定路径在距相机多远的位置显示的属性。
 * @property {Property | string} [relativeTo] 指定可视化路径的帧数。可以使用其他实体的 ID 来相对于该实体可视化路径，或者使用字符串值 "FIXED" 或 "INERTIAL" 在这些参考帧中可视化路径。
 * @property {Property | PathMode} [materialMode] 指定沿路径如何应用材质属性的属性。
 */

/**
 * 描述由 {@link Entity} 随时间移动所形成的路径的折线。
 *
 * @alias PathGraphics
 * @constructor
 *
 * @param {PathGraphics.ConstructorOptions} [options] 描述初始化选项的对象。
 */
function PathGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._leadTime = undefined;
  this._leadTimeSubscription = undefined;
  this._trailTime = undefined;
  this._trailTimeSubscription = undefined;
  this._width = undefined;
  this._widthSubscription = undefined;
  this._resolution = undefined;
  this._resolutionSubscription = undefined;
  this._material = undefined;
  this._materialSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;
  this._relativeTo = undefined;
  this._relativeToSubscription = undefined;
  this._materialMode = undefined;
  this._materialModeSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(PathGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof PathGraphics.prototype
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },

  /**
   * 获取或设置指定路径可见性的布尔属性。
   * @memberof PathGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定对象前方显示秒数的属性。
   * @memberof PathGraphics.prototype
   * @type {Property|undefined}
   */
  leadTime: createPropertyDescriptor("leadTime"),

  /**
   * 获取或设置指定对象后方显示秒数的属性。
   * @memberof PathGraphics.prototype
   * @type {Property|undefined}
   */
  trailTime: createPropertyDescriptor("trailTime"),

  /**
   * 获取或设置指定像素宽度的数值属性。
   * @memberof PathGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  width: createPropertyDescriptor("width"),

  /**
   * 获取或设置指定采样位置时最大步长秒数的属性。
   * 允许使用正分数值；在 PORTIONS 材质模式下，非正数值将回退到默认分辨率 60 秒。
   * @memberof PathGraphics.prototype
   * @type {Property|undefined}
   * @default 60
   */
  resolution: createPropertyDescriptor("resolution"),

  /**
   * 获取或设置绘制路径所用材质的属性。
   * @memberof PathGraphics.prototype
   * @type {MaterialProperty}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定路径在距相机多远的位置的 {@link DistanceDisplayCondition} 属性。
   * @memberof PathGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),

  /**
   * 获取或设置可视化路径的帧数。可以使用其他实体的 ID 来相对于该实体可视化路径，或者使用字符串值 "FIXED" 或 "INERTIAL" 在这些参考帧中可视化路径。
   * @memberof PathGraphics.prototype
   * @type {Property|undefined}
   */
  relativeTo: createPropertyDescriptor("relativeTo"),
  materialMode: createPropertyDescriptor("materialMode"),
});

/**
 * 复制此实例。
 *
 * @param {PathGraphics} [result] 用于存储结果的对象。
 * @returns {PathGraphics} The 修改后的结果参数，或如果未提供则创建新实例。
 */
PathGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new PathGraphics(this);
  }
  result.show = this.show;
  result.leadTime = this.leadTime;
  result.trailTime = this.trailTime;
  result.width = this.width;
  result.resolution = this.resolution;
  result.material = this.material;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  result.relativeTo = this.relativeTo;
  result.materialMode = this.materialMode;
  return result;
};

/**
 * 将此对象中未赋值的每个属性赋值给
 * 提供源对象中相同属性的值。
 *
 * @param {PathGraphics} source 将被合并到此对象中的对象。
 */
PathGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.leadTime = this.leadTime ?? source.leadTime;
  this.trailTime = this.trailTime ?? source.trailTime;
  this.width = this.width ?? source.width;
  this.resolution = this.resolution ?? source.resolution;
  this.material = this.material ?? source.material;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
  this.relativeTo = this.relativeTo ?? source.relativeTo;
  this.materialMode = this.materialMode ?? source.materialMode;
};
export default PathGraphics;
