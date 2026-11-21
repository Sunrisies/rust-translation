import { Check } from "@cesium/core";

/**
 * 获取一个 GLSL 代码片段，该代码使用 {@link getClippingFunction} 中的 `clip` 函数对片段进行裁剪并应用样式。
 *
 * @param {string} samplerUniformName 裁剪平面纹理采样器的统一变量名称。
 * @param {string} matrixUniformName 裁剪平面矩阵的统一变量名称。
 * @param {string} styleUniformName 裁剪平面样式的统一变量名称，类型为 vec4。
 * @returns {string} A 包含用于裁剪和样式化当前片段的 GLSL 代码字符串。
 * @private
 */
function getClipAndStyleCode(
  samplerUniformName,
  matrixUniformName,
  styleUniformName,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("samplerUniformName", samplerUniformName);
  Check.typeOf.string("matrixUniformName", matrixUniformName);
  Check.typeOf.string("styleUniformName", styleUniformName);
  //>>includeEnd('debug');

  const shaderCode =
    `    float clipDistance = clip(gl_FragCoord, ${samplerUniformName}, ${matrixUniformName}); \n` +
    `    vec4 clippingPlanesEdgeColor = vec4(1.0); \n` +
    `    clippingPlanesEdgeColor.rgb = ${styleUniformName}.rgb; \n` +
    `    float clippingPlanesEdgeWidth = ${styleUniformName}.a; \n` +
    `    if (clipDistance > 0.0 && clipDistance < clippingPlanesEdgeWidth) \n` +
    `    { \n` +
    `        out_FragColor = clippingPlanesEdgeColor;\n` +
    `    } \n`;
  return shaderCode;
}
export default getClipAndStyleCode;
