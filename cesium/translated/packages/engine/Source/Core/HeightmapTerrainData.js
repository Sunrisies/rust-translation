import {
  BoundingSphere,
  Cartesian3,
  Check,
  DeveloperError,
  Frozen,
  GeographicProjection,
  Math as CesiumMath,
  OrientedBoundingBox,
  Rectangle,
  defined,
} from "@cesium/core";
import HeightmapEncoding from "./HeightmapEncoding.js";
import HeightmapTessellator from "./HeightmapTessellator.js";
import TaskProcessor from "./TaskProcessor.js";
import TerrainData from "./TerrainData.js";
import TerrainEncoding from "./TerrainEncoding.js";
import TerrainMesh from "./TerrainMesh.js";
import TerrainProvider from "./TerrainProvider.js";

/**
 * 单个瓦片的地形数据以高度图形式呈现。高度图
 * 是一个按行主序排列的 heights 数组，从北到南、从西到东。
 *
 * @alias HeightmapTerrainData
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|Float64Array} options.buffer 包含高度数据的缓冲区。
 * @param {number} options.width 高度图的宽度（经度方向），以样本为单位。
 * @param {number} options.height 高度图的高度（纬度方向），以样本为单位。
 * @param {number} [options.childTileMask=15] 指示该瓦片四个子瓦片中哪些存在的位掩码。
 * 如果某个子瓦片的位被设置，当该瓦片需要时，也会请求其几何数据。如果位被清除，则不会请求该子瓦片，而是从父瓦片进行上采样。位值如下：
 * is needed.  If the bit is cleared, the child tile is not requested and geometry is
 * instead upsampled from the parent.  The bit values are as follows:
 * <table>
 * <tr><th>位位置</th><th>位值</th><th>子瓦片</th></tr>
 * <tr><td>0</td><td>1</td><td>西南</td></tr>
 * <tr><td>1</td><td>2</td><td>东南</td></tr>
 * <tr><td>2</td><td>4</td><td>西北</td></tr>
 * <tr><td>3</td><td>8</td><td>东北</td></tr>
 * </table>
 * @param {Uint8Array} [options.waterMask] 包含在此地形数据中的水掩码，如有。水掩码是一个正方形
 * Uint8Array 或图像，其中值 255 表示水，值 0 表示陆地。
 * 0 到 255 之间的值也被允许，以便平滑地过渡于陆地和水中。
 * @param {object} [options.structure] 描述高度数据结构的对象。
 * @param {number} [options.structure.heightScale=1.0] 用于乘以高度样本以获得
 * 高于 heightOffset 的高度（以米为单位）的因子。heightOffset 在乘以比例后加到结果高度上。
 * 添加到缩放后的高度上的偏移量，以获得最终高度（以米为单位）。该偏移量在高度样本乘以
 * @param {number} [options.structure.heightOffset=0.0] 高度比例后添加。
 * 构成单个高度样本的缓冲区元素数量。通常为 1，表示每个元素都是独立的高度样本。如果大于 1，则这些元素共同构成高度样本，该样本根据 structure.elementMultiplier 和 structure.isBigEndian 属性计算。
 * 从第一个高度元素到下一个高度的第一个元素之间要跳过的元素数量。
 * @param {number} [options.structure.elementsPerHeight=1] 用于计算高度值的乘数，当
 * stride 属性大于 1 时使用。例如，如果 stride 为 4 且 strideMultiplier 为 256，则高度按以下方式计算：
 * it is greater than 1, that number of elements together form the height sample, which is
 * computed according to the structure.elementMultiplier and structure.isBigEndian properties.
 * @param {number} [options.structure.stride=1] The number of elements to skip to get from the first element of
 * one height to the first element of the next height.
 * @param {number} [options.structure.elementMultiplier=256.0] The multiplier used to compute the height value when the
 * stride property is greater than 1.  For example, if the stride is 4 and the strideMultiplier
 * is 256, the height is computed as follows:
 * `height = buffer[index] + buffer[index + 1] * 256 + buffer[index + 2] * 256 * 256 + buffer[index + 3] * 256 * 256 * 256`
 * 此计算假设 `isBigEndian` 属性为 false。如果为 true，则元素的顺序会被反转。
 * 表示缓冲区中元素的字节序。
 * @param {boolean} [options.structure.isBigEndian=false] 当 `stride` 属性大于 1 时，表示缓冲区中元素的字节序。如果此属性为 false，则第一个元素为低阶元素；如果为 true，则第一个元素为高阶元素。
 * 在 `heightBuffer` 中可以存储的最低值。使用 `heightScale` 和 `heightOffset` 进行编码后低于该值的高度值将被限制为该值。例如，如果高度缓冲区是一个 `Uint16Array`，则该值应为 0，因为 `Uint16Array` 不能存储负数。如果此参数未指定，则没有最小值的约束。
 * 在 `heightBuffer` 中可以存储的最高值。使用 `heightScale` 和 `heightOffset` 进行编码后高于该值的高度值将被限制为该值。例如，如果高度缓冲区是一个 `Uint16Array`，则该值应为 `256 * 256 - 1` 或 65535，因为 `Uint16Array` 不能存储大于 65535 的数字。如果此参数未指定，则没有最大值的约束。
 * @param {number} [options.structure.lowestEncodedHeight] 用于缓冲区的编码方式。
 * 如果此实例是通过对另一个实例进行上采样创建的，则为 true；否则为 false。
 * const buffer = ...
 * const heightBuffer = new Uint16Array(buffer, 0, that._heightmapWidth * that._heightmapWidth);
 * @param {number} [options.structure.highestEncodedHeight] const childTileMask = new Uint8Array(buffer, heightBuffer.byteLength, 1)[0];
 * const waterMask = new Uint8Array(buffer, heightBuffer.byteLength + 1, buffer.byteLength - heightBuffer.byteLength - 1);
 * const terrainData = new Cesium.HeightmapTerrainData({
 * buffer : heightBuffer,
 * @param {HeightmapEncoding} [options.encoding=HeightmapEncoding.NONE] width : 65,
 * @param {boolean} [options.createdByUpsampling=false] height : 65,
 * childTileMask : childTileMask,
 *
 *
 * @example
 * waterMask : waterMask
 * 此瓦片的版权信息数组。
 * 如果地形数据中包含水掩码，则将其纳入此数据。水掩码是一个正方形 `Uint8Array` 或图像，其中值 255 表示水域，值 0 表示陆地。
 * 0 到 255 之间的数值也被允许，以便平滑地过渡陆地和水域。
 * 根据此地形数据创建一个 {@link TerrainMesh}。
 * Object with the following properties:
 * width : 65,
 * height : 65,
 * childTileMask : childTileMask,
 * waterMask : waterMask
 * });
 *
 * @see TerrainData
 * @see QuantizedMeshTerrainData
 * @see GoogleEarthEnterpriseTerrainData
 */
function HeightmapTerrainData(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.buffer", options.buffer);
  Check.typeOf.number("options.width", options.width);
  Check.typeOf.number("options.height", options.height);
  //>>includeEnd('debug');

  this._buffer = options.buffer;
  this._width = options.width;
  this._height = options.height;
  this._childTileMask = options.childTileMask ?? 15;
  this._encoding = options.encoding ?? HeightmapEncoding.NONE;

  const defaultStructure = HeightmapTessellator.DEFAULT_STRUCTURE;
  let structure = options.structure;
  if (!defined(structure)) {
    structure = defaultStructure;
  } else if (structure !== defaultStructure) {
    structure.heightScale =
      structure.heightScale ?? defaultStructure.heightScale;
    structure.heightOffset =
      structure.heightOffset ?? defaultStructure.heightOffset;
    structure.elementsPerHeight =
      structure.elementsPerHeight ?? defaultStructure.elementsPerHeight;
    structure.stride = structure.stride ?? defaultStructure.stride;
    structure.elementMultiplier =
      structure.elementMultiplier ?? defaultStructure.elementMultiplier;
    structure.isBigEndian =
      structure.isBigEndian ?? defaultStructure.isBigEndian;
  }

  this._structure = structure;
  this._createdByUpsampling = options.createdByUpsampling ?? false;
  this._waterMask = options.waterMask;

  this._skirtHeight = undefined;
  this._bufferType =
    this._encoding === HeightmapEncoding.LERC
      ? Float32Array
      : this._buffer.constructor;
  this._mesh = undefined;
}

Object.defineProperties(HeightmapTerrainData.prototype, {
  /**
   * An array of credits for this tile.
   * @memberof HeightmapTerrainData.prototype
   * @type {Credit[]}
   */
  credits: {
    get: function () {
      return undefined;
    },
  },
  /**
   * The water mask included in this terrain data, if any.  A water mask is a square
   * Uint8Array or image where a value of 255 indicates water and a value of 0 indicates land.
   * Values in between 0 and 255 are allowed as well to smoothly blend between land and water.
   * @memberof HeightmapTerrainData.prototype
   * @type {Uint8Array|HTMLImageElement|HTMLCanvasElement|ImageBitmap|undefined}
   */
  waterMask: {
    get: function () {
      return this._waterMask;
    },
  },

  childTileMask: {
    get: function () {
      return this._childTileMask;
    },
  },
});

const createMeshTaskName = "createVerticesFromHeightmap";
const createMeshTaskProcessorNoThrottle = new TaskProcessor(createMeshTaskName);
const createMeshTaskProcessorThrottle = new TaskProcessor(
  createMeshTaskName,
  TerrainData.maximumAsynchronousTasks,
);

/**
 * Creates a {@link TerrainMesh} from this terrain data.
 *
 * @private
 *
 * @param {object} options Object with the following properties:
 * @param {TilingScheme} options.tilingScheme 此瓦片所属的平铺方案。
 * @param {number} options.x 创建地形数据所用瓦片的 X 坐标。
 * @param {number} options.y 创建地形数据所用瓦片的 Y 坐标。
 * @param {number} options.level 创建地形数据所用瓦片的高度级别。
 * @param {number} [options.exaggeration=1.0] 用于放大地形的比例。
 * @param {number} [options.exaggerationRelativeHeight=0.0] 地形被放大的相对高度。
 * @param {boolean} [options.throttle=true] 如果为 true，表示如果已有太多异步网格创建正在进行中，此操作需要重新尝试。
 * @returns {Promise<TerrainMesh>|undefined} A 地形网格的承诺，如果已有太多
 * 异步网格创建正在进行中且操作需要
 * 稍后重新尝试。
 */
HeightmapTerrainData.prototype.createMesh = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.tilingScheme", options.tilingScheme);
  Check.typeOf.number("options.x", options.x);
  Check.typeOf.number("options.y", options.y);
  Check.typeOf.number("options.level", options.level);
  //>>includeEnd('debug');

  const tilingScheme = options.tilingScheme;
  const x = options.x;
  const y = options.y;
  const level = options.level;
  const exaggeration = options.exaggeration ?? 1.0;
  const exaggerationRelativeHeight = options.exaggerationRelativeHeight ?? 0.0;
  const throttle = options.throttle ?? true;

  const ellipsoid = tilingScheme.ellipsoid;
  const nativeRectangle = tilingScheme.tileXYToNativeRectangle(x, y, level);
  const rectangle = tilingScheme.tileXYToRectangle(x, y, level);

  // Compute the center of the tile for RTC rendering.
  const center = ellipsoid.cartographicToCartesian(Rectangle.center(rectangle));

  const structure = this._structure;

  const levelZeroMaxError =
    TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
      ellipsoid,
      this._width,
      tilingScheme.getNumberOfXTilesAtLevel(0),
    );
  const thisLevelMaxError = levelZeroMaxError / (1 << level);
  this._skirtHeight = Math.min(thisLevelMaxError * 4.0, 1000.0);

  const createMeshTaskProcessor = throttle
    ? createMeshTaskProcessorThrottle
    : createMeshTaskProcessorNoThrottle;

  const verticesPromise = createMeshTaskProcessor.scheduleTask({
    heightmap: this._buffer,
    structure: structure,
    includeWebMercatorT: true,
    width: this._width,
    height: this._height,
    nativeRectangle: nativeRectangle,
    rectangle: rectangle,
    relativeToCenter: center,
    ellipsoid: ellipsoid,
    skirtHeight: this._skirtHeight,
    isGeographic: tilingScheme.projection instanceof GeographicProjection,
    exaggeration: exaggeration,
    exaggerationRelativeHeight: exaggerationRelativeHeight,
    encoding: this._encoding,
  });

  if (!defined(verticesPromise)) {
    // Postponed
    return undefined;
  }

  const that = this;
  return Promise.resolve(verticesPromise).then(function (result) {
    let indicesAndEdges;
    if (that._skirtHeight > 0.0) {
      indicesAndEdges =
        TerrainProvider.getRegularGridAndSkirtIndicesAndEdgeIndices(
          result.gridWidth,
          result.gridHeight,
        );
    } else {
      indicesAndEdges = TerrainProvider.getRegularGridIndicesAndEdgeIndices(
        result.gridWidth,
        result.gridHeight,
      );
    }

    const vertexCountWithoutSkirts = result.gridWidth * result.gridHeight;

    // Clone complex result objects because the transfer from the web worker
    // has stripped them down to JSON-style objects.
    that._mesh = new TerrainMesh(
      center,
      new Float32Array(result.vertices),
      indicesAndEdges.indices,
      indicesAndEdges.indexCountWithoutSkirts,
      vertexCountWithoutSkirts,
      result.minimumHeight,
      result.maximumHeight,
      rectangle,
      BoundingSphere.clone(result.boundingSphere3D),
      Cartesian3.clone(result.occludeePointInScaledSpace),
      result.numberOfAttributes,
      OrientedBoundingBox.clone(result.orientedBoundingBox),
      TerrainEncoding.clone(result.encoding),
      indicesAndEdges.westIndicesSouthToNorth,
      indicesAndEdges.southIndicesEastToWest,
      indicesAndEdges.eastIndicesNorthToSouth,
      indicesAndEdges.northIndicesWestToEast,
    );

    // Free memory received from server after mesh is created.
    that._buffer = undefined;
    return that._mesh;
  });
};

/**
 * @param {object} options 具有以下属性的对象：
 * @param {TilingScheme} options.tilingScheme 此瓦片所属的平铺方案。
 * @param {number} options.x 创建地形数据所用瓦片的 X 坐标。
 * @param {number} options.y 创建地形数据所用瓦片的 Y 坐标。
 * @param {number} options.level 创建地形数据所用瓦片的高度级别。
 * @param {number} [options.exaggeration=1.0] 用于放大地形的比例。
 * @param {number} [options.exaggerationRelativeHeight=0.0] 地形被放大的相对高度。
 *
 * @private
 */
HeightmapTerrainData.prototype._createMeshSync = function (options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.tilingScheme", options.tilingScheme);
  Check.typeOf.number("options.x", options.x);
  Check.typeOf.number("options.y", options.y);
  Check.typeOf.number("options.level", options.level);
  //>>includeEnd('debug');

  const tilingScheme = options.tilingScheme;
  const x = options.x;
  const y = options.y;
  const level = options.level;
  const exaggeration = options.exaggeration ?? 1.0;
  const exaggerationRelativeHeight = options.exaggerationRelativeHeight ?? 0.0;

  const ellipsoid = tilingScheme.ellipsoid;
  const nativeRectangle = tilingScheme.tileXYToNativeRectangle(x, y, level);
  const rectangle = tilingScheme.tileXYToRectangle(x, y, level);

  // Compute the center of the tile for RTC rendering.
  const center = ellipsoid.cartographicToCartesian(Rectangle.center(rectangle));

  const structure = this._structure;

  const levelZeroMaxError =
    TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
      ellipsoid,
      this._width,
      tilingScheme.getNumberOfXTilesAtLevel(0),
    );
  const thisLevelMaxError = levelZeroMaxError / (1 << level);
  this._skirtHeight = Math.min(thisLevelMaxError * 4.0, 1000.0);

  const result = HeightmapTessellator.computeVertices({
    heightmap: this._buffer,
    structure: structure,
    includeWebMercatorT: true,
    width: this._width,
    height: this._height,
    nativeRectangle: nativeRectangle,
    rectangle: rectangle,
    relativeToCenter: center,
    ellipsoid: ellipsoid,
    skirtHeight: this._skirtHeight,
    isGeographic: tilingScheme.projection instanceof GeographicProjection,
    exaggeration: exaggeration,
    exaggerationRelativeHeight: exaggerationRelativeHeight,
  });

  // Free memory received from server after mesh is created.
  this._buffer = undefined;

  let indicesAndEdges;
  if (this._skirtHeight > 0.0) {
    indicesAndEdges =
      TerrainProvider.getRegularGridAndSkirtIndicesAndEdgeIndices(
        this._width,
        this._height,
      );
  } else {
    indicesAndEdges = TerrainProvider.getRegularGridIndicesAndEdgeIndices(
      this._width,
      this._height,
    );
  }

  const vertexCountWithoutSkirts = result.gridWidth * result.gridHeight;

  // No need to clone here (as we do in the async version) because the result
  // is not coming from a web worker.
  this._mesh = new TerrainMesh(
    center,
    result.vertices,
    indicesAndEdges.indices,
    indicesAndEdges.indexCountWithoutSkirts,
    vertexCountWithoutSkirts,
    result.minimumHeight,
    result.maximumHeight,
    rectangle,
    result.boundingSphere3D,
    result.occludeePointInScaledSpace,
    result.encoding.stride,
    result.orientedBoundingBox,
    result.encoding,
    indicesAndEdges.westIndicesSouthToNorth,
    indicesAndEdges.southIndicesEastToWest,
    indicesAndEdges.eastIndicesNorthToSouth,
    indicesAndEdges.northIndicesWestToEast,
  );

  return this._mesh;
};

/**
 * 在指定的经度和纬度处计算地形高度。
 *
 * @param {Rectangle} rectangle 此地形数据所覆盖的矩形区域。
 * @param {number} longitude 以弧度表示的经度。
 * @param {number} latitude 以弧度表示的纬度。
 * @returns {number} The 指定位置处的地形高度。如果位置
 * 位于矩形区域之外，该方法将外推高度，这很可能对于矩形区域外的位置非常错误。
 * 在矩形区域外，此结果可能非常不准确。
 */
HeightmapTerrainData.prototype.interpolateHeight = function (
  rectangle,
  longitude,
  latitude,
) {
  const width = this._width;
  const height = this._height;

  const structure = this._structure;
  const stride = structure.stride;
  const elementsPerHeight = structure.elementsPerHeight;
  const elementMultiplier = structure.elementMultiplier;
  const isBigEndian = structure.isBigEndian;
  const heightOffset = structure.heightOffset;
  const heightScale = structure.heightScale;

  const isMeshCreated = defined(this._mesh);
  const isLERCEncoding = this._encoding === HeightmapEncoding.LERC;
  const isInterpolationImpossible = !isMeshCreated && isLERCEncoding;
  if (isInterpolationImpossible) {
    // We can't interpolate using the buffer because it's LERC encoded
    //  so please call createMesh() first and interpolate using the mesh;
    //  as mesh creation will decode the LERC buffer
    return undefined;
  }

  let heightSample;
  if (isMeshCreated) {
    const buffer = this._mesh.vertices;
    const encoding = this._mesh.encoding;
    heightSample = interpolateMeshHeight(
      buffer,
      encoding,
      heightOffset,
      heightScale,
      rectangle,
      width,
      height,
      longitude,
      latitude,
    );
  } else {
    heightSample = interpolateHeight(
      this._buffer,
      elementsPerHeight,
      elementMultiplier,
      stride,
      isBigEndian,
      rectangle,
      width,
      height,
      longitude,
      latitude,
    );
    heightSample = heightSample * heightScale + heightOffset;
  }

  return heightSample;
};

/**
 * 对此地形数据进行上采样，以便子瓦片使用。生成的实例将包含该实例中的部分
 * 高度样本，必要时进行插值。
 *
 * @param {TilingScheme} tilingScheme 此地形数据的平铺方案。
 * @param {number} thisX 此瓦片在平铺方案中的 X 坐标。
 * @param {number} thisY 此瓦片在平铺方案中的 Y 坐标。
 * @param {number} thisLevel 此瓦片在平铺方案中的高度级别。
 * @param {number} descendantX 我们正在进行上采样子的瓦片的平铺方案中的 X 坐标。
 * @param {number} descendantY 我们正在进行上采样子的瓦片的平铺方案中的 Y 坐标。
 * @param {number} descendantLevel 我们正在进行上采样子的瓦片的平铺方案中的高度级别。
 * @returns {Promise<HeightmapTerrainData>|undefined} A 子瓦片上采样后的高度图地形数据的承诺，
 * 如果网格不可用则定义为未定义。
 */
HeightmapTerrainData.prototype.upsample = function (
  tilingScheme,
  thisX,
  thisY,
  thisLevel,
  descendantX,
  descendantY,
  descendantLevel,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(tilingScheme)) {
    throw new DeveloperError("tilingScheme is required.");
  }
  if (!defined(thisX)) {
    throw new DeveloperError("thisX is required.");
  }
  if (!defined(thisY)) {
    throw new DeveloperError("thisY is required.");
  }
  if (!defined(thisLevel)) {
    throw new DeveloperError("thisLevel is required.");
  }
  if (!defined(descendantX)) {
    throw new DeveloperError("descendantX is required.");
  }
  if (!defined(descendantY)) {
    throw new DeveloperError("descendantY is required.");
  }
  if (!defined(descendantLevel)) {
    throw new DeveloperError("descendantLevel is required.");
  }
  const levelDifference = descendantLevel - thisLevel;
  if (levelDifference > 1) {
    throw new DeveloperError(
      "Upsampling through more than one level at a time is not currently supported.",
    );
  }
  //>>includeEnd('debug');

  const meshData = this._mesh;
  if (!defined(meshData)) {
    return undefined;
  }

  const width = this._width;
  const height = this._height;
  const structure = this._structure;
  const stride = structure.stride;

  const heights = new this._bufferType(width * height * stride);

  const buffer = meshData.vertices;
  const encoding = meshData.encoding;

  // PERFORMANCE_IDEA: don't recompute these rectangles - the caller already knows them.
  const sourceRectangle = tilingScheme.tileXYToRectangle(
    thisX,
    thisY,
    thisLevel,
  );
  const destinationRectangle = tilingScheme.tileXYToRectangle(
    descendantX,
    descendantY,
    descendantLevel,
  );

  const heightOffset = structure.heightOffset;
  const heightScale = structure.heightScale;

  const elementsPerHeight = structure.elementsPerHeight;
  const elementMultiplier = structure.elementMultiplier;
  const isBigEndian = structure.isBigEndian;

  const divisor = Math.pow(elementMultiplier, elementsPerHeight - 1);

  for (let j = 0; j < height; ++j) {
    const latitude = CesiumMath.lerp(
      destinationRectangle.north,
      destinationRectangle.south,
      j / (height - 1),
    );
    for (let i = 0; i < width; ++i) {
      const longitude = CesiumMath.lerp(
        destinationRectangle.west,
        destinationRectangle.east,
        i / (width - 1),
      );
      let heightSample = interpolateMeshHeight(
        buffer,
        encoding,
        heightOffset,
        heightScale,
        sourceRectangle,
        width,
        height,
        longitude,
        latitude,
      );

      // Use conditionals here instead of Math.min and Math.max so that an undefined
      // lowestEncodedHeight or highestEncodedHeight has no effect.
      heightSample =
        heightSample < structure.lowestEncodedHeight
          ? structure.lowestEncodedHeight
          : heightSample;
      heightSample =
        heightSample > structure.highestEncodedHeight
          ? structure.highestEncodedHeight
          : heightSample;

      setHeight(
        heights,
        elementsPerHeight,
        elementMultiplier,
        divisor,
        stride,
        isBigEndian,
        j * width + i,
        heightSample,
      );
    }
  }

  return Promise.resolve(
    new HeightmapTerrainData({
      buffer: heights,
      width: width,
      height: height,
      childTileMask: 0,
      structure: this._structure,
      createdByUpsampling: true,
    }),
  );
};

/**
 * 根据
 * {@link HeightmapTerrainData.childTileMask} 确定给定子瓦片是否可用。给定的子瓦片坐标被假设
 * 作为该瓦片的四个子实体之一。如果给出非子瓦片坐标，
 * 则返回东南子瓦片的可用性。
 *
 * @param {number} thisX 这是父瓦片的瓦片 X 坐标。
 * @param {number} thisY 这是父瓦片的瓦片 Y 坐标。
 * @param {number} childX 用于检查可用性的子瓦片的瓦片 X 坐标。
 * @param {number} childY 用于检查可用性的子瓦片的瓦片 Y 坐标。
 * @returns {boolean} True 如果子瓦片可用，则返回真；否则返回假。
 */
HeightmapTerrainData.prototype.isChildAvailable = function (
  thisX,
  thisY,
  childX,
  childY,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("thisX", thisX);
  Check.typeOf.number("thisY", thisY);
  Check.typeOf.number("childX", childX);
  Check.typeOf.number("childY", childY);
  //>>includeEnd('debug');

  let bitNumber = 2; // northwest child
  if (childX !== thisX * 2) {
    ++bitNumber; // east child
  }
  if (childY !== thisY * 2) {
    bitNumber -= 2; // south child
  }

  return (this._childTileMask & (1 << bitNumber)) !== 0;
};

/**
 * 获取一个值，指示此地形数据是否通过低分辨率上采样从原始数据生成。
 * 地形数据。如果此值为假，则数据来自其他来源，例如从远程服务器下载。对于通过 {@link HeightmapTerrainData#upsample} 调用返回的实例，此方法应返回真。
 * 如果此实例是通过上采样生成的，则返回真；否则返回假。
 * returned from a call to {@link HeightmapTerrainData#upsample}.
 *
 * @returns {boolean} True if this instance was created by upsampling; otherwise, false.
 */
HeightmapTerrainData.prototype.wasCreatedByUpsampling = function () {
  return this._createdByUpsampling;
};

function interpolateHeight(
  sourceHeights,
  elementsPerHeight,
  elementMultiplier,
  stride,
  isBigEndian,
  sourceRectangle,
  width,
  height,
  longitude,
  latitude,
) {
  const fromWest =
    ((longitude - sourceRectangle.west) * (width - 1)) /
    (sourceRectangle.east - sourceRectangle.west);
  const fromSouth =
    ((latitude - sourceRectangle.south) * (height - 1)) /
    (sourceRectangle.north - sourceRectangle.south);

  let westInteger = fromWest | 0;
  let eastInteger = westInteger + 1;
  if (eastInteger >= width) {
    eastInteger = width - 1;
    westInteger = width - 2;
  }

  let southInteger = fromSouth | 0;
  let northInteger = southInteger + 1;
  if (northInteger >= height) {
    northInteger = height - 1;
    southInteger = height - 2;
  }

  const dx = fromWest - westInteger;
  const dy = fromSouth - southInteger;

  southInteger = height - 1 - southInteger;
  northInteger = height - 1 - northInteger;

  const southwestHeight = getHeight(
    sourceHeights,
    elementsPerHeight,
    elementMultiplier,
    stride,
    isBigEndian,
    southInteger * width + westInteger,
  );
  const southeastHeight = getHeight(
    sourceHeights,
    elementsPerHeight,
    elementMultiplier,
    stride,
    isBigEndian,
    southInteger * width + eastInteger,
  );
  const northwestHeight = getHeight(
    sourceHeights,
    elementsPerHeight,
    elementMultiplier,
    stride,
    isBigEndian,
    northInteger * width + westInteger,
  );
  const northeastHeight = getHeight(
    sourceHeights,
    elementsPerHeight,
    elementMultiplier,
    stride,
    isBigEndian,
    northInteger * width + eastInteger,
  );

  return triangleInterpolateHeight(
    dx,
    dy,
    southwestHeight,
    southeastHeight,
    northwestHeight,
    northeastHeight,
  );
}

function interpolateMeshHeight(
  buffer,
  encoding,
  heightOffset,
  heightScale,
  sourceRectangle,
  width,
  height,
  longitude,
  latitude,
) {
  // returns a height encoded according to the structure's heightScale and heightOffset.
  const fromWest =
    ((longitude - sourceRectangle.west) * (width - 1)) /
    (sourceRectangle.east - sourceRectangle.west);
  const fromSouth =
    ((latitude - sourceRectangle.south) * (height - 1)) /
    (sourceRectangle.north - sourceRectangle.south);

  let westInteger = fromWest | 0;
  let eastInteger = westInteger + 1;
  if (eastInteger >= width) {
    eastInteger = width - 1;
    westInteger = width - 2;
  }

  let southInteger = fromSouth | 0;
  let northInteger = southInteger + 1;
  if (northInteger >= height) {
    northInteger = height - 1;
    southInteger = height - 2;
  }

  const dx = fromWest - westInteger;
  const dy = fromSouth - southInteger;

  southInteger = height - 1 - southInteger;
  northInteger = height - 1 - northInteger;

  const southwestHeight =
    (encoding.decodeHeight(buffer, southInteger * width + westInteger) -
      heightOffset) /
    heightScale;
  const southeastHeight =
    (encoding.decodeHeight(buffer, southInteger * width + eastInteger) -
      heightOffset) /
    heightScale;
  const northwestHeight =
    (encoding.decodeHeight(buffer, northInteger * width + westInteger) -
      heightOffset) /
    heightScale;
  const northeastHeight =
    (encoding.decodeHeight(buffer, northInteger * width + eastInteger) -
      heightOffset) /
    heightScale;

  return triangleInterpolateHeight(
    dx,
    dy,
    southwestHeight,
    southeastHeight,
    northwestHeight,
    northeastHeight,
  );
}

function triangleInterpolateHeight(
  dX,
  dY,
  southwestHeight,
  southeastHeight,
  northwestHeight,
  northeastHeight,
) {
  // The HeightmapTessellator bisects the quad from southwest to northeast.
  if (dY < dX) {
    // Lower right triangle
    return (
      southwestHeight +
      dX * (southeastHeight - southwestHeight) +
      dY * (northeastHeight - southeastHeight)
    );
  }

  // Upper left triangle
  return (
    southwestHeight +
    dX * (northeastHeight - northwestHeight) +
    dY * (northwestHeight - southwestHeight)
  );
}

function getHeight(
  heights,
  elementsPerHeight,
  elementMultiplier,
  stride,
  isBigEndian,
  index,
) {
  index *= stride;

  let height = 0;
  let i;

  if (isBigEndian) {
    for (i = 0; i < elementsPerHeight; ++i) {
      height = height * elementMultiplier + heights[index + i];
    }
  } else {
    for (i = elementsPerHeight - 1; i >= 0; --i) {
      height = height * elementMultiplier + heights[index + i];
    }
  }

  return height;
}

function setHeight(
  heights,
  elementsPerHeight,
  elementMultiplier,
  divisor,
  stride,
  isBigEndian,
  index,
  height,
) {
  index *= stride;

  let i;
  if (isBigEndian) {
    for (i = 0; i < elementsPerHeight - 1; ++i) {
      heights[index + i] = (height / divisor) | 0;
      height -= heights[index + i] * divisor;
      divisor /= elementMultiplier;
    }
  } else {
    for (i = elementsPerHeight - 1; i > 0; --i) {
      heights[index + i] = (height / divisor) | 0;
      height -= heights[index + i] * divisor;
      divisor /= elementMultiplier;
    }
  }
  heights[index + i] = height;
}
export default HeightmapTerrainData;
