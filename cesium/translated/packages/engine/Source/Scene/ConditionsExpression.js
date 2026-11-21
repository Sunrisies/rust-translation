import { addAllToArray, clone, defined } from "@cesium/core";
import Expression from "./Expression.js";

/**
 * 应用于 {@link Cesium3DTileset} 的样式表达式。
 * <p>
 * 用于评估使用 3D Tiles Styling 语言定义的条件表达式。
 * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language}
 * </p>
 * <p>
 * 实现 {@link StyleExpression} 接口。
 * </p>
 *
 * @alias ConditionsExpression
 * @constructor
 *
 * @param {object} [conditionsExpression] 使用 3D Tiles Styling 语言定义的条件表达式。
 * @param {object} [defines] 在样式中定义。
 *
 * @example
 * const expression = new Cesium.ConditionsExpression({
 * conditions : [
 * ['${Area} > 10, 'color("#FF0000")'],
 * ['${id} !== "1"', 'color("#00FF00")'],
 * ['true', 'color("#FFFFFF")']
 *     ]
 * });
 * expression.evaluateColor(feature, result); // 返回 Cesium.Color 对象
 */
function ConditionsExpression(conditionsExpression, defines) {
  this._conditionsExpression = clone(conditionsExpression, true);
  this._conditions = conditionsExpression.conditions;
  this._runtimeConditions = undefined;

  setRuntime(this, defines);
}

Object.defineProperties(ConditionsExpression.prototype, {
  /**
   * 获取使用 3D Tiles Styling 语言定义的条件表达式。
   *
   * @memberof ConditionsExpression.prototype
   *
   * @type {object}
   * @readonly
   *
   * @default undefined
   */
  conditionsExpression: {
    get: function () {
      return this._conditionsExpression;
    },
  },
});

function Statement(condition, expression) {
  this.condition = condition;
  this.expression = expression;
}

function setRuntime(expression, defines) {
  const runtimeConditions = [];
  const conditions = expression._conditions;
  if (!defined(conditions)) {
    return;
  }
  const length = conditions.length;
  for (let i = 0; i < length; ++i) {
    const statement = conditions[i];
    const cond = String(statement[0]);
    const condExpression = String(statement[1]);
    runtimeConditions.push(
      new Statement(
        new Expression(cond, defines),
        new Expression(condExpression, defines),
      ),
    );
  }
  expression._runtimeConditions = runtimeConditions;
}

/**
 * 评估表达式的结果，可选地使用提供的特征属性。如果表达式的结果
 * 在
 * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language}
 * 为 <code>Boolean</code>、<code>Number</code> 或 <code>String</code> 类型，将返回相应的 JavaScript
 * 原始类型。如果结果为 <code>RegExp</code>，将返回 Javascript <code>RegExp</code>
 * 对象。如果结果为 <code>Cartesian2</code>、<code>Cartesian3</code> 或 <code>Cartesian4</code>，
 * 将返回 {@link Cartesian2}、{@link Cartesian3} 或 {@link Cartesian4} 对象。如果 <code>result</code> 参数为
 * a {@link Color}, the {@link Cartesian4} value is converted to a {@link Color} and then returned.
 *
 * @param {Cesium3DTileFeature} feature 可作为表达式变量使用的特征属性。
 * @param {object} [result] 存储结果的对象。
 * @returns {boolean|number|string|RegExp|Cartesian2|Cartesian3|Cartesian4|Color} The 评估表达式的结果。
 */
ConditionsExpression.prototype.evaluate = function (feature, result) {
  const conditions = this._runtimeConditions;
  if (!defined(conditions)) {
    return undefined;
  }
  const length = conditions.length;
  for (let i = 0; i < length; ++i) {
    const statement = conditions[i];
    if (statement.condition.evaluate(feature)) {
      return statement.expression.evaluate(feature, result);
    }
  }
};

/**
 * 使用特征定义的值评估 Color 表达式的结果。
 * <p>
 * 等同于 {@link ConditionsExpression#evaluate}，但始终返回 {@link Color} 对象。
 * </p>
 * @param {Cesium3DTileFeature} feature 可作为表达式变量使用的特征属性。
 * @param {Color} [result] 存储结果的对象。
 * @returns {Color} The 修改后的 result 参数或一个新的 Color 实例（如果未提供）。
 */
ConditionsExpression.prototype.evaluateColor = function (feature, result) {
  const conditions = this._runtimeConditions;
  if (!defined(conditions)) {
    return undefined;
  }
  const length = conditions.length;
  for (let i = 0; i < length; ++i) {
    const statement = conditions[i];
    if (statement.condition.evaluate(feature)) {
      return statement.expression.evaluateColor(feature, result);
    }
  }
};

/**
 * 获取该表达式的着色器函数。
 * 如果无法从该表达式生成着色器函数，则返回 undefined。
 *
 * @param {string} functionSignature 生成函数的签名。
 * @param {object} variableSubstitutionMap 将变量名称映射到着色器变量名称。
 * @param {object} shaderState 存储关于生成的着色器函数信息，包括其是否为半透明。
 * @param {string} returnType 生成函数的返回类型。
 *
 * @returns {string} The 着色器函数。
 *
 * @private
 */
ConditionsExpression.prototype.getShaderFunction = function (
  functionSignature,
  variableSubstitutionMap,
  shaderState,
  returnType,
) {
  const conditions = this._runtimeConditions;
  if (!defined(conditions) || conditions.length === 0) {
    return undefined;
  }

  let shaderFunction = "";
  const length = conditions.length;
  for (let i = 0; i < length; ++i) {
    const statement = conditions[i];

    const condition = statement.condition.getShaderExpression(
      variableSubstitutionMap,
      shaderState,
    );
    const expression = statement.expression.getShaderExpression(
      variableSubstitutionMap,
      shaderState,
    );

    // Build the if/else chain from the list of conditions
    shaderFunction +=
      `    ${i === 0 ? "if" : "else if"} (${condition})\n` +
      `    {\n` +
      `        return ${expression};\n` +
      `    }\n`;
  }

  shaderFunction =
    `${returnType} ${functionSignature}\n` +
    `{\n${shaderFunction}    return ${returnType}(1.0);\n` + // Return a default value if no conditions are met
    `}\n`;

  return shaderFunction;
};

/**
 * 获取表达式使用的变量。
 *
 * @returns {string[]} The 表达式使用的变量。
 *
 * @private
 */
ConditionsExpression.prototype.getVariables = function () {
  let variables = [];

  const conditions = this._runtimeConditions;
  if (!defined(conditions) || conditions.length === 0) {
    return variables;
  }

  const length = conditions.length;
  for (let i = 0; i < length; ++i) {
    const statement = conditions[i];
    addAllToArray(variables, statement.condition.getVariables());
    addAllToArray(variables, statement.expression.getVariables());
  }

  // Remove duplicates
  variables = variables.filter(function (variable, index, variables) {
    return variables.indexOf(variable) === index;
  });

  return variables;
};

export default ConditionsExpression;