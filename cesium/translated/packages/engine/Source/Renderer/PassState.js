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
   * 要渲染的帧缓冲区。除非有 {@link DrawCommand} 或 {@link ClearCommand} 明确定义了帧缓冲区，否则将使用此帧缓冲区，该帧缓冲区用于离屏渲染。
   * 用于离屏渲染。
   * 当定义时，会覆盖 {@link DrawCommand} 渲染状态中的混合属性。
   *
   * @type {Framebuffer}
   * @default undefined
   */
  this.framebuffer = undefined;

  /**
   * 例如，用于允许渲染器在选择通道期间关闭混合。
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
   * 例如，用于允许渲染器在选择通道期间剪切出选择区域。
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
