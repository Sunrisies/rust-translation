import { Check, Frozen, defined } from "@cesium/core";
import Credit from "../Core/Credit.js";
import Resource from "../Core/Resource.js";
import IonResource from "../Core/IonResource.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";

const trailingSlashRegex = /\/$/;

/**
 * @typedef {object} Azure2DImageryProvider.ConstructorOptions
 *
 * Azure2DImageryProvider 构造器的初始化选项
 *
 * @property {string} subscriptionKey 影像的公开订阅密钥。
 * @property {string} [url="https://atlas.microsoft.com/"] Azure 服务器 URL。
 * @property {string} [tilesetId="microsoft.imagery"] Azure tileset ID。有效的选项包括 {@link microsoft.imagery}、{@link microsoft.base.road} 和 {@link microsoft.base.labels.road}。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体参数。如果未指定，则使用默认椭球体。
 * @property {number} [minimumLevel=0] 影像提供器支持的最小细节级别。在指定时需注意
 * 最小级别下的瓦片数量应较少，例如四片或更少。数量过多可能导致
 * 渲染问题。
 * @property {number} [maximumLevel=22] 影像提供器支持的最大细节级别。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 图像所覆盖的弧度单位制矩形区域。
 */

/**
 * 提供来自 Azure 的 2D 图像瓦片。
 *
 * @alias Azure2DImageryProvider
 * @constructor
 * @param {Azure2DImageryProvider.ConstructorOptions} options 描述初始化选项的对象。
 *
 * @example
 * // Azure 2D 影像提供器
 * const azureImageryProvider = new Cesium.Azure2DImageryProvider({
 * subscriptionKey: "subscription-key",
 * tilesetId: "microsoft.base.road"
 * });
 */
function Azure2DImageryProvider(options) {
  options = options ?? {};
  const tilesetId = options.tilesetId ?? "microsoft.imagery";
  this._maximumLevel = options.maximumLevel ?? 22;
  this._minimumLevel = options.minimumLevel ?? 0;

  this._subscriptionKey =
    options.subscriptionKey ?? options["subscription-key"];
  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.subscriptionKey", this._subscriptionKey);
  //>>includeEnd('debug');

  this._tilesetId = options.tilesetId;

  const resource =
    options.url instanceof IonResource
      ? options.url
      : Resource.createIfNeeded(options.url ?? "https://atlas.microsoft.com/");

  let templateUrl = resource.getUrlComponent();
  if (!trailingSlashRegex.test(templateUrl)) {
    templateUrl += "/";
  }

  const tilesUrl = `${templateUrl}map/tile`;
  this._viewportUrl = `${templateUrl}map/attribution`;

  resource.url = tilesUrl;

  resource.setQueryParameters({
    "api-version": "2024-04-01",
    tilesetId: tilesetId,
    "subscription-key": this._subscriptionKey,
    zoom: `{z}`,
    x: `{x}`,
    y: `{y}`,
  });

  this._resource = resource;

  let credit;
  if (defined(options.credit)) {
    credit = options.credit;
    if (typeof credit === "string") {
      credit = new Credit(credit);
    }
  }

  const provider = new UrlTemplateImageryProvider({
    ...options,
    maximumLevel: this._maximumLevel,
    minimumLevel: this._minimumLevel,
    url: resource,
    credit: credit,
  });
  provider._resource = resource;
  this._imageryProvider = provider;

  // This will be defined for ion resources
  this._tileCredits = resource.credits;
  this._attributionsByLevel = undefined;
}

Object.defineProperties(Azure2DImageryProvider.prototype, {
  /**
   * 获取 Azure 2D Imagery 服务器的 URL。
   * @memberof Azure2DImageryProvider.prototype
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
   * @memberof Azure2DImageryProvider.prototype
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
   * @memberof Azure2DImageryProvider.prototype
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
   * @memberof Azure2DImageryProvider.prototype
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
   * @memberof Azure2DImageryProvider.prototype
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
   * 只有在影像的矩形区域足够小且最小级别的瓦片数量较少时，才应使用最小级别。如果
   * 最小级别的瓦片数量过多，则会导致
   * 渲染问题。
   * 获取提供器使用的瓦片方案。
   * @memberof Azure2DImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return this._imageryProvider.minimumLevel;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未定义为 undefined，该策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数返回 undefined，则不会过滤任何瓦片。
   * @memberof Azure2DImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._imageryProvider.tilingScheme;
    },
  },

  /**
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * 获取此影像提供器激活时显示的信用信息。通常用于显示影像的来源。
   * @memberof Azure2DImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._imageryProvider.tileDiscardPolicy;
    },
  },

  /**
   * 获取该提供器使用的代理。
   * 获取指示该影像提供器是否提供图像的布尔值。
   * are passed an instance of {@link TileProviderError}.
   * @memberof Azure2DImageryProvider.prototype
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
   * @memberof Azure2DImageryProvider.prototype
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
   * @memberof Azure2DImageryProvider.prototype
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
   * 包含 alpha 通道。如果此属性为 false，则存在的 alpha 通道将被忽略。
   * 任何没有 alpha 通道的图像将被视为其 alpha 值为 1.0。当此属性为 true 时，内存使用和纹理上传时间都会减少。
   * 获取在显示特定瓦片时应显示的致谢信息。
   * 瓦片的 X 坐标。
   * @memberof Azure2DImageryProvider.prototype
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
 * 瓦片的 Y 坐标。
 *
 * @param {number} x 瓦片的级别。
 * @param {number} y 瓦片的级别。
 * @param {number} level 瓦片的层级。
 * @returns {Credit[]|undefined} The 在显示瓦片时应显示的致谢信息。
 */
Azure2DImageryProvider.prototype.getTileCredits = function (x, y, level) {
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
 * 获取指定瓦片的图像。
 *
 * @param {number} x 瓦片的 X 坐标。
 * @param {number} y 瓦片的 Y 坐标。
 * @param {number} level 瓦片的层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 对图像的承诺，在图像可用时解析，或者
 * 如果向服务器发送的请求过多且需要重试，则返回 undefined。
 */
Azure2DImageryProvider.prototype.requestImage = function (
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
 * 此影像提供程序目前不支持选择特征，因此该函数直接返回 undefined。
 * undefined。
 *
 * @param {number} x 瓦片的 X 坐标。
 * @param {number} y 瓦片的 Y 坐标。
 * @param {number} level 瓦片的层级。
 * @param {number} longitude 选择特征的经度。
 * @param {number} latitude  选择特征的纬度。
 * @return {undefined} Undefined 因为不支持选择功能。
 */
Azure2DImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return undefined;
};

/**
 * 获取来自 Azure Maps 的影像归属信息以在致谢中显示。
 * @private
 * @return {Promise<Map<Credit[]>>} The 在致谢中显示的归属来源列表。
 */
Azure2DImageryProvider.prototype.getViewportCredits = async function () {
  const maximumLevel = this._maximumLevel;

  const promises = [];
  for (let level = 0; level < maximumLevel + 1; level++) {
    promises.push(
      fetchViewportAttribution(
        this._resource,
        this._viewportUrl,
        this._subscriptionKey,
        this._tilesetId,
        level,
      ),
    );
  }
  const results = await Promise.all(promises);

  const attributionsByLevel = new Map();
  for (let level = 0; level < maximumLevel + 1; level++) {
    const credits = [];
    const attributions = results[level].join(",");
    if (attributions) {
      const levelCredits = new Credit(attributions);
      credits.push(levelCredits);
    }
    attributionsByLevel.set(level, credits);
  }

  this._attributionsByLevel = attributionsByLevel;

  return attributionsByLevel;
};

async function fetchViewportAttribution(resource, url, key, tilesetId, level) {
  const viewportResource = resource.getDerivedResource({
    url,
    queryParameters: {
      zoom: level,
      bounds: "-180,-90,180,90",
    },
    data: JSON.stringify(Frozen.EMPTY_OBJECT),
  });

  const viewportJson = await viewportResource.fetchJson();
  return viewportJson.copyrights;
}

// Exposed for tests
export default Azure2DImageryProvider;
