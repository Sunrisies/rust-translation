import { Check } from "@cesium/core";

/**
 * @typedef {object} PpeMetadata.ConstructorOptions
 *
 * PpeMetadata 构造器的初始化选项
 *
 * @property {PpeSource} source 错误数据的来源
 * @property {number|undefined} [min] 该属性的最小允许值
 * @property {number|undefined} [max] 该属性的最大允许值
 */

/**
 * 与存储的 PPE（每点误差）数据相关的元数据
 *
 * 这反映了 `ppeMetadata` 定义
 * {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local} glTF 扩展
 *
 * @constructor
 * @param {PpeMetadata.ConstructorOptions} options 描述初始化选项的对象
 *
 * @private
 */
function PpeMetadata(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.source", options.source);
  //>>includeEnd('debug');

  this._min = options.min;
  this._max = options.max;
  this._source = options.source;
}

Object.defineProperties(PpeMetadata.prototype, {
  /**
   * 该属性的最小允许值。这是所有值中的最小值
   * 在应用了偏移和缩放属性后的结果
   * 之后的值
   *
   * @memberof PpeMetadata.prototype
   * @type {number|undefined}
   * @readonly
   */
  min: {
    get: function () {
      return this._min;
    },
  },

  /**
   * 该属性的最大允许值。这是所有值中的最大值
   * 在应用了偏移和缩放属性后的结果
   * 之后的值
   *
   * @memberof PpeMetadata.prototype
   * @type {number|undefined}
   * @readonly
   */
  max: {
    get: function () {
      return this._max;
    },
  },

  /**
   * 可能的错误来源内容
   *
   * @memberof PpeMetadata.prototype
   * @type {PpeSource}
   * @readonly
   */
  source: {
    get: function () {
      return this._source;
    },
  },
});

export default PpeMetadata;
