// @ts-check

import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Ellipsoid,
  Frozen,
  Rectangle,
  WebMercatorProjection,
  defined,
} from "@cesium/core";
/** @import { MapProjection } from "@cesium/core"; */
/** @import TilingScheme from "./TilingScheme.js"; */

const southwestScratch = new Cartographic();
const northeastScratch = new Cartographic();

const southwestCartesianScratch = new Cartesian3();
const northeastCartesianScratch = new Cartesian3();

/**
 * 一种针对 {@link WebMercatorProjection}（EPSG:3857）的几何分块方案。这是
 * 谷歌地图、微软 Bing 地图和大多数 ESRI ArcGIS Online 使用的分块方案。
 *
 * @implements {TilingScheme}
 */
class WebMercatorTilingScheme {
  /**
   * @type {Cartesian2}
   * @private
   */
  _rectangleSouthwestInMeters;

  /**
   * @type {Cartesian2}
   * @private
   */
  _rectangleNortheastInMeters;

  /**
   * @param {object} [options] 具有以下属性的对象：
   * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 被分块处理的椭球体表面。默认为
   * 默认椭球体。
   * @param {number} [options.numberOfLevelZeroTilesX=1] 在分块树中，零级时 X 方向的 tiles 数量。
   * 分块树。
   * @param {number} [options.numberOfLevelZeroTilesY=1] 在分块树中，零级时 Y 方向的 tiles 数量。
   * 分块树。
   * @param {Cartesian2} [options.rectangleSouthwestInMeters] 被该分块方案覆盖的矩形区域的西南角，以米为单位。如果未指定此参数或 rectangleNortheastInMeters，则整个地球仪在经度方向被覆盖，在纬度方向也覆盖相同距离，形成正方形投影。
   * 被该分块方案覆盖的矩形区域的东北角，以米为单位。如果未指定此参数或 rectangleSouthwestInMeters，则整个地球仪在经度方向被覆盖，在纬度方向也覆盖相同距离，形成正方形投影。
   * 获取由该分块方案分块处理的椭球体。
   * 获取被该分块方案覆盖的矩形，以弧度为单位。
   * @param {Cartesian2} [options.rectangleNortheastInMeters] 获取该分块方案使用的地图投影。
   * 在指定的细节级别下，X 方向的 tiles 总数。
   * 细节级别。
   * 给定级别下 X 方向的 tiles 数量。
   */
  constructor(options) {
    options = options ?? Frozen.EMPTY_OBJECT;

    this._ellipsoid = options.ellipsoid ?? Ellipsoid.default;
    this._numberOfLevelZeroTilesX = options.numberOfLevelZeroTilesX ?? 1;
    this._numberOfLevelZeroTilesY = options.numberOfLevelZeroTilesY ?? 1;

    this._projection = new WebMercatorProjection(this._ellipsoid);

    if (
      defined(options.rectangleSouthwestInMeters) &&
      defined(options.rectangleNortheastInMeters)
    ) {
      this._rectangleSouthwestInMeters = options.rectangleSouthwestInMeters;
      this._rectangleNortheastInMeters = options.rectangleNortheastInMeters;
    } else {
      const semimajorAxisTimesPi = this._ellipsoid.maximumRadius * Math.PI;
      this._rectangleSouthwestInMeters = new Cartesian2(
        -semimajorAxisTimesPi,
        -semimajorAxisTimesPi,
      );
      this._rectangleNortheastInMeters = new Cartesian2(
        semimajorAxisTimesPi,
        semimajorAxisTimesPi,
      );
    }

    let { x, y } = this._rectangleSouthwestInMeters;
    Cartesian3.fromElements(x, y, 0, southwestCartesianScratch);
    this._projection.unproject(southwestCartesianScratch, southwestScratch);

    ({ x, y } = this._rectangleNortheastInMeters);
    Cartesian3.fromElements(x, y, 0, northeastCartesianScratch);
    this._projection.unproject(northeastCartesianScratch, northeastScratch);

    this._rectangle = new Rectangle(
      southwestScratch.longitude,
      southwestScratch.latitude,
      northeastScratch.longitude,
      northeastScratch.latitude,
    );
  }

  /**
   * 获取由该分块方案分块处理的椭球体。
   * @type {Ellipsoid}
   */
  get ellipsoid() {
    return this._ellipsoid;
  }

  /**
   * 获取被该分块方案覆盖的矩形，以弧度为单位。
   * @type {Rectangle}
   */
  get rectangle() {
    return this._rectangle;
  }

  /**
   * 获取该分块方案使用的地图投影。
   * @type {MapProjection}
   */
  get projection() {
    return this._projection;
  }

  /**
   * 在指定的细节级别下，Y 方向的 tiles 总数。
   *
   * @param {number} level 细节级别。
   * @returns {number} The 给定级别下 X 方向的 tiles 数量。
   */
  getNumberOfXTilesAtLevel(level) {
    return this._numberOfLevelZeroTilesX << level;
  }

  /**
   * 在指定的细节级别下，Y 方向的 tiles 总数。
   *
   * @param {number} level 细节级别。
   * @returns {number} The 给定级别下 Y 方向的 tiles 数量。
   */
  getNumberOfYTilesAtLevel(level) {
    return this._numberOfLevelZeroTilesY << level;
  }

  /**
   * 将以大地经纬度表示的矩形转换为该分块方案的本地坐标系统。
   * 要转换的矩形。
   *
   * @param {Rectangle} rectangle 要转换的实例。
   * @param {Rectangle} [result] 要复制结果的实例，如果应创建新实例则定义为未定义。
   * 指定的 'result'，或如果 'result' 未定义则包含本地矩形的新对象。
   * @returns {Rectangle} The 指定的 'result'，或如果 'result' 未定义则包含本地矩形的新对象。
   * 将 tile 的 x、y 坐标和级别转换为以该分块方案的本地坐标表示的矩形。
   */
  rectangleToNativeRectangle(rectangle, result) {
    const projection = this._projection;
    const southwest = projection.project(Rectangle.southwest(rectangle));
    const northeast = projection.project(Rectangle.northeast(rectangle));

    if (!defined(result)) {
      return new Rectangle(southwest.x, southwest.y, northeast.x, northeast.y);
    }

    result.west = southwest.x;
    result.south = southwest.y;
    result.east = northeast.x;
    result.north = northeast.y;
    return result;
  }

  /**
   * tile 的整数 x 坐标。
   * tile 的整数 y 坐标。
   *
   * @param {number} x tile 的细节级别。零表示最不详细。
   * @param {number} y 要复制结果的实例。如果应创建新实例则定义为未定义。
   * @param {number} level 要复制结果的实例。如果应创建新实例则定义为未定义。
   * @param {Rectangle} [result] 指定的 'result'，或如果 'result' 未定义则包含矩形的新对象。
   * 指定的 'result'，或如果 'result' 未定义则包含矩形的新对象。
   * @returns {Rectangle} The specified 'result', or a new object containing the rectangle
   * 如果 ‘result’ 未定义。
   */
  tileXYToNativeRectangle(x, y, level, result) {
    const xTiles = this.getNumberOfXTilesAtLevel(level);
    const yTiles = this.getNumberOfYTilesAtLevel(level);

    const xTileWidth =
      (this._rectangleNortheastInMeters.x -
        this._rectangleSouthwestInMeters.x) /
      xTiles;
    const west = this._rectangleSouthwestInMeters.x + x * xTileWidth;
    const east = this._rectangleSouthwestInMeters.x + (x + 1) * xTileWidth;

    const yTileHeight =
      (this._rectangleNortheastInMeters.y -
        this._rectangleSouthwestInMeters.y) /
      yTiles;
    const north = this._rectangleNortheastInMeters.y - y * yTileHeight;
    const south = this._rectangleNortheastInMeters.y - (y + 1) * yTileHeight;

    if (!defined(result)) {
      return new Rectangle(west, south, east, north);
    }

    result.west = west;
    result.south = south;
    result.east = east;
    result.north = north;
    return result;
  }

  /**
   * 将瓦片的坐标值 x、y 和层级转换为弧度形式的地图矩形。
   *
   * @param {number} x 瓦片的整数 x 坐标。
   * @param {number} y 瓦片的整数 y 坐标。
   * @param {number} level 瓦片的细节级别。零表示最不详细。
   * @param {Rectangle} [result] 要复制结果的实例，如果创建了新的实例则为未定义。
   * 指定 ‘result’，或者创建一个包含矩形信息的新的对象。
   * @returns {Rectangle} The 如果 ‘result’ 未定义，则使用新的对象。
   * 计算包含给定地图位置的瓦片的 x、y 坐标。
   */
  tileXYToRectangle(x, y, level, result) {
    const nativeRectangle = this.tileXYToNativeRectangle(x, y, level, result);

    const projection = this._projection;
    const southwest = projection.unproject(
      new Cartesian3(nativeRectangle.west, nativeRectangle.south),
    );
    const northeast = projection.unproject(
      new Cartesian3(nativeRectangle.east, nativeRectangle.north),
    );

    nativeRectangle.west = southwest.longitude;
    nativeRectangle.south = southwest.latitude;
    nativeRectangle.east = northeast.longitude;
    nativeRectangle.north = northeast.latitude;
    return nativeRectangle;
  }

  /**
   * Calculates the tile x, y coordinates of the tile containing
   * 位置。
   *
   * @param {Cartographic} position 位置。
   * @param {number} level 瓦片的细节级别。零表示最不详细。
   * @param {Cartesian2} [result] 要复制结果的实例，如果创建了新的实例则为未定义。
   * 如果创建了新的实例，则指定 ‘result’，或者创建一个包含瓦片 x、y 坐标信息的新的对象。
   * @returns {Cartesian2} The 如果 ‘result’ 未定义，则使用新的对象。
   * if 'result' is undefined.
   */
  positionToTileXY(position, level, result) {
    const rectangle = this._rectangle;
    if (!Rectangle.contains(rectangle, position)) {
      // outside the bounds of the tiling scheme
      return undefined;
    }

    const xTiles = this.getNumberOfXTilesAtLevel(level);
    const yTiles = this.getNumberOfYTilesAtLevel(level);

    const overallWidth =
      this._rectangleNortheastInMeters.x - this._rectangleSouthwestInMeters.x;
    const xTileWidth = overallWidth / xTiles;
    const overallHeight =
      this._rectangleNortheastInMeters.y - this._rectangleSouthwestInMeters.y;
    const yTileHeight = overallHeight / yTiles;

    const projection = this._projection;

    const webMercatorPosition = projection.project(position);
    const distanceFromWest =
      webMercatorPosition.x - this._rectangleSouthwestInMeters.x;
    const distanceFromNorth =
      this._rectangleNortheastInMeters.y - webMercatorPosition.y;

    let xTileCoordinate = (distanceFromWest / xTileWidth) | 0;
    if (xTileCoordinate >= xTiles) {
      xTileCoordinate = xTiles - 1;
    }
    let yTileCoordinate = (distanceFromNorth / yTileHeight) | 0;
    if (yTileCoordinate >= yTiles) {
      yTileCoordinate = yTiles - 1;
    }

    if (!defined(result)) {
      return new Cartesian2(xTileCoordinate, yTileCoordinate);
    }

    result.x = xTileCoordinate;
    result.y = yTileCoordinate;
    return result;
  }
}

export default WebMercatorTilingScheme;
