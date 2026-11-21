import { Check, DeveloperError, Frozen, defined } from "@cesium/core";
import Credit from "../Core/Credit.js";
import Resource from "../Core/Resource.js";
import IonResource from "../Core/IonResource.js";
import GoogleMaps from "../Core/GoogleMaps.js";
import { GOOGLE_2D_MAPS as createFromIonEndpoint } from "./IonImageryProviderFactory.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";

const trailingSlashRegex = /\/$/;

/**
 * @typedef {object} Google2DImageryProvider.ConstructorOptions
 *
 * Google2DImageryProvider 构造函数的初始化选项
 *
 * @property {string} key 用于发送瓦片请求的 Google API 密钥。
 * @property {string} session 跟踪地图和视口当前状态的 Google 会话令牌。
 * @property {string|Resource|IonResource} url Google 2D 地图端点。
 * @property {string} tileWidth 每个瓦片的像素宽度。
 * @property {string} tileHeight 每个瓦片的像素高度。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体。如果未指定，则使用默认椭球体。
 * @property {number} [minimumLevel=0] 影像提供器支持的最小细节级别。注意，当指定
 * 最小级别下的瓦片数量较少时，例如四块或更少，需谨慎处理。较大的数量
 * 可能会导致渲染问题。
 * @property {number} [maximumLevel=22] 影像提供器支持的最大细节级别。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 图像所覆盖的矩形区域，以弧度为单位。
 */

/**
 * <div class="notice">
 * 通常不直接实例化此对象，应使用 {@link Google2DImageryProvider.fromIonAssetId} 或 {@link Google2DImageryProvider.fromUrl}。
 * </div>
 *
 *
 * 从 {@link https://developers.google.com/maps/documentation/tile/2d-tiles-overview|Google 2D Tiles} 提供 2D 图像瓦片。
 *
 * Google 2D Tiles 只能与 Google 地理编码器一起使用。
 *
 * @alias Google2DImageryProvider
 * @constructor
 *
 * @param {Google2DImageryProvider.ConstructorOptions} options 描述初始化选项的对象
 *
 * @example
 * // Google 2D 影像提供器
 * const googleTilesProvider = Cesium.Google2DImageryProvider.fromIonAssetId({
 * assetId: 3830184
 * });
  * @example
 * // 使用您自己的 Google API 密钥
 * Cesium.GoogleMaps.defaultApiKey = "your-api-key";
 *
 * const googleTilesProvider = Cesium.Google2DImageryProvider.fromUrl({
 * mapType: "SATELLITE"
 * });
 *

 *
 * @see {@link https://developers.google.com/maps/documentation/tile/2d-tiles-overview}
 * @see {@link https://developers.google.com/maps/documentation/tile/session_tokens}
 * @see {@link https://en.wikipedia.org/wiki/IETF_language_tag|IETF Language Tags}
 * @see {@link https://cldr.unicode.org/|Common Locale Data Repository region identifiers}
 */

function Google2DImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  this._maximumLevel = options.maximumLevel ?? 22;
  this._minimumLevel = options.minimumLevel ?? 0;

  //>>includeStart("debug", pragmas.debug);
  Check.defined("options.session", options.session);
  Check.defined("options.tileWidth", options.tileWidth);
  Check.defined("options.tileHeight", options.tileHeight);
  Check.defined("options.key", options.key);
  //>>includeEnd("debug");

  this._session = options.session;
  this._key = options.key;
  this._tileWidth = options.tileWidth;
  this._tileHeight = options.tileHeight;

  const resource =
    options.url instanceof IonResource
      ? options.url
      : Resource.createIfNeeded(options.url ?? GoogleMaps.mapTilesApiEndpoint);

  let templateUrl = resource.getUrlComponent();
  if (!trailingSlashRegex.test(templateUrl)) {
    templateUrl += "/";
  }
  const tilesUrl = `${templateUrl}v1/2dtiles/{z}/{x}/{y}`;
  this._viewportUrl = `${templateUrl}tile/v1/viewport`;

  resource.url = tilesUrl;

  resource.setQueryParameters({
    session: encodeURIComponent(options.session),
    key: encodeURIComponent(options.key),
  });

  this._resource = resource.clone();

  let credit;
  if (defined(options.credit)) {
    credit = options.credit;
    if (typeof credit === "string") {
      credit = new Credit(credit);
    }
  }

  const provider = new UrlTemplateImageryProvider({
    url: resource,
    credit: credit,
    tileWidth: options.tileWidth,
    tileHeight: options.tileHeight,
    ellipsoid: options.ellipsoid,
    rectangle: options.rectangle,
    maximumLevel: this._maximumLevel,
    minimumLevel: this._minimumLevel,
  });
  provider._resource = resource;
  this._imageryProvider = provider;

  // This will be defined for ion resources
  this._tileCredits = resource.credits;
  this._attributionsByLevel = undefined;
}

Object.defineProperties(Google2DImageryProvider.prototype, {
  /**
   * 获取 Google 2D 影像服务器的 URL。
   * @memberof Google2DImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._imageryProvider.url;
    },
  },

  /**
   * 获取该实例所提供影像的矩形区域，以弧度为单位。
   * @memberof Google2DImageryProvider.prototype
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
   * @memberof Google2DImageryProvider.prototype
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
   * @memberof Google2DImageryProvider.prototype
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
   * @memberof Google2DImageryProvider.prototype
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
   * 只有当影像的矩形区域足够小，使得最小级别的瓦片数量较少时，才应使用最小级别。如果
   * 影像提供器在最小级别下包含大量瓦片，则会导致
   * 渲染问题。
   * 获取提供器使用的瓦片方案。
   * @memberof Google2DImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return this._imageryProvider.minimumLevel;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未未定义，该策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数
   * @memberof Google2DImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._imageryProvider.tilingScheme;
    },
  },

  /**
   * 返回 undefined，则不会过滤任何瓦片。
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅即可接收该事件。
   * returns undefined, no tiles are filtered.
   * @memberof Google2DImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._imageryProvider.tileDiscardPolicy;
    },
  },

  /**
   * Gets an event that is raised when the imagery provider encounters an asynchronous error.  By subscribing
   * 对于该事件，您将收到错误通知并有可能从中恢复。事件监听器
   * 会传递一个 {@link TileProviderError} 的实例。
   * @memberof Google2DImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._imageryProvider.errorEvent;
    },
  },

  /**
   * 获取此影像提供器处于活动状态时应显示的信用信息。通常用于显示
   * 影像的来源。
   * @memberof Google2DImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._imageryProvider.credit;
    },
  },

  /**
   * 获取该提供器使用的代理对象。
   * @memberof Google2DImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return this._imageryProvider.proxy;
    },
  },

  /**
   * 获取一个值，指示该影像提供器提供的图像是否包含 alpha 通道。如果此属性为 false，则存在的 alpha 通道将被忽略。
   * 如果此属性为 true，则任何没有 alpha 通道的图像将被视为其 alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少。
   * 创建一个 {@link ImageryProvider}，该提供器使用 Cesium ion REST API 从 {@link https://developers.google.com/maps/documentation/tile/2d-tiles-overview|Google 2D Tiles} 提供 2D 全局瓦片影像。
   * 具有以下属性的对象：
   * Cesium ion 资产 ID。
   * @memberof Google2DImageryProvider.prototype
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
 * Google 地图影像的地图类型。有效选项包括卫星、地形和路线图。如果设置了 overlayLayerType，则忽略 mapType，返回透明覆盖层；如果 overlayMapType 未定义，则返回 mapType 的基础地图。layerRoadmap 包含在地形和路线图地图类型中。
 * @param {object} options 指定在瓦片上显示信息的语言使用的 IETF 语言标签。
 * @param {string} options.assetId 一个 Common Locale Data Repository 区域标识符（两个大写字母），表示用户的物理位置。
 * @param {"satellite" | "terrain" | "roadmap"} [options.mapType="satellite"] 返回具有指定 layerType 的透明覆盖层地图。如果未提供值，则返回 mapType 的基础地图。使用多个 Google2DImageryProvider 可以在场景中添加多个 Google 地图覆盖层。layerRoadmap 包含在地形和路线图地图类型中，因此将其作为地形或路线图的覆盖层添加没有效果。
 * @param {string} [options.language="en_US"] 一个 JSON 风格对象数组，用于指定道路、公园和建成区等地图特征的外观和细节级别。样式用于自定义标准 Google 基础地图。仅当 mapType 为路线图时，styles 参数才有效。有关完整的样式语法，请参阅 ({@link https://developers.google.com/maps/documentation/tile/style-reference|Google Style Reference})。
 * @param {string} [options.region="US"] A Common Locale Data Repository region identifier (two uppercase letters) that represents the physical location of the user.
 * @param {"layerRoadmap" | "layerStreetview" | "layerTraffic"} [options.overlayLayerType] Returns a transparent overlay map with the specified layerType. If no value is provided, a basemap of mapType is returned. Use multiple instances of Google2DImageryProvider to add multiple Google Maps overlays to a scene. layerRoadmap is included in terrain and roadmap mapTypes, so adding as overlay to terrain or roadmap has no effect.
 * @param {object} [options.styles] An array of JSON style objects that specify the appearance and detail level of map features such as roads, parks, and built-up areas. Styling is used to customize the standard Google base map. The styles parameter is valid only if the mapType is roadmap. For the complete style syntax, see the ({@link https://developers.google.com/maps/documentation/tile/style-reference|Google Style Reference}).
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 椭球体。如果未指定，则使用默认椭球体。
 * @param {number} [options.minimumLevel=0] 影像提供器支持的最小细节级别。在指定时需注意
 * 最小级别下的瓦片数量应较小，例如四片或更少。数量过大可能会导致渲染问题。
 * 影像提供器支持的最大细节级别。
 * @param {number} [options.maximumLevel=22] 影像提供器支持的最大细节级别。
 * @param {Rectangle} [options.rectangle=Rectangle.MAX_VALUE] 图像所覆盖的矩形区域，以弧度为单位。
 * @param {Credit|string} [options.credit] 数据源的信用标识，显示在画布上。
 *
 * @returns {Promise<Google2DImageryProvider>} A 承诺，最终结果为创建的 Google2DImageryProvider。
 *
 * @example
 * // Google 2D 影像提供器
 * const googleTilesProvider = Cesium.Google2DImageryProvider.fromIonAssetId({
 * assetId: 3830184
 * });
 * @example
 * // 具有自定义样式的 Google 2D 路线图覆盖层
 * const googleTilesProvider = Cesium.Google2DImageryProvider.fromIonAssetId({
 * assetId: 3830184,
 * overlayLayerType: "layerRoadmap",
 * styles: [
 *         {
 * stylers: [{ hue: "#00ffe6" }, { saturation: -20 }],
 *         },
 *         {
 * featureType: "road",
 * elementType: "geometry",
 * stylers: [{ lightness: 100 }, { visibility: "simplified" }],
 *         },
 *     ],
 * });
 */
Google2DImageryProvider.fromIonAssetId = async function (options) {
  options = options ?? {};
  options.mapType = options.mapType ?? "satellite";
  options.language = options.language ?? "en_US";
  options.region = options.region ?? "US";

  const overlayLayerType = options.overlayLayerType;
  //>>includeStart("debug", pragmas.debug);
  if (defined(overlayLayerType)) {
    Check.typeOf.string("options.overlayLayerType", overlayLayerType);
  }
  Check.defined("options.assetId", options.assetId);
  //>>includeEnd("debug");

  const queryOptions = buildQueryOptions(options);

  const endpointResource = IonResource._createEndpointResource(
    options.assetId,
    {
      queryParameters: {
        options: JSON.stringify(queryOptions),
      },
    },
  );

  const providerOptions = {
    language: options.language,
    region: options.region,
    ellipsoid: options.ellipsoid,
    minimumLevel: options.minimumLevel,
    maximumLevel: options.maximumLevel,
    rectangle: options.rectangle,
    credit: options.credit,
  };

  const endpoint = await endpointResource.fetchJson();
  const url = endpoint.options.url;
  delete endpoint.options.url;
  endpoint.options = {
    ...endpoint.options,
    ...providerOptions,
  };

  return createFromIonEndpoint(url, endpoint, endpointResource);
};

/**
 * 创建一个 {@link ImageryProvider}，提供来自 {@link https://developers.google.com/maps/documentation/tile/2d-tiles-overview|Google 2D Tiles}的2D全球瓦片影像。
 * @param {object} options 具有以下属性的对象：
 * @param {string} [options.key=GoogleMaps.defaultApiKey] 用于访问 Google 2D Tiles 的 API 密钥。有关如何生成自己密钥的说明，请参阅 {@link https://developers.google.com/maps/documentation/javascript/get-api-key}。
 * @param {"satellite" | "terrain" | "roadmap"} [options.mapType="satellite"] Google 地图影像的地图类型。有效选项包括卫星、地形和路线图。如果设置了 overlayLayerType，则忽略 mapType，返回透明覆盖层。如果未定义 overlayMapType，则返回 mapType 的基础地图。layerRoadmap overlayLayerType 包含在地形和路线图地图类型中。
 * @param {string} [options.language="en_US"] 指定在瓦片上显示信息的语言使用的 IETF 语言标签。
 * @param {string} [options.region="US"] 代表用户物理位置的 Common Locale Data Repository 区域标识符（两个大写字母）。
 * @param {"layerRoadmap" | "layerStreetview" | "layerTraffic"} [options.overlayLayerType] 返回具有指定 layerType 的透明覆盖地图。如果未提供值，则返回 mapType 的基础地图。使用多个 Google2DImageryProvider 可以在场景中添加多个 Google 地图覆盖层。layerRoadmap 包含在地形和路线图地图类型中，因此将其作为覆盖层添加到地形或路线图上无效。
 * @param {object} [options.styles] 一个 JSON 格式对象的数组，用于指定道路、公园和建成区等地图要素的外观和细节级别。样式设置用于自定义标准 Google 基础地图。仅当 mapType 为 roadmap 时，styles 参数才有效。完整的样式语法请参见 ({@link https://developers.google.com/maps/documentation/tile/style-reference|Google Style Reference})。
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 椭球体。如果未指定，则使用默认椭球体。
 * @param {number} [options.minimumLevel=0] 影像提供器支持的最小细节级别。在指定时请注意，最小级别下的瓦片数量应较少，例如四片或更少。数量过多可能会导致渲染问题。
 * 当最小级别的瓦片数量较少时，如四片或更少，可能会出现问题。数量较多则可能导致渲染问题。
 * 影像提供器支持的最大细节级别。
 * @param {number} [options.maximumLevel=22] 影像提供器支持的最大细节级别。
 * @param {Rectangle} [options.rectangle=Rectangle.MAX_VALUE] 图像所覆盖的矩形区域，以弧度为单位。
 * @param {Credit|string} [options.credit] 在画布上显示的数据源标签。
 *
 * @returns {Promise<Google2DImageryProvider>} A resolve 后的 promise，指向创建的 Google2DImageryProvider。
 *
 * @example
 * // 使用您自己的 Google api 密钥
 * Cesium.GoogleMaps.defaultApiKey = "your-api-key";
 *
 * const googleTilesProvider = Cesium.Google2DImageryProvider.fromUrl({
 * mapType: "satellite"
 * });
 * @example
 * // 带有自定义样式的 Google 2D 路线图覆盖层
 * Cesium.GoogleMaps.defaultApiKey = "your-api-key";
 *
 * const googleTilesProvider = Cesium.Google2DImageryProvider.fromUrl({
 * overlayLayerType: "layerRoadmap",
 * styles: [
 *         {
 * stylers: [{ hue: "#00ffe6" }, { saturation: -20 }],
 *         },
 *         {
 * featureType: "road",
 * elementType: "geometry",
 * stylers: [{ lightness: 100 }, { visibility: "simplified" }],
 *         },
 *     ],
 * });
 */
Google2DImageryProvider.fromUrl = async function (options) {
  options = options ?? {};
  options.mapType = options.mapType ?? "satellite";
  options.language = options.language ?? "en_US";
  options.region = options.region ?? "US";
  options.url = options.url ?? GoogleMaps.mapTilesApiEndpoint;
  options.key = options.key ?? GoogleMaps.defaultApiKey;

  const overlayLayerType = options.overlayLayerType;
  //>>includeStart("debug", pragmas.debug);
  if (defined(overlayLayerType)) {
    Check.typeOf.string("overlayLayerType", overlayLayerType);
  }
  if (!defined(options.key) && !defined(GoogleMaps.defaultApiKey)) {
    throw new DeveloperError(
      "options.key or GoogleMaps.defaultApiKey is required.",
    );
  }
  //>>includeEnd("debug");

  const sessionJson = await createGoogleImagerySession(options);
  return new Google2DImageryProvider({
    ...sessionJson,
    ...options,
    credit: options.credit ?? GoogleMaps.getDefaultCredit(),
  });
};

/**
 * 获取在显示特定瓦片时显示的标签。
 *
 * @param {number} x 瓦片的 X 坐标。
 * @param {number} y 瓦片的 Y 坐标。
 * @param {number} level 瓦片级别；
 * @returns {Credit[]|undefined} The 在显示瓦片时显示的标签。
 */
Google2DImageryProvider.prototype.getTileCredits = function (x, y, level) {
  const hasAttributions = defined(this._attributionsByLevel);

  if (!hasAttributions || !defined(this._tileCredits)) {
    return undefined;
  }

  const innerCredits = this._attributionsByLevel.get(level);
  if (!defined(this._tileCredits)) {
    return innerCredits;
  }

  return this._tileCredits.concat(innerCredits);
};

/**
 * 对给定瓦片请求图像。
 *
 * @param {number} x 瓦片的 X 坐标。
 * @param {number} y 瓦片的 Y 坐标。
 * @param {number} level 瓦片级别。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像 resolve 后的 promise，当图像可用时解析，或者
 * 如果对服务器的活动请求过多，则为 undefined，请求将在之后重试。
 */
Google2DImageryProvider.prototype.requestImage = function (
  x,
  y,
  level,
  request,
) {
  const promise = this._imageryProvider.requestImage(x, y, level, request);

  // If the requestImage call returns undefined, it couldn't be scheduled this frame. Make sure to return undefined so this can be handled upstream.
  if (!defined(promise)) {
    return undefined;
  }

  // Asynchronously request and populate _attributionsByLevel if it hasn't been already. We do this here so that the promise can be properly awaited.
  if (!defined(this._attributionsByLevel)) {
    return Promise.all([promise, this.getViewportCredits()]).then(
      (results) => results[0],
    );
  }

  return promise;
};

/**
 * 该影像提供器目前不支持选择要素，因此此函数直接返回
 * undefined。
 *
 * @param {number} x 瓦片的 X 坐标。
 * @param {number} y 瓦片的 Y 坐标。
 * @param {number} level 瓦片级别。
 * @param {number} longitude 选择要素的经度。
 * @param {number} latitude  选择要素的纬度。
 * @return {undefined} Undefined 因为不支持选择。
 */
Google2DImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return undefined;
};

/**
 * 获取来自 Google 地图的影像来源信息以在致谢中展示。
 * @private
 * @return {Promise<Map<Credit[]>>} The 在致谢中展示的影像来源列表。
 */
Google2DImageryProvider.prototype.getViewportCredits = async function () {
  const maximumLevel = this._maximumLevel;

  const promises = [];
  for (let level = 0; level < maximumLevel + 1; level++) {
    promises.push(
      fetchViewportAttribution(this._resource, this._viewportUrl, level),
    );
  }
  const results = await Promise.all(promises);

  const attributionsByLevel = new Map();
  for (let level = 0; level < maximumLevel + 1; level++) {
    const credits = [];
    const attributions = results[level];
    if (attributions) {
      const levelCredits = new Credit(attributions);
      credits.push(levelCredits);
    }
    attributionsByLevel.set(level, credits);
  }

  this._attributionsByLevel = attributionsByLevel;

  return attributionsByLevel;
};

async function fetchViewportAttribution(resource, url, level) {
  const viewportResource = resource.getDerivedResource({
    url,
    queryParameters: {
      zoom: level,
      north: 90,
      south: -90,
      east: 180,
      west: -180,
    },
    data: JSON.stringify(Frozen.EMPTY_OBJECT),
  });
  const viewportJson = await viewportResource.fetchJson();
  return viewportJson.copyright;
}

function buildQueryOptions(options) {
  const { mapType, overlayLayerType, styles } = options;

  const queryOptions = {
    mapType,
    overlay: false,
  };

  if (mapType === "terrain" && !defined(overlayLayerType)) {
    queryOptions.layerTypes = ["layerRoadmap"];
  }

  if (defined(overlayLayerType)) {
    queryOptions.mapType = "satellite";
    queryOptions.overlay = true;
    queryOptions.layerTypes = [overlayLayerType];
  }
  if (defined(styles)) {
    queryOptions.styles = styles;
  }
  return queryOptions;
}

async function createGoogleImagerySession(options) {
  const { language, region, key, url } = options;

  const queryOptions = buildQueryOptions(options);

  let baseUrl = url.url ?? url;
  if (!trailingSlashRegex.test(baseUrl)) {
    baseUrl += "/";
  }

  const response = await Resource.post({
    url: `${baseUrl}v1/createSession`,
    queryParameters: { key: key },
    data: JSON.stringify({
      ...queryOptions,
      language,
      region,
    }),
  });
  const responseJson = JSON.parse(response);
  return responseJson;
}

export default Google2DImageryProvider;
