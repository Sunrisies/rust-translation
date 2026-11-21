import { Check, DeveloperError, defined } from "@cesium/core";

/**
 * Morton 顺序（又称 Z-顺序曲线）辅助函数。
 * @see {@link https://en.wikipedia.org/wiki/Z-order_curve}
 *
 * @namespace MortonOrder
 * @private
 */
const MortonOrder = {};

/**
 * 在数字的位之间插入一个 0 位间距。此功能与 removeOneSpacing 相反。
 *
 * 示例：
 * 输入：6
 * 输入（二进制）：  110
 * 输出（二进制）： 10100
 * ^ ^（添加）
 * 输出：20
 *
 * @private
 * @param {number} v 一个 16 位无符号整数。
 * @returns {number} A 32 位无符号整数。
 * @see {@link https://fgiesen.wordpress.com/2009/12/13/decoding-morton-codes/}
 * @private
 */
function insertOneSpacing(v) {
  v = (v ^ (v << 8)) & 0x00ff00ff;
  v = (v ^ (v << 4)) & 0x0f0f0f0f;
  v = (v ^ (v << 2)) & 0x33333333;
  v = (v ^ (v << 1)) & 0x55555555;
  return v;
}

/**
 * 在数字的位之间插入两个 0 位间距。此功能与 removeTwoSpacing 相反。
 *
 * 示例：
 * 输入：6
 * 输入（二进制）：  110
 * 输出（二进制）： 1001000
 * ^^ ^^（添加）
 * 输出：72
 *
 * @private
 * @param {number} v 一个 10 位无符号整数。
 * @returns {number} A 30 位无符号整数。
 * @see {@link https://fgiesen.wordpress.com/2009/12/13/decoding-morton-codes/}
 */
function insertTwoSpacing(v) {
  v = (v ^ (v << 16)) & 0x030000ff;
  v = (v ^ (v << 8)) & 0x0300f00f;
  v = (v ^ (v << 4)) & 0x030c30c3;
  v = (v ^ (v << 2)) & 0x09249249;
  return v;
}

/**
 * 在位之间移除一个间距位。此功能与 insertOneSpacing 相反。
 *
 * 示例：
 * 输入：20
 * 输入（二进制）：  10100
 * ^ ^（移除）
 * 输出（二进制）： 110
 * 输出：6
 *
 * @private
 * @param {number} v 一个 32 位无符号整数。
 * @returns {number} A 16 位无符号整数。
 * @see {@link https://fgiesen.wordpress.com/2009/12/13/decoding-morton-codes/}
 */
function removeOneSpacing(v) {
  v &= 0x55555555;
  v = (v ^ (v >> 1)) & 0x33333333;
  v = (v ^ (v >> 2)) & 0x0f0f0f0f;
  v = (v ^ (v >> 4)) & 0x00ff00ff;
  v = (v ^ (v >> 8)) & 0x0000ffff;
  return v;
}

/**
 * 在位之间移除两个间距位。此功能与 insertTwoSpacing 相反。
 *
 * 示例：
 * 输入：72
 * 输入（二进制）：  1001000
 * ^^ ^^（移除）
 * 输出（二进制）： 110
 * 输出：6
 *
 * @private
 * @param {number} v 一个 30 位无符号整数。
 * @returns {number} A 10 位无符号整数。
 * @see {@link https://fgiesen.wordpress.com/2009/12/13/decoding-morton-codes/}
 */
function removeTwoSpacing(v) {
  v &= 0x09249249;
  v = (v ^ (v >> 2)) & 0x030c30c3;
  v = (v ^ (v >> 4)) & 0x0300f00f;
  v = (v ^ (v >> 8)) & 0xff0000ff;
  v = (v ^ (v >> 16)) & 0x000003ff;
  return v;
}

/**
 * 从 2D 坐标计算 Morton 索引。这相当于交错它们的位。
 * 由于 JavaScript 中 32 位位运算的限制，输入必须是 16 位无符号整数（得到 32 位 Morton 索引）。
 *
 * @param {number} x X 坐标范围在 [0, (2^16)-1] 内。
 * @param {number} y Y 坐标范围在 [0, (2^16)-1] 内。
 * @returns {number} The Morton 索引。
 * @private
 */
MortonOrder.encode2D = function (x, y) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("x", x);
  Check.typeOf.number("y", y);
  if (x < 0 || x > 65535 || y < 0 || y > 65535) {
    throw new DeveloperError("inputs must be 16-bit unsigned integers");
  }
  //>>includeEnd('debug');

  // Note: JavaScript bitwise operations return signed 32-bit integers, so the
  // final result needs to be reintepreted as an unsigned integer using >>> 0.
  // This is not needed for encode3D because the result is guaranteed to be at most
  // 30 bits and thus will always be interpreted as an unsigned value.
  return (insertOneSpacing(x) | (insertOneSpacing(y) << 1)) >>> 0;
};

/**
 * 从 Morton 索引计算 2D 坐标。这相当于解交错它们的位。
 * 由于 JavaScript 中 32 位位运算的限制，输入必须是 32 位无符号整数（得到每个坐标 16 位）。
 *
 * @param {number} mortonIndex Morton 索引范围在 [0, (2^32)-1] 内。
 * @param {number[]} [result] 用于存储结果的数组。
 * @returns {number[]} An 包含与 Morton 索引对应的 2D 坐标的数组。
 * @private
 */
MortonOrder.decode2D = function (mortonIndex, result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("mortonIndex", mortonIndex);
  if (mortonIndex < 0 || mortonIndex > 4294967295) {
    throw new DeveloperError("input must be a 32-bit unsigned integer");
  }
  //>>includeEnd('debug');

  if (!defined(result)) {
    result = new Array(2);
  }

  result[0] = removeOneSpacing(mortonIndex);
  result[1] = removeOneSpacing(mortonIndex >> 1);
  return result;
};

/**
 * 从 3D 坐标计算 Morton 索引。这相当于交错它们的位。
 * 由于 JavaScript 中 32 位位运算的限制，输入必须是 10 位无符号整数（得到 30 位 Morton 索引）。
 *
 * @param {number} x X 坐标范围在 [0, (2^10)-1] 内。
 * @param {number} y Y 坐标范围在 [0, (2^10)-1] 内。
 * @param {number} z Z 坐标范围在 [0, (2^10)-1] 内。
 * @returns {number} The Morton 索引。
 * @private
 */
MortonOrder.encode3D = function (x, y, z) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("x", x);
  Check.typeOf.number("y", y);
  Check.typeOf.number("z", z);
  if (x < 0 || x > 1023 || y < 0 || y > 1023 || z < 0 || z > 1023) {
    throw new DeveloperError("inputs must be 10-bit unsigned integers");
  }
  //>>includeEnd('debug');

  return (
    insertTwoSpacing(x) |
    (insertTwoSpacing(y) << 1) |
    (insertTwoSpacing(z) << 2)
  );
};

/**
 * 从 Morton 索引计算 3D 坐标。这相当于解交错它们的位。
 * 由于 JavaScript 中 32 位位运算的限制，输入必须是 30 位无符号整数（得到每个坐标 10 位）。
 *
 * @param {number} mortonIndex Morton 索引的范围为 [0, (2^30)-1]。
 * @param {number[]} [result] 用于存储结果的数组。
 * @returns {number[]} An 包含与 Morton 索引对应的 3D 坐标的数组。
 * @private
 */
MortonOrder.decode3D = function (mortonIndex, result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("mortonIndex", mortonIndex);
  if (mortonIndex < 0 || mortonIndex > 1073741823) {
    throw new DeveloperError("input must be a 30-bit unsigned integer");
  }
  //>>includeEnd('debug');

  if (!defined(result)) {
    result = new Array(3);
  }

  result[0] = removeTwoSpacing(mortonIndex);
  result[1] = removeTwoSpacing(mortonIndex >> 1);
  result[2] = removeTwoSpacing(mortonIndex >> 2);
  return result;
};

export default MortonOrder;
