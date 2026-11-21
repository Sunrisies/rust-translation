import {
  DeveloperError,
  Event,
  JulianDate,
  ReferenceFrame,
  defined,
} from "@cesium/core";
import PositionProperty from "./PositionProperty.js";

/**
 * 一个<code>PositionProperty</code>，其值由回调函数延迟计算。
 *
 * @alias CallbackPositionProperty
 * @constructor
 *
 * @param {CallbackPositionProperty.Callback} callback 在评估位置属性时调用的函数。
 * @param {boolean} isConstant 当回调函数每次返回相同的值时，返回<code>true</code>；如果值会变化，则返回<code>false</code>。
 * @param {ReferenceFrame} [referenceFrame=ReferenceFrame.FIXED] 定义位置所在的参考框架。
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=callback-position-property|Cesium Sandcastle Callback Position Property Demo}
 */
function CallbackPositionProperty(callback, isConstant, referenceFrame) {
  this._callback = undefined;
  this._isConstant = undefined;
  this._referenceFrame = referenceFrame ?? ReferenceFrame.FIXED;
  this._definitionChanged = new Event();
  this.setCallback(callback, isConstant);
}

Object.defineProperties(CallbackPositionProperty.prototype, {
  /**
   * 获取表示该属性是否恒定的值。
   * @memberof CallbackPositionProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return this._isConstant;
    },
  },
  /**
   * 获取当该属性的定义发生变化时引发的事件。
   * 如果调用`getValue`返回的结果不同，则认为定义已改变。
   * 获取定义变更时的参考框架。
   * @memberof CallbackPositionProperty.prototype
   *
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
  /**
   * 获取在固定参考框架中该位置的定义。
   * @memberof CallbackPositionProperty.prototype
   * @type {ReferenceFrame}
   * @default ReferenceFrame.FIXED;
   */
  referenceFrame: {
    get: function () {
      return this._referenceFrame;
    },
  },
});

const timeScratch = new JulianDate();

/**
 * 获取在指定时间下的属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的持续时间。如果省略，则使用当前系统时间。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改过的结果参数或新实例（如果未提供结果参数）。
 */
CallbackPositionProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return this.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
};

/**
 * 设置要使用的回调函数。
 *
 * @param {CallbackPositionProperty.Callback} callback 在评估属性时调用的函数。
 * @param {boolean} isConstant 当回调函数每次返回相同的值时，返回<code>true</code>；如果值会变化，则返回<code>false</code>。
 */
CallbackPositionProperty.prototype.setCallback = function (
  callback,
  isConstant,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(callback)) {
    throw new DeveloperError("callback is required.");
  }
  if (!defined(isConstant)) {
    throw new DeveloperError("isConstant is required.");
  }
  //>>includeEnd('debug');

  const changed =
    this._callback !== callback || this._isConstant !== isConstant;

  this._callback = callback;
  this._isConstant = isConstant;

  if (changed) {
    this._definitionChanged.raiseEvent(this);
  }
};

/**
 * 获取在指定时间和参考框架下的属性值。
 *
 * @param {JulianDate} time 检索值的持续时间。
 * @param {ReferenceFrame} referenceFrame 结果所需的参考框架。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改过的结果参数或新实例（如果未提供结果参数）。
 */
CallbackPositionProperty.prototype.getValueInReferenceFrame = function (
  time,
  referenceFrame,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(time)) {
    throw new DeveloperError("time is required.");
  }
  if (!defined(referenceFrame)) {
    throw new DeveloperError("referenceFrame is required.");
  }
  //>>includeEnd('debug');

  const value = this._callback(time, result);

  return PositionProperty.convertToReferenceFrame(
    time,
    value,
    this._referenceFrame,
    referenceFrame,
    result,
  );
};

/**
 * 比较该属性和提供的属性，返回
 * 如果它们相等，返回<code>true</code>，否则返回<code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回<code>false</code>，否则返回<code>true</code>。
 */
CallbackPositionProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof CallbackPositionProperty &&
      this._callback === other._callback &&
      this._isConstant === other._isConstant &&
      this._referenceFrame === other._referenceFrame)
  );
};

/**
 * 返回位置属性值的函数。
 * @callback CallbackPositionProperty.Callback
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的持续时间。如果省略，则使用当前系统时间。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，函数必须创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改过的结果参数或新实例（如果未提供结果参数或不受支持）。
 */
export default CallbackPositionProperty;
