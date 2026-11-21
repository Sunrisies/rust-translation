import {
  Cartesian3,
  Ellipsoid,
  Event,
  FixedFrameTransforms,
  JulianDate,
  Matrix3,
  Quaternion,
  defined,
} from "@cesium/core";
import Property from "./Property.js";
import VelocityVectorProperty from "./VelocityVectorProperty.js";

/**
 * 一个评估为 {@link Quaternion} 旋转的 {@link Property}
 * 基于提供的 {@link PositionProperty} 的速度。
 *
 * @alias VelocityOrientationProperty
 * @constructor
 *
 * @param {PositionProperty} [position] 用于计算方向的定位属性。
 * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] 用于确定上下方向的椭球体。
 *
 * @example
 * //创建一个具有位置和方向的实体。
 * const position = new Cesium.SampledProperty();
 * position.addSamples(...);
 * const entity = viewer.entities.add({
 * position : position,
 * orientation : new Cesium.VelocityOrientationProperty(position)
 * }));
 */
function VelocityOrientationProperty(position, ellipsoid) {
  this._velocityVectorProperty = new VelocityVectorProperty(position, true);
  this._subscription = undefined;
  this._ellipsoid = undefined;
  this._definitionChanged = new Event();

  this.ellipsoid = ellipsoid ?? Ellipsoid.default;

  const that = this;
  this._velocityVectorProperty.definitionChanged.addEventListener(function () {
    that._definitionChanged.raiseEvent(that);
  });
}

Object.defineProperties(VelocityOrientationProperty.prototype, {
  /**
   * 获取指示该属性是否恒定的值。
   * @memberof VelocityOrientationProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return Property.isConstant(this._velocityVectorProperty);
    },
  },
  /**
   * 获取当该属性定义发生变化时引发的事件。
   * @memberof VelocityOrientationProperty.prototype
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
   * 获取或设置用于计算方向的定位属性。
   * @memberof VelocityOrientationProperty.prototype
   *
   * @type {Property|undefined}
   */
  position: {
    get: function () {
      return this._velocityVectorProperty.position;
    },
    set: function (value) {
      this._velocityVectorProperty.position = value;
    },
  },
  /**
   * 获取或设置用于确定上下方向的椭球体。
   * @memberof VelocityOrientationProperty.prototype
   *
   * @type {Property|undefined}
   */
  ellipsoid: {
    get: function () {
      return this._ellipsoid;
    },
    set: function (value) {
      const oldValue = this._ellipsoid;
      if (oldValue !== value) {
        this._ellipsoid = value;
        this._definitionChanged.raiseEvent(this);
      }
    },
  },
});

const positionScratch = new Cartesian3();
const velocityScratch = new Cartesian3();
const rotationScratch = new Matrix3();
const timeScratch = new JulianDate();

/**
 * 获取指定时间下的属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值的时刻。如果省略，则使用当前系统时间。
 * @param {Quaternion} [result] 存储值的对象。如果省略，则创建并返回新实例。
 * @returns {Quaternion} The 修改后的结果参数或新实例（如果未提供结果参数）。
 */
VelocityOrientationProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  const velocity = this._velocityVectorProperty._getValue(
    time,
    velocityScratch,
    positionScratch,
  );

  if (!defined(velocity)) {
    return undefined;
  }

  FixedFrameTransforms.rotationMatrixFromPositionVelocity(
    positionScratch,
    velocity,
    this._ellipsoid,
    rotationScratch,
  );
  return Quaternion.fromRotationMatrix(rotationScratch, result);
};

/**
 * 比较该属性与提供的属性，若相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 若左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
VelocityOrientationProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof VelocityOrientationProperty &&
      Property.equals(
        this._velocityVectorProperty,
        other._velocityVectorProperty,
      ) &&
      (this._ellipsoid === other._ellipsoid ||
        this._ellipsoid.equals(other._ellipsoid)))
  );
};
export default VelocityOrientationProperty;
