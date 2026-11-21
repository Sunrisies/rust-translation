import { DeveloperError } from "@cesium/core";

/**
 * 在椭球体表面显示影像。此类型描述了一个
 * 接口，不可直接实例化。
 *
 * @alias PanoramaProvider
 * @constructor
 * @abstract
 *
 * @see GoogleStreetViewCubeMapPanoramaProvider
 * @see EquirectangularPanorama
 * @see CubeMapPanorama
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=panorama|Cesium Sandcastle Panorama}
 */
function PanoramaProvider() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(PanoramaProvider.prototype, {});

/**
 * 返回全景提供器。
 *
 * @param {object} options 创建全景提供器的输入选项。
 * @returns {PanoramaProvider} The 用于将全景加载到场景中的全景提供器。
 */
PanoramaProvider.fromUrl = function (options) {
  DeveloperError.throwInstantiationError();
};

/**
 * 返回全景基本体。
 *
 * @param {object} options 创建全景基本体的输入选项。
 * @returns {Panorama} The 在场景中显示全景的全景基本体。
 */
PanoramaProvider.prototype.loadPanorama = function (options) {
  DeveloperError.throwInstantiationError();
};

export default PanoramaProvider;
