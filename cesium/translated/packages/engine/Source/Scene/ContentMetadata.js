import { Check, Frozen } from "@cesium/core";
import MetadataEntity from "./MetadataEntity.js";

/**
 * 关于 3D Tile 内容的元数据。这代表内容元数据 JSON（3D Tiles 1.1）。
 * 或者是在单个 {@link Cesium3DTileContent} 上的 <code>3DTILES_metadata</code> 扩展文件。
 * <p>
 * 有关 3D Tiles 的更多信息，请参见 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.content 要么是内容元数据 JSON（3D Tiles 1.1），要么是附加在内容上的扩展文件 JSON。
 * @param {MetadataClass} options.class 内容元数据所遵循的类。
 *
 * @alias ContentMetadata
 * @constructor
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，这部分内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
 */
function ContentMetadata(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const content = options.content;
  const metadataClass = options.class;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.content", content);
  Check.typeOf.object("options.class", metadataClass);
  //>>includeEnd('debug');

  this._class = metadataClass;
  this._properties = content.properties;
  this._extensions = content.extensions;
  this._extras = content.extras;
}

Object.defineProperties(ContentMetadata.prototype, {
  /**
   * 属性所遵循的类。
   *
   * @memberof ContentMetadata.prototype
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
   * @memberof ContentMetadata.prototype
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
   * @memberof ContentMetadata.prototype
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
 * 返回内容是否具有该属性。
 *
 * @param {string} propertyId 属性的大小写敏感的 ID。
 * @returns {boolean} Whether 内容具有该属性。
 * @private
 */
ContentMetadata.prototype.hasProperty = function (propertyId) {
  return MetadataEntity.hasProperty(propertyId, this._properties, this._class);
};

/**
 * 返回内容是否具有给定语义的属性。
 *
 * @param {string} semantic 属性的大小写敏感的语义。
 * @returns {boolean} Whether 内容具有给定语义的属性。
 * @private
 */
ContentMetadata.prototype.hasPropertyBySemantic = function (semantic) {
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
ContentMetadata.prototype.getPropertyIds = function (results) {
  return MetadataEntity.getPropertyIds(this._properties, this._class, results);
};

/**
 * 返回具有给定 ID 的属性的值副本。
 * <p>
 * 如果属性已归一化，则返回归一化后的值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感的 ID。
 * @returns {*} The 属性的值，或者如果内容没有该属性则为 <code>undefined</code>。
 * @private
 */
ContentMetadata.prototype.getProperty = function (propertyId) {
  return MetadataEntity.getProperty(propertyId, this._properties, this._class);
};

/**
 * 设置具有给定 ID 的属性的值。
 * <p>
 * 如果属性已归一化，则必须向此函数提供归一化后的值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感的 ID。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果属性已被设置，则为 <code>false</code>，否则为其他值。
 * @private
 */
ContentMetadata.prototype.setProperty = function (propertyId, value) {
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
 * @param {string} semantic 属性的大小写敏感的语义。
 * @returns {*} The 属性的值，或者如果内容没有该语义则为 <code>undefined</code>。
 * @private
 */
ContentMetadata.prototype.getPropertyBySemantic = function (semantic) {
  return MetadataEntity.getPropertyBySemantic(
    semantic,
    this._properties,
    this._class,
  );
};

/**
 * 设置具有给定语义的属性的值。
 *
 * @param {string} semantic 属性的大小写敏感的语义。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果属性已被设置，则为 <code>false</code>，否则为其他值。
 * @private
 */
ContentMetadata.prototype.setPropertyBySemantic = function (semantic, value) {
  return MetadataEntity.setPropertyBySemantic(
    semantic,
    value,
    this._properties,
    this._class,
  );
};

export default ContentMetadata;
