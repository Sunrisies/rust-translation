// @ts-check

import { WebGLConstants } from "@cesium/core";
/**
 * 决定两个像素值如何组合。
 *
 * @enum {number}
 */
const BlendEquation = {
  /**
   * 像素值按分量相加。此方式用于实现半透明效果的叠加混合。
   *
   * @type {number}
   * @constant
   */
  ADD: WebGLConstants.FUNC_ADD,

  /**
   * 像素值按分量相减（源值 - 目标值）。此方式用于实现半透明效果的 alpha 混合。
   *
   * @type {number}
   * @constant
   */
  SUBTRACT: WebGLConstants.FUNC_SUBTRACT,

  /**
   * 像素值按分量相减（目标值 - 源值）。
   *
   * @type {number}
   * @constant
   */
  REVERSE_SUBTRACT: WebGLConstants.FUNC_REVERSE_SUBTRACT,

  /**
   * 像素值被赋予最小值函数（min(源值, 目标值)）。
   *
   * 该公式针对每个像素颜色分量进行运算。
   *
   * @type {number}
   * @constant
   */
  MIN: WebGLConstants.MIN,

  /**
   * 像素值被赋予最大值函数（max(源值, 目标值)）。
   *
   * 该公式同样针对每个像素颜色分量进行运算。
   *
   * @type {number}
   * @constant
   */
  MAX: WebGLConstants.MAX,
};

Object.freeze(BlendEquation);

export default BlendEquation;
