import { Frozen, defined, oneTimeWarning } from "@cesium/core";
import hasExtension from "./hasExtension.js";
import TileMetadata from "./TileMetadata.js";

/**
 * 检查 tiles 是否包含元数据，该元数据可以存在于其 metadata 字段中（3D Tiles 1.1），也可以存在于 <code>3DTILES_metadata</code> 扩展中。如果存在，则通过相应的类获取 tiles 元数据。
 * 该规则假设在构建任何 tiles 之前，tileset.metadata 已经被创建。
 * 用于查询 tiles 元数据的 tileset。
 * <p>
 * 此规则基于 tileset.metadata 在 tiles 构建前已存在的前提。
 * </p>
 * @function
 *
 * @param {Cesium3DTileset} tileset 用于查询 tiles 元数据的 tileset。
 * @param {object} tileHeader {@link Cesium3DTile} 的 JSON 头部信息。
 * @return {TileMetadata} the tiles 元数据，如果未找到则返回 <code>undefined</code>。
 * @private
 * @experimental This 此功能使用了 3D Tiles 规范中的部分内容，该规范尚未最终定稿，且可能根据 Cesium 的标准弃用政策进行更改。
 */
function findTileMetadata(tileset, tileHeader) {
  const metadataJson = hasExtension(tileHeader, "3DTILES_metadata")
    ? tileHeader.extensions["3DTILES_metadata"]
    : tileHeader.metadata;

  if (!defined(metadataJson)) {
    return undefined;
  }

  if (!defined(tileset.schema)) {
    findTileMetadata._oneTimeWarning(
      "findTileMetadata-missing-root-schema",
      "Could not find a metadata schema for tile metadata. For tilesets that contain external tilesets, make sure the schema is added to the root tileset.json.",
    );
    return undefined;
  }

  const classes = tileset.schema.classes ?? Frozen.EMPTY_OBJECT;
  if (defined(metadataJson.class)) {
    const tileClass = classes[metadataJson.class];
    if (!defined(tileClass)) {
      findTileMetadata._oneTimeWarning(
        `findTileMetadata-missing-class-${metadataJson.class}`,
        `Could not find class "${metadataJson.class}" in the metadata schema; ignoring tile metadata. Classes used by external tilesets must also be defined in the root tileset.json schema.`,
      );
      return undefined;
    }
    return new TileMetadata({
      tile: metadataJson,
      class: tileClass,
    });
  }

  return undefined;
}

// Exposed for testing
findTileMetadata._oneTimeWarning = oneTimeWarning;
export default findTileMetadata;
