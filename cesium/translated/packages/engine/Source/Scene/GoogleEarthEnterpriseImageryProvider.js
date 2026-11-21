import {
  Check,
  Event,
  Frozen,
  Math as CesiumMath,
  Rectangle,
  RuntimeError,
  defined,
} from "@cesium/core";
import Credit from "../Core/Credit.js";
import decodeGoogleEarthEnterpriseData from "../Core/decodeGoogleEarthEnterpriseData.js";
import GeographicTilingScheme from "../Core/GeographicTilingScheme.js";
import GoogleEarthEnterpriseMetadata from "../Core/GoogleEarthEnterpriseMetadata.js";
import loadImageFromTypedArray from "../Core/loadImageFromTypedArray.js";
import Request from "../Core/Request.js";
import * as protobuf from "protobufjs/dist/minimal/protobuf.js";

/**
 * @private
 */
function GoogleEarthEnterpriseDiscardPolicy() {
  this._image = new Image();
}

/**
 * 确定丢弃策略是否准备好处理图像。
 * @returns {boolean} True 如果丢弃策略准备好处理图像，则返回 true；否则返回 false。
 */
GoogleEarthEnterpriseDiscardPolicy.prototype.isReady = function () {
  return true;
};

/**
 * 给定一个瓦片图像，决定是否应丢弃该图像。
 *
 * @param {HTMLImageElement} image 用于测试的图像。
 * @returns {boolean} True 如果图像应被丢弃，则返回 true；否则返回 false。
 */
GoogleEarthEnterpriseDiscardPolicy.prototype.shouldDiscardImage = function (
  image,
) {
  return image === this._image;
};

/**
 * @typedef {object} GoogleEarthEnterpriseImageryProvider.ConstructorOptions
 *
 * GoogleEarthEnterpriseImageryProvider 构造器的初始化选项
 *
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球参数。如果未指定，则使用默认椭球参数。
 * @property {TileDiscardPolicy} [tileDiscardPolicy] 决定瓦片是否无效的策略
 * 是否应被丢弃。如果未指定该值，则默认策略为
 * 丢弃无法下载的瓦片。
 * @property {Credit|string} [credit] 数据显示在画布上的数据源信用信息。
 */

/**
 * <div class="notice">
 * 要创建 GoogleEarthEnterpriseImageryProvider，请调用 {@link GoogleEarthEnterpriseImageryProvider.fromMetadata}。不要直接调用构造器。
 * </div>
 *
 * 使用 Google Earth Enterprise REST API 提供瓦片式影像。
 *
 * 注意：此提供器适用于 Google Earth Enterprise 的 3D Earth API，
 * {@link GoogleEarthEnterpriseMapsProvider} 应配合 2D Maps API 使用。
 *
 * @alias GoogleEarthEnterpriseImageryProvider
 * @constructor
 *
 * @param {GoogleEarthEnterpriseImageryProvider.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @see GoogleEarthEnterpriseImageryProvider.fromMetadata
 * @see GoogleEarthEnterpriseTerrainProvider
 * @see ArcGisMapServerImageryProvider
 * @see GoogleEarthEnterpriseMapsProvider
 * @see OpenStreetMapImageryProvider
 * @see SingleTileImageryProvider
 * @see TileMapServiceImageryProvider
 * @see WebMapServiceImageryProvider
 * @see WebMapTileServiceImageryProvider
 * @see UrlTemplateImageryProvider
 *
 *
 * @example
 * const geeMetadata = await GoogleEarthEnterpriseMetadata.fromUrl("http://www.example.com");
 * const gee = Cesium.GoogleEarthEnterpriseImageryProvider.fromMetadata(geeMetadata);
 *
 * @see {@link http://www.w3.org/TR/cors/|Cross-Origin Resource Sharing}
 */
function GoogleEarthEnterpriseImageryProvider(options) {
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

  this._tilingScheme = new GeographicTilingScheme({
    numberOfLevelZeroTilesX: 2,
    numberOfLevelZeroTilesY: 2,
    rectangle: new Rectangle(
      -CesiumMath.PI,
      -CesiumMath.PI,
      CesiumMath.PI,
      CesiumMath.PI,
    ),
    ellipsoid: options.ellipsoid,
  });

  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;

  this._tileWidth = 256;
  this._tileHeight = 256;
  this._maximumLevel = 23;

  // Install the default tile discard policy if none has been supplied.
  if (!defined(this._tileDiscardPolicy)) {
    this._tileDiscardPolicy = new GoogleEarthEnterpriseDiscardPolicy();
  }

  this._errorEvent = new Event();
}

Object.defineProperties(GoogleEarthEnterpriseImageryProvider.prototype, {
  /**
   * 获取托管影像的 Google Earth Enterprise 服务器 URL 名称。
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._metadata.url;
    },
  },

  /**
   * 获取此提供器使用的代理。
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return this._metadata.proxy;
    },
  },

  /**
   * 获取每个瓦片的像素宽度。
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._tileWidth;
    },
  },

  /**
   * 获取每个瓦片的像素高度。
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
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
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
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
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return 0;
    },
  },

  /**
   * 获取此提供器使用的瓦片化方案。
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取此实例提供的影像的弧度矩形区域。
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._tilingScheme.rectangle;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未定义为 undefined，则丢弃策略通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数
   * 返回 undefined，则不会过滤任何瓦片。
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._tileDiscardPolicy;
    },
  },

  /**
   * 接收 {@link TileProviderError} 的实例。
   * 获取此影像提供器激活时显示的信誉信息。通常用于显示信誉。
   * are passed an instance of {@link TileProviderError}.
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * Gets the credit to display when this imagery provider is active.  Typically this is used to credit
   * 影像来源。
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 获取一个布尔值，指示此影像提供器提供的图像是否存在。
   * 包含 alpha 通道。如果此属性为 false，则存在的 alpha 通道将被忽略。
   * 如果此属性为 true，则任何没有 alpha 通道的图像将被视为其 alpha 为 1.0。将此属性设置为 false 可减少内存使用和纹理上传时间。
   * 使用 Google Earth Enterprise REST API 创建平铺式影像提供器。
   * 可用于与 GoogleEarthEnterpriseTerrainProvider 共享元数据请求的元数据对象。
   * @memberof GoogleEarthEnterpriseImageryProvider.prototype
   * @type {boolean}
   * @readonly
   */
  hasAlphaChannel: {
    get: function () {
      return false;
    },
  },
});

/**
 * 描述初始化选项的对象。
 * @param {GoogleEarthEnterpriseMetadata} metadata 元数据对象，可用于与 GoogleEarthEnterpriseTerrainProvider 共享元数据请求。
 * @param {GoogleEarthEnterpriseImageryProvider.ConstructorOptions} options 描述初始化选项的对象。
 * @returns {GoogleEarthEnterpriseImageryProvider}
 *
 * @exception {RuntimeError} The metadata url 没有影像数据。
 *
 * @example
 * const geeMetadata = await GoogleEarthEnterpriseMetadata.fromUrl("http://www.example.com");
 * const gee = Cesium.GoogleEarthEnterpriseImageryProvider.fromMetadata(geeMetadata);
 */
GoogleEarthEnterpriseImageryProvider.fromMetadata = function (
  metadata,
  options,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("metadata", metadata);
  //>>includeEnd('debug');

  if (!metadata.imageryPresent) {
    throw new RuntimeError(`The server ${metadata.url} doesn't have imagery`);
  }

  const provider = new GoogleEarthEnterpriseImageryProvider(options);
  provider._metadata = metadata;
  return provider;
};

/**
 * 获取在显示特定瓦片时应显示的说明文字。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级；
 * @returns {Credit[]} The 在显示瓦片时应显示的说明文字。
 */
GoogleEarthEnterpriseImageryProvider.prototype.getTileCredits = function (
  x,
  y,
  level,
) {
  const metadata = this._metadata;
  const info = metadata.getTileInformation(x, y, level);
  if (defined(info)) {
    const credit = metadata.providers[info.imageryProvider];
    if (defined(credit)) {
      return [credit];
    }
  }

  return undefined;
};

/**
 * 请求特定瓦片的图像。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像承诺，当图像可用时将解析，或者
 * 如果对服务器有太多活跃请求，则视为未定义，请求将在之后重试。
 */
GoogleEarthEnterpriseImageryProvider.prototype.requestImage = function (
  x,
  y,
  level,
  request,
) {
  const invalidImage = this._tileDiscardPolicy._image; // Empty image or undefined depending on discard policy
  const metadata = this._metadata;
  const quadKey = GoogleEarthEnterpriseMetadata.tileXYToQuadKey(x, y, level);
  const info = metadata.getTileInformation(x, y, level);
  if (!defined(info)) {
    if (metadata.isValid(quadKey)) {
      const metadataRequest = new Request({
        throttle: request.throttle,
        throttleByServer: request.throttleByServer,
        type: request.type,
        priorityFunction: request.priorityFunction,
      });
      metadata.populateSubtree(x, y, level, metadataRequest);
      return undefined; // No metadata so return undefined so we can be loaded later
    }
    return Promise.resolve(invalidImage); // Image doesn't exist
  }

  if (!info.hasImagery()) {
    // Already have info and there isn't any imagery here
    return Promise.resolve(invalidImage);
  }
  const promise = buildImageResource(
    this,
    info,
    x,
    y,
    level,
    request,
  ).fetchArrayBuffer();
  if (!defined(promise)) {
    return undefined; // Throttled
  }

  return promise.then(function (image) {
    decodeGoogleEarthEnterpriseData(metadata.key, image);
    let a = new Uint8Array(image);
    let type;

    const protoImagery = metadata.protoImagery;
    if (!defined(protoImagery) || !protoImagery) {
      type = getImageType(a);
    }

    if (!defined(type) && (!defined(protoImagery) || protoImagery)) {
      const message = decodeEarthImageryPacket(a);
      type = message.imageType;
      a = message.imageData;
    }

    if (!defined(type) || !defined(a)) {
      return invalidImage;
    }

    return loadImageFromTypedArray({
      uint8Array: a,
      format: type,
      flipY: true,
    });
  });
};

/**
 * 此影像提供器目前不支持选择特征功能，因此该函数直接返回未定义值。
 * 未定义。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 选择特征的经度。
 * @param {number} latitude  选择特征的纬度。
 * @return {undefined} Undefined 由于不支持选择功能，因此返回未定义值。
 */
GoogleEarthEnterpriseImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return undefined;
};

//
// Functions to handle imagery packets
//
function buildImageResource(imageryProvider, info, x, y, level, request) {
  const quadKey = GoogleEarthEnterpriseMetadata.tileXYToQuadKey(x, y, level);
  let version = info.imageryVersion;
  version = defined(version) && version > 0 ? version : 1;

  return imageryProvider._metadata.resource.getDerivedResource({
    url: `flatfile?f1-0${quadKey}-i.${version.toString()}`,
    request: request,
  });
}

// Detects if a Uint8Array is a JPEG or PNG
function getImageType(image) {
  const jpeg = "JFIF";
  if (
    image[6] === jpeg.charCodeAt(0) &&
    image[7] === jpeg.charCodeAt(1) &&
    image[8] === jpeg.charCodeAt(2) &&
    image[9] === jpeg.charCodeAt(3)
  ) {
    return "image/jpeg";
  }

  const png = "PNG";
  if (
    image[1] === png.charCodeAt(0) &&
    image[2] === png.charCodeAt(1) &&
    image[3] === png.charCodeAt(2)
  ) {
    return "image/png";
  }

  return undefined;
}

// Decodes an Imagery protobuf into the message
// Partially generated with the help of protobuf.js static generator
function decodeEarthImageryPacket(data) {
  const reader = protobuf.Reader.create(data);
  const end = reader.len;
  const message = {};
  while (reader.pos < end) {
    const tag = reader.uint32();
    let copyrightIds;
    switch (tag >>> 3) {
      case 1:
        message.imageType = reader.uint32();
        break;
      case 2:
        message.imageData = reader.bytes();
        break;
      case 3:
        message.alphaType = reader.uint32();
        break;
      case 4:
        message.imageAlpha = reader.bytes();
        break;
      case 5:
        copyrightIds = message.copyrightIds;
        if (!defined(copyrightIds)) {
          copyrightIds = message.copyrightIds = [];
        }
        if ((tag & 7) === 2) {
          const end2 = reader.uint32() + reader.pos;
          while (reader.pos < end2) {
            copyrightIds.push(reader.uint32());
          }
        } else {
          copyrightIds.push(reader.uint32());
        }
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  const imageType = message.imageType;
  if (defined(imageType)) {
    switch (imageType) {
      case 0:
        message.imageType = "image/jpeg";
        break;
      case 4:
        message.imageType = "image/png";
        break;
      default:
        throw new RuntimeError(
          "GoogleEarthEnterpriseImageryProvider: Unsupported image type.",
        );
    }
  }

  const alphaType = message.alphaType;
  if (defined(alphaType) && alphaType !== 0) {
    console.log(
      "GoogleEarthEnterpriseImageryProvider: External alpha not supported.",
    );
    delete message.alphaType;
    delete message.imageAlpha;
  }

  return message;
}
export default GoogleEarthEnterpriseImageryProvider;
