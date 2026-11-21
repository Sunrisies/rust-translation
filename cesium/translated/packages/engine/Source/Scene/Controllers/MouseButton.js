// @ts-check

/**
 * 这种枚举类型用于分类鼠标按钮：左键、中键和右键。
 * @enum {number}
 */
const MouseButton = {
  /**
   * 表示鼠标左键。
   * @type {number}
   * @constant
   */
  LEFT: 0,

  /**
   * 表示鼠标中键。
   * @type {number}
   * @constant
   */
  MIDDLE: 1,

  /**
   * 表示鼠标右键。
   * @type {number}
   * @constant
   */
  RIGHT: 2,
};

Object.freeze(MouseButton);

export default MouseButton;
