// @ts-check

/**
 * 这种枚举类型用于确定地形网格的顶点如何被压缩。
 *
 * @enum {number}
 *
 * @private
 */
const TerrainQuantization = {
  /**
   * 顶点不会被压缩。
   *
   * @type {number}
   * @constant
   */
  NONE: 0,

  /**
   * 顶点被压缩为 12 位。
   *
   * @type {number}
   * @constant
   */
  BITS12: 1,
};

Object.freeze(TerrainQuantization);

export default TerrainQuantization;
