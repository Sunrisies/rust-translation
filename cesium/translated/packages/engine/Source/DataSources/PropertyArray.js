import { Event, EventHelper, JulianDate, defined } from "@cesium/core";
import Property from "./Property.js";

/**
 * 一个控件，其值为一个数组，数组元素为其他属性实例的计算值。
 * 的 computed 值。
 *
 * @alias PropertyArray
 * @constructor
 *
 * @param {Property[]} [value] 属性实例的数组。
 */
function PropertyArray(value) {
  this._value = undefined;
  this._definitionChanged = new Event();
  this._eventHelper = new EventHelper();
  this.setValue(value);
}

Object.defineProperties(PropertyArray.prototype, {
  /**
   * 获取一个值，指示该属性是否为常量。如果数组中的所有属性项均为常量，则该属性被视为常量。
   * 当数组中的所有属性项均为常量时，视为常量。
   * @memberof PropertyArray.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      const value = this._value;
      if (!defined(value)) {
        return true;
      }
      const length = value.length;
      for (let i = 0; i < length; i++) {
        if (!Property.isConstant(value[i])) {
          return false;
        }
      }
      return true;
    },
  },
  /**
   * 获取当该属性的定义发生变化时引发的事件。
   * 当调用 setValue 并传入与当前值或数组中的某个属性不同的数据时，定义会发生变化。
   * 如果结果参数未被提供，则创建并返回一个新的实例。
   * @memberof PropertyArray.prototype
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
 * 获取该属性的值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的时间。如果省略，则使用当前系统时间。
 * @param {object[]} [result] 存储值的对象。如果省略，则创建并返回一个新的实例。
 * @returns {object[]} The 修改后的结果参数，该参数是一个数组，包含在给定时间对每个包含的属性进行评估产生的数值，或者如果未提供结果参数，则使用新实例产生的数值。
 */
PropertyArray.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }

  const value = this._value;
  if (!defined(value)) {
    return undefined;
  }

  const length = value.length;
  if (!defined(result)) {
    result = new Array(length);
  }
  let i = 0;
  let x = 0;
  while (i < length) {
    const property = this._value[i];
    const itemValue = property.getValue(time, result[i]);
    if (defined(itemValue)) {
      result[x] = itemValue;
      x++;
    }
    i++;
  }
  result.length = x;
  return result;
};

/**
 * 设置该属性的值。
 *
 * @param {Property[]} value 属性实例的数组。
 */
PropertyArray.prototype.setValue = function (value) {
  const eventHelper = this._eventHelper;
  eventHelper.removeAll();

  if (defined(value)) {
    this._value = value.slice();
    const length = value.length;
    for (let i = 0; i < length; i++) {
      const property = value[i];
      if (defined(property)) {
        eventHelper.add(
          property.definitionChanged,
          PropertyArray.prototype._raiseDefinitionChanged,
          this,
        );
      }
    }
  } else {
    this._value = undefined;
  }
  this._definitionChanged.raiseEvent(this);
};

/**
 * 比较该属性与提供的属性，如果相等则返回 <code>true</code>，否则返回 <code>false</code>。
 * 另一个属性。
 *
 * @param {Property} [other] 如果左右两边相等，返回 <code>false</code>，否则返回 <code>true</code>。
 * @returns {boolean} <code>true</code> 如果左右两边相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
PropertyArray.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof PropertyArray && //
      Property.arrayEquals(this._value, other._value))
  );
};

PropertyArray.prototype._raiseDefinitionChanged = function () {
  this._definitionChanged.raiseEvent(this);
};
export default PropertyArray;
