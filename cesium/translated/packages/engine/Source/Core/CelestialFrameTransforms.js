import {
  DeveloperError,
  HeadingPitchRoll,
  JulianDate,
  Math as CesiumMath,
  Matrix3,
  TimeConstants,
  defined,
} from "@cesium/core";
import EarthOrientationParameters from "./EarthOrientationParameters.js";
import EarthOrientationParametersSample from "./EarthOrientationParametersSample.js";
import Iau2006XysData from "./Iau2006XysData.js";
import Iau2006XysSample from "./Iau2006XysSample.js";

/**
 * 包含将位置转换为不同参考框架的函数。
 *
 * @namespace CelestialFrameTransforms
 *
 * @private
 */
const CelestialFrameTransforms = {};

const gmstConstant0 = 6 * 3600 + 41 * 60 + 50.54841;
const gmstConstant1 = 8640184.812866;
const gmstConstant2 = 0.093104;
const gmstConstant3 = -6.2e-6;
const rateCoef = 1.1772758384668e-19;
const wgs84WRPrecessing = 7.2921158553e-5;
const twoPiOverSecondsInDay = CesiumMath.TWO_PI / 86400.0;
let dateInUtc = new JulianDate();

/**
 * 默认函数用于计算旋转矩阵，以将点或向量从国际天球参考框架（GCRF/ICRF）的惯性坐标系转换为中心天体（通常为地球）的固定坐标系轴。
 * 在给定时间进行照明和从惯性参考框架转换时使用。如果
 * 进行转换所需的数据尚未加载，则该函数可能返回未定义值。
 * 旋转矩阵的计算时间。
 *
 * @param {JulianDate} date 存储结果的对象。如果此参数未指定，则创建并返回一个新的实例。
 * @param {Matrix3} [result] 旋转矩阵，或者如果进行转换所需的数据尚未加载，则返回未定义值。
 * 修改后的结果参数或新的 Matrix3 实例（如果未提供）。
 * @returns {Matrix3|undefined} The // 将默认 ICRF 设置为固定变换，以匹配月球的变换。
 * Cesium.CelestialFrameTransforms.computeIcrfToCentralBodyFixedMatrix = Cesium.CelestialFrameTransforms.computeIcrfToMoonFixedMatrix;
 *
 * @example
 * 计算旋转矩阵，以将点或向量从真赤道平均分点（TEME）轴转换为
 * 给定时间下的伪固定轴。该方法将 UT1 时间标准视为等同于 UTC。
 *
 * @see CelestialFrameTransforms.computeIcrfToFixedMatrix
 * @see CelestialFrameTransforms.computeTemeToPseudoFixedMatrix
 * @see CelestialFrameTransforms.computeIcrfToMoonFixedMatrix
 */
CelestialFrameTransforms.computeIcrfToCentralBodyFixedMatrix = function (
  date,
  result,
) {
  let transformMatrix = CelestialFrameTransforms.computeIcrfToFixedMatrix(
    date,
    result,
  );
  if (!defined(transformMatrix)) {
    transformMatrix = CelestialFrameTransforms.computeTemeToPseudoFixedMatrix(
      date,
      result,
    );
  }

  return transformMatrix;
};

/**
 * 旋转矩阵的计算时间。
 * 存储结果的对象。
 *
 * @param {JulianDate} date 修改后的结果参数或新的 Matrix3 实例（如果未提供）。
 * @param {Matrix3} [result] // 将视图设置为惯性坐标系。
 * @returns {Matrix3} The 修改后的结果参数或新的 Matrix3 实例（如果未提供）。
 *
 * @example
 * // 将视图设置为惯性坐标系。
 * scene.postUpdate.addEventListener(function(scene, time) {
 * const now = Cesium.JulianDate.now();
 * const offset = Cesium.Matrix4.multiplyByPoint(camera.transform, camera.position, new Cesium.Cartesian3());
 * const transform = Cesium.Matrix4.fromRotationTranslation(Cesium.CelestialFrameTransforms.computeTemeToPseudoFixedMatrix(now));
 * const inverseTransform = Cesium.Matrix4.inverseTransformation(transform, new Cesium.Matrix4());
 * Cesium.Matrix4.multiplyByPoint(inverseTransform, offset, offset);
 * camera.lookAtTransform(transform, offset);
 * });
 */
CelestialFrameTransforms.computeTemeToPseudoFixedMatrix = function (
  date,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(date)) {
    throw new DeveloperError("date is required.");
  }
  //>>includeEnd('debug');

  // GMST is actually computed using UT1.  We're using UTC as an approximation of UT1.
  // We do not want to use the function like convertTaiToUtc in JulianDate because
  // we explicitly do not want to fail when inside the leap second.

  dateInUtc = JulianDate.addSeconds(
    date,
    -JulianDate.computeTaiMinusUtc(date),
    dateInUtc,
  );
  const utcDayNumber = dateInUtc.dayNumber;
  const utcSecondsIntoDay = dateInUtc.secondsOfDay;

  let t;
  const diffDays = utcDayNumber - 2451545;
  if (utcSecondsIntoDay >= 43200.0) {
    t = (diffDays + 0.5) / TimeConstants.DAYS_PER_JULIAN_CENTURY;
  } else {
    t = (diffDays - 0.5) / TimeConstants.DAYS_PER_JULIAN_CENTURY;
  }

  const gmst0 =
    gmstConstant0 +
    t * (gmstConstant1 + t * (gmstConstant2 + t * gmstConstant3));
  const angle = (gmst0 * twoPiOverSecondsInDay) % CesiumMath.TWO_PI;
  const ratio = wgs84WRPrecessing + rateCoef * (utcDayNumber - 2451545.5);
  const secondsSinceMidnight =
    (utcSecondsIntoDay + TimeConstants.SECONDS_PER_DAY * 0.5) %
    TimeConstants.SECONDS_PER_DAY;
  const gha = angle + ratio * secondsSinceMidnight;
  const cosGha = Math.cos(gha);
  const sinGha = Math.sin(gha);

  if (!defined(result)) {
    return new Matrix3(
      cosGha,
      sinGha,
      0.0,
      -sinGha,
      cosGha,
      0.0,
      0.0,
      0.0,
      1.0,
    );
  }
  result[0] = cosGha;
  result[1] = -sinGha;
  result[2] = 0.0;
  result[3] = sinGha;
  result[4] = cosGha;
  result[5] = 0.0;
  result[6] = 0.0;
  result[7] = 0.0;
  result[8] = 1.0;
  return result;
};

/**
 * IAU 2006 XYS 数据的来源，用于计算固定坐标系和 ICRF 坐标系之间的转换。
 * 地球定向参数（EOP）数据的来源，用于计算固定坐标系和 ICRF 坐标系之间的转换。默认情况下，所有 EOP 值都使用零值，
 * @type {Iau2006XysData}
 *
 * @see CelestialFrameTransforms.computeIcrfToFixedMatrix
 * @see CelestialFrameTransforms.computeFixedToIcrfMatrix
 *
 * @private
 */
CelestialFrameTransforms.iau2006XysData = new Iau2006XysData();

/**
 * 从而得到对 ICRF 坐标系的合理但不完全准确的表示。
 * between the Fixed and ICRF axes.  By default, zero values are used for all EOP values,
 * yielding a reasonable but not completely accurate representation of the ICRF axes.
 * @type {EarthOrientationParameters}
 *
 * @see CelestialFrameTransforms.computeIcrfToFixedMatrix
 * @see CelestialFrameTransforms.computeFixedToIcrfMatrix
 *
 * @private
 */
CelestialFrameTransforms.earthOrientationParameters =
  EarthOrientationParameters.NONE;

const ttMinusTai = 32.184;
const j2000ttDays = 2451545.0;

/**
 * 预加载在给定时间间隔内用于从 ICRF 轴到固定轴转换所需的数据。此函数返回一个承诺，当该承诺解决后，
 * 表示预加载已完成。
 * 预加载的间隔。
 *
 * @param {TimeInterval} timeInterval 承诺，当该承诺解决后表示预加载已完成。
 * @returns {Promise<void>} A 并评估固定轴和 ICRF 轴之间的转换将
 * 在间隔内的某段时间内不再返回 undefined。
 * 使用 const interval = new Cesium.TimeInterval(...);
 *
 *
 * @example
 * await Cesium.CelestialFrameTransforms.preloadIcrfFixed(interval);
 * // 数据现已加载
 * 计算旋转矩阵，以在给定时间将点或向量从国际天球参考系（GCRF/ICRF）惯性轴转换为地球固定轴。
 *
 * @see CelestialFrameTransforms.computeIcrfToFixedMatrix
 * @see CelestialFrameTransforms.computeFixedToIcrfMatrix
 */
CelestialFrameTransforms.preloadIcrfFixed = function (timeInterval) {
  const startDayTT = timeInterval.start.dayNumber;
  const startSecondTT = timeInterval.start.secondsOfDay + ttMinusTai;
  const stopDayTT = timeInterval.stop.dayNumber;
  const stopSecondTT = timeInterval.stop.secondsOfDay + ttMinusTai;

  return CelestialFrameTransforms.iau2006XysData.preload(
    startDayTT,
    startSecondTT,
    stopDayTT,
    stopSecondTT,
  );
};

/**
 * 计算旋转矩阵以在给定时间将点或向量从国际天球参考系（GCRF/ICRF）惯性轴转换为地球固定轴。如果进行转换所需的数据尚未加载，此函数可能返回 undefined。
 * 计算旋转矩阵的时间点。
 * 存储结果的对象。如果未指定此参数，则创建并返回新实例。
 * 旋转矩阵，如果进行转换所需的数据尚未加载则返回 undefined。
 *
 * @param {JulianDate} date 计算旋转矩阵的时间点。
 * @param {Matrix3} [result] 存储结果的对象。如果未指定此参数，则创建并返回新实例。
 * // 将点从固定轴转换为 ICRF 轴。
 * @returns {Matrix3|undefined} The const now = Cesium.JulianDate.now();
 * const pointInFixed = Cesium.Cartesian3.fromDegrees(0.0, 0.0);
 *
 *
 * @example
 * const fixedToIcrf = Cesium.CelestialFrameTransforms.computeMoonFixedToIcrfMatrix(now);
 * let pointInInertial = new Cesium.Cartesian3();
 * if (Cesium.defined(fixedToIcrf)) {
 * pointInInertial = Cesium.Matrix3.multiplyByVector(fixedToIcrf, pointInFixed, pointInInertial);
 * const offset = Cesium.Cartesian3.clone(camera.position);
 * const transform = Cesium.Matrix4.fromRotationTranslation(icrfToFixed);
 * camera.lookAtTransform(transform, offset);
 *   }
 * });
 *
 * @see CelestialFrameTransforms.preloadIcrfFixed
 */
CelestialFrameTransforms.computeIcrfToFixedMatrix = function (date, result) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(date)) {
    throw new DeveloperError("date is required.");
  }
  //>>includeEnd('debug');
  if (!defined(result)) {
    result = new Matrix3();
  }

  const fixedToIcrfMtx = CelestialFrameTransforms.computeFixedToIcrfMatrix(
    date,
    result,
  );
  if (!defined(fixedToIcrfMtx)) {
    return undefined;
  }

  return Matrix3.transpose(fixedToIcrfMtx, result);
};

const TdtMinusTai = 32.184;
const J2000d = 2451545;
const scratchHpr = new HeadingPitchRoll();
const scratchRotationMatrix = new Matrix3();
const dateScratch = new JulianDate();

/**
 * Computes a rotation matrix to transform a point or vector from the Moon-Fixed frame axes
 * to the International Celestial Reference Frame (GCRF/ICRF) inertial frame axes
 * at a given time.
 *
 * @param {JulianDate} date The time at which to compute the rotation matrix.
 * @param {Matrix3} [result] The object onto which to store the result.  If this parameter is
 * not specified, a new instance is created and returned.
 * @returns {Matrix3} The rotation matrix.
 *
 * @example
 * // Transform a point from the Fixed axes to the ICRF axes.
 * const now = Cesium.JulianDate.now();
 * const pointInFixed = Cesium.Cartesian3.fromDegrees(0.0, 0.0);
 * const fixedToIcrf = Cesium.CelestialFrameTransforms.computeMoonFixedToIcrfMatrix(now);
 * let pointInInertial = new Cesium.Cartesian3();
 * if (Cesium.defined(fixedToIcrf)) {
 * pointInInertial = Cesium.Matrix3.multiplyByVector(fixedToIcrf, pointInFixed, pointInInertial);
 * }
 */
CelestialFrameTransforms.computeMoonFixedToIcrfMatrix = function (
  date,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(date)) {
    throw new DeveloperError("date is required.");
  }
  //>>includeEnd('debug');

  if (!defined(result)) {
    result = new Matrix3();
  }

  // Converts TAI to TT
  const secondsTT = JulianDate.addSeconds(date, TdtMinusTai, dateScratch);

  // Converts TT to TDB, interval in days since the standard epoch
  const d = JulianDate.totalDays(secondsTT) - J2000d;

  // Compute the approximate rotation, using https://articles.adsabs.harvard.edu//full/1980CeMec..22..205D/0000209.000.html
  const e1 = CesiumMath.toRadians(12.112) - CesiumMath.toRadians(0.052992) * d;
  const e2 = CesiumMath.toRadians(24.224) - CesiumMath.toRadians(0.105984) * d;
  const e3 = CesiumMath.toRadians(227.645) + CesiumMath.toRadians(13.012) * d;
  const e4 =
    CesiumMath.toRadians(261.105) + CesiumMath.toRadians(13.340716) * d;
  const e5 = CesiumMath.toRadians(358.0) + CesiumMath.toRadians(0.9856) * d;

  scratchHpr.pitch =
    CesiumMath.toRadians(270.0 - 90) -
    CesiumMath.toRadians(3.878) * Math.sin(e1) -
    CesiumMath.toRadians(0.12) * Math.sin(e2) +
    CesiumMath.toRadians(0.07) * Math.sin(e3) -
    CesiumMath.toRadians(0.017) * Math.sin(e4);
  scratchHpr.roll =
    CesiumMath.toRadians(66.53 - 90) +
    CesiumMath.toRadians(1.543) * Math.cos(e1) +
    CesiumMath.toRadians(0.24) * Math.cos(e2) -
    CesiumMath.toRadians(0.028) * Math.cos(e3) +
    CesiumMath.toRadians(0.007) * Math.cos(e4);
  scratchHpr.heading =
    CesiumMath.toRadians(244.375 - 90) +
    CesiumMath.toRadians(13.17635831) * d +
    CesiumMath.toRadians(3.558) * Math.sin(e1) +
    CesiumMath.toRadians(0.121) * Math.sin(e2) -
    CesiumMath.toRadians(0.064) * Math.sin(e3) +
    CesiumMath.toRadians(0.016) * Math.sin(e4) +
    CesiumMath.toRadians(0.025) * Math.sin(e5);
  return Matrix3.fromHeadingPitchRoll(
    scratchHpr,
    scratchRotationMatrix,
    result,
  );
};

/**
 * 计算旋转矩阵，以将点或向量从国际天球参考框架转换为月球固定坐标系的轴系。
 * 将国际天球参考框架 (GCRF/ICRF) 的惯性坐标系轴系转换为月球固定坐标系的轴系。
 * 在特定的时间。
 *
 * @param {JulianDate} date 计算旋转矩阵的时间点。
 * @param {Matrix3} [result] 存储结果的对象。如果此参数未指定，则创建并返回一个新的实例。
 * 旋转矩阵。
 * @returns {Matrix3} The // 将默认 ICRF 设置为固定变换为月球坐标系的变换。
 *
 * @example
 * Cesium.CelestialFrameTransforms.computeIcrfToCentralBodyFixedMatrix = Cesium.CelestialFrameTransforms.computeIcrfToMoonFixedMatrix;
 * Cesium.CelestialFrameTransforms.computeIcrfToCentralBodyFixedMatrix = Cesium.CelestialFrameTransforms.computeIcrfToMoonFixedMatrix;
 */
CelestialFrameTransforms.computeIcrfToMoonFixedMatrix = function (
  date,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(date)) {
    throw new DeveloperError("date is required.");
  }
  //>>includeEnd('debug');
  if (!defined(result)) {
    result = new Matrix3();
  }

  const fixedToIcrfMtx = CelestialFrameTransforms.computeMoonFixedToIcrfMatrix(
    date,
    result,
  );
  if (!defined(fixedToIcrfMtx)) {
    return undefined;
  }

  return Matrix3.transpose(fixedToIcrfMtx, result);
};

const xysScratch = new Iau2006XysSample(0.0, 0.0, 0.0);
const eopScratch = new EarthOrientationParametersSample(
  0.0,
  0.0,
  0.0,
  0.0,
  0.0,
);
const rotation1Scratch = new Matrix3();
const rotation2Scratch = new Matrix3();

/**
 * 计算旋转矩阵，以将点或向量从地球固定坐标系的轴系 (ITRF) 转换为国际天球参考框架 (GCRF/ICRF) 的轴系。
 * 在特定的时间。如果进行变换所需的数据尚未加载，此函数可能返回 undefined。
 * 计算旋转矩阵的时间点。
 * 存储结果的对象。如果此参数未指定，则创建并返回一个新的实例。
 *
 * @param {JulianDate} date 旋转矩阵，或者如果进行变换所需的数据尚未加载，则返回 undefined。
 * @param {Matrix3} [result] 旋转矩阵，或者如果进行变换所需的数据尚未加载，则返回 undefined。
 * 将点从固定坐标系的轴系转换为 ICRF 坐标系的轴系。
 * @returns {Matrix3|undefined} The const now = Cesium.JulianDate.now();
 * const pointInFixed = Cesium.Cartesian3.fromDegrees(0.0, 0.0);
 *
 *
 * @example
 * const fixedToIcrf = Cesium.CelestialFrameTransforms.computeFixedToIcrfMatrix(now);
 * let pointInInertial = new Cesium.Cartesian3();
 * if (Cesium.defined(fixedToIcrf)) {
 * pointInInertial = Cesium.Matrix3.multiplyByVector(fixedToIcrf, pointInFixed, pointInInertial);
 * let pointInInertial = new Cesium.Cartesian3();
 * if (Cesium.defined(fixedToIcrf)) {
 * pointInInertial = Cesium.Matrix3.multiplyByVector(fixedToIcrf, pointInFixed, pointInInertial);
 * }
 *
 * @see CelestialFrameTransforms.preloadIcrfFixed
 */
CelestialFrameTransforms.computeFixedToIcrfMatrix = function (date, result) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(date)) {
    throw new DeveloperError("date is required.");
  }
  //>>includeEnd('debug');

  if (!defined(result)) {
    result = new Matrix3();
  }

  // Compute pole wander
  const eop = CelestialFrameTransforms.earthOrientationParameters.compute(
    date,
    eopScratch,
  );
  if (!defined(eop)) {
    return undefined;
  }

  // There is no external conversion to Terrestrial Time (TT).
  // So use International Atomic Time (TAI) and convert using offsets.
  // Here we are assuming that dayTT and secondTT are positive
  const dayTT = date.dayNumber;
  // It's possible here that secondTT could roll over 86400
  // This does not seem to affect the precision (unit tests check for this)
  const secondTT = date.secondsOfDay + ttMinusTai;

  const xys = CelestialFrameTransforms.iau2006XysData.computeXysRadians(
    dayTT,
    secondTT,
    xysScratch,
  );
  if (!defined(xys)) {
    return undefined;
  }

  const x = xys.x + eop.xPoleOffset;
  const y = xys.y + eop.yPoleOffset;

  // Compute XYS rotation
  const a = 1.0 / (1.0 + Math.sqrt(1.0 - x * x - y * y));

  const rotation1 = rotation1Scratch;
  rotation1[0] = 1.0 - a * x * x;
  rotation1[3] = -a * x * y;
  rotation1[6] = x;
  rotation1[1] = -a * x * y;
  rotation1[4] = 1 - a * y * y;
  rotation1[7] = y;
  rotation1[2] = -x;
  rotation1[5] = -y;
  rotation1[8] = 1 - a * (x * x + y * y);

  const rotation2 = Matrix3.fromRotationZ(-xys.s, rotation2Scratch);
  const matrixQ = Matrix3.multiply(rotation1, rotation2, rotation1Scratch);

  // Similar to TT conversions above
  // It's possible here that secondTT could roll over 86400
  // This does not seem to affect the precision (unit tests check for this)
  const dateUt1day = date.dayNumber;
  const dateUt1sec =
    date.secondsOfDay - JulianDate.computeTaiMinusUtc(date) + eop.ut1MinusUtc;

  // Compute Earth rotation angle
  // The IERS standard for era is
  //    era = 0.7790572732640 + 1.00273781191135448 * Tu
  // where
  //    Tu = JulianDateInUt1 - 2451545.0
  // However, you get much more precision if you make the following simplification
  //    era = a + (1 + b) * (JulianDayNumber + FractionOfDay - 2451545)
  //    era = a + (JulianDayNumber - 2451545) + FractionOfDay + b (JulianDayNumber - 2451545 + FractionOfDay)
  //    era = a + FractionOfDay + b (JulianDayNumber - 2451545 + FractionOfDay)
  // since (JulianDayNumber - 2451545) represents an integer number of revolutions which will be discarded anyway.
  const daysSinceJ2000 = dateUt1day - 2451545;
  const fractionOfDay = dateUt1sec / TimeConstants.SECONDS_PER_DAY;
  let era =
    0.779057273264 +
    fractionOfDay +
    0.00273781191135448 * (daysSinceJ2000 + fractionOfDay);
  era = (era % 1.0) * CesiumMath.TWO_PI;

  const earthRotation = Matrix3.fromRotationZ(era, rotation2Scratch);

  // pseudoFixed to ICRF
  const pfToIcrf = Matrix3.multiply(matrixQ, earthRotation, rotation1Scratch);

  // Compute pole wander matrix
  const cosxp = Math.cos(eop.xPoleWander);
  const cosyp = Math.cos(eop.yPoleWander);
  const sinxp = Math.sin(eop.xPoleWander);
  const sinyp = Math.sin(eop.yPoleWander);

  let ttt = dayTT - j2000ttDays + secondTT / TimeConstants.SECONDS_PER_DAY;
  ttt /= 36525.0;

  // approximate sp value in rad
  const sp = (-47.0e-6 * ttt * CesiumMath.RADIANS_PER_DEGREE) / 3600.0;
  const cossp = Math.cos(sp);
  const sinsp = Math.sin(sp);

  const fToPfMtx = rotation2Scratch;
  fToPfMtx[0] = cosxp * cossp;
  fToPfMtx[1] = cosxp * sinsp;
  fToPfMtx[2] = sinxp;
  fToPfMtx[3] = -cosyp * sinsp + sinyp * sinxp * cossp;
  fToPfMtx[4] = cosyp * cossp + sinyp * sinxp * sinsp;
  fToPfMtx[5] = -sinyp * cosxp;
  fToPfMtx[6] = -sinyp * sinsp - cosyp * sinxp * cossp;
  fToPfMtx[7] = sinyp * cossp - cosyp * sinxp * sinsp;
  fToPfMtx[8] = cosyp * cosxp;

  return Matrix3.multiply(pfToIcrf, fToPfMtx, result);
};

export default CelestialFrameTransforms;
