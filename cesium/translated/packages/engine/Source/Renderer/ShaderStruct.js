/**
 * 用于动态生成 GLSL 结构的工具函数。
 *
 * @alias ShaderStruct
 * @constructor
 *
 * @see {@link ShaderBuilder}
 * @param {string} name 该结构在着色器中的名称。
 * @example
 * // 生成结构：
 * //
 * // 结构属性
 * // {
 * //     vec3 position;
 * //     vec3 normal;
 * //     vec2 texCoord;
 * // };
 * const struct = new ShaderStruct("Attributes");
 * struct.addField("vec3", "position");
 * struct.addField("vec3", "normal");
 * struct.addField("vec2", "texCoord");
 * const generatedLines = struct.generateGlslLines();
 *
 * @private
 */
function ShaderStruct(name) {
  this.name = name;
  this.fields = [];
}

/**
 * 向结构中添加字段
 * @param {string} type 结构字段的类型
 * @param {string} identifier 结构字段的标识符
 */
ShaderStruct.prototype.addField = function (type, identifier) {
  const field = `    ${type} ${identifier};`;
  this.fields.push(field);
};

/**
 * 生成用于 {@link ShaderBuilder} 的 GLSL 代码行列表
 * @return {string[]} The 生成的 GLSL 代码。
 */
ShaderStruct.prototype.generateGlslLines = function () {
  let fields = this.fields;
  if (fields.length === 0) {
    // GLSL requires structs to have at least one field
    fields = ["    float _empty;"];
  }

  return [].concat(`struct ${this.name}`, "{", fields, "};");
};

export default ShaderStruct;
