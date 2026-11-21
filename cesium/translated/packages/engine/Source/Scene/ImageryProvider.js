import { Check, DeveloperError, defined } from "@cesium/core";
import loadKTX2 from "../Core/loadKTX2.js";
import Resource from "../Core/Resource.js";

/**
 * @typedef {HTMLImageElement|HTMLCanvasElement|ImageBitmap|OffscreenCanvas} ImageryTypes
 *
 * {@link ImageryProvider} 方法返回图像的格式可能
 * 因提供方、配置或服务器设置而异。最常见的格式包括
 * <code>HTMLImageElement</code>、<code>HTMLCanvasElement</code>，或在支持
 * 的浏览器中使用 <code>ImageBitmap</code>。
 *
 * 有关各 ImageryProvider 类如何返回图像的具体信息，请参阅相关文档。
 */

/**
 * 将影像显示在椭球体表面。这种类型描述了一个
 * 接口，不用于直接实例化。
 *
 * @alias ImageryProvider
 * @constructor
 * @abstract
 *
 * @see ArcGisMapServerImageryProvider
 * @see BingMapsImageryProvider
 * @see OpenStreetMapImageryProvider
 * @see TileMapServiceImageryProvider
 * @see GoogleEarthEnterpriseImageryProvider
 * @see GoogleEarthEnterpriseMapsProvider
 * @see GridImageryProvider
 * @see IonImageryProvider
 * @see MapboxImageryProvider
 * @see MapboxStyleImageryProvider
 * @see SingleTileImageryProvider
 * @see TileCoordinatesImageryProvider
 * @see UrlTemplateImageryProvider
 * @see WebMapServiceImageryProvider
 * @see WebMapTileServiceImageryProvider
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=imagery-layers|Cesium Sandcastle Imagery Layers Demo}
 * @demo {@link https://sandcastle.cesium.com/index.html?id=imagery-layers-manipulation|Cesium Sandcastle Imagery Manipulation Demo}
 */
function ImageryProvider() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(ImageryProvider.prototype, {
  /**
   * 获取该实例提供的影像的矩形区域，单位为单位弧度。
   * @memberof ImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取每个瓦片的宽度，单位像素。
   * @memberof ImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取每个瓦片的高度，单位像素。
   * @memberof ImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileHeight: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取可请求的最大细节级别。
   * @memberof ImageryProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  maximumLevel: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取可请求的最小细节级别。通常，
   * 只有在影像的矩形区域足够小，使得最小级别下的瓦片数量较少时，才应使用最小级别。
   * 如果最小级别的瓦片数量过多，则会导致渲染问题。
   * 获取提供方使用的瓦片方案。
   * 获取瓦片丢弃策略。如果未定义为未定义，该策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果此函数返回未定义，则不会过滤任何瓦片。
   * @memberof ImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取影像提供方遇到的异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * @memberof ImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 接收 {@link TileProviderError} 的实例。
   * 获取此影像提供方激活时显示的署名。通常用于显示影像的来源署名。
   * 获取该提供方使用的代理。
   * @memberof ImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取一个值，指示此影像提供方提供的图像是否包含 alpha 通道。如果此属性为 false，则存在的 alpha 通道将被忽略。如果此属性为 true，则没有 alpha 通道的图像将被视为其 alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少。
   * 获取显示特定瓦片时显示的署名。
   * are passed an instance of {@link TileProviderError}.
   * @memberof ImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 瓦片 Y 坐标。
   * 瓦片级别；
   * @memberof ImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 显示该瓦片时显示的署名。
   * @memberof ImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * Gets a value indicating whether or not the images provided by this imagery provider
   * include an alpha channel.  If this property is false, an alpha channel, if present, will
   * be ignored.  If this property is true, any images without an alpha channel will be treated
   * as if their alpha is 1.0 everywhere.  When this property is false, memory usage
   * and texture upload time are reduced.
   * @memberof ImageryProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasAlphaChannel: {
    get: DeveloperError.throwInstantiationError,
  },
});

/**
 * Gets the credits to be displayed when a given tile is displayed.
 *
 * @param {number} x The tile X coordinate.
 * @param {number} y The tile Y coordinate.
 * @param {number} level The tile level;
 * @returns {Credit[]} The credits to be displayed when the tile is displayed.
 */
ImageryProvider.prototype.getTileCredits = function (x, y, level) {
  DeveloperError.throwInstantiationError();
};

/**
 * 针对给定的瓦片请求图像。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} Returns 图像的承诺，当图像可用时将解析，或者
 * 如果向服务器发送的活跃请求过多，则定义为未定义，请求将在之后重试。
 */
ImageryProvider.prototype.requestImage = function (x, y, level, request) {
  DeveloperError.throwInstantiationError();
};

/**
 * 异步确定在给定经度和纬度处的瓦片内是否存在任何特征。
 * 在瓦片范围内。
 * 此函数为可选，因此并非所有 ImageryProvider 都包含该功能。
 *
 * @function
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 选择特征时的经度。
 * @param {number} latitude  选择特征时的纬度。
 * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 所选特征的承诺，将在异步操作完成时解析。解析值是一个 {@link ImageryLayerFeatureInfo} 实例数组。如果给定位置没有找到特征，该数组可能为空。
 *                   picking completes.  The resolved value is an array of {@link ImageryLayerFeatureInfo}
 * 从给定 URL 加载图像。如果 URL 引用的服务器已有
 * 太多待处理请求，此函数将返回未定义，表示
 *
 */
ImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  DeveloperError.throwInstantiationError();
};

const ktx2Regex = /\.ktx2$/i;

/**
 * 请求应在之后重试。
 * 该 URL 对应的影像提供器。
 * 图像的 URL。
 *
 * @param {ImageryProvider} imageryProvider 当图像可用时解析的承诺，或者
 * @param {Resource|string} url 如果向服务器发送的活跃请求过多，则定义为未定义，请求将在之后重试。
 * @returns {Promise<ImageryTypes|CompressedTextureBuffer>|undefined} A promise for the image that will resolve when the image is available, or
 * undefined if there are too many active requests to the server, and the request should be retried later.
 */
ImageryProvider.loadImage = function (imageryProvider, url) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  const resource = Resource.createIfNeeded(url);

  if (ktx2Regex.test(resource.url)) {
    // Resolves with `CompressedTextureBuffer`
    return loadKTX2(resource);
  } else if (
    defined(imageryProvider) &&
    defined(imageryProvider.tileDiscardPolicy)
  ) {
    // Resolves with `HTMLImageElement` or `ImageBitmap`
    return resource.fetchImage({
      preferBlob: true,
      preferImageBitmap: true,
      flipY: true,
    });
  }

  return resource.fetchImage({
    preferImageBitmap: true,
    flipY: true,
  });
};
export default ImageryProvider;