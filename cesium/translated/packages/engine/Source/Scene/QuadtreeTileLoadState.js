// @ts-check

/**
 * 在瓦片加载流程中 {@link QuadtreeTile} 的状态。
 * @enum {number}
 * @private
 */
const QuadtreeTileLoadState = {
  /**
   * 该瓦片为新状态，加载尚未开始。
   * @type QuadtreeTileLoadState
   * @constant
   * @default 0
   */
  START: 0,

  /**
   * 加载正在进行中。
   * @type QuadtreeTileLoadState
   * @constant
   * @default 1
   */
  LOADING: 1,

  /**
   * 加载已完成。
   * @type QuadtreeTileLoadState
   * @constant
   * @default 2
   */
  DONE: 2,

  /**
   * 瓦片加载失败。
   * @type QuadtreeTileLoadState
   * @constant
   * @default 3
   */
  FAILED: 3,
};

Object.freeze(QuadtreeTileLoadState);

export default QuadtreeTileLoadState;
