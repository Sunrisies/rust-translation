import {
  Cartesian3,
  RuntimeError,
  defined,
  destroyObject,
  getMagic,
} from "@cesium/core";

/**
 * 表示一个
 * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/TileFormats/Composite|Composite}
 * 在 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification|3D Tiles} 瓦片集中的一张瓦片。
 * <p>
 * 实现 {@link Cesium3DTileContent} 接口。
 * </p>
 *
 * @implements Cesium3DTileContent
 * @private
 */
class Composite3DTileContent {
  constructor(tileset, tile, resource, contents) {
    this._tileset = tileset;
    this._tile = tile;
    this._resource = resource;

    if (!defined(contents)) {
      contents = [];
    }
    this._contents = contents;

    this._metadata = undefined;
    this._group = undefined;
    this._ready = false;
  }

  get featurePropertiesDirty() {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      if (contents[i].featurePropertiesDirty) {
        return true;
      }
    }

    return false;
  }

  set featurePropertiesDirty(value) {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].featurePropertiesDirty = value;
    }
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 总是返回 <code>0</code>。 应调用 <code>featuresLength</code> 来获取复合瓦片中的一张瓦片的信息。
   */
  get featuresLength() {
    return 0;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 总是返回 <code>0</code>。 应调用 <code>pointsLength</code> 来获取复合瓦片中的一张瓦片的信息。
   */
  get pointsLength() {
    return 0;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 总是返回 <code>0</code>。 应调用 <code>trianglesLength</code> 来获取复合瓦片中的一张瓦片的信息。
   */
  get trianglesLength() {
    return 0;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 总是返回 <code>0</code>。 应调用 <code>geometryByteLength</code> 来获取复合瓦片中的一张瓦片的信息。
   */
  get geometryByteLength() {
    return 0;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 总是返回 <code>0</code>。 应调用 <code>texturesByteLength</code> 来获取复合瓦片中的一张瓦片的信息。
   */
  get texturesByteLength() {
    return 0;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 总是返回 <code>0</code>。 应调用 <code>batchTableByteLength</code> 来获取复合瓦片中的一张瓦片的信息。
   */
  get batchTableByteLength() {
    return 0;
  }

  get innerContents() {
    return this._contents;
  }

  /**
   * 当该瓦片的内容准备好渲染时返回 true；否则返回 false。
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

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 同时存储内容元数据，并将内容元数据传播到其所有子元素中。
   * @private
   * @experimental This 该特性使用了尚未定稿的 3D Tiles 规范的一部分，可能会根据 Cesium 的标准弃用政策进行更改。
   */
  get metadata() {
    return this._metadata;
  }

  set metadata(value) {
    this._metadata = value;
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].metadata = value;
    }
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 总是返回 <code>undefined</code>。 应调用 <code>batchTable</code> 来获取复合瓦片中的一张瓦片的信息。
   */
  get batchTable() {
    return undefined;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。 <code>Composite3DTileContent</code>
   * 同时存储组元数据，并将组元数据传播到其所有子元素中。
   * @private
   * @experimental This 该特性使用了尚未定稿的 3D Tiles 规范的一部分，可能会根据 Cesium 的标准弃用政策进行更改。
   */
  get group() {
    return this._group;
  }

  set group(value) {
    this._group = value;
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].group = value;
    }
  }

  /** @inheritdoc */
  get show() {
    let result = true;
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      result = result & contents[i].show;
    }
    return result;
  }

  set show(value) {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].show = value;
    }
  }

  static async fromTileType(
    tileset,
    tile,
    resource,
    arrayBuffer,
    byteOffset,
    factory,
  ) {
    byteOffset = byteOffset ?? 0;

    const uint8Array = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    byteOffset += sizeOfUint32; // Skip magic

    const version = view.getUint32(byteOffset, true);
    if (version !== 1) {
      throw new RuntimeError(
        `Only Composite Tile version 1 is supported. Version ${version} is not.`,
      );
    }
    byteOffset += sizeOfUint32;

    // Skip byteLength
    byteOffset += sizeOfUint32;

    const tilesLength = view.getUint32(byteOffset, true);
    byteOffset += sizeOfUint32;

    // For caching purposes, models within the composite tile must be
    // distinguished. To do this, add a query parameter ?compositeIndex=i.
    // Since composite tiles may contain other composite tiles, check for an
    // existing prefix and separate them with underscores. e.g.
    // ?compositeIndex=0_1_1
    let prefix = resource.queryParameters.compositeIndex;
    if (defined(prefix)) {
      // We'll be adding another value at the end, so add an underscore.
      prefix = `${prefix}_`;
    } else {
      // no prefix
      prefix = "";
    }

    const promises = [];
    promises.length = tilesLength;
    for (let i = 0; i < tilesLength; ++i) {
      const tileType = getMagic(uint8Array, byteOffset);

      // Tile byte length is stored after magic and version
      const tileByteLength = view.getUint32(
        byteOffset + sizeOfUint32 * 2,
        true,
      );

      const contentFactory = factory[tileType];

      // Label which content within the composite this is
      const compositeIndex = `${prefix}${i}`;
      const childResource = resource.getDerivedResource({
        queryParameters: {
          compositeIndex: compositeIndex,
        },
      });

      if (defined(contentFactory)) {
        promises[i] = Promise.resolve(
          contentFactory(tileset, tile, childResource, arrayBuffer, byteOffset),
        );
      } else {
        throw new RuntimeError(
          `Unknown tile content type, ${tileType}, inside Composite tile`,
        );
      }

      byteOffset += tileByteLength;
    }

    const innerContents = await Promise.all(promises);
    const content = new Composite3DTileContent(
      tileset,
      tile,
      resource,
      innerContents,
    );
    return content;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。<code>Composite3DTileContent</code>
   * 始终返回 <code>false</code>。应调用 <code>hasProperty</code> 来检查复合中的瓦片属性。
   */
  hasProperty(batchId, name) {
    return false;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。<code>Composite3DTileContent</code>
   * 始终返回 <code>undefined</code>。应调用 <code>getFeature</code> 来检查复合中的瓦片特征。
   */
  getFeature(batchId) {
    return undefined;
  }

  applyDebugSettings(enabled, color) {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].applyDebugSettings(enabled, color);
    }
  }

  applyStyle(style) {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].applyStyle(style);
    }
  }

  update(tileset, frameState) {
    const contents = this._contents;
    const length = contents.length;
    let ready = true;
    for (let i = 0; i < length; ++i) {
      contents[i].update(tileset, frameState);
      ready = ready && contents[i].ready;
    }

    if (!this._ready && ready) {
      this._ready = true;
    }
  }

  /**
   * 查找射线与渲染的瓦片内容表面之间的交点。射线必须以世界坐标形式提供。
   *
   * @param {Ray} ray 用于检测相交的射线。
   * @param {FrameState} frameState 帧状态。
   * @param {Cartesian3|undefined} [result] 交点或 <code>undefined</code>，如果未找到交点。
   * @returns {Cartesian3|undefined} The 交点或 <code>undefined</code>，如果未找到交点。
   *
   * @private
   */
  pick(ray, frameState, result) {
    if (!this._ready) {
      return undefined;
    }

    let intersection;
    let minDistance = Number.POSITIVE_INFINITY;
    const contents = this._contents;
    const length = contents.length;

    for (let i = 0; i < length; ++i) {
      const candidate = contents[i].pick(ray, frameState, result);

      if (!defined(candidate)) {
        continue;
      }

      const distance = Cartesian3.distance(ray.origin, candidate);
      if (distance < minDistance) {
        intersection = candidate;
        minDistance = distance;
      }
    }

    if (!defined(intersection)) {
      return undefined;
    }

    return result;
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].destroy();
    }
    return destroyObject(this);
  }
}

const sizeOfUint32 = Uint32Array.BYTES_PER_ELEMENT;

export default Composite3DTileContent;
