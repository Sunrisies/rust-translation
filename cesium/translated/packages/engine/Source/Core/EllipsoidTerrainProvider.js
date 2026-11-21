import { Ellipsoid, Event, Frozen, defined } from "@cesium/core";
import GeographicTilingScheme from "./GeographicTilingScheme.js";
import HeightmapTerrainData from "./HeightmapTerrainData.js";
import TerrainProvider from "./TerrainProvider.js";

/**
 * 一个非常简单的 {@link TerrainProvider} 控件，通过将椭球表面分割为小块来生成几何数据。
 * 对象具有以下属性：
 *
 * @alias EllipsoidTerrainProvider
 * @constructor
 *
 * @param {object} [options] Object with the following properties:
 * @param {TilingScheme} [options.tilingScheme] 分块方案，指定如何将椭球表面分割为小块。如果未提供此参数，则使用 {@link GeographicTilingScheme} 分块方案。
 * 椭球。如果指定了分块方案，则忽略此参数，使用分块方案的椭球数据。如果两者均未指定，则使用默认椭球数据。
 * 当地形提供器遇到异步错误时引发的事件。通过订阅该事件，您可以收到错误通知并可能进行恢复。事件监听器接收 {@link TileProviderError} 的实例。
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 此地形提供器处于活动状态时显示的信用信息。通常用于显示地形的来源。
 * 此提供器使用的分块方案。
 * 指示提供器是否包含水掩模的值。水掩模表示地球上的哪些区域是水而不是陆地，因此可以被渲染为具有动画波浪的反射表面。
 *
 * @see TerrainProvider
 */
function EllipsoidTerrainProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._tilingScheme = options.tilingScheme;
  if (!defined(this._tilingScheme)) {
    this._tilingScheme = new GeographicTilingScheme({
      ellipsoid: options.ellipsoid ?? Ellipsoid.default,
    });
  }

  // Note: the 64 below does NOT need to match the actual vertex dimensions, because
  // the ellipsoid is significantly smoother than actual terrain.
  this._levelZeroMaximumGeometricError =
    TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
      this._tilingScheme.ellipsoid,
      64,
      this._tilingScheme.getNumberOfXTilesAtLevel(0),
    );

  this._errorEvent = new Event();
}

Object.defineProperties(EllipsoidTerrainProvider.prototype, {
  /**
   * 指示请求的块是否包含顶点法线的值。
   * 可用于确定该提供器提供的地形可用性的对象，例如在点和矩形上。如果可用性信息不可得，此属性可能未定义。
   * 请求特定块的几何数据。结果包括地形数据，并表明所有子块均可用。
   * @memberof EllipsoidTerrainProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 请求几何数据的块的 X 坐标。
   * 请求几何数据的块的 Y 坐标。
   * @memberof EllipsoidTerrainProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 请求几何数据的块的层级。
   * @memberof EllipsoidTerrainProvider.prototype
   * @type {GeographicTilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 指示提供器是否包含水掩模的值。水掩模表示地球上的哪些区域是水而不是陆地，因此可以被渲染为具有动画波浪的反射表面。
   * 指示请求的块是否包含顶点法线的值。
   * 可用于确定该提供器提供的地形可用性的对象，例如在点和矩形上。如果可用性信息不可得，此属性可能未定义。
   * @memberof EllipsoidTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasWaterMask: {
    get: function () {
      return false;
    },
  },

  /**
   * 指示请求的块是否包含顶点法线的布尔值。
   * @memberof EllipsoidTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasVertexNormals: {
    get: function () {
      return false;
    },
  },
  /**
   * 可用于确定该提供器提供的地形可用性的对象，例如在点和矩形上。此属性可能未定义，因为可用性信息不可得。
   * 请求特定块的几何数据。结果包括地形数据，并表明所有子块均可用。
   * 用于获取给定层级中块允许的最大几何误差。
   * @memberof EllipsoidTerrainProvider.prototype
   * @type {TileAvailability|undefined}
   * @readonly
   */
  availability: {
    get: function () {
      return undefined;
    },
  },
});

/**
 * 用于获取最大几何误差的块层级。
 * 最大几何误差。
 *
 * @param {number} x 确定块的哪些数据可以加载。
 * @param {number} y 用于请求几何数据的块的 X 坐标。
 * @param {number} level 用于请求几何数据的块的 Y 坐标。
 * @param {Request} [request] 用于请求几何数据的块的层级。
 *
 * @returns {Promise<TerrainData>|undefined} A 请求几何数据的对象。仅用于内部使用。
 * 对请求几何数据的承诺。如果此方法返回 undefined 而不是承诺，说明当前有太多请求正在等待，该请求将在以后重试。
 * 获取给定层级中块允许的最大几何误差。
 */
EllipsoidTerrainProvider.prototype.requestTileGeometry = function (
  x,
  y,
  level,
  request,
) {
  const width = 16;
  const height = 16;
  return Promise.resolve(
    new HeightmapTerrainData({
      buffer: new Uint8Array(width * height),
      width: width,
      height: height,
    }),
  );
};

/**
 * 获取特定层级中块允许的最大几何误差。
 *
 * @param {number} level 用于获取最大几何误差的块层级。
 * @returns {number} The 最大几何误差。
 */
EllipsoidTerrainProvider.prototype.getLevelMaximumGeometricError = function (
  level,
) {
  return this._levelZeroMaximumGeometricError / (1 << level);
};

/**
 * 确定块的哪些数据可以加载。
 *
 * @param {number} x The X coordinate of the tile for which to request geometry.
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {boolean|undefined} Undefined 如果不支持，则为 true 或 false。
 */
EllipsoidTerrainProvider.prototype.getTileDataAvailable = function (
  x,
  y,
  level,
) {
  return undefined;
};

/**
 * 确保加载瓦片的可用性数据。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {undefined} This 提供器不支持加载可用性数据。
 */
EllipsoidTerrainProvider.prototype.loadTileDataAvailability = function (
  x,
  y,
  level,
) {
  return undefined;
};
export default EllipsoidTerrainProvider;
