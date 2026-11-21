import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Check,
  DeveloperError,
  Event,
  Frozen,
  GeographicProjection,
  Math as CesiumMath,
  Rectangle,
  RuntimeError,
  WebMercatorProjection,
  defined,
} from "@cesium/core";
import Credit from "../Core/Credit.js";
import GeographicTilingScheme from "../Core/GeographicTilingScheme.js";
import Resource from "../Core/Resource.js";
import WebMercatorTilingScheme from "../Core/WebMercatorTilingScheme.js";
import ArcGisMapService from "./ArcGisMapService.js";
import DiscardMissingTileImagePolicy from "./DiscardMissingTileImagePolicy.js";
import ImageryLayerFeatureInfo from "./ImageryLayerFeatureInfo.js";
import ImageryProvider from "./ImageryProvider.js";
import ArcGisBaseMapType from "./ArcGisBaseMapType.js";

/**
 * @typedef {object} ArcGisMapServerImageryProvider.ConstructorOptions
 *
 * ArcGisMapServerImageryProvider构造函数的初始化选项
 *
 * @property {TileDiscardPolicy} [tileDiscardPolicy] 决定是否丢弃无效图块的策略
 * 如果未指定该值，则使用默认策略
 * {@link DiscardMissingTileImagePolicy} 用于瓦片地图服务器，而
 * {@link NeverTileDiscardPolicy} 用于非瓦片地图服务器。在前者情况下，
 * 我们请求最大图块级别的0,0图块，并检查像素 (0,0)、(200,20)、(20,200)、
 * (80,110) 和 (160, 130)。如果所有这些像素都是透明的，则丢弃检查被禁用，不会丢弃任何图块。如果其中任何一个像素有非透明颜色，则所有
 * disabled and no tiles are discarded.  If any of them have a non-transparent color, any
 * 在这些像素位置具有相同值的图块都会被丢弃。这些默认设置的最终结果应为标准 ArcGIS Server 的正确图块丢弃。为了确保
 * these defaults should be correct tile discarding for a standard ArcGIS Server.  To ensure
 * 不会丢弃任何图块，请为此参数构造并传递 {@link NeverTileDiscardPolicy}。
 * 如果为true，则使用服务器预缓存的图块（如果可用）。导出图块仅支持已废弃的API。
 * @property {boolean} [usePreCachedTilesIfAvailable=true] 要显示的图层逗号分隔列表，或未定义表示所有图层都应显示。
 * 如果为true，{@link ArcGisMapServerImageryProvider#pickFeatures} 将调用 MapServer上的 Identify服务并返回响应中的特征。如果为false，
 * @property {string} [layers] {@link ArcGisMapServerImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选择的特征），而不与服务器通信。如果不需要此提供程序的特征可选择，请将此属性设置为 false。可以通过在对象上设置 {@link ArcGisMapServerImageryProvider#enablePickFeatures} 属性来覆盖此设置。
 * @property {boolean} [enablePickFeatures=true] If true, {@link ArcGisMapServerImageryProvider#pickFeatures} will invoke
 * 用于将世界划分为图块的镶嵌方案。
 *        {@link ArcGisMapServerImageryProvider#pickFeatures} will immediately return undefined (indicating no pickable features)
 * 椭球体。如果指定了镶嵌方案并使用了它，
 *        be pickable. Can be overridden by setting the {@link ArcGisMapServerImageryProvider#enablePickFeatures} property on the object.
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 数据源的版权信息，在画布上显示。当访问瓦片服务器时，此参数被忽略。
 * 每个图块的宽度（以像素为单位）。当访问瓦片服务器时，此参数被忽略。
 * @property {TilingScheme} [tilingScheme=new GeographicTilingScheme()] The tiling scheme to use to divide the world into tiles.
 * This parameter is ignored when accessing a tiled server.
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] The ellipsoid.  If the tilingScheme is specified and used,
 * this parameter is ignored and the tiling scheme's ellipsoid is used instead. If neither
 * parameter is specified, the default ellipsoid is used.
 * @property {Credit|string} [credit] A credit for the data source, which is displayed on the canvas.  This parameter is ignored when accessing a tiled server.
 * @property {number} [tileWidth=256] The width of each tile in pixels.  This parameter is ignored when accessing a tiled server.
 * @property {number} [tileHeight=256] 每个瓦片的高度，以像素为单位。访问瓦片服务器时此参数被忽略。
 * @property {number} [maximumLevel] 请求的最大瓦片级别，如果没有最大级别则定义为未定义。访问瓦片服务器时此参数被忽略。
 * 瓦片服务器。
 *
 *
 */

/**
 * 用于获取初始元数据时跟踪创建细节。
 *
 * @constructor
 * @private
 *
 * @param {ArcGisMapServerImageryProvider.ConstructorOptions} options 描述初始化选项的对象。
 */
function ImageryProviderBuilder(options) {
  this.useTiles = options.usePreCachedTilesIfAvailable ?? true;

  const ellipsoid = options.ellipsoid;
  this.tilingScheme =
    options.tilingScheme ??
    new GeographicTilingScheme({ ellipsoid: ellipsoid });
  this.rectangle = options.rectangle ?? this.tilingScheme.rectangle;
  this.ellipsoid = ellipsoid;

  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this.credit = credit;
  this.tileCredits = undefined;
  this.tileDiscardPolicy = options.tileDiscardPolicy;

  this.tileWidth = options.tileWidth ?? 256;
  this.tileHeight = options.tileHeight ?? 256;
  this.maximumLevel = options.maximumLevel;
}

/**
 * 根据构建器值完成 ArcGisMapServerImageryProvider 的创建。
 *
 * @private
 *
 * @param {ArcGisMapServerImageryProvider} provider
 */
ImageryProviderBuilder.prototype.build = function (provider) {
  provider._useTiles = this.useTiles;
  provider._tilingScheme = this.tilingScheme;
  provider._rectangle = this.rectangle;
  provider._credit = this.credit;
  provider._tileCredits = this.tileCredits;
  provider._tileDiscardPolicy = this.tileDiscardPolicy;
  provider._tileWidth = this.tileWidth;
  provider._tileHeight = this.tileHeight;
  provider._maximumLevel = this.maximumLevel;

  // Install the default tile discard policy if none has been supplied.
  if (this.useTiles && !defined(this.tileDiscardPolicy)) {
    provider._tileDiscardPolicy = new DiscardMissingTileImagePolicy({
      missingImageUrl: buildImageResource(provider, 0, 0, this.maximumLevel)
        .url,
      pixelsToCheck: [
        new Cartesian2(0, 0),
        new Cartesian2(200, 20),
        new Cartesian2(20, 200),
        new Cartesian2(80, 110),
        new Cartesian2(160, 130),
      ],
      disableCheckIfAllPixelsAreTransparent: true,
    });
  }
};

function metadataSuccess(data, imageryProviderBuilder) {
  const tileInfo = data.tileInfo;
  if (!defined(tileInfo)) {
    imageryProviderBuilder.useTiles = false;
  } else {
    imageryProviderBuilder.tileWidth = tileInfo.rows;
    imageryProviderBuilder.tileHeight = tileInfo.cols;

    if (
      tileInfo.spatialReference.wkid === 102100 ||
      tileInfo.spatialReference.wkid === 102113
    ) {
      imageryProviderBuilder.tilingScheme = new WebMercatorTilingScheme({
        ellipsoid: imageryProviderBuilder.ellipsoid,
      });
    } else if (data.tileInfo.spatialReference.wkid === 4326) {
      imageryProviderBuilder.tilingScheme = new GeographicTilingScheme({
        ellipsoid: imageryProviderBuilder.ellipsoid,
      });
    } else {
      const message = `Tile spatial reference WKID ${data.tileInfo.spatialReference.wkid} is not supported.`;
      throw new RuntimeError(message);
    }
    imageryProviderBuilder.maximumLevel = data.tileInfo.lods.length - 1;

    if (defined(data.fullExtent)) {
      if (
        defined(data.fullExtent.spatialReference) &&
        defined(data.fullExtent.spatialReference.wkid)
      ) {
        if (
          data.fullExtent.spatialReference.wkid === 102100 ||
          data.fullExtent.spatialReference.wkid === 102113
        ) {
          const projection = new WebMercatorProjection();
          const extent = data.fullExtent;
          const sw = projection.unproject(
            new Cartesian3(
              Math.max(
                extent.xmin,
                -imageryProviderBuilder.tilingScheme.ellipsoid.maximumRadius *
                  Math.PI,
              ),
              Math.max(
                extent.ymin,
                -imageryProviderBuilder.tilingScheme.ellipsoid.maximumRadius *
                  Math.PI,
              ),
              0.0,
            ),
          );
          const ne = projection.unproject(
            new Cartesian3(
              Math.min(
                extent.xmax,
                imageryProviderBuilder.tilingScheme.ellipsoid.maximumRadius *
                  Math.PI,
              ),
              Math.min(
                extent.ymax,
                imageryProviderBuilder.tilingScheme.ellipsoid.maximumRadius *
                  Math.PI,
              ),
              0.0,
            ),
          );
          imageryProviderBuilder.rectangle = new Rectangle(
            sw.longitude,
            sw.latitude,
            ne.longitude,
            ne.latitude,
          );
        } else if (data.fullExtent.spatialReference.wkid === 4326) {
          imageryProviderBuilder.rectangle = Rectangle.fromDegrees(
            data.fullExtent.xmin,
            data.fullExtent.ymin,
            data.fullExtent.xmax,
            data.fullExtent.ymax,
          );
        } else {
          const extentMessage = `fullExtent.spatialReference WKID ${data.fullExtent.spatialReference.wkid} is not supported.`;
          throw new RuntimeError(extentMessage);
        }
      }
    } else {
      imageryProviderBuilder.rectangle =
        imageryProviderBuilder.tilingScheme.rectangle;
    }

    imageryProviderBuilder.useTiles = true;
  }

  if (defined(data.copyrightText) && data.copyrightText.length > 0) {
    if (defined(imageryProviderBuilder.credit)) {
      imageryProviderBuilder.tileCredits = [new Credit(data.copyrightText)];
    } else {
      imageryProviderBuilder.credit = new Credit(data.copyrightText);
    }
  }
}

function metadataFailure(resource, error) {
  let message = `An error occurred while accessing ${resource.url}`;
  if (defined(error) && defined(error.message)) {
    message += `: ${error.message}`;
  }

  throw new RuntimeError(message);
}

async function requestMetadata(resource, imageryProviderBuilder) {
  const jsonResource = resource.getDerivedResource({
    queryParameters: {
      f: "json",
    },
  });

  try {
    const data = await jsonResource.fetchJson();
    metadataSuccess(data, imageryProviderBuilder);
  } catch (error) {
    metadataFailure(resource, error);
  }
}

/**
 * <div class="notice">
 * 通常不直接实例化此对象，应使用 {@link ArcGisMapServerImageryProvider.fromBasemapType} 或 {@link ArcGisMapServerImageryProvider.fromUrl}。
 * </div>
 *
 * 提供由 ArcGIS MapServer 托管的瓦片影像。默认情况下，如果可用，将使用服务器预缓存的瓦片。
 * 需要一个 {@link https://developers.arcgis.com/documentation/mapping-apis-and-services/security| ArcGIS 访问令牌} 来认证对 ArcGIS Image Tile 服务的请求。
 *
 * <br/>
 *
 * An {@link https://developers.arcgis.com/documentation/mapping-apis-and-services/security| ArcGIS Access Token } is required to authenticate requests to an ArcGIS Image Tile service.
 * 为了访问安全的 ArcGIS 资源，需要创建一个 ArcGIS 开发者账户或 ArcGIS online 账户，然后实现认证方法以获取访问令牌。
 * 描述初始化选项的对象。
 *
 * @alias ArcGisMapServerImageryProvider
 * @constructor
 *
 * @param {ArcGisMapServerImageryProvider.ConstructorOptions} [options] // 设置访问 ArcGIS Image Tile 服务的默认访问令牌
 *
 * @see ArcGisMapServerImageryProvider.fromBasemapType
 * @see ArcGisMapServerImageryProvider.fromUrl
 *
 * @example
 * Cesium.ArcGisMapService.defaultAccessToken = "<ArcGIS Access Token>";
 * // 从默认的 ArcGIS 底图添加底层图层
 *
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * baseLayer: Cesium.ImageryLayer.fromProviderAsync(
 * baseLayer: Cesium.ImageryLayer.fromProviderAsync(
 * Cesium.ArcGisMapServerImageryProvider.fromBasemapType(
 * Cesium.ArcGisBaseMapType.SATELLITE
 *     )
 *   ),
 * });
 *
 * @example
 * // 直接从 URL 创建影像提供器
 * const esri = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
 * "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer", {
 * token: "<ArcGIS Access Token>"
 * });
 *
 * @see {@link https://developers.arcgis.com/rest/|ArcGIS Server REST API}
 * @see {@link https://developers.arcgis.com/documentation/mapping-apis-and-services/security| ArcGIS Access Token }

 */
function ArcGisMapServerImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

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

  this._tileDiscardPolicy = options.tileDiscardPolicy;
  this._tileWidth = options.tileWidth ?? 256;
  this._tileHeight = options.tileHeight ?? 256;
  this._maximumLevel = options.maximumLevel;
  this._tilingScheme =
    options.tilingScheme ??
    new GeographicTilingScheme({ ellipsoid: options.ellipsoid });
  this._useTiles = options.usePreCachedTilesIfAvailable ?? true;
  this._rectangle = options.rectangle ?? this._tilingScheme.rectangle;
  this._layers = options.layers;
  this._credit = options.credit;
  this._tileCredits = undefined;

  /**
   * 获取或设置指示是否启用要素选择的值。如果为 true，{@link ArcGisMapServerImageryProvider#pickFeatures} 将
   * 在 ArcGIS 服务器上执行“识别”操作，并返回响应中包含的要素。如果为 false，
   * {@link ArcGisMapServerImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选择的要素）
   * 而不与服务器通信。
   * @type {boolean}
   * @default true
   */
  this.enablePickFeatures = options.enablePickFeatures ?? true;

  this._errorEvent = new Event();
}

/**
 * 创建一个 {@link ImageryProvider}，该提供器从 ArcGIS 底图提供瓦片影像。
 * @param {ArcGisBaseMapType} style ArcGIS 基础地图影像的风格。有效的选项包括 {@link ArcGisBaseMapType.SATELLITE}、{@link ArcGisBaseMapType.OCEANS} 和 {@link ArcGisBaseMapType.HILLSHADE}。
 * @param {ArcGisMapServerImageryProvider.ConstructorOptions} [options] 描述初始化选项的对象。
 * @returns {Promise<ArcGisMapServerImageryProvider>} A resolve 后的 promise，用于获取创建的 ArcGisMapServerImageryProvider。
 *
 * @example
 * // 设置访问 ArcGIS Image Tile 服务的默认访问令牌
 * Cesium.ArcGisMapService.defaultAccessToken = "<ArcGIS Access Token>";
 *
 * // 从默认的 ArcGIS 基础地图添加基础图层
 * const provider = await Cesium.ArcGisMapServerImageryProvider.fromBasemapType(
 * Cesium.ArcGisBaseMapType.SATELLITE);
 *
 * @example
 * // 从默认的 ArcGIS 基础地图添加基础图层
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * baseLayer: Cesium.ImageryLayer.fromProviderAsync(
 * Cesium.ArcGisMapServerImageryProvider.fromBasemapType(
 * Cesium.ArcGisBaseMapType.HILLSHADE, {
 * token: "<ArcGIS Access Token>"
 *       }
 *     )
 *   ),
 * });
 */

ArcGisMapServerImageryProvider.fromBasemapType = async function (
  style,
  options,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("style", style);
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;
  let accessToken;
  let server;
  let warningCredit;
  switch (style) {
    case ArcGisBaseMapType.SATELLITE:
      {
        accessToken = options.token ?? ArcGisMapService.defaultAccessToken;
        server = Resource.createIfNeeded(
          ArcGisMapService.defaultWorldImageryServer,
        );
        server.appendForwardSlash();
        const defaultTokenCredit =
          ArcGisMapService.getDefaultTokenCredit(accessToken);
        if (defined(defaultTokenCredit)) {
          warningCredit = Credit.clone(defaultTokenCredit);
        }
      }
      break;
    case ArcGisBaseMapType.OCEANS:
      {
        accessToken = options.token ?? ArcGisMapService.defaultAccessToken;
        server = Resource.createIfNeeded(
          ArcGisMapService.defaultWorldOceanServer,
        );
        server.appendForwardSlash();
        const defaultTokenCredit =
          ArcGisMapService.getDefaultTokenCredit(accessToken);
        if (defined(defaultTokenCredit)) {
          warningCredit = Credit.clone(defaultTokenCredit);
        }
      }
      break;
    case ArcGisBaseMapType.HILLSHADE:
      {
        accessToken = options.token ?? ArcGisMapService.defaultAccessToken;
        server = Resource.createIfNeeded(
          ArcGisMapService.defaultWorldHillshadeServer,
        );
        server.appendForwardSlash();
        const defaultTokenCredit =
          ArcGisMapService.getDefaultTokenCredit(accessToken);
        if (defined(defaultTokenCredit)) {
          warningCredit = Credit.clone(defaultTokenCredit);
        }
      }
      break;
    default:
      //>>includeStart('debug', pragmas.debug);
      throw new DeveloperError(`Unsupported basemap type: ${style}`);
    //>>includeEnd('debug');
  }

  return ArcGisMapServerImageryProvider.fromUrl(server, {
    ...options,
    token: accessToken,
    credit: warningCredit,
    usePreCachedTilesIfAvailable: true, // ArcGIS Base Map Service Layers only support Tiled views
  });
};

function buildImageResource(imageryProvider, x, y, level, request) {
  let resource;
  if (imageryProvider._useTiles) {
    resource = imageryProvider._resource.getDerivedResource({
      url: `tile/${level}/${y}/${x}`,
      request: request,
    });
  } else {
    const nativeRectangle =
      imageryProvider._tilingScheme.tileXYToNativeRectangle(x, y, level);
    const bbox = `${nativeRectangle.west},${nativeRectangle.south},${nativeRectangle.east},${nativeRectangle.north}`;

    const query = {
      bbox: bbox,
      size: `${imageryProvider._tileWidth},${imageryProvider._tileHeight}`,
      format: "png32",
      transparent: true,
      f: "image",
    };

    if (
      imageryProvider._tilingScheme.projection instanceof GeographicProjection
    ) {
      query.bboxSR = 4326;
      query.imageSR = 4326;
    } else {
      query.bboxSR = 3857;
      query.imageSR = 3857;
    }
    if (imageryProvider.layers) {
      query.layers = `show:${imageryProvider.layers}`;
    }

    resource = imageryProvider._resource.getDerivedResource({
      url: "export",
      request: request,
      queryParameters: query,
    });
  }
  return resource;
}

Object.defineProperties(ArcGisMapServerImageryProvider.prototype, {
  /**
   * 获取 ArcGIS MapServer 的 URL。
   * @memberof ArcGisMapServerImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._resource._url;
    },
  },

  /**
   * 获取用于与 ArcGis MapServer 服务进行身份验证的 ArcGIS 令牌。
   * @memberof ArcGisMapServerImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  token: {
    get: function () {
      return this._resource.queryParameters.token;
    },
  },

  /**
   * 获取此提供器使用的代理。
   * @memberof ArcGisMapServerImageryProvider.prototype
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
   * @memberof ArcGisMapServerImageryProvider.prototype
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
   * @memberof ArcGisMapServerImageryProvider.prototype
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
   * @memberof ArcGisMapServerImageryProvider.prototype
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
   * @memberof ArcGisMapServerImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return 0;
    },
  },

  /**
   * 获取此提供器使用的镶嵌方案。
   * @memberof ArcGisMapServerImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取此实例提供的影像的矩形范围，单位：弧度。
   * @memberof ArcGisMapServerImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._rectangle;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未定义为 undefined，则丢弃策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数返回 undefined，则不会过滤任何瓦片。
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * @memberof ArcGisMapServerImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._tileDiscardPolicy;
    },
  },

  /**
   * 获取此影像提供器激活时显示的信用信息。通常用于显示影像的来源。
   * 获取指示此影像提供器是否使用来自 ArcGIS MapServer 的预缓存瓦片的值。
   * are passed an instance of {@link TileProviderError}.
   * @memberof ArcGisMapServerImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 获取此影像提供器激活时显示的信用信息。通常用于显示影像的来源。
   * 获取指示此影像提供器是否使用预缓存瓦片的值。
   * @memberof ArcGisMapServerImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 获取指示此影像提供器是否包含 alpha 通道的值。如果此属性为 true，则任何没有 alpha 通道的图像将被视为有 alpha 通道。
   * ArcGIS MapServer。
   * @memberof ArcGisMapServerImageryProvider.prototype
   *
   * @type {boolean}
   * @readonly
   * @default true
   */
  usingPrecachedTiles: {
    get: function () {
      return this._useTiles;
    },
  },

  /**
   * 获取指示此影像提供器提供的图像是否包含 alpha 通道的值。如果此属性为 false，则存在的 alpha 通道将被忽略。如果此属性为 true，则任何没有 alpha 通道的图像将被视为有 alpha 通道。
   * include an alpha channel.  If this property is false, an alpha channel, if present, will
   * be ignored.  If this property is true, any images without an alpha channel will be treated
   * 仿佛它们的 alpha 值在所有位置均为 1.0。当此属性为 false 时，内存使用量
   * 以及纹理上传时间都会减少。
   * @memberof ArcGisMapServerImageryProvider.prototype
   *
   * @type {boolean}
   * @readonly
   * @default true
   */
  hasAlphaChannel: {
    get: function () {
      return true;
    },
  },

  /**
   * 获取用于显示的层 ID 的逗号分隔列表。
   * @memberof ArcGisMapServerImageryProvider.prototype
   *
   * @type {string}
   */
  layers: {
    get: function () {
      return this._layers;
    },
  },
});

/**
 * 创建一个 {@link ImageryProvider}，该提供器由 ArcGIS MapServer 托管的分块影像。默认情况下，服务器预缓存的分块将被使用
 * 如果可用的话。
 *
 * @param {Resource|string} url ArcGIS MapServer 服务的 URL。
 * @param {ArcGisMapServerImageryProvider.ConstructorOptions} [options] 描述初始化选项的对象。
 * @returns {Promise<ArcGisMapServerImageryProvider>} A 一个 promise，其解析结果为创建的 ArcGisMapServerImageryProvider。
 *
 * @example
 * const esri = await Cesium.ArcGisMapServerImageryProvider.fromUrl()
 * "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
 * );
 *
 * @exception {RuntimeError} metadata 空间参考指定了一个未知的 WKID。
 * @exception {RuntimeError} metadata fullExtent.spatialReference 指定了一个未知的 WKID。
 */
ArcGisMapServerImageryProvider.fromUrl = async function (url, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;

  const resource = Resource.createIfNeeded(url);
  resource.appendForwardSlash();

  if (defined(options.token)) {
    resource.setQueryParameters({
      token: options.token,
    });
  }

  const provider = new ArcGisMapServerImageryProvider(options);
  provider._resource = resource;
  const imageryProviderBuilder = new ImageryProviderBuilder(options);
  const useTiles = options.usePreCachedTilesIfAvailable ?? true;
  if (useTiles) {
    await requestMetadata(resource, imageryProviderBuilder);
  }

  imageryProviderBuilder.build(provider);
  return provider;
};

/**
 * 获取在显示特定分块时显示的致谢信息。
 *
 * @param {number} x 分块的 X 坐标。
 * @param {number} y 分块的 Y 坐标。
 * @param {number} level 分块层级；
 * @returns {Credit[]} The 在显示分块时显示的致谢信息。
 */
ArcGisMapServerImageryProvider.prototype.getTileCredits = function (
  x,
  y,
  level,
) {
  return this._tileCredits;
};

/**
 * 请求给定分块的图像。
 *
 * @param {number} x 分块的 X 坐标。
 * @param {number} y 分块的 Y 坐标。
 * @param {number} level 分块层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像的 promise，当图像可用时解析，或者
 * 如果对服务器有太多活跃请求，则视为未定义，请求将在之后重试。
 */
ArcGisMapServerImageryProvider.prototype.requestImage = function (
  x,
  y,
  level,
  request,
) {
  return ImageryProvider.loadImage(
    this,
    buildImageResource(this, x, y, level, request),
  );
};

/**
    /**
     * 异步确定在给定经度和纬度范围内分块中是否存在任何特征。
     * 分块的 X 坐标。
     *
     * @param {number} x 分块的 Y 坐标。
     * @param {number} y 分块层级。
     * @param {number} level 分块层级。
     * @param {number} longitude 选择特征的经度。
     * @param {number} latitude  选择特征的纬度。
     * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 选择特征的 promise，当异步过程完成时解析。解析结果是一个 {@link ImageryLayerFeatureInfo} 的数组。
     * picking completes.  The resolved value is an array of {@link ImageryLayerFeatureInfo}
     * 实例。如果给定位置没有找到特征，该数组可能为空。
     */
ArcGisMapServerImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  if (!this.enablePickFeatures) {
    return undefined;
  }

  const rectangle = this._tilingScheme.tileXYToNativeRectangle(x, y, level);

  let horizontal;
  let vertical;
  let sr;
  if (this._tilingScheme.projection instanceof GeographicProjection) {
    horizontal = CesiumMath.toDegrees(longitude);
    vertical = CesiumMath.toDegrees(latitude);
    sr = "4326";
  } else {
    const projected = this._tilingScheme.projection.project(
      new Cartographic(longitude, latitude, 0.0),
    );
    horizontal = projected.x;
    vertical = projected.y;
    sr = "3857";
  }

  let layers = "visible";
  if (defined(this._layers)) {
    layers += `:${this._layers}`;
  }

  const query = {
    f: "json",
    tolerance: 2,
    geometryType: "esriGeometryPoint",
    geometry: `${horizontal},${vertical}`,
    mapExtent: `${rectangle.west},${rectangle.south},${rectangle.east},${rectangle.north}`,
    imageDisplay: `${this._tileWidth},${this._tileHeight},96`,
    sr: sr,
    layers: layers,
  };

  const resource = this._resource.getDerivedResource({
    url: "identify",
    queryParameters: query,
  });

  return resource.fetchJson().then(function (json) {
    const result = [];

    const features = json.results;
    if (!defined(features)) {
      return result;
    }

    for (let i = 0; i < features.length; ++i) {
      const feature = features[i];

      const featureInfo = new ImageryLayerFeatureInfo();
      featureInfo.data = feature;
      featureInfo.name = feature.value;
      featureInfo.properties = feature.attributes;
      featureInfo.configureDescriptionFromProperties(feature.attributes);

      // If this is a point feature, use the coordinates of the point.
      if (feature.geometryType === "esriGeometryPoint" && feature.geometry) {
        const wkid =
          feature.geometry.spatialReference &&
          feature.geometry.spatialReference.wkid
            ? feature.geometry.spatialReference.wkid
            : 4326;
        if (wkid === 4326 || wkid === 4283) {
          featureInfo.position = Cartographic.fromDegrees(
            feature.geometry.x,
            feature.geometry.y,
            feature.geometry.z,
          );
        } else if (wkid === 102100 || wkid === 900913 || wkid === 3857) {
          const projection = new WebMercatorProjection();
          featureInfo.position = projection.unproject(
            new Cartesian3(
              feature.geometry.x,
              feature.geometry.y,
              feature.geometry.z,
            ),
          );
        }
      }

      result.push(featureInfo);
    }

    return result;
  });
};
ArcGisMapServerImageryProvider._metadataCache = {};
export default ArcGisMapServerImageryProvider;