import { defined } from "@cesium/core";

/**
 * 检查 JSON 对象中是否存在特定扩展。此功能可用于
 * 3D Tiles 扩展或 glTF 扩展
 * @param {object} json JSON 对象
 * @param {string} extensionName 扩展的名称，例如 '3DTILES_implicit_tiling'
 * @returns {boolean} True 如果扩展存在
 * @private
 */
function hasExtension(json, extensionName) {
  return (
    defined(json) &&
    defined(json.extensions) &&
    defined(json.extensions[extensionName])
  );
}

export default hasExtension;
