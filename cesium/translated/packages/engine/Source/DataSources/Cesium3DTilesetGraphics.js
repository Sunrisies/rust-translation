import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";

/**
 * @typedef {object} Cesium3DTilesetGraphics.ConstructorOptions
 *
 * Cesium3DTilesetGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 指定图块集可见性的布尔属性。
 * @property {Property | string | Resource} [uri] 指定图块集 URI 的字符串或资源属性。
 * @property {Property | number} [maximumScreenSpaceError] 指定用于驱动细节级别优化的最大屏幕空间误差的数值或属性。
 */

/**
 * 由 {@link Entity} 表示的 3D 图块集。
 * 图块集模型矩阵由包含它的实体位置和方向决定。
 * 如果位置未定义，则保持未设置状态。
 *
 * @alias Cesium3DTilesetGraphics
 * @constructor
 *
 * @param {Cesium3DTilesetGraphics.ConstructorOptions} [options] 描述初始化选项的对象。
 */
function Cesium3DTilesetGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._uri = undefined;
  this._uriSubscription = undefined;
  this._maximumScreenSpaceError = undefined;
  this._maximumScreenSpaceErrorSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(Cesium3DTilesetGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof Cesium3DTilesetGraphics.prototype
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },

  /**
   * 获取或设置指定模型可见性的布尔属性。
   * @memberof Cesium3DTilesetGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定 glTF 资源 URI 的字符串属性。
   * @memberof Cesium3DTilesetGraphics.prototype
   * @type {Property|undefined}
   */
  uri: createPropertyDescriptor("uri"),

  /**
   * 获取或设置用于驱动细节级别优化的最大屏幕空间误差。
   * @memberof Cesium3DTilesetGraphics.prototype
   * @type {Property|undefined}
   */
  maximumScreenSpaceError: createPropertyDescriptor("maximumScreenSpaceError"),
});

/**
 * 复制此实例。
 *
 * @param {Cesium3DTilesetGraphics} [result] 存储结果的对象。
 * @returns {Cesium3DTilesetGraphics} The 修改后的结果参数或新实例（如果未提供）。
 */
Cesium3DTilesetGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new Cesium3DTilesetGraphics(this);
  }
  result.show = this.show;
  result.uri = this.uri;
  result.maximumScreenSpaceError = this.maximumScreenSpaceError;

  return result;
};

/**
 * 将此对象上未分配的属性赋值给提供源对象上相同属性的值。
 * 要合并到的对象。
 *
 * @param {Cesium3DTilesetGraphics} source The object to be merged into this object.
 */
Cesium3DTilesetGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.uri = this.uri ?? source.uri;
  this.maximumScreenSpaceError =
    this.maximumScreenSpaceError ?? source.maximumScreenSpaceError;
};

export default Cesium3DTilesetGraphics;
