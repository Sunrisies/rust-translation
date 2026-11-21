import { Check, DeveloperError, RuntimeError, defined } from "@cesium/core";
import Cesium3DTileset from "./Cesium3DTileset.js";
import Resource from "../Core/Resource.js";
import ITwinPlatform from "../Core/ITwinPlatform.js";
import KmlDataSource from "../DataSources/KmlDataSource.js";
import GeoJsonDataSource from "../DataSources/GeoJsonDataSource.js";

/**
 * 将 iTwin 平台数据加载到 CesiumJS 中的方法
 *
 * @experimental This 此功能尚未定稿，可能根据 Cesium 的标准弃用政策进行变更。
 *
 * @see ITwinPlatform
 * @namespace ITwinData
 */
const ITwinData = {};

/**
 * 使用 iTwin 的 Mesh Export API 为给定的 iModel id 创建 {@link Cesium3DTileset}。
 *
 * 如果给定的 iModel id 没有可用的完成导出数据，返回的 promise 将解析为 <code>undefined</code>。
 * 建议等待 10-20 秒后再次尝试加载 tileset。
 * 如果所有导出数据均无效，将会抛出错误。
 *
 * 有关请求参数的更多信息，请参阅 {@link https://developer.bentley.com/apis/mesh-export/overview/|iTwin Platform Mesh Export API documentation}。
 *
 * @example
 * const tileset = await Cesium.ITwinData.createTilesetFromIModelId({ iModelId });
 * if (Cesium.defined(tileset)) {
 * viewer.scene.primitives.add(tileset);
 * }
 *
 * @experimental This 此功能尚未定稿，可能根据 Cesium 的标准弃用政策进行变更。
 *
 * @param {object} options
 * @param {string} options.iModelId 要加载的 iModel 的 ID
 * @param {Cesium3DTileset.ConstructorOptions} [options.tilesetOptions] 包含传递给内部创建的 {@link Cesium3DTileset} 选项的对象。
 * @param {string} [options.changesetId] 要加载的更改集的 ID，若未提供则使用最新更改集
 * @returns {Promise<Cesium3DTileset | undefined>} A 将解析为创建的 3D tileset 的 promise，如果给定的 iModel id 没有完成导出数据则解析为 <code>undefined</code>
 *
 * @throws {RuntimeError} If 给定 iModel 的所有导出数据均无效
 * @throws {RuntimeError} If iTwin API 请求失败
 */
ITwinData.createTilesetFromIModelId = async function ({
  iModelId,
  changesetId,
  tilesetOptions,
}) {
  const { exports } = await ITwinPlatform.getExports(iModelId, changesetId);

  if (
    exports.length > 0 &&
    exports.every((exportObj) => {
      return exportObj.status === ITwinPlatform.ExportStatus.Invalid;
    })
  ) {
    throw new RuntimeError(
      `All exports for this iModel are Invalid: ${iModelId}`,
    );
  }

  const completeExport = exports.find((exportObj) => {
    return exportObj.status === ITwinPlatform.ExportStatus.Complete;
  });

  if (!defined(completeExport)) {
    return;
  }

  // Convert the link to the tileset url while preserving the search paramaters
  // This link is only valid 1 hour
  const baseUrl = new URL(completeExport._links.mesh.href);
  baseUrl.pathname = `${baseUrl.pathname}/tileset.json`;
  const tilesetUrl = baseUrl.toString();

  const resource = new Resource({
    url: tilesetUrl,
  });

  return Cesium3DTileset.fromUrl(resource, tilesetOptions);
};

/**
 * 为指定的现实数据 ID 创建 tileset。此函数仅适用于
 * 3D Tiles 网格和点云。
 *
 * 如果未提供 <code>type</code> 或 <code>rootDocument</code>，此函数将
 * 首先请求指定现实数据的完整元数据以填充这些值。
 *
 * 生成的 tileset 的 <code>maximumScreenSpaceError</code> 默认设为 4，
 * 除非通过给定的 tileset 选项明确覆盖。
 *
 * @experimental This 此功能尚未定稿，可能根据 Cesium 的标准弃用政策进行变更。
 *
 * @param {object} options
 * @param {string} options.iTwinId 要加载数据的 iTwin 的 ID
 * @param {string} options.realityDataId 要加载的现实数据的 ID
 * @param {ITwinPlatform.RealityDataType} [options.type] 此现实数据的类型
 * @param {string} [options.rootDocument] 此现实数据根文档的路径
 * @param {Cesium3DTileset.ConstructorOptions} [options.tilesetOptions] 包含
 * 传递给内部创建的 {@link Cesium3DTileset} 选项的对象。
 * @returns {Promise<Cesium3DTileset>}
 *
 * @throws {RuntimeError} if 此函数不支持现实数据的类型
 */
ITwinData.createTilesetForRealityDataId = async function ({
  iTwinId,
  realityDataId,
  type,
  rootDocument,
  tilesetOptions,
}) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("iTwinId", iTwinId);
  Check.typeOf.string("realityDataId", realityDataId);
  if (defined(type)) {
    Check.typeOf.string("type", type);
  }
  if (defined(rootDocument)) {
    Check.typeOf.string("rootDocument", rootDocument);
  }
  //>>includeEnd('debug');

  if (!defined(type) || !defined(rootDocument)) {
    const metadata = await ITwinPlatform.getRealityDataMetadata(
      iTwinId,
      realityDataId,
    );
    rootDocument = metadata.rootDocument;
    type = metadata.type;
  }

  const supportedRealityDataTypes = [
    ITwinPlatform.RealityDataType.Cesium3DTiles,
    ITwinPlatform.RealityDataType.PNTS,
    ITwinPlatform.RealityDataType.RealityMesh3DTiles,
    ITwinPlatform.RealityDataType.Terrain3DTiles,
    ITwinPlatform.RealityDataType.GaussianSplat3DTiles,
  ];

  if (!supportedRealityDataTypes.includes(type)) {
    throw new RuntimeError(`Reality data type is not a mesh type: ${type}`);
  }

  const tilesetAccessUrl = await ITwinPlatform.getRealityDataURL(
    iTwinId,
    realityDataId,
    rootDocument,
  );

  // The maximum screen space error was defined to default to 4 for
  // reality data tilesets, because they did not show the expected
  // amount of detail with the default value of 16. Values that are
  // given in the tilesetOptions should still override that default.
  const internalTilesetOptions = {
    maximumScreenSpaceError: 4,
    ...tilesetOptions,
  };

  return Cesium3DTileset.fromUrl(tilesetAccessUrl, internalTilesetOptions);
};

/**
 * 为指定的现实数据 ID 创建正确类型的数据源。
 * 此函数仅适用于 KML 和 GeoJSON 类型数据。
 *
 * 如果未提供 <code>type</code> 或 <code>rootDocument</code>，此函数将
 * 首先请求指定现实数据的完整元数据以填充这些值。
 *
 * @param {object} options
 * @param {string} options.iTwinId 用于加载数据的 iTwin 的 id
 * @param {string} options.realityDataId 用于加载的现实数据的 id
 * @param {ITwinPlatform.RealityDataType} [options.type] 此现实数据的类型
 * @param {string} [options.rootDocument] 此现实数据的根文档路径
 * @returns {Promise<GeoJsonDataSource | KmlDataSource>}
 *
 * @throws {RuntimeError} if 此函数不支持现实数据的类型
 */
ITwinData.createDataSourceForRealityDataId = async function ({
  iTwinId,
  realityDataId,
  type,
  rootDocument,
}) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("iTwinId", iTwinId);
  Check.typeOf.string("realityDataId", realityDataId);
  if (defined(type)) {
    Check.typeOf.string("type", type);
  }
  if (defined(rootDocument)) {
    Check.typeOf.string("rootDocument", rootDocument);
  }
  //>>includeEnd('debug');

  if (!defined(type) || !defined(rootDocument)) {
    const metadata = await ITwinPlatform.getRealityDataMetadata(
      iTwinId,
      realityDataId,
    );
    rootDocument = metadata.rootDocument;
    type = metadata.type;
  }

  const supportedRealityDataTypes = [
    ITwinPlatform.RealityDataType.KML,
    ITwinPlatform.RealityDataType.GeoJSON,
  ];

  if (!supportedRealityDataTypes.includes(type)) {
    throw new RuntimeError(
      `Reality data type is not a data source type: ${type}`,
    );
  }

  const tilesetAccessUrl = await ITwinPlatform.getRealityDataURL(
    iTwinId,
    realityDataId,
    rootDocument,
  );

  if (type === ITwinPlatform.RealityDataType.GeoJSON) {
    return GeoJsonDataSource.load(tilesetAccessUrl);
  }

  // If we get here it's guaranteed to be a KML type
  return KmlDataSource.load(tilesetAccessUrl);
};

/**
 * 将 Geospatial Features API 中的数据以 GeoJSON 格式加载。
 *
 * @param {object} options
 * @param {string} options.iTwinId 用于加载数据的 iTwin 的 id
 * @param {string} options.collectionId 用于加载的数据集的 id
 * @param {number} [options.limit=10000] 每页项数，必须在 1 到 10,000 之间（包含边界值）
 * @returns {Promise<GeoJsonDataSource>}
 */
ITwinData.loadGeospatialFeatures = async function ({
  iTwinId,
  collectionId,
  limit,
}) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("iTwinId", iTwinId);
  Check.typeOf.string("collectionId", collectionId);
  if (defined(limit)) {
    Check.typeOf.number("limit", limit);
    Check.typeOf.number.lessThanOrEquals("limit", limit, 10000);
    Check.typeOf.number.greaterThanOrEquals("limit", limit, 1);
  }
  if (
    !defined(ITwinPlatform.defaultAccessToken) &&
    !defined(ITwinPlatform.defaultShareKey)
  ) {
    throw new DeveloperError(
      "Must set ITwinPlatform.defaultAccessToken or ITwinPlatform.defaultShareKey first",
    );
  }
  //>>includeEnd('debug');

  const pageLimit = limit ?? 10000;

  const tilesetUrl = `${ITwinPlatform.apiEndpoint}geospatial-features/itwins/${iTwinId}/ogc/collections/${collectionId}/items`;

  const resource = new Resource({
    url: tilesetUrl,
    headers: {
      Authorization: ITwinPlatform._getAuthorizationHeader(),
      Accept: "application/vnd.bentley.itwin-platform.v1+json",
    },
    queryParameters: {
      limit: pageLimit,
      client: "CesiumJS",
    },
  });

  return GeoJsonDataSource.load(resource);
};

export default ITwinData;
