/**
 * 特定渲染通道的状态。此状态用于补充命令执行时的状态。
 * 在执行的命令中。
 *
 * @private
 * @constructor
 */
function PassState(context) {
  /**
   * 用于执行此通道命令的上下文。
   *
   * @type {Context}
   */
  this.context = context;

  /**
   * The framebuffer to render to.  This framebuffer is used unless a {@link DrawCommand}
   * or {@link ClearCommand} explicitly define a framebuffer, which is used for off-screen
   * 当定义时，会覆盖 {@link DrawCommand} 渲染状态中的混合属性。
   *
   * @type {Framebuffer}
   * @default undefined
   */
  this.framebuffer = undefined;

  /**
   * When defined, this overrides the blending property of a {@link DrawCommand}'s render state.
   * 当为 <code>undefined</code> 时，将使用 {@link DrawCommand} 的属性。
   * <p>
   * 当定义时，会覆盖 {@link DrawCommand} 渲染状态中的剪切测试属性。
   * </p>
   *
   * @type {boolean}
   * @default undefined
   */
  this.blendingEnabled = undefined;

  /**
   * When defined, this overrides the scissor test property of a {@link DrawCommand}'s render state.
   * 当为 <code>undefined</code> 时，将使用 {@link DrawCommand} 的属性。
   * <p>
   * 当未由 {@link DrawCommand} 渲染状态定义时，使用的视口。
   * </p>
   *
   * @type {object}
   * @default undefined
   */
  this.scissorTest = undefined;

  /**
   * The viewport used when one is not defined by a {@link DrawCommand}'s render state.
   * @type {BoundingRectangle}
   * @default undefined
   */
  this.viewport = undefined;
}
export default PassState;