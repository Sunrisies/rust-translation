import {
  Check,
  DeveloperError,
  Frozen,
  addAllToArray,
  defined,
  destroyObject,
} from "@cesium/core";
import JsonMetadataTable from "./JsonMetadataTable.js";

/**
 * 用于 <code>EXT_structural_metadata</code> 扩展或
 * 传统 <code>EXT_feature_metadata</code> glTF 扩展的属性表。它还包含一些
 * 选项，以与 3D Tiles 1.0 批表兼容。
 * <p>
 * 对于批表，属性按以下顺序解析：
 * </p>
 * <ol>
 * <li>来自 options.metadataTable 的二进制属性</li>
 * <li>来自 options.jsonMetadataTable 的 JSON 属性</li>
 * <li>来自 options.batchTableHierarchy 的批表层次结构属性</li>
 * </ol>
 * <p>
 * 请参阅 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension} 以及
 * 之前的 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata|EXT_feature_metadata Extension} glTF 文档。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} [options.name] 用于描述该表的易读名称
 * @param {string|number} [options.id] 用于识别属性表的唯一 ID，有助于调试。对于 <code>EXT_structural_metadata</code>，这是属性表数组中的数组索引；对于 <code>EXT_feature_metadata</code>，这是属性表字典中的字典键。
 * @param {number} options.count 表中特征的数量。
 * @param {MetadataTable} [options.metadataTable] 二进制属性的表格。
 * @param {JsonMetadataTable} [options.jsonMetadataTable] 为了与旧批表兼容，可以传递自由形式的 JSON 属性。
 * @param {BatchTableHierarchy} [options.batchTableHierarchy] 为了与 <code>3DTILES_batch_table_hierarchy</code> 扩展兼容，可以提供层次结构。
 * @param {object} [options.extras] 额外的用户自定义属性
 * @param {object} [options.extensions] 包含扩展的对象
 *
 * @alias PropertyTable
 * @constructor
 *
 * @private
 * @experimental This 功能使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
 */
function PropertyTable(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("options.count", options.count);
  //>>includeEnd('debug');

  this._name = options.name;
  this._id = options.id;
  this._count = options.count;
  this._extras = options.extras;
  this._extensions = options.extensions;
  this._metadataTable = options.metadataTable;
  this._jsonMetadataTable = options.jsonMetadataTable;
  this._batchTableHierarchy = options.batchTableHierarchy;
  this._texture = options.texture; // Property table buffer data packed into a GPU texture
}

Object.defineProperties(PropertyTable.prototype, {
  /**
   * 该表的易读名称
   *
   * @memberof PropertyTable.prototype
   * @type {string}
   * @readonly
   * @private
   */
  name: {
    get: function () {
      return this._name;
    },
  },
  /**
   * 该表的标识符。有助于调试。
   *
   * @memberof PropertyTable.prototype
   * @type {string|number}
   * @readonly
   * @private
   */
  id: {
    get: function () {
      return this._id;
    },
  },
  /**
   * 表中特征的数量。
   *
   * @memberof PropertyTable.prototype
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
   * @memberof PropertyTable.prototype
   * @type {MetadataClass}
   * @readonly
   */
  class: {
    get: function () {
      if (defined(this._metadataTable)) {
        return this._metadataTable.class;
      }

      return undefined;
    },
  },

  /**
   * 存储在该表中的属性。
   *
   * @memberof PropertyTable.prototype
   * @type {Object<string, MetadataTableProperty>}
   * @readonly
   */
  properties: {
    get: function () {
      if (defined(this._metadataTable)) {
        return this._metadataTable.properties;
      }

      return undefined;
    },
  },

  /**
   * 额外的用户自定义属性。
   *
   * @memberof PropertyTable.prototype
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
   * @memberof PropertyTable.prototype
   * @type {object}
   * @readonly
   * @private
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },

  /**
   * 获取内存中存储的二进制元数据总量。这
   * 不包括 JSON 元数据
   *
   * @memberof PropertyTable.prototype
   * @type {number}
   * @readonly
   * @private
   */
  byteLength: {
    get: function () {
      let totalByteLength = 0;
      if (defined(this._metadataTable)) {
        totalByteLength += this._metadataTable.byteLength;
      }

      if (defined(this._batchTableHierarchy)) {
        totalByteLength += this._batchTableHierarchy.byteLength;
      }

      return totalByteLength;
    },
  },

  /**
   * 包含属性表数据的纹理，如果有的话。
   *
   * @memberof PropertyTable.prototype
   * @type {Texture | undefined}
   * @readonly
   * @private
   */
  texture: {
    get: function () {
      return this._texture;
    },
  },
});

/**
 * 返回特征是否具有该属性。为了与 <code>3DTILES_batch_table_hierarchy</code> 扩展兼容，这是针对特定特征计算的。
 *
 * @param {number} index 特征的索引。
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {boolean} Whether 该特性具有此属性。
 * @private
 */
PropertyTable.prototype.hasProperty = function (index, propertyId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  Check.typeOf.string("propertyId", propertyId);
  //>>includeEnd('debug');

  if (
    defined(this._metadataTable) &&
    this._metadataTable.hasProperty(propertyId)
  ) {
    return true;
  }

  if (
    defined(this._batchTableHierarchy) &&
    this._batchTableHierarchy.hasProperty(index, propertyId)
  ) {
    return true;
  }

  if (
    defined(this._jsonMetadataTable) &&
    this._jsonMetadataTable.hasProperty(propertyId)
  ) {
    return true;
  }

  return false;
};

/**
 * 返回该特性是否具有给定语义的属性。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {boolean} Whether 该特性具有给定语义的属性。
 * @private
 */
PropertyTable.prototype.hasPropertyBySemantic = function (index, semantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  if (defined(this._metadataTable)) {
    return this._metadataTable.hasPropertyBySemantic(semantic);
  }

  return false;
};

/**
 * 返回是否有任何特性具有此属性。
 * 这主要用于检查类中是否存在该属性。
 * 在使用 <code>3DTILES_batch_table_hierarchy</code> 扩展时，用于检查层次结构中的属性大小写敏感语义。
 *
 * @param {string} propertyId 属性的大小写敏感标识符。
 * @returns {boolean} Whether 任何特性均具有此属性。
 * @private
 */
PropertyTable.prototype.propertyExists = function (propertyId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  //>>includeEnd('debug');

  if (
    defined(this._metadataTable) &&
    this._metadataTable.hasProperty(propertyId)
  ) {
    return true;
  }

  if (
    defined(this._batchTableHierarchy) &&
    this._batchTableHierarchy.propertyExists(propertyId)
  ) {
    return true;
  }

  if (
    defined(this._jsonMetadataTable) &&
    this._jsonMetadataTable.hasProperty(propertyId)
  ) {
    return true;
  }

  return false;
};

/**
 * 返回是否有任何特性具有给定语义的属性。
 *
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {boolean} Whether 任何特性均具有给定语义的属性。
 * @private
 */
PropertyTable.prototype.propertyExistsBySemantic = function (semantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  if (defined(this._metadataTable)) {
    return this._metadataTable.hasPropertyBySemantic(semantic);
  }

  return false;
};

const scratchResults = [];

/**
 * 返回属性标识符数组。为了与 <code>3DTILES_batch_table_hierarchy</code> 扩展兼容，此数组是针对特定特性计算的。
 *
 * @param {number} index 特性的索引。
 * @param {string[]} [results] 用于存储结果的数组。
 * @returns {string[]} The 属性标识符。
 * @private
 */
PropertyTable.prototype.getPropertyIds = function (index, results) {
  results = defined(results) ? results : [];
  results.length = 0;

  if (defined(this._metadataTable)) {
    // concat in place to avoid unnecessary array allocation
    const ids = this._metadataTable.getPropertyIds(scratchResults);
    addAllToArray(results, ids);
  }

  if (defined(this._batchTableHierarchy)) {
    const ids = this._batchTableHierarchy.getPropertyIds(index, scratchResults);
    addAllToArray(results, ids);
  }

  if (defined(this._jsonMetadataTable)) {
    const ids = this._jsonMetadataTable.getPropertyIds(scratchResults);
    addAllToArray(results, ids);
  }

  return results;
};

/**
 * 返回具有给定标识符的属性的值副本。
 * <p>
 * 如果属性已归一化，则返回归一化后的值。
 * </p>
 *
 * @param {number} index 特性的索引。
 * @param {string} propertyId 属性的大小写敏感标识符。
 * @returns {*} The 属性的值，或如果特性没有此属性则为 <code>undefined</code>。
 * @private
 */
PropertyTable.prototype.getProperty = function (index, propertyId) {
  let result;
  if (defined(this._metadataTable)) {
    result = this._metadataTable.getProperty(index, propertyId);
    if (defined(result)) {
      return result;
    }
  }

  if (defined(this._batchTableHierarchy)) {
    result = this._batchTableHierarchy.getProperty(index, propertyId);
    if (defined(result)) {
      return result;
    }
  }

  if (defined(this._jsonMetadataTable)) {
    result = this._jsonMetadataTable.getProperty(index, propertyId);
    if (defined(result)) {
      return result;
    }
  }

  return undefined;
};

/**
 * 设置具有给定标识符的属性的值。如果该属性不存在，
 * 则将其作为 JSON 元数据属性创建。
 *
 * <p>
 * 如果属性已归一化，则必须向此函数提供归一化后的值。
 * </p>
 *
 * @param {number} index 特性的索引。
 * @param {string} propertyId 属性的大小写敏感标识符。
 * @param {*} value 将被复制的属性的值。
 * @private
 */
PropertyTable.prototype.setProperty = function (index, propertyId, value) {
  if (
    defined(this._metadataTable) &&
    this._metadataTable.setProperty(index, propertyId, value)
  ) {
    return;
  }

  if (
    defined(this._batchTableHierarchy) &&
    this._batchTableHierarchy.setProperty(index, propertyId, value)
  ) {
    return;
  }

  // Ensure we have a table for JSON properties
  if (!defined(this._jsonMetadataTable)) {
    this._jsonMetadataTable = new JsonMetadataTable({
      count: this._count,
      properties: {},
    });
  }

  // JsonMetadataTable will handle creating a new property at runtime.
  this._jsonMetadataTable.setProperty(index, propertyId, value);
};

/**
 * 返回具有给定语义的属性的值副本。
 * <p>
 * 此操作仅针对底层 {@link MetadataTable}（如果存在）进行，
 * 因为 {@link JsonMetadataTable} 和 {@link BatchTableHierarchy} 没有语义。
 * 语义。
 * </p>
 *
 * @param {number} index 特性的索引。
 * @param {string} semantic 属性的大小写敏感语义。
 * @returns {*} The 属性的值，或如果特性没有此语义则为 <code>undefined</code>。
 * @private
 */
PropertyTable.prototype.getPropertyBySemantic = function (index, semantic) {
  if (defined(this._metadataTable)) {
    return this._metadataTable.getPropertyBySemantic(index, semantic);
  }

  return undefined;
};

/**
 * 设置具有给定语义的属性的值。
 * <p>
 * 此操作仅针对底层 {@link MetadataTable}（如果存在）进行，
 * 因为 {@link JsonMetadataTable} 和 {@link BatchTableHierarchy} 没有语义。
 * 语义。
 * </p>
 *
 * @param {number} index 特性的索引。
 * @param {string} semantic 属性的大小写敏感语义。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果设置了该属性，返回 <code>false</code>，否则返回原值。
 * @private
 */
PropertyTable.prototype.setPropertyBySemantic = function (
  index,
  semantic,
  value,
) {
  if (defined(this._metadataTable)) {
    return this._metadataTable.setPropertyBySemantic(index, semantic, value);
  }

  return false;
};

/**
 * 返回一个包含指定属性Id对应值类型的数组。
 * <p>
 * 此操作仅针对底层的 {@link MetadataTable}（如果存在）进行。
 * {@link JsonMetadataTable} 和 {@link BatchTableHierarchy} 不将值存储在类型数组中。
 * 类型数组中不包含值。
 * </p>
 *
 * @param {string} propertyId 属性ID区分大小写。
 * @returns {*} The 包含属性值的类型数组；如果属性值未存储在类型数组中，则返回 <code>undefined</code>。
 *
 * @private
 */
PropertyTable.prototype.getPropertyTypedArray = function (propertyId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  //>>includeEnd('debug');

  if (defined(this._metadataTable)) {
    return this._metadataTable.getPropertyTypedArray(propertyId);
  }

  return undefined;
};

/**
 * 返回一个包含具有给定语义的属性值的类型数组。
 * <p>
 * 此操作仅针对底层的 {@link MetadataTable}（如果存在）进行。
 * {@link JsonMetadataTable} 和 {@link BatchTableHierarchy} 没有语义。
 * 属性的区分大小写的语义。
 * </p>
 *
 * @param {string} semantic 包含属性值的类型数组；如果属性值未存储在类型数组中，则返回 <code>undefined</code>。
 * @returns {*} The 销毁属性表中需要清理的所有资源。
 *
 * @private
 */
PropertyTable.prototype.getPropertyTypedArrayBySemantic = function (semantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  if (defined(this._metadataTable)) {
    return this._metadataTable.getPropertyTypedArrayBySemantic(semantic);
  }

  return undefined;
};

function checkFeatureId(featureId, featuresLength) {
  if (!defined(featureId) || featureId < 0 || featureId >= featuresLength) {
    throw new DeveloperError(
      `featureId is required and must be between zero and featuresLength - 1 (${featuresLength}` -
        +").",
    );
  }
}

PropertyTable.prototype.isClass = function (featureId, className) {
  //>>includeStart('debug', pragmas.debug);
  checkFeatureId(featureId, this.count);
  Check.typeOf.string("className", className);
  //>>includeEnd('debug');

  const hierarchy = this._batchTableHierarchy;
  if (!defined(hierarchy)) {
    return false;
  }

  return hierarchy.isClass(featureId, className);
};

PropertyTable.prototype.isExactClass = function (featureId, className) {
  //>>includeStart('debug', pragmas.debug);
  checkFeatureId(featureId, this.count);
  Check.typeOf.string("className", className);
  //>>includeEnd('debug');

  return this.getExactClassName(featureId) === className;
};

PropertyTable.prototype.getExactClassName = function (featureId) {
  //>>includeStart('debug', pragmas.debug);
  checkFeatureId(featureId, this.count);
  //>>includeEnd('debug');

  const hierarchy = this._batchTableHierarchy;
  if (!defined(hierarchy)) {
    return undefined;
  }

  return hierarchy.getClassName(featureId);
};

/**
 * Destroys any resources that need cleaning up in the property table.
 *
 * @private
 */
PropertyTable.prototype.destroy = function () {
  this._texture = this._texture && this._texture.destroy();
  return destroyObject(this);
};

export default PropertyTable;
