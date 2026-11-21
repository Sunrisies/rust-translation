import {
  Check,
  DeveloperError,
  Frozen,
  RuntimeError,
  WebGLConstants,
  destroyObject,
} from "@cesium/core";

/**
 * WebGLSync 接口属于 WebGL 2 API，用于同步 GPU 与应用程序之间的操作。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Context} context
 *
 * @exception {DeveloperError} A 使用 Sync 操作需要 WebGL 2 上下文。
 *
 * @private
 * @constructor
 */
function Sync(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const context = options.context;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", context);
  //>>includeEnd('debug');

  if (!context._webgl2) {
    throw new DeveloperError(
      "A WebGL 2 context is required to use Sync operations.",
    );
  }

  const gl = context._gl;
  const sync = gl.fenceSync(WebGLConstants.SYNC_GPU_COMMANDS_COMPLETE, 0);

  this._gl = gl;
  this._sync = sync;
}
Sync.create = function (options) {
  return new Sync(options);
};
/**
 * 查询该 Sync 对象的同步状态。
 *
 * @returns {number} Returns 一个 WebGLConstants 值，表示同步对象的状态（WebGLConstants.SIGNALED 或 WebGLConstants.UNSIGNALED）。
 *
 * @private
 */
Sync.prototype.getStatus = function () {
  const status = this._gl.getSyncParameter(
    this._sync,
    WebGLConstants.SYNC_STATUS,
  );
  return status;
};
Sync.prototype.isDestroyed = function () {
  return false;
};
Sync.prototype.destroy = function () {
  this._gl.deleteSync(this._sync);
  return destroyObject(this);
};

/**
 * 逐步轮询 Sync 对象的状态，直到收到信号后停止。
 * 通常应在每帧进行一次轮询。
 *
 * @example
 * try {
 * await sync.waitForSignal(function (next) {
 * setTimeout(next, 100);
 *  });
 *} catch (e) {
 * throw "信号超时";
 *} finally {
 * sync.destroy();
 *}
 *
 * @param {function} scheduleFunction 用于安排下一次轮询的函数。其唯一参数为回调函数。
 * @param {number} [ttl=10] 在超时前可进行的轮询最大次数。
 *
 * @exception {RuntimeError} Wait 用于信号超时的判断。
 */
Sync.prototype.waitForSignal = async function (scheduleFunction, ttl) {
  const self = this;
  ttl = ttl ?? 10;
  function waitForSignal0(resolve, reject, ttl) {
    return () => {
      const syncStatus = self.getStatus();
      const signaled = syncStatus === WebGLConstants.SIGNALED;
      if (signaled) {
        resolve();
      } else if (ttl <= 0) {
        reject(new RuntimeError("Wait for signal timeout"));
      } else {
        scheduleFunction(waitForSignal0(resolve, reject, ttl - 1));
      }
    };
  }
  return new Promise((resolve, reject) => {
    scheduleFunction(waitForSignal0(resolve, reject, ttl));
  });
};
export default Sync;
