import { Check, Ellipsoid, Event, Frozen, defined } from "@cesium/core";
import Credit from "./Credit.js";
import GeographicTilingScheme from "./GeographicTilingScheme.js";
import HeightmapTerrainData from "./HeightmapTerrainData.js";
import TerrainProvider from "./TerrainProvider.js";

/**
 * @callback CustomHeightmapTerrainProvider.GeometryCallback
 * @param {number} x 请求几何数据的瓦片X坐标。
 * @param {number} y 请求几何数据的瓦片Y坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|Float64Array|number[]|Promise<Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|Float64Array|number[]>|undefined} An 以行主序方式排列的高度数组或数组承诺。如果未定义，地球仪将渲染父瓦片。
 */

/**
 * 一个简单的 {@link TerrainProvider} 类，通过回调函数获取高度值。
 * 可用于程序化生成的地形，也可作为加载自定义
 * 高度图数据的方式，无需创建 {@link TerrainProvider} 的子类。
 *
 * 存在一些限制，例如没有水掩模、没有顶点法线，也没有
 * 可用性，因此完整的 {@link TerrainProvider} 子类更适合这些更复杂的用例。
 * 具有以下属性的对象：
 *
 * @alias CustomHeightmapTerrainProvider
 * @constructor
 *
 * @param {object} options 请求瓦片几何数据的回调函数。
 * @param {CustomHeightmapTerrainProvider.GeometryCallback} options.callback 每个高度图瓦片中的列数。
 * @param {number} options.width 每个高度图瓦片中的行数。
 * @param {number} options.height 指定椭球表面如何被划分为瓦片的镶嵌方案。如果未提供此参数，则使用 {@link GeographicTilingScheme}。
 * @param {TilingScheme} [options.tilingScheme] 椭球体。如果指定了镶嵌方案，
 * surface is broken into tiles. If this parameter is not provided, a {@link GeographicTilingScheme}
 * 则使用默认椭球体。
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 在画布上显示的数据来源标签。
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrainProvider: new Cesium.CustomHeightmapTerrainProvider({
 * @param {Credit|string} [options.credit] width: 32,
 *
 * @example
 * height: 32,
 * callback: function (x, y, level) {
 * return new Float32Array(32 * 32); // 全部为零
 * 当地形提供器遇到异步错误时触发事件。通过订阅此事件，
 * 您将收到错误通知并可能从中恢复。事件监听器
 * 接收 {@link TileProviderError} 的实例。
 *     },
 *   }),
 * });
 *
 * @see TerrainProvider
 */
function CustomHeightmapTerrainProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.callback", options.callback);
  Check.defined("options.width", options.width);
  Check.defined("options.height", options.height);
  //>>includeEnd('debug');

  this._callback = options.callback;

  this._tilingScheme = options.tilingScheme;
  if (!defined(this._tilingScheme)) {
    this._tilingScheme = new GeographicTilingScheme({
      ellipsoid: options.ellipsoid ?? Ellipsoid.default,
    });
  }

  this._width = options.width;
  this._height = options.height;
  const maxTileDimensions = Math.max(this._width, this._height);

  this._levelZeroMaximumGeometricError =
    TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
      this._tilingScheme.ellipsoid,
      maxTileDimensions,
      this._tilingScheme.getNumberOfXTilesAtLevel(0),
    );

  this._errorEvent = new Event();

  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;
}

Object.defineProperties(CustomHeightmapTerrainProvider.prototype, {
  /**
   * 在地形提供器激活时显示的标签。通常用于标注
   * 地形的来源。
   * are passed an instance of {@link TileProviderError}.
   * @memberof CustomHeightmapTerrainProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 指示提供器是否包含水掩模的值。水掩模
   * 表示地球上的哪些区域是水而不是陆地，因此可以被渲染为具有动画波浪的反射表面。
   * @memberof CustomHeightmapTerrainProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * {@link CustomHeightmapTerrainProvider} 不支持水掩模，因此返回值为
   * @memberof CustomHeightmapTerrainProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * Gets a value indicating whether or not the provider includes a water mask. The water mask
   * indicates which areas of the globe are water rather than land, so they can be rendered
   * as a reflective surface with animated waves.
   * Water mask is not supported by {@link CustomHeightmapTerrainProvider}, so the return
   * 该值始终为 false。
   * @memberof CustomHeightmapTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasWaterMask: {
    get: function () {
      return false;
    },
  },

  /**
   * 获取一个值，指示请求的瓦片是否包含顶点法线。
   * {@link CustomHeightmapTerrainProvider} 不支持顶点法线，因此返回值为
   * 该值始终为 false。
   * @memberof CustomHeightmapTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasVertexNormals: {
    get: function () {
      return false;
    },
  },

  /**
   * 获取一个对象，可用于确定此提供器中的地形可用性，例如
   * 在点和矩形上。如果地形可用性信息不可用，则此属性可能未定义。
   * 该提供器无法提供地形可用性信息。
   * @memberof CustomHeightmapTerrainProvider.prototype
   * @type {TileAvailability}
   * @readonly
   */
  availability: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取每个高度图瓦片中的列数。
   * @memberof CustomHeightmapTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  width: {
    get: function () {
      return this._width;
    },
  },

  /**
   * 获取每个高度图瓦片中的行数。
   * @memberof CustomHeightmapTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  height: {
    get: function () {
      return this._height;
    },
  },
});

/**
 * 请求特定瓦片的几何数据。结果包含地形数据，并表明所有子瓦片均可使用。
 * 该提供器已准备好加载瓦片的数据。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片的层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 *
 * @returns {Promise<TerrainData>|undefined} A 请求几何数据的承诺。如果此方法返回 undefined 而不是承诺，说明已有太多请求正在等待中，请求将在之后重试。
 * 获取给定层级下瓦片允许的最大几何误差。
 * 获取最大几何误差的瓦片层级。
 */
CustomHeightmapTerrainProvider.prototype.requestTileGeometry = function (
  x,
  y,
  level,
  request,
) {
  const promise = this._callback(x, y, level);
  if (!defined(promise)) {
    return undefined;
  }

  const width = this._width;
  const height = this._height;

  return Promise.resolve(promise).then(function (heightmapData) {
    let buffer = heightmapData;
    if (Array.isArray(buffer)) {
      // HeightmapTerrainData expects a TypedArray, so convert from number[] to Float64Array
      buffer = new Float64Array(buffer);
    }

    return new HeightmapTerrainData({
      buffer: buffer,
      width: width,
      height: height,
    });
  });
};

/**
 * 最大几何误差。
 *
 * @param {number} level 确定瓦片的数据是否可加载。
 * @returns {number} The 获取最大几何误差的瓦片层级。
 */
CustomHeightmapTerrainProvider.prototype.getLevelMaximumGeometricError =
  function (level) {
    return this._levelZeroMaximumGeometricError / (1 << level);
  };

/**
 * 确定瓦片的数据是否可加载。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {boolean|undefined} Undefined 如果不支持，则为 true 或 false。
 */
CustomHeightmapTerrainProvider.prototype.getTileDataAvailable = function (
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
 * @returns {undefined|Promise<void>} Undefined 如果无需加载数据，或者所有所需瓦片已加载时 Promise 被解析。
 */
CustomHeightmapTerrainProvider.prototype.loadTileDataAvailability = function (
  x,
  y,
  level,
) {
  return undefined;
};
export default CustomHeightmapTerrainProvider;