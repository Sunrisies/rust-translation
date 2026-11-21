import { Math as CesiumMath } from "@cesium/core";

/**
 * 定义目标颜色与实体源颜色之间混合的不同模式。
 *
 * 高亮模式将源颜色与目标颜色相乘。
 * 替换模式用目标颜色替代源颜色。
 * 混合模式将源颜色与目标颜色融合在一起。
 *
 * @enum {number}
 *
 * @see Model.colorBlendMode
 */
const ColorBlendMode = {
  HIGHLIGHT: 0,
  REPLACE: 1,
  MIX: 2,
};

/**
 * 获取颜色混合模式下的颜色混合值，其中 0 表示高亮，1 表示完全替换。
 *
 * @param {ColorBlendMode} colorBlendMode 颜色混合模式。
 * @param {number} colorBlendAmount 颜色混合程度，在模式为 <code>MIX</code> 时使用。
 * @returns {number} The 颜色混合值。
 *
 * @private
 */
ColorBlendMode.getColorBlend = function (colorBlendMode, colorBlendAmount) {
  if (colorBlendMode === ColorBlendMode.HIGHLIGHT) {
    return 0.0;
  } else if (colorBlendMode === ColorBlendMode.REPLACE) {
    return 1.0;
  } else if (colorBlendMode === ColorBlendMode.MIX) {
    // The value 0.0 is reserved for highlight, so clamp to just above 0.0.
    return CesiumMath.clamp(colorBlendAmount, CesiumMath.EPSILON4, 1.0);
  }
};

Object.freeze(ColorBlendMode);

export default ColorBlendMode;
