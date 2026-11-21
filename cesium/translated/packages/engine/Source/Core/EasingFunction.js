import { Easing } from "@tweenjs/tween.js";

/**
 * 用于 TweenCollection 的缓动函数。这些函数来自
 * {@link https://github.com/sole/tween.js/|Tween.js} 和 Robert Penner。请参见
 * {@link http://sole.github.io/tween.js/examples/03_graphs.html|Tween.js graphs for each function}.
 *
 * @namespace
 */
const EasingFunction = {
  /**
   * 线性缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  LINEAR_NONE: Easing.Linear.None,

  /**
   * 二次缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUADRATIC_IN: Easing.Quadratic.In,
  /**
   * 二次结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUADRATIC_OUT: Easing.Quadratic.Out,
  /**
   * 先二次再二次结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUADRATIC_IN_OUT: Easing.Quadratic.InOut,

  /**
   * 三次缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  CUBIC_IN: Easing.Cubic.In,
  /**
   * 三次结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  CUBIC_OUT: Easing.Cubic.Out,
  /**
   * 三次缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  CUBIC_IN_OUT: Easing.Cubic.InOut,

  /**
   * 四次缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUARTIC_IN: Easing.Quartic.In,
  /**
   * 四次结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUARTIC_OUT: Easing.Quartic.Out,
  /**
   * 四次缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUARTIC_IN_OUT: Easing.Quartic.InOut,

  /**
   * 五次缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUINTIC_IN: Easing.Quintic.In,
  /**
   * 五次结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUINTIC_OUT: Easing.Quintic.Out,
  /**
   * 五次缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  QUINTIC_IN_OUT: Easing.Quintic.InOut,

  /**
   * 正弦缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  SINUSOIDAL_IN: Easing.Sinusoidal.In,
  /**
   * 正弦结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  SINUSOIDAL_OUT: Easing.Sinusoidal.Out,
  /**
   * 正弦缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  SINUSOIDAL_IN_OUT: Easing.Sinusoidal.InOut,

  /**
   * 指数缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  EXPONENTIAL_IN: Easing.Exponential.In,
  /**
   * 指数结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  EXPONENTIAL_OUT: Easing.Exponential.Out,
  /**
   * 指数缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  EXPONENTIAL_IN_OUT: Easing.Exponential.InOut,

  /**
   * 循环缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  CIRCULAR_IN: Easing.Circular.In,
  /**
   * 循环结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  CIRCULAR_OUT: Easing.Circular.Out,
  /**
   * 循环缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  CIRCULAR_IN_OUT: Easing.Circular.InOut,

  /**
   * 弹性缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  ELASTIC_IN: Easing.Elastic.In,
  /**
   * 弹性结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  ELASTIC_OUT: Easing.Elastic.Out,
  /**
   * 弹性缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  ELASTIC_IN_OUT: Easing.Elastic.InOut,

  /**
   * 回弹缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  BACK_IN: Easing.Back.In,
  /**
   * 回弹结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  BACK_OUT: Easing.Back.Out,
  /**
   * 回弹缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  BACK_IN_OUT: Easing.Back.InOut,

  /**
   * 弹跳缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  BOUNCE_IN: Easing.Bounce.In,
  /**
   * 弹跳结束缓动。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  BOUNCE_OUT: Easing.Bounce.Out,
  /**
   * 弹跳缓动然后结束。
   *
   * @type {EasingFunction.Callback}
   * @constant
   */
  BOUNCE_IN_OUT: Easing.Bounce.InOut,
};

/**
 * 实现自定义缓动函数的函数接口。
 * @callback EasingFunction.Callback
 * @param {number} time 时间范围在 <code>[0, 1]</code> 内。
 * @returns {number} The 给定时间下的函数值。
 *
 * @example
 * 函数 quadraticIn(time) {
 * 返回 time * time;
 * }
 *
 * @example
 * 函数 quadraticOut(time) {
 * 返回 time * (2.0 - time);
 * }
 */

export default Object.freeze(EasingFunction);