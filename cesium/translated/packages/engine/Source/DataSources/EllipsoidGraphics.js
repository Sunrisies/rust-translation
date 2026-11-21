import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} EllipsoidGraphics.ConstructorOptions
 *
 * EllipsoidGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定椭球的可见性。
 * @property {Property | Cartesian3} [radii] 一个 {@link Cartesian3} 属性，指定椭球的半径。
 * @property {Property | Cartesian3} [innerRadii] 一个 {@link Cartesian3} 属性，指定椭球的内半径。
 * @property {Property | number} [minimumClock=0.0] 一个属性，指定椭球的最小时钟角度。
 * @property {Property | number} [maximumClock=2*PI] 一个属性，指定椭球的最大时钟角度。
 * @property {Property | number} [minimumCone=0.0] 一个属性，指定椭球的最小圆锥角度。
 * @property {Property | number} [maximumCone=PI] 一个属性，指定椭球的最大圆锥角度。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 一个属性，指定实体位置相对于该属性的高度值。
 * @property {Property | boolean} [fill=true] 一个布尔属性，指定椭球是否填充提供的材质。
 * @property {MaterialProperty | Color | HTMLVideoElement} [material=Color.WHITE] 一个属性，指定用于填充椭球的材质。
 * @property {Property | boolean} [outline=false] 一个布尔属性，指定椭球是否带有轮廓。
 * @property {Property | Color} [outlineColor=Color.BLACK] 一个属性，指定轮廓的 {@link Color}。
 * @property {Property | number} [outlineWidth=1.0] 一个数值属性，指定轮廓的宽度。
 * @property {Property | number} [stackPartitions=64] 一个属性，指定堆叠数。
 * @property {Property | number} [slicePartitions=64] 一个属性，指定径向切片数。
 * @property {Property | number} [subdivisions=128] 一个属性，指定每个轮廓环的样本数，从而确定曲率的精度。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 一个枚举属性，指定椭球是投射还是接收光源的阴影。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定椭球在距离相机多远的位置显示。
 */

/**
 * 描述一个椭球或球体。中心位置和方向由包含的 {@link Entity} 决定。
 *
 * @alias EllipsoidGraphics
 * @constructor
 *
 * @param {EllipsoidGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=spheres-and-ellipsoids|Cesium Sandcastle Spheres and Ellipsoids Demo}
 */
function EllipsoidGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._radii = undefined;
  this._radiiSubscription = undefined;
  this._innerRadii = undefined;
  this._innerRadiiSubscription = undefined;
  this._minimumClock = undefined;
  this._minimumClockSubscription = undefined;
  this._maximumClock = undefined;
  this._maximumClockSubscription = undefined;
  this._minimumCone = undefined;
  this._minimumConeSubscription = undefined;
  this._maximumCone = undefined;
  this._maximumConeSubscription = undefined;
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
  this._stackPartitions = undefined;
  this._stackPartitionsSubscription = undefined;
  this._slicePartitions = undefined;
  this._slicePartitionsSubscription = undefined;
  this._subdivisions = undefined;
  this._subdivisionsSubscription = undefined;
  this._shadows = undefined;
  this._shadowsSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(EllipsoidGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof EllipsoidGraphics.prototype
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
   * 获取或设置指定椭球可见性的布尔属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定椭球半径的 {@link Cartesian3} {@link Property}。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   */
  radii: createPropertyDescriptor("radii"),

  /**
   * 获取或设置指定椭球内半径的 {@link Cartesian3} {@link Property}。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default radii
   */
  innerRadii: createPropertyDescriptor("innerRadii"),

  /**
   * 获取或设置指定椭球最小时钟角度的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default 0.0
   */
  minimumClock: createPropertyDescriptor("minimumClock"),

  /**
   * 获取或设置指定椭球最大时钟角度的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default 2*PI
   */
  maximumClock: createPropertyDescriptor("maximumClock"),

  /**
   * 获取或设置指定椭球最小圆锥角度的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default 0.0
   */
  minimumCone: createPropertyDescriptor("minimumCone"),

  /**
   * 获取或设置指定椭球最大圆锥角度的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default PI
   */
  maximumCone: createPropertyDescriptor("maximumCone"),

  /**
   * 获取或设置指定 {@link HeightReference} 的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * 获取或设置指定椭球是否填充提供的材质的布尔属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  fill: createPropertyDescriptor("fill"),

  /**
   * 获取或设置指定用于填充椭球的材料的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {MaterialProperty}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定椭球是否带有轮廓的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  outline: createPropertyDescriptor("outline"),

  /**
   * 获取或设置指定轮廓颜色的 {@link Color} 属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置指定轮廓宽度的数值属性。
   * <p>
   * 注意：在 Windows 平台的所有主流浏览器上，此属性将被忽略。详情请参见 (@link https://github.com/CesiumGS/cesium/issues/40)。
   * </p>
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置指定堆栈数量属性的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default 64
   */
  stackPartitions: createPropertyDescriptor("stackPartitions"),

  /**
   * 获取或设置每 360 度内的径向切片数量的属性。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default 64
   */
  slicePartitions: createPropertyDescriptor("slicePartitions"),

  /**
   * 获取或设置轮廓环中样本数量属性，用于确定曲率的精度。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default 128
   */
  subdivisions: createPropertyDescriptor("subdivisions"),

  /**
   * 获取或设置枚举属性，指定椭球是否
   * 投射或接收光源的阴影。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 获取或设置 {@link DistanceDisplayCondition} 属性，指定椭球在距相机多远的距离下显示。
   * @memberof EllipsoidGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),
});

/**
 * 复制此实例。
 *
 * @param {EllipsoidGraphics} [result] 用于存储结果的对象。
 * @returns {EllipsoidGraphics} The 修改结果参数或如果未提供则创建新实例。
 */
EllipsoidGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new EllipsoidGraphics(this);
  }
  result.show = this.show;
  result.radii = this.radii;
  result.innerRadii = this.innerRadii;
  result.minimumClock = this.minimumClock;
  result.maximumClock = this.maximumClock;
  result.minimumCone = this.minimumCone;
  result.maximumCone = this.maximumCone;
  result.heightReference = this.heightReference;
  result.fill = this.fill;
  result.material = this.material;
  result.outline = this.outline;
  result.outlineColor = this.outlineColor;
  result.outlineWidth = this.outlineWidth;
  result.stackPartitions = this.stackPartitions;
  result.slicePartitions = this.slicePartitions;
  result.subdivisions = this.subdivisions;
  result.shadows = this.shadows;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  return result;
};

/**
 * 将此对象上所有未分配的属性赋值给
 * 提供的源对象上相同属性的值。
 *
 * @param {EllipsoidGraphics} source 要合并到此对象的对象。
 */
EllipsoidGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.radii = this.radii ?? source.radii;
  this.innerRadii = this.innerRadii ?? source.innerRadii;
  this.minimumClock = this.minimumClock ?? source.minimumClock;
  this.maximumClock = this.maximumClock ?? source.maximumClock;
  this.minimumCone = this.minimumCone ?? source.minimumCone;
  this.maximumCone = this.maximumCone ?? source.maximumCone;
  this.heightReference = this.heightReference ?? source.heightReference;
  this.fill = this.fill ?? source.fill;
  this.material = this.material ?? source.material;
  this.outline = this.outline ?? source.outline;
  this.outlineColor = this.outlineColor ?? source.outlineColor;
  this.outlineWidth = this.outlineWidth ?? source.outlineWidth;
  this.stackPartitions = this.stackPartitions ?? source.stackPartitions;
  this.slicePartitions = this.slicePartitions ?? source.slicePartitions;
  this.subdivisions = this.subdivisions ?? source.subdivisions;
  this.shadows = this.shadows ?? source.shadows;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
};
export default EllipsoidGraphics;
