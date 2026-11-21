import {
  Check,
  Event,
  Frozen,
  JulianDate,
  Math as CesiumMath,
  Rectangle,
  RuntimeError,
  defined,
} from "@cesium/core";
import Credit from "./Credit.js";
import GeographicTilingScheme from "./GeographicTilingScheme.js";
import GoogleEarthEnterpriseMetadata from "./GoogleEarthEnterpriseMetadata.js";
import GoogleEarthEnterpriseTerrainData from "./GoogleEarthEnterpriseTerrainData.js";
import HeightmapTerrainData from "./HeightmapTerrainData.js";
import Request from "./Request.js";
import RequestState from "./RequestState.js";
import RequestType from "./RequestType.js";
import TaskProcessor from "./TaskProcessor.js";

const TerrainState = {
  UNKNOWN: 0,
  NONE: 1,
  SELF: 2,
  PARENT: 3,
};

const julianDateScratch = new JulianDate();

function TerrainCache() {
  this._terrainCache = {};
  this._lastTidy = JulianDate.now();
}

TerrainCache.prototype.add = function (quadKey, buffer) {
  this._terrainCache[quadKey] = {
    buffer: buffer,
    timestamp: JulianDate.now(),
  };
};

TerrainCache.prototype.get = function (quadKey) {
  const terrainCache = this._terrainCache;
  const result = terrainCache[quadKey];
  if (defined(result)) {
    delete this._terrainCache[quadKey];
    return result.buffer;
  }
};

TerrainCache.prototype.tidy = function () {
  JulianDate.now(julianDateScratch);
  if (JulianDate.secondsDifference(julianDateScratch, this._lastTidy) > 10) {
    const terrainCache = this._terrainCache;
    const keys = Object.keys(terrainCache);
    const count = keys.length;
    for (let i = 0; i < count; ++i) {
      const k = keys[i];
      const e = terrainCache[k];
      if (JulianDate.secondsDifference(julianDateScratch, e.timestamp) > 10) {
        delete terrainCache[k];
      }
    }

    JulianDate.clone(julianDateScratch, this._lastTidy);
  }
};

/**
 * @typedef {object} GoogleEarthEnterpriseTerrainProvider.ConstructorOptions
 *
 * GoogleEarthEnterpriseTerrainProvider构造器的初始化选项
 *
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体。如果未指定，则使用默认椭球体。
 * @property {Credit|string} [credit] 数据来源的致谢信息，显示在画布上。
 */

/**
 * <div class="notice">
 * 要创建 GoogleEarthEnterpriseTerrainProvider，请调用 {@link  GoogleEarthEnterpriseTerrainProvider.fromMetadata}。不要直接调用构造器。
 * </div>
 *
 * 通过 Google Earth Enterprise REST API 提供瓦片式地形。
 *
 * @alias GoogleEarthEnterpriseTerrainProvider
 * @constructor
 *
 * @param {GoogleEarthEnterpriseTerrainProvider.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @see GoogleEarthEnterpriseTerrainProvider.fromMetadata
 * @see GoogleEarthEnterpriseMetadata.fromUrl
 * @see GoogleEarthEnterpriseImageryProvider
 * @see CesiumTerrainProvider
 *
 * @example
 * const geeMetadata = await GoogleEarthEnterpriseMetadata.fromUrl("http://www.example.com");
 * const gee = Cesium.GoogleEarthEnterpriseTerrainProvider.fromMetadata(geeMetadata);
 *
 * @see {@link http://www.w3.org/TR/cors/|Cross-Origin Resource Sharing}
 */
function GoogleEarthEnterpriseTerrainProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._tilingScheme = new GeographicTilingScheme({
    numberOfLevelZeroTilesX: 2,
    numberOfLevelZeroTilesY: 2,
    rectangle: new Rectangle(
      -CesiumMath.PI,
      -CesiumMath.PI,
      CesiumMath.PI,
      CesiumMath.PI,
    ),
    ellipsoid: options.ellipsoid,
  });

  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;

  // Pulled from Google's documentation
  this._levelZeroMaximumGeometricError = 40075.16;

  this._terrainCache = new TerrainCache();
  this._terrainPromises = {};
  this._terrainRequests = {};

  this._errorEvent = new Event();
}

Object.defineProperties(GoogleEarthEnterpriseTerrainProvider.prototype, {
  /**
   * 获取托管影像的 Google Earth Enterprise 服务器 URL 名称。
   * @memberof GoogleEarthEnterpriseTerrainProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._metadata.url;
    },
  },

  /**
   * 获取此提供器使用的代理。
   * @memberof GoogleEarthEnterpriseTerrainProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return this._metadata.proxy;
    },
  },

  /**
   * 获取此提供器使用的瓦片方案。
   * @memberof GoogleEarthEnterpriseTerrainProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取当影像提供器遇到异步错误时引发的事件。通过订阅该事件，
   * 您将收到错误通知，并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * @memberof GoogleEarthEnterpriseTerrainProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 获取此地形提供器激活时显示的致谢信息。通常用于致谢
   * 地形来源。
   * @memberof GoogleEarthEnterpriseTerrainProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 获取指示提供器是否包含水掩膜的值。水掩膜
   * 表示地球上的哪些区域是水而不是陆地，因此可以被渲染为具有动画波浪的反射表面。
   * 获取指示请求的瓦片是否包含顶点法线的值。
   * @memberof GoogleEarthEnterpriseTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasWaterMask: {
    get: function () {
      return false;
    },
  },

  /**
   * 获取可用于确定此提供器地形可用性的对象，例如
   * @memberof GoogleEarthEnterpriseTerrainProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasVertexNormals: {
    get: function () {
      return false;
    },
  },

  /**
   * Gets an object that can be used to determine availability of terrain from this provider, such as
   * 在点和矩形上。如果可用性信息不可得，
   * 此属性可能未定义。
   * @memberof GoogleEarthEnterpriseTerrainProvider.prototype
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
 * 从 GoogleEarthEnterpriseMetadata 创建 GoogleEarthTerrainProvider
 *
 * @param {GoogleEarthEnterpriseMetadata} metadata 可用于与 GoogleEarthEnterpriseImageryProvider 共享元数据请求的元数据对象。
 * @param {GoogleEarthEnterpriseTerrainProvider.ConstructorOptions} options 描述初始化选项的对象
 * @returns {GoogleEarthEnterpriseTerrainProvider}
 *
 * @see GoogleEarthEnterpriseMetadata.fromUrl
 *
 * @exception {RuntimeError} metadata 未指定地形
 *
 * @example
 * const geeMetadata = await GoogleEarthEnterpriseMetadata.fromUrl("http://www.example.com");
 * const gee = Cesium.GoogleEarthEnterpriseTerrainProvider.fromMetadata(geeMetadata);
 */
GoogleEarthEnterpriseTerrainProvider.fromMetadata = function (
  metadata,
  options,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("metadata", metadata);
  //>>includeEnd('debug');

  if (!metadata.terrainPresent) {
    throw new RuntimeError(`The server ${metadata.url} doesn't have terrain`);
  }

  const provider = new GoogleEarthEnterpriseTerrainProvider(options);
  provider._metadata = metadata;

  return provider;
};

const taskProcessor = new TaskProcessor("decodeGoogleEarthEnterprisePacket");

// If the tile has its own terrain, then you can just use its child bitmask. If it was requested using it's parent
//  then you need to check all of its children to see if they have terrain.
function computeChildMask(quadKey, info, metadata) {
  let childMask = info.getChildBitmask();
  if (info.terrainState === TerrainState.PARENT) {
    childMask = 0;
    for (let i = 0; i < 4; ++i) {
      const child = metadata.getTileInformationFromQuadKey(
        quadKey + i.toString(),
      );
      if (defined(child) && child.hasTerrain()) {
        childMask |= 1 << i;
      }
    }
  }

  return childMask;
}

/**
 * 请求给定瓦片的几何数据。结果必须包含地形数据。
 * 可以可选包含水掩模以及哪些子瓦片可用的指示。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<TerrainData>|undefined} A 请求的几何数据的承诺。如果此方法
 * 返回 undefined 而不是承诺，表示当前有太多请求正在等待中，
 * 请求将稍后重试。
 */
GoogleEarthEnterpriseTerrainProvider.prototype.requestTileGeometry = function (
  x,
  y,
  level,
  request,
) {
  const quadKey = GoogleEarthEnterpriseMetadata.tileXYToQuadKey(x, y, level);
  const terrainCache = this._terrainCache;
  const metadata = this._metadata;
  const info = metadata.getTileInformationFromQuadKey(quadKey);

  // Check if this tile is even possibly available
  if (!defined(info)) {
    return Promise.reject(new RuntimeError("Terrain tile doesn't exist"));
  }

  let terrainState = info.terrainState;
  if (!defined(terrainState)) {
    // First time we have tried to load this tile, so set terrain state to UNKNOWN
    terrainState = info.terrainState = TerrainState.UNKNOWN;
  }

  // If its in the cache, return it
  const buffer = terrainCache.get(quadKey);
  if (defined(buffer)) {
    const credit = metadata.providers[info.terrainProvider];
    return Promise.resolve(
      new GoogleEarthEnterpriseTerrainData({
        buffer: buffer,
        childTileMask: computeChildMask(quadKey, info, metadata),
        credits: defined(credit) ? [credit] : undefined,
        negativeAltitudeExponentBias: metadata.negativeAltitudeExponentBias,
        negativeElevationThreshold: metadata.negativeAltitudeThreshold,
      }),
    );
  }

  // Clean up the cache
  terrainCache.tidy();

  // We have a tile, check to see if no ancestors have terrain or that we know for sure it doesn't
  if (!info.ancestorHasTerrain) {
    // We haven't reached a level with terrain, so return the ellipsoid
    return Promise.resolve(
      new HeightmapTerrainData({
        buffer: new Uint8Array(16 * 16),
        width: 16,
        height: 16,
      }),
    );
  } else if (terrainState === TerrainState.NONE) {
    // Already have info and there isn't any terrain here
    return Promise.reject(new RuntimeError("Terrain tile doesn't exist"));
  }

  // Figure out where we are getting the terrain and what version
  let parentInfo;
  let q = quadKey;
  let terrainVersion = -1;
  switch (terrainState) {
    case TerrainState.SELF: // We have terrain and have retrieved it before
      terrainVersion = info.terrainVersion;
      break;
    case TerrainState.PARENT: // We have terrain in our parent
      q = q.substring(0, q.length - 1);
      parentInfo = metadata.getTileInformationFromQuadKey(q);
      terrainVersion = parentInfo.terrainVersion;
      break;
    case TerrainState.UNKNOWN: // We haven't tried to retrieve terrain yet
      if (info.hasTerrain()) {
        terrainVersion = info.terrainVersion; // We should have terrain
      } else {
        q = q.substring(0, q.length - 1);
        parentInfo = metadata.getTileInformationFromQuadKey(q);
        if (defined(parentInfo) && parentInfo.hasTerrain()) {
          terrainVersion = parentInfo.terrainVersion; // Try checking in the parent
        }
      }
      break;
  }

  // We can't figure out where to get the terrain
  if (terrainVersion < 0) {
    return Promise.reject(new RuntimeError("Terrain tile doesn't exist"));
  }

  // Load that terrain
  const terrainPromises = this._terrainPromises;
  const terrainRequests = this._terrainRequests;
  let sharedPromise;
  let sharedRequest;
  if (defined(terrainPromises[q])) {
    // Already being loaded possibly from another child, so return existing promise
    sharedPromise = terrainPromises[q];
    sharedRequest = terrainRequests[q];
  } else {
    // Create new request for terrain
    sharedRequest = request;
    const requestPromise = buildTerrainResource(
      this,
      q,
      terrainVersion,
      sharedRequest,
    ).fetchArrayBuffer();

    if (!defined(requestPromise)) {
      return undefined; // Throttled
    }

    sharedPromise = requestPromise.then(function (terrain) {
      if (defined(terrain)) {
        return taskProcessor
          .scheduleTask(
            {
              buffer: terrain,
              type: "Terrain",
              key: metadata.key,
            },
            [terrain],
          )
          .then(function (terrainTiles) {
            // Add requested tile and mark it as SELF
            const requestedInfo = metadata.getTileInformationFromQuadKey(q);
            requestedInfo.terrainState = TerrainState.SELF;
            terrainCache.add(q, terrainTiles[0]);
            const provider = requestedInfo.terrainProvider;

            // Add children to cache
            const count = terrainTiles.length - 1;
            for (let j = 0; j < count; ++j) {
              const childKey = q + j.toString();
              const child = metadata.getTileInformationFromQuadKey(childKey);
              if (defined(child)) {
                terrainCache.add(childKey, terrainTiles[j + 1]);
                child.terrainState = TerrainState.PARENT;
                if (child.terrainProvider === 0) {
                  child.terrainProvider = provider;
                }
              }
            }
          });
      }

      return Promise.reject(new RuntimeError("Failed to load terrain."));
    });

    terrainPromises[q] = sharedPromise; // Store promise without delete from terrainPromises
    terrainRequests[q] = sharedRequest;

    // Set promise so we remove from terrainPromises just one time
    sharedPromise = sharedPromise.finally(function () {
      delete terrainPromises[q];
      delete terrainRequests[q];
    });
  }

  return sharedPromise
    .then(function () {
      const buffer = terrainCache.get(quadKey);
      if (defined(buffer)) {
        const credit = metadata.providers[info.terrainProvider];
        return new GoogleEarthEnterpriseTerrainData({
          buffer: buffer,
          childTileMask: computeChildMask(quadKey, info, metadata),
          credits: defined(credit) ? [credit] : undefined,
          negativeAltitudeExponentBias: metadata.negativeAltitudeExponentBias,
          negativeElevationThreshold: metadata.negativeAltitudeThreshold,
        });
      }

      return Promise.reject(new RuntimeError("Failed to load terrain."));
    })
    .catch(function (error) {
      if (sharedRequest.state === RequestState.CANCELLED) {
        request.state = sharedRequest.state;
        return Promise.reject(error);
      }
      info.terrainState = TerrainState.NONE;
      return Promise.reject(error);
    });
};

/**
 * 获取给定层级下瓦片允许的最大几何误差。
 *
 * @param {number} level 获取最大几何误差的瓦片层级。
 * @returns {number} The 最大几何误差。
 */
GoogleEarthEnterpriseTerrainProvider.prototype.getLevelMaximumGeometricError =
  function (level) {
    return this._levelZeroMaximumGeometricError / (1 << level);
  };

/**
 * 确定瓦片的数据是否可加载。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {boolean|undefined} Undefined 如果不支持，则为 false；否则为 true。
 */
GoogleEarthEnterpriseTerrainProvider.prototype.getTileDataAvailable = function (
  x,
  y,
  level,
) {
  const metadata = this._metadata;
  let quadKey = GoogleEarthEnterpriseMetadata.tileXYToQuadKey(x, y, level);

  const info = metadata.getTileInformation(x, y, level);
  if (info === null) {
    return false;
  }

  if (defined(info)) {
    if (!info.ancestorHasTerrain) {
      return true; // We'll just return the ellipsoid
    }

    const terrainState = info.terrainState;
    if (terrainState === TerrainState.NONE) {
      return false; // Terrain is not available
    }

    if (!defined(terrainState) || terrainState === TerrainState.UNKNOWN) {
      info.terrainState = TerrainState.UNKNOWN;
      if (!info.hasTerrain()) {
        quadKey = quadKey.substring(0, quadKey.length - 1);
        const parentInfo = metadata.getTileInformationFromQuadKey(quadKey);
        if (!defined(parentInfo) || !parentInfo.hasTerrain()) {
          return false;
        }
      }
    }

    return true;
  }

  if (metadata.isValid(quadKey)) {
    // We will need this tile, so request metadata and return false for now
    const request = new Request({
      throttle: false,
      throttleByServer: true,
      type: RequestType.TERRAIN,
    });
    metadata.populateSubtree(x, y, level, request);
  }
  return false;
};

/**
 * 确保加载瓦片的可用性数据。
 *
 * @param {number} x 请求几何数据的瓦片的 X 坐标。
 * @param {number} y 请求几何数据的瓦片的 Y 坐标。
 * @param {number} level 请求几何数据的瓦片层级。
 * @returns {undefined}
 */
GoogleEarthEnterpriseTerrainProvider.prototype.loadTileDataAvailability =
  function (x, y, level) {
    return undefined;
  };

//
// Functions to handle imagery packets
//
function buildTerrainResource(terrainProvider, quadKey, version, request) {
  version = defined(version) && version > 0 ? version : 1;
  return terrainProvider._metadata.resource.getDerivedResource({
    url: `flatfile?f1c-0${quadKey}-t.${version.toString()}`,
    request: request,
  });
}
export default GoogleEarthEnterpriseTerrainProvider;
