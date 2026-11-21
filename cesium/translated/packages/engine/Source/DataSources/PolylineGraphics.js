import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createMaterialPropertyDescriptor from "./createMaterialPropertyDescriptor.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} PolylineGraphics.ConstructorOptions
 *
 * PolylineGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定多折线可见性。
 * @property {Property | Cartesian3[]} [positions] 一个属性，指定定义线带阵列的 {@link Cartesian3} 位置。
 * @property {Property | number} [width=1.0] 一个数值属性，指定像素宽度。
 * @property {Property | number} [granularity=Cesium.Math.RADIANS_PER_DEGREE] 一个数值属性，在 arcType 不为 ArcType.NONE 时，指定每个经纬度之间的角度距离。
 * @property {MaterialProperty | Color} [material=Color.WHITE] 一个属性，指定绘制多折线所使用的材质。
 * @property {MaterialProperty | Color} [depthFailMaterial] 一个属性，指定多折线位于地形下方时使用的材质。
 * @property {Property | ArcType} [arcType=ArcType.GEODESIC] 多折线段必须遵循的线条类型。
 * @property {Property | boolean} [clampToGround=false] 一个布尔属性，指定多折线是否应被限制在地面上。
 * @property {Property | ShadowMode} [shadows=ShadowMode.DISABLED] 一个枚举属性，指定多折线是投射阴影还是接收来自光源的阴影。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定多折线在距相机多远的距离下显示。
 * @property {Property | ClassificationType} [classificationType=ClassificationType.BOTH] 一个枚举属性，指定多折线在地面上时是分类地形、3D Tiles 还是两者都分类。
 * @property {Property | number} [zIndex=0] 一个属性，指定用于排序地面几何体的 zIndex。仅当 `clampToGround` 为 true 且支持地形上的多折线时才有效果。
 */

/**
 * 描述一条多折线。前两个位置定义一条线段，
 * 每个额外的位置定义从前一个位置到该位置的线段。这些线段可以是线性连接的点、大弧线或受地形限制。
 * 可以是线性连接的点、大弧线或受地形限制。
 *
 * @alias PolylineGraphics
 * @constructor
 *
 * @param {PolylineGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @see Entity
 * @demo {@link https://sandcastle.cesium.com/index.html?id=polyline|Cesium Sandcastle Polyline Demo}
 */
function PolylineGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._positions = undefined;
  this._positionsSubscription = undefined;
  this._width = undefined;
  this._widthSubscription = undefined;
  this._granularity = undefined;
  this._granularitySubscription = undefined;
  this._material = undefined;
  this._materialSubscription = undefined;
  this._depthFailMaterial = undefined;
  this._depthFailMaterialSubscription = undefined;
  this._arcType = undefined;
  this._arcTypeSubscription = undefined;
  this._clampToGround = undefined;
  this._clampToGroundSubscription = undefined;
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

Object.defineProperties(PolylineGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof PolylineGraphics.prototype
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
   * 获取或设置指定多折线可见性的布尔属性。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定定义线带阵列的 {@link Cartesian3} 位置的属性。
   * 每个位置。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   */
  positions: createPropertyDescriptor("positions"),

  /**
   * 获取或设置指定像素宽度的数值属性。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  width: createPropertyDescriptor("width"),

  /**
   * 获取或设置数值属性，在 arcType 不为 ArcType.NONE 且 clampToGround 为 false 时，指定每个经纬度之间的角度距离。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   * @default Cesium.Math.RADIANS_PER_DEGREE
   */
  granularity: createPropertyDescriptor("granularity"),

  /**
   * 获取或设置指定绘制多折线所使用的材质的属性。
   * @memberof PolylineGraphics.prototype
   * @type {MaterialProperty}
   * @default Color.WHITE
   */
  material: createMaterialPropertyDescriptor("material"),

  /**
   * 获取或设置当多折线未能通过深度测试时使用的材质属性。
   * <p>
   * 需要 EXT_frag_depth WebGL 扩展才能正确渲染。如果不支持该扩展，
   * 可能会出现伪影。
   * </p>
   * @memberof PolylineGraphics.prototype
   * @type {MaterialProperty}
   * @default undefined
   */
  depthFailMaterial: createMaterialPropertyDescriptor("depthFailMaterial"),

  /**
   * 获取或设置指定线段应为大弧线、斜线还是线性连接的 {@link ArcType} 属性。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   * @default ArcType.GEODESIC
   */
  arcType: createPropertyDescriptor("arcType"),

  /**
   * 获取或设置布尔属性，指定折线是否应被限制在地面范围内。
   * 获取或设置枚举属性，指定折线是否应被限制在地面范围内。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  clampToGround: createPropertyDescriptor("clampToGround"),

  /**
   * 获取或设置枚举属性，指定折线是否会投射或接收来自光源的阴影。
   * 获取或设置 {@link DistanceDisplayCondition} 属性，指定该折线在距相机多远的距离下显示。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.DISABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * 获取或设置 {@link ClassificationType} 属性，指定该折线在地面上时是否对地形、3D Tiles进行分类。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),

  /**
   * 获取或设置 {@link ClassificationType} 属性，指定该折线在地面上时是否对地形、3D Tiles或两者进行分类。
   * @memberof PolylineGraphics.prototype
   * @type {Property|undefined}
   * @default ClassificationType.BOTH
   */
  classificationType: createPropertyDescriptor("classificationType"),

  /**
   * 获取或设置 zIndex 属性，指定折线的排序顺序。仅当 `clampToGround` 为 true 且支持地形上的折线时生效。
   * @memberof PolylineGraphics.prototype
   * @type {ConstantProperty|undefined}
   * @default 0
   */
  zIndex: createPropertyDescriptor("zIndex"),
});

/**
 * 复制此实例。
 *
 * @param {PolylineGraphics} [result] 用于存储结果的对象。
 * @returns {PolylineGraphics} The 修改结果参数或创建新实例（若未提供）。
 */
PolylineGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new PolylineGraphics(this);
  }
  result.show = this.show;
  result.positions = this.positions;
  result.width = this.width;
  result.granularity = this.granularity;
  result.material = this.material;
  result.depthFailMaterial = this.depthFailMaterial;
  result.arcType = this.arcType;
  result.clampToGround = this.clampToGround;
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
 * @param {PolylineGraphics} source 要合并到此对象中的对象。
 */
PolylineGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.positions = this.positions ?? source.positions;
  this.width = this.width ?? source.width;
  this.granularity = this.granularity ?? source.granularity;
  this.material = this.material ?? source.material;
  this.depthFailMaterial = this.depthFailMaterial ?? source.depthFailMaterial;
  this.arcType = this.arcType ?? source.arcType;
  this.clampToGround = this.clampToGround ?? source.clampToGround;
  this.shadows = this.shadows ?? source.shadows;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
  this.classificationType =
    this.classificationType ?? source.classificationType;
  this.zIndex = this.zIndex ?? source.zIndex;
};
export default PolylineGraphics;
