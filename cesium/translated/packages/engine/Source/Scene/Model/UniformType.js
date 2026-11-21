// @ts-check

/**
 * 基本 GLSL 统一变量类型的枚举。这些可以与
 * {@link CustomShader} 一起使用来声明用户自定义的统一变量。
 *
 * @enum {string}
 *
 * @experimental This 该特性采用了部分尚未定稿的 3D Tiles 规范，可能会根据 Cesium 的标准弃用政策发生变化。
 */
const UniformType = {
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
   * 一个整数值。
   *
   * @type {string}
   * @constant
   */
  INT: "int",
  /**
   * 一个包含 2 个整数值的向量。
   *
   * @type {string}
   * @constant
   */
  INT_VEC2: "ivec2",
  /**
   * 一个包含 3 个整数值的向量。
   *
   * @type {string}
   * @constant
   */
  INT_VEC3: "ivec3",
  /**
   * 一个包含 4 个整数值的向量。
   *
   * @type {string}
   * @constant
   */
  INT_VEC4: "ivec4",
  /**
   * 一个布尔值。
   *
   * @type {string}
   * @constant
   */
  BOOL: "bool",
  /**
   * 一个包含 2 个布尔值的向量。
   *
   * @type {string}
   * @constant
   */
  BOOL_VEC2: "bvec2",
  /**
   * 一个包含 3 个布尔值的向量。
   *
   * @type {string}
   * @constant
   */
  BOOL_VEC3: "bvec3",
  /**
   * 一个包含 4 个布尔值的向量。
   *
   * @type {string}
   * @constant
   */
  BOOL_VEC4: "bvec4",
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
  /**
   * 一个 2D 采样纹理。
   * @type {string}
   * @constant
   */
  SAMPLER_2D: "sampler2D",
  SAMPLER_CUBE: "samplerCube",
};

Object.freeze(UniformType);

export default UniformType;
