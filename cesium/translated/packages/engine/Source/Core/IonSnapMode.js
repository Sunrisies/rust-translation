/**
 * 支持 {@link IonSnapService#snap} 的吸附模式。这些模式遵循
 * MicroStation 的吸附模式语义；详见
 * {@link https://docs.bentley.com/LiveContent/web/MicroStation%20Help-v27/en/GUID-77D54C0B-D6FF-13DA-5EC8-3196330F5244.html|MicroStation documentation}
 * 作为参考。
 *
 * @experimental This 该功能尚未定稿，可能根据 Cesium 的标准弃用政策进行更改。
 *
 * @enum {number}
 */
const IonSnapMode = {
  /**
   * 吸附到光标最近的实体上的点。当光标
   * 距离边缘的吸附范围之外时，则吸附到光标下方的表面。
   * instead。
   * @type {number}
   * @constant
   */
  NEAREST: 1,
  /**
   * 吸附到实体最近的关键点。关键点由
   * 实体的几何类型和吸附除数定义。
   * <p>
   * 在线性实体上，关键点沿每个线段规则分布：
   * 线段上的关键点数量比吸附
   * 除数多一个，且当除数为偶数时，线段的中点也是关键点。Ion API 目前不接受吸附除数，因此
   * even. The ion API does not currently accept a snap divisor, so the
   * 使用服务器的默认除数。
   * </p>
   * @type {number}
   * @constant
   */
  NEAREST_KEYPOINT: 2,
  /**
   * 吸附到具有中心点的实体中心（如圆形和
   * 弧线）。对于其他实体，可能吸附到质心。
   * @type {number}
   * @constant
   */
  CENTER: 8,
};

Object.freeze(IonSnapMode);

export default IonSnapMode;