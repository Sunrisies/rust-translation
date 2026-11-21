import { Check } from "@cesium/core";

/**
 * 一组从笛卡尔坐标计算得到的地图位置及其边界矩形，用于特定椭球体。
 * 该数据用于 <code>ModelPrimitiveImagery</code> 类，并存储
 *
 * 原始实体的位置，这些位置被映射到一个在影像图层中使用的椭球体上。这避免了重新计算原始实体 POSITION 属性值到 ECEF 的变换，以及随后将这些位置转换为地图位置的过程。
 * 创建新实例
 * 位置
 * 位置数量
 * 位置的边界矩形
 *
 * @private
 */
class MappedPositions {
  /**
   * 椭球体
   *
   * @param {Iterable<Cartographic>} cartographicPositions 返回地图位置
   * @param {number} numPositions 位置数量
   * @param {Rectangle} cartographicBoundingRectangle 位置的边界
   * 矩形
   * @param {Ellipsoid} ellipsoid 椭球体
   */
  constructor(
    cartographicPositions,
    numPositions,
    cartographicBoundingRectangle,
    ellipsoid,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("cartographicPositions", cartographicPositions);
    Check.typeOf.number.greaterThanOrEquals("numPositions", numPositions, 0);
    Check.defined(
      "cartographicBoundingRectangle",
      cartographicBoundingRectangle,
    );
    Check.defined("ellipsoid", ellipsoid);
    //>>includeEnd('debug');

    this._cartographicPositions = cartographicPositions;
    this._numPositions = numPositions;
    this._cartographicBoundingRectangle = cartographicBoundingRectangle;
    this._ellipsoid = ellipsoid;
  }

  /**
   * 返回地图位置
   *
   * @returns {Iterable<Cartographic>} The 位置
   */
  get cartographicPositions() {
    return this._cartographicPositions;
  }

  /**
   * 返回位置数量
   *
   * @returns {number} The 位置数量
   */
  get numPositions() {
    return this._numPositions;
  }

  /**
   * 返回地图边界矩形
   *
   * @returns {Rectangle} The 矩形
   */
  get cartographicBoundingRectangle() {
    return this._cartographicBoundingRectangle;
  }

  /**
   * 返回创建这些位置的椭球体
   *
   * @returns {Ellipsoid} The 椭球体
   */
  get ellipsoid() {
    return this._ellipsoid;
  }
}

export default MappedPositions;
