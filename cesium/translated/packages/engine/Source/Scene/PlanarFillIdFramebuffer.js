import {
  Color,
  PixelDatatype,
  PixelFormat,
  defined,
  destroyObject,
} from "@cesium/core";
import FramebufferManager from "../Renderer/FramebufferManager.js";
import ClearCommand from "../Renderer/ClearCommand.js";

/**
 * 创建并管理用于平面填充功能 ID 预处理的帧缓冲区。
 *
 * 在此处理过程中，非背景平面填充几何图形将其特征 ID 写入屏幕大小的纹理中。
 * 随后，具有
 * <code>behind: true</code> (BENTLEY_materials_planar_fill) 的基元会采样此纹理。
 * 纹理以判断它们即将覆盖的像素是否属于
 * 相同的逻辑对象（相同的特征 ID）。只有在这种情况下，才会应用额外的深度偏移，将填充内容推至其对象边缘之后。
 * 以及非背景填充——但不会推至其他对象之后。
 * 布局如下：
 *
 * Layout:
 * 颜色附件 0 – R32F（单个红色通道）：编码后的特征 ID。
 * 深度模板附件——与主场景共享，用于正确的深度测试。
 *
 * @alias PlanarFillIdFramebuffer
 * @constructor
 * @private
 */
function PlanarFillIdFramebuffer() {
  this._framebufferManager = new FramebufferManager({
    colorAttachmentsLength: 1,
    createColorAttachments: true,
    depthStencil: true,
    supportsDepthTexture: true,
    color: true,
  });

  this._framebuffer = undefined;
  this._idTexture = undefined;
  this._depthStencilTexture = undefined;

  this._clearCommand = new ClearCommand({
    color: new Color(0.0, 0.0, 0.0, 0.0),
    depth: 1.0,
    stencil: 0,
    owner: this,
  });
}

Object.defineProperties(PlanarFillIdFramebuffer.prototype, {
  /**
   * 获取底层的帧缓冲区。
   * @memberof PlanarFillIdFramebuffer.prototype
   * @type {Framebuffer}
   * @readonly
   */
  framebuffer: {
    get: function () {
      return this._framebuffer;
    },
  },

  /**
   * 获取特征 ID 纹理（颜色附件 0）。
   * @memberof PlanarFillIdFramebuffer.prototype
   * @type {Texture}
   * @readonly
   */
  idTexture: {
    get: function () {
      return this._idTexture;
    },
  },

  /**
   * 获取深度模板纹理。
   * @memberof PlanarFillIdFramebuffer.prototype
   * @type {Texture}
   * @readonly
   */
  depthStencilTexture: {
    get: function () {
      return this._depthStencilTexture;
    },
  },
});

/**
 * 更新（创建/调整大小）帧缓冲区以匹配视口大小。
 *
 * @param {Context} context
 * @param {BoundingRectangle} viewport
 * @param {boolean} hdr
 * @returns {boolean} <code>true</code> 如果帧缓冲区被重新创建。
 */
PlanarFillIdFramebuffer.prototype.update = function (context, viewport, hdr) {
  const width = viewport.width;
  const height = viewport.height;

  // Feature IDs are integers, so a 32-bit float channel provides plenty of range
  // for feature IDs. A single RED channel (R32F) is used since only one value is
  // stored per pixel. Rendering to R32F requires EXT_color_buffer_float, which is
  // available in WebGL2 on all browsers CesiumJS supports; the UNSIGNED_BYTE fallback
  // below only exists for stubbed WebGL contexts possibly used in tests.
  const pixelDatatype = context.colorBufferFloat
    ? PixelDatatype.FLOAT
    : PixelDatatype.UNSIGNED_BYTE;

  const changed = this._framebufferManager.update(
    context,
    width,
    height,
    1, // no MSAA
    pixelDatatype,
    PixelFormat.RED,
  );

  if (this._framebufferManager.framebuffer) {
    this._framebuffer = this._framebufferManager.framebuffer;
    this._idTexture = this._framebufferManager.getColorTexture(0);
    this._depthStencilTexture =
      this._framebufferManager.getDepthStencilTexture();
  }

  return changed;
};

/**
 * 返回一个针对该帧缓冲区的 ClearCommand 命令。
 *
 * @param {Color} [clearColor] 覆盖清除颜色（默认：透明黑色）。
 * @returns {ClearCommand}
 */
PlanarFillIdFramebuffer.prototype.getClearCommand = function (clearColor) {
  this._clearCommand.framebuffer = this._framebuffer;
  if (defined(clearColor)) {
    Color.clone(clearColor, this._clearCommand.color);
  }
  return this._clearCommand;
};

/**
 * 释放 GPU 资源而不销毁该对象；后续调用
 * {@link PlanarFillIdFramebuffer#update} 会重新创建这些资源。
 */
PlanarFillIdFramebuffer.prototype.releaseResources = function () {
  if (!defined(this._framebuffer)) {
    return;
  }
  this._framebufferManager.destroy();
  this._framebuffer = undefined;
  this._idTexture = undefined;
  this._depthStencilTexture = undefined;
};

/**
 * @returns {boolean}
 */
PlanarFillIdFramebuffer.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁 WebGL 资源。
 */
PlanarFillIdFramebuffer.prototype.destroy = function () {
  this._framebufferManager =
    this._framebufferManager && this._framebufferManager.destroy();
  this._clearCommand = undefined;
  return destroyObject(this);
};

export default PlanarFillIdFramebuffer;
