import { Check } from "@cesium/core";

/**
 * @typedef {object} Spdcf.ConstructorOptions
 *
 * Spdcf 构造器的初始化选项
 *
 * @property {number} A 因子 A，范围为 (0, 1]
 * @property {number} alpha Alpha 值，范围在 [0, 1]
 * @property {number} beta Beta 值，范围在 [0, 10]
 * @property {number} T tau 值，范围在 (0, +inf)
 */

/**
 * 严格正定相关函数的变量。
 *
 * 这反映了 `spdcf` 的定义。
 * {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local} glTF 扩展。
 * 此类实例作为参数存储在
 * `CorrelationGroup` 中。
 *
 * 参数 (A, alpha, beta, T) 描述了随着时间差 delta_t 的变化而减少的相关性：
 * spdcf(delta_t) = A_t * (alpha_t + ((1 - alpha_t)(1 + beta_t)) / (beta_t + e^(delta_t/T_t)))
 * ```
 * spdcf(delta_t) = A_t * (alpha_t + ((1 - alpha_t)(1 + beta_t)) / (beta_t + e^(delta_t/T_t)))
 * ```
 *
 * @constructor
 * @param {Spdcf.ConstructorOptions} options 描述初始化选项的对象
 * @experimental This 目前尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
 */
function Spdcf(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThan("options.A", options.A, 0.0);
  Check.typeOf.number.lessThanOrEquals("options.A", options.A, 1.0);
  Check.typeOf.number.greaterThanOrEquals("options.alpha", options.alpha, 0.0);
  Check.typeOf.number.lessThan("options.alpha", options.alpha, 1.0);
  Check.typeOf.number.greaterThanOrEquals("options.beta", options.beta, 0.0);
  Check.typeOf.number.lessThanOrEquals("options.beta", options.beta, 10.0);
  Check.typeOf.number.greaterThan("options.T", options.T, 0.0);
  //>>includeEnd('debug');

  this._A = options.A;
  this._alpha = options.alpha;
  this._beta = options.beta;
  this._T = options.T;
}

Object.defineProperties(Spdcf.prototype, {
  /**
   * In (0, 1]
   *
   * @memberof Spdcf.prototype
   * @type {number}
   * @readonly
   */
  A: {
    get: function () {
      return this._A;
    },
  },

  /**
   * In [0, 1)
   *
   * @memberof Spdcf.prototype
   * @type {number}
   * @readonly
   */
  alpha: {
    get: function () {
      return this._alpha;
    },
  },

  /**
   * In [0, 10]
   *
   * @memberof Spdcf.prototype
   * @type {number}
   * @readonly
   */
  beta: {
    get: function () {
      return this._beta;
    },
  },

  /**
   * 范围在 (0, +inf)
   *
   * @memberof Spdcf.prototype
   * @type {number}
   * @readonly
   */
  T: {
    get: function () {
      return this._T;
    },
  },
});

export default Spdcf;
