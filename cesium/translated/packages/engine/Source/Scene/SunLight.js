import { Color, Frozen } from "@cesium/core";

/**
 * 一种源自太阳的方向性光源。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Color} [options.color=Color.WHITE] 光线的颜色。
 * @param {number} [options.intensity=2.0] 光线的强度。
 *
 * @alias SunLight
 * @constructor
 */
function SunLight(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  /**
   * 光线的颜色。
   * @type {Color}
   * @default Color.WHITE
   */
  this.color = Color.clone(options.color ?? Color.WHITE);

  /**
   * 光线的强度。
   * @type {number}
   * @default 2.0
   */
  this.intensity = options.intensity ?? 2.0;
}

export default SunLight;
