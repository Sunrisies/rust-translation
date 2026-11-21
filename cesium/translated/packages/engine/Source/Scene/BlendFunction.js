// @ts-check

import { WebGLConstants } from "@cesium/core";
/**
 * 确定混合因子如何计算。
 *
 * @enum {number}
 */
const BlendFunction = {
  /**
   * 混合因子为零。
   *
   * @type {number}
   * @constant
   */
  ZERO: WebGLConstants.ZERO,

  /**
   * 混合因子为一。
   *
   * @type {number}
   * @constant
   */
  ONE: WebGLConstants.ONE,

  /**
   * 混合因子是源颜色。
   *
   * @type {number}
   * @constant
   */
  SOURCE_COLOR: WebGLConstants.SRC_COLOR,

  /**
   * 混合因子为一减去源颜色。
   *
   * @type {number}
   * @constant
   */
  ONE_MINUS_SOURCE_COLOR: WebGLConstants.ONE_MINUS_SRC_COLOR,

  /**
   * 混合因子是目标颜色。
   *
   * @type {number}
   * @constant
   */
  DESTINATION_COLOR: WebGLConstants.DST_COLOR,

  /**
   * 混合因子为一减去目标颜色。
   *
   * @type {number}
   * @constant
   */
  ONE_MINUS_DESTINATION_COLOR: WebGLConstants.ONE_MINUS_DST_COLOR,

  /**
   * 混合因子是源Alpha值。
   *
   * @type {number}
   * @constant
   */
  SOURCE_ALPHA: WebGLConstants.SRC_ALPHA,

  /**
   * 混合因子为一减去源Alpha值。
   *
   * @type {number}
   * @constant
   */
  ONE_MINUS_SOURCE_ALPHA: WebGLConstants.ONE_MINUS_SRC_ALPHA,

  /**
   * 混合因子是目标Alpha值。
   *
   * @type {number}
   * @constant
   */
  DESTINATION_ALPHA: WebGLConstants.DST_ALPHA,

  /**
   * 混合因子为一减去目标Alpha值。
   *
   * @type {number}
   * @constant
   */
  ONE_MINUS_DESTINATION_ALPHA: WebGLConstants.ONE_MINUS_DST_ALPHA,

  /**
   * 混合因子是恒色。
   *
   * @type {number}
   * @constant
   */
  CONSTANT_COLOR: WebGLConstants.CONSTANT_COLOR,

  /**
   * 混合因子为一减去恒色。
   *
   * @type {number}
   * @constant
   */
  ONE_MINUS_CONSTANT_COLOR: WebGLConstants.ONE_MINUS_CONSTANT_COLOR,

  /**
   * 混合因子是恒Alpha值。
   *
   * @type {number}
   * @constant
   */
  CONSTANT_ALPHA: WebGLConstants.CONSTANT_ALPHA,

  /**
   * 混合因子为一减去恒Alpha值。
   *
   * @type {number}
   * @constant
   */
  ONE_MINUS_CONSTANT_ALPHA: WebGLConstants.ONE_MINUS_CONSTANT_ALPHA,

  /**
   * 混合因子是饱和的源Alpha值。
   *
   * @type {number}
   * @constant
   */
  SOURCE_ALPHA_SATURATE: WebGLConstants.SRC_ALPHA_SATURATE,
};

Object.freeze(BlendFunction);

export default BlendFunction;
