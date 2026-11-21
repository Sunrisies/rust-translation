// @ts-check

import {
  Cartesian2,
  Check,
  Ellipsoid,
  Frozen,
  GeographicProjection,
  Math as CesiumMath,
  Rectangle,
  defined,
} from "@cesium/core";
/** @import { Cartographic } from "@cesium/core"; */
/** @import { MapProjection } from "@cesium/core"; */
/** @import TilingScheme from "./TilingScheme.js"; */

/**
 * 一种用于几何数据的平铺方案，参考一个简单的 {@link GeographicProjection}，其中
 * 经度和纬度直接映射到 X 和 Y。这种投影通常被称为地理投影、等距角投影、等距圆柱投影或平板投影。
 * 具有以下属性：
 *
 * @implements {TilingScheme}
 */
class GeographicTilingScheme {
  /**
   * @param {object} [options] 具有以下属性的实体：
   * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 被平铺的椭球体表面。默认为
   * 默认椭球体。
   * @param {Rectangle} [options.rectangle=Rectangle.MAX_VALUE] 该平铺方案所覆盖的矩形，以弧度为单位。
   * @param {number} [options.numberOfLevelZeroTilesX=2] 在平铺树中，零级时 X 方向的平铺块数。
   * 在平铺树中，零级时 Y 方向的平铺块数。
   * @param {number} [options.numberOfLevelZeroTilesY=1] 在平铺树中，零级时 Y 方向的平铺块数。
   * 获取被该平铺方案平铺的椭球体。
   */
  constructor(options) {
    options = options ?? Frozen.EMPTY_OBJECT;

    this._ellipsoid = options.ellipsoid ?? Ellipsoid.default;
    this._rectangle = options.rectangle ?? Rectangle.MAX_VALUE;
    this._projection = new GeographicProjection(this._ellipsoid);
    this._numberOfLevelZeroTilesX = options.numberOfLevelZeroTilesX ?? 2;
    this._numberOfLevelZeroTilesY = options.numberOfLevelZeroTilesY ?? 1;
  }

  /**
   * 获取该平铺方案所覆盖的矩形，以弧度为单位。
   * @type {Ellipsoid}
   */
  get ellipsoid() {
    return this._ellipsoid;
  }

  /**
   * 获取该平铺方案所覆盖的矩形，以弧度为单位。
   * @type {Rectangle}
   */
  get rectangle() {
    return this._rectangle;
  }

  /**
   * 获取该平铺方案使用的地图投影。
   * @type {MapProjection}
   */
  get projection() {
    return this._projection;
  }

  /**
   * 获取指定细节级别下 X 方向的平铺块总数。
   *
   * @param {number} level 细节级别。
   * @returns {number} The 给定级别下 X 方向的平铺块数。
   */
  getNumberOfXTilesAtLevel(level) {
    return this._numberOfLevelZeroTilesX << level;
  }

  /**
   * 获取指定细节级别下 Y 方向的平铺块总数。
   *
   * @param {number} level 细节级别。
   * @returns {number} The 给定级别下 Y 方向的平铺块数。
   */
  getNumberOfYTilesAtLevel(level) {
    return this._numberOfLevelZeroTilesY << level;
  }

  /**
   * 将以大地经纬度表示的矩形转换为该平铺方案的本地坐标系统。
   * 转换的矩形。
   *
   * @param {Rectangle} rectangle 要转换的矩形。
   * @param {Rectangle} [result] 复制结果的实例，如果应创建新实例则为未定义。
   * 指定的 'result'，或者如果 'result' 未定义则包含本地矩形的新对象。
   * @returns {Rectangle} The 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * 将平铺的 x、y 坐标和级别转换为该平铺方案的本地坐标表示的矩形。
   */
  rectangleToNativeRectangle(rectangle, result) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("rectangle", rectangle);
    //>>includeEnd('debug');

    const west = CesiumMath.toDegrees(rectangle.west);
    const south = CesiumMath.toDegrees(rectangle.south);
    const east = CesiumMath.toDegrees(rectangle.east);
    const north = CesiumMath.toDegrees(rectangle.north);

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
   * 将平铺的 x、y 坐标和级别转换为本地坐标表示的矩形。
   * 平铺的整数 x 坐标。
   *
   * @param {number} x 平铺的整数 y 坐标。
   * @param {number} y 平铺的零级细节级别。零表示最不详细。
   * @param {number} level 复制结果的实例，如果应创建新实例则为未定义。
   * @param {Rectangle} [result] 复制结果的实例，如果应创建新实例则为未定义。
   * 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * @returns {Rectangle} The 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * 将平铺的 x、y 坐标和级别转换为弧度表示的地图学矩形。
   */
  tileXYToNativeRectangle(x, y, level, result) {
    const rectangleRadians = this.tileXYToRectangle(x, y, level, result);
    rectangleRadians.west = CesiumMath.toDegrees(rectangleRadians.west);
    rectangleRadians.south = CesiumMath.toDegrees(rectangleRadians.south);
    rectangleRadians.east = CesiumMath.toDegrees(rectangleRadians.east);
    rectangleRadians.north = CesiumMath.toDegrees(rectangleRadians.north);
    return rectangleRadians;
  }

  /**
   * 平铺的整数 x 坐标。
   *
   * @param {number} x 平铺的整数 y 坐标。
   * @param {number} y 平铺的零级细节级别。零表示最不详细。
   * @param {number} level 复制结果的实例，如果应创建新实例则为未定义。
   * @param {Rectangle} [result] 复制结果的实例，如果应创建新实例则为未定义。
   * 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * @returns {Rectangle} The 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * 将平铺的 x、y 坐标和级别转换为弧度表示的地图学矩形。
   */
  tileXYToRectangle(x, y, level, result) {
    const rectangle = this._rectangle;

    const xTiles = this.getNumberOfXTilesAtLevel(level);
    const yTiles = this.getNumberOfYTilesAtLevel(level);

    const xTileWidth = rectangle.width / xTiles;
    const west = x * xTileWidth + rectangle.west;
    const east = (x + 1) * xTileWidth + rectangle.west;

    const yTileHeight = rectangle.height / yTiles;
    const north = rectangle.north - y * yTileHeight;
    const south = rectangle.north - (y + 1) * yTileHeight;

    if (!defined(result)) {
      result = new Rectangle(west, south, east, north);
    }

    result.west = west;
    result.south = south;
    result.east = east;
    result.north = north;
    return result;
  }

  /**
   * 计算包含该平铺块的 x、y 坐标。
   * 给定的地图坐标位置。
   *
   * @param {Cartographic} position 该位置。
   * @param {number} level 瓦片细节级别。零表示最不详细。
   * @param {Cartesian2} [result] 要复制结果的实例，若需要创建新实例则视为未定义。
   * 指定了 ‘result’，或者是一个包含瓦片 x、y 坐标的新对象。
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

    const xTileWidth = rectangle.width / xTiles;
    const yTileHeight = rectangle.height / yTiles;

    let longitude = position.longitude;
    if (rectangle.east < rectangle.west) {
      longitude += CesiumMath.TWO_PI;
    }

    let xTileCoordinate = ((longitude - rectangle.west) / xTileWidth) | 0;
    if (xTileCoordinate >= xTiles) {
      xTileCoordinate = xTiles - 1;
    }

    let yTileCoordinate =
      ((rectangle.north - position.latitude) / yTileHeight) | 0;
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

export default GeographicTilingScheme;
