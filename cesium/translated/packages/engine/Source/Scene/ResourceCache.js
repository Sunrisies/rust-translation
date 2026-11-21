import { Check, DeveloperError, Frozen, defined } from "@cesium/core";
import BufferLoader from "./BufferLoader.js";
import GltfBufferViewLoader from "./GltfBufferViewLoader.js";
import GltfDracoLoader from "./GltfDracoLoader.js";
import GltfImageLoader from "./GltfImageLoader.js";
import GltfIndexBufferLoader from "./GltfIndexBufferLoader.js";
import GltfJsonLoader from "./GltfJsonLoader.js";
import GltfTextureLoader from "./GltfTextureLoader.js";
import GltfVertexBufferLoader from "./GltfVertexBufferLoader.js";
import GltfSpzLoader from "./GltfSpzLoader.js";
import MetadataSchemaLoader from "./MetadataSchemaLoader.js";
import ResourceCacheKey from "./ResourceCacheKey.js";
import ResourceCacheStatistics from "./ResourceCacheStatistics.js";

/**
 * 用于存储跨 3D Tiles 和 glTF 共享资源的缓存。
 *
 * @namespace ResourceCache
 *
 * @internal
 */
function ResourceCache() {}

ResourceCache.cacheEntries = {};

/**
 * 存储在资源缓存中的二进制数据的统计信息。
 *
 * @type {ResourceCacheStatistics}
 *
 * @internal
 */
ResourceCache.statistics = new ResourceCacheStatistics();

/**
 * 一个引用计数缓存条目。
 *
 * @param {ResourceLoader} resourceLoader 资源本身。
 *
 * @alias CacheEntry
 * @constructor
 *
 * @private
 */
function CacheEntry(resourceLoader) {
  this.referenceCount = 1;
  this.resourceLoader = resourceLoader;

  // For unit testing only
  this._statisticsPromise = undefined;
}

/**
 * 从缓存中获取资源。如果资源存在，其引用计数会增加。
 * 如果不存在资源加载器，则返回 undefined。
 *
 * @param {string} cacheKey 资源的缓存键。
 *
 * @returns {ResourceLoader|undefined} The 资源。
 * @private
 */
ResourceCache.get = function (cacheKey) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("cacheKey", cacheKey);
  //>>includeEnd('debug');

  const cacheEntry = ResourceCache.cacheEntries[cacheKey];
  if (defined(cacheEntry)) {
    ++cacheEntry.referenceCount;
    return cacheEntry.resourceLoader;
  }
  return undefined;
};

/**
 * 将其添加到缓存中。
 *
 * @param {ResourceLoader} resourceLoader 资源。
 * @returns {ResourceLoader} The 资源。
 *
 * @exception {DeveloperError} Resource 该缓存键已存在于缓存中。
 * @private
 */
ResourceCache.add = function (resourceLoader) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("resourceLoader", resourceLoader);
  //>>includeEnd('debug');

  const cacheKey = resourceLoader.cacheKey;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.resourceLoader.cacheKey", cacheKey);

  if (defined(ResourceCache.cacheEntries[cacheKey])) {
    throw new DeveloperError(
      `Resource with this cacheKey is already in the cache: ${cacheKey}`,
    );
  }
  //>>includeEnd('debug');

  ResourceCache.cacheEntries[cacheKey] = new CacheEntry(resourceLoader);

  return resourceLoader;
};

/**
 * 从缓存中卸载资源。当引用计数归零时，
 * 资源被销毁。
 *
 * @param {ResourceLoader} resourceLoader 资源。
 *
 * @exception {DeveloperError} Resource 不在缓存中。
 * @exception {DeveloperError} Cannot 卸载没有引用的资源。
 * @private
 */
ResourceCache.unload = function (resourceLoader) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("resourceLoader", resourceLoader);
  //>>includeEnd('debug');

  const cacheKey = resourceLoader.cacheKey;
  const cacheEntry = ResourceCache.cacheEntries[cacheKey];

  //>>includeStart('debug', pragmas.debug);
  if (!defined(cacheEntry)) {
    throw new DeveloperError(`Resource is not in the cache: ${cacheKey}`);
  }
  //>>includeEnd('debug');

  --cacheEntry.referenceCount;

  if (cacheEntry.referenceCount === 0) {
    ResourceCache.statistics.removeLoader(resourceLoader);
    resourceLoader.destroy();
    delete ResourceCache.cacheEntries[cacheKey];
  }
};

/**
 * 从缓存中获取现有的模式加载器，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} [options.schema] 明确定义模式 JSON 的对象。与 options.resource 互斥。
 * @param {Resource} [options.resource] 指向模式 JSON 的 {@link Resource}。与 options.schema 互斥。
 *
 * @returns {MetadataSchemaLoader} The 缓存中的模式资源。
 *
 * @exception {DeveloperError} One 必须定义 options.schema 和 options.resource。
 * @private
 */
ResourceCache.getSchemaLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { schema, resource } = options;

  //>>includeStart('debug', pragmas.debug);
  if (defined(schema) === defined(resource)) {
    throw new DeveloperError(
      "One of options.schema and options.resource must be defined.",
    );
  }
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getSchemaCacheKey({
    schema: schema,
    resource: resource,
  });

  let schemaLoader = ResourceCache.get(cacheKey);
  if (defined(schemaLoader)) {
    return schemaLoader;
  }

  schemaLoader = new MetadataSchemaLoader({
    schema: schema,
    resource: resource,
    cacheKey: cacheKey,
  });

  return ResourceCache.add(schemaLoader);
};

/**
 * 从缓存中获取现有的嵌入缓冲区加载器，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Resource} options.parentResource 包含嵌入缓冲区的 {@link Resource}。
 * @param {number} options.bufferId 嵌入缓冲区在父资源中的唯一标识符。
 * @param {Uint8Array} [options.typedArray] 包含嵌入缓冲区内容的类型数组。
 *
 * @returns {BufferLoader} The 缓存中的缓冲区加载器。
 * @private
 */
ResourceCache.getEmbeddedBufferLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { parentResource, bufferId, typedArray } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.parentResource", parentResource);
  Check.typeOf.number("options.bufferId", bufferId);
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getEmbeddedBufferCacheKey({
    parentResource: parentResource,
    bufferId: bufferId,
  });

  let bufferLoader = ResourceCache.get(cacheKey);
  if (defined(bufferLoader)) {
    return bufferLoader;
  }

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.typedArray", typedArray);
  //>>includeEnd('debug');

  bufferLoader = new BufferLoader({
    typedArray: typedArray,
    cacheKey: cacheKey,
  });

  return ResourceCache.add(bufferLoader);
};

/**
 * 从缓存中获取现有的外部缓冲区，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Resource} options.resource 指向外部缓冲区的 {@link Resource}。
 *
 * @returns {BufferLoader} The 缓存中的缓冲区加载器。
 * @private
 */
ResourceCache.getExternalBufferLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { resource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.resource", resource);
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getExternalBufferCacheKey({
    resource: resource,
  });

  let bufferLoader = ResourceCache.get(cacheKey);
  if (defined(bufferLoader)) {
    return bufferLoader;
  }

  bufferLoader = new BufferLoader({
    resource: resource,
    cacheKey: cacheKey,
  });

  return ResourceCache.add(bufferLoader);
};

/**
 * 从缓存中获取现有的 glTF JSON 加载器，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中路径所基于的 {@link Resource}。
 * @param {Uint8Array} [options.typedArray] 包含 glTF 内容的类型数组。
 * @param {object} [options.gltfJson] 解析后的 glTF JSON 内容。
 *
 * @returns {GltfJsonLoader} The 缓存中的 glTF JSON 加载器。
 * @private
 */
ResourceCache.getGltfJsonLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltfResource, baseResource, typedArray, gltfJson } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getGltfCacheKey({
    gltfResource: gltfResource,
  });

  let gltfJsonLoader = ResourceCache.get(cacheKey);
  if (defined(gltfJsonLoader)) {
    return gltfJsonLoader;
  }

  gltfJsonLoader = new GltfJsonLoader({
    resourceCache: ResourceCache,
    gltfResource: gltfResource,
    baseResource: baseResource,
    typedArray: typedArray,
    gltfJson: gltfJson,
    cacheKey: cacheKey,
  });

  return ResourceCache.add(gltfJsonLoader);
};

/**
 * 从缓存中获取现有的 glTF 缓冲区视图，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON。
 * @param {number} options.bufferViewId 缓冲区视图 ID。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中路径所基于的 {@link Resource}。
 *
 * @returns {GltfBufferViewLoader} The 缓存中的缓冲区视图加载器。
 * @private
 */
ResourceCache.getBufferViewLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, bufferViewId, gltfResource, baseResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.number("options.bufferViewId", bufferViewId);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getBufferViewCacheKey({
    gltf: gltf,
    bufferViewId: bufferViewId,
    gltfResource: gltfResource,
    baseResource: baseResource,
  });

  let bufferViewLoader = ResourceCache.get(cacheKey);
  if (defined(bufferViewLoader)) {
    return bufferViewLoader;
  }

  bufferViewLoader = new GltfBufferViewLoader({
    resourceCache: ResourceCache,
    gltf: gltf,
    bufferViewId: bufferViewId,
    gltfResource: gltfResource,
    baseResource: baseResource,
    cacheKey: cacheKey,
  });

  return ResourceCache.add(bufferViewLoader);
};

/**
 * 从缓存中获取现有的 Draco 数据，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON 文件。
 * @param {object} options.primitive 包含 Draco 扩展的基元。
 * @param {object} options.draco Draco 扩展对象。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource glTF JSON 中路径相对于的 {@link Resource}。
 *
 * @returns {GltfDracoLoader} The 缓存中的 Draco 加载器。
 * @private
 */
ResourceCache.getDracoLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, primitive, draco, gltfResource, baseResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.primitive", primitive);
  Check.typeOf.object("options.draco", draco);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getDracoCacheKey({
    gltf: gltf,
    draco: draco,
    gltfResource: gltfResource,
    baseResource: baseResource,
  });

  let dracoLoader = ResourceCache.get(cacheKey);
  if (defined(dracoLoader)) {
    return dracoLoader;
  }

  dracoLoader = new GltfDracoLoader({
    resourceCache: ResourceCache,
    gltf: gltf,
    primitive: primitive,
    draco: draco,
    gltfResource: gltfResource,
    baseResource: baseResource,
    cacheKey: cacheKey,
  });

  return ResourceCache.add(dracoLoader);
};

/**
 * 从缓存中获取现有的 SPZ 加载器，如果不存在则创建新的加载器。
 * 此加载器用于解码 glTF 中的 SPZ（Splat Point Cloud）数据。
 * 
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON 文件。
 * @param {object} options.primitive 包含 SPZ 扩展的基元。
 * @param {object} options.spz SPZ 扩展对象。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource glTF JSON 中路径相对于的 {@link Resource}。
 *
 * @return {GltfSpzLoader} The 缓存中的 SPZ 加载器。
 @private
 * */
ResourceCache.getSpzLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, primitive, spz, gltfResource, baseResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.primitive", primitive);
  Check.typeOf.object("options.spz", spz);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getSpzCacheKey({
    gltf: gltf,
    spz: spz,
    gltfResource: gltfResource,
    baseResource: baseResource,
  });

  let spzLoader = ResourceCache.get(cacheKey);
  if (defined(spzLoader)) {
    return spzLoader;
  }

  spzLoader = new GltfSpzLoader({
    resourceCache: ResourceCache,
    gltf: gltf,
    primitive: primitive,
    spz: spz,
    gltfResource: gltfResource,
    baseResource: baseResource,
    cacheKey: cacheKey,
  });

  return ResourceCache.add(spzLoader);
};

/**
 * 从缓存中获取现有的 glTF 顶点缓冲区，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON 文件。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource glTF JSON 中路径相对于的 {@link Resource}。
 * @param {FrameState} options.frameState 帧状态。
 * @param {number} [options.bufferViewId] 与顶点缓冲区对应的 bufferView ID。
 * @param {object} [options.primitive] 包含 Draco 扩展的基元。
 * @param {object} [options.draco] Draco 扩展对象。
 * @param {object} [options.spz] SPZ 扩展对象。
 * @param {string} [options.attributeSemantic] 属性语义，例如 POSITION 或 NORMAL。
 * @param {number} [options.accessorId] 访问器 ID。
 * @param {boolean} [options.asynchronous=true] 决定 WebGL 资源创建是否会在多个帧中逐步进行，直到所有 WebGL 资源都被创建。
 * @param {boolean} [options.dequantize=false] 决定顶点缓冲区是否将在 CPU 上去量化。
 * @param {boolean} [options.loadBuffer=false] 将顶点缓冲区加载为 GPU 顶点缓冲区。
 * @param {boolean} [options.loadTypedArray=false] 将顶点缓冲区加载为类型数组。
 * @exception {DeveloperError} Exactly 必须有一个有效的顶点缓冲区源：options.bufferViewId、options.spz 或 options.draco，对应 options.attributeSemantic。
 * @exception {DeveloperError} When 必须定义 options.draco，并且必须定义 options.attributeSemantic。
 * @exception {DeveloperError} When 必须定义 options.draco，并且必须定义 options.accessorId。
 *
 * @returns {GltfVertexBufferLoader} The 缓存中的顶点缓冲区加载器。
 * @private
 */
ResourceCache.getVertexBufferLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    gltf,
    gltfResource,
    baseResource,
    frameState,
    bufferViewId,
    primitive,
    draco,
    spz,
    attributeSemantic,
    accessorId,
    asynchronous = true,
    dequantize = false,
    loadBuffer = false,
    loadTypedArray = false,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  Check.typeOf.object("options.frameState", frameState);
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
      "When options.draco is defined options.hasAccessorId must also be defined.",
    );
  }

  if (hasDraco && !hasPrimitive) {
    throw new DeveloperError(
      "When options.draco is defined options.primitive must also be defined.",
    );
  }

  if (hasDraco) {
    Check.typeOf.object("options.draco", draco);
    Check.typeOf.string("options.attributeSemantic", attributeSemantic);
    Check.typeOf.number("options.accessorId", accessorId);
  }

  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getVertexBufferCacheKey({
    gltf: gltf,
    gltfResource: gltfResource,
    baseResource: baseResource,
    frameState: frameState,
    bufferViewId: bufferViewId,
    draco: draco,
    spz: spz,
    attributeSemantic: attributeSemantic,
    dequantize: dequantize,
    loadBuffer: loadBuffer,
    loadTypedArray: loadTypedArray,
  });

  let vertexBufferLoader = ResourceCache.get(cacheKey);
  if (defined(vertexBufferLoader)) {
    return vertexBufferLoader;
  }

  vertexBufferLoader = new GltfVertexBufferLoader({
    resourceCache: ResourceCache,
    gltf: gltf,
    gltfResource: gltfResource,
    baseResource: baseResource,
    bufferViewId: bufferViewId,
    primitive: primitive,
    draco: draco,
    spz: spz,
    attributeSemantic: attributeSemantic,
    accessorId: accessorId,
    cacheKey: cacheKey,
    asynchronous: asynchronous,
    dequantize: dequantize,
    loadBuffer: loadBuffer,
    loadTypedArray: loadTypedArray,
  });

  return ResourceCache.add(vertexBufferLoader);
};

function hasDracoCompression(draco, semantic) {
  return (
    defined(draco) &&
    defined(draco.attributes) &&
    defined(draco.attributes[semantic])
  );
}

/**
 * 从缓存中获取现有的 glTF 索引缓冲区，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON 文件。
 * @param {number} options.accessorId 与索引缓冲区对应的访问器 ID。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource glTF JSON 中路径相对于的 {@link Resource}。
 * @param {FrameState} options.frameState 帧状态。
 * @param {object} [options.primitive] 包含 Draco 扩展的基元。
 * @param {object} [options.draco] Draco 扩展对象。
 * @param {boolean} [options.asynchronous=true] 决定 WebGL 资源创建是否会在多个帧中逐步进行，或一次性完成，直到所有 WebGL 资源都被创建。
 * @param {boolean} [options.loadBuffer=false] 将索引缓冲区加载为 GPU 索引缓冲区。
 * @param {boolean} [options.loadTypedArray=false] 将索引缓冲区加载为类型数组。
 * @returns {GltfIndexBufferLoader} The 缓存的索引缓冲区加载器。
 * @private
 */
ResourceCache.getIndexBufferLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    gltf,
    accessorId,
    gltfResource,
    baseResource,
    frameState,
    primitive,
    draco,
    asynchronous = true,
    loadBuffer = false,
    loadTypedArray = false,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.number("options.accessorId", accessorId);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  Check.typeOf.object("options.frameState", frameState);
  if (!loadBuffer && !loadTypedArray) {
    throw new DeveloperError(
      "At least one of loadBuffer and loadTypedArray must be true.",
    );
  }
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getIndexBufferCacheKey({
    gltf: gltf,
    accessorId: accessorId,
    gltfResource: gltfResource,
    baseResource: baseResource,
    frameState: frameState,
    draco: draco,
    loadBuffer: loadBuffer,
    loadTypedArray: loadTypedArray,
  });

  let indexBufferLoader = ResourceCache.get(cacheKey);
  if (defined(indexBufferLoader)) {
    return indexBufferLoader;
  }

  indexBufferLoader = new GltfIndexBufferLoader({
    resourceCache: ResourceCache,
    gltf: gltf,
    accessorId: accessorId,
    gltfResource: gltfResource,
    baseResource: baseResource,
    primitive: primitive,
    draco: draco,
    cacheKey: cacheKey,
    asynchronous: asynchronous,
    loadBuffer: loadBuffer,
    loadTypedArray: loadTypedArray,
  });

  return ResourceCache.add(indexBufferLoader);
};

/**
 * 从缓存中获取现有的 glTF 图像，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON 文件。
 * @param {number} options.imageId 图像 ID。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中相对路径所指向的 {@link Resource}。
 *
 * @returns {GltfImageLoader} The 缓存的图像加载器。
 * @private
 */
ResourceCache.getImageLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, imageId, gltfResource, baseResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.number("options.imageId", imageId);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getImageCacheKey({
    gltf: gltf,
    imageId: imageId,
    gltfResource: gltfResource,
    baseResource: baseResource,
  });

  let imageLoader = ResourceCache.get(cacheKey);
  if (defined(imageLoader)) {
    return imageLoader;
  }

  imageLoader = new GltfImageLoader({
    resourceCache: ResourceCache,
    gltf: gltf,
    imageId: imageId,
    gltfResource: gltfResource,
    baseResource: baseResource,
    cacheKey: cacheKey,
  });

  return ResourceCache.add(imageLoader);
};

/**
 * 从缓存中获取现有的 glTF 纹理，如果不存在则创建新的加载器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON 文件。
 * @param {object} options.textureInfo 纹理信息对象。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中相对路径所指向的 {@link Resource}。
 * @param {SupportedImageFormats} options.supportedImageFormats 支持的图像格式。
 * @param {FrameState} options.frameState 帧状态。
 * @param {boolean} [options.asynchronous=true] 决定 WebGL 资源创建是否会在多个帧中逐步进行，或一次性完成，直到所有 WebGL 资源都被创建。
 *
 * @returns {GltfTextureLoader} The 缓存的纹理加载器。
 * @private
 */
ResourceCache.getTextureLoader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    gltf,
    textureInfo,
    gltfResource,
    baseResource,
    supportedImageFormats,
    frameState,
    asynchronous = true,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.textureInfo", textureInfo);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  Check.typeOf.object("options.supportedImageFormats", supportedImageFormats);
  Check.typeOf.object("options.frameState", frameState);
  //>>includeEnd('debug');

  const cacheKey = ResourceCacheKey.getTextureCacheKey({
    gltf: gltf,
    textureInfo: textureInfo,
    gltfResource: gltfResource,
    baseResource: baseResource,
    supportedImageFormats: supportedImageFormats,
    frameState: frameState,
  });

  let textureLoader = ResourceCache.get(cacheKey);
  if (defined(textureLoader)) {
    return textureLoader;
  }

  textureLoader = new GltfTextureLoader({
    resourceCache: ResourceCache,
    gltf: gltf,
    textureInfo: textureInfo,
    gltfResource: gltfResource,
    baseResource: baseResource,
    supportedImageFormats: supportedImageFormats,
    cacheKey: cacheKey,
    asynchronous: asynchronous,
  });

  return ResourceCache.add(textureLoader);
};

/**
 * 从缓存中卸载所有内容。此操作用于单元测试。
 *
 * @private
 */
ResourceCache.clearForSpecs = function () {
  // Unload in the order below. This prevents an unload function from unloading
  // a resource that has already been unloaded.
  const precedence = [
    GltfVertexBufferLoader,
    GltfIndexBufferLoader,
    GltfDracoLoader,
    GltfTextureLoader,
    GltfImageLoader,
    GltfBufferViewLoader,
    BufferLoader,
    MetadataSchemaLoader,
    GltfJsonLoader,
  ];

  let cacheKey;
  const cacheEntries = ResourceCache.cacheEntries;

  const cacheEntriesSorted = [];
  for (cacheKey in cacheEntries) {
    if (cacheEntries.hasOwnProperty(cacheKey)) {
      cacheEntriesSorted.push(cacheEntries[cacheKey]);
    }
  }

  cacheEntriesSorted.sort(function (a, b) {
    const indexA = precedence.indexOf(a.resourceLoader.constructor);
    const indexB = precedence.indexOf(b.resourceLoader.constructor);
    return indexA - indexB;
  });

  const cacheEntriesLength = cacheEntriesSorted.length;
  for (let i = 0; i < cacheEntriesLength; ++i) {
    const cacheEntry = cacheEntriesSorted[i];
    cacheKey = cacheEntry.resourceLoader.cacheKey;
    if (defined(cacheEntries[cacheKey])) {
      cacheEntry.resourceLoader.destroy();
      delete cacheEntries[cacheKey];
    }
  }

  ResourceCache.statistics.clear();
};

export default ResourceCache;
