import { Frozen } from "@cesium/core";

/**
 * 表示在系统生命周期中的特定时刻，来自 {@link ParticleSystem} 的 {@link Particle}s 爆发。
 *
 * @alias ParticleBurst
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {number} [options.time=0.0] 爆发发生时的时间，即粒子系统生命周期开始后的秒数。
 * @param {number} [options.minimum=0.0] 爆发中发射的粒子最小数量。
 * @param {number} [options.maximum=50.0] 爆发中发射的粒子最大数量。
 */
function ParticleBurst(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 爆发发生时的时间，即粒子系统生命周期开始后的秒数。
   * @type {number}
   * @default 0.0
   */
  this.time = options.time ?? 0.0;
  /**
   * 发射的粒子最小数量。
   * @type {number}
   * @default 0.0
   */
  this.minimum = options.minimum ?? 0.0;
  /**
   * 发射的粒子最大数量。
   * @type {number}
   * @default 50.0
   */
  this.maximum = options.maximum ?? 50.0;

  this._complete = false;
}

Object.defineProperties(ParticleBurst.prototype, {
  /**
   * 如果爆发已完成，则输出 <code>true</code>；否则输出 <code>false</code>。
   * @memberof ParticleBurst.prototype
   * @type {boolean}
   */
  complete: {
    get: function () {
      return this._complete;
    },
  },
});
export default ParticleBurst;
