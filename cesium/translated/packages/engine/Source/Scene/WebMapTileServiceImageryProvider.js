import { DeveloperError, Event, Frozen, combine, defined } from "@cesium/core";
import Resource from "../Core/Resource.js";
import WebMercatorTilingScheme from "../Core/WebMercatorTilingScheme.js";
import TimeDynamicImagery from "./TimeDynamicImagery.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";
import GetFeatureInfoFormat from "./GetFeatureInfoFormat.js";

/**
 * @typedef {object} WebMapTileServiceImageryProvider.ConstructorOptions
 *
 * WebMapTileServiceImageryProvider 构造函数的初始化选项
 *
 * @property {Resource|string} url WMTS GetTile 操作的基础 URL（针对 KVP 编码请求）或 tile-URL 模板（针对 RESTful 请求）。tile-URL 模板应包含以下变量：&#123;style&#125;、&#123;TileMatrixSet&#125;、&#123;TileMatrix&#125;、&#123;TileRow&#125;、&#123;TileCol&#125;。如果实际值已硬编码或服务器不需要，前两个为可选。&#123;s&#125; 关键字可用于指定子域。
 * @property {string} [format='image/jpeg'] 从服务器获取图像的 MIME 类型。
 * @property {string} layer WMTS 请求的图层名称。
 * @property {string} style WMTS 请求的样式名称。
 * @property {string} tileMatrixSetID 用于 WMTS 请求的 TileMatrixSet 标识符。
 * @property {boolean} [enablePickFeatures] 如果为 true，{@link WebMapTileServiceImageryProvider#pickFeatures} 将调用
 * WMTS 服务器上的 GetFeatureInfo 操作，并返回响应中包含的要素。如果为 false，
 * {@link WebMapTileServiceImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选取的要素）
 * 而不与服务器通信。如果知道您的 WMTS 服务器不支持
 * GetFeatureInfo，或者不希望此提供商的要素可选取，请将此属性设置为 false。
 * 对于 KVP 编码，默认为 true。对于 RESTful 编码，仅在
 * {@link WebMapTileServiceImageryProvider.ConstructorOptions#getFeatureInfoUrl} 被指定时默认为 true，否则为 false。
 * @property {object} [getFeatureInfoParameters] 包含在 GetFeatureInfo 请求中的附加参数。键在内部小写。
 * @property {Resource|string} [getFeatureInfoUrl] WMTS 服务的 GetFeatureInfo URL。如果未指定，则使用 <code>url</code> 的值。
 * @property {GetFeatureInfoFormat[]} [getFeatureInfoFormats=WebMapTileServiceImageryProvider.DefaultGetFeatureInfoFormats] 格式
 * 用于尝试 WMTS GetFeatureInfo 请求的格式。由于不同 WMTS 服务中的要素信息响应不同，
 * 您可能需要提供自定义格式和解析回调；请参阅
 * {@link https://sandcastle.cesium.com/?id=web-map-tile-service-picking|Sandcastle 示例} 以获取编写自定义回调的完整
 * 示例。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 图层所覆盖的矩形区域。
 * @property {TilingScheme} [tilingScheme] 与 TileMatrixSet 中图块组织相对应的平铺方案。
 * @property {Ellipsoid} [ellipsoid] 椭球体。如果未指定，则使用 WGS84 椭球体。
 * @property {number} [tileWidth=256] 图块的像素宽度。
 * @property {number} [tileHeight=256] 图块的像素高度。
 * @property {number} [minimumLevel=0] 影像提供器支持的最小细节级别。
 * @property {number} [maximumLevel] 影像提供器支持的最大细节级别，如果没有限制则定义为 undefined。
 * @property {Array} [tileMatrixLabels] 用于 WMTS 请求的 TileMatrix 中标识符列表，每个标识符对应一个 TileMatrix 级别。
 * @property {Credit|string} [credit] 在画布上显示的数据源标签。
 * @property {string|string[]} [subdomains='abc'] 在 URL 模板中的 `{s}` 占位符使用的子域。
 * 如果此参数为单个字符串，则字符串中的每个字符都是一个子域。如果它是
 * 一个数组，则数组中的每个元素都是一个子域。
 * @property {Clock} [clock] 用于确定时间维度值的 Clock 实例。当指定 `times` 时必需。
 * @property {TimeIntervalCollection} [times] 包含时间动态维度及其值的对象的 TimeIntervalCollection 的 <code>data</code> 属性。
 * @property {object} [dimensions] 包含静态维度及其值的对象。
 */

/**
 * 提供由符合 {@link http://www.opengeospatial.org/standards/wmts|WMTS 1.0.0} 标准的服务器提供的瓦片式影像。
 * 此提供器支持 HTTP KVP 编码和 RESTful GetTile 请求，但目前不支持 SOAP 编码。
 *
 * @alias WebMapTileServiceImageryProvider
 * @constructor
 *
 * @param {WebMapTileServiceImageryProvider.ConstructorOptions} options 描述初始化选项的对象。
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=web-map-tile-service-with-time|Cesium Sandcastle Web Map Tile Service with Time Demo}
 *
 * @example
 * // 示例 1. USGS 阴影地形瓦片（KVP）
 * const shadedRelief1 = new Cesium.WebMapTileServiceImageryProvider({
 * url : 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/WMTS',
 * layer : 'USGSShadedReliefOnly',
 * style : 'default',
 * format : 'image/jpeg',
 * tileMatrixSetID : 'default028mm',
 * // tileMatrixLabels : ['default028mm:0', 'default028mm:1', 'default028mm:2' ...],
 * maximumLevel: 19,
 * credit : new Cesium.Credit('U. S. Geological Survey')
 * });
 * viewer.imageryLayers.addImageryProvider(shadedRelief1);
 *
 * @example
 * // 示例 2. USGS 阴影地形瓦片（RESTful）
 * const shadedRelief2 = new Cesium.WebMapTileServiceImageryProvider({
 * url : 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/WMTS/tile/1.0.0/USGSShadedReliefOnly/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg',
 * layer : 'USGSShadedReliefOnly',
 * style : 'default',
 * format : 'image/jpeg',
 * tileMatrixSetID : 'default028mm',
 * maximumLevel: 19,
 * credit : new Cesium.Credit('U. S. Geological Survey')
 * });
 * viewer.imageryLayers.addImageryProvider(shadedRelief2);
 *
 * @example
 * // 示例 3：NASA 时间动态积雪数据（RESTful）
 * // 根据 capabilities XML 定义该图层的时间间隔
 * const times = Cesium.TimeIntervalCollection.fromIso8601({
 * iso8601: '2025-01-01/2025-09-01/P5D', // 使用 Dimension 部分中有效的间隔
 * dataCallback: function(interval, index) {
 * // 返回一个包含 URL 模板中使用的 Time 变量的对象
 * return {
 * Time: Cesium.JulianDate.toIso8601(interval.start, 0)
 *       };
 *   }
 * });

 * // 获取内部时钟，设置期望的起始时间、停止时间和乘数
 * const clock = viewer.clock;
 * clock.startTime = Cesium.JulianDate.fromIso8601('2025-01-01');
 * clock.currentTime = Cesium.JulianDate.fromIso8601('2025-01-01');
 * clock.stopTime = Cesium.JulianDate.fromIso8601('2025-09-01');
 * clock.clockRange = Cesium.ClockRange.LOOP_STOP;
 * clock.multiplier = 1; // 每秒 1 天
 * clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
 *
 * viewer.timeline.zoomTo(clock.startTime, clock.stopTime);
 *
 * const weather = new Cesium.WebMapTileServiceImageryProvider({
 * url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/AMSRU2_Snow_Water_Equivalent_5Day/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png',
 * layer: 'AMSRU2_Snow_Water_Equivalent_5Day',
 * style: 'default',
 * tileMatrixSetID: 'GoogleMapsCompatible_Level6',
 * format: 'image/png',
 * clock: clock,
 * times: times,
 * credit: new Cesium.Credit('NASA Global Imagery Browse Services for EOSDIS')
 * });
 * viewer.imageryLayers.addImageryProvider(weather);
 *
 * @example
 * // 示例 4. 支持 GetFeatureInfo 的非洲数字地球水体（RESTful）
 * const waterbodies = new Cesium.WebMapTileServiceImageryProvider({
 * url: "https://geoserver.digitalearth.africa/geoserver/gwc/service/wmts/rest/{layer}/{style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}?format={format}",
 * layer: "waterbodies:DEAfrica_Waterbodies",
 * style: "waterbodies:waterbodies_v0_0_4",
 * tileMatrixSetID: "EPSG:3857",
 * tileMatrixLabels: [
 * "EPSG:3857:0",
 * "EPSG:3857:1",
 * "EPSG:3857:2",
 * "EPSG:3857:3",
 * "EPSG:3857:4",
 * "EPSG:3857:5",
 * "EPSG:3857:6",
 * "EPSG:3857:7",
 * "EPSG:3857:8",
 * "EPSG:3857:9",
 * "EPSG:3857:10",
 * "EPSG:3857:11",
 * "EPSG:3857:12",
 * "EPSG:3857:13",
 * "EPSG:3857:14",
 * "EPSG:3857:15",
 * "EPSG:3857:16",
 * "EPSG:3857:17",
 * "EPSG:3857:18",
 * "EPSG:3857:19",
 * "EPSG:3857:20",
 * "EPSG:3857:21",
 * "EPSG:3857:22",
 * "EPSG:3857:23",
 * "EPSG:3857:24",
 * "EPSG:3857:25",
 * "EPSG:3857:26",
 * "EPSG:3857:27",
 * "EPSG:3857:28",
 * "EPSG:3857:29",
 * "EPSG:3857:30",
 *    ],
 * format: "image/png",
 * enablePickFeatures: true,
 * getFeatureInfoUrl: "https://geoserver.digitalearth.africa/geoserver/gwc/service/wmts/rest/{layer}/{style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}/{j}/{i}?format={format}",
 * });
 *
 * viewer.imageryLayers.addImageryProvider(waterbodies);
 *
 * @see ArcGisMapServerImageryProvider
 * @see BingMapsImageryProvider
 * @see GoogleEarthEnterpriseMapsProvider
 * @see OpenStreetMapImageryProvider
 * @see SingleTileImageryProvider
 * @see TileMapServiceImageryProvider
 * @see WebMapServiceImageryProvider
 * @see UrlTemplateImageryProvider
 * 
 * @see {@link https://sandcastle.cesium.com/?id=web-map-tile-service-picking|Custom GetFeatureInfo Sandcastle Example}
 */
function WebMapTileServiceImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(options.url)) {
    throw new DeveloperError("options.url is required.");
  }
  if (!defined(options.layer)) {
    throw new DeveloperError("options.layer is required.");
  }
  if (!defined(options.style)) {
    throw new DeveloperError("options.style is required.");
  }
  if (!defined(options.tileMatrixSetID)) {
    throw new DeveloperError("options.tileMatrixSetID is required.");
  }
  if (defined(options.times) && !defined(options.clock)) {
    throw new DeveloperError(
      "options.times was specified, so options.clock is required.",
    );
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

  this._getFeatureInfoUrl = options.getFeatureInfoUrl ?? options.url;

  const resource = Resource.createIfNeeded(options.url);
  const pickFeatureResource = Resource.createIfNeeded(this._getFeatureInfoUrl);

  const style = options.style;
  const tileMatrixSetID = options.tileMatrixSetID;
  const url = resource.url;
  const format = options.format ?? "image/jpeg";

  const bracketMatch = url.match(/{/g);
  if (
    !defined(bracketMatch) ||
    (bracketMatch.length === 1 && /{s}/.test(url))
  ) {
    resource.setQueryParameters(
      WebMapTileServiceImageryProvider.DefaultParameters,
      true,
    );
    this._useKvp = true;
  } else {
    resource.setTemplateValues(
      WebMapTileServiceImageryProvider.DefaultParameters,
      true,
    );
    this._useKvp = false;
  }

  if (this._useKvp) {
    pickFeatureResource.setQueryParameters(
      WebMapTileServiceImageryProvider.GetFeatureInfoDefaultParameters,
      true,
    );

    if (defined(options.getFeatureInfoParameters)) {
      pickFeatureResource.setQueryParameters(
        objectToLowercase(options.getFeatureInfoParameters),
      );
    }

    const pickFeatureParams = {
      infoformat: "{format}",
      i: "{i}",
      j: "{j}",
    };
    pickFeatureResource.setQueryParameters(pickFeatureParams, true);
  } else {
    pickFeatureResource.setTemplateValues(
      WebMapTileServiceImageryProvider.GetFeatureInfoDefaultParameters,
      true,
    );

    if (defined(options.getFeatureInfoParameters)) {
      pickFeatureResource.setTemplateValues(
        objectToLowercase(options.getFeatureInfoParameters),
      );
    }
  }

  this._resource = resource;
  this._tileMatrixLabels = options.tileMatrixLabels;
  this._format = format;
  this._dimensions = options.dimensions;
  this._tilematrixset = tileMatrixSetID;

  const parameters = {};
  parameters.tilematrix = "{TileMatrix}";
  parameters.layer = options.layer;
  parameters.style = style;
  parameters.tilerow = "{TileRow}";
  parameters.tilecol = "{TileCol}";
  parameters.tilematrixset = tileMatrixSetID;

  if (this._useKvp) {
    resource.setQueryParameters(parameters, true);
    resource.setQueryParameters({ format: format }, true);
    pickFeatureResource.setQueryParameters({ format: format }, true);
    pickFeatureResource.setQueryParameters(parameters, true);
  } else {
    parameters.Style = style;
    resource.setTemplateValues(parameters);
    resource.setTemplateValues({ format: format });
    pickFeatureResource.setTemplateValues(parameters);
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

  this._errorEvent = new Event();

  // Let UrlTemplateImageryProvider do the actual URL building.
  this._tileProvider = new UrlTemplateImageryProvider({
    url: resource,
    pickFeaturesUrl: pickFeatureResource,
    tilingScheme:
      options.tilingScheme ??
      new WebMercatorTilingScheme({ ellipsoid: options.ellipsoid }),
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
      WebMapTileServiceImageryProvider.DefaultGetFeatureInfoFormats,
    enablePickFeatures:
      options.enablePickFeatures ??
      (this._useKvp || defined(options.getFeatureInfoUrl)),
    customTags: createCustomTags(this),
  });
}

function requestImage(imageryProvider, col, row, level, request, interval) {
  const tileProvider = imageryProvider._tileProvider;

  applyDimensions(imageryProvider, tileProvider._resource, interval);

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
  const tileProvider = imageryProvider._tileProvider;

  applyDimensions(
    imageryProvider,
    tileProvider._pickFeaturesResource,
    interval,
  );

  return tileProvider.pickFeatures(x, y, level, longitude, latitude);
}

Object.defineProperties(WebMapTileServiceImageryProvider.prototype, {
  /**
   * 获取托管影像的服务 URL。
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._resource.url;
    },
  },

  /**
   * 获取该提供器使用的代理。
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return this._resource.proxy;
    },
  },

  /**
   * 获取每个瓦片的宽度，单位：像素。
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._tileProvider.tileWidth;
    },
  },

  /**
   * 获取每个瓦片的高度，单位：像素。
   * @memberof WebMapTileServiceImageryProvider.prototype
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
   * @memberof WebMapTileServiceImageryProvider.prototype
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
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return this._tileProvider.minimumLevel;
    },
  },

  /**
   * 获取该提供器使用的瓦片方案。
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tileProvider.tilingScheme;
    },
  },

  /**
   * 获取该实例提供的影像的矩形范围，单位：弧度。
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._tileProvider.rectangle;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未定义为 undefined，则丢弃策略通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数返回 undefined，则不会过滤任何瓦片。
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您可以收到错误通知并可能进行恢复。事件监听器接收的是 {@link TileProviderError} 的实例。
   * 获取该影像提供器返回的图片的 MIME 类型。
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._tileProvider.tileDiscardPolicy;
    },
  },

  /**
   * 获取该影像提供器激活时显示的信用信息。通常用于显示影像的来源。
   * 获取指示该影像提供器提供的图片是否包含 Alpha 通道的值。如果此属性为 false，则存在的 Alpha 通道将被忽略。如果此属性为 true，则没有 Alpha 通道的图片将被视为其 Alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少。
   * 获取或设置是否启用特征选择功能的值。如果为 true，{@link WebMapTileServiceImageryProvider#pickFeatures} 将在 WMTS 服务器上调用 <code>GetFeatureInfo</code> 服务，并尝试解析响应中的特征信息。如果为 false，{@link WebMapTileServiceImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选择的
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._tileProvider.errorEvent;
    },
  },

  /**
   * 特征），而无需与服务器通信。如果知道数据来源不支持特征选择，或者不希望该提供器的特征可选择，请将此属性设置为 false。
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  format: {
    get: function () {
      return this._format;
    },
  },

  /**
   * KVP 编码的默认值为 true。对于 RESTful 编码，仅在指定了 {@link WebMapTileServiceImageryProvider.ConstructorOptions#getFeatureInfoUrl} 时才为 true，否则为 false。
   * the source of the imagery.
   * @memberof WebMapTileServiceImageryProvider.prototype
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
   * include an alpha channel.  If this property is false, an alpha channel, if present, will
   * be ignored.  If this property is true, any images without an alpha channel will be treated
   * as if their alpha is 1.0 everywhere.  When this property is false, memory usage
   * and texture upload time are reduced.
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasAlphaChannel: {
    get: function () {
      return true;
    },
  },

  /**
   * Gets or sets a value indicating whether feature picking is enabled.  If true, {@link WebMapTileServiceImageryProvider#pickFeatures} will
   * invoke the <code>GetFeatureInfo</code> service on the WMTS server and attempt to interpret the features included in the response.  If false,
   * {@link WebMapTileServiceImageryProvider#pickFeatures} will immediately return undefined (indicating no pickable
   * features) without communicating with the server.  Set this property to false if you know your data
   * source does not support picking features or if you don't want this provider's features to be pickable.
   * Defaults to true for KVP encoding. For RESTful encoding, defaults to true only when
   * {@link WebMapTileServiceImageryProvider.ConstructorOptions#getFeatureInfoUrl} is specified, and false otherwise.
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {boolean}
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
   * 用于获取时间动态参数所使用的时间时钟。
   * @memberof WebMapTileServiceImageryProvider.prototype
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
   * 用于获取时间动态参数的时间间隔集合。每个
   * TimeInterval 是一个包含在
   * 瓦片请求过程中使用的属性键和值的对象。
   * @memberof WebMapTileServiceImageryProvider.prototype
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
   * 包含静态尺寸及其值的对象。
   * @memberof WebMapTileServiceImageryProvider.prototype
   * @type {object}
   */
  dimensions: {
    get: function () {
      return this._dimensions;
    },
    set: function (value) {
      if (this._dimensions !== value) {
        this._dimensions = value;
        if (defined(this._reload)) {
          this._reload();
        }
      }
    },
  },

  /**
   * 获取 WMTS 服务器的 getFeatureInfo URL。
   * @memberof WebMapTileServiceImageryProvider.prototype
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
 * 当显示特定瓦片时显示的致谢信息。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级；
 * @returns {Credit[]} The 当显示瓦片时显示的致谢信息。
 */
WebMapTileServiceImageryProvider.prototype.getTileCredits = function (
  x,
  y,
  level,
) {
  return this._tileProvider.getTileCredits(x, y, level);
};

/**
 * 请求特定瓦片的图像。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像在可用时将解析的承诺，或者
 * 如果对服务器的活跃请求过多，则视为未定义，请求将在之后重试。
 */
WebMapTileServiceImageryProvider.prototype.requestImage = function (
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
 * 异步确定在给定经度和纬度范围内
 * 瓦片中是否存在任何特征。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 选择特征的经度。
 * @param {number} latitude  选择特征的纬度。
 * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 所选特征的承诺，将在异步
 * 选择完成时解析。解析值是一个 {@link ImageryLayerFeatureInfo} 实例数组。如果给定位置没有找到特征，则数组可能为空。
 * 的数组。如果给定位置没有发现特征，则数组可能为空。
 */
WebMapTileServiceImageryProvider.prototype.pickFeatures = function (
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
 * 用于获取图像时 WMTS URL 中应包含的默认参数。值如下：
 * service=WMTS
 * version=1.0.0
 * request=GetTile
 *
 * @constant
 * @type {object}
 */
WebMapTileServiceImageryProvider.DefaultParameters = Object.freeze({
  service: "WMTS",
  version: "1.0.0",
  request: "GetTile",
});

/**
 * 用于获取特征信息时 WMTS URL 中应包含的默认参数。值如下：
 * service=WMTS
 * version=1.0.0
 * request=GetFeatureInfo
 *
 * @constant
 * @type {object}
 */
WebMapTileServiceImageryProvider.GetFeatureInfoDefaultParameters =
  Object.freeze({
    service: "WMTS",
    version: "1.0.0",
    request: "GetFeatureInfo",
  });

WebMapTileServiceImageryProvider.DefaultGetFeatureInfoFormats = Object.freeze([
  Object.freeze(new GetFeatureInfoFormat("json", "application/json")),
  Object.freeze(new GetFeatureInfoFormat("xml", "text/xml")),
  Object.freeze(new GetFeatureInfoFormat("text", "text/html")),
]);

function applyDimensions(imageryProvider, resource, interval) {
  const staticDimensions = imageryProvider._dimensions;
  const dynamicIntervalData = defined(interval) ? interval.data : undefined;

  if (!imageryProvider._useKvp) {
    if (defined(staticDimensions)) {
      resource.setTemplateValues(staticDimensions);
    }

    if (defined(dynamicIntervalData)) {
      resource.setTemplateValues(dynamicIntervalData);
    }
  } else {
    // build KVP request
    let query = {};

    if (defined(staticDimensions)) {
      query = combine(query, staticDimensions);
    }

    if (defined(dynamicIntervalData)) {
      query = combine(query, dynamicIntervalData);
    }

    resource.setQueryParameters(query);
  }
}

function createCustomTags(imageryProvider) {
  function getTileMatrix(level) {
    const labels = imageryProvider._tileMatrixLabels;
    return defined(labels) ? labels[level] : level.toString();
  }

  // We provide both uppercase and lowercase to make it more convenient for users when creating URL templates.
  return {
    TileMatrix: function (provider, x, y, level) {
      return getTileMatrix(level);
    },
    tilematrix: function (provider, x, y, level) {
      return getTileMatrix(level);
    },
    TileRow: function (provider, x, y) {
      return y.toString();
    },
    tilerow: function (provider, x, y) {
      return y.toString();
    },
    TileCol: function (provider, x, y) {
      return x.toString();
    },
    tilecol: function (provider, x, y) {
      return x.toString();
    },
    TileMatrixSet: function (provider) {
      return imageryProvider._tilematrixset;
    },
    tilematrixset: function (provider) {
      return imageryProvider._tilematrixset;
    },
  };
}

function objectToLowercase(obj) {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key.toLowerCase()] = obj[key];
    }
  }
  return result;
}

export default WebMapTileServiceImageryProvider;
