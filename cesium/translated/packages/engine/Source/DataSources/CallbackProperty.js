import { DeveloperError, Event, JulianDate, defined } from "@cesium/core";

/**
 * A {@link Property} whose value is lazily evaluated by a callback function.
 *
 * @alias CallbackProperty
 * @constructor
 *
 * @param {CallbackProperty.Callback} callback 属性计算时调用的函数。
 * @param {boolean} isConstant 当回调函数每次返回相同值时为 <code>true</code>，如果值会变化则为 <code>false</code>。
 */
function CallbackProperty(callback, isConstant) {
  this._callback = undefined;
  this._isConstant = undefined;
  this._definitionChanged = new Event();
  this.setCallback(callback, isConstant);
}

Object.defineProperties(CallbackProperty.prototype, {
  /**
   * 获取一个指示该属性是否为常量的值。
   * @memberof CallbackProperty.prototype
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
   * 获取属性定义发生变化时引发的事件。
   * 调用 setCallback 时，定义会被更改。
   * @memberof CallbackProperty.prototype
   *
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
});

const timeScratch = new JulianDate();

/**
 * 获取属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的时间间隔。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的目标对象。如果省略，将创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数或不受支持。
 */
CallbackProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return this._callback(time, result);
};

/**
 * 设置要使用的回调函数。
 *
 * @param {CallbackProperty.Callback} callback 属性计算时调用的函数。
 * @param {boolean} isConstant 当回调函数每次返回相同值时为 <code>true</code>，如果值会变化则为 <code>false</code>。
 */
CallbackProperty.prototype.setCallback = function (callback, isConstant) {
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
 * 将此属性与提供的属性进行比较并返回结果。
 * 如果两者相等则为 <code>true</code>，否则为 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等则为 <code>false</code>，否则为其他值。
 */
CallbackProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof CallbackProperty &&
      this._callback === other._callback &&
      this._isConstant === other._isConstant)
  );
};

/**
 * 返回属性值的函数。
 * @callback CallbackProperty.Callback
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的时间间隔。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的目标对象。如果省略，函数必须创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数或不受支持。
 */
export default CallbackProperty;