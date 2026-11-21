/**
 * 大气照明效果（天空氛围、地面氛围、雾效）可以通过
 * 来自太阳或其他光源的动态照明进一步调整
 * 这些效果会随时间变化。此枚举决定了使用哪种光源。
 *
 * @enum {number}
 */
const DynamicAtmosphereLightingType = {
  /**
   * 不要使用动态大气照明。大气照明效果将
   * 从正上方照明，而不是使用场景中的光源。
   *
   * @type {number}
   * @constant
   */
  NONE: 0,
  /**
   * 使用场景当前的光源进行动态大气照明。
   *
   * @type {number}
   * @constant
   */
  SCENE_LIGHT: 1,
  /**
   * 强制动态大气照明始终使用阳光方向，
   * 即使场景使用不同的光源也是如此。
   *
   * @type {number}
   * @constant
   */
  SUNLIGHT: 2,
};

/**
 * 从旧的地球标志中获取照明枚举值
 *
 * @param {Globe} globe 地球
 * @return {DynamicAtmosphereLightingType} The 对应的枚举值
 *
 * @private
 */
DynamicAtmosphereLightingType.fromGlobeFlags = function (globe) {
  const lightingOn = globe.enableLighting && globe.dynamicAtmosphereLighting;
  if (!lightingOn) {
    return DynamicAtmosphereLightingType.NONE;
  }

  // Force sunlight
  if (globe.dynamicAtmosphereLightingFromSun) {
    return DynamicAtmosphereLightingType.SUNLIGHT;
  }

  return DynamicAtmosphereLightingType.SCENE_LIGHT;
};

Object.freeze(DynamicAtmosphereLightingType);

export default DynamicAtmosphereLightingType;
