import { Frozen, VertexFormat } from "@cesium/core";
import PerInstanceColorAppearanceFS from "../Shaders/Appearances/PerInstanceColorAppearanceFS.js";
import PerInstanceColorAppearanceVS from "../Shaders/Appearances/PerInstanceColorAppearanceVS.js";
import PerInstanceFlatColorAppearanceFS from "../Shaders/Appearances/PerInstanceFlatColorAppearanceFS.js";
import PerInstanceFlatColorAppearanceVS from "../Shaders/Appearances/PerInstanceFlatColorAppearanceVS.js";
import Appearance from "./Appearance.js";

/**
 * 具有颜色属性的 {@link GeometryInstance} 实例的外观。
 * 这允许多个具有不同颜色的几何实例使用相同的 {@link Primitive} 进行绘制，如下例所示。
 * 具有以下属性的对象：
 *
 * @alias PerInstanceColorAppearance
 * @constructor
 *
 * @param {object} [options] 当 <code>true</code> 时，片段着色器中使用平面着色，这意味着光照未被考虑。
 * @param {boolean} [options.flat=false] 当 <code>true</code> 时，片段着色器根据需求翻转表面法线，以确保法线朝向观察者，避免暗点。当几何体的两侧都需要着色时，例如 {@link WallGeometry}，此设置非常有用。
 * @param {boolean} [options.faceForward=!options.closed] 当 <code>true</code> 时，期望几何体呈现半透明效果，因此 {@link PerInstanceColorAppearance#renderState} 启用了 alpha 混合。
 * @param {boolean} [options.translucent=true] 当 <code>true</code> 时，期望几何体是闭合的，因此 {@link PerInstanceColorAppearance#renderState} 启用了背面剔除。
 * @param {boolean} [options.closed=false] 当 <code>true</code> 时，期望几何体是封闭的，因此 {@link PerInstanceColorAppearance#renderState} 启用了背面剔除。
 * @param {string} [options.vertexShaderSource] 可选择的 GLSL 顶点着色器源代码，用于覆盖默认顶点着色器。
 * @param {string} [options.fragmentShaderSource] 可选择的 GLSL 片段着色器源代码，用于覆盖默认片段着色器。
 * @param {object} [options.renderState] 可选择的渲染状态，用于覆盖默认渲染状态。
 *
 * @example
 * // 一条实心白色线段
 * const primitive = new Cesium.Primitive({
 * geometryInstances : new Cesium.GeometryInstance({
 * geometry : new Cesium.SimplePolylineGeometry({
 * positions : Cesium.Cartesian3.fromDegreesArray([
 *         0.0, 0.0,
 *         5.0, 0.0
 *       ])
 *     }),
 * attributes : {
 * color : Cesium.ColorGeometryInstanceAttribute.fromColor(new Cesium.Color(1.0, 1.0, 1.0, 1.0))
 *     }
 *   }),
 * appearance : new Cesium.PerInstanceColorAppearance({
 * flat : true,
 * translucent : false
 *   })
 * });
 *
 * // 一个primitive中的两个矩形，每个具有不同颜色
 * const instance = new Cesium.GeometryInstance({
 * geometry : new Cesium.RectangleGeometry({
 * rectangle : Cesium.Rectangle.fromDegrees(0.0, 20.0, 10.0, 30.0)
 *   }),
 * attributes : {
 * color : new Cesium.ColorGeometryInstanceAttribute(1.0, 0.0, 0.0, 0.5)
 *   }
 * });
 *
 * const anotherInstance = new Cesium.GeometryInstance({
 * geometry : new Cesium.RectangleGeometry({
 * rectangle : Cesium.Rectangle.fromDegrees(0.0, 40.0, 10.0, 50.0)
 *   }),
 * attributes : {
 * color : new Cesium.ColorGeometryInstanceAttribute(0.0, 0.0, 1.0, 0.5)
 *   }
 * });
 *
 * const rectanglePrimitive = new Cesium.Primitive({
 * geometryInstances : [instance, anotherInstance],
 * appearance : new Cesium.PerInstanceColorAppearance()
 * });
 */
function PerInstanceColorAppearance(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const translucent = options.translucent ?? true;
  const closed = options.closed ?? false;
  const flat = options.flat ?? false;
  const vs = flat
    ? PerInstanceFlatColorAppearanceVS
    : PerInstanceColorAppearanceVS;
  const fs = flat
    ? PerInstanceFlatColorAppearanceFS
    : PerInstanceColorAppearanceFS;
  const vertexFormat = flat
    ? PerInstanceColorAppearance.FLAT_VERTEX_FORMAT
    : PerInstanceColorAppearance.VERTEX_FORMAT;

  /**
   * 此属性属于 {@link Appearance} 接口，但不在此处显示
   * 自使用完全自定义片段着色器后，由 {@link PerInstanceColorAppearance} 使用。
   *
   * @type Material
   *
   * @default undefined
   */
  this.material = undefined;

  /**
   * 当 <code>true</code> 时，几何图形预计为半透明，因此
   * {@link PerInstanceColorAppearance#renderState} 启用了 alpha 混合。
   *
   * @type {boolean}
   *
   * @default true
   */
  this.translucent = translucent;

  this._vertexShaderSource = options.vertexShaderSource ?? vs;
  this._fragmentShaderSource = options.fragmentShaderSource ?? fs;
  this._renderState = Appearance.getDefaultRenderState(
    translucent,
    closed,
    options.renderState,
  );
  this._closed = closed;

  // Non-derived members

  this._vertexFormat = vertexFormat;
  this._flat = flat;
  this._faceForward = options.faceForward ?? !closed;
}

Object.defineProperties(PerInstanceColorAppearance.prototype, {
  /**
   * 顶点着色器的 GLSL 源代码。
   *
   * @memberof PerInstanceColorAppearance.prototype
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
   * @memberof PerInstanceColorAppearance.prototype
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
   * 在构建 {@link PerInstanceColorAppearance} 实例时，可以显式定义渲染状态。
   * 或者通过 {@link PerInstanceColorAppearance#translucent} 隐式设置。
   * 以及 {@link PerInstanceColorAppearance#closed}。
   * </p>
   *
   * @memberof PerInstanceColorAppearance.prototype
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
   * 当 <code>true</code> 时，几何图形预计为封闭，因此
   * {@link PerInstanceColorAppearance#renderState} 启用了背面剔除。
   * 如果查看器进入几何图形，它将不可见。
   *
   * @memberof PerInstanceColorAppearance.prototype
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
   * 几何图形可以拥有更多顶点属性但仍保持兼容——这会带来一定的性能成本——但不能少于所需数量。
   * 当 <code>true</code> 时，片段着色器使用平面着色，
   *
   * @memberof PerInstanceColorAppearance.prototype
   *
   * @type VertexFormat
   * @readonly
   */
  vertexFormat: {
    get: function () {
      return this._vertexFormat;
    },
  },

  /**
   * 这意味着光照未被考虑在内。
   * 当 <code>true</code> 时，片段着色器根据需求翻转表面法线，以确保法线朝向查看器，避免
   *
   * @memberof PerInstanceColorAppearance.prototype
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
   * 暗点出现。当几何图形的两侧都需被着色时，这非常有用，应像 {@link WallGeometry} 那样着色。
   * 所有 {@link PerInstanceColorAppearance} 实例兼容的 {@link VertexFormat}。这仅需要 <code>position</code> 和 <code>normal</code>
   * 属性。
   * 当 {@link PerInstanceColorAppearance#flat} 为 <code>true</code> 时，所有 {@link PerInstanceColorAppearance} 实例兼容的 {@link VertexFormat}。
   *
   * @memberof PerInstanceColorAppearance.prototype
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
});

/**
 * 仅需要 <code>position</code> 和 <code>normal</code>
 * 属性。
 * 属性。
 *
 * @type VertexFormat
 *
 * @constant
 */
PerInstanceColorAppearance.VERTEX_FORMAT = VertexFormat.POSITION_AND_NORMAL;

/**
 * 当 {@link PerInstanceColorAppearance#flat} 为 <code>true</code> 时，所有 {@link PerInstanceColorAppearance} 实例兼容的 {@link VertexFormat}。
 * 属性。
 * 仅需要 <code>position</code> 属性。
 *
 * @type VertexFormat
 *
 * @constant
 */
PerInstanceColorAppearance.FLAT_VERTEX_FORMAT = VertexFormat.POSITION_ONLY;

/**
 * 程序化生成完整的 GLSL 片段着色器源代码。对于 {@link PerInstanceColorAppearance}，
 * 此代码源自 {@link PerInstanceColorAppearance#fragmentShaderSource}、{@link PerInstanceColorAppearance#flat} 和 {@link PerInstanceColorAppearance#faceForward}。
 * 完整的 GLSL 片段着色器源代码。
 *
 * @function
 *
 * @returns {string} The 根据 {@link PerInstanceColorAppearance#translucent} 确定几何图形是否为半透明。
 */
PerInstanceColorAppearance.prototype.getFragmentShaderSource =
  Appearance.prototype.getFragmentShaderSource;

/**
 * 如果外观为半透明。
 *
 * @function
 *
 * @returns {boolean} <code>true</code> 则创建渲染状态。这不是最终的渲染状态实例；相反，
 */
PerInstanceColorAppearance.prototype.isTranslucent =
  Appearance.prototype.isTranslucent;

/**
 * Creates a render state.  This is not the final render state instance; instead,
 * 它包含与渲染状态相同的部分渲染状态属性。
 * 在相应上下文中创建。
 *
 * @function
 *
 * @returns {object} The 渲染状态。
 */
PerInstanceColorAppearance.prototype.getRenderState =
  Appearance.prototype.getRenderState;
export default PerInstanceColorAppearance;
