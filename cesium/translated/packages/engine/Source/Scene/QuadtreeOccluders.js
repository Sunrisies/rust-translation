// @ts-check

import { Cartesian3, EllipsoidalOccluder } from "@cesium/core";
/** @import { Ellipsoid } from "@cesium/core"; */

/**
 * 一组用于测试四叉树瓦片遮挡的遮挡器。
 *
 * @private
 */
class QuadtreeOccluders {
  /**
   * @param {object} [options]
   * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.WGS84] 可能遮挡瓦片的椭球体。
   */
  constructor(options) {
    this._ellipsoid = new EllipsoidalOccluder(
      options.ellipsoid,
      Cartesian3.ZERO,
    );
  }

  /**
   * 获取可用于判断某点是否被
   * 椭球体遮挡的 {@link EllipsoidalOccluder}。
   * @type {EllipsoidalOccluder}
   */
  get ellipsoid() {
    return this._ellipsoid;
  }
}

export default QuadtreeOccluders;
