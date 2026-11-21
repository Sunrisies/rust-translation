import {
  BoundingSphere,
  BoxGeometry,
  Cartesian3,
  DeveloperError,
  Frozen,
  Matrix4,
  VertexFormat,
  combine,
  defined,
  destroyObject,
} from "@cesium/core";
import BufferUsage from "../Renderer/BufferUsage.js";
import DrawCommand from "../Renderer/DrawCommand.js";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import ShaderProgram from "../Renderer/ShaderProgram.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import VertexArray from "../Renderer/VertexArray.js";
import EllipsoidFS from "../Shaders/EllipsoidFS.js";
import EllipsoidVS from "../Shaders/EllipsoidVS.js";
import BlendingState from "./BlendingState.js";
import CullFace from "./CullFace.js";
import Material from "./Material.js";
import SceneMode from "./SceneMode.js";

const attributeLocations = {
  position: 0,
};

/**
 * 一个可渲染的椭球体。当三个 {@link EllipsoidPrimitive#radii} 分量相等时，它也可以绘制为球体。
 * <p>
 * 此功能仅支持 3D 模式。在 2D 或 Columbus 视图中不会显示该椭球体。
 * </p>
 *
 * @alias EllipsoidPrimitive
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Cartesian3} [options.center=Cartesian3.ZERO] 椭球体在模型坐标中的中心位置。
 * @param {Cartesian3} [options.radii] 椭球体在模型坐标中沿 <code>x</code>、<code>y</code> 和 <code>z</code> 轴的半径。
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 将椭球体从模型坐标转换为世界坐标的 4x4 变换矩阵。
 * @param {boolean} [options.show=true] 决定此primitive是否会被显示。
 * @param {Material} [options.material=Material.ColorType] primitive的表面外观。
 * @param {object} [options.id] 当通过 {@link Scene#pick} 选中实例时返回的自定义对象。
 * @param {boolean} [options.debugShowBoundingVolume=false] 仅用于调试。决定此primitive的命令边界球是否显示。
 *
 * @private
 */
function EllipsoidPrimitive(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 椭球体在模型坐标中的中心位置。
   * <p>
   * 默认值为 {@link Cartesian3.ZERO}。
   * </p>
   *
   * @type {Cartesian3}
   * @default {@link Cartesian3.ZERO}
   *
   * @see EllipsoidPrimitive#modelMatrix
   */
  this.center = Cartesian3.clone(options.center ?? Cartesian3.ZERO);
  this._center = new Cartesian3();

  /**
   * 椭球体在模型坐标中沿 <code>x</code>、<code>y</code> 和 <code>z</code> 轴的半径。
   * 当这些值相同时，椭球体即为球体。
   * <p>
   * 默认值为 <code>undefined</code>。在提供半径之前不会绘制该椭球体。
   * </p>
   *
   * @type {Cartesian3}
   * @default undefined
   *
   *
   * @example
   * // 半径为 2.0 的球体
   * e.radii = new Cesium.Cartesian3(2.0, 2.0, 2.0);
   *
   * @see EllipsoidPrimitive#modelMatrix
   */
  this.radii = Cartesian3.clone(options.radii);
  this._radii = new Cartesian3();

  this._oneOverEllipsoidRadiiSquared = new Cartesian3();
  this._boundingSphere = new BoundingSphere();

  /**
   * 将椭球体从模型坐标转换为世界坐标的 4x4 变换矩阵。
   * 当该矩阵为单位矩阵时，椭球体将在世界坐标中绘制，即地球 WGS84 坐标。
   * 可以通过提供不同的变换矩阵来使用本地参考框架，例如 {@link Transforms.eastNorthUpToFixedFrame} 返回的矩阵。
   * by {@link Transforms.eastNorthUpToFixedFrame}.
   *
   * @type {Matrix4}
   * @default {@link Matrix4.IDENTITY}
   *
   * @example
   * e.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
   * 决定椭球体primitive是否会被显示。
   */
  this.modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);
  this._modelMatrix = new Matrix4();
  this._computedModelMatrix = new Matrix4();

  /**
   * 椭球体的表面外观。这可以是多个内置 {@link Material} 对象中的一种，也可以是使用
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  /**
   * {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric} 编写的自定义材质。
   * {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric}.
   * <p>
   * 默认材质为 <code>Material.ColorType</code>。
   * </p>
   *
   * @type {Material}
   * @default Material.fromType(Material.ColorType)
   *
   *
   * @example
   * // 1. 将默认材质的颜色更改为黄色
   * e.material.uniforms.color = new Cesium.Color(1.0, 1.0, 0.0, 1.0);
   *
   * // 2. 将材质更改为水平条纹
   * e.material = Cesium.Material.fromType(Cesium.Material.StripeType);
   *
   * @see {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric}
   */
  this.material = options.material ?? Material.fromType(Material.ColorType);
  this._material = undefined;
  this._translucent = undefined;

  /**
   * 当选择椭球体时，会返回用户定义的对象。
   *
   * @type {object}
   *
   * @default undefined
   *
   * @see Scene#pick
   */
  this.id = options.id;
  this._id = undefined;

  /**
   * 此属性仅用于调试；不用于生产环境，也未经过优化。
   * <p>
   * 为primitive中的每个绘制命令绘制边界球体。
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;

  /**
   * @private
   */
  this.onlySunLighting = options.onlySunLighting ?? false;
  this._onlySunLighting = false;

  /**
   * @private
   */
  this._depthTestEnabled = options.depthTestEnabled ?? true;

  this._useLogDepth = false;

  this._sp = undefined;
  this._rs = undefined;
  this._va = undefined;

  this._pickSP = undefined;
  this._pickId = undefined;

  this._colorCommand = new DrawCommand({
    owner: options._owner ?? this,
  });
  this._pickCommand = new DrawCommand({
    owner: options._owner ?? this,
    pickOnly: true,
  });

  const that = this;
  this._uniforms = {
    u_radii: function () {
      return that.radii;
    },
    u_oneOverEllipsoidRadiiSquared: function () {
      return that._oneOverEllipsoidRadiiSquared;
    },
  };

  this._pickUniforms = {
    czm_pickColor: function () {
      return that._pickId.color;
    },
  };
}

function getVertexArray(context) {
  let vertexArray = context.cache.ellipsoidPrimitive_vertexArray;

  if (defined(vertexArray)) {
    return vertexArray;
  }

  const geometry = BoxGeometry.createGeometry(
    BoxGeometry.fromDimensions({
      dimensions: new Cartesian3(2.0, 2.0, 2.0),
      vertexFormat: VertexFormat.POSITION_ONLY,
    }),
  );

  vertexArray = VertexArray.fromGeometry({
    context: context,
    geometry: geometry,
    attributeLocations: attributeLocations,
    bufferUsage: BufferUsage.STATIC_DRAW,
    interleave: true,
  });

  context.cache.ellipsoidPrimitive_vertexArray = vertexArray;
  return vertexArray;
}

/**
 * 在 {@link Viewer} 或 {@link CesiumWidget} 将场景渲染到
 * 所需绘制命令时调用。
 * <p>
 * 请勿直接调用此函数。此文档仅用于列出
 * 在场景渲染时可能产生的异常：
 * </p>
 *
 * @exception {DeveloperError} this.material 必须定义。
 */
EllipsoidPrimitive.prototype.update = function (frameState) {
  if (
    !this.show ||
    frameState.mode !== SceneMode.SCENE3D ||
    !defined(this.center) ||
    !defined(this.radii)
  ) {
    return;
  }

  //>>includeStart('debug', pragmas.debug);
  if (!defined(this.material)) {
    throw new DeveloperError("this.material must be defined.");
  }
  //>>includeEnd('debug');

  const context = frameState.context;
  const translucent = this.material.isTranslucent();
  const translucencyChanged = this._translucent !== translucent;

  if (!defined(this._rs) || translucencyChanged) {
    this._translucent = translucent;

    // If this render state is ever updated to use a non-default
    // depth range, the hard-coded values in EllipsoidVS.glsl need
    // to be updated as well.

    this._rs = RenderState.fromCache({
      // Cull front faces - not back faces - so the ellipsoid doesn't
      // disappear if the viewer enters the bounding box.
      cull: {
        enabled: true,
        face: CullFace.FRONT,
      },
      depthTest: {
        enabled: this._depthTestEnabled,
      },
      // Only write depth when EXT_frag_depth is supported since the depth for
      // the bounding box is wrong; it is not the true depth of the ray casted ellipsoid.
      depthMask: !translucent && context.fragmentDepth,
      blending: translucent ? BlendingState.ALPHA_BLEND : undefined,
    });
  }

  if (!defined(this._va)) {
    this._va = getVertexArray(context);
  }

  let boundingSphereDirty = false;

  const radii = this.radii;
  if (!Cartesian3.equals(this._radii, radii)) {
    Cartesian3.clone(radii, this._radii);

    const r = this._oneOverEllipsoidRadiiSquared;
    r.x = 1.0 / (radii.x * radii.x);
    r.y = 1.0 / (radii.y * radii.y);
    r.z = 1.0 / (radii.z * radii.z);

    boundingSphereDirty = true;
  }

  if (
    !Matrix4.equals(this.modelMatrix, this._modelMatrix) ||
    !Cartesian3.equals(this.center, this._center)
  ) {
    Matrix4.clone(this.modelMatrix, this._modelMatrix);
    Cartesian3.clone(this.center, this._center);

    // Translate model coordinates used for rendering such that the origin is the center of the ellipsoid.
    Matrix4.multiplyByTranslation(
      this.modelMatrix,
      this.center,
      this._computedModelMatrix,
    );
    boundingSphereDirty = true;
  }

  if (boundingSphereDirty) {
    Cartesian3.clone(Cartesian3.ZERO, this._boundingSphere.center);
    this._boundingSphere.radius = Cartesian3.maximumComponent(radii);
    BoundingSphere.transform(
      this._boundingSphere,
      this._computedModelMatrix,
      this._boundingSphere,
    );
  }

  const materialChanged = this._material !== this.material;
  this._material = this.material;
  this._material.update(context);

  const lightingChanged = this.onlySunLighting !== this._onlySunLighting;
  this._onlySunLighting = this.onlySunLighting;

  const useLogDepth = frameState.useLogDepth;
  const useLogDepthChanged = this._useLogDepth !== useLogDepth;
  this._useLogDepth = useLogDepth;

  const colorCommand = this._colorCommand;
  let vs;
  let fs;

  // Recompile shader when material, lighting, or translucency changes
  if (
    materialChanged ||
    lightingChanged ||
    translucencyChanged ||
    useLogDepthChanged
  ) {
    vs = new ShaderSource({
      sources: [EllipsoidVS],
    });
    fs = new ShaderSource({
      sources: [this.material.shaderSource, EllipsoidFS],
    });
    if (this.onlySunLighting) {
      fs.defines.push("ONLY_SUN_LIGHTING");
    }
    if (!translucent && context.fragmentDepth) {
      fs.defines.push("WRITE_DEPTH");
    }
    if (this._useLogDepth) {
      vs.defines.push("LOG_DEPTH");
      fs.defines.push("LOG_DEPTH");
    }

    this._sp = ShaderProgram.replaceCache({
      context: context,
      shaderProgram: this._sp,
      vertexShaderSource: vs,
      fragmentShaderSource: fs,
      attributeLocations: attributeLocations,
    });

    colorCommand.vertexArray = this._va;
    colorCommand.renderState = this._rs;
    colorCommand.shaderProgram = this._sp;
    colorCommand.uniformMap = combine(this._uniforms, this.material._uniforms);
    colorCommand.executeInClosestFrustum = translucent;
  }

  const commandList = frameState.commandList;
  const passes = frameState.passes;

  if (passes.render) {
    colorCommand.boundingVolume = this._boundingSphere;
    colorCommand.debugShowBoundingVolume = this.debugShowBoundingVolume;
    colorCommand.modelMatrix = this._computedModelMatrix;
    colorCommand.pass = translucent ? Pass.TRANSLUCENT : Pass.OPAQUE;

    commandList.push(colorCommand);
  }

  if (passes.pick) {
    const pickCommand = this._pickCommand;

    if (!defined(this._pickId) || this._id !== this.id) {
      this._id = this.id;
      this._pickId = this._pickId && this._pickId.destroy();
      this._pickId = context.createPickId({
        primitive: this,
        id: this.id,
      });
    }

    // Recompile shader when material changes
    if (
      materialChanged ||
      lightingChanged ||
      !defined(this._pickSP) ||
      useLogDepthChanged
    ) {
      vs = new ShaderSource({
        sources: [EllipsoidVS],
      });
      fs = new ShaderSource({
        sources: [this.material.shaderSource, EllipsoidFS],
        pickColorQualifier: "uniform",
      });
      if (this.onlySunLighting) {
        fs.defines.push("ONLY_SUN_LIGHTING");
      }
      if (!translucent && context.fragmentDepth) {
        fs.defines.push("WRITE_DEPTH");
      }
      if (this._useLogDepth) {
        vs.defines.push("LOG_DEPTH");
        fs.defines.push("LOG_DEPTH");
      }

      this._pickSP = ShaderProgram.replaceCache({
        context: context,
        shaderProgram: this._pickSP,
        vertexShaderSource: vs,
        fragmentShaderSource: fs,
        attributeLocations: attributeLocations,
      });

      pickCommand.vertexArray = this._va;
      pickCommand.renderState = this._rs;
      pickCommand.shaderProgram = this._pickSP;
      pickCommand.uniformMap = combine(
        combine(this._uniforms, this._pickUniforms),
        this.material._uniforms,
      );
      pickCommand.executeInClosestFrustum = translucent;
    }

    pickCommand.boundingVolume = this._boundingSphere;
    pickCommand.modelMatrix = this._computedModelMatrix;
    pickCommand.pass = translucent ? Pass.TRANSLUCENT : Pass.OPAQUE;

    commandList.push(pickCommand);
  }
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>true</code>。
 *
 * @see EllipsoidPrimitive#destroy
 */
EllipsoidPrimitive.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的WebGL资源。销毁对象可以确保
 * WebGL资源的确定释放，而无需依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * e = e && e.destroy();
 *
 * @see EllipsoidPrimitive#isDestroyed
 */
EllipsoidPrimitive.prototype.destroy = function () {
  this._sp = this._sp && this._sp.destroy();
  this._pickSP = this._pickSP && this._pickSP.destroy();
  this._pickId = this._pickId && this._pickId.destroy();
  return destroyObject(this);
};
export default EllipsoidPrimitive;