/**
 * 包含在特定时间计算的方向数据的结构。这些数据
 * 表示旋转极的方向以及围绕该极的旋转。
 * <p>
 * 这些参数与 IAU/IAG 工作组的报告中的参数相对应，
 * 只是以弧度为单位表示。
 * </p>
 *
 * @namespace IauOrientationParameters
 *
 * @ignore
 */
function IauOrientationParameters(
  rightAscension,
  declination,
  rotation,
  rotationRate,
) {
  /**
   * 天体北极相对于国际天球参考框架的赤经，以弧度为单位。
   * 天体北极相对于国际天球参考框架的赤纬，以弧度为单位。
   * @type {number}
   *
   * @ignore
   */
  this.rightAscension = rightAscension;

  /**
   * 天体北极相对于国际天球参考框架的赤纬，以弧度为单位。
   * 用于使一组轴与 IAU 报告定义的子午线对齐的旋转，以弧度为单位。
   * @type {number}
   *
   * @ignore
   */
  this.declination = declination;

  /**
   * 围绕北极的瞬时旋转速率，以弧度/秒为单位。
   * the meridian defined by the IAU report, in radians.
   * @type {number}
   *
   * @ignore
   */
  this.rotation = rotation;

  /**
   * The instantaneous rotation rate about the north pole, in radians per second.
   * @type {number}
   *
   * @ignore
   */
  this.rotationRate = rotationRate;
}
export default IauOrientationParameters;
