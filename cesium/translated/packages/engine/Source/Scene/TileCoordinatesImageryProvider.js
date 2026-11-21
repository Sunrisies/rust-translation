import { Color, Event, Frozen, defined } from "@cesium/core";
import GeographicTilingScheme from "../Core/GeographicTilingScheme.js";

/**
 * @typedef {object} TileCoordinatesImageryProvider.ConstructorOptions
 *
 * TileCoordinatesImageryProvider 构造函数的初始化选项
 *
 * @property {TilingScheme} [tilingScheme=new GeographicTilingScheme()] 用于绘制瓦片的分块方案。
 * @property {Ellipsoid} [ellipsoid] 椭球体。如果指定了分块方案，
 * 该参数将被忽略，将使用分块方案的椭球体。如果两者均未指定，
 * 则使用 WGS84 椭球体。
 * @property {Color} [color=Color.YELLOW] 绘制瓦片框和标签的颜色。
 * @property {number} [tileWidth=256] 用于细节级别选择的瓦片宽度。
 * @property {number} [tileHeight=256] 用于细节级别选择的瓦片高度。
 */

/**
 * 一个 {@link ImageryProvider}，它在分块方案中的每个渲染瓦片周围绘制一个框，并在其中绘制
 * 指示瓦片的 X、Y、细节级别坐标的标签。这主要用于
 * 调试地形和影像渲染问题。
 *
 * @alias TileCoordinatesImageryProvider
 * @constructor
 *
 * @param {TileCoordinatesImageryProvider.ConstructorOptions} [options] 描述初始化选项的对象
 */
function TileCoordinatesImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._tilingScheme = defined(options.tilingScheme)
    ? options.tilingScheme
    : new GeographicTilingScheme({ ellipsoid: options.ellipsoid });
  this._color = options.color ?? Color.YELLOW;
  this._errorEvent = new Event();
  this._tileWidth = options.tileWidth ?? 256;
  this._tileHeight = options.tileHeight ?? 256;

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
}

Object.defineProperties(TileCoordinatesImageryProvider.prototype, {
  /**
   * 获取该提供器使用的代理。
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   */
  proxy: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取每个瓦片的宽度，以像素为单位。
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._tileWidth;
    },
  },

  /**
   * 获取每个瓦片的高度，以像素为单位。
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  tileHeight: {
    get: function () {
      return this._tileHeight;
    },
  },

  /**
   * 获取可以请求的最大细节级别。
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  maximumLevel: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取可以请求的最小细节级别。
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取该提供器使用的分块方案。
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取本实例提供的影像的矩形区域，以弧度为单位。
   * @memberof TileCoordinatesImageryProvider.prototype
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
   * for filtering out "missing" tiles via its shouldDiscardImage function.  If this function
   * 返回 undefined，则不会过滤任何瓦片。
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取影像提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * are passed an instance of {@link TileProviderError}.
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 获取当该影像提供器激活时要显示的致谢信息。通常用于显示影像来源的致谢。
   * 指示该影像提供器提供的图像是否包含 alpha 通道的值。如果此属性为 false，则存在的 alpha 通道将被忽略。如果此属性为 true，则没有 alpha 通道的任何图像将被视为其 alpha 为 1.0。将此属性设置为 false 可减少内存使用和纹理上传时间。
   * @memberof TileCoordinatesImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取当显示特定瓦片时要显示的致谢信息。
   * 瓦片的 X 坐标。
   * 瓦片的 Y 坐标。
   * 瓦片的细节级别；
   * 当显示瓦片时要显示的致谢信息。
   * @memberof TileCoordinatesImageryProvider.prototype
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
 * Gets the credits to be displayed when a given tile is displayed.
 *
 * @param {number} x The tile X coordinate.
 * @param {number} y The tile Y coordinate.
 * @param {number} level The tile level;
 * @returns {Credit[]} The credits to be displayed when the tile is displayed.
 */
TileCoordinatesImageryProvider.prototype.getTileCredits = function (
  x,
  y,
  level,
) {
  return undefined;
};

/**
 * 针对指定的瓦片请求影像数据。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<HTMLCanvasElement>} The 以 Canvas DOM 对象形式呈现的解析影像。
 */
TileCoordinatesImageryProvider.prototype.requestImage = function (
  x,
  y,
  level,
  request,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  const cssColor = this._color.toCssColorString();

  context.strokeStyle = cssColor;
  context.lineWidth = 2;
  context.strokeRect(1, 1, 255, 255);

  context.font = "bold 25px Arial";
  context.textAlign = "center";
  context.fillStyle = cssColor;
  context.fillText(`L: ${level}`, 124, 86);
  context.fillText(`X: ${x}`, 124, 136);
  context.fillText(`Y: ${y}`, 124, 186);

  return Promise.resolve(canvas);
};

/**
 * 当前该影像提供器不支持选择功能，因此此函数仅返回
 * 未定义值。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 用于选择功能的经度。
 * @param {number} latitude  用于选择功能的纬度。
 * @return {undefined} Undefined 由于不支持选择功能，因此返回未定义值。
 */
TileCoordinatesImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return undefined;
};
export default TileCoordinatesImageryProvider;