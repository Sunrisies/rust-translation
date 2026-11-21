import { Color, Frozen } from "@cesium/core";

/**
 * 表示对渲染器发出的清除帧缓冲区命令。
 *
 * @private
 * @constructor
 */
function ClearCommand(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 要清除的颜色缓冲区值。当为 <code>undefined</code> 时，颜色缓冲区不会被清除。
   *
   * @type {Color}
   *
   * @default undefined
   */
  this.color = options.color;

  /**
   * 要清除的深度缓冲区值。当为 <code>undefined</code> 时，深度缓冲区不会被清除。
   *
   * @type {number}
   *
   * @default undefined
   */
  this.depth = options.depth;

  /**
   * 要清除模板缓冲区的值。当为 <code>undefined</code> 时，模板缓冲区不会被清除。
   *
   * @type {number}
   *
   * @default undefined
   */
  this.stencil = options.stencil;

  /**
   * 执行清除命令时应用的渲染状态。以下状态会影响清除操作：
   * 剪切测试、颜色掩码、深度掩码和模板掩码。当渲染状态为
   * <code>undefined</code> 时，使用默认渲染状态。
   *
   * @type {RenderState}
   *
   * @default undefined
   */
  this.renderState = options.renderState;

  /**
   * 要清除的帧缓冲区。
   *
   * @type {Framebuffer}
   *
   * @default undefined
   */
  this.framebuffer = options.framebuffer;

  /**
   * 创建此命令的对象。这对于调试命令执行非常有用；即使只有对命令的引用，也可以查看是谁创建了该命令，并且可以通过 {@link Scene#debugCommandFilter} 选择性地执行命令。
   * 执行此命令的通道。
   * 执行此命令的遍数。
   * 将颜色清除为 (0.0, 0.0, 0.0, 0.0)；深度清除为 1.0；模板清除为 0.
   *
   * @type {object}
   *
   * @default undefined
   *
   * @see Scene#debugCommandFilter
   */
  this.owner = options.owner;

  /**
   * The pass in which to run this command.
   *
   * @type {Pass}
   *
   * @default undefined
   */
  this.pass = options.pass;
}

/**
 * Clears color to (0.0, 0.0, 0.0, 0.0); depth to 1.0; and stencil to 0.
 *
 * @type {ClearCommand}
 *
 * @constant
 */
ClearCommand.ALL = Object.freeze(
  new ClearCommand({
    color: new Color(0.0, 0.0, 0.0, 0.0),
    depth: 1.0,
    stencil: 0.0,
  }),
);

ClearCommand.prototype.execute = function (context, passState) {
  context.clear(this, passState);
};
export default ClearCommand;
