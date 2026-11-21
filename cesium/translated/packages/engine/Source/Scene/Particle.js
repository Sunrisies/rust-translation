import { Cartesian2, Cartesian3, Color, Frozen, defined } from "@cesium/core";

const defaultSize = new Cartesian2(1.0, 1.0);

/**
 * 由 {@link ParticleSystem} 发射的粒子。
 *
 * @alias Particle
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {number} [options.mass=1.0] 粒子的质量，单位：千克。
 * @param {Cartesian3} [options.position=Cartesian3.ZERO] 粒子在世界坐标中的初始位置。
 * @param {Cartesian3} [options.velocity=Cartesian3.ZERO] 粒子在世界坐标中的速度向量。
 * @param {number} [options.life=Number.MAX_VALUE] 粒子在秒内的寿命。
 * @param {object} [options.image] 用于广告牌的 URI、HTMLImageElement 或 HTMLCanvasElement。
 * @param {Color} [options.startColor=Color.WHITE] 粒子诞生时的颜色。
 * @param {Color} [options.endColor=Color.WHITE] 粒子死亡时的颜色。
 * @param {number} [options.startScale=1.0] 粒子诞生时的比例。
 * @param {number} [options.endScale=1.0] 粒子死亡时的比例。
 * @param {Cartesian2} [options.imageSize=new Cartesian2(1.0, 1.0)] 将粒子图像按像素缩放的尺寸，即宽度和高度。
 */
function Particle(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 粒子的质量，单位：千克。
   * @type {number}
   * @default 1.0
   */
  this.mass = options.mass ?? 1.0;
  /**
   * 粒子在世界坐标中的位置。
   * @type {Cartesian3}
   * @default Cartesian3.ZERO
   */
  this.position = Cartesian3.clone(options.position ?? Cartesian3.ZERO);
  /**
   * 粒子在世界坐标中的速度。
   * @type {Cartesian3}
   * @default Cartesian3.ZERO
   */
  this.velocity = Cartesian3.clone(options.velocity ?? Cartesian3.ZERO);
  /**
   * 粒子在秒内的寿命。
   * @type {number}
   * @default Number.MAX_VALUE
   */
  this.life = options.life ?? Number.MAX_VALUE;
  /**
   * 用于粒子的图像。
   * @type {object}
   * @default undefined
   */
  this.image = options.image;
  /**
   * 粒子诞生时的颜色。
   * @type {Color}
   * @default Color.WHITE
   */
  this.startColor = Color.clone(options.startColor ?? Color.WHITE);
  /**
   * 粒子死亡时的颜色。
   * @type {Color}
   * @default Color.WHITE
   */
  this.endColor = Color.clone(options.endColor ?? Color.WHITE);
  /**
   * 粒子诞生时的比例。
   * @type {number}
   * @default 1.0
   */
  this.startScale = options.startScale ?? 1.0;
  /**
   * 粒子死亡时的比例。
   * @type {number}
   * @default 1.0
   */
  this.endScale = options.endScale ?? 1.0;
  /**
   * 将粒子图像按像素缩放的尺寸，即宽度和高度。
   * @type {Cartesian2}
   * @default new Cartesian(1.0, 1.0)
   */
  this.imageSize = Cartesian2.clone(options.imageSize ?? defaultSize);

  this._age = 0.0;
  this._normalizedAge = 0.0;

  // used by ParticleSystem
  this._billboard = undefined;
}

Object.defineProperties(Particle.prototype, {
  /**
   * 获取粒子在秒内的年龄。
   * @memberof Particle.prototype
   * @type {number}
   */
  age: {
    get: function () {
      return this._age;
    },
  },
  /**
   * 获取归一化后的年龄值，范围在 [0.0, 1.0] 之间。
   * @memberof Particle.prototype
   * @type {number}
   */
  normalizedAge: {
    get: function () {
      return this._normalizedAge;
    },
  },
});

const deltaScratch = new Cartesian3();

/**
 * @private
 */
Particle.prototype.update = function (dt, particleUpdateFunction) {
  // Apply the velocity
  Cartesian3.multiplyByScalar(this.velocity, dt, deltaScratch);
  Cartesian3.add(this.position, deltaScratch, this.position);

  // Update any forces.
  if (defined(particleUpdateFunction)) {
    particleUpdateFunction(this, dt);
  }

  // Age the particle
  this._age += dt;

  // Compute the normalized age.
  if (this.life === Number.MAX_VALUE) {
    this._normalizedAge = 0.0;
  } else {
    this._normalizedAge = this._age / this.life;
  }

  // If this particle is older than it's lifespan then die.
  return this._age <= this.life;
};
export default Particle;
