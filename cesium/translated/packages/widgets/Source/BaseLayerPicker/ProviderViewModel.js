import { DeveloperError, defined } from "@cesium/core";
import knockout from "../ThirdParty/knockout.js";
import createCommand from "../createCommand.js";

/**
 * 表示 {@link BaseLayerPicker} 中每个项目的视图模型。
 *
 * @alias ProviderViewModel
 * @constructor
 *
 * @param {object} options 包含所有参数的对象。
 * @param {string} options.name 图层的名称。
 * @param {string} options.tooltip 鼠标悬停在项目上时显示的工具提示。
 * @param {string} options.iconUrl 代表该图层的图标。
 * @param {string} [options.category] 图层的类别。
 * @param {ProviderViewModel.CreationFunction|Command} options.creationFunction 一个函数或命令。
 * 用于创建一个或多个提供器，当选择此项目时这些提供器将被添加到地球模型上。
 *
 * @see BaseLayerPicker
 * @see ImageryProvider
 * @see TerrainProvider
 */
function ProviderViewModel(options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(options.name)) {
    throw new DeveloperError("options.name is required.");
  }
  if (!defined(options.tooltip)) {
    throw new DeveloperError("options.tooltip is required.");
  }
  if (!defined(options.iconUrl)) {
    throw new DeveloperError("options.iconUrl is required.");
  }
  if (typeof options.creationFunction !== "function") {
    throw new DeveloperError("options.creationFunction is required.");
  }
  //>>includeEnd('debug');

  let creationCommand = options.creationFunction;
  if (!defined(creationCommand.canExecute)) {
    creationCommand = createCommand(creationCommand);
  }

  this._creationCommand = creationCommand;

  /**
   * 获取显示名称。此属性是可观察的。
   * @type {string}
   */
  this.name = options.name;

  /**
   * 获取工具提示。此属性是可观察的。
   * @type {string}
   */
  this.tooltip = options.tooltip;

  /**
   * 获取图标。此属性是可观察的。
   * @type {string}
   */
  this.iconUrl = options.iconUrl;

  this._category = options.category ?? "";

  knockout.track(this, ["name", "tooltip", "iconUrl"]);
}

Object.defineProperties(ProviderViewModel.prototype, {
  /**
   * 获取用于创建一个或多个提供器的命令，当选择此项目时这些提供器将被添加到地球模型上。
   * 类别。
   * @memberof ProviderViewModel.prototype
   * @type {Command}
   * @readonly
   */
  creationCommand: {
    get: function () {
      return this._creationCommand;
    },
  },

  /**
   * 创建一个或多个提供器的函数。
   * @type {string}
   * @memberof ProviderViewModel.prototype
   * @readonly
   */
  category: {
    get: function () {
      return this._category;
    },
  },
});

/**
 * 要添加到地球模型的 ImageryProvider 或 TerrainProvider，或提供器数组。
 * @callback ProviderViewModel.CreationFunction
 * @returns {ImageryProvider|TerrainProvider|ImageryProvider[]|TerrainProvider[]|Promise<TerrainProvider>|Promise<ImageryProvider>|Promise<TerrainProvider[]>|Promise<ImageryProvider[]>}
 * The ImageryProvider or TerrainProvider, or array of providers, to be added
 * to the globe.
 */
export default ProviderViewModel;
