import { DeveloperError } from "@cesium/core";

/**
 * 单个瓦片的地形数据。这种类型描述了一个
 * 接口，不用于直接实例化。
 *
 * @alias TerrainData
 * @constructor
 *
 * @see HeightmapTerrainData
 * @see QuantizedMeshTerrainData
 * @see GoogleEarthEnterpriseTerrainData
 * @see Cesium3DTilesTerrainData
 */
function TerrainData() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(TerrainData.prototype, {
  /**
   * 该瓦片的相关版权信息数组。
   * @memberof TerrainData.prototype
   * @type {Credit[]}
   */
  credits: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 包含在该地形数据中的水掩模，如有。水掩模是一个矩形
   * Uint8Array或图像，其中值 255 表示水域，值 0 表示陆地。
   * 0 到 255 之间的数值也被允许，用于平滑地过渡陆地和水域。
   * @memberof TerrainData.prototype
   * @type {Uint8Array|HTMLImageElement|HTMLCanvasElement|ImageBitmap|undefined}
   */
  waterMask: {
    get: DeveloperError.throwInstantiationError,
  },
});

/**
 * 在指定的经度和纬度处计算地形高度。
 * @function
 *
 * @param {Rectangle} rectangle 该地形数据所覆盖的矩形区域。
 * @param {number} longitude 以弧度表示的经度。
 * @param {number} latitude 以弧度表示的纬度。
 * @returns {number} The 指定位置处的地形高度。如果位置
 * 位于矩形之外，该方法将外推高度，这可能在矩形外的位置上非常
 * 不准确。
 */
TerrainData.prototype.interpolateHeight =
  DeveloperError.throwInstantiationError;

/**
 * 根据
 * {@link TerrainData#childTileMask}判断给定子瓦片是否可用。假设给定的子瓦片坐标属于该瓦片的四个子瓦片之一。如果给出非子瓦片坐标，
 * to be one of the four children of this tile.  If non-child tile coordinates are
 * 则返回东南子瓦片的可用性。
 * @function
 *
 * @param {number} thisX 此（父）瓦片的瓦片 X 坐标。
 * @param {number} thisY 此（父）瓦片的瓦片 Y 坐标。
 * @param {number} childX 用于检查可用性的子瓦片的瓦片 X 坐标。
 * @param {number} childY 用于检查可用性的子瓦片的瓦片 Y 坐标。
 * @returns {boolean} True 如果子瓦片可用，则为 true；否则为 false。
 */
TerrainData.prototype.isChildAvailable = DeveloperError.throwInstantiationError;

/**
 * 从该地形数据创建 {@link TerrainMesh}。
 * @function
 *
 * @private
 *
 * @param {object} options 具有以下属性的对象：
 * @param {TilingScheme} options.tilingScheme 该瓦片所属的平铺方案。
 * @param {number} options.x 创建地形数据的瓦片的 X 坐标。
 * @param {number} options.y 创建地形数据的瓦片的 Y 坐标。
 * @param {number} options.level 创建地形数据的瓦片的层级。
 * @param {number} [options.exaggeration=1.0] 用于放大地形比例的缩放比例。
 * @param {number} [options.exaggerationRelativeHeight=0.0] 地形被放大的相对高度。
 * @param {boolean} [options.throttle=true] 如果为 true，表示如果已有太多异步网格创建正在进行中，此操作需要重新尝试。
 * @returns {Promise<TerrainMesh>|undefined} A 地形网格的承诺，如果已有太多
 * 异步网格创建正在进行中且操作应该
 * 稍后重新尝试。
 */
TerrainData.prototype.createMesh = DeveloperError.throwInstantiationError;

/**
 * 对此地形数据进行上采样，供子瓦片使用。
 * @function
 *
 * @param {TilingScheme} tilingScheme 此地形数据的平铺方案。
 * @param {number} thisX 该瓦片在平铺方案中的 X 坐标。
 * @param {number} thisY 该瓦片在平铺方案中的 Y 坐标。
 * @param {number} thisLevel 该瓦片在镶嵌方案中的层级。
 * @param {number} descendantX 我们进行上采样所针对的子孙瓦片的在镶嵌方案中的 X 坐标。
 * @param {number} descendantY 我们进行上采样所针对的子孙瓦片的在镶嵌方案中的 Y 坐标。
 * @param {number} descendantLevel 我们进行上采样所针对的子孙瓦片在镶嵌方案中的层级。
 * @returns {Promise<TerrainData>|undefined} A 关于子孙瓦片上采样地形数据的前景。
 * 如果正在进行太多异步上采样操作，且请求被延迟，则视为未定义。
 * 被延迟。
 */
TerrainData.prototype.upsample = DeveloperError.throwInstantiationError;

/**
 * 获取一个值，指示该地形数据是否通过上采样低分辨率数据生成。
 * 如果此值为 false，则数据来自其他来源，例如从远程服务器下载。此方法对于通过 {@link TerrainData#upsample} 调用返回的实例应返回 true。
 * 如果该实例是通过上采样生成的，否则返回 false。
 * 用于地形处理的最大异步任务数量。
 * @function
 *
 * @returns {boolean} True if this instance was created by upsampling; otherwise, false.
 */
TerrainData.prototype.wasCreatedByUpsampling =
  DeveloperError.throwInstantiationError;

/**
 * The maximum number of asynchronous tasks used for terrain processing.
 *
 * @type {number}
 * @private
 */
TerrainData.maximumAsynchronousTasks = 5;

export default TerrainData;
