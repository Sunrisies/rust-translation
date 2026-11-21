import {
  BoxGeometry,
  Cartesian3,
  Check,
  DeveloperError,
  GeometryPipeline,
  Matrix4,
  VertexFormat,
  defined,
  destroyObject,
} from "@cesium/core";
import BufferUsage from "../Renderer/BufferUsage.js";
import CubeMap from "../Renderer/CubeMap.js";
import DrawCommand from "../Renderer/DrawCommand.js";
import loadCubeMap from "../Renderer/loadCubeMap.js";
import RenderState from "../Renderer/RenderState.js";
import ShaderProgram from "../Renderer/ShaderProgram.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import VertexArray from "../Renderer/VertexArray.js";
import SkyBoxFS from "../Shaders/SkyBoxFS.js";
import SkyBoxVS from "../Shaders/SkyBoxVS.js";
import CubeMapPanoramaVS from "../Shaders/CubeMapPanoramaVS.js";
import BlendingState from "./BlendingState.js";
import SceneMode from "./SceneMode.js";
import Pass from "../Renderer/Pass.js";
import Credit from "../Core/Credit.js";

/**
 * @typedef {object} CubeMapPanorama.ConstructorOptions
 *
 * CubeMapPanorama 构造器的初始化选项
 *
 * @property {object} [options.sources] 六个立方体地图面的源 URL 或 <code>Image</code> 对象。请参见下面的示例。
 * @property {Matrix3} [options.transform] 定义全景图方向的 3x3 变换矩阵。未指定时，默认方向使用真赤道平均分点（TEME）轴。
 * @property {boolean} [options.show=true] 决定此原始体是否会被显示。
 * @property {Credit|string} [options.credit] 显示在画布上的全景图的致谢信息。
 *
 */

/**
 * 在场景中以立方体地图格式显示影像的 {@link Panorama}。
 * <p>
 * 此功能仅支持 3D 模式。当转换为 2D 或 Columbus 视图时，立方体地图全景图会淡化。立方体地图全景图的大小
 * 必须不超过 {@link Scene#maximumSkyBoxSize}。
 * </p>
 *
 * @alias CubeMapPanorama
 * @constructor
 *
 * @param {CubeMapPanorama.ConstructorOptions} options 描述初始化选项的对象
 *
 * @example
 * const modelMatrix = Cesium.Matrix4.getMatrix3()
 * Cesium.Transforms.localFrameToFixedFrameGenerator("north", "down")
 * Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
 * Cesium.Ellipsoid.default
 *   ),
 * new Cesium.Matrix3()
 * );
 *
 *
 * scene.primitives.add(new Cesium.CubeMapPanorama({
 * sources : {
 * positiveX : 'cubemap_px.png',
 * negativeX : 'cubemap_nx.png',
 * positiveY : 'cubemap_py.png',
 * negativeY : 'cubemap_ny.png',
 * positiveZ : 'cubemap_pz.png',
 * negativeZ : 'cubemap_nz.png'
 *   }
 * transform: modelMatrix,
 * }));
 *
 * @see SkyBox
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=panorama|Cesium Sandcastle Panorama}
 */
function CubeMapPanorama(options) {
  /**
   * 用于创建立方体地图面的源：一个具有 <code>positiveX</code>、<code>negativeX</code>、<code>positiveY</code>、<code>negativeY</code>、<code>positiveZ</code> 和 <code>negativeZ</code> 属性的对象。
   * 这些可以是 URL 或 <code>Image</code> 对象。
   * 决定立方体地图全景图是否会被显示。
   * 获取全景图的变换。如果未定义，则使用默认方向，即真赤道平均分点（TEME）轴。
   *
   * @type {object}
   * @default undefined
   */
  this.sources = options.sources;
  this._sources = undefined;

  this._transform = options.transform;

  /**
   * 获取全景图的致谢信息。
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  this._returnCommand = options.returnCommand ?? false;
  this._addToPanoramaCommandList = !this._returnCommand;

  this._command = new DrawCommand({
    modelMatrix: Matrix4.clone(Matrix4.IDENTITY),
    owner: this,
    // render before everything else
    pass: Pass.ENVIRONMENT,
  });
  this._cubeMap = undefined;

  this._attributeLocations = undefined;
  this._useHdr = undefined;
  this._hasError = false;
  this._error = undefined;

  // Credit specified by the user.
  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;
}

Object.defineProperties(CubeMapPanorama.prototype, {
  /**
   * 在 {@link Viewer} 或 {@link CesiumWidget} 渲染场景时调用此函数，以获取渲染此原始体所需的绘制命令。
   * @memberof CubeMapPanorama.prototype
   * @type {Matrix3}
   * @readonly
   */
  transform: {
    get: function () {
      return this._transform;
    },
  },

  /**
   * 不要直接调用此函数。此文档仅用于列出渲染场景时可能传播的异常：
   * @memberof CubeMapPanorama.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return defined(this._credit) ? this._credit : undefined;
    },
  },
});

/**
 * 需要此对象，并且必须具有 positiveX、negativeX、positiveY、negativeY、positiveZ 和 negativeZ 属性。
 * 所有属性必须属于同一类型。
 * <p>
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * 如果此对象被销毁，则不应使用它；调用任何其他函数
 * </p>
 *
 * @exception {DeveloperError} this.sources is required and must have positiveX, negativeX, positiveY, negativeY, positiveZ, and negativeZ properties.
 * @exception {DeveloperError} this.sources properties must all be the same type.
 */
CubeMapPanorama.prototype.update = function (frameState, useHdr) {
  const that = this;
  const { mode, passes, context, panoramaCommandList } = frameState;

  if (!this.show) {
    return undefined;
  }

  if (mode !== SceneMode.SCENE3D && mode !== SceneMode.MORPHING) {
    return undefined;
  }

  // The cube map panorama is only rendered during the render pass; it is not pickable, it doesn't cast shadows, etc.
  if (!passes.render) {
    return undefined;
  }

  // Throw any errors that had previously occurred asynchronously so they aren't
  // ignored when running.  See https://github.com/CesiumGS/cesium/pull/12307
  if (this._hasError) {
    const error = this._error;
    this._hasError = false;
    this._error = undefined;
    throw error;
  }

  if (this._sources !== this.sources) {
    this._sources = this.sources;
    const sources = this.sources;

    //>>includeStart('debug', pragmas.debug);
    Check.defined("this.sources", sources);
    if (
      Object.values(CubeMap.FaceName).some(
        (faceName) => !defined(sources[faceName]),
      )
    ) {
      throw new DeveloperError(
        "this.sources must have positiveX, negativeX, positiveY, negativeY, positiveZ, and negativeZ properties.",
      );
    }

    const sourceType = typeof sources.positiveX;
    if (
      Object.values(CubeMap.FaceName).some(
        (faceName) => typeof sources[faceName] !== sourceType,
      )
    ) {
      throw new DeveloperError(
        "this.sources properties must all be the same type.",
      );
    }
    //>>includeEnd('debug');

    if (typeof sources.positiveX === "string") {
      // Given urls for cube-map images.  Load them.
      loadCubeMap(context, this._sources)
        .then(function (cubeMap) {
          that._cubeMap = that._cubeMap && that._cubeMap.destroy();
          that._cubeMap = cubeMap;
        })
        .catch((error) => {
          // Defer throwing the error until the next call to update to prevent
          // test from failing in `afterAll` if this is rejected after the test
          // using the Skybox ends.  See https://github.com/CesiumGS/cesium/pull/12307
          this._hasError = true;
          this._error = error;
        });
    } else {
      this._cubeMap = this._cubeMap && this._cubeMap.destroy();
      this._cubeMap = new CubeMap({
        context: context,
        source: sources,
      });
    }
    this._addToPanoramaCommandList = true;
  }

  const command = this._command;

  if (!defined(command.vertexArray)) {
    command.uniformMap = {
      u_cubeMap: function () {
        return that._cubeMap;
      },
      u_cubeMapPanoramaTransform: function () {
        return that._transform;
      },
    };

    const geometry = BoxGeometry.createGeometry(
      BoxGeometry.fromDimensions({
        dimensions: new Cartesian3(2.0, 2.0, 2.0),
        vertexFormat: VertexFormat.POSITION_ONLY,
      }),
    );
    const attributeLocations = (this._attributeLocations =
      GeometryPipeline.createAttributeLocations(geometry));

    command.vertexArray = VertexArray.fromGeometry({
      context: context,
      geometry: geometry,
      attributeLocations: attributeLocations,
      bufferUsage: BufferUsage.STATIC_DRAW,
    });

    // no depth test/write
    command.renderState = RenderState.fromCache({
      depthTest: { enabled: false },
      depthMask: false,
      blending: BlendingState.ALPHA_BLEND,
    });
    this._addToPanoramaCommandList = true;
  }

  if (!defined(command.shaderProgram) || this._useHdr !== useHdr) {
    const fs = new ShaderSource({
      defines: [useHdr ? "HDR" : ""],
      sources: [SkyBoxFS],
    });
    command.shaderProgram = ShaderProgram.fromCache({
      context: context,
      //vertexShaderSource: SkyBoxVS,
      vertexShaderSource: defined(this._transform)
        ? CubeMapPanoramaVS
        : SkyBoxVS,
      fragmentShaderSource: fs,
      attributeLocations: this._attributeLocations,
    });
    this._useHdr = useHdr;
    this._addToPanoramaCommandList = true;
  }

  if (!defined(this._cubeMap)) {
    return undefined;
  }

  if (this.show && defined(this._credit) && !this._returnCommand) {
    const creditDisplay = frameState.creditDisplay;
    creditDisplay.addCreditToNextFrame(this._credit);
  }

  if (this._returnCommand) {
    return command;
  }

  if (this._addToPanoramaCommandList) {
    panoramaCommandList.push(command);
    this._addToPanoramaCommandList = false;
  }
};

/**
 * Returns true if this object was destroyed; otherwise, false.
 * <br /><br />
 * If this object was destroyed, it should not be used; calling any function other than
 * 调用 <code>isDestroyed</code> 将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象已被销毁，则返回 <code>true</code>；否则返回 <code>false</code>。
 *
 * @see CubeMapPanorama#destroy
 */
CubeMapPanorama.prototype.isDestroyed = function () {
  return false;
};

/**
 * 会释放该对象所持有的 WebGL 资源。销毁对象可以使得 WebGL 资源被确定性地释放，而无需依赖垃圾收集器来销毁该对象。
 * 一旦对象被销毁，就不应再使用它；调用除 <code>isDestroyed</code> 之外的任何函数都会引发
 * <br /><br />
 * Once an object is destroyed, it should not be used; calling any function other than
 * 异常。因此，
 * 应将返回值 (<code>undefined</code>) 赋给该对象，如示例中所示。
 *
 * @exception {DeveloperError} This 表明对象已被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * cubeMapPanorama = cubeMapPanorama && cubeMapPanorama.destroy();
 *
 * @see CubeMapPanorama#isDestroyed
 */
CubeMapPanorama.prototype.destroy = function () {
  const command = this._command;
  command.vertexArray = command.vertexArray && command.vertexArray.destroy();
  command.shaderProgram =
    command.shaderProgram && command.shaderProgram.destroy();
  this._cubeMap = this._cubeMap && this._cubeMap.destroy();
  return destroyObject(this);
};

export default CubeMapPanorama;
