// @ts-check

import { DeveloperError } from "@cesium/core";
/** @import { Cartesian2 } from "@cesium/core"; */
/** @import { Cartographic } from "@cesium/core"; */
/** @import { Ellipsoid } from "@cesium/core"; */
/** @import { MapProjection } from "@cesium/core"; */
/** @import { Rectangle } from "@cesium/core"; */

/**
 * 用于椭球体表面几何或影像的平铺方案。在细节级别为零时，
 * 最粗糙、细节最少的级别， tiles的数量可配置。
 * 在细节级别为一时，零级 tiles 每个都有四个子 tiles，每个方向两个。
 * 在细节级别为二时，一级 tiles 每个都有四个子 tiles，每个方向两个。
 * 此规则持续适用于几何或影像源中存在的所有级别。
 *
 * @interface
 *
 * @see WebMercatorTilingScheme
 * @see GeographicTilingScheme
 */
class TilingScheme {
  /**
   * 获取由平铺方案平铺的椭球体。
   * @type {Ellipsoid}
   */
  ellipsoid;

  /**
   * 获取该平铺方案所覆盖的以弧度表示的矩形区域。
   * @type {Rectangle}
   */
  rectangle;

  /**
   * 获取平铺方案使用的地图投影。
   * @type {MapProjection}
   */
  projection;

  /**
   * @param {object} options
   */
  constructor(options) {
    //>>includeStart('debug', pragmas.debug);
    throw new DeveloperError(
      "This type should not be instantiated directly.  Instead, use WebMercatorTilingScheme or GeographicTilingScheme.",
    );
    //>>includeEnd('debug');
  }

  /**
   * 获取指定细节级别下 X 方向的总 tiles 数量。
   *
   * @param {number} level 细节级别。
   * @returns {number} The 给定级别下 X 方向的 tiles 数量。
   */
  getNumberOfXTilesAtLevel(level) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 获取指定细节级别下 Y 方向的总 tiles 数量。
   *
   * @param {number} level 细节级别。
   * @returns {number} The 给定级别下 Y 方向的 tiles 数量。
   */
  getNumberOfYTilesAtLevel(level) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 将以大地经纬度表示的矩形转换为该平铺方案的本地坐标系统。
   * 要转换的矩形。
   *
   * @param {Rectangle} rectangle 待转换的矩形。
   * @param {Rectangle} [result] 要复制结果的实例，如果应创建新实例则定义为未定义。
   * 指定的 'result'，或者如果 'result' 未定义则包含本地矩形的新对象。
   * @returns {Rectangle} The 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * 将 tiles 的 x、y 坐标和级别转换为平铺方案的本地坐标表示的矩形。
   */
  rectangleToNativeRectangle(rectangle, result) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 将 tiles 的 x、y 坐标和级别转换为以弧度表示的本地坐标表示的矩形。
   * tiles 的整数 x 坐标。
   *
   * @param {number} x tiles 的整数 y 坐标。
   * @param {number} y tiles 的级别。零表示最不详细。
   * @param {number} level 要复制结果的实例，如果应创建新实例则定义为未定义。
   * @param {Rectangle} [result] 要复制结果的实例，如果应创建新实例则定义为未定义。
   * 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * @returns {Rectangle} The 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * 将 tiles 的 x、y 坐标和级别转换为以弧度表示的地图投影矩形。
   */
  tileXYToNativeRectangle(x, y, level, result) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * tiles 的整数 x 坐标。
   *
   * @param {number} x tiles 的整数 y 坐标。
   * @param {number} y tiles 的级别。零表示最不详细。
   * @param {number} level tiles 的级别。零表示最不详细。
   * @param {Rectangle} [result] 要复制结果的实例，如果应创建新实例则定义为未定义。
   * 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * @returns {Rectangle} The 指定的 'result'，或者如果 'result' 未定义则包含矩形的新对象。
   * 将 tiles 的 x、y 坐标和级别转换为以弧度表示的地图投影矩形。
   */
  tileXYToRectangle(x, y, level, result) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 计算包含给定地图位置的 tiles 的 x、y 坐标。
   * 位置。
   *
   * @param {Cartographic} position 位置。
   * @param {number} level tiles 的级别。零表示最不详细。
   * @param {Cartesian2} [result] 要复制结果的实例，如果应创建新实例则定义为未定义。
   * 应当被创建。
   * @returns {Cartesian2} The 指定 'result'，或创建一个包含瓦片 x、y 坐标的新对象。
   * 如果 'result' 未定义。
   */
  positionToTileXY(position, level, result) {
    DeveloperError.throwInstantiationError();
  }
}

export default TilingScheme;
