import { Cartesian3, Check, Math as CesiumMath } from "@cesium/core";

/**
 * 一个从圆形区域发射粒子的粒子发射器。
 * 粒子将位于圆形区域内，并具有沿 z 轴方向的初始速度。
 *
 * @alias CircleEmitter
 * @constructor
 *
 * @param {number} [radius=1.0] 圆形的半径，单位：米。
 */
function CircleEmitter(radius) {
  radius = radius ?? 1.0;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThan("radius", radius, 0.0);
  //>>includeEnd('debug');

  this._radius = radius ?? 1.0;
}

Object.defineProperties(CircleEmitter.prototype, {
  /**
   * 圆形的半径，单位：米。
   * @memberof CircleEmitter.prototype
   * @type {number}
   * @default 1.0
   */
  radius: {
    get: function () {
      return this._radius;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThan("value", value, 0.0);
      //>>includeEnd('debug');
      this._radius = value;
    },
  },
});

/**
 * 通过设置粒子的位置和速度来初始化给定的 {@link Particle}。
 *
 * @private
 * @param {Particle} particle 要初始化的粒子。
 */
CircleEmitter.prototype.emit = function (particle) {
  const theta = CesiumMath.randomBetween(0.0, CesiumMath.TWO_PI);
  const rad = CesiumMath.randomBetween(0.0, this._radius);

  const x = rad * Math.cos(theta);
  const y = rad * Math.sin(theta);
  const z = 0.0;

  particle.position = Cartesian3.fromElements(x, y, z, particle.position);
  particle.velocity = Cartesian3.clone(Cartesian3.UNIT_Z, particle.velocity);
};
export default CircleEmitter;
