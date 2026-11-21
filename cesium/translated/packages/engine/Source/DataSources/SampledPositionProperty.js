import {
  Cartesian3,
  Check,
  DeveloperError,
  Event,
  JulianDate,
  ReferenceFrame,
  defined,
} from "@cesium/core";
import PositionProperty from "./PositionProperty.js";
import Property from "./Property.js";
import SampledProperty from "./SampledProperty.js";

/**
 * 一个也是 {@link PositionProperty} 的 {@link SampledProperty}。
 *
 * @alias SampledPositionProperty
 * @constructor
 *
 * @param {ReferenceFrame} [referenceFrame=ReferenceFrame.FIXED] 定义位置所采用的参考框架。
 * @param {number} [numberOfDerivatives=0] 每个位置对应的导数数量，例如速度、加速度等。
 */
function SampledPositionProperty(referenceFrame, numberOfDerivatives) {
  numberOfDerivatives = numberOfDerivatives ?? 0;

  let derivativeTypes;
  if (numberOfDerivatives > 0) {
    derivativeTypes = new Array(numberOfDerivatives);
    for (let i = 0; i < numberOfDerivatives; i++) {
      derivativeTypes[i] = Cartesian3;
    }
  }

  this._numberOfDerivatives = numberOfDerivatives;
  this._property = new SampledProperty(Cartesian3, derivativeTypes);
  this._definitionChanged = new Event();
  this._referenceFrame = referenceFrame ?? ReferenceFrame.FIXED;

  this._property._definitionChanged.addEventListener(function () {
    this._definitionChanged.raiseEvent(this);
  }, this);
}

Object.defineProperties(SampledPositionProperty.prototype, {
  /**
   * 获取一个值以指示该属性是否恒定。如果 {@codegetValue} 始终返回相同的结果，则该属性被视为恒定。
   * 获取当该属性的定义发生变化时引发的事件。
   * @memberof SampledPositionProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return this._property.isConstant;
    },
  },
  /**
   * 如果调用 {@codegetValue} 会返回不同的结果，则认为该定义已改变。
   * 如果在同一时间请求值，且调用 {@codegetValue} 返回的结果不同，则认为该定义已改变。
   * 获取定义位置所采用的参考框架。
   * @memberof SampledPositionProperty.prototype
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
   * 获取在检索值时使用的插值程度。调用 {@code`setInterpolationOptions} 可以设置此参数。
   * @memberof SampledPositionProperty.prototype
   * @type {ReferenceFrame}
   * @default ReferenceFrame.FIXED;
   */
  referenceFrame: {
    get: function () {
      return this._referenceFrame;
    },
  },
  /**
   * 获取在检索值时使用的插值算法。调用 {@code`setInterpolationOptions} 可以设置此参数。
   * @memberof SampledPositionProperty.prototype
   *
   * @type {number}
   * @default 1
   * @readonly
   */
  interpolationDegree: {
    get: function () {
      return this._property.interpolationDegree;
    },
  },
  /**
   * 该属性所包含的导数数量，例如仅位置为 0，速度为 1 等。
   * @memberof SampledPositionProperty.prototype
   *
   * @type {InterpolationAlgorithm}
   * @default LinearApproximation
   * @readonly
   */
  interpolationAlgorithm: {
    get: function () {
      return this._property.interpolationAlgorithm;
    },
  },
  /**
   * 获取或设置在请求值时使用的外推类型，即在已有样本之后才请求的值。
   * @memberof SampledPositionProperty.prototype
   *
   * @type {number}
   * @default 0
   */
  numberOfDerivatives: {
    get: function () {
      return this._numberOfDerivatives;
    },
  },
  /**
   * 获取或设置在请求值时使用的外推时间量。值为 0 则无限期外推。
   * 获取在请求值之前、已有样本之前使用的外推类型。
   * @memberof SampledPositionProperty.prototype
   * @type {ExtrapolationType}
   * @default ExtrapolationType.NONE
   */
  forwardExtrapolationType: {
    get: function () {
      return this._property.forwardExtrapolationType;
    },
    set: function (value) {
      this._property.forwardExtrapolationType = value;
    },
  },
  /**
   * 获取或设置在属性变得未定义之前向后外推的时间量。值为 0 则无限期外推。
   * 获取在提供的时间点、提供的参考框架下的位置。
   * @memberof SampledPositionProperty.prototype
   * @type {number}
   * @default 0
   */
  forwardExtrapolationDuration: {
    get: function () {
      return this._property.forwardExtrapolationDuration;
    },
    set: function (value) {
      this._property.forwardExtrapolationDuration = value;
    },
  },
  /**
   * 获取或设置在请求值之前、已有样本之前使用的外推类型。
   * 获取在提供的时间点、提供的参考框架下的位置。
   * @memberof SampledPositionProperty.prototype
   * @type {ExtrapolationType}
   * @default ExtrapolationType.NONE
   */
  backwardExtrapolationType: {
    get: function () {
      return this._property.backwardExtrapolationType;
    },
    set: function (value) {
      this._property.backwardExtrapolationType = value;
    },
  },
  /**
   * 获取或设置在属性变得未定义之前向前外推的时间量。值为 0 则无限期外推。
   * 获取提供时间点的位置。
   * @memberof SampledPositionProperty.prototype
   * @type {number}
   * @default 0
   */
  backwardExtrapolationDuration: {
    get: function () {
      return this._property.backwardExtrapolationDuration;
    },
    set: function (value) {
      this._property.backwardExtrapolationDuration = value;
    },
  },
});

const timeScratch = new JulianDate();

/**
 * 检索值所使用的时间。如果省略，则使用当前系统时间。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值所使用的时间。如果省略，则使用当前系统时间。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，则创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改的 result 参数或新实例，如果未提供 result 参数。
 */
SampledPositionProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return this.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
};

/**
 * 获取提供时间点的位置及提供的参考框架下的位置。
 *
 * @param {JulianDate} time 检索值所使用的时间。
 * @param {ReferenceFrame} referenceFrame 期望结果的参考框架。
 * @param {Cartesian3} [result] 存储值的对象。如果省略，则创建并返回新实例。
 * @returns {Cartesian3 | undefined} The 修改的 result 参数或新实例，如果未提供 result 参数。
 */
SampledPositionProperty.prototype.getValueInReferenceFrame = function (
  time,
  referenceFrame,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("time", time);
  Check.defined("referenceFrame", referenceFrame);
  //>>includeEnd('debug');

  result = this._property.getValue(time, result);
  if (defined(result)) {
    return PositionProperty.convertToReferenceFrame(
      time,
      result,
      this._referenceFrame,
      referenceFrame,
      result,
    );
  }
  return undefined;
};

/**
 * 设置插值位置时使用的算法和程度。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {InterpolationAlgorithm} [options.interpolationAlgorithm] 新的插值算法。如果未定义，则现有属性保持不变。
 * @param {number} [options.interpolationDegree] 新的插值程度。如果未定义，则保持现有属性不变。
 */
SampledPositionProperty.prototype.setInterpolationOptions = function (options) {
  this._property.setInterpolationOptions(options);
};

/**
 * 添加一个新的样本。
 *
 * @param {JulianDate} time 样本时间。
 * @param {Cartesian3} position 在给定时间的位置。
 * @param {Cartesian3[]} [derivatives] 在给定时间下的导数值数组。
 */
SampledPositionProperty.prototype.addSample = function (
  time,
  position,
  derivatives,
) {
  const numberOfDerivatives = this._numberOfDerivatives;
  //>>includeStart('debug', pragmas.debug);
  if (
    numberOfDerivatives > 0 &&
    (!defined(derivatives) || derivatives.length !== numberOfDerivatives)
  ) {
    throw new DeveloperError(
      "derivatives length must be equal to the number of derivatives.",
    );
  }
  //>>includeEnd('debug');
  this._property.addSample(time, position, derivatives);
};

/**
 * 通过并行数组添加多个样本。
 *
 * @param {JulianDate[]} times 一个 JulianDate 实例数组，每个索引对应一个样本时间。
 * @param {Cartesian3[]} positions 一个 Cartesian3 位置实例数组，每个值对应给定时间索引。
 * @param {Array[]} [derivatives] 一个数组，每个值都是包含对应时间索引导数的另一个数组。
 *
 * @exception {DeveloperError} All 数组长度必须相同。
 */
SampledPositionProperty.prototype.addSamples = function (
  times,
  positions,
  derivatives,
) {
  this._property.addSamples(times, positions, derivatives);
};

/**
 * 将样本作为单个打包数组添加，每个新样本以日期形式表示，
 * 随后是对应值和导数的打包表示。
 *
 * @param {number[]} packedSamples 打包样本的数组。
 * @param {JulianDate} [epoch] 如果 packedSamples 中的任何日期是数字，则视为从本纪元开始的秒数偏移量。
 */
SampledPositionProperty.prototype.addSamplesPackedArray = function (
  packedSamples,
  epoch,
) {
  this._property.addSamplesPackedArray(packedSamples, epoch);
};

/**
 * 如果存在，在给定时间移除一个样本。
 *
 * @param {JulianDate} time 样本时间。
 * @returns {boolean} <code>true</code> 如果时间上的样本被移除，返回 <code>false</code>，否则返回 <code>true</code>。
 */
SampledPositionProperty.prototype.removeSample = function (time) {
  return this._property.removeSample(time);
};

/**
 * 移除给定时间间隔内的所有样本。
 *
 * @param {TimeInterval} time 用于移除所有样本的时间间隔。
 */
SampledPositionProperty.prototype.removeSamples = function (timeInterval) {
  this._property.removeSamples(timeInterval);
};

/**
 * 比较此属性与提供的属性，并返回
 * 如果相等，返回 <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>true</code>。
 */
SampledPositionProperty.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof SampledPositionProperty &&
      Property.equals(this._property, other._property) && //
      this._referenceFrame === other._referenceFrame)
  );
};
export default SampledPositionProperty;
