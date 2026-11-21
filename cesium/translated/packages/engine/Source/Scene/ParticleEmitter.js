import { DeveloperError } from "@cesium/core";

/**
 * <p>
 * 一个从 {@link ParticleSystem} 初始化 {@link Particle} 的对象。
 * </p>
 * <p>
 * 这种类型描述了一个接口，不用于直接实例化。
 * </p>
 *
 * @alias ParticleEmitter
 * @constructor
 *
 * @see BoxEmitter
 * @see CircleEmitter
 * @see ConeEmitter
 * @see SphereEmitter
 */
function ParticleEmitter(options) {
  //>>includeStart('debug', pragmas.debug);
  throw new DeveloperError(
    "This type should not be instantiated directly.  Instead, use BoxEmitter, CircleEmitter, ConeEmitter or SphereEmitter.",
  );
  //>>includeEnd('debug');
}

/**
 * 通过设置其位置和速度来初始化给定的 {Particle}。
 *
 * @private
 * @param {Particle} The 要初始化的粒子
 */
ParticleEmitter.prototype.emit = function (particle) {
  DeveloperError.throwInstantiationError();
};
export default ParticleEmitter;
