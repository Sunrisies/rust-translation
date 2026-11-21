// @ts-check

/**
 * 相对于对象的水平位置，例如 {@link Billboard}。
 * 或 {@link Label}。例如，将水平原点设置为<code>LEFT</code>
 * 或<code>RIGHT</code>则会在屏幕空间中的左侧或右侧显示广告牌。
 * 即锚点位置的水平中心。
 * <br /><br />
 * <div align='center'>
 * <img src='Images/Billboard.setHorizontalOrigin.png' width='648' height='196' /><br />
 * </div>
 *
 * @enum {number}
 *
 * @see Billboard#horizontalOrigin
 * @see Label#horizontalOrigin
 */
const HorizontalOrigin = {
  /**
   * 原点位于对象的水平中心。
   *
   * @type {number}
   * @constant
   */
  CENTER: 0,

  /**
   * 原点位于对象的左侧。
   *
   * @type {number}
   * @constant
   */
  LEFT: 1,

  /**
   * 原点位于对象的右侧。
   *
   * @type {number}
   * @constant
   */
  RIGHT: -1,
};

Object.freeze(HorizontalOrigin);

export default HorizontalOrigin;
