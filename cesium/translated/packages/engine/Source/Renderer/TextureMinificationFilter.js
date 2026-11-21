import { WebGLConstants } from "@cesium/core";

/**
 * 枚举在压缩 WebGL 纹理时使用的所有可能滤镜。
 *
 * @enum {number}
 *
 * @see TextureMagnificationFilter
 */
const TextureMinificationFilter = {
  /**
   * 通过返回最近的像素来采样纹理。
   *
   * @type {number}
   * @constant
   */
  NEAREST: WebGLConstants.NEAREST,
  /**
   * 通过四个最近像素的双线性插值来采样纹理。这比 <code>NEAREST</code> 滤镜能产生更平滑的结果。
   *
   * @type {number}
   * @constant
   */
  LINEAR: WebGLConstants.LINEAR,
  /**
   * 选择最近的 mip 级别，并在该级别内进行最近采样。
   * <p>
   * 要求纹理具有 mipmap。mip 级别由纹理的视角角度和屏幕空间大小决定。
   * </p>
   *
   * @type {number}
   * @constant
   */
  NEAREST_MIPMAP_NEAREST: WebGLConstants.NEAREST_MIPMAP_NEAREST,
  /**
   * 选择最近的 mip 级别，并在该级别内进行线性采样。
   * <p>
   * 要求纹理具有 mipmap。mip 级别由纹理的视角角度和屏幕空间大小决定。
   * </p>
   *
   * @type {number}
   * @constant
   */
  LINEAR_MIPMAP_NEAREST: WebGLConstants.LINEAR_MIPMAP_NEAREST,
  /**
   * 使用来自两个相邻 mip 级别的最近采样方式读取纹理值，并线性插值结果。
   * <p>
   * 此选项在从 mipmapped 纹理采样时提供了良好的视觉质量和速度平衡。
   * </p>
   * <p>
   * 要求纹理具有 mipmap。mip 级别由纹理的视角角度和屏幕空间大小决定。
   * </p>
   *
   * @type {number}
   * @constant
   */
  NEAREST_MIPMAP_LINEAR: WebGLConstants.NEAREST_MIPMAP_LINEAR,
  /**
   * 使用来自两个相邻 mip 级别的线性采样方式读取纹理值，并线性插值结果。
   * <p>
   * 此选项在从 mipmapped 纹理采样时提供了良好的视觉质量和速度平衡。
   * </p>
   * <p>
   * 要求纹理具有 mipmap。mip 级别由纹理的视角角度和屏幕空间大小决定。
   * </p>
   * @type {number}
   * @constant
   */
  LINEAR_MIPMAP_LINEAR: WebGLConstants.LINEAR_MIPMAP_LINEAR,
};

/**
 * 根据可能的枚举值验证给定的 <code>textureMinificationFilter</code>。
 *
 * @private
 *
 * @param textureMinificationFilter
 * @returns {boolean} <code>true</code> 如果 <code>textureMinificationFilter</code> 有效。
 */
TextureMinificationFilter.validate = function (textureMinificationFilter) {
  return (
    textureMinificationFilter === TextureMinificationFilter.NEAREST ||
    textureMinificationFilter === TextureMinificationFilter.LINEAR ||
    textureMinificationFilter ===
      TextureMinificationFilter.NEAREST_MIPMAP_NEAREST ||
    textureMinificationFilter ===
      TextureMinificationFilter.LINEAR_MIPMAP_NEAREST ||
    textureMinificationFilter ===
      TextureMinificationFilter.NEAREST_MIPMAP_LINEAR ||
    textureMinificationFilter === TextureMinificationFilter.LINEAR_MIPMAP_LINEAR
  );
};

Object.freeze(TextureMinificationFilter);

export default TextureMinificationFilter;
