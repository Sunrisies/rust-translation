// @ts-check

/**
 * 描述 <code>Primitive</code> 生命周期的状态，由 <code>primitive._state</code> 表示。
 * 状态转换由调用 <code>update</code> 函数触发，但如果
 *
 * primitive 的 <code>asynchronous</code> 标志被设置为
 * <code>true</code>，实际状态变化可能会异步发生。
 * 初始状态为 primitive 的状态。
 * 注意，这并不表示 primitive 已经“准备就绪”，正如
 *
 * @enum {number}
 * @private
 */
const PrimitiveState = {
  /**
   * <code>_ready</code> 属性所指示的那样。它的含义恰恰相反：primitive 根本
   *
   * 没有完成任何操作。
   * 对于使用 <code>asynchronous:true</code> 设置创建的 primitive，处于此状态的
   * 时，<code>update</code> 调用会开始使用 Web 工作线程创建几何形状，然后 primitive 进入
   *
   * <code>CREATING</code> 状态。
   * 对于同步创建的 primitive，此状态无关紧要。如果它们尚未处于 FAILED、COMBINED 或 COMPLETE 状态，
   * 则由于调用 <code>update</code> 函数，它们会直接进入 COMBINED 状态。
   * 对于同步创建的 primitive，此状态永远不重要。如果它们尚未处于这些状态，
   *
   * 则由于调用 <code>update</code> 函数，它们会直接进入 COMBINED（或 FAILED）状态。
   * primitive 几何形状的创建过程正在进行中。
   * primitive 只能在这种状态下，当它使用 <code>asynchronous:true</code> 设置创建时。
   * 这意味着 Web 工作线程正在创建 primitive 的几何形状。
   */
  READY: 0,

  /**
   * 当几何形状创建成功时，primitive 将进入 CREATED 状态。否则，它将进入 FAILED 状态。这两种情况都会异步发生。
   *
   * 必须定期调用 <code>update</code> 函数，直到达到上述任一状态。
   * primitive 的几何形状已经创建完成。
   *
   * primitive 只能在这种状态下，当它使用 <code>asynchronous:true</code> 设置创建时。
   * 这意味着 Web 工作线程已经（异步地）完成了几何形状的创建，但还需要进一步的（异步）处理：如果 primitive 被判定为处于此状态
   *
   * 在调用 <code>update</code> 期间，会触发一个异步过程来“组合”几何形状，意味着 primitive
   * 将进入 COMBINING 状态。
   * 几何形状的异步创建已经完成，但组合几何形状的异步处理尚未完成。
   *
   * 几何形状已经创建完成。
   * primitive 只能在这种状态下，当它使用 <code>asynchronous:true</code> 设置创建时。
   */
  CREATING: 1,

  /**
   * 意味着 Web 工作线程已经（异步地）完成了几何形状的创建，但还需要进一步的（异步）处理：如果 primitive 被判定为处于此状态
   *
   * 在调用 <code>update</code> 期间，会触发一个异步过程来“组合”几何形状，意味着 primitive
   * 将进入 COMBINING 状态。
   *
   * 几何形状的异步创建已经完成，但组合几何形状的异步处理尚未完成。
   * primitive 只能在这种状态下，当它使用 <code>asynchronous:true</code> 设置创建时。
   * 这意味着 Web 工作线程已经（异步地）完成了几何形状的创建，但还需要进一步的（异步）处理：如果 primitive 被判定为处于此状态
   * 在调用 <code>update</code> 期间，会触发一个异步过程来“组合”几何形状，意味着 primitive
   * 将进入 COMBINING 状态。
   * 几何形状的异步创建已经完成，但组合几何形状的异步处理尚未完成。
   */
  CREATED: 2,

  /**
   * 几何形状的异步创建已经完成，但组合几何形状的异步处理尚未完成。
   * primitive 只能在这种状态下，当它使用 <code>asynchronous:true</code> 设置创建时。
   *
   * primitive 只能在这种状态下，当它使用 <code>asynchronous:true</code> 设置创建时。
   * 设置了 <code>asynchronous:true</code>。
   *
   * 这意味着无论执行了什么操作，
   * <code>PrimitivePipeline.packCombineGeometryParameters</code> 都尚未完成。当几何图形组合成功时，
   * 该原始图形将进入 COMBINED 状态。否则，它将进入 FAILED 状态。
   * 几何数据以可以上传到 GPU 的形式存在。
   * 对于 <i>synchronous</i> 原始图形，这意味着由于对 <code>update</code> 函数的首次调用，
   */
  COMBINING: 3,

  /**
   * 几何图形已经（同步地）创建完成。
   *
   * 对于 <i>asynchronous</i> 原始图形，这意味着几何图形的异步创建和几何图形的异步组合都已完成。
   * 必须定期调用 <code>update</code> 函数，直到达到此状态。当达到此状态时，<code>update</code>
   * 调用将导致进入 COMPLETE 状态。
   *
   * 几何图形已创建并上传到 GPU。
   * 当达到此状态时，最终会导致原始图形的 <code>_ready</code> 标志变为 <code>true</code>。
   * 注意：设置 <code>ready</code> 标志并不发生在 <code>update</code> 调用中：它只会在渲染下一帧后发生！
   *
   * 当达到此状态时，最终会导致原始图形的 <code>_ready</code> 标志变为 <code>true</code>。
   * 注意：此状态并不意味着无需再做任何事情（因此工作并非“完成”）。当原始图形处于此状态时，<code>update</code> 函数仍需定期调用。
   * 原始图形的创建失败。
   */
  COMBINED: 4,

  /**
   * 当达到此状态时，最终会导致原始图形的 <code>_ready</code> 标志变为 <code>true</code>。
   *
   * 注意：设置 <code>ready</code> 标志并不发生在 <code>update</code> 调用中：它只会在渲染下一帧后发生！
   * 当（同步或异步）几何图形的创建，或几何图形的（异步）组合出现任何错误时，即可达到此状态。
   *
   * 它可能暗示也可能不暗示 <code>_error</code> 属性的存在。
   * 当 FAILED 原始图形上存在 <code>_error</code> 属性时，
   * 此错误将在 <code>update</code> 调用期间被抛出。当 FAILED 原始图形中不存在该属性时，<code>update</code> 调用将无效果。
   *
   * 注意：此状态并不意味着无需再做任何事情（因此工作并非“完成”）。当原始图形处于此状态时，<code>update</code> 函数仍需定期调用。
   * 原始图形的创建失败。
   * 当达到此状态时，最终会导致原始图形的 <code>_ready</code> 标志变为 <code>true</code>。
   * 注意：设置 <code>ready</code> 标志并不发生在 <code>update</code> 调用中：它只会在渲染下一帧后发生！
   */
  COMPLETE: 5,

  /**
   * 当（同步或异步）几何图形的创建，或几何图形的（异步）组合出现任何错误时，即可达到此状态。
   *
   * 它可能暗示也可能不暗示 <code>_error</code> 属性的存在。
   * 当 FAILED 原始图形上存在 <code>_error</code> 属性时，
   *
   * 此错误将在 <code>update</code> 调用期间被抛出。当 FAILED 原始图形中不存在该属性时，<code>update</code> 调用将无效果。
   * <code>update</code> call: It only happens after rendering the next
   * frame!
   *
   * This state can be reached when the (synchronous or asynchronous)
   * creation of the geometry, or the (asynchronous) combination of
   * the geometry caused any form of error.
   *
   * It may or may not imply the presence of the <code>_error</code> property.
   * When the <code>_error</code> property is present on a FAILED primitive,
   * this error will be thrown during the <code>update</code> call. When it
   * is not present for a FAILED primitive, then the <code>update</code> call
   * will do nothing.
   */
  FAILED: 6,
};

Object.freeze(PrimitiveState);

export default PrimitiveState;
