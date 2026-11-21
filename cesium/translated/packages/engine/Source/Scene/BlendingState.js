// @ts-check

import BlendEquation from "./BlendEquation.js";
import BlendFunction from "./BlendFunction.js";

/**
 * 混合状态结合了 {@link BlendEquation} 和 {@link BlendFunction}，并通过
 * <code>enabled</code> 标志来定义在渲染时结合源和
 * 目标片段的完整混合状态。
 * <p>
 * 这是在使用 {@link Appearance#renderState} 的自定义渲染状态时使用的辅助方法。
 * </p>
 *
 * @namespace
 */
const BlendingState = {
  /**
   * 混合被禁用。
   *
   * @type {object}
   * @constant
   */
  DISABLED: Object.freeze({
    enabled: false,
  }),

  /**
   * 使用 alpha 混合，通过 <code>source(source.alpha) + destination(1 - source.alpha)</code> 启用混合。
   *
   * @type {object}
   * @constant
   */
  ALPHA_BLEND: Object.freeze({
    enabled: true,
    equationRgb: BlendEquation.ADD,
    equationAlpha: BlendEquation.ADD,
    functionSourceRgb: BlendFunction.SOURCE_ALPHA,
    functionSourceAlpha: BlendFunction.ONE,
    functionDestinationRgb: BlendFunction.ONE_MINUS_SOURCE_ALPHA,
    functionDestinationAlpha: BlendFunction.ONE_MINUS_SOURCE_ALPHA,
  }),

  /**
   * 使用预乘 alpha 的 alpha 混合，通过 <code>source + destination(1 - source.alpha)</code> 启用混合。
   *
   * @type {object}
   * @constant
   */
  PRE_MULTIPLIED_ALPHA_BLEND: Object.freeze({
    enabled: true,
    equationRgb: BlendEquation.ADD,
    equationAlpha: BlendEquation.ADD,
    functionSourceRgb: BlendFunction.ONE,
    functionSourceAlpha: BlendFunction.ONE,
    functionDestinationRgb: BlendFunction.ONE_MINUS_SOURCE_ALPHA,
    functionDestinationAlpha: BlendFunction.ONE_MINUS_SOURCE_ALPHA,
  }),

  /**
   * 使用加法混合，通过 <code>source(source.alpha) + destination</code> 启用混合。
   *
   * @type {object}
   * @constant
   */
  ADDITIVE_BLEND: Object.freeze({
    enabled: true,
    equationRgb: BlendEquation.ADD,
    equationAlpha: BlendEquation.ADD,
    functionSourceRgb: BlendFunction.SOURCE_ALPHA,
    functionSourceAlpha: BlendFunction.ONE,
    functionDestinationRgb: BlendFunction.ONE,
    functionDestinationAlpha: BlendFunction.ONE,
  }),
};

Object.freeze(BlendingState);

export default BlendingState;
