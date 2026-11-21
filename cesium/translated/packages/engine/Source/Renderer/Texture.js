import {
  Cartesian2,
  Check,
  Color,
  DeveloperError,
  Frozen,
  Math as CesiumMath,
  PixelDatatype,
  PixelFormat,
  createGuid,
  defined,
  destroyObject,
} from "@cesium/core";
import ContextLimits from "./ContextLimits.js";
import MipmapHint from "./MipmapHint.js";
import Sampler from "./Sampler.js";
import TextureMagnificationFilter from "./TextureMagnificationFilter.js";
import TextureMinificationFilter from "./TextureMinificationFilter.js";

/**
 * @typedef {object} Texture.ConstructorOptions
 *
 * @property {Context} context
 * @property {object} [source] 用于加载到纹理中的像素值来源。可以是 {@link ImageData}、{@link HTMLImageElement}、{@link HTMLCanvasElement}、
 * {@link HTMLVideoElement}、{@link OffscreenCanvas} 或 {@link ImageBitmap}，
 * 或者具有宽度、高度和 arrayBufferView 属性的对象。
 * @property {PixelFormat} [pixelFormat=PixelFormat.RGBA] 每个像素的格式，即其组件数量及其所代表的含义。
 * @property {PixelDatatype} [pixelDatatype=PixelDatatype.UNSIGNED_BYTE] 每个像素的数据类型。
 * @property {boolean} [flipY=true] 如果为 true，则源值将按 y 轴倒置的方式读取（y=0 位于顶部）。
 * @property {boolean} [skipColorSpaceConversion=false] 如果为 true，读取像素值时将跳过颜色空间转换。
 * @property {Sampler} [sampler] 关于如何采样纹理的信息。
 * @property {number} [width] 纹理的像素宽度。如果未提供，则必须从源中获取。
 * @property {number} [height] 纹理的像素高度。如果未提供，则必须从源中获取。
 * @property {boolean} [preMultiplyAlpha] 如果为 true，则 alpha 通道将与其他通道相乘。
 * @property {string} [id] 纹理的唯一标识符。如果没有给出，则将创建 GUID。
 *
 * @private
 */

/**
 * 用于包装 {@link https://developer.mozilla.org/en-US/docs/Web/API/WebGLTexture|WebGLTexture} 的包装器，以抽象掉设置纹理时繁琐的 GL 调用。
 * 用于隐藏与设置纹理相关的冗长 GL 调用。
 *
 * @alias Texture
 * @constructor
 *
 * @param {Texture.ConstructorOptions} options
 * @private
 */
function Texture(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", options.context);
  //>>includeEnd('debug');

  const {
    context,
    source,
    pixelFormat = PixelFormat.RGBA,
    pixelDatatype = PixelDatatype.UNSIGNED_BYTE,
    flipY = true,
    skipColorSpaceConversion = false,
    sampler = new Sampler(),
  } = options;

  let { width, height } = options;
  if (defined(source)) {
    // Make sure we are using the element's intrinsic width and height where available
    if (!defined(width)) {
      width = source.videoWidth ?? source.naturalWidth ?? source.width;
    }
    if (!defined(height)) {
      height = source.videoHeight ?? source.naturalHeight ?? source.height;
    }
  }

  // Use premultiplied alpha for opaque textures should perform better on Chrome:
  // http://media.tojicode.com/webglCamp4/#20
  const preMultiplyAlpha =
    options.preMultiplyAlpha ||
    pixelFormat === PixelFormat.RGB ||
    pixelFormat === PixelFormat.LUMINANCE;

  const internalFormat = PixelFormat.toInternalFormat(
    pixelFormat,
    pixelDatatype,
    context.webgl2,
  );

  const isCompressed = PixelFormat.isCompressedFormat(internalFormat);

  //>>includeStart('debug', pragmas.debug);
  if (!defined(width) || !defined(height)) {
    throw new DeveloperError(
      "options requires a source field to create an initialized texture or width and height fields to create a blank texture.",
    );
  }

  Check.typeOf.number.greaterThan("width", width, 0);

  if (width > ContextLimits.maximumTextureSize) {
    throw new DeveloperError(
      `Width must be less than or equal to the maximum texture size (${ContextLimits.maximumTextureSize}).  Check maximumTextureSize.`,
    );
  }

  Check.typeOf.number.greaterThan("height", height, 0);

  if (height > ContextLimits.maximumTextureSize) {
    throw new DeveloperError(
      `Height must be less than or equal to the maximum texture size (${ContextLimits.maximumTextureSize}).  Check maximumTextureSize.`,
    );
  }

  if (!PixelFormat.validate(pixelFormat)) {
    throw new DeveloperError("Invalid options.pixelFormat.");
  }

  if (!isCompressed && !PixelDatatype.validate(pixelDatatype)) {
    throw new DeveloperError("Invalid options.pixelDatatype.");
  }

  if (
    pixelFormat === PixelFormat.DEPTH_COMPONENT &&
    pixelDatatype !== PixelDatatype.UNSIGNED_SHORT &&
    pixelDatatype !== PixelDatatype.UNSIGNED_INT
  ) {
    throw new DeveloperError(
      "When options.pixelFormat is DEPTH_COMPONENT, options.pixelDatatype must be UNSIGNED_SHORT or UNSIGNED_INT.",
    );
  }

  if (
    pixelFormat === PixelFormat.DEPTH_STENCIL &&
    pixelDatatype !== PixelDatatype.UNSIGNED_INT_24_8
  ) {
    throw new DeveloperError(
      "When options.pixelFormat is DEPTH_STENCIL, options.pixelDatatype must be UNSIGNED_INT_24_8.",
    );
  }

  if (pixelDatatype === PixelDatatype.FLOAT && !context.floatingPointTexture) {
    throw new DeveloperError(
      "When options.pixelDatatype is FLOAT, this WebGL implementation must support the OES_texture_float extension.  Check context.floatingPointTexture.",
    );
  }

  if (
    pixelDatatype === PixelDatatype.HALF_FLOAT &&
    !context.halfFloatingPointTexture
  ) {
    throw new DeveloperError(
      "When options.pixelDatatype is HALF_FLOAT, this WebGL implementation must support the OES_texture_half_float extension. Check context.halfFloatingPointTexture.",
    );
  }

  if (PixelFormat.isDepthFormat(pixelFormat)) {
    if (defined(source)) {
      throw new DeveloperError(
        "When options.pixelFormat is DEPTH_COMPONENT or DEPTH_STENCIL, source cannot be provided.",
      );
    }

    if (!context.depthTexture) {
      throw new DeveloperError(
        "When options.pixelFormat is DEPTH_COMPONENT or DEPTH_STENCIL, this WebGL implementation must support WEBGL_depth_texture.  Check context.depthTexture.",
      );
    }
  }

  if (isCompressed) {
    if (!defined(source) || !defined(source.arrayBufferView)) {
      throw new DeveloperError(
        "When options.pixelFormat is compressed, options.source.arrayBufferView must be defined.",
      );
    }

    if (PixelFormat.isDXTFormat(internalFormat) && !context.s3tc) {
      throw new DeveloperError(
        "When options.pixelFormat is S3TC compressed, this WebGL implementation must support the WEBGL_compressed_texture_s3tc extension. Check context.s3tc.",
      );
    } else if (PixelFormat.isPVRTCFormat(internalFormat) && !context.pvrtc) {
      throw new DeveloperError(
        "When options.pixelFormat is PVRTC compressed, this WebGL implementation must support the WEBGL_compressed_texture_pvrtc extension. Check context.pvrtc.",
      );
    } else if (PixelFormat.isASTCFormat(internalFormat) && !context.astc) {
      throw new DeveloperError(
        "When options.pixelFormat is ASTC compressed, this WebGL implementation must support the WEBGL_compressed_texture_astc extension. Check context.astc.",
      );
    } else if (PixelFormat.isETC2Format(internalFormat) && !context.etc) {
      throw new DeveloperError(
        "When options.pixelFormat is ETC2 compressed, this WebGL implementation must support the WEBGL_compressed_texture_etc extension. Check context.etc.",
      );
    } else if (PixelFormat.isETC1Format(internalFormat) && !context.etc1) {
      throw new DeveloperError(
        "When options.pixelFormat is ETC1 compressed, this WebGL implementation must support the WEBGL_compressed_texture_etc1 extension. Check context.etc1.",
      );
    } else if (PixelFormat.isBC7Format(internalFormat) && !context.bc7) {
      throw new DeveloperError(
        "When options.pixelFormat is BC7 compressed, this WebGL implementation must support the EXT_texture_compression_bptc extension. Check context.bc7.",
      );
    }

    if (
      PixelFormat.compressedTextureSizeInBytes(
        internalFormat,
        width,
        height,
      ) !== source.arrayBufferView.byteLength
    ) {
      throw new DeveloperError(
        "The byte length of the array buffer is invalid for the compressed texture with the given width and height.",
      );
    }
  }
  //>>includeEnd('debug');

  const gl = context._gl;

  const sizeInBytes = isCompressed
    ? PixelFormat.compressedTextureSizeInBytes(pixelFormat, width, height)
    : PixelFormat.textureSizeInBytes(pixelFormat, pixelDatatype, width, height);

  this._id = options.id ?? createGuid();
  this._context = context;
  this._textureFilterAnisotropic = context._textureFilterAnisotropic;
  this._textureTarget = gl.TEXTURE_2D;
  this._texture = gl.createTexture();
  this._internalFormat = internalFormat;
  this._pixelFormat = pixelFormat;
  this._pixelDatatype = pixelDatatype;
  this._width = width;
  this._height = height;
  this._dimensions = new Cartesian2(width, height);
  this._hasMipmap = false;
  this._sizeInBytes = sizeInBytes;
  this._preMultiplyAlpha = preMultiplyAlpha;
  this._flipY = flipY;
  this._initialized = false;
  this._sampler = undefined;

  this._sampler = sampler;
  setupSampler(this, sampler);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(this._textureTarget, this._texture);

  if (defined(source)) {
    if (skipColorSpaceConversion) {
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    } else {
      gl.pixelStorei(
        gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
        gl.BROWSER_DEFAULT_WEBGL,
      );
    }
    if (defined(source.arrayBufferView)) {
      const isCompressed = PixelFormat.isCompressedFormat(internalFormat);
      if (isCompressed) {
        loadCompressedBufferSource(this, source);
      } else {
        loadBufferSource(this, source);
      }
    } else if (defined(source.framebuffer)) {
      loadFramebufferSource(this, source);
    } else {
      loadImageSource(this, source);
    }
    this._initialized = true;
  } else {
    loadNull(this);
  }

  gl.bindTexture(this._textureTarget, null);
}

/**
 * 从缓冲区加载压缩后的像素数据到纹理中。
 *
 * @param {Texture} texture 将像素值加载到的纹理。
 * @param {object} source 用于加载到纹理中的像素值来源。
 *
 * @private
 */
function loadCompressedBufferSource(texture, source) {
  const context = texture._context;
  const gl = context._gl;
  const textureTarget = texture._textureTarget;
  const internalFormat = texture._internalFormat;

  const { width, height } = texture;

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  gl.compressedTexImage2D(
    textureTarget,
    0,
    internalFormat,
    width,
    height,
    0,
    source.arrayBufferView,
  );

  if (defined(source.mipLevels)) {
    let mipWidth = width;
    let mipHeight = height;
    for (let i = 0; i < source.mipLevels.length; ++i) {
      mipWidth = nextMipSize(mipWidth);
      mipHeight = nextMipSize(mipHeight);
      gl.compressedTexImage2D(
        textureTarget,
        i + 1,
        internalFormat,
        mipWidth,
        mipHeight,
        0,
        source.mipLevels[i],
      );
    }
  }
}

/**
 * 从缓冲区加载像素数据到纹理中。
 *
 * @param {Texture} texture 将像素值加载到的纹理。
 * @param {object} source 用于加载到纹理中的像素值来源。
 *
 * @private
 */
function loadBufferSource(texture, source) {
  const context = texture._context;
  const gl = context._gl;
  const textureTarget = texture._textureTarget;
  const internalFormat = texture._internalFormat;

  const { width, height, pixelFormat, pixelDatatype, flipY } = texture;

  const unpackAlignment = PixelFormat.alignmentInBytes(
    pixelFormat,
    pixelDatatype,
    width,
  );

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, unpackAlignment);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  let { arrayBufferView } = source;
  if (flipY) {
    arrayBufferView = PixelFormat.flipY(
      arrayBufferView,
      pixelFormat,
      pixelDatatype,
      width,
      height,
    );
  }
  gl.texImage2D(
    textureTarget,
    0,
    internalFormat,
    width,
    height,
    0,
    pixelFormat,
    PixelDatatype.toWebGLConstant(pixelDatatype, context.webgl2),
    arrayBufferView,
  );

  if (defined(source.mipLevels)) {
    let mipWidth = width;
    let mipHeight = height;
    for (let i = 0; i < source.mipLevels.length; ++i) {
      mipWidth = nextMipSize(mipWidth);
      mipHeight = nextMipSize(mipHeight);
      gl.texImage2D(
        textureTarget,
        i + 1,
        internalFormat,
        mipWidth,
        mipHeight,
        0,
        pixelFormat,
        PixelDatatype.toWebGLConstant(pixelDatatype, context.webgl2),
        source.mipLevels[i],
      );
    }
  }
}

/**
 * 从缓冲区加载像素数据到纹理的一部分中。
 *
 * @param {Texture} texture 将像素值加载到的纹理。
 * @param {TypedArray} arrayBufferView 将加载到纹理中的像素值。
 * @param {number} xOffset 要更新的纹理子区域左下角的像素 x 坐标。
 * @param {number} yOffset 要更新的纹理子区域左下角的像素 y 坐标。
 * @param {number} width 源数据的宽度，以像素为单位。
 * @param {number} height 源数据的高度，以像素为单位。
 *
 * @private
 */
function loadPartialBufferSource(
  texture,
  arrayBufferView,
  xOffset,
  yOffset,
  width,
  height,
) {
  const context = texture._context;
  const gl = context._gl;

  const { pixelFormat, pixelDatatype } = texture;

  const unpackAlignment = PixelFormat.alignmentInBytes(
    pixelFormat,
    pixelDatatype,
    width,
  );
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, unpackAlignment);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  if (texture.flipY) {
    arrayBufferView = PixelFormat.flipY(
      arrayBufferView,
      pixelFormat,
      pixelDatatype,
      width,
      height,
    );
  }
  gl.texSubImage2D(
    texture._textureTarget,
    0,
    xOffset,
    yOffset,
    width,
    height,
    pixelFormat,
    PixelDatatype.toWebGLConstant(pixelDatatype, context.webgl2),
    arrayBufferView,
  );
}

/**
 * 从帧缓冲区加载像素数据到纹理中。
 *
 * @param {Texture} texture 将像素值加载到的纹理。
 * @param {object} source 用于加载到纹理中的像素值来源。
 *
 * @private
 */
function loadFramebufferSource(texture, source) {
  const context = texture._context;
  const gl = context._gl;

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  if (source.framebuffer !== context.defaultFramebuffer) {
    source.framebuffer._bind();
  }

  gl.copyTexImage2D(
    texture._textureTarget,
    0,
    texture._internalFormat,
    source.xOffset,
    source.yOffset,
    texture.width,
    texture.height,
    0,
  );

  if (source.framebuffer !== context.defaultFramebuffer) {
    source.framebuffer._unBind();
  }
}

/**
 * 从 Image 加载像素数据到纹理中。
 *
 * @param {Texture} texture 将像素值加载到的纹理。
 * @param {ImageData|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|OffscreenCanvas|ImageBitmap} source 用于加载到纹理中的像素值来源。
 *
 * @private
 */
function loadImageSource(texture, source) {
  const context = texture._context;
  const gl = context._gl;

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.preMultiplyAlpha);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);

  gl.texImage2D(
    texture._textureTarget,
    0,
    texture._internalFormat,
    texture.pixelFormat,
    PixelDatatype.toWebGLConstant(texture.pixelDatatype, context.webgl2),
    source,
  );
}

/**
 * 从 Image 加载像素数据到纹理的一部分中。
 *
 * @param {Texture} texture 将像素值加载到的纹理。
 * @param {ImageData|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} source 用于加载到纹理中的 texel 值的来源。
 * @param {number} xOffset 要更新的纹理子区域左下角的 texel x 坐标。
 * @param {number} yOffset 要更新的纹理子区域左下角的 texel y 坐标。
 *
 * @private
 */
function loadPartialImageSource(texture, source, xOffset, yOffset) {
  const context = texture._context;
  const gl = context._gl;

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.preMultiplyAlpha);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);

  gl.texSubImage2D(
    texture._textureTarget,
    0,
    xOffset,
    yOffset,
    texture.pixelFormat,
    PixelDatatype.toWebGLConstant(texture.pixelDatatype, context.webgl2),
    source,
  );
}

/**
 * 计算下一 mip 级的图像尺寸。
 *
 * @param {number} currentSize 当前 mip 级的大小。
 * @returns {number} The 下一 mip 级的大小。
 *
 * @private
 */
function nextMipSize(currentSize) {
  const nextSize = Math.floor(currentSize / 2) | 0;
  return Math.max(nextSize, 1);
}

/**
 * 在 GPU 内存中分配一个纹理，但不提供任何图像数据。
 *
 * @param {Texture} texture 要用空值初始化的纹理。
 *
 * @private
 */
function loadNull(texture) {
  const context = texture._context;

  context._gl.texImage2D(
    texture._textureTarget,
    0,
    texture._internalFormat,
    texture._width,
    texture._height,
    0,
    texture._pixelFormat,
    PixelDatatype.toWebGLConstant(texture._pixelDatatype, context.webgl2),
    null,
  );
}

/**
 * 此函数与使用 Texture 构造函数相同，不同之处在于它可以在测试中被
 * 替换为 mock/spy。
 * @ignore
 */
Texture.create = function (options) {
  return new Texture(options);
};

/**
 * 创建纹理，并将帧缓冲区的子图像复制到该纹理中。当无参数调用时，
 * 纹理的宽度和高度与帧缓冲区相同，并包含其内容。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Context} options.context Texture 被创建的上下文。
 * @param {PixelFormat} [options.pixelFormat=PixelFormat.RGB] 纹理的内部像素格式。
 * @param {number} [options.framebufferXOffset=0] 从帧缓冲区的 x 方向偏移量，即复制开始的位置。
 * @param {number} [options.framebufferYOffset=0] 从帧缓冲区的 y 方向偏移量，即复制开始的位置。
 * @param {number} [options.width=canvas.clientWidth] 纹理在 texels 中的宽度。
 * @param {number} [options.height=canvas.clientHeight] 纹理在 texels 中的高度。
 * @param {Framebuffer} [options.framebuffer=defaultFramebuffer] 用于创建纹理的帧缓冲区。如果此参数未指定，则使用默认帧缓冲区。
 * 来自帧缓冲区的内容作为纹理的内容。
 * @returns {Texture} A 纹理的内容来自帧缓冲区。
 *
 * @exception {DeveloperError} Invalid 像素格式。
 * @exception {DeveloperError} pixelFormat 不能是 DEPTH_COMPONENT、DEPTH_STENCIL 或压缩格式。
 * @exception {DeveloperError} framebufferXOffset 必须大于或等于零。
 * @exception {DeveloperError} framebufferYOffset 必须大于或等于零。
 * @exception {DeveloperError} framebufferXOffset + 宽度必须小于或等于 canvas.clientWidth。
 * @exception {DeveloperError} framebufferYOffset + 高度必须小于或等于 canvas.clientHeight。
 *
 *
 * @example
 * // 创建一个包含帧缓冲区内容的纹理。
 * const t = Texture.fromFramebuffer({
 * context : context
 * });
 *
 * @see Sampler
 *
 * @private
 */
Texture.fromFramebuffer = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", options.context);
  //>>includeEnd('debug');

  const context = options.context;
  const {
    pixelFormat = PixelFormat.RGB,
    framebufferXOffset = 0,
    framebufferYOffset = 0,
    width = context.drawingBufferWidth,
    height = context.drawingBufferHeight,
    framebuffer,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  if (!PixelFormat.validate(pixelFormat)) {
    throw new DeveloperError("Invalid pixelFormat.");
  }
  if (
    PixelFormat.isDepthFormat(pixelFormat) ||
    PixelFormat.isCompressedFormat(pixelFormat)
  ) {
    throw new DeveloperError(
      "pixelFormat cannot be DEPTH_COMPONENT, DEPTH_STENCIL or a compressed format.",
    );
  }
  Check.defined("options.context", context);
  Check.typeOf.number.greaterThanOrEquals(
    "framebufferXOffset",
    framebufferXOffset,
    0,
  );
  Check.typeOf.number.greaterThanOrEquals(
    "framebufferYOffset",
    framebufferYOffset,
    0,
  );
  if (framebufferXOffset + width > context.drawingBufferWidth) {
    throw new DeveloperError(
      "framebufferXOffset + width must be less than or equal to drawingBufferWidth",
    );
  }
  if (framebufferYOffset + height > context.drawingBufferHeight) {
    throw new DeveloperError(
      "framebufferYOffset + height must be less than or equal to drawingBufferHeight.",
    );
  }
  //>>includeEnd('debug');

  const texture = new Texture({
    context: context,
    width: width,
    height: height,
    pixelFormat: pixelFormat,
    source: {
      framebuffer: defined(framebuffer)
        ? framebuffer
        : context.defaultFramebuffer,
      xOffset: framebufferXOffset,
      yOffset: framebufferYOffset,
      width: width,
      height: height,
    },
  });

  return texture;
};

Object.defineProperties(Texture.prototype, {
  /**
   * 纹理的唯一 ID。
   * @memberof Texture.prototype
   * @type {string}
   * @readonly
   * @private
   */
  id: {
    get: function () {
      return this._id;
    },
  },
  /**
   * 采样此纹理时使用的采样器。
   * 通过调用 {@link Sampler} 创建采样器。如果此参数未指定，则使用默认采样器。默认采样器在两种放大和缩小模式下都进行裁剪，
   * parameter is not specified, a default sampler is used.  The default sampler clamps texture
   * 并在两个方向上使用线性过滤，
   * 并使用最大各向异性为 1.0。
   * @memberof Texture.prototype
   * @type {Sampler}
   * @private
   */
  sampler: {
    get: function () {
      return this._sampler;
    },
    set: function (sampler) {
      setupSampler(this, sampler);
      this._sampler = sampler;
    },
  },
  pixelFormat: {
    get: function () {
      return this._pixelFormat;
    },
  },
  pixelDatatype: {
    get: function () {
      return this._pixelDatatype;
    },
  },
  dimensions: {
    get: function () {
      return this._dimensions;
    },
  },
  preMultiplyAlpha: {
    get: function () {
      return this._preMultiplyAlpha;
    },
  },
  flipY: {
    get: function () {
      return this._flipY;
    },
  },
  width: {
    get: function () {
      return this._width;
    },
  },
  height: {
    get: function () {
      return this._height;
    },
  },
  sizeInBytes: {
    get: function () {
      if (this._hasMipmap) {
        return Math.floor((this._sizeInBytes * 4) / 3);
      }
      return this._sizeInBytes;
    },
  },
  _target: {
    get: function () {
      return this._textureTarget;
    },
  },
});

/**
 * 为与纹理一起使用的采样器设置参数
 * @param {Texture} texture 此采样器要采样的纹理。
 * @param {Sampler} sampler 关于如何采样纹理的信息。
 * @private
 */
function setupSampler(texture, sampler) {
  let { minificationFilter, magnificationFilter } = sampler;

  const mipmap = [
    TextureMinificationFilter.NEAREST_MIPMAP_NEAREST,
    TextureMinificationFilter.NEAREST_MIPMAP_LINEAR,
    TextureMinificationFilter.LINEAR_MIPMAP_NEAREST,
    TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
  ].includes(minificationFilter);

  const context = texture._context;
  const pixelFormat = texture._pixelFormat;
  const pixelDatatype = texture._pixelDatatype;

  // float textures only support nearest filtering unless the linear extensions are supported
  if (
    (pixelDatatype === PixelDatatype.FLOAT && !context.textureFloatLinear) ||
    (pixelDatatype === PixelDatatype.HALF_FLOAT &&
      !context.textureHalfFloatLinear)
  ) {
    // override the sampler's settings
    minificationFilter = mipmap
      ? TextureMinificationFilter.NEAREST_MIPMAP_NEAREST
      : TextureMinificationFilter.NEAREST;
    magnificationFilter = TextureMagnificationFilter.NEAREST;
  }

  // WebGL 2 depth texture only support nearest filtering. See section 3.8.13 OpenGL ES 3 spec
  if (context.webgl2) {
    if (PixelFormat.isDepthFormat(pixelFormat)) {
      minificationFilter = TextureMinificationFilter.NEAREST;
      magnificationFilter = TextureMagnificationFilter.NEAREST;
    }
  }

  const gl = context._gl;
  const target = texture._textureTarget;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, texture._texture);
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, minificationFilter);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, magnificationFilter);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, sampler.wrapS);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, sampler.wrapT);
  if (defined(texture._textureFilterAnisotropic)) {
    gl.texParameteri(
      target,
      texture._textureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
      sampler.maximumAnisotropy,
    );
  }
  gl.bindTexture(target, null);
}

/**
 * 将新的图像数据从来源 {@link ImageData}、{@link HTMLImageElement}、{@link HTMLCanvasElement} 或 {@link HTMLVideoElement} 复制到该纹理中。
 * 或者是一个具有宽度、高度和 arrayBufferView 属性的对象。
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.source 源 {@link ImageData}、{@link HTMLImageElement}、{@link HTMLCanvasElement}、{@link HTMLVideoElement}，
 * {@link OffscreenCanvas} 或者 {@link ImageBitmap}，
 * 或者是一个具有宽度、高度和 arrayBufferView 属性的对象。
 * @param {number} [options.xOffset=0] 要复制到的纹理中 x 方向的偏移量。
 * @param {number} [options.yOffset=0] 要复制到的纹理中 y 方向的偏移量。
 * @param {boolean} [options.skipColorSpaceConversion=false] 如果为 true，则忽略纹理中的任何自定义伽马或颜色配置文件。
 *
 * @exception {DeveloperError} Cannot 当纹理像素格式为 DEPTH_COMPONENT 或 DEPTH_STENCIL 时调用 copyFrom。
 * @exception {DeveloperError} Cannot 使用压缩的纹理像素格式调用 copyFrom。
 * @exception {DeveloperError} xOffset 必须大于或等于零。
 * @exception {DeveloperError} yOffset 必须大于或等于零。
 * @exception {DeveloperError} xOffset + source.width 必须小于或等于 width。
 * @exception {DeveloperError} yOffset + source.height 必须小于或等于 height。
 * @exception {DeveloperError} This 纹理已被销毁，即已调用 destroy()。
 * @private
 * @example
 * texture.copyFrom({
 * source: {
 * width : 1,
 * height : 1,
 * arrayBufferView : new Uint8Array([255, 0, 0, 255])
 *  }
 * });
 */
Texture.prototype.copyFrom = function (options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("options", options);
  //>>includeEnd('debug');

  const {
    xOffset = 0,
    yOffset = 0,
    source,
    skipColorSpaceConversion = false,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.source", source);
  if (PixelFormat.isDepthFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Cannot call copyFrom when the texture pixel format is DEPTH_COMPONENT or DEPTH_STENCIL.",
    );
  }
  if (PixelFormat.isCompressedFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Cannot call copyFrom with a compressed texture pixel format.",
    );
  }
  Check.typeOf.number.greaterThanOrEquals("xOffset", xOffset, 0);
  Check.typeOf.number.greaterThanOrEquals("yOffset", yOffset, 0);
  Check.typeOf.number.lessThanOrEquals(
    "xOffset + options.source.width",
    xOffset + source.width,
    this._width,
  );
  Check.typeOf.number.lessThanOrEquals(
    "yOffset + options.source.height",
    yOffset + source.height,
    this._height,
  );
  //>>includeEnd('debug');

  const context = this._context;
  const gl = context._gl;
  const target = this._textureTarget;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, this._texture);

  let { width, height } = source;

  // Make sure we are using the element's intrinsic width and height where available
  if (defined(source.videoWidth) && defined(source.videoHeight)) {
    width = source.videoWidth;
    height = source.videoHeight;
  } else if (defined(source.naturalWidth) && defined(source.naturalHeight)) {
    width = source.naturalWidth;
    height = source.naturalHeight;
  }

  if (skipColorSpaceConversion) {
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  } else {
    gl.pixelStorei(
      gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
      gl.BROWSER_DEFAULT_WEBGL,
    );
  }

  let uploaded = false;
  if (!this._initialized) {
    if (
      xOffset === 0 &&
      yOffset === 0 &&
      width === this._width &&
      height === this._height
    ) {
      // initialize the entire texture
      if (defined(source.arrayBufferView)) {
        loadBufferSource(this, source);
      } else {
        loadImageSource(this, source);
      }
      uploaded = true;
    } else {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      loadNull(this);
    }
    this._initialized = true;
  }

  if (!uploaded) {
    if (defined(source.arrayBufferView)) {
      loadPartialBufferSource(
        this,
        source.arrayBufferView,
        xOffset,
        yOffset,
        width,
        height,
      );
    } else {
      loadPartialImageSource(this, source, xOffset, yOffset);
    }
  }

  gl.bindTexture(target, null);
};

/**
 * @param {number} [xOffset=0] 要复制到的纹理中 x 方向的偏移量。
 * @param {number} [yOffset=0] 要复制到的纹理中 y 方向的偏移量。
 * @param {number} [framebufferXOffset=0] 可选
 * @param {number} [framebufferYOffset=0] 可选
 * @param {number} [width=width] 可选
 * @param {number} [height=height] 可选
 * @private
 * @exception {DeveloperError} Cannot 当纹理像素格式为 DEPTH_COMPONENT 或 DEPTH_STENCIL 时调用 copyFromFramebuffer。
 * @exception {DeveloperError} Cannot 当纹理像素数据类型为 FLOAT 时调用 copyFromFramebuffer。
 * @exception {DeveloperError} Cannot 当纹理像素数据类型为 HALF_FLOAT 时调用 copyFromFramebuffer。
 * @exception {DeveloperError} Cannot 使用压缩的纹理像素格式调用 copyFrom。
 * @exception {DeveloperError} This 纹理已被销毁，即已调用 destroy()。
 * @exception {DeveloperError} xOffset 必须大于或等于零。
 * @exception {DeveloperError} yOffset 必须大于或等于零。
 * @exception {DeveloperError} framebufferXOffset 必须大于或等于零。
 * @exception {DeveloperError} framebufferYOffset 必须大于或等于零。
 * @exception {DeveloperError} xOffset + width 必须小于或等于 width。
 * @exception {DeveloperError} yOffset + height 必须小于或等于 height。
 */
Texture.prototype.copyFromFramebuffer = function (
  xOffset,
  yOffset,
  framebufferXOffset,
  framebufferYOffset,
  width,
  height,
) {
  xOffset = xOffset ?? 0;
  yOffset = yOffset ?? 0;
  framebufferXOffset = framebufferXOffset ?? 0;
  framebufferYOffset = framebufferYOffset ?? 0;
  width = width ?? this._width;
  height = height ?? this._height;

  //>>includeStart('debug', pragmas.debug);
  if (PixelFormat.isDepthFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Cannot call copyFromFramebuffer when the texture pixel format is DEPTH_COMPONENT or DEPTH_STENCIL.",
    );
  }
  if (this._pixelDatatype === PixelDatatype.FLOAT) {
    throw new DeveloperError(
      "Cannot call copyFromFramebuffer when the texture pixel data type is FLOAT.",
    );
  }
  if (this._pixelDatatype === PixelDatatype.HALF_FLOAT) {
    throw new DeveloperError(
      "Cannot call copyFromFramebuffer when the texture pixel data type is HALF_FLOAT.",
    );
  }
  if (PixelFormat.isCompressedFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Cannot call copyFrom with a compressed texture pixel format.",
    );
  }

  Check.typeOf.number.greaterThanOrEquals("xOffset", xOffset, 0);
  Check.typeOf.number.greaterThanOrEquals("yOffset", yOffset, 0);
  Check.typeOf.number.greaterThanOrEquals(
    "framebufferXOffset",
    framebufferXOffset,
    0,
  );
  Check.typeOf.number.greaterThanOrEquals(
    "framebufferYOffset",
    framebufferYOffset,
    0,
  );
  Check.typeOf.number.lessThanOrEquals(
    "xOffset + width",
    xOffset + width,
    this._width,
  );
  Check.typeOf.number.lessThanOrEquals(
    "yOffset + height",
    yOffset + height,
    this._height,
  );
  //>>includeEnd('debug');

  const gl = this._context._gl;
  const target = this._textureTarget;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, this._texture);
  gl.copyTexSubImage2D(
    target,
    0,
    xOffset,
    yOffset,
    framebufferXOffset,
    framebufferYOffset,
    width,
    height,
  );
  gl.bindTexture(target, null);
  this._initialized = true;
};

/**
 * @param {MipmapHint} [hint=MipmapHint.DONT_CARE] 可选。
 * @private
 * @exception {DeveloperError} Cannot 当纹理像素格式为 DEPTH_COMPONENT 或 DEPTH_STENCIL 时调用 generateMipmap。
 * @exception {DeveloperError} Cannot 当纹理像素格式为压缩格式时调用 generateMipmap。
 * @exception {DeveloperError} hint 无效。
 * @exception {DeveloperError} This 在 WebGL1 环境中调用 generateMipmap() 时，纹理的宽度必须是2的幂次。
 * @exception {DeveloperError} This 在 WebGL1 环境中调用 generateMipmap() 时，纹理的高度必须是2的幂次。
 * @exception {DeveloperError} This 纹理已被销毁，即已调用 destroy()。
 */
Texture.prototype.generateMipmap = function (hint) {
  hint = hint ?? MipmapHint.DONT_CARE;

  //>>includeStart('debug', pragmas.debug);
  if (PixelFormat.isDepthFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Cannot call generateMipmap when the texture pixel format is DEPTH_COMPONENT or DEPTH_STENCIL.",
    );
  }
  if (PixelFormat.isCompressedFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Cannot call generateMipmap with a compressed pixel format.",
    );
  }
  if (!this._context.webgl2) {
    if (this._width > 1 && !CesiumMath.isPowerOfTwo(this._width)) {
      throw new DeveloperError(
        "width must be a power of two to call generateMipmap() in a WebGL1 context.",
      );
    }
    if (this._height > 1 && !CesiumMath.isPowerOfTwo(this._height)) {
      throw new DeveloperError(
        "height must be a power of two to call generateMipmap() in a WebGL1 context.",
      );
    }
  }
  if (!MipmapHint.validate(hint)) {
    throw new DeveloperError("hint is invalid.");
  }
  //>>includeEnd('debug');

  this._hasMipmap = true;

  const gl = this._context._gl;
  const target = this._textureTarget;

  gl.hint(gl.GENERATE_MIPMAP_HINT, hint);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, this._texture);
  gl.generateMipmap(target);
  gl.bindTexture(target, null);
};

Texture.prototype.isDestroyed = function () {
  return false;
};

Texture.prototype.destroy = function () {
  this._context._gl.deleteTexture(this._texture);
  return destroyObject(this);
};

/**
 * 其他纹理下载期间用作占位纹理的默认颜色。
 * 此值可以全局更改以自定义占位纹理的外观。
 *
 * @type {Color}
 * @default Color.WHITE
 */
Texture.defaultColor = Color.WHITE;

export default Texture;
