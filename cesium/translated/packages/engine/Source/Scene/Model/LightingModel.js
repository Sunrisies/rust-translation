// @ts-check

/**
 * 用于为 {@link Model} 提供光照的照明模型。
 *
 * @enum {number}
 *
 * @experimental This 该特性采用了 3D Tiles 规范中的部分内容，但此内容尚未定稿，可能根据 Cesium 的标准弃用政策发生变化。
 */
const LightingModel = {
  /**
   * 使用无光照渲染模式，即跳过光照计算。模型的
   * 漫反射颜色（假设为线性 RGB 格式，而非 sRGB 格式）直接用于计算 <code>out_FragColor</code>。Alpha 模式仍然被应用。
   * 。
   * 。
   *
   * @type {number}
   * @constant
   */
  UNLIT: 0,
  /**
   * 使用基于物理的渲染光照计算。这包括
   * PBR 金属粗糙度和 PBR 高光光泽度。在可能的情况下，也会采用基于影像的光照方式。
   * lighting is also applied when possible.
   *
   * @type {number}
   * @constant
   */
  PBR: 1,
};

Object.freeze(LightingModel);

export default LightingModel;
