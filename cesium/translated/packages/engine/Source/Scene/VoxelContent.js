import {
  Check,
  ComponentDatatype,
  DeveloperError,
  defined,
  destroyObject,
} from "@cesium/core";
import GltfLoader from "./GltfLoader.js";
import MetadataComponentType from "./MetadataComponentType.js";
import MetadataType from "./MetadataType.js";

/**
 * <div class="notice">
 * 要创建 VoxelContent，请调用 {@link VoxelContent.fromMetadataArray} 或 {@link VoxelContent.fromGltf}。不要直接调用构造函数。
 * </div>
 * 表示 {@link Cesium3DTilesVoxelProvider} 的体素内容的对象。
 *
 * @alias VoxelContent
 * @internalConstructor
 *
 * @privateParam {object} options 具有以下属性的对象：
 * @privateParam {ResourceLoader} [options.loader] 用于加载体素内容的加载器。
 * @privateParam {Int8Array[]|Uint8Array[]|Int16Array[]|Uint16Array[]|Int32Array[]|Uint32Array[]|Float32Array[]|Float64Array[]} [options.metadata] 该体素内容的元数据。
 *
 * @exception {DeveloperError} One 必须定义加载器和元数据。
 * @exception {DeveloperError} metadata 必须是 TypedArrays 的数组。
 *
 * @experimental This 此功能尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 */
function VoxelContent(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options", options);
  if (!defined(options.loader)) {
    if (!defined(options.metadata)) {
      throw new DeveloperError("One of loader and metadata must be defined.");
    }
    if (!Array.isArray(options.metadata)) {
      throw new DeveloperError("metadata must be an array of TypedArrays.");
    }
  }
  //>>includeEnd('debug');

  const { loader, metadata } = options;

  this._loader = loader;
  this._metadata = metadata;
  this._resourcesLoaded = false;
  this._ready = false;
}

Object.defineProperties(VoxelContent.prototype, {
  /**
   * 当内容准备好渲染时返回 true；否则返回 false。
   *
   * @memberof VoxelContent.prototype
   *
   * @type {boolean}
   * @readonly
   * @private
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },

  /**
   * 该体素内容的元数据。
   * 元数据是 TypedArrays 的数组，每个字段对应一个数组。
   * 一个字段的数据是一个按 X、Y、Z 顺序排列的扁平化 3D 数组。
   *
   * @memberof VoxelContent.prototype
   * @type {Int8Array[]|Uint8Array[]|Int16Array[]|Uint16Array[]|Int32Array[]|Uint32Array[]|Float32Array[]|Float64Array[]}
   * @readonly
   */
  metadata: {
    get: function () {
      return this._metadata;
    },
  },
});

/**
 * 从元数据数组创建 VoxelContent。
 *
 * @param {Int8Array[]|Uint8Array[]|Int16Array[]|Uint16Array[]|Int32Array[]|Uint32Array[]|Float32Array[]|Float64Array[]} metadata 用于此体素内容的元数据。
 * @returns {VoxelContent} A 包含指定元数据的 VoxelContent。
 */
VoxelContent.fromMetadataArray = function (metadata) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("metadata", metadata);
  if (!Array.isArray(metadata)) {
    throw new DeveloperError("metadata must be an array of TypedArrays.");
  }
  //>>includeEnd('debug');

  return new VoxelContent({ metadata });
};

/**
 * 从 glTF 资源创建 VoxelContent。
 *
 * @param {Resource} resource 指向包含体素内容的 glTF 的 Resource。
 * @returns {Promise<VoxelContent>} A 承诺解析为体素内容。
 *
 * @private
 */
VoxelContent.fromGltf = async function (resource) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("resource", resource);
  //>>includeEnd('debug');

  // Construct the glTF loader
  const loader = new GltfLoader({
    gltfResource: resource,
    releaseGltfJson: false,
    loadAttributesAsTypedArray: true,
  });

  try {
    // This loads the gltf JSON and ensures the gltf is valid
    // Further resource loading is handled synchronously in loader.process()
    // via voxelContent.update() as the frameState is needed
    await loader.load();
  } catch (error) {
    loader.destroy();
    throw error;
  }

  return new VoxelContent({ loader });
};

/**
 * 更新内容，直到所有资源准备好渲染。
 * @param {FrameState} frameState 帧状态
 * @private
 */
VoxelContent.prototype.update = function (primitive, frameState) {
  const loader = this._loader;

  if (this._ready) {
    // Nothing to do
    return;
  }

  // Ensures frames continue to render in requestRender mode while resources are processing
  frameState.afterRender.push(() => true);

  if (!defined(loader)) {
    this._ready = true;
    return;
  }

  if (this._resourcesLoaded) {
    const { structuralMetadata, scene } = loader.components;
    const { attributes } = scene.nodes[0].primitives[0];
    this._metadata = processAttributes(
      attributes,
      structuralMetadata,
      primitive,
    );
    this._ready = true;
    return;
  }

  this._resourcesLoaded = loader.process(frameState);
};

/**
 * 处理来自 glTF 加载器的属性，并按原始对象期望的顺序重新排序。
 *
 * @param {ModelComponents.Attribute[]} attributes 要处理的属性
 * @param {StructuralMetadata} structuralMetadata 来自 glTF EXT_structural_metadata 扩展的信息
 * @param {VoxelPrimitive} primitive 将使用此体素内容的原始对象。
 * @returns {Int8Array[]|Uint8Array[]|Int16Array[]|Uint16Array[]|Int32Array[]|Uint32Array[]|Float32Array[]|Float64Array[]} An 包含属性值的 TypedArrays 数组
 * @private
 */
function processAttributes(attributes, structuralMetadata, primitive) {
  const { className, names, types, componentTypes } = primitive.provider;
  const propertyAttribute = structuralMetadata.propertyAttributes.find(
    (p) => p.class.id === className,
  );
  const { properties } = propertyAttribute;
  const data = new Array(names.length);

  for (let i = 0; i < attributes.length; i++) {
    // Find the appropriate glTF attribute based on its name.
    const name = properties[names[i]].attribute;
    const attribute = attributes.find((a) => a.name === name);
    if (!defined(attribute)) {
      continue;
    }

    const componentDatatype = MetadataComponentType.toComponentDatatype(
      componentTypes[i],
    );
    const componentCount = MetadataType.getComponentCount(types[i]);
    const totalCount = attribute.count * componentCount;
    data[i] = ComponentDatatype.createArrayBufferView(
      componentDatatype,
      attribute.typedArray.buffer,
      attribute.typedArray.byteOffset + attribute.byteOffset,
      totalCount,
    );
  }

  return data;
}

/**
 * 如果此对象被销毁，返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，返回 <code>false</code>；否则返回 <code>true</code>。
 *
 * @see VoxelContent#destroy
 *
 * @private
 */
VoxelContent.prototype.isDestroyed = function () {
  return false;
};

/**
 * 释放此对象使用的资源。
 * @private
 */
VoxelContent.prototype.destroy = function () {
  this._loader = this._loader && this._loader.destroy();
  return destroyObject(this);
};

export default VoxelContent;
