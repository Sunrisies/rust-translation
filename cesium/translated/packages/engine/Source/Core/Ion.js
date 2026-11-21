import { defined } from "@cesium/core";
import Credit from "./Credit.js";
import Resource from "./Resource.js";

let defaultTokenCredit;
const defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IldQb0dGTEdyY2hDejlSMm8iLCJqdGkiOiIxZDlkMWFmZS0wZjY1LTQ2ZGYtOWQ2YS1iNjgxMmZjZTkyM2EiLCJpZCI6MjU5LCJzdWIiOiJDZXNpdW1KUyIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiIxLjE0NyBSZWxlYXNlIC0gRGVsZXRlIG9uIEphbnVhcnkgMSwgMjAyNyIsImlhdCI6MTc5MjkwNTEyM30.doKMneDAmgY-6nOogKo5os5i7_xCI_4J3flZv21Uiv4";
/**
 * 访问 Cesium ion API 的默认设置。
 *
 * 如果您使用任何与 ion 相关的 API，则只需要离子访问令牌。
 * 默认访问令牌仅用于测试用途。
 * 在 {@link https://cesium.com} 注册免费离子账户，获取您的专属访问令牌。
 *
 * @see IonResource
 * @see IonImageryProvider
 * @see IonGeocoderService
 * @see createWorldImagery
 * @see createWorldTerrain
 * @namespace Ion
 */
const Ion = {};

/**
 * 获取或设置默认的 Cesium ion 访问令牌。
 *
 * @type {string}
 */
Ion.defaultAccessToken = defaultAccessToken;

/**
 * 获取或设置默认的 Cesium ion 服务器。
 *
 * @type {string|Resource}
 * @default https://api.cesium.com
 */
Ion.defaultServer = new Resource({ url: "https://api.cesium.com/" });

Ion.getDefaultTokenCredit = function (providedKey) {
  if (providedKey !== defaultAccessToken) {
    return undefined;
  }

  if (!defined(defaultTokenCredit)) {
    const defaultTokenMessage =
      '<b> \
            This application is using Cesium\'s default ion access token. Please assign <i>Cesium.Ion.defaultAccessToken</i> \
            with an access token from your ion account before making any Cesium API calls. \
            You can sign up for a free ion account at <a href="https://cesium.com">https://cesium.com</a>.</b>';

    defaultTokenCredit = new Credit(defaultTokenMessage, true);
  }

  return defaultTokenCredit;
};
export default Ion;
