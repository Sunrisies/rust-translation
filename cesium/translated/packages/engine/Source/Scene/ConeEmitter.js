import { Cartesian3, Check, Math as CesiumMath } from "@cesium/core";

const defaultAngle = CesiumMath.toRadians(30.0);

/**
 * 一个在圆锥范围内发射粒子的粒子发射器。
 * 粒子将位于圆锥的尖端，并具有朝向底部的初始速度。
 *
 * @alias ConeEmitter
 * @constructor
 *
 * @param {number} [angle=Cesium.Math.toRadians(30.0)] 圆锥的角度，以弧度为单位。
 */
function ConeEmitter(angle) {
  this._angle = angle ?? defaultAngle;
}

Object.defineProperties(ConeEmitter.prototype, {
  /**
   * 圆锥的角度，以弧度为单位。
   * @memberof ConeEmitter.prototype
   * @type {number}
   * @default Cesium.Math.toRadians(30.0)
   */
  angle: {
    get: function () {
      return this._angle;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');
      this._angle = value;
    },
  },
});

/**
 * 通过设置粒子的位置和速度来初始化该粒子。
 *
 * @private
 * @param {Particle} particle 要初始化的粒子
 */
ConeEmitter.prototype.emit = function (particle) {
  const radius = Math.tan(this._angle);

  // Compute a random point on the cone's base
  const theta = CesiumMath.randomBetween(0.0, CesiumMath.TWO_PI);
  const rad = CesiumMath.randomBetween(0.0, radius);

  const x = rad * Math.cos(theta);
  const y = rad * Math.sin(theta);
  const z = 1.0;

  particle.velocity = Cartesian3.fromElements(x, y, z, particle.velocity);
  Cartesian3.normalize(particle.velocity, particle.velocity);
  particle.position = Cartesian3.clone(Cartesian3.ZERO, particle.position);
};
export default ConeEmitter;
