import {
  Cartesian3,
  Ellipsoid,
  Frozen,
  Matrix3,
  Matrix4,
  defined,
  destroyObject,
} from "@cesium/core";
import buildModuleUrl from "../Core/buildModuleUrl.js";
import IauOrientationAxes from "../Core/IauOrientationAxes.js";
import Simon1994PlanetaryPositions from "../Core/Simon1994PlanetaryPositions.js";
import CelestialFrameTransforms from "../Core/CelestialFrameTransforms.js";
import EllipsoidPrimitive from "./EllipsoidPrimitive.js";
import Material from "./Material.js";

/**
 * 以 3D 形式绘制月亮。
 * @alias Moon
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.show=true] 决定月亮是否会被渲染。
 * @param {string} [options.textureUrl=buildModuleUrl('Assets/Textures/moonSmall.jpg')] 月亮纹理。
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.MOON] 月亮椭球体。
 * @param {boolean} [options.onlySunLighting=true] 使用太阳作为唯一的光源。
 *
 *
 * @example
 * scene.moon = new Cesium.Moon();
 *
 * @see Scene#moon
 */
function Moon(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  let url = options.textureUrl;
  if (!defined(url)) {
    url = buildModuleUrl("Assets/Textures/moonSmall.jpg");
  }

  /**
   * 决定月亮是否会被显示。
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  /**
   * 月亮纹理。
   * @type {string}
   * @default buildModuleUrl('Assets/Textures/moonSmall.jpg')
   */
  this.textureUrl = url;

  this._ellipsoid = options.ellipsoid ?? Ellipsoid.MOON;

  /**
   * 使用太阳作为唯一的光源。
   * @type {boolean}
   * @default true
   */
  this.onlySunLighting = options.onlySunLighting ?? true;

  this._ellipsoidPrimitive = new EllipsoidPrimitive({
    radii: this.ellipsoid.radii,
    material: Material.fromType(Material.ImageType),
    depthTestEnabled: false,
    _owner: this,
  });
  this._ellipsoidPrimitive.material.translucent = false;

  this._axes = new IauOrientationAxes();
}

Object.defineProperties(Moon.prototype, {
  /**
   * 获取定义月亮形状的椭球体。
   *
   * @memberof Moon.prototype
   *
   * @type {Ellipsoid}
   * @readonly
   *
   * @default {@link Ellipsoid.MOON}
   */
  ellipsoid: {
    get: function () {
      return this._ellipsoid;
    },
  },
});

const icrfToFixed = new Matrix3();
const rotationScratch = new Matrix3();
const translationScratch = new Cartesian3();
const scratchCommandList = [];

/**
 * @private
 */
Moon.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  const ellipsoidPrimitive = this._ellipsoidPrimitive;
  ellipsoidPrimitive.material.uniforms.image = this.textureUrl;
  ellipsoidPrimitive.onlySunLighting = this.onlySunLighting;

  const date = frameState.time;
  if (
    !defined(
      CelestialFrameTransforms.computeIcrfToFixedMatrix(date, icrfToFixed),
    )
  ) {
    CelestialFrameTransforms.computeTemeToPseudoFixedMatrix(date, icrfToFixed);
  }

  const rotation = this._axes.evaluate(date, rotationScratch);
  Matrix3.transpose(rotation, rotation);
  Matrix3.multiply(icrfToFixed, rotation, rotation);

  const translation =
    Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(
      date,
      translationScratch,
    );
  Matrix3.multiplyByVector(icrfToFixed, translation, translation);

  Matrix4.fromRotationTranslation(
    rotation,
    translation,
    ellipsoidPrimitive.modelMatrix,
  );

  const savedCommandList = frameState.commandList;
  frameState.commandList = scratchCommandList;
  scratchCommandList.length = 0;
  ellipsoidPrimitive.update(frameState);
  frameState.commandList = savedCommandList;
  return scratchCommandList.length === 1 ? scratchCommandList[0] : undefined;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 true。
 *
 * @see Moon#destroy
 */
Moon.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的 WebGL 资源。销毁对象可以确保 WebGL 资源的确定释放，而无需依赖垃圾收集器来销毁该对象。
 * 一旦对象被销毁，则不应使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * 表示对象已被销毁，即调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This moon = moon && moon.destroy();
 *
 *
 * @example
 * moon = moon && moon.destroy();
 *
 * @see Moon#isDestroyed
 */
Moon.prototype.destroy = function () {
  this._ellipsoidPrimitive =
    this._ellipsoidPrimitive && this._ellipsoidPrimitive.destroy();
  return destroyObject(this);
};
export default Moon;