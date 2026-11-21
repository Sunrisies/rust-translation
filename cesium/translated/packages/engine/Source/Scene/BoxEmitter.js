import { Cartesian3, Check, Math as CesiumMath } from "@cesium/core";

const defaultDimensions = new Cartesian3(1.0, 1.0, 1.0);

/**
 * 一个在框内发射粒子的粒子发射器。
 * 粒子会随机分布在框内，并具有从框中心发出的初始速度。
 *
 * @alias BoxEmitter
 * @constructor
 *
 * @param {Cartesian3} dimensions 框的宽度、高度和深度尺寸。
 */
function BoxEmitter(dimensions) {
  dimensions = dimensions ?? defaultDimensions;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("dimensions", dimensions);
  Check.typeOf.number.greaterThanOrEquals("dimensions.x", dimensions.x, 0.0);
  Check.typeOf.number.greaterThanOrEquals("dimensions.y", dimensions.y, 0.0);
  Check.typeOf.number.greaterThanOrEquals("dimensions.z", dimensions.z, 0.0);
  //>>includeEnd('debug');

  this._dimensions = Cartesian3.clone(dimensions);
}

Object.defineProperties(BoxEmitter.prototype, {
  /**
   * 框的宽度、高度和深度尺寸，以米为单位。
   * @memberof BoxEmitter.prototype
   * @type {Cartesian3}
   * @default new Cartesian3(1.0, 1.0, 1.0)
   */
  dimensions: {
    get: function () {
      return this._dimensions;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.defined("value", value);
      Check.typeOf.number.greaterThanOrEquals("value.x", value.x, 0.0);
      Check.typeOf.number.greaterThanOrEquals("value.y", value.y, 0.0);
      Check.typeOf.number.greaterThanOrEquals("value.z", value.z, 0.0);
      //>>includeEnd('debug');
      Cartesian3.clone(value, this._dimensions);
    },
  },
});

const scratchHalfDim = new Cartesian3();

/**
 * 通过设置粒子的位置和速度来初始化给定的{Particle}。
 *
 * @private
 * @param {Particle} particle 要初始化的粒子。
 */
BoxEmitter.prototype.emit = function (particle) {
  const dim = this._dimensions;
  const halfDim = Cartesian3.multiplyByScalar(dim, 0.5, scratchHalfDim);

  const x = CesiumMath.randomBetween(-halfDim.x, halfDim.x);
  const y = CesiumMath.randomBetween(-halfDim.y, halfDim.y);
  const z = CesiumMath.randomBetween(-halfDim.z, halfDim.z);

  particle.position = Cartesian3.fromElements(x, y, z, particle.position);
  particle.velocity = Cartesian3.normalize(
    particle.position,
    particle.velocity,
  );
};
export default BoxEmitter;
