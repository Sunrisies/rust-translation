import {
  Cartesian3,
  Check,
  ComponentDatatype,
  Frozen,
  Matrix4,
  defined,
} from "@cesium/core";
import Axis from "../Axis.js";
import B3dmParser from "../B3dmParser.js";
import Cesium3DTileFeatureTable from "../Cesium3DTileFeatureTable.js";
import StructuralMetadata from "../StructuralMetadata.js";
import GltfLoader from "../GltfLoader.js";
import MetadataClass from "../MetadataClass.js";
import ModelComponents from "../ModelComponents.js";
import ModelUtility from "./ModelUtility.js";
import parseBatchTable from "../parseBatchTable.js";
import PropertyTable from "../PropertyTable.js";
import ResourceLoader from "../ResourceLoader.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";

const B3dmLoaderState = {
  UNLOADED: 0,
  LOADING: 1,
  PROCESSING: 2,
  READY: 3,
  FAILED: 4,
};

const FeatureIdAttribute = ModelComponents.FeatureIdAttribute;

/**
 * 加载批量 3D 模型。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 */
class B3dmLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性的对象：
   * @param {Resource} options.b3dmResource 包含 b3dm 的 {@link Resource}。
   * @param {ArrayBuffer} options.arrayBuffer b3dm 内容的数据缓冲区数组。
   * @param {number} [options.byteOffset] b3dm 内容在数组缓冲区中的起始字节偏移量。
   * @param {Resource} [options.baseResource] glTF JSON 路径所基于的 {@link Resource}。
   * @param {boolean} [options.releaseGltfJson=false] 当为 true 时，在 glTF 加载完成后会释放 glTF JSON。这对于 3D Tiles 等场景非常有用，因为每个 .gltf 模型都是唯一的，缓存 glTF JSON 效果不佳。
   * @param {boolean} [options.asynchronous=true] 决定 WebGL 资源创建是否会在多个帧中逐步完成，直到所有 WebGL 资源都被创建。
   * @param {boolean} [options.incrementallyLoadTextures=true] 决定在 glTF 加载后是否仍可以继续流式传输纹理。
   * @param {Axis} [options.upAxis=Axis.Y] glTF 模型的上轴。
   * @param {Axis} [options.forwardAxis=Axis.X] glTF 模型的前轴。
   * @param {boolean} [options.loadAttributesAsTypedArray=false] 如果为 <code>true</code>，则将所有属性作为类型数组加载，而不是 GPU 缓冲区。如果属性在 glTF 中交错存储，则会在类型数组中解交错。
   * @param {boolean} [options.loadAttributesFor2D=false] 如果为 <code>true</code>，则将位置缓冲区及任何实例属性缓冲区作为类型数组加载，以便准确将模型投影到 2D 空间。
   * @param {boolean} [options.enablePick=false]  如果为 <code>true</code>，则将位置缓冲区、任何实例属性缓冲区及索引缓冲区作为类型数组加载，以便在 WebGL1 中支持 CPU 拾取操作。
   * @param {boolean} [options.loadIndicesForWireframe=false] 如果为 <code>true</code>，则将索引缓冲区作为类型数组加载。这对于在 WebGL1 中创建线框索引非常有用。
   * @param {boolean} [options.loadPrimitiveOutline=true] 如果为 <code>true</code>，则从 {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展加载轮廓线。可以设置为 false 以在加载时避免后处理几何图形。
   * @param {boolean} [options.loadForClassification=false] 如果为 <code>true</code> 且模型具有特征 ID，则将特征 ID 和索引作为类型数组加载。这对于批量处理特征进行分类非常有用。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;

    const b3dmResource = options.b3dmResource;
    let baseResource = options.baseResource;
    const arrayBuffer = options.arrayBuffer;
    const byteOffset = options.byteOffset ?? 0;
    const releaseGltfJson = options.releaseGltfJson ?? false;
    const asynchronous = options.asynchronous ?? true;
    const incrementallyLoadTextures = options.incrementallyLoadTextures ?? true;
    const upAxis = options.upAxis ?? Axis.Y;
    const forwardAxis = options.forwardAxis ?? Axis.X;
    const loadAttributesAsTypedArray =
      options.loadAttributesAsTypedArray ?? false;
    const loadAttributesFor2D = options.loadAttributesFor2D ?? false;
    const enablePick = options.enablePick ?? false;
    const loadIndicesForWireframe = options.loadIndicesForWireframe ?? false;
    const loadPrimitiveOutline = options.loadPrimitiveOutline ?? true;
    const loadForClassification = options.loadForClassification ?? false;

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("options.b3dmResource", b3dmResource);
    Check.typeOf.object("options.arrayBuffer", arrayBuffer);
    //>>includeEnd('debug');

    baseResource = defined(baseResource) ? baseResource : b3dmResource.clone();

    this._b3dmResource = b3dmResource;
    this._baseResource = baseResource;
    this._arrayBuffer = arrayBuffer;
    this._byteOffset = byteOffset;
    this._releaseGltfJson = releaseGltfJson;
    this._asynchronous = asynchronous;
    this._incrementallyLoadTextures = incrementallyLoadTextures;
    this._upAxis = upAxis;
    this._forwardAxis = forwardAxis;
    this._loadAttributesAsTypedArray = loadAttributesAsTypedArray;
    this._loadAttributesFor2D = loadAttributesFor2D;
    this._enablePick = enablePick;
    this._loadIndicesForWireframe = loadIndicesForWireframe;
    this._loadPrimitiveOutline = loadPrimitiveOutline;
    this._loadForClassification = loadForClassification;

    this._state = B3dmLoaderState.UNLOADED;

    this._promise = undefined;

    this._gltfLoader = undefined;

    // Loaded results.
    this._batchLength = 0;
    this._propertyTable = undefined;

    // The batch table object contains a json and a binary component access using keys of the same name.
    this._batchTable = undefined;
    this._components = undefined;
    this._transform = Matrix4.IDENTITY;
  }

  /**
   * 如果纹理已加载则为 true，当 incrementallyLoadTextures 为 true 时很有用。
   *
   *
   * @type {boolean}
   * @readonly
   * @private
   */
  get texturesLoaded() {
    return this._gltfLoader?.texturesLoaded;
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
    return undefined;
  }

  /**
   * 已加载的组件。
   *
   *
   * @type {ModelComponents.Components}
   * @readonly
   * @private
   */
  get components() {
    return this._components;
  }

  /**
   * 加载资源。
   * @returns {Promise<B3dmLoader>} A 在资源加载完成时解析为 loader 的 promise。
   * @private
   */
  load() {
    if (defined(this._promise)) {
      return this._promise;
    }

    const b3dm = B3dmParser.parse(this._arrayBuffer, this._byteOffset);

    const featureTableJson = b3dm.featureTableJson;
    const featureTableBinary = b3dm.featureTableBinary;
    const batchTableJson = b3dm.batchTableJson;
    const batchTableBinary = b3dm.batchTableBinary;

    const featureTable = new Cesium3DTileFeatureTable(
      featureTableJson,
      featureTableBinary,
    );
    const batchLength = featureTable.getGlobalProperty("BATCH_LENGTH");
    // Set batch length.
    this._batchLength = batchLength;
    // Set the RTC Center transform, if present.
    const rtcCenter = featureTable.getGlobalProperty(
      "RTC_CENTER",
      ComponentDatatype.FLOAT,
      3,
    );
    if (defined(rtcCenter)) {
      this._transform = Matrix4.fromTranslation(
        Cartesian3.fromArray(rtcCenter),
      );
    }

    this._batchTable = {
      json: batchTableJson,
      binary: batchTableBinary,
    };

    const gltfLoader = new GltfLoader({
      typedArray: b3dm.gltf,
      upAxis: this._upAxis,
      forwardAxis: this._forwardAxis,
      gltfResource: this._b3dmResource,
      baseResource: this._baseResource,
      releaseGltfJson: this._releaseGltfJson,
      incrementallyLoadTextures: this._incrementallyLoadTextures,
      loadAttributesAsTypedArray: this._loadAttributesAsTypedArray,
      loadAttributesFor2D: this._loadAttributesFor2D,
      enablePick: this._enablePick,
      loadIndicesForWireframe: this._loadIndicesForWireframe,
      loadPrimitiveOutline: this._loadPrimitiveOutline,
      loadForClassification: this._loadForClassification,
      renameBatchIdSemantic: true,
    });

    this._gltfLoader = gltfLoader;
    this._state = B3dmLoaderState.LOADING;

    const that = this;
    this._promise = gltfLoader
      .load()
      .then(function () {
        if (that.isDestroyed()) {
          return;
        }

        that._state = B3dmLoaderState.PROCESSING;
        return that;
      })
      .catch(function (error) {
        if (that.isDestroyed()) {
          return;
        }

        return handleError(that, error);
      });

    return this._promise;
  }

  process(frameState) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("frameState", frameState);
    //>>includeEnd('debug');

    if (this._state === B3dmLoaderState.READY) {
      return true;
    }

    if (this._state !== B3dmLoaderState.PROCESSING) {
      return false;
    }

    const ready = this._gltfLoader.process(frameState);
    if (!ready) {
      return false;
    }

    const components = this._gltfLoader.components;

    // Combine the RTC_CENTER transform from the b3dm and the CESIUM_RTC
    // transform from the glTF. In practice usually only one or the
    // other is supplied. If they don't exist the transforms will
    // be identity matrices.
    components.transform = Matrix4.multiplyTransformation(
      this._transform,
      components.transform,
      components.transform,
    );
    createStructuralMetadata(this, components);
    this._components = components;

    // Now that we have the parsed components, we can release the array buffer
    this._arrayBuffer = undefined;

    this._state = B3dmLoaderState.READY;
    return true;
  }

  unload() {
    if (defined(this._gltfLoader) && !this._gltfLoader.isDestroyed()) {
      this._gltfLoader.unload();
    }

    this._components = undefined;
    this._arrayBuffer = undefined;
  }
}

function handleError(b3dmLoader, error) {
  b3dmLoader.unload();
  b3dmLoader._state = B3dmLoaderState.FAILED;
  const errorMessage = "Failed to load b3dm";
  error = b3dmLoader.getError(errorMessage, error);
  return Promise.reject(error);
}

function createStructuralMetadata(loader, components) {
  const batchTable = loader._batchTable;
  const batchLength = loader._batchLength;

  if (batchLength === 0) {
    return;
  }

  let structuralMetadata;
  if (defined(batchTable.json)) {
    // Add the structural metadata from the batch table to the model components.
    structuralMetadata = parseBatchTable({
      count: batchLength,
      batchTable: batchTable.json,
      binaryBody: batchTable.binary,
    });
  } else {
    // If batch table is not defined, create a property table without any properties.
    const emptyPropertyTable = new PropertyTable({
      name: MetadataClass.BATCH_TABLE_CLASS_NAME,
      count: batchLength,
    });
    structuralMetadata = new StructuralMetadata({
      schema: {},
      propertyTables: [emptyPropertyTable],
    });
  }

  // Add the feature ID attribute to the primitives.
  const nodes = components.scene.nodes;
  const length = nodes.length;
  for (let i = 0; i < length; i++) {
    processNode(nodes[i]);
  }
  components.structuralMetadata = structuralMetadata;
}

// Recursive function to add the feature ID attribute to all primitives that have a feature ID vertex attribute.
function processNode(node) {
  const childrenLength = node.children.length;
  for (let i = 0; i < childrenLength; i++) {
    processNode(node.children[i]);
  }

  const primitivesLength = node.primitives.length;
  for (let i = 0; i < primitivesLength; i++) {
    const primitive = node.primitives[i];
    const featureIdVertexAttribute = ModelUtility.getAttributeBySemantic(
      primitive,
      VertexAttributeSemantic.FEATURE_ID,
    );
    if (defined(featureIdVertexAttribute)) {
      featureIdVertexAttribute.setIndex = 0;
      const featureIdAttribute = new FeatureIdAttribute();
      featureIdAttribute.propertyTableId = 0;
      featureIdAttribute.setIndex = 0;
      featureIdAttribute.positionalLabel = "featureId_0";
      primitive.featureIds.push(featureIdAttribute);
    }
  }
}

export default B3dmLoader;
