import ShaderSource from "../Renderer/ShaderSource.js";

/**
 * 支持在屏幕的仅一侧渲染内容。
 *
 * @private
 */
const Splitter = {
  /**
   * 给定一个片段着色器字符串，返回其修改版本，该版本
   * 仅在屏幕的某一侧渲染。另一侧的片段将被丢弃。屏幕侧通过名为
   * `czm_splitDirection` 的统一变量来指定，可通过调用
   * {@link Splitter#addUniforms} 添加该变量，分割位置则通过名为
   * {@link Splitter#addUniforms}, and the split position is given by an
   * 将 `czm_splitDirection` 添加到给定的统一变量映射中。
   */
  modifyFragmentShader: function modifyFragmentShader(shader) {
    shader = ShaderSource.replaceMain(shader, "czm_splitter_main");
    shader +=
      // czm_splitPosition is not declared because it is an automatic uniform.
      "uniform float czm_splitDirection; \n" +
      "void main() \n" +
      "{ \n" +
      // Don't split when rendering the shadow map, because it is rendered from
      // the perspective of a totally different camera.
      "#ifndef SHADOW_MAP\n" +
      "    if (czm_splitDirection < 0.0 && gl_FragCoord.x > czm_splitPosition) discard; \n" +
      "    if (czm_splitDirection > 0.0 && gl_FragCoord.x < czm_splitPosition) discard; \n" +
      "#endif\n" +
      "    czm_splitter_main(); \n" +
      "} \n";

    return shader;
  },

  /**
   * 将 `czm_splitDirection` 添加到给定的统一变量映射中。
   *
   * @param {object} object 可以查找 `splitDirection` 属性的对象。
   * @param {object} uniformMap 统一变量映射。
   */
  addUniforms: function addUniforms(object, uniformMap) {
    uniformMap.czm_splitDirection = function () {
      return object.splitDirection;
    };
  },
};

export default Splitter;