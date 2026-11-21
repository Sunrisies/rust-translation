import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Check,
  Event,
  Frozen,
  GeographicProjection,
  Math as CesiumMath,
  Rectangle,
  combine,
  defined,
} from "@cesium/core";
import Credit from "../Core/Credit.js";
import Resource from "../Core/Resource.js";
import WebMercatorTilingScheme from "../Core/WebMercatorTilingScheme.js";
import ImageryProvider from "./ImageryProvider.js";

const templateRegex = /{[^}]+}/g;

const tags = {
  x: xTag,
  y: yTag,
  z: zTag,
  s: sTag,
  reverseX: reverseXTag,
  reverseY: reverseYTag,
  reverseZ: reverseZTag,
  westDegrees: westDegreesTag,
  southDegrees: southDegreesTag,
  eastDegrees: eastDegreesTag,
  northDegrees: northDegreesTag,
  westProjected: westProjectedTag,
  southProjected: southProjectedTag,
  eastProjected: eastProjectedTag,
  northProjected: northProjectedTag,
  width: widthTag,
  height: heightTag,
};

const pickFeaturesTags = combine(tags, {
  i: iTag,
  j: jTag,
  reverseI: reverseITag,
  reverseJ: reverseJTag,
  longitudeDegrees: longitudeDegreesTag,
  latitudeDegrees: latitudeDegreesTag,
  longitudeProjected: longitudeProjectedTag,
  latitudeProjected: latitudeProjectedTag,
  format: formatTag,
});

/**
 * @typedef {object} UrlTemplateImageryProvider.ConstructorOptions
 *
 * UrlTemplateImageryProvider 构造函数的初始化选项
 *
 * @property {Resource|string} url  用于请求瓦片的URL 模板。它包含以下关键字：
 * <ul>
 * <li><code>{z}</code>：瓦片在镶嵌方案中的层级。零级是四叉树金字塔的根节点。
 * <li><code>{x}</code>：瓦片在镶嵌方案中的 X 坐标，其中 0 为最西边的瓦片。
 * <li><code>{y}</code>：瓦片在镶嵌方案中的 Y 坐标，其中 0 为最北边的瓦片。
 * <li><code>{s}</code>：可用的子域之一，用于克服浏览器对每个主机同时请求数量的限制。
 * <li><code>{reverseX}</code>：瓦片在镶嵌方案中的 X 坐标，其中 0 为最东边的瓦片。
 * <li><code>{reverseY}</code>：瓦片在镶嵌方案中的 Y 坐标，其中 0 为最南边的瓦片。
 * <li><code>{reverseZ}</code>：瓦片在镶嵌方案中的层级，零级是四叉树金字塔的最高层级。要使用 reverseZ，必须定义 maximumLevel。
 * <li><code>{westDegrees}</code>：瓦片的西边缘，以大地度为单位。
 * <li><code>{southDegrees}</code>：瓦片的南边缘，以大地度为单位。
 * <li><code>{eastDegrees}</code>：瓦片的东边缘，以大地度为单位。
 * <li><code>{northDegrees}</code>：瓦片的北边缘，以大地度为单位。
 * <li><code>{westProjected}</code>：瓦片在镶嵌方案的投影坐标中的西边缘。
 * <li><code>{southProjected}</code>：瓦片在镶嵌方案的投影坐标中的南边缘。
 * <li><code>{eastProjected}</code>：瓦片在镶嵌方案的投影坐标中的东边缘。
 * <li><code>{northProjected}</code>：瓦片在镶嵌方案的投影坐标中的北边缘。
 * <li><code>{width}</code>：每个瓦片的像素宽度。
 * <li><code>{height}</code>：每个瓦片的像素高度。
 * </ul>
 * @property {Resource|string} [pickFeaturesUrl] 用于选择要素的URL 模板。如果未指定此属性，
 * {@link UrlTemplateImageryProvider#pickFeatures} 将立即返回 undefined，表示没有
 * 被选择的要素。URL 模板支持 <code>url</code> 所支持的所有关键字。
 * 参数及以下内容：
 * <ul>
 * <li><code>{i}</code>: 选中位置的像素列（水平坐标），最西边的像素为 0。</li>
 * <li><code>{j}</code>: 选中位置的像素行（垂直坐标），最北边的像素为 0。</li>
 * <li><code>{reverseI}</code>: 选中位置的像素列（水平坐标），最东边的像素为 0。</li>
 * <li><code>{reverseJ}</code>: 选中位置的像素行（垂直坐标），最南边的像素为 0。</li>
 * <li><code>{longitudeDegrees}</code>: 选中位置的经度，单位：度。</li>
 * <li><code>{latitudeDegrees}</code>: 选中位置的纬度，单位：度。</li>
 * <li><code>{longitudeProjected}</code>: 选中位置的经度，以镶嵌方案下的投影坐标表示。</li>
 * <li><code>{latitudeProjected}</code>: 选中位置的纬度，以镶嵌方案下的投影坐标表示。</li>
 * <li><code>{format}</code>: 获取要素信息的格式，参见 {@link GetFeatureInfoFormat}。</li>
 * </ul>
 * @property {object} [urlSchemeZeroPadding] 获取每个瓦片坐标的 URL 方案零填充值。格式为 '000'，其中
 * 每个坐标左侧用零填充以匹配传入的零字符串宽度。例如：
 * urlSchemeZeroPadding : { '{x}' : '0000'}
 * 会导致在生成的 URL 中，{x} 的值变为 12，返回字符串 '0012'。
 * 如果传入的对象包含以下关键字：
 * <ul>
 * <li> <code>{z}</code>: 镶嵌方案中瓦片的层级零填充值。</li>
 * <li> <code>{x}</code>: 镶嵌方案中瓦片 X 坐标的零填充值。</li>
 * <li> <code>{y}</code>: 镶嵌方案中瓦片 Y 坐标的零填充值。</li>
 * <li> <code>{reverseX}</code>: 镶嵌方案中瓦片 reverseX 坐标的零填充值。</li>
 * <li> <code>{reverseY}</code>: 镶嵌方案中瓦片 reverseY 坐标的零填充值。</li>
 * <li> <code>{reverseZ}</code>: 镶嵌方案中瓦片的 reverseZ 坐标的零填充值。</li>
 * </ul>
 * @property {string|string[]} [subdomains='abc'] URL 模板中 <code>{s}</code> 占位符使用的子域。
 * 如果此参数为单个字符串，则字符串中的每个字符都是一个子域。如果是
 * 一个数组，数组中的每个元素都是一个子域。
 * @property {Credit|string} [credit=''] 在画布上显示的数据源的引用。
 * @property {number} [minimumLevel=0] 影像提供商支持的最小细节级别。指定时请注意，最小级别下的瓦片数量应较少，例如四片或更少。数量过多可能导致渲染问题。
 * 影像提供商支持的最大细节级别，如果没有限制则定义为未定义。
 * 图像所覆盖的矩形区域，以弧度为单位。
 * @property {number} [maximumLevel] 指定椭球体表面被划分为瓦片的 tiling 方案。如果未提供此参数，则使用 {@link WebMercatorTilingScheme}。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 椭球体。如果指定了 tilingScheme，则忽略此参数，使用 tiling 方案的椭球体。如果两者均未指定，则使用 WGS84 椭球体。
 * @property {TilingScheme} [tilingScheme=WebMercatorTilingScheme] 图像瓦片的像素宽度。
 * surface is broken into tiles.  If this parameter is not provided, a {@link WebMercatorTilingScheme}
 * 如果此影像提供商提供的图像包含 Alpha 通道，则为 true；否则为 false。如果此属性为 false，则存在的 Alpha 通道将被忽略。如果此属性为 true，则没有 Alpha 通道的任何图像将被视为其 Alpha 为 1.0。当此属性为 false 时，内存使用和纹理上传时间可能会减少。
 * @property {Ellipsoid} [ellipsoid] 在调用 {@link UrlTemplateImageryProvider#pickFeatures} 时，获取特定位置特征信息的格式。如果未指定此参数，则禁用特征选择功能。
 * 如果为 true，{@link UrlTemplateImageryProvider#pickFeatures} 将请求 <code>pickFeaturesUrl</code> 并尝试解析响应中的特征。如果为 false，{@link UrlTemplateImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选择的
 * 特征），而不会与服务器通信。如果知道数据来源不支持特征选择或不想让此提供商的特征可选择，请将此属性设置为 false。注意，可以通过修改 {@link UriTemplateImageryProvider#enablePickFeatures} 属性来动态覆盖此设置。
 * @property {number} [tileWidth=256] 根据某些标准丢弃瓦片图像的策略。
 * @property {number} [tileHeight=256] 允许在 URL 模板中替换自定义关键词。对象必须以字符串作为键，以函数作为值。
 * @property {boolean} [hasAlphaChannel=true] true if the images provided by this imagery provider
 * include an alpha channel; otherwise, false.  If this property is false, an alpha channel, if
 * present, will be ignored.  If this property is true, any images without an alpha channel will
 * be treated as if their alpha is 1.0 everywhere.  When this property is false, memory usage
 * and texture upload time are potentially reduced.
 * @property {GetFeatureInfoFormat[]} [getFeatureInfoFormats] The formats in which to get feature information at a
 * specific location when {@link UrlTemplateImageryProvider#pickFeatures} is invoked.  If this
 * parameter is not specified, feature picking is disabled.
 * @property {boolean} [enablePickFeatures=true] If true, {@link UrlTemplateImageryProvider#pickFeatures} will
 * request the <code>pickFeaturesUrl</code> and attempt to interpret the features included in the response.  If false,
 * {@link UrlTemplateImageryProvider#pickFeatures} will immediately return undefined (indicating no pickable
 * features) without communicating with the server.  Set this property to false if you know your data
 * source does not support picking features or if you don't want this provider's features to be pickable. Note
 * that this can be dynamically overridden by modifying the {@link UriTemplateImageryProvider#enablePickFeatures}
 * property.
 * @property {TileDiscardPolicy} [tileDiscardPolicy] A policy for discarding tile images according to some criteria
 * @property {object} [customTags] Allow to replace custom keywords in the URL template. The object must have strings as keys and functions as values.
 */

/**
 * 通过使用指定的 URL 模板请求瓦片来提供影像。
 *
 * @alias UrlTemplateImageryProvider
 * @constructor
 *
 * @param {UrlTemplateImageryProvider.ConstructorOptions} options 描述初始化选项的对象。
 *
 * @example
 * // 访问使用 TMS 瓦片方案和地理坐标系 (EPSG:4326) 的 Natural Earth II 影像。
 * const tms = new Cesium.UrlTemplateImageryProvider({
 * url : Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII') + '/{z}/{x}/{reverseY}.jpg',
 * tilingScheme : new Cesium.GeographicTilingScheme(),
 * maximumLevel : 5
 * });
 * // 访问使用类似 OpenStreetMap 的瓦片方案的 CartoDB Positron 基础地图。
 * const positron = new Cesium.UrlTemplateImageryProvider({
 * url : 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
 * credit : 'Map tiles by CartoDB, under CC BY 3.0. Data by OpenStreetMap, under ODbL.'
 * });
 * // 访问 Web 地图服务 (WMS) 服务器。
 * const wms = new Cesium.UrlTemplateImageryProvider({
 * url : 'https://services.ga.gov.au/gis/services/NM_Hydrology_and_Marine_Points/MapServer/WMSServer?' +
 * 'tiled=true&transparent=true&format=image%2Fpng&exceptions=application%2Fvnd.ogc.se_xml&' +
 * 'styles=&service=WMS&version=1.3.0&request=GetMap&' +
 * 'layers=Bores&crs=EPSG%3A3857&' +
 * 'bbox={westProjected}%2C{southProjected}%2C{eastProjected}%2C{northProjected}&' +
 * 'width=256&height=256',
 * rectangle : Cesium.Rectangle.fromDegrees(95.0, -55.0, 170.0, -1.0)  // From GetCapabilities EX_GeographicBoundingBox
 * });
 * // 在模板 URL 中使用自定义标签。
 * const custom = new Cesium.UrlTemplateImageryProvider({
 * url : 'https://yoururl/{Time}/{z}/{y}/{x}.png',
 * customTags : {
 * Time: function(imageryProvider, x, y, level) {
 * return '20171231'
 *        }
 *    }
 * });
 *
 * @see ArcGisMapServerImageryProvider
 * @see BingMapsImageryProvider
 * @see GoogleEarthEnterpriseMapsProvider
 * @see OpenStreetMapImageryProvider
 * @see SingleTileImageryProvider
 * @see TileMapServiceImageryProvider
 * @see WebMapServiceImageryProvider
 * @see WebMapTileServiceImageryProvider
 */
function UrlTemplateImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._errorEvent = new Event();

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.url", options.url);
  //>>includeEnd('debug');

  const resource = Resource.createIfNeeded(options.url);
  const pickFeaturesResource = Resource.createIfNeeded(options.pickFeaturesUrl);

  this._resource = resource;
  this._urlSchemeZeroPadding = options.urlSchemeZeroPadding;
  this._getFeatureInfoFormats = options.getFeatureInfoFormats;
  this._pickFeaturesResource = pickFeaturesResource;

  let subdomains = options.subdomains;
  if (Array.isArray(subdomains)) {
    subdomains = subdomains.slice();
  } else if (defined(subdomains) && subdomains.length > 0) {
    subdomains = subdomains.split("");
  } else {
    subdomains = ["a", "b", "c"];
  }
  this._subdomains = subdomains;

  this._tileWidth = options.tileWidth ?? 256;
  this._tileHeight = options.tileHeight ?? 256;
  this._minimumLevel = options.minimumLevel ?? 0;
  this._maximumLevel = options.maximumLevel;
  this._tilingScheme =
    options.tilingScheme ??
    new WebMercatorTilingScheme({ ellipsoid: options.ellipsoid });

  this._rectangle = options.rectangle ?? this._tilingScheme.rectangle;
  this._rectangle = Rectangle.intersection(
    this._rectangle,
    this._tilingScheme.rectangle,
  );

  this._tileDiscardPolicy = options.tileDiscardPolicy;

  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;
  this._hasAlphaChannel = options.hasAlphaChannel ?? true;

  const customTags = options.customTags;
  const allTags = combine(tags, customTags);
  const allPickFeaturesTags = combine(pickFeaturesTags, customTags);
  this._tags = allTags;
  this._pickFeaturesTags = allPickFeaturesTags;

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

  /**
   * 获取或设置指示是否启用特征选择的值。如果为 true，{@link UrlTemplateImageryProvider#pickFeatures} 将
   * 请求 <code>options.pickFeaturesUrl</code> 并尝试解析响应中包含的特征。如果为 false，
   * {@link UrlTemplateImageryProvider#pickFeatures} 将立即返回 undefined（表示没有可选择的
   * 特征）而无需与服务器通信。如果知道数据来源不支持特征选择或不想让此提供商的特征可选择，请将此属性设置为 false。
   * 获取用于请求瓦片的 URL 模板。它包含以下关键字：
   * @type {boolean}
   * @default true
   */
  this.enablePickFeatures = options.enablePickFeatures ?? true;
}

Object.defineProperties(UrlTemplateImageryProvider.prototype, {
  /**
   * <li> <code>{z}</code>: 瓦片在瓦片方案中的层级。零级是四叉树金字塔的根节点。
   * <ul>
   * <li> <code>{z}</code>: The level of the tile in the tiling scheme.  Level zero is the root of the quadtree pyramid.</li>
   * <li> <code>{x}</code>: 镶嵌方案中的瓦片 X 坐标，其中 0 为最西边的瓦片。</li>
   * <li> <code>{y}</code>: 镶嵌方案中的瓦片 Y 坐标，其中 0 为最北边的瓦片。</li>
   * <li> <code>{s}</code>: 可用的子域之一，用于克服浏览器对每个主机同时请求数量的限制。</li>
   * <li> <code>{reverseX}</code>: 镶嵌方案中的瓦片 X 坐标，其中 0 为最东边的瓦片。</li>
   * <li> <code>{reverseY}</code>: 镶嵌方案中的瓦片 Y 坐标，其中 0 为最南边的瓦片。</li>
   * <li> <code>{reverseZ}</code>: 镶嵌方案中瓦片的层级，其中层级零为四叉树金字塔的最高层级。要使用 reverseZ，必须定义 maximumLevel。</li>
   * <li> <code>{westDegrees}</code>: 瓦片在大地坐标中的西边缘度数。</li>
   * <li> <code>{southDegrees}</code>: 瓦片在大地坐标中的南边缘度数。</li>
   * <li> <code>{eastDegrees}</code>: 瓦片在大地坐标中的东边缘度数。</li>
   * <li> <code>{northDegrees}</code>: 瓦片在大地坐标中的北边缘度数。</li>
   * <li> <code>{westProjected}</code>: 镶嵌方案中的瓦片在投影坐标中的西边缘。</li>
   * <li> <code>{southProjected}</code>: 镶嵌方案中的瓦片在投影坐标中的南边缘。</li>
   * <li> <code>{eastProjected}</code>: 镶嵌方案中的瓦片在投影坐标中的东边缘。</li>
   * <li> <code>{northProjected}</code>: 镶嵌方案中的瓦片在投影坐标中的北边缘。</li>
   * <li> <code>{width}</code>: 每个瓦片的像素宽度。</li>
   * <li> <code>{height}</code>: 每个瓦片的像素高度。</li>
   * </ul>
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._resource.url;
    },
  },

  /**
   * 获取每个瓦片坐标的 URL 方案零填充值。格式为 '000'，其中每个坐标左侧都会填充零以匹配传入的零字符串宽度。例如，设置如下：
   * urlSchemeZeroPadding : { '{x}' : '0000'}
   * 会导致 {x} 的值变为 12，从而在生成的 URL 中返回字符串 '0012'。
   * 它包含以下关键字：
   * <li> <code>{z}</code>: 镶嵌方案中瓦片层级的零填充值。</li>
   * <ul>
   * <li> <code>{x}</code>: 镶嵌方案中瓦片 X 坐标的零填充值。</li>
   * <li> <code>{x}</code>: The zero padding for the tile X coordinate in the tiling scheme.</li>
   * <li> <code>{y}</code>: 切片方案中瓦片 Y 坐标的零填充值。</li>
   * <li> <code>{reverseX}</code>: 切片方案中瓦片 reverseX 坐标的零填充值。</li>
   * <li> <code>{reverseY}</code>: 切片方案中瓦片 reverseY 坐标的零填充值。</li>
   * <li> <code>{reverseZ}</code>: 切片方案中瓦片的 reverseZ 坐标的零填充值。</li>
   * </ul>
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {object}
   * @readonly
   */
  urlSchemeZeroPadding: {
    get: function () {
      return this._urlSchemeZeroPadding;
    },
  },

  /**
   * 获取用于选择特征的 URL 模板。如果未指定此属性，
   * {@link UrlTemplateImageryProvider#pickFeatures} 将立即返回 undefined，表示没有选择任何特征。URL 模板支持
   * {@link UrlTemplateImageryProvider#url} 属性所支持的所有关键词，此外还支持以下内容：
   * {@link UrlTemplateImageryProvider#url} property, plus the following:
   * <ul>
   * <li><code>{i}</code>: The pixel column (horizontal coordinate) of the picked position, where the Westernmost pixel is 0.</li>
   * <li><code>{j}</code>: 被选择位置的像素行（垂直坐标），最北端像素为 0。</li>
   * <li><code>{reverseI}</code>: 被选择位置的像素列（水平坐标），最东端像素为 0。</li>
   * <li><code>{reverseJ}</code>: 被选择位置的像素行（垂直坐标），最南端像素为 0。</li>
   * <li><code>{longitudeDegrees}</code>: 被选择位置的经度，以度为单位。</li>
   * <li><code>{latitudeDegrees}</code>: 被选择位置的纬度，以度为单位。</li>
   * <li><code>{longitudeProjected}</code>: 被选择位置的经度，以切片方案的投影坐标表示。</li>
   * <li><code>{latitudeProjected}</code>: 被选择位置的纬度，以切片方案的投影坐标表示。</li>
   * <li><code>{format}</code>: 获取特征信息的格式，如 {@link GetFeatureInfoFormat} 中所述。</li>
   * </ul>
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {string}
   * @readonly
   */
  pickFeaturesUrl: {
    get: function () {
      return this._pickFeaturesResource.url;
    },
  },

  /**
   * 获取此提供器使用的代理对象。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {Proxy}
   * @readonly
   * @default undefined
   */
  proxy: {
    get: function () {
      return this._resource.proxy;
    },
  },

  /**
   * 获取每个瓦片的宽度，以像素为单位。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {number}
   * @readonly
   * @default 256
   */
  tileWidth: {
    get: function () {
      return this._tileWidth;
    },
  },

  /**
   * 获取每个瓦片的高度，以像素为单位。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {number}
   * @readonly
   * @default 256
   */
  tileHeight: {
    get: function () {
      return this._tileHeight;
    },
  },

  /**
   * 获取可请求的最大细节级别，如果没有限制则返回 undefined。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {number|undefined}
   * @readonly
   * @default undefined
   */
  maximumLevel: {
    get: function () {
      return this._maximumLevel;
    },
  },

  /**
   * 获取可请求的最小细节级别。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {number}
   * @readonly
   * @default 0
   */
  minimumLevel: {
    get: function () {
      return this._minimumLevel;
    },
  },

  /**
   * 获取此提供器使用的切片方案。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   * @default new WebMercatorTilingScheme()
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取此实例提供的影像的矩形区域，以弧度为单位。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   * @default tilingScheme.rectangle
   */
  rectangle: {
    get: function () {
      return this._rectangle;
    },
  },

  /**
   * 获取瓦片丢弃策略。如果未定义为 undefined，则使用该策略来过滤掉“缺失”的瓦片，通过 shouldDiscardImage 函数实现。
   * 如果此函数返回 undefined，则不会过滤任何瓦片。
   * 当影像提供程序遇到异步错误时，会触发一个事件。通过订阅该事件，您可以收到错误通知并可能进行恢复处理。事件监听器接收 {@link TileProviderError} 的实例。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   * @default undefined
   */
  tileDiscardPolicy: {
    get: function () {
      return this._tileDiscardPolicy;
    },
  },

  /**
   * 获取影像提供程序处于活动状态时要显示的标签。通常用于显示影像来源的相关信息。
   * 获取指示该影像提供程序提供的图像是否包含 alpha 通道的值。如果此属性为 false，则存在的 alpha 通道将被忽略；如果为 true，则没有 alpha 通道的图像将被视为其 alpha 值为 1.0。当此属性为 false 时，内存使用和纹理上传时间都会减少。
   * are passed an instance of {@link TileProviderError}.
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 瓦片 X 坐标。
   * 瓦片 Y 坐标。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {Credit}
   * @readonly
   * @default undefined
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 瓦片级别。
   * 瓦片 X 坐标。
   * 瓦片 Y 坐标。
   * 瓦片级别。
   * 请求对象。仅用于内部使用。
   * @memberof UrlTemplateImageryProvider.prototype
   * @type {boolean}
   * @readonly
   * @default true
   */
  hasAlphaChannel: {
    get: function () {
      return this._hasAlphaChannel;
    },
  },
});

/**
 * 图像可用时将解析的图像承诺；或者如果向服务器发送的请求过多，则请求被推迟，等待后续重试。
 *
 * @param {number} x 异步确定在给定经度和纬度范围内是否存在任何特征。
 * @param {number} y 瓦片 X 坐标。
 * @param {number} level 瓦片 Y 坐标。
 * @returns {Credit[]} The 显示瓦片时的标签。
 */
UrlTemplateImageryProvider.prototype.getTileCredits = function (x, y, level) {
  return undefined;
};

/**
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片级别。
 * @param {Request} [request] 请求对象。仅用于内部使用。
 * @returns {Promise<ImageryTypes>|undefined} A 图像承诺，当图像可用时解析；或者如果活动请求过多且请求需要重试，则返回 undefined。
 * 异步确定在给定经度和纬度范围内是否存在特征。
 */
UrlTemplateImageryProvider.prototype.requestImage = function (
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
 * 异步确定在给定经度和纬度范围内是否存在特征。
 * 瓦片 X 坐标。
 *
 * @param {number} x 瓦片 X 坐标。
 * @param {number} y 瓦片 Y 坐标。
 * @param {number} level 瓦片级别。
 * @param {number} longitude 选择特征的经度。
 * @param {number} latitude  选择特征的纬度。
 * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 异步选择完成时的特征承诺。解析值是一个 {@link ImageryLayerFeatureInfo} 实例数组。如果给定位置没有找到特征，该数组可能为空。
 *                   picking completes.  The resolved value is an array of {@link ImageryLayerFeatureInfo}
 * instances.  The array may be empty if no features are found at the given location.
 * It may also be undefined if picking is not supported.
 */
UrlTemplateImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude,
) {
  if (
    !this.enablePickFeatures ||
    !defined(this._pickFeaturesResource) ||
    this._getFeatureInfoFormats.length === 0
  ) {
    return undefined;
  }

  let formatIndex = 0;

  const that = this;

  function handleResponse(format, data) {
    return format.callback(data);
  }

  function doRequest() {
    if (formatIndex >= that._getFeatureInfoFormats.length) {
      // No valid formats, so no features picked.
      return Promise.resolve([]);
    }

    const format = that._getFeatureInfoFormats[formatIndex];
    const resource = buildPickFeaturesResource(
      that,
      x,
      y,
      level,
      longitude,
      latitude,
      format.format,
    );

    ++formatIndex;

    if (format.type === "json") {
      return resource.fetchJson().then(format.callback).catch(doRequest);
    } else if (format.type === "xml") {
      return resource.fetchXML().then(format.callback).catch(doRequest);
    } else if (format.type === "text" || format.type === "html") {
      return resource.fetchText().then(format.callback).catch(doRequest);
    }
    return resource
      .fetch({
        responseType: format.format,
      })
      .then(handleResponse.bind(undefined, format))
      .catch(doRequest);
  }

  return doRequest();
};

let degreesScratchComputed = false;
const degreesScratch = new Rectangle();
let projectedScratchComputed = false;
const projectedScratch = new Rectangle();

function buildImageResource(imageryProvider, x, y, level, request) {
  degreesScratchComputed = false;
  projectedScratchComputed = false;

  const resource = imageryProvider._resource;
  const url = resource.getUrlComponent(true);
  const allTags = imageryProvider._tags;
  const templateValues = {};

  const match = url.match(templateRegex);
  if (defined(match)) {
    match.forEach(function (tag) {
      const key = tag.substring(1, tag.length - 1); //strip {}
      if (defined(allTags[key])) {
        templateValues[key] = allTags[key](imageryProvider, x, y, level);
      }
    });
  }

  return resource.getDerivedResource({
    request: request,
    templateValues: templateValues,
  });
}

let ijScratchComputed = false;
const ijScratch = new Cartesian2();
let longitudeLatitudeProjectedScratchComputed = false;

function buildPickFeaturesResource(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  format,
) {
  degreesScratchComputed = false;
  projectedScratchComputed = false;
  ijScratchComputed = false;
  longitudeLatitudeProjectedScratchComputed = false;

  const resource = imageryProvider._pickFeaturesResource;
  const url = resource.getUrlComponent(true);
  const allTags = imageryProvider._pickFeaturesTags;
  const templateValues = {};
  const match = url.match(templateRegex);
  if (defined(match)) {
    match.forEach(function (tag) {
      const key = tag.substring(1, tag.length - 1); //strip {}
      if (defined(allTags[key])) {
        templateValues[key] = allTags[key](
          imageryProvider,
          x,
          y,
          level,
          longitude,
          latitude,
          format,
        );
      }
    });
  }

  return resource.getDerivedResource({
    templateValues: templateValues,
  });
}

function padWithZerosIfNecessary(imageryProvider, key, value) {
  if (
    imageryProvider &&
    imageryProvider.urlSchemeZeroPadding &&
    imageryProvider.urlSchemeZeroPadding.hasOwnProperty(key)
  ) {
    const paddingTemplate = imageryProvider.urlSchemeZeroPadding[key];
    if (typeof paddingTemplate === "string") {
      const paddingTemplateWidth = paddingTemplate.length;
      if (paddingTemplateWidth > 1) {
        value =
          value.length >= paddingTemplateWidth
            ? value
            : new Array(
                paddingTemplateWidth - value.toString().length + 1,
              ).join("0") + value;
      }
    }
  }
  return value;
}

function xTag(imageryProvider, x, y, level) {
  return padWithZerosIfNecessary(imageryProvider, "{x}", x);
}

function reverseXTag(imageryProvider, x, y, level) {
  const reverseX =
    imageryProvider.tilingScheme.getNumberOfXTilesAtLevel(level) - x - 1;
  return padWithZerosIfNecessary(imageryProvider, "{reverseX}", reverseX);
}

function yTag(imageryProvider, x, y, level) {
  return padWithZerosIfNecessary(imageryProvider, "{y}", y);
}

function reverseYTag(imageryProvider, x, y, level) {
  const reverseY =
    imageryProvider.tilingScheme.getNumberOfYTilesAtLevel(level) - y - 1;
  return padWithZerosIfNecessary(imageryProvider, "{reverseY}", reverseY);
}

function reverseZTag(imageryProvider, x, y, level) {
  const maximumLevel = imageryProvider.maximumLevel;
  const reverseZ =
    defined(maximumLevel) && level < maximumLevel
      ? maximumLevel - level - 1
      : level;
  return padWithZerosIfNecessary(imageryProvider, "{reverseZ}", reverseZ);
}

function zTag(imageryProvider, x, y, level) {
  return padWithZerosIfNecessary(imageryProvider, "{z}", level);
}

function sTag(imageryProvider, x, y, level) {
  const index = (x + y + level) % imageryProvider._subdomains.length;
  return imageryProvider._subdomains[index];
}

function computeDegrees(imageryProvider, x, y, level) {
  if (degreesScratchComputed) {
    return;
  }

  imageryProvider.tilingScheme.tileXYToRectangle(x, y, level, degreesScratch);
  degreesScratch.west = CesiumMath.toDegrees(degreesScratch.west);
  degreesScratch.south = CesiumMath.toDegrees(degreesScratch.south);
  degreesScratch.east = CesiumMath.toDegrees(degreesScratch.east);
  degreesScratch.north = CesiumMath.toDegrees(degreesScratch.north);

  degreesScratchComputed = true;
}

function westDegreesTag(imageryProvider, x, y, level) {
  computeDegrees(imageryProvider, x, y, level);
  return degreesScratch.west;
}

function southDegreesTag(imageryProvider, x, y, level) {
  computeDegrees(imageryProvider, x, y, level);
  return degreesScratch.south;
}

function eastDegreesTag(imageryProvider, x, y, level) {
  computeDegrees(imageryProvider, x, y, level);
  return degreesScratch.east;
}

function northDegreesTag(imageryProvider, x, y, level) {
  computeDegrees(imageryProvider, x, y, level);
  return degreesScratch.north;
}

function computeProjected(imageryProvider, x, y, level) {
  if (projectedScratchComputed) {
    return;
  }

  imageryProvider.tilingScheme.tileXYToNativeRectangle(
    x,
    y,
    level,
    projectedScratch,
  );

  projectedScratchComputed = true;
}

function westProjectedTag(imageryProvider, x, y, level) {
  computeProjected(imageryProvider, x, y, level);
  return projectedScratch.west;
}

function southProjectedTag(imageryProvider, x, y, level) {
  computeProjected(imageryProvider, x, y, level);
  return projectedScratch.south;
}

function eastProjectedTag(imageryProvider, x, y, level) {
  computeProjected(imageryProvider, x, y, level);
  return projectedScratch.east;
}

function northProjectedTag(imageryProvider, x, y, level) {
  computeProjected(imageryProvider, x, y, level);
  return projectedScratch.north;
}

function widthTag(imageryProvider, x, y, level) {
  return imageryProvider.tileWidth;
}

function heightTag(imageryProvider, x, y, level) {
  return imageryProvider.tileHeight;
}

function iTag(imageryProvider, x, y, level, longitude, latitude, format) {
  computeIJ(imageryProvider, x, y, level, longitude, latitude);
  return ijScratch.x;
}

function jTag(imageryProvider, x, y, level, longitude, latitude, format) {
  computeIJ(imageryProvider, x, y, level, longitude, latitude);
  return ijScratch.y;
}

function reverseITag(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  format,
) {
  computeIJ(imageryProvider, x, y, level, longitude, latitude);
  return imageryProvider.tileWidth - ijScratch.x - 1;
}

function reverseJTag(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  format,
) {
  computeIJ(imageryProvider, x, y, level, longitude, latitude);
  return imageryProvider.tileHeight - ijScratch.y - 1;
}

const rectangleScratch = new Rectangle();
const longitudeLatitudeProjectedScratch = new Cartesian3();

function computeIJ(imageryProvider, x, y, level, longitude, latitude, format) {
  if (ijScratchComputed) {
    return;
  }

  computeLongitudeLatitudeProjected(
    imageryProvider,
    x,
    y,
    level,
    longitude,
    latitude,
  );
  const projected = longitudeLatitudeProjectedScratch;

  const rectangle = imageryProvider.tilingScheme.tileXYToNativeRectangle(
    x,
    y,
    level,
    rectangleScratch,
  );
  ijScratch.x =
    ((imageryProvider.tileWidth * (projected.x - rectangle.west)) /
      rectangle.width) |
    0;
  ijScratch.y =
    ((imageryProvider.tileHeight * (rectangle.north - projected.y)) /
      rectangle.height) |
    0;
  ijScratchComputed = true;
}

function longitudeDegreesTag(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  format,
) {
  return CesiumMath.toDegrees(longitude);
}

function latitudeDegreesTag(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  format,
) {
  return CesiumMath.toDegrees(latitude);
}

function longitudeProjectedTag(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  format,
) {
  computeLongitudeLatitudeProjected(
    imageryProvider,
    x,
    y,
    level,
    longitude,
    latitude,
  );
  return longitudeLatitudeProjectedScratch.x;
}

function latitudeProjectedTag(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  format,
) {
  computeLongitudeLatitudeProjected(
    imageryProvider,
    x,
    y,
    level,
    longitude,
    latitude,
  );
  return longitudeLatitudeProjectedScratch.y;
}

const cartographicScratch = new Cartographic();

function computeLongitudeLatitudeProjected(
  imageryProvider,
  x,
  y,
  level,
  longitude,
  latitude,
  format,
) {
  if (longitudeLatitudeProjectedScratchComputed) {
    return;
  }

  if (imageryProvider.tilingScheme.projection instanceof GeographicProjection) {
    longitudeLatitudeProjectedScratch.x = CesiumMath.toDegrees(longitude);
    longitudeLatitudeProjectedScratch.y = CesiumMath.toDegrees(latitude);
  } else {
    const cartographic = cartographicScratch;
    cartographic.longitude = longitude;
    cartographic.latitude = latitude;
    imageryProvider.tilingScheme.projection.project(
      cartographic,
      longitudeLatitudeProjectedScratch,
    );
  }

  longitudeLatitudeProjectedScratchComputed = true;
}

function formatTag(imageryProvider, x, y, level, longitude, latitude, format) {
  return format;
}
export default UrlTemplateImageryProvider;