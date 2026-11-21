import { Frozen, JulianDate, TimeStandard, defined } from "@cesium/core";
import buildModuleUrl from "./buildModuleUrl.js";
import Iau2006XysSample from "./Iau2006XysSample.js";
import Resource from "./Resource.js";

/**
 * 用于评估国际天球参考框架与国际地球参考框架之间转换的 IAU2006 XYS 数据集。
 * 国际天球参考框架 (ICRF) 与国际地球参考框架 (ITRF) 之间的转换。
 *
 * @alias Iau2006XysData
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Resource|string} [options.xysFileUrlTemplate='Assets/IAU2006_XYS/IAU2006_XYS_{0}.json'] 获取 XYS 数据的模板 URL。在模板中，
 * `{0}` 将被替换为文件索引。
 * @param {number} [options.interpolationOrder=9] 对 XYS 数据进行插值处理的顺序。
 * @param {number} [options.sampleZeroJulianEphemerisDate=2442396.5] 第一个 XYS 样本的朱利安历元日期 (JED)。
 * 连续 XYS 样本之间的步长，以天为单位。
 * @param {number} [options.stepSizeDays=1.0] 每个 XYS 文件中的样本数量。
 * @param {number} [options.samplesPerXysFile=1000] 所有 XYS 文件中的总样本数量。
 * @param {number} [options.totalSamples=27426] 所有 XYS 文件中的总样本数。
 *
 * @private
 */
function Iau2006XysData(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._xysFileUrlTemplate = Resource.createIfNeeded(
    options.xysFileUrlTemplate,
  );
  this._interpolationOrder = options.interpolationOrder ?? 9;
  this._sampleZeroJulianEphemerisDate =
    options.sampleZeroJulianEphemerisDate ?? 2442396.5;
  this._sampleZeroDateTT = new JulianDate(
    this._sampleZeroJulianEphemerisDate,
    0.0,
    TimeStandard.TAI,
  );
  this._stepSizeDays = options.stepSizeDays ?? 1.0;
  this._samplesPerXysFile = options.samplesPerXysFile ?? 1000;
  this._totalSamples = options.totalSamples ?? 27426;
  this._samples = new Array(this._totalSamples * 3);
  this._chunkDownloadsInProgress = [];

  const order = this._interpolationOrder;

  // Compute denominators and X values for interpolation.
  const denom = (this._denominators = new Array(order + 1));
  const xTable = (this._xTable = new Array(order + 1));

  const stepN = Math.pow(this._stepSizeDays, order);

  for (let i = 0; i <= order; ++i) {
    denom[i] = stepN;
    xTable[i] = i * this._stepSizeDays;

    for (let j = 0; j <= order; ++j) {
      if (j !== i) {
        denom[i] *= i - j;
      }
    }

    denom[i] = 1.0 / denom[i];
  }

  // Allocate scratch arrays for interpolation.
  this._work = new Array(order + 1);
  this._coef = new Array(order + 1);
}

const julianDateScratch = new JulianDate(0, 0.0, TimeStandard.TAI);

function getDaysSinceEpoch(xys, dayTT, secondTT) {
  const dateTT = julianDateScratch;
  dateTT.dayNumber = dayTT;
  dateTT.secondsOfDay = secondTT;
  return JulianDate.daysDifference(dateTT, xys._sampleZeroDateTT);
}

/**
 * 预加载指定日期范围内的 XYS 数据。
 *
 * @param {number} startDayTT 预加载区间开始的朱利安日数，以地球时间 (TT) 标准表示。
 * 预加载区间开始的中午过后秒数，以地球时间 (TT) 标准表示。
 * @param {number} startSecondTT 预加载区间结束的中午过后秒数，以地球时间 (TT) 标准表示。
 * 预加载区间结束的朱利安日数，以地球时间 (TT) 标准表示。
 * @param {number} stopDayTT 预加载区间结束的中午过后秒数，以地球时间 (TT) 标准表示。
 * 预加载区间结束的中午过后秒数，以地球时间 (TT) 标准表示。
 * @param {number} stopSecondTT 预加载区间结束的中午过后秒数，以地球时间 (TT) 标准表示。
 * 预加载区间开始的中午过后秒数，以地球时间 (TT) 标准表示。
 * @returns {Promise<void>} A 承诺：解析后表明所请求的区间已被预加载。
 * 预加载完成。
 */
Iau2006XysData.prototype.preload = function (
  startDayTT,
  startSecondTT,
  stopDayTT,
  stopSecondTT,
) {
  const startDaysSinceEpoch = getDaysSinceEpoch(
    this,
    startDayTT,
    startSecondTT,
  );
  const stopDaysSinceEpoch = getDaysSinceEpoch(this, stopDayTT, stopSecondTT);

  let startIndex =
    (startDaysSinceEpoch / this._stepSizeDays - this._interpolationOrder / 2) |
    0;
  if (startIndex < 0) {
    startIndex = 0;
  }

  let stopIndex =
    (stopDaysSinceEpoch / this._stepSizeDays - this._interpolationOrder / 2) |
    (0 + this._interpolationOrder);
  if (stopIndex >= this._totalSamples) {
    stopIndex = this._totalSamples - 1;
  }

  const startChunk = (startIndex / this._samplesPerXysFile) | 0;
  const stopChunk = (stopIndex / this._samplesPerXysFile) | 0;

  const promises = [];
  for (let i = startChunk; i <= stopChunk; ++i) {
    promises.push(requestXysChunk(this, i));
  }

  return Promise.all(promises);
};

/**
 * 通过插值计算给定日期的 XYS 值。如果所需数据尚未下载，
 * 该方法将返回 undefined。
 *
 * @param {number} dayTT 用于计算 XYS 值的朱利安日数，以地球时间 (TT) 标准表示。
 * 计算 XYS 值日期的中午过后秒数，以地球时间 (TT) 标准表示。
 * @param {number} secondTT 计算 XYS 值日期的中午过后秒数，以地球时间 (TT) 标准表示。
 * 计算 XYS 值日期的中午过后秒数，以地球时间 (TT) 标准表示。
 * @param {Iau2006XysSample} [result] 要复制插值结果的实例。如果此参数
 * 为 undefined，则分配并返回新实例。
 * @returns {Iau2006XysSample|undefined} The 插值后的 XYS 值，如果此计算所需的数据尚未下载，则返回 undefined。
 * computation has not yet been downloaded.
 *
 * @see Iau2006XysData#preload
 */
Iau2006XysData.prototype.computeXysRadians = function (
  dayTT,
  secondTT,
  result,
) {
  const daysSinceEpoch = getDaysSinceEpoch(this, dayTT, secondTT);
  if (daysSinceEpoch < 0.0) {
    // Can't evaluate prior to the epoch of the data.
    return undefined;
  }

  const centerIndex = (daysSinceEpoch / this._stepSizeDays) | 0;
  if (centerIndex >= this._totalSamples) {
    // Can't evaluate after the last sample in the data.
    return undefined;
  }

  const degree = this._interpolationOrder;

  let firstIndex = centerIndex - ((degree / 2) | 0);
  if (firstIndex < 0) {
    firstIndex = 0;
  }
  let lastIndex = firstIndex + degree;
  if (lastIndex >= this._totalSamples) {
    lastIndex = this._totalSamples - 1;
    firstIndex = lastIndex - degree;
    if (firstIndex < 0) {
      firstIndex = 0;
    }
  }

  // Are all the samples we need present?
  // We can assume so if the first and last are present
  let isDataMissing = false;
  const samples = this._samples;
  if (!defined(samples[firstIndex * 3])) {
    requestXysChunk(this, (firstIndex / this._samplesPerXysFile) | 0);
    isDataMissing = true;
  }

  if (!defined(samples[lastIndex * 3])) {
    requestXysChunk(this, (lastIndex / this._samplesPerXysFile) | 0);
    isDataMissing = true;
  }

  if (isDataMissing) {
    return undefined;
  }

  if (!defined(result)) {
    result = new Iau2006XysSample(0.0, 0.0, 0.0);
  } else {
    result.x = 0.0;
    result.y = 0.0;
    result.s = 0.0;
  }

  const x = daysSinceEpoch - firstIndex * this._stepSizeDays;

  const work = this._work;
  const denom = this._denominators;
  const coef = this._coef;
  const xTable = this._xTable;

  let i, j;
  for (i = 0; i <= degree; ++i) {
    work[i] = x - xTable[i];
  }

  for (i = 0; i <= degree; ++i) {
    coef[i] = 1.0;

    for (j = 0; j <= degree; ++j) {
      if (j !== i) {
        coef[i] *= work[j];
      }
    }

    coef[i] *= denom[i];

    let sampleIndex = (firstIndex + i) * 3;
    result.x += coef[i] * samples[sampleIndex++];
    result.y += coef[i] * samples[sampleIndex++];
    result.s += coef[i] * samples[sampleIndex];
  }

  return result;
};

Iau2006XysData.prototype._updateChunkData = function (index, { samples }) {
  this._chunkDownloadsInProgress[index] = undefined;

  const samplesPerFile = this._samplesPerXysFile;
  const startIndex = index * samplesPerFile * 3;

  for (let i = 0; i < samples.length; ++i) {
    this._samples[startIndex + i] = samples[i];
  }
};

async function requestXysChunkJson(resource, index, xysData) {
  try {
    const chunk = await resource.fetchJson();
    xysData._updateChunkData(index, chunk);
  } catch (e) {
    // Swallow the error. Proper error handling was not initially implemented
    // for this class, and upstream systems all have fallbacks.
  }
}

function requestXysChunk(xysData, chunkIndex) {
  if (defined(xysData._chunkDownloadsInProgress[chunkIndex])) {
    // Chunk has already been requested.
    return xysData._chunkDownloadsInProgress[chunkIndex];
  }

  let chunkUrl;
  const xysFileUrlTemplate = xysData._xysFileUrlTemplate;
  if (defined(xysFileUrlTemplate)) {
    chunkUrl = xysFileUrlTemplate.getDerivedResource({
      templateValues: {
        0: chunkIndex,
      },
    });
  } else {
    chunkUrl = new Resource({
      url: buildModuleUrl(`Assets/IAU2006_XYS/IAU2006_XYS_${chunkIndex}.json`),
    });
  }

  const promise = requestXysChunkJson(chunkUrl, chunkIndex, xysData);
  xysData._chunkDownloadsInProgress[chunkIndex] = promise;

  return promise;
}
export default Iau2006XysData;
