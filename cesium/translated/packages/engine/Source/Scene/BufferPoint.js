// @ts-check

import { Cartesian3, assert } from "@cesium/core";
import BufferPrimitive from "./BufferPrimitive.js";
import BufferPrimitiveCollection from "./BufferPrimitiveCollection.js";

/** @import BufferPointCollection from "./BufferPointCollection.js"; */

const { DirtyFlags, Error } = BufferPrimitiveCollection;

const scratchCartesian = new Cartesian3();

/**
 * 视图绑定于 {@link BufferPointCollection} 的底层缓冲区数据。
 *
 * <p>BufferPoint 实例是 {@link https://en.wikipedia.org/wiki/Flyweight_pattern|flyweights}：
 * 单个 BufferPoint 实例可以临时绑定到 BufferPointCollection 中的任何“点”上，从而允许非常大的集合以最小内存占用进行迭代和更新。</p>
 * 表示为一个位置。
 * 该特性尚未定稿，可能会根据 Cesium 的标准弃用政策发生变化。
 *
 * 位置数组中的偏移量指向当前点的顶点，即 VEC3 元素的数量。
 *
 * @see BufferPointCollection
 * @see BufferPointMaterial
 * @see BufferPrimitive
 * @experimental This 从源点复制数据到结果点。
 * @extends BufferPrimitive
 */
class BufferPoint extends BufferPrimitive {
  /**
   * @type {BufferPointCollection}
   * @ignore
   */
  _collection = null;

  /** @ignore */
  static Layout = {
    ...BufferPrimitive.Layout,

    /**
     * 集合位置数组中的偏移量指向该点的位置，即 VEC3 元素的数量。
     * @type {number}
     * @ignore
     */
    POSITION_OFFSET_U32: BufferPrimitive.Layout.__BYTE_LENGTH,

    /**
     * @type {number}
     * @ignore
     */
    __BYTE_LENGTH: BufferPrimitive.Layout.__BYTE_LENGTH + 4,
  };

  /////////////////////////////////////////////////////////////////////////////
  // LIFECYCLE

  /**
   * 此原始类型中的位置（顶点）数量。始终为 1。
   *
   * @param {BufferPoint} point
   * @param {BufferPoint} result
   * @return {BufferPoint}
   * @override
   */
  static clone(point, result) {
    super.clone(point, result);
    result.setPosition(point.getPosition(scratchCartesian));
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // GEOMETRY

  /**
   * 获取该点的位置。
   * 设置该点的位置。
   *
   * @type {number}
   * @readonly
   * @ignore
   */
  get vertexOffset() {
    return this._getUint32(BufferPoint.Layout.POSITION_OFFSET_U32);
  }

  /**
   * 返回表示该点的 JSON 可序列化对象。这种编码方式
   *
   * @type {number}
   * @readonly
   */
  get vertexCount() {
    return 1;
  }

  /**
   * 并不节省内存，通常仅用于调试和测试。
   *
   * @param {Cartesian3} [result]
   * @returns {Cartesian3}
   */
  getPosition(result) {
    const positionF64 = this._collection._positionView;
    // @ts-expect-error TODO(tsd-jsdoc): See https://github.com/CesiumGS/cesium/pull/13302.
    return Cartesian3.fromArray(positionF64, this.vertexOffset * 3, result);
  }

  /**
   * Sets the position of this point.
   *
   * @param {Cartesian3} position
   */
  setPosition(position) {
    const collection = this._collection;
    const vertexOffset = this.vertexOffset;

    //>>includeStart('debug', pragmas.debug);
    assert(vertexOffset < collection.vertexCountMax, Error.ERR_CAPACITY);
    //>>includeEnd('debug');

    collection._positionView[vertexOffset * 3] = position.x;
    collection._positionView[vertexOffset * 3 + 1] = position.y;
    collection._positionView[vertexOffset * 3 + 2] = position.z;

    collection._makeDirty(DirtyFlags.GEOMETRY, this._index);
    collection._makeDirtyBoundingVolume();
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * Returns a JSON-serializable object representing the point. This encoding
   * is not memory-efficient, and should generally be used for debugging and
   * testing.
   *
   * @returns {object} JSON-serializable object.
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      position: Cartesian3.pack(this.getPosition(), []),
    };
  }
}

export default BufferPoint;
