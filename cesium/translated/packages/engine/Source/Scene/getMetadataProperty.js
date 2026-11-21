import { defined } from "@cesium/core";

/**
 * 从给定的 `StructuralMetadata` 中返回 `PropertyTextureProperty`
 * 与给定描述相匹配的。
 *
 * 如果给定的结构元数据为 `undefined`，则返回 `undefined`。
 *
 * 否则，该方法将检查给定的
 * 结构元数据中所有的属性纹理。
 *
 * 如果找到具有与给定名称匹配的 `_id` 的类，并且该类包含给定属性名称的属性，那么
 * 该属性将被返回。
 * 否则，返回 `undefined`
 *
 * Otherwise, `undefined` is returned
 *
 * @param {StructuralMetadata} structuralMetadata 结构元数据
 * @param {string} className 元数据类的名称
 * @param {string} propertyName 元数据属性的名称
 * @returns {PropertyTextureProperty|undefined}
 * @private
 */
function getMetadataProperty(structuralMetadata, className, propertyName) {
  if (!defined(structuralMetadata)) {
    return undefined;
  }
  const propertyTextures = structuralMetadata.propertyTextures;
  for (const propertyTexture of propertyTextures) {
    const metadataClass = propertyTexture.class;
    if (metadataClass.id === className) {
      const properties = propertyTexture.properties;
      const property = properties[propertyName];
      if (defined(property)) {
        return property;
      }
    }
  }
  // Note: This could check for property attributes in a similar
  // way. But since picking arbitrary property attributes via the
  // frame buffer is not supported yet, returning "undefined" here
  // causes the picking to bail out early and safely when no
  // property texture was found.
  // See https://github.com/CesiumGS/cesium/issues/12225
  return undefined;
}

export default getMetadataProperty;
