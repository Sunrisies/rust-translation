import { Frozen, defined, oneTimeWarning } from "@cesium/core";
import ContentMetadata from "./ContentMetadata.js";
import hasExtension from "./hasExtension.js";

/**
 * 检查内容是否包含元数据，该元数据可以存在于其元数据字段中（3D Tiles 1.1）或
 * <code>3DTILES_metadata</code> 扩展中。如果存在，则获取对应类的内容元数据。
 * 。
 *
 * @function
 *
 * @param {Cesium3DTileset} tileset 用于查询内容元数据的瓦片集。
 * @param {object} contentHeader 用于 {@link Cesium3DTileContent} 的 JSON 头部。
 * @return {ContentMetadata} the 内容元数据，若未找到则返回 <code>undefined</code>。
 * @private
 * @experimental This 该特性使用了尚未最终定稿的 3D Tiles 规范部分内容，且可能根据 Cesium 的标准弃用政策发生变化。
 */
function findContentMetadata(tileset, contentHeader) {
  const metadataJson = hasExtension(contentHeader, "3DTILES_metadata")
    ? contentHeader.extensions["3DTILES_metadata"]
    : contentHeader.metadata;

  if (!defined(metadataJson)) {
    return undefined;
  }

  if (!defined(tileset.schema)) {
    findContentMetadata._oneTimeWarning(
      "findContentMetadata-missing-root-schema",
      "Could not find a metadata schema for content metadata. For tilesets that contain external tilesets, make sure the schema is added to the root tileset.json.",
    );
    return undefined;
  }

  const classes = tileset.schema.classes ?? Frozen.EMPTY_OBJECT;
  if (defined(metadataJson.class)) {
    const contentClass = classes[metadataJson.class];
    if (!defined(contentClass)) {
      findContentMetadata._oneTimeWarning(
        `findContentMetadata-missing-class-${metadataJson.class}`,
        `Could not find class "${metadataJson.class}" in the metadata schema; ignoring content metadata. Classes used by external tilesets must also be defined in the root tileset.json schema.`,
      );
      return undefined;
    }
    return new ContentMetadata({
      content: metadataJson,
      class: contentClass,
    });
  }

  return undefined;
}

// Exposed for testing
findContentMetadata._oneTimeWarning = oneTimeWarning;
export default findContentMetadata;
