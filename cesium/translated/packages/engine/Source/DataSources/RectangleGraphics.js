import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} RectangleGraphics.ConstructorOptions
 *
 * RectangleGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 指定矩形可见性的布尔属性。
 * @property {Property | Rectangle} [coordinates] 指定 {@link Rectangle} 的属性。
 * @property {Property | number} [height=0] 指定矩形相对于椭球面的高度的数值属性。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 指定高度所针对的基准的属性。
 * @property {Property | number} [extrudedHeight] 指定矩形拉伸面相对于椭球面的高度的数值属性。
 * @property {Property | HeightReference} [extrudedHeightReference=HeightReference.NONE] 指定拉伸高度所针对的基准的属性。
 * @property {Property | number} [rotation=0.0] 指定矩形从北方向顺时针旋转角度的数值属性。
 * @property {Property | number} [stRotation=0.0] 指定矩形纹理从北方向逆时针旋转角度的数值属性。
 * @property {Property | number} [granularity=Cesium.Math.RADIANS_PER_DEGREE] 指定矩形上各点之间的角距的数值属性。
 * @property {Property | boolean} [fill=true] 指定矩形是否用提供的材质填充的布尔属性。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 指定用于填充矩形的材质的属性。
 * @property {Property | boolean} [outline=false] 指定矩形是否带有轮廓的布尔属性。
 * @property {Property | Color} [outlineColor=Color.BLACK] 指定轮廓的 {@link Color} 属性。
 * @property {Property | number} [outlineWidth=1.0] 指定轮廓宽度的数值属性。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 指定矩形是否投射或接收光源阴影的枚举属性。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 指定该矩形在距相机多远的距离下显示的属性。
 * @property {Property | ClassificationType} [classificationType=ClassificationType.BOTH] 指定该矩形在地面上时是否对地形、3D Tiles 或两者进行分类的枚举属性。
 * @property {Property | number} [zIndex=0] 指定用于排序地面几何图形的 zIndex 属性。仅当矩形为常量且未指定高度或拉伸高度时生效。
 */

/**
 * 描述 {@link Rectangle} 的图形特性。
 * 该矩形符合地球曲率，可以放置在表面或
 * 在高度上，并可选地被拉伸成体积形状。
 *
 * @alias RectangleGraphics
 * @constructor
 *
 * @param {RectangleGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @see Entity
 * @demo {@link https://sandcastle.cesium.com/index.html?id=rectangle|Cesium Sandcastle Rectangle Demo}
 */
function RectangleGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._coordinates = undefined;
  this._coordinatesSubscription = undefined;
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
  this._shadows = undefined;
  this._shadowsSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distancedisplayConditionSubscription = undefined;
  this._classificationType = undefined;
  this._classificationTypeSubscription = undefined;
  this._zIndex = undefined;
  this._zIndexSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(RectangleGraphics.prototype, {
  /**
   * Gets the event that is raised whenever a property or sub-property is changed or modified.
   * @memberof RectangleGraphics.prototype
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
   * Gets or sets the boolean Property specifying the visibility of the rectangle.
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * Gets or sets the Property specifying the {@link Rectangle}.
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   */
  coordinates: createPropertyDescriptor("coordinates"),

  /**
   * Gets or sets the numeric Property specifying the altitude of the rectangle.
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default 0.0
   */
  height: createPropertyDescriptor("height"),

  /**
   * Gets or sets the Property specifying the {@link HeightReference}.
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * Gets or sets the numeric Property specifying the altitude of the rectangle extrusion.
   * 设置此属性会创建从高度开始到该高度结束的立体区域。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   */
  extrudedHeight: createPropertyDescriptor("extrudedHeight"),

  /**
   * 获取或设置指定拉伸高度的 {@link HeightReference} 属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  extrudedHeightReference: createPropertyDescriptor("extrudedHeightReference"),

  /**
   * 获取或设置指定矩形顺时针从北方向旋转程度的数值属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default 0
   */
  rotation: createPropertyDescriptor("rotation"),

  /**
   * 获取或设置指定矩形纹理逆时针从北方向旋转程度的数值属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default 0
   */
  stRotation: createPropertyDescriptor("stRotation"),

  /**
   * 获取或设置指定矩形上各点之间的角度距离的数值属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default {CesiumMath.RADIANS_PER_DEGREE}
   */
  granularity: createPropertyDescriptor("granularity"),

  /**
   * 获取或设置指定矩形是否填充为提供的材质的布尔属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  fill: createPropertyDescriptor("fill"),

  /**
   * 获取或设置用于填充矩形的材质属性。
   * @memberof RectangleGraphics.prototype
   * @type {MaterialProperty}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置指定矩形是否带有轮廓的属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  outline: createPropertyDescriptor("outline"),

  /**
   * 获取或设置轮廓的 {@link Color} 属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default Color.BLACK
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置指定轮廓宽度的数值属性。
   * <p>
   * 注意：此属性在 Windows 平台的所有主流浏览器中将被忽略。详情请参见 (@link https://github.com/CesiumGS/cesium/issues/40)。
   * </p>
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置指定矩形
   * 是否从光源投射或接收阴影的枚举属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 获取或设置指定矩形在距相机多远的距离下显示 {@link DistanceDisplayCondition} 属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),

  /**
   * 获取或设置指定矩形在地面上时是否对地形、3D Tiles进行分类的 {@link ClassificationType} 属性。
   * @memberof RectangleGraphics.prototype
   * @type {Property|undefined}
   * @default ClassificationType.BOTH
   */
  classificationType: createPropertyDescriptor("classificationType"),

  /**
   * 获取或设置指定矩形排序顺序的 zIndex 属性。仅当矩形为常量且未指定高度或拉伸高度时才有效果。
   * @memberof RectangleGraphics.prototype
   * @type {ConstantProperty|undefined}
   * @default 0
   */
  zIndex: createPropertyDescriptor("zIndex"),
});

/**
 * 复制此实例。
 *
 * @param {RectangleGraphics} [result] 用于存储结果的对象。
 * @returns {RectangleGraphics} The 修改结果参数或提供新实例。
 */
RectangleGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new RectangleGraphics(this);
  }
  result.show = this.show;
  result.coordinates = this.coordinates;
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
  result.shadows = this.shadows;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  result.classificationType = this.classificationType;
  result.zIndex = this.zIndex;
  return result;
};

/**
 * 将此对象上所有未分配的属性赋值给
 * 提供源对象上相同属性的值。
 *
 * @param {RectangleGraphics} source 要合并到此对象的对象。
 */
RectangleGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.coordinates = this.coordinates ?? source.coordinates;
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
  this.shadows = this.shadows ?? source.shadows;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
  this.classificationType =
    this.classificationType ?? source.classificationType;
  this.zIndex = this.zIndex ?? source.zIndex;
};
export default RectangleGraphics;
