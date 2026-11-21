/**
 * 由 {@link Visualizer} 正在执行 BoundingSphere 的计算状态。
 * @enum {number}
 * @internal
 */
const BoundingSphereState = {
  /**
   * BoundingSphere 已计算完成。
   * @type BoundingSphereState
   * @constant
   * @private
   */
  DONE: 0,
  /**
   * BoundingSphere 仍在计算中。
   * @type BoundingSphereState
   * @constant
   * @private
   */
  PENDING: 1,
  /**
   * BoundingSphere 不存在。
   * @type BoundingSphereState
   * @constant
   * @internal
   */
  FAILED: 2,
};

Object.freeze(BoundingSphereState);

export default BoundingSphereState;
