import { Check, Frozen, defined } from "@cesium/core";
import findMeshoptExtension from "./findMeshoptExtension.js";
import { MeshoptDecoder } from "meshoptimizer";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";

/**
 * 加载 glTF 缓冲区视图。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 */
class GltfBufferViewLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性：
   * @param {ResourceCache} options.resourceCache {@link ResourceCache}（以避免循环依赖）。
   * @param {object} options.gltf glTF JSON 数据。
   * @param {number} options.bufferViewId 缓冲区视图 ID。
   * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
   * @param {Resource} options.baseResource glTF JSON 中路径所指向的 {@link Resource}。
   * @param {string} [options.cacheKey] 资源的缓存键。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const resourceCache = options.resourceCache;
    const gltf = options.gltf;
    const bufferViewId = options.bufferViewId;
    const gltfResource = options.gltfResource;
    const baseResource = options.baseResource;
    const cacheKey = options.cacheKey;

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.func("options.resourceCache", resourceCache);
    Check.typeOf.object("options.gltf", gltf);
    Check.typeOf.number("options.bufferViewId", bufferViewId);
    Check.typeOf.object("options.gltfResource", gltfResource);
    Check.typeOf.object("options.baseResource", baseResource);
    //>>includeEnd('debug');

    const bufferView = gltf.bufferViews[bufferViewId];
    let bufferId = bufferView.buffer;
    let byteOffset = bufferView.byteOffset;
    let byteLength = bufferView.byteLength;

    let hasMeshopt = false;
    let meshoptByteStride;
    let meshoptCount;
    let meshoptMode;
    let meshoptFilter;

    const meshopt = findMeshoptExtension(bufferView);
    if (defined(meshopt)) {
      bufferId = meshopt.buffer;
      byteOffset = meshopt.byteOffset ?? 0;
      byteLength = meshopt.byteLength;

      hasMeshopt = true;
      meshoptByteStride = meshopt.byteStride;
      meshoptCount = meshopt.count;
      meshoptMode = meshopt.mode;
      meshoptFilter = meshopt.filter ?? "NONE";
    }

    const buffer = gltf.buffers[bufferId];

    this._hasMeshopt = hasMeshopt;
    this._meshoptByteStride = meshoptByteStride;
    this._meshoptCount = meshoptCount;
    this._meshoptMode = meshoptMode;
    this._meshoptFilter = meshoptFilter;

    this._resourceCache = resourceCache;
    this._gltfResource = gltfResource;
    this._baseResource = baseResource;
    this._buffer = buffer;
    this._bufferId = bufferId;
    this._byteOffset = byteOffset;
    this._byteLength = byteLength;
    this._cacheKey = cacheKey;
    this._bufferLoader = undefined;
    this._typedArray = undefined;
    this._state = ResourceLoaderState.UNLOADED;
    this._promise = undefined;
  }

  /**
   * 资源的缓存键。
   *
   *
   * @type {string}
   * @readonly
   * @private
   */
  get cacheKey() {
    return this._cacheKey;
  }

  /**
   * 包含缓冲区视图数据的类型数组。
   *
   *
   * @type {Uint8Array}
   * @readonly
   * @private
   */
  get typedArray() {
    return this._typedArray;
  }

  /**
   * 加载资源。
   * @returns {Promise<GltfBufferViewLoader>} A 当资源加载完成时， resolve 为 loader 的 promise。
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
   * 卸载资源。
   * @private
   */
  unload() {
    if (defined(this._bufferLoader) && !this._bufferLoader.isDestroyed()) {
      this._resourceCache.unload(this._bufferLoader);
    }

    this._bufferLoader = undefined;
    this._typedArray = undefined;
  }
}

/**
 * 加载与 loader 相关的资源。
 * @private
 * @param {GltfBufferViewLoader} loader
 * @returns {Promise<GltfBufferViewLoader>}
 */
async function loadResources(loader) {
  try {
    const bufferLoader = getBufferLoader(loader);
    loader._bufferLoader = bufferLoader;
    await bufferLoader.load();

    if (loader.isDestroyed()) {
      return;
    }

    const bufferTypedArray = bufferLoader.typedArray;
    const bufferViewTypedArray = new Uint8Array(
      bufferTypedArray.buffer,
      bufferTypedArray.byteOffset + loader._byteOffset,
      loader._byteLength,
    );

    // Unload the buffer
    loader.unload();

    loader._typedArray = bufferViewTypedArray;
    if (loader._hasMeshopt) {
      const count = loader._meshoptCount;
      const byteStride = loader._meshoptByteStride;
      const result = new Uint8Array(count * byteStride);
      MeshoptDecoder.decodeGltfBuffer(
        result,
        count,
        byteStride,
        loader._typedArray,
        loader._meshoptMode,
        loader._meshoptFilter,
      );
      loader._typedArray = result;
    }

    loader._state = ResourceLoaderState.READY;
    return loader;
  } catch (error) {
    if (loader.isDestroyed()) {
      return;
    }

    loader.unload();
    loader._state = ResourceLoaderState.FAILED;
    const errorMessage = "Failed to load buffer view";
    throw loader.getError(errorMessage, error);
  }
}

/**
 * 获取指定的缓冲区视图 loader 对应的缓冲区 loader。
 * 首先尝试从资源缓存中检索。如果找不到缓冲区 loader，
 * 则创建新的缓冲区 loader 并将其添加到资源缓存中。
 * @private
 * @param {GltfBufferViewLoader} bufferViewLoader loader。
 * @returns {BufferLoader} The 缓冲区 loader。
 */
function getBufferLoader(bufferViewLoader) {
  const resourceCache = bufferViewLoader._resourceCache;
  const buffer = bufferViewLoader._buffer;

  if (defined(buffer.uri)) {
    const baseResource = bufferViewLoader._baseResource;
    const resource = baseResource.getDerivedResource({
      url: buffer.uri,
    });
    return resourceCache.getExternalBufferLoader({
      resource: resource,
    });
  }

  const source = buffer.extras?._pipeline?.source;
  return resourceCache.getEmbeddedBufferLoader({
    parentResource: bufferViewLoader._gltfResource,
    bufferId: bufferViewLoader._bufferId,
    typedArray: source,
  });
}

export default GltfBufferViewLoader;
