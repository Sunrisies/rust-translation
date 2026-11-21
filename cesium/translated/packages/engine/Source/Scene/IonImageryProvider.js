import {
  Check,
  Event,
  Frozen,
  RuntimeError,
  clone,
  defined,
} from "@cesium/core";
import IonResource from "../Core/IonResource.js";
import IonImageryProviderFactory from "./IonImageryProviderFactory.js";

/**
 * @typedef {object} IonImageryProvider.ConstructorOptions
 *
 * TileMapServiceImageryProvider 构造函数的初始化选项
 *
 * @property {string} [accessToken=Ion.defaultAccessToken] 要使用的访问令牌。
 * @property {string|Resource} [server=Ion.defaultServer] Cesium ion API 服务器的资源地址。
 */

/**
 * <div class="notice">
 * 要创建 IonImageryProvider，请调用 {@link IonImageryProvider.fromAssetId}。不要直接调用构造函数。
 * </div>
 *
 * 通过 Cesium ion REST API 提供瓦片式影像。
 *
 * @alias IonImageryProvider
 * @constructor
 *
 * @example
 * const imageryLayer = Cesium.ImageryLayer.fromProviderAsync(Cesium.IonImageryProvider.fromAssetId(3812));
 * viewer.imageryLayers.add(imageryLayer);
 *
 * @see IonImageryProvider.fromAssetId
 */
function IonImageryProvider() {
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

  this._tileCredits = undefined;
  this._errorEvent = new Event();
}

Object.defineProperties(IonImageryProvider.prototype, {
  /**
   * 获取该实例提供的影像的矩形区域，单位为单位弧度。
   * @memberof IonImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._imageryProvider.rectangle;
    },
  },

  /**
   * 获取每个瓦片的宽度，单位像素。
   * @memberof IonImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._imageryProvider.tileWidth;
    },
  },

  /**
   * 获取每个瓦片的高度，单位像素。
   * @memberof IonImageryProvider.prototype
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
   * @memberof IonImageryProvider.prototype
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
   * 只有在影像的矩形区域足够小，使得最小级别下的瓦片数量较少时，才应使用最小级别。如果最小级别下的瓦片数量过多，
   * 会导致渲染问题。
   * 获取提供器使用的瓦片方案。
   * 获取瓦片丢弃策略。如果未定义为 undefined，该策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数返回 undefined，则不会过滤任何瓦片。
   * @memberof IonImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return this._imageryProvider.minimumLevel;
    },
  },

  /**
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您可以收到错误通知并可能进行恢复。事件监听器
   * @memberof IonImageryProvider.prototype
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
   * 获取此影像提供器激活时显示的信用信息。通常用于显示影像来源。
   * 获取指示此影像提供器提供的图像是否包含 Alpha 通道的值。如果此属性为 false，则存在的 Alpha 通道将被忽略。如果此属性为 true，则没有 Alpha 通道的图像将被视为其 Alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少。
   * @memberof IonImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._imageryProvider.tileDiscardPolicy;
    },
  },

  /**
   * 获取此提供器使用的代理。
   * 使用 Cesium ion REST API 创建瓦片式影像提供器。
   * are passed an instance of {@link TileProviderError}.
   * @memberof IonImageryProvider.prototype
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
   * resolve 后得到的 Promise，用于创建 IonImageryProvider。
   * @memberof IonImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._imageryProvider.credit;
    },
  },

  /**
   * Gets a value indicating whether or not the images provided by this imagery provider
   * include an alpha channel.  If this property is false, an alpha channel, if present, will
   * be ignored.  If this property is true, any images without an alpha channel will be treated
   * as if their alpha is 1.0 everywhere.  When this property is false, memory usage
   * and texture upload time are reduced.
   * @memberof IonImageryProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasAlphaChannel: {
    get: function () {
      return this._imageryProvider.hasAlphaChannel;
    },
  },

  /**
   * Gets the proxy used by this provider.
   * @memberof IonImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   * @default undefined
   */
  proxy: {
    get: function () {
      return undefined;
    },
  },
});

/**
 * Creates a provider for tiled imagery using the Cesium ion REST API.
 *
 * @param {number} assetId  An ion imagery asset ID.
 * @param {IonImageryProvider.ConstructorOptions} [options] Object describing initialization options.
 * @returns {Promise<IonImageryProvider>} A promise which resolves to the created IonImageryProvider.
 *
 * @example
 * const imageryLayer = Cesium.ImageryLayer.fromProviderAsync(Cesium.IonImageryProvider.fromAssetId(3812));
 * viewer.imageryLayers.add(imageryLayer);
 *
 * @exception {RuntimeError} Cesium ion assetId 不是影像资产
 * @exception {RuntimeError} Unrecognized Cesium ion 影像类型
 */
IonImageryProvider.fromAssetId = async function (assetId, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("assetId", assetId);
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;
  const endpointResource = IonResource._createEndpointResource(
    assetId,
    options,
  );

  // A simple cache to avoid making repeated requests to ion for endpoints we've
  // already retrieved. This exists mainly to support Bing caching to reduce
  // world imagery sessions, but provides a small boost of performance in general
  // if constantly reloading assets
  const cacheKey = assetId.toString() + options.accessToken + options.server;
  let promise = IonImageryProvider._endpointCache[cacheKey];
  if (!defined(promise)) {
    promise = endpointResource.fetchJson();
    IonImageryProvider._endpointCache[cacheKey] = promise;
  }

  let endpoint = await promise;
  if (endpoint.type !== "IMAGERY") {
    throw new RuntimeError(
      `Cesium ion asset ${assetId} is not an imagery asset.`,
    );
  }

  const externalType = endpoint.externalType;
  let factory = IonImageryProviderFactory.defaultFactoryCallback;

  // Make a copy before editing since this object reference is cached;
  endpoint = clone(endpoint, true);
  endpoint.options = endpoint.options ?? {};
  const url = endpoint.options?.url;
  delete options.url;

  if (defined(externalType)) {
    factory = IonImageryProviderFactory[externalType];

    if (!defined(factory)) {
      throw new RuntimeError(
        `Unrecognized Cesium ion imagery type: ${externalType}`,
      );
    }
  }

  const imageryProvider = await factory(url, endpoint, endpointResource);
  const provider = new IonImageryProvider(options);

  imageryProvider.errorEvent.addEventListener(function (tileProviderError) {
    //Propagate the errorEvent but set the provider to this instance instead
    //of the inner instance.
    tileProviderError.provider = provider;
    provider._errorEvent.raiseEvent(tileProviderError);
  });

  provider._tileCredits = IonResource.getCreditsFromEndpoint(
    endpoint,
    endpointResource,
  );

  provider._imageryProvider = imageryProvider;

  return provider;
};

/**
 * 在显示特定瓦片时，获取要显示的说明文字。
 * @function
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级；
 * @returns {Credit[]} The 在显示瓦片时，要显示的说明文字。
 */
IonImageryProvider.prototype.getTileCredits = function (x, y, level) {
  const innerCredits = this._imageryProvider.getTileCredits(x, y, level);
  if (!defined(innerCredits)) {
    return this._tileCredits;
  }

  return this._tileCredits.concat(innerCredits);
};

/**
 * 请求特定瓦片的图像。
 * @function
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像的承诺，当图像可用时将解析，或者
 * 如果对服务器有太多活跃请求，则定义为 undefined，请求将在之后重试。
 */
IonImageryProvider.prototype.requestImage = function (x, y, level, request) {
  return this._imageryProvider.requestImage(x, y, level, request);
};

/**
 * 异步确定在给定经度和纬度范围内，瓦片内是否存在任何特征。
 * 此函数可选，因此并非所有影像提供者都包含该功能。
 *
 * @function
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 选择特征的经度。
 * @param {number} latitude  选择特征的纬度。
 * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 选择特征的承诺，当异步操作完成时将解析。解析值是一个 {@link ImageryLayerFeatureInfo} 数组。
 *                   picking completes.  The resolved value is an array of {@link ImageryLayerFeatureInfo}
 * 如果不支持选择功能，则也可能为 undefined。
 * It may also be undefined if picking is not supported.
 */
IonImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return this._imageryProvider.pickFeatures(x, y, level, longitude, latitude);
};

//exposed for testing
IonImageryProvider._endpointCache = {};
export default IonImageryProvider;