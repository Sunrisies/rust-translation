import { DeveloperError, Frozen, Rectangle, defined } from "@cesium/core";
import Credit from "../Core/Credit.js";
import Resource from "../Core/Resource.js";
import WebMercatorTilingScheme from "../Core/WebMercatorTilingScheme.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";

const defaultCredit = new Credit(
  "MapQuest, Open Street Map and contributors, CC-BY-SA",
);

/**
 * @typedef {object} OpenStreetMapImageryProvider.ConstructorOptions
 *
 * OpenStreetMapImageryProvider 构造函数的初始化选项
 *
 * @property {string} [url='https://tile.openstreetmap.org'] OpenStreetMap 服务器地址。
 * @property {string} [fileExtension='png'] 服务器上图像的文件扩展名。
 * @property {boolean} [retinaTiles=false] 当为 true 时，对于视网膜显示设备会请求 2x 分辨率的瓦片。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 影像图层的矩形范围。
 * @property {number} [minimumLevel=0] 影像提供器支持的最小细节级别。
 * @property {number} [maximumLevel] 影像提供器支持的最大细节级别，如果没有限制则保留为 undefined。
 * @property {Ellipsoid} [ellipsoid] 椭球体参数。如果未指定，则使用 WGS84 椭球体。
 * @property {Credit|string} [credit='MapQuest, Open Street Map and contributors, CC-BY-SA'] 数据来源的版权信息，会在画布上显示。
 */

/**
 * 由 OpenStreetMap 提供的带有瓦片式影像的提供器
 * 或另一种 Slippy 瓦片提供器。默认地址连接至 OpenStreetMap 的志愿者运营服务器，因此您必须遵守他们的
 * {@link http://wiki.openstreetmap.org/wiki/Tile_usage_policy|Tile Usage Policy}。
 * 描述初始化选项的对象
 *
 * @alias OpenStreetMapImageryProvider
 * @constructor
 * @extends UrlTemplateImageryProvider
 *
 * @param {OpenStreetMapImageryProvider.ConstructorOptions} options 矩形和 minimumLevel 表示在最小级别下有超过四个瓦片。不支持在最小级别下有超过四个瓦片的影像提供器。
 * @exception {DeveloperError} The const osm = new Cesium.OpenStreetMapImageryProvider({
 *
 * @see ArcGisMapServerImageryProvider
 * @see BingMapsImageryProvider
 * @see GoogleEarthEnterpriseMapsProvider
 * @see SingleTileImageryProvider
 * @see TileMapServiceImageryProvider
 * @see WebMapServiceImageryProvider
 * @see WebMapTileServiceImageryProvider
 * @see UrlTemplateImageryProvider
 *
 * @example
 * url : 'https://tile.openstreetmap.org/'
 * url : 'https://tile.openstreetmap.org/'
 * });
 *
 * @see {@link http://wiki.openstreetmap.org/wiki/Main_Page|OpenStreetMap Wiki}
 * @see {@link http://www.w3.org/TR/cors/|Cross-Origin Resource Sharing}
 */
function OpenStreetMapImageryProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const resource = Resource.createIfNeeded(
    options.url ?? "https://tile.openstreetmap.org/",
  );
  resource.appendForwardSlash();
  resource.url += `{z}/{x}/{y}${
    options.retinaTiles ? "@2x" : ""
  }.${options.fileExtension ?? "png"}`;

  const tilingScheme = new WebMercatorTilingScheme({
    ellipsoid: options.ellipsoid,
  });

  const tileWidth = 256;
  const tileHeight = 256;

  const minimumLevel = options.minimumLevel ?? 0;
  const maximumLevel = options.maximumLevel;

  const rectangle = options.rectangle ?? tilingScheme.rectangle;

  // Check the number of tiles at the minimum level.  If it's more than four,
  // throw an exception, because starting at the higher minimum
  // level will cause too many tiles to be downloaded and rendered.
  const swTile = tilingScheme.positionToTileXY(
    Rectangle.southwest(rectangle),
    minimumLevel,
  );
  const neTile = tilingScheme.positionToTileXY(
    Rectangle.northeast(rectangle),
    minimumLevel,
  );
  const tileCount =
    (Math.abs(neTile.x - swTile.x) + 1) * (Math.abs(neTile.y - swTile.y) + 1);
  //>>includeStart('debug', pragmas.debug);
  if (tileCount > 4) {
    throw new DeveloperError(
      `The rectangle and minimumLevel indicate that there are ${tileCount} tiles at the minimum level. Imagery providers with more than four tiles at the minimum level are not supported.`,
    );
  }
  //>>includeEnd('debug');

  let credit = options.credit ?? defaultCredit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }

  UrlTemplateImageryProvider.call(this, {
    url: resource,
    credit: credit,
    tilingScheme: tilingScheme,
    tileWidth: tileWidth,
    tileHeight: tileHeight,
    minimumLevel: minimumLevel,
    maximumLevel: maximumLevel,
    rectangle: rectangle,
  });
}

if (defined(Object.create)) {
  OpenStreetMapImageryProvider.prototype = Object.create(
    UrlTemplateImageryProvider.prototype,
  );
  OpenStreetMapImageryProvider.prototype.constructor =
    OpenStreetMapImageryProvider;
}

export default OpenStreetMapImageryProvider;
