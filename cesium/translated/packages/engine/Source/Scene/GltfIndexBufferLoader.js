import {
  Check,
  ComponentDatatype,
  DeveloperError,
  Frozen,
  IndexDatatype,
  defined,
  deprecationWarning,
} from "@cesium/core";
import Buffer from "../Renderer/Buffer.js";
import BufferUsage from "../Renderer/BufferUsage.js";
import JobType from "./JobType.js";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";

/**
 * 从 glTF 访问器加载索引缓冲区。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 */
class GltfIndexBufferLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性：
   * @param {ResourceCache} options.resourceCache 使用 {@link ResourceCache}（以避免循环依赖）。
   * @param {object} options.gltf glTF JSON 数据。
   * @param {number} options.accessorId 与索引缓冲区对应的访问器 ID。
   * @param {Resource} options.gltfResource 包含 glTF 数据的 {@link Resource}。
   * @param {Resource} options.baseResource glTF JSON 中相对路径所指向的 {@link Resource}。
   * @param {object} [options.primitive] 包含 Draco 扩展的原始类型数据。
   * @param {object} [options.draco] Draco 扩展对象。
   * @param {string} [options.cacheKey] 资源的缓存键。
   * @param {boolean} [options.asynchronous=true] 决定 WebGL 资源创建是否会在多个帧中逐步完成，直到所有 WebGL 资源都被创建。
   * @param {boolean} [options.loadBuffer=false] 将索引缓冲区加载为 GPU 索引缓冲区。
   * @param {boolean} [options.loadTypedArray=false] 将索引缓冲区加载为类型数组。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const resourceCache = options.resourceCache;
    const gltf = options.gltf;
    const accessorId = options.accessorId;
    const gltfResource = options.gltfResource;
    const baseResource = options.baseResource;
    const primitive = options.primitive;
    const draco = options.draco;
    const cacheKey = options.cacheKey;
    const asynchronous = options.asynchronous ?? true;
    const loadBuffer = options.loadBuffer ?? false;
    const loadTypedArray = options.loadTypedArray ?? false;

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.func("options.resourceCache", resourceCache);
    Check.typeOf.object("options.gltf", gltf);
    Check.typeOf.number("options.accessorId", accessorId);
    Check.typeOf.object("options.gltfResource", gltfResource);
    Check.typeOf.object("options.baseResource", baseResource);
    if (!loadBuffer && !loadTypedArray) {
      throw new DeveloperError(
        "At least one of loadBuffer and loadTypedArray must be true.",
      );
    }
    //>>includeEnd('debug');

    const indexDatatype = gltf.accessors[accessorId].componentType;

    this._resourceCache = resourceCache;
    this._gltfResource = gltfResource;
    this._baseResource = baseResource;
    this._gltf = gltf;
    this._accessorId = accessorId;
    this._indexDatatype = indexDatatype;
    this._primitive = primitive;
    this._draco = draco;
    this._cacheKey = cacheKey;
    this._asynchronous = asynchronous;
    this._loadBuffer = loadBuffer;
    this._loadTypedArray = loadTypedArray;
    this._bufferViewLoader = undefined;
    this._dracoLoader = undefined;
    this._typedArray = undefined;
    this._buffer = undefined;
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
   * 索引缓冲区。仅在 <code>loadBuffer</code> 为 true 时定义。
   *
   *
   * @type {Buffer}
   * @readonly
   * @private
   */
  get buffer() {
    return this._buffer;
  }

  /**
   * 包含索引的类型数组。仅在 <code>loadTypedArray</code> 为 true 时定义。
   *
   *
   * @type {Uint8Array|Uint16Array|Uint32Array}
   * @readonly
   * @private
   */
  get typedArray() {
    return this._typedArray;
  }

  /**
   * 解码后的索引数据类型。
   *
   *
   * @type {IndexDatatype}
   * @readonly
   * @private
   */
  get indexDatatype() {
    return this._indexDatatype;
  }

  /**
   * 加载资源。
   * @returns {Promise<GltfIndexBufferLoader>} A 在资源加载完成时解析为 loader 的 promise。
   * @private
   */
  async load() {
    if (defined(this._promise)) {
      return this._promise;
    }

    if (defined(this._draco)) {
      this._promise = loadFromDraco(this);
      return this._promise;
    }

    this._promise = loadFromBufferView(this);
    return this._promise;
  }

  /**
   * 处理资源直至其准备就绪。
   *
   * @param {FrameState} frameState 帧状态。
   * @private
   */
  process(frameState) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("frameState", frameState);
    //>>includeEnd('debug');

    if (this._state === ResourceLoaderState.READY) {
      return true;
    }

    if (
      this._state !== ResourceLoaderState.LOADED &&
      this._state !== ResourceLoaderState.PROCESSING
    ) {
      return false;
    }

    let typedArray = this._typedArray;
    let indexDatatype = this._indexDatatype;

    if (defined(this._dracoLoader)) {
      try {
        const ready = this._dracoLoader.process(frameState);
        if (ready) {
          const dracoLoader = this._dracoLoader;
          typedArray = dracoLoader.decodedData.indices.typedArray;
          this._typedArray = typedArray;
          // The index datatype may be a smaller datatype after draco decode
          indexDatatype = ComponentDatatype.fromTypedArray(typedArray);
          this._indexDatatype = indexDatatype;
        }
      } catch (error) {
        handleError(this, error);
      }
    }

    if (!defined(typedArray)) {
      // Buffer view hasn't been loaded yet
      return false;
    }

    let buffer;
    if (this._loadBuffer && this._asynchronous) {
      const indexBufferJob = scratchIndexBufferJob;
      indexBufferJob.set(typedArray, indexDatatype, frameState.context);
      const jobScheduler = frameState.jobScheduler;
      if (!jobScheduler.execute(indexBufferJob, JobType.BUFFER)) {
        // Job scheduler is full. Try again next frame.
        return false;
      }
      buffer = indexBufferJob.buffer;
    } else if (this._loadBuffer) {
      buffer = createIndexBuffer(typedArray, indexDatatype, frameState.context);
    }

    // Unload everything except the index buffer and/or typed array.
    this.unload();

    this._buffer = buffer;
    this._typedArray = this._loadTypedArray ? typedArray : undefined;
    this._state = ResourceLoaderState.READY;

    this._resourceCache.statistics.addGeometryLoader(this);
    return true;
  }

  /**
   * 卸载资源。
   * @private
   */
  unload() {
    if (defined(this._buffer)) {
      this._buffer.destroy();
    }

    const resourceCache = this._resourceCache;

    if (
      defined(this._bufferViewLoader) &&
      !this._bufferViewLoader.isDestroyed()
    ) {
      resourceCache.unload(this._bufferViewLoader);
    }

    if (defined(this._dracoLoader)) {
      resourceCache.unload(this._dracoLoader);
    }

    this._bufferViewLoader = undefined;
    this._dracoLoader = undefined;
    this._typedArray = undefined;
    this._buffer = undefined;
    this._gltf = undefined;
    this._primitive = undefined;
  }
}

class CreateIndexBufferJob {
  constructor() {
    this.typedArray = undefined;
    this.indexDatatype = undefined;
    this.context = undefined;
    this.buffer = undefined;
  }

  set(typedArray, indexDatatype, context) {
    this.typedArray = typedArray;
    this.indexDatatype = indexDatatype;
    this.context = context;
  }

  execute() {
    this.buffer = createIndexBuffer(
      this.typedArray,
      this.indexDatatype,
      this.context,
    );
  }
}

function createIndexBuffer(typedArray, indexDatatype, context) {
  const buffer = Buffer.createIndexBuffer({
    typedArray: typedArray,
    context: context,
    usage: BufferUsage.STATIC_DRAW,
    indexDatatype: indexDatatype,
  });
  buffer.vertexArrayDestroyable = false;
  return buffer;
}

const scratchIndexBufferJob = new CreateIndexBufferJob();

async function loadFromDraco(indexBufferLoader) {
  indexBufferLoader._state = ResourceLoaderState.LOADING;
  const resourceCache = indexBufferLoader._resourceCache;

  try {
    const dracoLoader = resourceCache.getDracoLoader({
      gltf: indexBufferLoader._gltf,
      primitive: indexBufferLoader._primitive,
      draco: indexBufferLoader._draco,
      gltfResource: indexBufferLoader._gltfResource,
      baseResource: indexBufferLoader._baseResource,
    });
    indexBufferLoader._dracoLoader = dracoLoader;
    await dracoLoader.load();

    if (indexBufferLoader.isDestroyed()) {
      return;
    }

    // Now wait for process() to run to finish loading
    indexBufferLoader._state = ResourceLoaderState.LOADED;
    return indexBufferLoader;
  } catch (error) {
    if (indexBufferLoader.isDestroyed()) {
      return;
    }

    handleError(indexBufferLoader, error);
  }
}

async function loadFromBufferView(indexBufferLoader) {
  const gltf = indexBufferLoader._gltf;
  const accessorId = indexBufferLoader._accessorId;
  const accessor = gltf.accessors[accessorId];
  const bufferViewId = accessor.bufferView;

  indexBufferLoader._state = ResourceLoaderState.LOADING;
  const resourceCache = indexBufferLoader._resourceCache;
  try {
    const bufferViewLoader = resourceCache.getBufferViewLoader({
      gltf: gltf,
      bufferViewId: bufferViewId,
      gltfResource: indexBufferLoader._gltfResource,
      baseResource: indexBufferLoader._baseResource,
    });
    indexBufferLoader._bufferViewLoader = bufferViewLoader;

    await bufferViewLoader.load();
    if (indexBufferLoader.isDestroyed()) {
      return;
    }

    const bufferViewTypedArray = bufferViewLoader.typedArray;
    indexBufferLoader._typedArray = createIndicesTypedArray(
      indexBufferLoader,
      bufferViewTypedArray,
    );
    indexBufferLoader._state = ResourceLoaderState.PROCESSING;
    return indexBufferLoader;
  } catch (error) {
    if (indexBufferLoader.isDestroyed()) {
      return;
    }

    handleError(indexBufferLoader, error);
  }
}

function createIndicesTypedArray(indexBufferLoader, bufferViewTypedArray) {
  const gltf = indexBufferLoader._gltf;
  const accessorId = indexBufferLoader._accessorId;
  const accessor = gltf.accessors[accessorId];
  const count = accessor.count;
  const indexDatatype = accessor.componentType;
  const indexSize = IndexDatatype.getSizeInBytes(indexDatatype);

  let arrayBuffer = bufferViewTypedArray.buffer;
  let byteOffset = bufferViewTypedArray.byteOffset + accessor.byteOffset;

  if (byteOffset % indexSize !== 0) {
    const byteLength = count * indexSize;
    const view = new Uint8Array(arrayBuffer, byteOffset, byteLength);
    const copy = new Uint8Array(view);
    arrayBuffer = copy.buffer;
    byteOffset = 0;
    deprecationWarning(
      "index-buffer-unaligned",
      `The index array is not aligned to a ${indexSize}-byte boundary.`,
    );
  }

  let typedArray;
  if (indexDatatype === IndexDatatype.UNSIGNED_BYTE) {
    typedArray = new Uint8Array(arrayBuffer, byteOffset, count);
  } else if (indexDatatype === IndexDatatype.UNSIGNED_SHORT) {
    typedArray = new Uint16Array(arrayBuffer, byteOffset, count);
  } else if (indexDatatype === IndexDatatype.UNSIGNED_INT) {
    typedArray = new Uint32Array(arrayBuffer, byteOffset, count);
  }

  return typedArray;
}

function handleError(indexBufferLoader, error) {
  indexBufferLoader.unload();
  indexBufferLoader._state = ResourceLoaderState.FAILED;
  const errorMessage = "Failed to load index buffer";
  throw indexBufferLoader.getError(errorMessage, error);
}

export default GltfIndexBufferLoader;
