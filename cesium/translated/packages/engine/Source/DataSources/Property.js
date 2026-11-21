import { DeveloperError, defined } from "@cesium/core";

/**
 * 所有属性的接口，表示可以随时间变化的值。
 * 这种类型定义了一个接口，无法直接实例化。
 *
 * @alias Property
 * @constructor
 * @abstract
 *
 * @see CompositeProperty
 * @see ConstantProperty
 * @see SampledProperty
 * @see TimeIntervalCollectionProperty
 * @see MaterialProperty
 * @see PositionProperty
 * @see ReferenceProperty
 */
function Property() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(Property.prototype, {
  /**
   * 获取一个值以指示该属性是否为常量。如果 `getValue` 始终返回相同的结果，则该属性被视为常量。
   * 常量是指对于当前定义而言，`getValue` 总是返回相同的结果。
   * @memberof Property.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取当该属性定义发生变化时引发的事件。
   * 如果调用 `getValue` 会返回不同结果，则认为定义已改变。
   * 获取指定时间下的属性值。如果省略，则使用当前系统时间。
   * @memberof Property.prototype
   *
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: DeveloperError.throwInstantiationError,
  },
});

/**
 * 获取指定时间下的属性值。如果省略，将创建并返回一个新的实例。
 * @function
 *
 * @param {JulianDate} [time=JulianDate.now()] 用于检索值的时长。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储该值的对象。如果省略，将创建并返回一个新的实例。
 * @returns {object} The 如果未提供结果参数，则返回修改后的结果或一个新的实例。
 */
Property.prototype.getValue = DeveloperError.throwInstantiationError;

/**
 * 比较此属性与提供的属性，如果相等则返回 <code>true</code>，否则返回 <code>false</code>。
 * 
 * @function
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
Property.prototype.equals = DeveloperError.throwInstantiationError;

/**
 * @private
 */
Property.equals = function (left, right) {
  return left === right || (defined(left) && left.equals(right));
};

/**
 * @private
 */
Property.arrayEquals = function (left, right) {
  if (left === right) {
    return true;
  }
  if (!defined(left) || !defined(right) || left.length !== right.length) {
    return false;
  }
  const length = left.length;
  for (let i = 0; i < length; i++) {
    if (!Property.equals(left[i], right[i])) {
      return false;
    }
  }
  return true;
};

/**
 * @private
 */
Property.isConstant = function (property) {
  return !defined(property) || property.isConstant;
};

/**
 * @private
 */
Property.getValueOrUndefined = function (property, time, result) {
  return defined(property) ? property.getValue(time, result) : undefined;
};

/**
 * @private
 */
Property.getValueOrDefault = function (property, time, valueDefault, result) {
  return defined(property)
    ? (property.getValue(time, result) ?? valueDefault)
    : valueDefault;
};

/**
 * @private
 */
Property.getValueOrClonedDefault = function (
  property,
  time,
  valueDefault,
  result,
) {
  let value;
  if (defined(property)) {
    value = property.getValue(time, result);
  }
  if (!defined(value)) {
    value = valueDefault.clone(value);
  }
  return value;
};
export default Property;
