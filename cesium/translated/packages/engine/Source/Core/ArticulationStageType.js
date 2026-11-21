// @ts-check

/**
 * 一个枚举值，用于描述由关节阶段定义的运动类型。
 * 位于 AGI_articulations 扩展中。
 *
 * @alias {ArticulationStageType}
 * @enum {string}
 *
 * @private
 */
const ArticulationStageType = {
  XTRANSLATE: "xTranslate",
  YTRANSLATE: "yTranslate",
  ZTRANSLATE: "zTranslate",
  XROTATE: "xRotate",
  YROTATE: "yRotate",
  ZROTATE: "zRotate",
  XSCALE: "xScale",
  YSCALE: "yScale",
  ZSCALE: "zScale",
  UNIFORMSCALE: "uniformScale",
};

Object.freeze(ArticulationStageType);

export default ArticulationStageType;
