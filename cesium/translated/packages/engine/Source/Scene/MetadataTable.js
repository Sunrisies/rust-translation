import { Check, Frozen, clone, defined } from "@cesium/core";
import MetadataEntity from "./MetadataEntity.js";
import MetadataTableProperty from "./MetadataTableProperty.js";

/**
 * 包含实体集合二进制元数据的表格。此表格用于表示批量表的二进制属性，以及 3D Tiles Next 扩展中的二进制元数据。
 * 用于表示批量表的二进制属性，以及 3D Tiles Next 扩展中的二进制元数据。
 * 用于 3D Tiles Next 细节，请参考 3D Tiles 的 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}，以及 glTF 的 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata|EXT_feature_metadata Extension}。
 * <p>
 * For 3D Tiles Next details, see the {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension} for 3D Tiles, as well as the {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata|EXT_feature_metadata Extension} for glTF.
 * </p>
 *
 * @param {object} options 表格中实体的数量。
 * @param {number} options.count 包含属性的字典。
 * @param {object} [options.properties] 属性所遵循的类。
 * @param {MetadataClass} options.class 将属性适配到的类。
 * @param {Object<string, Uint8Array>} [options.bufferViews] 将 bufferView ID 映射到 Uint8Array 对象的对象。
 *
 * @alias MetadataTable
 * @constructor
 *
 * @private
 * @experimental This feature 使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
 */
function MetadataTable(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const count = options.count;
  const metadataClass = options.class;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThan("options.count", count, 0);
  Check.typeOf.object("options.class", metadataClass);
  //>>includeEnd('debug');

  let byteLength = 0;
  const properties = {};
  if (defined(options.properties)) {
    for (const propertyId in options.properties) {
      if (options.properties.hasOwnProperty(propertyId)) {
        const property = new MetadataTableProperty({
          count: count,
          property: options.properties[propertyId],
          classProperty: metadataClass.properties[propertyId],
          bufferViews: options.bufferViews,
        });
        properties[propertyId] = property;
        byteLength += property.byteLength;
      }
    }
  }

  this._count = count;
  this._class = metadataClass;
  this._properties = properties;
  this._byteLength = byteLength;
}

Object.defineProperties(MetadataTable.prototype, {
  /**
   * 表格中实体的数量。
   *
   * @memberof MetadataTable.prototype
   * @type {number}
   * @readonly
   * @private
   */
  count: {
    get: function () {
      return this._count;
    },
  },

  /**
   * 属性所遵循的类。
   *
   * @memberof MetadataTable.prototype
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
   * 此表中使用的所有类型数组的大小。
   *
   * @memberof MetadataTable.prototype
   * @type {number}
   * @readonly
   * @private
   */
  byteLength: {
    get: function () {
      return this._byteLength;
    },
  },

  /**
   * 表格的属性。
   *
   * @memberof MetadataTable.prototype
   * @type {Object<string, MetadataTableProperty>}
   * @readonly
   * @private
   */
  properties: {
    get: function () {
      return this._properties;
    },
  },
});

/**
 * 返回表格是否包含该属性。
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {boolean} Whether 表格是否包含该属性。
 * @private
 */
MetadataTable.prototype.hasProperty = function (propertyId) {
  return MetadataEntity.hasProperty(propertyId, this._properties, this._class);
};

/**
 * 返回表格是否包含具有给定语义的属性。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {boolean} Whether 表格是否包含具有给定语义的属性。
 * @private
 */
MetadataTable.prototype.hasPropertyBySemantic = function (semantic) {
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
MetadataTable.prototype.getPropertyIds = function (results) {
  return MetadataEntity.getPropertyIds(this._properties, this._class, results);
};

/**
 * 返回具有给定 ID 的属性的值副本。
 * <p>
 * 如果属性是枚举，则返回枚举名称。
 * </p>
 * <p>
 * 如果属性已归一化，则返回归一化值。对于有符号整数类型，该值位于[-1.0, 1.0]范围内；对于无符号整数类型，则位于[0.0, 1.0]范围内。
 * 如果属性未归一化且类型为 INT64 或 UINT64，则返回 BigInt。在不支持 BigInt 的平台上，将返回数字。注意，数字仅支持最多 52 位整数精度。大于 2^53 - 1 或小于 -(2^53 - 1) 的值可能在读取时丢失精度。
 * 实体的索引。
 * </p>
 * <p>
 * 属性的大小写敏感 ID。
 * 属性的值，如果实体没有该属性则返回 <code>undefined</code>。
 * 是必需的，且范围在 0 到 count - 1 之间。
 * 设置具有给定 ID 的属性的值。
 * 如果属性是枚举，必须提供枚举名称，而不是...
 * </p>
 *
 * @param {number} index The index of the entity.
 * @param {string} propertyId The case-sensitive ID of the property.
 * @returns {*} The value of the property or <code>undefined</code> if the entity does not have this property.
 *
 * @exception {DeveloperError} index is required and between zero and count - 1
 * @private
 */
MetadataTable.prototype.getProperty = function (index, propertyId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  //>>includeEnd('debug');

  const property = this._properties[propertyId];

  let value;
  if (defined(property)) {
    value = property.get(index);
  } else {
    value = getDefault(this._class, propertyId);
  }

  return value;
};

/**
 * Sets the value of the property with the given ID.
 * <p>
 * If the property is an enum the name of the enum must be provided, not the
 * 整数值。
 * </p>
 * <p>
 * 如果属性已归一化，则必须向此函数提供归一化值。
 * 对于有符号整数类型，值必须在 [-1.0, 1.0] 范围内。
 * 对于无符号整数类型，值必须在 [0.0, 1.0] 范围内。
 * </p>
 * <p>
 * 如果属性未归一化且类型或 componentType 为 INT64 或 UINT64，则可以提供 BigInt。在不支持 BigInt 的平台上，可以提供数字。注意，数字仅支持最多 52 位整数精度。大于 2^53 - 1 或小于 -(2^53 - 1) 的值在设置时可能会丢失精度。
 * 实体索引。
 * 属性的大小写敏感 ID。
 * 将被复制的属性值。
 * 如果属性已设置，则为 <code>false</code>，否则为 <code>true</code>。
 * </p>
 *
 * @param {number} index 实体的索引。
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @param {*} value 将被复制的属性值。
 * @returns {boolean} <code>true</code> 如果属性已设置，则为 <code>false</code>，否则为 <code>true</code>。
 *
 * @exception {DeveloperError} index required，且介于 0 和 count - 1 之间。
 * @exception {DeveloperError} value 类型不匹配。
 * @exception {DeveloperError} value 类型超出范围。
 * @exception {DeveloperError} Array 长度与 componentCount 不匹配。
 * @private
 */
MetadataTable.prototype.setProperty = function (index, propertyId, value) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  //>>includeEnd('debug');

  const property = this._properties[propertyId];
  if (defined(property)) {
    property.set(index, value);
    return true;
  }

  return false;
};

/**
 * 返回具有给定语义的属性值的副本。
 *
 * @param {number} index 实体的索引。
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {*} The 属性的值，如果实体没有该语义则为 <code>undefined</code>。
 *
 * @exception {DeveloperError} index required，且介于 0 和 count - 1 之间。
 * @private
 */
MetadataTable.prototype.getPropertyBySemantic = function (index, semantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  let property;
  const propertiesBySemantic = this._class.propertiesBySemantic;
  if (defined(propertiesBySemantic)) {
    property = propertiesBySemantic[semantic];
  }

  if (defined(property)) {
    return this.getProperty(index, property.id);
  }

  return undefined;
};

/**
 * 设置具有给定语义的属性值。
 *
 * @param {number} index 实体的索引。
 * @param {string} semantic 属性的大小写敏感语义。
 * @param {*} value 将被复制的属性值。
 * @returns {boolean} <code>true</code> 如果属性已设置，则为 <code>false</code>，否则为 <code>true</code>。
 *
 * @exception {DeveloperError} index required，且介于 0 和 count - 1 之间。
 * @exception {DeveloperError} value 类型不匹配。
 * @exception {DeveloperError} value 类型超出范围。
 * @exception {DeveloperError} Array 长度与 componentCount 不匹配。
 * @private
 */
MetadataTable.prototype.setPropertyBySemantic = function (
  index,
  semantic,
  value,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  let property;
  const propertiesBySemantic = this._class.propertiesBySemantic;
  if (defined(propertiesBySemantic)) {
    property = propertiesBySemantic[semantic];
  }

  if (defined(property)) {
    return this.setProperty(index, property.id, value);
  }

  return false;
};

/**
 * 返回包含给定 propertyId 属性值的类型化数组。
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {*} The 包含属性值的类型化数组，如果属性值未存储在类型化数组中则为 <code>undefined</code>。
 *
 * @private
 */
MetadataTable.prototype.getPropertyTypedArray = function (propertyId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  //>>includeEnd('debug');

  const property = this._properties[propertyId];

  if (defined(property)) {
    return property.getTypedArray();
  }

  return undefined;
};

/**
 * 返回包含具有给定语义的属性的属性值的类型化数组。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {*} The 包含属性值的类型化数组，如果属性值未存储在类型化数组中则为 <code>undefined</code>。
 *
 * @private
 */
MetadataTable.prototype.getPropertyTypedArrayBySemantic = function (semantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  let property;
  const propertiesBySemantic = this._class.propertiesBySemantic;
  if (defined(propertiesBySemantic)) {
    property = propertiesBySemantic[semantic];
  }

  if (defined(property)) {
    return this.getPropertyTypedArray(property.id);
  }

  return undefined;
};

function getDefault(classDefinition, propertyId) {
  const classProperties = classDefinition.properties;
  if (!defined(classProperties)) {
    return undefined;
  }

  const classProperty = classProperties[propertyId];
  if (defined(classProperty) && defined(classProperty.default)) {
    let value = classProperty.default;
    if (classProperty.isArray) {
      value = clone(value, true);
    }
    value = classProperty.normalize(value);
    return classProperty.unpackVectorAndMatrixTypes(value);
  }
}

export default MetadataTable;