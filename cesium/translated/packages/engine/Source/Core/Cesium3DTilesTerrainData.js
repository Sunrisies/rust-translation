import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Check,
  DeveloperError,
  Frozen,
  Intersections2D,
  Math as CesiumMath,
  OrientedBoundingBox,
  Rectangle,
  defined,
} from "@cesium/core";
import Cesium3DTilesTerrainGeometryProcessor from "./Cesium3DTilesTerrainGeometryProcessor.js";
import TaskProcessor from "./TaskProcessor.js";
import TerrainData from "./TerrainData.js";
import TerrainEncoding from "./TerrainEncoding.js";
import TerrainMesh from "./TerrainMesh.js";

/**
 * 单个瓦片的地形数据以 glb（二进制 glTF）格式呈现。
 *
 * @alias Cesium3DTilesTerrainData
 * @experimental This 该特征尚未最终确定，可能会根据 Cesium 的标准弃用政策发生变化。
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Object.<string,*>} options.gltf 解析后的 glTF JSON 数据。
 * @param {number} options.minimumHeight 瓦片内的最低地形高度，以椭圆体上方米为单位。
 * @param {number} options.maximumHeight 瓦片内的最高地形高度，以椭圆体上方米为单位。
 * @param {BoundingSphere} options.boundingSphere 包围网格中所有顶点的球体。
 * @param {OrientedBoundingBox} options.orientedBoundingBox 包含网格中所有顶点的定向边界框。
 * @param {Cartesian3} options.horizonOcclusionPoint 网格的地平线遮挡点。如果此点
 * 位于地平线下方，则整个瓦片也被认为位于地平线下方。
 * 该点以椭圆体缩放坐标表示。
 * @param {number} options.skirtHeight 在瓦片边缘增加的裙边高度。
 * @param {boolean} [options.requestVertexNormals=false] 指示是否应加载法线数据。
 * @param {boolean} [options.requestWaterMask=false] 指示是否应加载水掩模数据。
 * @param {Credit[]} [options.credits] 此瓦片的致谢列表。
 * @param {number} [options.childTileMask=15] 指示该瓦片的四个子瓦片中哪些存在的位掩码。
 * 如果某个子瓦片的位被设置，当该子瓦片
 * 需要时，也会请求其几何数据。如果位被清除，则不会请求该子瓦片的几何数据，而是从父瓦片进行上采样。位值如下：
 * <table>
 * <tr><th>位位置</th><th>位值</th><th>子瓦片</th></tr>
 * <tr><td>0</td><td>1</td><td>西南</td></tr>
 * <tr><td>1</td><td>2</td><td>东南</td></tr>
 * <tr><td>2</td><td>4</td><td>西北</td></tr>
 * <tr><td>3</td><td>8</td><td>东北</td></tr>
 * <tr><td>3</td><td>12</td><td>北</td></tr>
 * </table>
 * @param {Uint8Array} [options.waterMask] 包含水掩模的缓冲区。
 * @see TerrainData
 * @see QuantizedMeshTerrainData
 * @see HeightmapTerrainData
 * @see GoogleEarthEnterpriseTerrainData
 */
function Cesium3DTilesTerrainData(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug)
  Check.defined("options.gltf", options.gltf);
  Check.typeOf.number("options.minimumHeight", options.minimumHeight);
  Check.typeOf.number("options.maximumHeight", options.maximumHeight);
  Check.typeOf.object("options.boundingSphere", options.boundingSphere);
  Check.typeOf.object(
    "option.orientedBoundingBox",
    options.orientedBoundingBox,
  );
  Check.typeOf.object(
    "options.horizonOcclusionPoint",
    options.horizonOcclusionPoint,
  );
  Check.typeOf.number("options.skirtHeight", options.skirtHeight);
  //>>includeEnd('debug');

  this._minimumHeight = options.minimumHeight;
  this._maximumHeight = options.maximumHeight;
  this._skirtHeight = options.skirtHeight;
  this._boundingSphere = BoundingSphere.clone(
    options.boundingSphere,
    new BoundingSphere(),
  );
  this._orientedBoundingBox = OrientedBoundingBox.clone(
    options.orientedBoundingBox,
    new OrientedBoundingBox(),
  );
  this._horizonOcclusionPoint = Cartesian3.clone(
    options.horizonOcclusionPoint,
    new Cartesian3(),
  );
  this._hasVertexNormals = options.requestVertexNormals ?? false;
  this._hasWaterMask = options.requestWaterMask ?? false;
  this._hasWebMercatorT = true;
  this._credits = options.credits;
  this._childTileMask = options.childTileMask ?? 15;
  this._gltf = options.gltf;

  /**
   * @private
   * @type {TerrainMesh|undefined}
   */
  this._mesh = undefined;

  this._waterMask = options.waterMask;
}

Object.defineProperties(Cesium3DTilesTerrainData.prototype, {
  /**
   * 此瓦片的致谢列表。
   * @memberof Cesium3DTilesTerrainData.prototype
   * @type {Credit[]|undefined}
   */
  credits: {
    get: function () {
      return this._credits;
    },
  },
  /**
   * 如果有的话，此地形数据中包含的水掩模。水掩模是一个矩形
   * Uint8Array 或图像，其中值 255 表示水域，值 0 表示陆地。
   * 0 到 255 之间的数值也被允许，用于平滑地过渡陆地和水域。
   * @memberof Cesium3DTilesTerrainData.prototype
   * @type {Uint8Array|HTMLImageElement|HTMLCanvasElement|ImageBitmap|undefined}
   */
  waterMask: {
    get: function () {
      return this._waterMask;
    },
  },
});

/**
 * 返回指定经度和纬度处的地形高度，如果网格未定义则返回 undefined。
 *
 * @param {Rectangle} rectangle 此地形数据所覆盖的矩形区域。
 * @param {number} longitude 以弧度表示的经度。
 * @param {number} latitude 以弧度表示的纬度。
 * @returns {number|undefined} The 指定位置处的地形高度，如果网格未定义则返回 undefined。
 * 如果位置在矩形区域之外，此方法将外推高度，
 * 对于矩形区域外的位置，这种外推结果很可能非常不准确。
 */
Cesium3DTilesTerrainData.prototype.interpolateHeight = function (
  rectangle,
  longitude,
  latitude,
) {
  const mesh = this._mesh;
  if (mesh === undefined) {
    return undefined;
  }

  const height = interpolateMeshHeight(mesh, rectangle, longitude, latitude);
  return height;
};

/**
 * 根据
 * {@link TerrainData#childTileMask} 判断给定子瓦片是否可用。给定的子瓦片坐标假定为
 * 该瓦片的四个子瓦片之一。如果给出非子瓦片坐标，
 * 则返回东南子瓦片的可用性。
 *
 * @param {number} thisX 此（父）瓦片的瓦片 X 坐标。
 * @param {number} thisY 此（父）瓦片的瓦片 Y 坐标。
 * @param {number} childX 用于检查可用性的子瓦片的瓦片 X 坐标。
 * @param {number} childY 用于检查可用性的子瓦片的瓦片 Y 坐标。
 * @returns {boolean} True 如果子瓦片可用，则为 true；否则为 false。
 */
Cesium3DTilesTerrainData.prototype.isChildAvailable = function (
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

const createMeshTaskName = "createVerticesFromCesium3DTilesTerrain";
const createMeshTaskProcessorNoThrottle = new TaskProcessor(createMeshTaskName);
const createMeshTaskProcessorThrottle = new TaskProcessor(
  createMeshTaskName,
  TerrainData.maximumAsynchronousTasks,
);

/**
 * 从此地形数据创建 {@link TerrainMesh}。
 *
 * @private
 *
 * @param {object} options 具有以下属性的对象：
 * @param {TilingScheme} options.tilingScheme 此瓦片所属的平铺方案。
 * @param {number} options.x 用于创建地形数据的瓦片的 X 坐标。
 * @param {number} options.y 用于创建地形数据的瓦片的 Y 坐标。
 * @param {number} options.level 用于创建地形数据的瓦片的层级。
 * @param {number} [options.exaggeration=1.0] 用于夸大地形的比例。
 * @param {number} [options.exaggerationRelativeHeight=0.0] 地形被夸大的相对高度。
 * @param {boolean} [options.throttle=true] 如果为 true，表示如果已有太多异步网格创建正在进行中，此操作需要重新尝试。
 * @returns {Promise.<TerrainMesh>|undefined} A 地形网格的承诺，如果已有太多
 * 异步网格创建正在进行中且操作应该
 * 稍后重新尝试。
 */
Cesium3DTilesTerrainData.prototype.createMesh = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug)
  Check.typeOf.object("options.tilingScheme", options.tilingScheme);
  Check.typeOf.number("options.x", options.x);
  Check.typeOf.number("options.y", options.y);
  Check.typeOf.number("options.level", options.level);
  //>>includeEnd('debug');

  const throttle = options.throttle ?? true;
  const createMeshTaskProcessor = throttle
    ? createMeshTaskProcessorThrottle
    : createMeshTaskProcessorNoThrottle;

  const tilingScheme = options.tilingScheme;
  const ellipsoid = tilingScheme.ellipsoid;
  const x = options.x;
  const y = options.y;
  const level = options.level;
  const rectangle = tilingScheme.tileXYToRectangle(
    x,
    y,
    level,
    new Rectangle(),
  );

  const gltf = this._gltf;
  const verticesPromise = createMeshTaskProcessor.scheduleTask({
    ellipsoid: ellipsoid,
    rectangle: rectangle,
    hasVertexNormals: this._hasVertexNormals,
    hasWaterMask: this._hasWaterMask,
    hasWebMercatorT: this._hasWebMercatorT,
    gltf: gltf,
    minimumHeight: this._minimumHeight,
    maximumHeight: this._maximumHeight,
    boundingSphere: this._boundingSphere,
    orientedBoundingBox: this._orientedBoundingBox,
    horizonOcclusionPoint: this._horizonOcclusionPoint,
    skirtHeight: this._skirtHeight,
    exaggeration: options.exaggeration,
    exaggerationRelativeHeight: options.exaggerationRelativeHeight,
  });

  if (!defined(verticesPromise)) {
    // Too many active requests. Postponed.
    return undefined;
  }

  const that = this;
  return Promise.resolve(verticesPromise).then(function (result) {
    const taskResult = result;

    // Need to re-clone and re-wrap all buffers and complex objects to put them back into their normal state
    const encoding = TerrainEncoding.clone(
      taskResult.encoding,
      new TerrainEncoding(),
    );
    const vertices = new Float32Array(taskResult.verticesBuffer);
    const vertexCount = vertices.length / encoding.stride;
    const vertexCountWithoutSkirts = taskResult.vertexCountWithoutSkirts;
    // For consistency with glTF spec, 16 bit index buffer can't contain 65535
    const SizedIndexType = vertexCount <= 65535 ? Uint16Array : Uint32Array;
    const indices = new SizedIndexType(taskResult.indicesBuffer);
    const westIndices = new SizedIndexType(taskResult.westIndicesBuffer);
    const eastIndices = new SizedIndexType(taskResult.eastIndicesBuffer);
    const southIndices = new SizedIndexType(taskResult.southIndicesBuffer);
    const northIndices = new SizedIndexType(taskResult.northIndicesBuffer);
    const indexCountWithoutSkirts = taskResult.indexCountWithoutSkirts;
    const minimumHeight = that._minimumHeight;
    const maximumHeight = that._maximumHeight;
    const center = Cartesian3.clone(encoding.center, new Cartesian3());
    const boundingSphere = BoundingSphere.clone(
      that._boundingSphere,
      new BoundingSphere(),
    );
    const horizonOcclusionPoint = Cartesian3.clone(
      that._horizonOcclusionPoint,
      new Cartesian3(),
    );
    const orientedBoundingBox = OrientedBoundingBox.clone(
      that._orientedBoundingBox,
      new OrientedBoundingBox(),
    );

    const mesh = new TerrainMesh(
      center,
      vertices,
      indices,
      indexCountWithoutSkirts,
      vertexCountWithoutSkirts,
      minimumHeight,
      maximumHeight,
      rectangle,
      boundingSphere,
      horizonOcclusionPoint,
      encoding.stride,
      orientedBoundingBox,
      encoding,
      westIndices,
      southIndices,
      eastIndices,
      northIndices,
    );

    that._mesh = mesh;

    return Promise.resolve(mesh);
  });
};

/**
 * 从此地形数据同步创建 {@link TerrainMesh}。
 *
 * @private
 *
 * @param {object} options 具有以下属性的对象：
 * @param {TilingScheme} options.tilingScheme 此瓦片所属的平铺方案。
 * @param {number} options.x 用于创建地形数据的瓦片的 X 坐标。
 * @param {number} options.y 用于创建地形数据的瓦片的 Y 坐标。
 * @param {number} options.level 用于创建地形数据的瓦片的层级。
 * @param {number} [options.exaggeration=1.0] 用于夸大地形的比例。
 * @param {number} [options.exaggerationRelativeHeight=0.0] 地形被夸大的相对高度。
 * @returns {Promise.<TerrainMesh>} A 地形网格的承诺。
 */
Cesium3DTilesTerrainData.prototype._createMeshSync = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug)
  Check.typeOf.object("options.tilingScheme", options.tilingScheme);
  Check.typeOf.number("options.x", options.x);
  Check.typeOf.number("options.y", options.y);
  Check.typeOf.number("options.level", options.level);
  //>>includeEnd('debug');

  const tilingScheme = options.tilingScheme;
  const ellipsoid = tilingScheme.ellipsoid;
  const x = options.x;
  const y = options.y;
  const level = options.level;
  const rectangle = tilingScheme.tileXYToRectangle(
    x,
    y,
    level,
    new Rectangle(),
  );

  const meshPromise = Cesium3DTilesTerrainGeometryProcessor.createMesh({
    ellipsoid: ellipsoid,
    rectangle: rectangle,
    hasVertexNormals: this._hasVertexNormals,
    hasWebMercatorT: this._hasWebMercatorT,
    gltf: this._gltf,
    minimumHeight: this._minimumHeight,
    maximumHeight: this._maximumHeight,
    boundingSphere: this._boundingSphere,
    orientedBoundingBox: this._orientedBoundingBox,
    horizonOcclusionPoint: this._horizonOcclusionPoint,
    skirtHeight: this._skirtHeight,
    exaggeration: options.exaggeration,
    exaggerationRelativeHeight: options.exaggerationRelativeHeight,
  });

  const that = this;
  return Promise.resolve(meshPromise).then(function (mesh) {
    that._mesh = mesh;
    return Promise.resolve(mesh);
  });
};

/**
 * 对此地形数据进行上采样，以便子瓦片使用。
 *
 * @param {TilingScheme} tilingScheme 此地形数据的平铺方案。
 * @param {number} thisX 此瓦片在平铺方案中的 X 坐标。
 * @param {number} thisY 此瓦片在平铺方案中的 Y 坐标。
 * @param {number} thisLevel 此瓦片在平铺方案中的层级。
 * @param {number} descendantX 我们正在进行上采样的子瓦片在平铺方案中的 X 坐标。
 * @param {number} descendantY 我们正在进行上采样的子瓦片在平铺方案中的 Y 坐标。
 * @param {number} descendantLevel 我们正在进行上采样的子瓦片在平铺方案中的层级。
 * @returns {Promise.<TerrainData>|undefined} A 对于子 tile 的放大地形数据承诺值，如果尚未调用 createMesh 或正在执行过多异步放大操作导致请求被延迟，则值为 undefined。
 */
Cesium3DTilesTerrainData.prototype.upsample = function (
  tilingScheme,
  thisX,
  thisY,
  thisLevel,
  descendantX,
  descendantY,
  descendantLevel,
) {
  // mesh is not defined, so there are no UVs yet, so exit early
  const mesh = this._mesh;
  if (mesh === undefined) {
    return undefined;
  }

  const isSynchronous = false;
  const upsampledTerrainData = upsampleMesh(
    isSynchronous,
    mesh,
    this._skirtHeight,
    this._credits,
    tilingScheme,
    thisX,
    thisY,
    thisLevel,
    descendantX,
    descendantY,
    descendantLevel,
  );
  return upsampledTerrainData;
};

/**
 * 同步地将此地形数据放大，以供子 tile 使用。
 *
 * @private
 *
 * @param {TilingScheme} tilingScheme 此地形数据的切片方案。
 * @param {number} thisX 此 tile 在切片方案中的 X 坐标。
 * @param {number} thisY 此 tile 在切片方案中的 Y 坐标。
 * @param {number} thisLevel 此 tile 在切片方案中的层级。
 * @param {number} descendantX 我们正在放大的子 tile 在切片方案中的 X 坐标。
 * @param {number} descendantY 我们正在放大的子 tile 在切片方案中的 Y 坐标。
 * @param {number} descendantLevel 我们正在放大的子 tile 在切片方案中的层级。
 * @returns {Promise.<TerrainData>|undefined} A 对于子 tile 的放大地形数据承诺值，如果尚未调用 createMesh 则值为 undefined。
 */
Cesium3DTilesTerrainData.prototype._upsampleSync = function (
  tilingScheme,
  thisX,
  thisY,
  thisLevel,
  descendantX,
  descendantY,
  descendantLevel,
) {
  // mesh is not defined, so there are no UVs yet, so exit early
  const mesh = this._mesh;
  if (mesh === undefined) {
    return undefined;
  }

  const isSynchronous = true;
  const upsampledTerrainData = upsampleMesh(
    isSynchronous,
    mesh,
    this._skirtHeight,
    this._credits,
    tilingScheme,
    thisX,
    thisY,
    thisLevel,
    descendantX,
    descendantY,
    descendantLevel,
  );
  return upsampledTerrainData;
};

/**
 * 获取一个值指示此地形数据是否通过放大低分辨率数据创建。
 * 地形数据。如果此值为 false，则数据来自其他来源，例如从远程服务器下载。此方法对于通过 {@link Cesium3DTilesTerrainData#upsample} 调用得到的实例应返回 true。
 * 如果此实例是通过放大创建的，则值为 true；否则为 false。
 * 具有以下属性的对象：
 *
 * @returns {boolean} True 地形网格。
 */
Cesium3DTilesTerrainData.prototype.wasCreatedByUpsampling = function () {
  return false;
};

/**
 * @private
 * @constructor
 *
 * @param {object} options 在 tile 边缘添加的裙边高度。
 * @param {TerrainMesh} options.terrainMesh 此 tile 的信用数组。
 * @param {number} options.skirtHeight 从此地形数据创建 {@link TerrainMesh}。
 * @param {Credit[]} [options.credits] 具有以下属性的对象：
 */
function Cesium3DTilesUpsampleTerrainData(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug)
  Check.defined("options.terrainMesh", options.terrainMesh);
  Check.defined("options.skirtHeight", options.skirtHeight);
  //>>includeEnd('debug');

  this._mesh = options.terrainMesh;
  this._skirtHeight = options.skirtHeight;
  this._credits = options.credits;
}

/**
 * 从此地形数据创建 {@link TerrainMesh}。
 *
 * @private
 *
 * @param {object} options 具有以下属性的对象：
 * @param {TilingScheme} options.tilingScheme 此 tile 所属的切片方案。
 * @param {number} options.x 用于创建地形数据的 tile 的 X 坐标。
 * @param {number} options.y 用于创建地形数据的 tile 的 Y 坐标。
 * @param {number} options.level 用于创建地形数据的 tile 的层级。
 * @param {number} [options.exaggeration=1.0] 用于放大地形的比例。
 * @param {number} [options.exaggerationRelativeHeight=0.0] 地形被放大的相对高度。
 * @param {boolean} [options.throttle=true] 如果为 true，表示如果已有过多异步网格创建正在进行中，则此操作需要重新尝试。
 * @returns {Promise.<TerrainMesh>|undefined} A 地形网格的承诺值，如果已有过多异步网格创建正在进行中且操作需要稍后重新尝试，则值为 undefined。
 */
Cesium3DTilesUpsampleTerrainData.prototype.createMesh = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.tilingScheme", options.tilingScheme);
  Check.typeOf.number("options.x", options.x);
  Check.typeOf.number("options.y", options.y);
  Check.typeOf.number("options.level", options.level);
  //>>includeEnd('debug');

  return Promise.resolve(this._mesh);
};

/**
 * 同步地将此地形数据放大，以供子 tile 使用。
 *
 * @param {TilingScheme} tilingScheme 此地形数据的切片方案。
 * @param {number} thisX 此 tile 在切片方案中的 X 坐标。
 * @param {number} thisY 此瓦片在镶嵌方案中的 Y 坐标。
 * @param {number} thisLevel 此瓦片在镶嵌方案中的层级。
 * @param {number} descendantX 我们进行上采样所针对的后续瓦片在镶嵌方案中的 X 坐标。
 * @param {number} descendantY 我们进行上采样所针对的后续瓦片在镶嵌方案中的 Y 坐标。
 * @param {number} descendantLevel 我们进行上采样所针对的后续瓦片在镶嵌方案中的层级。
 * @returns {Promise.<TerrainData>|undefined} A 后续瓦片上采样地形数据的承诺，如果同时有太多异步上采样操作正在进行且请求被延迟，则定义为未定义。
 */
Cesium3DTilesUpsampleTerrainData.prototype.upsample = function (
  tilingScheme,
  thisX,
  thisY,
  thisLevel,
  descendantX,
  descendantY,
  descendantLevel,
) {
  const isSynchronous = false;
  const upsampledTerrainData = upsampleMesh(
    isSynchronous,
    this._mesh,
    this._skirtHeight,
    this._credits,
    tilingScheme,
    thisX,
    thisY,
    thisLevel,
    descendantX,
    descendantY,
    descendantLevel,
  );
  return upsampledTerrainData;
};

/**
 * 同步地将此地形数据上采样，以便后续瓦片使用。
 *
 * @private
 *
 * @param {TilingScheme} tilingScheme 此地形数据的镶嵌方案。
 * @param {number} thisX 此瓦片在镶嵌方案中的 X 坐标。
 * @param {number} thisY 此瓦片在镶嵌方案中的 Y 坐标。
 * @param {number} thisLevel 此瓦片在镶嵌方案中的层级。
 * @param {number} descendantX 我们进行上采样所针对的后续瓦片在镶嵌方案中的 X 坐标。
 * @param {number} descendantY 我们进行上采样所针对的后续瓦片在镶嵌方案中的 Y 坐标。
 * @param {number} descendantLevel 我们进行上采样所针对的后续瓦片在镶嵌方案中的层级。
 * @returns {Promise.<TerrainData>} A 后续瓦片上采样地形数据的承诺。
 */
Cesium3DTilesUpsampleTerrainData.prototype._upsampleSync = function (
  tilingScheme,
  thisX,
  thisY,
  thisLevel,
  descendantX,
  descendantY,
  descendantLevel,
) {
  const isSynchronous = true;
  return upsampleMesh(
    isSynchronous,
    this._mesh,
    this._skirtHeight,
    this._credits,
    tilingScheme,
    thisX,
    thisY,
    thisLevel,
    descendantX,
    descendantY,
    descendantLevel,
  );
};

/**
 * 在指定的经度和纬度处计算地形高度。
 *
 * @param {Rectangle} rectangle 此地形数据所覆盖的矩形区域。
 * @param {number} longitude 以弧度表示的经度。
 * @param {number} latitude 以弧度表示的纬度。
 * @returns {number} The 指定位置处的地形高度。如果位置位于矩形区域之外，该方法将进行外推计算，但对于矩形区域之外的位置，结果可能非常不准确。
 */
Cesium3DTilesUpsampleTerrainData.prototype.interpolateHeight = function (
  rectangle,
  longitude,
  latitude,
) {
  const mesh = this._mesh;
  const height = interpolateMeshHeight(mesh, rectangle, longitude, latitude);
  return height;
};

/**
 * 获取一个值，指示此地形数据是否通过上采样低分辨率数据生成。
 * 地形数据。如果此值为 false，则数据来自其他来源，例如从远程服务器下载。对于通过 {@link TerrainData#upsample} 调用返回的实例，该方法应返回 true。
 * 如果此实例是通过上采样生成的，则为 true；否则为 false。
 * 根据 {@link TerrainData#childTileMask} 判断给定子瓦片是否可用。假设给定的子瓦片坐标属于此瓦片的四个子瓦片之一。如果给出非子瓦片坐标，则返回东南子瓦片的可用性。
 *
 * @returns {boolean} True 此（父）瓦片的瓦片 X 坐标。
 */
Cesium3DTilesUpsampleTerrainData.prototype.wasCreatedByUpsampling =
  function () {
    return true;
  };

/**
 * 此（父）瓦片的瓦片 Y 坐标。
 * {@link TerrainData#childTileMask}. The given child tile coordinates are assumed
 * to be one of the four children of this tile. If non-child tile coordinates are
 * given, the availability of the southeast child tile is returned.
 *
 * @param {number} _thisX The tile X coordinate of this (the parent) tile.
 * @param {number} _thisY The tile Y coordinate of this (the parent) tile.
 * @param {number} _childX 用于检查可用性的子瓦片X坐标。
 * @param {number} _childY 用于检查可用性的子瓦片Y坐标。
 * @returns {boolean} True 如果子瓦片可用，则返回true；否则返回false。
 */
Cesium3DTilesUpsampleTerrainData.prototype.isChildAvailable = function (
  _thisX,
  _thisY,
  _childX,
  _childY,
) {
  // upsample tiles are dynamic so they don't have children
  return false;
};

Object.defineProperties(Cesium3DTilesUpsampleTerrainData.prototype, {
  /**
   * 该瓦片的版权信息数组。
   * @memberof Cesium3DTilesUpsampleTerrainData.prototype
   * @type {Credit[]|undefined}
   */
  credits: {
    get: function () {
      return this._credits;
    },
  },
  /**
   * 此地形数据中包含的水掩模，如果存在的话。水掩模是一个矩形
   * Uint8Array或图像，其中值为255表示水域，值为0表示陆地。
   * 0到255之间的其他值也被允许，以便平滑地过渡陆地和水域。
   * @memberof Cesium3DTilesUpsampleTerrainData.prototype
   * @type {Uint8Array|HTMLImageElement|HTMLCanvasElement|ImageBitmap|undefined}
   */
  waterMask: {
    get: function () {
      // Note: watermask not needed because there's a fallback in another file that checks for ancestor tile water mask
      return undefined;
    },
  },
});

const upsampleTaskProcessor = new TaskProcessor(
  "upsampleVerticesFromCesium3DTilesTerrain",
  TerrainData.maximumAsynchronousTasks,
);

/**
 * 对此地形数据进行上采样，供子瓦片使用。
 * @private
 * @param {boolean} synchronous
 * @param {TerrainMesh} thisMesh 正在被上采样的网格。
 * @param {number} thisSkirtHeight 网格的边缘高度。
 * @param {Credit[]|undefined} credits 版权信息。
 * @param {TilingScheme} tilingScheme 此地形数据的瓦片布局方案。
 * @param {number} thisX 该瓦片在瓦片布局方案中的X坐标。
 * @param {number} thisY 该瓦片在瓦片布局方案中的Y坐标。
 * @param {number} thisLevel 该瓦片在瓦片布局方案中的层级。
 * @param {number} descendantX 我们正在上采样子的瓦片的瓦片布局方案中的X坐标。
 * @param {number} descendantY 我们正在上采样子的瓦片的瓦片布局方案中的Y坐标。
 * @param {number} descendantLevel 我们正在上采样的子的瓦片的瓦片布局方案中的层级。
 * @returns {Promise.<TerrainData>|undefined} A 子瓦片上采样地形数据的承诺，如果同时有太多异步上采样操作正在进行且请求被延迟，则未定义。
 */
function upsampleMesh(
  synchronous,
  thisMesh,
  thisSkirtHeight,
  credits,
  tilingScheme,
  thisX,
  thisY,
  thisLevel,
  descendantX,
  descendantY,
  descendantLevel,
) {
  //>>includeStart('debug', pragmas.debug)
  Check.typeOf.bool("synchronous", synchronous);
  Check.typeOf.object("thisMesh", thisMesh);
  Check.typeOf.number("thisSkirtHeight", thisSkirtHeight);
  Check.typeOf.object("tilingScheme", tilingScheme);
  Check.typeOf.number("thisX", thisX);
  Check.typeOf.number("thisY", thisY);
  Check.typeOf.number("thisLevel", thisLevel);
  Check.typeOf.number("descendantX", descendantX);
  Check.typeOf.number("descendantY", descendantY);
  Check.typeOf.number("descendantLevel", descendantLevel);
  //>>includeEnd('debug');

  const levelDifference = descendantLevel - thisLevel;
  if (levelDifference > 1) {
    throw new DeveloperError(
      "Upsampling through more than one level at a time is not currently supported.",
    );
  }

  const upsampleSkirtHeight = thisSkirtHeight * 0.5;
  const isEastChild = thisX * 2 !== descendantX;
  const isNorthChild = thisY * 2 === descendantY;
  const upsampleRectangle = tilingScheme.tileXYToRectangle(
    descendantX,
    descendantY,
    descendantLevel,
    new Rectangle(),
  );
  const ellipsoid = tilingScheme.ellipsoid;

  const options = {
    isEastChild: isEastChild,
    isNorthChild: isNorthChild,
    rectangle: upsampleRectangle,
    ellipsoid: ellipsoid,
    skirtHeight: upsampleSkirtHeight,
    parentVertices: thisMesh.vertices,
    parentIndices: thisMesh.indices,
    parentVertexCountWithoutSkirts: thisMesh.vertexCountWithoutSkirts,
    parentIndexCountWithoutSkirts: thisMesh.indexCountWithoutSkirts,
    parentMinimumHeight: thisMesh.minimumHeight,
    parentMaximumHeight: thisMesh.maximumHeight,
    parentEncoding: thisMesh.encoding,
  };

  if (synchronous) {
    const upsampledMesh =
      Cesium3DTilesTerrainGeometryProcessor.upsampleMesh(options);

    const upsampledTerrainData = new Cesium3DTilesUpsampleTerrainData({
      terrainMesh: upsampledMesh,
      skirtHeight: upsampleSkirtHeight,
      credits: credits,
    });

    return Promise.resolve(upsampledTerrainData);
  }

  const upsamplePromise = upsampleTaskProcessor.scheduleTask(options);

  if (upsamplePromise === undefined) {
    // Postponed
    return undefined;
  }

  return upsamplePromise.then(function (taskResult) {
    // Need to re-clone and re-wrap all buffers and complex objects to put them back into their normal state
    const encoding = TerrainEncoding.clone(
      taskResult.encoding,
      new TerrainEncoding(),
    );
    const stride = encoding.stride;
    const vertices = new Float32Array(taskResult.verticesBuffer);
    const vertexCount = vertices.length / stride;
    const vertexCountWithoutSkirts = taskResult.vertexCountWithoutSkirts;
    // For consistency with glTF spec, 16 bit index buffer can't contain 65535
    const SizedIndexType = vertexCount <= 65535 ? Uint16Array : Uint32Array;
    const indices = new SizedIndexType(taskResult.indicesBuffer);
    const westIndices = new SizedIndexType(taskResult.westIndicesBuffer);
    const eastIndices = new SizedIndexType(taskResult.eastIndicesBuffer);
    const southIndices = new SizedIndexType(taskResult.southIndicesBuffer);
    const northIndices = new SizedIndexType(taskResult.northIndicesBuffer);
    const indexCountWithoutSkirts = taskResult.indexCountWithoutSkirts;
    const minimumHeight = taskResult.minimumHeight;
    const maximumHeight = taskResult.maximumHeight;
    const center = Cartesian3.clone(encoding.center, new Cartesian3());
    const boundingSphere = BoundingSphere.clone(
      taskResult.boundingSphere,
      new BoundingSphere(),
    );
    const horizonOcclusionPoint = Cartesian3.clone(
      taskResult.horizonOcclusionPoint,
      new Cartesian3(),
    );
    const orientedBoundingBox = OrientedBoundingBox.clone(
      taskResult.orientedBoundingBox,
      new OrientedBoundingBox(),
    );

    const upsampledMesh = new TerrainMesh(
      center,
      vertices,
      indices,
      indexCountWithoutSkirts,
      vertexCountWithoutSkirts,
      minimumHeight,
      maximumHeight,
      upsampleRectangle,
      boundingSphere,
      horizonOcclusionPoint,
      stride,
      orientedBoundingBox,
      encoding,
      westIndices,
      southIndices,
      eastIndices,
      northIndices,
    );

    const upsampledTerrainData = new Cesium3DTilesUpsampleTerrainData({
      terrainMesh: upsampledMesh,
      skirtHeight: upsampleSkirtHeight,
      credits: credits,
    });

    return Promise.resolve(upsampledTerrainData);
  });
}

const scratchUv0 = new Cartesian2();
const scratchUv1 = new Cartesian2();
const scratchUv2 = new Cartesian2();
const scratchBary = new Cartesian3();

/**
 * 在指定的经度和纬度处计算地形高度。如果位置在网格之外，则返回0.0。
 * @private
 * @param {TerrainMesh} mesh 地形网格。
 * @param {Rectangle} rectangle 此地形数据所覆盖的矩形区域。
 * @param {number} longitude 以弧度表示的经度。
 * @param {number} latitude 以弧度表示的纬度。
 * @returns {number} The 指定位置处的地形高度。如果位置在矩形区域之外，该方法将推算高度，但对于远离矩形区域的位置，这种推算结果可能非常不准确。
 */
function interpolateMeshHeight(mesh, rectangle, longitude, latitude) {
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

  const { vertices, encoding, indices } = mesh;

  for (let i = 0; i < mesh.indexCountWithoutSkirts; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const uv0 = encoding.decodeTextureCoordinates(vertices, i0, scratchUv0);
    const uv1 = encoding.decodeTextureCoordinates(vertices, i1, scratchUv1);
    const uv2 = encoding.decodeTextureCoordinates(vertices, i2, scratchUv2);

    const minU = Math.min(uv0.x, uv1.x, uv2.x);
    const maxU = Math.max(uv0.x, uv1.x, uv2.x);
    const minV = Math.min(uv0.y, uv1.y, uv2.y);
    const maxV = Math.max(uv0.y, uv1.y, uv2.y);

    if (u >= minU && u <= maxU && v >= minV && v <= maxV) {
      const barycentric = Intersections2D.computeBarycentricCoordinates(
        u,
        v,
        uv0.x,
        uv0.y,
        uv1.x,
        uv1.y,
        uv2.x,
        uv2.y,
        scratchBary,
      );
      if (
        barycentric.x >= 0.0 &&
        barycentric.y >= 0.0 &&
        barycentric.z >= 0.0
      ) {
        const h0 = encoding.decodeHeight(vertices, i0);
        const h1 = encoding.decodeHeight(vertices, i1);
        const h2 = encoding.decodeHeight(vertices, i2);
        const height =
          barycentric.x * h0 + barycentric.y * h1 + barycentric.z * h2;
        return height;
      }
    }
  }

  // Position does not lie in any triangle in this mesh.
  // This should not happen often since we start by clamping to the rectangle.
  return 0.0;
}

export default Cesium3DTilesTerrainData;
