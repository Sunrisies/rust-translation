import {
  Math as CesiumMath,
  PixelDatatype,
  defined,
  destroyObject,
} from "@cesium/core";
import getImageFromTypedArray from "../../Core/getImageFromTypedArray.js";
import resizeImageToNextPowerOfTwo from "../../Core/resizeImageToNextPowerOfTwo.js";
import Texture from "../../Renderer/Texture.js";
import TextureMinificationFilter from "../../Renderer/TextureMinificationFilter.js";
import TextureWrap from "../../Renderer/TextureWrap.js";

/**
 * 用于管理纹理加载的对象
 *
 * @alias TextureManager
 * @constructor
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，但此内容尚未定稿，可能根据 Cesium 的标准弃用政策发生变化。
 */
function TextureManager() {
  this._defaultTexture = undefined;
  this._textures = {};
  this._loadedImages = [];

  // Keep track of the last time update() was called to avoid
  // calling update() twice.
  this._lastUpdatedFrame = -1;
}

/**
 * 获取已加载的纹理之一
 * @param {string} textureId 由 {@link TextureManager#loadTexture2D} 加载的纹理的唯一 ID
 * @return {Texture} The 纹理，或 <code>undefined</code> 表示不存在纹理
 */
TextureManager.prototype.getTexture = function (textureId) {
  return this._textures[textureId];
};

function fetchTexture2D(textureManager, textureId, textureUniform) {
  textureUniform.resource
    .fetchImage()
    .then(function (image) {
      textureManager._loadedImages.push({
        id: textureId,
        image: image,
        textureUniform: textureUniform,
      });
    })
    .catch(function () {
      const texture = textureManager._textures[textureId];
      if (defined(texture) && texture !== textureManager._defaultTexture) {
        texture.destroy();
      }

      textureManager._textures[textureId] = textureManager._defaultTexture;
    });
}

/**
 * 异步加载 2D 纹理。请注意，必须在渲染循环中调用 {@link TextureManager#update}
 * 以完成纹理的处理。
 *
 * @param {string} textureId 用于识别该纹理的唯一 ID
 * @param {TextureUniform} textureUniform 纹理的描述信息
 *
 * @private
 */
TextureManager.prototype.loadTexture2D = function (textureId, textureUniform) {
  if (defined(textureUniform.typedArray)) {
    this._loadedImages.push({
      id: textureId,
      textureUniform: textureUniform,
    });
  } else {
    fetchTexture2D(this, textureId, textureUniform);
  }
};

function createTexture(textureManager, loadedImage, context) {
  const { id, textureUniform, image } = loadedImage;

  // If the context is WebGL1, and the sampler needs mipmaps or repeating
  // boundary conditions, the image may need to be resized first
  const texture = context.webgl2
    ? getTextureAndMips(textureUniform, image, context)
    : getWebGL1Texture(textureUniform, image, context);

  // Destroy the old texture once the new one is loaded for more seamless
  // transitions between values
  const oldTexture = textureManager._textures[id];
  if (defined(oldTexture) && oldTexture !== context.defaultTexture) {
    oldTexture.destroy();
  }
  textureManager._textures[id] = texture;
}

function getTextureAndMips(textureUniform, image, context) {
  const { typedArray, sampler } = textureUniform;

  const texture = defined(typedArray)
    ? getTextureFromTypedArray(textureUniform, context)
    : new Texture({ context, source: image, sampler });

  if (samplerRequiresMipmap(sampler)) {
    texture.generateMipmap();
  }

  return texture;
}

function getWebGL1Texture(textureUniform, image, context) {
  const { typedArray, sampler } = textureUniform;

  // WebGL1 requires power-of-two texture dimensions for mipmapping and REPEAT wrap modes
  const needMipmap = samplerRequiresMipmap(sampler);

  const samplerRepeats =
    sampler.wrapS === TextureWrap.REPEAT ||
    sampler.wrapS === TextureWrap.MIRRORED_REPEAT ||
    sampler.wrapT === TextureWrap.REPEAT ||
    sampler.wrapT === TextureWrap.MIRRORED_REPEAT;

  const { width, height } = defined(typedArray) ? textureUniform : image;
  const isPowerOfTwo = [width, height].every(CesiumMath.isPowerOfTwo);
  const requiresResize = (needMipmap || samplerRepeats) && !isPowerOfTwo;

  if (!requiresResize) {
    return getTextureAndMips(textureUniform, image, context);
  } else if (!defined(typedArray)) {
    const resizedImage = resizeImageToNextPowerOfTwo(image);
    return getTextureAndMips(textureUniform, resizedImage, context);
  } else if (textureUniform.pixelDatatype === PixelDatatype.UNSIGNED_BYTE) {
    const imageFromArray = getImageFromTypedArray(typedArray, width, height);
    const resizedImage = resizeImageToNextPowerOfTwo(imageFromArray);
    return getTextureAndMips({ sampler }, resizedImage, context);
  }

  // typedArray is non-power-of-two but can't be resized. Warn and return raw texture (no mipmaps)
  if (needMipmap) {
    console.warn(
      "Texture requires resizing for mipmaps but pixelDataType cannot be resized. The texture may be rendered incorrectly.",
    );
  } else if (samplerRepeats) {
    console.warn(
      "Texture requires resizing for wrapping but pixelDataType cannot be resized. The texture may be rendered incorrectly.",
    );
  }
  return getTextureFromTypedArray(textureUniform, context);
}

function samplerRequiresMipmap(sampler) {
  return [
    TextureMinificationFilter.NEAREST_MIPMAP_NEAREST,
    TextureMinificationFilter.NEAREST_MIPMAP_LINEAR,
    TextureMinificationFilter.LINEAR_MIPMAP_NEAREST,
    TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
  ].includes(sampler.minificationFilter);
}

function getTextureFromTypedArray(textureUniform, context) {
  const {
    pixelFormat,
    pixelDatatype,
    width,
    height,
    typedArray: arrayBufferView,
    sampler,
  } = textureUniform;

  return new Texture({
    context,
    pixelFormat,
    pixelDatatype,
    source: { arrayBufferView, width, height },
    sampler,
    flipY: false,
  });
}

TextureManager.prototype.update = function (frameState) {
  // update only needs to be called once a frame.
  if (frameState.frameNumber === this._lastUpdatedFrame) {
    return;
  }
  this._lastUpdatedFrame = frameState.frameNumber;

  const context = frameState.context;
  this._defaultTexture = context.defaultTexture;

  // If any images were loaded since the last frame, create Textures
  // for them and store in the uniform dictionary
  const loadedImages = this._loadedImages;
  for (let i = 0; i < loadedImages.length; i++) {
    const loadedImage = loadedImages[i];
    createTexture(this, loadedImage, context);
  }
  loadedImages.length = 0;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 *
 * @returns {boolean} True 如果此对象被销毁，则返回 false；否则返回 false。
 *
 * @see TextureManager#destroy
 * @private
 */
TextureManager.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的 WebGL 资源。销毁对象可以确保
 * WebGL 资源的确定释放，而不是依赖垃圾收集器来销毁该对象。
 * <br /><br />
 * 一旦对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @example
 * textureManager = textureManager && textureManager.destroy();
 *
 * @see TextureManager#isDestroyed
 * @private
 */
TextureManager.prototype.destroy = function () {
  const textures = this._textures;
  for (const texture in textures) {
    if (textures.hasOwnProperty(texture)) {
      const instance = textures[texture];
      if (instance !== this._defaultTexture) {
        instance.destroy();
      }
    }
  }
  return destroyObject(this);
};

export default TextureManager;
