import {
  DeveloperError,
  Frozen,
  defined,
  destroyObject,
  getTimestamp,
} from "@cesium/core";
import getElement from "../DataSources/getElement.js";

/**
 * @internal
 */
function PerformanceDisplay(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const container = getElement(options.container);
  //>>includeStart('debug', pragmas.debug);
  if (!defined(container)) {
    throw new DeveloperError("container is required");
  }
  //>>includeEnd('debug');

  this._container = container;

  const display = document.createElement("div");
  display.className = "cesium-performanceDisplay";
  const fpsElement = document.createElement("div");
  fpsElement.className = "cesium-performanceDisplay-fps";
  this._fpsText = document.createTextNode("");
  fpsElement.appendChild(this._fpsText);
  const msElement = document.createElement("div");
  msElement.className = "cesium-performanceDisplay-ms";
  this._msText = document.createTextNode("");
  msElement.appendChild(this._msText);
  display.appendChild(msElement);
  display.appendChild(fpsElement);
  this._container.appendChild(display);

  this._lastFpsSampleTime = getTimestamp();
  this._lastMsSampleTime = getTimestamp();
  this._fpsFrameCount = 0;
  this._msFrameCount = 0;

  this._throttled = false;
  const throttledElement = document.createElement("div");
  throttledElement.className = "cesium-performanceDisplay-throttled";
  this._throttledText = document.createTextNode("");
  throttledElement.appendChild(this._throttledText);
  display.appendChild(throttledElement);
}

Object.defineProperties(PerformanceDisplay.prototype, {
  /**
   * 显示界面应指示 FPS 正在被限制。
   * @memberof PerformanceDisplay.prototype
   *
   * @type {boolean}
   */
  throttled: {
    get: function () {
      return this._throttled;
    },
    set: function (value) {
      if (this._throttled === value) {
        return;
      }

      if (value) {
        this._throttledText.nodeValue = "(throttled)";
      } else {
        this._throttledText.nodeValue = "";
      }

      this._throttled = value;
    },
  },
});

/**
 * 更新显示。此函数应在每一帧调用一次，因为
 * 每次调用都会将一帧数据记录到内部缓冲区中，并重新绘制显示界面。
 *
 * @param {boolean} [renderedThisFrame=true] 如果设置了该参数，只有为真时才会更新和显示 FPS 数值。
 *
 * @internal
 */
PerformanceDisplay.prototype.update = function (renderedThisFrame) {
  const time = getTimestamp();
  const updateDisplay = renderedThisFrame ?? true;

  this._fpsFrameCount++;
  const fpsElapsedTime = time - this._lastFpsSampleTime;
  if (fpsElapsedTime > 1000) {
    let fps = "N/A";
    if (updateDisplay) {
      fps = ((this._fpsFrameCount * 1000) / fpsElapsedTime) | 0;
    }

    this._fpsText.nodeValue = `${fps} FPS`;
    this._lastFpsSampleTime = time;
    this._fpsFrameCount = 0;
  }

  this._msFrameCount++;
  const msElapsedTime = time - this._lastMsSampleTime;
  if (msElapsedTime > 200) {
    let ms = "N/A";
    if (updateDisplay) {
      ms = (msElapsedTime / this._msFrameCount).toFixed(2);
    }

    this._msText.nodeValue = `${ms} MS`;
    this._lastMsSampleTime = time;
    this._msFrameCount = 0;
  }
};

/**
 * 会销毁该对象所持有的 WebGL 资源。
 */
PerformanceDisplay.prototype.destroy = function () {
  return destroyObject(this);
};
export default PerformanceDisplay;
