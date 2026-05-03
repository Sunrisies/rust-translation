import { defined, DeveloperError } from "@cesium/engine";
import knockout from "../ThirdParty/knockout.js";
import createCommand from "../createCommand.js";

/**
 * 一个视图模型，用于表示 {@link BaseLayerPicker} 中的每个项。
 *
 * @alias ProviderViewModel
 * @constructor
 *
 * @param {object} options 包含所有参数的对象。
 * @param {string} options.name 该层的名称。
 * @param {string} options.tooltip 当鼠标悬停在该项上时显示的工具提示。
 * @param {string} options.iconUrl 代表该层的图标。
 * @param {string} [options.category] 该层的类别。
 * @param {ProviderViewModel.CreationFunction|Command} options.creationFunction 函数或命令
 * 这将创建一个或多个提供者，当选择此项时，这些提供者将被添加到全球列表中。
 *
 * @see BaseLayerPicker
 * @see ImageryProvider
 * @see TerrainProvider
 */
function ProviderViewModel(options) {
    // >>includeStart('debug', pragmas.debug);
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
    // >>includeEnd('debug');

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
     * 获取一个或更多提供者，这些提供者将被添加到
     * 当此项被选中时，会显示地球模型。
     * @memberof ProviderViewModel.prototype
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
     * 获取类别
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
 * 创建一个或多个提供者的函数。
 * @callback ProviderViewModel.CreationFunction
 * @returns {ImageryProvider|TerrainProvider|ImageryProvider[]|TerrainProvider[]|Promise<TerrainProvider>|Promise<ImageryProvider>|Promise<TerrainProvider[]>|Promise<ImageryProvider[]>}
 * 需要添加的意象提供者或地形提供者，或者一系列提供者。
 * 环球。
 */
export default ProviderViewModel;