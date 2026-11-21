import { createGuid } from "@cesium/core";
import deprecatedCoreExport from "./_deprecatedCoreExport.js";

/**
 * @deprecated createGuid 在 CesiumJS 1.146 版本中已被弃用，将在 1.150 版本中移除。
 * 请改用 @cesium/core 中的 createGuid 函数进行导入。
 */
export default deprecatedCoreExport("createGuid", createGuid);
