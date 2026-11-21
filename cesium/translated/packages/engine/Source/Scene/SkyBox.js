import { destroyObject } from "@cesium/core";
import buildModuleUrl from "../Core/buildModuleUrl.js";
import CubeMapPanorama from "./CubeMapPanorama.js";
import SceneMode from "./SceneMode.js";

/**
 * 用于绘制星星的场景周围的天空框。该天空框使用真赤道平均春分点（TEME）轴定义。
 * <p>
 * 此功能仅支持 3D 模式。当转换为 2D 或 Columbus 视图时，天空框会淡化。天空框的大小
 * 不得超过 {@link Scene#maximumCubeMapSize}。
 * </p>
 *
 * @alias SkyBox
 * @constructor
 *
 * @param {object} options 具有以下属性的实体：
 * @param {object} [options.sources] 六个立方体贴图面的源 URL 或 <code>Image</code> 对象。请参见下面的示例。
 * @param {boolean} [options.show=true] 决定此原始体是否显示。
 *
 *
 * @example
 * scene.skyBox = new Cesium.SkyBox({
 * sources : {
 * positiveX : 'skybox_px.png',
 * negativeX : 'skybox_nx.png',
 * positiveY : 'skybox_py.png',
 * negativeY : 'skybox_ny.png',
 * positiveZ : 'skybox_pz.png',
 * negativeZ : 'skybox_nz.png'
 *   }
 * });
 *
 * @see Scene#skyBox
 * @see Transforms.computeTemeToPseudoFixedMatrix
 */
function SkyBox(options) {
  this._sources = options.sources;
  this._show = options.show ?? true;
  this._panorama = new CubeMapPanorama({
    sources: this._sources,
    show: this._show,
    returnCommand: true,
  });
}

Object.defineProperties(SkyBox.prototype, {
  /**
   * 获取或设置原始体对象。
   * @memberof SkyBox.prototype
   * @type {object}
   */
  sources: {
    get: function () {
      return this._panorama.sources;
    },
    set: function (value) {
      this._panorama.sources = value;
    },
  },

  /**
   * 决定天空框是否显示。
   * @memberof SkyBox.prototype
   * @type {boolean}
   * @default true
   */

  show: {
    get: function () {
      return this._panorama.show;
    },
    set: function (value) {
      this._panorama.show = value;
    },
  },
});

/**
 * 在 {@link Viewer} 或 {@link CesiumWidget} 将场景渲染时调用，
 * 获取渲染此原始体所需的绘制命令。
 * <p>
 * 不要直接调用此函数。此文档仅用于列出
 * 在场景渲染时可能传播的异常：
 * </p>
 *
 * @exception {DeveloperError} this.sources 需要 positiveX、negativeX、positiveY、negativeY、positiveZ 和 negativeZ 属性。
 * @exception {DeveloperError} this.sources 所有属性必须属于相同类型。
 */
SkyBox.prototype.update = function (frameState, useHdr) {
  const { mode, passes } = frameState;

  if (mode !== SceneMode.SCENE3D && mode !== SceneMode.MORPHING) {
    return;
  }

  if (!passes.render) {
    return;
  }

  // Delegate completely
  return this._panorama.update(frameState, useHdr);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>false</code>。
 *
 * @see SkyBox#destroy
 */
SkyBox.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而不依赖垃圾收集器来销毁该对象。
 * 一旦对象被销毁，就不应再使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例所示。
 * 对象被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This skyBox = skyBox && skyBox.destroy();
 *
 *
 * @example
 * 创建具有地球默认星图的天空框实例。
 *
 * @see SkyBox#isDestroyed
 */
SkyBox.prototype.destroy = function () {
  this._panorama = this._panorama && this._panorama.destroy();
  return destroyObject(this);
};

function getDefaultSkyBoxUrl(suffix) {
  return buildModuleUrl(`Assets/Textures/SkyBox/tycho2t3_80_${suffix}.jpg`);
}

/**
 * 地球的默认天空框
 * @return {SkyBox} The 地球的默认天空框
 *
 * @example
 * viewer.scene.skyBox = Cesium.SkyBox.createEarthSkyBox();
 */
SkyBox.createEarthSkyBox = function () {
  return new SkyBox({
    sources: {
      positiveX: getDefaultSkyBoxUrl("px"),
      negativeX: getDefaultSkyBoxUrl("mx"),
      positiveY: getDefaultSkyBoxUrl("py"),
      negativeY: getDefaultSkyBoxUrl("my"),
      positiveZ: getDefaultSkyBoxUrl("pz"),
      negativeZ: getDefaultSkyBoxUrl("mz"),
    },
  });
};

export default SkyBox;
