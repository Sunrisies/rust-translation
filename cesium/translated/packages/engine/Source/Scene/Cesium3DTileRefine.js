// @ts-check

/**
 * 瓦片的优化方法。
 * <p>
 * See the {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification#refinement|Refinement}
 * 位于 3D Tiles 规范中。
 * </p>
 *
 * @enum {number}
 *
 * @private
 */
const Cesium3DTileRefine = {
  /**
   * 渲染该瓦片，如果未满足屏幕空间误差要求，则对其子实体进行优化。
   *
   * @type {number}
   * @constant
   */
  ADD: 0,

  /**
   * 渲染该瓦片，或者如果未满足屏幕空间误差要求，则对其后代实体进行优化。
   *
   * @type {number}
   * @constant
   */
  REPLACE: 1,
};

Object.freeze(Cesium3DTileRefine);

export default Cesium3DTileRefine;