// @ts-check

/**
 * 决定集合中基本体中的不透明和半透明部分如何与场景进行混合。
 * 集合在渲染通道、混合和深度行为上有所不同。
 * 它们针对每个选项选择不同的混合方式；请参阅相关集合的 <code>blendOption</code> 文档说明。
 * 此处指特定的集合。
 *
 * @enum {number}
 */
const BlendOption = {
  /**
   * 集合中的基本体完全不透明。
   * @type {number}
   * @constant
   */
  OPAQUE: 0,

  /**
   * 集合中的基本体完全半透明。
   * @type {number}
   * @constant
   */
  TRANSLUCENT: 1,

  /**
   * 集合中的基本体既不透明又半透明，每个基本体
   * 都根据其自身的不透明度进行绘制。
   * @type {number}
   * @constant
   */
  OPAQUE_AND_TRANSLUCENT: 2,
};

Object.freeze(BlendOption);

export default BlendOption;
