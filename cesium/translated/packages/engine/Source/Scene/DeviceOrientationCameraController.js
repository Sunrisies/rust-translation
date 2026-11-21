import {
  DeveloperError,
  Math as CesiumMath,
  Matrix3,
  Quaternion,
  defined,
  destroyObject,
} from "@cesium/core";

/**
 * @private
 */
function DeviceOrientationCameraController(scene) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(scene)) {
    throw new DeveloperError("scene is required.");
  }
  //>>includeEnd('debug');

  this._scene = scene;

  this._lastAlpha = undefined;
  this._lastBeta = undefined;
  this._lastGamma = undefined;

  this._alpha = undefined;
  this._beta = undefined;
  this._gamma = undefined;

  const that = this;

  function callback(e) {
    const alpha = e.alpha;
    if (!defined(alpha)) {
      that._alpha = undefined;
      that._beta = undefined;
      that._gamma = undefined;
      return;
    }

    that._alpha = CesiumMath.toRadians(alpha);
    that._beta = CesiumMath.toRadians(e.beta);
    that._gamma = CesiumMath.toRadians(e.gamma);
  }

  window.addEventListener("deviceorientation", callback, false);

  this._removeListener = function () {
    window.removeEventListener("deviceorientation", callback, false);
  };
}

const scratchQuaternion1 = new Quaternion();
const scratchQuaternion2 = new Quaternion();
const scratchMatrix3 = new Matrix3();

function rotate(camera, alpha, beta, gamma) {
  const direction = camera.direction;
  const right = camera.right;
  const up = camera.up;

  const bQuat = Quaternion.fromAxisAngle(direction, beta, scratchQuaternion2);
  const gQuat = Quaternion.fromAxisAngle(right, gamma, scratchQuaternion1);

  const rotQuat = Quaternion.multiply(gQuat, bQuat, gQuat);

  const aQuat = Quaternion.fromAxisAngle(up, alpha, scratchQuaternion2);
  Quaternion.multiply(aQuat, rotQuat, rotQuat);

  const matrix = Matrix3.fromQuaternion(rotQuat, scratchMatrix3);
  Matrix3.multiplyByVector(matrix, right, right);
  Matrix3.multiplyByVector(matrix, up, up);
  Matrix3.multiplyByVector(matrix, direction, direction);
}

DeviceOrientationCameraController.prototype.update = function () {
  if (!defined(this._alpha)) {
    return;
  }

  if (!defined(this._lastAlpha)) {
    this._lastAlpha = this._alpha;
    this._lastBeta = this._beta;
    this._lastGamma = this._gamma;
  }

  const a = this._lastAlpha - this._alpha;
  const b = this._lastBeta - this._beta;
  const g = this._lastGamma - this._gamma;

  rotate(this._scene.camera, -a, b, g);

  this._lastAlpha = this._alpha;
  this._lastBeta = this._beta;
  this._lastGamma = this._gamma;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 false；否则返回 <code>false</code>。
 */
DeviceOrientationCameraController.prototype.isDestroyed = function () {
  return false;
};

/**
 * 会释放此对象所持有的资源。销毁对象可以使得资源被确定性地释放，而无需依赖垃圾收集器来销毁该对象。
 * 而不是依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，就不应再使用它；除了调用 <code>isDestroyed</code> 函数之外，调用其他任何函数都会引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给该对象，如示例中所做的那样。
 * 即表示对象已被销毁，也就是调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 */
DeviceOrientationCameraController.prototype.destroy = function () {
  this._removeListener();
  return destroyObject(this);
};
export default DeviceOrientationCameraController;
