// @ts-check

import { assert, defined } from "@cesium/core";
import BufferPrimitive from "./BufferPrimitive.js";
import BufferPrimitiveCollection from "./BufferPrimitiveCollection.js";

/** @import { TypedArray, TypedArrayConstructor } from "@cesium/core"; */
/** @import BufferPolylineCollection from "./BufferPolylineCollection.js"; */

const { ERR_RESIZE, ERR_CAPACITY } = BufferPrimitiveCollection.Error;
const { DirtyFlags } = BufferPrimitiveCollection;

/**
 * 视图绑定到 {@link BufferPolylineCollection} 的底层缓冲区数据上。
 *
 * <p>BufferPolyline 实例是 {@link https://en.wikipedia.org/wiki/Flyweight_pattern|flyweights}：
 * 单个 BufferPolyline 实例可以临时绑定到任何概念上，
 * 使 BufferPolylineCollection 中的“折线”能够被迭代并更新，且内存占用最小。</p>
 * 由两个或更多位置表示。
 *
 * 该特性尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 *
 * @see BufferPolylineCollection
 * @see BufferPolylineMaterial
 * @see BufferPrimitive
 * @extends BufferPrimitive
 * @experimental This 位置数组中的偏移量指向折线的第一个顶点，即 VEC3 元素的数量。
 */
class BufferPolyline extends BufferPrimitive {
  /**
   * @type {BufferPolylineCollection}
   * @ignore
   */
  _collection = null;

  /** @ignore */
  static Layout = {
    ...BufferPrimitive.Layout,

    /**
     * 此折线中位置（顶点）的数量，即 VEC3 元素的数量。
     * @type {number}
     * @ignore
     */
    POSITION_OFFSET_U32: BufferPrimitive.Layout.__BYTE_LENGTH,

    /**
     * 从源折线复制数据到结果折线。如果结果折线不是新的（即集合中的最后一个折线），则源和结果折线
     * @type {number}
     * @ignore
     */
    POSITION_COUNT_U32: BufferPrimitive.Layout.__BYTE_LENGTH + 4,

    /**
     * @type {number}
     * @ignore
     */
    __BYTE_LENGTH: BufferPrimitive.Layout.__BYTE_LENGTH + 8,
  };

  /////////////////////////////////////////////////////////////////////////////
  // LIFECYCLE

  /**
   * 必须具有相同的顶点数量。
   * 集合位置数组中的偏移量指向折线的第一个顶点，即 VEC3 元素的数量。
   * 此折线中位置（顶点）的数量，即 VEC3 元素的数量。
   *
   * @param {BufferPolyline} polyline
   * @param {BufferPolyline} result
   * @return {BufferPolyline}
   * @override
   */
  static clone(polyline, result) {
    super.clone(polyline, result);
    result.setPositions(polyline.getPositions());
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // GEOMETRY

  /**
   * 此折线中位置（顶点）的数量，即 VEC3 元素的数量。
   * 返回该折线顶点位置的数组视图。如果提供 'result' 参数，则顶点位置会被写入该数组并返回。
   *
   * @type {number}
   * @readonly
   * @ignore
   */
  get vertexOffset() {
    return this._getUint32(BufferPolyline.Layout.POSITION_OFFSET_U32);
  }

  /**
   * 否则，返回集合内存上的 ArrayView —— 对该数组的更改不会触发渲染更新，这需要调用 `.setPositions()` 方法。
   *
   * @type {number}
   * @readonly
   */
  get vertexCount() {
    return this._getUint32(BufferPolyline.Layout.POSITION_COUNT_U32);
  }

  /**
   * 返回 {TypedArray}。
   * 返回表示折线的 JSON 可序列化对象。这种编码方式
   * 不节省内存，通常适用于调试和测试。
   * 对象。
   *
   * @param {TypedArray} [result]
   * return {TypedArray}
   */
  getPositions(result) {
    const { vertexOffset, vertexCount } = this;
    const positionView = this._collection._positionView;

    if (!defined(result)) {
      const byteOffset =
        positionView.byteOffset +
        vertexOffset * 3 * positionView.BYTES_PER_ELEMENT;
      const TypedArray = /** @type {TypedArrayConstructor} */ (
        positionView.constructor
      );
      return new TypedArray(
        /** @type {ArrayBuffer} */ (positionView.buffer),
        byteOffset,
        vertexCount * 3,
      );
    }

    for (let i = 0; i < vertexCount; i++) {
      result[i * 3] = positionView[(vertexOffset + i) * 3];
      result[i * 3 + 1] = positionView[(vertexOffset + i) * 3 + 1];
      result[i * 3 + 2] = positionView[(vertexOffset + i) * 3 + 2];
    }
    return result;
  }

  /** @param {TypedArray} positions */
  setPositions(positions) {
    const collection = this._collection;
    const vertexOffset = this.vertexOffset;
    const srcCount = this.vertexCount;
    const dstCount = positions.length / 3;
    const collectionCount = collection._positionCount + dstCount - srcCount;

    //>>includeStart('debug', pragmas.debug);
    assert(srcCount === dstCount || this._isResizable(), ERR_RESIZE);
    assert(collectionCount <= collection.vertexCountMax, ERR_CAPACITY);
    //>>includeEnd('debug');

    collection._positionCount = collectionCount;

    // Write vertex count only if changed, avoiding extra DirtyFlag assignments.
    if (srcCount !== dstCount) {
      this._setUint32(BufferPolyline.Layout.POSITION_COUNT_U32, dstCount);
    }

    const positionView = collection._positionView;
    for (let i = 0; i < dstCount; i++) {
      positionView[(vertexOffset + i) * 3] = positions[i * 3];
      positionView[(vertexOffset + i) * 3 + 1] = positions[i * 3 + 1];
      positionView[(vertexOffset + i) * 3 + 2] = positions[i * 3 + 2];
    }

    collection._makeDirty(DirtyFlags.GEOMETRY, this._index);
    collection._makeDirtyBoundingVolume();
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * Returns a JSON-serializable object representing the polyline. This encoding
   * is not memory-efficient, and should generally be used for debugging and
   * testing.
   *
   * @returns {object} JSON-serializable object.
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      positions: Array.from(this.getPositions()),
    };
  }
}

export default BufferPolyline;
