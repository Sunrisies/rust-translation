import { Check, DeveloperError } from "@cesium/core";

/**
 * 用于区分 {@link Model} 不同用途的枚举类型
 * 包括独立的 glTF 模型以及多种 3D Tiles 格式
 * （包括通过 <code>3DTILES_content_gltf</code> 的 glTF 格式）
 *
 * @enum {string}
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中尚未最终定稿且可能随 Cesium 标准弃用政策而变更的部分内容
 */
const ModelType = {
  /**
   * 独立的 glTF 模型
   * <p>
   * 请勿与 {@link ModelType.TILE_GLTF} 混淆
   * 该类型适用于 3D Tiles
   * </p>
   *
   * @type {string}
   * @constant
   */
  GLTF: "GLTF",
  /**
   * 作为 3D Tileset 中瓦片内容的 glTF 模型，通过
   * <code>3DTILES_content_gltf</code> 实现
   * <p>
   * 请勿与 {@link ModelType.GLTF} 混淆
   * 该类型适用于独立模型
   * </p>
   *
   * @type {string}
   * @constant
   */
  TILE_GLTF: "TILE_GLTF",
  /**
   * 3D Tiles 1.0 批处理 3D 模型
   *
   * @type {string}
   * @constant
   */
  TILE_B3DM: "B3DM",
  /**
   * 3D Tiles 1.0 实例化 3D 模型
   *
   * @type {string}
   * @constant
   */
  TILE_I3DM: "I3DM",
  /**
   * 3D Tiles 1.0 点云
   *
   * @type {string}
   * @constant
   */
  TILE_PNTS: "PNTS",

  /**
   * <code>MAXAR_content_geojson</code> 扩展中的 GeoJSON 内容
   *
   * @type {string}
   * @constant
   */
  TILE_GEOJSON: "TILE_GEOJSON",
};

/**
 * 检查模型是否用于 3D Tiles
 * @param {ModelType} modelType 模型的类型
 * @returns {boolean} <code>true</code> 如果模型为 3D Tiles 格式，则为 <code>false</code>，否则为 true
 */
ModelType.is3DTiles = function (modelType) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("modelType", modelType);
  //>>includeEnd('debug');

  switch (modelType) {
    case ModelType.TILE_GLTF:
    case ModelType.TILE_B3DM:
    case ModelType.TILE_I3DM:
    case ModelType.TILE_PNTS:
    case ModelType.TILE_GEOJSON:
      return true;
    case ModelType.GLTF:
      return false;
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError("modelType is not a valid value.");
    //>>includeEnd('debug');
  }
};

Object.freeze(ModelType);

export default ModelType;
