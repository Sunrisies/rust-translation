import { DeveloperError } from "@cesium/core";

/**
 * 用于动态生成 GLSL 函数的工具函数
 *
 * @alias ShaderFunction
 * @constructor
 *
 * @see {@link ShaderBuilder}
 * @param {string} signature 函数在着色器中的完整签名，不包括花括号。
 * @example
 * // 生成以下函数
 * //
 * // void assignVaryings(vec3 position)
 * // {
 * //    v_positionEC = (czm_modelView * vec4(a_position, 1.0)).xyz;
 * //    v_texCoord = a_texCoord;
 * // }
 * const signature = "void assignVaryings(vec3 position)";
 * const func = new ShaderFunction(signature);
 * func.addLine("v_positionEC = (czm_modelView * vec4(a_position, 1.0)).xyz;");
 * func.addLine("v_texCoord = a_texCoord;");
 * const generatedLines = func.generateGlslLines();
 *
 * @private
 */
function ShaderFunction(signature) {
  this.signature = signature;
  this.body = [];
}

/**
 * 向函数体添加一行或多行代码
 * @param {string|string[]} lines 要添加到函数体中的一行或多行 GLSL 代码。不要包含任何前导或尾随空格，但每行必须包含分号。
 */
ShaderFunction.prototype.addLines = function (lines) {
  //>>includeStart('debug', pragmas.debug);
  if (typeof lines !== "string" && !Array.isArray(lines)) {
    throw new DeveloperError(
      `Expected lines to be a string or an array of strings, actual value was ${lines}`,
    );
  }
  //>>includeEnd('debug');
  const body = this.body;

  // Indent the body of the function by 4 spaces
  if (Array.isArray(lines)) {
    const length = lines.length;
    for (let i = 0; i < length; i++) {
      body.push(`    ${lines[i]}`);
    }
  } else {
    // Single string case
    body.push(`    ${lines}`);
  }
};

/**
 * 生成适用于 {@link ShaderBuilder} 的 GLSL 代码行
 * @return {string[]}
 */
ShaderFunction.prototype.generateGlslLines = function () {
  return [].concat(this.signature, "{", this.body, "}");
};

export default ShaderFunction;
