import { DeveloperError, Frozen, defined } from "@cesium/core";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";

/**
 * 加载嵌入或外部缓冲区。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 */
class BufferLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性的对象：
   * @param {Uint8Array} [options.typedArray] 包含嵌入缓冲区内容的类型数组。与 options.resource 互斥。
   * @param {Resource} [options.resource] 指向外部缓冲区的 {@link Resource}。与 options.typedArray 互斥。
   * @param {string} [options.cacheKey] 资源的缓存键。
   *
   * @exception {DeveloperError} One 必须定义 options.typedArray 和 options.resource。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const typedArray = options.typedArray;
    const resource = options.resource;
    const cacheKey = options.cacheKey;

    //>>includeStart('debug', pragmas.debug);
    if (defined(typedArray) === defined(resource)) {
      throw new DeveloperError(
        "One of options.typedArray and options.resource must be defined.",
      );
    }
    //>>includeEnd('debug');

    this._typedArray = typedArray;
    this._resource = resource;
    this._cacheKey = cacheKey;
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
   * 包含嵌入缓冲区内容的类型数组。
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
   * @returns {Promise<BufferLoader>} A 当资源加载完成时， resolve 的 promise 会返回 loader。
   * @private
   */
  async load() {
    if (defined(this._promise)) {
      return this._promise;
    }

    if (defined(this._typedArray)) {
      this._promise = Promise.resolve(this);
      return this._promise;
    }

    this._promise = loadExternalBuffer(this);
    return this._promise;
  }

  /**
   * 用于测试。
   * @private
   */
  static _fetchArrayBuffer(resource) {
    return resource.fetchArrayBuffer();
  }

  /**
   * 卸载资源。
   * @private
   */
  unload() {
    this._typedArray = undefined;
  }
}

async function loadExternalBuffer(bufferLoader) {
  const resource = bufferLoader._resource;
  bufferLoader._state = ResourceLoaderState.LOADING;
  try {
    const arrayBuffer = await BufferLoader._fetchArrayBuffer(resource);
    if (bufferLoader.isDestroyed()) {
      return;
    }

    bufferLoader._typedArray = new Uint8Array(arrayBuffer);
    bufferLoader._state = ResourceLoaderState.READY;
    return bufferLoader;
  } catch (error) {
    if (bufferLoader.isDestroyed()) {
      return;
    }

    bufferLoader._state = ResourceLoaderState.FAILED;
    const errorMessage = `Failed to load external buffer: ${resource.url}`;
    throw bufferLoader.getError(errorMessage, error);
  }
}

export default BufferLoader;
