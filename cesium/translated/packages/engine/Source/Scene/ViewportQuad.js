import {
  BoundingRectangle,
  Color,
  DeveloperError,
  defined,
  destroyObject,
} from "@cesium/core";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import ViewportQuadFS from "../Shaders/ViewportQuadFS.js";
import BlendingState from "./BlendingState.js";
import Material from "./Material.js";

/**
 * 一个对齐的四边形视口。
 *
 * @alias ViewportQuad
 * @constructor
 *
 * @param {BoundingRectangle} [rectangle] 定义该四边形在视口内的位置的 {@link BoundingRectangle}。
 * @param {Material} [material] 定义视口四边形表面外观的 {@link Material}。
 *
 * @example
 * const viewportQuad = new Cesium.ViewportQuad(new Cesium.BoundingRectangle(0, 0, 80, 40));
 * viewportQuad.material.uniforms.color = new Cesium.Color(1.0, 0.0, 0.0, 1.0);
 */
function ViewportQuad(rectangle, material) {
  /**
   * 决定是否显示该视口四边形原语。
   *
   * @type {boolean}
   * @default true
   */
  this.show = true;

  if (!defined(rectangle)) {
    rectangle = new BoundingRectangle();
  }

  /**
   * 定义该四边形在视口内的位置的 BoundingRectangle。
   *
   * @type {BoundingRectangle}
   *
   * @example
   * viewportQuad.rectangle = new Cesium.BoundingRectangle(0, 0, 80, 40);
   */
  this.rectangle = BoundingRectangle.clone(rectangle);

  if (!defined(material)) {
    material = Material.fromType(Material.ColorType, {
      color: new Color(1.0, 1.0, 1.0, 1.0),
    });
  }

  /**
   * 视口四边形的表面外观。这可以是多个内置 {@link Material} 对象之一，也可以是自定义材质，通过脚本定义。
   * {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric}。
   * <p>
   * 默认材质是 <code>Material.ColorType</code>。
   * </p>
   *
   * @type Material
   *
   * @example
   * // 1. 将默认材质的颜色改为黄色
   * viewportQuad.material.uniforms.color = new Cesium.Color(1.0, 1.0, 0.0, 1.0);
   *
   * // 2. 将材质改为水平条纹
   * viewportQuad.material = Cesium.Material.fromType(Cesium.Material.StripeType);
   *
   * @see {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric}
   */
  this.material = material;
  this._material = undefined;

  this._overlayCommand = undefined;
  this._rs = undefined;
}

/**
 * 在 {@link Viewer} 或 {@link CesiumWidget} 将场景渲染时调用此函数，以获取渲染该原语所需的绘制命令。
 * 获取渲染该原语所需的绘制命令。
 * <p>
 * 不要直接调用此函数。此文档只是为了列出渲染场景时可能产生的异常：
 * 必须被定义。
 * </p>
 *
 * @exception {DeveloperError} this.material 必须被定义。
 * @exception {DeveloperError} this.rectangle 必须被定义。
 */
ViewportQuad.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  //>>includeStart('debug', pragmas.debug);
  if (!defined(this.material)) {
    throw new DeveloperError("this.material must be defined.");
  }
  if (!defined(this.rectangle)) {
    throw new DeveloperError("this.rectangle must be defined.");
  }
  //>>includeEnd('debug');

  const rs = this._rs;
  if (!defined(rs) || !BoundingRectangle.equals(rs.viewport, this.rectangle)) {
    this._rs = RenderState.fromCache({
      blending: BlendingState.ALPHA_BLEND,
      viewport: this.rectangle,
    });
  }

  const pass = frameState.passes;
  if (pass.render) {
    const context = frameState.context;

    if (this._material !== this.material || !defined(this._overlayCommand)) {
      // Recompile shader when material changes
      this._material = this.material;

      if (defined(this._overlayCommand)) {
        this._overlayCommand.shaderProgram.destroy();
      }

      const fs = new ShaderSource({
        sources: [this._material.shaderSource, ViewportQuadFS],
      });
      this._overlayCommand = context.createViewportQuadCommand(fs, {
        renderState: this._rs,
        uniformMap: this._material._uniforms,
        owner: this,
      });
      this._overlayCommand.pass = Pass.OVERLAY;
    }

    this._material.update(context);

    this._overlayCommand.renderState = this._rs;
    this._overlayCommand.uniformMap = this._material._uniforms;
    frameState.commandList.push(this._overlayCommand);
  }
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} True 如果此对象被销毁，则返回 true；否则返回 false。
 *
 * @see ViewportQuad#destroy
 */
ViewportQuad.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的 WebGL 资源。销毁对象允许确定性的
 * WebGL 资源释放，而不是依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy()。
 *
 *
 * @example
 * quad = quad && quad.destroy();
 *
 * @see ViewportQuad#isDestroyed
 */
ViewportQuad.prototype.destroy = function () {
  if (defined(this._overlayCommand)) {
    this._overlayCommand.shaderProgram =
      this._overlayCommand.shaderProgram &&
      this._overlayCommand.shaderProgram.destroy();
  }
  return destroyObject(this);
};
export default ViewportQuad;
