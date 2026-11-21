import { Check, ComponentDatatype, Frozen, defined } from "@cesium/core";
import DracoLoader from "./DracoLoader.js";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";
import VertexAttributeSemantic from "./VertexAttributeSemantic.js";

/**
 * 从 glTF 中加载 draco 缓冲区。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 */
class GltfDracoLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性的对象：
   * @param {ResourceCache} options.resourceCache 使用 {@link ResourceCache}（以避免循环依赖）。
   * @param {object} options.gltf glTF JSON 数据。
   * @param {object} options.primitive 包含 Draco 扩展的基元。
   * @param {object} options.draco Draco 扩展对象。
   * @param {Resource} options.gltfResource 包含 glTF 数据的 {@link Resource}。
   * @param {Resource} options.baseResource 在 glTF JSON 中路径相对于的 {@link Resource}。
   * @param {string} [options.cacheKey] 资源的缓存键。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const resourceCache = options.resourceCache;
    const gltf = options.gltf;
    const primitive = options.primitive;
    const draco = options.draco;
    const gltfResource = options.gltfResource;
    const baseResource = options.baseResource;
    const cacheKey = options.cacheKey;

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.func("options.resourceCache", resourceCache);
    Check.typeOf.object("options.gltf", gltf);
    Check.typeOf.object("options.primitive", primitive);
    Check.typeOf.object("options.draco", draco);
    Check.typeOf.object("options.gltfResource", gltfResource);
    Check.typeOf.object("options.baseResource", baseResource);
    //>>includeEnd('debug');

    this._resourceCache = resourceCache;
    this._gltfResource = gltfResource;
    this._baseResource = baseResource;
    this._gltf = gltf;
    this._primitive = primitive;
    this._draco = draco;
    this._cacheKey = cacheKey;
    this._bufferViewLoader = undefined;
    this._bufferViewTypedArray = undefined;
    this._decodePromise = undefined;
    this._decodedData = undefined;
    this._state = ResourceLoaderState.UNLOADED;
    this._promise = undefined;
    this._dracoError = undefined;
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
   * 解码后的数据。
   *
   *
   * @type {object}
   * @readonly
   * @private
   */
  get decodedData() {
    return this._decodedData;
  }

  /**
   * 加载资源。
   * @returns {Promise<GltfDracoLoader>} A 当资源加载完成时 resolve 为 loader 的 promise。
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

    if (this._state !== ResourceLoaderState.PROCESSING) {
      return false;
    }

    if (defined(this._dracoError)) {
      handleError(this, this._dracoError);
    }

    if (!defined(this._bufferViewTypedArray)) {
      // Not ready to decode the Draco buffer
      return false;
    }

    if (defined(this._decodePromise)) {
      // Currently decoding
      return false;
    }

    const draco = this._draco;
    const primitive = this._primitive;
    const gltf = this._gltf;
    const bufferViews = gltf.bufferViews;
    const bufferViewId = draco.bufferView;
    const bufferView = bufferViews[bufferViewId];
    const compressedAttributes = draco.attributes;

    // Skip de-quantization transform if present for floating point attributes.
    // They will stay quantized in memory and be dequantized in the shader.
    const attributesToSkipTransform = [];

    for (const attribute in primitive.attributes) {
      if (primitive.attributes.hasOwnProperty(attribute)) {
        const dracoAttributeType = getDracoAttributeType(attribute);
        if (defined(dracoAttributeType)) {
          const accessor = gltf.accessors[primitive.attributes[attribute]];
          if (accessor.componentType === ComponentDatatype.FLOAT) {
            if (!attributesToSkipTransform.includes(dracoAttributeType)) {
              attributesToSkipTransform.push(dracoAttributeType);
            }
          }
        }
      }
    }

    const decodeOptions = {
      // Need to make a copy of the typed array otherwise the underlying
      // ArrayBuffer may be accessed on both the worker and the main thread. This
      // leads to errors such as "ArrayBuffer at index 0 is already detached".
      // PERFORMANCE_IDEA: Look into SharedArrayBuffer to get around this.
      array: new Uint8Array(this._bufferViewTypedArray),
      bufferView: bufferView,
      compressedAttributes: compressedAttributes,
      dequantizeInShader: true,
      attributesToSkipTransform: attributesToSkipTransform,
    };

    const decodePromise = DracoLoader.decodeBufferView(decodeOptions);

    if (!defined(decodePromise)) {
      // Cannot schedule task this frame
      return false;
    }

    this._decodePromise = processDecode(this, decodePromise);
  }

  /**
   * 卸载资源。
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
      bufferViewId: loader._draco.bufferView,
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

function handleError(dracoLoader, error) {
  dracoLoader.unload();
  dracoLoader._state = ResourceLoaderState.FAILED;
  const errorMessage = "Failed to load Draco";
  throw dracoLoader.getError(errorMessage, error);
}

async function processDecode(loader, decodePromise) {
  try {
    const results = await decodePromise;
    if (loader.isDestroyed()) {
      return;
    }

    // Unload everything except the decoded data
    loader.unload();

    loader._decodedData = {
      indices: results.indexArray,
      vertexAttributes: results.attributeData,
    };
    loader._state = ResourceLoaderState.READY;
    return loader._baseResource;
  } catch (error) {
    if (loader.isDestroyed()) {
      return;
    }

    // Capture this error so it can be thrown on the next `process` call
    loader._dracoError = error;
  }
}

const SemanticToDracoAttributeType = {};
SemanticToDracoAttributeType[VertexAttributeSemantic.POSITION] = "POSITION";
SemanticToDracoAttributeType[VertexAttributeSemantic.NORMAL] = "NORMAL";
SemanticToDracoAttributeType[VertexAttributeSemantic.COLOR] = "COLOR";
SemanticToDracoAttributeType[VertexAttributeSemantic.TEXCOORD] = "TEX_COORD";

function getDracoAttributeType(attribute) {
  for (const semantic in SemanticToDracoAttributeType) {
    if (SemanticToDracoAttributeType.hasOwnProperty(semantic)) {
      if (attribute.startsWith(semantic)) {
        return SemanticToDracoAttributeType[semantic];
      }
    }
  }

  return undefined;
}

export default GltfDracoLoader;
