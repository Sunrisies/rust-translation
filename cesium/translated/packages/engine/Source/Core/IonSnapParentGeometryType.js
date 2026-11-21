/**
 * 由 snap 解析出的父几何类型，通过
 * {@link IonSnapService#snap} 作为 {@link IonSnapService.Result} <code>parentGeometryType</code> 报告。
 * 数值与 iTwin.js 中的一致。
 * {@link https://www.itwinjs.org/reference/core-frontend/locatingelements/hitparentgeomtype/|HitParentGeomType} enum。
 *
 * @experimental This 该特性尚未最终确定，可能根据 Cesium 的标准弃用政策进行变更。
 *
 * @enum {number}
 */
const IonSnapParentGeometryType = {
  /**
   * 没有父几何类型。
   * @type {number}
   * @constant
   */
  NONE: 0,
  /**
   * 线体。
   * @type {number}
   * @constant
   */
  WIRE: 1,
  /**
   * 面体。
   * @type {number}
   * @constant
   */
  SHEET: 2,
  /**
   * 实体。
   * @type {number}
   * @constant
   */
  SOLID: 3,
  /**
   * 网格。
   * @type {number}
   * @constant
   */
  MESH: 4,
  /**
   * 文本。
   * @type {number}
   * @constant
   */
  TEXT: 5,
};

Object.freeze(IonSnapParentGeometryType);

export default IonSnapParentGeometryType;
