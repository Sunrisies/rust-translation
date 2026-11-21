// @ts-check

// Note, these values map directly to ion asset ids.

/**
 * {@link createWorldImagery} 提供的影像类型。
 *
 * @enum {number}
 */
const IonWorldImageryStyle = {
  /**
   * 航空影像。
   *
   * @type {number}
   * @constant
   */
  AERIAL: 2,

  /**
   * 带有道路覆盖层的航空影像。
   *
   * @type {number}
   * @constant
   */
  AERIAL_WITH_LABELS: 3,

  /**
   * 没有额外影像的道路。
   *
   * @type {number}
   * @constant
   */
  ROAD: 4,
};

Object.freeze(IonWorldImageryStyle);

export default IonWorldImageryStyle;
