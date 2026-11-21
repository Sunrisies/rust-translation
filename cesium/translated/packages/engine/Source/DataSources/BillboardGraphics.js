import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} BillboardGraphics.ConstructorOptions
 *
 * BillboardGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 指定广告牌可见性的布尔属性。
 * @property {Property | string | HTMLImageElement | HTMLCanvasElement} [image] 指定用于广告牌的图像、URI 或 Canvas 的属性。
 * @property {Property | number} [scale=1.0] 指定应用于图像尺寸的比例的数值属性。
 * @property {Property | Cartesian2} [pixelOffset=Cartesian2.ZERO] 指定像素偏移量的 {@link Cartesian2} 属性。
 * @property {Property | Cartesian3} [eyeOffset=Cartesian3.ZERO] 指定眼睛偏移量的 {@link Cartesian3} 属性。
 * @property {Property | HorizontalOrigin} [horizontalOrigin=HorizontalOrigin.CENTER] 指定 {@link HorizontalOrigin} 的属性。
 * @property {Property | VerticalOrigin} [verticalOrigin=VerticalOrigin.CENTER] 指定 {@link VerticalOrigin} 的属性。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 指定高度相对于什么的属性。
 * @property {Property | Color} [color=Color.WHITE] 指定图像色调 {@link Color} 的属性。
 * @property {Property | number} [rotation=0] 指定关于对齐轴的旋转角度的数值属性。
 * @property {Property | Cartesian3} [alignedAxis=Cartesian3.ZERO] 指定旋转单位向量轴的 {@link Cartesian3} 属性。
 * @property {Property | boolean} [sizeInMeters] 指定广告牌尺寸是否以米为单位显示的布尔属性。
 * @property {Property | number} [width] 指定广告牌在像素上的宽度，覆盖原生尺寸。
 * @property {Property | number} [height] 指定广告牌在像素上的高度，覆盖原生尺寸。
 * @property {Property | NearFarScalar} [scaleByDistance] 用于根据与相机的距离对点进行缩放的 {@link NearFarScalar} 属性。
 * @property {Property | NearFarScalar} [translucencyByDistance] 用于根据与相机的距离设置半透明度的 {@link NearFarScalar} 属性。
 * @property {Property | NearFarScalar} [pixelOffsetScaleByDistance] 用于根据与相机的距离设置像素偏移量的 {@link NearFarScalar} 属性。
 * @property {Property | BoundingRectangle} [imageSubRegion] 指定用于广告牌的影像子区域的 {@link BoundingRectangle} 属性，该区域以左下角的像素为单位。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 指定广告牌在距相机多远的位置显示的属性。
 * @property {Property | number} [disableDepthTestDistance] 指定禁用深度测试时的距相机距离的属性。
 * @property {Property | SplitDirection} [splitDirection] 指定广告牌的 {@link SplitDirection} 属性。
 */

/**
 * 描述位于包含 {@link Entity} 位置的二维图标。
 * <p>
 * <div align='center'>
 * <img src='Images/Billboard.png' width='400' height='300' /><br />
 * 示例广告牌
 * </div>
 * </p>
 *
 * @alias BillboardGraphics
 * @constructor
 *
 * @param {BillboardGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=billboards|Cesium Sandcastle Billboard Demo}
 */
function BillboardGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._image = undefined;
  this._imageSubscription = undefined;
  this._scale = undefined;
  this._scaleSubscription = undefined;
  this._pixelOffset = undefined;
  this._pixelOffsetSubscription = undefined;
  this._eyeOffset = undefined;
  this._eyeOffsetSubscription = undefined;
  this._horizontalOrigin = undefined;
  this._horizontalOriginSubscription = undefined;
  this._verticalOrigin = undefined;
  this._verticalOriginSubscription = undefined;
  this._heightReference = undefined;
  this._heightReferenceSubscription = undefined;
  this._color = undefined;
  this._colorSubscription = undefined;
  this._rotation = undefined;
  this._rotationSubscription = undefined;
  this._alignedAxis = undefined;
  this._alignedAxisSubscription = undefined;
  this._sizeInMeters = undefined;
  this._sizeInMetersSubscription = undefined;
  this._width = undefined;
  this._widthSubscription = undefined;
  this._height = undefined;
  this._heightSubscription = undefined;
  this._scaleByDistance = undefined;
  this._scaleByDistanceSubscription = undefined;
  this._translucencyByDistance = undefined;
  this._translucencyByDistanceSubscription = undefined;
  this._pixelOffsetScaleByDistance = undefined;
  this._pixelOffsetScaleByDistanceSubscription = undefined;
  this._imageSubRegion = undefined;
  this._imageSubRegionSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;
  this._disableDepthTestDistance = undefined;
  this._disableDepthTestDistanceSubscription = undefined;
  this._splitDirection = undefined;
  this._splitDirectionSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(BillboardGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof BillboardGraphics.prototype
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
   * 获取或设置指定广告牌可见性的布尔属性。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定用于广告牌的图像、URI 或 Canvas 的属性。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  image: createPropertyDescriptor("image"),

  /**
   * 获取或设置指定应用于影像的统一比例的数值属性。
   * 大于 <code>1.0</code> 的比例会放大公告牌，而小于 <code>1.0</code> 的比例则会缩小它。
   * <p>
   * <div align='center'>
   * <img src='Images/Billboard.setScale.png' width='400' height='300' /><br/>
   * 在上图从左到右，比例分别为 <code>0.5</code>、<code>1.0</code> 和 <code>2.0</code>。
   * </div>
   * </p>
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  scale: createPropertyDescriptor("scale"),

  /**
   * 获取或设置指定公告牌在屏幕空间中的像素偏移量的 {@link Cartesian2} 属性
   * 从该公告牌的原点开始。这通常用于将多个公告牌和标签对齐到
   * 相同的位置，例如图像和文本。屏幕空间原点是画布的
   * 左上角；<code>x</code> 从左到右增加，<code>y</code> 从上到下增加。
   * <p>
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><code>default</code><br/><img src='Images/Billboard.setPixelOffset.default.png' width='250' height='188' /></td>
   * <td align='center'><code>b.pixeloffset = new Cartesian2(50, 25);</code><br/><img src='Images/Billboard.setPixelOffset.x50y-25.png' width='250' height='188' /></td>
   * </tr></table>
   * 公告牌的原点由黄色点表示。
   * </div>
   * </p>
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default Cartesian2.ZERO
   */
  pixelOffset: createPropertyDescriptor("pixelOffset"),

  /**
   * 获取或设置指定公告牌在眼睛坐标中的偏移量的 {@link Cartesian3} 属性。
   * 眼睛坐标是一种左手坐标系，其中 <code>x</code> 指向观察者的
   * 右侧，<code>y</code> 指向上方，<code>z</code> 指向屏幕内部。
   * <p>
   * 眼睛偏移通常用于将多个公告牌或对象排列在相同的位置，例如将公告牌置于其对应的 3D 模型之上。
   * 将公告牌置于其对应的 3D 模型之上。
   * </p>
   * 下面，公告牌位于地球的中心位置，但通过眼睛偏移使其始终
   * 出现在地球的上部，无论观察者或地球的方向如何。
   * <p>
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><img src='Images/Billboard.setEyeOffset.one.png' width='250' height='188' /></td>
   * <td align='center'><img src='Images/Billboard.setEyeOffset.two.png' width='250' height='188' /></td>
   * </tr></table>
   * <code>b.eyeOffset = new Cartesian3(0.0, 8000000.0, 0.0);</code>
   * </div>
   * </p>
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default Cartesian3.ZERO
   */
  eyeOffset: createPropertyDescriptor("eyeOffset"),

  /**
   * 获取或设置指定 {@link HorizontalOrigin} 的属性。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default HorizontalOrigin.CENTER
   */
  horizontalOrigin: createPropertyDescriptor("horizontalOrigin"),

  /**
   * 获取或设置指定 {@link VerticalOrigin} 的属性。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default VerticalOrigin.CENTER
   */
  verticalOrigin: createPropertyDescriptor("verticalOrigin"),

  /**
   * 获取或设置指定 {@link HeightReference} 的属性。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * 获取或设置与 <code>image</code> 相乘的 {@link Color} 属性。
   * 此属性有两个常见用途。首先，相同的白色纹理可以被多个不同的广告牌使用，
   * 每个广告牌都有不同的颜色，从而创建出彩色广告牌。其次，颜色的 alpha 分量可以
   * 用于使广告牌半透明，如下所示。alpha 值为 <code>0.0</code> 时广告牌为
   * 半透明，而 <code>1.0</code> 时广告牌为不透明。
   * <p>
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><code>default</code><br/><img src='Images/Billboard.setColor.Alpha255.png' width='250' height='188' /></td>
   * <td align='center'><code>alpha : 0.5</code><br/><img src='Images/Billboard.setColor.Alpha127.png' width='250' height='188' /></td>
   * </tr></table>
   * </div>
   * </p>
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  color: createPropertyDescriptor("color"),

  /**
   * 获取或设置指定图像旋转的数值属性，从
   * <code>alignedAxis</code> 开始按逆时针方向旋转。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default 0
   */
  rotation: createPropertyDescriptor("rotation"),

  /**
   * 获取或设置指定旋转单位向量轴的 {@link Cartesian3} 属性
   * 在固定框架中。设置为 Cartesian3.ZERO 时，旋转从屏幕顶部开始。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default Cartesian3.ZERO
   */
  alignedAxis: createPropertyDescriptor("alignedAxis"),

  /**
   * 获取或设置布尔属性，指定此广告牌的大小是否以米为单位测量。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  sizeInMeters: createPropertyDescriptor("sizeInMeters"),

  /**
   * 获取或设置指定广告牌宽度的数值属性，单位为像素。
   * 未定义时，使用原生宽度。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  width: createPropertyDescriptor("width"),

  /**
   * 获取或设置指定广告牌高度的数值属性，单位为单位像素。
   * 未定义时，使用原生高度。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  height: createPropertyDescriptor("height"),

  /**
   * 获取或设置指定基于与相机距离的缩放比例的 {@link NearFarScalar} 属性。
   * A billboard's scale will interpolate between the {@link NearFarScalar#nearValue} and
   * {@link NearFarScalar#farValue} 和
   * of the specified {@link NearFarScalar#near} and {@link NearFarScalar#far}.
   * 超出这些范围时，广告牌的缩放比例被限制在最近的边界值。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  scaleByDistance: createPropertyDescriptor("scaleByDistance"),

  /**
   * 获取或设置指定基于与相机距离的广告牌半透明度的 {@link NearFarScalar} 属性。
   * A billboard's translucency will interpolate between the {@link NearFarScalar#nearValue} and
   * {@link NearFarScalar#farValue} while the camera distance falls within the lower and upper bounds
   * of the specified {@link NearFarScalar#near} and {@link NearFarScalar#far}.
   * 在这些范围之外，广告牌的半透明效果会被限制在最近的边界。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  translucencyByDistance: createPropertyDescriptor("translucencyByDistance"),

  /**
   * 获取或设置 {@link NearFarScalar} 属性，该属性指定了基于相机距离的广告牌像素偏移量。
   * 广告牌的像素偏移量将在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值。
   * of the specified {@link NearFarScalar#near} and {@link NearFarScalar#far}.
   * 在这些范围之外，广告牌的像素偏移量会被限制在最近的边界。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  pixelOffsetScaleByDistance: createPropertyDescriptor(
    "pixelOffsetScaleByDistance",
  ),

  /**
   * 获取或设置指定了 {@link BoundingRectangle} 的属性，该矩形定义了用于广告牌的 <code>image</code> 子区域，而不是整个图像。
   * 以从底部左端开始的像素为单位进行测量。
   * 获取或设置 {@link DistanceDisplayCondition} 属性，该属性指定了广告牌在距离相机多远的位置显示。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  imageSubRegion: createPropertyDescriptor("imageSubRegion"),

  /**
   * 获取或设置 {@link DistanceDisplayCondition} 属性，该属性指定了在距离相机多远的范围内禁用深度测试，例如防止与地形发生裁剪。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),

  /**
   * 当设置为零时，深度测试始终被应用；当设置为 Number.POSITIVE_INFINITY 时，深度测试永远不会被应用。
   * 获取或设置指定了此广告牌的 {@link SplitDirection} 属性的属性。
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   */
  disableDepthTestDistance: createPropertyDescriptor(
    "disableDepthTestDistance",
  ),

  /**
   * Gets or sets the Property specifying the {@link SplitDirection} of this billboard.
   * @memberof BillboardGraphics.prototype
   * @type {Property|undefined}
   * @default SplitDirection.NONE
   */
  splitDirection: createPropertyDescriptor("splitDirection"),
});

/**
 * 存储结果的对象。
 *
 * @param {BillboardGraphics} [result] 用于存储结果的对象。
 * @returns {BillboardGraphics} The 修改结果参数或如果未提供则创建新实例。
 */
BillboardGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new BillboardGraphics(this);
  }
  result.show = this._show;
  result.image = this._image;
  result.scale = this._scale;
  result.pixelOffset = this._pixelOffset;
  result.eyeOffset = this._eyeOffset;
  result.horizontalOrigin = this._horizontalOrigin;
  result.verticalOrigin = this._verticalOrigin;
  result.heightReference = this._heightReference;
  result.color = this._color;
  result.rotation = this._rotation;
  result.alignedAxis = this._alignedAxis;
  result.sizeInMeters = this._sizeInMeters;
  result.width = this._width;
  result.height = this._height;
  result.scaleByDistance = this._scaleByDistance;
  result.translucencyByDistance = this._translucencyByDistance;
  result.pixelOffsetScaleByDistance = this._pixelOffsetScaleByDistance;
  result.imageSubRegion = this._imageSubRegion;
  result.distanceDisplayCondition = this._distanceDisplayCondition;
  result.disableDepthTestDistance = this._disableDepthTestDistance;
  result.splitDirection = this._splitDirection;
  return result;
};

/**
 * 将此对象上所有未分配的属性值分配给
 * 提供的源对象上相同属性的值。
 *
 * @param {BillboardGraphics} source 要合并到此对象中的对象。
 */
BillboardGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this._show ?? source.show;
  this.image = this._image ?? source.image;
  this.scale = this._scale ?? source.scale;
  this.pixelOffset = this._pixelOffset ?? source.pixelOffset;
  this.eyeOffset = this._eyeOffset ?? source.eyeOffset;
  this.horizontalOrigin = this._horizontalOrigin ?? source.horizontalOrigin;
  this.verticalOrigin = this._verticalOrigin ?? source.verticalOrigin;
  this.heightReference = this._heightReference ?? source.heightReference;
  this.color = this._color ?? source.color;
  this.rotation = this._rotation ?? source.rotation;
  this.alignedAxis = this._alignedAxis ?? source.alignedAxis;
  this.sizeInMeters = this._sizeInMeters ?? source.sizeInMeters;
  this.width = this._width ?? source.width;
  this.height = this._height ?? source.height;
  this.scaleByDistance = this._scaleByDistance ?? source.scaleByDistance;
  this.translucencyByDistance =
    this._translucencyByDistance ?? source.translucencyByDistance;
  this.pixelOffsetScaleByDistance =
    this._pixelOffsetScaleByDistance ?? source.pixelOffsetScaleByDistance;
  this.imageSubRegion = this._imageSubRegion ?? source.imageSubRegion;
  this.distanceDisplayCondition =
    this._distanceDisplayCondition ?? source.distanceDisplayCondition;
  this.disableDepthTestDistance =
    this._disableDepthTestDistance ?? source.disableDepthTestDistance;
  this.splitDirection = this.splitDirection ?? source.splitDirection;
};
export default BillboardGraphics;