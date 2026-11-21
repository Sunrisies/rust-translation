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
  Rectangle,
  defined,
} from "@cesium/core";
import QuantizedMeshTerrainData from "./QuantizedMeshTerrainData.js";
import TaskProcessor from "./TaskProcessor.js";
import TerrainData from "./TerrainData.js";
import TerrainEncoding from "./TerrainEncoding.js";
import TerrainMesh from "./TerrainMesh.js";

/**
 * 来自 Google Earth Enterprise 服务器的单个瓦片地形数据。
 *
 * @alias GoogleEarthEnterpriseTerrainData
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {ArrayBuffer} options.buffer 包含地形数据的缓冲区。
 * @param {number} options.negativeAltitudeExponentBias 用于编码为非常小的正值的负地形高度的乘数。
 * @param {number} options.negativeElevationThreshold 负值的阈值。
 * @param {number} [options.childTileMask=15] 指示该瓦片的四个子瓦片中哪些存在的位掩码。
 * 如果子瓦片的位被设置，当需要时也会为该瓦片请求几何数据。如果位被清除，则不会请求该子瓦片，而是从父瓦片进行上采样。位值如下：
 * <table>
 * <tr><th>位位置</th><th>位值</th><th>子瓦片</th></tr>
 * <table>
 * <tr><th>位位置</th><th>位值</th><th>子瓦片</th></tr>
 * <tr><td>0</td><td>1</td><td>西南</td></tr>
 * <tr><td>1</td><td>2</td><td>东南</td></tr>
 * <tr><td>2</td><td>4</td><td>东北</td></tr>
 * <tr><td>3</td><td>8</td><td>西北</td></tr>
 * </table>
 * @param {boolean} [options.createdByUpsampling=false] 如果此实例是通过上采样其他实例创建的，则为真；否则为假。
 * 此瓦片的致谢列表。
 * @param {Credit[]} [options.credits] 此瓦片的致谢数组。
 *
 *
 * @example
 * const buffer = ...
 * const childTileMask = ...
 * const terrainData = new Cesium.GoogleEarthEnterpriseTerrainData({
 * buffer : heightBuffer,
 * childTileMask : childTileMask
 * });
 *
 * @see TerrainData
 * @see HeightmapTerrainData
 * @see QuantizedMeshTerrainData
 */
function GoogleEarthEnterpriseTerrainData(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.buffer", options.buffer);
  Check.typeOf.number(
    "options.negativeAltitudeExponentBias",
    options.negativeAltitudeExponentBias,
  );
  Check.typeOf.number(
    "options.negativeElevationThreshold",
    options.negativeElevationThreshold,
  );
  //>>includeEnd('debug');

  this._buffer = options.buffer;
  this._credits = options.credits;
  this._negativeAltitudeExponentBias = options.negativeAltitudeExponentBias;
  this._negativeElevationThreshold = options.negativeElevationThreshold;

  // Convert from google layout to layout of other providers
  // 3 2 -> 2 3
  // 0 1 -> 0 1
  const googleChildTileMask = options.childTileMask ?? 15;
  let childTileMask = googleChildTileMask & 3; // Bottom row is identical
  childTileMask |= googleChildTileMask & 4 ? 8 : 0; // NE
  childTileMask |= googleChildTileMask & 8 ? 4 : 0; // NW

  this._childTileMask = childTileMask;

  this._createdByUpsampling = options.createdByUpsampling ?? false;

  this._skirtHeight = undefined;
  this._bufferType = this._buffer.constructor;
  this._mesh = undefined;
  this._minimumHeight = undefined;
  this._maximumHeight = undefined;
}

Object.defineProperties(GoogleEarthEnterpriseTerrainData.prototype, {
  /**
   * 此瓦片的致谢列表
   * @memberof GoogleEarthEnterpriseTerrainData.prototype
   * @type {Credit[]}
   */
  credits: {
    get: function () {
      return this._credits;
    },
  },
  /**
   * 此地形数据中包含的水掩码，如果有。水掩码是一个矩形
   * Uint8Array 或图像，其中值 255 表示水域，值 0 表示陆地。
   * 0 到 255 之间的值也被允许，以平滑地过渡陆地和水域。
   * @memberof GoogleEarthEnterpriseTerrainData.prototype
   * @type {Uint8Array|HTMLImageElement|HTMLCanvasElement|undefined}
   */
  waterMask: {
    get: function () {
      return undefined;
    },
  },
});

const createMeshTaskName = "createVerticesFromGoogleEarthEnterpriseBuffer";
const createMeshTaskProcessorNoThrottle = new TaskProcessor(createMeshTaskName);
const createMeshTaskProcessorThrottle = new TaskProcessor(
  createMeshTaskName,
  TerrainData.maximumAsynchronousTasks,
);

const nativeRectangleScratch = new Rectangle();
const rectangleScratch = new Rectangle();

/**
 * 从此地形数据创建 {@link TerrainMesh}。
 *
 * @private
 *
 * @param {object} options 具有以下属性的对象：
 * @param {TilingScheme} options.tilingScheme 该瓦片所属的平铺方案。
 * @param {number} options.x 创建地形数据的瓦片的 X 坐标。
 * @param {number} options.y 创建地形数据的瓦片的 Y 坐标。
 * @param {number} options.level 创建地形数据的瓦片的层级。
 * @param {number} [options.exaggeration=1.0] 用于放大地形比例的缩放比例。
 * @param {number} [options.exaggerationRelativeHeight=0.0] 地形被放大的高度。
 * @param {boolean} [options.throttle=true] 如果为真，表示如果已有太多异步网格创建正在进行中，此操作需要重新尝试。
 * @returns {Promise<TerrainMesh>|undefined} A 地形网格的承诺，如果已有太多
 * 异步网格创建正在进行中且操作应该
 * 稍后重新尝试。
 */
GoogleEarthEnterpriseTerrainData.prototype.createMesh = function (options) {
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
  tilingScheme.tileXYToNativeRectangle(x, y, level, nativeRectangleScratch);
  tilingScheme.tileXYToRectangle(x, y, level, rectangleScratch);

  // Compute the center of the tile for RTC rendering.
  const center = ellipsoid.cartographicToCartesian(
    Rectangle.center(rectangleScratch),
  );

  const levelZeroMaxError = 40075.16; // From Google's Doc
  const thisLevelMaxError = levelZeroMaxError / (1 << level);
  this._skirtHeight = Math.min(thisLevelMaxError * 8.0, 1000.0);

  const createMeshTaskProcessor = throttle
    ? createMeshTaskProcessorThrottle
    : createMeshTaskProcessorNoThrottle;

  const verticesPromise = createMeshTaskProcessor.scheduleTask({
    buffer: this._buffer,
    nativeRectangle: nativeRectangleScratch,
    rectangle: rectangleScratch,
    relativeToCenter: center,
    ellipsoid: ellipsoid,
    skirtHeight: this._skirtHeight,
    exaggeration: exaggeration,
    exaggerationRelativeHeight: exaggerationRelativeHeight,
    includeWebMercatorT: true,
    negativeAltitudeExponentBias: this._negativeAltitudeExponentBias,
    negativeElevationThreshold: this._negativeElevationThreshold,
  });

  if (!defined(verticesPromise)) {
    // Postponed
    return undefined;
  }

  const that = this;
  return verticesPromise.then(function (result) {
    // Clone complex result objects because the transfer from the web worker
    // has stripped them down to JSON-style objects.
    that._mesh = new TerrainMesh(
      center,
      new Float32Array(result.vertices),
      new Uint16Array(result.indices),
      result.indexCountWithoutSkirts,
      result.vertexCountWithoutSkirts,
      result.minimumHeight,
      result.maximumHeight,
      rectangleScratch,
      BoundingSphere.clone(result.boundingSphere3D),
      Cartesian3.clone(result.occludeePointInScaledSpace),
      result.numberOfAttributes,
      OrientedBoundingBox.clone(result.orientedBoundingBox),
      TerrainEncoding.clone(result.encoding),
      result.westIndicesSouthToNorth,
      result.southIndicesEastToWest,
      result.eastIndicesNorthToSouth,
      result.northIndicesWestToEast,
    );

    that._minimumHeight = result.minimumHeight;
    that._maximumHeight = result.maximumHeight;

    // Free memory received from server after mesh is created.
    that._buffer = undefined;
    return that._mesh;
  });
};

/**
 * 在指定的经度和纬度计算地形高度。
 *
 * @param {Rectangle} rectangle 此地形数据覆盖的矩形区域。
 * @param {number} longitude 以弧度表示的经度。
 * @param {number} latitude 以弧度为单位的纬度。
 * @returns {number} The 指定位置处的地形高度。如果位置
 * 位于矩形框外，该方法将进行外推计算，但结果可能非常
 * 不准确，尤其是在矩形框外的位置。
 */
GoogleEarthEnterpriseTerrainData.prototype.interpolateHeight = function (
  rectangle,
  longitude,
  latitude,
) {
  const u = CesiumMath.clamp(
    (longitude - rectangle.west) / rectangle.width,
    0.0,
    1.0,
  );
  const v = CesiumMath.clamp(
    (latitude - rectangle.south) / rectangle.height,
    0.0,
    1.0,
  );

  if (!defined(this._mesh)) {
    return interpolateHeight(this, u, v, rectangle);
  }

  return interpolateMeshHeight(this, u, v);
};

const upsampleTaskProcessor = new TaskProcessor(
  "upsampleQuantizedTerrainMesh",
  TerrainData.maximumAsynchronousTasks,
);

/**
 * 对地形数据进行上采样，以便由子瓦片使用。生成的实例将包含该实例中的部分
 * 高度样本，必要时进行插值处理。
 *
 * @param {TilingScheme} tilingScheme 此地形数据的瓦片划分方案。
 * @param {number} thisX 该瓦片在瓦片划分方案中的 X 坐标。
 * @param {number} thisY 该瓦片在瓦片划分方案中的 Y 坐标。
 * @param {number} thisLevel 该瓦片在瓦片划分方案中的层级。
 * @param {number} descendantX 我们正在进行上采样子的瓦片在瓦片划分方案中的 X 坐标。
 * @param {number} descendantY 我们正在进行上采样子的瓦片在瓦片划分方案中的 Y 坐标。
 * @param {number} descendantLevel 我们正在上采样子的瓦片在瓦片划分方案中的层级。
 * @returns {Promise<HeightmapTerrainData>|undefined} A 对于子瓦片的上采样地形数据，其预期效果，
 * 如果同时有太多异步上采样操作正在进行且请求已被
 * 延迟，则结果为未定义。
 */
GoogleEarthEnterpriseTerrainData.prototype.upsample = function (
  tilingScheme,
  thisX,
  thisY,
  thisLevel,
  descendantX,
  descendantY,
  descendantLevel,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("tilingScheme", tilingScheme);
  Check.typeOf.number("thisX", thisX);
  Check.typeOf.number("thisY", thisY);
  Check.typeOf.number("thisLevel", thisLevel);
  Check.typeOf.number("descendantX", descendantX);
  Check.typeOf.number("descendantY", descendantY);
  Check.typeOf.number("descendantLevel", descendantLevel);
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
    indices: mesh.indices,
    indexCountWithoutSkirts: mesh.indexCountWithoutSkirts,
    vertexCountWithoutSkirts: mesh.vertexCountWithoutSkirts,
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

  const that = this;
  return upsamplePromise.then(function (result) {
    const quantizedVertices = new Uint16Array(result.vertices);
    const indicesTypedArray = IndexDatatype.createTypedArray(
      quantizedVertices.length / 3,
      result.indices,
    );

    const skirtHeight = that._skirtHeight;

    // Use QuantizedMeshTerrainData since we have what we need already parsed
    return new QuantizedMeshTerrainData({
      quantizedVertices: quantizedVertices,
      indices: indicesTypedArray,
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
      westSkirtHeight: skirtHeight,
      southSkirtHeight: skirtHeight,
      eastSkirtHeight: skirtHeight,
      northSkirtHeight: skirtHeight,
      childTileMask: 0,
      createdByUpsampling: true,
      credits: that._credits,
    });
  });
};

/**
 * 根据
 * {@link GoogleEarthEnterpriseTerrainData.childTileMask} 判断给定子瓦片是否可用。给定的子瓦片坐标假设为
 * 该瓦片的四个子瓦片之一。如果给出非子瓦片坐标，
 * 则返回东南子瓦片的可用性。
 *
 * @param {number} thisX 此（父）瓦片的瓦片 X 坐标。
 * @param {number} thisY 此（父）瓦片的瓦片 Y 坐标。
 * @param {number} childX 用于检查可用性的子瓦片的瓦片 X 坐标。
 * @param {number} childY 用于检查可用性的子瓦片的瓦片 Y 坐标。
 * @returns {boolean} True 如果子瓦片可用，则返回真；否则返回假。
 */
GoogleEarthEnterpriseTerrainData.prototype.isChildAvailable = function (
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
 * 获取一个值，指示此地形数据是否通过上采样低分辨率地形数据创建。如果此值为假，则数据来自其他来源，例如
 * 从远程服务器下载。对于由 {@link HeightmapTerrainData#upsample} 调用返回的实例，该方法应返回真
 * 表示此实例是通过上采样创建的；否则返回假。
 * returned from a call to {@link HeightmapTerrainData#upsample}.
 *
 * @returns {boolean} True if this instance was created by upsampling; otherwise, false.
 */
GoogleEarthEnterpriseTerrainData.prototype.wasCreatedByUpsampling =
  function () {
    return this._createdByUpsampling;
  };

const texCoordScratch0 = new Cartesian2();
const texCoordScratch1 = new Cartesian2();
const texCoordScratch2 = new Cartesian2();
const barycentricCoordinateScratch = new Cartesian3();

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

  // Position does not lie in any triangle in this mesh.
  return undefined;
}

const sizeOfUint16 = Uint16Array.BYTES_PER_ELEMENT;
const sizeOfUint32 = Uint32Array.BYTES_PER_ELEMENT;
const sizeOfInt32 = Int32Array.BYTES_PER_ELEMENT;
const sizeOfFloat = Float32Array.BYTES_PER_ELEMENT;
const sizeOfDouble = Float64Array.BYTES_PER_ELEMENT;

function interpolateHeight(terrainData, u, v, rectangle) {
  const buffer = terrainData._buffer;
  let quad = 0; // SW
  let uStart = 0.0;
  let vStart = 0.0;
  if (v > 0.5) {
    // Upper row
    if (u > 0.5) {
      // NE
      quad = 2;
      uStart = 0.5;
    } else {
      // NW
      quad = 3;
    }
    vStart = 0.5;
  } else if (u > 0.5) {
    // SE
    quad = 1;
    uStart = 0.5;
  }

  const dv = new DataView(buffer);
  let offset = 0;
  for (let q = 0; q < quad; ++q) {
    offset += dv.getUint32(offset, true);
    offset += sizeOfUint32;
  }
  offset += sizeOfUint32; // Skip length of quad
  offset += 2 * sizeOfDouble; // Skip origin

  // Read sizes
  const xSize = CesiumMath.toRadians(dv.getFloat64(offset, true) * 180.0);
  offset += sizeOfDouble;
  const ySize = CesiumMath.toRadians(dv.getFloat64(offset, true) * 180.0);
  offset += sizeOfDouble;

  // Samples per quad
  const xScale = rectangle.width / xSize / 2;
  const yScale = rectangle.height / ySize / 2;

  // Number of points
  const numPoints = dv.getInt32(offset, true);
  offset += sizeOfInt32;

  // Number of faces
  const numIndices = dv.getInt32(offset, true) * 3;
  offset += sizeOfInt32;

  offset += sizeOfInt32; // Skip Level

  const uBuffer = new Array(numPoints);
  const vBuffer = new Array(numPoints);
  const heights = new Array(numPoints);
  let i;
  for (i = 0; i < numPoints; ++i) {
    uBuffer[i] = uStart + dv.getUint8(offset++) * xScale;
    vBuffer[i] = vStart + dv.getUint8(offset++) * yScale;

    // Height is stored in units of (1/EarthRadius) or (1/6371010.0)
    heights[i] = dv.getFloat32(offset, true) * 6371010.0;
    offset += sizeOfFloat;
  }

  const indices = new Array(numIndices);
  for (i = 0; i < numIndices; ++i) {
    indices[i] = dv.getUint16(offset, true);
    offset += sizeOfUint16;
  }

  for (i = 0; i < numIndices; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const u0 = uBuffer[i0];
    const u1 = uBuffer[i1];
    const u2 = uBuffer[i2];

    const v0 = vBuffer[i0];
    const v1 = vBuffer[i1];
    const v2 = vBuffer[i2];

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
      return (
        barycentric.x * heights[i0] +
        barycentric.y * heights[i1] +
        barycentric.z * heights[i2]
      );
    }
  }

  // Position does not lie in any triangle in this mesh.
  return undefined;
}
export default GoogleEarthEnterpriseTerrainData;
