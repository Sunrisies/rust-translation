import { DeveloperError } from "@cesium/core";

/**
 * 应用于 {@link Cesium3DTileset} 的样式表达式。
 * <p>
 * 此接口的派生类在
 * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language} 中评估表达式。
 * </p>
 * <p>
 * 此类型描述一个接口，不用于直接实例化。
 * </p>
 *
 * @alias StyleExpression
 * @constructor
 *
 * @see Expression
 * @see ConditionsExpression
 */
function StyleExpression() {}

/**
 * 评估表达式的结果，可选使用提供的功能属性。如果表达式的结果在
 * 的
 * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language}
 * 的类型为 <code>Boolean</code>、<code>Number</code> 或 <code>String</code>，将返回相应的 JavaScript
 * 原始类型。如果结果是 <code>RegExp</code>，将返回 Javascript <code>RegExp</code>
 * 对象。如果结果是 <code>Cartesian2</code>、<code>Cartesian3</code> 或 <code>Cartesian4</code>，
 * 将返回 {@link Cartesian2}、{@link Cartesian3} 或 {@link Cartesian4} 对象。如果 <code>result</code> 参数为
 * {@link Color}，则 {@link Cartesian4} 值将被转换为 {@link Color} 然后返回。
 *
 * @param {Cesium3DTileFeature} feature 可作为表达式变量使用的功能属性。
 * @param {object} [result] 存储结果的对象。
 * @returns {boolean|number|string|RegExp|Cartesian2|Cartesian3|Cartesian4|Color} The 评估表达式的结果。
 */
StyleExpression.prototype.evaluate = function (feature, result) {
  DeveloperError.throwInstantiationError();
};

/**
 * 评估 Color 表达式的结果，可选使用提供的功能属性。
 * <p>
 * 这等同于 {@link StyleExpression#evaluate}，但始终返回 {@link Color} 对象。
 * </p>
 *
 * @param {Cesium3DTileFeature} feature 可作为表达式变量使用的功能属性。
 * @param {Color} [result] 存储结果的对象。
 * @returns {Color} The 修改过的 result 参数或一个新的 <code>Color</code> 实例（如果未提供）。
 */
StyleExpression.prototype.evaluateColor = function (feature, result) {
  DeveloperError.throwInstantiationError();
};

/**
 * 获取此表达式的着色器函数。
 * 如果无法从该表达式生成着色器函数，则返回 undefined。
 *
 * @param {string} functionSignature 生成函数的签名。
 * @param {object} variableSubstitutionMap 将变量名称映射到着色器变量名称。
 * @param {object} shaderState 存储关于生成的着色器函数信息，包括其是否半透明。
 * @param {string} returnType 生成函数的返回类型。
 *
 * @returns {string} The 着色器函数。
 *
 * @private
 */
StyleExpression.prototype.getShaderFunction = function (
  functionSignature,
  variableSubstitutionMap,
  shaderState,
  returnType,
) {
  DeveloperError.throwInstantiationError();
};

/**
 * 获取表达式使用的变量。
 *
 * @returns {string[]} The 表达式使用的变量。
 *
 * @private
 */
StyleExpression.prototype.getVariables = function () {
  DeveloperError.throwInstantiationError();
};

export default StyleExpression;
