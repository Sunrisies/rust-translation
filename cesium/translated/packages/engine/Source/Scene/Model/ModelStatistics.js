import { AssociativeArray, Check } from "@cesium/core";

/**
 * 单个模型的渲染统计信息。
 *
 * @alias ModelStatistics
 * @constructor
 *
 * @see Cesium3DTilesetStatistics
 *
 * @private
 */
function ModelStatistics() {
  /**
   * 该模型中所有 POINTS 原语的总点数。
   *
   * @type {number}
   * @private
   */
  this.pointsLength = 0;

  /**
   * 该模型中所有 TRIANGLE、TRIANGLE_STRIP 或
   * TRIANGLE_FAN 原语的总三角形数。
   *
   * @type {number}
   * @private
   */
  this.trianglesLength = 0;

  /**
   * 所有几何缓冲区的总大小（以字节为单位）。这包含了顶点
   * 属性（包括特征 ID 和属性属性）以及索引
   * 缓冲区。管道生成的任何属性均包含在此总数中。
   * 所有纹理的总大小（以字节为单位）。这包括材质纹理、
   *
   * @type {number}
   * @private
   */
  this.geometryByteLength = 0;

  /**
   * Total size of all textures in bytes. This includes materials,
   * 特征 ID 纹理和属性纹理。
   *
   * @type {number}
   * @private
   */
  this.texturesByteLength = 0;

  /**
   * 属性表的总大小。这排除了用于选择和样式化的批量纹理。
   * `texture.id` 字符串与相应纹理的字节长度之间的映射关系。
   *
   * @type {number}
   * @private
   */
  this.propertyTablesByteLength = 0;

  // Sets of buffers and textures that have already been counted.
  // This is to prevent double-counting cached assets.
  this._bufferIdSet = {};

  /**
   * 用于确保内存值准确，对用于选择的批量纹理进行迭代计算。
   * 此模型的内存计数。每次重建绘制命令管道时都应调用此操作。
   *
   * @type {object}
   * @private
   */
  this._textureIdByteLengths = {};

  // Associated array of batch textures that have already been counted.
  // This allows for quick look-up to check if a texture has been counted,
  // while also allowing for dynamic texture counting.
  this._batchTextureIdMap = new AssociativeArray();
}

Object.defineProperties(ModelStatistics.prototype, {
  /**
   * 用于选择和样式化的批量纹理的总大小。
   * 批量纹理是异步创建的，因此此处遍历所有纹理以确保其内存值准确。
   * 重置该模型的内存计数。每次重建绘制命令管道时都应执行此操作。
   *
   * @memberof ModelStatistics.prototype
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  batchTexturesByteLength: {
    get: function () {
      const length = this._batchTextureIdMap.length;
      const values = this._batchTextureIdMap.values;

      let memory = 0;
      for (let i = 0; i < length; i++) {
        memory += values[i].byteLength;
      }

      return memory;
    },
  },
});

/**
 * 统计给定缓冲区的内存大小（以字节为单位）。如果某个缓冲区已
 * 被这些统计信息统计过，则不会再次统计。
 *
 * @private
 */
ModelStatistics.prototype.clear = function () {
  this.pointsLength = 0;
  this.trianglesLength = 0;
  this.geometryByteLength = 0;
  this.texturesByteLength = 0;
  this.propertyTablesByteLength = 0;

  this._bufferIdSet = {};
  this._textureIdByteLengths = {};
  this._batchTextureIdMap.removeAll();
};

/**
 * 统计给定缓冲区的内存大小（以字节为单位）。如果某个缓冲区已
 * 被这些统计信息统计过，则不会再次统计。
 * 与模型相关的 GPU 缓冲区。
 *
 * @param {Buffer} buffer 缓冲区是否通过类型数组在 CPU 上存在副本。
 * @param {boolean} hasCpuCopy 统计给定纹理的内存大小（以字节为单位）。如果某个纹理已
 *
 * @private
 */
ModelStatistics.prototype.addBuffer = function (buffer, hasCpuCopy) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  Check.typeOf.bool("hasCpuCopy", hasCpuCopy);
  //>>includeEnd('debug');

  if (!this._bufferIdSet.hasOwnProperty(buffer._id)) {
    // If there's a CPU copy, count the memory twice.
    const copies = hasCpuCopy ? 2 : 1;
    this.geometryByteLength += buffer.sizeInBytes * copies;
  }

  // Simulate set insertion.
  this._bufferIdSet[buffer._id] = true;
};

/**
 * 被这些统计信息统计过，则不会再次统计。
 * 与模型相关的纹理 ID。
 * 纹理字节长度。
 * <p>
 * 用于统计模型的材质和属性纹理数量。批量纹理的处理方式不同，使用
 * `addBatchTexture` 进行统计。
 * 与模型相关的纹理。
 * </p>
 *
 * @param {Texture} texture 与模型相关的纹理。
 *
 * @private
 */
ModelStatistics.prototype.addTexture = function (texture) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("texture", texture);
  //>>includeEnd('debug');

  if (!this._textureIdByteLengths.hasOwnProperty(texture._id)) {
    this.texturesByteLength += texture.sizeInBytes;
    this._textureIdByteLengths[texture._id] = texture.sizeInBytes;
  }
};

/**
 * 返回一个数组，包含模型中所有纹理的 `texture.id` 值。
 * 属于该模型的纹理。
 *
 * @returns {string[]} The 纹理 ID。
 */
ModelStatistics.prototype.getTextureIds = function () {
  return Object.keys(this._textureIdByteLengths);
};

/**
 * 返回属于该模型的具有给定 ID 的纹理数据长度（以字节为单位），如果模型
 * 不包含该 ID 的纹理，则返回 `undefined`。
 * 纹理 ID。
 *
 * @param {string} textureId 纹理 ID。
 * @returns {number|undefined} The 纹理字节长度。
 */
ModelStatistics.prototype.getTextureByteLengthById = function (textureId) {
  return this._textureIdByteLengths[textureId];
};

/**
 * 统计批量纹理的内存大小（以字节为单位）。如果某个批量纹理已
 * 被这些统计信息统计过，则不会再次统计。
 * 统计次数。
 * <p>
 * 批量纹理的处理方式与其他纹理不同。它们包含用于特征表的批量
 * 和选择纹理，这些纹理是动态创建的。因此，它们可能不包含两种纹理。
 * are created dynamically. As such, they may not have both textures
 * 在它们被加入统计时才会加载。它们的内存
 * 因此会动态地被计算。
 * </p>
 *
 * @param {BatchTexture} batchTexture 与模型相关的批量纹理。
 *
 * @private
 */
ModelStatistics.prototype.addBatchTexture = function (batchTexture) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("batchTexture", batchTexture);
  //>>includeEnd('debug');

  if (!this._batchTextureIdMap.contains(batchTexture._id)) {
    this._batchTextureIdMap.set(batchTexture._id, batchTexture);
  }
};

export default ModelStatistics;
