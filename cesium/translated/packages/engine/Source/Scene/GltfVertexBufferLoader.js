import {
  AttributeType,
  Check,
  DeveloperError,
  Frozen,
  Math as CesiumMath,
  defined,
} from "@cesium/core";
import Buffer from "../Renderer/Buffer.js";
import BufferUsage from "../Renderer/BufferUsage.js";
import JobType from "./JobType.js";
import ModelComponents from "./ModelComponents.js";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";

/**
 * 从 glTF buffer view 中加载顶点缓冲区。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 */
class GltfVertexBufferLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性的对象：
   * @param {ResourceCache} options.resourceCache 使用 {@link ResourceCache}（以避免循环依赖）。
   * @param {object} options.gltf glTF JSON 数据。
   * @param {Resource} options.gltfResource 包含 glTF 数据的 {@link Resource}。
   * @param {Resource} options.baseResource 在 glTF JSON 中相对路径所指向的 {@link Resource}。
   * @param {number} [options.bufferViewId] 与顶点缓冲区对应的 bufferView ID。
   * @param {object} [options.primitive] 包含 Draco 扩展的primitive。
   * @param {object} [options.draco] Draco 扩展对象。
   * @param {object} [options.spz] SPZ 扩展对象。
   * @param {string} [options.attributeSemantic] 属性语义，例如 POSITION 或 NORMAL。
   * @param {number} [options.accessorId] 访问器 ID。
   * @param {string} [options.cacheKey] 资源的缓存键。
   * @param {boolean} [options.asynchronous=true] 决定 WebGL 资源创建是否会在多个帧中逐步完成，直到所有 WebGL 资源都被创建。
   * @param {boolean} [options.loadBuffer=false] 将顶点缓冲区加载为 GPU 顶点缓冲区。
   * @param {boolean} [options.loadTypedArray=false] 将顶点缓冲区加载为类型数组。
   *
   * @exception {DeveloperError} Exactly 必须有效一个顶点缓冲区源：options.bufferViewId、options.spz 或 options.draco（针对 options.attributeSemantic）。
   * @exception {DeveloperError} When 必须定义 options.draco，并且必须定义 options.attributeSemantic。
   * @exception {DeveloperError} When 必须定义 options.draco，并且必须定义 options.accessorId。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const resourceCache = options.resourceCache;
    const gltf = options.gltf;
    const gltfResource = options.gltfResource;
    const baseResource = options.baseResource;
    const bufferViewId = options.bufferViewId;
    const primitive = options.primitive;
    const draco = options.draco;
    const attributeSemantic = options.attributeSemantic;
    const accessorId = options.accessorId;
    const cacheKey = options.cacheKey;
    const spz = options.spz;
    const asynchronous = options.asynchronous ?? true;
    const loadBuffer = options.loadBuffer ?? false;
    const loadTypedArray = options.loadTypedArray ?? false;

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.func("options.resourceCache", resourceCache);
    Check.typeOf.object("options.gltf", gltf);
    Check.typeOf.object("options.gltfResource", gltfResource);
    Check.typeOf.object("options.baseResource", baseResource);
    if (!loadBuffer && !loadTypedArray) {
      throw new DeveloperError(
        "At least one of loadBuffer and loadTypedArray must be true.",
      );
    }

    const hasBufferViewId = defined(bufferViewId);
    const hasPrimitive = defined(primitive);
    const hasDraco = hasDracoCompression(draco, attributeSemantic);
    const hasAttributeSemantic = defined(attributeSemantic);
    const hasAccessorId = defined(accessorId);
    const hasSpz = defined(spz);
    const sourceCount =
      Number(hasBufferViewId) + Number(hasDraco) + Number(hasSpz);
    if (sourceCount !== 1) {
      throw new DeveloperError(
        "Exactly one vertex buffer source must be effective: options.bufferViewId, options.spz, or options.draco for options.attributeSemantic.",
      );
    }

    if (hasDraco && !hasAttributeSemantic) {
      throw new DeveloperError(
        "When options.draco is defined options.attributeSemantic must also be defined.",
      );
    }

    if (hasDraco && !hasAccessorId) {
      throw new DeveloperError(
        "When options.draco is defined options.accessorId must also be defined.",
      );
    }

    if (hasDraco && !hasPrimitive) {
      throw new DeveloperError(
        "When options.draco is defined options.primitive must also be defined.",
      );
    }

    if (hasDraco) {
      Check.typeOf.object("options.primitive", primitive);
      Check.typeOf.object("options.draco", draco);
      Check.typeOf.string("options.attributeSemantic", attributeSemantic);
      Check.typeOf.number("options.accessorId", accessorId);
    }

    //>>includeEnd('debug');

    this._resourceCache = resourceCache;
    this._gltfResource = gltfResource;
    this._baseResource = baseResource;
    this._gltf = gltf;
    this._bufferViewId = bufferViewId;
    this._primitive = primitive;
    this._draco = draco;
    this._spz = spz;
    this._attributeSemantic = attributeSemantic;
    this._accessorId = accessorId;
    this._cacheKey = cacheKey;
    this._asynchronous = asynchronous;
    this._loadBuffer = loadBuffer;
    this._loadTypedArray = loadTypedArray;
    this._bufferViewLoader = undefined;
    this._dracoLoader = undefined;
    this._quantization = undefined;
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
   * 顶点缓冲区。仅在 <code>loadAsTypedArray</code> 为 false 时定义。
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
   * 包含顶点缓冲区数据的类型数组。仅在 <code>loadAsTypedArray</code> 为 true 时定义。
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
   * Draco 解码后量化顶点属性的信息。
   *
   *
   * @type {ModelComponents.Quantization}
   * @readonly
   * @private
   */
  get quantization() {
    return this._quantization;
  }

  /**
   * 加载资源。
   * @returns {Promise<GltfVertexBufferLoader>} A 在资源加载完成时解析为 loader 的承诺。
   * @private
   */
  async load() {
    if (defined(this._promise)) {
      return this._promise;
    }

    if (defined(this._spz)) {
      this._promise = loadFromSpz(this);
      return this._promise;
    }

    if (hasDracoCompression(this._draco, this._attributeSemantic)) {
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

    if (defined(this._dracoLoader)) {
      try {
        const ready = this._dracoLoader.process(frameState);
        if (!ready) {
          return false;
        }
      } catch (error) {
        handleError(this, error);
      }

      processDraco(this);
    }

    if (defined(this._spzLoader)) {
      try {
        const ready = this._spzLoader.process(frameState);
        if (!ready) {
          return false;
        }
      } catch (error) {
        handleError(this, error);
      }

      processSpz(this);
    }

    let buffer;
    const typedArray = this._typedArray;
    if (this._loadBuffer && this._asynchronous) {
      const vertexBufferJob = scratchVertexBufferJob;
      vertexBufferJob.set(typedArray, frameState.context);
      const jobScheduler = frameState.jobScheduler;
      if (!jobScheduler.execute(vertexBufferJob, JobType.BUFFER)) {
        // Job scheduler is full. Try again next frame.
        return false;
      }
      buffer = vertexBufferJob.buffer;
    } else if (this._loadBuffer) {
      buffer = createVertexBuffer(typedArray, frameState.context);
    }

    // Unload everything except the vertex buffer
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

    if (defined(this._spzLoader)) {
      resourceCache.unload(this._spzLoader);
    }

    this._bufferViewLoader = undefined;
    this._dracoLoader = undefined;
    this._spzLoader = undefined;
    this._typedArray = undefined;
    this._buffer = undefined;
    this._gltf = undefined;
    this._primitive = undefined;
  }
}

function hasDracoCompression(draco, semantic) {
  return (
    defined(draco) &&
    defined(draco.attributes) &&
    defined(draco.attributes[semantic])
  );
}

function getQuantizationInformation(
  dracoQuantization,
  componentDatatype,
  componentCount,
  type,
) {
  const quantizationBits = dracoQuantization.quantizationBits;
  const normalizationRange = (1 << quantizationBits) - 1;
  const normalizationDivisor = 1.0 / normalizationRange;

  const quantization = new ModelComponents.Quantization();
  quantization.componentDatatype = componentDatatype;
  quantization.octEncoded = dracoQuantization.octEncoded;
  quantization.octEncodedZXY = true;
  quantization.type = type;

  if (quantization.octEncoded) {
    quantization.type = AttributeType.VEC2;
    quantization.normalizationRange = normalizationRange;
  } else {
    const MathType = AttributeType.getMathType(type);
    if (MathType === Number) {
      const dimensions = dracoQuantization.range;
      quantization.quantizedVolumeOffset = dracoQuantization.minValues[0];
      quantization.quantizedVolumeDimensions = dimensions;
      quantization.normalizationRange = normalizationRange;
      quantization.quantizedVolumeStepSize = dimensions * normalizationDivisor;
    } else {
      quantization.quantizedVolumeOffset = MathType.unpack(
        dracoQuantization.minValues,
      );
      quantization.normalizationRange = MathType.unpack(
        new Array(componentCount).fill(normalizationRange),
      );
      const packedDimensions = new Array(componentCount).fill(
        dracoQuantization.range,
      );
      quantization.quantizedVolumeDimensions =
        MathType.unpack(packedDimensions);

      // Computing the step size
      const packedSteps = packedDimensions.map(function (dimension) {
        return dimension * normalizationDivisor;
      });
      quantization.quantizedVolumeStepSize = MathType.unpack(packedSteps);
    }
  }

  return quantization;
}

async function loadFromSpz(vertexBufferLoader) {
  vertexBufferLoader._state = ResourceLoaderState.LOADING;
  const resourceCache = vertexBufferLoader._resourceCache;
  try {
    const spzLoader = resourceCache.getSpzLoader({
      gltf: vertexBufferLoader._gltf,
      primitive: vertexBufferLoader._primitive,
      spz: vertexBufferLoader._spz,
      gltfResource: vertexBufferLoader._gltfResource,
      baseResource: vertexBufferLoader._baseResource,
    });
    vertexBufferLoader._spzLoader = spzLoader;
    await spzLoader.load();

    if (vertexBufferLoader.isDestroyed()) {
      return;
    }

    vertexBufferLoader._state = ResourceLoaderState.LOADED;
    return vertexBufferLoader;
  } catch {
    if (vertexBufferLoader.isDestroyed()) {
      return;
    }
  }
}

function getShAttributePrefix(attribute) {
  const prefix = attribute.startsWith("KHR_gaussian_splatting:")
    ? "KHR_gaussian_splatting:"
    : "_";
  return `${prefix}SH_DEGREE_`;
}

function extractSHDegreeAndCoef(attribute) {
  const prefix = getShAttributePrefix(attribute);
  const separator = "_COEF_";

  const lStart = prefix.length;
  const coefIndex = attribute.indexOf(separator, lStart);

  const l = parseInt(attribute.slice(lStart, coefIndex), 10);
  const n = parseInt(attribute.slice(coefIndex + separator.length), 10);

  return { l, n };
}

function processSpz(vertexBufferLoader) {
  vertexBufferLoader._state = ResourceLoaderState.PROCESSING;
  const spzLoader = vertexBufferLoader._spzLoader;

  const gcloudData = spzLoader.decodedData.gcloud;

  if (vertexBufferLoader._attributeSemantic === "POSITION") {
    vertexBufferLoader._typedArray = gcloudData.positions;
  } else if (
    vertexBufferLoader._attributeSemantic === "KHR_gaussian_splatting:SCALE" ||
    vertexBufferLoader._attributeSemantic === "_SCALE"
  ) {
    vertexBufferLoader._typedArray = gcloudData.scales;
  } else if (
    vertexBufferLoader._attributeSemantic ===
      "KHR_gaussian_splatting:ROTATION" ||
    vertexBufferLoader._attributeSemantic === "_ROTATION"
  ) {
    vertexBufferLoader._typedArray = gcloudData.rotations;
  } else if (vertexBufferLoader._attributeSemantic === "COLOR_0") {
    const colors = gcloudData.colors;
    const alphas = gcloudData.alphas;
    vertexBufferLoader._typedArray = new Uint8Array((colors.length / 3) * 4);
    for (let i = 0; i < colors.length / 3; i++) {
      vertexBufferLoader._typedArray[i * 4] = CesiumMath.clamp(
        colors[i * 3] * 255.0,
        0.0,
        255.0,
      );
      vertexBufferLoader._typedArray[i * 4 + 1] = CesiumMath.clamp(
        colors[i * 3 + 1] * 255.0,
        0.0,
        255.0,
      );
      vertexBufferLoader._typedArray[i * 4 + 2] = CesiumMath.clamp(
        colors[i * 3 + 2] * 255.0,
        0.0,
        255.0,
      );
      vertexBufferLoader._typedArray[i * 4 + 3] = CesiumMath.clamp(
        alphas[i] * 255.0,
        0.0,
        255.0,
      );
    }
  } else if (vertexBufferLoader._attributeSemantic.includes("SH_DEGREE_")) {
    const { l, n } = extractSHDegreeAndCoef(
      vertexBufferLoader._attributeSemantic,
    );
    const sphericalHarmonicDegree = gcloudData.shDegree;
    let stride = 0;
    const base = [0, 9, 24];
    switch (sphericalHarmonicDegree) {
      case 1:
        stride = 9;
        break;
      case 2:
        stride = 24;
        break;
      case 3:
        stride = 45;
        break;
    }
    const count = gcloudData.numPoints;
    const sh = gcloudData.sh;
    vertexBufferLoader._typedArray = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const idx = i * stride + base[l - 1] + n * 3;
      vertexBufferLoader._typedArray[i * 3] = sh[idx];
      vertexBufferLoader._typedArray[i * 3 + 1] = sh[idx + 1];
      vertexBufferLoader._typedArray[i * 3 + 2] = sh[idx + 2];
    }
  }
}

async function loadFromDraco(vertexBufferLoader) {
  vertexBufferLoader._state = ResourceLoaderState.LOADING;
  const resourceCache = vertexBufferLoader._resourceCache;
  try {
    const dracoLoader = resourceCache.getDracoLoader({
      gltf: vertexBufferLoader._gltf,
      primitive: vertexBufferLoader._primitive,
      draco: vertexBufferLoader._draco,
      gltfResource: vertexBufferLoader._gltfResource,
      baseResource: vertexBufferLoader._baseResource,
    });
    vertexBufferLoader._dracoLoader = dracoLoader;
    await dracoLoader.load();

    if (vertexBufferLoader.isDestroyed()) {
      return;
    }

    // Now wait for process() to run to finish loading
    vertexBufferLoader._state = ResourceLoaderState.LOADED;
    return vertexBufferLoader;
  } catch {
    if (vertexBufferLoader.isDestroyed()) {
      return;
    }

    handleError(vertexBufferLoader);
  }
}

function processDraco(vertexBufferLoader) {
  vertexBufferLoader._state = ResourceLoaderState.PROCESSING;
  const dracoLoader = vertexBufferLoader._dracoLoader;

  // Get the typed array and quantization information
  const decodedVertexAttributes = dracoLoader.decodedData.vertexAttributes;
  const attributeSemantic = vertexBufferLoader._attributeSemantic;
  const dracoAttribute = decodedVertexAttributes[attributeSemantic];
  const accessorId = vertexBufferLoader._accessorId;
  const accessor = vertexBufferLoader._gltf.accessors[accessorId];
  const type = accessor.type;
  const typedArray = dracoAttribute.array;
  const dracoQuantization = dracoAttribute.data.quantization;
  if (defined(dracoQuantization)) {
    vertexBufferLoader._quantization = getQuantizationInformation(
      dracoQuantization,
      dracoAttribute.data.componentDatatype,
      dracoAttribute.data.componentsPerAttribute,
      type,
    );
  }

  vertexBufferLoader._typedArray = new Uint8Array(
    typedArray.buffer,
    typedArray.byteOffset,
    typedArray.byteLength,
  );
}

async function loadFromBufferView(vertexBufferLoader) {
  vertexBufferLoader._state = ResourceLoaderState.LOADING;
  const resourceCache = vertexBufferLoader._resourceCache;
  try {
    const bufferViewLoader = resourceCache.getBufferViewLoader({
      gltf: vertexBufferLoader._gltf,
      bufferViewId: vertexBufferLoader._bufferViewId,
      gltfResource: vertexBufferLoader._gltfResource,
      baseResource: vertexBufferLoader._baseResource,
    });
    vertexBufferLoader._bufferViewLoader = bufferViewLoader;
    await bufferViewLoader.load();

    if (vertexBufferLoader.isDestroyed()) {
      return;
    }

    vertexBufferLoader._typedArray = bufferViewLoader.typedArray;
    vertexBufferLoader._state = ResourceLoaderState.PROCESSING;
    return vertexBufferLoader;
  } catch (error) {
    if (vertexBufferLoader.isDestroyed()) {
      return;
    }

    handleError(vertexBufferLoader, error);
  }
}

function handleError(vertexBufferLoader, error) {
  vertexBufferLoader.unload();
  vertexBufferLoader._state = ResourceLoaderState.FAILED;
  const errorMessage = "Failed to load vertex buffer";
  throw vertexBufferLoader.getError(errorMessage, error);
}

class CreateVertexBufferJob {
  constructor() {
    this.typedArray = undefined;
    this.context = undefined;
    this.buffer = undefined;
  }

  set(typedArray, context) {
    this.typedArray = typedArray;
    this.context = context;
  }

  execute() {
    this.buffer = createVertexBuffer(this.typedArray, this.context);
  }
}

function createVertexBuffer(typedArray, context) {
  const buffer = Buffer.createVertexBuffer({
    typedArray: typedArray,
    context: context,
    usage: BufferUsage.STATIC_DRAW,
  });
  buffer.vertexArrayDestroyable = false;
  return buffer;
}

const scratchVertexBufferJob = new CreateVertexBufferJob();

export default GltfVertexBufferLoader;
