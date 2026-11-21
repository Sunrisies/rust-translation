import {
  Check,
  DeveloperError,
  addAllToArray,
  clone,
  defined,
} from "@cesium/core";
import ShaderDestination from "./ShaderDestination.js";
import ShaderProgram from "./ShaderProgram.js";
import ShaderSource from "./ShaderSource.js";
import ShaderStruct from "./ShaderStruct.js";
import ShaderFunction from "./ShaderFunction.js";

/**
 * 用于简化 {@link ShaderProgram} 文本构建的对象。它跟踪顶点着色器与片段着色器的 GLSL 代码。
 * <p>
 * 对于顶点着色器，着色器构建器会跟踪 <code>#defines</code> 列表、
 * 属性列表、统一变量列表以及着色器行列表。它还
 * 记录每个属性的位置，以便调用者可以轻松构建 {@link VertexArray}
 * </p>
 * <p>
 * 对于片段着色器，着色器构建器会跟踪 <code>#defines</code> 列表、
 * 属性列表、统一变量列表以及着色器行列表。
 * </p>
 *
 * @alias ShaderBuilder
 * @constructor
 *
 * @example
 * const shaderBuilder = new ShaderBuilder();
 * shaderBuilder.addDefine("SOLID_COLOR", undefined, ShaderDestination.FRAGMENT);
 * shaderBuilder.addUniform("vec3", "u_color", ShaderDestination.FRAGMENT);
 * shaderBuilder.addVarying("vec3", v_color);
 * // 这些位置可在构建 VertexArray 时使用
 * const positionLocation = shaderBuilder.addPositionAttribute("vec3", "a_position");
 * const colorLocation = shaderBuilder.addAttribute("vec3", "a_color");
 * shaderBuilder.addVertexLines([
 * "void main()",
 *  "{",
 * "    v_color = a_color;",
 * "    gl_Position = vec4(a_position, 1.0);",
 *  "}"
 * ]);
 * shaderBuilder.addFragmentLines([
 * "void main()",
 *  "{",
 * "    #ifdef SOLID_COLOR",
 * "    out_FragColor = vec4(u_color, 1.0);",
 * "    #else",
 * "    out_FragColor = vec4(v_color, 1.0);",
 * "    #endif",
 *  "}"
 * ]);
 * const shaderProgram = shaderBuilder.build(context);
 *
 * @private
 */
function ShaderBuilder() {
  // Some WebGL implementations require attribute 0 to always
  // be active, so the position attribute is tracked separately
  this._positionAttributeLine = undefined;
  this._nextAttributeLocation = 1;
  this._attributeLocations = {};
  this._attributeLines = [];

  // Dynamically-generated structs and functions
  // these are dictionaries of id -> ShaderStruct or ShaderFunction respectively
  this._structs = {};
  this._functions = {};

  this._vertexShaderParts = {
    defineLines: [],
    uniformLines: [],
    shaderLines: [],
    varyingLines: [],
    // identifiers of structs/functions to include, listed in insertion order
    structIds: [],
    functionIds: [],
  };
  this._fragmentShaderParts = {
    defineLines: [],
    uniformLines: [],
    shaderLines: [],
    varyingLines: [],
    // identifiers of structs/functions to include, listed in insertion order
    structIds: [],
    functionIds: [],
  };
}

Object.defineProperties(ShaderBuilder.prototype, {
  /**
   * 获取顶点着色器中对应整数位置的属性名称字典
   * 在顶点着色器中。
   *
   * @memberof ShaderBuilder.prototype
   * @type {Object<string, number>}
   * @readonly
   * @private
   */
  attributeLocations: {
    get: function () {
      return this._attributeLocations;
    },
  },
});

/**
 * 在其中一个或两个着色器中添加 <code>#define</code> 宏。这些行
 * 将出现在最终着色器源文件的顶部。
 *
 * @param {string} identifier 宏的标识符。标识符必须使用大写字母加下划线，以符合 Cesium 的风格指南。
 * @param {string} [value] 宏的值。如果未定义，define 将不包含值。该值将通过 <code>toString()</code> 转换为 GLSL 代码
 * @param {ShaderDestination} [destination=ShaderDestination.BOTH] define 出现在顶点着色器、片段着色器还是两者中。
 *
 * @example
 * // 在两个着色器中创建 "#define ENABLE_LIGHTING" 行
 * shaderBuilder.addDefine("ENABLE_LIGHTING");
 * // 在片段着色器中创建 "#define PI 3.141592" 行
 * shaderBuilder.addDefine("PI", 3.141593, ShaderDestination.FRAGMENT);
 */
ShaderBuilder.prototype.addDefine = function (identifier, value, destination) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("identifier", identifier);
  //>>includeEnd('debug');

  destination = destination ?? ShaderDestination.BOTH;

  // The ShaderSource created in build() will add the #define part
  let line = identifier;
  if (defined(value)) {
    line += ` ${value.toString()}`;
  }

  if (ShaderDestination.includesVertexShader(destination)) {
    this._vertexShaderParts.defineLines.push(line);
  }

  if (ShaderDestination.includesFragmentShader(destination)) {
    this._fragmentShaderParts.defineLines.push(line);
  }
};

/**
 * 向着色器中添加新的动态生成的结构体
 * @param {string} structId 在 {@link ShaderBuilder#addStructField} 中用于识别该结构体的唯一 ID
 * @param {string} structName 该结构体在着色器中的名称。
 * @param {ShaderDestination} destination 该结构体将出现在顶点着色器、片段着色器中，还是两者都出现。
 *
 * @example
 * // 在片段着色器中生成以下结构体
 * // 结构体 TestStruct
 * // {
 * // };
 * shaderBuilder.addStruct("testStructId", "TestStruct", ShaderDestination.FRAGMENT);
 */
ShaderBuilder.prototype.addStruct = function (
  structId,
  structName,
  destination,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("structId", structId);
  Check.typeOf.string("structName", structName);
  Check.typeOf.number("destination", destination);
  //>>includeEnd('debug');
  this._structs[structId] = new ShaderStruct(structName);
  if (ShaderDestination.includesVertexShader(destination)) {
    this._vertexShaderParts.structIds.push(structId);
  }

  if (ShaderDestination.includesFragmentShader(destination)) {
    this._fragmentShaderParts.structIds.push(structId);
  }
};

/**
 * 向动态生成的结构体添加字段。
 * @param {string} structId 该结构体的 ID。必须首先使用 {@link ShaderBuilder#addStruct} 创建该 ID。
 * @param {string} type 该字段的 GLSL 类型。
 * @param {string} identifier 该字段的标识符。
 *
 * @example
 * // 在片段着色器中生成以下结构体
 * // 结构体 TestStruct
 * // {
 * //    float minimum;
 * //    float maximum;
 * // };
 * shaderBuilder.addStruct("testStructId", "TestStruct", ShaderDestination.FRAGMENT);
 * shaderBuilder.addStructField("testStructId", "float", "maximum");
 * shaderBuilder.addStructField("testStructId", "float", "minimum");
 */
ShaderBuilder.prototype.addStructField = function (structId, type, identifier) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("structId", structId);
  Check.typeOf.string("type", type);
  Check.typeOf.string("identifier", identifier);
  //>>includeEnd('debug');
  this._structs[structId].addField(type, identifier);
};

/**
 * 向着色器中添加新的动态生成函数。
 * @param {string} functionName 该函数的名称。将在 {@link ShaderBuilder#addFunctionLines} 中用于识别该函数。
 * @param {string} signature 函数在着色器中出现的完整签名。不要包含花括号。
 * @param {ShaderDestination} destination 该结构体将出现在顶点着色器、片段着色器中，还是两者都出现。
 * @example
 * // 在顶点着色器中生成以下函数
 * // vec3 testFunction(float parameter)
 * // {
 * // }
 * shaderBuilder.addStruct("testFunction", "vec3 testFunction(float parameter)", ShaderDestination.VERTEX);
 */
ShaderBuilder.prototype.addFunction = function (
  functionName,
  signature,
  destination,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("functionName", functionName);
  Check.typeOf.string("signature", signature);
  Check.typeOf.number("destination", destination);
  //>>includeEnd('debug');
  this._functions[functionName] = new ShaderFunction(signature);

  if (ShaderDestination.includesVertexShader(destination)) {
    this._vertexShaderParts.functionIds.push(functionName);
  }

  if (ShaderDestination.includesFragmentShader(destination)) {
    this._fragmentShaderParts.functionIds.push(functionName);
  }
};

/**
 * 向动态生成的函数添加行代码
 * @param {string} functionName 该函数的名称。必须提前使用 {@link ShaderBuilder#addFunction} 创建该函数。
 * @param {string|string[]} lines 要添加到函数体中的一条或多条 GLSL 代码行。不要包含任何前导或尾随空格，但每条行必须包含分号。
 *
 * @example
 * // 在顶点着色器中生成以下函数
 * // vec3 testFunction(float parameter)
 * // {
 * //   float signed = 2.0 * parameter - 1.0;
 * //   return vec3(signed, 0.0, 0.0);
 * // }
 * shaderBuilder.addStruct("testFunction", "vec3 testFunction(float parameter)", ShaderDestination.VERTEX);
 * shaderBuilder.addFunctionLines("testFunction", [
 * "float signed = 2.0 * parameter - 1.0;",
 * "return vec3(parameter);"
 * ]);
 */
ShaderBuilder.prototype.addFunctionLines = function (functionName, lines) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("functionName", functionName);
  if (typeof lines !== "string" && !Array.isArray(lines)) {
    throw new DeveloperError(
      `Expected lines to be a string or an array of strings, actual value was ${lines}`,
    );
  }
  //>>includeEnd('debug');
  this._functions[functionName].addLines(lines);
};

/**
 * 向一个或两个着色器中添加统一变量声明。这些行
 * 将出现在最终着色器源文件的顶部附近。
 *
 * @param {string} type 该统一变量的 GLSL 类型。
 * @param {string} identifier 该统一变量的标识符。标识符必须以 <code>u_</code> 开头，以符合 Cesium 的风格指南。
 * @param {ShaderDestination} [destination=ShaderDestination.BOTH] 该统一变量是否出现在顶点着色器、片段着色器或两者中。
 *
 * @example
 * // 生成 "uniform vec3 u_resolution;" 这一行代码
 * shaderBuilder.addUniform("vec3", "u_resolution", ShaderDestination.FRAGMENT);
 * // 在两种着色器中均生成 "uniform float u_time;" 这一行代码
 * shaderBuilder.addUniform("float", "u_time", ShaderDestination.BOTH);
 */
ShaderBuilder.prototype.addUniform = function (type, identifier, destination) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  Check.typeOf.string("identifier", identifier);
  //>>includeEnd('debug');

  destination = destination ?? ShaderDestination.BOTH;
  const line = `uniform ${type} ${identifier};`;

  if (ShaderDestination.includesVertexShader(destination)) {
    this._vertexShaderParts.uniformLines.push(line);
  }

  if (ShaderDestination.includesFragmentShader(destination)) {
    this._fragmentShaderParts.uniformLines.push(line);
  }
};

/**
 * 在顶点着色器中添加位置属性声明。这些行代码
 * 会出现在最终着色器源文件的顶部附近。
 * <p>
 * 某些 WebGL 实现要求启用属性 0，因此此位置
 * 被保留用于位置属性。关于其他所有属性，请参见
 * {@link ShaderBuilder#addAttribute}
 * </p>
 *
 * @param {string} type 属性的 GLSL 类型
 * @param {string} identifier 属性的标识符。标识符必须以 <code>a_</code> 开头，以符合 Cesium 的风格指南。
 * @return {number} The 属性的整数位置。此位置可用于为 {@link VertexArray} 创建属性，该值始终为 0。
 *
 * @example
 * // 生成 "in vec3 a_position;" 这一行代码
 * shaderBuilder.setPositionAttribute("vec3", "a_position");
 */
ShaderBuilder.prototype.setPositionAttribute = function (type, identifier) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  Check.typeOf.string("identifier", identifier);

  if (defined(this._positionAttributeLine)) {
    throw new DeveloperError(
      "setPositionAttribute() must be called exactly once for the attribute used for gl_Position. For other attributes, use addAttribute()",
    );
  }
  //>>includeEnd('debug');

  this._positionAttributeLine = `in ${type} ${identifier};`;

  // Some WebGL implementations require attribute 0 to always be active, so
  // this builder assumes the position will always go in location 0
  this._attributeLocations[identifier] = 0;
  return 0;
};

/**
 * 在顶点着色器中添加属性声明。这些行代码
 * 会出现在最终着色器源文件的顶部附近。
 * <p>
 * 某些 WebGL 实现要求启用属性 0，因此此位置
 * 被保留用于位置属性。请参阅 {@link ShaderBuilder#setPositionAttribute}
 * </p>
 *
 * @param {string} type 属性的 GLSL 类型
 * @param {string} identifier 属性的标识符。标识符必须以 <code>a_</code> 开头，以符合 Cesium 的风格指南。
 * @return {number} The 属性的整数位置。此位置可用于为 {@link VertexArray} 创建属性
 *
 * @example
 * // 在顶点着色器中生成 "in vec2 a_texCoord0;" 这一行代码
 * shaderBuilder.addAttribute("vec2", "a_texCoord0");
 */
ShaderBuilder.prototype.addAttribute = function (type, identifier) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  Check.typeOf.string("identifier", identifier);
  //>>includeEnd('debug');

  const line = `in ${type} ${identifier};`;
  this._attributeLines.push(line);

  const location = this._nextAttributeLocation;
  this._attributeLocations[identifier] = location;

  // Most attributes only require a single attribute location, but matrices
  // require more.
  this._nextAttributeLocation += getAttributeLocationCount(type);
  return location;
};

/**
 * 在顶点和片段着色器中均添加 varying 声明。
 *
 * @param {string} type varying 的 GLSL 类型
 * @param {string} identifier varying 的标识符。标识符必须以 <code>v_</code> 开头，以符合 Cesium 的风格指南。
 * @param {string} [qualifier] varying 的修饰符，例如 <code>flat</code>。
 *
 * @example
 * // 在顶点着色器中生成 "in vec3 v_color;" 这一行代码
 * // 在片段着色器中生成 "out vec3 v_color;" 这一行代码
 * shaderBuilder.addVarying("vec3", "v_color");
 */
ShaderBuilder.prototype.addVarying = function (type, identifier, qualifier) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  Check.typeOf.string("identifier", identifier);
  //>>includeEnd('debug');

  qualifier = defined(qualifier) ? `${qualifier} ` : "";

  const line = `${type} ${identifier};`;
  this._vertexShaderParts.varyingLines.push(`${qualifier}out ${line}`);
  this._fragmentShaderParts.varyingLines.push(`${qualifier}in ${line}`);
};

/**
 * 向顶点着色器添加 GLSL 代码行
 *
 * @param {string|string[]} lines 添加到顶点着色器源文件末尾的一行或多行代码
 *
 * @example
 * shaderBuilder.addVertexLines([
 * "void main()",
 *  "{",
 * "    v_color = a_color;",
 * "    gl_Position = vec4(a_position, 1.0);",
 *  "}"
 * ]);
 */
ShaderBuilder.prototype.addVertexLines = function (lines) {
  //>>includeStart('debug', pragmas.debug);
  if (typeof lines !== "string" && !Array.isArray(lines)) {
    throw new DeveloperError(
      `Expected lines to be a string or an array of strings, actual value was ${lines}`,
    );
  }
  //>>includeEnd('debug');

  const vertexLines = this._vertexShaderParts.shaderLines;
  if (Array.isArray(lines)) {
    addAllToArray(vertexLines, lines);
  } else {
    // Single string case
    vertexLines.push(lines);
  }
};

/**
 * 向片段着色器添加 GLSL 代码行
 *
 * @param {string|string[]} lines 添加到片段着色器源文件末尾的一行或多行代码
 *
 * @example
 * shaderBuilder.addFragmentLines([
 * "void main()",
 *  "{",
 * "    #ifdef SOLID_COLOR",
 * "    out_FragColor = vec4(u_color, 1.0);",
 * "    #else",
 * "    out_FragColor = vec4(v_color, 1.0);",
 * "    #endif",
 *  "}"
 * ]);
 */
ShaderBuilder.prototype.addFragmentLines = function (lines) {
  //>>includeStart('debug', pragmas.debug);
  if (typeof lines !== "string" && !Array.isArray(lines)) {
    throw new DeveloperError(
      `Expected lines to be a string or an array of strings, actual value was ${lines}`,
    );
  }
  //>>includeEnd('debug');

  const fragmentLines = this._fragmentShaderParts.shaderLines;
  if (Array.isArray(lines)) {
    addAllToArray(fragmentLines, lines);
  } else {
    // Single string case
    fragmentLines.push(lines);
  }
};

/**
 * 使用其他方法添加的内容构建 {@link ShaderProgram}。
 * 通过此方法在修改着色器的其他
 * 方法后调用一次。
 *
 * @param {Context} context 用于创建着色器的上下文。
 * @return {ShaderProgram} A 用于渲染的着色器程序。
 *
 * @example
 * const shaderProgram = shaderBuilder.buildShaderProgram(context);
 */
ShaderBuilder.prototype.buildShaderProgram = function (context) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("context", context);
  //>>includeEnd('debug');

  const positionAttribute = defined(this._positionAttributeLine)
    ? [this._positionAttributeLine]
    : [];

  const structLines = generateStructLines(this);
  const functionLines = generateFunctionLines(this);

  // Lines are joined here so the ShaderSource
  // generates a single #line 0 directive
  const vertexLines = positionAttribute
    .concat(
      this._attributeLines,
      this._vertexShaderParts.uniformLines,
      this._vertexShaderParts.varyingLines,
      structLines.vertexLines,
      functionLines.vertexLines,
      this._vertexShaderParts.shaderLines,
    )
    .join("\n");
  const vertexShaderSource = new ShaderSource({
    defines: this._vertexShaderParts.defineLines,
    sources: [vertexLines],
  });

  const fragmentLines = this._fragmentShaderParts.uniformLines
    .concat(
      this._fragmentShaderParts.varyingLines,
      structLines.fragmentLines,
      functionLines.fragmentLines,
      this._fragmentShaderParts.shaderLines,
    )
    .join("\n");
  const fragmentShaderSource = new ShaderSource({
    defines: this._fragmentShaderParts.defineLines,
    sources: [fragmentLines],
  });

  return ShaderProgram.fromCache({
    context: context,
    vertexShaderSource: vertexShaderSource,
    fragmentShaderSource: fragmentShaderSource,
    attributeLocations: this._attributeLocations,
  });
};

ShaderBuilder.prototype.clone = function () {
  return clone(this, true);
};

function generateStructLines(shaderBuilder) {
  const vertexLines = [];
  const fragmentLines = [];

  let i;
  let structIds = shaderBuilder._vertexShaderParts.structIds;
  let structId;
  let struct;
  let structLines;
  for (i = 0; i < structIds.length; i++) {
    structId = structIds[i];
    struct = shaderBuilder._structs[structId];
    structLines = struct.generateGlslLines();
    addAllToArray(vertexLines, structLines);
  }

  structIds = shaderBuilder._fragmentShaderParts.structIds;
  for (i = 0; i < structIds.length; i++) {
    structId = structIds[i];
    struct = shaderBuilder._structs[structId];
    structLines = struct.generateGlslLines();
    addAllToArray(fragmentLines, structLines);
  }

  return {
    vertexLines: vertexLines,
    fragmentLines: fragmentLines,
  };
}

function getAttributeLocationCount(glslType) {
  switch (glslType) {
    case "mat2":
      return 2;
    case "mat3":
      return 3;
    case "mat4":
      return 4;
    default:
      return 1;
  }
}

function generateFunctionLines(shaderBuilder) {
  const vertexLines = [];
  const fragmentLines = [];

  let i;
  let functionIds = shaderBuilder._vertexShaderParts.functionIds;
  let functionId;
  let func;
  let functionLines;
  for (i = 0; i < functionIds.length; i++) {
    functionId = functionIds[i];
    func = shaderBuilder._functions[functionId];
    functionLines = func.generateGlslLines();
    addAllToArray(vertexLines, functionLines);
  }

  functionIds = shaderBuilder._fragmentShaderParts.functionIds;
  for (i = 0; i < functionIds.length; i++) {
    functionId = functionIds[i];
    func = shaderBuilder._functions[functionId];
    functionLines = func.generateGlslLines();
    addAllToArray(fragmentLines, functionLines);
  }

  return {
    vertexLines: vertexLines,
    fragmentLines: fragmentLines,
  };
}

export default ShaderBuilder;
