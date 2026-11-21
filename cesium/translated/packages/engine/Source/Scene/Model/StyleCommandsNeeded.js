/**
 * 一个枚举，描述由
 * 一个 {@link Cesium3DTileStyle} 所需的命令类型（不透明或半透明）。
 *
 * @enum {number}
 * @private
 */
const StyleCommandsNeeded = {
  ALL_OPAQUE: 0,
  ALL_TRANSLUCENT: 1,
  OPAQUE_AND_TRANSLUCENT: 2,
};

/**
 * @private
 */
StyleCommandsNeeded.getStyleCommandsNeeded = function (
  featuresLength,
  translucentFeaturesLength,
) {
  if (translucentFeaturesLength === 0) {
    return StyleCommandsNeeded.ALL_OPAQUE;
  } else if (translucentFeaturesLength === featuresLength) {
    return StyleCommandsNeeded.ALL_TRANSLUCENT;
  }
  return StyleCommandsNeeded.OPAQUE_AND_TRANSLUCENT;
};

Object.freeze(StyleCommandsNeeded);

export default StyleCommandsNeeded;
