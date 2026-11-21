// @ts-check

/**
 * 定义材料属性如何沿路径应用。
 *
 * @enum {number}
 */
const PathMode = {
  /**
   * 材料整体应用于整个路径。
   * @type {number}
   * @constant
   */
  WHOLE: 0,

  /**
   * 根据时间位置信息，部分地应用材料，
   * 使用基于间隔的材料属性。
   * @type {number}
   * @constant
   */
  PORTIONS: 1,
};

Object.freeze(PathMode);

export default PathMode;
