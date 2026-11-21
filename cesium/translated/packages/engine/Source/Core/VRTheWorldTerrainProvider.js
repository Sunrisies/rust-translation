import {
  Check,
  Ellipsoid,
  Event,
  Frozen,
  Math as CesiumMath,
  Rectangle,
  RuntimeError,
  defined,
} from "@cesium/core";
import Credit from "./Credit.js";
import GeographicTilingScheme from "./GeographicTilingScheme.js";
import getImagePixels from "./getImagePixels.js";
import HeightmapTerrainData from "./HeightmapTerrainData.js";
import Resource from "./Resource.js";
import TerrainProvider from "./TerrainProvider.js";
import TileProviderError from "./TileProviderError.js";

function DataRectangle(rectangle, maxLevel) {
  this.rectangle = rectangle;
  this.maxLevel = maxLevel;
}

/**
 * @typedef {object} VRTheWorldTerrainProvider.ConstructorOptions
 *
 * VRTheWorldTerrainProvider 构造函数的初始化选项
 *
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体。如果未指定，则使用默认椭球体。
 * @property {Credit|string} [credit] 数据来源的署名，显示在画布上。
 */

/**
 * 用于在获取初始元数据时跟踪创建细节
 *
 * @constructor
 * @private
 *
 * @param {VRTheWorldTerrainProvider.ConstructorOptions} options 描述初始化选项的对象
 */
function TerrainProviderBuilder(options) {
  this.ellipsoid = options.ellipsoid ?? Ellipsoid.default;
  this.tilingScheme = undefined;
  this.heightmapWidth = undefined;
  this.heightmapHeight = undefined;
  this.levelZeroMaximumGeometricError = undefined;
  this.rectangles = [];
}

TerrainProviderBuilder.prototype.build = function (provider) {
  provider._tilingScheme = this.tilingScheme;
  provider._heightmapWidth = this.heightmapWidth;
  provider._heightmapHeight = this.heightmapHeight;
  provider._levelZeroMaximumGeometricError =
    this.levelZeroMaximumGeometricError;
  provider._rectangles = this.rectangles;
};

function metadataSuccess(terrainProviderBuilder, xml) {
  const srs = xml.getElementsByTagName("SRS")[0].textContent;
  if (srs === "EPSG:4326") {
    terrainProviderBuilder.tilingScheme = new GeographicTilingScheme({
      ellipsoid: terrainProviderBuilder.ellipsoid,
    });
  } else {
    throw new RuntimeError(`SRS ${srs} is not supported`);
  }

  const tileFormat = xml.getElementsByTagName("TileFormat")[0];
  terrainProviderBuilder.heightmapWidth = parseInt(
    tileFormat.getAttribute("width"),
    10,
  );
  terrainProviderBuilder.heightmapHeight = parseInt(
    tileFormat.getAttribute("height"),
    10,
  );
  terrainProviderBuilder.levelZeroMaximumGeometricError =
    TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
      terrainProviderBuilder.ellipsoid,
      Math.min(
        terrainProviderBuilder.heightmapWidth,
        terrainProviderBuilder.heightmapHeight,
      ),
      terrainProviderBuilder.tilingScheme.getNumberOfXTilesAtLevel(0),
    );

  const dataRectangles = xml.getElementsByTagName("DataExtent");

  for (let i = 0; i < dataRectangles.length; ++i) {
    const dataRectangle = dataRectangles[i];

    const west = CesiumMath.toRadians(
      parseFloat(dataRectangle.getAttribute("minx")),
    );
    const south = CesiumMath.toRadians(
      parseFloat(dataRectangle.getAttribute("miny")),
    );
    const east = CesiumMath.toRadians(
      parseFloat(dataRectangle.getAttribute("maxx")),
    );
    const north = CesiumMath.toRadians(
      parseFloat(dataRectangle.getAttribute("maxy")),
    );
    const maxLevel = parseInt(dataRectangle.getAttribute("maxlevel"), 10);

    terrainProviderBuilder.rectangles.push(
      new DataRectangle(new Rectangle(west, south, east, north), maxLevel),
    );
  }
}

function metadataFailure(resource, error, provider) {
  let message = `An error occurred while accessing ${resource.url}`;

  if (defined(error) && defined(error.message)) {
    message = `${message}: ${error.message}`;
  }

  TileProviderError.reportError(
    undefined,
    provider,
    defined(provider) ? provider._errorEvent : undefined,
    message,
  );

  throw new RuntimeError(message);
}

async function requestMetadata(terrainProviderBuilder, resource, provider) {
  try {
    const xml = await resource.fetchXML();
    metadataSuccess(terrainProviderBuilder, xml);
  } catch (error) {
    metadataFailure(resource, error, provider);
  }
}

/**
 * <div class="notice">
 * 要创建 VRTheWorldTerrainProvider，请调用 {@link VRTheWorldTerrainProvider.fromUrl}。不要直接调用构造函数。
 * </div>
 *
 * 一个通过分割高度图生成地形几何的 {@link TerrainProvider}
 * retrieved from a {@link http://vr-theworld.com/|VT MÄK VR-TheWorld server}.
 *
 * @alias VRTheWorldTerrainProvider
 * @constructor
 *
 * @param {VRTheWorldTerrainProvider.ConstructorOptions} [options] 描述初始化选项的对象。
 *
 * @example
 * const terrainProvider = await Cesium.VRTheWorldTerrainProvider.fromUrl(
 * "https://www.vr-theworld.com/vr-theworld/tiles1.0.0/73/"
 * );
 * viewer.terrainProvider = terrainProvider;
 *
 * @see TerrainProvider
 */
function VRTheWorldTerrainProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._errorEvent = new Event();

  this._terrainDataStructure = {
    heightScale: 1.0 / 1000.0,
    heightOffset: -1000.0,
    elementsPerHeight: 3,
    stride: 4,
    elementMultiplier: 256.0,
    isBigEndian: true,
    lowestEncodedHeight: 0,
    highestEncodedHeight: 256 * 256 * 256 - 1,
  };

  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;

  this._tilingScheme = undefined;
  this._rectangles = [];
}

Object.defineProperties(VRTheWorldTerrainProvider.prototype, {
  /**
   * 当地形提供器遇到异步错误时触发事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * are passed an instance of {@link TileProviderError}.
   * @memberof VRTheWorldTerrainProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 获取此地形提供器激活时显示的署名。通常用于标注地形的来源。
   * 获取该提供器使用的镶嵌方案。
   * @memberof VRTheWorldTerrainProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 获取该提供器使用的镶嵌方案。
   * @memberof VRTheWorldTerrainProvider.prototype
   * @type {GeographicTilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取指示提供器是否包含水掩膜的值。水掩膜
   * 表示地球上的哪些区域是水而不是陆地，因此可以被渲染为具有动画波浪的反射表面。
   * 获取指示请求的瓦片是否包含顶点法线的值。
   * @memberof VRTheWorldTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasWaterMask: {
    get: function () {
      return false;
    },
  },

  /**
   * 获取可用于确定该提供器地形可用性的对象，例如
   * @memberof VRTheWorldTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasVertexNormals: {
    get: function () {
      return false;
    },
  },
  /**
   * 在点和矩形上。如果可用性信息不可得，此属性可能未定义。
   * 创建通过分割高度图生成地形几何的 {@link TerrainProvider}
   * 从 {@link http://vr-theworld.com/|VT MÄK VR-TheWorld 服务器} 获取
   * @memberof VRTheWorldTerrainProvider.prototype
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
 * Creates a {@link TerrainProvider} that produces terrain geometry by tessellating height maps
 * retrieved from a {@link http://vr-theworld.com/|VT MÄK VR-TheWorld server}.
 *
 * @param {Resource|string} url const terrainProvider = await Cesium.VRTheWorldTerrainProvider.fromUrl(
 * @param {VRTheWorldTerrainProvider.ConstructorOptions} [options] "https://www.vr-theworld.com/vr-theworld/tiles1.0.0/73/"
 * @returns {Promise<VRTheWorldTerrainProvider>}
 *
 * @example
 * viewer.terrainProvider = terrainProvider;
 * 指定未知的 SRS
 * );
 * 请求给定瓦片的几何数据。结果包含地形信息
 *
 * @exception {RuntimeError} metadata specifies and unknown SRS
 */
VRTheWorldTerrainProvider.fromUrl = async function (url, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;

  const terrainProviderBuilder = new TerrainProviderBuilder(options);
  const resource = Resource.createIfNeeded(url);

  await requestMetadata(terrainProviderBuilder, resource);

  const provider = new VRTheWorldTerrainProvider(options);
  terrainProviderBuilder.build(provider);
  provider._resource = resource;

  return provider;
};

/**
 * Requests the geometry for a given tile. The result includes terrain
 * 表示所有子瓦片均可用。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<TerrainData>|undefined} A 请求的几何数据的承诺。如果此方法
 * 返回 undefined 而不是承诺，说明当前有太多请求正在等待中，
 * 请求将稍后重试。
 */
VRTheWorldTerrainProvider.prototype.requestTileGeometry = function (
  x,
  y,
  level,
  request,
) {
  const yTiles = this._tilingScheme.getNumberOfYTilesAtLevel(level);
  const resource = this._resource.getDerivedResource({
    url: `${level}/${x}/${yTiles - y - 1}.tif`,
    queryParameters: {
      cesium: true,
    },
    request: request,
  });
  const promise = resource.fetchImage({
    preferImageBitmap: true,
  });
  if (!defined(promise)) {
    return undefined;
  }

  const that = this;
  return Promise.resolve(promise).then(function (image) {
    return new HeightmapTerrainData({
      buffer: getImagePixels(image),
      width: that._heightmapWidth,
      height: that._heightmapHeight,
      childTileMask: getChildMask(that, x, y, level),
      structure: that._terrainDataStructure,
    });
  });
};

/**
 * 获取给定层级瓦片允许的最大几何误差。
 *
 * @param {number} level 获取最大几何误差的瓦片层级。
 * @returns {number} The 最大几何误差。
 */
VRTheWorldTerrainProvider.prototype.getLevelMaximumGeometricError = function (
  level,
) {
  return this._levelZeroMaximumGeometricError / (1 << level);
};

const rectangleScratch = new Rectangle();

function getChildMask(provider, x, y, level) {
  const tilingScheme = provider._tilingScheme;
  const rectangles = provider._rectangles;
  const parentRectangle = tilingScheme.tileXYToRectangle(x, y, level);

  let childMask = 0;

  for (let i = 0; i < rectangles.length && childMask !== 15; ++i) {
    const rectangle = rectangles[i];
    if (rectangle.maxLevel <= level) {
      continue;
    }

    const testRectangle = rectangle.rectangle;

    const intersection = Rectangle.intersection(
      testRectangle,
      parentRectangle,
      rectangleScratch,
    );
    if (defined(intersection)) {
      // Parent tile is inside this rectangle, so at least one child is, too.
      if (
        isTileInRectangle(tilingScheme, testRectangle, x * 2, y * 2, level + 1)
      ) {
        childMask |= 4; // northwest
      }
      if (
        isTileInRectangle(
          tilingScheme,
          testRectangle,
          x * 2 + 1,
          y * 2,
          level + 1,
        )
      ) {
        childMask |= 8; // northeast
      }
      if (
        isTileInRectangle(
          tilingScheme,
          testRectangle,
          x * 2,
          y * 2 + 1,
          level + 1,
        )
      ) {
        childMask |= 1; // southwest
      }
      if (
        isTileInRectangle(
          tilingScheme,
          testRectangle,
          x * 2 + 1,
          y * 2 + 1,
          level + 1,
        )
      ) {
        childMask |= 2; // southeast
      }
    }
  }

  return childMask;
}

function isTileInRectangle(tilingScheme, rectangle, x, y, level) {
  const tileRectangle = tilingScheme.tileXYToRectangle(x, y, level);
  return defined(
    Rectangle.intersection(tileRectangle, rectangle, rectangleScratch),
  );
}

/**
 * 确定瓦片的数据是否可加载。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {boolean|undefined} Undefined 如果不支持，则为 true 或 false。
 */
VRTheWorldTerrainProvider.prototype.getTileDataAvailable = function (
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
 * @returns {undefined|Promise<void>} Undefined 如果无需加载，或者当所有所需的瓦片加载完成后会解析为 Promise。
 */
VRTheWorldTerrainProvider.prototype.loadTileDataAvailability = function (
  x,
  y,
  level,
) {
  return undefined;
};
export default VRTheWorldTerrainProvider;