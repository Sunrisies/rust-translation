import {
  Cartesian3,
  DeveloperError,
  Matrix3,
  ReferenceFrame,
  defined,
} from "@cesium/core";
import CelestialFrameTransforms from "../Core/CelestialFrameTransforms.js";
/**
 * 用于定义世界的所有 {@link Property} 对象的接口
 * 位置作为一个 {@link Cartesian3}，并关联一个 {@link ReferenceFrame}。
 * 这种类型定义了一个接口，无法直接实例化。
 *
 * @alias PositionProperty
 * @constructor
 * @abstract
 *
 * @see CallbackPositionProperty
 * @see CompositePositionProperty
 * @see ConstantPositionProperty
 * @see SampledPositionProperty
 * @see TimeIntervalCollectionPositionProperty
 */
function PositionProperty() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(PositionProperty.prototype, {
  /**
   * 获取一个值来表示该属性是否恒定。如果`getValue`始终返回相同的结果，则该属性被视为
   * 恒定的。
   * @memberof PositionProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取当该属性的定义发生变化时引发的事件。
   * 如果调用`getValue`会返回
   * 在相同时间内的不同结果，则认为定义已改变。
   * @memberof PositionProperty.prototype
   *
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取位置所关联的参考框架。
   * @memberof PositionProperty.prototype
   * @type {ReferenceFrame}
   */
  referenceFrame: {
    get: DeveloperError.throwInstantiationError,
  },
});

/**
 * 获取在指定时间下的固定参考框架中的属性值。
 * @function
 *
 * @param {JulianDate} [time=JulianDate.now()] 获取值的时间。如果省略，则使用当前系统时间。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
PositionProperty.prototype.getValue = DeveloperError.throwInstantiationError;

/**
 * 获取在指定时间和参考框架中的属性值。
 * @function
 *
 * @param {JulianDate} time 获取值的时间。
 * @param {ReferenceFrame} referenceFrame 期望的结果参考框架。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，将创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
PositionProperty.prototype.getValueInReferenceFrame =
  DeveloperError.throwInstantiationError;

/**
 * 比较该属性和提供的属性，如果相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 * @function
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>false</code>。
 */
PositionProperty.prototype.equals = DeveloperError.throwInstantiationError;

const scratchMatrix3 = new Matrix3();

/**
 * @private
 */
PositionProperty.convertToReferenceFrame = function (
  time,
  value,
  inputFrame,
  outputFrame,
  result,
) {
  if (!defined(value)) {
    return value;
  }
  if (!defined(result)) {
    result = new Cartesian3();
  }

  if (inputFrame === outputFrame) {
    return Cartesian3.clone(value, result);
  }

  const icrfToFixed =
    CelestialFrameTransforms.computeIcrfToCentralBodyFixedMatrix(
      time,
      scratchMatrix3,
    );
  if (inputFrame === ReferenceFrame.INERTIAL) {
    return Matrix3.multiplyByVector(icrfToFixed, value, result);
  }
  if (inputFrame === ReferenceFrame.FIXED) {
    return Matrix3.multiplyByVector(
      Matrix3.transpose(icrfToFixed, scratchMatrix3),
      value,
      result,
    );
  }
};
export default PositionProperty;
