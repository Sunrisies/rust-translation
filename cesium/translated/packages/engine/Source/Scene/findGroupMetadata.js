import { defined } from "@cesium/core";
import hasExtension from "./hasExtension.js";

/**
 * 检查内容是否包含元数据，该元数据可以存在于其元数据字段中（3D Tiles 1.1），也可以存在于 <code>3DTILES_metadata</code> 扩展中。如果存在，请查找具有对应 ID 的组。
 * 用于查询组元数据的瓦片集
 * 用于获取组元数据的 JSON 头部，该头部来自 {@link Cesium3DTileContent}
 *
 * @function
 *
 * @param {Cesium3DTileset} tileset 如果未找到组元数据，则返回 <code>undefined</code>
 * @param {object} contentHeader 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未最终定稿，可能会根据 Cesium 标准弃用政策进行更改。
 * @return {GroupMetadata} the group metadata, or <code>undefined</code> if not found
 * @private
 * @experimental This feature is using part of the 3D Tiles spec that is not final and is subject to change without Cesium's standard deprecation policy.
 */
function findGroupMetadata(tileset, contentHeader) {
  const metadataExtension = tileset.metadataExtension;
  if (!defined(metadataExtension)) {
    return undefined;
  }
  const groups = metadataExtension.groups;

  const group = hasExtension(contentHeader, "3DTILES_metadata")
    ? contentHeader.extensions["3DTILES_metadata"].group
    : contentHeader.group;

  if (typeof group === "number") {
    return groups[group];
  }

  const index = metadataExtension.groupIds.findIndex(function (id) {
    return id === group;
  });

  return index >= 0 ? groups[index] : undefined;
}

export default findGroupMetadata;
