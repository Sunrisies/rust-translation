import { Cartesian3, Check, Color, DeveloperError } from "@cesium/core";

/**
 * 从无限远处向单一方向发射的光。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Cartesian3} options.direction 光发射的方向。
 * @param {Color} [options.color=Color.WHITE] 光的颜色。
 * @param {number} [options.intensity=1.0] 光的强度。
 *
 * @exception {DeveloperError} options.direction 不能为零长度。
 *
 * @alias DirectionalLight
 * @constructor
 */
function DirectionalLight(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options", options);
  Check.typeOf.object("options.direction", options.direction);
  if (Cartesian3.equals(options.direction, Cartesian3.ZERO)) {
    throw new DeveloperError("options.direction cannot be zero-length");
  }
  //>>includeEnd('debug');

  /**
   * 光发射的方向。
   * @type {Cartesian3}
   */
  this.direction = Cartesian3.clone(options.direction);

  /**
   * 光的颜色。
   * @type {Color}
   * @default Color.WHITE
   */
  this.color = Color.clone(options.color ?? Color.WHITE);

  /**
   * 光的强度。
   * @type {number}
   * @default 1.0
   */
  this.intensity = options.intensity ?? 1.0;
}

export default DirectionalLight;
