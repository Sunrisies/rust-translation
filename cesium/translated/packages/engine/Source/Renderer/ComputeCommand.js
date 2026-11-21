import { Frozen } from "@cesium/core";
import Pass from "./Pass.js";

/**
 * 表示对渲染器发出的 GPU 计算命令（使用传统 GPGPU）。
 *
 * @private
 * @constructor
 */
function ComputeCommand(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 顶点数组。若未提供，则使用视口四边形。
   *
   * @type {VertexArray}
   * @default undefined
   */
  this.vertexArray = options.vertexArray;

  /**
   * 片段着色器源代码。默认顶点着色器为 ViewportQuadVS。
   *
   * @type {ShaderSource}
   * @default undefined
   */
  this.fragmentShaderSource = options.fragmentShaderSource;

  /**
   * 要应用的着色器程序。
   *
   * @type {ShaderProgram}
   * @default undefined
   */
  this.shaderProgram = options.shaderProgram;

  /**
   * 具有与着色器程序中的统一变量名称匹配的函数及其返回值来设置这些统一变量。
   * 以及返回值来设置那些统一变量。
   *
   * @type {object}
   * @default undefined
   */
  this.uniformMap = options.uniformMap;

  /**
   * 用于离屏渲染的纹理。
   *
   * @type {Texture}
   * @default undefined
   */
  this.outputTexture = options.outputTexture;

  /**
   * 在计算命令执行前立即调用的函数。用于更新任何渲染器资源。仅接受计算命令作为参数。
   * 计算命令执行后调用的函数。接受输出纹理作为参数。
   *
   * @type {Function}
   * @default undefined
   */
  this.preExecute = options.preExecute;

  /**
   * 命令被取消时调用的函数。
   * 渲染命令被取消时调用的函数。
   *
   * @type {Function}
   * @default undefined
   */
  this.postExecute = options.postExecute;

  /**
   * 渲染命令被取消时调用的函数。
   *
   * @type {Function}
   * @default undefined
   */
  this.canceled = options.canceled;

  /**
   * 渲染器资源是否会在本次调用后保留。如果不会，它们在完成后将被销毁。
   * 始终使用计算通道进行渲染。
   *
   * @type {boolean}
   * @default false
   */
  this.persists = options.persists ?? false;

  /**
   * 渲染的通道。始终为计算通道。
   *
   * @type {Pass}
   * @default Pass.COMPUTE;
   */
  this.pass = Pass.COMPUTE;

  /**
   * 创建此命令的实体。这对于调试命令执行非常有用；它允许我们仅通过引用命令时就能看到是谁创建了该命令，并且可以用来选择性地执行命令。
   * 使用 {@link Scene#debugCommandFilter}。
   * 执行计算命令。
   * 处理计算命令的上下文。
   *
   * @type {object}
   * @default undefined
   *
   * @see Scene#debugCommandFilter
   */
  this.owner = options.owner;
}

/**
 * Executes the compute command.
 *
 * @param {ComputeEngine} computeEngine The context that processes the compute command.
 */
ComputeCommand.prototype.execute = function (computeEngine) {
  computeEngine.execute(this);
};
export default ComputeCommand;
