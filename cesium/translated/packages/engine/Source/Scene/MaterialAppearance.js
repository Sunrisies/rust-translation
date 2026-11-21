import { Frozen, VertexFormat, defined } from "@cesium/core";
import AllMaterialAppearanceFS from "../Shaders/Appearances/AllMaterialAppearanceFS.js";
import AllMaterialAppearanceVS from "../Shaders/Appearances/AllMaterialAppearanceVS.js";
import BasicMaterialAppearanceFS from "../Shaders/Appearances/BasicMaterialAppearanceFS.js";
import BasicMaterialAppearanceVS from "../Shaders/Appearances/BasicMaterialAppearanceVS.js";
import TexturedMaterialAppearanceFS from "../Shaders/Appearances/TexturedMaterialAppearanceFS.js";
import TexturedMaterialAppearanceVS from "../Shaders/Appearances/TexturedMaterialAppearanceVS.js";
import Appearance from "./Appearance.js";
import Material from "./Material.js";

/**
     * 一种用于任意几何体的外观（与 {@link EllipsoidSurfaceAppearance} 等不同）
     * 支持使用材质进行着色。
     *
     * @alias MaterialAppearance
     * @constructor
     *
     * @param {object} [options] 具有以下属性的对象：
     * @param {boolean} [options.flat=false] 当 <code>true</code> 时，片段着色器中使用平面着色，这意味着光照不被考虑。
     * @param {boolean} [options.faceForward=!options.closed] 当 <code>true</code> 时，片段着色器根据需求翻转表面法线，以确保法线朝向观察者，避免暗点出现。当几何体的两侧都需要着色时，如 {@link WallGeometry} 所示，此功能非常有用。
     * @param {boolean} [options.translucent=true] 当 <code>true</code> 时，预期该几何体呈现半透明效果，因此 {@link MaterialAppearance#renderState} 需启用 alpha 混合。
     * @param {boolean} [options.closed=false] 当 <code>true</code> 时，预期该几何体是封闭的，因此 {@link MaterialAppearance#renderState} 需启用背面剔除。
     * @param {MaterialAppearance.MaterialSupportType} [options.materialSupport=MaterialAppearance.MaterialSupport.TEXTURED] 将支持的材质类型。
     * @param {Material} [options.material=Material.ColorType] 用于确定片段颜色的材质。
     * @param {string} [options.vertexShaderSource] 可覆盖默认顶点着色器的可选 GLSL 顶点着色器源。
     * @param {string} [options.fragmentShaderSource] 可覆盖默认片段着色器的可选 GLSL 片段着色器源。
     * @param {object} [options.renderState] 可覆盖默认渲染状态的可选渲染状态。
     *
     * @see {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric}
     * @demo {@link https://sandcastle.cesium.com/index.html?id=materials|Cesium Sandcastle Material Appearance Demo}
     *
     * @example
     * const primitive = new Cesium.Primitive({
     * geometryInstances : new Cesium.GeometryInstance({
     * geometry : new Cesium.WallGeometry({
            materialSupport :  Cesium.MaterialAppearance.MaterialSupport.BASIC.vertexFormat,
     *       // ...
     *     })
     *   }),
     * appearance : new Cesium.MaterialAppearance({
     * material : Cesium.Material.fromType('Color'),
     * faceForward : true
     *   })
     *
     * });
     */
function MaterialAppearance(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const translucent = options.translucent ?? true;
  const closed = options.closed ?? false;
  const materialSupport =
    options.materialSupport ?? MaterialAppearance.MaterialSupport.TEXTURED;

  /**
   * 用于确定片段颜色的材质。与其他 {@link MaterialAppearance} 不同，
   * 属性并非只读，因此外观的材质可以动态更改。
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
   * 当 <code>true</code> 时，预期该几何体呈现半透明效果。
   *
   * @type {boolean}
   *
   * @default true
   */
  this.translucent = translucent;

  this._vertexShaderSource =
    options.vertexShaderSource ?? materialSupport.vertexShaderSource;
  this._fragmentShaderSource =
    options.fragmentShaderSource ?? materialSupport.fragmentShaderSource;
  this._renderState = Appearance.getDefaultRenderState(
    translucent,
    closed,
    options.renderState,
  );
  this._closed = closed;

  // Non-derived members

  this._materialSupport = materialSupport;
  this._vertexFormat = materialSupport.vertexFormat;
  this._flat = options.flat ?? false;
  this._faceForward = options.faceForward ?? !closed;
}

Object.defineProperties(MaterialAppearance.prototype, {
  /**
   * 顶点着色器的 GLSL 源代码。
   *
   * @memberof MaterialAppearance.prototype
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
   * 片段着色器的 GLSL 源代码。完整的片段着色器源
   * 是经过程序构建的，考虑了 {@link MaterialAppearance#material},
   * {@link MaterialAppearance#flat} 和 {@link MaterialAppearance#faceForward}。
   * 使用 {@link MaterialAppearance#getFragmentShaderSource} 获取完整源代码。
   *
   * @memberof MaterialAppearance.prototype
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
   * 渲染该几何体时使用的 WebGL 固定函数状态。
   * <p>
   * 在构建 {@link MaterialAppearance} 实例时，可以显式定义渲染状态，
   * 也可以通过 {@link MaterialAppearance#translucent} 隐式设置渲染状态。
   * 和 {@link MaterialAppearance#closed}。
   * </p>
   *
   * @memberof MaterialAppearance.prototype
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
   * 当 <code>true</code> 时，几何形状应被视为闭合的。
   * {@link MaterialAppearance#renderState} 已启用背面剔除。
   * 如果查看器进入该几何形状，它将不可见。
   *
   * @memberof MaterialAppearance.prototype
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
   * 此实例支持的材质类型。这会影响所需的
   * {@link VertexFormat} 以及顶点和片段着色器的复杂度。
   *
   * @memberof MaterialAppearance.prototype
   *
   * @type {MaterialAppearance.MaterialSupportType}
   * @readonly
   *
   * @default {@link MaterialAppearance.MaterialSupport.TEXTURED}
   */
  materialSupport: {
    get: function () {
      return this._materialSupport;
    },
  },

  /**
   * 此外观实例兼容的 {@link VertexFormat}。
   * 一个几何形状可以拥有更多的顶点属性，并且仍然兼容——但这会带来
   * 潜在的性能成本——但无法少于这个数量。
   *
   * @memberof MaterialAppearance.prototype
   *
   * @type VertexFormat
   * @readonly
   *
   * @default {@link MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat}
   */
  vertexFormat: {
    get: function () {
      return this._vertexFormat;
    },
  },

  /**
   * 当 <code>true</code> 时，片段着色器中使用平面着色。
   * 这意味着光照效果未被考虑。
   *
   * @memberof MaterialAppearance.prototype
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
   * 当 <code>true</code> 时，片段着色器根据需求翻转表面法线，
   * 以确保法线朝向查看器，避免
   * 暗点出现。当几何形状的两侧都需
   * 像 {@link WallGeometry} 那样着色时非常有用。
   *
   * @memberof MaterialAppearance.prototype
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
 * 程序化生成完整的 GLSL 片段着色器源。对于 {@link MaterialAppearance}，
 * 这是从 {@link MaterialAppearance#fragmentShaderSource}、{@link MaterialAppearance#material}、
 * {@link MaterialAppearance#flat} 和 {@link MaterialAppearance#faceForward} 派生而来的。
 *
 * @function
 *
 * @returns {string} The 完整的 GLSL 片段着色器源。
 */
MaterialAppearance.prototype.getFragmentShaderSource =
  Appearance.prototype.getFragmentShaderSource;

/**
 * 根据 {@link MaterialAppearance#translucent} 和 {@link Material#isTranslucent} 确定几何形状是否为半透明。
 *
 * @function
 *
 * @returns {boolean} <code>true</code> 如果外观是半透明的。
 */
MaterialAppearance.prototype.isTranslucent = Appearance.prototype.isTranslucent;

/**
 * 创建一个渲染状态。这不是最终的渲染状态实例；相反，
 * 它可以包含与上下文中的渲染状态相同的部分渲染状态属性。
 * 渲染状态。
 *
 * @function
 *
 * @returns {object} The 渲染状态。
 */
MaterialAppearance.prototype.getRenderState =
  Appearance.prototype.getRenderState;

/**
 * @typedef MaterialAppearance.MaterialSupportType
 * @type {object}
 * @property {VertexFormat} vertexFormat
 * @property {string} vertexShaderSource
 * @property {string} fragmentShaderSource
 */

/**
 * 确定 {@link MaterialAppearance} 实例支持的 {@link Material} 类型。这是
 * (灵活性（多种材质）与内存/性能之间的权衡
 * (所需的顶点格式和 GLSL 着色器复杂度。
 * 仅支持基本材质，这些材质只需要 <code>position</code> 和
 * @namespace
 */
MaterialAppearance.MaterialSupport = {
  /**
   * 以及 <code>normal</code> 顶点属性。
   * 支持带有纹理的材质，这些材质需要 <code>position</code>、
   *
   * @type {MaterialAppearance.MaterialSupportType}
   * @constant
   */
  BASIC: Object.freeze({
    vertexFormat: VertexFormat.POSITION_AND_NORMAL,
    vertexShaderSource: BasicMaterialAppearanceVS,
    fragmentShaderSource: BasicMaterialAppearanceFS,
  }),
  /**
   * Materials with textures, which require <code>position</code>,
   * <code>normal</code> 和 <code>st</code> 顶点属性。
   * 这些材质都受此类别的约束。绝大多数材质属于此类。
   *
   * @type {MaterialAppearance.MaterialSupportType}
   * @constant
   */
  TEXTURED: Object.freeze({
    vertexFormat: VertexFormat.POSITION_NORMAL_AND_ST,
    vertexShaderSource: TexturedMaterialAppearanceVS,
    fragmentShaderSource: TexturedMaterialAppearanceFS,
  }),
  /**
   * 所有材质，包括在切线空间中工作的材质，都受支持。
   * 这需要 <code>position</code>、<code>normal</code>、<code>st</code>。
   * <code>tangent</code> 和 <code>bitangent</code> 顶点属性。
   *
   * @type {MaterialAppearance.MaterialSupportType}
   * @constant
   */
  ALL: Object.freeze({
    vertexFormat: VertexFormat.ALL,
    vertexShaderSource: AllMaterialAppearanceVS,
    fragmentShaderSource: AllMaterialAppearanceFS,
  }),
};
export default MaterialAppearance;
