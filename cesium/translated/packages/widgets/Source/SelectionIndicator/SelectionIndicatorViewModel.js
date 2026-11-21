import { Cartesian2, DeveloperError, defined } from "@cesium/core";
import { EasingFunction, SceneTransforms } from "@cesium/engine";
import knockout from "../ThirdParty/knockout.js";

const screenSpacePos = new Cartesian2();
const offScreen = "-1000px";

/**
 * {@link SelectionIndicator} 的视图模型。
 * @alias SelectionIndicatorViewModel
 * @constructor
 *
 * @param {Scene} scene 用于屏幕空间坐标转换的场景实例。
 * @param {Element} selectionIndicatorElement 包含构成选择指示器的所有实体的元素。
 * @param {Element} container 包含控件的 DOM 元素。
 */
function SelectionIndicatorViewModel(
  scene,
  selectionIndicatorElement,
  container,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(scene)) {
    throw new DeveloperError("scene is required.");
  }

  if (!defined(selectionIndicatorElement)) {
    throw new DeveloperError("selectionIndicatorElement is required.");
  }

  if (!defined(container)) {
    throw new DeveloperError("container is required.");
  }
  //>>includeEnd('debug');

  this._scene = scene;
  this._screenPositionX = offScreen;
  this._screenPositionY = offScreen;
  this._tweens = scene.tweens;
  this._container = container ?? document.body;
  this._selectionIndicatorElement = selectionIndicatorElement;
  this._scale = 1;

  /**
   * 获取或设置要显示选择指示器的对象的世界位置。
   * @type {Cartesian3}
   */
  this.position = undefined;

  /**
   * 获取或设置选择指示器的可见性。即使选中对象没有位置，此属性也可以设为 false。
   * @type {boolean}
   */
  this.showSelection = false;

  knockout.track(this, [
    "position",
    "_screenPositionX",
    "_screenPositionY",
    "_scale",
    "showSelection",
  ]);

  /**
   * 获取位置指示器的可见性。当选中的对象没有位置时，此属性可以为 false。
   * 获取或设置将对象的世界位置转换为屏幕空间位置的函数。
   * @type {boolean}
   */
  this.isVisible = undefined;
  knockout.defineProperty(this, "isVisible", {
    get: function () {
      return this.showSelection && defined(this.position);
    },
  });

  knockout.defineProperty(this, "_transform", {
    get: function () {
      return `scale(${this._scale})`;
    },
  });

  /**
   * selectionIndicatorViewModel.computeScreenSpacePosition = function(position, result) {
   *
   * @member
   * @type {SelectionIndicatorViewModel.ComputeScreenSpacePosition}
   * @default SceneTransforms.worldToWindowCoordinates
   *
   * @example
   * return Cesium.SceneTransforms.worldToWindowCoordinates(scene, position, result);
   * 更新选择指示器的视图，使其与视图模型的位置和内容属性保持一致。
   * };
   */
  this.computeScreenSpacePosition = function (position, result) {
    return SceneTransforms.worldToWindowCoordinates(scene, position, result);
  };
}

/**
 * 此函数应在渲染循环中调用。
 * 动画化指示器以吸引对选择的注意。
 */
SelectionIndicatorViewModel.prototype.update = function () {
  if (this.showSelection && defined(this.position)) {
    const screenPosition = this.computeScreenSpacePosition(
      this.position,
      screenSpacePos,
    );
    if (!defined(screenPosition)) {
      this._screenPositionX = offScreen;
      this._screenPositionY = offScreen;
    } else {
      const container = this._container;
      const containerWidth = container.parentNode.clientWidth;
      const containerHeight = container.parentNode.clientHeight;
      const indicatorSize = this._selectionIndicatorElement.clientWidth;
      const halfSize = indicatorSize * 0.5;

      screenPosition.x =
        Math.min(
          Math.max(screenPosition.x, -indicatorSize),
          containerWidth + indicatorSize,
        ) - halfSize;
      screenPosition.y =
        Math.min(
          Math.max(screenPosition.y, -indicatorSize),
          containerHeight + indicatorSize,
        ) - halfSize;

      this._screenPositionX = `${Math.floor(screenPosition.x + 0.25)}px`;
      this._screenPositionY = `${Math.floor(screenPosition.y + 0.25)}px`;
    }
  }
};

/**
 * 动画化指示器以释放选择状态。
 */
SelectionIndicatorViewModel.prototype.animateAppear = function () {
  this._tweens.addProperty({
    object: this,
    property: "_scale",
    startValue: 2,
    stopValue: 1,
    duration: 0.8,
    easingFunction: EasingFunction.EXPONENTIAL_OUT,
  });
};

/**
 * 获取包含选择指示器的 HTML 元素。
 */
SelectionIndicatorViewModel.prototype.animateDepart = function () {
  this._tweens.addProperty({
    object: this,
    property: "_scale",
    startValue: this._scale,
    stopValue: 1.5,
    duration: 0.8,
    easingFunction: EasingFunction.EXPONENTIAL_OUT,
  });
};

Object.defineProperties(SelectionIndicatorViewModel.prototype, {
  /**
   * 获取持有选择指示器的 HTML 元素。
   * @memberof SelectionIndicatorViewModel.prototype
   *
   * @type {Element}
   */
  container: {
    get: function () {
      return this._container;
    },
  },

  /**
   * 获取正在使用的场景。
   * @memberof SelectionIndicatorViewModel.prototype
   *
   * @type {Element}
   */
  selectionIndicatorElement: {
    get: function () {
      return this._selectionIndicatorElement;
    },
  },

  /**
   * 将对象的世界位置转换为屏幕空间位置的函数。
   * @memberof SelectionIndicatorViewModel.prototype
   *
   * @type {Scene}
   */
  scene: {
    get: function () {
      return this._scene;
    },
  },
});

/**
 * 将对象的世界位置转换为屏幕空间位置的函数。
 * @callback SelectionIndicatorViewModel.ComputeScreenSpacePosition
 * @param {Cartesian3} position WGS84（世界）坐标中的位置。
 * @param {Cartesian2} result 一个返回输入位置并转换为窗口坐标的对象。
 * @returns {Cartesian2} The modified result parameter.
 */
export default SelectionIndicatorViewModel;
