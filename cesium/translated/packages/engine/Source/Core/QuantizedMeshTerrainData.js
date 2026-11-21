import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Check,
  DeveloperError,
  Frozen,
  IndexDatatype,
  Intersections2D,
  Math as CesiumMath,
  OrientedBoundingBox,
  defined,
} from "@cesium/core";
import TaskProcessor from "./TaskProcessor.js";
import TerrainData from "./TerrainData.js";
import TerrainEncoding from "./TerrainEncoding.js";
import TerrainMesh from "./TerrainMesh.js";

/**
 * 单个瓦片的地形数据以量化网格形式表示。该量化网格由三个顶点属性组成：经度和纬度以及高度。所有属性均以 16 位值的形式表示，范围在 0 到 32767 之间。经度和纬度在瓦片的西南角为 0，在东北角为 32767；高度在瓦片的最低点为 0，在最高点为 32767。
 * 对象具有以下属性：
 * 包含量化网格的缓冲区。
 * 指定量化顶点如何连接成三角形的索引。每个三个索引对应一个三角形。
 * 瓦片内的最小地形高度，以米为单位，位于椭球面上方。
 *
 * @alias QuantizedMeshTerrainData
 * @constructor
 *
 * @param {object} options 瓦片内的最大地形高度，以米为单位，位于椭球面上方。
 * @param {Uint16Array} options.quantizedVertices 包围量化网格的缓冲区。
 * @param {Uint16Array|Uint32Array} options.indices 指定量化顶点如何连接成三角形的索引。
 * 每个三个索引对应一个三角形。
 * @param {number} options.minimumHeight 瓦片内的最小地形高度，以米为单位，位于椭球面上方。
 * @param {number} options.maximumHeight 瓦片内的最大地形高度，以米为单位，位于椭球面上方。
 * @param {BoundingSphere} options.boundingSphere 包围网格中所有顶点的球体。
 * @param {OrientedBoundingBox} [options.orientedBoundingBox] 包围网格中所有顶点的定向边界框。
 * @param {Cartesian3} options.horizonOcclusionPoint 网格的地平线遮挡点。如果此点低于地平线，则整个瓦片也被认为低于地平线。
 * 该点以椭球坐标表示。
 * 瓦片西边缘顶点索引。
 * @param {number[]} options.westIndices 瓦片南边缘顶点索引。
 * @param {number[]} options.southIndices 瓦片东边缘顶点索引。
 * @param {number[]} options.eastIndices 瓦片北边缘顶点索引。
 * @param {number[]} options.northIndices 瓦片北边缘顶点索引。
 * @param {number} options.westSkirtHeight 瓦片西边缘需添加的裙边高度。
 * @param {number} options.southSkirtHeight 瓦片南边缘需添加的裙边高度。
 * @param {number} options.eastSkirtHeight 瓦片东边缘需添加的裙边高度。
 * @param {number} options.northSkirtHeight 瓦片北边缘需添加的裙边高度。
 * @param {number} [options.childTileMask=15] 指示该瓦片的四个子瓦片中哪些存在的位掩码。
 * 如果某个子瓦片的位被设置，当该子瓦片需要时，也会请求其几何数据。如果位被清除，则不会请求该子瓦片，而是从父瓦片进行上采样。位值如下：
 * <table>
 * <tr><th>位位置</th><th>位值</th><th>子瓦片</th></tr>
 * <tr><td>0</td><td>1</td><td>西南</td></tr>
 * <tr><td>1</td><td>2</td><td>东南</td></tr>
 * <tr><td>2</td><td>4</td><td>西北</td></tr>
 * <tr><td>3</td><td>8</td><td>东北</td></tr>
 * </table>
 * 如果此实例是通过上采样另一个实例创建的，则为真。
 * </table>
 * @param {boolean} [options.createdByUpsampling=false] True if this instance was created by upsampling another instance;
 * 否则，为 false。
 * @param {Uint8Array} [options.encodedNormals] 包含每个顶点法线的缓冲区，使用 'oct' 编码方式存储。
 * @param {Uint8Array} [options.waterMask] 包含水印遮罩的缓冲区。
 * @param {Credit[]} [options.credits] 该瓦片的相关致谢列表。
 *
 *
 * @example
 * const data = new Cesium.QuantizedMeshTerrainData({
 * minimumHeight : -100,
 * maximumHeight : 2101,
 * quantizedVertices : new Uint16Array([// 顺序为 SW NW SE NE
 * // 经度
 *                                          0, 0, 32767, 32767,
 * // 纬度
 *                                          0, 32767, 0, 32767,
 * // 高度
 *                                          16384, 0, 32767, 16384]),
 * indices : new Uint16Array([0, 3, 1,
 *                                0, 2, 3]),
 * boundingSphere : new Cesium.BoundingSphere(new Cesium.Cartesian3(1.0, 2.0, 3.0), 10000),
 * orientedBoundingBox : new Cesium.OrientedBoundingBox(new Cesium.Cartesian3(1.0, 2.0, 3.0), Cesium.Matrix3.fromRotationX(Cesium.Math.PI, new Cesium.Matrix3())),
 * horizonOcclusionPoint : new Cesium.Cartesian3(3.0, 2.0, 1.0),
 * westIndices : [0, 1],
 * southIndices : [0, 1],
 * eastIndices : [2, 3],
 * northIndices : [1, 3],
 * westSkirtHeight : 1.0,
 * southSkirtHeight : 1.0,
 * eastSkirtHeight : 1.0,
 * northSkirtHeight : 1.0
 * });
 *
 * @see TerrainData
 * @see HeightmapTerrainData
 * @see GoogleEarthEnterpriseTerrainData
 */
function QuantizedMeshTerrainData(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug)
  Check.typeOf.object("options.quantizedVertices", options.quantizedVertices);
  Check.typeOf.object("options.indices", options.indices);
  Check.typeOf.number("options.minimumHeight", options.minimumHeight);
  Check.typeOf.number("options.maximumHeight", options.maximumHeight);
  Check.typeOf.object("options.boundingSphere", options.boundingSphere);
  Check.typeOf.object(
    "options.horizonOcclusionPoint",
    options.horizonOcclusionPoint,
  );
  Check.typeOf.object("options.westIndices", options.westIndices);
  Check.typeOf.object("options.southIndices", options.southIndices);
  Check.typeOf.object("options.eastIndices", options.eastIndices);
  Check.typeOf.object("options.northIndices", options.northIndices);
  Check.typeOf.number("options.westSkirtHeight", options.westSkirtHeight);
  Check.typeOf.number("options.southSkirtHeight", options.southSkirtHeight);
  Check.typeOf.number("options.eastSkirtHeight", options.eastSkirtHeight);
  Check.typeOf.number("options.northSkirtHeight", options.northSkirtHeight);
  //>>includeEnd('debug');

  this._quantizedVertices = options.quantizedVertices;
  this._encodedNormals = options.encodedNormals;
  this._indices = options.indices;
  this._minimumHeight = options.minimumHeight;
  this._maximumHeight = options.maximumHeight;
  this._boundingSphere = options.boundingSphere;
  this._orientedBoundingBox = options.orientedBoundingBox;
  this._horizonOcclusionPoint = options.horizonOcclusionPoint;
  this._credits = options.credits;

  const vertexCount = this._quantizedVertices.length / 3;
  const uValues = (this._uValues = this._quantizedVertices.subarray(
    0,
    vertexCount,
  ));
  const vValues = (this._vValues = this._quantizedVertices.subarray(
    vertexCount,
    2 * vertexCount,
  ));
  this._heightValues = this._quantizedVertices.subarray(
    2 * vertexCount,
    3 * vertexCount,
  );

  // We don't assume that we can count on the edge vertices being sorted by u or v.
  function sortByV(a, b) {
    return vValues[a] - vValues[b];
  }

  function sortByU(a, b) {
    return uValues[a] - uValues[b];
  }

  this._westIndices = sortIndicesIfNecessary(
    options.westIndices,
    sortByV,
    vertexCount,
  );
  this._southIndices = sortIndicesIfNecessary(
    options.southIndices,
    sortByU,
    vertexCount,
  );
  this._eastIndices = sortIndicesIfNecessary(
    options.eastIndices,
    sortByV,
    vertexCount,
  );
  this._northIndices = sortIndicesIfNecessary(
    options.northIndices,
    sortByU,
    vertexCount,
  );

  this._westSkirtHeight = options.westSkirtHeight;
  this._southSkirtHeight = options.southSkirtHeight;
  this._eastSkirtHeight = options.eastSkirtHeight;
  this._northSkirtHeight = options.northSkirtHeight;

  this._childTileMask = options.childTileMask ?? 15;

  this._createdByUpsampling = options.createdByUpsampling ?? false;
  this._waterMask = options.waterMask;

  this._mesh = undefined;
}

Object.defineProperties(QuantizedMeshTerrainData.prototype, {
  /**
   * 该瓦片的相关致谢列表。
   * @memberof QuantizedMeshTerrainData.prototype
   * @type {Credit[]}
   */
  credits: {
    get: function () {
      return this._credits;
    },
  },
  /**
   * 此地形数据中包含的水面遮罩，若存在的话。水面遮罩是一个矩形
   * Uint8Array 或图像，其中值 255 表示水域，值 0 表示陆地。
   * 0 到 255 之间的数值也被允许，用于平滑地过渡陆地和水域。
   * @memberof QuantizedMeshTerrainData.prototype
   * @type {Uint8Array|HTMLImageElement|HTMLCanvasElement|undefined}
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

  canUpsample: {
    get: function () {
      return defined(this._mesh);
    },
  },
});

const arrayScratch = [];

function sortIndicesIfNecessary(indices, sortFunction, vertexCount) {
  arrayScratch.length = indices.length;

  let needsSort = false;
  for (let i = 0, len = indices.length; i < len; ++i) {
    arrayScratch[i] = indices[i];
    needsSort =
      needsSort || (i > 0 && sortFunction(indices[i - 1], indices[i]) > 0);
  }

  if (needsSort) {
    arrayScratch.sort(sortFunction);
    return IndexDatatype.createTypedArray(vertexCount, arrayScratch);
  }
  return indices;
}

const createMeshTaskName = "createVerticesFromQuantizedTerrainMesh";
const createMeshTaskProcessorNoThrottle = new TaskProcessor(createMeshTaskName);
const createMeshTaskProcessorThrottle = new TaskProcessor(
  createMeshTaskName,
  TerrainData.maximumAsynchronousTasks,
);

/**
 * 根据此地形数据创建 {@link TerrainMesh}。
 *
 * @private
 *
 * @param {object} options 具有以下属性的对象：
 * @param {TilingScheme} options.tilingScheme 该瓦片所属的镶嵌方案。
 * @param {number} options.x 用于生成地形数据的瓦片的 X 坐标。
 * @param {number} options.y 用于生成地形数据的瓦片的 Y 坐标。
 * @param {number} options.level 用于生成地形数据的瓦片的层级。
 * @param {number} [options.exaggeration=1.0] 用于放大地形比例的缩放比例。
 * @param {number} [options.exaggerationRelativeHeight=0.0] 地形被放大的相对高度。
 * @param {boolean} [options.throttle=true] 如果为 true，表示如果已有太多异步网格创建正在进行中，此操作需要重新尝试。
 * @returns {Promise<TerrainMesh>|undefined} A 地形网格的承诺，如果已有太多
 * 异步网格创建正在进行中且操作应该
 * 稍后重新尝试。
 */
QuantizedMeshTerrainData.prototype.createMesh = function (options) {
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
  const rectangle = tilingScheme.tileXYToRectangle(x, y, level);

  const createMeshTaskProcessor = throttle
    ? createMeshTaskProcessorThrottle
    : createMeshTaskProcessorNoThrottle;

  const verticesPromise = createMeshTaskProcessor.scheduleTask({
    minimumHeight: this._minimumHeight,
    maximumHeight: this._maximumHeight,
    quantizedVertices: this._quantizedVertices,
    octEncodedNormals: this._encodedNormals,
    includeWebMercatorT: true,
    indices: this._indices,
    westIndices: this._westIndices,
    southIndices: this._southIndices,
    eastIndices: this._eastIndices,
    northIndices: this._northIndices,
    westSkirtHeight: this._westSkirtHeight,
    southSkirtHeight: this._southSkirtHeight,
    eastSkirtHeight: this._eastSkirtHeight,
    northSkirtHeight: this._northSkirtHeight,
    rectangle: rectangle,
    relativeToCenter: this._boundingSphere.center,
    ellipsoid: ellipsoid,
    exaggeration: exaggeration,
    exaggerationRelativeHeight: exaggerationRelativeHeight,
  });

  if (!defined(verticesPromise)) {
    // Postponed
    return undefined;
  }

  const that = this;
  return Promise.resolve(verticesPromise).then(function (result) {
    const vertexCountWithoutSkirts = that._quantizedVertices.length / 3;
    const vertexCount =
      vertexCountWithoutSkirts +
      that._westIndices.length +
      that._southIndices.length +
      that._eastIndices.length +
      that._northIndices.length;
    const indicesTypedArray = IndexDatatype.createTypedArray(
      vertexCount,
      result.indices,
    );

    const vertices = new Float32Array(result.vertices);
    const rtc = result.center;
    const minimumHeight = result.minimumHeight;
    const maximumHeight = result.maximumHeight;
    const boundingSphere = that._boundingSphere;
    const obb = that._orientedBoundingBox;
    const occludeePointInScaledSpace =
      Cartesian3.clone(result.occludeePointInScaledSpace) ??
      that._horizonOcclusionPoint;
    const stride = result.vertexStride;
    const terrainEncoding = TerrainEncoding.clone(result.encoding);

    // Clone complex result objects because the transfer from the web worker
    // has stripped them down to JSON-style objects.
    that._mesh = new TerrainMesh(
      rtc,
      vertices,
      indicesTypedArray,
      result.indexCountWithoutSkirts,
      vertexCountWithoutSkirts,
      minimumHeight,
      maximumHeight,
      rectangle,
      boundingSphere,
      occludeePointInScaledSpace,
      stride,
      obb,
      terrainEncoding,
      result.westIndicesSouthToNorth,
      result.southIndicesEastToWest,
      result.eastIndicesNorthToSouth,
      result.northIndicesWestToEast,
    );

    // Free memory received from server after mesh is created.
    that._quantizedVertices = undefined;
    that._encodedNormals = undefined;
    that._indices = undefined;

    that._uValues = undefined;
    that._vValues = undefined;
    that._heightValues = undefined;

    that._westIndices = undefined;
    that._southIndices = undefined;
    that._eastIndices = undefined;
    that._northIndices = undefined;

    return that._mesh;
  });
};

const upsampleTaskProcessor = new TaskProcessor(
  "upsampleQuantizedTerrainMesh",
  TerrainData.maximumAsynchronousTasks,
);

/**
 * 对此地形数据进行上采样，以便子瓦片使用。生成的实例将包含部分
 * 顶点，必要时进行插值。
 *
 * @param {TilingScheme} tilingScheme 此地形数据的镶嵌方案。
 * @param {number} thisX 此瓦片在镶嵌方案中的 X 坐标。
 * @param {number} thisY 此瓦片在镶嵌方案中的 Y 坐标。
 * @param {number} thisLevel 此瓦片在镶嵌方案中的层级。
 * @param {number} descendantX 我们正在进行上采样时，子瓦片的镶嵌方案中的 X 坐标。
 * @param {number} descendantY 我们正在上采样的下层瓦片在平铺方案中的 Y 坐标。
 * @param {number} descendantLevel 我们正在上采样的下层瓦片在平铺方案中的层级。
 * @returns {Promise<QuantizedMeshTerrainData>|undefined} A 下层瓦片上上采样后的地形数据承诺值，
 * 如果同时有太多异步上采样操作正在进行，且请求已被延迟，则视为未定义。
 * 该下层瓦片的地形高度计算值。
 */
QuantizedMeshTerrainData.prototype.upsample = function (
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

  const mesh = this._mesh;
  if (!defined(this._mesh)) {
    return undefined;
  }

  const isEastChild = thisX * 2 !== descendantX;
  const isNorthChild = thisY * 2 === descendantY;

  const ellipsoid = tilingScheme.ellipsoid;
  const childRectangle = tilingScheme.tileXYToRectangle(
    descendantX,
    descendantY,
    descendantLevel,
  );

  const upsamplePromise = upsampleTaskProcessor.scheduleTask({
    vertices: mesh.vertices,
    vertexCountWithoutSkirts: mesh.vertexCountWithoutSkirts,
    indices: mesh.indices,
    indexCountWithoutSkirts: mesh.indexCountWithoutSkirts,
    encoding: mesh.encoding,
    minimumHeight: this._minimumHeight,
    maximumHeight: this._maximumHeight,
    isEastChild: isEastChild,
    isNorthChild: isNorthChild,
    childRectangle: childRectangle,
    ellipsoid: ellipsoid,
  });

  if (!defined(upsamplePromise)) {
    // Postponed
    return undefined;
  }

  let shortestSkirt = Math.min(this._westSkirtHeight, this._eastSkirtHeight);
  shortestSkirt = Math.min(shortestSkirt, this._southSkirtHeight);
  shortestSkirt = Math.min(shortestSkirt, this._northSkirtHeight);

  const westSkirtHeight = isEastChild
    ? shortestSkirt * 0.5
    : this._westSkirtHeight;
  const southSkirtHeight = isNorthChild
    ? shortestSkirt * 0.5
    : this._southSkirtHeight;
  const eastSkirtHeight = isEastChild
    ? this._eastSkirtHeight
    : shortestSkirt * 0.5;
  const northSkirtHeight = isNorthChild
    ? this._northSkirtHeight
    : shortestSkirt * 0.5;
  const credits = this._credits;

  return Promise.resolve(upsamplePromise).then(function (result) {
    const quantizedVertices = new Uint16Array(result.vertices);
    const indicesTypedArray = IndexDatatype.createTypedArray(
      quantizedVertices.length / 3,
      result.indices,
    );
    let encodedNormals;
    if (defined(result.encodedNormals)) {
      encodedNormals = new Uint8Array(result.encodedNormals);
    }

    return new QuantizedMeshTerrainData({
      quantizedVertices: quantizedVertices,
      indices: indicesTypedArray,
      encodedNormals: encodedNormals,
      minimumHeight: result.minimumHeight,
      maximumHeight: result.maximumHeight,
      boundingSphere: BoundingSphere.clone(result.boundingSphere),
      orientedBoundingBox: OrientedBoundingBox.clone(
        result.orientedBoundingBox,
      ),
      horizonOcclusionPoint: Cartesian3.clone(result.horizonOcclusionPoint),
      westIndices: result.westIndices,
      southIndices: result.southIndices,
      eastIndices: result.eastIndices,
      northIndices: result.northIndices,
      westSkirtHeight: westSkirtHeight,
      southSkirtHeight: southSkirtHeight,
      eastSkirtHeight: eastSkirtHeight,
      northSkirtHeight: northSkirtHeight,
      childTileMask: 0,
      credits: credits,
      createdByUpsampling: true,
    });
  });
};

const maxShort = 32767;
const barycentricCoordinateScratch = new Cartesian3();

/**
 * 在指定的经度和纬度处计算地形高度。
 *
 * @param {Rectangle} rectangle 此地形数据所覆盖的矩形区域。
 * @param {number} longitude 以弧度为单位的经度。
 * @param {number} latitude 以弧度为单位的纬度。
 * @returns {number} The 指定位置处的地形高度。该位置被限制在矩形区域内，因此位于矩形外部的位置可能会得到错误结果。
 * 根据 {@link QuantizedMeshTerrainData.childTileMask} 判断给定子瓦片是否可用。假设给定的子瓦片坐标属于该瓦片的四个子瓦片之一。如果给出非子瓦片坐标，则返回东南侧子瓦片的可用性。
 */
QuantizedMeshTerrainData.prototype.interpolateHeight = function (
  rectangle,
  longitude,
  latitude,
) {
  let u = CesiumMath.clamp(
    (longitude - rectangle.west) / rectangle.width,
    0.0,
    1.0,
  );
  u *= maxShort;
  let v = CesiumMath.clamp(
    (latitude - rectangle.south) / rectangle.height,
    0.0,
    1.0,
  );
  v *= maxShort;

  if (!defined(this._mesh)) {
    return interpolateHeight(this, u, v);
  }

  return interpolateMeshHeight(this, u, v);
};

function pointInBoundingBox(u, v, u0, v0, u1, v1, u2, v2) {
  const minU = Math.min(u0, u1, u2);
  const maxU = Math.max(u0, u1, u2);
  const minV = Math.min(v0, v1, v2);
  const maxV = Math.max(v0, v1, v2);
  return u >= minU && u <= maxU && v >= minV && v <= maxV;
}

const texCoordScratch0 = new Cartesian2();
const texCoordScratch1 = new Cartesian2();
const texCoordScratch2 = new Cartesian2();

function interpolateMeshHeight(terrainData, u, v) {
  const mesh = terrainData._mesh;
  const vertices = mesh.vertices;
  const encoding = mesh.encoding;
  const indices = mesh.indices;

  for (let i = 0, len = indices.length; i < len; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const uv0 = encoding.decodeTextureCoordinates(
      vertices,
      i0,
      texCoordScratch0,
    );
    const uv1 = encoding.decodeTextureCoordinates(
      vertices,
      i1,
      texCoordScratch1,
    );
    const uv2 = encoding.decodeTextureCoordinates(
      vertices,
      i2,
      texCoordScratch2,
    );

    if (pointInBoundingBox(u, v, uv0.x, uv0.y, uv1.x, uv1.y, uv2.x, uv2.y)) {
      const barycentric = Intersections2D.computeBarycentricCoordinates(
        u,
        v,
        uv0.x,
        uv0.y,
        uv1.x,
        uv1.y,
        uv2.x,
        uv2.y,
        barycentricCoordinateScratch,
      );
      if (
        barycentric.x >= -1e-15 &&
        barycentric.y >= -1e-15 &&
        barycentric.z >= -1e-15
      ) {
        const h0 = encoding.decodeHeight(vertices, i0);
        const h1 = encoding.decodeHeight(vertices, i1);
        const h2 = encoding.decodeHeight(vertices, i2);
        return barycentric.x * h0 + barycentric.y * h1 + barycentric.z * h2;
      }
    }
  }

  // Position does not lie in any triangle in this mesh.
  return undefined;
}

function interpolateHeight(terrainData, u, v) {
  const uBuffer = terrainData._uValues;
  const vBuffer = terrainData._vValues;
  const heightBuffer = terrainData._heightValues;

  const indices = terrainData._indices;
  for (let i = 0, len = indices.length; i < len; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const u0 = uBuffer[i0];
    const u1 = uBuffer[i1];
    const u2 = uBuffer[i2];

    const v0 = vBuffer[i0];
    const v1 = vBuffer[i1];
    const v2 = vBuffer[i2];

    if (pointInBoundingBox(u, v, u0, v0, u1, v1, u2, v2)) {
      const barycentric = Intersections2D.computeBarycentricCoordinates(
        u,
        v,
        u0,
        v0,
        u1,
        v1,
        u2,
        v2,
        barycentricCoordinateScratch,
      );
      if (
        barycentric.x >= -1e-15 &&
        barycentric.y >= -1e-15 &&
        barycentric.z >= -1e-15
      ) {
        const quantizedHeight =
          barycentric.x * heightBuffer[i0] +
          barycentric.y * heightBuffer[i1] +
          barycentric.z * heightBuffer[i2];
        return CesiumMath.lerp(
          terrainData._minimumHeight,
          terrainData._maximumHeight,
          quantizedHeight / maxShort,
        );
      }
    }
  }

  // Position does not lie in any triangle in this mesh.
  return undefined;
}

/**
 * 判断给定子瓦片是否可用，基于
 * {@link QuantizedMeshTerrainData.childTileMask}。假设给定的子瓦片坐标属于该瓦片的四个子瓦片之一。如果给出非子瓦片坐标，则返回东南侧子瓦片的可用性。
 * 此（父）瓦片的瓦片 X 坐标。
 * 此（父）瓦片的瓦片 Y 坐标。
 *
 * @param {number} thisX 用于检查可用性的子瓦片的瓦片 X 坐标。
 * @param {number} thisY 用于检查可用性的子瓦片的瓦片 Y 坐标。
 * @param {number} childX 用于检查可用性的子瓦片的瓦片 X 坐标。
 * @param {number} childY 用于检查可用性的子瓦片的瓦片 Y 坐标。
 * @returns {boolean} True 如果子瓦片可用，则返回 true；否则返回 false。
 */
QuantizedMeshTerrainData.prototype.isChildAvailable = function (
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
 * 获取一个值，指示此地形数据是否通过上采样低分辨率地形数据创建。如果该值为 false，则数据来自其他来源，例如从远程服务器下载。对于通过 {@link HeightmapTerrainData#upsample} 调用返回的实例，该方法应返回 true。
 * 如果此实例是通过上采样创建的，则返回 true；否则返回 false。
 * as by downloading it from a remote server.  This method should return true for instances
 * returned from a call to {@link HeightmapTerrainData#upsample}.
 *
 * @returns {boolean} True if this instance was created by upsampling; otherwise, false.
 */
QuantizedMeshTerrainData.prototype.wasCreatedByUpsampling = function () {
  return this._createdByUpsampling;
};
export default QuantizedMeshTerrainData;
