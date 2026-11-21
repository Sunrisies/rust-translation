// @ts-check

/**
 * 由 {@link GeocoderService} 执行的地理编码类型。
 * @enum {number}
 * @see Geocoder
 */
const GeocodeType = {
  /**
   * 执行搜索操作，此时输入被视为完整。
   *
   * @type {number}
   * @constant
   */
  SEARCH: 0,

  /**
   * 使用部分输入进行自动补全，通常
   * 用于在用户输入时显示可能的结果。
   *
   * @type {number}
   * @constant
   */
  AUTOCOMPLETE: 1,
};

Object.freeze(GeocodeType);

export default GeocodeType;
