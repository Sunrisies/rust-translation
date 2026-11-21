/**
 * 一次采样得到的地球方位参数集合（EOP）。
 *
 * @alias EarthOrientationParametersSample
 * @constructor
 *
 * @param {number} xPoleWander 极点围绕 X 轴的偏移量，以弧度为单位。
 * @param {number} yPoleWander 极点围绕 Y 轴的偏移量，以弧度为单位。
 * @param {number} xPoleOffset 极点围绕 X 轴相对于天球中间极点的偏移量，以弧度为单位。
 * @param {number} yPoleOffset 极点围绕 Y 轴相对于天球中间极点的偏移量，以弧度为单位。
 * @param {number} ut1MinusUtc 时间标准差异，即 UT1 - UTC，以秒为单位。
 *
 * @private
 */
function EarthOrientationParametersSample(
  xPoleWander,
  yPoleWander,
  xPoleOffset,
  yPoleOffset,
  ut1MinusUtc,
) {
  /**
   * 极点围绕 X 轴的偏移量，以弧度为单位。
   * @type {number}
   */
  this.xPoleWander = xPoleWander;

  /**
   * 极点围绕 Y 轴的偏移量，以弧度为单位。
   * @type {number}
   */
  this.yPoleWander = yPoleWander;

  /**
   * 极点围绕 X 轴相对于天球中间极点的偏移量，以弧度为单位。
   * @type {number}
   */
  this.xPoleOffset = xPoleOffset;

  /**
   * 极点围绕 Y 轴相对于天球中间极点的偏移量，以弧度为单位。
   * @type {number}
   */
  this.yPoleOffset = yPoleOffset;

  /**
   * 时间标准差异，即 UT1 - UTC，以秒为单位。
   * @type {number}
   */
  this.ut1MinusUtc = ut1MinusUtc;
}
export default EarthOrientationParametersSample;
