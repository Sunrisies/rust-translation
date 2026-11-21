// @ts-check

import {
  Cartesian3,
  JulianDate,
  Math as CesiumMath,
  Matrix3,
  Quaternion,
  defined,
} from "@cesium/core";
import Iau2000Orientation from "./Iau2000Orientation.js";

/** @import IauOrientationParameters from "./IauOrientationParameters.js"; */

/**
 * 一个计算 {@link JulianDate} 对应的 {@link IauOrientationParameters} 的函数。
 * @callback ComputeFunction
 * @param {JulianDate} date 用于评估参数的日期。
 * @returns {IauOrientationParameters} The 定向参数。
 * @private
 */

/**
 * 由数据表示的代表地球方向的轴。
 * 来自 IAU/IAG 工作组关于旋转元素的报告。
 *
 * @see Iau2000Orientation
 *
 * @private
 */
class IauOrientationAxes {
  /**
   * @param {ComputeFunction} [computeFunction] 给定 {@link JulianDate} 时计算 {@link IauOrientationParameters} 的函数。
   */
  constructor(computeFunction) {
    if (!defined(computeFunction) || typeof computeFunction !== "function") {
      computeFunction = Iau2000Orientation.ComputeMoon;
    }

    this._computeFunction = computeFunction;
  }

  /**
   * 从 ICRF 到地球固定轴的旋转计算。
   *
   * @param {JulianDate} date 用于评估矩阵的日期。
   * @param {Matrix3} result 存储结果的对象。
   * @returns {Matrix3} The 修改后的结果参数或新的从 ICRF 到固定轴的旋转实例。
   */
  evaluate(date, result) {
    if (!defined(date)) {
      date = JulianDate.now();
    }

    const alphaDeltaW = this._computeFunction(date);
    const precMtx = computeRotationMatrix(
      alphaDeltaW.rightAscension,
      alphaDeltaW.declination,
      result,
    );

    const rot = CesiumMath.zeroToTwoPi(alphaDeltaW.rotation);
    const quat = Quaternion.fromAxisAngle(Cartesian3.UNIT_Z, rot, quatScratch);
    const rotMtx = Matrix3.fromQuaternion(
      Quaternion.conjugate(quat, quat),
      rotMtxScratch,
    );

    const cbi2cbf = Matrix3.multiply(rotMtx, precMtx, precMtx);
    return cbi2cbf;
  }
}

const xAxisScratch = new Cartesian3();
const yAxisScratch = new Cartesian3();
const zAxisScratch = new Cartesian3();

/**
 * 从赤经和赤纬计算旋转矩阵。
 *
 * @param {number} alpha 赤经，以弧度为单位。
 * @param {number} delta 赤纬，以弧度为单位。
 * @param {Matrix3} [result] 存储结果的对象。
 * @returns {Matrix3} The 修改后的结果参数或新的 Matrix3 实例。
 * @private
 */

function computeRotationMatrix(alpha, delta, result) {
  const xAxis = xAxisScratch;
  xAxis.x = Math.cos(alpha + CesiumMath.PI_OVER_TWO);
  xAxis.y = Math.sin(alpha + CesiumMath.PI_OVER_TWO);
  xAxis.z = 0.0;

  const cosDec = Math.cos(delta);

  const zAxis = zAxisScratch;
  zAxis.x = cosDec * Math.cos(alpha);
  zAxis.y = cosDec * Math.sin(alpha);
  zAxis.z = Math.sin(delta);

  const yAxis = Cartesian3.cross(zAxis, xAxis, yAxisScratch);

  if (!defined(result)) {
    result = new Matrix3();
  }

  return Matrix3.fromRowMajorArray(
    [
      xAxis.x,
      xAxis.y,
      xAxis.z,
      yAxis.x,
      yAxis.y,
      yAxis.z,
      zAxis.x,
      zAxis.y,
      zAxis.z,
    ],
    result,
  );
}

const rotMtxScratch = new Matrix3();
const quatScratch = new Quaternion();

export default IauOrientationAxes;
