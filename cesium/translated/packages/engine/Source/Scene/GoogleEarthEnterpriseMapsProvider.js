import { Check, Event, Rectangle, RuntimeError, defined } from "@cesium/core";
import buildModuleUrl from "../Core/buildModuleUrl.js";
import Credit from "../Core/Credit.js";
import GeographicTilingScheme from "../Core/GeographicTilingScheme.js";
import Resource from "../Core/Resource.js";
import TileProviderError from "../Core/TileProviderError.js";
import WebMercatorTilingScheme from "../Core/WebMercatorTilingScheme.js";
import ImageryProvider from "./ImageryProvider.js";

/**
 * @typedef {object} GoogleEarthEnterpriseMapsProvider.ConstructorOptions
 *
 * GoogleEarthEnterpriseMapsProvider 构造器的初始化选项
 *
 * @property {number} channel 从服务器请求数据时使用的通道（id）。
 * 可以通过查看位于以下位置的 json 文件找到通道编号：
 * earth.localdomain/default_map/query?request=Json&vars=geeServerDefs The /default_map path may
 * 根据您的 Google Earth Enterprise 服务器配置有所不同。请寻找与
 * “ImageryMaps” requestType 相关联的“id”。可能有多于一个可用的 id。
 * 示例：
 *        {
 * layers: [
 *            {
 *              id: 1002,
 * requestType: "ImageryMaps"
 *            },
 *            {
 *              id: 1007,
 * requestType: "VectorMapsRaster"
 *            }
 *          ]
 *        }
 * @property {string} [path="/default_map"] 托管影像的 Google Earth 服务器路径。
 * @property {number} [maximumLevel] Google Earth
 * Enterprise 服务器支持的最大细节级别，或如果没有限制则定义为 undefined。
 * @property {TileDiscardPolicy} [tileDiscardPolicy] 决定哪些瓦片无效的策略
 * 并应被丢弃。为确保没有瓦片被丢弃，请为此参数构造并传递
 * 一个 {@link NeverTileDiscardPolicy}。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体。如果未指定，则使用默认椭球体。
 */

/**
 * 用于获取初始元数据时跟踪创建细节。
 *
 * @constructor
 * @private
 *
 * @param {GoogleEarthEnterpriseMapsProvider.ConstructorOptions} options 描述初始化选项的对象。
 */
function ImageryProviderBuilder(options) {
  this.channel = options.channel;
  this.ellipsoid = options.ellipsoid;
  this.tilingScheme = undefined;
  this.version = undefined;
}

/**
 * 基于 builder 值完成 GoogleEarthEnterpriseMapsProvider 的创建。
 *
 * @private
 *
 * @param {GoogleEarthEnterpriseMapsProvider} provider
 */
ImageryProviderBuilder.prototype.build = function (provider) {
  provider._channel = this.channel;
  provider._version = this.version;
  provider._tilingScheme = this.tilingScheme;
};

function metadataSuccess(text, imageryProviderBuilder) {
  let data;

  // The Google Earth server sends malformed JSON data currently...
  try {
    // First, try parsing it like normal in case a future version sends correctly formatted JSON
    data = JSON.parse(text);
  } catch (e) {
    // Quote object strings manually, then try parsing again
    data = JSON.parse(
      text.replace(/([\[\{,])[\n\r ]*([A-Za-z0-9]+)[\n\r ]*:/g, '$1"$2":'),
    );
  }

  let layer;
  for (let i = 0; i < data.layers.length; i++) {
    if (data.layers[i].id === imageryProviderBuilder.channel) {
      layer = data.layers[i];
      break;
    }
  }

  if (!defined(layer)) {
    const message = `Could not find layer with channel (id) of ${imageryProviderBuilder.channel}.`;
    throw new RuntimeError(message);
  }

  if (!defined(layer.version)) {
    const message = `Could not find a version in channel (id) ${imageryProviderBuilder.channel}.`;
    throw new RuntimeError(message);
  }

  imageryProviderBuilder.version = layer.version;

  if (defined(data.projection) && data.projection === "flat") {
    imageryProviderBuilder.tilingScheme = new GeographicTilingScheme({
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 2,
      rectangle: new Rectangle(-Math.PI, -Math.PI, Math.PI, Math.PI),
      ellipsoid: imageryProviderBuilder.ellipsoid,
    });
    // Default to mercator projection when projection is undefined
  } else if (!defined(data.projection) || data.projection === "mercator") {
    imageryProviderBuilder.tilingScheme = new WebMercatorTilingScheme({
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 2,
      ellipsoid: imageryProviderBuilder.ellipsoid,
    });
  } else {
    const message = `Unsupported projection ${data.projection}.`;
    throw new RuntimeError(message);
  }

  return true;
}

function metadataFailure(error, metadataResource, provider) {
  let message = `An error occurred while accessing ${metadataResource.url}.`;
  if (defined(error) && defined(error.message)) {
    message += `: ${error.message}`;
  }

  TileProviderError.reportError(
    undefined,
    provider,
    defined(provider) ? provider._errorEvent : undefined,
    message,
  );

  throw new RuntimeError(message);
}

async function requestMetadata(
  metadataResource,
  imageryProviderBuilder,
  provider,
) {
  try {
    const text = await metadataResource.fetchText();
    metadataSuccess(text, imageryProviderBuilder);
  } catch (error) {
    metadataFailure(error, metadataResource, provider);
  }
}

/**
 * <div class="notice">
 * 要构造 GoogleEarthEnterpriseMapsProvider，请调用 {@link GoogleEarthEnterpriseImageryProvider.fromUrl}。不要直接调用构造器。
 * </div>
 *
 * 使用 Google Earth 影像 API 提供瓦片式影像。
 *
 * 注意：此影像提供器不适用于公共 Google Earth 服务器。它适用于
 * Google Earth Enterprise 服务器。
 *
 * 默认情况下，Google Earth Enterprise 服务器不会设置
 * {@link http://www.w3.org/TR/cors/|Cross-Origin Resource Sharing} 头部。您可以使用
 * 代理服务器添加这些头部，或在 /opt/google/gehttpd/conf/gehttpd.conf 中
 * 并在 '&lt;Directory /&gt;' 和
 * '&lt;Directory "/opt/google/gehttpd/htdocs"&gt;' 指令中添加 'Header set Access-Control-Allow-Origin "*"' 选项。
 *
 * 此提供器用于与 Google Earth Enterprise 中的 2D Maps API 一起使用。对于 3D Earth API 的使用，需要
 * 使用 {@link GoogleEarthEnterpriseImageryProvider}。
 *
 * @alias GoogleEarthEnterpriseMapsProvider
 * @constructor
 *
 * @param {GoogleEarthEnterpriseMapsProvider.ConstructorOptions} options 描述初始化选项的对象。
 *
 * @exception {RuntimeError} Could 找不到通道（id）为 <code>options.channel</code> 的图层。
 * @exception {RuntimeError} Could 找不到通道（id）为 <code>options.channel</code> 的版本。
 * @exception {RuntimeError} Unsupported 投影 <code>data.projection</code>。
 *
 * @see ArcGisMapServerImageryProvider
 * @see BingMapsImageryProvider
 * @see OpenStreetMapImageryProvider
 * @see SingleTileImageryProvider
 * @see TileMapServiceImageryProvider
 * @see WebMapServiceImageryProvider
 * @see WebMapTileServiceImageryProvider
 * @see UrlTemplateImageryProvider
 *
 *
 * @example
 * const google = await Cesium.GoogleEarthEnterpriseMapsProvider.fromUrl("https://earth.localdomain", 1008);
 *
 * @see {@link http://www.w3.org/TR/cors/|Cross-Origin Resource Sharing}
 */
function GoogleEarthEnterpriseMapsProvider(options) {
  options = options ?? {};

  this._defaultAlpha = undefined;
  this._defaultNightAlpha = undefined;
  this._defaultDayAlpha = undefined;
  this._defaultBrightness = undefined;
  this._defaultContrast = undefined;
  this._defaultHue = undefined;
  this._defaultSaturation = undefined;
  this._defaultGamma = 1.9;
  this._defaultMinificationFilter = undefined;
  this._defaultMagnificationFilter = undefined;

  this._tileDiscardPolicy = options.tileDiscardPolicy;
  this._channel = options.channel;
  this._requestType = "ImageryMaps";
  this._credit = new Credit(
    `<a href="http://www.google.com/enterprise/mapsearth/products/earthenterprise.html"><img src="${GoogleEarthEnterpriseMapsProvider.logoUrl}" title="Google Imagery"/></a>`,
  );

  this._tilingScheme = undefined;

  this._version = undefined;

  this._tileWidth = 256;
  this._tileHeight = 256;
  this._maximumLevel = options.maximumLevel;

  this._errorEvent = new Event();
}

Object.defineProperties(GoogleEarthEnterpriseMapsProvider.prototype, {
  /**
   * 获取 Google Earth MapServer 的 URL。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._url;
    },
  },

  /**
   * 获取 Google Earth 服务器上数据的 url 路径。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {string}
   * @readonly
   */
  path: {
    get: function () {
      return this._path;
    },
  },

  /**
   * 获取该提供器使用的代理。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return this._resource.proxy;
    },
  },

  /**
   * 获取当前正在使用的影像通道（id）。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {number}
   * @readonly
   */
  channel: {
    get: function () {
      return this._channel;
    },
  },

  /**
   * 获取每个瓦片的宽度，单位：像素。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._tileWidth;
    },
  },

  /**
   * 获取每个瓦片的高度，单位：像素。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {number}
   * @readonly
   */
  tileHeight: {
    get: function () {
      return this._tileHeight;
    },
  },

  /**
   * 获取可请求的最大细节级别。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  maximumLevel: {
    get: function () {
      return this._maximumLevel;
    },
  },

  /**
   * 获取可请求的最小细节级别。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return 0;
    },
  },

  /**
   * 获取该提供器使用的镶嵌方案。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取该提供器使用的数据版本。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {number}
   * @readonly
   */
  version: {
    get: function () {
      return this._version;
    },
  },

  /**
   * 获取从提供器请求的数据类型。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {string}
   * @readonly
   */
  requestType: {
    get: function () {
      return this._requestType;
    },
  },
  /**
   * 获取该实例提供的影像的弧度范围。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._tilingScheme.rectangle;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未定义为 undefined，则丢弃策略通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数返回 undefined，则不会过滤任何瓦片。
   * 当影像提供器遇到异步错误时触发事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器接收 {@link TileProviderError} 的实例。
   * 获取此影像提供器激活时显示的致谢信息。通常用于显示影像的来源。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._tileDiscardPolicy;
    },
  },

  /**
   * 获取指示该影像提供器提供的图像是否包含 alpha 通道的值。如果此属性为 false，则存在的 alpha 通道将被忽略。如果此属性为 true，则没有 alpha 通道的任何图像将被视为其 alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少。
   * 使用 Google Earth 影像 API 创建镶嵌影像提供器。
   * are passed an instance of {@link TileProviderError}.
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 描述初始化选项的对象。
   * 创建的 GoogleEarthEnterpriseMapsProvider。
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 未找到通道（id）为 <code>options.channel</code> 的图层。
   * 未在通道（id）<code>options.channel</code>中找到版本。
   * 投影 <code>data.projection</code>。
   * const google = await Cesium.GoogleEarthEnterpriseMapsProvider.fromUrl("https://earth.localdomain", 1008);
   * and texture upload time are reduced.
   * @memberof GoogleEarthEnterpriseMapsProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasAlphaChannel: {
    get: function () {
      return true;
    },
  },
});

/**
 * Creates a tiled imagery provider using the Google Earth Imagery API.
 *
 * @param {Resource|string} url The url of the Google Earth server hosting the imagery.
 * @param {GoogleEarthEnterpriseMapsProvider.ConstructorOptions} [options] Object describing initialization options
 * @returns {Promise<GoogleEarthEnterpriseMapsProvider>} The created GoogleEarthEnterpriseMapsProvider.
 *
 * @exception {RuntimeError} Could not find layer with channel (id) of <code>options.channel</code>.
 * @exception {RuntimeError} Could not find a version in channel (id) <code>options.channel</code>.
 * @exception {RuntimeError} Unsupported projection <code>data.projection</code>.
 *
 * @example
 * const google = await Cesium.GoogleEarthEnterpriseMapsProvider.fromUrl("https://earth.localdomain", 1008);
 */
GoogleEarthEnterpriseMapsProvider.fromUrl = async function (
  url,
  channel,
  options,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  Check.defined("channel", channel);
  //>>includeEnd('debug');

  options = options ?? {};

  const path = options.path ?? "/default_map";

  const resource = Resource.createIfNeeded(url).getDerivedResource({
    // We used to just append path to url, so now that we do proper URI resolution, removed the /
    url: path[0] === "/" ? path.substring(1) : path,
  });

  resource.appendForwardSlash();

  const metadataResource = resource.getDerivedResource({
    url: "query",
    queryParameters: {
      request: "Json",
      vars: "geeServerDefs",
      is2d: "t",
    },
  });

  const imageryProviderBuilder = new ImageryProviderBuilder(options);
  imageryProviderBuilder.channel = channel;
  await requestMetadata(metadataResource, imageryProviderBuilder);

  const provider = new GoogleEarthEnterpriseMapsProvider(options);
  imageryProviderBuilder.build(provider);

  provider._resource = resource;
  provider._url = url;
  provider._path = path;

  return provider;
};

/**
 * 获取在显示特定瓦片时应显示的致谢信息。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级；
 * @returns {Credit[]} The 在显示瓦片时应显示的致谢信息。
 */
GoogleEarthEnterpriseMapsProvider.prototype.getTileCredits = function (
  x,
  y,
  level,
) {
  return undefined;
};

/**
 * 请求指定瓦片的图像。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像承诺：当图像可用时才会解析，或者
 * 如果向服务器发送的请求过多，则视为未定义，请求将在之后重试。
 */
GoogleEarthEnterpriseMapsProvider.prototype.requestImage = function (
  x,
  y,
  level,
  request,
) {
  const resource = this._resource.getDerivedResource({
    url: "query",
    request: request,
    queryParameters: {
      request: this._requestType,
      channel: this._channel,
      version: this._version,
      x: x,
      y: y,
      z: level + 1, // Google Earth starts with a zoom level of 1, not 0
    },
  });

  return ImageryProvider.loadImage(this, resource);
};

/**
 * 此影像提供商会不支持选择特征功能，因此该函数直接返回
 * 未定义。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 选择特征的经度。
 * @param {number} latitude  选择特征的纬度。
 * @return {undefined} Undefined 因为不支持选择功能。
 */
GoogleEarthEnterpriseMapsProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return undefined;
};

GoogleEarthEnterpriseMapsProvider._logoUrl = undefined;

Object.defineProperties(GoogleEarthEnterpriseMapsProvider, {
  /**
   * 获取或设置用于致谢信息中显示的 Google Earth 标志的 URL。
   * @memberof GoogleEarthEnterpriseMapsProvider
   * @type {string}
   */
  logoUrl: {
    get: function () {
      if (!defined(GoogleEarthEnterpriseMapsProvider._logoUrl)) {
        GoogleEarthEnterpriseMapsProvider._logoUrl = buildModuleUrl(
          "Assets/Images/google_earth_credit.png",
        );
      }
      return GoogleEarthEnterpriseMapsProvider._logoUrl;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.defined("value", value);
      //>>includeEnd('debug');

      GoogleEarthEnterpriseMapsProvider._logoUrl = value;
    },
  },
});
export default GoogleEarthEnterpriseMapsProvider;