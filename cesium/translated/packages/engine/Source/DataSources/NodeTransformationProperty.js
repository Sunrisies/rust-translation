import {
  Event,
  Frozen,
  JulianDate,
  TranslationRotationScale,
  defined,
} from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";

const defaultNodeTransformation = new TranslationRotationScale();

/**
 * 一个产生 {@link TranslationRotationScale} 数据的 {@link Property}。
 * @alias NodeTransformationProperty
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Property|Cartesian3} [options.translation=Cartesian3.ZERO] 一个指定应用于节点的 (x, y, z) 平移的 {@link Cartesian3} 属性。
 * @param {Property|Quaternion} [options.rotation=Quaternion.IDENTITY] 一个指定应用于节点的 (x, y, z, w) 旋转的 {@link Quaternion} 属性。
 * @param {Property|Cartesian3} [options.scale=new Cartesian3(1.0, 1.0, 1.0)] 一个指定应用于节点的 (x, y, z) 缩放的 {@link Cartesian3} 属性。
 */
function NodeTransformationProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._definitionChanged = new Event();
  this._translation = undefined;
  this._translationSubscription = undefined;
  this._rotation = undefined;
  this._rotationSubscription = undefined;
  this._scale = undefined;
  this._scaleSubscription = undefined;

  this.translation = options.translation;
  this.rotation = options.rotation;
  this.scale = options.scale;
}

Object.defineProperties(NodeTransformationProperty.prototype, {
  /**
   * 获取一个值以指示该属性是否为常数。如果`getValue` 始终返回相同的结果，则该属性被视为常数。
   * 当该属性的定义发生变化时，会触发此事件。
   * @memberof NodeTransformationProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return (
        Property.isConstant(this._translation) &&
        Property.isConstant(this._rotation) &&
        Property.isConstant(this._scale)
      );
    },
  },

  /**
   * 当调用`getValue` 时返回不同的结果，则认为该属性的定义已改变。
   * 如果调用`getValue` 在相同时间内返回不同的结果，则认为该属性的定义已改变。
   * 获取或设置指定应用于节点的 (x, y, z) 平移的 {@link Cartesian3} 属性。
   * @memberof NodeTransformationProperty.prototype
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
   * 获取或设置指定应用于节点的 (x, y, z, w) 旋转的 {@link Quaternion} 属性。
   * @memberof NodeTransformationProperty.prototype
   * @type {Property|undefined}
   * @default Cartesian3.ZERO
   */
  translation: createPropertyDescriptor("translation"),

  /**
   * 获取或设置指定应用于节点的 (x, y, z) 缩放的 {@link Cartesian3} 属性。
   * @memberof NodeTransformationProperty.prototype
   * @type {Property|undefined}
   * @default Quaternion.IDENTITY
   */
  rotation: createPropertyDescriptor("rotation"),

  /**
   * 获取或设置指定应用于节点的 (x, y, z) 缩放的 {@link Cartesian3} 属性。
   * @memberof NodeTransformationProperty.prototype
   * @type {Property|undefined}
   * @default new Cartesian3(1.0, 1.0, 1.0)
   */
  scale: createPropertyDescriptor("scale"),
});

const timeScratch = new JulianDate();

/**
 * 获取指定时间下的属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 用于检索值的时间。如果省略，则使用当前系统时间。
 * @param {TranslationRotationScale} [result] 用于存储值的对象。如果省略，则创建并返回一个新的实例。
 * @returns {TranslationRotationScale} The 如果未提供结果参数，则返回修改后的结果参数或新实例。
 */
NodeTransformationProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  if (!defined(result)) {
    result = new TranslationRotationScale();
  }

  result.translation = Property.getValueOrClonedDefault(
    this._translation,
    time,
    defaultNodeTransformation.translation,
    result.translation,
  );
  result.rotation = Property.getValueOrClonedDefault(
    this._rotation,
    time,
    defaultNodeTransformation.rotation,
    result.rotation,
  );
  result.scale = Property.getValueOrClonedDefault(
    this._scale,
    time,
    defaultNodeTransformation.scale,
    result.scale,
  );
  return result;
};

/**
 * 比较该属性与提供的属性，如果相等则返回<code>true</code>，否则返回<code>false</code>。
 * 另一个属性。
 *
 * @param {Property} [other] 如果左右值相等，则返回<code>false</code>，否则返回<code>true</code>。
 * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
 */
NodeTransformationProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof NodeTransformationProperty &&
      Property.equals(this._translation, other._translation) &&
      Property.equals(this._rotation, other._rotation) &&
      Property.equals(this._scale, other._scale))
  );
};
export default NodeTransformationProperty;
