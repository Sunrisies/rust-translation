// @ts-check

/**
 * 列出可用于与相机交互的输入选项。
 *
 * @enum {number}
 */
const CameraEventType = {
  /**
   * 按下左鼠标按钮，随后移动鼠标并释放按钮。
   *
   * @type {number}
   * @constant
   */
  LEFT_DRAG: 0,

  /**
   * 按下右鼠标按钮，随后移动鼠标并释放按钮。
   *
   * @type {number}
   * @constant
   */
  RIGHT_DRAG: 1,

  /**
   * 按下中鼠标按钮，随后移动鼠标并释放按钮。
   *
   * @type {number}
   * @constant
   */
  MIDDLE_DRAG: 2,

  /**
   * 使用中鼠标按钮滚动。
   *
   * @type {number}
   * @constant
   */
  WHEEL: 3,

  /**
   * 在触摸面上用双指触摸。
   *
   * @type {number}
   * @constant
   */
  PINCH: 4,
};

Object.freeze(CameraEventType);

export default CameraEventType;
