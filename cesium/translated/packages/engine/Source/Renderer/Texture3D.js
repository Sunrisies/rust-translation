import {
  Cartesian3,
  Check,
  DeveloperError,
  Frozen,
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
 * @typedef {object} Texture3D.Source
 * @property {number} width 3D 纹理源数据的宽度（以像素为单位）。
 * @property {number} height 3D 纹理源数据的高度（以像素为单位）。
 * @property {number} depth 3D 纹理源数据的深度（以像素为单位）。
 * @property {TypedArray|DataView} arrayBufferView 3D 纹理的源数据。每个元素的类型必须与 pixelDatatype 匹配。
 * @property {TypedArray|DataView} [mipLevels] 多级细节数据数组。数组中的每个元素都必须是与 pixelDatatype 匹配的 TypedArray 或 DataView。
 */

/**
 * @typedef {object} Texture3D.ConstructorOptions
 *
 * @property {Context} context
 * @property {Texture3D.Source} [source] 要加载到 3D 纹理中的 texel 值的来源。
 * @property {PixelFormat} [pixelFormat=PixelFormat.RGBA] 每个像素的格式，即其组件数量及其含义。
 * @property {PixelDatatype} [pixelDatatype=PixelDatatype.UNSIGNED_BYTE] 每个像素的数据类型。
 * @property {boolean} [flipY=true] 如果为 true，源值将按 y 轴反转的方式读取（y=0 位于顶部）。
 * @property {boolean} [skipColorSpaceConversion=false] 如果为 true，读取 texel 值时将跳过颜色空间转换。
 * @property {Sampler} [sampler] 关于如何采样 3D 纹理的信息。
 * @property {number} [width] 3D 纹理的宽度（以像素为单位）。如果未提供，则必须从源中获取。
 * @property {number} [height] 3D 纹理的高度（以像素为单位）。如果未提供，则必须从源中获取。
 * @property {number} [depth] 3D 纹理的深度（以像素为单位）。如果未提供，则必须从源中获取。
 * @property {boolean} [preMultiplyAlpha] 如果为 true，alpha 通道将与其他通道相乘。
 * @property {string} [id] 3D 纹理的唯一标识符。如果未提供，则将创建 GUID。
 *
 * @private
 */

/**
 * 用于包装 {@link https://developer.mozilla.org/en-US/docs/Web/API/WebGLTexture|WebGLTexture} 的包装器，以抽象掉设置 texture3D 时相关的冗长 GL 调用。
 * 用于隐藏设置 texture3D 时相关的复杂 GL 调用。
 *
 * @alias Texture3D
 * @constructor
 *
 * @param {Texture3D.ConstructorOptions} options
 * @private
 */
function Texture3D(options) {
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

  // 3D textures are not supported in a WebGL1 context. But we allow a stub context for testing.
  if (!context.webgl2 && !defined(context.options.getWebGLStub)) {
    throw new DeveloperError(
      "WebGL1 does not support texture3D. Please use a WebGL2 context.",
    );
  }

  let { width, height, depth } = options;
  if (defined(source)) {
    // Make sure we are using the element's intrinsic width and height where available
    if (!defined(width)) {
      width = source.width;
    }
    if (!defined(height)) {
      height = source.height;
    }
    // depth is not used for 2D textures, but is required for 3D textures
    if (!defined(depth)) {
      depth = source.depth;
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
  if (!defined(width) || !defined(height) || !defined(depth)) {
    throw new DeveloperError(
      "options requires a source field to create an initialized texture3D or width, height and depth fields to create a blank texture3D.",
    );
  }

  Check.typeOf.number.greaterThan("width", width, 0);

  if (width > ContextLimits.maximum3DTextureSize) {
    throw new DeveloperError(
      `Width must be less than or equal to the maximum texture3D size (${ContextLimits.maximum3DTextureSize}).  Check maximum3DTextureSize.`,
    );
  }

  Check.typeOf.number.greaterThan("height", height, 0);

  if (height > ContextLimits.maximum3DTextureSize) {
    throw new DeveloperError(
      `Height must be less than or equal to the maximum texture3D size (${ContextLimits.maximum3DTextureSize}).  Check maximum3DTextureSize.`,
    );
  }

  Check.typeOf.number.greaterThan("depth", depth, 0);

  if (depth > ContextLimits.maximum3DTextureSize) {
    throw new DeveloperError(
      `Depth must be less than or equal to the maximum texture3D size (${ContextLimits.maximum3DTextureSize}).  Check maximum3DTextureSize.`,
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
    throw new DeveloperError(
      "Texture3D does not currently support compressed formats.",
    );
  }
  //>>includeEnd('debug');

  const gl = context._gl;

  const sizeInBytes = PixelFormat.texture3DSizeInBytes(
    pixelFormat,
    pixelDatatype,
    width,
    height,
    depth,
  );

  this._id = options.id ?? createGuid();
  this._context = context;
  this._textureFilterAnisotropic = context._textureFilterAnisotropic;
  this._textureTarget = gl.TEXTURE_3D;
  this._texture = gl.createTexture();
  this._internalFormat = internalFormat;
  this._pixelFormat = pixelFormat;
  this._pixelDatatype = pixelDatatype;
  this._width = width;
  this._height = height;
  this._depth = depth;
  this._dimensions = new Cartesian3(width, height, depth);
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
    if (!defined(source.arrayBufferView)) {
      throw new DeveloperError(
        "For Texture3D, options.source.arrayBufferView must be defined",
      );
    }

    loadBufferSource(this, source);

    this._initialized = true;
  } else {
    loadNull(this);
  }

  gl.bindTexture(this._textureTarget, null);
}

/**
 * 将缓冲区中的 texel 数据加载到 texture3D 中。
 *
 * @param {Texture3D} texture3D 要加载 texel 值的 texture3D。
 * @param {Texture3D.Source} source 要加载 texel 值到 texture3D 的源。
 *
 * @private
 */
function loadBufferSource(texture3D, source) {
  const context = texture3D._context;
  const gl = context._gl;
  const textureTarget = texture3D._textureTarget;
  const internalFormat = texture3D._internalFormat;

  const { width, height, depth, pixelFormat, pixelDatatype, flipY } = texture3D;

  const unpackAlignment = PixelFormat.alignmentInBytes(
    pixelFormat,
    pixelDatatype,
    width,
  );
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, unpackAlignment);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  const { arrayBufferView } = source;
  if (flipY) {
    console.warn("texture3D.flipY is not supported.");
  }

  let levels = 1;
  if (source.mipLevels && source.mipLevels.length) {
    levels = source.mipLevels.length + 1;
  }
  gl.texStorage3D(textureTarget, levels, internalFormat, width, height, depth);

  gl.texSubImage3D(
    textureTarget,
    0,
    0,
    0,
    0,
    width,
    height,
    depth,
    pixelFormat,
    PixelDatatype.toWebGLConstant(pixelDatatype, context.webgl2),
    arrayBufferView,
  );

  if (levels > 1) {
    let mipWidth = width;
    let mipHeight = height;
    let mipDepth = depth;
    for (let i = 0; i < source.mipLevels.length; ++i) {
      mipWidth = nextMipSize(mipWidth);
      mipHeight = nextMipSize(mipHeight);
      mipDepth = nextMipSize(mipDepth);
      gl.texSubImage3D(
        textureTarget,
        i + 1,
        0,
        0,
        0,
        mipWidth,
        mipHeight,
        mipDepth,
        pixelFormat,
        PixelDatatype.toWebGLConstant(pixelDatatype, context.webgl2),
        source.mipLevels[i],
      );
    }
  }
}

/**
 * 将具有宽度、高度、深度和 arrayBufferView 属性的源对象中的新图像数据复制到此纹理中。
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.source 具有宽度、高度、深度和 arrayBufferView 属性的源对象。
 * @param {number} [options.xOffset=0] 要复制到的纹理中 x 方向的偏移量。
 * @param {number} [options.yOffset=0] 要复制到的纹理中 y 方向的偏移量。
 * @param {number} [options.zOffset=0] 要复制到的纹理中 z 方向的偏移量。
 * @param {boolean} [options.skipColorSpaceConversion=false] 如果为 true，则忽略纹理中的任何自定义伽马或颜色配置文件。
 *
 * @exception {DeveloperError} Unsupported 使用压缩纹理像素格式进行 copyFrom 操作。
 * @exception {DeveloperError} xOffset 必须大于或等于零。
 * @exception {DeveloperError} yOffset 必须大于或等于零。
 * @exception {DeveloperError} zOffset 必须大于或等于零。
 * @exception {DeveloperError} xOffset + source.width 必须小于或等于宽度。
 * @exception {DeveloperError} yOffset + 源数据的高度必须小于或等于目标高度。
 * @exception {DeveloperError} zOffset + 源数据的深度必须小于或等于目标深度。
 * @exception {DeveloperError} This 纹理已被破坏，即已调用了 destroy() 方法。
 * @private
 * @example
 * texture.copyFrom({
 * source: {
 * 宽度：1，
 * 高度：1，
 * 深度：1，
 * arrayBufferView：new Uint8Array([255, 0, 0, 255])
 *  }
 * });
 */
Texture3D.prototype.copyFrom = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const { source, xOffset = 0, yOffset = 0, zOffset = 0 } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.source", source);
  Check.defined("options.source.arrayBufferView", source.arrayBufferView);
  if (PixelFormat.isCompressedFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Unsupported copyFrom with a compressed texture pixel format.",
    );
  }
  Check.typeOf.number.greaterThanOrEquals("xOffset", xOffset, 0);
  Check.typeOf.number.greaterThanOrEquals("yOffset", yOffset, 0);
  Check.typeOf.number.greaterThanOrEquals("zOffset", zOffset, 0);
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
  Check.typeOf.number.lessThanOrEquals(
    "zOffset + options.source.depth",
    zOffset + source.depth,
    this._depth,
  );
  //>>includeEnd('debug');

  const context = this._context;
  const gl = context._gl;
  const target = this._textureTarget;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, this._texture);

  const { width, height, depth } = source;
  let uploaded = false;
  if (!this._initialized) {
    if (
      xOffset === 0 &&
      yOffset === 0 &&
      zOffset === 0 &&
      width === this._width &&
      height === this._height &&
      depth === this._depth
    ) {
      loadBufferSource(this, source);
      uploaded = true;
    } else {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      loadNull(this);
    }
    this._initialized = true;
  }

  if (!uploaded) {
    loadPartialBufferSource(
      this,
      source.arrayBufferView,
      xOffset,
      yOffset,
      zOffset,
      width,
      height,
      depth,
    );
  }

  gl.bindTexture(target, null);
};

/**
 * 从缓冲区加载纹理像素数据到 3D 纹理中
 *
 * @param {Texture3D} texture3D 将加载纹理像素值的 3D 纹理。
 * @param {TypedArray} arrayBufferView 将加载到 3D 纹理中的纹理像素值。
 * @param {number} xOffset 要更新的纹理子区域左下角的纹理像素 x 坐标。
 * @param {number} yOffset 要更新的纹理子区域左下角的纹理像素 y 坐标。
 * @param {number} zOffset 要更新的纹理子区域左下角的纹理像素 z 坐标。
 * @param {number} width 源数据的宽度，以像素为单位。
 * @param {number} height 源数据的高度，以像素为单位。
 * @param {number} depth 源数据的深度，以像素为单位。
 *
 * @private
 */
function loadPartialBufferSource(
  texture3D,
  arrayBufferView,
  xOffset,
  yOffset,
  zOffset,
  width,
  height,
  depth,
) {
  const context = texture3D._context;
  const gl = context._gl;

  const { pixelFormat, pixelDatatype } = texture3D;

  const unpackAlignment = PixelFormat.alignmentInBytes(
    pixelFormat,
    pixelDatatype,
    width,
  );
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, unpackAlignment);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  gl.texSubImage3D(
    texture3D._textureTarget,
    0,
    xOffset,
    yOffset,
    zOffset,
    width,
    height,
    depth,
    pixelFormat,
    PixelDatatype.toWebGLConstant(pixelDatatype, context.webgl2),
    arrayBufferView,
  );
}

/**
 * 计算下一 mip 级的图像维度。
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
 * 在不提供任何图像数据的情况下，在 GPU 内存中分配一个 3D 纹理。
 *
 * @param {Texture3D} texture3D 将用空值初始化的 3D 纹理。
 *
 * @private
 */
function loadNull(texture3D) {
  const context = texture3D._context;

  context._gl.texImage3D(
    texture3D._textureTarget,
    0,
    texture3D._internalFormat,
    texture3D._width,
    texture3D._height,
    texture3D._depth,
    0,
    texture3D._pixelFormat,
    PixelDatatype.toWebGLConstant(texture3D._pixelDatatype, context.webgl2),
    null,
  );
}

/**
 * 此函数与使用 Texture3D 构造函数相同，不同之处在于它可以在测试中替换为模拟/监视器。
 * 3D 纹理的唯一 ID。
 * @private
 */
Texture3D.create = function (options) {
  return new Texture3D(options);
};

Object.defineProperties(Texture3D.prototype, {
  /**
   * 采样此 3D 纹理时使用的采样器。
   * @memberof Texture3D.prototype
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
   * 通过调用 {@link Sampler} 创建采样器。如果未指定此参数，则使用默认采样器。默认采样器在两个方向上限制 3D 纹理的坐标，对放大和缩小均使用线性过滤，并且最大各向异性为 1.0。
   * 为 3D 纹理设置用于使用的采样器。
   * 此采样器将采样的 3D 纹理。
   * 关于如何采样 3D 纹理的信息。
   * 可选参数。
   * @memberof Texture3D.prototype
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
  depth: {
    get: function () {
      return this._depth;
    },
  },
  sizeInBytes: {
    get: function () {
      if (this._hasMipmap) {
        return Math.floor((this._sizeInBytes * 8) / 7);
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
 * 当 3D 纹理的像素格式为 DEPTH_COMPONENT 或 DEPTH_STENCIL 时，调用 generateMipmap()。
 * @param {Texture3D} texture3D 当 3D 纹理的像素格式为压缩格式时，调用 generateMipmap()。
 * @param {Sampler} sampler 无效。
 * @private
 */
function setupSampler(texture3D, sampler) {
  let { minificationFilter, magnificationFilter } = sampler;

  const mipmap = [
    TextureMinificationFilter.NEAREST_MIPMAP_NEAREST,
    TextureMinificationFilter.NEAREST_MIPMAP_LINEAR,
    TextureMinificationFilter.LINEAR_MIPMAP_NEAREST,
    TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
  ].includes(minificationFilter);

  const context = texture3D._context;
  const pixelFormat = texture3D._pixelFormat;
  const pixelDatatype = texture3D._pixelDatatype;

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

  // WebGL 2 depth texture3D only support nearest filtering. See section 3.8.13 OpenGL ES 3 spec
  if (PixelFormat.isDepthFormat(pixelFormat)) {
    minificationFilter = TextureMinificationFilter.NEAREST;
    magnificationFilter = TextureMagnificationFilter.NEAREST;
  }

  const gl = context._gl;
  const target = texture3D._textureTarget;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, texture3D._texture);
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, minificationFilter);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, magnificationFilter);
  gl.texParameteri(target, gl.TEXTURE_WRAP_R, sampler.wrapR);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, sampler.wrapS);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, sampler.wrapT);
  if (defined(texture3D._textureFilterAnisotropic)) {
    gl.texParameteri(
      target,
      texture3D._textureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
      sampler.maximumAnisotropy,
    );
  }
  gl.bindTexture(target, null);
}

/**
 * @param {MipmapHint} [hint=MipmapHint.DONT_CARE] 在 WebGL1 上下文中调用 generateMipmap() 时，3D 纹理的宽度必须是2的幂次。
 * @private
 * @exception {DeveloperError} Cannot 在 WebGL1 上下文中调用 generateMipmap() 时，3D 纹理的高度必须是2的幂次。
 * @exception {DeveloperError} Cannot 3D 纹理已被破坏，即已调用了 destroy() 方法。
 * @exception {DeveloperError} hint is invalid.
 * @exception {DeveloperError} This texture3D's width must be a power of two to call generateMipmap() in a WebGL1 context.
 * @exception {DeveloperError} This texture3D's height must be a power of two to call generateMipmap() in a WebGL1 context.
 * @exception {DeveloperError} This texture3D was destroyed, i.e., destroy() was called.
 */
Texture3D.prototype.generateMipmap = function (hint) {
  hint = hint ?? MipmapHint.DONT_CARE;

  //>>includeStart('debug', pragmas.debug);
  if (PixelFormat.isDepthFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Cannot call generateMipmap when the texture3D pixel format is DEPTH_COMPONENT or DEPTH_STENCIL.",
    );
  }
  if (PixelFormat.isCompressedFormat(this._pixelFormat)) {
    throw new DeveloperError(
      "Cannot call generateMipmap with a compressed pixel format.",
    );
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

Texture3D.prototype.isDestroyed = function () {
  return false;
};

Texture3D.prototype.destroy = function () {
  this._context._gl.deleteTexture(this._texture);
  return destroyObject(this);
};
export default Texture3D;
