/**
 * 用于指示 {@link Cesium3DTileContent} 不同类型的枚举值。
 * 对于二进制文件，枚举值为该二进制文件的魔数。
 * 除非另有说明。对于 JSON 文件，枚举值为唯一名称。
 * 仅供内部使用。
 *
 * @enum {string}
 * @see Cesium3DTileContent
 *
 * @private
 */
const Cesium3DTileContentType = {
  /**
   * 批处理 3D 模型。这是一种具有
   * 魔数 <code>b3dm</code> 的二进制格式。
   *
   * @type {string}
   * @constant
   * @private
   */
  BATCHED_3D_MODEL: "b3dm",
  /**
   * 实例化 3D 模型。这是一种具有魔数
   * <code>i3dm</code>
   *
   * @type {string}
   * @constant
   * @private
   */
  INSTANCED_3D_MODEL: "i3dm",
  /**
   * 复合模型。这是一种具有魔数的二进制格式。
   * <code>cmpt</code>
   *
   * @type {string}
   * @constant
   * @private
   */
  COMPOSITE: "cmpt",
  /**
   * 点云模型。这是一种具有魔数的二进制格式。
   * <code>pnts</code>
   *
   * @type {string}
   * @constant
   * @private
   */
  POINT_CLOUD: "pnts",
  /**
   * 向量瓦片。这是一种具有魔数的二进制格式。
   * <code>vctr</code>
   *
   * @type {string}
   * @constant
   * @private
   */
  VECTOR: "vctr",
  /**
   * 几何瓦片。这是一种具有魔数的二进制格式。
   * <code>geom</code>
   *
   * @type {string}
   * @constant
   * @private
   */
  GEOMETRY: "geom",
  /**
   * 以 JSON + 外部 BIN 形式存在的 glTF 模型。此格式被视为
   * JSON 格式。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿的部分内容，且可能根据 Cesium 标准弃用政策进行变更。
   */
  GLTF: "gltf",
  /**
   * glTF 文件的二进制形式。内部中，魔数从
   * 从 <code>glTF</code> 更改为 <code>glb</code>，以与
   * JSON glTF 格式区分开。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿的部分内容，且可能根据 Cesium 标准弃用政策进行变更。
   */
  GLTF_BINARY: "glb",
  /**
   * 对于隐式瓦片化，可用性位流存储在二进制子树文件中。
   * 魔数为 <code>subt</code>
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿的部分内容，且可能根据 Cesium 标准弃用政策进行变更。
   */
  IMPLICIT_SUBTREE: "subt",
  /**
   * 用于隐式瓦片化。子树也可以以 JSON 文件形式表示。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿的部分内容，且可能根据 Cesium 标准弃用政策进行变更。
   */
  IMPLICIT_SUBTREE_JSON: "subtreeJson",
  /**
   * 用于隐式瓦片化。子树也可以以 glTF JSON 文件形式表示
   * 并带有 <code>3DTILES_subtree</code> 扩展名。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿的部分内容，且可能根据 Cesium 标准弃用政策进行变更。
   */
  IMPLICIT_SUBTREE_GLTF: "subtreeGltf",
  /**
   * 用于隐式瓦片化。子树也可以以二进制 glTF 文件形式表示
   * 并带有 <code>3DTILES_subtree</code> 扩展名。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿的部分内容，且可能根据 Cesium 标准弃用政策进行变更。
   */
  IMPLICIT_SUBTREE_GLB: "subtreeGlb",
  /**
   * 内容可以引用另一个 tileset.json 作为外部瓦片集使用。这是一种基于 JSON 的格式。
   * as an external tileset. This is a JSON-based format.
   *
   * @type {string}
   * @constant
   * @private
   */
  EXTERNAL_TILESET: "externalTileset",
  /**
   * 多种内容与其他内容类型分开处理。
   * 由于请求调度方式的差异所致。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该功能使用了尚未定稿的 3D Tiles 规范部分内容，且可能根据 Cesium 的标准弃用政策发生变化。
   */
  MULTIPLE_CONTENT: "multipleContent",
  /**
   * 用于 <code>MAXAR_content_geojson</code> 扩展的 GeoJSON 内容。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该功能使用了尚未定稿的 3D Tiles 规范部分内容，且可能根据 Cesium 的标准弃用政策发生变化。
   */
  GEOJSON: "geoJson",
  /**
   * 用于 <code>3DTILES_content_voxels</code> 扩展的二进制体素内容。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该功能使用了尚未定稿的 3D Tiles 规范部分内容，且可能根据 Cesium 的标准弃用政策发生变化。
   */
  VOXEL_BINARY: "voxl",
  /**
   * 用于 <code>3DTILES_content_voxels</code> 扩展的二进制体素内容。
   *
   * @type {string}
   * @constant
   * @private
   * @experimental This 该功能使用了尚未定稿的 3D Tiles 规范部分内容，且可能根据 Cesium 的标准弃用政策发生变化。
   */
  VOXEL_JSON: "voxelJson",
};

/**
 * 检查内容是否为支持的二进制格式之一。否则，
 * 调用者可以假设为 JSON 格式。
 * @param {Cesium3DTileContentType} contentType 内容有效载荷的内容类型。
 * @return {boolean} <code>true</code> 如果内容类型为二进制格式，则为 <code>true</code>；如果内容类型为 JSON 格式，则为 <code>false</code>。
 * @private
 */
Cesium3DTileContentType.isBinaryFormat = function (contentType) {
  switch (contentType) {
    case Cesium3DTileContentType.BATCHED_3D_MODEL:
    case Cesium3DTileContentType.INSTANCED_3D_MODEL:
    case Cesium3DTileContentType.COMPOSITE:
    case Cesium3DTileContentType.POINT_CLOUD:
    case Cesium3DTileContentType.VECTOR:
    case Cesium3DTileContentType.GEOMETRY:
    case Cesium3DTileContentType.IMPLICIT_SUBTREE:
    case Cesium3DTileContentType.VOXEL_BINARY:
    case Cesium3DTileContentType.GLTF_BINARY:
    case Cesium3DTileContentType.IMPLICIT_SUBTREE_GLB:
      return true;
    default:
      return false;
  }
};

/**
 * 检查内容是否为隐式平铺使用的子树格式之一。
 * @param {Cesium3DTileContentType} contentType 内容有效载荷的内容类型。
 * @return {boolean} <code>true</code> 如果内容类型为子树格式，则为 <code>true</code>；否则为 <code>false</code>。
 * @private
 */
Cesium3DTileContentType.isSubtree = function (contentType) {
  switch (contentType) {
    case Cesium3DTileContentType.IMPLICIT_SUBTREE:
    case Cesium3DTileContentType.IMPLICIT_SUBTREE_JSON:
    case Cesium3DTileContentType.IMPLICIT_SUBTREE_GLTF:
    case Cesium3DTileContentType.IMPLICIT_SUBTREE_GLB:
      return true;
    default:
      return false;
  }
};

Object.freeze(Cesium3DTileContentType);

export default Cesium3DTileContentType;
