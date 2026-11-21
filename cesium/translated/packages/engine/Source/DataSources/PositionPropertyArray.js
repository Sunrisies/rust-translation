import {
  DeveloperError,
  Event,
  EventHelper,
  JulianDate,
  ReferenceFrame,
  defined,
} from "@cesium/core";
import Property from "./Property.js";

/**
 * A {@link Property} whose value is an array whose items are the computed value
 * 来自其他 PositionProperty 实例的值。
 *
 * @alias PositionPropertyArray
 * @constructor
 *
 * @param {Property[]} [value] Property 实例的数组。
 * @param {ReferenceFrame} [referenceFrame=ReferenceFrame.FIXED] 定义位置所在的参考框架。
 */
function PositionPropertyArray(value, referenceFrame) {
  this._value = undefined;
  this._definitionChanged = new Event();
  this._eventHelper = new EventHelper();
  this._referenceFrame = referenceFrame ?? ReferenceFrame.FIXED;
  this.setValue(value);
}

Object.defineProperties(PositionPropertyArray.prototype, {
  /**
   * 获取一个值以指示该属性是否为常量。如果数组中的所有属性项均为常量，则该属性被视为常量。
   * 当数组中的所有属性项均恒定时，视为常量。
   * @memberof PositionPropertyArray.prototype
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
   * 当调用 setValue 并传入与当前值不同的数据或数组中的某个属性发生变化时，定义会被更新。
   * 获取定义位置所在的参考框架。
   * @memberof PositionPropertyArray.prototype
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
   * 获取该属性的值。
   * @memberof PositionPropertyArray.prototype
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
 * 获取该属性的值。如果省略，则使用当前系统时间。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的时间间隔。如果省略，则使用当前系统时间。
 * @param {Cartesian3[]} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3[]} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
PositionPropertyArray.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return this.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
};

/**
 * 获取在指定时间和参考框架下该属性的值。
 *
 * @param {JulianDate} time 检索值的时间间隔。
 * @param {ReferenceFrame} referenceFrame 期望的结果参考框架。
 * @param {Cartesian3[]} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3[]} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
PositionPropertyArray.prototype.getValueInReferenceFrame = function (
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
    const property = value[i];
    const itemValue = property.getValueInReferenceFrame(
      time,
      referenceFrame,
      result[i],
    );
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
 * @param {Property[]} value Property 实例的数组。
 */
PositionPropertyArray.prototype.setValue = function (value) {
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
          PositionPropertyArray.prototype._raiseDefinitionChanged,
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
PositionPropertyArray.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof PositionPropertyArray && //
      this._referenceFrame === other._referenceFrame && //
      Property.arrayEquals(this._value, other._value))
  );
};

PositionPropertyArray.prototype._raiseDefinitionChanged = function () {
  this._definitionChanged.raiseEvent(this);
};
export default PositionPropertyArray;