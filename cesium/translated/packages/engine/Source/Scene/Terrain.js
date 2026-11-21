import { Check, Event } from "@cesium/core";
import createWorldBathymetryAsync from "../Core/createWorldBathymetryAsync.js";
import createWorldTerrainAsync from "../Core/createWorldTerrainAsync.js";

/**
 * 用于管理地形提供器异步操作的辅助工具。
 *
 * @alias Terrain
 * @constructor
 *
 * @see Terrain.fromWorldTerrain
 * @see CesiumTerrainProvider
 * @see VRTheWorldTerrainProvider
 * @see GoogleEarthEnterpriseTerrainProvider
 *
 * @example
 * // 创建
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl("https://myTestTerrain.com"));
 * });
 *
 * @example
 * // 处理加载事件
 * const terrain = new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl("https://myTestTerrain.com"));
 *
 * scene.setTerrain(terrain);
 *
 * terrain.readyEvent.addEventListener(provider => {
 * scene.globe.enableLighting = true;
 *
 * terrain.provider.errorEvent.addEventListener(error => {
 * alert(`在加载地形瓦片时遇到错误！ ${error}`);
 *   });
 * });
 *
 * terrain.errorEvent.addEventListener(error => {
 * alert(`创建地形时遇到错误！ ${error}`);
 * });
 *
 * @param {Promise<TerrainProvider>} terrainProviderPromise 一个解析为地形提供器的 Promise
 */
function Terrain(terrainProviderPromise) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("terrainProviderPromise", terrainProviderPromise);
  //>>includeEnd('debug');

  this._ready = false;
  this._provider = undefined;
  this._errorEvent = new Event();
  this._readyEvent = new Event();

  handlePromise(this, terrainProviderPromise);
}

Object.defineProperties(Terrain.prototype, {
  /**
   * 当地形提供器遇到异步错误时，会触发此事件。通过订阅该事件，您可以收到错误通知并可能进行恢复操作。事件监听器
   * 接收抛出的错误的实例。
   * 当地形提供器成功创建时，会触发此事件。事件监听器
   * @memberof Terrain.prototype
   * @type {Event<Terrain.ErrorEventCallback>}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 传递 {@link TerrainProvider} 的创建实例。
   * 返回 true，表示地形提供器已成功创建；否则返回 false。
   * @memberof Terrain.prototype
   * @type {Event<Terrain.ReadyEventCallback>}
   * @readonly
   */
  readyEvent: {
    get: function () {
      return this._readyEvent;
    },
  },

  /**
   * 提供表面几何数据的地形提供器。在 {@link Terrain.readyEvent} 触发之前不要使用。
   * @memberof Terrain.prototype
   *
   * @type {boolean}
   * @readonly
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },

  /**
   * 为 {@link https://cesium.com/content/#cesium-world-terrain|Cesium World Terrain} 创建 {@link Terrain} 实例。
   * @memberof Terrain.prototype
   *
   * @type {TerrainProvider}
   * @readonly
   */
  provider: {
    get: function () {
      return this._provider;
    },
  },
});
/**
 * 具有以下属性的对象：
 *
 * @function
 *
 * @param {object} [options] 标志，指示客户端是否应请求服务器提供的额外照明信息（如果可用）。
 * @param {boolean} [options.requestVertexNormals=false] 标志，指示客户端是否应请求服务器提供的每瓦片水掩模（如果可用）。
 * @param {boolean} [options.requestWaterMask=false] CesiumTerrainProvider 的异步辅助对象。
 * @returns {Terrain} An // 使用默认设置创建 Cesium World Terrain
 *
 * @see Ion
 * @see createWorldTerrainAsync
 *
 * @example
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrain: Cesium.Terrain.fromWorldTerrain()
 * // 使用水和法线创建 Cesium World Terrain
 * });
 *
 * @example
 * const viewer1 = new Cesium.Viewer("cesiumContainer", {
 * terrain: Cesium.Terrain.fromWorldTerrain({
 * requestWaterMask: true,
 * requestVertexNormals: true
 * // 处理加载事件
 *    });
 * });
 *
 * @example
 * const terrain = Cesium.Terrain.fromWorldTerrain();
 * scene.setTerrain(terrain);
 *
 * scene.setTerrain(terrain);
 *
 * terrain.readyEvent.addEventListener(provider => {
 * scene.globe.enableLighting = true;
 *
 * terrain.provider.errorEvent.addEventListener(error => {
 * alert(`在加载地形瓦片时遇到错误！${error}`);
 *   });
 * });
 *
 * terrain.errorEvent.addEventListener(error => {
 * alert(`在创建地形时遇到错误！${error}`);
 * });
 */
Terrain.fromWorldTerrain = function (options) {
  return new Terrain(createWorldTerrainAsync(options));
};

/**
 * 创建一个 {@link Terrain} 实例，用于 {@link https://cesium.com/content/#cesium-world-bathymetry|Cesium World Bathymetry}。
 *
 * @function
 *
 * @param {object} [options] 该对象包含以下属性：
 * @param {boolean} [options.requestVertexNormals=false] 指示客户端是否应在有可用时从服务器请求额外照明信息的标志。
 * @returns {Terrain} An CesiumTerrainProvider 的异步辅助对象。
 *
 * @see Ion
 * @see createWorldBathymetryAsync
 *
 * @example
 * // 使用默认设置创建 Cesium World Bathymetry
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrain: Cesium.Terrain.fromWorldBathymetry)
 * });
 *
 * @example
 * // 使用法线创建 Cesium World Terrain。
 * const viewer1 = new Cesium.Viewer("cesiumContainer", {
 * terrain: Cesium.Terrain.fromWorldBathymetry({
 * requestVertexNormals: true
 *    });
 * });
 *
 * @example
 * // 处理加载事件
 * const bathymetry = Cesium.Terrain.fromWorldBathymetry();
 *
 * scene.setTerrain(bathymetry);
 *
 * bathymetry.readyEvent.addEventListener(provider => {
 * scene.globe.enableLighting = true;
 *
 * bathymetry.provider.errorEvent.addEventListener(error => {
 * alert(`在加载地形瓦片时遇到错误！${error}`);
 *   });
 * });
 *
 * bathymetry.errorEvent.addEventListener(error => {
 * alert(`在创建地形时遇到错误！${error}`);
 * });
 */
Terrain.fromWorldBathymetry = function (options) {
  return new Terrain(createWorldBathymetryAsync(options));
};

function handleError(errorEvent, error) {
  if (errorEvent.numberOfListeners > 0) {
    errorEvent.raiseEvent(error);
  } else {
    // Default handler is to log to the console
    console.error(error);
  }
}

async function handlePromise(instance, promise) {
  let provider;
  try {
    provider = await Promise.resolve(promise);
    instance._provider = provider;
    instance._ready = true;
    instance._readyEvent.raiseEvent(provider);
  } catch (error) {
    handleError(instance._errorEvent, error);
  }
}

export default Terrain;

/**
 * 当发生错误时调用的函数。
 * @callback Terrain.ErrorEventCallback
 *
 * @this Terrain
 * @param {Error} err 包含所发生错误详情的对象。
 */

/**
 * provider 创建后调用的函数
 * @callback Terrain.ReadyEventCallback
 *
 * @this Terrain
 * @param {TerrainProvider} provider 创建的地形提供器。
 */
