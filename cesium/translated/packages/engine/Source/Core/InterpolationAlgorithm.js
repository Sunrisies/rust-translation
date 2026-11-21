// @ts-check

import { DeveloperError } from "@cesium/core";
/**
 * 插值算法的接口。
 *
 * @interface
 *
 * @see LagrangePolynomialApproximation
 * @see LinearApproximation
 * @see HermitePolynomialApproximation
 */
class InterpolationAlgorithm {
  /**
   * 获取该插值算法的名称。
   * @type {string}
   */
  type;

  /**
   * 给定所需的阶数，返回进行插值所需的数据点数量。
   *
   * @function
   * @param {number} degree 所需的插值阶数。
   * @returns {number} The 进行所需阶数插值所需的数据点数量。
   */
  getRequiredDataPoints(degree) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 执行零阶插值。
   *
   * @function
   * @param {number} x 将被插值的因变量所依赖的独立变量。
   * @param {number[]} xTable 用于插值的独立变量数组。该数组中的值
   * 必须按递增顺序排列，且数组中不能出现重复的值。
   * @param {number[]} yTable 用于插值的因变量数组。对于一组三个
   * 时间 1 和时间 2 下的因变量值 (p,q,w)，应如下所示：{p1, q1, w1, p2, q2, w2}。
   * @param {number} yStride yTable中与xTable中每个独立变量值对应的因变量值数量。
   * 将结果存储到现有数组中。
   * @param {number[]} [result] 插值值的数组，或如果提供了结果参数则输出结果参数。
   * @returns {number[]} The 执行高阶插值。并非所有插值器都支持高阶插值，
   */
  interpolateOrderZero(x, xTable, yTable, yStride, result) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 如果实现对象未定义此功能，将使用interpolateOrderZero。
   * 将被插值的因变量所依赖的独立变量。
   *
   * @function
   * @optional
   * @param {number} x 将被插值的因变量所依赖的独立变量。
   * @param {number[]} xTable 用于插值的独立变量数组。该数组中的值
   * 必须按递增顺序排列，且数组中不能出现重复的值。
   * @param {number[]} yTable 用于插值的因变量数组。对于一组三个
   * 时间 1 和时间 2 下的因变量值 (p,q,w)，应如下所示：{p1, q1, w1, p2, q2, w2}。
   * @param {number} yStride yTable中与xTable中每个独立变量值对应的因变量值数量。
   * 将结果存储到现有数组中。
   * @param {number} inputOrder 输入的导数数量。
   * @param {number} outputOrder 期望输出的导数数量。
   * @param {number[]} [result] 将结果存储到现有数组中。
   * @returns {number[]} The 插值值的数组，或如果提供了结果参数则输出结果参数。
   */
  interpolate(x, xTable, yTable, yStride, inputOrder, outputOrder, result) {
    DeveloperError.throwInstantiationError();
  }
}

export default InterpolationAlgorithm;
