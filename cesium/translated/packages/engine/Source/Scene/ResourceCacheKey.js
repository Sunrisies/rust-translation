import {
  Check,
  DeveloperError,
  Frozen,
  defined,
  getAbsoluteUri,
} from "@cesium/core";
import findMeshoptExtension from "./findMeshoptExtension.js";
import GltfLoaderUtil from "./GltfLoaderUtil.js";

/**
 * 为 {@link ResourceCache} 中的资源计算缓存键。
 *
 * @namespace ResourceCacheKey
 *
 * @private
 */
const ResourceCacheKey = {};

function getExternalResourceCacheKey(resource) {
  return getAbsoluteUri(resource.url);
}

function getBufferViewCacheKey(bufferView) {
  let { byteOffset, byteLength } = bufferView;

  const meshopt = findMeshoptExtension(bufferView);
  if (defined(meshopt)) {
    byteOffset = meshopt.byteOffset ?? 0;
    byteLength = meshopt.byteLength;
  }

  return `${byteOffset}-${byteOffset + byteLength}`;
}

function getAccessorCacheKey(accessor, bufferView) {
  const byteOffset = bufferView.byteOffset + accessor.byteOffset;
  const { componentType, type, count } = accessor;
  return `${byteOffset}-${componentType}-${type}-${count}`;
}

function getEmbeddedBufferCacheKey(parentResource, bufferId) {
  const parentCacheKey = getExternalResourceCacheKey(parentResource);
  return `${parentCacheKey}-buffer-id-${bufferId}`;
}

function getBufferCacheKey(buffer, bufferId, gltfResource, baseResource) {
  if (defined(buffer.uri)) {
    const resource = baseResource.getDerivedResource({
      url: buffer.uri,
    });
    return getExternalResourceCacheKey(resource);
  }

  return getEmbeddedBufferCacheKey(gltfResource, bufferId);
}

function getDracoCacheKey(gltf, draco, gltfResource, baseResource) {
  const bufferViewId = draco.bufferView;
  const bufferView = gltf.bufferViews[bufferViewId];
  const bufferId = bufferView.buffer;
  const buffer = gltf.buffers[bufferId];

  const bufferCacheKey = getBufferCacheKey(
    buffer,
    bufferId,
    gltfResource,
    baseResource,
  );

  const bufferViewCacheKey = getBufferViewCacheKey(bufferView);

  return `${bufferCacheKey}-range-${bufferViewCacheKey}`;
}

function getSpzCacheKey(gltf, spz, gltfResource, baseResource) {
  const bufferViewId = spz.bufferView;
  const bufferView = gltf.bufferViews[bufferViewId];
  const bufferId = bufferView.buffer;
  const buffer = gltf.buffers[bufferId];

  const bufferCacheKey = getBufferCacheKey(
    buffer,
    bufferId,
    gltfResource,
    baseResource,
  );

  const bufferViewCacheKey = getBufferViewCacheKey(bufferView);

  return `${bufferCacheKey}-range-${bufferViewCacheKey}`;
}

function getImageCacheKey(gltf, imageId, gltfResource, baseResource) {
  const image = gltf.images[imageId];
  const bufferViewId = image.bufferView;
  const uri = image.uri;

  if (defined(uri)) {
    const resource = baseResource.getDerivedResource({
      url: uri,
    });
    return getExternalResourceCacheKey(resource);
  }

  const bufferView = gltf.bufferViews[bufferViewId];
  const bufferId = bufferView.buffer;
  const buffer = gltf.buffers[bufferId];

  const bufferCacheKey = getBufferCacheKey(
    buffer,
    bufferId,
    gltfResource,
    baseResource,
  );

  const bufferViewCacheKey = getBufferViewCacheKey(bufferView);

  return `${bufferCacheKey}-range-${bufferViewCacheKey}`;
}

function getSamplerCacheKey(gltf, textureInfo) {
  const sampler = GltfLoaderUtil.createSampler({
    gltf: gltf,
    textureInfo: textureInfo,
  });

  return `${sampler.wrapS}-${sampler.wrapT}-${sampler.minificationFilter}-${sampler.magnificationFilter}`;
}

/**
 * 获取模式缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} [options.schema] 明确定义 JSON 模式的对象。与 options.resource 互斥。
 * @param {Resource} [options.resource] 指向 JSON 模式的 {@link Resource}。与 options.schema 互斥。
 *
 * @returns {string} The 模式缓存键。
 *
 * @exception {DeveloperError} One 必须定义 options.schema 和 options.resource。
 * @private
 */
ResourceCacheKey.getSchemaCacheKey = function (options) {
  const { schema, resource } = options;

  //>>includeStart('debug', pragmas.debug);
  if (defined(schema) === defined(resource)) {
    throw new DeveloperError(
      "One of options.schema and options.resource must be defined.",
    );
  }
  //>>includeEnd('debug');

  if (defined(schema)) {
    return `embedded-schema:${JSON.stringify(schema)}`;
  }

  return `external-schema:${getExternalResourceCacheKey(resource)}`;
};

/**
 * 获取外部缓冲区缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Resource} options.resource 指向外部缓冲区的 {@link Resource}。
 *
 * @returns {string} The 外部缓冲区缓存键。
 * @private
 */
ResourceCacheKey.getExternalBufferCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { resource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.resource", resource);
  //>>includeEnd('debug');

  return `external-buffer:${getExternalResourceCacheKey(resource)}`;
};

/**
 * 获取嵌入式缓冲区缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Resource} options.parentResource 包含嵌入式缓冲区的 {@link Resource}。
 * @param {number} options.bufferId 嵌入式缓冲区在父资源中的唯一标识符。
 *
 * @returns {string} The 嵌入式缓冲区缓存键。
 * @private
 */
ResourceCacheKey.getEmbeddedBufferCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { parentResource, bufferId } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.parentResource", parentResource);
  Check.typeOf.number("options.bufferId", bufferId);
  //>>includeEnd('debug');

  return `embedded-buffer:${getEmbeddedBufferCacheKey(
    parentResource,
    bufferId,
  )}`;
};

/**
 * 获取 glTF 缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 *
 * @returns {string} The glTF 缓存键。
 * @private
 */
ResourceCacheKey.getGltfCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltfResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltfResource", gltfResource);
  //>>includeEnd('debug');

  return `gltf:${getExternalResourceCacheKey(gltfResource)}`;
};

/**
 * 获取缓冲区视图缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON。
 * @param {number} options.bufferViewId 缓冲区视图 ID。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中路径所基于的 {@link Resource}。
 *
 * @returns {string} The 缓冲区视图缓存键。
 * @private
 */
ResourceCacheKey.getBufferViewCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, bufferViewId, gltfResource, baseResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.number("options.bufferViewId", bufferViewId);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  const bufferView = gltf.bufferViews[bufferViewId];
  let bufferId = bufferView.buffer;
  const buffer = gltf.buffers[bufferId];
  const meshopt = findMeshoptExtension(bufferView);
  if (defined(meshopt)) {
    bufferId = meshopt.buffer;
  }

  const bufferCacheKey = getBufferCacheKey(
    buffer,
    bufferId,
    gltfResource,
    baseResource,
  );

  const bufferViewCacheKey = getBufferViewCacheKey(bufferView);

  return `buffer-view:${bufferCacheKey}-range-${bufferViewCacheKey}`;
};

/**
 * 获取 Draco 缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON。
 * @param {object} options.draco Draco 扩展对象。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中路径所基于的 {@link Resource}。
 *
 * @returns {string} The Draco 缓存键。
 * @private
 */
ResourceCacheKey.getDracoCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, draco, gltfResource, baseResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.draco", draco);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  return `draco:${getDracoCacheKey(gltf, draco, gltfResource, baseResource)}`;
};

ResourceCacheKey.getSpzCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, spz, gltfResource, baseResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.spz", spz);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  return `spz:${getSpzCacheKey(gltf, spz, gltfResource, baseResource)}`;
};
/**
 * 获取顶点缓冲区缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中路径所基于的 {@link Resource}。
 * @param {FrameState} options.frameState 帧状态。
 * @param {number} [options.bufferViewId] 与顶点缓冲区对应的缓冲区视图 ID。
 * @param {object} [options.draco] Draco 扩展对象。
 * @param {object} [options.spz] SPZ 扩展对象。
 * @param {string} [options.attributeSemantic] 属性语义，例如 POSITION 或 NORMAL。
 * @param {boolean} [options.dequantize=false] 决定顶点缓冲区是否将在 CPU 上去量化。
 * @param {boolean} [options.loadBuffer=false] 将顶点缓冲区加载为 GPU 顶点缓冲区。
 * @param {boolean} [options.loadTypedArray=false] 将顶点缓冲区加载为类型数组。
 * @exception {DeveloperError} Exactly 必须有一个有效的顶点缓冲区源：options.bufferViewId、options.spz 或 options.draco，对应 options.attributeSemantic。
 * @exception {DeveloperError} When 必须定义 options.draco，并且必须定义 options.attributeSemantic。
 *
 * @returns {string} The 顶点缓冲区缓存键。
 * @private
 */
ResourceCacheKey.getVertexBufferCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    gltf,
    gltfResource,
    baseResource,
    frameState,
    bufferViewId,
    draco,
    spz,
    attributeSemantic,
    dequantize = false,
    loadBuffer = false,
    loadTypedArray = false,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  Check.typeOf.object("options.frameState", frameState);

  const hasBufferViewId = defined(bufferViewId);
  const hasDraco = hasDracoCompression(draco, attributeSemantic);
  const hasAttributeSemantic = defined(attributeSemantic);
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

  if (hasDraco) {
    Check.typeOf.object("options.draco", draco);
    Check.typeOf.string("options.attributeSemantic", attributeSemantic);
  }

  if (!loadBuffer && !loadTypedArray) {
    throw new DeveloperError(
      "At least one of loadBuffer and loadTypedArray must be true.",
    );
  }
  //>>includeEnd('debug');

  let cacheKeySuffix = "";
  if (dequantize) {
    cacheKeySuffix += "-dequantize";
  }

  if (loadBuffer) {
    cacheKeySuffix += "-buffer";
    cacheKeySuffix += `-context-${frameState.context.id}`;
  }

  if (loadTypedArray) {
    cacheKeySuffix += "-typed-array";
  }

  if (defined(spz)) {
    const spzCacheKey = getSpzCacheKey(gltf, spz, gltfResource, baseResource);
    return `vertex-buffer:${spzCacheKey}-spz-${attributeSemantic}${cacheKeySuffix}`;
  }

  if (defined(draco)) {
    const dracoCacheKey = getDracoCacheKey(
      gltf,
      draco,
      gltfResource,
      baseResource,
    );
    return `vertex-buffer:${dracoCacheKey}-draco-${attributeSemantic}${cacheKeySuffix}`;
  }

  const bufferView = gltf.bufferViews[bufferViewId];
  const bufferId = bufferView.buffer;
  const buffer = gltf.buffers[bufferId];

  const bufferCacheKey = getBufferCacheKey(
    buffer,
    bufferId,
    gltfResource,
    baseResource,
  );

  const bufferViewCacheKey = getBufferViewCacheKey(bufferView);

  return `vertex-buffer:${bufferCacheKey}-range-${bufferViewCacheKey}${cacheKeySuffix}`;
};

function hasDracoCompression(draco, semantic) {
  return (
    defined(draco) &&
    defined(draco.attributes) &&
    defined(draco.attributes[semantic])
  );
}

/**
 * 获取索引缓冲区缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON。
 * @param {number} options.accessorId 与索引缓冲区对应的访问器 ID。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中路径的 {@link Resource} 是相对路径的。
 * @param {FrameState} options.frameState 帧状态。
 * @param {object} [options.draco] Draco 扩展对象。
 * @param {boolean} [options.loadBuffer=false] 将索引缓冲区加载为 GPU 索引缓冲区。
 * @param {boolean} [options.loadTypedArray=false] 将索引缓冲区加载为类型数组。
 *
 * @returns {string} The 索引缓冲区缓存键。
 * @private
 */
ResourceCacheKey.getIndexBufferCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    gltf,
    accessorId,
    gltfResource,
    baseResource,
    frameState,
    draco,
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

  let cacheKeySuffix = "";
  if (loadBuffer) {
    cacheKeySuffix += "-buffer";
    cacheKeySuffix += `-context-${frameState.context.id}`;
  }

  if (loadTypedArray) {
    cacheKeySuffix += "-typed-array";
  }

  if (defined(draco)) {
    const dracoCacheKey = getDracoCacheKey(
      gltf,
      draco,
      gltfResource,
      baseResource,
    );
    return `index-buffer:${dracoCacheKey}-draco${cacheKeySuffix}`;
  }

  const accessor = gltf.accessors[accessorId];
  const bufferViewId = accessor.bufferView;
  const bufferView = gltf.bufferViews[bufferViewId];
  const bufferId = bufferView.buffer;
  const buffer = gltf.buffers[bufferId];

  const bufferCacheKey = getBufferCacheKey(
    buffer,
    bufferId,
    gltfResource,
    baseResource,
  );

  const accessorCacheKey = getAccessorCacheKey(accessor, bufferView);

  return `index-buffer:${bufferCacheKey}-accessor-${accessorCacheKey}${cacheKeySuffix}`;
};

/**
 * 获取图像缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON。
 * @param {number} options.imageId 图像 ID。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中路径的 {@link Resource} 是相对路径的。
 *
 * @returns {string} The 图像缓存键。
 * @private
 */
ResourceCacheKey.getImageCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, imageId, gltfResource, baseResource } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.number("options.imageId", imageId);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  //>>includeEnd('debug');

  const imageCacheKey = getImageCacheKey(
    gltf,
    imageId,
    gltfResource,
    baseResource,
  );

  return `image:${imageCacheKey}`;
};

/**
 * 获取纹理缓存键。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.gltf glTF JSON。
 * @param {object} options.textureInfo 纹理信息对象。
 * @param {Resource} options.gltfResource 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.baseResource 在 glTF JSON 中路径的 {@link Resource} 是相对路径的。
 * @param {SupportedImageFormats} options.supportedImageFormats 支持的图像格式。
 * @param {FrameState} options.frameState 帧状态。
 *
 * @returns {string} The 纹理缓存键。
 * @private
 */
ResourceCacheKey.getTextureCacheKey = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    gltf,
    textureInfo,
    gltfResource,
    baseResource,
    supportedImageFormats,
    frameState,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.textureInfo", textureInfo);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  Check.typeOf.object("options.supportedImageFormats", supportedImageFormats);
  Check.typeOf.object("options.frameState", frameState);
  //>>includeEnd('debug');

  const textureId = textureInfo.index;

  const imageId = GltfLoaderUtil.getImageIdFromTexture({
    gltf: gltf,
    textureId: textureId,
    supportedImageFormats: supportedImageFormats,
  });

  const imageCacheKey = getImageCacheKey(
    gltf,
    imageId,
    gltfResource,
    baseResource,
  );

  // Include the sampler cache key in the texture cache key since textures and
  // samplers are coupled in WebGL 1. When upgrading to WebGL 2 consider
  // removing the sampleCacheKey here.
  const samplerCacheKey = getSamplerCacheKey(gltf, textureInfo);

  return `texture:${imageCacheKey}-sampler-${samplerCacheKey}-context-${frameState.context.id}`;
};

export default ResourceCacheKey;
