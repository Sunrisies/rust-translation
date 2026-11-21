import { defined } from "@cesium/core";

/**
 * 返回 meshopt 压缩扩展对象 KHR_meshopt_compression 或
 * EXT_meshopt_compression，位于 glTF bufferView 或 buffer 中。如果同时存在这两种情况，
 * 建议优先使用 KHR。
 * @param {object} gltfObject 一个 glTF bufferView 或 buffer。
 * @returns {object|undefined} The meshopt 扩展对象，或未定义。
 * @private
 */
function findMeshoptExtension(gltfObject) {
  const extensions = gltfObject?.extensions;
  if (!defined(extensions)) {
    return undefined;
  }

  return (
    extensions["KHR_meshopt_compression"] ??
    extensions["EXT_meshopt_compression"]
  );
}

export default findMeshoptExtension;
