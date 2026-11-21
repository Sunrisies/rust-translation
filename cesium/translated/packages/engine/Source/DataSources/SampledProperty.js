import {
  Check,
  DeveloperError,
  Event,
  ExtrapolationType,
  JulianDate,
  LinearApproximation,
  binarySearch,
  defined,
} from "@cesium/core";

const PackableNumber = {
  packedLength: 1,
  pack: function (value, array, startingIndex) {
    startingIndex = startingIndex ?? 0;
    array[startingIndex] = value;
  },
  unpack: function (array, startingIndex, result) {
    startingIndex = startingIndex ?? 0;
    return array[startingIndex];
  },
};

//We can't use splice for inserting new elements because function apply can't handle
//a huge number of arguments.  See https://code.google.com/p/chromium/issues/detail?id=56588
function arrayInsert(array, startIndex, items) {
  let i;
  const arrayLength = array.length;
  const itemsLength = items.length;
  const newLength = arrayLength + itemsLength;

  array.length = newLength;
  if (arrayLength !== startIndex) {
    let q = arrayLength - 1;
    for (i = newLength - 1; i >= startIndex; i--) {
      array[i] = array[q--];
    }
  }

  for (i = 0; i < itemsLength; i++) {
    array[startIndex++] = items[i];
  }
}

function convertDate(date, epoch) {
  if (date instanceof JulianDate) {
    return date;
  }
  if (typeof date === "string") {
    return JulianDate.fromIso8601(date);
  }
  return JulianDate.addSeconds(epoch, date, new JulianDate());
}

const timesSpliceArgs = [];
const valuesSpliceArgs = [];

function mergeNewSamples(epoch, times, values, newData, packedLength) {
  let newDataIndex = 0;
  let i;
  let prevItem;
  let timesInsertionPoint;
  let valuesInsertionPoint;
  let currentTime;
  let nextTime;

  while (newDataIndex < newData.length) {
    currentTime = convertDate(newData[newDataIndex], epoch);
    timesInsertionPoint = binarySearch(times, currentTime, JulianDate.compare);
    let timesSpliceArgsCount = 0;
    let valuesSpliceArgsCount = 0;

    if (timesInsertionPoint < 0) {
      //Doesn't exist, insert as many additional values as we can.
      timesInsertionPoint = ~timesInsertionPoint;

      valuesInsertionPoint = timesInsertionPoint * packedLength;
      prevItem = undefined;
      nextTime = times[timesInsertionPoint];
      while (newDataIndex < newData.length) {
        currentTime = convertDate(newData[newDataIndex], epoch);
        if (
          (defined(prevItem) &&
            JulianDate.compare(prevItem, currentTime) >= 0) ||
          (defined(nextTime) && JulianDate.compare(currentTime, nextTime) >= 0)
        ) {
          break;
        }
        timesSpliceArgs[timesSpliceArgsCount++] = currentTime;
        newDataIndex = newDataIndex + 1;
        for (i = 0; i < packedLength; i++) {
          valuesSpliceArgs[valuesSpliceArgsCount++] = newData[newDataIndex];
          newDataIndex = newDataIndex + 1;
        }
        prevItem = currentTime;
      }

      if (timesSpliceArgsCount > 0) {
        valuesSpliceArgs.length = valuesSpliceArgsCount;
        arrayInsert(values, valuesInsertionPoint, valuesSpliceArgs);

        timesSpliceArgs.length = timesSpliceArgsCount;
        arrayInsert(times, timesInsertionPoint, timesSpliceArgs);
      }
    } else {
      //Found an exact match
      for (i = 0; i < packedLength; i++) {
        newDataIndex++;
        values[timesInsertionPoint * packedLength + i] = newData[newDataIndex];
      }
      newDataIndex++;
    }
  }
}

/**
 * 一个控件，其值通过提供的样本集和指定的插值算法及程度在给定时间内进行插值计算。
 * 由提供的样本集和指定的插值算法及程度决定。
 * @alias SampledProperty
 * @constructor
 *
 * @param {number|Packable} type 控件的类型。
 * @param {Packable[]} [derivativeTypes] 当提供时，表示样本将包含指定类型的导数信息。
 *
 *
 * @example
 * //创建一个线性插值的 Cartesian2
 * const property = new Cesium.SampledProperty(Cesium.Cartesian2);
 *
 * //用数据填充它
 * property.addSample(Cesium.JulianDate.fromIso8601('2012-08-01T00:00:00.00Z'), new Cesium.Cartesian2(0, 0));
 * property.addSample(Cesium.JulianDate.fromIso8601('2012-08-02T00:00:00.00Z'), new Cesium.Cartesian2(4, 7));
 *
 * //获取插值后的值
 * const result = property.getValue(Cesium.JulianDate.fromIso8601('2012-08-01T12:00:00.00Z'));
 *
 * @example
 * //创建一个使用三阶赫米特多项式近似的简单数值 SampledProperty
 * const property = new Cesium.SampledProperty(Number);
 * property.setInterpolationOptions({
 * interpolationDegree : 3,
 * interpolationAlgorithm : Cesium.HermitePolynomialApproximation
 * });
 *
 * //用数据填充它
 * property.addSample(Cesium.JulianDate.fromIso8601('2012-08-01T00:00:00.00Z'), 1.0);
 * property.addSample(Cesium.JulianDate.fromIso8601('2012-08-01T00:01:00.00Z'), 6.0);
 * property.addSample(Cesium.JulianDate.fromIso8601('2012-08-01T00:02:00.00Z'), 12.0);
 * property.addSample(Cesium.JulianDate.fromIso8601('2012-08-01T00:03:30.00Z'), 5.0);
 * property.addSample(Cesium.JulianDate.fromIso8601('2012-08-01T00:06:30.00Z'), 2.0);
 *
 * //样本可以任意顺序添加。
 * property.addSample(Cesium.JulianDate.fromIso8601('2012-08-01T00:00:30.00Z'), 6.2);
 *
 * //获取插值后的值
 * const result = property.getValue(Cesium.JulianDate.fromIso8601('2012-08-01T00:02:34.00Z'));
 *
 * @see SampledPositionProperty
 */
function SampledProperty(type, derivativeTypes) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("type", type);
  //>>includeEnd('debug');

  let innerType = type;
  if (innerType === Number) {
    innerType = PackableNumber;
  }
  let packedLength = innerType.packedLength;
  let packedInterpolationLength =
    innerType.packedInterpolationLength ?? packedLength;

  let inputOrder = 0;
  let innerDerivativeTypes;
  if (defined(derivativeTypes)) {
    const length = derivativeTypes.length;
    innerDerivativeTypes = new Array(length);
    for (let i = 0; i < length; i++) {
      let derivativeType = derivativeTypes[i];
      if (derivativeType === Number) {
        derivativeType = PackableNumber;
      }
      const derivativePackedLength = derivativeType.packedLength;
      packedLength += derivativePackedLength;
      packedInterpolationLength +=
        derivativeType.packedInterpolationLength ?? derivativePackedLength;
      innerDerivativeTypes[i] = derivativeType;
    }
    inputOrder = length;
  }

  this._type = type;
  this._innerType = innerType;
  this._interpolationDegree = 1;
  this._interpolationAlgorithm = LinearApproximation;
  this._numberOfPoints = 0;
  this._times = [];
  this._values = [];
  this._xTable = [];
  this._yTable = [];
  this._packedLength = packedLength;
  this._packedInterpolationLength = packedInterpolationLength;
  this._updateTableLength = true;
  this._interpolationResult = new Array(packedInterpolationLength);
  this._definitionChanged = new Event();
  this._derivativeTypes = derivativeTypes;
  this._innerDerivativeTypes = innerDerivativeTypes;
  this._inputOrder = inputOrder;
  this._forwardExtrapolationType = ExtrapolationType.NONE;
  this._forwardExtrapolationDuration = 0;
  this._backwardExtrapolationType = ExtrapolationType.NONE;
  this._backwardExtrapolationDuration = 0;
}

Object.defineProperties(SampledProperty.prototype, {
  /**
   * 获取一个值，指示该属性是否为常数。如果getValue始终返回相同的结果，则该属性被视为
   * 常数。
   * @memberof SampledProperty.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return this._values.length === 0;
    },
  },
  /**
   * 当该属性的定义发生变化时，会触发此事件。
   * 如果调用getValue返回不同结果，则认为定义已改变。
   * 获取属性的类型。
   * @memberof SampledProperty.prototype
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
   * 获取该属性使用的导数类型。
   * @memberof SampledProperty.prototype
   * @type {*}
   */
  type: {
    get: function () {
      return this._type;
    },
  },
  /**
   * 获取检索值时使用的插值程度。
   * @memberof SampledProperty.prototype
   * @type {Packable[]}
   */
  derivativeTypes: {
    get: function () {
      return this._derivativeTypes;
    },
  },
  /**
   * 获取检索值时使用的插值算法。
   * @memberof SampledProperty.prototype
   * @type {number}
   * @default 1
   */
  interpolationDegree: {
    get: function () {
      return this._interpolationDegree;
    },
  },
  /**
   * Gets the interpolation algorithm to use when retrieving a value.
   * @memberof SampledProperty.prototype
   * @type {InterpolationAlgorithm}
   * @default LinearApproximation
   */
  interpolationAlgorithm: {
    get: function () {
      return this._interpolationAlgorithm;
    },
  },
  /**
   * 在请求值时执行外推的类型
   * 是在所有可用样本之后一次请求时执行的。
   * @memberof SampledProperty.prototype
   * @type {ExtrapolationType}
   * @default ExtrapolationType.NONE
   */
  forwardExtrapolationType: {
    get: function () {
      return this._forwardExtrapolationType;
    },
    set: function (value) {
      if (this._forwardExtrapolationType !== value) {
        this._forwardExtrapolationType = value;
        this._definitionChanged.raiseEvent(this);
      }
    },
  },
  /**
   * 获取或设置在
   * 属性变为未定义之前进行外推的时间量。值为 0 则无限期外推。
   * @memberof SampledProperty.prototype
   * @type {number}
   * @default 0
   */
  forwardExtrapolationDuration: {
    get: function () {
      return this._forwardExtrapolationDuration;
    },
    set: function (value) {
      if (this._forwardExtrapolationDuration !== value) {
        this._forwardExtrapolationDuration = value;
        this._definitionChanged.raiseEvent(this);
      }
    },
  },
  /**
   * 在请求值时执行外推的类型
   * 是在所有可用样本之前一次请求时执行的。
   * @memberof SampledProperty.prototype
   * @type {ExtrapolationType}
   * @default ExtrapolationType.NONE
   */
  backwardExtrapolationType: {
    get: function () {
      return this._backwardExtrapolationType;
    },
    set: function (value) {
      if (this._backwardExtrapolationType !== value) {
        this._backwardExtrapolationType = value;
        this._definitionChanged.raiseEvent(this);
      }
    },
  },
  /**
   * 获取或设置向后外推的时间量
   * 在属性变为未定义之前。值为 0 则无限期外推。
   * @memberof SampledProperty.prototype
   * @type {number}
   * @default 0
   */
  backwardExtrapolationDuration: {
    get: function () {
      return this._backwardExtrapolationDuration;
    },
    set: function (value) {
      if (this._backwardExtrapolationDuration !== value) {
        this._backwardExtrapolationDuration = value;
        this._definitionChanged.raiseEvent(this);
      }
    },
  },
});

const timeScratch = new JulianDate();

/**
 * 获取指定时间下的属性值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 检索值所花费的时间。如果省略，则使用当前系统时间。
 * @param {object} [result] 存储值的对象，如果省略，则创建并返回新实例。
 * @returns {object} The 修改后的结果参数或新实例，如果未提供结果参数。
 */
SampledProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }

  const times = this._times;
  const timesLength = times.length;
  if (timesLength === 0) {
    return undefined;
  }

  let timeout;
  const innerType = this._innerType;
  const values = this._values;
  let index = binarySearch(times, time, JulianDate.compare);

  if (index < 0) {
    index = ~index;

    if (index === 0) {
      const startTime = times[index];
      timeout = this._backwardExtrapolationDuration;
      if (
        this._backwardExtrapolationType === ExtrapolationType.NONE ||
        (timeout !== 0 &&
          JulianDate.secondsDifference(startTime, time) > timeout)
      ) {
        return undefined;
      }
      if (this._backwardExtrapolationType === ExtrapolationType.HOLD) {
        return innerType.unpack(values, 0, result);
      }
    }

    if (index >= timesLength) {
      index = timesLength - 1;
      const endTime = times[index];
      timeout = this._forwardExtrapolationDuration;
      if (
        this._forwardExtrapolationType === ExtrapolationType.NONE ||
        (timeout !== 0 && JulianDate.secondsDifference(time, endTime) > timeout)
      ) {
        return undefined;
      }
      if (this._forwardExtrapolationType === ExtrapolationType.HOLD) {
        index = timesLength - 1;
        return innerType.unpack(values, index * innerType.packedLength, result);
      }
    }

    const xTable = this._xTable;
    const yTable = this._yTable;
    const interpolationAlgorithm = this._interpolationAlgorithm;
    const packedInterpolationLength = this._packedInterpolationLength;
    const inputOrder = this._inputOrder;

    if (this._updateTableLength) {
      this._updateTableLength = false;
      const numberOfPoints = Math.min(
        interpolationAlgorithm.getRequiredDataPoints(
          this._interpolationDegree,
          inputOrder,
        ),
        timesLength,
      );
      if (numberOfPoints !== this._numberOfPoints) {
        this._numberOfPoints = numberOfPoints;
        xTable.length = numberOfPoints;
        yTable.length = numberOfPoints * packedInterpolationLength;
      }
    }

    const degree = this._numberOfPoints - 1;
    if (degree < 1) {
      return undefined;
    }

    let firstIndex = 0;
    let lastIndex = timesLength - 1;
    const pointsInCollection = lastIndex - firstIndex + 1;

    if (pointsInCollection >= degree + 1) {
      let computedFirstIndex = index - ((degree / 2) | 0) - 1;
      if (computedFirstIndex < firstIndex) {
        computedFirstIndex = firstIndex;
      }
      let computedLastIndex = computedFirstIndex + degree;
      if (computedLastIndex > lastIndex) {
        computedLastIndex = lastIndex;
        computedFirstIndex = computedLastIndex - degree;
        if (computedFirstIndex < firstIndex) {
          computedFirstIndex = firstIndex;
        }
      }

      firstIndex = computedFirstIndex;
      lastIndex = computedLastIndex;
    }
    const length = lastIndex - firstIndex + 1;

    // Build the tables
    for (let i = 0; i < length; ++i) {
      xTable[i] = JulianDate.secondsDifference(
        times[firstIndex + i],
        times[lastIndex],
      );
    }

    if (!defined(innerType.convertPackedArrayForInterpolation)) {
      let destinationIndex = 0;
      const packedLength = this._packedLength;
      let sourceIndex = firstIndex * packedLength;
      const stop = (lastIndex + 1) * packedLength;

      while (sourceIndex < stop) {
        yTable[destinationIndex] = values[sourceIndex];
        sourceIndex++;
        destinationIndex++;
      }
    } else {
      innerType.convertPackedArrayForInterpolation(
        values,
        firstIndex,
        lastIndex,
        yTable,
      );
    }

    // Interpolate!
    const x = JulianDate.secondsDifference(time, times[lastIndex]);
    let interpolationResult;
    if (inputOrder === 0 || !defined(interpolationAlgorithm.interpolate)) {
      interpolationResult = interpolationAlgorithm.interpolateOrderZero(
        x,
        xTable,
        yTable,
        packedInterpolationLength,
        this._interpolationResult,
      );
    } else {
      const yStride = Math.floor(packedInterpolationLength / (inputOrder + 1));
      interpolationResult = interpolationAlgorithm.interpolate(
        x,
        xTable,
        yTable,
        yStride,
        inputOrder,
        inputOrder,
        this._interpolationResult,
      );
    }

    if (!defined(innerType.unpackInterpolationResult)) {
      return innerType.unpack(interpolationResult, 0, result);
    }
    return innerType.unpackInterpolationResult(
      interpolationResult,
      values,
      firstIndex,
      lastIndex,
      result,
    );
  }
  return innerType.unpack(values, index * this._packedLength, result);
};

/**
 * 设置插值时使用的算法和程度。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {InterpolationAlgorithm} [options.interpolationAlgorithm] 新的插值算法。如果未定义，现有属性保持不变。
 * @param {number} [options.interpolationDegree] 新的插值程度。如果未定义，现有属性保持不变。
 */
SampledProperty.prototype.setInterpolationOptions = function (options) {
  if (!defined(options)) {
    return;
  }

  let valuesChanged = false;

  const interpolationAlgorithm = options.interpolationAlgorithm;
  const interpolationDegree = options.interpolationDegree;

  if (
    defined(interpolationAlgorithm) &&
    this._interpolationAlgorithm !== interpolationAlgorithm
  ) {
    this._interpolationAlgorithm = interpolationAlgorithm;
    valuesChanged = true;
  }

  if (
    defined(interpolationDegree) &&
    this._interpolationDegree !== interpolationDegree
  ) {
    this._interpolationDegree = interpolationDegree;
    valuesChanged = true;
  }

  if (valuesChanged) {
    this._updateTableLength = true;
    this._definitionChanged.raiseEvent(this);
  }
};

/**
 * 添加一个新的样本。
 *
 * @param {JulianDate} time 样本时间。
 * @param {Packable} value 指定时间下的数值。
 * @param {Packable[]} [derivatives] 指定时间下的导数数组。
 */
SampledProperty.prototype.addSample = function (time, value, derivatives) {
  const innerDerivativeTypes = this._innerDerivativeTypes;
  const hasDerivatives = defined(innerDerivativeTypes);

  //>>includeStart('debug', pragmas.debug);
  Check.defined("time", time);
  Check.defined("value", value);
  if (hasDerivatives) {
    Check.defined("derivatives", derivatives);
  }
  //>>includeEnd('debug');

  const innerType = this._innerType;
  const data = [];
  data.push(time);
  innerType.pack(value, data, data.length);

  if (hasDerivatives) {
    const derivativesLength = innerDerivativeTypes.length;
    for (let x = 0; x < derivativesLength; x++) {
      innerDerivativeTypes[x].pack(derivatives[x], data, data.length);
    }
  }
  mergeNewSamples(
    undefined,
    this._times,
    this._values,
    data,
    this._packedLength,
  );
  this._updateTableLength = true;
  this._definitionChanged.raiseEvent(this);
};

/**
 * 添加一个样本数组。
 *
 * @param {JulianDate[]} times 一个 JulianDate 实例数组，每个索引对应一个样本时间。
 * @param {Packable[]} values 值数组，每个值对应指定的时间索引。
 * @param {Array[]} [derivativeValues] 一个数组，其中每个项目都是等效时间索引下的导数数组。
 *
 * @exception {DeveloperError} times 且值的长度必须相同。
 * @exception {DeveloperError} times 且 derivativeValues 的长度必须相同。
 */
SampledProperty.prototype.addSamples = function (
  times,
  values,
  derivativeValues,
) {
  const innerDerivativeTypes = this._innerDerivativeTypes;
  const hasDerivatives = defined(innerDerivativeTypes);

  //>>includeStart('debug', pragmas.debug);
  Check.defined("times", times);
  Check.defined("values", values);
  if (times.length !== values.length) {
    throw new DeveloperError("times and values must be the same length.");
  }
  if (
    hasDerivatives &&
    (!defined(derivativeValues) || derivativeValues.length !== times.length)
  ) {
    throw new DeveloperError(
      "times and derivativeValues must be the same length.",
    );
  }
  //>>includeEnd('debug');

  const innerType = this._innerType;
  const length = times.length;
  const data = [];
  for (let i = 0; i < length; i++) {
    data.push(times[i]);
    innerType.pack(values[i], data, data.length);

    if (hasDerivatives) {
      const derivatives = derivativeValues[i];
      const derivativesLength = innerDerivativeTypes.length;
      for (let x = 0; x < derivativesLength; x++) {
        innerDerivativeTypes[x].pack(derivatives[x], data, data.length);
      }
    }
  }
  mergeNewSamples(
    undefined,
    this._times,
    this._values,
    data,
    this._packedLength,
  );
  this._updateTableLength = true;
  this._definitionChanged.raiseEvent(this);
};

/**
 * 获取与索引对应的指定样本的时间。负索引按相反顺序访问样本列表。
 *
 * @param {number} index 样本列表的索引。
 * @returns {JulianDate | undefined} The 样本的 JulianDate 时间，如果失败则未定义。
 */
SampledProperty.prototype.getSample = function (index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  const times = this._times;
  const len = times.length;
  if (!defined(len)) {
    return undefined;
  }

  if (index < 0) {
    index += len;
  }

  return times[index];
};

/**
 * 将样本作为单个打包数组添加，每个新样本表示为一个日期，
 * 随后是对应值和导数的打包表示。
 *
 * @param {number[]} packedSamples 打包样本的数组。
 * @param {JulianDate} [epoch] 如果 packedSamples 中的任何日期是数字，则视为从当前纪元开始的秒数偏移量。
 */
SampledProperty.prototype.addSamplesPackedArray = function (
  packedSamples,
  epoch,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("packedSamples", packedSamples);
  //>>includeEnd('debug');

  mergeNewSamples(
    epoch,
    this._times,
    this._values,
    packedSamples,
    this._packedLength,
  );
  this._updateTableLength = true;
  this._definitionChanged.raiseEvent(this);
};

/**
 * 如果存在，在给定时间移除一个样本。
 *
 * @param {JulianDate} time 样本时间。
 * @returns {boolean} <code>true</code> 如果时间上的样本被移除，返回 <code>false</code>，否则返回真。
 */
SampledProperty.prototype.removeSample = function (time) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("time", time);
  //>>includeEnd('debug');

  const index = binarySearch(this._times, time, JulianDate.compare);
  if (index < 0) {
    return false;
  }
  removeSamples(this, index, 1);
  return true;
};

function removeSamples(property, startIndex, numberToRemove) {
  const packedLength = property._packedLength;
  property._times.splice(startIndex, numberToRemove);
  property._values.splice(
    startIndex * packedLength,
    numberToRemove * packedLength,
  );
  property._updateTableLength = true;
  property._definitionChanged.raiseEvent(property);
}

/**
 * 移除给定时间间隔内的所有样本。
 *
 * @param {TimeInterval} time 用于移除所有样本的时间间隔。
 */
SampledProperty.prototype.removeSamples = function (timeInterval) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("timeInterval", timeInterval);
  //>>includeEnd('debug');

  const times = this._times;
  let startIndex = binarySearch(times, timeInterval.start, JulianDate.compare);
  if (startIndex < 0) {
    startIndex = ~startIndex;
  } else if (!timeInterval.isStartIncluded) {
    ++startIndex;
  }
  let stopIndex = binarySearch(times, timeInterval.stop, JulianDate.compare);
  if (stopIndex < 0) {
    stopIndex = ~stopIndex;
  } else if (timeInterval.isStopIncluded) {
    ++stopIndex;
  }

  removeSamples(this, startIndex, stopIndex - startIndex);
};

/**
 * 将此属性与提供的属性进行比较并返回结果。
 * 如果两者相等，返回 <code>true</code>；否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>；否则返回 <code>false</code>。
 */
SampledProperty.prototype.equals = function (other) {
  if (this === other) {
    return true;
  }
  if (!defined(other)) {
    return false;
  }

  if (
    this._type !== other._type || //
    this._interpolationDegree !== other._interpolationDegree || //
    this._interpolationAlgorithm !== other._interpolationAlgorithm
  ) {
    return false;
  }

  const derivativeTypes = this._derivativeTypes;
  const hasDerivatives = defined(derivativeTypes);
  const otherDerivativeTypes = other._derivativeTypes;
  const otherHasDerivatives = defined(otherDerivativeTypes);
  if (hasDerivatives !== otherHasDerivatives) {
    return false;
  }

  let i;
  let length;
  if (hasDerivatives) {
    length = derivativeTypes.length;
    if (length !== otherDerivativeTypes.length) {
      return false;
    }

    for (i = 0; i < length; i++) {
      if (derivativeTypes[i] !== otherDerivativeTypes[i]) {
        return false;
      }
    }
  }

  const times = this._times;
  const otherTimes = other._times;
  length = times.length;

  if (length !== otherTimes.length) {
    return false;
  }

  for (i = 0; i < length; i++) {
    if (!JulianDate.equals(times[i], otherTimes[i])) {
      return false;
    }
  }

  const values = this._values;
  const otherValues = other._values;
  length = values.length;

  //Since time lengths are equal, values length and other length are guaranteed to be equal.
  for (i = 0; i < length; i++) {
    if (values[i] !== otherValues[i]) {
      return false;
    }
  }

  return true;
};

//Exposed for testing.
SampledProperty._mergeNewSamples = mergeNewSamples;
export default SampledProperty;
