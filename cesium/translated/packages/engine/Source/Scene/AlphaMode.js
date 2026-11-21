// @ts-check

/**
 * 材料的透明度渲染模式。
 *
 * @enum {string}
 * @private
 */
const AlphaMode = {
  /**
   * 忽略透明度值，渲染输出完全不透明。
   *
   * @type {string}
   * @constant
   */
  OPAQUE: "OPAQUE",

  /**
   * 根据透明度值和指定的透明度截止值，渲染输出要么完全不透明，要么完全透明。
   *
   * @type {string}
   * @constant
   */
  MASK: "MASK",

  /**
   * 通过透明度混合技术，将渲染输出叠加到目标上。
   *
   * @type {string}
   * @constant
   */
  BLEND: "BLEND",
};

Object.freeze(AlphaMode);

export default AlphaMode;
