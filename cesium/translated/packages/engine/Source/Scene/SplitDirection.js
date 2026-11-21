// @ts-check

/**
 * 显示原始实体或影像图层相对于 {@link Scene#splitPosition} 的方向。
 *
 * @enum {number}
 *
 * @see ImageryLayer#splitDirection
 * @see Cesium3DTileset#splitDirection
 */
const SplitDirection = {
  /**
   * 将原始实体或影像图层显示在 {@link Scene#splitPosition} 的左侧。
   *
   * @type {number}
   * @constant
   */
  LEFT: -1.0,

  /**
   * 始终显示原始实体或影像图层。
   *
   * @type {number}
   * @constant
   */
  NONE: 0.0,

  /**
   * 将原始实体或影像图层显示在 {@link Scene#splitPosition} 的右侧。
   *
   * @type {number}
   * @constant
   */
  RIGHT: 1.0,
};

Object.freeze(SplitDirection);

export default SplitDirection;
