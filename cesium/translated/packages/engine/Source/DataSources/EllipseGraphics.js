import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} EllipseGraphics.ConstructorOptions
 *
 * EllipseGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 指定椭圆可见性的布尔属性。
 * @property {Property | number} [semiMajorAxis] 指定半长轴的数值属性。
 * @property {Property | number} [semiMinorAxis] 指定半短轴的数值属性。
 * @property {Property | number} [height=0] 指定椭圆相对于椭球面的高度的数值属性。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 指定高度所相对于的参考对象属性。
 * @property {Property | number} [extrudedHeight] 指定椭圆拉伸面相对于椭球面的高度的数值属性。
 * @property {Property | HeightReference} [extrudedHeightReference=HeightReference.NONE] 指定拉伸高度所相对于的参考对象属性。
 * @property {Property | number} [rotation=0.0] 指定椭圆从北方向逆时针旋转角度的数值属性。
 * @property {Property | number} [stRotation=0.0] 指定椭圆纹理从北方向逆时针旋转角度的数值属性。
 * @property {Property | number} [granularity=Cesium.Math.RADIANS_PER_DEGREE] 指定椭圆上两点之间的角距数值属性。
 * @property {Property | boolean} [fill=true] 指定椭圆是否用提供的材质填充的布尔属性。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 指定用于填充椭圆的材质的属性。
 * @property {Property | boolean} [outline=false] 指定椭圆是否加粗的布尔属性。
 * @property {Property | Color} [outlineColor=Color.BLACK] 指定轮廓的 {@link Color} 属性。
 * @property {Property | number} [outlineWidth=1.0] 指定轮廓宽度的数值属性。
 * @property {Property | number} [numberOfVerticalLines=16] 指定用于沿轮廓边缘绘制垂直线的数量数值属性。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 指定椭圆是否投射或接收光源阴影的枚举属性。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 指定该椭圆在距相机多远的距离下显示的属性。
 * @property {Property | ClassificationType} [classificationType=ClassificationType.BOTH] 指定该椭圆在地面上时是否对地形、3D Tiles 或两者进行分类的枚举属性。
 * @property {ConstantProperty | number} [zIndex=0] 指定 Ellipse 的 zIndex 属性，用于排序地面几何图形。仅当椭圆为常量且未指定高度或拉伸高度时才有效果。
 */

/**
 * 描述由中心点及半长轴和半短轴定义的椭圆。
 * 该椭圆符合地球曲率，可以放置在表面或
 * 在高度上，并可选地被拉伸成体积。
 * 中心点由包含的 {@link Entity} 决定。
 *
 * @alias EllipseGraphics
 * @constructor
 *
 * @param {EllipseGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=circles-and-ellipses|Cesium Sandcastle Circles and Ellipses Demo}
 */
function EllipseGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._semiMajorAxis = undefined;
  this._semiMajorAxisSubscription = undefined;
  this._semiMinorAxis = undefined;
  this._semiMinorAxisSubscription = undefined;
  this._height = undefined;
  this._heightSubscription = undefined;
  this._heightReference = undefined;
  this._heightReferenceSubscription = undefined;
  this._extrudedHeight = undefined;
  this._extrudedHeightSubscription = undefined;
  this._extrudedHeightReference = undefined;
  this._extrudedHeightReferenceSubscription = undefined;
  this._rotation = undefined;
  this._rotationSubscription = undefined;
  this._stRotation = undefined;
  this._stRotationSubscription = undefined;
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
  this._numberOfVerticalLines = undefined;
  this._numberOfVerticalLinesSubscription = undefined;
  this._shadows = undefined;
  this._shadowsSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;
  this._classificationType = undefined;
  this._classificationTypeSubscription = undefined;
  this._zIndex = undefined;
  this._zIndexSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(EllipseGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof EllipseGraphics.prototype
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
   * 获取或设置指定椭圆可见性的布尔属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定半长轴的数值属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   */
  semiMajorAxis: createPropertyDescriptor("semiMajorAxis"),

  /**
   * 获取或设置指定半短轴的数值属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   */
  semiMinorAxis: createPropertyDescriptor("semiMinorAxis"),

  /**
   * 获取或设置指定椭圆的高度数值属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default 0.0
   */
  height: createPropertyDescriptor("height"),

  /**
   * 获取或设置指定 {@link HeightReference} 的属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * 获取或设置指定椭圆延伸高度的数值属性。
   * 设置此属性会创建从该高度开始到该高度结束的体块。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   */
  extrudedHeight: createPropertyDescriptor("extrudedHeight"),

  /**
   * 获取或设置指定延伸后的 {@link HeightReference} 属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  extrudedHeightReference: createPropertyDescriptor("extrudedHeightReference"),

  /**
   * 获取或设置指定椭圆逆时针旋转角度的数值属性，从北方向开始计算。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default 0
   */
  rotation: createPropertyDescriptor("rotation"),

  /**
   * 获取或设置指定椭圆纹理逆时针旋转角度的数值属性，从北方向开始计算。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default 0
   */
  stRotation: createPropertyDescriptor("stRotation"),

  /**
   * 获取或设置指定椭圆上点之间的角度距离的数值属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default {CesiumMath.RADIANS_PER_DEGREE}
   */
  granularity: createPropertyDescriptor("granularity"),

  /**
   * 获取或设置指定椭圆是否用提供的材质填充的布尔属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  fill: createPropertyDescriptor("fill"),

  /**
   * 获取或设置指定用于填充椭圆的材质的属性。
   * @memberof EllipseGraphics.prototype
   * @type {MaterialProperty|undefined}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定椭圆是否带有轮廓的属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  outline: createPropertyDescriptor("outline"),

  /**
   * 获取或设置指定轮廓 {@link Color} 的值。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置指定轮廓宽度的数值属性。
   * <p>
   * 注意：在 Windows 平台的所有主流浏览器中，此属性将被忽略。详情请参见 (@link https://github.com/CesiumGS/cesium/issues/40)。
   * </p>
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置指定用于绘制轮廓周边垂直线条数量的数值属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default 16
   */
  numberOfVerticalLines: createPropertyDescriptor("numberOfVerticalLines"),

  /**
   * 获取或设置指定椭圆是否
   * 从光源接收或投射阴影的枚举属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 获取或设置指定椭圆在距相机多远的距离下显示的 {@link DistanceDisplayCondition} 属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),

  /**
   * 获取或设置指定椭圆在地面上时是否对地形、3D Tiles进行分类的 {@link ClassificationType} 属性。
   * @memberof EllipseGraphics.prototype
   * @type {Property|undefined}
   * @default ClassificationType.BOTH
   */
  classificationType: createPropertyDescriptor("classificationType"),

  /**
   * 获取或设置指定椭圆排序的 zIndex 属性。仅当椭圆为常量且未指定高度或延伸高度时生效。
   * @memberof EllipseGraphics.prototype
   * @type {ConstantProperty|undefined}
   * @default 0
   */
  zIndex: createPropertyDescriptor("zIndex"),
});

/**
 * 复制此实例。
 *
 * @param {EllipseGraphics} [result] 用于存储结果的对象。
 * @returns {EllipseGraphics} The 修改结果参数或如果未提供则创建新实例。
 */
EllipseGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new EllipseGraphics(this);
  }
  result.show = this.show;
  result.semiMajorAxis = this.semiMajorAxis;
  result.semiMinorAxis = this.semiMinorAxis;
  result.height = this.height;
  result.heightReference = this.heightReference;
  result.extrudedHeight = this.extrudedHeight;
  result.extrudedHeightReference = this.extrudedHeightReference;
  result.rotation = this.rotation;
  result.stRotation = this.stRotation;
  result.granularity = this.granularity;
  result.fill = this.fill;
  result.material = this.material;
  result.outline = this.outline;
  result.outlineColor = this.outlineColor;
  result.outlineWidth = this.outlineWidth;
  result.numberOfVerticalLines = this.numberOfVerticalLines;
  result.shadows = this.shadows;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  result.classificationType = this.classificationType;
  result.zIndex = this.zIndex;
  return result;
};

/**
 * 将此对象上所有未分配的属性值设置为
 * 提供源对象上相同属性的值。
 *
 * @param {EllipseGraphics} source 要合并到该对象的实体。
 */
EllipseGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.semiMajorAxis = this.semiMajorAxis ?? source.semiMajorAxis;
  this.semiMinorAxis = this.semiMinorAxis ?? source.semiMinorAxis;
  this.height = this.height ?? source.height;
  this.heightReference = this.heightReference ?? source.heightReference;
  this.extrudedHeight = this.extrudedHeight ?? source.extrudedHeight;
  this.extrudedHeightReference =
    this.extrudedHeightReference ?? source.extrudedHeightReference;
  this.rotation = this.rotation ?? source.rotation;
  this.stRotation = this.stRotation ?? source.stRotation;
  this.granularity = this.granularity ?? source.granularity;
  this.fill = this.fill ?? source.fill;
  this.material = this.material ?? source.material;
  this.outline = this.outline ?? source.outline;
  this.outlineColor = this.outlineColor ?? source.outlineColor;
  this.outlineWidth = this.outlineWidth ?? source.outlineWidth;
  this.numberOfVerticalLines =
    this.numberOfVerticalLines ?? source.numberOfVerticalLines;
  this.shadows = this.shadows ?? source.shadows;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
  this.classificationType =
    this.classificationType ?? source.classificationType;
  this.zIndex = this.zIndex ?? source.zIndex;
};
export default EllipseGraphics;
