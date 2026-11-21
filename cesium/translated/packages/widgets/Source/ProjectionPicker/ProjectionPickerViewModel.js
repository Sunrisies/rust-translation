import {
  DeveloperError,
  EventHelper,
  OrthographicFrustum,
  defined,
  destroyObject,
} from "@cesium/core";
import { SceneMode } from "@cesium/engine";
import knockout from "../ThirdParty/knockout.js";
import createCommand from "../createCommand.js";

/**
 * {@link ProjectionPicker} 的视图模型。
 * @alias ProjectionPickerViewModel
 * @constructor
 *
 * @param {Scene} scene 用于切换投影方式的场景。
 */
function ProjectionPickerViewModel(scene) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(scene)) {
    throw new DeveloperError("scene is required.");
  }
  //>>includeEnd('debug');

  this._scene = scene;
  this._orthographic = scene.camera.frustum instanceof OrthographicFrustum;
  this._flightInProgress = false;

  /**
   * 获取或设置按钮下拉框是否当前可见。此属性可观察。
   * @type {boolean}
   * @default false
   */
  this.dropDownVisible = false;

  /**
   * 获取或设置透视投影提示工具。此属性可观察。
   * @type {string}
   * @default 'Perspective 投影方式
   */
  this.tooltipPerspective = "Perspective Projection";

  /**
   * 获取或设置正交投影提示工具。此属性可观察。
   * @type {string}
   * @default 'Orthographic 投影方式
   */
  this.tooltipOrthographic = "Orthographic Projection";

  /**
   * 获取当前激活的提示工具。此属性可观察。
   * @type {string}
   */
  this.selectedTooltip = undefined;

  /**
   * 获取或设置当前的场景模式。此属性可观察。
   * @type {SceneMode}
   */
  this.sceneMode = scene.mode;

  knockout.track(this, [
    "_orthographic",
    "_flightInProgress",
    "sceneMode",
    "dropDownVisible",
    "tooltipPerspective",
    "tooltipOrthographic",
  ]);

  const that = this;
  knockout.defineProperty(this, "selectedTooltip", function () {
    if (that._orthographic) {
      return that.tooltipOrthographic;
    }
    return that.tooltipPerspective;
  });

  this._toggleDropDown = createCommand(function () {
    if (that.sceneMode === SceneMode.SCENE2D || that._flightInProgress) {
      return;
    }

    that.dropDownVisible = !that.dropDownVisible;
  });

  this._eventHelper = new EventHelper();
  this._eventHelper.add(
    scene.morphComplete,
    function (transitioner, oldMode, newMode, isMorphing) {
      that.sceneMode = newMode;
      that._orthographic =
        newMode === SceneMode.SCENE2D ||
        that._scene.camera.frustum instanceof OrthographicFrustum;
    },
  );
  this._eventHelper.add(scene.preRender, function () {
    that._flightInProgress = defined(scene.camera._currentFlight);
  });

  this._switchToPerspective = createCommand(function () {
    if (that.sceneMode === SceneMode.SCENE2D) {
      return;
    }

    that._scene.camera.switchToPerspectiveFrustum();
    that._orthographic = false;
    that.dropDownVisible = false;
  });

  this._switchToOrthographic = createCommand(function () {
    if (that.sceneMode === SceneMode.SCENE2D) {
      return;
    }

    that._scene.camera.switchToOrthographicFrustum();
    that._orthographic = true;
    that.dropDownVisible = false;
  });

  //Used by knockout
  this._sceneMode = SceneMode;
}

Object.defineProperties(ProjectionPickerViewModel.prototype, {
  /**
   * 获取场景
   * @memberof ProjectionPickerViewModel.prototype
   * @type {Scene}
   */
  scene: {
    get: function () {
      return this._scene;
    },
  },

  /**
   * 获取切换下拉框的命令。
   * @memberof ProjectionPickerViewModel.prototype
   *
   * @type {Command}
   */
  toggleDropDown: {
    get: function () {
      return this._toggleDropDown;
    },
  },

  /**
   * 获取切换到透视投影的命令。
   * @memberof ProjectionPickerViewModel.prototype
   *
   * @type {Command}
   */
  switchToPerspective: {
    get: function () {
      return this._switchToPerspective;
    },
  },

  /**
   * 获取切换到正交投影的命令。
   * @memberof ProjectionPickerViewModel.prototype
   *
   * @type {Command}
   */
  switchToOrthographic: {
    get: function () {
      return this._switchToOrthographic;
    },
  },

  /**
   * 获取当前场景是否使用正交投影。
   * @memberof ProjectionPickerViewModel.prototype
   *
   * @type {Command}
   */
  isOrthographicProjection: {
    get: function () {
      return this._orthographic;
    },
  },
});

/**
 * @returns {boolean} true 如果对象已被销毁，则为 false，否则为 true。
 */
ProjectionPickerViewModel.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁视图模型。
 */
ProjectionPickerViewModel.prototype.destroy = function () {
  this._eventHelper.removeAll();
  destroyObject(this);
};
export default ProjectionPickerViewModel;
