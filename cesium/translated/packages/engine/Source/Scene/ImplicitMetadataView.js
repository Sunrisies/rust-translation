import { Check, Frozen } from "@cesium/core";

/**
 * 该类表示由隐式子树拥有的 <code>MetadataTable</code> 中的单个实体。实体通过 entityId 指定。
 * <p>
 * 有关 3D Tiles 的信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}
 * </p>
 *
 * @param {MetadataTable} options.metadataTable 元数据表。
 * @param {MetadataClass} options.class 元数据所遵循的类。
 * @param {number} options.entityId 元数据所属实体的 ID。
 * @param {object} options.propertyTableJson 包含实体属性表的 JSON 数据。
 *
 * @alias ImplicitMetadataView
 * @constructor
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能根据 Cesium 的标准弃用政策发生变化。
 */
function ImplicitMetadataView(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const metadataTable = options.metadataTable;
  const metadataClass = options.class;
  const entityId = options.entityId;
  const propertyTableJson = options.propertyTableJson;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.metadataTable", metadataTable);
  Check.typeOf.object("options.class", metadataClass);
  Check.typeOf.number("options.entityId", entityId);
  Check.typeOf.object("options.propertyTableJson", propertyTableJson);

  //>>includeEnd('debug');

  this._class = metadataClass;
  this._metadataTable = metadataTable;
  this._entityId = entityId;

  this._extensions = propertyTableJson.extensions;
  this._extras = propertyTableJson.extras;
}

Object.defineProperties(ImplicitMetadataView.prototype, {
  /**
   * 属性所遵循的类。
   *
   * @memberof ImplicitMetadataView.prototype
   * @type {MetadataClass}
   * @readonly
   */
  class: {
    get: function () {
      return this._class;
    },
  },

  /**
   * 额外的用户定义属性。
   *
   * @memberof ImplicitMetadataView.prototype
   * @type {object}
   * @readonly
   */
  extras: {
    get: function () {
      return this._extras;
    },
  },

  /**
   * 包含扩展的对象。
   *
   * @memberof ImplicitMetadataView.prototype
   * @type {object}
   * @readonly
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },
});

/**
 * 返回元数据是否包含该属性。
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {boolean} Whether 瓦片具有该属性。
 * @private
 */
ImplicitMetadataView.prototype.hasProperty = function (propertyId) {
  return this._metadataTable.hasProperty(propertyId);
};

/**
 * 返回元数据是否包含具有给定语义的属性。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {boolean} Whether 瓦片具有具有给定语义的属性。
 * @private
 */
ImplicitMetadataView.prototype.hasPropertyBySemantic = function (semantic) {
  return this._metadataTable.hasPropertyBySemantic(semantic);
};

/**
 * 返回元数据表中属性 ID 的数组。
 *
 * @param {string[]} [results] 用于存储结果的数组。
 * @returns {string[]} The 属性 ID。
 * @private
 */
ImplicitMetadataView.prototype.getPropertyIds = function (results) {
  return this._metadataTable.getPropertyIds(results);
};

/**
 * 返回具有给定 ID 的属性的值副本。
 * <p>
 * 如果属性已归一化，则返回归一化后的值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {*} The 属性的值，或如果瓦片没有该属性则为 <code>undefined</code>。
 * @private
 */
ImplicitMetadataView.prototype.getProperty = function (propertyId) {
  return this._metadataTable.getProperty(this._entityId, propertyId);
};

/**
 * 在元数据表中设置具有给定 ID 的属性的值。
 * <p>
 * 如果属性已归一化，则必须向此函数提供归一化后的值。
 * </p>
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果属性已设置，则为 <code>false</code>，否则为 <code>true</code>。
 * @private
 */
ImplicitMetadataView.prototype.setProperty = function (propertyId, value) {
  return this._metadataTable.setProperty(this._entityId, propertyId, value);
};

/**
 * 返回元数据表中具有给定语义的属性的值副本。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {*} The 属性的值，或如果瓦片没有该语义则为 <code>undefined</code>。
 * @private
 */
ImplicitMetadataView.prototype.getPropertyBySemantic = function (semantic) {
  return this._metadataTable.getPropertyBySemantic(this._entityId, semantic);
};

/**
 * 在元数据表中设置具有给定语义的属性的值。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果属性已设置，则为 <code>false</code>，否则为 <code>true</code>。
 * @private
 */

ImplicitMetadataView.prototype.setPropertyBySemantic = function (
  semantic,
  value,
) {
  return this._metadataTable.setPropertyBySemantic(
    this._entityId,
    semantic,
    value,
  );
};

export default ImplicitMetadataView;
