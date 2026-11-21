// @ts-check

/**
 * 决定 glTF 动画是否以及如何循环播放。
 *
 * @enum {number}
 *
 * @see ModelAnimationCollection#add
 */
const ModelAnimationLoop = {
  /**
   * 播放动画一次，不进行循环。
   *
   * @type {number}
   * @constant
   */
  NONE: 0,

  /**
   * 在动画停止后立即从头开始播放，使其循环。
   *
   * @type {number}
   * @constant
   */
  REPEAT: 1,

  /**
   * 使动画循环播放。首先正向播放，然后反向播放，再正向播放，如此反复。
   *
   * @type {number}
   * @constant
   */
  MIRRORED_REPEAT: 2,
};

Object.freeze(ModelAnimationLoop);

export default ModelAnimationLoop;
