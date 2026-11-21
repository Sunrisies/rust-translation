import { Check, Frozen } from "@cesium/core";
import MetadataEntity from "./MetadataEntity.js";

/**
 * 关于 3D Tile 的元数据。这代表 3D Tiles 1.1 的 tile metadata JSON。
 * 或者单个 {@link Cesium3DTile} 上的 <code>3DTILES_metadata</code> 扩展文件。
 * <p>
 * 有关 3D Tiles 的更多信息，请参见 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.tile 要么是 tile metadata JSON (3D Tiles 1.1)，要么是附加在 tile 上的扩展文件 JSON。
 * @param {MetadataClass} options.class tile metadata 所遵循的类。
 *
 * @alias TileMetadata
 * @constructor
 * @private
 * @experimental This feature 是 3D Tiles 规范中尚未最终定稿的部分，可能会根据 Cesium 的标准弃用政策进行更改。
 */
function TileMetadata(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const tile = options.tile;
  const metadataClass = options.class;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.tile", tile);
  Check.typeOf.object("options.class", metadataClass);
  //>>includeEnd('debug');

  this._class = metadataClass;
  this._properties = tile.properties;
  this._extensions = tile.extensions;
  this._extras = tile.extras;
}

Object.defineProperties(TileMetadata.prototype, {
  /**
   * 属性所遵循的类。
   *
   * @memberof TileMetadata.prototype
   * @type {MetadataClass}
   * @readonly
   * @private
   */
  class: {
    get: function () {
      return this._class;
    },
  },

  /**
   * 额外的用户自定义属性。
   *
   * @memberof TileMetadata.prototype
   * @type {object}
   * @readonly
   * @private
   */
  extras: {
    get: function () {
      return this._extras;
    },
  },

  /**
   * 包含扩展文件的对象。
   *
   * @memberof TileMetadata.prototype
   * @type {object}
   * @readonly
   * @private
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },
});

/**
 * 返回该 tile 是否具有此属性。
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {boolean} Whether tile 是否具有此属性。
 * @private
 */
TileMetadata.prototype.hasProperty = function (propertyId) {
  return MetadataEntity.hasProperty(propertyId, this._properties, this._class);
};

/**
 * 返回 tile 是否具有给定语义的属性。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {boolean} Whether tile 是否具有给定语义的属性。
 * @private
 */
TileMetadata.prototype.hasPropertyBySemantic = function (semantic) {
  return MetadataEntity.hasPropertyBySemantic(
    semantic,
    this._properties,
    this._class,
  );
};

/**
 * 返回属性 ID 的数组。
 *
 * @param {string[]} [results] 用于存储结果的数组。
 * @returns {string[]} The 属性 ID。
 * @private
 */
TileMetadata.prototype.getPropertyIds = function (results) {
  return MetadataEntity.getPropertyIds(this._properties, this._class, results);
};

/**
 * 返回具有给定 ID 的属性的值副本。
 * <p>
 * 如果属性已归一化，则返回归一化后的值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {*} The 属性的值，或者如果 tile 没有此属性则为 <code>undefined</code>。
 * @private
 */
TileMetadata.prototype.getProperty = function (propertyId) {
  return MetadataEntity.getProperty(propertyId, this._properties, this._class);
};

/**
 * 设置具有给定 ID 的属性的值。
 * <p>
 * 如果属性已归一化，则必须向此函数提供归一化后的值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果属性已设置，则为 <code>false</code>，否则为 true。
 * @private
 */
TileMetadata.prototype.setProperty = function (propertyId, value) {
  return MetadataEntity.setProperty(
    propertyId,
    value,
    this._properties,
    this._class,
  );
};

/**
 * 返回具有给定语义的属性的值副本。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {*} The 属性的值，或者如果 tile 没有此语义则为 <code>undefined</code>。
 * @private
 */
TileMetadata.prototype.getPropertyBySemantic = function (semantic) {
  return MetadataEntity.getPropertyBySemantic(
    semantic,
    this._properties,
    this._class,
  );
};

/**
 * 设置具有给定语义的属性的值。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果属性已设置，则为 <code>false</code>，否则为 true。
 * @private
 */
TileMetadata.prototype.setPropertyBySemantic = function (semantic, value) {
  return MetadataEntity.setPropertyBySemantic(
    semantic,
    value,
    this._properties,
    this._class,
  );
};

export default TileMetadata;
