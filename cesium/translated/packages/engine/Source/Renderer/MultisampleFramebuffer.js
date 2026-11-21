import {
  Check,
  DeveloperError,
  Frozen,
  defined,
  destroyObject,
} from "@cesium/core";
import Framebuffer from "./Framebuffer.js";

/**
 * 创建一个围绕两个帧缓冲器的多采样包装器，可选择初始时添加颜色与深度模板附件。
 * 第一个帧缓冲器具有多采样特性。
 * 包含渲染缓冲区附件，在 blit 过程中绑定为 READ_FRAMEBUFFER。
 * 第二个帧缓冲器在 blit 过程中绑定为 DRAW_FRAMEBUFFER，并带有纹理附件以存储复制的像素。
 * 该对象具有以下属性：
 *
 * @param {object} options 必须提供颜色渲染缓冲区及纹理附件。
 * @param {Context} options.context
 * @param {number} options.width
 * @param {number} options.height
 * @param {Texture[]} [options.colorTextures]
 * @param {Renderbuffer[]} [options.colorRenderbuffers]
 * @param {Texture} [options.depthStencilTexture]
 * @param {Renderbuffer} [options.depthStencilRenderbuffer]
 * @param {boolean} [options.destroyAttachments]
 *
 * @exception {DeveloperError} Both 必须提供深度模板渲染缓冲区及纹理附件。
 * @exception {DeveloperError} Both 必须提供深度模板渲染缓冲区及纹理附件。
 *
 * @private
 * @constructor
 */
function MultisampleFramebuffer(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const {
    context,
    width,
    height,
    colorRenderbuffers,
    colorTextures,
    depthStencilRenderbuffer,
    depthStencilTexture,
    destroyAttachments,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", context);
  Check.defined("options.width", width);
  Check.defined("options.height", height);
  //>>includeEnd('debug');

  this._width = width;
  this._height = height;

  if (defined(colorRenderbuffers) !== defined(colorTextures)) {
    throw new DeveloperError(
      "Both color renderbuffer and texture attachments must be provided.",
    );
  }

  if (defined(depthStencilRenderbuffer) !== defined(depthStencilTexture)) {
    throw new DeveloperError(
      "Both depth-stencil renderbuffer and texture attachments must be provided.",
    );
  }

  this._renderFramebuffer = new Framebuffer({
    context: context,
    colorRenderbuffers: colorRenderbuffers,
    depthStencilRenderbuffer: depthStencilRenderbuffer,
    destroyAttachments: destroyAttachments,
  });
  this._colorFramebuffer = new Framebuffer({
    context: context,
    colorTextures: colorTextures,
    depthStencilTexture: depthStencilTexture,
    destroyAttachments: destroyAttachments,
  });
}

MultisampleFramebuffer.prototype.getRenderFramebuffer = function () {
  return this._renderFramebuffer;
};

MultisampleFramebuffer.prototype.getColorFramebuffer = function () {
  return this._colorFramebuffer;
};

/**
 * 将渲染帧缓冲器中的数据复制到颜色帧缓冲器，同时应用深度模板掩码。
 *
 * @param {Context} context
 * @param {boolean} blitStencil 如果应应用深度模板掩码，则输出 <code>true</code>。
 *
 * @private
 */
MultisampleFramebuffer.prototype.blitFramebuffers = function (
  context,
  blitStencil,
) {
  this._renderFramebuffer.bindRead();
  this._colorFramebuffer.bindDraw();
  const gl = context._gl;
  let mask = 0;
  if (this._colorFramebuffer._colorTextures.length > 0) {
    mask |= gl.COLOR_BUFFER_BIT;
  }
  if (defined(this._colorFramebuffer.depthStencilTexture)) {
    mask |= gl.DEPTH_BUFFER_BIT | (blitStencil ? gl.STENCIL_BUFFER_BIT : 0);
  }
  gl.blitFramebuffer(
    0,
    0,
    this._width,
    this._height,
    0,
    0,
    this._width,
    this._height,
    mask,
    gl.NEAREST,
  );
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
};

MultisampleFramebuffer.prototype.isDestroyed = function () {
  return false;
};

MultisampleFramebuffer.prototype.destroy = function () {
  this._renderFramebuffer.destroy();
  this._colorFramebuffer.destroy();
  return destroyObject(this);
};

export default MultisampleFramebuffer;
