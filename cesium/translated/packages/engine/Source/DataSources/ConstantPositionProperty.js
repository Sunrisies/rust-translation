import {
  Cartesian3,
  DeveloperError,
  Event,
  JulianDate,
  ReferenceFrame,
  defined,
} from "@cesium/core";
import PositionProperty from "./PositionProperty.js";

/**
 * 一个<code>PositionProperty</code>，其值相对于
 * {@link 参考框架} 保持不变。
 *
 * @alias ConstantPositionProperty
 * @constructor
 *
 * @param {Cartesian3} [value] 属性值。
 * @param {ReferenceFrame} [referenceFrame=ReferenceFrame.FIXED] 定义位置所采用的参考框架。
 */
function ConstantPositionProperty(value, referenceFrame) {
  this._definitionChanged = new Event();
  this._value = Cartesian3.clone(value);
  this._referenceFrame = referenceFrame ?? ReferenceFrame.FIXED;
}

Object.defineProperties(ConstantPositionProperty.prototype, {
  /**
   * 获取一个指示该属性是否为常量的值。如果`getValue`始终返回相同的结果，则该属性被视为
   * 常量。
   * @memberof ConstantPositionProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        !defined(this._value) || this._referenceFrame === ReferenceFrame.FIXED
      );
    },
  },
  /**
   * 当该属性的定义发生变化时引发的事件。
   * 如果调用`getValue`在相同时间内返回不同的结果，则认为定义已改变。
   * 定义位置所采用的参考框架。
   * @memberof ConstantPositionProperty.prototype
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
   * Gets the reference frame in which the position is defined.
   * @memberof ConstantPositionProperty.prototype
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
 * 在指定时间下的属性值（以固定参考框架表示）。
 *
 * @param {JulianDate} [time=JulianDate.now()] 获取值的时间。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象。如果省略，则创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
ConstantPositionProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return this.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
};

/**
 * 设置属性值。
 *
 * @param {Cartesian3} value 属性值。
 * @param {ReferenceFrame} [referenceFrame=this.referenceFrame] 定义位置所采用的参考框架。
 */
ConstantPositionProperty.prototype.setValue = function (value, referenceFrame) {
  let definitionChanged = false;
  if (!Cartesian3.equals(this._value, value)) {
    definitionChanged = true;
    this._value = Cartesian3.clone(value);
  }
  if (defined(referenceFrame) && this._referenceFrame !== referenceFrame) {
    definitionChanged = true;
    this._referenceFrame = referenceFrame;
  }
  if (definitionChanged) {
    this._definitionChanged.raiseEvent(this);
  }
};

/**
 * 在指定时间和参考框架下获取属性值。
 *
 * @param {JulianDate} time 获取值的时间。
 * @param {ReferenceFrame} referenceFrame 结果的期望参考框架。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，则创建并返回新实例。
 * @returns {Cartesian3} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
ConstantPositionProperty.prototype.getValueInReferenceFrame = function (
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

  return PositionProperty.convertToReferenceFrame(
    time,
    this._value,
    this._referenceFrame,
    referenceFrame,
    result,
  );
};

/**
 * 将此属性与提供的属性进行比较，如果相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
ConstantPositionProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof ConstantPositionProperty &&
      Cartesian3.equals(this._value, other._value) &&
      this._referenceFrame === other._referenceFrame)
  );
};
export default ConstantPositionProperty;
