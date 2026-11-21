/**
 * 指定在阴影功能开启时，该实体是否投射或接收光线阴影。
 * 阴影功能已启用。
 *
 * @enum {number}
 */
const ShadowMode = {
  /**
   * 该实体既不投射也不接收阴影。
   *
   * @type {number}
   * @constant
   */
  DISABLED: 0,

  /**
   * 该实体既投射又接收阴影。
   *
   * @type {number}
   * @constant
   */
  ENABLED: 1,

  /**
   * 该实体仅投射阴影。
   *
   * @type {number}
   * @constant
   */
  CAST_ONLY: 2,

  /**
   * 该实体仅接收阴影。
   *
   * @type {number}
   * @constant
   */
  RECEIVE_ONLY: 3,
};

/**
 * @private
 */
ShadowMode.NUMBER_OF_SHADOW_MODES = 4;

/**
 * 确定阴影模式是否投射阴影。
 *
 * @param {ShadowMode} shadowMode 阴影模式。
 * @returns {boolean} <code>true</code> 如果阴影模式投射阴影，则为真；否则为 <code>false</code>。
 *
 * @private
 */
ShadowMode.castShadows = function (shadowMode) {
  return (
    shadowMode === ShadowMode.ENABLED || shadowMode === ShadowMode.CAST_ONLY
  );
};

/**
 * 确定阴影模式是否接收阴影。
 *
 * @param {ShadowMode} shadowMode 阴影模式。
 * @returns {boolean} <code>true</code> 如果阴影模式接收阴影，则为真；否则为 <code>false</code>。
 *
 * @private
 */
ShadowMode.receiveShadows = function (shadowMode) {
  return (
    shadowMode === ShadowMode.ENABLED || shadowMode === ShadowMode.RECEIVE_ONLY
  );
};

/**
 * 获取与阴影的投射和接收情况相对应的阴影模式。
 *
 * @param {boolean} castShadows 是否投射阴影。
 * @param {boolean} receiveShadows 是否接收阴影。
 * @returns {ShadowMode} The 按照指定规则投射和接收阴影的阴影模式。
 *
 * @private
 */
ShadowMode.fromCastReceive = function (castShadows, receiveShadows) {
  if (castShadows && receiveShadows) {
    return ShadowMode.ENABLED;
  } else if (castShadows) {
    return ShadowMode.CAST_ONLY;
  } else if (receiveShadows) {
    return ShadowMode.RECEIVE_ONLY;
  }
  return ShadowMode.DISABLED;
};

Object.freeze(ShadowMode);

export default ShadowMode;
