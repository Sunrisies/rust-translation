import { Check, Frozen, RuntimeError, defined } from "@cesium/core";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";
import { loadSpz } from "@spz-loader/core";

// Cumulative number of SH coefficient floats per splat per channel for each
// degree. Degree 0 has no extra SH data (base color is stored separately in
// the "colors" attribute). Degrees 1-3 follow the standard SH basis count:
// l=1 adds 3 bands × 3 channels = 9; l=2 adds 5 × 3 = 15 (total 24);
// l=3 adds 7 × 3 = 21 (total 45).
const SH_FLOATS_PER_SPLAT_BY_DEGREE = [0, 9, 24, 45];

// Non-SH attribute floats per splat: position(3) + scale(3) + rotation(4)
// + opacity(1) + color(3) = 14.
const BASE_FLOATS_PER_SPLAT = 14;

// The spz-loader WASM module is compiled with a signed 32-bit address space,
// giving a hard ceiling of 2 GB. An additional factor of ~2× is required
// because spz-loader copies every decoded C++ vector into a JavaScript
// TypedArray. 1.6 GB is used as a conservative pre-flight threshold.
const WASM_MEMORY_LIMIT_BYTES = 1.6 * 1024 * 1024 * 1024;

// glTF attribute semantics whose values are produced by SPZ decompression.
// This must stay in sync with the SPZ routing in GltfVertexBufferLoader. Opacity
// is not listed separately: it is carried in COLOR_0's alpha channel. Spherical
// harmonics attributes use the SH_DEGREE_* naming and are matched in
// isSpzSemantic below.
const spzProvidedSemantics = new Set([
  "POSITION",
  "KHR_gaussian_splatting:SCALE",
  "_SCALE",
  "KHR_gaussian_splatting:ROTATION",
  "_ROTATION",
  "COLOR_0",
]);

/**
 * 返回指定的 glTF 属性语义是否属于由 SPZ 解压缩提供的类型。
 * （参见 SPZ 路由机制）。这是 SPZ 提供的语义集的唯一权威来源，因此加载器门和顶点缓冲区路由不会偏离。
 * {@link GltfVertexBufferLoader}）。这是 SPZ 提供的语义集的单一来源，以确保一致性。
 * 因此，加载器门和顶点缓冲区路由不会偏离。
 * 该 glTF 属性语义，例如“位置”。
 *
 * @param {string} gltfSemantic 如果 SPZ 解码提供此语义。
 * @returns {boolean} <code>true</code> 从 glTF JSON 中获取 SPZ 原始图元的点数及最大球谐级数，而无需修改压缩后的二进制数据。
 * @private
 */
function isSpzSemantic(gltfSemantic) {
  if (!defined(gltfSemantic)) {
    return false;
  }
  return (
    spzProvidedSemantics.has(gltfSemantic) ||
    gltfSemantic.includes("SH_DEGREE_")
  );
}

/**
 * 通过读取 POSITION 中的 <code>count</code> 字段和 <code>shDegree</code> 来推导。
 * 该原始图元中存在的最高编号的 <code>SH_DEGREE_n</code> 属性值。如果所需信息不可用，则返回 <code>undefined</code>。
 * <p>
 * glTF JSON 对象。
 * glTF 原始图元对象。
 * 估计解码 SPZ 文件时达到的峰值内存消耗（以字节为单位）。该估计考虑了 WASM 堆的分配以及 spz-loader 产生的 JavaScript TypedArray 副本。
 * 高斯模糊点的数量。
 * 球谐级数（0–3）。
 * 字节数。
 * </p>
 * @param {object} gltf 从 glTF 中加载 SPZ 缓冲区。
 * @param {object} primitive 实现 {@link ResourceLoader} 接口。
 * @returns {{ numPoints: number, shDegree: number }|undefined}
 * @private
 */
function getSpzInfoFromGltf(gltf, primitive) {
  const attributes = primitive?.attributes;
  if (!defined(attributes)) {
    return undefined;
  }

  const positionAccessorId = attributes["POSITION"];
  if (!defined(positionAccessorId)) {
    return undefined;
  }
  const accessor = gltf?.accessors?.[positionAccessorId];
  if (!defined(accessor) || accessor.count <= 0) {
    return undefined;
  }

  let shDegree = 0;
  for (const semantic in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, semantic)) {
      const match = /SH_DEGREE_(\d+)_COEF_/.exec(semantic);
      if (match) {
        shDegree = Math.max(shDegree, parseInt(match[1], 10));
      }
    }
  }

  return { numPoints: accessor.count, shDegree };
}

/**
 * 包含以下属性的对象：
 * {@link ResourceCache}（以避免循环依赖）。
 * glTF JSON。
 * @param {number} numPoints 包含 SPZ 扩展的原始图元对象。
 * @param {number} shDegree SPZ 扩展对象。
 * @returns {number} Estimated 包含 glTF 的 {@link Resource}。
 * @private
 */
function estimateSpzMemoryBytes(numPoints, shDegree) {
  const floatsPerPoint =
    BASE_FLOATS_PER_SPLAT + (SH_FLOATS_PER_SPLAT_BY_DEGREE[shDegree] ?? 0);
  // ×2 accounts for WASM heap + JS TypedArray mirror.
  return numPoints * floatsPerPoint * Float32Array.BYTES_PER_ELEMENT * 2;
}

/**
 * 在 glTF JSON 中路径相对的对象。
 * <p>
 * Implements the {@link ResourceLoader} interface.
 * </p>
 *
 * @private
 */
class GltfSpzLoader extends ResourceLoader {
  /**
   * @param {object} options 资源的缓存键。
   * @param {ResourceCache} options.resourceCache The {@link ResourceCache} (to avoid circular dependencies).
   * @param {object} options.gltf 加载 SPZ 资源。
   * @param {object} options.primitive 当 SPZ 被加载时， resolve 的 promise 会返回该资源。
   * @param {object} options.spz 处理 SPZ 资源。
   * @param {Resource} options.gltfResource The {@link Resource} containing the glTF.
   * @param {Resource} options.baseResource The {@link Resource} that paths in the glTF JSON are relative to.
   * @param {string} [options.cacheKey] The cache key of the resource.
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const resourceCache = options.resourceCache;
    const gltf = options.gltf;
    const primitive = options.primitive;
    const spz = options.spz;
    const gltfResource = options.gltfResource;
    const baseResource = options.baseResource;
    const cacheKey = options.cacheKey;

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.func("options.resourceCache", resourceCache);
    Check.typeOf.object("options.gltf", gltf);
    Check.typeOf.object("options.primitive", primitive);
    Check.typeOf.object("options.spz", spz);
    Check.typeOf.object("options.gltfResource", gltfResource);
    Check.typeOf.object("options.baseResource", baseResource);
    //>>includeEnd('debug');

    this._resourceCache = resourceCache;
    this._gltfResource = gltfResource;
    this._baseResource = baseResource;
    this._gltf = gltf;
    this._primitive = primitive;
    this._spz = spz;
    this._cacheKey = cacheKey;
    this._bufferViewLoader = undefined;
    this._bufferViewTypedArray = undefined;
    this._decodePromise = undefined;
    this._decodedData = undefined;
    this._state = ResourceLoaderState.UNLOADED;
    this._promise = undefined;
    this._spzError = undefined;
  }

  /**
   * The cache key of the resource.
   * @type {string}
   * @readonly
   * @private
   */
  get cacheKey() {
    return this._cacheKey;
  }

  /**
   * The decoded SPZ data.
   * @type {object}
   * @readonly
   * @private
   */
  get decodedData() {
    return this._decodedData;
  }

  /**
   * Loads the SPZ resource.
   * @returns {Promise<Resource>} A promise that resolves to the resource when the SPZ is loaded.
   * @private
   */
  async load() {
    if (defined(this._promise)) {
      return this._promise;
    }

    this._state = ResourceLoaderState.LOADING;
    this._promise = loadResources(this);
    return this._promise;
  }

  /**
   * Processes the SPZ resource.
   * @param {FrameState} frameState The frame state.
   * @private
   */
  process(frameState) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("frameState", frameState);
    //>>includeEnd('debug');

    if (this._state === ResourceLoaderState.READY) {
      return true;
    }

    if (this._state !== ResourceLoaderState.PROCESSING) {
      return false;
    }

    if (defined(this._spzError)) {
      handleError(this, this._spzError);
    }

    if (!defined(this._bufferViewTypedArray)) {
      return false;
    }

    if (defined(this._decodePromise)) {
      return false;
    }

    // Reject oversized SPZ payloads before invoking the WASM decoder.
    // The spz-loader WASM module has a hard 2 GB memory ceiling; exceeding
    // it causes an unrecoverable Aborted() call with no useful diagnostic.
    // See: https://github.com/CesiumGS/cesium/issues/13283
    //
    // The SPZ binary is gzip-compressed, so its header cannot be read
    // directly. Point count and SH degree are therefore derived from the
    // glTF JSON, which is available at this stage.
    const spzInfo = getSpzInfoFromGltf(this._gltf, this._primitive);
    if (defined(spzInfo)) {
      const estimatedBytes = estimateSpzMemoryBytes(
        spzInfo.numPoints,
        spzInfo.shDegree,
      );
      if (estimatedBytes > WASM_MEMORY_LIMIT_BYTES) {
        const estimatedMB = Math.round(estimatedBytes / (1024 * 1024));
        handleError(
          this,
          new RuntimeError(
            `SPZ data too large to decode: ${spzInfo.numPoints.toLocaleString()} splats ` +
              `with spherical harmonics degree ${spzInfo.shDegree} would require ` +
              `approximately ${estimatedMB} MB, which exceeds the WASM memory limit. ` +
              `Consider using a lower spherical harmonics degree or splitting the ` +
              `dataset into smaller tiles.`,
          ),
        );
        return false;
      }
    }

    const decodePromise = loadSpz(this._bufferViewTypedArray, {
      unpackOptions: { coordinateSystem: "UNSPECIFIED" },
    });

    if (!defined(decodePromise)) {
      return false;
    }

    this._decodePromise = processDecode(this, decodePromise);
  }

  /**
   * Unloads the SPZ resource and frees associated resources.
   * @private
   */
  unload() {
    if (defined(this._bufferViewLoader)) {
      this._resourceCache.unload(this._bufferViewLoader);
    }

    this._bufferViewLoader = undefined;
    this._bufferViewTypedArray = undefined;
    this._decodedData = undefined;
    this._gltf = undefined;
    this._primitive = undefined;
  }
}

async function loadResources(loader) {
  const resourceCache = loader._resourceCache;
  try {
    const bufferViewLoader = resourceCache.getBufferViewLoader({
      gltf: loader._gltf,
      bufferViewId: loader._spz.bufferView,
      gltfResource: loader._gltfResource,
      baseResource: loader._baseResource,
    });
    loader._bufferViewLoader = bufferViewLoader;
    await bufferViewLoader.load();

    if (loader.isDestroyed()) {
      return;
    }

    loader._bufferViewTypedArray = bufferViewLoader.typedArray;
    loader._state = ResourceLoaderState.PROCESSING;
    return loader;
  } catch (error) {
    if (loader.isDestroyed()) {
      return;
    }

    handleError(loader, error);
  }
}

function handleError(spzLoader, error) {
  spzLoader.unload();
  spzLoader._state = ResourceLoaderState.FAILED;
  const errorMessage = "Failed to load SPZ";
  throw spzLoader.getError(errorMessage, error);
}

async function processDecode(loader, decodePromise) {
  try {
    const gcloud = await decodePromise;
    if (loader.isDestroyed()) {
      return;
    }

    loader.unload();

    loader._decodedData = {
      gcloud: gcloud,
    };
    loader._state = ResourceLoaderState.READY;
    return loader._baseResource;
  } catch (error) {
    if (loader.isDestroyed()) {
      return;
    }

    loader._spzError = error;
  }
}

export { estimateSpzMemoryBytes, getSpzInfoFromGltf, isSpzSemantic };
export default GltfSpzLoader;