import { Event, defined } from "@cesium/core";

/**
 * 一个属性值不会随模拟时间变化。
 *
 * @alias ConstantProperty
 * @constructor
 *
 * @param {*} [value] 属性值。
 *
 * @see ConstantPositionProperty
 */
function ConstantProperty(value) {
  this._value = undefined;
  this._hasClone = false;
  this._hasEquals = false;
  this._definitionChanged = new Event();
  this.setValue(value);
}

Object.defineProperties(ConstantProperty.prototype, {
  /**
   * 获取一个指示该属性是否恒定的值。
   * 此属性始终返回 <code>true</code>。
   * @memberof ConstantProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    value: true,
  },
  /**
   * 获取当该属性定义发生变化时引发的事件。
   * 当调用 <code>setValue</code> 并传入与当前值不同的数据时，定义会发生变化。
   * 与当前值不同。
   * @memberof ConstantProperty.prototype
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

/**
 * 获取属性的值。
 *
 * @param {JulianDate} [time] 获取值的时间。由于该值不随时间变化，此参数未被使用。
 * @param {object} [result] 存储值的对象；如果省略，则创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
ConstantProperty.prototype.getValue = function (time, result) {
  return this._hasClone ? this._value.clone(result) : this._value;
};

/**
 * 设置属性的值。
 *
 * @param {*} value 属性值。
 */
ConstantProperty.prototype.setValue = function (value) {
  const oldValue = this._value;
  if (oldValue !== value) {
    const isDefined = defined(value);
    const hasClone = isDefined && typeof value.clone === "function";
    const hasEquals = isDefined && typeof value.equals === "function";

    const changed = !hasEquals || !value.equals(oldValue);
    if (changed) {
      this._hasClone = hasClone;
      this._hasEquals = hasEquals;
      this._value = !hasClone ? value : value.clone(this._value);
      this._definitionChanged.raiseEvent(this);
    }
  }
};

/**
 * 比较此属性与提供的属性，并返回
 * 如果相等则返回 <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右相等则返回 <code>false</code>，否则返回 <code>true</code>。
 */
ConstantProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof ConstantProperty && //
      ((!this._hasEquals && this._value === other._value) || //
        (this._hasEquals && this._value.equals(other._value))))
  );
};

/**
 * 获取此属性的值。
 *
 * @returns {*} This 属性值。
 */
ConstantProperty.prototype.valueOf = function () {
  return this._value;
};

/**
 * 创建表示该属性值的字符串。
 *
 * @returns {string} A 表示属性值的字符串。
 */
ConstantProperty.prototype.toString = function () {
  return String(this._value);
};
export default ConstantProperty;
