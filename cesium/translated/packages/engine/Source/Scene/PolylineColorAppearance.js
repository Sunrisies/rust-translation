import { Frozen, VertexFormat } from "@cesium/core";
import PerInstanceFlatColorAppearanceFS from "../Shaders/Appearances/PerInstanceFlatColorAppearanceFS.js";
import PolylineColorAppearanceVS from "../Shaders/Appearances/PolylineColorAppearanceVS.js";
import PolylineCommon from "../Shaders/PolylineCommon.js";
import Appearance from "./Appearance.js";

const defaultVertexShaderSource = `#define CLIP_POLYLINE \n${PolylineCommon}\n${PolylineColorAppearanceVS}`;
const defaultFragmentShaderSource = PerInstanceFlatColorAppearanceFS;

/**
 * 一种具有颜色属性的 {@link GeometryInstance} 实例外观，
 * {@link PolylineGeometry} 或 {@link GroundPolylineGeometry}。
 * 这允许多个具有不同颜色的几何实例使用相同的
 * {@link Primitive} 被绘制出来。
 *
 * @alias PolylineColorAppearance
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.translucent=true] 当 <code>true</code> 时，几何图形应呈现半透明状态，因此 {@link PolylineColorAppearance#renderState} 启用了 alpha 混合。
 * @param {string} [options.vertexShaderSource] 可选择的 GLSL 顶点着色器源代码，用于覆盖默认顶点着色器。
 * @param {string} [options.fragmentShaderSource] 可选择的 GLSL 片段着色器源代码，用于覆盖默认片段着色器。
 * @param {object} [options.renderState] 可选择的渲染状态，用于覆盖默认渲染状态。
 *
 * @example
 * // 一条实心白色线段
 * const primitive = new Cesium.Primitive({
 * geometryInstances : new Cesium.GeometryInstance({
 * geometry : new Cesium.PolylineGeometry({
 * positions : Cesium.Cartesian3.fromDegreesArray([
 *         0.0, 0.0,
 *         5.0, 0.0
 *       ]),
 * width : 10.0,
 * vertexFormat : Cesium.PolylineColorAppearance.VERTEX_FORMAT
 *     }),
 * attributes : {
 * color : Cesium.ColorGeometryInstanceAttribute.fromColor(new Cesium.Color(1.0, 1.0, 1.0, 1.0))
 *     }
 *   }),
 * appearance : new Cesium.PolylineColorAppearance({
 * translucent : false
 *   })
 * });
 */
function PolylineColorAppearance(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const translucent = options.translucent ?? true;
  const closed = false;
  const vertexFormat = PolylineColorAppearance.VERTEX_FORMAT;

  /**
   * 此属性属于 {@link Appearance} 接口，但由于使用了完全自定义的片段着色器，因此
   * 未被 {@link PolylineColorAppearance} 使用。
   *
   * @type Material
   *
   * @default undefined
   */
  this.material = undefined;

  /**
   * 当 <code>true</code> 时，几何图形应呈现半透明状态，因此
   * {@link PolylineColorAppearance#renderState} 启用了 alpha 混合。
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

Object.defineProperties(PolylineColorAppearance.prototype, {
  /**
   * 顶点着色器的 GLSL 源代码。
   *
   * @memberof PolylineColorAppearance.prototype
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
   * 片段着色器的 GLSL 源代码。
   *
   * @memberof PolylineColorAppearance.prototype
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
   * 在构建 {@link PolylineColorAppearance} 实例时，可以显式定义渲染状态，
   * 或者通过 {@link PolylineColorAppearance#translucent} 隐式设置。
   * </p>
   *
   * @memberof PolylineColorAppearance.prototype
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
   * 当 <code>true</code> 时，几何图形应闭合，因此
   * {@link PolylineColorAppearance#renderState} 启用了背面剔除。
   * 对于 <code>PolylineColorAppearance</code>，此值始终为 <code>false</code>。
   *
   * @memberof PolylineColorAppearance.prototype
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
   * 一个几何图形可以具有更多顶点属性且仍然兼容——但这会带来一定的性能开销——但它不能少于这些属性。
   * 所有 {@link PolylineColorAppearance} 实例兼容的 {@link VertexFormat}。
   *
   * @memberof PolylineColorAppearance.prototype
   *
   * @type VertexFormat
   * @readonly
   *
   * @default {@link PolylineColorAppearance.VERTEX_FORMAT}
   */
  vertexFormat: {
    get: function () {
      return this._vertexFormat;
    },
  },
});

/**
 * The {@link VertexFormat} that all {@link PolylineColorAppearance} instances
 * 相互兼容。仅需提供 <code>position</code> 属性即可。
 *
 * @type VertexFormat
 *
 * @constant
 */
PolylineColorAppearance.VERTEX_FORMAT = VertexFormat.POSITION_ONLY;

/**
 * 程序化生成完整的 GLSL 片段着色器源码。
 *
 * @function
 *
 * @returns {string} The 完整的 GLSL 片段着色器源码。
 */
PolylineColorAppearance.prototype.getFragmentShaderSource =
  Appearance.prototype.getFragmentShaderSource;

/**
 * 根据 {@link PolylineColorAppearance#translucent} 判断几何图形是否为半透明。
 *
 * @function
 *
 * @returns {boolean} <code>true</code> 如果外观为半透明。
 */
PolylineColorAppearance.prototype.isTranslucent =
  Appearance.prototype.isTranslucent;

/**
 * 创建渲染状态。这不是最终的渲染状态实例，而是可以包含与上下文中的渲染状态相同的部分渲染状态属性。
 * 它可包含与上下文中的渲染状态相同的部分渲染状态属性。
 * 在上下文中创建的渲染状态。
 *
 * @function
 *
 * @returns {object} The 渲染状态。
 */
PolylineColorAppearance.prototype.getRenderState =
  Appearance.prototype.getRenderState;
export default PolylineColorAppearance;
