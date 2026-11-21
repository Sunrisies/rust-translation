import { Check, Frozen, defined } from "@cesium/core";
import MetadataEntity from "./MetadataEntity.js";

/**
 * 关于隐式子树的元数据。
 * <p>
 * 有关 3D Tiles 的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.subtreeMetadata 子树元数据 JSON 对象。
 * @param {MetadataClass} options.class 子树元数据所遵循的类。
 *
 * @alias ImplicitSubtreeMetadata
 * @constructor
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会因 Cesium 标准弃用政策而发生变化。
 */
function ImplicitSubtreeMetadata(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const subtreeMetadata = options.subtreeMetadata;
  const metadataClass = options.class;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.subtreeMetadata", subtreeMetadata);
  Check.typeOf.object("options.class", metadataClass);
  //>>includeEnd('debug');

  const properties = defined(subtreeMetadata.properties)
    ? subtreeMetadata.properties
    : {};

  this._class = metadataClass;
  this._properties = properties;
  this._extras = subtreeMetadata.extras;
  this._extensions = subtreeMetadata.extensions;
}

Object.defineProperties(ImplicitSubtreeMetadata.prototype, {
  /**
   * 属性所遵循的类。
   *
   * @memberof ImplicitSubtreeMetadata.prototype
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
   * @memberof ImplicitSubtreeMetadata.prototype
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
   * 包含扩展的对象。
   *
   * @memberof ImplicitSubtreeMetadata.prototype
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
 * 返回子树是否具有该属性。
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {boolean} Whether 子树具有该属性。
 * @private
 */
ImplicitSubtreeMetadata.prototype.hasProperty = function (propertyId) {
  return MetadataEntity.hasProperty(propertyId, this._properties, this._class);
};

/**
 * 返回子树是否具有给定语义的属性。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {boolean} Whether 子树具有给定语义的属性。
 * @private
 */
ImplicitSubtreeMetadata.prototype.hasPropertyBySemantic = function (semantic) {
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
ImplicitSubtreeMetadata.prototype.getPropertyIds = function (results) {
  return MetadataEntity.getPropertyIds(this._properties, this._class, results);
};

/**
 * 返回具有给定 ID 的属性的值副本。
 * <p>
 * 如果属性已归一化，则返回归一化值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {*} The 属性的值，或者如果子树没有该属性则为 <code>undefined</code>。
 * @private
 */
ImplicitSubtreeMetadata.prototype.getProperty = function (propertyId) {
  return MetadataEntity.getProperty(propertyId, this._properties, this._class);
};

/**
 * 设置具有给定 ID 的属性的值。
 * <p>
 * 如果属性已归一化，则必须向此函数提供归一化值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果设置了该属性，则为 <code>false</code>，否则为 <code>true</code>。
 * @private
 */
ImplicitSubtreeMetadata.prototype.setProperty = function (propertyId, value) {
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
 * @returns {*} The 属性的值，或者如果子树没有该语义则为 <code>undefined</code>。
 * @private
 */
ImplicitSubtreeMetadata.prototype.getPropertyBySemantic = function (semantic) {
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
 * @returns {boolean} <code>true</code> 如果设置了该属性，则为 <code>false</code>，否则为 <code>true</code>。
 * @private
 */
ImplicitSubtreeMetadata.prototype.setPropertyBySemantic = function (
  semantic,
  value,
) {
  return MetadataEntity.setPropertyBySemantic(
    semantic,
    value,
    this._properties,
    this._class,
  );
};

export default ImplicitSubtreeMetadata;
