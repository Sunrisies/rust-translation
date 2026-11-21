import {
  RuntimeError,
  defined,
  getJsonFromTypedArray,
  getMagic,
} from "@cesium/core";
import Cesium3DTileContentType from "./Cesium3DTileContentType.js";
import hasExtension from "./hasExtension.js";

/**
 * `preprocess3DTileContent()` 函数的处理结果。这包括
 * {@link Cesium3DTileContentType} 以及载荷内容。该载荷可能是
 * 根据内容类型分为二进制或 JSON 格式。
 *
 * @typedef {object} PreprocessedContent
 * @property {Cesium3DTileContentType} contentType 内容的类型。
 * @property {Uint8Array} [binaryPayload] 对于二进制文件，载荷以 byteOffset 为 0 的数组形式返回。
 * @property {object} [jsonPayload] 对于 JSON 文件，结果以 JSON 对象的形式返回。
 * @private
 */

/**
 * 对 {@link Cesium3DTileContent} 进行预处理，以确定内容类型
 * 并将 JSON 文件解析为对象。
 *
 * @param {ArrayBuffer} arrayBuffer 原始二进制载荷。
 * @return {PreprocessedContent}
 * @private
 */
function preprocess3DTileContent(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);
  let contentType = getMagic(uint8Array);

  // We use glTF for JSON glTF files. For binary glTF, we rename this
  // to glb to disambiguate
  if (contentType === "glTF") {
    contentType = "glb";
  }

  if (
    contentType === Cesium3DTileContentType.GLTF_BINARY &&
    hasExtension(getGlbJson(uint8Array), "3DTILES_subtree")
  ) {
    contentType = Cesium3DTileContentType.IMPLICIT_SUBTREE_GLB;
  }

  if (Cesium3DTileContentType.isBinaryFormat(contentType)) {
    return {
      // For binary files, the enum value is the magic number
      contentType: contentType,
      binaryPayload: uint8Array,
    };
  }

  const json = getJsonContent(uint8Array);
  if (defined(json.root)) {
    // Most likely a tileset JSON
    return {
      contentType: Cesium3DTileContentType.EXTERNAL_TILESET,
      jsonPayload: json,
    };
  }

  if (defined(json.asset)) {
    // Most likely a glTF. Tileset JSON also has an "asset" property
    // so this check needs to happen second
    if (hasExtension(json, "3DTILES_subtree")) {
      return {
        contentType: Cesium3DTileContentType.IMPLICIT_SUBTREE_GLTF,
        jsonPayload: json,
      };
    }

    return {
      contentType: Cesium3DTileContentType.GLTF,
      jsonPayload: json,
    };
  }

  if (defined(json.tileAvailability)) {
    // Most likely a subtree JSON.
    return {
      contentType: Cesium3DTileContentType.IMPLICIT_SUBTREE_JSON,
      jsonPayload: json,
    };
  }

  if (defined(json.type)) {
    // Most likely a GeoJSON
    return {
      contentType: Cesium3DTileContentType.GEOJSON,
      jsonPayload: json,
    };
  }

  if (defined(json.voxelTable)) {
    // Most likely a voxel JSON
    return {
      contentType: Cesium3DTileContentType.VOXEL_JSON,
      jsonPayload: json,
    };
  }

  throw new RuntimeError("Invalid tile content.");
}

const glbJsonChunkType = 0x4e4f534a;

/**
 * 读取 glb 的 JSON 数据块，该数据块总是第一个数据块。
 *
 * @param {Uint8Array} glb glb 数据。
 * @returns {object|undefined} The 解析后的 JSON 数据块，如果 glb 不以 JSON 数据块开头则返回 <code>undefined</code>。
 * @private
 */
function getGlbJson(glb) {
  const glbHeaderByteLength = 12;
  const chunkHeaderByteLength = 8;
  const jsonByteOffset = glbHeaderByteLength + chunkHeaderByteLength;
  if (glb.byteLength < jsonByteOffset) {
    return undefined;
  }

  const dataView = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonByteLength = dataView.getUint32(glbHeaderByteLength, true);
  const chunkType = dataView.getUint32(glbHeaderByteLength + 4, true);
  if (
    chunkType !== glbJsonChunkType ||
    jsonByteOffset + jsonByteLength > glb.byteLength
  ) {
    return undefined;
  }

  return getJsonContent(glb, jsonByteOffset, jsonByteLength);
}

function getJsonContent(uint8Array, byteOffset, byteLength) {
  let json;

  try {
    json = getJsonFromTypedArray(uint8Array, byteOffset, byteLength);
  } catch (error) {
    throw new RuntimeError("Invalid tile content.");
  }

  return json;
}

export default preprocess3DTileContent;
