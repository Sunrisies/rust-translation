import { Check, DeveloperError, RuntimeError, defined } from "@cesium/core";

/**
 * 用于 {@link ImplicitSubtree} 的可用性比特流。该比特流支持
 * Uint8Array 比特流和常量值。
 *
 * @alias ImplicitAvailabilityBitstream
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {number} options.lengthBits 比特流的位数，以比特为单位
 * @param {boolean} [options.constant] 一个布尔值，表示比特流中所有位的值是否相同
 * @param {Uint8Array} [options.bitstream] 存储比特流二进制数据的字节数组
 * @param {number} [options.availableCount] 指示比特流中 1 的位数
 * @param {boolean} [options.computeAvailableCountEnabled=false] 如果为 true 且 options.availableCount 未定义，则从比特流计算 availableCount。
 * @private
 * @experimental This feature 使用 3D Tiles 规范中的部分内容，该内容尚未最终确定，可能随 Cesium 标准弃用政策而变更。
 */
function ImplicitAvailabilityBitstream(options) {
  const lengthBits = options.lengthBits;
  let availableCount = options.availableCount;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("options.lengthBits", lengthBits);
  //>>includeEnd('debug');

  const constant = options.constant;
  const bitstream = options.bitstream;

  if (defined(constant)) {
    // if defined, constant must be 1 which means all tiles are available
    availableCount = lengthBits;
  } else {
    const expectedLength = Math.ceil(lengthBits / 8);
    if (bitstream.length !== expectedLength) {
      throw new RuntimeError(
        `Availability bitstream must be exactly ${expectedLength} bytes long to store ${lengthBits} bits. Actual bitstream was ${bitstream.length} bytes long.`,
      );
    }

    // Only compute the available count if requested, as this involves looping
    // over the bitstream.
    const computeAvailableCountEnabled =
      options.computeAvailableCountEnabled ?? false;
    if (!defined(availableCount) && computeAvailableCountEnabled) {
      availableCount = count1Bits(bitstream, lengthBits);
    }
  }

  this._lengthBits = lengthBits;
  this._availableCount = availableCount;
  this._constant = constant;
  this._bitstream = bitstream;
}

/**
 * 统计比特流中值为 1 的位数。此值用于
 * 在未预计算的情况下计算 availableCount。
 *
 * @param {Uint8Array} bitstream 类型为数组的比特流
 * @param {number} lengthBits 比特流中的位数
 * @private
 */
function count1Bits(bitstream, lengthBits) {
  let count = 0;
  for (let i = 0; i < lengthBits; i++) {
    const byteIndex = i >> 3;
    const bitIndex = i % 8;
    count += (bitstream[byteIndex] >> bitIndex) & 1;
  }
  return count;
}

Object.defineProperties(ImplicitAvailabilityBitstream.prototype, {
  /**
   * 比特流的位数，以比特为单位。
   *
   * @memberof ImplicitAvailabilityBitstream.prototype
   *
   * @type {number}
   * @readonly
   * @private
   */
  lengthBits: {
    get: function () {
      return this._lengthBits;
    },
  },
  /**
   * 比特流中值为 <code>1</code> 的位数。
   *
   * @memberof ImplicitAvailabilityBitstream.prototype
   *
   * @type {number}
   * @readonly
   * @private
   */
  availableCount: {
    get: function () {
      return this._availableCount;
    },
  },
});

/**
 * 从可用性比特流中获取一个布尔值比特。如果比特流
 * 是常量，则返回常量值。
 *
 * @param {number} index 比特的整数索引。
 * @returns {boolean} The 比特的值
 * @private
 */
ImplicitAvailabilityBitstream.prototype.getBit = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (index < 0 || index >= this._lengthBits) {
    throw new DeveloperError("Bit index out of bounds.");
  }
  //>>includeEnd('debug');

  if (defined(this._constant)) {
    return this._constant;
  }

  // byteIndex is floor(index / 8)
  const byteIndex = index >> 3;
  const bitIndex = index % 8;

  return ((this._bitstream[byteIndex] >> bitIndex) & 1) === 1;
};

export default ImplicitAvailabilityBitstream;
