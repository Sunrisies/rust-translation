import { DeveloperError, destroyObject } from "@cesium/core";

/**
 * 表示瓦片中的空内容。
 * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification|3D Tiles} 瓦片集中
 * 没有内容，例如用于优化层次剔除。
 * <p>
 * 实现 {@link Cesium3DTileContent} 接口。
 * </p>
 *
 * @implements Cesium3DTileContent
 * @private
 */
class Empty3DTileContent {
  constructor(tileset, tile) {
    this._tileset = tileset;
    this._tile = tile;
    this._show = true;
    this.featurePropertiesDirty = false;
  }

  get featuresLength() {
    return 0;
  }

  get pointsLength() {
    return 0;
  }

  get trianglesLength() {
    return 0;
  }

  get geometryByteLength() {
    return 0;
  }

  get texturesByteLength() {
    return 0;
  }

  get batchTableByteLength() {
    return 0;
  }

  get innerContents() {
    return undefined;
  }

  /**
   * 当瓦片内容准备好渲染时返回 true；否则返回 false。
   *
   *
   * @type {boolean}
   * @readonly
   * @private
   */
  get ready() {
    return true;
  }

  get tileset() {
    return this._tileset;
  }

  get tile() {
    return this._tile;
  }

  get url() {
    return undefined;
  }

  get metadata() {
    return undefined;
  }

  set metadata(value) {
    //>>includeStart('debug', pragmas.debug);
    throw new DeveloperError("Empty3DTileContent cannot have content metadata");
    //>>includeEnd('debug');
  }

  get batchTable() {
    return undefined;
  }

  get group() {
    return undefined;
  }

  set group(value) {
    //>>includeStart('debug', pragmas.debug);
    throw new DeveloperError("Empty3DTileContent cannot have group metadata");
    //>>includeEnd('debug');
  }

  /** @inheritdoc */
  get show() {
    return this._show;
  }

  set show(value) {
    this._show = value;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口。<code>Empty3DTileContent</code>
   * 总是返回 <code>false</code>，因为这种类型的瓦片没有任何特征。
   */
  hasProperty(batchId, name) {
    return false;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口。<code>Empty3DTileContent</code>
   * 总是返回 <code>undefined</code>，因为这种类型的瓦片没有任何特征。
   */
  getFeature(batchId) {
    return undefined;
  }

  applyDebugSettings(enabled, color) {}
  applyStyle(style) {}
  update(tileset, frameState) {}

  pick(ray, frameState, result) {
    return undefined;
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    return destroyObject(this);
  }
}

export default Empty3DTileContent;
