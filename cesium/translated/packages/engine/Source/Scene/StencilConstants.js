import StencilFunction from "./StencilFunction.js";
import StencilOperation from "./StencilOperation.js";

/**
 * 最高位用于标识该像素是否为 3D Tiles。
 * 接下来的三个位用于存储跳过 LOD 优化的选择深度。
 * 最后四个位用于分类目的的阴影体积增量/减量操作。
 *
 * @private
 */
const StencilConstants = {
  CESIUM_3D_TILE_MASK: 0x80,
  SKIP_LOD_MASK: 0x70,
  SKIP_LOD_BIT_SHIFT: 4,
  CLASSIFICATION_MASK: 0x0f,
};

StencilConstants.setCesium3DTileBit = function () {
  return {
    enabled: true,
    frontFunction: StencilFunction.ALWAYS,
    frontOperation: {
      fail: StencilOperation.KEEP,
      zFail: StencilOperation.KEEP,
      zPass: StencilOperation.REPLACE,
    },
    backFunction: StencilFunction.ALWAYS,
    backOperation: {
      fail: StencilOperation.KEEP,
      zFail: StencilOperation.KEEP,
      zPass: StencilOperation.REPLACE,
    },
    reference: StencilConstants.CESIUM_3D_TILE_MASK,
    mask: StencilConstants.CESIUM_3D_TILE_MASK,
  };
};
export default Object.freeze(StencilConstants);
