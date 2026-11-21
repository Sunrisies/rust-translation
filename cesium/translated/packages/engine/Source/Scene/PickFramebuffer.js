import {
  BoundingRectangle,
  Color,
  PixelDatatype,
  PixelFormat,
  RuntimeError,
  defined,
  destroyObject,
} from "@cesium/core";
import FramebufferManager from "../Renderer/FramebufferManager.js";
import PassState from "../Renderer/PassState.js";
import Sync from "../Renderer/Sync.js";

/**
 * @private
 */
function PickFramebuffer(context) {
  // Override per-command states
  const passState = new PassState(context);
  passState.blendingEnabled = false;
  passState.scissorTest = {
    enabled: true,
    rectangle: new BoundingRectangle(),
  };
  passState.viewport = new BoundingRectangle();

  this._context = context;
  this._fb = new FramebufferManager({
    depthStencil: true,
  });
  this._passState = passState;
  this._width = 0;
  this._height = 0;
}

/**
 * 返回在指定矩形内渲染的选中实体。
 *
 * @private
 * @param {object} context 当前活动上下文。
 * @param {Uint8Array|Uint16Array|Float32Array|Uint32Array} pixels 指定矩形内的像素数据。
 * @param {number} width 矩形宽度。
 * @param {number} height 矩形高度。
 * @param {number} [limit=1] 如果提供，收集到该数量对象后停止迭代。
 * @returns {object[]} A 按与矩形中心距离排序的渲染对象列表。
 */
function pickObjectsFromPixels(context, pixels, width, height, limit = 1) {
  const max = Math.max(width, height);
  const length = max * max;
  const halfWidth = Math.floor(width * 0.5);
  const halfHeight = Math.floor(height * 0.5);

  let x = 0;
  let y = 0;
  let dx = 0;
  let dy = -1;

  // Spiral around the center pixel, this is a workaround until
  // we can access the depth buffer on all browsers.

  // The region does not have to square and the dimensions do not have to be odd, but
  // loop iterations would be wasted. Prefer square regions where the size is odd.
  const objects = new Set();
  for (let i = 0; i < length; ++i) {
    if (
      -halfWidth <= x &&
      x <= halfWidth &&
      -halfHeight <= y &&
      y <= halfHeight
    ) {
      const index = 4 * ((halfHeight - y) * width + x + halfWidth);

      const pickColor = Color.bytesToRgba(
        pixels[index],
        pixels[index + 1],
        pixels[index + 2],
        pixels[index + 3],
      );

      const object = context.getObjectByPickColor(pickColor);
      if (defined(object)) {
        objects.add(object);
        if (objects.size >= limit) {
          break;
        }
      }
    }

    // if (top right || bottom left corners) || (top left corner) || (bottom right corner + (1, 0))
    // change spiral direction
    if (x === y || (x < 0 && -x === y) || (x > 0 && x === 1 - y)) {
      const temp = dx;
      dx = -dy;
      dy = temp;
    }

    x += dx;
    y += dy;
  }
  return [...objects];
}

PickFramebuffer.prototype.begin = function (screenSpaceRectangle, viewport) {
  const context = this._context;
  const { width, height } = viewport;

  BoundingRectangle.clone(
    screenSpaceRectangle,
    this._passState.scissorTest.rectangle,
  );

  // Create or recreate renderbuffers and framebuffer used for picking
  this._width = width;
  this._height = height;
  this._fb.update(context, width, height);
  this._passState.framebuffer = this._fb.framebuffer;

  this._passState.viewport.width = width;
  this._passState.viewport.height = height;

  return this._passState;
};

/**
 * 使用异步方式在不阻塞 GPU 的情况下，返回在指定矩形内渲染的选中对象。
 * 需要 WebGL2。
 *
 * @param {BoundingRectangle} screenSpaceRectangle
 * @param {FrameState} frameState
 * @param {number} [limit=1] 如果提供，收集到该数量对象后停止迭代。
 * @returns {Promise<object[]>} A 按与矩形中心距离排序的渲染对象列表。
 *
 * @exception {RuntimeError} Async 选择请求超时。
 * @exception {DeveloperError} A 需要 WebGL 2 上下文。
 */
PickFramebuffer.prototype.endAsync = async function (
  screenSpaceRectangle,
  frameState,
  limit = 1,
) {
  const width = screenSpaceRectangle.width ?? 1.0;
  const height = screenSpaceRectangle.height ?? 1.0;

  const context = this._context;
  const framebuffer = this._fb.framebuffer;

  let pixelDatatype = PixelDatatype.UNSIGNED_BYTE;
  let pixelFormat = PixelFormat.RGBA;

  if (defined(framebuffer) && framebuffer.numberOfColorAttachments > 0) {
    pixelDatatype = framebuffer.getColorTexture(0).pixelDatatype;
    pixelFormat = framebuffer.getColorTexture(0).pixelFormat;
  }

  const pbo = context.readPixelsToPBO({
    x: screenSpaceRectangle.x,
    y: screenSpaceRectangle.y,
    width: width,
    height: height,
    framebuffer: framebuffer,
  });

  const sync = Sync.create({
    context: context,
  });

  // Wait for the GPU to signal that it is ready to readback the PBO data
  try {
    await sync.waitForSignal((next) => frameState.afterRender.push(next));
    const pixels = PixelFormat.createTypedArray(
      pixelFormat,
      pixelDatatype,
      width,
      height,
    );
    pbo.getBufferData(pixels);
    const pickedObjects = pickObjectsFromPixels(
      context,
      pixels,
      width,
      height,
      limit,
    );
    return pickedObjects;
  } catch (e) {
    throw new RuntimeError("Async Picking Request Timeout");
  } finally {
    sync.destroy();
    pbo.destroy();
  }
};

/**
 * 返回在指定矩形内渲染的选中对象。
 *
 * @param {BoundingRectangle} screenSpaceRectangle
 * @param {number} [limit=1] 如果提供，收集到该数量对象后停止迭代。
 * @returns {object[]} A 按与矩形中心距离排序的渲染对象列表。
 */
PickFramebuffer.prototype.end = function (screenSpaceRectangle, limit = 1) {
  const width = screenSpaceRectangle.width ?? 1.0;
  const height = screenSpaceRectangle.height ?? 1.0;

  const context = this._context;
  const pixels = context.readPixels({
    x: screenSpaceRectangle.x,
    y: screenSpaceRectangle.y,
    width: width,
    height: height,
    framebuffer: this._fb.framebuffer,
  });

  return pickObjectsFromPixels(context, pixels, width, height, limit);
};

/**
 * 返回包含给定矩形中心像素的 RGBA（字节）组件的类型化数组。
 * 这可以是通过 pickVoxel 通道渲染的体素块和采样信息，或者可能是元数据选择渲染通道的结果。
 *
 * This may, for example, be voxel tile and sample information as rendered
 * by a pickVoxel pass, within a given rectangle. Or it may be the result
 * RGBA 组件
 *
 * @param {BoundingRectangle} screenSpaceRectangle
 * @returns {Uint8Array} The RGBA components
 */
PickFramebuffer.prototype.readCenterPixel = function (screenSpaceRectangle) {
  const width = screenSpaceRectangle.width ?? 1.0;
  const height = screenSpaceRectangle.height ?? 1.0;

  const context = this._context;
  const pixels = context.readPixels({
    x: screenSpaceRectangle.x,
    y: screenSpaceRectangle.y,
    width: width,
    height: height,
    framebuffer: this._fb.framebuffer,
  });

  // Read the center pixel
  const halfWidth = Math.floor(width * 0.5);
  const halfHeight = Math.floor(height * 0.5);
  const index = 4 * (halfHeight * width + halfWidth);

  return pixels.slice(index, index + 4);
};

PickFramebuffer.prototype.isDestroyed = function () {
  return false;
};

PickFramebuffer.prototype.destroy = function () {
  this._fb.destroy();
  return destroyObject(this);
};

export default PickFramebuffer;
