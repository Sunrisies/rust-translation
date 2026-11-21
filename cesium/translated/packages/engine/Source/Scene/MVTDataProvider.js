// @ts-check

import { RuntimeError, defined, oneTimeWarning } from "@cesium/core";
import Axis from "./Axis.js";
import Empty3DTileContent from "./Empty3DTileContent.js";
import UrlTemplate3DTilesDataProvider from "./UrlTemplate3DTilesDataProvider.js";
import VectorGltf3DTileContent from "./VectorGltf3DTileContent.js";
import buildVectorGltfFromMVT from "./buildVectorGltfFromMVT.js";
import decodeMVT from "./decodeMVT.js";

/** @import Cesium3DTile from "./Cesium3DTile.js"; */
/** @import Cesium3DTileset from "./Cesium3DTileset.js"; */
/** @import FeatureLayerCollection from "./FeatureLayerCollection.js"; */
/** @import FeatureLayerProvider from "./FeatureLayerProvider.js"; */
/** @import HeightReference from "./HeightReference.js"; */
/** @import { Rectangle } from "@cesium/core"; */
/** @import Resource from "../Core/Resource.js"; */
/** @import Scene from "./Scene.js"; */

/**
 * 一个 Mapbox Vector Tiles (MVT) 数据提供器。加载 .mvt 或 .pbf 瓦片，并在运行时动态转换为 3D Tiles。
 * 在运行时动态转换。
 *
 * <div class="notice">
 * 通常不直接实例化此对象，请使用 {@link MVTDataProvider.fromUrl}。
 * </div>
 *
 * @extends UrlTemplate3DTilesDataProvider
 * @implements {FeatureLayerProvider}
 * @experimental This 该功能尚未最终确定，可能会根据 Cesium 的标准弃用政策进行变更。
 */
class MVTDataProvider extends UrlTemplate3DTilesDataProvider {
  /**
   * 从指定的 URL 模板和选项中创建 MVTDataProvider。
   *
   * @param {Resource|string} url URL 模板，包含 {z}、{x} 和 {y} 占位符。
   * @param {object} [options] 提供器选项。
   * @param {number} [options.minZoom=0] 生成的瓦片集中表示的最小缩放级别。
   * @param {number} [options.maxZoom=14] 生成的瓦片集中表示的最大缩放级别。
   * @param {Rectangle} [options.extent] 以弧度表示的可选地理范围，用于约束生成的瓦片树。
   * @param {string} [options.featureIdProperty] 用作特征 ID 的 MVT 属性名称。
   * @param {HeightReference} [options.heightReference] 将解码后的点、线和多边形平铺到
   * 由 {@link HeightReference.CLAMP_TO_TERRAIN} 指定的表面上；在地球仪上平铺，
   * {@link HeightReference.CLAMP_TO_3D_TILE} 在 3D Tiles 和模型上平铺，以及
   * {@link HeightReference.CLAMP_TO_GROUND} 在两者上均进行平铺。需要 <code>options.scene</code>。
   * @param {Scene} [options.scene] 生成瓦片集的渲染场景，当
   * <code>options.heightReference</code> 为限制值时所需。
   * @returns {Promise<MVTDataProvider>}
   */
  static async fromUrl(url, options) {
    return /** @type {Promise<MVTDataProvider>} */ (
      super.fromUrl(url, options)
    );
  }

  /**
   * 此实例提供的特征层，每个 MVT 源层一个。层在包含其特征的第一个瓦片加载时添加，因此层顺序遵循
   * 瓦片加载顺序；使用 {@link FeatureLayerCollection#getByName} 查找层。
   * tile load order; use {@link FeatureLayerCollection#getByName} to find a layer.
   *
   * @type {FeatureLayerCollection}
   * @readonly
   */
  get featureLayers() {
    return this._tileset._featureLayers;
  }

  /**
   * @returns {object}
   * @protected
   * @ignore
   */
  _createTilesetLoadOptions() {
    return {
      ...super._createTilesetLoadOptions(),
      skipLevelOfDetail: false,
      enablePick: true,
      featureIdLabel: "featureId_0",
      instanceFeatureIdLabel: "instanceFeatureId_0",
    };
  }

  /**
   * @param {Cesium3DTileset} tileset
   * @protected
   * @ignore
   */
  _configureTileset(tileset) {
    tileset._modelUpAxis = Axis.Z;
    tileset._modelForwardAxis = Axis.X;
  }

  /**
   * @returns {object}
   * @protected
   * @ignore
   */
  _createCodec() {
    const featureIdProperty = this._featureIdProperty;
    return {
      contentType: "mvt",
      missingTilePolicy: { statusCodes: [404, 204] },

      /**
       * @param {Cesium3DTileset} tileset
       * @param {Cesium3DTile} tile
       * @param {Resource} resource
       * @param {ArrayBuffer} arrayBuffer
       * @ignore
       */
      createContent: async (tileset, tile, resource, arrayBuffer) => {
        const decodedTile = decodeMVT(arrayBuffer);
        for (const layer of decodedTile.layers) {
          if (layer.features.length > 0) {
            tileset._featureLayers._getOrAddByName(layer.name);
          }
        }
        const tileCoordinates = parseTileCoordinates(
          resource.getUrlComponent(true),
        );
        const glb = buildVectorGltfFromMVT(decodedTile, tileCoordinates, {
          featureIdProperty: featureIdProperty,
        });
        if (!defined(glb)) {
          if (!hasAnyDecodedFeatures(decodedTile)) {
            return new Empty3DTileContent(tileset, tile);
          }
          throw new RuntimeError(
            "Decoded MVT tile did not produce vector glTF content.",
          );
        }
        return VectorGltf3DTileContent.fromGltf(tileset, tile, resource, glb);
      },
    };
  }
}

/**
 * @param {string} url
 * @returns {{tileZ:number, tileX:number, tileY:number}}
 * @ignore
 */
function parseTileCoordinates(url) {
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.[^/?#]+)?(?:[?#]|$)/i);
  if (!match) {
    oneTimeWarning(
      "MVTDataProvider.parseTileCoordinates",
      `MVT tile URL did not match /{z}/{x}/{y} pattern. Falling back to z/x/y = 0/0/0. URL: ${url}`,
    );
    return { tileZ: 0, tileX: 0, tileY: 0 };
  }
  return {
    tileZ: parseInt(match[1], 10),
    tileX: parseInt(match[2], 10),
    tileY: parseInt(match[3], 10),
  };
}

/**
 * @param {{layers:Array<{features:Array<*>}>}} decodedTile
 * @returns {boolean}
 * @ignore
 */
function hasAnyDecodedFeatures(decodedTile) {
  const layers = decodedTile.layers;
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].features.length > 0) {
      return true;
    }
  }
  return false;
}

MVTDataProvider._parseTileCoordinates = parseTileCoordinates;

export default MVTDataProvider;