/**
 * 指定添加到 {@link CloudCollection} 中的云类型，该类型在 {@link CloudCollection#add} 中被调用。
 *
 * @enum {number}
 */

const CloudType = {
  /**
   * 卷云。
   *
   * @type {number}
   * @constant
   */
  CUMULUS: 0,
};

/**
 * 验证提供的云类型是否为有效的 {@link CloudType}。
 *
 * @param {CloudType} cloudType 需要验证的云类型。
 * @returns {boolean} <code>true</code> 如果提供的云类型是有效值，则返回 true；否则返回 <code>false</code>。
 *
 * @example
 * 如果 (!Cesium.CloudType.validate(cloudType)) {
 * 抛出 Cesium.DeveloperError 异常，提示云类型必须是有效值。
 * }
 */

CloudType.validate = function (cloudType) {
  return cloudType === CloudType.CUMULUS;
};

Object.freeze(CloudType);

export default CloudType;
