import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} PointGraphics.ConstructorOptions
 *
 * PointGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定点的可见性。
 * @property {Property | number} [pixelSize=1] 一个数值属性，指定像素大小。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 一个属性，指定高度相对于什么基准。
 * @property {Property | Color} [color=Color.WHITE] 一个属性，指定点的 {@link Color} 值。
 * @property {Property | Color} [outlineColor=Color.BLACK] 一个属性，指定轮廓的 {@link Color} 值。
 * @property {Property | number} [outlineWidth=0] 一个数值属性，指定轮廓的像素宽度。
 * @property {Property | NearFarScalar} [scaleByDistance] 一个 {@link NearFarScalar} 属性，用于根据距离对点进行缩放。
 * @property {Property | NearFarScalar} [translucencyByDistance] 一个 {@link NearFarScalar} 属性，用于根据与相机的距离设置半透明效果。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定该点在距相机多远的距离下显示。
 * @property {Property | number} [disableDepthTestDistance] 一个属性，指定在距相机多远的距离下禁用深度测试。
 * @property {Property | SplitDirection} [splitDirection] 一个属性，指定应用于该点的 {@link SplitDirection} 分割方式。
 */

/**
 * Describes a graphical point located at the position of the containing {@link Entity}.
 *
 * @alias PointGraphics
 * @constructor
 *
 * @param {PointGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 */
function PointGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._pixelSize = undefined;
  this._pixelSizeSubscription = undefined;
  this._heightReference = undefined;
  this._heightReferenceSubscription = undefined;
  this._color = undefined;
  this._colorSubscription = undefined;
  this._outlineColor = undefined;
  this._outlineColorSubscription = undefined;
  this._outlineWidth = undefined;
  this._outlineWidthSubscription = undefined;
  this._scaleByDistance = undefined;
  this._scaleByDistanceSubscription = undefined;
  this._translucencyByDistance = undefined;
  this._translucencyByDistanceSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;
  this._disableDepthTestDistance = undefined;
  this._disableDepthTestDistanceSubscription = undefined;
  this._splitDirection = undefined;
  this._splitDirectionSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(PointGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof PointGraphics.prototype
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
   * 获取或设置指定点可见性的布尔属性。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定像素大小的数值属性。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   * @default 1
   */
  pixelSize: createPropertyDescriptor("pixelSize"),

  /**
   * 获取或设置指定 {@link HeightReference} 属性的属性。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * 获取或设置指定点的 {@link Color} 值的属性。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  color: createPropertyDescriptor("color"),

  /**
   * 获取或设置指定轮廓的 {@link Color} 值的属性。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置指定轮廓像素宽度的数值属性。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   * @default 0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置用于根据距离对点进行缩放的 {@link NearFarScalar} 属性。
   * 如果未定义，则使用固定大小。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   */
  scaleByDistance: createPropertyDescriptor("scaleByDistance"),

  /**
   * 获取或设置指定基于与相机距离的点半透明效果的 {@link NearFarScalar} 属性。
   * A point's translucency will interpolate between the {@link NearFarScalar#nearValue} and
   * {@link NearFarScalar#farValue} while the camera distance falls within the lower and upper bounds
   * of the specified {@link NearFarScalar#near} and {@link NearFarScalar#far}.
   * 在这些范围之外，点的半透明效果被限制在最近的边界上。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   */
  translucencyByDistance: createPropertyDescriptor("translucencyByDistance"),

  /**
   * 获取或设置指定该点在距相机多远的距离下显示的 {@link DistanceDisplayCondition} 属性。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),

  /**
   * 获取或设置禁用深度测试的距相机距离，例如，用于防止与地形发生裁剪。
   * 当设置为零时，始终应用深度测试。当设置为 Number.POSITIVE_INFINITY 时，从不应用深度测试。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   */
  disableDepthTestDistance: createPropertyDescriptor(
    "disableDepthTestDistance",
  ),

  /**
   * 获取或设置指定此点 {@link SplitDirection} 的属性。
   * @memberof PointGraphics.prototype
   * @type {Property|undefined}
   * @default SplitDirection.NONE
   */
  splitDirection: createPropertyDescriptor("splitDirection"),
});

/**
 * 复制此实例。
 *
 * @param {PointGraphics} [result] 用于存储结果的对象。
 * @returns {PointGraphics} The 修改结果参数或创建一个新的实例（如果未提供）。
 */
PointGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new PointGraphics(this);
  }
  result.show = this.show;
  result.pixelSize = this.pixelSize;
  result.heightReference = this.heightReference;
  result.color = this.color;
  result.outlineColor = this.outlineColor;
  result.outlineWidth = this.outlineWidth;
  result.scaleByDistance = this.scaleByDistance;
  result.translucencyByDistance = this._translucencyByDistance;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  result.disableDepthTestDistance = this.disableDepthTestDistance;
  result.splitDirection = this.splitDirection;
  return result;
};

/**
 * 将此对象上所有未分配的属性赋值给
 * 提供的源对象上相同属性的值。
 *
 * @param {PointGraphics} source 要合并到此对象的对象。
 */
PointGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.pixelSize = this.pixelSize ?? source.pixelSize;
  this.heightReference = this.heightReference ?? source.heightReference;
  this.color = this.color ?? source.color;
  this.outlineColor = this.outlineColor ?? source.outlineColor;
  this.outlineWidth = this.outlineWidth ?? source.outlineWidth;
  this.scaleByDistance = this.scaleByDistance ?? source.scaleByDistance;
  this.translucencyByDistance =
    this._translucencyByDistance ?? source.translucencyByDistance;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
  this.disableDepthTestDistance =
    this.disableDepthTestDistance ?? source.disableDepthTestDistance;

  this.splitDirection = this.splitDirection ?? source.splitDirection;
};
export default PointGraphics;