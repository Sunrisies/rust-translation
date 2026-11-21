import {
  Check,
  DeveloperError,
  PixelDatatype,
  PixelFormat,
  defined,
} from "@cesium/core";

/**
 * @private
 */
function CubeMapFace(
  context,
  texture,
  textureTarget,
  targetFace,
  internalFormat,
  pixelFormat,
  pixelDatatype,
  size,
  preMultiplyAlpha,
  flipY,
  initialized,
) {
  this._context = context;
  this._texture = texture;
  this._textureTarget = textureTarget;
  this._targetFace = targetFace;
  this._pixelDatatype = pixelDatatype;
  this._internalFormat = internalFormat;
  this._pixelFormat = pixelFormat;
  this._size = size;
  this._preMultiplyAlpha = preMultiplyAlpha;
  this._flipY = flipY;
  this._initialized = initialized;
}

Object.defineProperties(CubeMapFace.prototype, {
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
  _target: {
    get: function () {
      return this._targetFace;
    },
  },
});

/**
 * 从源纹理复制 texel 到 cubemap 的面上。
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.source 源 {@link ImageData}、{@link HTMLImageElement}、{@link HTMLCanvasElement}、{@link HTMLVideoElement}，
 * 或具有宽度、高度和 arrayBufferView 属性的对象。
 * @param {number} [options.xOffset=0] 在 cubemap 中复制开始的 x 方向偏移量。
 * @param {number} [options.yOffset=0] 在 cubemap 中复制开始的 y 方向偏移量。
 * @param {boolean} [options.skipColorSpaceConversion=false] 如果为 true，则纹理中的任何自定义伽马或颜色配置文件将被忽略。
 * @exception {DeveloperError} xOffset 必须大于或等于零。
 * @exception {DeveloperError} yOffset 必须大于或等于零。
 * @exception {DeveloperError} xOffset + 源宽度必须小于或等于宽度。
 * @exception {DeveloperError} yOffset + 源高度必须小于或等于高度。
 * @exception {DeveloperError} This CubeMap 已被销毁，即调用了 destroy()。
 *
 * @example
 * // 创建一个具有 1x1 面的 cubemap，并将 +x 面设为红色。
 * const cubeMap = new CubeMap({
 * context : context
 * width : 1,
 * height : 1
 * });
 * cubeMap.positiveX.copyFrom({
 * source: {
 * width : 1,
 * height : 1,
 * arrayBufferView : new Uint8Array([255, 0, 0, 255])
 *   }
 * });
 */
CubeMapFace.prototype.copyFrom = function (options) {
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
  Check.typeOf.number.greaterThanOrEquals("xOffset", xOffset, 0);
  Check.typeOf.number.greaterThanOrEquals("yOffset", yOffset, 0);
  if (xOffset + source.width > this._size) {
    throw new DeveloperError(
      "xOffset + options.source.width must be less than or equal to width.",
    );
  }
  if (yOffset + source.height > this._size) {
    throw new DeveloperError(
      "yOffset + options.source.height must be less than or equal to height.",
    );
  }
  //>>includeEnd('debug');

  const { width, height } = source;

  const gl = this._context._gl;
  const target = this._textureTarget;
  const targetFace = this._targetFace;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, this._texture);

  let arrayBufferView = source.arrayBufferView;

  const size = this._size;
  const pixelFormat = this._pixelFormat;
  const internalFormat = this._internalFormat;
  const pixelDatatype = this._pixelDatatype;

  const preMultiplyAlpha = this._preMultiplyAlpha;
  const flipY = this._flipY;

  let unpackAlignment = 4;
  if (defined(arrayBufferView)) {
    unpackAlignment = PixelFormat.alignmentInBytes(
      pixelFormat,
      pixelDatatype,
      width,
    );
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, unpackAlignment);

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
    let pixels;
    if (xOffset === 0 && yOffset === 0 && width === size && height === size) {
      // initialize the entire texture
      if (defined(arrayBufferView)) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        if (flipY) {
          arrayBufferView = PixelFormat.flipY(
            arrayBufferView,
            pixelFormat,
            pixelDatatype,
            size,
            size,
          );
        }
        pixels = arrayBufferView;
      } else {
        // Only valid for DOM-Element uploads
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, preMultiplyAlpha);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
        pixels = source;
      }
      uploaded = true;
    } else {
      // initialize the entire texture to zero
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      pixels = PixelFormat.createTypedArray(
        pixelFormat,
        pixelDatatype,
        size,
        size,
      );
    }
    gl.texImage2D(
      targetFace,
      0,
      internalFormat,
      size,
      size,
      0,
      pixelFormat,
      PixelDatatype.toWebGLConstant(pixelDatatype, this._context.webgl2),
      pixels,
    );
    this._initialized = true;
  }

  if (!uploaded) {
    if (defined(arrayBufferView)) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      if (flipY) {
        arrayBufferView = PixelFormat.flipY(
          arrayBufferView,
          pixelFormat,
          pixelDatatype,
          width,
          height,
        );
      }
      gl.texSubImage2D(
        targetFace,
        0,
        xOffset,
        yOffset,
        width,
        height,
        pixelFormat,
        PixelDatatype.toWebGLConstant(pixelDatatype, this._context.webgl2),
        arrayBufferView,
      );
    } else {
      // Only valid for DOM-Element uploads
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, preMultiplyAlpha);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);

      // Source: ImageData, HTMLImageElement, HTMLCanvasElement, or HTMLVideoElement
      gl.texSubImage2D(
        targetFace,
        0,
        xOffset,
        yOffset,
        pixelFormat,
        PixelDatatype.toWebGLConstant(pixelDatatype, this._context.webgl2),
        source,
      );
    }
  }

  gl.bindTexture(target, null);
};

/**
 * 从帧缓冲区复制 texel 到 cubemap 的面上。
 * @param {number} [xOffset=0] 在 cubemap 中复制开始的 x 方向偏移量。
 * @param {number} [yOffset=0] 在 cubemap 中复制开始的 y 方向偏移量。
 * @param {number} [framebufferXOffset=0] 从帧缓冲区的 x 方向偏移量开始复制。
 * @param {number} [framebufferYOffset=0] 从帧缓冲区的 y 方向偏移量开始复制。
 * @param {number} [width=CubeMap's width] 要复制的子图像的宽度。
 * @param {number} [height=CubeMap's height] 要复制的子图像的高度。
 * @throws {DeveloperError} Cannot 当纹理像素数据类型为 FLOAT 时，调用 copyFromFramebuffer。
 * @throws {DeveloperError} Cannot 当纹理像素数据类型为 HALF_FLOAT 时，调用 copyFromFramebuffer。
 * @throws {DeveloperError} This CubeMap 已被销毁，即调用了 destroy()。
 * @throws {DeveloperError} xOffset 必须大于或等于零。
 * @throws {DeveloperError} yOffset 必须大于或等于零。
 * @throws {DeveloperError} framebufferXOffset 必须大于或等于零。
 * @throws {DeveloperError} framebufferYOffset 必须大于或等于零。
 * @throws {DeveloperError} xOffset + 源宽度必须小于或等于宽度。
 * @throws {DeveloperError} yOffset + 源高度必须小于或等于高度。
 * @throws {DeveloperError} This CubeMap 已被销毁，即调用了 destroy()。
 * @example
 * // 将帧缓冲区内容复制到 +x cubemap 面上。
 * cubeMap.positiveX.copyFromFramebuffer();
 */
CubeMapFace.prototype.copyFromFramebuffer = function (
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
  width = width ?? this._size;
  height = height ?? this._size;

  //>>includeStart('debug', pragmas.debug);
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
  if (xOffset + width > this._size) {
    throw new DeveloperError(
      "xOffset + source.width must be less than or equal to width.",
    );
  }
  if (yOffset + height > this._size) {
    throw new DeveloperError(
      "yOffset + source.height must be less than or equal to height.",
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
  //>>includeEnd('debug');

  const gl = this._context._gl;
  const target = this._textureTarget;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, this._texture);
  gl.copyTexSubImage2D(
    this._targetFace,
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
 * 从帧缓冲区复制 texel 到 cubemap 的 mipmap 面上。
 * @param {number} [xOffset=0] 从帧缓冲区的 x 方向偏移量开始复制。
 * @param {number} [yOffset=0] 从帧缓冲区的 y 方向偏移量开始复制。
 * @param {number} [width=CubeMap's width] 要复制的子图像的宽度。
 * @param {number} [height=CubeMap's height] 要复制的子图像的高度。
 * @param {number} [level=0] 细节级别。级别 0 是基础图像级别，级别 n 是第 n 级 MIP 映射简化级别。
 * @throws {DeveloperError} Cannot 当纹理像素数据类型为 FLOAT 时，调用 copyFromFramebuffer。
 * @throws {DeveloperError} Cannot 当纹理像素数据类型为 HALF_FLOAT 时，调用 copyFromFramebuffer。
 * @throws {DeveloperError} This CubeMap 已被销毁，即调用了 destroy()。
 * @throws {DeveloperError} xOffset 必须大于等于零。
 * @throws {DeveloperError} yOffset 必须大于等于零。
 * @throws {DeveloperError} framebufferXOffset 必须大于等于零。
 * @throws {DeveloperError} framebufferYOffset 必须大于等于零。
 * @throws {DeveloperError} xOffset + source.width 必须小于或等于 width。
 * @throws {DeveloperError} yOffset + source.height 必须小于或等于 height。
 * @throws {DeveloperError} This CubeMap 已被销毁，即调用了 destroy()。
 *
 * @example
 * // 将 framebuffer 内容复制到 +x 立方体面。
 * cubeMap.positiveX.copyFromFramebuffer();
 */
CubeMapFace.prototype.copyMipmapFromFramebuffer = function (
  xOffset,
  yOffset,
  width,
  height,
  level,
) {
  xOffset = xOffset ?? 0;
  yOffset = yOffset ?? 0;
  width = width ?? this._size;
  height = height ?? this._size;
  level = level ?? 0;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThanOrEquals("xOffset", xOffset, 0);
  Check.typeOf.number.greaterThanOrEquals("yOffset", yOffset, 0);

  if (xOffset + width > this._size) {
    throw new DeveloperError(
      "xOffset + source.width must be less than or equal to width.",
    );
  }
  if (yOffset + height > this._size) {
    throw new DeveloperError(
      "yOffset + source.height must be less than or equal to height.",
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
  //>>includeEnd('debug');

  const gl = this._context._gl;
  const target = this._textureTarget;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, this._texture);
  gl.copyTexImage2D(
    this._targetFace,
    level,
    this._internalFormat,
    xOffset,
    yOffset,
    width,
    height,
    0,
  );
  gl.bindTexture(target, null);
  this._initialized = true;
};
export default CubeMapFace;
