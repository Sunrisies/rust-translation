import { Frozen, VertexFormat, defined } from "@cesium/core";
import PolylineMaterialAppearanceVS from "../Shaders/Appearances/PolylineMaterialAppearanceVS.js";
import PolylineCommon from "../Shaders/PolylineCommon.js";
import PolylineFS from "../Shaders/PolylineFS.js";
import Appearance from "./Appearance.js";
import Material from "./Material.js";

const defaultVertexShaderSource = `#define CLIP_POLYLINE \n${PolylineCommon}\n${PolylineMaterialAppearanceVS}`;
const defaultFragmentShaderSource = PolylineFS;

/**
 * 一种支持材质阴影的 {@link PolylineGeometry} 外观。
 *
 * @alias PolylineMaterialAppearance
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.translucent=true] 当 <code>true</code> 时，几何图形应呈现半透明状态，使得 {@link PolylineMaterialAppearance#renderState} 启用了 alpha 混合。
 * @param {Material} [options.material=Material.ColorType] 用于确定片段颜色的材质。
 * @param {string} [options.vertexShaderSource] 可选择的 GLSL 顶点着色器源代码，以覆盖默认顶点着色器。
 * @param {string} [options.fragmentShaderSource] 可选择的 GLSL 片段着色器源代码，以覆盖默认片段着色器。
 * @param {object} [options.renderState] 可选择的渲染状态，以覆盖默认渲染状态。
 *
 * @see {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric}
 *
 * @example
 * const primitive = new Cesium.Primitive({
 * geometryInstances : new Cesium.GeometryInstance({
 * geometry : new Cesium.PolylineGeometry({
 * positions : Cesium.Cartesian3.fromDegreesArray([
 *         0.0, 0.0,
 *         5.0, 0.0
 *       ]),
 * width : 10.0,
 * vertexFormat : Cesium.PolylineMaterialAppearance.VERTEX_FORMAT
 *     })
 *   }),
 * appearance : new Cesium.PolylineMaterialAppearance({
 * material : Cesium.Material.fromType('Color')
 *   })
 * });
 */
function PolylineMaterialAppearance(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const translucent = options.translucent ?? true;
  const closed = false;
  const vertexFormat = PolylineMaterialAppearance.VERTEX_FORMAT;

  /**
   * 用于确定片段颜色的材质。与其他 {@link PolylineMaterialAppearance} 不同，
   * 该属性不是只读的，因此外观的材质可以动态更改。
   *
   * @type Material
   *
   * @default {@link Material.ColorType}
   *
   * @see {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric}
   */
  this.material = defined(options.material)
    ? options.material
    : Material.fromType(Material.ColorType);

  /**
   * 当 <code>true</code> 时，几何图形应呈现半透明状态，使得
   * {@link PolylineMaterialAppearance#renderState} 启用了 alpha 混合。
   *
   * @type {boolean}
   *
   * @default true
   */
  this.translucent = translucent;

  this._vertexShaderSource =
    options.vertexShaderSource ?? defaultVertexShaderSource;
  this._fragmentShaderSource =
    options.fragmentShaderSource ?? defaultFragmentShaderSource;
  this._renderState = Appearance.getDefaultRenderState(
    translucent,
    closed,
    options.renderState,
  );
  this._closed = closed;

  // Non-derived members

  this._vertexFormat = vertexFormat;
}

Object.defineProperties(PolylineMaterialAppearance.prototype, {
  /**
   * 顶点着色器的 GLSL 源代码。
   *
   * @memberof PolylineMaterialAppearance.prototype
   *
   * @type {string}
   * @readonly
   */
  vertexShaderSource: {
    get: function () {
      let vs = this._vertexShaderSource;
      if (
        this.material.shaderSource.search(/in\s+float\s+v_polylineAngle;/g) !==
        -1
      ) {
        vs = `#define POLYLINE_DASH\n${vs}`;
      }
      return vs;
    },
  },

  /**
   * 片段着色器的 GLSL 源代码。
   *
   * @memberof PolylineMaterialAppearance.prototype
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
   * 渲染几何图形时使用的 WebGL 固定函数状态。
   * <p>
   * 在构建 {@link PolylineMaterialAppearance} 实例时，可以显式定义渲染状态，
   * 或者通过 {@link PolylineMaterialAppearance#translucent} 隐式设置。
   * 以及 {@link PolylineMaterialAppearance#closed}。
   * </p>
   *
   * @memberof PolylineMaterialAppearance.prototype
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
   * 当 <code>true</code> 时，几何图形应呈闭合状态，使得
   * {@link PolylineMaterialAppearance#renderState} 启用了背面剔除。
   * 对于 {@link PolylineMaterialAppearance}，此值始终为 <code>false</code>。
   *
   * @memberof PolylineMaterialAppearance.prototype
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
   * 此外观实例兼容的 {@link VertexFormat}。
   * 几何图形可以具有更多顶点属性但仍保持兼容，但这会带来一定的性能开销，且不能少于所需数量。
   * 所有 {@link PolylineMaterialAppearance} 实例兼容的 {@link VertexFormat}。这需要 <code>position</code> 和 <code>st</code> 属性。
   *
   * @memberof PolylineMaterialAppearance.prototype
   *
   * @type VertexFormat
   * @readonly
   *
   * @default {@link PolylineMaterialAppearance.VERTEX_FORMAT}
   */
  vertexFormat: {
    get: function () {
      return this._vertexFormat;
    },
  },
});

/**
 * The {@link VertexFormat} that all {@link PolylineMaterialAppearance} instances
 * are compatible with. This requires <code>position</code> and <code>st</code> attributes.
 *
 * @type VertexFormat
 *
 * @constant
 */
PolylineMaterialAppearance.VERTEX_FORMAT = VertexFormat.POSITION_AND_ST;

/**
 * Procedurally creates the full GLSL fragment shader source.  For {@link PolylineMaterialAppearance},
 * 该内容源自 {@link PolylineMaterialAppearance#fragmentShaderSource} 和 {@link PolylineMaterialAppearance#material}。
 *
 * @function
 *
 * @returns {string} The 完整的 GLSL 片段着色器源码。
 */
PolylineMaterialAppearance.prototype.getFragmentShaderSource =
  Appearance.prototype.getFragmentShaderSource;

/**
 * 根据 {@link PolylineMaterialAppearance#translucent} 和 {@link Material#isTranslucent} 判断几何图形是否为半透明。
 *
 * @function
 *
 * @returns {boolean} <code>true</code> 如果外观为半透明。
 */
PolylineMaterialAppearance.prototype.isTranslucent =
  Appearance.prototype.isTranslucent;

/**
 * 创建一个渲染状态。这不是最终的渲染状态实例，而是可以包含与原始渲染状态相同的部分渲染状态属性。
 * 这些属性是在该上下文中创建的。
 * 渲染状态。
 *
 * @function
 *
 * @returns {object} The render state.
 */
PolylineMaterialAppearance.prototype.getRenderState =
  Appearance.prototype.getRenderState;
export default PolylineMaterialAppearance;