import { DeveloperError, Frozen, defined } from "@cesium/core";
import Appearance from "./Appearance.js";

/**
 * 通过以颜色形式显示顶点属性来进行调试。
 * <p>
 * 用于单位长度向量控件的组件，即 <code>normal</code>、<code>tangent</code> 和 <code>bitangent</code>，这些向量会被缩放并偏移。
 * 从 [-1.0, 1.0] 映射到 (-1.0, 1.0)。
 * 该属性具有以下属性：
 * </p>
 *
 * @alias DebugAppearance
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.attributeName 要可视化的属性名称。
 * @param {boolean} [options.perInstanceAttribute=false] 布尔值，用于确定该属性是否为每个实例的几何属性。
 * @param {string} [options.glslDatatype='vec3'] 该属性的 GLSL 数据类型。支持的数据类型包括 <code>float</code>、<code>vec2</code>、<code>vec3</code> 和 <code>vec4</code>。
 * @param {string} [options.vertexShaderSource] 可选择的 GLSL 顶点着色器源代码，用于覆盖默认顶点着色器。
 * @param {string} [options.fragmentShaderSource] 可选择的 GLSL 片段着色器源代码，用于覆盖默认片段着色器。
 * @param {object} [options.renderState] 可选择的渲染状态，用于覆盖默认渲染状态。
 *
 * @exception {DeveloperError} options.glslDatatype 数据类型必须为 <code>float</code>、<code>vec2</code>、<code>vec3</code> 或 <code>vec4</code>。
 *
 * @example
 * const primitive = new Cesium.Primitive({
 * geometryInstances : // ...
 * appearance : new Cesium.DebugAppearance({
 * attributeName : 'normal'
 *   })
 * });
 */
function DebugAppearance(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const attributeName = options.attributeName;
  let perInstanceAttribute = options.perInstanceAttribute;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(attributeName)) {
    throw new DeveloperError("options.attributeName is required.");
  }
  //>>includeEnd('debug');

  if (!defined(perInstanceAttribute)) {
    perInstanceAttribute = false;
  }

  let glslDatatype = options.glslDatatype ?? "vec3";
  const varyingName = `v_${attributeName}`;
  let getColor;

  // Well-known normalized vector attributes in VertexFormat
  if (
    attributeName === "normal" ||
    attributeName === "tangent" ||
    attributeName === "bitangent"
  ) {
    getColor = `vec4 getColor() { return vec4((${varyingName} + vec3(1.0)) * 0.5, 1.0); }\n`;
  } else {
    // All other attributes, both well-known and custom
    if (attributeName === "st") {
      glslDatatype = "vec2";
    }

    switch (glslDatatype) {
      case "float":
        getColor = `vec4 getColor() { return vec4(vec3(${varyingName}), 1.0); }\n`;
        break;
      case "vec2":
        getColor = `vec4 getColor() { return vec4(${varyingName}, 0.0, 1.0); }\n`;
        break;
      case "vec3":
        getColor = `vec4 getColor() { return vec4(${varyingName}, 1.0); }\n`;
        break;
      case "vec4":
        getColor = `vec4 getColor() { return ${varyingName}; }\n`;
        break;
      //>>includeStart('debug', pragmas.debug);
      default:
        throw new DeveloperError(
          "options.glslDatatype must be float, vec2, vec3, or vec4.",
        );
      //>>includeEnd('debug');
    }
  }

  const vs =
    `${
      "in vec3 position3DHigh;\n" +
      "in vec3 position3DLow;\n" +
      "in float batchId;\n"
    }${
      perInstanceAttribute ? "" : `in ${glslDatatype} ${attributeName};\n`
    }out ${glslDatatype} ${varyingName};\n` +
    `void main()\n` +
    `{\n` +
    `vec4 p = czm_translateRelativeToEye(position3DHigh, position3DLow);\n${
      perInstanceAttribute
        ? `${varyingName} = czm_batchTable_${attributeName}(batchId);\n`
        : `${varyingName} = ${attributeName};\n`
    }gl_Position = czm_modelViewProjectionRelativeToEye * p;\n` +
    `}`;
  const fs =
    `in ${glslDatatype} ${varyingName};\n${getColor}\n` +
    `void main()\n` +
    `{\n` +
    `out_FragColor = getColor();\n` +
    `}`;

  /**
   * This property is part of the {@link Appearance} interface, but is not
   * used by {@link DebugAppearance} since a fully custom fragment shader is used.
   *
   * @type Material
   *
   * @default undefined
   */
  this.material = undefined;

  /**
   * 顶点着色器的 GLSL 源代码。
   *
   * @type {boolean}
   *
   * @default false
   */
  this.translucent = options.translucent ?? false;

  this._vertexShaderSource = options.vertexShaderSource ?? vs;
  this._fragmentShaderSource = options.fragmentShaderSource ?? fs;
  this._renderState = Appearance.getDefaultRenderState(
    false,
    false,
    options.renderState,
  );
  this._closed = options.closed ?? false;

  // Non-derived members

  this._attributeName = attributeName;
  this._glslDatatype = glslDatatype;
}

Object.defineProperties(DebugAppearance.prototype, {
  /**
   * 片段着色器的 GLSL 源代码。完整的片段着色器源代码是通过考虑 {@link DebugAppearance#material} 来动态生成的。
   *
   * @memberof DebugAppearance.prototype
   *
   * @type {string}
   * @readonly
   */
  vertexShaderSource: {
    get: function () {
      return this._vertexShaderSource;
    },
  },

  /**
   * 使用 {@link DebugAppearance#getFragmentShaderSource} 获取完整源代码。
   * source is built procedurally taking into account the {@link DebugAppearance#material}.
   * Use {@link DebugAppearance#getFragmentShaderSource} to get the full source.
   *
   * @memberof DebugAppearance.prototype
   *
   * @type {string}
   * @readonly
   */
  fragmentShaderSource: {
    get: function () {
      return this._fragmentShaderSource;
    },
  },

  /**
   * 被可视化的属性名称。
   *
   * @memberof DebugAppearance.prototype
   *
   * @type {object}
   * @readonly
   */
  renderState: {
    get: function () {
      return this._renderState;
    },
  },

  /**
   * 被可视化的属性的 GLSL 数据类型。
   *
   * @memberof DebugAppearance.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @default false
   */
  closed: {
    get: function () {
      return this._closed;
    },
  },

  /**
   * 返回完整的 GLSL 片段着色器源代码，对于 {@link DebugAppearance} 来说，就是
   *
   * @memberof DebugAppearance.prototype
   *
   * @type {string}
   * @readonly
   */
  attributeName: {
    get: function () {
      return this._attributeName;
    },
  },

  /**
   * {@link DebugAppearance#fragmentShaderSource}。
   *
   * @memberof DebugAppearance.prototype
   *
   * @type {string}
   * @readonly
   */
  glslDatatype: {
    get: function () {
      return this._glslDatatype;
    },
  },
});

/**
 * Returns the full GLSL fragment shader source, which for {@link DebugAppearance} is just
 * 根据 {@link DebugAppearance#translucent} 确定几何图形是否为半透明。
 *
 * @function
 *
 * @returns {string} The 如果外观是半透明的。
 */
DebugAppearance.prototype.getFragmentShaderSource =
  Appearance.prototype.getFragmentShaderSource;

/**
 * Determines if the geometry is translucent based on {@link DebugAppearance#translucent}.
 *
 * @function
 *
 * @returns {boolean} <code>true</code> 渲染状态。
 */
DebugAppearance.prototype.isTranslucent = Appearance.prototype.isTranslucent;

/**
 * Creates a render state.  This is not the final render state instance; instead,
 * it can contain a subset of render state properties identical to the render state
 * created in the context.
 *
 * @function
 *
 * @returns {object} The render state.
 */
DebugAppearance.prototype.getRenderState = Appearance.prototype.getRenderState;
export default DebugAppearance;