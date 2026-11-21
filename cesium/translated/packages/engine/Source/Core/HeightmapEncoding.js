// @ts-check

/**
 * 用于高度图的编码方式
 *
 * @enum {number}
 */
const HeightmapEncoding = {
  /**
   * 无编码
   *
   * @type {number}
   * @constant
   */
  NONE: 0,

  /**
   * LERC 编码
   *
   * @type {number}
   * @constant
   *
   * @see {@link https://github.com/Esri/lerc|The LERC specification}
   */
  LERC: 1,
};

Object.freeze(HeightmapEncoding);

export default HeightmapEncoding;
