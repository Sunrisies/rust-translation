// @ts-check

/**
 * 可通过 Cesium ion 使用的底层地理编码服务。
 *
 * @enum {string}
 */
const IonGeocodeProviderType = {
  /**
   * Google 地理编码器，用于 Google 数据。
   *
   * @type {string}
   * @constant
   */
  GOOGLE: "GOOGLE",

  /**
   * Bing 地理编码器，用于 Bing 数据。
   *
   * @type {string}
   * @constant
   */
  BING: "BING",

  /**
   * 使用服务器上设置的默认地理编码器。当既不使用 Bing 数据也不使用
   * Google 数据时，将使用此方式。
   *
   * @type {string}
   * @constant
   */
  DEFAULT: "DEFAULT",
};

Object.freeze(IonGeocodeProviderType);

export default IonGeocodeProviderType;
