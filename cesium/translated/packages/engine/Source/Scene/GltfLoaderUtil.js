import { Cartesian2, Check, Frozen, Matrix3, defined } from "@cesium/core";
import Sampler from "../Renderer/Sampler.js";
import TextureMagnificationFilter from "../Renderer/TextureMagnificationFilter.js";
import TextureMinificationFilter from "../Renderer/TextureMinificationFilter.js";
import TextureWrap from "../Renderer/TextureWrap.js";
import ModelComponents from "./ModelComponents.js";

/**
 * glTF 加载工具函数。
 *
 * @namespace GltfLoaderUtil
 *
 * @private
 */
const GltfLoaderUtil = {};

/**
 * 获取纹理所引用的图像 ID。
 * <p>
 * 当该纹理包含 EXT_texture_webp 扩展且浏览器支持 WebP 格式时，返回 WebP 图像 ID。
 * 具有以下属性的对象：
 * </p>
 *
 * @param {object} options glTF JSON 数据。
 * @param {object} options.gltf 纹理 ID。
 * @param {number} options.textureId 支持的影像图层格式。
 * @param {SupportedImageFormats} options.supportedImageFormats 图像 ID。
 *
 * @returns {number} The 为纹理创建采样器。
 * @private
 */
GltfLoaderUtil.getImageIdFromTexture = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, textureId, supportedImageFormats } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.number("options.textureId", textureId);
  Check.typeOf.object("options.supportedImageFormats", supportedImageFormats);
  //>>includeEnd('debug');

  const texture = gltf.textures[textureId];
  const extensions = texture.extensions;
  if (defined(extensions)) {
    if (supportedImageFormats.webp && defined(extensions.EXT_texture_webp)) {
      return extensions.EXT_texture_webp.source;
    } else if (
      supportedImageFormats.basis &&
      defined(extensions.KHR_texture_basisu)
    ) {
      return extensions.KHR_texture_basisu.source;
    }
  }
  return texture.source;
};

/**
 * 具有以下属性的对象：
 *
 * @param {object} options glTF JSON 数据。
 * @param {object} options.gltf 纹理信息对象。
 * @param {object} options.textureInfo 纹理信息。
 * @param {boolean} [options.compressedTextureNoMipmap=false] 当纹理被压缩且未包含内嵌 mipmap 时，值为 true。
 *
 * @returns {Sampler} The 采样器。
 * @private
 */
GltfLoaderUtil.createSampler = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { gltf, textureInfo, compressedTextureNoMipmap = false } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.textureInfo", textureInfo);
  //>>includeEnd('debug');

  // Default sampler properties
  let wrapS = TextureWrap.REPEAT;
  let wrapT = TextureWrap.REPEAT;
  let minFilter = TextureMinificationFilter.LINEAR;
  let magFilter = TextureMagnificationFilter.LINEAR;

  const textureId = textureInfo.index;
  const texture = gltf.textures[textureId];
  const samplerId = texture.sampler;

  if (defined(samplerId)) {
    const sampler = gltf.samplers[samplerId];
    wrapS = sampler.wrapS ?? wrapS;
    wrapT = sampler.wrapT ?? wrapT;
    minFilter = sampler.minFilter ?? minFilter;
    magFilter = sampler.magFilter ?? magFilter;
  }

  if (
    compressedTextureNoMipmap &&
    minFilter !== TextureMinificationFilter.LINEAR &&
    minFilter !== TextureMinificationFilter.NEAREST
  ) {
    if (
      minFilter === TextureMinificationFilter.NEAREST_MIPMAP_NEAREST ||
      minFilter === TextureMinificationFilter.NEAREST_MIPMAP_LINEAR
    ) {
      minFilter = TextureMinificationFilter.NEAREST;
    } else {
      minFilter = TextureMinificationFilter.LINEAR;
    }
  }

  if (!TextureWrap.validate(wrapS)) {
    wrapS = TextureWrap.REPEAT;
  }

  if (!TextureWrap.validate(wrapT)) {
    wrapT = TextureWrap.REPEAT;
  }

  if (!TextureMinificationFilter.validate(minFilter)) {
    minFilter = TextureMinificationFilter.LINEAR;
  }

  if (!TextureMagnificationFilter.validate(magFilter)) {
    magFilter = TextureMagnificationFilter.LINEAR;
  }

  return new Sampler({
    wrapS: wrapS,
    wrapT: wrapT,
    minificationFilter: minFilter,
    magnificationFilter: magFilter,
  });
};

const defaultScale = new Cartesian2(1.0, 1.0);

/**
 * 创建模型纹理读取器。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.textureInfo 纹理信息 JSON 数据。
 * @param {string} [options.channels] 要读取的纹理通道。
 * @param {Texture} [options.texture] 纹理对象。
 *
 * @returns {ModelComponents.TextureReader} The 该模型的纹理读取器。
 */
GltfLoaderUtil.createModelTextureReader = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const { textureInfo, channels, texture } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.textureInfo", textureInfo);
  //>>includeEnd('debug');

  let texCoord = textureInfo.texCoord ?? 0;
  let transform;

  const textureTransform = textureInfo.extensions?.KHR_texture_transform;

  if (defined(textureTransform)) {
    texCoord = textureTransform.texCoord ?? texCoord;

    const offset = defined(textureTransform.offset)
      ? Cartesian2.unpack(textureTransform.offset)
      : Cartesian2.ZERO;
    let rotation = textureTransform.rotation ?? 0.0;
    const scale = defined(textureTransform.scale)
      ? Cartesian2.unpack(textureTransform.scale)
      : defaultScale;

    // glTF assumes UV coordinates start with (0, 0) in the top left corner
    // (y-down) unlike WebGL which puts (0, 0) in the bottom left corner (y-up).
    // This means rotations are reversed since the angle from x to y is now
    // clockwise instead of CCW. Translations and scales are not impacted by
    // this.
    rotation = -rotation;

    // prettier-ignore
    transform = new Matrix3(
      Math.cos(rotation) * scale.x, -Math.sin(rotation) * scale.y, offset.x,
      Math.sin(rotation) * scale.x, Math.cos(rotation) * scale.y, offset.y,
      0.0, 0.0, 1.0
    );
  }

  const modelTextureReader = new ModelComponents.TextureReader();
  modelTextureReader.index = textureInfo.index;
  modelTextureReader.texture = texture;
  modelTextureReader.texCoord = texCoord;
  modelTextureReader.scale = textureInfo.scale;
  modelTextureReader.transform = transform;
  modelTextureReader.channels = channels;

  // EXT_textureInfo_constant_lod extension
  const constantLodExtension =
    textureInfo.extensions?.EXT_textureInfo_constant_lod;
  if (defined(constantLodExtension)) {
    modelTextureReader.constantLod = {
      repetitions: constantLodExtension.repetitions ?? 1.0,
      offset: defined(constantLodExtension.offset)
        ? Cartesian2.unpack(constantLodExtension.offset)
        : Cartesian2.ZERO,
      minClampDistance: constantLodExtension.minClampDistance ?? 1.0,
      maxClampDistance: constantLodExtension.maxClampDistance ?? 4294967296.0,
    };
  }

  return modelTextureReader;
};

export default GltfLoaderUtil;
