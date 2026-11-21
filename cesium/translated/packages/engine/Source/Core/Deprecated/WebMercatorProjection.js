import { WebMercatorProjection } from "@cesium/core";
import deprecatedCoreExport from "./_deprecatedCoreExport.js";

/**
 * @deprecated WebMercatorProjection 在 CesiumJS 1.146 版本中已被弃用，将在 1.150 版本中移除。
 * 请改用 @cesium/core 中的 WebMercatorProjection 导入方式。
 */
export default deprecatedCoreExport(
  "WebMercatorProjection",
  WebMercatorProjection,
);
