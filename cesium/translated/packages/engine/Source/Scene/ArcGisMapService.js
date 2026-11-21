import { defined } from "@cesium/core";
import Credit from "../Core/Credit.js";
import Resource from "../Core/Resource.js";

let defaultTokenCredit;
const defaultAccessToken =
  "AAPTaoA7NiSvx84aoJcprWzHHmw..xIe_hcNkysDZUTfjNd9pp5iQxR9iRRn8Lft4KJdstDjimT07VrmT7uYXlMcczLTIkR5DfMP7arSNR2zvpthW8IwvHV2n6qksONukoZztRqk3MXFC2wZmcRAiEAMBCaNBLAKtkAgDqjRpgrGJaQ6jESIkNECgrFFynaiaoikNidyVw6SXJ1mkbbf0ndwJqoh0RRCg82QicoGupO6h6CTX0RLcwfwdxwwPLFNKBL5EoZvfsQzm0HmYziVaAT1_s3VB5Xnn";
/**
 * 访问 ArcGIS 影像瓦片服务的默认选项。
 *
 * 访问 ArcGIS 影像瓦片图层需要一个 ArcGIS 访问令牌。
 * 仅用于测试目的的默认令牌已提供。
 * 要获取访问令牌，请访问 {@link https://developers.arcgis.com} 并创建免费账户。
 * More info can be found in the {@link https://developers.arcgis.com/documentation/mapping-apis-and-services/security/ | ArcGIS developer guide}.
 *
 * @see ArcGisMapServerImageryProvider
 * @namespace ArcGisMapService
 */

const ArcGisMapService = {};
/**
 * 获取或设置默认的 ArcGIS 访问令牌。
 *
 * @type {string}
 */
ArcGisMapService.defaultAccessToken = defaultAccessToken;

/**
 * 获取或设置 ArcGIS World 影像瓦片服务的 URL。
 *
 * @type {string|Resource}
 * @default https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer
 */
ArcGisMapService.defaultWorldImageryServer = new Resource({
  url: "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer",
});

/**
 * 获取或设置 ArcGIS World Hillshade 瓦片服务的 URL。
 *
 * @type {string|Resource}
 * @default https://ibasemaps-api.arcgis.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer
 */
ArcGisMapService.defaultWorldHillshadeServer = new Resource({
  url: "https://ibasemaps-api.arcgis.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer",
});

/**
 * 获取或设置 ArcGIS World Oceans 瓦片服务的 URL。
 *
 * @type {string|Resource}
 * @default https://ibasemaps-api.arcgis.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer
 */
ArcGisMapService.defaultWorldOceanServer = new Resource({
  url: "https://ibasemaps-api.arcgis.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer",
});

/**
 *
 * @param {string} providedKey
 * @return {string|undefined}
 */
ArcGisMapService.getDefaultTokenCredit = function (providedKey) {
  if (providedKey !== defaultAccessToken) {
    return undefined;
  }

  if (!defined(defaultTokenCredit)) {
    const defaultTokenMessage =
      '<b> \
            This application is using a default ArcGIS access token. Please assign <i>Cesium.ArcGisMapService.defaultAccessToken</i> \
            with an API key from your ArcGIS Developer account before using the ArcGIS tile services. \
            You can sign up for a free ArcGIS Developer account at <a href="https://developers.arcgis.com/">https://developers.arcgis.com/</a>.</b>';

    defaultTokenCredit = new Credit(defaultTokenMessage, true);
  }

  return defaultTokenCredit;
};
export default ArcGisMapService;