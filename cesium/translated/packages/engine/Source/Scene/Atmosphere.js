import { Cartesian3, Math as CesiumMath } from "@cesium/core";
import DynamicAtmosphereLightingType from "./DynamicAtmosphereLightingType.js";

/**
 * 3D Tiles和模型用于渲染天空氛围、地面氛围和雾效的通用氛围设置。
 *
 * <p>
 * 此类不应与负责渲染天空的 {@link SkyAtmosphere} 混淆。
 * </p>
 * <p>
 * 虽然氛围设置影响雾的颜色，但请参见 {@link Fog} 以控制雾的渲染方式。
 * </p>
 *
 * @alias Atmosphere
 * @constructor
 *
 * @example
 * // 使用太阳方向开启动态氛围照明
 * scene.atmosphere.dynamicLighting = Cesium.DynamicAtmosphereLightingType.SUNLIGHT;
 *
 * @example
 * // 使用场景中的任何光源开启动态照明
 * scene.light = new Cesium.DirectionalLight({
 * direction: new Cesium.Cartesian3(1, 0, 0)
 * });
 * scene.atmosphere.dynamicLighting = Cesium.DynamicAtmosphereLightingType.SCENE_LIGHT;
 *
 * @example
 * // 调整氛围效果的颜色。
 * scene.atmosphere.hueShift = 0.4; // 在色轮上旋转 40%
 * scene.atmosphere.brightnessShift = 0.25; // 增加亮度
 * scene.atmosphere.saturationShift = -0.1; // 降低颜色饱和度
 *
 * @see SkyAtmosphere
 * @see Globe
 * @see Fog
 */
function Atmosphere() {
  /**
   * 用于计算地面氛围颜色的光照强度。
   *
   * @type {number}
   * @default 10.0
   */
  this.lightIntensity = 10.0;

  /**
   * 用于地面氛围大气散射方程的瑞利散射系数。
   *
   * @type {Cartesian3}
   * @default Cartesian3(5.5e-6, 13.0e-6, 28.4e-6)
   */
  this.rayleighCoefficient = new Cartesian3(5.5e-6, 13.0e-6, 28.4e-6);

  /**
   * 用于地面氛围大气散射方程的米氏散射系数。
   *
   * @type {Cartesian3}
   * @default Cartesian3(21e-6, 21e-6, 21e-6)
   */
  this.mieCoefficient = new Cartesian3(21e-6, 21e-6, 21e-6);

  /**
   * 地面氛围大气散射方程中的瑞利尺度高度，单位：米。
   *
   * @type {number}
   * @default 10000.0
   */
  this.rayleighScaleHeight = 10000.0;

  /**
   * 地面氛围大气散射方程中的米氏尺度高度，单位：米。
   *
   * @type {number}
   * @default 3200.0
   */
  this.mieScaleHeight = 3200.0;

  /**
   * 考虑用于米氏散射的介质各向异性。
   * <p>
   * 有效值在 -1.0 到 1.0 之间。
   * </p>
   *
   * @type {number}
   * @default 0.9
   */
  this.mieAnisotropy = 0.9;

  /**
   * 应用于氛围的色相偏移。默认值为 0.0（无偏移）。
   * 色相偏移为 1.0 表示所有可用色相完全旋转一次。
   *
   * @type {number}
   * @default 0.0
   */
  this.hueShift = 0.0;

  /**
   * 应用于氛围的饱和度偏移。默认值为 0.0（无偏移）。
   * 饱和度偏移为 -1.0 时为单色。
   *
   * @type {number}
   * @default 0.0
   */
  this.saturationShift = 0.0;

  /**
   * 应用于氛围的亮度偏移。默认值为 0.0（无偏移）。
   * 亮度偏移为 -1.0 为完全黑暗，会让空间显现出来。
   *
   * @type {number}
   * @default 0.0
   */
  this.brightnessShift = 0.0;

  /**
   * 当不是 DynamicAtmosphereLightingType.NONE 时，选中的光源将
   * 用于动态照明所有与氛围相关的渲染效果。
   *
   * @type {DynamicAtmosphereLightingType}
   * @default DynamicAtmosphereLightingType.NONE
   */
  this.dynamicLighting = DynamicAtmosphereLightingType.NONE;
}

/**
 * 如果氛围着色器需要颜色校正步骤，则返回 <code>true</code>。
 * @param {Atmosphere} atmosphere 要检查的氛围实例
 * @returns {boolean} true 如果大气着色器需要颜色校正步骤
 */
Atmosphere.requiresColorCorrect = function (atmosphere) {
  return !(
    CesiumMath.equalsEpsilon(atmosphere.hueShift, 0.0, CesiumMath.EPSILON7) &&
    CesiumMath.equalsEpsilon(
      atmosphere.saturationShift,
      0.0,
      CesiumMath.EPSILON7,
    ) &&
    CesiumMath.equalsEpsilon(
      atmosphere.brightnessShift,
      0.0,
      CesiumMath.EPSILON7,
    )
  );
};

export default Atmosphere;
