import { DeveloperError, Math as CesiumMath, defined } from "@cesium/core";

/**
 * 表示一个始终进行插值处理的 {@link Packable} 数字
 * 朝向旋转角度最小的方向。该对象从不直接被使用
 * 而是被传递给 {@link SampledProperty} 的构造函数
 * 以表示二维旋转角度
 *
 * @interface Rotation
 *
 *
 * @example
 * const time1 = Cesium.JulianDate.fromIso8601('2010-05-07T00:00:00');
 * const time2 = Cesium.JulianDate.fromIso8601('2010-05-07T00:01:00');
 * const time3 = Cesium.JulianDate.fromIso8601('2010-05-07T00:02:00');
 *
 * const property = new Cesium.SampledProperty(Cesium.Rotation);
 * property.addSample(time1, 0);
 * property.addSample(time3, Cesium.Math.toRadians(350));
 *
 * //在 time2 时刻的值将等于 355 度，而不是 175 度（如果你构造
 * //一个 SampledProperty(Number) 会得到 175 度。注意，实际
 * //返回值以弧度为单位，而非度数。
 * property.getValue(time2);
 * 用于将对象打包到数组中的元素数量
 *
 * @see PackableForInterpolation
 */
const Rotation = {
  /**
   * 将提供的实例存储到提供的数组中
   * @type {number}
   */
  packedLength: 1,

  /**
   * 要打包的值
   *
   * @param {Rotation} value 要打包到的数组
   * @param {number[]} array 要打包到的数组索引
   * @param {number} [startingIndex=0] 开始打包元素的数组索引
   *
   * @returns {number[]} The 被打包到的数组
   */
  pack: function (value, array, startingIndex) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(value)) {
      throw new DeveloperError("value is required");
    }

    if (!defined(array)) {
      throw new DeveloperError("array is required");
    }
    //>>includeEnd('debug');

    startingIndex = startingIndex ?? 0;
    array[startingIndex] = value;

    return array;
  },

  /**
   * 从打包的数组中检索一个实例
   *
   * @param {number[]} array 被打包用于插值的数组
   * @param {number} [startingIndex=0] 待解包元素的起始索引
   * @param {Rotation} [result] 存储结果的对象
   * @returns {Rotation} The 修改过的结果参数或一个新的 Rotation 实例（如果未提供）
   */
  unpack: function (array, startingIndex, result) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(array)) {
      throw new DeveloperError("array is required");
    }
    //>>includeEnd('debug');

    startingIndex = startingIndex ?? 0;
    return array[startingIndex];
  },

  /**
   * 将打包的数组转换为适合插值的格式
   *
   * @param {number[]} packedArray 被打包的数组
   * @param {number} [startingIndex=0] 需要转换的第一个元素的索引
   * @param {number} [lastIndex=packedArray.length] 需要转换的最后一个元素的索引
   * @param {number[]} [result] 存储结果的对象
   */
  convertPackedArrayForInterpolation: function (
    packedArray,
    startingIndex,
    lastIndex,
    result,
  ) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(packedArray)) {
      throw new DeveloperError("packedArray is required");
    }
    //>>includeEnd('debug');

    if (!defined(result)) {
      result = [];
    }

    startingIndex = startingIndex ?? 0;
    lastIndex = lastIndex ?? packedArray.length;

    let previousValue;
    for (let i = 0, len = lastIndex - startingIndex + 1; i < len; i++) {
      const value = packedArray[startingIndex + i];
      if (i === 0 || Math.abs(previousValue - value) < Math.PI) {
        result[i] = value;
      } else {
        result[i] = value - CesiumMath.TWO_PI;
      }
      previousValue = value;
    }
  },

  /**
   * 从使用 {@link Rotation.convertPackedArrayForInterpolation} 转换过的打包数组中检索一个实例
   *
   * @param {number[]} array 之前用于插值的打包数组
   * @param {number[]} sourceArray 原始的打包数组
   * @param {number} [firstIndex=0] 用于转换数组的 firstIndex
   * @param {number} [lastIndex=packedArray.length] 用于转换数组的 lastIndex
   * @param {Rotation} [result] 存储结果的对象
   * @returns {Rotation} The 修改过的结果参数或一个新的 Rotation 实例（如果未提供）
   */
  unpackInterpolationResult: function (
    array,
    sourceArray,
    firstIndex,
    lastIndex,
    result,
  ) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(array)) {
      throw new DeveloperError("array is required");
    }
    if (!defined(sourceArray)) {
      throw new DeveloperError("sourceArray is required");
    }
    //>>includeEnd('debug');

    result = array[0];
    if (result < 0) {
      return result + CesiumMath.TWO_PI;
    }
    return result;
  },
};
export default Rotation;
