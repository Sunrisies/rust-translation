import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} LabelGraphics.ConstructorOptions
 *
 * LabelGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定标签的可见性。
 * @property {Property | string} [text] 一个属性，指定文本内容。支持显式换行 '\n'。
 * @property {Property | string} [font='30px sans-serif'] 一个属性，指定 CSS 字体。
 * @property {Property | LabelStyle} [style=LabelStyle.FILL] 一个属性，指定 {@link LabelStyle}。
 * @property {Property | number} [scale=1.0] 一个数值属性，指定应用于文本的缩放比例。
 * @property {Property | boolean} [showBackground=false] 一个布尔属性，指定标签背景的可见性。
 * @property {Property | Color} [backgroundColor=new Color(0.165, 0.165, 0.165, 0.8)] 一个属性，指定背景 {@link Color}。
 * @property {Property | Cartesian2} [backgroundPadding=new Cartesian2(7, 5)] 一个 {@link Cartesian2} 属性，指定水平和垂直背景内边距的像素值。
 * @property {Property | Cartesian2} [pixelOffset=Cartesian2.ZERO] 一个 {@link Cartesian2} 属性，指定像素偏移量。
 * @property {Property | Cartesian3} [eyeOffset=Cartesian3.ZERO] 一个 {@link Cartesian3} 属性，指定眼睛偏移量。
 * @property {Property | HorizontalOrigin} [horizontalOrigin=HorizontalOrigin.CENTER] 一个属性，指定 {@link HorizontalOrigin}。
 * @property {Property | VerticalOrigin} [verticalOrigin=VerticalOrigin.CENTER] 一个属性，指定 {@link VerticalOrigin}。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 一个属性，指定高度所基于的基准。
 * @property {Property | Color} [fillColor=Color.WHITE] 一个属性，指定填充 {@link Color}。
 * @property {Property | Color} [outlineColor=Color.BLACK] 一个属性，指定轮廓 {@link Color}。
 * @property {Property | number} [outlineWidth=1.0] 一个数值属性，指定轮廓宽度。
 * @property {Property | NearFarScalar} [translucencyByDistance] 一个 {@link NearFarScalar} 属性，用于根据与相机的距离设置半透明效果。
 * @property {Property | NearFarScalar} [pixelOffsetScaleByDistance] 一个 {@link NearFarScalar} 属性，用于根据与相机的距离设置像素偏移量。
 * @property {Property | NearFarScalar} [scaleByDistance] 一个 {@link NearFarScalar} 属性，用于根据与相机的距离设置缩放比例。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定该标签在距相机多远的范围内显示。
 * @property {Property | number} [disableDepthTestDistance] 一个属性，指定禁用深度测试的距相机距离。
 */

/**
 * 描述位于包含 {@link Entity} 位置的二维标签。
 * <p>
 * <div align='center'>
 * <img src='Images/Label.png' width='400' height='300' /><br />
 * 示例标签
 * </div>
 * </p>
 *
 * @alias LabelGraphics
 * @constructor
 *
 * @param {LabelGraphics.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=labels|Cesium Sandcastle Labels Demo}
 */
function LabelGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._text = undefined;
  this._textSubscription = undefined;
  this._font = undefined;
  this._fontSubscription = undefined;
  this._style = undefined;
  this._styleSubscription = undefined;
  this._scale = undefined;
  this._scaleSubscription = undefined;
  this._showBackground = undefined;
  this._showBackgroundSubscription = undefined;
  this._backgroundColor = undefined;
  this._backgroundColorSubscription = undefined;
  this._backgroundPadding = undefined;
  this._backgroundPaddingSubscription = undefined;
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
  this._fillColor = undefined;
  this._fillColorSubscription = undefined;
  this._outlineColor = undefined;
  this._outlineColorSubscription = undefined;
  this._outlineWidth = undefined;
  this._outlineWidthSubscription = undefined;
  this._translucencyByDistance = undefined;
  this._translucencyByDistanceSubscription = undefined;
  this._pixelOffsetScaleByDistance = undefined;
  this._pixelOffsetScaleByDistanceSubscription = undefined;
  this._scaleByDistance = undefined;
  this._scaleByDistanceSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;
  this._disableDepthTestDistance = undefined;
  this._disableDepthTestDistanceSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(LabelGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof LabelGraphics.prototype
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
   * 获取或设置指定标签可见性的布尔属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定标签文本的字符串属性。
   * 支持显式换行 '\n'。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  text: createPropertyDescriptor("text"),

  /**
   * 获取或设置以 CSS 语法指定的字体字符串属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/font|CSS font on MDN}
   */
  font: createPropertyDescriptor("font"),

  /**
   * 获取或设置指定 {@link LabelStyle} 的属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  style: createPropertyDescriptor("style"),

  /**
   * 获取或设置指定应用于影像的统一缩放比例的数值属性。
   * 大于 <code>1.0</code> 的缩放比例会放大标签，小于 <code>1.0</code> 的缩放比例会缩小标签。
   * <p>
   * <div align='center'>
   * <img src='Images/Label.setScale.png' width='400' height='300' /><br/>
   * 在上图从左到右，比例分别为 <code>0.5</code>、<code>1.0</code> 和 <code>2.0</code>。
   * </div>
   * </div>
   * </p>
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  scale: createPropertyDescriptor("scale"),

  /**
   * 获取或设置指定标签背景可见性的布尔属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   * @default false
   */
  showBackground: createPropertyDescriptor("showBackground"),

  /**
   * 获取或设置指定背景颜色的属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   * @default new 颜色：(0.165, 0.165, 0.165, 0.8)
   */
  backgroundColor: createPropertyDescriptor("backgroundColor"),

  /**
   * 获取或设置指定标签水平和垂直背景内边距的 {@link Cartesian2} 属性，单位为像素。
   * </div>
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   * @default new Cartesian2(7, 5)
   */
  backgroundPadding: createPropertyDescriptor("backgroundPadding"),

  /**
   * 获取或设置指定标签在屏幕空间中的像素偏移量的 {@link Cartesian2} 属性。
   * 从该标签的原点开始。常用于对齐多个标签，使它们处于相同位置，例如图像和文本。屏幕空间原点是画布的左上角；<code>x</code> 从左到右增加，<code>y</code> 从上到下增加。
   * </div>
   * <div align='center'>
   * <p>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><code>default</code><br/><img src='Images/Label.setPixelOffset.default.png' width='250' height='188' /></td>
   * <td align='center'><code>l.pixeloffset = new Cartesian2(25, 75);</code><br/><img src='Images/Label.setPixelOffset.x50y-25.png' width='250' height='188' /></td>
   * </tr></table>
   * </div>
   * 标签的原点由黄色点表示。
   * </div>
   * </p>
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   * @default Cartesian2.ZERO
   */
  pixelOffset: createPropertyDescriptor("pixelOffset"),

  /**
   * 获取或设置指定标签在眼睛坐标中的偏移量的 {@link Cartesian3} 属性。
   * 眼睛坐标是一种左手坐标系，其中 <code>x</code> 指向观察者的右侧，<code>y</code> 指向上方，<code>z</code> 指向屏幕内部。
   * 常用于将多个标签或对象排列在相同位置，例如将标签置于其对应的 3D 模型之上。
   * <p>
   * </div>
   * </div>
   * </p>
   * 下面，标签位于地球中心位置，但通过眼睛偏移设置，它始终出现在地球上方，不受观察者或地球方向的影响。
   * </div>
   * <p>
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><img src='Images/Billboard.setEyeOffset.one.png' width='250' height='188' /></td>
   * <td align='center'><img src='Images/Billboard.setEyeOffset.two.png' width='250' height='188' /></td>
   * </tr></table>
   * <code>l.eyeOffset = new Cartesian3(0.0, 8000000.0, 0.0);</code><br /><br />
   * </div>
   * </p>
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   * @default Cartesian3.ZERO
   */
  eyeOffset: createPropertyDescriptor("eyeOffset"),

  /**
   * 获取或设置指定 {@link HorizontalOrigin} 的属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  horizontalOrigin: createPropertyDescriptor("horizontalOrigin"),

  /**
   * 获取或设置指定 {@link VerticalOrigin} 的属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  verticalOrigin: createPropertyDescriptor("verticalOrigin"),

  /**
   * 获取或设置指定 {@link HeightReference} 的属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * 获取或设置填充 {@link Color} 的属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  fillColor: createPropertyDescriptor("fillColor"),

  /**
   * 获取或设置轮廓 {@link Color} 的属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  outlineColor: createPropertyDescriptor("outlineColor"),

  /**
   * 获取或设置指定轮廓宽度的数值属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  outlineWidth: createPropertyDescriptor("outlineWidth"),

  /**
   * 获取或设置指定根据相机距离计算标签透明度的 {@link NearFarScalar} 属性。
   * 标签的透明度将在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值，当相机距离处于指定 {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 的下限和上限范围内时。
   * 标签的透明度在这两个范围之外时，会被限制为最近的边界值。
   * 获取或设置指定根据相机距离计算标签像素偏移量的 {@link NearFarScalar} 属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  translucencyByDistance: createPropertyDescriptor("translucencyByDistance"),

  /**
   * 获取或设置指定根据相机距离计算标签像素偏移量的 {@link NearFarScalar} 属性。
   * 标签的像素偏移量将在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值，当相机距离处于指定 {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 的下限和上限范围内时。
   * 标签的像素偏移量在这两个范围之外时，会被限制为最近的边界值。
   * 获取或设置基于标签与相机距离的 {@link NearFarScalar} 属性，用于调整标签的缩放比例。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  pixelOffsetScaleByDistance: createPropertyDescriptor(
    "pixelOffsetScaleByDistance",
  ),

  /**
   * 获取或设置基于标签与相机距离的 {@link NearFarScalar} 属性，用于调整标签的缩放比例。
   * 标签的缩放比例将在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值，当相机距离处于指定 {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 的下限和上限范围内时。
   * 标签的缩放比例在这两个范围之外时，会被限制为最近的边界值。如果未定义，
   * {@link NearFarScalar#farValue} 将被禁用。
   * 获取或设置指定该标签在距相机多远的距离下显示的 {@link DistanceDisplayCondition} 属性。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  scaleByDistance: createPropertyDescriptor("scaleByDistance"),

  /**
   * 获取或设置用于禁用深度测试的距相机距离，例如，以防止与地形发生裁剪。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),

  /**
   * 当设置为零时，深度测试始终应用；当设置为 Number.POSITIVE_INFINITY 时，深度测试从不应用。
   * 当设置为零时，深度测试始终应用；当设置为 Number.POSITIVE_INFINITY 时，深度测试从不应用。
   * @memberof LabelGraphics.prototype
   * @type {Property|undefined}
   */
  disableDepthTestDistance: createPropertyDescriptor(
    "disableDepthTestDistance",
  ),
});

/**
 * 复制此实例。
 *
 * @param {LabelGraphics} [result] 用于存储结果的对象。
 * @returns {LabelGraphics} The 修改后的结果参数，或如果未提供则创建新实例。
 */
LabelGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new LabelGraphics(this);
  }
  result.show = this.show;
  result.text = this.text;
  result.font = this.font;
  result.style = this.style;
  result.scale = this.scale;
  result.showBackground = this.showBackground;
  result.backgroundColor = this.backgroundColor;
  result.backgroundPadding = this.backgroundPadding;
  result.pixelOffset = this.pixelOffset;
  result.eyeOffset = this.eyeOffset;
  result.horizontalOrigin = this.horizontalOrigin;
  result.verticalOrigin = this.verticalOrigin;
  result.heightReference = this.heightReference;
  result.fillColor = this.fillColor;
  result.outlineColor = this.outlineColor;
  result.outlineWidth = this.outlineWidth;
  result.translucencyByDistance = this.translucencyByDistance;
  result.pixelOffsetScaleByDistance = this.pixelOffsetScaleByDistance;
  result.scaleByDistance = this.scaleByDistance;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  result.disableDepthTestDistance = this.disableDepthTestDistance;
  return result;
};

/**
 * 将此对象中未赋值的每个属性赋值给
 * 提供源对象中相同属性的值。
 *
 * @param {LabelGraphics} source 将被合并到此对象中的对象。
 */
LabelGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.text = this.text ?? source.text;
  this.font = this.font ?? source.font;
  this.style = this.style ?? source.style;
  this.scale = this.scale ?? source.scale;
  this.showBackground = this.showBackground ?? source.showBackground;
  this.backgroundColor = this.backgroundColor ?? source.backgroundColor;
  this.backgroundPadding = this.backgroundPadding ?? source.backgroundPadding;
  this.pixelOffset = this.pixelOffset ?? source.pixelOffset;
  this.eyeOffset = this.eyeOffset ?? source.eyeOffset;
  this.horizontalOrigin = this.horizontalOrigin ?? source.horizontalOrigin;
  this.verticalOrigin = this.verticalOrigin ?? source.verticalOrigin;
  this.heightReference = this.heightReference ?? source.heightReference;
  this.fillColor = this.fillColor ?? source.fillColor;
  this.outlineColor = this.outlineColor ?? source.outlineColor;
  this.outlineWidth = this.outlineWidth ?? source.outlineWidth;
  this.translucencyByDistance =
    this.translucencyByDistance ?? source.translucencyByDistance;
  this.pixelOffsetScaleByDistance =
    this.pixelOffsetScaleByDistance ?? source.pixelOffsetScaleByDistance;
  this.scaleByDistance = this.scaleByDistance ?? source.scaleByDistance;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
  this.disableDepthTestDistance =
    this.disableDepthTestDistance ?? source.disableDepthTestDistance;
};
export default LabelGraphics;
