import { DeveloperError } from "@cesium/core";

/**
 * 隐式瓦片集的细分方案。
 *
 * @enum {string}
 * @private
 * @experimental This 该特性采用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
const ImplicitSubdivisionScheme = {
  /**
   * 四叉树将父瓦片分为四个子瓦片，在边界框的 x 和 y 维度中点处分割。
   * 
   * @type {string}
   * @constant
   * @private
   */
  QUADTREE: "QUADTREE",
  /**
   * 八叉树将父瓦片分为八个子瓦片，在边界框的 x、y 和 z 维度中点处分割。
   * 
   * @type {string}
   * @constant
   * @private
   */
  OCTREE: "OCTREE",
};

/**
 * 获取给定细分方案的分支因子。
 * @param {ImplicitSubdivisionScheme} subdivisionScheme 细分方案
 * @returns {number} The 分支因子，四叉树为 4，八叉树为 8。
 * @private
 */
ImplicitSubdivisionScheme.getBranchingFactor = function (subdivisionScheme) {
  switch (subdivisionScheme) {
    case ImplicitSubdivisionScheme.OCTREE:
      return 8;
    case ImplicitSubdivisionScheme.QUADTREE:
      return 4;
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError("subdivisionScheme is not a valid value.");
    //>>includeEnd('debug');
  }
};

Object.freeze(ImplicitSubdivisionScheme);

export default ImplicitSubdivisionScheme;
