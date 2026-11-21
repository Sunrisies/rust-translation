/**
 * 一个枚举，描述 {@link CustomShader} 将如何被添加到
 * 片段着色器。这决定了着色器与材质之间的交互方式。
 *
 * @enum {string}
 *
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，但此内容尚未定稿，可能根据 Cesium 的标准弃用政策发生变化。
 */
const CustomShaderMode = {
  /**
   * 自定义着色器将用于修改材质阶段的结果。
   * 在光照应用之前。
   *
   * @type {string}
   * @constant
   */
  MODIFY_MATERIAL: "MODIFY_MATERIAL",
  /**
   * 将使用自定义着色器而非材质阶段。这是一个提示，
   * 以优化材质处理代码。
   *
   * @type {string}
   * @constant
   */
  REPLACE_MATERIAL: "REPLACE_MATERIAL",
};

/**
 * 将着色器模式转换为大写标识符，以便用于 GLSL 定义指令中。例如：<code>#define CUSTOM_SHADER_MODIFY_MATERIAL</code>
 * directives. For example:  <code>#define CUSTOM_SHADER_MODIFY_MATERIAL</code>
 * @param {CustomShaderMode} customShaderMode 着色器模式
 * @return {string} The 用于使用的 GLSL 宏名称
 *
 * @private
 */
CustomShaderMode.getDefineName = function (customShaderMode) {
  return `CUSTOM_SHADER_${customShaderMode}`;
};

Object.freeze(CustomShaderMode);

export default CustomShaderMode;
