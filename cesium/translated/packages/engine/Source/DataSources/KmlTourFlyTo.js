import { BoundingSphere, combine, defined } from "@cesium/core";
import EasingFunction from "../Core/EasingFunction.js";
/**
 * 将 KmlTour 切换到下一个目的地。此切换通过指定的飞行动作模式在指定时间内实现。
 * 在给定秒数内使用指定的飞行动作模式。
 *
 * @alias KmlTourFlyTo
 * @constructor
 *
 * @param {number} duration 进入持续时间
 * @param {string} flyToMode KML 飞行动作模式：弹跳、平滑等
 * @param {KmlCamera|KmlLookAt} view KmlCamera 或 KmlLookAt
 *
 * @see KmlTour
 * @see KmlTourWait
 */
function KmlTourFlyTo(duration, flyToMode, view) {
  this.type = "KmlTourFlyTo";
  this.blocking = true;
  this.activeCamera = null;
  this.activeCallback = null;

  this.duration = duration;
  this.view = view;
  this.flyToMode = flyToMode;
}

/**
 * 播放此播放列表条目
 *
 * @param {KmlTourFlyTo.DoneCallback} done 播放结束时将被调用的函数
 * @param {Camera} camera Cesium 相机
 * @param {object} [cameraOptions] 将与相机飞行动作选项合并。参见 {@link Camera#flyTo}
 */
KmlTourFlyTo.prototype.play = function (done, camera, cameraOptions) {
  this.activeCamera = camera;
  if (defined(done) && done !== null) {
    const self = this;
    this.activeCallback = function (terminated) {
      delete self.activeCallback;
      delete self.activeCamera;
      done(defined(terminated) ? false : terminated);
    };
  }

  const options = this.getCameraOptions(cameraOptions);
  if (this.view.headingPitchRoll) {
    camera.flyTo(options);
  } else if (this.view.headingPitchRange) {
    const target = new BoundingSphere(this.view.position);
    camera.flyToBoundingSphere(target, options);
  }
};

/**
 * 停止当前条目的执行。取消相机飞行动作
 */
KmlTourFlyTo.prototype.stop = function () {
  if (defined(this.activeCamera)) {
    this.activeCamera.cancelFlight();
  }
  if (defined(this.activeCallback)) {
    this.activeCallback(true);
  }
};

/**
 * 返回 {@link Camera#flyTo} 或 {@link Camera#flyToBoundingSphere} 的选项
 * 取决于此.view 类型。
 *
 * @param {object} cameraOptions 与生成的选项合并的选项。参见 {@link Camera#flyTo}
 * @returns {object} {@link Camera#flyTo} 或 {@link Camera#flyToBoundingSphere} 选项
 */
KmlTourFlyTo.prototype.getCameraOptions = function (cameraOptions) {
  let options = {
    duration: this.duration,
  };

  if (defined(this.activeCallback)) {
    options.complete = this.activeCallback;
  }

  if (this.flyToMode === "smooth") {
    options.easingFunction = EasingFunction.LINEAR_NONE;
  }

  if (this.view.headingPitchRoll) {
    options.destination = this.view.position;
    options.orientation = this.view.headingPitchRoll;
  } else if (this.view.headingPitchRange) {
    options.offset = this.view.headingPitchRange;
  }

  if (defined(cameraOptions)) {
    options = combine(options, cameraOptions);
  }
  return options;
};

/**
 * 飞行完成时将被执行的函数
 * @callback KmlTourFlyTo.DoneCallback
 *
 * @param {boolean} terminated 如果在进入播放结束前调用了 {@link KmlTourFlyTo#stop}，则为 true
 * 
 */
export default KmlTourFlyTo;
