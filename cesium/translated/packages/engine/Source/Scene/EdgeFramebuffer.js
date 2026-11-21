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
 * 创建并管理用于边缘可见性渲染的帧缓冲区。
 *
 * @alias EdgeFramebuffer
 * @constructor
 *
 * @private
 */
function EdgeFramebuffer() {
  // Create framebuffer manager with multiple render targets (MRT)
  // Color attachment 0: edge color output (visualization / debug)
  // Color attachment 1: R: edge type, G: featureId (metadata / ids)
  // Color attachment 2: packed depth (czm_packDepth) for edge fragments
  this._framebufferManager = new FramebufferManager({
    colorAttachmentsLength: 3, // MRT: Color + ID + Depth (packed RGBA)
    createColorAttachments: true,
    depthStencil: true,
    supportsDepthTexture: true,
    color: true,
  });

  this._framebuffer = undefined;
  this._colorTexture = undefined;
  this._idTexture = undefined;
  this._depthTexture = undefined; // packed depth color attachment (location = 2)
  this._depthStencilTexture = undefined;

  this._clearCommand = new ClearCommand({
    color: new Color(0.0, 0.0, 0.0, 0.0),
    depth: 1.0,
    stencil: 0,
    owner: this,
  });
}

Object.defineProperties(EdgeFramebuffer.prototype, {
  /**
   * 获取用于边缘渲染的帧缓冲区。
   * @memberof EdgeFramebuffer.prototype
   * @type {Framebuffer}
   * @readonly
   */
  framebuffer: {
    get: function () {
      return this._framebuffer;
    },
  },

  /**
   * 获取颜色纹理。
   * @memberof EdgeFramebuffer.prototype
   * @type {Texture}
   * @readonly
   */
  colorTexture: {
    get: function () {
      return this._colorTexture;
    },
  },

  /**
   * 获取 ID 纹理。
   * @memberof EdgeFramebuffer.prototype
   * @type {Texture}
   * @readonly
   */
  idTexture: {
    get: function () {
      return this._idTexture;
    },
  },

  /**
   * 获取在边缘处理过程中写入的打包深度纹理。
   * @memberof EdgeFramebuffer.prototype
   * @type {Texture}
   * @readonly
   */
  depthTexture: {
    get: function () {
      return this._depthTexture;
    },
  },

  /**
   * 获取深度-模板纹理。
   * @memberof EdgeFramebuffer.prototype
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
 * 更新帧缓冲区。
 *
 * @param {Context} context 上下文。
 * @param {BoundingRectangle} viewport 视口。
 * @param {boolean} hdr HDR 是否启用。
 * @param {Texture} [existingColorTexture] 可重用的现有颜色纹理（可选）。
 * @param {Texture} [existingDepthTexture] 可重用的现有深度纹理（可选）。
 *
 * @returns {boolean} True 如果帧缓冲区已更新，则为 true；否则为 false。
 */
EdgeFramebuffer.prototype.update = function (
  context,
  viewport,
  hdr,
  existingColorTexture,
  existingDepthTexture,
) {
  const width = viewport.width;
  const height = viewport.height;

  const pixelDatatype = hdr
    ? context.halfFloatingPointTexture
      ? PixelDatatype.HALF_FLOAT
      : PixelDatatype.FLOAT
    : PixelDatatype.UNSIGNED_BYTE;

  const changed = this._framebufferManager.update(
    context,
    width,
    height,
    1, // No MSAA
    pixelDatatype,
    PixelFormat.RGBA,
  );

  // Always assign framebuffer if FramebufferManager has one
  if (this._framebufferManager.framebuffer) {
    this._framebuffer = this._framebufferManager.framebuffer;

    // Get the textures from the framebuffer manager or use existing ones
    this._colorTexture = defined(existingColorTexture)
      ? existingColorTexture
      : this._framebufferManager.getColorTexture(0); // Color attachment 0
    this._idTexture = this._framebufferManager.getColorTexture(1); // Color attachment 1: ID texture
    this._depthTexture = this._framebufferManager.getColorTexture(2); // Color attachment 2: packed depth
    this._depthStencilTexture = defined(existingDepthTexture)
      ? existingDepthTexture
      : this._framebufferManager.getDepthStencilTexture();
  }

  return changed;
};

/**
 * 使用 ClearCommand 清除帧缓冲区。
 * @deprecated Use 使用 getClearCommand() 进行正确的 MRT 清除。
 *
 * @param {Context} context 上下文。
 * @param {PassState} passState 处理状态。
 * @param {Color} clearColor 清除颜色。
 */
EdgeFramebuffer.prototype.clear = function (context, passState, clearColor) {
  const clearCommand = this.getClearCommand(clearColor);
  clearCommand.execute(context, passState);
};

/**
 * 获取该帧缓冲区的清除命令。
 *
 * @param {Color} [clearColor] 要使用的清除颜色。如果未定义，则使用默认值。
 * @returns {ClearCommand} The 清除命令。
 */
EdgeFramebuffer.prototype.getClearCommand = function (clearColor) {
  this._clearCommand.framebuffer = this._framebuffer;

  if (defined(clearColor)) {
    Color.clone(clearColor, this._clearCommand.color);
  }

  return this._clearCommand;
};

/**
 * 获取边缘帧缓冲区，必要时创建它。
 *
 * @param {Context} context 上下文。
 * @param {BoundingRectangle} viewport 视口。
 * @param {Texture} [existingColorTexture] 可重用的现有颜色纹理（可选）。
 * @param {Texture} [existingDepthTexture] 可重用的现有深度纹理（可选）。
 *
 * @returns {Framebuffer} The 边缘帧缓冲区。
 */
EdgeFramebuffer.prototype.getFramebuffer = function (
  context,
  viewport,
  existingColorTexture,
  existingDepthTexture,
) {
  this.update(
    context,
    viewport,
    false,
    existingColorTexture,
    existingDepthTexture,
  );
  return this._framebuffer;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 *
 * @returns {boolean} True 如果此对象被销毁，则返回 true；否则返回 false。
 */
EdgeFramebuffer.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而无需依赖垃圾收集器来销毁此对象。
 * 替代方案是调用 destroy() 以释放 WebGL 资源，而不是依赖垃圾收集器。
 * <br /><br />
 * 一旦对象被销毁，就不应再使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值（<code>undefined</code>）赋值给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 */
EdgeFramebuffer.prototype.destroy = function () {
  this._framebufferManager =
    this._framebufferManager && this._framebufferManager.destroy();
  this._clearCommand = undefined;
  return destroyObject(this);
};

export default EdgeFramebuffer;
