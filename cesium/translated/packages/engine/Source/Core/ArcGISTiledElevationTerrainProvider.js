import {
  Cartesian2,
  Check,
  Ellipsoid,
  Event,
  Frozen,
  Rectangle,
  RuntimeError,
  defined,
} from "@cesium/core";
import Credit from "./Credit.js";
import GeographicTilingScheme from "./GeographicTilingScheme.js";
import HeightmapEncoding from "./HeightmapEncoding.js";
import HeightmapTerrainData from "./HeightmapTerrainData.js";
import Request from "./Request.js";
import RequestState from "./RequestState.js";
import RequestType from "./RequestType.js";
import Resource from "./Resource.js";
import TerrainProvider from "./TerrainProvider.js";
import TileAvailability from "./TileAvailability.js";
import TileProviderError from "./TileProviderError.js";
import WebMercatorTilingScheme from "./WebMercatorTilingScheme.js";

const ALL_CHILDREN = 15;

/**
 * @typedef {object} ArcGISTiledElevationTerrainProvider.ConstructorOptions
 *
 * ArcGISTiledElevationTerrainProvider 构造函数的初始化选项
 *
 * @property {string} [token] 用于连接服务的授权令牌。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体。如果指定了 tilingScheme，
 * 该参数将被忽略，将使用 tiling scheme 的椭球体。
 * 如果未指定任何参数，则使用默认椭球体。
 */

/**
 * 用于在获取初始元数据时跟踪创建细节
 *
 * @constructor
 * @private
 *
 * @param {ArcGISTiledElevationTerrainProvider.ConstructorOptions} [options] 描述初始化选项的对象。
 */
function TerrainProviderBuilder(options) {
  this.ellipsoid = options.ellipsoid ?? Ellipsoid.default;

  this.credit = undefined;
  this.tilingScheme = undefined;
  this.height = undefined;
  this.width = undefined;
  this.encoding = undefined;
  this.lodCount = undefined;
  this.hasAvailability = false;
  this.tilesAvailable = undefined;
  this.tilesAvailabilityLoaded = undefined;
  this.levelZeroMaximumGeometricError = undefined;
  this.terrainDataStructure = undefined;
}

/**
 * 根据 builder 值完成 ArcGISTiledElevationTerrainProvider 的创建。
 *
 * @private
 *
 * @param {ArcGISTiledElevationTerrainProvider} provider
 */
TerrainProviderBuilder.prototype.build = function (provider) {
  provider._credit = this.credit;
  provider._tilingScheme = this.tilingScheme;
  provider._height = this.height;
  provider._width = this.width;
  provider._encoding = this.encoding;
  provider._lodCount = this.lodCount;
  provider._hasAvailability = this.hasAvailability;
  provider._tilesAvailable = this.tilesAvailable;
  provider._tilesAvailabilityLoaded = this.tilesAvailabilityLoaded;
  provider._levelZeroMaximumGeometricError =
    this.levelZeroMaximumGeometricError;
  provider._terrainDataStructure = this.terrainDataStructure;
};

function parseMetadataSuccess(terrainProviderBuilder, metadata) {
  const copyrightText = metadata.copyrightText;
  if (defined(copyrightText)) {
    terrainProviderBuilder.credit = new Credit(copyrightText);
  }

  const spatialReference = metadata.spatialReference;
  const wkid = spatialReference.latestWkid ?? spatialReference.wkid;
  const extent = metadata.extent;
  const tilingSchemeOptions = {
    ellipsoid: terrainProviderBuilder.ellipsoid,
  };
  if (wkid === 4326) {
    tilingSchemeOptions.rectangle = Rectangle.fromDegrees(
      extent.xmin,
      extent.ymin,
      extent.xmax,
      extent.ymax,
    );
    terrainProviderBuilder.tilingScheme = new GeographicTilingScheme(
      tilingSchemeOptions,
    );
  } else if (wkid === 3857) {
    // Clamp extent to EPSG 3857 bounds
    const epsg3857Bounds =
      Math.PI * terrainProviderBuilder.ellipsoid.maximumRadius;
    if (metadata.extent.xmax > epsg3857Bounds) {
      metadata.extent.xmax = epsg3857Bounds;
    }
    if (metadata.extent.ymax > epsg3857Bounds) {
      metadata.extent.ymax = epsg3857Bounds;
    }
    if (metadata.extent.xmin < -epsg3857Bounds) {
      metadata.extent.xmin = -epsg3857Bounds;
    }
    if (metadata.extent.ymin < -epsg3857Bounds) {
      metadata.extent.ymin = -epsg3857Bounds;
    }

    tilingSchemeOptions.rectangleSouthwestInMeters = new Cartesian2(
      extent.xmin,
      extent.ymin,
    );
    tilingSchemeOptions.rectangleNortheastInMeters = new Cartesian2(
      extent.xmax,
      extent.ymax,
    );
    terrainProviderBuilder.tilingScheme = new WebMercatorTilingScheme(
      tilingSchemeOptions,
    );
  } else {
    throw new RuntimeError("Invalid spatial reference");
  }

  const tileInfo = metadata.tileInfo;
  if (!defined(tileInfo)) {
    throw new RuntimeError("tileInfo is required");
  }

  terrainProviderBuilder.width = tileInfo.rows + 1;
  terrainProviderBuilder.height = tileInfo.cols + 1;
  terrainProviderBuilder.encoding =
    tileInfo.format === "LERC"
      ? HeightmapEncoding.LERC
      : HeightmapEncoding.NONE;
  terrainProviderBuilder.lodCount = tileInfo.lods.length - 1;

  const hasAvailability = (terrainProviderBuilder.hasAvailability =
    metadata.capabilities.indexOf("Tilemap") !== -1);
  if (hasAvailability) {
    terrainProviderBuilder.tilesAvailable = new TileAvailability(
      terrainProviderBuilder.tilingScheme,
      terrainProviderBuilder.lodCount,
    );
    terrainProviderBuilder.tilesAvailable.addAvailableTileRange(
      0,
      0,
      0,
      terrainProviderBuilder.tilingScheme.getNumberOfXTilesAtLevel(0),
      terrainProviderBuilder.tilingScheme.getNumberOfYTilesAtLevel(0),
    );
    terrainProviderBuilder.tilesAvailabilityLoaded = new TileAvailability(
      terrainProviderBuilder.tilingScheme,
      terrainProviderBuilder.lodCount,
    );
  }

  terrainProviderBuilder.levelZeroMaximumGeometricError =
    TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
      terrainProviderBuilder.tilingScheme.ellipsoid,
      terrainProviderBuilder.width,
      terrainProviderBuilder.tilingScheme.getNumberOfXTilesAtLevel(0),
    );

  if (metadata.bandCount > 1) {
    console.log(
      "ArcGISTiledElevationTerrainProvider: Terrain data has more than 1 band. Using the first one.",
    );
  }

  if (defined(metadata.minValues) && defined(metadata.maxValues)) {
    terrainProviderBuilder.terrainDataStructure = {
      elementMultiplier: 1.0,
      lowestEncodedHeight: metadata.minValues[0],
      highestEncodedHeight: metadata.maxValues[0],
    };
  } else {
    terrainProviderBuilder.terrainDataStructure = {
      elementMultiplier: 1.0,
    };
  }
}

async function requestMetadata(
  terrainProviderBuilder,
  metadataResource,
  provider,
) {
  try {
    const metadata = await metadataResource.fetchJson();
    parseMetadataSuccess(terrainProviderBuilder, metadata);
  } catch (error) {
    const message = `An error occurred while accessing ${metadataResource}.`;
    TileProviderError.reportError(
      undefined,
      provider,
      defined(provider) ? provider._errorEvent : undefined,
      message,
    );

    throw error;
  }
}

/**
 * <div class="notice">
 * 要构建 CesiumTerrainProvider，请调用 {@link ArcGISTiledElevationTerrainProvider.fromUrl}。不要直接调用构造函数。
 * </div>
 *
 * 一个通过分割高度图生成地形几何的 {@link TerrainProvider}
 * 从 ArcGIS ImageService 的 Elevation Tiles 中获取。
 *
 * @alias ArcGISTiledElevationTerrainProvider
 * @constructor
 *
 * @example
 * const terrainProvider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl("https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer", {
 * token: "KED1aF_I4UzXOHy3BnhwyBHU4l5oY6rO6walkmHoYqGp4XyIWUd5YZUC1ZrLAzvV40pR6gBXQayh0eFA8m6vPg.."
 * });
 * viewer.terrainProvider = terrainProvider;
 *
 * @see TerrainProvider
 */
function ArcGISTiledElevationTerrainProvider() {
  this._resource = undefined;
  this._credit = undefined;
  this._tilingScheme = undefined;
  this._levelZeroMaximumGeometricError = undefined;
  this._maxLevel = undefined;
  this._terrainDataStructure = undefined;
  this._width = undefined;
  this._height = undefined;
  this._encoding = undefined;
  this._lodCount = undefined;

  this._hasAvailability = false;
  this._tilesAvailable = undefined;
  this._tilesAvailabilityLoaded = undefined;
  this._availableCache = {};

  this._errorEvent = new Event();
}

Object.defineProperties(ArcGISTiledElevationTerrainProvider.prototype, {
  /**
   * 在地形提供器遇到异步错误时触发事件。通过订阅该事件，
   * 您将收到错误通知，并有可能从中恢复。事件监听器
   * 接收到一个 {@link TileProviderError} 实例。
   * @memberof ArcGISTiledElevationTerrainProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 获取此地形提供器处于活动状态时显示的信用信息。通常用于显示
   * 地形的来源。
   * @memberof ArcGISTiledElevationTerrainProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 获取此提供器使用的 tiling scheme。
   * @memberof ArcGISTiledElevationTerrainProvider.prototype
   * @type {GeographicTilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取一个值，指示提供器是否包含水掩膜。水掩膜
   * 表示地球上的哪些区域是水而不是陆地，因此可以被渲染为具有动画波浪的反射表面。
   * 获取一个值，指示请求的瓦片是否包含顶点法线。
   * @memberof ArcGISTiledElevationTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasWaterMask: {
    get: function () {
      return false;
    },
  },

  /**
   * 获取一个对象，可用于确定此提供器的地形可用性，例如
   * @memberof ArcGISTiledElevationTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasVertexNormals: {
    get: function () {
      return false;
    },
  },
  /**
   * 在点和矩形上。如果可用性信息不可得，
   * 此属性可能未定义。
   * 创建一个通过分割高度图生成地形几何的 {@link TerrainProvider}
   * @memberof ArcGISTiledElevationTerrainProvider.prototype
   * @type {TileAvailability|undefined}
   * @readonly
   */
  availability: {
    get: function () {
      return this._tilesAvailable;
    },
  },
});

/**
 * Creates a {@link TerrainProvider} that produces terrain geometry by tessellating height maps
 * 从 ArcGIS ImageService 的 Elevation Tiles 中获取。
 *
 * @param {Resource|string|Promise<Resource>|Promise<string>} url ArcGIS ImageServer 服务的 URL。
 * @param {ArcGISTiledElevationTerrainProvider.ConstructorOptions} [options] 描述初始化选项的 url 或对象。
 * @returns {Promise<ArcGISTiledElevationTerrainProvider>}
 *
 * @example
 * const terrainProvider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl("https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer", {
 * token: "KED1aF_I4UzXOHy3BnhwyBHU4l5oY6rO6walkmHoYqGp4XyIWUd5YZUC1ZrLAzvV40pR6gBXQayh0eFA8m6vPg.."
 * });
 * viewer.terrainProvider = terrainProvider;
 *
 * @exception {RuntimeError} metadata 指定了无效的空间参考
 * @exception {RuntimeError} metadata 未指定 tileInfo
 */
ArcGISTiledElevationTerrainProvider.fromUrl = async function (url, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;

  url = await Promise.resolve(url);
  let resource = Resource.createIfNeeded(url);
  resource.appendForwardSlash();
  if (defined(options.token)) {
    resource = resource.getDerivedResource({
      queryParameters: {
        token: options.token,
      },
    });
  }

  const metadataResource = resource.getDerivedResource({
    queryParameters: {
      f: "pjson",
    },
  });

  const terrainProviderBuilder = new TerrainProviderBuilder(options);
  await requestMetadata(terrainProviderBuilder, metadataResource);

  const provider = new ArcGISTiledElevationTerrainProvider(options);
  terrainProviderBuilder.build(provider);
  provider._resource = resource;

  return provider;
};

/**
 * 请求特定瓦片的几何数据。结果包含地形
 * 数据，并表明所有子瓦片均可使用。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片的层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<TerrainData>|undefined} A 请求几何数据的 promise。如果此方法
 * 返回 undefined 而不是 promise，说明当前有太多请求正在等待中，
 * 并将在稍后重试。
 */
ArcGISTiledElevationTerrainProvider.prototype.requestTileGeometry = function (
  x,
  y,
  level,
  request,
) {
  const tileResource = this._resource.getDerivedResource({
    url: `tile/${level}/${y}/${x}`,
    request: request,
  });

  const hasAvailability = this._hasAvailability;
  let availabilityPromise = Promise.resolve(true);
  let availabilityRequest;
  if (
    hasAvailability &&
    !defined(isTileAvailable(this, level + 1, x * 2, y * 2))
  ) {
    // We need to load child availability
    const availabilityResult = requestAvailability(
      this,
      level + 1,
      x * 2,
      y * 2,
    );

    availabilityPromise = availabilityResult.promise;
    availabilityRequest = availabilityResult.request;
  }

  const promise = tileResource.fetchArrayBuffer();
  if (!defined(promise) || !defined(availabilityPromise)) {
    return undefined;
  }

  const that = this;
  const tilesAvailable = this._tilesAvailable;
  return Promise.all([promise, availabilityPromise])
    .then(function (result) {
      return new HeightmapTerrainData({
        buffer: result[0],
        width: that._width,
        height: that._height,
        childTileMask: hasAvailability
          ? tilesAvailable.computeChildMaskForTile(level, x, y)
          : ALL_CHILDREN,
        structure: that._terrainDataStructure,
        encoding: that._encoding,
      });
    })
    .catch(async function (error) {
      if (
        defined(availabilityRequest) &&
        availabilityRequest.state === RequestState.CANCELLED
      ) {
        request.cancel();

        // Don't reject the promise till the request is actually cancelled
        // Otherwise it will think the request failed, but it didn't.
        try {
          await request.deferred?.promise;
        } catch {
          // Eat this error
        }

        request.state = RequestState.CANCELLED;
        return Promise.reject(error);
      }
      return Promise.reject(error);
    });
};

function isTileAvailable(that, level, x, y) {
  if (!that._hasAvailability) {
    return undefined;
  }

  const tilesAvailabilityLoaded = that._tilesAvailabilityLoaded;
  const tilesAvailable = that._tilesAvailable;

  if (level > that._lodCount) {
    return false;
  }

  // Check if tiles are known to be available
  if (tilesAvailable.isTileAvailable(level, x, y)) {
    return true;
  }

  // or to not be available
  if (tilesAvailabilityLoaded.isTileAvailable(level, x, y)) {
    return false;
  }

  return undefined;
}

/**
 * 获取特定层级瓦片允许的最大几何误差。
 *
 * @param {number} level 获取最大几何误差的瓦片层级。
 * @returns {number} The 最大几何误差。
 */
ArcGISTiledElevationTerrainProvider.prototype.getLevelMaximumGeometricError =
  function (level) {
    return this._levelZeroMaximumGeometricError / (1 << level);
  };

/**
 * 确定某个瓦片的数据是否可加载。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {boolean|undefined} Undefined 如果不支持，则为 true 或 false。
 */
ArcGISTiledElevationTerrainProvider.prototype.getTileDataAvailable = function (
  x,
  y,
  level,
) {
  if (!this._hasAvailability) {
    return undefined;
  }

  const result = isTileAvailable(this, level, x, y);
  if (defined(result)) {
    return result;
  }

  requestAvailability(this, level, x, y);

  return undefined;
};

/**
 * 确保加载该瓦片的可用性数据。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {undefined} This 提供器不支持加载可用性信息。
 */
ArcGISTiledElevationTerrainProvider.prototype.loadTileDataAvailability =
  function (x, y, level) {
    return undefined;
  };

function findRange(origin, width, height, data) {
  const endCol = width - 1;
  const endRow = height - 1;

  const value = data[origin.y * width + origin.x];
  const endingIndices = [];
  const range = {
    startX: origin.x,
    startY: origin.y,
    endX: 0,
    endY: 0,
  };

  const corner = new Cartesian2(origin.x + 1, origin.y + 1);
  let doneX = false;
  let doneY = false;
  while (!(doneX && doneY)) {
    // We want to use the original value when checking Y,
    //  so get it before it possibly gets incremented
    let endX = corner.x;

    // If we no longer move in the Y direction we need to check the corner tile in X pass
    const endY = doneY ? corner.y + 1 : corner.y;

    // Check X range
    if (!doneX) {
      for (let y = origin.y; y < endY; ++y) {
        if (data[y * width + corner.x] !== value) {
          doneX = true;
          break;
        }
      }

      if (doneX) {
        endingIndices.push(new Cartesian2(corner.x, origin.y));

        // Use the last good column so we can continue with Y
        --corner.x;
        --endX;
        range.endX = corner.x;
      } else if (corner.x === endCol) {
        range.endX = corner.x;
        doneX = true;
      } else {
        ++corner.x;
      }
    }

    // Check Y range - The corner tile is checked here
    if (!doneY) {
      const col = corner.y * width;
      for (let x = origin.x; x <= endX; ++x) {
        if (data[col + x] !== value) {
          doneY = true;
          break;
        }
      }

      if (doneY) {
        endingIndices.push(new Cartesian2(origin.x, corner.y));

        // Use the last good row so we can continue with X
        --corner.y;
        range.endY = corner.y;
      } else if (corner.y === endRow) {
        range.endY = corner.y;
        doneY = true;
      } else {
        ++corner.y;
      }
    }
  }

  return {
    endingIndices: endingIndices,
    range: range,
    value: value,
  };
}

function computeAvailability(x, y, width, height, data) {
  const ranges = [];

  const singleValue = data.every(function (val) {
    return val === data[0];
  });
  if (singleValue) {
    if (data[0] === 1) {
      ranges.push({
        startX: x,
        startY: y,
        endX: x + width - 1,
        endY: y + height - 1,
      });
    }

    return ranges;
  }

  let positions = [new Cartesian2(0, 0)];
  while (positions.length > 0) {
    const origin = positions.pop();
    const result = findRange(origin, width, height, data);

    if (result.value === 1) {
      // Convert range into the array into global tile coordinates
      const range = result.range;
      range.startX += x;
      range.endX += x;
      range.startY += y;
      range.endY += y;
      ranges.push(range);
    }

    const endingIndices = result.endingIndices;
    if (endingIndices.length > 0) {
      positions = positions.concat(endingIndices);
    }
  }

  return ranges;
}

function requestAvailability(that, level, x, y) {
  if (!that._hasAvailability) {
    return {};
  }

  // Fetch 128x128 availability list, so we make the minimum amount of requests
  const xOffset = Math.floor(x / 128) * 128;
  const yOffset = Math.floor(y / 128) * 128;

  const dim = Math.min(1 << level, 128);
  const url = `tilemap/${level}/${yOffset}/${xOffset}/${dim}/${dim}`;

  const availableCache = that._availableCache;
  if (defined(availableCache[url])) {
    return availableCache[url];
  }

  const request = new Request({
    throttle: false,
    throttleByServer: true,
    type: RequestType.TERRAIN,
  });

  const tilemapResource = that._resource.getDerivedResource({
    url: url,
    request: request,
  });

  let promise = tilemapResource.fetchJson();
  if (!defined(promise)) {
    return {};
  }

  promise = promise.then(function (result) {
    const available = computeAvailability(
      xOffset,
      yOffset,
      dim,
      dim,
      result.data,
    );

    // Mark whole area as having availability loaded
    that._tilesAvailabilityLoaded.addAvailableTileRange(
      level,
      xOffset,
      yOffset,
      xOffset + dim,
      yOffset + dim,
    );

    const tilesAvailable = that._tilesAvailable;
    for (let i = 0; i < available.length; ++i) {
      const range = available[i];
      tilesAvailable.addAvailableTileRange(
        level,
        range.startX,
        range.startY,
        range.endX,
        range.endY,
      );
    }

    // Conveniently return availability of original tile
    return isTileAvailable(that, level, x, y);
  });

  availableCache[url] = {
    promise: promise,
    request: request,
  };

  promise = promise.finally(function (result) {
    delete availableCache[url];

    return result;
  });

  return {
    promise: promise,
    request: request,
  };
}
export default ArcGISTiledElevationTerrainProvider;
