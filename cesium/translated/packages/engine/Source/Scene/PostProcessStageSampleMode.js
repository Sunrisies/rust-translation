/**
 * 指定输入纹理被 {@link PostProcessStage} 采样的方式。
 *
 * @enum {number}
 */
const PostProcessStageSampleMode = {
  /**
   * 通过返回最近的纹素来采样纹理。
   *
   * @type {number}
   * @constant
   */
  NEAREST: 0,
  /**
   * 通过四个最近的纹素的双线性插值来采样纹理。
   *
   * @type {number}
   * @constant
   */
  LINEAR: 1,
};
export default PostProcessStageSampleMode;
