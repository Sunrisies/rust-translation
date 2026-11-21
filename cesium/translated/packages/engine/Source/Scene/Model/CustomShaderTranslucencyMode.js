// @ts-check

/**
 * 用于控制 {@link CustomShader} 如何处理与原始版本不同的半透明效果的枚举值。
 * 基础几何体。
 *
 * @enum {number}
 *
 * @experimental This 该特性采用了 3D Tiles 规范中的部分内容，但此内容尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */
const CustomShaderTranslucencyMode = {
  /**
   * 从基础几何体的材质中继承半透明设置。如果基础几何体使用了
   * 半透明材质，自定义着色器也会被视为半透明。如果基础几何体使用了
   * 不透明材质，自定义着色器则被视为不透明。
   *
   * @type {number}
   * @constant
   */
  INHERIT: 0,
  /**
   * 强制基础几何体以不透明状态渲染，忽略所有材质设置。
   *
   * @type {number}
   * @constant
   */
  OPAQUE: 1,
  /**
   * 强制基础几何体以半透明状态渲染，忽略所有材质设置。
   *
   * @type {number}
   * @constant
   */
  TRANSLUCENT: 2,
};

Object.freeze(CustomShaderTranslucencyMode);

export default CustomShaderTranslucencyMode;
