import {
  Event,
  PixelDatatype,
  PixelFormat,
  defined,
  destroyObject,
} from "@cesium/core";
import loadKTX2 from "../Core/loadKTX2.js";
import CubeMap from "../Renderer/CubeMap.js";
import Sampler from "../Renderer/Sampler.js";
import TextureMinificationFilter from "../Renderer/TextureMinificationFilter.js";

/**
 * 管理立方体贴图，用作镜面环境贴图。
 *
 * @alias SpecularEnvironmentCubeMap
 * @constructor
 *
 * @param {string} url 包含镜面环境贴图和复杂MIP映射的 KTX2 文件地址。
 * @private
 */
function SpecularEnvironmentCubeMap(url) {
  this._url = url;

  this._cubeMapBuffers = undefined;
  this._texture = undefined;

  this._maximumMipmapLevel = undefined;

  this._loading = false;
  this._ready = false;

  this._errorEvent = new Event();
}

Object.defineProperties(SpecularEnvironmentCubeMap.prototype, {
  /**
   * 包含镜面环境贴图和复杂MIP映射的 KTX2 文件地址。
   * @memberof SpecularEnvironmentCubeMap.prototype
   * @type {string}
   * @readonly
   */
  url: {
    get: function () {
      return this._url;
    },
  },
  /**
   * 在遇到异步错误时触发事件。通过订阅该事件，
   * 您可以收到错误通知，并有可能从中恢复。
   * @memberof SpecularEnvironmentCubeMap.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },
  /**
   * 包含所有打包后的卷积的纹理。
   * @memberof SpecularEnvironmentCubeMap.prototype
   * @type {Texture}
   * @readonly
   */
  texture: {
    get: function () {
      return this._texture;
    },
  },
  /**
   * 具有有效环境贴图数据的MIP级别最大数量。
   * 这可能与 WebGL 立方体贴图中的 MIP 级别数量不同。
   * 在 <code>maximumMipmapLevel</code> 加载的数据适用于
   * 具有最大粗糙度 (1.0) 的 PBR 材质渲染。
   * @memberOf SpecularEnvironmentCubeMap.prototype
   * @type {number}
   * @readonly
   */
  maximumMipmapLevel: {
    get: function () {
      return this._maximumMipmapLevel;
    },
  },
  /**
   * 确定立方体贴图是否完整且可用。
   * @memberof SpecularEnvironmentCubeMap.prototype
   * @type {boolean}
   * @readonly
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },
});

SpecularEnvironmentCubeMap.isSupported = function (context) {
  const supportsFloatBuffersAndTextures =
    (context.colorBufferHalfFloat && context.halfFloatingPointTexture) ||
    (context.floatingPointTexture && context.colorBufferFloat);
  return supportsFloatBuffersAndTextures && context.supportsTextureLod;
};

function cleanupResources(map) {
  map._cubeMapBuffers = undefined;
}

/**
 * 加载环境贴图图像，并构建立方体贴图以进行镜面辐射度计算。
 * <p>
 * 图像加载完成后，下一次调用会清理未使用的资源。之后的每次调用均为无操作。
 * </p>
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
SpecularEnvironmentCubeMap.prototype.update = function (frameState) {
  const { context } = frameState;

  if (!SpecularEnvironmentCubeMap.isSupported(context)) {
    return;
  }

  if (defined(this._texture)) {
    cleanupResources(this);
    return;
  }

  if (!defined(this._texture) && !this._loading) {
    const cachedTexture = context.textureCache.getTexture(this._url);
    if (defined(cachedTexture)) {
      cleanupResources(this);
      this._texture = cachedTexture;
      this._maximumMipmapLevel = this._texture.maximumMipmapLevel;
      this._ready = true;
    }
  }

  const cubeMapBuffers = this._cubeMapBuffers;
  if (!defined(cubeMapBuffers) && !this._loading) {
    const that = this;
    loadKTX2(this._url)
      .then(function (buffers) {
        that._cubeMapBuffers = buffers;
        that._loading = false;
      })
      .catch(function (error) {
        if (that.isDestroyed()) {
          return;
        }
        that._errorEvent.raiseEvent(error);
      });
    this._loading = true;
  }

  if (!defined(this._cubeMapBuffers)) {
    return;
  }

  // Datatype is defined if it is a normalized type (i.e. ..._UNORM, ..._SFLOAT)
  let { pixelDatatype } = cubeMapBuffers[0].positiveX;
  if (!defined(pixelDatatype)) {
    pixelDatatype = context.halfFloatingPointTexture
      ? PixelDatatype.HALF_FLOAT
      : PixelDatatype.FLOAT;
  }
  const pixelFormat = PixelFormat.RGBA;

  const mipLevels = cubeMapBuffers.length;
  this._maximumMipmapLevel = mipLevels - 1;

  const faceSize = cubeMapBuffers[0].positiveX.width;
  const expectedMipLevels = Math.log2(faceSize) + 1;
  if (mipLevels !== expectedMipLevels) {
    // We assume the last supplied mip level was computed as the specular radiance
    // for roughness 1.0.
    // Fill the remaining levels with null values, to avoid WebGL errors.
    const dummyMipLevel = {};
    Object.values(CubeMap.FaceName).forEach((faceName) => {
      dummyMipLevel[faceName] = undefined;
    });
    for (let mipLevel = mipLevels; mipLevel < expectedMipLevels; mipLevel++) {
      cubeMapBuffers.push(dummyMipLevel);
    }
  }

  const sampler = new Sampler({
    minificationFilter: TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
  });

  const cubeMap = new CubeMap({
    context: context,
    source: cubeMapBuffers[0],
    flipY: false,
    pixelDatatype: pixelDatatype,
    pixelFormat: pixelFormat,
    sampler: sampler,
  });
  cubeMap.loadMipmaps(cubeMapBuffers.slice(1));
  this._texture = cubeMap;

  this._texture.maximumMipmapLevel = this._maximumMipmapLevel;
  context.textureCache.addTexture(this._url, this._texture);

  this._ready = true;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <p>
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>true</code>。
 *
 * @see SpecularEnvironmentCubeMap#destroy
 */
SpecularEnvironmentCubeMap.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性的
 * WebGL 资源释放，而不是依赖垃圾收集器来销毁此对象。
 * <p>
 * 一旦对象被销毁，就不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * </p>
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see SpecularEnvironmentCubeMap#isDestroyed
 */
SpecularEnvironmentCubeMap.prototype.destroy = function () {
  cleanupResources(this);
  this._texture = this._texture && this._texture.destroy();
  return destroyObject(this);
};
export default SpecularEnvironmentCubeMap;
