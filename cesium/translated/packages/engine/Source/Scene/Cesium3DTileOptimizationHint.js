// @ts-check

/**
 * 定义 3D 瓦片优化支持的提示
 *
 * @enum {number}
 *
 * @private
 */
const Cesium3DTileOptimizationHint = {
  NOT_COMPUTED: -1,
  USE_OPTIMIZATION: 1,
  SKIP_OPTIMIZATION: 0,
};

Object.freeze(Cesium3DTileOptimizationHint);

export default Cesium3DTileOptimizationHint;
