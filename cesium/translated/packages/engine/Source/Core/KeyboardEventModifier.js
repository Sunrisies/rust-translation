// @ts-check

/**
 * 这种枚举类型用于表示键盘修饰键。这些按键
 * 是除其他事件类型之外被持续按下的键。
 *
 * @enum {number}
 */
const KeyboardEventModifier = {
  /**
   * 表示被持续按下的 Shift 键。
   *
   * @type {number}
   * @constant
   */
  SHIFT: 0,

  /**
   * 表示被持续按下的 Control 键。
   *
   * @type {number}
   * @constant
   */
  CTRL: 1,

  /**
   * 表示被持续按下的 Alt 键。
   *
   * @type {number}
   * @constant
   */
  ALT: 2,
};

Object.freeze(KeyboardEventModifier);

export default KeyboardEventModifier;
