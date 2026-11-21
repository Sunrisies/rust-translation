import {
  Cartesian2,
  Cartographic,
  Check,
  Frozen,
  GeographicProjection,
  Rectangle,
  RuntimeError,
  defined,
} from "@cesium/core";
import GeographicTilingScheme from "../Core/GeographicTilingScheme.js";
import RequestErrorEvent from "../Core/RequestErrorEvent.js";
import Resource from "../Core/Resource.js";
import TileProviderError from "../Core/TileProviderError.js";
import WebMercatorTilingScheme from "../Core/WebMercatorTilingScheme.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";

/**
 * @typedef {object} TileMapServiceImageryProvider.ConstructorOptions
 *
 * TileMapServiceImageryProvider构造函数的初始化选项
 *
 * @property {string} [fileExtension='png'] 服务器上图像的文件扩展名。
 * @property {Credit|string} [credit=''] 在画布上显示的数据源的引用。
 * @property {number} [minimumLevel=0] 影像提供器支持的最小细节级别。在指定时需注意
 * 最小级别上的瓦片数量应较少，例如四片或更少。数量过多可能导致渲染问题。
 * 影像提供器支持的最大细节级别，如果没有限制则定义为未定义。
 * @property {number} [maximumLevel] 以弧度表示的图像所覆盖的矩形区域。
 * @property {Rectangle} [rectangle=Rectangle.MAX_VALUE] 指定椭球表面被划分为瓦片的 tiling方案。如果未提供此参数，则使用 {@link WebMercatorTilingScheme}。
 * @property {TilingScheme} [tilingScheme] The tiling scheme specifying how the ellipsoidal
 * surface is broken into tiles.  If this parameter is not provided, a {@link WebMercatorTilingScheme}
 * 椭球体。如果指定了tilingScheme，则忽略此参数，使用tiling方案的椭球体。如果两者均未指定，则使用WGS84椭球体。
 * @property {Ellipsoid} [ellipsoid] 图像瓦片的像素宽度。
 * 图像瓦片的像素高度。
 * gdal2tiles.py的旧版本在tilemapresource.xml中翻转了X和Y值。
 * @property {number} [tileWidth=256] 根据某些标准丢弃瓦片图像的策略。
 * @property {number} [tileHeight=256] 指定此选项将执行相同的操作，允许加载这些错误的瓦片集。
 * @property {boolean} [flipXY] <div class="notice">
 * @property {TileDiscardPolicy} [tileDiscardPolicy] 用于根据某些标准丢弃瓦片图像的政策。
 * 指定此选项将执行相同操作，允许加载这些错误的瓦片集。
 */

/**
 * <div class="notice">
 * 要创建TileMapServiceImageryProvider，请调用 {@link TileMapServiceImageryProvider.fromUrl}。不要直接调用构造函数。
 * </div>
 *
 * 提供由
 * {@link http://www.maptiler.org/|MapTiler}、{@link http://www.klokan.cz/projects/gdal2tiles/|GDAL2Tiles}等生成的瓦片图像的影像提供器。
 *
 * @alias TileMapServiceImageryProvider
 * @constructor
 * @extends UrlTemplateImageryProvider
 *
 * @param {TileMapServiceImageryProvider.ConstructorOptions} [options] 描述初始化选项的对象
 *
 * @see ArcGisMapServerImageryProvider
 * @see BingMapsImageryProvider
 * @see GoogleEarthEnterpriseMapsProvider
 * @see OpenStreetMapImageryProvider
 * @see SingleTileImageryProvider
 * @see WebMapServiceImageryProvider
 * @see WebMapTileServiceImageryProvider
 * @see UrlTemplateImageryProvider
 *
 * @example
 * const tms = await Cesium.TileMapServiceImageryProvider.fromUrl(
 * "../images/cesium_maptiler/Cesium_Logo_Color", {
 * fileExtension: 'png',
 * maximumLevel: 4,
 * rectangle: new Cesium.Rectangle(
 * Cesium.Math.toRadians(-120.0),
 * Cesium.Math.toRadians(20.0),
 * Cesium.Math.toRadians(-60.0),
 * Cesium.Math.toRadians(40.0))
 * });
 */
function TileMapServiceImageryProvider(options) {
  UrlTemplateImageryProvider.call(this, options);
}

TileMapServiceImageryProvider._requestMetadata = async function (
  options,
  tmsResource,
  xmlResource,
  provider,
) {
  // Try to load remaining parameters from XML
  try {
    const xml = await xmlResource.fetchXML();
    return TileMapServiceImageryProvider._metadataSuccess(
      xml,
      options,
      tmsResource,
      xmlResource,
      provider,
    );
  } catch (e) {
    if (e instanceof RequestErrorEvent) {
      return TileMapServiceImageryProvider._metadataFailure(
        options,
        tmsResource,
      );
    }

    throw e;
  }
};
/**
 * 根据指定的URL创建TileMapServiceImageryProvider。
 *
 * @param {Resource|string} url 服务器上图像瓦片的路径。
 * @param {TileMapServiceImageryProvider.ConstructorOptions} [options] 描述初始化选项的对象。
 * @returns {Promise<TileMapServiceImageryProvider>} A resolve后的承诺，表示已创建的TileMapServiceImageryProvider。
 *
 * @example
 * const tms = await Cesium.TileMapServiceImageryProvider.fromUrl(
 * '../images/cesium_maptiler/Cesium_Logo_Color', {
 * fileExtension: 'png',
 * maximumLevel: 4,
 * rectangle: new Cesium.Rectangle(
 * Cesium.Math.toRadians(-120.0),
 * Cesium.Math.toRadians(20.0),
 * Cesium.Math.toRadians(-60.0),
 * Cesium.Math.toRadians(40.0))
 * });
 *
 * @exception {RuntimeError} Unable 用于在 tilemapresource.xml 中查找预期的 tilesets 或 bbox 属性
 * @exception {RuntimeError} tilemapresource.xml 指定一个不支持的 profile 属性
 */
TileMapServiceImageryProvider.fromUrl = async function (url, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  const resource = Resource.createIfNeeded(url);
  resource.appendForwardSlash();

  const tmsResource = resource;
  const xmlResource = resource.getDerivedResource({
    url: "tilemapresource.xml",
  });

  options = options ?? Frozen.EMPTY_OBJECT;
  const metadata = await TileMapServiceImageryProvider._requestMetadata(
    options,
    tmsResource,
    xmlResource,
  );

  return new TileMapServiceImageryProvider(metadata);
};

if (defined(Object.create)) {
  TileMapServiceImageryProvider.prototype = Object.create(
    UrlTemplateImageryProvider.prototype,
  );
  TileMapServiceImageryProvider.prototype.constructor =
    TileMapServiceImageryProvider;
}

/**
 * 修改给定矩形的属性，使其不会超出给定的镶嵌方案矩形范围
 * @private
 */
function confineRectangleToTilingScheme(rectangle, tilingScheme) {
  if (rectangle.west < tilingScheme.rectangle.west) {
    rectangle.west = tilingScheme.rectangle.west;
  }
  if (rectangle.east > tilingScheme.rectangle.east) {
    rectangle.east = tilingScheme.rectangle.east;
  }
  if (rectangle.south < tilingScheme.rectangle.south) {
    rectangle.south = tilingScheme.rectangle.south;
  }
  if (rectangle.north > tilingScheme.rectangle.north) {
    rectangle.north = tilingScheme.rectangle.north;
  }
  return rectangle;
}

function calculateSafeMinimumDetailLevel(
  tilingScheme,
  rectangle,
  minimumLevel,
) {
  // Check the number of tiles at the minimum level.  If it's more than four,
  // try requesting the lower levels anyway, because starting at the higher minimum
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
  if (tileCount > 4) {
    return 0;
  }
  return minimumLevel;
}

/**
 * 解析成功的 xml 请求结果
 * @private
 *
 * @param {object} xml
 * @param {TileMapServiceImageryProvider.ConstructorOptions} options
 * @param {Resource} tmsResource
 * @param {Resource} xmlResource
 * @returns {UrlTemplateImageryProvider.ConstructorOptions}
 */
TileMapServiceImageryProvider._metadataSuccess = function (
  xml,
  options,
  tmsResource,
  xmlResource,
  provider,
) {
  const tileFormatRegex = /tileformat/i;
  const tileSetRegex = /tileset/i;
  const tileSetsRegex = /tilesets/i;
  const bboxRegex = /boundingbox/i;
  let format, bbox, tilesets;
  const tilesetsList = []; //list of TileSets

  // Allowing options properties (already copied to that) to override XML values

  // Iterate XML Document nodes for properties
  const nodeList = xml.childNodes[0].childNodes;
  for (let i = 0; i < nodeList.length; i++) {
    if (tileFormatRegex.test(nodeList.item(i).nodeName)) {
      format = nodeList.item(i);
    } else if (tileSetsRegex.test(nodeList.item(i).nodeName)) {
      tilesets = nodeList.item(i); // Node list of TileSets
      const tileSetNodes = nodeList.item(i).childNodes;
      // Iterate the nodes to find all TileSets
      for (let j = 0; j < tileSetNodes.length; j++) {
        if (tileSetRegex.test(tileSetNodes.item(j).nodeName)) {
          // Add them to tilesets list
          tilesetsList.push(tileSetNodes.item(j));
        }
      }
    } else if (bboxRegex.test(nodeList.item(i).nodeName)) {
      bbox = nodeList.item(i);
    }
  }

  let message;
  if (!defined(tilesets) || !defined(bbox)) {
    message = `Unable to find expected tilesets or bbox attributes in ${xmlResource.url}.`;
    if (defined(provider)) {
      TileProviderError.reportError(
        undefined,
        provider,
        provider.errorEvent,
        message,
      );
    }

    throw new RuntimeError(message);
  }

  const fileExtension =
    options.fileExtension ?? format.getAttribute("extension");
  const tileWidth =
    options.tileWidth ?? parseInt(format.getAttribute("width"), 10);
  const tileHeight =
    options.tileHeight ?? parseInt(format.getAttribute("height"), 10);
  let minimumLevel =
    options.minimumLevel ?? parseInt(tilesetsList[0].getAttribute("order"), 10);
  const maximumLevel =
    options.maximumLevel ??
    parseInt(tilesetsList[tilesetsList.length - 1].getAttribute("order"), 10);
  const tilingSchemeName = tilesets.getAttribute("profile");
  let tilingScheme = options.tilingScheme;

  if (!defined(tilingScheme)) {
    if (
      tilingSchemeName === "geodetic" ||
      tilingSchemeName === "global-geodetic"
    ) {
      tilingScheme = new GeographicTilingScheme({
        ellipsoid: options.ellipsoid,
      });
    } else if (
      tilingSchemeName === "mercator" ||
      tilingSchemeName === "global-mercator"
    ) {
      tilingScheme = new WebMercatorTilingScheme({
        ellipsoid: options.ellipsoid,
      });
    } else {
      message = `${xmlResource.url} specifies an unsupported profile attribute, ${tilingSchemeName}.`;
      if (defined(provider)) {
        TileProviderError.reportError(
          undefined,
          provider,
          provider.errorEvent,
          message,
        );
      }

      throw new RuntimeError(message);
    }
  }

  // rectangle handling
  let rectangle = Rectangle.clone(options.rectangle);

  if (!defined(rectangle)) {
    let sw;
    let ne;
    let swXY;
    let neXY;

    // In older versions of gdal x and y values were flipped, which is why we check for an option to flip
    // the values here as well. Unfortunately there is no way to autodetect whether flipping is needed.
    const flipXY = options.flipXY ?? false;
    if (flipXY) {
      swXY = new Cartesian2(
        parseFloat(bbox.getAttribute("miny")),
        parseFloat(bbox.getAttribute("minx")),
      );
      neXY = new Cartesian2(
        parseFloat(bbox.getAttribute("maxy")),
        parseFloat(bbox.getAttribute("maxx")),
      );
    } else {
      swXY = new Cartesian2(
        parseFloat(bbox.getAttribute("minx")),
        parseFloat(bbox.getAttribute("miny")),
      );
      neXY = new Cartesian2(
        parseFloat(bbox.getAttribute("maxx")),
        parseFloat(bbox.getAttribute("maxy")),
      );
    }

    // Determine based on the profile attribute if this tileset was generated by gdal2tiles.py, which
    // uses 'mercator' and 'geodetic' profiles, or by a tool compliant with the TMS standard, which is
    // 'global-mercator' and 'global-geodetic' profiles. In the gdal2Tiles case, X and Y are always in
    // geodetic degrees.
    const isGdal2tiles =
      tilingSchemeName === "geodetic" || tilingSchemeName === "mercator";
    if (
      tilingScheme.projection instanceof GeographicProjection ||
      isGdal2tiles
    ) {
      sw = Cartographic.fromDegrees(swXY.x, swXY.y);
      ne = Cartographic.fromDegrees(neXY.x, neXY.y);
    } else {
      const projection = tilingScheme.projection;
      sw = projection.unproject(swXY);
      ne = projection.unproject(neXY);
    }

    rectangle = new Rectangle(
      sw.longitude,
      sw.latitude,
      ne.longitude,
      ne.latitude,
    );
  }

  // The rectangle must not be outside the bounds allowed by the tiling scheme.
  rectangle = confineRectangleToTilingScheme(rectangle, tilingScheme);
  // clamp our minimum detail level to something that isn't going to request a ridiculous number of tiles
  minimumLevel = calculateSafeMinimumDetailLevel(
    tilingScheme,
    rectangle,
    minimumLevel,
  );

  const templateResource = tmsResource.getDerivedResource({
    url: `{z}/{x}/{reverseY}.${fileExtension}`,
  });

  return {
    url: templateResource,
    tilingScheme: tilingScheme,
    rectangle: rectangle,
    tileWidth: tileWidth,
    tileHeight: tileHeight,
    minimumLevel: minimumLevel,
    maximumLevel: maximumLevel,
    tileDiscardPolicy: options.tileDiscardPolicy,
    credit: options.credit,
  };
};

/**
 * 通过提供默认值来处理 xml 请求失败情况
 * @private
 *
 * @param {TileMapServiceImageryProvider.ConstructorOptions} options
 * @param {Resource} tmsResource
 * @returns {UrlTemplateImageryProvider.ConstructorOptions}
 */
TileMapServiceImageryProvider._metadataFailure = function (
  options,
  tmsResource,
) {
  // Can't load XML, still allow options and defaults
  const fileExtension = options.fileExtension ?? "png";
  const tileWidth = options.tileWidth ?? 256;
  const tileHeight = options.tileHeight ?? 256;
  const maximumLevel = options.maximumLevel;
  const tilingScheme = defined(options.tilingScheme)
    ? options.tilingScheme
    : new WebMercatorTilingScheme({ ellipsoid: options.ellipsoid });

  let rectangle = options.rectangle ?? tilingScheme.rectangle;
  // The rectangle must not be outside the bounds allowed by the tiling scheme.
  rectangle = confineRectangleToTilingScheme(rectangle, tilingScheme);

  // make sure we use a safe minimum detail level, so we don't request a ridiculous number of tiles
  const minimumLevel = calculateSafeMinimumDetailLevel(
    tilingScheme,
    rectangle,
    options.minimumLevel,
  );

  const templateResource = tmsResource.getDerivedResource({
    url: `{z}/{x}/{reverseY}.${fileExtension}`,
  });

  return {
    url: templateResource,
    tilingScheme: tilingScheme,
    rectangle: rectangle,
    tileWidth: tileWidth,
    tileHeight: tileHeight,
    minimumLevel: minimumLevel,
    maximumLevel: maximumLevel,
    tileDiscardPolicy: options.tileDiscardPolicy,
    credit: options.credit,
  };
};

export default TileMapServiceImageryProvider;
