import { Cartographic, Color, defined } from "@cesium/core";
import Cesium3DTileFeature from "./Cesium3DTileFeature.js";
import createBillboardPointCallback from "./createBillboardPointCallback.js";

/** @import Billboard from "./Billboard.js"; */
/** @import Cesium3DTileContent from "./Cesium3DTileContent.js"; */
/** @import Cesium3DTileset from "./Cesium3DTileset.js"; */
/** @import FeatureLayer from "./FeatureLayer.js"; */
/** @import { DistanceDisplayCondition } from "@cesium/core"; */
/** @import HorizontalOrigin from "./HorizontalOrigin.js"; */
/** @import Label from "./Label.js"; */
/** @import { NearFarScalar } from "@cesium/core"; */
/** @import Polyline from "./Polyline.js"; */
/** @import VerticalOrigin from "./VerticalOrigin.js"; */

/** @ignore */
const scratchCartographic = new Cartographic();

/**
 * 一个 {@link Cesium3DTileset} 的点特征。
 * <p>
 * 提供对瓦片批次表中存储的特征属性的访问，以及
 * 显示/隐藏特征并更改其点属性的能力。
 * </p>
 * <p>
 * 对 <code>Cesium3DTilePointFeature</code> 对象的修改具有该瓦片内容的生命周期。如果瓦片内容被卸载，例如因超出视野而需要释放缓存中的空间以保留可见瓦片，请监听 {@link Cesium3DTileset#tileUnload} 事件以保存任何修改。同时监听 {@link Cesium3DTileset#tileVisible} 事件以重新应用这些修改。
 * 不要直接构造此对象。通过 {@link Cesium3DTileContent#getFeature} 或
 * to free space in the cache for visible tiles, listen to the {@link Cesium3DTileset#tileUnload} event to save any
 * modifications. Also listen to the {@link Cesium3DTileset#tileVisible} event to reapply any modifications.
 * </p>
 * <p>
 * 不要直接构造此对象。通过 {@link Cesium3DTileContent#getFeature} 或
 * 使用 {@link Scene#pick} 和 {@link Scene#pickPosition} 选择来访问它。
 * </p>
 *
 * @experimental This 该特征使用的是 3D Tiles 规范中的部分内容，该规范尚未定稿且可能根据 Cesium 的标准弃用政策进行更改。
 *
 * @example
 * // 当鼠标悬停时，在控制台日志中显示所有特征属性。
 * handler.setInputAction(function(movement) {
 * const feature = scene.pick(movement.endPosition);
 * if (feature instanceof Cesium.Cesium3DTilePointFeature) {
 * const propertyIds = feature.getPropertyIds();
 * const length = propertyIds.length;
 * for (let i = 0; i < length; ++i) {
 * const propertyId = propertyIds[i];
 * console.log(`{propertyId}: ${feature.getProperty(propertyId)}`);
 *         }
 *     }
 * }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 */
class Cesium3DTilePointFeature {
  static defaultColor = Color.WHITE;
  static defaultPointOutlineColor = Color.BLACK;
  static defaultPointOutlineWidth = 0.0;
  static defaultPointSize = 8.0;

  /**
   * @param {Cesium3DTileContent} content
   * @param {number} batchId
   * @param {Billboard} billboard
   * @param {Label} label
   * @param {Polyline} polyline
   */
  constructor(content, batchId, billboard, label, polyline) {
    this._content = content;
    this._billboard = billboard;
    this._label = label;
    this._polyline = polyline;

    this._batchId = batchId;
    this._billboardImage = undefined;
    this._billboardColor = undefined;
    this._billboardOutlineColor = undefined;
    this._billboardOutlineWidth = undefined;
    this._billboardSize = undefined;
    this._pointSize = undefined;
    this._color = undefined;
    this._pointSize = undefined;
    this._pointOutlineColor = undefined;
    this._pointOutlineWidth = undefined;
    this._heightOffset = undefined;

    this._pickIds = new Array(3);

    setBillboardImage(this);
  }

  /**
   * 获取或设置特征是否显示。此设置对所有特征生效，
   * 在评估样式显示时生效。
   *
   * @type {boolean}
   *
   * @default true
   */
  get show() {
    return this._label.show;
  }

  set show(value) {
    this._label.show = value;
    this._billboard.show = value;
    this._polyline.show = value;
  }

  /**
   * 获取或设置该特征点的颜色。
   * <p>
   * 仅在 <code>image</code> 为 <code>undefined</code> 时应用。
   * </p>
   *
   * @type {Color}
   */
  get color() {
    return this._color;
  }

  set color(value) {
    this._color = Color.clone(value, this._color);
    setBillboardImage(this);
  }

  /**
   * 获取或设置该特征点的大小。
   * <p>
   * 仅在 <code>image</code> 为 <code>undefined</code> 时应用。
   * </p>
   *
   * @type {number}
   */
  get pointSize() {
    return this._pointSize;
  }

  set pointSize(value) {
    this._pointSize = value;
    setBillboardImage(this);
  }

  /**
   * 获取或设置该特征点的轮廓颜色。
   * <p>
   * 仅在 <code>image</code> 为 <code>undefined</code> 时应用。
   * </p>
   *
   * @type {Color}
   */
  get pointOutlineColor() {
    return this._pointOutlineColor;
  }

  set pointOutlineColor(value) {
    this._pointOutlineColor = Color.clone(value, this._pointOutlineColor);
    setBillboardImage(this);
  }

  /**
   * 获取或设置该特征点的轮廓宽度（以像素为单位）。
   * <p>
   * 仅在 <code>image</code> 为 <code>undefined</code> 时应用。
   * </p>
   *
   * @type {number}
   */
  get pointOutlineWidth() {
    return this._pointOutlineWidth;
  }

  set pointOutlineWidth(value) {
    this._pointOutlineWidth = value;
    setBillboardImage(this);
  }

  /**
   * 获取或设置该特征的标签颜色。
   * <p>
   * 如果定义了 <code>labelText</code>，则颜色将应用于标签。
   * </p>
   *
   * @type {Color}
   */
  get labelColor() {
    return this._label.fillColor;
  }

  set labelColor(value) {
    this._label.fillColor = value;
    this._polyline.show = this._label.show && value.alpha > 0.0;
  }

  /**
   * 获取或设置该特征的标签轮廓颜色。
   * <p>
   * 如果定义了 <code>labelText</code>，则轮廓颜色将应用于标签。
   * </p>
   *
   * @type {Color}
   */
  get labelOutlineColor() {
    return this._label.outlineColor;
  }

  set labelOutlineColor(value) {
    this._label.outlineColor = value;
  }

  /**
   * 获取或设置该特征的轮廓宽度（以像素为单位）。
   * <p>
   * 如果定义了 <code>labelText</code>，则轮廓宽度将应用于该点。
   * </p>
   *
   * @type {number}
   */
  get labelOutlineWidth() {
    return this._label.outlineWidth;
  }

  set labelOutlineWidth(value) {
    this._label.outlineWidth = value;
  }

  /**
   * 获取或设置此特性的字体。
   * <p>
   * 仅在定义 <code>labelText</code> 时应用。
   * </p>
   *
   * @type {string}
   */
  get font() {
    return this._label.font;
  }

  set font(value) {
    this._label.font = value;
  }

  /**
   * 获取或设置此特性的填充和轮廓样式。
   * <p>
   * 仅在定义 <code>labelText</code> 时应用。
   * </p>
   *
   * @type {LabelStyle}
   */
  get labelStyle() {
    return this._label.style;
  }

  set labelStyle(value) {
    this._label.style = value;
  }

  /**
   * 获取或设置此特性的文本。
   *
   * @type {string}
   */
  get labelText() {
    return this._label.text;
  }

  set labelText(value) {
    if (!defined(value)) {
      value = "";
    }
    this._label.text = value;
  }

  /**
   * 获取或设置此特性文本的背景颜色。
   * <p>
   * 仅在定义 <code>labelText</code> 时应用。
   * </p>
   *
   * @type {Color}
   */
  get backgroundColor() {
    return this._label.backgroundColor;
  }

  set backgroundColor(value) {
    this._label.backgroundColor = value;
  }

  /**
   * 获取或设置此特性文本的背景内边距。
   * <p>
   * 仅在定义 <code>labelText</code> 时应用。
   * </p>
   *
   * @type {Cartesian2}
   */
  get backgroundPadding() {
    return this._label.backgroundPadding;
  }

  set backgroundPadding(value) {
    this._label.backgroundPadding = value;
  }

  /**
   * 获取或设置是否显示此特性文本的背景。
   * <p>
   * 仅在定义 <code>labelText</code> 时应用。
   * </p>
   *
   * @type {boolean}
   */
  get backgroundEnabled() {
    return this._label.showBackground;
  }

  set backgroundEnabled(value) {
    this._label.showBackground = value;
  }

  /**
   * 获取或设置此特性的近远缩放属性。
   *
   * @type {NearFarScalar}
   */
  get scaleByDistance() {
    return this._label.scaleByDistance;
  }

  set scaleByDistance(value) {
    this._label.scaleByDistance = value;
    this._billboard.scaleByDistance = value;
  }

  /**
   * 获取或设置此特性的近远半透明属性。
   *
   * @type {NearFarScalar}
   */
  get translucencyByDistance() {
    return this._label.translucencyByDistance;
  }

  set translucencyByDistance(value) {
    this._label.translucencyByDistance = value;
    this._billboard.translucencyByDistance = value;
  }

  /**
   * 获取或设置指定该特性在距相机多远的距离下显示的条件。
   *
   * @type {DistanceDisplayCondition}
   */
  get distanceDisplayCondition() {
    return this._label.distanceDisplayCondition;
  }

  set distanceDisplayCondition(value) {
    this._label.distanceDisplayCondition = value;
    this._polyline.distanceDisplayCondition = value;
    this._billboard.distanceDisplayCondition = value;
  }

  /**
   * 获取或设置此特性的高度偏移量（以米为单位）。
   *
   * @type {number}
   */
  get heightOffset() {
    return this._heightOffset;
  }

  set heightOffset(value) {
    const offset = this._heightOffset ?? 0.0;

    const ellipsoid = this._content.tileset.ellipsoid;
    const cart = ellipsoid.cartesianToCartographic(
      this._billboard.position,
      scratchCartographic,
    );
    cart.height = cart.height - offset + value;
    const newPosition = ellipsoid.cartographicToCartesian(cart);

    this._billboard.position = newPosition;
    this._label.position = this._billboard.position;
    this._polyline.positions = [this._polyline.positions[0], newPosition];

    this._heightOffset = value;
  }

  /**
   * 获取或设置锚线是否显示。
   * <p>
   * 仅在定义 <code>heightOffset</code> 时应用。
   * </p>
   *
   * @type {boolean}
   */
  get anchorLineEnabled() {
    return this._polyline.show;
  }

  set anchorLineEnabled(value) {
    this._polyline.show = value;
  }

  /**
   * 获取或设置锚线的颜色。
   * <p>
   * 仅在定义 <code>heightOffset</code> 时应用。
   * </p>
   *
   * @type {Color}
   */
  get anchorLineColor() {
    return this._polyline.material.uniforms.color;
  }

  set anchorLineColor(value) {
    this._polyline.material.uniforms.color = Color.clone(
      value,
      this._polyline.material.uniforms.color,
    );
  }

  /**
   * 获取或设置此特性的图像。
   *
   * @type {string}
   */
  get image() {
    return this._billboardImage;
  }

  set image(value) {
    const imageChanged = this._billboardImage !== value;
    this._billboardImage = value;
    if (imageChanged) {
      setBillboardImage(this);
    }
  }

  /**
   * 获取或设置深度测试将被禁用的距离。
   *
   * @type {number}
   */
  get disableDepthTestDistance() {
    return this._label.disableDepthTestDistance;
  }

  set disableDepthTestDistance(value) {
    this._label.disableDepthTestDistance = value;
    this._billboard.disableDepthTestDistance = value;
  }

  /**
   * 获取或设置该点的水平原点，决定该点位于
   * 锚位置的左侧、中心还是右侧。
   *
   * @type {HorizontalOrigin}
   */
  get horizontalOrigin() {
    return this._billboard.horizontalOrigin;
  }

  set horizontalOrigin(value) {
    this._billboard.horizontalOrigin = value;
  }

  /**
   * 获取或设置该点的垂直原点，决定该点位于
   * 锚位置的底部、中心还是顶部。
   *
   * @type {VerticalOrigin}
   */
  get verticalOrigin() {
    return this._billboard.verticalOrigin;
  }

  set verticalOrigin(value) {
    this._billboard.verticalOrigin = value;
  }

  /**
   * 获取或设置该点文本的水平原点，决定该点文本位于
   * 锚位置的左侧、中心还是右侧。
   *
   * @type {HorizontalOrigin}
   */
  get labelHorizontalOrigin() {
    return this._label.horizontalOrigin;
  }

  set labelHorizontalOrigin(value) {
    this._label.horizontalOrigin = value;
  }

  /**
   * 获取或设置该点文本的垂直原点，决定该点文本位于
   * 锚点的底部、中心、顶部或基线位置。
   *
   * @type {VerticalOrigin}
   */
  get labelVerticalOrigin() {
    return this._label.verticalOrigin;
  }

  set labelVerticalOrigin(value) {
    this._label.verticalOrigin = value;
  }

  /**
   * 获取包含该特性的瓦片内容。
   *
   * @type {Cesium3DTileContent}
   *
   * @readonly
   * @private
   */
  get content() {
    return this._content;
  }

  /**
   * 获取包含该特性的瓦片集。
   *
   * @type {Cesium3DTileset}
   *
   * @readonly
   */
  get tileset() {
    return this._content.tileset;
  }

  /**
   * 获取包含该特性的特征层（如果有的话）。
   *
   * @type {FeatureLayer|undefined}
   *
   * @readonly
   * @experimental This 该特性尚未最终确定，且可能根据 Cesium 的标准弃用政策发生变化。
   */
  get featureLayer() {
    return Cesium3DTileFeature.getFeatureLayer(this._content);
  }

  /**
   * {@link Scene#pick} 返回的所有对象都具有 <code>primitive</code> 属性。这返回
   * 包含该特性的瓦片集。
   *
   * @type {Cesium3DTileset}
   *
   * @readonly
   */
  get primitive() {
    return this._content.tileset;
  }

  /**
   * @private
   */
  get pickIds() {
    const ids = this._pickIds;
    ids[0] = this._billboard.pickId;
    ids[1] = this._label.pickId;
    ids[2] = this._polyline.pickId;
    return ids;
  }

  /**
   * 返回该特性是否包含此属性。这包括来自该特性的
   * 类及其继承类的属性，在使用批量表格层次结构时。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string} name 属性的大小写敏感名称。
   * @returns {boolean} Whether 该特性包含此属性。
   */
  hasProperty(name) {
    return this._content.batchTable.hasProperty(this._batchId, name);
  }

  /**
   * 返回一个属性 ID 数组，用于该特性。这包括来自该特性的
   * 类及其继承类的属性，在使用批量表格层次结构时。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string[]} [results] 用于存储结果的数组。
   * @returns {string[]} The 特性属性的 ID。
   */
  getPropertyIds(results) {
    return this._content.batchTable.getPropertyIds(this._batchId, results);
  }

  /**
   * 返回具有给定名称的特性的属性值的副本。这包括来自该特性的
   * 类及其继承类的属性，在使用批量表格层次结构时。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string} name 属性的大小写敏感名称。
   * @returns {*} The 属性的值，如果特性没有此属性则返回 <code>undefined</code>。
   *
   * @example
   * // 在控制台日志中显示特性的所有属性。
   * const propertyIds = feature.getPropertyIds();
   * const length = propertyIds.length;
   * for (let i = 0; i < length; ++i) {
   * const propertyId = propertyIds[i];
   * console.log(`{propertyId} : ${feature.getProperty(propertyId)}`);
   * }
   */
  getProperty(name) {
    return this._content.batchTable.getProperty(this._batchId, name);
  }

  /**
   * 返回具有给定名称的特性的属性值的副本。
   * 如果特性包含具有元数据的 tileset（3D Tiles 1.1）
   * 或使用 <code>3DTILES_metadata</code> 扩展，则 tileset、组和 tile 的元数据
   * 是继承的。
   * <p>
   * 为了解决名称冲突，此方法按元数据的粒度从最具体到
   * 最不具体的方式解析名称，顺序为：特性、tile、组、
   * tileset。在每种粒度中，首先解析语义，然后解析其他
   * 属性。
   * </p>
   * @param {string} name 属性的大小写敏感名称。
   * @returns {*} The 属性的值，如果特性没有此属性则返回 <code>undefined</code>。
   * @private
   * @experimental This 特性使用的是 3D Tiles 规范中的部分内容，该内容尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
   */
  getPropertyInherited(name) {
    return Cesium3DTileFeature.getPropertyInherited(
      this._content,
      this._batchId,
      name,
    );
  }

  /**
   * 设置具有给定名称的特性的属性值。
   * <p>
   * 如果具有给定名称的属性不存在，则创建该属性。
   * </p>
   *
   * @param {string} name 属性的大小写敏感名称。
   * @param {*} value 将被复制的属性值。
   *
   * @exception {DeveloperError} Inherited 批量表格层次结构属性为只读。
   *
   * @example
   * const height = feature.getProperty('Height'); // 例如，建筑物的高度
   *
   * @example
   * const name = 'clicked';
   * if (feature.getProperty(name)) {
   * console.log('already clicked');
   * } else {
   * feature.setProperty(name, true);
   * console.log('first click');
   * }
   */
  setProperty(name, value) {
    this._content.batchTable.setProperty(this._batchId, name, value);

    // PERFORMANCE_IDEA: Probably overkill, but maybe only mark the tile dirty if the
    // property is in one of the style's expressions or - if it can be done quickly -
    // if the new property value changed the result of an expression.
    this._content.featurePropertiesDirty = true;
  }

  /**
   * 返回该实体的类名是否等于 <code>className</code>。与 {@link Cesium3DTilePointFeature#isClass} 不同。
   * 此函数仅检查实体的精确类名，不检查继承类。
   * <p>
   * 如果没有批表层次结构，此函数返回 <code>false</code>。
   * </p>
   *
   * @param {string} className 需要检查的名称。
   * @returns {boolean} Whether 该实体的类名等于 <code>className</code>
   *
   * @private
   */
  isExactClass(className) {
    return this._content.batchTable.isExactClass(this._batchId, className);
  }

  /**
   * 返回该实体的类名或任何继承类是否名为 <code>className</code>。
   * <p>
   * 如果没有批表层次结构，此函数返回 <code>false</code>。
   * </p>
   *
   * @param {string} className 需要检查的名称。
   * @returns {boolean} Whether 该实体的类名或继承类名为 <code>className</code>
   *
   * @private
   */
  isClass(className) {
    return this._content.batchTable.isClass(this._batchId, className);
  }

  /**
   * 返回该实体的类名。
   * <p>
   * 如果没有批表层次结构，此函数返回 <code>undefined</code>。
   * </p>
   *
   * @returns {string} The 实体的类名。
   *
   * @private
   */
  getExactClassName() {
    return this._content.batchTable.getExactClassName(this._batchId);
  }
}

/**
 * @param {Cesium3DTilePointFeature} feature
 * @ignore
 */
function setBillboardImage(feature) {
  const b = feature._billboard;
  if (defined(feature._billboardImage) && feature._billboardImage !== b.image) {
    b.image = feature._billboardImage;
    return;
  }

  if (defined(feature._billboardImage)) {
    return;
  }

  const newColor = feature._color ?? Cesium3DTilePointFeature.defaultColor;
  const newOutlineColor =
    feature._pointOutlineColor ??
    Cesium3DTilePointFeature.defaultPointOutlineColor;
  const newOutlineWidth =
    feature._pointOutlineWidth ??
    Cesium3DTilePointFeature.defaultPointOutlineWidth;
  const newPointSize =
    feature._pointSize ?? Cesium3DTilePointFeature.defaultPointSize;

  const currentColor = feature._billboardColor;
  const currentOutlineColor = feature._billboardOutlineColor;
  const currentOutlineWidth = feature._billboardOutlineWidth;
  const currentPointSize = feature._billboardSize;

  if (
    Color.equals(newColor, currentColor) &&
    Color.equals(newOutlineColor, currentOutlineColor) &&
    newOutlineWidth === currentOutlineWidth &&
    newPointSize === currentPointSize
  ) {
    return;
  }

  feature._billboardColor = Color.clone(newColor, feature._billboardColor);
  feature._billboardOutlineColor = Color.clone(
    newOutlineColor,
    feature._billboardOutlineColor,
  );
  feature._billboardOutlineWidth = newOutlineWidth;
  feature._billboardSize = newPointSize;

  const centerAlpha = newColor.alpha;
  const cssColor = newColor.toCssColorString();
  const cssOutlineColor = newOutlineColor.toCssColorString();
  const textureId = JSON.stringify([
    cssColor,
    newPointSize,
    cssOutlineColor,
    newOutlineWidth,
  ]);

  b.setImage(
    textureId,
    createBillboardPointCallback(
      centerAlpha,
      cssColor,
      cssOutlineColor,
      newOutlineWidth,
      newPointSize,
    ),
  );
}

export default Cesium3DTilePointFeature;