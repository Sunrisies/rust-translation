/**
 * @alias KmlLookAt
 * @constructor
 *
 * @param {Cartesian3} position 相机位置
 * @param {HeadingPitchRange} headingPitchRange 相机朝向
 */
function KmlLookAt(position, headingPitchRange) {
  this.position = position;
  this.headingPitchRange = headingPitchRange;
}
export default KmlLookAt;
