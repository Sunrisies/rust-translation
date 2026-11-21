import { Cartesian3, Check, Math as CesiumMath } from "@cesium/core";

/**
 * 一个在球体内发射粒子的粒子发射器。
 * 粒子会随机分布在球体内，并具有从球心发出的初始速度。
 *
 * @alias SphereEmitter
 * @constructor
 *
 * @param {number} [radius=1.0] 球的半径，单位：米。
 */
function SphereEmitter(radius) {
  radius = radius ?? 1.0;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThan("radius", radius, 0.0);
  //>>includeEnd('debug');

  this._radius = radius ?? 1.0;
}

Object.defineProperties(SphereEmitter.prototype, {
  /**
   * 球的半径，单位：米。
   * @memberof SphereEmitter.prototype
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
 * 通过设置粒子的位置和速度来初始化给定的 {Particle}。
 *
 * @private
 * @param {Particle} particle 要初始化的粒子
 */
SphereEmitter.prototype.emit = function (particle) {
  const theta = CesiumMath.randomBetween(0.0, CesiumMath.TWO_PI);
  const phi = CesiumMath.randomBetween(0.0, CesiumMath.PI);
  const rad = CesiumMath.randomBetween(0.0, this._radius);

  const x = rad * Math.cos(theta) * Math.sin(phi);
  const y = rad * Math.sin(theta) * Math.sin(phi);
  const z = rad * Math.cos(phi);

  particle.position = Cartesian3.fromElements(x, y, z, particle.position);
  particle.velocity = Cartesian3.normalize(
    particle.position,
    particle.velocity,
  );
};
export default SphereEmitter;
