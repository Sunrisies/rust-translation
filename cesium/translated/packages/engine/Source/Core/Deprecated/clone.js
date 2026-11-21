import { clone } from "@cesium/core";
import deprecatedCoreExport from "./_deprecatedCoreExport.js";

/**
 * @deprecated clone 在 CesiumJS 1.146 版本中已被弃用，将在 1.150 版本中移除。
 * 应改用 @cesium/core 中的 import clone 方法。
 */
export default deprecatedCoreExport("clone", clone);
