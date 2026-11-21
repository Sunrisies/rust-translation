import { Check, DeveloperError, clone, defined } from "@cesium/core";
import MetadataEntity from "./MetadataEntity.js";

/**
 * 用于存储自由格式 JSON 元数据的表格，类似于 3D Tiles 批处理表格。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {number} options.count 表格中实体的数量。
 * @param {Object<string, Array>} options.properties 元数据表格的 JSON 表示形式。所有数组必须恰好包含 options.count 个元素。
 *
 * @alias JsonMetadataTable
 * @constructor
 * @private
 */

// An empty class is used because JsonMetadataTable is an older type of metadata table
// that does not have a class definition.
const emptyClass = {};

function JsonMetadataTable(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThan("options.count", options.count, 0);
  Check.typeOf.object("options.properties", options.properties);
  //>>includeEnd('debug');

  this._count = options.count;
  this._properties = clone(options.properties, true);
}

/**
 * 返回表格是否具有该属性。
 *
 * @param {string} propertyId 该属性的区分大小写的 ID。
 * @returns {boolean} Whether 表格具有该属性。
 * @private
 */
JsonMetadataTable.prototype.hasProperty = function (propertyId) {
  return MetadataEntity.hasProperty(propertyId, this._properties, emptyClass);
};

/**
 * 返回一个属性 ID 的数组。
 *
 * @param {string[]} [results] 用于存储结果的数组。
 * @returns {string[]} The 属性 ID。
 * @private
 */
JsonMetadataTable.prototype.getPropertyIds = function (results) {
  return MetadataEntity.getPropertyIds(this._properties, emptyClass, results);
};

/**
 * 返回具有给定 ID 的属性值副本。
 *
 * @param {number} index 实体的索引。
 * @param {string} propertyId 该属性的区分大小写的 ID。
 * @returns {*} The 属性的值，如果实体没有该属性则返回 <code>undefined</code>。
 *
 * @exception {DeveloperError} index 超出范围
 * @private
 */
JsonMetadataTable.prototype.getProperty = function (index, propertyId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  Check.typeOf.string("propertyId", propertyId);

  if (index < 0 || index >= this._count) {
    throw new DeveloperError(`index must be in the range [0, ${this._count})`);
  }
  //>>includeEnd('debug');

  const property = this._properties[propertyId];
  if (defined(property)) {
    return clone(property[index], true);
  }

  return undefined;
};

/**
 * 设置具有给定 ID 的属性值。如果该属性不存在，
 * 则会被创建。
 *
 * @param {number} index 实体的索引。
 * @param {string} propertyId 该属性的区分大小写的 ID。
 * @param {*} value 将被复制的属性值。
 *
 * @exception {DeveloperError} index 超出范围
 * @private
 */
JsonMetadataTable.prototype.setProperty = function (index, propertyId, value) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  Check.typeOf.string("propertyId", propertyId);

  if (index < 0 || index >= this._count) {
    throw new DeveloperError(`index must be in the range [0, ${this._count})`);
  }
  //>>includeEnd('debug');

  let property = this._properties[propertyId];
  if (!defined(property)) {
    // Property does not exist. Create it.
    property = new Array(this._count);
    this._properties[propertyId] = property;
  }

  property[index] = clone(value, true);
};

export default JsonMetadataTable;
