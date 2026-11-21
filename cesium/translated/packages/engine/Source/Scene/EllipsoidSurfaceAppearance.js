import { Frozen, VertexFormat, defined } from "@cesium/core";
import EllipsoidSurfaceAppearanceFS from "../Shaders/Appearances/EllipsoidSurfaceAppearanceFS.js";
import EllipsoidSurfaceAppearanceVS from "../Shaders/Appearances/EllipsoidSurfaceAppearanceVS.js";
import Appearance from "./Appearance.js";
import Material from "./Material.js";

/**
 * 一种用于椭球体表面的几何外观，类似于 {@link PolygonGeometry}。
 * 以及 {@link RectangleGeometry}，支持所有材质，如 {@link MaterialAppearance}。
 * 使用 {@link MaterialAppearance.MaterialSupport.ALL}。然而，这种外观需要
 * 较少的顶点属性，因为片段着色器可以程序化计算 <code>normal</code>、<code>tangent</code> 和 <code>bitangent</code>。
 * <code>tangent</code>、<code>normal</code> 和 <code>bitangent</code>。
 *
 * @alias EllipsoidSurfaceAppearance
 * @constructor
 *
 * @param {object} [options] 具有以下属性的实体：
 * @param {boolean} [options.flat=false] 当 <code>true</code> 时，片段着色器中使用平面着色，意味着光照未被考虑。
 * @param {boolean} [options.faceForward=options.aboveGround] 当 <code>true</code> 时，片段着色器根据需求翻转表面法线，以确保法线朝向观察者，避免暗点。当几何体的两侧都需要着色时，如 {@link WallGeometry}，这非常有用。
 * @param {boolean} [options.translucent=true] 当 <code>true</code> 时，预期几何体会呈现半透明效果，因此 {@link EllipsoidSurfaceAppearance#renderState} 启用了 alpha 混合。
 * @param {boolean} [options.aboveGround=false] 当 <code>true</code> 时，预期几何体位于椭球体表面——而不是在其上方恒定高度处——因此 {@link EllipsoidSurfaceAppearance#renderState} 启用了背面剔除。
 * @param {Material} [options.material=Material.ColorType] 用于确定片段颜色的材质。
 * @param {string} [options.vertexShaderSource] 可选的 GLSL 顶点着色器源代码，以覆盖默认顶点着色器。
 * @param {string} [options.fragmentShaderSource] 可选的 GLSL 片段着色器源代码，以覆盖默认片段着色器。
 * @param {object} [options.renderState] 可选的渲染状态，以覆盖默认渲染状态。
 *
 * @see {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric}
 *
 * @example
 * const primitive = new Cesium.Primitive({
 * geometryInstances : new Cesium.GeometryInstance({
 * geometry : new Cesium.PolygonGeometry({
 * vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
 *       // ...
 *     })
 *   }),
 * appearance : new Cesium.EllipsoidSurfaceAppearance({
 * material : Cesium.Material.fromType('Stripe')
 *   })
 * });
 */
function EllipsoidSurfaceAppearance(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const translucent = options.translucent ?? true;
  const aboveGround = options.aboveGround ?? false;

  /**
   * 用于确定片段颜色的材质。与其他 {@link EllipsoidSurfaceAppearance} 属性不同，此材质不是只读的，因此外观的材质可以动态更改。
   * 当 <code>true</code> 时，预期几何体会呈现半透明效果。
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
   * When <code>true</code>, the geometry is expected to appear translucent.
   *
   * @type {boolean}
   *
   * @default true
   */
  this.translucent = options.translucent ?? true;

  this._vertexShaderSource =
    options.vertexShaderSource ?? EllipsoidSurfaceAppearanceVS;
  this._fragmentShaderSource =
    options.fragmentShaderSource ?? EllipsoidSurfaceAppearanceFS;
  this._renderState = Appearance.getDefaultRenderState(
    translucent,
    !aboveGround,
    options.renderState,
  );
  this._closed = false;

  // Non-derived members

  this._flat = options.flat ?? false;
  this._faceForward = options.faceForward ?? aboveGround;
  this._aboveGround = aboveGround;
}

Object.defineProperties(EllipsoidSurfaceAppearance.prototype, {
  /**
   * 顶点着色器的 GLSL 源代码。
   *
   * @memberof EllipsoidSurfaceAppearance.prototype
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
   * 片段着色器的 GLSL 源代码。完整的片段着色器源代码是程序化生成的，考虑了 {@link EllipsoidSurfaceAppearance#material}、
   * source is built procedurally taking into account {@link EllipsoidSurfaceAppearance#material},
   * {@link EllipsoidSurfaceAppearance#flat}, and {@link EllipsoidSurfaceAppearance#faceForward}.
   * 使用 {@link EllipsoidSurfaceAppearance#getFragmentShaderSource} 获取完整源代码。
   *
   * @memberof EllipsoidSurfaceAppearance.prototype
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
   * The render state can be explicitly defined when constructing a {@link EllipsoidSurfaceAppearance}
   * 或者通过 {@link EllipsoidSurfaceAppearance#aboveGround} 设置。
   * 以及 {@link EllipsoidSurfaceAppearance#aboveGround}。
   * </p>
   *
   * @memberof EllipsoidSurfaceAppearance.prototype
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
   * 当 <code>true</code> 时，期望几何图形是闭合的，因此
   * {@link EllipsoidSurfaceAppearance#renderState} 启用了背面剔除。
   * 如果查看器进入几何图形内部，它将不可见。
   *
   * @memberof EllipsoidSurfaceAppearance.prototype
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
   * 此控件实例兼容的 {@link VertexFormat}。
   * 几何图形可以拥有更多顶点属性且仍然兼容——但这会带来一定的性能开销——但不能少于所需数量。
   * 当 <code>true</code> 时，片段着色器中使用平面着色，
   *
   * @memberof EllipsoidSurfaceAppearance.prototype
   *
   * @type VertexFormat
   * @readonly
   *
   * @default {@link EllipsoidSurfaceAppearance.VERTEX_FORMAT}
   */
  vertexFormat: {
    get: function () {
      return EllipsoidSurfaceAppearance.VERTEX_FORMAT;
    },
  },

  /**
   * 这意味着光照效果未被考虑。
   * 当 <code>true</code> 时，片段着色器会翻转表面法线，
   *
   * @memberof EllipsoidSurfaceAppearance.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @default false
   */
  flat: {
    get: function () {
      return this._flat;
    },
  },

  /**
   * 以确保法线朝向查看器，避免暗点。当几何图形的两侧都需
   * 以 {@link WallGeometry} 方式着色时非常有用。
   * 当 <code>true</code> 时，期望几何图形位于椭球表面——而不是在其上方恒定高度处——因此 {@link EllipsoidSurfaceAppearance#renderState}
   * shaded like {@link WallGeometry}.
   *
   * @memberof EllipsoidSurfaceAppearance.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @default true
   */
  faceForward: {
    get: function () {
      return this._faceForward;
    },
  },

  /**
   * 所有 {@link EllipsoidSurfaceAppearance} 实例兼容的 {@link VertexFormat}，
   * surface - not at a constant height above it - so {@link EllipsoidSurfaceAppearance#renderState}
   * 程序化生成完整的 GLSL 片段着色器源代码。对于 {@link EllipsoidSurfaceAppearance}，
   *
   *
   * @memberof EllipsoidSurfaceAppearance.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @default false
   */
  aboveGround: {
    get: function () {
      return this._aboveGround;
    },
  },
});

/**
 * The {@link VertexFormat} that all {@link EllipsoidSurfaceAppearance} instances
 * 完整的 GLSL 片段着色器源代码。
 * 根据 {@link EllipsoidSurfaceAppearance#translucent} 和 {@link Material#isTranslucent} 确定几何图形是否为半透明。
 *
 * @type VertexFormat
 *
 * @constant
 */
EllipsoidSurfaceAppearance.VERTEX_FORMAT = VertexFormat.POSITION_AND_ST;

/**
 * Procedurally creates the full GLSL fragment shader source.  For {@link EllipsoidSurfaceAppearance},
 * this is derived from {@link EllipsoidSurfaceAppearance#fragmentShaderSource}, {@link EllipsoidSurfaceAppearance#flat},
 * and {@link EllipsoidSurfaceAppearance#faceForward}.
 *
 * @function
 *
 * @returns {string} The 子集的渲染状态属性。
 */
EllipsoidSurfaceAppearance.prototype.getFragmentShaderSource =
  Appearance.prototype.getFragmentShaderSource;

/**
 * Determines if the geometry is translucent based on {@link EllipsoidSurfaceAppearance#translucent} and {@link Material#isTranslucent}.
 *
 * @function
 *
 * @returns {boolean} <code>true</code> if the appearance is translucent.
 */
EllipsoidSurfaceAppearance.prototype.isTranslucent =
  Appearance.prototype.isTranslucent;

/**
 * Creates a render state.  This is not the final render state instance; instead,
 * it can contain a subset of render state properties identical to the render state
 * created in the context.
 *
 * @function
 *
 * @returns {object} The 渲染状态。
 */
EllipsoidSurfaceAppearance.prototype.getRenderState =
  Appearance.prototype.getRenderState;
export default EllipsoidSurfaceAppearance;