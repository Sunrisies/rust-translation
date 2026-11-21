import { DeveloperError, Frozen, defined } from "@cesium/core";
import Credit from "../Core/Credit.js";
import Resource from "../Core/Resource.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";

const trailingSlashRegex = /\/$/;
const defaultCredit = new Credit(
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/">Improve this map</a></strong>',
);

/**
 * @typedef {object} MapboxStyleImageryProvider.ConstructorOptions
 *
 * MapboxStyleImageryProvider 构造器的初始化选项
 *
 * @property {Resource|string} [url='https://api.mapbox.com/styles/v1/'] Mapbox 服务器 URL。
 * @property {string} [username='mapbox'] 地图账户的用户名。
 * @property {string} styleId Mapbox 样式 ID。
 * @property {string} accessToken 影像的公开访问令牌。
 * @property {number} [tilesize=512] 图像瓦片的大小。
 * @property {boolean} [scaleFactor] 决定瓦片是否以 @2x 缩放比例渲染。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体。如果未指定，则使用默认椭球体。
 * @property {number} [minimumLevel=0] 影像提供器支持的最小细节级别。在指定时请注意，最小级别下的瓦片数量应较少，例如四片或更少。数量过多可能导致渲染问题。
 * 影像提供器支持的最大细节级别，如果没有限制则保留为 undefined。
 * 图像所覆盖的矩形区域，以弧度为单位。
 * @property {number} [maximumLevel] 数据源提供的信用信息，显示在画布上。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 由 Mapbox 提供的瓦片式影像。
 * @property {Credit|string} [credit] 描述初始化选项的对象。
 */

/**
 * // Mapbox 样式提供器
 *
 * @alias MapboxStyleImageryProvider
 * @constructor
 *
 * @param {MapboxStyleImageryProvider.ConstructorOptions} options const mapbox = new Cesium.MapboxStyleImageryProvider({
 *
 * @example
 * styleId: 'streets-v11',
 * accessToken: 'thisIsMyAccessToken'
 * 获取 Mapbox 服务器的 URL。
 * 获取该实例提供的影像的矩形区域，以弧度为单位。
 * });
 *
 * @see {@link https://docs.mapbox.com/api/maps/#styles}
 * @see {@link https://docs.mapbox.com/api/#access-tokens-and-token-scopes}
 */
function MapboxStyleImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const styleId = options.styleId;
  //>>includeStart('debug', pragmas.debug);
  if (!defined(styleId)) {
    throw new DeveloperError("options.styleId is required.");
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
    options.url ?? "https://api.mapbox.com/styles/v1/",
  );

  this._styleId = styleId;
  this._accessToken = accessToken;

  const tilesize = options.tilesize ?? 512;
  this._tilesize = tilesize;

  const username = options.username ?? "mapbox";
  this._username = username;

  const scaleFactor = defined(options.scaleFactor) ? "@2x" : "";

  let templateUrl = resource.getUrlComponent();
  if (!trailingSlashRegex.test(templateUrl)) {
    templateUrl += "/";
  }
  templateUrl += `${this._username}/${styleId}/tiles/${this._tilesize}/{z}/{x}/{y}${scaleFactor}`;
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

Object.defineProperties(MapboxStyleImageryProvider.prototype, {
  /**
   * 获取每个瓦片的宽度，以像素为单位。
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._imageryProvider.url;
    },
  },

  /**
   * 获取每个瓦片的高度，以像素为单位。
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._imageryProvider.rectangle;
    },
  },

  /**
   * 获取可请求的最大细节级别。
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._imageryProvider.tileWidth;
    },
  },

  /**
   * 获取可请求的最小细节级别。通常，
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileHeight: {
    get: function () {
      return this._imageryProvider.tileHeight;
    },
  },

  /**
   * 只有在影像的矩形区域足够小且最小级别的瓦片数量较少时，才应使用最小级别。如果最小级别的瓦片数量较多，
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  maximumLevel: {
    get: function () {
      return this._imageryProvider.maximumLevel;
    },
  },

  /**
   * 则会导致渲染问题。
   * 获取提供器使用的瓦片方案。
   * 获取瓦片丢弃策略。如果未定义为 undefined，则丢弃策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数返回 undefined，则不会过滤任何瓦片。
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return this._imageryProvider.minimumLevel;
    },
  },

  /**
   * 获取此影像提供器激活时显示的信用信息。通常用于显示影像的来源。
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._imageryProvider.tilingScheme;
    },
  },

  /**
   * 获取该提供器使用的代理。
   * for filtering out "missing" tiles via its shouldDiscardImage function.  If this function
   * returns undefined, no tiles are filtered.
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._imageryProvider.tileDiscardPolicy;
    },
  },

  /**
   * Gets an event that is raised when the imagery provider encounters an asynchronous error..  By subscribing
   * to the event, you will be notified of the error and can potentially recover from it.  Event listeners
   * are passed an instance of {@link TileProviderError}.
   * @memberof MapboxStyleImageryProvider.prototype
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
   * @memberof MapboxStyleImageryProvider.prototype
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
   * @memberof MapboxStyleImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return this._imageryProvider.proxy;
    },
  },

  /**
   * 获取一个布尔值，指示该影像提供器提供的影像是否存在
   * 包含 alpha 通道。如果此属性为 false，则存在的 alpha 通道将被忽略
   * 如果此属性为 true，则没有 alpha 通道的影像将被视为其 alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少
   * 获取在显示特定瓦片时应显示的说明文字
   * 瓦片 X 坐标
   * @memberof MapboxStyleImageryProvider.prototype
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
 * 瓦片 Y 坐标
 *
 * @param {number} x 瓦片级别
 * @param {number} y 瓦片层级
 * @param {number} level 瓦片级别
 * @returns {Credit[]} The 在显示瓦片时应显示的说明文字
 */
MapboxStyleImageryProvider.prototype.getTileCredits = function (x, y, level) {
  return undefined;
};

/**
 * 请求特定瓦片的影像数据
 *
 * @param {number} x 瓦片 X 坐标
 * @param {number} y 瓦片 Y 坐标
 * @param {number} level 瓦片级别
 * @param {Request} [request] 请求对象。仅用于内部使用
 * @returns {Promise<ImageryTypes>|undefined} A 影像的承诺，当影像可用时将解析，或者
 * 如果对服务器的活跃请求过多且需要重试，则定义为未定义
 */
MapboxStyleImageryProvider.prototype.requestImage = function (
  x,
  y,
  level,
  request,
) {
  return this._imageryProvider.requestImage(x, y, level, request);
};

/**
 * 异步确定在给定经度和纬度范围内的瓦片中是否存在任何特征
 * 此函数可选，因此并非所有影像提供器都包含该功能
 *
 *
 * @param {number} x 瓦片 X 坐标
 * @param {number} y 瓦片 Y 坐标
 * @param {number} level 瓦片级别
 * @param {number} longitude 选择特征的经度
 * @param {number} latitude  选择特征的纬度
 * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 所选特征的承诺，将在异步选择完成时解析。解析值是一个 {@link ImageryLayerFeatureInfo} 实例数组
 * 如果给定位置没有找到特征，则数组可能为空
 * 如果不支持选择功能，该值也可能未定义
 * It may also be undefined if picking is not supported.
 */
MapboxStyleImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return this._imageryProvider.pickFeatures(x, y, level, longitude, latitude);
};

// Exposed for tests
MapboxStyleImageryProvider._defaultCredit = defaultCredit;
export default MapboxStyleImageryProvider;
