import { DeveloperError } from "@cesium/core";

/**
 * 在场景中显示全景影像。此类型描述一个接口，不用于直接实例化。
 *
 * @alias Panorama
 * @constructor
 * @abstract
 *
 * @see EquirectangularPanorama
 * @see CubeMapPanorama
 * @see GoogleStreetViewCubeMapPanoramaProvider
 *
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=panorama|Cesium Sandcastle Panorama}
 */
function Panorama() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(Panorama.prototype, {
  /**
   * 决定是否显示全景影像。
   * @memberof Panorama.prototype
   * @type {boolean}
   */
  show: {
    get: DeveloperError.throwInstantiationError,
    set: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取全景影像的变换信息。
   * @memberof Panorama.prototype
   * @type {Matrix4}
   * @readonly
   */
  transform: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取全景影像的片尾说明。
   * @memberof Panorama.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: DeveloperError.throwInstantiationError,
  },
});

export default Panorama;
