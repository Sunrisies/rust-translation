// @ts-check

/**
 * 这种枚举类型用于分类鼠标事件：按下、抬起、点击、双击、移动以及按钮保持按下时的移动。
 *
 * @enum {number}
 */
const ScreenSpaceEventType = {
  /**
   * 表示鼠标左键按下的事件。
   *
   * @type {number}
   * @constant
   */
  LEFT_DOWN: 0,

  /**
   * 表示鼠标左键抬起的事件。
   *
   * @type {number}
   * @constant
   */
  LEFT_UP: 1,

  /**
   * 表示鼠标左键点击的事件。
   *
   * @type {number}
   * @constant
   */
  LEFT_CLICK: 2,

  /**
   * 表示鼠标左键双击的事件。
   *
   * @type {number}
   * @constant
   */
  LEFT_DOUBLE_CLICK: 3,

  /**
   * 表示鼠标左键按下的事件。
   *
   * @type {number}
   * @constant
   */
  RIGHT_DOWN: 5,

  /**
   * 表示鼠标右键抬起的事件。
   *
   * @type {number}
   * @constant
   */
  RIGHT_UP: 6,

  /**
   * 表示鼠标右键点击的事件。
   *
   * @type {number}
   * @constant
   */
  RIGHT_CLICK: 7,

  /**
   * 表示鼠标中间键按下的事件。
   *
   * @type {number}
   * @constant
   */
  MIDDLE_DOWN: 10,

  /**
   * 表示鼠标中间键抬起的事件。
   *
   * @type {number}
   * @constant
   */
  MIDDLE_UP: 11,

  /**
   * 表示鼠标中间键点击的事件。
   *
   * @type {number}
   * @constant
   */
  MIDDLE_CLICK: 12,

  /**
   * 表示鼠标移动的事件。
   *
   * @type {number}
   * @constant
   */
  MOUSE_MOVE: 15,

  /**
   * 表示鼠标滚轮事件。
   *
   * @type {number}
   * @constant
   */
  WHEEL: 16,

  /**
   * 表示触摸表面上双指事件的开始。
   *
   * @type {number}
   * @constant
   */
  PINCH_START: 17,

  /**
   * 表示触摸表面上双指事件的结束。
   *
   * @type {number}
   * @constant
   */
  PINCH_END: 18,

  /**
   * 表示触摸表面上双指事件的变化。
   *
   * @type {number}
   * @constant
   */
  PINCH_MOVE: 19,
};

Object.freeze(ScreenSpaceEventType);

export default ScreenSpaceEventType;
