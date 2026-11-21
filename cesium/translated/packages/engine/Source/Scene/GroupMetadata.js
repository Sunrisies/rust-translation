import { Check, Frozen, defined } from "@cesium/core";
import MetadataEntity from "./MetadataEntity.js";

/**
 * 关于一组 {@link Cesium3DTileContent} 的元数据
 * <p>
 * 有关 3D Tiles 的信息，请参见 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.id 该组的 ID。
 * @param {object} options.group 该组的 JSON 对象。
 * @param {MetadataClass} options.class 该组元数据所遵循的类。
 *
 * @alias GroupMetadata
 * @constructor
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会因 Cesium 标准弃用政策而发生变化。
 */
function GroupMetadata(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const id = options.id;
  const group = options.group;
  const metadataClass = options.class;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.group", group);
  Check.typeOf.object("options.class", metadataClass);
  //>>includeEnd('debug');

  const properties = defined(group.properties) ? group.properties : {};

  this._class = metadataClass;
  this._properties = properties;
  this._id = id;
  this._extras = group.extras;
  this._extensions = group.extensions;
}

Object.defineProperties(GroupMetadata.prototype, {
  /**
   * 属性所遵循的类。
   *
   * @memberof GroupMetadata.prototype
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
   * 该组的 ID。
   *
   * @memberof GroupMetadata.prototype
   * @type {string}
   * @readonly
   * @private
   */
  id: {
    get: function () {
      return this._id;
    },
  },

  /**
   * 额外的用户定义属性。
   *
   * @memberof GroupMetadata.prototype
   * @type {*}
   * @readonly
   * @private
   */
  extras: {
    get: function () {
      return this._extras;
    },
  },

  /**
   * 包含扩展的对象。
   *
   * @memberof GroupMetadata.prototype
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
 * 返回该组是否具有此属性。
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {boolean} Whether 该组具有此属性。
 * @private
 */
GroupMetadata.prototype.hasProperty = function (propertyId) {
  return MetadataEntity.hasProperty(propertyId, this._properties, this._class);
};

/**
 * 返回该组是否具有给定语义的属性。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {boolean} Whether 该组具有具有给定语义的属性。
 * @private
 */
GroupMetadata.prototype.hasPropertyBySemantic = function (semantic) {
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
GroupMetadata.prototype.getPropertyIds = function (results) {
  return MetadataEntity.getPropertyIds(this._properties, this._class, results);
};

/**
 * 返回具有给定 ID 的属性的值副本。
 * <p>
 * 如果属性已归一化，则返回归一化后的值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {*} The 属性的值，或者如果组没有此属性则为 <code>undefined</code>。
 * @private
 */
GroupMetadata.prototype.getProperty = function (propertyId) {
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
 * @returns {boolean} <code>true</code> 如果属性已设置，则为 <code>false</code>，否则为其他值。
 * @private
 */
GroupMetadata.prototype.setProperty = function (propertyId, value) {
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
 * @returns {*} The 属性的值，或者如果组没有此语义则为 <code>undefined</code>。
 * @private
 */
GroupMetadata.prototype.getPropertyBySemantic = function (semantic) {
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
 * @returns {boolean} <code>true</code> 如果属性已设置，则为 <code>false</code>，否则为其他值。
 * @private
 */
GroupMetadata.prototype.setPropertyBySemantic = function (semantic, value) {
  return MetadataEntity.setPropertyBySemantic(
    semantic,
    value,
    this._properties,
    this._class,
  );
};

export default GroupMetadata;
