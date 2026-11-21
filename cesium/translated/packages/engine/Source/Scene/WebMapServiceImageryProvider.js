import {
  DeveloperError,
  Frozen,
  WebMercatorProjection,
  defined,
} from "@cesium/core";
import GeographicTilingScheme from "../Core/GeographicTilingScheme.js";
import Resource from "../Core/Resource.js";
import GetFeatureInfoFormat from "./GetFeatureInfoFormat.js";
import TimeDynamicImagery from "./TimeDynamicImagery.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";

/**
 * EPSG 代码包含反向轴序，但不在 4000-5000 范围内。
 *
 * @type {number[]}
 * @ignore
 */
const includesReverseAxis = [
  3034, // ETRS89-extended / LCC Europe
  3035, // ETRS89-extended / LAEA Europe
  3042, // ETRS89 / UTM zone 30N (N-E)
  3043, // ETRS89 / UTM zone 31N (N-E)
  3044, // ETRS89 / UTM zone 32N (N-E)
];

/**
 * EPSG 代码不包含反向轴序，且在 4000-5000 范围内。
 *
 * @type {number[]}
 * @ignore
 */
const excludesReverseAxis = [
  4471, // Mayotte
  4559, // French Antilles
];

/**
 * @typedef {object} WebMapServiceImageryProvider.ConstructorOptions
 *
 * WebMapServiceImageryProvider 构造函数的初始化选项。
 *
 * @property {Resource|string} url WMS 服务的 URL。该 URL 支持与 {@link UrlTemplateImageryProvider} 相同的关键词。
 * @property {string} layers 要包含的图层，用逗号分隔。
 * @property {object} [parameters=WebMapServiceImageryProvider.DefaultParameters] 在 GetMap URL 中传递给 WMS 服务器的附加参数。
 * @property {boolean} [enablePickFeatures=true] 如果为 true，{@link WebMapServiceImageryProvider#pickFeatures} 将向 WMS 服务器调用
 * GetFeatureInfo 操作，并返回响应中包含的实体。如果为 false，
 * {@link WebMapServiceImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选取的实体）
 * 而不与服务器通信。如果知道您的 WMS 服务器不支持
 * GetFeatureInfo，或者不希望该提供商的实体可选取，请将此属性设置为 false。注意，这可以通过修改
 * WebMapServiceImageryProvider#enablePickFeatures 属性来动态覆盖。
 * @property {object} [getFeatureInfoParameters=WebMapServiceImageryProvider.GetFeatureInfoDefaultParameters] 在 GetFeatureInfo URL 中传递给 WMS 服务器的附加参数。
 * @property {Resource|string} [getFeatureInfoUrl] WMS 服务的 getFeatureInfo URL。如果此属性未定义，则使用 url 中的值。
 * @property {GetFeatureInfoFormat[]} [getFeatureInfoFormats=WebMapServiceImageryProvider.DefaultGetFeatureInfoFormats] 格式
 * 用于尝试 WMS GetFeatureInfo 请求的形式。由于不同 WMS 服务的特征信息响应有所不同，
 * 您可能需要提供自定义格式和解析回调；请参阅
 *        {@link https://sandcastle.cesium.com/?id=web-map-tile-service-picking|Sandcastle example} for a complete
 * 层的范围。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 用于将世界划分为瓦片的 tiling 方案。
 * @property {TilingScheme} [tilingScheme=new GeographicTilingScheme()] 使用的 tiling 方案，用于将世界划分为瓦片。
 * @property {Ellipsoid} [ellipsoid] 椭球体。如果指定了 tilingScheme，
 * 则忽略此参数，使用 tiling 方案的椭球体。如果两者均未指定，
 * 则使用 WGS84 椭球体。
 * @property {number} [tileWidth=256] 每个瓦片的像素宽度。
 * @property {number} [tileHeight=256] 每个瓦片的像素高度。
 * @property {number} [minimumLevel=0] 影像提供器支持的最小细节级别。在指定此参数时请注意，最低级别的瓦片数量应较少，例如四片或更少。较大的数量
 * specifying this that the number of tiles at the minimum level is small, such as four or less.  A larger number is
 * 可能会导致渲染问题。
 * @property {number} [maximumLevel] 影像提供器支持的最大细节级别，如果没有限制则定义为 undefined。
 * 未指定时，无限制。
 * @property {string} [crs] CRS 规范，适用于 WMS 规范 >= 1.3.0。
 * @property {string} [srs] SRS 规范，适用于 WMS 规范 1.1.0 或 1.1.1。
 * @property {Credit|string} [credit] 显示于画布上的数据来源标识。
 * @property {string|string[]} [subdomains='abc'] 在 URL 模板中用于 <code>{s}</code> 占位符的子域。
 * 如果此参数为单个字符串，则字符串中的每个字符均为一个子域。如果为
 * 数组，则数组中的每个元素均为一个子域。
 * @property {Clock} [clock] 用于确定时间维度值的时钟实例。当指定 `times` 时必需。
 * @property {TimeIntervalCollection} [times] 包含时间动态维度及其值的对象的数据属性的 TimeIntervalCollection。
 */

/**
 * 由 Web Map Service (WMS) 服务器提供的瓦片式影像。
 *
 * @alias WebMapServiceImageryProvider
 * @constructor
 *
 * @param {WebMapServiceImageryProvider.ConstructorOptions} options 描述初始化选项的对象。
 *
 * @see ArcGisMapServerImageryProvider
 * @see BingMapsImageryProvider
 * @see GoogleEarthEnterpriseMapsProvider
 * @see OpenStreetMapImageryProvider
 * @see SingleTileImageryProvider
 * @see TileMapServiceImageryProvider
 * @see WebMapTileServiceImageryProvider
 * @see UrlTemplateImageryProvider
 *
 * @see {@link https://enterprise.arcgis.com/en/server/latest/publish-services/linux/wms-services.htm|ArcGIS Server WMS Services}
 * @see {@link http://www.w3.org/TR/cors/|Cross-Origin Resource Sharing}
 * @see {@link https://sandcastle.cesium.com/?id=web-map-tile-service-picking|Custom GetFeatureInfo Sandcastle Example}
 *
 * @example
 * // 由美国政府运营的 WMS 服务器 https://apps.nationalmap.gov/services/
 * const provider = new Cesium.WebMapServiceImageryProvider({
 * url : 'https://basemap.nationalmap.gov:443/arcgis/services/USGSHydroCached/MapServer/WMSServer',
 * layers : '0',
 * proxy: new Cesium.DefaultProxy('/proxy/')
 * });
 * const imageryLayer = new Cesium.ImageryLayer(provider);
 * viewer.imageryLayers.add(imageryLayer);
 */
function WebMapServiceImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(options.url)) {
    throw new DeveloperError("options.url is required.");
  }
  if (!defined(options.layers)) {
    throw new DeveloperError("options.layers is required.");
  }
  //>>includeEnd('debug');

  if (defined(options.times) && !defined(options.clock)) {
    throw new DeveloperError(
      "options.times was specified, so options.clock is required.",
    );
  }

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

  this._getFeatureInfoUrl = options.getFeatureInfoUrl ?? options.url;

  const resource = Resource.createIfNeeded(options.url);
  const pickFeatureResource = Resource.createIfNeeded(this._getFeatureInfoUrl);

  resource.setQueryParameters(
    WebMapServiceImageryProvider.DefaultParameters,
    true,
  );
  pickFeatureResource.setQueryParameters(
    WebMapServiceImageryProvider.GetFeatureInfoDefaultParameters,
    true,
  );

  if (defined(options.parameters)) {
    resource.setQueryParameters(objectToLowercase(options.parameters));
  }

  if (defined(options.getFeatureInfoParameters)) {
    pickFeatureResource.setQueryParameters(
      objectToLowercase(options.getFeatureInfoParameters),
    );
  }

  const that = this;
  this._reload = undefined;
  if (defined(options.times)) {
    this._timeDynamicImagery = new TimeDynamicImagery({
      clock: options.clock,
      times: options.times,
      requestImageFunction: function (x, y, level, request, interval) {
        return requestImage(that, x, y, level, request, interval);
      },
      reloadFunction: function () {
        if (defined(that._reload)) {
          that._reload();
        }
      },
    });
  }

  const parameters = {};
  parameters.layers = options.layers;
  parameters.bbox =
    "{westProjected},{southProjected},{eastProjected},{northProjected}";
  parameters.width = "{width}";
  parameters.height = "{height}";

  // Use SRS or CRS based on the WMS version.
  if (parseFloat(resource.queryParameters.version) >= 1.3) {
    // Use CRS with 1.3.0 and going forward.
    // For GeographicTilingScheme, use CRS:84 vice EPSG:4326 to specify lon, lat (x, y) ordering for
    // bbox requests.
    parameters.crs =
      options.crs ??
      (options.tilingScheme &&
      options.tilingScheme.projection instanceof WebMercatorProjection
        ? "EPSG:3857"
        : "CRS:84");

    // The axis order in previous versions of the WMS specifications was to always use easting (x or lon ) and northing (y or
    // lat). WMS 1.3.0 specifies that, depending on the particular CRS, the x axis may or may not be oriented West-to-East,
    // and the y axis may or may not be oriented South-to-North. The WMS portrayal operation shall account for axis order.
    // This affects some of the EPSG codes that were commonly used such as ESPG:4326. The current implementation
    // makes sure that coordinates passed to the server (as part of the GetMap BBOX parameter) as well as those advertised
    // in the capabilities document reflect the inverse axe orders for EPSG codes between 4000 and 5000.
    //  - Taken from Section 9.1.3 of https://download.osgeo.org/mapserver/docs/MapServer-56.pdf
    const parts = parameters.crs.split(":");
    if (parts[0] === "EPSG" && parts.length === 2) {
      const code = Number(parts[1]);
      if (
        (code >= 4000 && code < 5000 && !excludesReverseAxis.includes(code)) ||
        includesReverseAxis.includes(code)
      ) {
        parameters.bbox =
          "{southProjected},{westProjected},{northProjected},{eastProjected}";
      }
    }
  } else {
    // SRS for WMS 1.1.0 or 1.1.1.
    parameters.srs =
      options.srs ??
      (options.tilingScheme &&
      options.tilingScheme.projection instanceof WebMercatorProjection
        ? "EPSG:3857"
        : "EPSG:4326");
  }

  resource.setQueryParameters(parameters, true);
  pickFeatureResource.setQueryParameters(parameters, true);

  const pickFeatureParams = {
    query_layers: options.layers,
    info_format: "{format}",
  };
  // use correct pixel coordinate identifier based on version
  if (parseFloat(pickFeatureResource.queryParameters.version) >= 1.3) {
    pickFeatureParams.i = "{i}";
    pickFeatureParams.j = "{j}";
  } else {
    pickFeatureParams.x = "{i}";
    pickFeatureParams.y = "{j}";
  }
  pickFeatureResource.setQueryParameters(pickFeatureParams, true);

  this._resource = resource;
  this._pickFeaturesResource = pickFeatureResource;
  this._layers = options.layers;

  // Let UrlTemplateImageryProvider do the actual URL building.
  this._tileProvider = new UrlTemplateImageryProvider({
    url: resource,
    pickFeaturesUrl: pickFeatureResource,
    tilingScheme:
      options.tilingScheme ??
      new GeographicTilingScheme({ ellipsoid: options.ellipsoid }),
    rectangle: options.rectangle,
    tileWidth: options.tileWidth,
    tileHeight: options.tileHeight,
    minimumLevel: options.minimumLevel,
    maximumLevel: options.maximumLevel,
    subdomains: options.subdomains,
    tileDiscardPolicy: options.tileDiscardPolicy,
    credit: options.credit,
    getFeatureInfoFormats:
      options.getFeatureInfoFormats ??
      WebMapServiceImageryProvider.DefaultGetFeatureInfoFormats,
    enablePickFeatures: options.enablePickFeatures,
  });
}

function requestImage(imageryProvider, col, row, level, request, interval) {
  const dynamicIntervalData = defined(interval) ? interval.data : undefined;
  const tileProvider = imageryProvider._tileProvider;

  if (defined(dynamicIntervalData)) {
    // We set the query parameters within the tile provider, because it is managing the query.
    tileProvider._resource.setQueryParameters(dynamicIntervalData);
  }
  return tileProvider.requestImage(col, row, level, request);
}

function pickFeatures(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  interval,
) {
  const dynamicIntervalData = defined(interval) ? interval.data : undefined;
  const tileProvider = imageryProvider._tileProvider;

  if (defined(dynamicIntervalData)) {
    // We set the query parameters within the tile provider, because it is managing the query.
    tileProvider._pickFeaturesResource.setQueryParameters(dynamicIntervalData);
  }
  return tileProvider.pickFeatures(x, y, level, longitude, latitude);
}

Object.defineProperties(WebMapServiceImageryProvider.prototype, {
  /**
   * 获取 WMS 服务器的 URL。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._resource._url;
    },
  },

  /**
   * 获取此提供器使用的代理。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return this._resource.proxy;
    },
  },

  /**
   * 获取由逗号分隔的 WMS 图层名称。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  layers: {
    get: function () {
      return this._layers;
    },
  },

  /**
   * 获取每个瓦片的像素宽度。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._tileProvider.tileWidth;
    },
  },

  /**
   * 获取每个瓦片的像素高度。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileHeight: {
    get: function () {
      return this._tileProvider.tileHeight;
    },
  },

  /**
   * 获取可请求的最大细节级别。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  maximumLevel: {
    get: function () {
      return this._tileProvider.maximumLevel;
    },
  },

  /**
   * 获取可请求的最小细节级别。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return this._tileProvider.minimumLevel;
    },
  },

  /**
   * 获取此提供器使用的瓦片方案。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tileProvider.tilingScheme;
    },
  },

  /**
   * 获取该实例提供的影像的弧度矩形区域。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._tileProvider.rectangle;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未未定义，则丢弃策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果此函数
   * 返回 undefined，则不会过滤任何瓦片。
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._tileProvider.tileDiscardPolicy;
    },
  },

  /**
   * 接收 {@link TileProviderError} 的实例。
   * 获取此影像提供器激活时显示的标识。通常用于标识影像的来源。
   * are passed an instance of {@link TileProviderError}.
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._tileProvider.errorEvent;
    },
  },

  /**
   * Gets the credit to display when this imagery provider is active.  Typically this is used to credit
   * the source of the imagery.
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._tileProvider.credit;
    },
  },

  /**
   * Gets a value indicating whether or not the images provided by this imagery provider
   * 包含 alpha 通道。如果此属性为 false，则存在的 alpha 通道将被忽略。
   * 如果此属性为 true，则没有 alpha 通道的图像将被视为其 alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少。
   * 用于指示是否启用特征选择。如果为 true，{@link WebMapServiceImageryProvider#pickFeatures} 将在 WMS 服务器上调用 <code>GetFeatureInfo</code> 服务，并尝试解析响应中的特征信息。
   * 如果为 false，则不会与服务器通信，{@link WebMapServiceImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选择的
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasAlphaChannel: {
    get: function () {
      return this._tileProvider.hasAlphaChannel;
    },
  },

  /**
   * 用于获取或设置是否启用特征选择。如果为 true，{@link WebMapServiceImageryProvider#pickFeatures} 将在 WMS 服务器上调用 <code>GetFeatureInfo</code> 服务，并尝试解析响应中的特征信息。
   * 如果为 false，则不会与服务器通信，{@link WebMapServiceImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选择的
   * {@link WebMapServiceImageryProvider#pickFeatures} will immediately return undefined (indicating no pickable
   * 用于获取时间动态参数所使用的时间的时钟。
   * 用于获取时间动态参数的时间间隔集合。每个 TimeInterval 都是一个包含在
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {boolean}
   * @default true
   */
  enablePickFeatures: {
    get: function () {
      return this._tileProvider.enablePickFeatures;
    },
    set: function (enablePickFeatures) {
      this._tileProvider.enablePickFeatures = enablePickFeatures;
    },
  },

  /**
   * 用于获取时间动态参数所使用的时间的时钟。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {Clock}
   */
  clock: {
    get: function () {
      return this._timeDynamicImagery.clock;
    },
    set: function (value) {
      this._timeDynamicImagery.clock = value;
    },
  },
  /**
   * 用于获取给定瓦片显示时应显示的徽章的集合。
   * TimeInterval 是一个对象，包含在瓦片请求过程中使用的属性键和值。
   * 用于获取 WMS 服务器的 getFeatureInfo URL。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {TimeIntervalCollection}
   */
  times: {
    get: function () {
      return this._timeDynamicImagery.times;
    },
    set: function (value) {
      this._timeDynamicImagery.times = value;
    },
  },

  /**
   * 用于获取 WMS 服务器中的 getFeatureInfo URL。
   * @memberof WebMapServiceImageryProvider.prototype
   * @type {Resource|string}
   * @readonly
   */
  getFeatureInfoUrl: {
    get: function () {
      return this._getFeatureInfoUrl;
    },
  },
});

/**
 * 用于获取给定瓦片显示时应显示的徽章。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级；
 * @returns {Credit[]} The 瓦片显示时应显示的徽章。
 */
WebMapServiceImageryProvider.prototype.getTileCredits = function (x, y, level) {
  return this._tileProvider.getTileCredits(x, y, level);
};

/**
 * 请求给定瓦片的图像。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像的承诺，当图像可用时将会解析，或者
 * 如果对服务器的活跃请求过多，则返回 undefined，该请求将在以后重试。
 */
WebMapServiceImageryProvider.prototype.requestImage = function (
  x,
  y,
  level,
  request,
) {
  let result;
  const timeDynamicImagery = this._timeDynamicImagery;
  let currentInterval;

  // Try and load from cache
  if (defined(timeDynamicImagery)) {
    currentInterval = timeDynamicImagery.currentInterval;
    result = timeDynamicImagery.getFromCache(x, y, level, request);
  }

  // Couldn't load from cache
  if (!defined(result)) {
    result = requestImage(this, x, y, level, request, currentInterval);
  }

  // If we are approaching an interval, preload this tile in the next interval
  if (defined(result) && defined(timeDynamicImagery)) {
    timeDynamicImagery.checkApproachingInterval(x, y, level, request);
  }

  return result;
};

/**
 * 异步确定在给定经度和纬度处是否存在特征。
 * 瓦片中的 X 坐标。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 选择特征的经度。
 * @param {number} latitude  选择特征的纬度。
 * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 异步完成后，所选特征的承诺将会解析。解析值是一个 {@link ImageryLayerFeatureInfo} 实例的数组。如果给定位置没有找到特征，则数组可能为空。
 *                   picking completes.  The resolved value is an array of {@link ImageryLayerFeatureInfo}
 * instances.  The array may be empty if no features are found at the given location.
 */
WebMapServiceImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  const timeDynamicImagery = this._timeDynamicImagery;
  const currentInterval = defined(timeDynamicImagery)
    ? timeDynamicImagery.currentInterval
    : undefined;

  return pickFeatures(this, x, y, level, longitude, latitude, currentInterval);
};

/**
 * The default parameters to include in the WMS URL to obtain images.  The values are as follows:
 * 服务=WMS
 * 版本=1.1.1
 * 请求=获取地图
 * 样式=
 * 格式=image/jpeg
 *
 * @constant
 * @type {object}
 */
WebMapServiceImageryProvider.DefaultParameters = Object.freeze({
  service: "WMS",
  version: "1.1.1",
  request: "GetMap",
  styles: "",
  format: "image/jpeg",
});

/**
 * 获取要素信息的WMS URL中应包含的默认参数。具体值如下：
 * 服务=WMS
 * 版本=1.1.1
 * 请求=获取要素信息
 *
 * @constant
 * @type {object}
 */
WebMapServiceImageryProvider.GetFeatureInfoDefaultParameters = Object.freeze({
  service: "WMS",
  version: "1.1.1",
  request: "GetFeatureInfo",
});

WebMapServiceImageryProvider.DefaultGetFeatureInfoFormats = Object.freeze([
  Object.freeze(new GetFeatureInfoFormat("json", "application/json")),
  Object.freeze(new GetFeatureInfoFormat("xml", "text/xml")),
  Object.freeze(new GetFeatureInfoFormat("text", "text/html")),
]);

function objectToLowercase(obj) {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key.toLowerCase()] = obj[key];
    }
  }
  return result;
}
export default WebMapServiceImageryProvider;