/**
 * 生成带符号距离场符号的设置
 *
 * @private
 */
const SDFSettings = {
  /**
   * 像素单位的字体大小
   *
   * @type {number}
   * @constant
   */
  FONT_SIZE: 48.0,

  /**
   * 符号周围的空白填充量
   *
   * @type {number}
   * @constant
   */
  PADDING: 10.0,

  /**
   * 用于编码距离的符号形状周围应保留多少像素
   *
   * @type {number}
   * @constant
   */
  RADIUS: 8.0,

  /**
   * 半径的哪一部分（相对值）用于表示符号的内部区域
   *
   * @type {number}
   * @constant
   */
  CUTOFF: 0.25,
};
export default Object.freeze(SDFSettings);
