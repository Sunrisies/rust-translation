import {
  Check,
  DeveloperError,
  Frozen,
  PixelDatatype,
  PixelFormat,
  defined,
  destroyObject,
} from "@cesium/core";
import ContextLimits from "./ContextLimits.js";

function attachTexture(framebuffer, attachment, texture) {
  const gl = framebuffer._gl;
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    attachment,
    texture._target,
    texture._texture,
    0,
  );
}

function attachRenderbuffer(framebuffer, attachment, renderbuffer) {
  const gl = framebuffer._gl;
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    attachment,
    gl.RENDERBUFFER,
    renderbuffer._getRenderbuffer(),
  );
}

/**
 * 创建一个带有可选初始颜色、深度和模板附件的帧缓冲区。
 * 帧缓冲区用于渲染到纹理的效果；它们允许我们
 * 在一次遍历中渲染到纹理，并在后续遍历中读取纹理。
 *
 * @param {object} options 具有以下属性的实体：
 * @param {Context} options.context
 * @param {Texture[]} [options.colorTextures]
 * @param {Renderbuffer[]} [options.colorRenderbuffers]
 * @param {Texture} [options.depthTexture]
 * @param {Renderbuffer} [options.depthRenderbuffer]
 * @param {Renderbuffer} [options.stencilRenderbuffer]
 * @param {Texture} [options.depthStencilTexture]
 * @param {Renderbuffer} [options.depthStencilRenderbuffer]
 * @param {boolean} [options.destroyAttachments=true] 当为 true 时，帧缓冲区拥有其附件，因此在调用 {@link Framebuffer#destroy} 或向附件点分配新附件时，这些附件将被销毁。
 *
 * @exception {DeveloperError} Cannot 同时具有颜色纹理和颜色渲染缓冲区附件。
 * @exception {DeveloperError} Cannot 同时具有深度纹理和深度渲染缓冲区附件。
 * @exception {DeveloperError} Cannot 同时具有深度纹理和深度渲染缓冲区附件。
 * @exception {DeveloperError} Cannot 同时具有深度和深度渲染缓冲区。
 * @exception {DeveloperError} Cannot 同时具有模板和深度渲染缓冲区。
 * @exception {DeveloperError} Cannot 同时具有深度和模板渲染缓冲区。
 * @exception {DeveloperError} The 颜色纹理的像素格式必须是颜色格式。
 * @exception {DeveloperError} The 深度纹理的像素格式必须是 DEPTH_COMPONENT。
 * @exception {DeveloperError} The 深度纹理的像素格式必须是 DEPTH_STENCIL。
 * @exception {DeveloperError} The 颜色附件的数量超过了支持的数量。
 * @exception {DeveloperError} The 颜色纹理的像素数据类型是 HALF_FLOAT，而 WebGL 实现不支持 EXT_color_buffer_half_float 扩展。
 * @exception {DeveloperError} The 颜色纹理的像素数据类型是 FLOAT，而 WebGL 实现不支持 EXT_color_buffer_float 或 WEBGL_color_buffer_float 扩展。
 *
 * @example
 * // 创建一个具有颜色和深度纹理附件的帧缓冲区。
 * const width = context.canvas.clientWidth;
 * const height = context.canvas.clientHeight;
 * const framebuffer = new Framebuffer({
 * context : context,
 * colorTextures : [new Texture({
 * context : context,
 * width : width,
 * height : height,
 * pixelFormat : PixelFormat.RGBA
 *   })],
 * depthTexture : new Texture({
 * context : context,
 * width : width,
 * height : height,
 * pixelFormat : PixelFormat.DEPTH_COMPONENT,
 * pixelDatatype : PixelDatatype.UNSIGNED_SHORT
 *   })
 * });
 *
 * @private
 * @constructor
 */
function Framebuffer(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const context = options.context;
  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", context);
  //>>includeEnd('debug');

  const gl = context._gl;
  const maximumColorAttachments = ContextLimits.maximumColorAttachments;

  this._gl = gl;
  this._framebuffer = gl.createFramebuffer();

  this._colorTextures = [];
  this._colorRenderbuffers = [];
  this._activeColorAttachments = [];

  this._depthTexture = undefined;
  this._depthRenderbuffer = undefined;
  this._stencilRenderbuffer = undefined;
  this._depthStencilTexture = undefined;
  this._depthStencilRenderbuffer = undefined;

  /**
   * 当为 true 时，帧缓冲区拥有其附件，因此在
   * 调用 {@link Framebuffer#destroy} 或向附件点分配新附件时，这些附件将被销毁。
   * 该帧缓冲区的状态。如果状态不是 WebGLConstants.FRAMEBUFFER_COMPLETE，
   *
   * @type {boolean}
   * @default true
   *
   * @see Framebuffer#destroy
   */
  this.destroyAttachments = options.destroyAttachments ?? true;

  // Throw if a texture and renderbuffer are attached to the same point.  This won't
  // cause a WebGL error (because only one will be attached), but is likely a developer error.

  //>>includeStart('debug', pragmas.debug);
  if (defined(options.colorTextures) && defined(options.colorRenderbuffers)) {
    throw new DeveloperError(
      "Cannot have both color texture and color renderbuffer attachments.",
    );
  }
  if (defined(options.depthTexture) && defined(options.depthRenderbuffer)) {
    throw new DeveloperError(
      "Cannot have both a depth texture and depth renderbuffer attachment.",
    );
  }
  if (
    defined(options.depthStencilTexture) &&
    defined(options.depthStencilRenderbuffer)
  ) {
    throw new DeveloperError(
      "Cannot have both a depth-stencil texture and depth-stencil renderbuffer attachment.",
    );
  }

  // Avoid errors defined in Section 6.5 of the WebGL spec
  const depthAttachment =
    defined(options.depthTexture) || defined(options.depthRenderbuffer);
  const depthStencilAttachment =
    defined(options.depthStencilTexture) ||
    defined(options.depthStencilRenderbuffer);
  if (depthAttachment && depthStencilAttachment) {
    throw new DeveloperError(
      "Cannot have both a depth and depth-stencil attachment.",
    );
  }
  if (defined(options.stencilRenderbuffer) && depthStencilAttachment) {
    throw new DeveloperError(
      "Cannot have both a stencil and depth-stencil attachment.",
    );
  }
  if (depthAttachment && defined(options.stencilRenderbuffer)) {
    throw new DeveloperError(
      "Cannot have both a depth and stencil attachment.",
    );
  }
  //>>includeEnd('debug');

  this._bind();

  if (defined(options.colorTextures)) {
    const textures = options.colorTextures;
    const length =
      (this._colorTextures.length =
      this._activeColorAttachments.length =
        textures.length);

    //>>includeStart('debug', pragmas.debug);
    if (length > maximumColorAttachments) {
      throw new DeveloperError(
        "The number of color attachments exceeds the number supported.",
      );
    }
    //>>includeEnd('debug');

    for (let i = 0; i < length; ++i) {
      const texture = textures[i];

      //>>includeStart('debug', pragmas.debug);
      if (!PixelFormat.isColorFormat(texture.pixelFormat)) {
        throw new DeveloperError(
          "The color-texture pixel-format must be a color format.",
        );
      }
      if (
        texture.pixelDatatype === PixelDatatype.FLOAT &&
        !context.colorBufferFloat
      ) {
        throw new DeveloperError(
          "The color texture pixel datatype is FLOAT and the WebGL implementation does not support the EXT_color_buffer_float or WEBGL_color_buffer_float extensions. See Context.colorBufferFloat.",
        );
      }
      if (
        texture.pixelDatatype === PixelDatatype.HALF_FLOAT &&
        !context.colorBufferHalfFloat
      ) {
        throw new DeveloperError(
          "The color texture pixel datatype is HALF_FLOAT and the WebGL implementation does not support the EXT_color_buffer_half_float extension. See Context.colorBufferHalfFloat.",
        );
      }
      //>>includeEnd('debug');

      const attachmentEnum = this._gl.COLOR_ATTACHMENT0 + i;
      attachTexture(this, attachmentEnum, texture);
      this._activeColorAttachments[i] = attachmentEnum;
      this._colorTextures[i] = texture;
    }
  }

  if (defined(options.colorRenderbuffers)) {
    const renderbuffers = options.colorRenderbuffers;
    const length =
      (this._colorRenderbuffers.length =
      this._activeColorAttachments.length =
        renderbuffers.length);

    //>>includeStart('debug', pragmas.debug);
    if (length > maximumColorAttachments) {
      throw new DeveloperError(
        "The number of color attachments exceeds the number supported.",
      );
    }
    //>>includeEnd('debug');

    for (let i = 0; i < length; ++i) {
      const renderbuffer = renderbuffers[i];
      const attachmentEnum = this._gl.COLOR_ATTACHMENT0 + i;
      attachRenderbuffer(this, attachmentEnum, renderbuffer);
      this._activeColorAttachments[i] = attachmentEnum;
      this._colorRenderbuffers[i] = renderbuffer;
    }
  }

  if (defined(options.depthTexture)) {
    const texture = options.depthTexture;

    //>>includeStart('debug', pragmas.debug);
    if (texture.pixelFormat !== PixelFormat.DEPTH_COMPONENT) {
      throw new DeveloperError(
        "The depth-texture pixel-format must be DEPTH_COMPONENT.",
      );
    }
    //>>includeEnd('debug');

    attachTexture(this, this._gl.DEPTH_ATTACHMENT, texture);
    this._depthTexture = texture;
  }

  if (defined(options.depthRenderbuffer)) {
    const renderbuffer = options.depthRenderbuffer;
    attachRenderbuffer(this, this._gl.DEPTH_ATTACHMENT, renderbuffer);
    this._depthRenderbuffer = renderbuffer;
  }

  if (defined(options.stencilRenderbuffer)) {
    const renderbuffer = options.stencilRenderbuffer;
    attachRenderbuffer(this, this._gl.STENCIL_ATTACHMENT, renderbuffer);
    this._stencilRenderbuffer = renderbuffer;
  }

  if (defined(options.depthStencilTexture)) {
    const texture = options.depthStencilTexture;

    //>>includeStart('debug', pragmas.debug);
    if (texture.pixelFormat !== PixelFormat.DEPTH_STENCIL) {
      throw new DeveloperError(
        "The depth-stencil pixel-format must be DEPTH_STENCIL.",
      );
    }
    //>>includeEnd('debug');

    attachTexture(this, this._gl.DEPTH_STENCIL_ATTACHMENT, texture);
    this._depthStencilTexture = texture;
  }

  if (defined(options.depthStencilRenderbuffer)) {
    const renderbuffer = options.depthStencilRenderbuffer;
    attachRenderbuffer(this, this._gl.DEPTH_STENCIL_ATTACHMENT, renderbuffer);
    this._depthStencilRenderbuffer = renderbuffer;
  }

  this._unBind();

  // _bind and _unBind bypass the context's framebuffer binding cache. The GL
  // binding is now the default framebuffer; update the cache to match.
  context._currentFramebuffer = undefined;
}

Object.defineProperties(Framebuffer.prototype, {
  /**
   * 尝试向帧缓冲区渲染时会抛出 {@link DeveloperError}。
   * 如果帧缓冲区具有深度附件，则为 true。深度附件包括
   * @memberof Framebuffer.prototype
   * @type {number}
   */
  status: {
    get: function () {
      this._bind();
      const status = this._gl.checkFramebufferStatus(this._gl.FRAMEBUFFER);
      this._unBind();
      return status;
    },
  },
  numberOfColorAttachments: {
    get: function () {
      return this._activeColorAttachments.length;
    },
  },
  depthTexture: {
    get: function () {
      return this._depthTexture;
    },
  },
  depthRenderbuffer: {
    get: function () {
      return this._depthRenderbuffer;
    },
  },
  stencilRenderbuffer: {
    get: function () {
      return this._stencilRenderbuffer;
    },
  },
  depthStencilTexture: {
    get: function () {
      return this._depthStencilTexture;
    },
  },
  depthStencilRenderbuffer: {
    get: function () {
      return this._depthStencilRenderbuffer;
    },
  },

  /**
   * True if the framebuffer has a depth attachment.  Depth attachments include
   * 深度和深度纹理，以及深度和深度渲染缓冲区。当
   * 需将渲染输出到帧缓冲区，且需要深度附件以使深度测试生效。
   * @memberof Framebuffer.prototype
   * @type {boolean}
   */
  hasDepthAttachment: {
    get: function () {
      return !!(
        this.depthTexture ||
        this.depthRenderbuffer ||
        this.depthStencilTexture ||
        this.depthStencilRenderbuffer
      );
    },
  },
});

Framebuffer.prototype._bind = function () {
  const gl = this._gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
};

Framebuffer.prototype._unBind = function () {
  const gl = this._gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

Framebuffer.prototype.bindDraw = function () {
  const gl = this._gl;
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._framebuffer);
};

Framebuffer.prototype.bindRead = function () {
  const gl = this._gl;
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._framebuffer);
};

Framebuffer.prototype._getActiveColorAttachments = function () {
  return this._activeColorAttachments;
};

Framebuffer.prototype.getColorTexture = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index) || index < 0 || index >= this._colorTextures.length) {
    throw new DeveloperError(
      "index is required, must be greater than or equal to zero and must be less than the number of color attachments.",
    );
  }
  //>>includeEnd('debug');

  return this._colorTextures[index];
};

Framebuffer.prototype.getColorRenderbuffer = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (
    !defined(index) ||
    index < 0 ||
    index >= this._colorRenderbuffers.length
  ) {
    throw new DeveloperError(
      "index is required, must be greater than or equal to zero and must be less than the number of color attachments.",
    );
  }
  //>>includeEnd('debug');

  return this._colorRenderbuffers[index];
};

Framebuffer.prototype.isDestroyed = function () {
  return false;
};

Framebuffer.prototype.destroy = function () {
  if (this.destroyAttachments) {
    // If the color texture is a cube map face, it is owned by the cube map, and will not be destroyed.
    const textures = this._colorTextures;
    for (let i = 0; i < textures.length; ++i) {
      const texture = textures[i];
      if (defined(texture)) {
        texture.destroy();
      }
    }

    const renderbuffers = this._colorRenderbuffers;
    for (let i = 0; i < renderbuffers.length; ++i) {
      const renderbuffer = renderbuffers[i];
      if (defined(renderbuffer)) {
        renderbuffer.destroy();
      }
    }

    this._depthTexture = this._depthTexture && this._depthTexture.destroy();
    this._depthRenderbuffer =
      this._depthRenderbuffer && this._depthRenderbuffer.destroy();
    this._stencilRenderbuffer =
      this._stencilRenderbuffer && this._stencilRenderbuffer.destroy();
    this._depthStencilTexture =
      this._depthStencilTexture && this._depthStencilTexture.destroy();
    this._depthStencilRenderbuffer =
      this._depthStencilRenderbuffer &&
      this._depthStencilRenderbuffer.destroy();
  }

  this._gl.deleteFramebuffer(this._framebuffer);
  return destroyObject(this);
};
export default Framebuffer;
