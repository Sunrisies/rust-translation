import { DeveloperError, Frozen, defined } from "@cesium/core";
import Credit from "../Core/Credit.js";
import Resource from "../Core/Resource.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";

const trailingSlashRegex = /\/$/;
const defaultCredit = new Credit(
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/">Improve this map</a></strong>',
);

/**
 * @typedef {object} MapboxImageryProvider.ConstructorOptions
 *
 * MapboxImageryProvider 构造函数的初始化选项
 *
 * @property {string} [url='https://api.mapbox.com/v4/'] Mapbox 服务器 URL。
 * @property {string} mapId Mapbox 地图 ID。
 * @property {string} accessToken 影像的公开访问令牌。
 * @property {string} [format='png'] 图像请求的格式。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体参数。如果未指定，则使用默认椭球体。
 * @property {number} [minimumLevel=0] 影像提供器支持的最小细节级别。注意，当最小级别下的瓦片数量较少时，例如四片或更少，可能会导致渲染问题。
 * 影像提供器支持的最大细节级别，如果没有限制则保留为 undefined。
 * 图像所覆盖的弧度单位制矩形区域。
 * @property {number} [maximumLevel] 数据源提供的信用信息，显示在画布上。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 由 Mapbox 托管的分块影像。
 * @property {Credit|string} [credit] 描述初始化选项的对象。
 */

/**
 * // Mapbox 瓦片提供器
 *
 * @alias MapboxImageryProvider
 * @constructor
 *
 * @param {MapboxImageryProvider.ConstructorOptions} options 描述初始化选项的对象
 *
 * @example
 * // Mapbox 瓦片提供器
 * const mapbox = new Cesium.MapboxImageryProvider({
 * mapId: 'mapbox.mapbox-terrain-v2',
 * accessToken: 'thisIsMyAccessToken'
 * });
 *
 * @see {@link https://docs.mapbox.com/api/maps/raster-tiles/}
 * @see {@link https://docs.mapbox.com/api/accounts/tokens/}
 */
function MapboxImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const mapId = options.mapId;
  //>>includeStart('debug', pragmas.debug);
  if (!defined(mapId)) {
    throw new DeveloperError("options.mapId is required.");
  }
  //>>includeEnd('debug');

  const accessToken = options.accessToken;
  //>>includeStart('debug', pragmas.debug);
  if (!defined(accessToken)) {
    throw new DeveloperError("options.accessToken is required.");
  }
  //>>includeEnd('debug');

  this._defaultAlpha = undefined;
  this._defaultNightAlpha = undefined;
  this._defaultDayAlpha = undefined;
  this._defaultBrightness = undefined;
  this._defaultContrast = undefined;
  this._defaultHue = undefined;
  this._defaultSaturation = undefined;
  this._defaultGamma = undefined;
  this._defaultMinificationFilter = undefined;
  this._defaultMagnificationFilter = undefined;

  const resource = Resource.createIfNeeded(
    options.url ?? "https://{s}.tiles.mapbox.com/v4/",
  );

  this._mapId = mapId;
  this._accessToken = accessToken;

  let format = options.format ?? "png";
  if (!/\./.test(format)) {
    format = `.${format}`;
  }
  this._format = format;

  let templateUrl = resource.getUrlComponent();
  if (!trailingSlashRegex.test(templateUrl)) {
    templateUrl += "/";
  }
  templateUrl += `${mapId}/{z}/{x}/{y}${this._format}`;
  resource.url = templateUrl;

  resource.setQueryParameters({
    access_token: accessToken,
  });

  let credit;
  if (defined(options.credit)) {
    credit = options.credit;
    if (typeof credit === "string") {
      credit = new Credit(credit);
    }
  } else {
    credit = defaultCredit;
  }

  this._resource = resource;
  this._imageryProvider = new UrlTemplateImageryProvider({
    url: resource,
    credit: credit,
    ellipsoid: options.ellipsoid,
    minimumLevel: options.minimumLevel,
    maximumLevel: options.maximumLevel,
    rectangle: options.rectangle,
  });
}

Object.defineProperties(MapboxImageryProvider.prototype, {
  /**
   * 获取 Mapbox 服务器的 URL。
   * @memberof MapboxImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._imageryProvider.url;
    },
  },

  /**
   * 获取该实例提供的影像的弧度单位制矩形区域。
   * @memberof MapboxImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._imageryProvider.rectangle;
    },
  },

  /**
   * 获取每个瓦片的像素宽度。
   * @memberof MapboxImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._imageryProvider.tileWidth;
    },
  },

  /**
   * 获取每个瓦片的像素高度。
   * @memberof MapboxImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileHeight: {
    get: function () {
      return this._imageryProvider.tileHeight;
    },
  },

  /**
   * 获取可请求的最大细节级别。
   * @memberof MapboxImageryProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  maximumLevel: {
    get: function () {
      return this._imageryProvider.maximumLevel;
    },
  },

  /**
   * 获取可请求的最小细节级别。通常，
   * 只有在影像的矩形区域足够小，使得最小级别的瓦片数量较少时，才应使用最小级别。如果最小级别的瓦片数量较多，
   * 则会导致渲染问题。
   * 获取提供器使用的分块方案。
   * 获取瓦片丢弃策略。如果未定义为 undefined，该策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数返回 undefined，则不会过滤任何瓦片。
   * @memberof MapboxImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return this._imageryProvider.minimumLevel;
    },
  },

  /**
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * @memberof MapboxImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._imageryProvider.tilingScheme;
    },
  },

  /**
   * 接收 {@link TileProviderError} 的实例。
   * 获取此影像提供器激活时显示的信用信息。通常用于显示影像的来源。
   * 获取该提供器使用的代理。
   * @memberof MapboxImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._imageryProvider.tileDiscardPolicy;
    },
  },

  /**
   * 获取指示该影像提供器提供的图像是否存在的布尔值。
   * to the event, you will be notified of the error and can potentially recover from it.  Event listeners
   * are passed an instance of {@link TileProviderError}.
   * @memberof MapboxImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._imageryProvider.errorEvent;
    },
  },

  /**
   * Gets the credit to display when this imagery provider is active.  Typically this is used to credit
   * the source of the imagery.
   * @memberof MapboxImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._imageryProvider.credit;
    },
  },

  /**
   * Gets the proxy used by this provider.
   * @memberof MapboxImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return this._imageryProvider.proxy;
    },
  },

  /**
   * Gets a value indicating whether or not the images provided by this imagery provider
   * 包含 Alpha 通道。如果此属性为 false，则存在的 Alpha 通道将被忽略。
   * 任何没有 Alpha 通道的图像将被视为其 Alpha 值为 1.0。当此属性为 true 时，内存使用和纹理上传时间都会减少。
   * 当该属性为 false 时，内存使用和纹理上传时间会减少。
   * 当该属性为 true 时，任何没有 Alpha 通道的图像都将被视为其 Alpha 值为 1.0。当此属性为 false 时，内存使用和纹理上传时间会减少。
   * @memberof MapboxImageryProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasAlphaChannel: {
    get: function () {
      return this._imageryProvider.hasAlphaChannel;
    },
  },
});

/**
 * 获取在显示特定瓦片时应显示的标题信息。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @returns {Credit[]} The 在显示瓦片时应显示的标题信息。
 */
MapboxImageryProvider.prototype.getTileCredits = function (x, y, level) {
  return undefined;
};

/**
 * 请求特定瓦片的图像。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像的承诺，该图像将在可用时解析，或者
 * 如果对服务器的活跃请求过多，则定义为未定义，请求将在之后重试。
 */
MapboxImageryProvider.prototype.requestImage = function (x, y, level, request) {
  return this._imageryProvider.requestImage(x, y, level, request);
};

/**
 * 异步确定在给定经度和纬度范围内的瓦片中是否存在任何功能。此函数可选，因此并非所有 ImageryProvider 都包含此功能。
 * 瓦片 X 坐标。
 *
 * @param {number} x 瓦片 Y 坐标。
 * @param {number} y 瓦片层级。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 选择功能的经度。
 * @param {number} latitude  选择功能的纬度。
 * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 选择功能的承诺，该承诺将在异步操作完成时解析。解析值是一个 {@link ImageryLayerFeatureInfo} 实例数组。如果给定位置没有找到功能，该数组可能为空。
 * 如果不支持选择功能，则也可能定义为未定义。
 * instances.  The array may be empty if no features are found at the given location.
 * It may also be undefined if picking is not supported.
 */
MapboxImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return this._imageryProvider.pickFeatures(x, y, level, longitude, latitude);
};

// Exposed for tests
MapboxImageryProvider._defaultCredit = defaultCredit;
export default MapboxImageryProvider;
