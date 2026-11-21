import { Check, DeveloperError, defined } from "@cesium/core";

/**
 * 用于从 3D Tiles 1.1 元数据中解析边界体积语义的工具。
 *
 * @namespace BoundingVolumeSemantics
 * @private
 */
const BoundingVolumeSemantics = {};

/**
 * 解析与边界体积相关的语义，例如
 * <code>TILE_BOUNDING_BOX</code> 和 <code>CONTENT_BOUNDING_BOX</code>，这些来自
 * 隐式瓦片或内容元数据。结果以 JSON 对象形式返回，
 * 在转码瓦片时使用（参见 {@link Implicit3DTileContent}）。
 * <p>
 * 边界体积按顺序检查为：矩形框、区域，然后是球体。仅返回
 * 第一个有效的边界体积。
 * </p>
 * <p>
 * 这同时处理瓦片边界体积和内容边界体积，唯一区别是前缀不同。例如 <code>TILE_BOUNDING_BOX</code> 和
 * is the prefix. e.g. <code>TILE_BOUNDING_BOX</code> and
 * <code>CONTENT_BOUNDING_BOX</code> 具有相同的内存布局。
 * </p>
 *
 * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata/Semantics|3D Metadata Semantic Reference} for 各种边界体积以及最小/最大高度。
 *
 * @param {string} prefix “TILE”或“CONTENT”
 * @param {TileMetadata|ContentMetadata} metadata 用于按语义查找值的元数据对象。实际上，这通常是一个 {@link ImplicitMetadataView}
 * @return {object} An 包含边界体积及任何最小或最大高度的对象。
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
 */
BoundingVolumeSemantics.parseAllBoundingVolumeSemantics = function (
  prefix,
  metadata,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("prefix", prefix);
  if (prefix !== "TILE" && prefix !== "CONTENT") {
    throw new DeveloperError("prefix must be either 'TILE' or 'CONTENT'");
  }
  Check.typeOf.object("metadata", metadata);
  //>>includeEnd('debug');

  return {
    boundingVolume: BoundingVolumeSemantics.parseBoundingVolumeSemantic(
      prefix,
      metadata,
    ),
    minimumHeight: BoundingVolumeSemantics._parseMinimumHeight(
      prefix,
      metadata,
    ),
    maximumHeight: BoundingVolumeSemantics._parseMaximumHeight(
      prefix,
      metadata,
    ),
  };
};

/**
 * 从瓦片或内容元数据中解析边界体积。如果元数据
 * 指定多个边界体积，仅返回第一个。边界
 * 体积按顺序检查为：矩形框、区域，然后是球体。
 * <p>
 * 这同时处理瓦片边界体积和内容边界体积，唯一区别是前缀不同。例如 <code>TILE_BOUNDING_BOX</code> 和
 * <code>CONTENT_BOUNDING_BOX</code> 具有相同的内存布局。
 * “TILE”或“CONTENT”
 * </p>
 *
 * @param {string} prefix 用于按语义查找值的元数据
 * @param {TileMetadata|ContentMetadata} metadata 表示瓦片或内容边界体积的 JSON 描述的对象
 * @return {object} An 解析来自瓦片或内容元数据的最小高度。这用于创建
 * @private
 */
BoundingVolumeSemantics.parseBoundingVolumeSemantic = function (
  prefix,
  metadata,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("prefix", prefix);
  if (prefix !== "TILE" && prefix !== "CONTENT") {
    throw new DeveloperError("prefix must be either 'TILE' or 'CONTENT'");
  }
  Check.typeOf.object("metadata", metadata);
  //>>includeEnd('debug');

  const boundingBoxSemantic = `${prefix}_BOUNDING_BOX`;
  const boundingBox = metadata.getPropertyBySemantic(boundingBoxSemantic);

  if (defined(boundingBox)) {
    return {
      box: boundingBox,
    };
  }

  const boundingRegionSemantic = `${prefix}_BOUNDING_REGION`;
  const boundingRegion = metadata.getPropertyBySemantic(boundingRegionSemantic);

  if (defined(boundingRegion)) {
    return {
      region: boundingRegion,
    };
  }

  const boundingSphereSemantic = `${prefix}_BOUNDING_SPHERE`;
  const boundingSphere = metadata.getPropertyBySemantic(boundingSphereSemantic);

  if (defined(boundingSphere)) {
    // ARRAY with 4 elements is automatically converted to a Cartesian4
    return {
      sphere: boundingSphere,
    };
  }

  return undefined;
};

/**
 * 更紧密的四叉树边界以进行隐式瓦片化。这适用于
 * <code>TILE_MINIMUM_HEIGHT</code> 和 <code>CONTENT_MINIMUM_HEIGHT</code>
 * “TILE”或“CONTENT”
 *
 * @param {string} prefix 用于按语义查找值的元数据
 * @param {TileMetadata|ContentMetadata} metadata 最小高度
 * @return {number} The 解析来自瓦片或内容元数据的最大高度。这用于创建
 * @private
 */
BoundingVolumeSemantics._parseMinimumHeight = function (prefix, metadata) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("prefix", prefix);
  if (prefix !== "TILE" && prefix !== "CONTENT") {
    throw new DeveloperError("prefix must be either 'TILE' or 'CONTENT'");
  }
  Check.typeOf.object("metadata", metadata);
  //>>includeEnd('debug');

  const minimumHeightSemantic = `${prefix}_MINIMUM_HEIGHT`;
  return metadata.getPropertyBySemantic(minimumHeightSemantic);
};

/**
 * 更紧密的四叉树边界以进行隐式瓦片化。这适用于
 * <code>TILE_MAXIMUM_HEIGHT</code> 和 <code>CONTENT_MAXIMUM_HEIGHT</code>
 * “TILE”或“CONTENT”
 *
 * @param {string} prefix 用于按语义查找值的元数据
 * @param {TileMetadata|ContentMetadata} metadata 最大高度
 * @return {number} The maximum height
 * @private
 */
BoundingVolumeSemantics._parseMaximumHeight = function (prefix, metadata) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("prefix", prefix);
  if (prefix !== "TILE" && prefix !== "CONTENT") {
    throw new DeveloperError("prefix must be either 'TILE' or 'CONTENT'");
  }
  Check.typeOf.object("metadata", metadata);
  //>>includeEnd('debug');

  const maximumHeightSemantic = `${prefix}_MAXIMUM_HEIGHT`;
  return metadata.getPropertyBySemantic(maximumHeightSemantic);
};

export default BoundingVolumeSemantics;
