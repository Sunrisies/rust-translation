import { Color, Event, Frozen, defined } from "@cesium/core";
import GeographicTilingScheme from "../Core/GeographicTilingScheme.js";

const defaultColor = new Color(1.0, 1.0, 1.0, 0.4);
const defaultGlowColor = new Color(0.0, 1.0, 0.0, 0.05);
const defaultBackgroundColor = new Color(0.0, 0.5, 0.0, 0.2);

/**
 * @typedef {object} GridImageryProvider.ConstructorOptions
 *
 * GridImageryProvider 构造函数的初始化选项
 *
 * @property {TilingScheme} [tilingScheme=new GeographicTilingScheme()] 绘制瓦片使用的镶嵌方案。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体。如果指定了镶嵌方案，
 * 该参数将被忽略，将使用镶嵌方案的椭球体。如果两者均未指定，
 * 则使用默认椭球体。
 * @property {number} [cells=8] 网格单元的数量。
 * @property {Color} [color=Color(1.0, 1.0, 1.0, 0.4)] 绘制网格线的颜色。
 * @property {Color} [glowColor=Color(0.0, 1.0, 0.0, 0.05)] 绘制网格线光晕的颜色。
 * @property {number} [glowWidth=6] 用于渲染线条光晕效果的线宽度。
 * @property {Color} [backgroundColor=Color(0.0, 0.5, 0.0, 0.2)] 背景填充颜色。
 * @property {number} [tileWidth=256] 用于细节级别选择的瓦片宽度。
 * @property {number} [tileHeight=256] 用于细节级别选择的瓦片高度。
 * @property {number} [canvasSize=256] 用于渲染的画布大小。
 */

/**
 * 一个在每个瓦片上绘制线框网格、具有可控制背景和光晕的 {@link ImageryProvider}。
 * 可用于自定义渲染效果或调试地形。
 *
 * @alias GridImageryProvider
 * @constructor
 * @param {GridImageryProvider.ConstructorOptions} options 描述初始化选项的对象
 *
 */
function GridImageryProvider(options) {
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

  this._tilingScheme = defined(options.tilingScheme)
    ? options.tilingScheme
    : new GeographicTilingScheme({ ellipsoid: options.ellipsoid });
  this._cells = options.cells ?? 8;
  this._color = options.color ?? defaultColor;
  this._glowColor = options.glowColor ?? defaultGlowColor;
  this._glowWidth = options.glowWidth ?? 6;
  this._backgroundColor = options.backgroundColor ?? defaultBackgroundColor;
  this._errorEvent = new Event();

  this._tileWidth = options.tileWidth ?? 256;
  this._tileHeight = options.tileHeight ?? 256;

  // A little larger than tile size so lines are sharper
  // Note: can't be too much difference otherwise texture blowout
  this._canvasSize = options.canvasSize ?? 256;

  // We only need a single canvas since all tiles will be the same
  this._canvas = this._createGridCanvas();
}

Object.defineProperties(GridImageryProvider.prototype, {
  /**
   * 获取该提供器使用的代理对象。
   * @memberof GridImageryProvider.prototype
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
   * @memberof GridImageryProvider.prototype
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
   * @memberof GridImageryProvider.prototype
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
   * @memberof GridImageryProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  maximumLevel: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取可请求的最小细节级别。
   * @memberof GridImageryProvider.prototype
   * @type {number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取该提供器使用的镶嵌方案。
   * @memberof GridImageryProvider.prototype
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
   * @memberof GridImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._tilingScheme.rectangle;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未定义为 undefined，该策略负责通过 shouldDiscardImage 函数过滤掉“缺失”的瓦片。如果该函数返回 undefined，则不会过滤任何瓦片。
   * 获取当影像提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * @memberof GridImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return undefined;
    },
  },

  /**
   * 获取当该影像提供器处于活动状态时要显示的致谢信息。通常用于显示影像来源。
   * 获取指示该影像提供器提供的图像是否包含 alpha 通道的值。如果此属性为 false，则存在的 alpha 通道将被忽略。如果此属性为 true，则没有 alpha 通道的任何图像将被视为其 alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少。
   * 在画布中绘制网格线。
   * @memberof GridImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 将网格渲染到带有背景和光晕的画布中。
   * the source of the imagery.
   * @memberof GridImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return undefined;
    },
  },

  /**
   * Gets a value indicating whether or not the images provided by this imagery provider
   * include an alpha channel.  If this property is false, an alpha channel, if present, will
   * be ignored.  If this property is true, any images without an alpha channel will be treated
   * as if their alpha is 1.0 everywhere.  When this property is false, memory usage
   * and texture upload time are reduced.
   * @memberof GridImageryProvider.prototype
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
 * Draws a grid of lines into a canvas.
 */
GridImageryProvider.prototype._drawGrid = function (context) {
  const minPixel = 0;
  const maxPixel = this._canvasSize;
  for (let x = 0; x <= this._cells; ++x) {
    const nx = x / this._cells;
    const val = 1 + nx * (maxPixel - 1);

    context.moveTo(val, minPixel);
    context.lineTo(val, maxPixel);
    context.moveTo(minPixel, val);
    context.lineTo(maxPixel, val);
  }
  context.stroke();
};

/**
 * Render a grid into a canvas with background and glow
 */
GridImageryProvider.prototype._createGridCanvas = function () {
  const canvas = document.createElement("canvas");
  canvas.width = this._canvasSize;
  canvas.height = this._canvasSize;
  const minPixel = 0;
  const maxPixel = this._canvasSize;

  const context = canvas.getContext("2d");

  // Fill the background
  const cssBackgroundColor = this._backgroundColor.toCssColorString();
  context.fillStyle = cssBackgroundColor;
  context.fillRect(minPixel, minPixel, maxPixel, maxPixel);

  // Glow for grid lines
  const cssGlowColor = this._glowColor.toCssColorString();
  context.strokeStyle = cssGlowColor;
  // Wide
  context.lineWidth = this._glowWidth;
  context.strokeRect(minPixel, minPixel, maxPixel, maxPixel);
  this._drawGrid(context);
  // Narrow
  context.lineWidth = this._glowWidth * 0.5;
  context.strokeRect(minPixel, minPixel, maxPixel, maxPixel);
  this._drawGrid(context);

  // Grid lines
  const cssColor = this._color.toCssColorString();
  // Border
  context.strokeStyle = cssColor;
  context.lineWidth = 2;
  context.strokeRect(minPixel, minPixel, maxPixel, maxPixel);
  // Inner
  context.lineWidth = 1;
  this._drawGrid(context);

  return canvas;
};

/**
 * 获取在显示特定瓦片时应显示的文字说明。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级；
 * @returns {Credit[]} The 在显示瓦片时应显示的文字说明。
 */
GridImageryProvider.prototype.getTileCredits = function (x, y, level) {
  return undefined;
};

/**
 * 请求指定瓦片的图像数据。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<HTMLCanvasElement>} The 作为 Canvas DOM 对象解析的图像数据。
 */
GridImageryProvider.prototype.requestImage = function (x, y, level, request) {
  return Promise.resolve(this._canvas);
};

/**
 * 该影像提供器目前不支持选择特征，因此此函数仅返回
 * undefined。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片层级。
 * @param {number} longitude 选择特征的经度。
 * @param {number} latitude  选择特征的纬度。
 * @return {undefined} Undefined 因为不支持选择功能。
 */
GridImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  return undefined;
};
export default GridImageryProvider;
