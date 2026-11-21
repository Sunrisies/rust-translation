import { DeveloperError, clone, destroyObject } from "@cesium/core";
import Context from "./Context.js";

/**
 * 允许单个 WebGL 上下文被任意数量的 {@link Scene} 使用。
 * 可以将 SharedContext 作为 {@link ContextOptions} 的替代值传递给 {@link Scene}、{@link CesiumWidget} 和 {@link Viewer} 的构造函数。
 * 与共享 WebGL 上下文关联的 {@link Primitive} 可以在使用相同上下文的任何 Scene 中显示。
 * 该上下文将每个 Scene 渲染到离屏画布，然后将结果快速显示到 Scene 的屏幕画布上。
 *
 * @private
 * @alias SharedContext
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {ContextOptions} [options.contextOptions] 上下文和 WebGL 创建属性。
 * @param {boolean} [options.autoDestroy=true] 在所有使用该上下文的 Scene 被销毁后，会销毁此上下文及其所有 WebGL 资源。

 * @see {@link http://www.khronos.org/registry/webgl/specs/latest/#5.2|WebGLContextAttributes}
 *
 * @example
 * // 创建两个共享单个 WebGL 上下文的 Scene
 * const context = new Cesium.SharedContext();
 * const scene1 = new Cesium.Scene({
 * canvas: canvas1,
 * contextOptions: context,
 * });
 * const scene2 = new Cesium.Scene({
 * canvas: canvas2,
 * contextOptions: context,
 * });
 */
function SharedContext(options) {
  this._autoDestroy = options?.autoDestroy ?? true;
  this._canvas = document.createElement("canvas");
  this._context = new Context(this._canvas, clone(options?.contextOptions));
  this._canvases = [];
}

/**
 * 创建管理特定画布的共享 WebGL 上下文的 {@link Context} 实例。
 * @param {HTMLCanvasElement} canvas 将上下文关联的画布元素
 * @returns {Context} The 创建的上下文实例
 * @private
 */
SharedContext.prototype.createSceneContext = function (canvas) {
  const context2d = canvas.getContext("2d", { alpha: true });

  //>>includeStart('debug', pragmas.debug);
  if (!context2d) {
    throw new DeveloperError(
      "canvas used with SharedContext must provide a 2d context",
    );
  }

  if (this._canvases.includes(canvas)) {
    throw new DeveloperError("canvas is already associated with a scene");
  }
  //>>includeEnd('debug');

  const sharedContext = this;
  sharedContext._canvases.push(canvas);

  let isDestroyed = false;
  const destroy = function () {
    isDestroyed = true;
    const index = sharedContext._canvases.indexOf(canvas);
    if (-1 !== index) {
      sharedContext._canvases.splice(index, 1);
      if (sharedContext._autoDestroy && sharedContext._canvases.length === 0) {
        sharedContext.destroy();
      }
    }
  };

  const beginFrame = function () {
    // Ensure the off-screen canvas is at least as large as the on-screen canvas.
    const sharedCanvas = sharedContext._context.canvas;

    const width = this.drawingBufferWidth;
    if (sharedCanvas.width < width) {
      sharedCanvas.width = width;
    }

    const height = this.drawingBufferHeight;
    if (sharedCanvas.height < height) {
      sharedCanvas.height = height;
    }
  };

  const endFrame = function () {
    // Blit the image from the off-screen canvas to the on-screen canvas.
    const w = this.drawingBufferWidth;
    const h = this.drawingBufferHeight;
    const yOffset = sharedContext._context.canvas.height - h; // drawImage has top as Y=0, GL has bottom as Y=0
    context2d.drawImage(
      sharedContext._context.canvas,
      0,
      yOffset,
      w,
      h,
      0,
      0,
      w,
      h,
    );

    // Do normal post-frame cleanup.
    sharedContext._context.endFrame();
  };

  const proxy = new Proxy(this._context, {
    get(target, prop, receiver) {
      if (prop === "isDestroyed") {
        return function () {
          return isDestroyed;
        };
      } else if (isDestroyed) {
        //>>includeStart('debug', pragmas.debug);
        throw new DeveloperError(
          "This object was destroyed, i.e., destroy() was called.",
        );
        //>>includeEnd('debug');
      }

      switch (prop) {
        case "_canvas":
          return canvas;
        case "destroy":
          return destroy;
        case "drawingBufferWidth":
          return canvas.width;
        case "drawingBufferHeight":
          return canvas.height;
        case "beginFrame":
          return beginFrame;
        case "endFrame":
          return endFrame;
        default:
          return Reflect.get(target, prop, receiver);
      }
    },
  });

  return proxy;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象可以确保
 * WebGL 资源的确定性释放，而无需依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，就不应再使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数都会引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * <br /><br />
 * 默认情况下，一旦最后一个使用它的 Scene 被销毁，SharedContext 会自动被销毁，此时
 * 无需直接调用此方法。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy()。
 *
 * @example
 * context = context && context.destroy();
 *
 * @see SharedContext#isDestroyed
 */
SharedContext.prototype.destroy = function () {
  this._context.destroy();
  destroyObject(this);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，就不应再使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数都会引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>。
 *
 * @see SharedContext#destroy
 */
SharedContext.prototype.isDestroyed = function () {
  return false;
};

export default SharedContext;
