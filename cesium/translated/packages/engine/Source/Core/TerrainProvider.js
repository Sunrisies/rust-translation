import {
  DeveloperError,
  IndexDatatype,
  Math as CesiumMath,
  defined,
} from "@cesium/core";

/**
 * 为椭球表面提供地形或其他几何图形。该表面几何图形
 * 按照 {@link TilingScheme} 被组织成瓦片金字塔结构。这种类型描述了一个
 * 接口，并不打算直接实例化。
 *
 * @alias TerrainProvider
 * @constructor
 *
 * @see EllipsoidTerrainProvider
 * @see CesiumTerrainProvider
 * @see VRTheWorldTerrainProvider
 * @see GoogleEarthEnterpriseTerrainProvider
 * @see ArcGISTiledElevationTerrainProvider
 * @see Cesium3DTilesTerrainProvider
 */
function TerrainProvider() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(TerrainProvider.prototype, {
  /**
   * 在地形提供器遇到异步错误时触发事件。通过订阅该事件，您可以收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * 获取此地形提供器处于活动状态时显示的信用信息。通常用于显示
   * @memberof TerrainProvider.prototype
   * @type {Event<TerrainProvider.ErrorEvent>}
   * @readonly
   */
  errorEvent: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 地形的来源。
   * 地形提供器使用的瓦片方案。
   * @memberof TerrainProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取提供器使用的瓦片方案。
   * @memberof TerrainProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取指示提供器是否包含水掩膜的值。水掩膜
   * 表示地球上的哪些区域是水而不是陆地，因此可以被渲染为具有动画波浪的反射表面。
   * 获取指示请求的瓦片是否包含顶点法线的值。
   * @memberof TerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasWaterMask: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取可用于确定此提供器提供的地形可用性的对象，例如
   * @memberof TerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasVertexNormals: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 在点和矩形上。如果可用性信息不可得，此属性可能未定义。
   * 获取表示规则网格的三角形网格的索引列表。使用相同的网格宽度和高度多次调用
   * 此函数将返回相同的索引列表。顶点总数必须小于或等于
   * @memberof TerrainProvider.prototype
   * @type {TileAvailability|undefined}
   * @readonly
   */
  availability: {
    get: DeveloperError.throwInstantiationError,
  },
});

const regularGridIndicesCache = [];

/**
 * 水平方向中规则网格的顶点数。
 * 垂直方向中规则网格的顶点数。
 * 索引列表。对于64KB或以下的数据，返回 Uint16Array；对于4GB或以下的数据，返回 Uint32Array。
 * to 65536.
 *
 * @param {number} width 给定边缘索引，计算裙边顶点数。
 * @param {number} height 瓦片西侧的边缘索引。
 * @returns {Uint16Array|Uint32Array} The 瓦片南侧的边缘索引。
 */
TerrainProvider.getRegularGridIndices = function (width, height) {
  //>>includeStart('debug', pragmas.debug);
  if (width * height >= CesiumMath.FOUR_GIGABYTES) {
    throw new DeveloperError(
      "The total number of vertices (width * height) must be less than 4,294,967,296.",
    );
  }
  //>>includeEnd('debug');

  let byWidth = regularGridIndicesCache[width];
  if (!defined(byWidth)) {
    regularGridIndicesCache[width] = byWidth = [];
  }

  let indices = byWidth[height];
  if (!defined(indices)) {
    if (width * height < CesiumMath.SIXTY_FOUR_KILOBYTES) {
      indices = byWidth[height] = new Uint16Array(
        (width - 1) * (height - 1) * 6,
      );
    } else {
      indices = byWidth[height] = new Uint32Array(
        (width - 1) * (height - 1) * 6,
      );
    }
    addRegularGridIndices(width, height, indices, 0);
  }

  return indices;
};

const regularGridAndEdgeIndicesCache = [];

/**
 * @private
 */
TerrainProvider.getRegularGridIndicesAndEdgeIndices = function (width, height) {
  //>>includeStart('debug', pragmas.debug);
  if (width * height >= CesiumMath.FOUR_GIGABYTES) {
    throw new DeveloperError(
      "The total number of vertices (width * height) must be less than 4,294,967,296.",
    );
  }
  //>>includeEnd('debug');

  let byWidth = regularGridAndEdgeIndicesCache[width];
  if (!defined(byWidth)) {
    regularGridAndEdgeIndicesCache[width] = byWidth = [];
  }

  let indicesAndEdges = byWidth[height];
  if (!defined(indicesAndEdges)) {
    const indices = TerrainProvider.getRegularGridIndices(width, height);

    const edgeIndices = getEdgeIndices(width, height);
    const westIndicesSouthToNorth = edgeIndices.westIndicesSouthToNorth;
    const southIndicesEastToWest = edgeIndices.southIndicesEastToWest;
    const eastIndicesNorthToSouth = edgeIndices.eastIndicesNorthToSouth;
    const northIndicesWestToEast = edgeIndices.northIndicesWestToEast;

    indicesAndEdges = byWidth[height] = {
      indices: indices,
      westIndicesSouthToNorth: westIndicesSouthToNorth,
      southIndicesEastToWest: southIndicesEastToWest,
      eastIndicesNorthToSouth: eastIndicesNorthToSouth,
      northIndicesWestToEast: northIndicesWestToEast,
    };
  }

  return indicesAndEdges;
};

const regularGridAndSkirtAndEdgeIndicesCache = [];

/**
 * @private
 */
TerrainProvider.getRegularGridAndSkirtIndicesAndEdgeIndices = function (
  width,
  height,
) {
  //>>includeStart('debug', pragmas.debug);
  if (width * height >= CesiumMath.FOUR_GIGABYTES) {
    throw new DeveloperError(
      "The total number of vertices (width * height) must be less than 4,294,967,296.",
    );
  }
  //>>includeEnd('debug');

  let byWidth = regularGridAndSkirtAndEdgeIndicesCache[width];
  if (!defined(byWidth)) {
    regularGridAndSkirtAndEdgeIndicesCache[width] = byWidth = [];
  }

  let indicesAndEdges = byWidth[height];
  if (!defined(indicesAndEdges)) {
    const gridVertexCount = width * height;
    const gridIndexCount = (width - 1) * (height - 1) * 6;
    const edgeVertexCount = width * 2 + height * 2;
    const edgeIndexCount = Math.max(0, edgeVertexCount - 4) * 6;
    const vertexCount = gridVertexCount + edgeVertexCount;
    const indexCount = gridIndexCount + edgeIndexCount;

    const edgeIndices = getEdgeIndices(width, height);
    const westIndicesSouthToNorth = edgeIndices.westIndicesSouthToNorth;
    const southIndicesEastToWest = edgeIndices.southIndicesEastToWest;
    const eastIndicesNorthToSouth = edgeIndices.eastIndicesNorthToSouth;
    const northIndicesWestToEast = edgeIndices.northIndicesWestToEast;

    const indices = IndexDatatype.createTypedArray(vertexCount, indexCount);
    addRegularGridIndices(width, height, indices, 0);
    TerrainProvider.addSkirtIndices(
      westIndicesSouthToNorth,
      southIndicesEastToWest,
      eastIndicesNorthToSouth,
      northIndicesWestToEast,
      gridVertexCount,
      indices,
      gridIndexCount,
    );

    indicesAndEdges = byWidth[height] = {
      indices: indices,
      westIndicesSouthToNorth: westIndicesSouthToNorth,
      southIndicesEastToWest: southIndicesEastToWest,
      eastIndicesNorthToSouth: eastIndicesNorthToSouth,
      northIndicesWestToEast: northIndicesWestToEast,
      indexCountWithoutSkirts: gridIndexCount,
    };
  }

  return indicesAndEdges;
};

/**
 * 瓦片东侧的边缘索引。
 * @private
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} westIndicesSouthToNorth 瓦片北侧的边缘索引。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} southIndicesEastToWest 裙边顶点数。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} eastIndicesNorthToSouth 给定裙边顶点数，计算裙边索引数。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} northIndicesWestToEast 考虑一个3x3的顶点网格。边缘周围将有8个裙边顶点：
 * @returns {number} The - 16个边缘三角形
 */
TerrainProvider.getSkirtVertexCount = function (
  westIndicesSouthToNorth,
  southIndicesEastToWest,
  eastIndicesNorthToSouth,
  northIndicesWestToEast,
) {
  return (
    westIndicesSouthToNorth.length +
    southIndicesEastToWest.length +
    eastIndicesNorthToSouth.length +
    northIndicesWestToEast.length
  );
};

/**
 * - 48个索引
 * 考虑一个3x3的顶点网格。边缘周围将有8个裙边顶点：
 * - 16 edge triangles
 * - 48 indices
 *
 *   |\|\|
 * |/|   |/|
 * |/|   |/|
 *   |\|\|
 *
 * @private
 * @param {number} skirtVertexCount
 * @returns {number}
 */
TerrainProvider.getSkirtIndexCount = function (skirtVertexCount) {
  return (skirtVertexCount - 4) * 2 * 3;
};

/**
 * Compute the number of skirt indices given the number of skirt vertices with filled corners.
 * Consider a 3x3 grid of vertices. There will be 8 skirt vertices around the edge:
 * - 16 个边缘三角形
 * - 4 个顶部三角形
 * - 60 个索引
 *
 *  /|\|\|\
 * |/|   |/|
 * |/|   |/|
 *  \|\|\|/
 *
 * @private
 * @param {number} skirtVertexCount
 * @returns {number}
 */
TerrainProvider.getSkirtIndexCountWithFilledCorners = function (
  skirtVertexCount,
) {
  return ((skirtVertexCount - 4) * 2 + 4) * 3;
};

/**
 * 添加裙边索引。
 * 此操作不会添加填充角，请使用 {@link TerrainProvider.addSkirtIndicesWithFilledCorners} 来添加带有填充角的裙边索引。
 * @private
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} westIndicesSouthToNorth 瓦片西边缘顶点的索引，按从南到北的顺序排列。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} southIndicesEastToWest 瓦片南边缘顶点的索引，按从东到西的顺序排列。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} eastIndicesNorthToSouth 瓦片东边缘顶点的索引，按从北到南的顺序排列。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} northIndicesWestToEast 瓦片北边缘顶点的索引，按从西到东的顺序排列。
 * @param {number} vertexCount 添加裙边顶点之前瓦片中的顶点数量。
 * @param {Uint16Array|Uint32Array} indices 要添加裙边索引的索引数组。
 * @param {number} offset 开始添加裙边索引时的索引数组偏移量。
 */
TerrainProvider.addSkirtIndices = function (
  westIndicesSouthToNorth,
  southIndicesEastToWest,
  eastIndicesNorthToSouth,
  northIndicesWestToEast,
  vertexCount,
  indices,
  offset,
) {
  let vertexIndex = vertexCount;
  offset = addSkirtIndices(
    westIndicesSouthToNorth,
    vertexIndex,
    indices,
    offset,
  );
  vertexIndex += westIndicesSouthToNorth.length;
  offset = addSkirtIndices(
    southIndicesEastToWest,
    vertexIndex,
    indices,
    offset,
  );
  vertexIndex += southIndicesEastToWest.length;
  offset = addSkirtIndices(
    eastIndicesNorthToSouth,
    vertexIndex,
    indices,
    offset,
  );
  vertexIndex += eastIndicesNorthToSouth.length;
  addSkirtIndices(northIndicesWestToEast, vertexIndex, indices, offset);
};

/**
 * 添加带有填充角的裙边索引。
 * @private
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} westIndicesSouthToNorth 瓦片西边缘顶点的索引，按从南到北的顺序排列。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} southIndicesEastToWest 瓦片南边缘顶点的索引，按从东到西的顺序排列。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} eastIndicesNorthToSouth 瓦片东边缘顶点的索引，按从北到南的顺序排列。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} northIndicesWestToEast 瓦片北边缘顶点的索引，按从西到东的顺序排列。
 * @param {number} vertexCount 添加裙边顶点之前瓦片中的顶点数量。
 * @param {Uint16Array|Uint32Array} indices 要添加裙边索引的索引数组。
 * @param {number} offset 开始添加裙边索引时的索引数组偏移量。
 */
TerrainProvider.addSkirtIndicesWithFilledCorners = function (
  westIndicesSouthToNorth,
  southIndicesEastToWest,
  eastIndicesNorthToSouth,
  northIndicesWestToEast,
  vertexCount,
  indices,
  offset,
) {
  // Add skirt indices without filled corners
  TerrainProvider.addSkirtIndices(
    westIndicesSouthToNorth,
    southIndicesEastToWest,
    eastIndicesNorthToSouth,
    northIndicesWestToEast,
    vertexCount,
    indices,
    offset,
  );

  const skirtVertexCount = TerrainProvider.getSkirtVertexCount(
    westIndicesSouthToNorth,
    southIndicesEastToWest,
    eastIndicesNorthToSouth,
    northIndicesWestToEast,
  );
  const skirtIndexCountWithoutCaps =
    TerrainProvider.getSkirtIndexCount(skirtVertexCount);

  const cornerStartIdx = offset + skirtIndexCountWithoutCaps;

  const cornerSWIndex = westIndicesSouthToNorth[0];
  const cornerNWIndex = northIndicesWestToEast[0];
  const cornerNEIndex = eastIndicesNorthToSouth[0];
  const cornerSEIndex = southIndicesEastToWest[0];

  // Indices based on edge order in addSkirtIndices
  const westSouthIndex = vertexCount;
  const westNorthIndex = westSouthIndex + westIndicesSouthToNorth.length - 1;
  const southEastIndex = westNorthIndex + 1;
  const southWestIndex = southEastIndex + southIndicesEastToWest.length - 1;
  const eastNorthIndex = southWestIndex + 1;
  const eastSouthIndex = eastNorthIndex + eastIndicesNorthToSouth.length - 1;
  const northWestIndex = eastSouthIndex + 1;
  const northEastIndex = northWestIndex + northIndicesWestToEast.length - 1;

  // Connect the corner vertices with the skirt vertices extending from the corner

  indices[cornerStartIdx + 0] = cornerSWIndex;
  indices[cornerStartIdx + 1] = westSouthIndex;
  indices[cornerStartIdx + 2] = southWestIndex;

  indices[cornerStartIdx + 3] = cornerSEIndex;
  indices[cornerStartIdx + 4] = southEastIndex;
  indices[cornerStartIdx + 5] = eastSouthIndex;

  indices[cornerStartIdx + 6] = cornerNEIndex;
  indices[cornerStartIdx + 7] = eastNorthIndex;
  indices[cornerStartIdx + 8] = northEastIndex;

  indices[cornerStartIdx + 9] = cornerNWIndex;
  indices[cornerStartIdx + 10] = northWestIndex;
  indices[cornerStartIdx + 11] = westNorthIndex;
};

function getEdgeIndices(width, height) {
  const westIndicesSouthToNorth = new Array(height);
  const southIndicesEastToWest = new Array(width);
  const eastIndicesNorthToSouth = new Array(height);
  const northIndicesWestToEast = new Array(width);

  let i;
  for (i = 0; i < width; ++i) {
    northIndicesWestToEast[i] = i;
    southIndicesEastToWest[i] = width * height - 1 - i;
  }

  for (i = 0; i < height; ++i) {
    eastIndicesNorthToSouth[i] = (i + 1) * width - 1;
    westIndicesSouthToNorth[i] = (height - i - 1) * width;
  }

  return {
    westIndicesSouthToNorth: westIndicesSouthToNorth,
    southIndicesEastToWest: southIndicesEastToWest,
    eastIndicesNorthToSouth: eastIndicesNorthToSouth,
    northIndicesWestToEast: northIndicesWestToEast,
  };
}

function addRegularGridIndices(width, height, indices, offset) {
  let index = 0;
  for (let j = 0; j < height - 1; ++j) {
    for (let i = 0; i < width - 1; ++i) {
      const upperLeft = index;
      const lowerLeft = upperLeft + width;
      const lowerRight = lowerLeft + 1;
      const upperRight = upperLeft + 1;

      indices[offset++] = upperLeft;
      indices[offset++] = lowerLeft;
      indices[offset++] = upperRight;
      indices[offset++] = upperRight;
      indices[offset++] = lowerLeft;
      indices[offset++] = lowerRight;

      ++index;
    }
    ++index;
  }
}

function addSkirtIndices(edgeIndices, vertexIndex, indices, offset) {
  let previousIndex = edgeIndices[0];

  const length = edgeIndices.length;
  for (let i = 1; i < length; ++i) {
    const index = edgeIndices[i];

    indices[offset++] = previousIndex;
    indices[offset++] = index;
    indices[offset++] = vertexIndex;

    indices[offset++] = vertexIndex;
    indices[offset++] = index;
    indices[offset++] = vertexIndex + 1;

    previousIndex = index;
    ++vertexIndex;
  }

  return offset;
}

/**
 * 指定由高度图生成的地形质量。值为 1.0 将确保相邻高度图顶点之间的间距不超过
 * {@link Globe.maximumScreenSpaceError} 屏幕像素，且渲染速度可能非常慢。
 * 值为 0.5 可将估计的零级几何误差减半，使相邻高度图顶点之间的屏幕像素数增加一倍，从而加快渲染速度。
 * 确定当几何数据来自高度图时适用的几何误差估计值。
 * 地形所连接的椭球体。
 * @type {number}
 */
TerrainProvider.heightmapTerrainQuality = 0.25;

/**
 * 与单个瓦片相关的高度图宽度（以像素为单位）。
 *
 * @param {Ellipsoid} ellipsoid 零级瓦片水平方向上的瓦片数量。
 * @param {number} tileImageWidth 估计的几何误差。
 * @param {number} numberOfTilesAtLevelZero 请求给定瓦片的几何数据。结果必须包含地形数据，并可选择包含水掩码以及哪些子瓦片可用的信息。
 * @returns {number} An estimated geometric error.
 */
TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap = function (
  ellipsoid,
  tileImageWidth,
  numberOfTilesAtLevelZero,
) {
  return (
    (ellipsoid.maximumRadius *
      2 *
      Math.PI *
      TerrainProvider.heightmapTerrainQuality) /
    (tileImageWidth * numberOfTilesAtLevelZero)
  );
};

/**
 * Requests the geometry for a given tile. The result must include terrain data and
 * may optionally include a water mask and an indication of which child tiles are available.
 * @function
 *
 * @param {number} x 请求几何数据的瓦片X坐标。
 * @param {number} y 请求几何数据的瓦片Y坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 *
 * @returns {Promise<TerrainData>|undefined} A 请求几何数据的承诺。如果此方法
 * 返回 undefined 而不是承诺，说明当前有太多请求正在等待处理，
 * 并将在之后重试该请求。
 */
TerrainProvider.prototype.requestTileGeometry =
  DeveloperError.throwInstantiationError;

/**
 * 获取给定层级瓦片允许的最大几何误差。
 * @function
 *
 * @param {number} level 获取最大几何误差的瓦片层级。
 * @returns {number} The 最大几何误差。
 */
TerrainProvider.prototype.getLevelMaximumGeometricError =
  DeveloperError.throwInstantiationError;

/**
 * 确定瓦片的数据是否可加载。
 * @function
 *
 * @param {number} x 请求几何数据的瓦片X坐标。
 * @param {number} y 请求几何数据的瓦片Y坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {boolean|undefined} Undefined 如果地形提供器不支持，则为 false；否则为 true。
 */
TerrainProvider.prototype.getTileDataAvailable =
  DeveloperError.throwInstantiationError;

/**
 * 确保加载瓦片的可用性数据。
 * @function
 *
 * @param {number} x 请求几何数据的瓦片X坐标。
 * @param {number} y 请求几何数据的瓦片Y坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {undefined|Promise<void>} Undefined 如果无需加载数据，或者所有必需的瓦片已加载时承诺得到解决。
 */
TerrainProvider.prototype.loadTileDataAvailability =
  DeveloperError.throwInstantiationError;
export default TerrainProvider;

/**
 * 发生错误时调用的函数。
 * @callback TerrainProvider.ErrorEvent
 *
 * @this TerrainProvider
 * @param {TileProviderError} err 包含所发生错误详情的对象。
 */
