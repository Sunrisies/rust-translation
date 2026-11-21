/**
 * 由 {@link IonSnapService#snap} 报告的吸附结果与光标的距离。
 * 作为 {@link IonSnapService.Result} <code>heat</code> 的值。数值与 iTwin.js 中的值一致。
 * {@link https://www.itwinjs.org/reference/core-frontend/locatingelements/snapheat/|SnapHeat} enum。
 *
 * @experimental This 该功能尚未最终确定，可能根据 Cesium 的标准弃用政策进行变更。
 *
 * @enum {number}
 */
const IonSnapHeat = {
  /**
   * 吸附结果与光标距离较远。
   * @type {number}
   * @constant
   */
  NONE: 0,
  /**
   * 吸附点值得关注，但位于吸附范围之外。
   * @type {number}
   * @constant
   */
  NOT_IN_RANGE: 1,
  /**
   * 吸附点在视图空间中的吸附范围内。
   * @type {number}
   * @constant
   */
  IN_RANGE: 2,
};

Object.freeze(IonSnapHeat);

export default IonSnapHeat;
