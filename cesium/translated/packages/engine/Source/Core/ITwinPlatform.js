import { Check, DeveloperError, RuntimeError, defined } from "@cesium/core";
import Resource from "./Resource.js";

/**
 * 访问 iTwin 平台的默认设置。
 *
 * @experimental This 该功能尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 *
 * @see ITwinData
 * @namespace ITwinPlatform
 */
const ITwinPlatform = {};

/**
 * 网格导出文件的状态状态。
 * 有效值包括：<code>NotStarted</code>、<code>InProgress</code>、<code>Complete</code>、<code>Invalid</code>
 * @enum {string}
 */
ITwinPlatform.ExportStatus = {
  NotStarted: "NotStarted",
  InProgress: "InProgress",
  Complete: "Complete",
  Invalid: "Invalid",
};

Object.freeze(ITwinPlatform.ExportStatus);

/**
 * 网格导出文件的类型。CesiumJS 仅支持加载 <code>3DTILES</code> 类型的文件。
 * 有效值包括：<code>IMODEL</code>、<code>CESIUM</code>、<code>3DTILES</code>
 * @enum {string}
 */
ITwinPlatform.ExportType = {
  IMODEL: "IMODEL",
  CESIUM: "CESIUM",
  "3DTILES": "3DTILES",
};

Object.freeze(ITwinPlatform.ExportType);

/**
 * 现实数据的类型。这是我们已知可以支持的类型的一部分列表。
 *
 * @see https://developer.bentley.com/apis/reality-management/rm-rd-details/#types
 * @enum {string}
 */
ITwinPlatform.RealityDataType = {
  Cesium3DTiles: "Cesium3DTiles",
  PNTS: "PNTS",
  RealityMesh3DTiles: "RealityMesh3DTiles",
  Terrain3DTiles: "Terrain3DTiles",
  GaussianSplat3DTiles: "GS_3DT",
  KML: "KML",
  GeoJSON: "GeoJSON",
  Unstructured: "Unstructured",
};

Object.freeze(ITwinPlatform.RealityDataType);

/**
 * 获取或设置默认的 iTwin 访问令牌。该令牌应具有 <code>itwin-platform</code> 范围。
 *
 * 如果定义了 {@link ITwinPlatform.defaultShareKey}，则该值将被忽略。
 *
 * @experimental This 该功能尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 *
 * @type {string|undefined}
 */
ITwinPlatform.defaultAccessToken = undefined;

/**
 * 获取或设置默认的 iTwin 共享密钥。如果提供此值，则会在所有请求中覆盖 {@link ITwinPlatform.defaultAccessToken}。
 *
 * 共享密钥可以通过 iTwin Shares API 生成。
 * https://developer.bentley.com/apis/access-control-v2/operations/create-itwin-share/
 *
 * @experimental This 该功能尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 *
 * @type {string|undefined}
 */
ITwinPlatform.defaultShareKey = undefined;

/**
 * 根据设置的密钥/令牌创建必要的授权头。
 * 如果设置了 {@link ITwinPlatform.defaultShareKey}，则优先使用，并且
 * 无论是否设置了 {@link ITwinPlatform.defaultAccessToken}，都将使用该值。
 * @private
 * @returns {string} full 基本/Bearer 方法的认证头。
 */
ITwinPlatform._getAuthorizationHeader = function () {
  //>>includeStart('debug', pragmas.debug);
  if (
    !defined(ITwinPlatform.defaultAccessToken) &&
    !defined(ITwinPlatform.defaultShareKey)
  ) {
    throw new DeveloperError(
      "Must set ITwinPlatform.defaultAccessToken or ITwinPlatform.defaultShareKey first",
    );
  }
  //>>includeEnd('debug');

  if (defined(ITwinPlatform.defaultShareKey)) {
    return `Basic ${ITwinPlatform.defaultShareKey}`;
  }
  return `Bearer ${ITwinPlatform.defaultAccessToken}`;
};

/**
 * 获取或设置默认的 iTwin API 端点。
 *
 * @experimental This 该功能尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 *
 * @type {string|Resource}
 * @default "https://api.bentley.com"
 */
ITwinPlatform.apiEndpoint = new Resource({
  url: "https://api.bentley.com",
});

/**
 * @typedef {object} ExportRequest
 * @private
 * @property {string} iModelId
 * @property {string} changesetId
 * @property {ITwinPlatform.ExportType} exportType 导出的类型。CesiumJS 仅支持 3DTILES 类型。
 */

/**
 * @typedef {object} Link
 * @private
 * @property {string} href
 */

/**
 * @typedef {object} ExportRepresentation
 * 使用 return=representation 时，从 get-exports 获取导出对象。
 * @private
 * @property {string} id 导出 ID。
 * @property {string} displayName iModel 的名称。
 * @property {ITwinPlatform.ExportStatus} status 此导出的状态。
 * @property {string} lastModified
 * @property {ExportRequest} request 包含关于导出本身信息的对象。
 * @property {{mesh: Link}} 链接对象，包含相关链接。对于导出文件，包括网格本身的访问 URL。
 */

/**
 * @typedef {object} GetExportsResponse
 * @private
 * @property {ExportRepresentation[]} exports 当前页面上的导出列表。
 * @property {{self: Link, next: Link | undefined, prev: Link | undefined}} 链接分页链接。
 */

/**
 * 获取指定 iModel 在其最新版本下的导出列表。
 * 这将仅返回前 5 个导出文件，且 {@link ITwinPlatform.ExportType} 为 <code>3DTILES</code>。
 *
 * @private
 *
 * @param {string} iModelId iModel 编号。
 * @param {string} [changesetId] 用于筛选结果的变更集 ID。如果未提供，则将返回来自最新可用变更集的导出文件。
 * @returns {Promise<GetExportsResponse>}
 *
 * @throws {RuntimeError} If iTwin API 请求失败
 */
ITwinPlatform.getExports = async function (iModelId, changesetId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("iModelId", iModelId);
  if (defined(changesetId)) {
    Check.typeOf.string("changesetId", changesetId);
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

  const resource = new Resource({
    url: `${ITwinPlatform.apiEndpoint}mesh-export`,
    headers: {
      Authorization: ITwinPlatform._getAuthorizationHeader(),
      Accept: "application/vnd.bentley.itwin-platform.v1+json",
      Prefer: "return=representation",
    },
    queryParameters: {
      iModelId: iModelId,
      exportType: ITwinPlatform.ExportType["3DTILES"],
      // With the export auto-generation it will auto-delete the 6th export so
      // there should never be more than 5 results. Just request them all and parse
      // for ones that are COMPLETE
      $top: "5",
      client: "CesiumJS",
    },
  });
  /* global CESIUM_VERSION */
  if (typeof CESIUM_VERSION !== "undefined") {
    resource.appendQueryParameters({ clientVersion: CESIUM_VERSION });
  }
  if (defined(changesetId) && changesetId !== "") {
    resource.appendQueryParameters({ changesetId: changesetId });
  }

  try {
    const response = await resource.fetchJson();
    return response;
  } catch (error) {
    const result = JSON.parse(error.response);
    if (error.statusCode === 401) {
      const code = result.error.details?.[0].code ?? "";
      throw new RuntimeError(
        `Unauthorized, bad token, wrong scopes or headers bad. ${code}`,
      );
    } else if (error.statusCode === 403) {
      console.error(result.error.code, result.error.message);
      throw new RuntimeError("Not allowed, forbidden");
    } else if (error.statusCode === 422) {
      throw new RuntimeError(
        `Unprocessable Entity:${result.error.code} ${result.error.message}`,
      );
    } else if (error.statusCode === 429) {
      throw new RuntimeError("Too many requests");
    }
    throw new RuntimeError(`Unknown request failure ${error.statusCode}`);
  }
};

/**
 * @typedef {object} RealityDataExtent
 * @private
 * @property {{latitude: number, longitude: number}} 西南
 * @property {{latitude: number, longitude: number}} 东北
 */

/**
 * @typedef {object} RealityDataRepresentation
 * @private
 * @property {string} id "95d8dccd-d89e-4287-bb5f-3219acbc71ae",
 * @property {string} displayName "现实数据名称",
 * @property {string} dataset "数据集",
 * @property {string} group "73d09423-28c3-4fdb-ab4a-03a47a5b04f8",
 * @property {string} description "现实数据的描述",
 * @property {string} rootDocument "Directory/SubDirectory/realityData.3mx",
 * @property {number} size 6521212,
 * @property {string} classification "模型",
 * @property {ITwinPlatform.RealityDataType} type "3MX",
 * @property {{startDateTime: string, endDateTime: string, acquirer: string}} 采集
 * @property {RealityDataExtent} extent
 * @property {boolean} authoring false,
 * @property {string} dataCenterLocation "北欧",
 * @property {string} modifiedDateTime "2021-04-09T19:03:12Z",
 * @property {string} lastAccessedDateTime "2021-04-09T00:00:00Z",
 * @property {string} createdDateTime "2021-02-22T20:03:40Z",
 * @property {string} ownerId "f1d49cc7-f9b3-494f-9c67-563ea5597063",
 */

/**
 * 加载给定 iTwin 标识符和现实数据标识符的完整元数据。
 *
 * @private
 *
 * @param {string} iTwinId 用于加载数据的 iTwin 标识符
 * @param {string} realityDataId 用于加载的现实数据标识符
 * @returns {Promise<RealityDataRepresentation>}
 */
ITwinPlatform.getRealityDataMetadata = async function (iTwinId, realityDataId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("iTwinId", iTwinId);
  Check.typeOf.string("realityDataId", realityDataId);
  if (
    !defined(ITwinPlatform.defaultAccessToken) &&
    !defined(ITwinPlatform.defaultShareKey)
  ) {
    throw new DeveloperError(
      "Must set ITwinPlatform.defaultAccessToken or ITwinPlatform.defaultShareKey first",
    );
  }
  //>>includeEnd('debug');

  const resource = new Resource({
    url: `${ITwinPlatform.apiEndpoint}reality-management/reality-data/${realityDataId}`,
    headers: {
      Authorization: ITwinPlatform._getAuthorizationHeader(),
      Accept: "application/vnd.bentley.itwin-platform.v1+json",
    },
    queryParameters: { iTwinId: iTwinId },
  });

  try {
    const response = await resource.fetchJson();
    return response.realityData;
  } catch (error) {
    const result = JSON.parse(error.response);
    if (error.statusCode === 401) {
      const code = result.error.details?.[0].code ?? "";
      throw new RuntimeError(
        `Unauthorized, bad token, wrong scopes or headers bad. ${code}`,
      );
    } else if (error.statusCode === 403) {
      console.error(result.error.code, result.error.message);
      throw new RuntimeError("Not allowed, forbidden");
    } else if (error.statusCode === 404) {
      throw new RuntimeError(
        `Reality data not found: ${iTwinId}, ${realityDataId}`,
      );
    } else if (error.statusCode === 422) {
      throw new RuntimeError(
        `Unprocessable Entity:${result.error.code} ${result.error.message}`,
      );
    } else if (error.statusCode === 429) {
      throw new RuntimeError("Too many requests");
    }
    throw new RuntimeError(`Unknown request failure ${error.statusCode}`);
  }
};

/**
 * 请求给定 iTwin 标识符、现实数据标识符和根文档的访问 URL。
 * 可通过 <code>return=representation</code> 从列表中获取根文档，
 * 或通过 {@link ITwinPlatform.getRealityDataMetadata} 的元数据接口获取。
 *
 * @private
 *
 * @param {string} iTwinId 用于加载数据的 iTwin 标识符
 * @param {string} realityDataId 用于加载的现实数据标识符
 * @param {string} rootDocument 此现实数据的根文档路径
 * @returns {Promise<string>}
 */
ITwinPlatform.getRealityDataURL = async function (
  iTwinId,
  realityDataId,
  rootDocument,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("iTwinId", iTwinId);
  Check.typeOf.string("realityDataId", realityDataId);
  Check.typeOf.string("rootDocument", rootDocument);
  if (
    !defined(ITwinPlatform.defaultAccessToken) &&
    !defined(ITwinPlatform.defaultShareKey)
  ) {
    throw new DeveloperError(
      "Must set ITwinPlatform.defaultAccessToken or ITwinPlatform.defaultShareKey first",
    );
  }
  //>>includeEnd('debug');

  const resource = new Resource({
    url: `${ITwinPlatform.apiEndpoint}reality-management/reality-data/${realityDataId}/readaccess`,
    headers: {
      Authorization: ITwinPlatform._getAuthorizationHeader(),
      Accept: "application/vnd.bentley.itwin-platform.v1+json",
    },
    queryParameters: { iTwinId: iTwinId },
  });

  try {
    const result = await resource.fetchJson();

    const containerUrl = result._links.containerUrl.href;
    const tilesetUrl = new URL(containerUrl);
    tilesetUrl.pathname = `${tilesetUrl.pathname}/${rootDocument}`;

    return tilesetUrl.toString();
  } catch (error) {
    const result = JSON.parse(error.response);
    if (error.statusCode === 401) {
      const code = result.error.details?.[0].code ?? "";
      throw new RuntimeError(
        `Unauthorized, bad token, wrong scopes or headers bad. ${code}`,
      );
    } else if (error.statusCode === 403) {
      console.error(result.error.code, result.error.message);
      throw new RuntimeError("Not allowed, forbidden");
    } else if (error.statusCode === 404) {
      throw new RuntimeError(
        `Reality data not found: ${iTwinId}, ${realityDataId}`,
      );
    } else if (error.statusCode === 422) {
      throw new RuntimeError(
        `Unprocessable Entity:${result.error.code} ${result.error.message}`,
      );
    } else if (error.statusCode === 429) {
      throw new RuntimeError("Too many requests");
    }
    throw new RuntimeError(`Unknown request failure ${error.statusCode}`);
  }
};

export default ITwinPlatform;
