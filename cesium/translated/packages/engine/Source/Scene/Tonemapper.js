// @ts-check

/**
 * 用于高动态范围渲染的音变算法。
 *
 * @enum {string}
 */
const Tonemapper = {
  /**
   * 使用 Reinhard 音变算法。
   *
   * @type {string}
   * @constant
   */
  REINHARD: "REINHARD",

  /**
   * 使用改进的 Reinhard 音变算法。
   *
   * @type {string}
   * @constant
   */
  MODIFIED_REINHARD: "MODIFIED_REINHARD",

  /**
   * 使用 Filmic 音变算法。
   *
   * @type {string}
   * @constant
   */
  FILMIC: "FILMIC",

  /**
   * 使用 ACES 音变算法。
   *
   * @type {string}
   * @constant
   */
  ACES: "ACES",

  /**
   * Use the PBR Neutral tonemapping {@link https://github.com/KhronosGroup/ToneMapping/tree/main/PBR_Neutral|from Khronos}.
   *
   * @type {string}
   * @constant
   */
  PBR_NEUTRAL: "PBR_NEUTRAL",
};

/**
 * 验证所提供的值是否为已知的音变器类型。
 * @private
 *
 * @param {string} tonemapper
 */
export function validateTonemapper(tonemapper) {
  return (
    tonemapper === Tonemapper.REINHARD ||
    tonemapper === Tonemapper.MODIFIED_REINHARD ||
    tonemapper === Tonemapper.FILMIC ||
    tonemapper === Tonemapper.ACES ||
    tonemapper === Tonemapper.PBR_NEUTRAL
  );
}

Object.freeze(Tonemapper);

export default Tonemapper;