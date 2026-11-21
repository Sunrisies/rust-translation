// @ts-check

/**
 * 用于 GLSL 变量类型的枚举。可用于声明变量。
 * 出现在 {@link CustomShader} 中。
 *
 * @enum {string}
 *
 * @experimental This 该特性采用了 3D Tiles 规范中的部分内容，但此内容尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */
const VaryingType = {
  /**
   * 一个浮点数值。
   *
   * @type {string}
   * @constant
   */
  FLOAT: "float",
  /**
   * 一个包含 2 个浮点值的向量。
   *
   * @type {string}
   * @constant
   */
  VEC2: "vec2",
  /**
   * 一个包含 3 个浮点值的向量。
   *
   * @type {string}
   * @constant
   */
  VEC3: "vec3",
  /**
   * 一个包含 4 个浮点值的向量。
   *
   * @type {string}
   * @constant
   */
  VEC4: "vec4",
  /**
   * 一个 2x2 的浮点值矩阵。
   *
   * @type {string}
   * @constant
   */
  MAT2: "mat2",
  /**
   * 一个 3x3 的浮点值矩阵。
   *
   * @type {string}
   * @constant
   */
  MAT3: "mat3",
  /**
   * 一个 4x4 的浮点值矩阵。
   *
   * @type {string}
   * @constant
   */
  MAT4: "mat4",
};

Object.freeze(VaryingType);

export default VaryingType;
