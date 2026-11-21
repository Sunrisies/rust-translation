import { formatError } from "@cesium/core";
import deprecatedCoreExport from "./_deprecatedCoreExport.js";

/**
 * @deprecated formatError 在 CesiumJS 1.146 版本中已被弃用，将在 1.150 版本中移除。
 * 应改用 @cesium/core 中的 Import formatError 错误。
 */
export default deprecatedCoreExport("formatError", formatError);
