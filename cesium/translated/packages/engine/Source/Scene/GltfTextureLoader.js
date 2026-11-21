import {
  Check,
  Frozen,
  Math as CesiumMath,
  PixelFormat,
  defined,
} from "@cesium/core";
import Texture from "../Renderer/Texture.js";
import TextureMinificationFilter from "../Renderer/TextureMinificationFilter.js";
import TextureWrap from "../Renderer/TextureWrap.js";
import GltfLoaderUtil from "./GltfLoaderUtil.js";
import JobType from "./JobType.js";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";
import resizeImageToNextPowerOfTwo from "../Core/resizeImageToNextPowerOfTwo.js";

/**
 * 加载 glTF 纹理。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 */
class GltfTextureLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性：
   * @param {ResourceCache} options.resourceCache 使用 {@link ResourceCache}（以避免循环依赖）。
   * @param {object} options.gltf glTF JSON 数据。
   * @param {object} options.textureInfo 纹理信息对象。
   * @param {Resource} options.gltfResource 包含 glTF 数据的 {@link Resource}。
   * @param {Resource} options.baseResource glTF JSON 中相对路径所指向的 {@link Resource}。
   * @param {SupportedImageFormats} options.supportedImageFormats 支持的图像格式。
   * @param {string} [options.cacheKey] 资源的缓存键。
   * @param {boolean} [options.asynchronous=true] 决定 WebGL 资源创建是否会在多个帧中逐步完成，直到所有 WebGL 资源创建完毕。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const resourceCache = options.resourceCache;
    const gltf = options.gltf;
    const textureInfo = options.textureInfo;
    const gltfResource = options.gltfResource;
    const baseResource = options.baseResource;
    const supportedImageFormats = options.supportedImageFormats;
    const cacheKey = options.cacheKey;
    const asynchronous = options.asynchronous ?? true;

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.func("options.resourceCache", resourceCache);
    Check.typeOf.object("options.gltf", gltf);
    Check.typeOf.object("options.textureInfo", textureInfo);
    Check.typeOf.object("options.gltfResource", gltfResource);
    Check.typeOf.object("options.baseResource", baseResource);
    Check.typeOf.object("options.supportedImageFormats", supportedImageFormats);
    //>>includeEnd('debug');

    const textureId = textureInfo.index;

    // imageId is guaranteed to be defined otherwise the GltfTextureLoader
    // wouldn't have been created
    const imageId = GltfLoaderUtil.getImageIdFromTexture({
      gltf: gltf,
      textureId: textureId,
      supportedImageFormats: supportedImageFormats,
    });

    this._resourceCache = resourceCache;
    this._gltf = gltf;
    this._textureInfo = textureInfo;
    this._imageId = imageId;
    this._gltfResource = gltfResource;
    this._baseResource = baseResource;
    this._cacheKey = cacheKey;
    this._asynchronous = asynchronous;
    this._imageLoader = undefined;
    this._image = undefined;
    this._mipLevels = undefined;
    this._texture = undefined;
    this._state = ResourceLoaderState.UNLOADED;
    this._promise = undefined;
  }

  /**
   * 资源的缓存键。
   *
   *
   * @type {string}
   * @readonly
   * @private
   */
  get cacheKey() {
    return this._cacheKey;
  }

  /**
   * 纹理数据。
   *
   *
   * @type {Texture}
   * @readonly
   * @private
   */
  get texture() {
    return this._texture;
  }

  /**
   * 加载资源。
   * @returns {Promise<GltfDracoLoader>} A 在资源加载完成后 resolve 的 promise。
   * @private
   */
  async load() {
    if (defined(this._promise)) {
      return this._promise;
    }

    this._state = ResourceLoaderState.LOADING;
    this._promise = loadResources(this);
    return this._promise;
  }

  /**
   * 处理资源直至其准备就绪。
   *
   * @param {FrameState} frameState 帧状态。
   * @returns {boolean} true 所有资源准备就绪时。
   * @private
   */
  process(frameState) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("frameState", frameState);
    //>>includeEnd('debug');

    if (this._state === ResourceLoaderState.READY) {
      return true;
    }

    if (
      this._state !== ResourceLoaderState.LOADED &&
      this._state !== ResourceLoaderState.PROCESSING
    ) {
      return false;
    }

    if (defined(this._texture)) {
      // Already created texture
      return false;
    }

    if (!defined(this._image)) {
      // Not ready to create texture
      return false;
    }

    this._state = ResourceLoaderState.PROCESSING;

    let texture;
    if (this._asynchronous) {
      const textureJob = scratchTextureJob;
      textureJob.set(
        this._gltf,
        this._textureInfo,
        this._cacheKey,
        this._image,
        this._mipLevels,
        frameState.context,
      );
      const jobScheduler = frameState.jobScheduler;
      if (!jobScheduler.execute(textureJob, JobType.TEXTURE)) {
        // Job scheduler is full. Try again next frame.
        return false;
      }
      texture = textureJob.texture;
    } else {
      texture = createTexture(
        this._gltf,
        this._textureInfo,
        this._cacheKey,
        this._image,
        this._mipLevels,
        frameState.context,
      );
    }

    // Unload everything except the texture
    this.unload();

    this._texture = texture;
    this._state = ResourceLoaderState.READY;
    this._resourceCache.statistics.addTextureLoader(this);
    return true;
  }

  /**
   * 卸载资源。
   * @private
   */
  unload() {
    if (defined(this._texture)) {
      this._texture.destroy();
    }

    if (defined(this._imageLoader) && !this._imageLoader.isDestroyed()) {
      this._resourceCache.unload(this._imageLoader);
    }

    this._imageLoader = undefined;
    this._image = undefined;
    this._mipLevels = undefined;
    this._texture = undefined;
    this._gltf = undefined;
  }
}

class CreateTextureJob {
  constructor() {
    this.gltf = undefined;
    this.textureInfo = undefined;
    this.textureId = undefined;
    this.image = undefined;
    this.context = undefined;
    this.texture = undefined;
  }

  set(gltf, textureInfo, textureId, image, mipLevels, context) {
    this.gltf = gltf;
    this.textureInfo = textureInfo;
    this.textureId = textureId;
    this.image = image;
    this.mipLevels = mipLevels;
    this.context = context;
  }

  execute() {
    this.texture = createTexture(
      this.gltf,
      this.textureInfo,
      this.textureId,
      this.image,
      this.mipLevels,
      this.context,
    );
  }
}

function createTexture(
  gltf,
  textureInfo,
  textureId,
  image,
  mipLevels,
  context,
) {
  // internalFormat is only defined for CompressedTextureBuffer
  const internalFormat = image.internalFormat;

  let compressedTextureNoMipmap = false;
  if (PixelFormat.isCompressedFormat(internalFormat) && !defined(mipLevels)) {
    compressedTextureNoMipmap = true;
  }

  const sampler = GltfLoaderUtil.createSampler({
    gltf: gltf,
    textureInfo: textureInfo,
    compressedTextureNoMipmap: compressedTextureNoMipmap,
  });

  const minFilter = sampler.minificationFilter;
  const wrapS = sampler.wrapS;
  const wrapT = sampler.wrapT;

  const samplerRequiresMipmap =
    minFilter === TextureMinificationFilter.NEAREST_MIPMAP_NEAREST ||
    minFilter === TextureMinificationFilter.NEAREST_MIPMAP_LINEAR ||
    minFilter === TextureMinificationFilter.LINEAR_MIPMAP_NEAREST ||
    minFilter === TextureMinificationFilter.LINEAR_MIPMAP_LINEAR;

  // generateMipmap is disallowed for compressed textures. Compressed textures
  // can have mipmaps but they must come with the KTX2 instead of generated by
  // WebGL. Also note from the KHR_texture_basisu spec:
  //
  //   When a texture refers to a sampler with mipmap minification or when the
  //   sampler is undefined, the KTX2 image SHOULD contain a full mip pyramid.
  //
  const generateMipmap = !defined(internalFormat) && samplerRequiresMipmap;

  // WebGL 1 requires power-of-two texture dimensions for mipmapping and REPEAT/MIRRORED_REPEAT wrap modes.
  const requiresPowerOfTwo =
    generateMipmap ||
    wrapS === TextureWrap.REPEAT ||
    wrapS === TextureWrap.MIRRORED_REPEAT ||
    wrapT === TextureWrap.REPEAT ||
    wrapT === TextureWrap.MIRRORED_REPEAT;

  const nonPowerOfTwo =
    !CesiumMath.isPowerOfTwo(image.width) ||
    !CesiumMath.isPowerOfTwo(image.height);

  const requiresResize = requiresPowerOfTwo && nonPowerOfTwo;

  let texture;
  if (defined(internalFormat)) {
    if (
      !context.webgl2 &&
      PixelFormat.isCompressedFormat(internalFormat) &&
      nonPowerOfTwo &&
      requiresPowerOfTwo
    ) {
      console.warn(
        "Compressed texture uses REPEAT or MIRRORED_REPEAT texture wrap mode and dimensions are not powers of two. The texture may be rendered incorrectly.",
      );
    }

    texture = Texture.create({
      id: textureId,
      context: context,
      source: {
        arrayBufferView: image.bufferView, // Only defined for CompressedTextureBuffer
        mipLevels: mipLevels,
      },
      width: image.width,
      height: image.height,
      pixelFormat: image.internalFormat, // Only defined for CompressedTextureBuffer
      sampler: sampler,
    });
  } else {
    if (requiresResize) {
      image = resizeImageToNextPowerOfTwo(image);
    }
    texture = Texture.create({
      id: textureId,
      context: context,
      source: image,
      sampler: sampler,
      flipY: false,
      skipColorSpaceConversion: true,
    });
  }

  if (generateMipmap) {
    texture.generateMipmap();
  }

  return texture;
}

const scratchTextureJob = new CreateTextureJob();

async function loadResources(loader) {
  const resourceCache = loader._resourceCache;
  try {
    const imageLoader = resourceCache.getImageLoader({
      gltf: loader._gltf,
      imageId: loader._imageId,
      gltfResource: loader._gltfResource,
      baseResource: loader._baseResource,
    });
    loader._imageLoader = imageLoader;
    await imageLoader.load();

    if (loader.isDestroyed()) {
      return;
    }

    // Now wait for process() to run to finish loading
    loader._image = imageLoader.image;
    loader._mipLevels = imageLoader.mipLevels;
    loader._state = ResourceLoaderState.LOADED;

    return loader;
  } catch (error) {
    if (loader.isDestroyed()) {
      return;
    }

    loader.unload();
    loader._state = ResourceLoaderState.FAILED;
    const errorMessage = "Failed to load texture";
    throw loader.getError(errorMessage, error);
  }
}

export default GltfTextureLoader;
