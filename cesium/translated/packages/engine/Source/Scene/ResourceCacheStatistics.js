import { Check, defined } from "@cesium/core";

/**
 * 通过加载的模型使用的 GPU 和 CPU 内存统计信息
 * {@link ResourceCache}。
 *
 * @alias ResourceCacheStatistics
 * @constructor
 *
 * @internal
 */
function ResourceCacheStatistics() {
  /**
   * 缓存中加载的顶点缓冲区和索引缓冲区的大小，以字节为单位。
   *
   * @type {number}
   * @private
   */
  this.geometryByteLength = 0;

  /**
   * 缓存中加载的所有纹理的大小，以字节为单位。
   *
   * @type {number}
   * @private
   */
  this.texturesByteLength = 0;

  // Track the sizes of resources by cache key. This is important so
  // removeLoader() can decrement the counts correctly.
  this._geometrySizes = {};
  this._textureSizes = {};
}

/**
 * 重置内存计数
 *
 * @private
 */
ResourceCacheStatistics.prototype.clear = function () {
  this.geometryByteLength = 0;
  this.texturesByteLength = 0;

  this._geometrySizes = {};
  this._textureSizes = {};
};

/**
 * 跟踪顶点或索引缓冲区加载器的资源。应在加载器准备完成且
 * 已加载和处理后调用此方法。
 * 此方法能妥善处理以下情况：
 * <ul>
 * <li>如果添加了两次加载器，其资源不会被重复计数</li>
 * <li>如果几何数据包含 GPU 缓冲区的 CPU 副本，则会被计入计数</li>
 * </ul>
 * @param {GltfVertexBufferLoader|GltfIndexBufferLoader} loader 需要跟踪资源的几何缓冲区
 *
 * @private
 */
ResourceCacheStatistics.prototype.addGeometryLoader = function (loader) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("loader", loader);
  //>>includeEnd('debug');

  const cacheKey = loader.cacheKey;

  // Don't double count the same resource.
  if (this._geometrySizes.hasOwnProperty(cacheKey)) {
    return;
  }

  this._geometrySizes[cacheKey] = 0;

  const buffer = loader.buffer;
  const typedArray = loader.typedArray;

  let totalSize = 0;

  if (defined(buffer)) {
    totalSize += buffer.sizeInBytes;
  }

  if (defined(typedArray)) {
    totalSize += typedArray.byteLength;
  }

  this.geometryByteLength += totalSize;
  this._geometrySizes[cacheKey] = totalSize;
};

/**
 * 跟踪纹理加载器的资源。应在加载器准备完成且
 * 已加载和处理后调用此方法。
 * 如果添加了两次加载器，其资源不会被重复计数。
 *
 * @param {GltfTextureLoader} loader 需要跟踪资源的纹理加载器
 *
 * @private
 */
ResourceCacheStatistics.prototype.addTextureLoader = function (loader) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("loader", loader);
  //>>includeEnd('debug');

  const cacheKey = loader.cacheKey;

  // Don't double count the same resource.
  if (this._textureSizes.hasOwnProperty(cacheKey)) {
    return;
  }

  this._textureSizes[cacheKey] = 0;
  const totalSize = loader.texture.sizeInBytes;
  this.texturesByteLength += loader.texture.sizeInBytes;
  this._textureSizes[cacheKey] = totalSize;
};

/**
 * 从内存计数中移除加载器的资源。加载器的缓存键
 * 用于确定资源信息，因此此方法可用于
 * 几何数据和纹理。如果加载器没有被跟踪的资源，
 * 则此操作无效果。
 * @param {ResourceLoader} loader 要从缓存中移除的资源加载器
 *
 * @private
 */
ResourceCacheStatistics.prototype.removeLoader = function (loader) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("loader", loader);
  //>>includeEnd('debug');

  const cacheKey = loader.cacheKey;
  const geometrySize = this._geometrySizes[cacheKey];
  delete this._geometrySizes[cacheKey];

  if (defined(geometrySize)) {
    this.geometryByteLength -= geometrySize;
  }

  const textureSize = this._textureSizes[cacheKey];
  delete this._textureSizes[cacheKey];

  if (defined(textureSize)) {
    this.texturesByteLength -= textureSize;
  }
};

export default ResourceCacheStatistics;
