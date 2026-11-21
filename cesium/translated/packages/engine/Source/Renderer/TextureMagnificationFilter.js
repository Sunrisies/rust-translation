import { WebGLConstants } from "@cesium/core";

/**
 * 列出放大 WebGL 纹理时使用的所有可能的过滤方式。
 *
 * @enum {number}
 *
 * @see TextureMinificationFilter
 */
const TextureMagnificationFilter = {
  /**
   * 通过返回最近的像素来采样纹理。
   *
   * @type {number}
   * @constant
   */
  NEAREST: WebGLConstants.NEAREST,
  /**
   * 通过对四个最近的像素进行双线性插值来采样纹理。这比 <code>NEAREST</code> 过滤方式能产生更平滑的效果。
   *
   * @type {number}
   * @constant
   */
  LINEAR: WebGLConstants.LINEAR,
};

/**
 * 根据可能的枚举值验证给定的 <code>textureMinificationFilter</code>。
 * @param textureMagnificationFilter
 * @returns {boolean} <code>true</code> 当且仅当 <code>textureMagnificationFilter</code> 有效时。
 *
 * @private
 */
TextureMagnificationFilter.validate = function (textureMagnificationFilter) {
  return (
    textureMagnificationFilter === TextureMagnificationFilter.NEAREST ||
    textureMagnificationFilter === TextureMagnificationFilter.LINEAR
  );
};

Object.freeze(TextureMagnificationFilter);

export default TextureMagnificationFilter;
