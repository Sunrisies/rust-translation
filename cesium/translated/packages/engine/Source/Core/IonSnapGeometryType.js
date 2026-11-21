/**
 * 由 {@link IonSnapService#snap} 报告的几何类型，该类型是 snap 所确定的结果。
 * 作为 {@link IonSnapService.Result} 的 <code>geometryType</code> 值。这些值与 iTwin.js 中的值一致。
 * {@link https://www.itwinjs.org/reference/core-frontend/locatingelements/hitgeomtype/|HitGeomType} enum。
 *
 * @experimental This 该特性尚未最终确定，可能会根据 Cesium 的标准弃用政策进行变更。
 *
 * @enum {number}
 */
const IonSnapGeometryType = {
  /**
   * 没有几何类型。
   * @type {number}
   * @constant
   */
  NONE: 0,
  /**
   * 一个点。
   * @type {number}
   * @constant
   */
  POINT: 1,
  /**
   * 一条线段。
   * @type {number}
   * @constant
   */
  SEGMENT: 2,
  /**
   * 一条曲线。
   * @type {number}
   * @constant
   */
  CURVE: 3,
  /**
   * 一个圆弧。
   * @type {number}
   * @constant
   */
  ARC: 4,
  /**
   * 一个表面。
   * <p>
   * 当使用 {@link IonSnapMode} <code>NEAREST</code> 时，此值表示
   * snap 跟踪了光标下方的表面，因为没有边缘位于
   * snap 范围内。这意味着 snap 点没有被拉到边缘上。
   * 边缘 snap 会在
   * {@link IonSnapService.Result} <code>curve</code> 中报告其他类型的信息，而在跟踪表面时则不会显示该信息。
   * tracking a surface.
   * </p>
   * @type {number}
   * @constant
   */
  SURFACE: 5,
};

Object.freeze(IonSnapGeometryType);

export default IonSnapGeometryType;
