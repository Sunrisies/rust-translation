import { destroyObject } from "@cesium/core";

/**
 * 表示瓦片中的内容
 * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification|3D Tiles} 瓦片集中的瓦片内容
 * 指向另一个 3D Tiles 瓦片集
 * <p>
 * 实现 {@link Cesium3DTileContent} 接口
 * </p>
 *
 * @implements Cesium3DTileContent
 * @private
 */
class Tileset3DTileContent {
  constructor(tileset, tile, resource) {
    this._tileset = tileset;
    this._tile = tile;
    this._resource = resource;

    this.featurePropertiesDirty = false;

    this._metadata = undefined;
    this._group = undefined;

    this._ready = false;
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
   * 当瓦片内容准备好渲染时返回 true，否则返回 false
   *
   *
   * @type {boolean}
   * @readonly
   * @private
   */
  get ready() {
    return this._ready;
  }

  get tileset() {
    return this._tileset;
  }

  get tile() {
    return this._tile;
  }

  get url() {
    return this._resource.getUrlComponent(true);
  }

  get batchTable() {
    return undefined;
  }

  get metadata() {
    return this._metadata;
  }

  set metadata(value) {
    this._metadata = value;
  }

  get group() {
    return this._group;
  }

  set group(value) {
    this._group = value;
  }

  /** @inheritdoc */
  get show() {
    return this._tileset.show;
  }

  set show(value) {
    this._tileset.show = value;
  }

  /**
   * 从解析后的 JSON 对象中创建 Tileset3DTileContent 实例
   * @param {Cesium3DTileset} tileset
   * @param {Cesium3DTile} tile
   * @param {Resource} resource
   * @param {object} json
   * @returns {Tileset3DTileContent}
   */
  static fromJson(tileset, tile, resource, json) {
    const content = new Tileset3DTileContent(tileset, tile, resource);
    content._tileset.loadTileset(content._resource, json, content._tile);
    content._ready = true;

    return content;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口 <code>Tileset3DTileContent</code>
   * 总是返回 <code>false</code>，因为这种类型的瓦片没有任何特性
   */
  hasProperty(batchId, name) {
    return false;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口 <code>Tileset3DTileContent</code>
   * 总是返回 <code>undefined</code>，因为这种类型的瓦片没有任何特性
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

export default Tileset3DTileContent;
