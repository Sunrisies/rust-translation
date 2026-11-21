import { defined } from "@cesium/core";

/**
 * 从给定模式中返回 `MetadataClassProperty`，该模式需满足
 * 给定的描述。
 *
 * 如果给定模式为 `undefined`，则返回 `undefined`。
 * 如果给定的 `schemaId` 已定义，但不符合给定模式的 ID，
 * 则返回 `undefined`。
 * 如果给定模式没有名为该名的类，
 * 或者该类没有名为该名的属性，
 * 则返回 `undefined`。
 *
 * 否则，返回 `MetadataClassProperty`。
 *
 * @param {object} schema 模式对象
 * @param {string|undefined} schemaId 元数据模式的 ID
 * @param {string} className 元数据类的名称
 * @param {string} propertyName 元数据属性的名称
 * @returns {MetadataClassProperty|undefined}
 * @private
 */
function getMetadataClassProperty(schema, schemaId, className, propertyName) {
  if (!defined(schema)) {
    return undefined;
  }
  if (defined(schemaId) && schema.id !== schemaId) {
    return undefined;
  }
  const classes = schema.classes || {};
  const metadataClass = classes[className];
  if (!defined(metadataClass)) {
    return undefined;
  }
  const properties = metadataClass.properties || {};
  const metadataProperty = properties[propertyName];
  if (!defined(metadataProperty)) {
    return undefined;
  }
  return metadataProperty;
}

export default getMetadataClassProperty;
