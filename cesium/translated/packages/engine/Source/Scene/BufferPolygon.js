// @ts-check

import { Check, assert, defined } from "@cesium/core";
import BufferPrimitive from "./BufferPrimitive.js";
import BufferPrimitiveCollection from "./BufferPrimitiveCollection.js";

/** @import { TypedArray, TypedArrayConstructor } from "@cesium/core"; */
/** @import BufferPolygonCollection from "./BufferPolygonCollection.js"; */

const { ERR_CAPACITY, ERR_RESIZE, ERR_OUT_OF_RANGE } =
  BufferPrimitiveCollection.Error;

const { DirtyFlags } = BufferPrimitiveCollection;

/**
 * 视图绑定到 {@link BufferPolygonCollection} 的底层缓冲数据上。
 *
 * <p>BufferPolygon 实例是 {@link https://en.wikipedia.org/wiki/Flyweight_pattern|flyweights}：
 * 单个 BufferPolygon 实例可以临时绑定到任何概念
 * BufferPolygonCollection 中的“多边形”，使得非常大的集合能够
 * 被迭代并更新，且内存占用最小。</p>
 *
 * <p>表示为一个（1）外部线性环，包含三（3）个或更多位置。
 * 可以可选地定义一个或多个内部线性环（“洞”）在
 * 多边形内。每个洞表示为位置数组中的单个索引，
 * 该索引处的顶点是内部线性环的起始点，该环
 * 沿着后续顶点继续延伸，直到到达下一个洞的索引顶点或顶点列表的末尾。存储预计算的
 * 三角剖分，每个三角形表示为三个顶点索引。</p>
 * 此功能尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
 *
 * @see BufferPolygonCollection
 * @see BufferPolygonMaterial
 * @see BufferPrimitive
 * @extends BufferPrimitive
 * @experimental This feature is not final and is subject to change without Cesium's standard deprecation policy.
 */
class BufferPolygon extends BufferPrimitive {
  /**
   * @type {BufferPolygonCollection}
   * @ignore
   */
  _collection = null;

  /** @ignore */
  static Layout = {
    ...BufferPrimitive.Layout,

    /**
     * 集合位置数组中的偏移量到多边形的第一个顶点，VEC3 元素的数量。
     * 此多边形中的位置（顶点）数量，VEC3 元素的数量。
     * @type {number}
     * @ignore
     */
    POSITION_OFFSET_U32: BufferPrimitive.Layout.__BYTE_LENGTH,

    /**
     * Count of positions (vertices) in this polygon, number of VEC3 elements.
     * @type {number}
     * @ignore
     */
    POSITION_COUNT_U32: BufferPrimitive.Layout.__BYTE_LENGTH + 4,

    /**
     * 集合洞数组中的偏移量到多边形的第一个洞，整数元素的数量。
     * 此多边形中的洞（索引）数量。
     * @type {number}
     * @ignore
     */
    HOLE_OFFSET_U32: BufferPrimitive.Layout.__BYTE_LENGTH + 8,

    /**
     * Count of holes (indices) in this polygon.
     * @type {number}
     * @ignore
     */
    HOLE_COUNT_U32: BufferPrimitive.Layout.__BYTE_LENGTH + 12,

    /**
     * 集合三角形数组中的偏移量到多边形的第一个三角形，
     * VEC3 元素的数量。
     * @type {number}
     * @ignore
     */
    TRIANGLE_OFFSET_U32: BufferPrimitive.Layout.__BYTE_LENGTH + 16,

    /**
     * 此多边形中的三角形数量，VEC3 元素的数量。
     * @type {number}
     * @ignore
     */
    TRIANGLE_COUNT_U32: BufferPrimitive.Layout.__BYTE_LENGTH + 20,

    /**
     * @type {number}
     * @ignore
     */
    __BYTE_LENGTH: BufferPrimitive.Layout.__BYTE_LENGTH + 24,
  };

  /////////////////////////////////////////////////////////////////////////////
  // LIFECYCLE

  /**
   * 将数据从源多边形复制到结果多边形。如果结果多边形不是
   * 新的（集合中的最后一个多边形），则源和结果多边形必须具有相同的顶点数、洞数和三角形数。
   * must have the same vertex counts, hole counts, and triangle counts.
   *
   * @param {BufferPolygon} polygon
   * @param {BufferPolygon} result
   * @return {BufferPolygon}
   * @override
   */
  static clone(polygon, result) {
    super.clone(polygon, result);
    result.setPositions(polygon.getPositions());
    result.setHoles(polygon.getHoles());
    result.setTriangles(polygon.getTriangles());
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // GEOMETRY

  /**
   * 集合位置数组中的偏移量到多边形的第一个顶点，VEC3 元素的数量。
   * 此多边形中的位置（顶点）数量，包括外环和内环（洞），VEC3 元素的数量。
   *
   * @type {number}
   * @readonly
   * @ignore
   */
  get vertexOffset() {
    return this._getUint32(BufferPolygon.Layout.POSITION_OFFSET_U32);
  }

  /**
   * Count of positions (vertices) in this polygon, including both outer ring and
   * internal rings (holes), number of VEC3 elements.
   *
   * @type {number}
   * @readonly
   */
  get vertexCount() {
    return this._getUint32(BufferPolygon.Layout.POSITION_COUNT_U32);
  }

  /**
   * 返回该多边形顶点位置的数组视图。如果给出 'result' 参数，
   * 顶点位置将写入该数组并返回。
   * 否则，返回集合内存上的 ArrayView — 对该数组的更改不会触发渲染更新，这需要使用 `.setPositions()`。
   * 返回 {TypedArray}
   *
   * @param {TypedArray} [result]
   * return {TypedArray}
   */
  getPositions(result) {
    return this._getPositionsRange(0, this.vertexCount, result);
  }

  /** @param {TypedArray} positions */
  setPositions(positions) {
    const collection = this._collection;
    const vertexOffset = this.vertexOffset;
    const srcCount = this.vertexCount;
    const dstCount = positions.length / 3;
    const collectionCount = collection.vertexCount + dstCount - srcCount;

    //>>includeStart('debug', pragmas.debug);
    assert(srcCount === dstCount || this._isResizable(), ERR_RESIZE);
    assert(collectionCount <= collection.vertexCountMax, ERR_CAPACITY);
    //>>includeEnd('debug');

    collection._positionCount = collectionCount;

    // Write vertex count only if changed, avoiding extra DirtyFlag assignments.
    if (srcCount !== dstCount) {
      this._setUint32(BufferPolygon.Layout.POSITION_COUNT_U32, dstCount);
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

  /**
   * 集合位置数组中的偏移量到多边形外环的第一个顶点。
   * 线性环，VEC3 元素的数量。
   *
   * @type {number}
   * @readonly
   */
  get outerVertexOffset() {
    return this.vertexOffset;
  }

  /**
   * 该多边形外线性环中顶点的数量。
   * VEC3 元素的数量。
   *
   * @type {number}
   * @readonly
   */
  get outerVertexCount() {
    if (this.holeCount > 0) {
      return this.getHoles()[0];
    }
    return this.vertexCount;
  }

  /**
   * 返回该多边形外线性环顶点位置的数组视图。
   * 如果提供 ‘result’ 参数，则将顶点位置写入该数组并返回。否则，返回集合内存中的 ArrayView —— 对该数组的修改不会触发渲染更新，需使用 `.setPositions()`。
   * 在集合孔洞数组中指向多边形第一个孔洞的偏移量，以及
   * 整数元素的数量。
   * 该多边形中孔洞的索引数量。
   *
   * @param {TypedArray} [result]
   * @returns {TypedArray}
   */
  getOuterPositions(result) {
    return this._getPositionsRange(0, this.outerVertexCount, result);
  }

  /**
   * 获取该多边形的孔洞索引，每个孔洞表示为该多边形位置数组中的一个偏移量。每个孔洞隐含地
   * 从该顶点偏移量开始沿着内部线性环继续，直到
   *
   * @type {number}
   * @readonly
   * @ignore
   */
  get holeOffset() {
    return this._getUint32(BufferPolygon.Layout.HOLE_OFFSET_U32);
  }

  /**
   * 到达位置数组的末尾或下一个孔洞偏移量。
   *
   * @type {number}
   * @readonly
   */
  get holeCount() {
    return this._getUint32(BufferPolygon.Layout.HOLE_COUNT_U32);
  }

  /**
   * 如果提供 ‘result’ 参数，则将孔洞索引写入该数组并返回。否则，返回集合内存中的 ArrayView —— 对该数组的修改不会触发渲染更新，需使用 `.setHoles()`。
   * 设置该多边形的孔洞索引，每个孔洞表示为该多边形位置数组中的一个偏移量。每个孔洞隐含地
   * 从该顶点偏移量开始沿着内部线性环继续，直到
   * 到达位置数组的末尾或下一个孔洞偏移量。
   *
   * 如果提供 ‘result’ 参数，则将孔洞索引写入该数组并返回。否则，返回集合内存中的 ArrayView —— 对该数组的修改不会触发渲染更新，需使用 `.setHoles()`。
   * 返回指定孔洞中 (VEC3) 顶点的数量。
   * 返回指定孔洞内线性环顶点位置的数组视图。如果提供 ‘result’ 参数，则将顶点位置写入该数组并返回。否则，返回集合内存中的 ArrayView —— 对该数组的修改不会触发渲染更新，需使用 `.setPositions()`。
   *
   * @param {TypedArray} [result]
   * @returns {TypedArray}
   */
  getHoles(result) {
    const { holeOffset, holeCount } = this;
    const holeIndexView = this._collection._holeIndexView;

    if (!defined(result)) {
      const byteOffset =
        holeIndexView.byteOffset + holeOffset * holeIndexView.BYTES_PER_ELEMENT;
      const TypedArray = /** @type {TypedArrayConstructor} */ (
        holeIndexView.constructor
      );
      return new TypedArray(
        /** @type {ArrayBuffer} */ (holeIndexView.buffer),
        byteOffset,
        holeCount,
      );
    }

    for (let i = 0; i < holeCount; i++) {
      result[i] = holeIndexView[holeOffset + i];
    }
    return result;
  }

  /**
   * 返回 {TypedArray}。
   * 访问顶点位置的内部辅助函数。‘vertexOffset’ 参数
   * 相对于多边形顶点块的起始位置，0 表示
   * 多边形中的第一个顶点。如果提供 ‘result’ 参数，则将请求范围内的顶点写入结果数组并返回。
   *
   * @param {TypedArray} holes
   */
  setHoles(holes) {
    const collection = this._collection;
    const holeOffset = this.holeOffset;
    const srcCount = this.holeCount;
    const dstCount = holes.length;
    const collectionCount = collection.holeCount + dstCount - srcCount;

    //>>includeStart('debug', pragmas.debug);
    assert(srcCount === dstCount || this._isResizable(), ERR_RESIZE);
    assert(collectionCount <= collection.holeCountMax, ERR_CAPACITY);
    //>>includeEnd('debug');

    collection._holeCount = collectionCount;

    // Write hole count only if changed, avoiding extra DirtyFlag assignments.
    if (srcCount !== dstCount) {
      this._setUint32(BufferPolygon.Layout.HOLE_COUNT_U32, dstCount);
    }

    const holeIndexView = collection._holeIndexView;
    for (let i = 0; i < dstCount; i++) {
      holeIndexView[holeOffset + i] = holes[i];
    }

    collection._makeDirty(DirtyFlags.GEOMETRY, this._index);
  }

  /**
   * 否则，返回集合内存中的 ArrayView。
   *
   * @param {number} holeIndex
   * @returns {number}
   */
  getHoleVertexCount(holeIndex) {
    const holes = this.getHoles();

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number.greaterThanOrEquals("holeIndex", holeIndex, 0);
    Check.typeOf.number.lessThan("holeIndex", holeIndex, holes.length);
    //>>includeEnd('debug');

    const holeVertexOffset = holes[holeIndex];
    return holeIndex === holes.length - 1
      ? this.vertexCount - holeVertexOffset
      : holes[holeIndex + 1] - holeVertexOffset;
  }

  /**
   * 在集合三角形数组中指向多边形第一个三角形的偏移量，
   * VEC3 元素的数量。
   * 该多边形中三角形的数量，VEC3 元素的数量。
   * memory — changes to this array will not trigger render updates, which
   * requires `.setPositions()`.
   *
   * @param {number} holeIndex
   * @param {TypedArray} [result]
   * return {TypedArray}
   */
  getHolePositions(holeIndex, result) {
    const holes = this.getHoles();

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number.greaterThanOrEquals("holeIndex", holeIndex, 0);
    Check.typeOf.number.lessThan("holeIndex", holeIndex, holes.length);
    //>>includeEnd('debug');

    const holeVertexOffset = holes[holeIndex];
    const holeVertexCount = this.getHoleVertexCount(holeIndex);
    return this._getPositionsRange(holeVertexOffset, holeVertexCount, result);
  }

  /**
   * Internal helper for accessing vertex positions. 'vertexOffset' argument
   * is relative to the start of the polygon's vertex block, with 0 being
   * the first vertex in the polygon. If 'result' argument is given, the
   * requested range of vertices are written to the result array and returned.
   * Otherwise, returns an ArrayView on collection memory.
   *
   * @param {number} vertexOffset
   * @param {number} vertexCount
   * @param {TypedArray} [result]
   * @returns {TypedArray}
   * @private
   */
  _getPositionsRange(vertexOffset, vertexCount, result) {
    const collection = this._collection;
    const positionView = this._collection._positionView;

    const collectionVertexOffset = this.vertexOffset + vertexOffset;

    //>>includeStart('debug', pragmas.debug);
    assert(collectionVertexOffset >= 0, ERR_OUT_OF_RANGE);
    assert(collectionVertexOffset < collection.vertexCount, ERR_OUT_OF_RANGE);
    assert(vertexCount > 0, ERR_OUT_OF_RANGE);
    assert(vertexCount <= this.vertexCount, ERR_OUT_OF_RANGE);
    //>>includeEnd('debug');

    if (!defined(result)) {
      const byteOffset =
        positionView.byteOffset +
        collectionVertexOffset * 3 * positionView.BYTES_PER_ELEMENT;
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
      result[i * 3] = positionView[(collectionVertexOffset + i) * 3];
      result[i * 3 + 1] = positionView[(collectionVertexOffset + i) * 3 + 1];
      result[i * 3 + 2] = positionView[(collectionVertexOffset + i) * 3 + 2];
    }
    return result;
  }

  /**
   * Offset in collection triangles array to first triangle in polygon,
   * number of VEC3 elements.
   * @type {number}
   * @readonly
   * @ignore
   */
  get triangleOffset() {
    return this._getUint32(BufferPolygon.Layout.TRIANGLE_OFFSET_U32);
  }

  /**
   * Count of triangles in this polygon, number of VEC3 elements.
   *
   * @type {number}
   * @readonly
   */
  get triangleCount() {
    return this._getUint32(BufferPolygon.Layout.TRIANGLE_COUNT_U32);
  }

  /**
   * 返回一个该多边形三角形索引的数组视图，格式为：
   * 每个三角形包含三个顶点索引。
   *
   * 如果提供 ‘result’ 参数，则将三角形索引写入该数组并返回。
   * 否则，在集合内存中返回一个 ArrayView ——
   * 对该数组的修改不会触发渲染更新，这需要调用
   * `.setTriangles()`。
   *
   * @param {TypedArray} [result]
   * @returns {TypedArray}
   */
  getTriangles(result) {
    const { triangleOffset, triangleCount } = this;
    const indices = this._collection._triangleIndexView;

    if (!defined(result)) {
      const byteOffset =
        indices.byteOffset + triangleOffset * 3 * indices.BYTES_PER_ELEMENT;
      const TypedArray = /** @type {TypedArrayConstructor} */ (
        indices.constructor
      );
      return new TypedArray(
        /** @type {ArrayBuffer} */ (indices.buffer),
        byteOffset,
        triangleCount * 3,
      );
    }

    for (let i = 0; i < triangleCount; i++) {
      result[i * 3] = indices[(triangleOffset + i) * 3];
      result[i * 3 + 1] = indices[(triangleOffset + i) * 3 + 1];
      result[i * 3 + 2] = indices[(triangleOffset + i) * 3 + 2];
    }
    return result;
  }

  /**
   * 设置该多边形的三角形索引，格式为每个三角形三个顶点索引。
   * 
   *
   * @param {TypedArray} indices
   */
  setTriangles(indices) {
    const collection = this._collection;
    const triangleOffset = this.triangleOffset;
    const srcCount = this.triangleCount;
    const dstCount = indices.length / 3;
    const collectionCount = collection.triangleCount + dstCount - srcCount;

    //>>includeStart('debug', pragmas.debug);
    assert(srcCount === dstCount || this._isResizable(), ERR_RESIZE);
    assert(collectionCount <= collection.triangleCountMax, ERR_CAPACITY);
    //>>includeEnd('debug');

    collection._triangleCount += dstCount - srcCount;

    // Write triangle count only if changed, avoiding extra DirtyFlag assignments.
    if (srcCount !== dstCount) {
      this._setUint32(BufferPolygon.Layout.TRIANGLE_COUNT_U32, dstCount);
    }

    const dstIndices = collection._triangleIndexView;
    for (let i = 0; i < dstCount; i++) {
      dstIndices[(triangleOffset + i) * 3] = indices[i * 3];
      dstIndices[(triangleOffset + i) * 3 + 1] = indices[i * 3 + 1];
      dstIndices[(triangleOffset + i) * 3 + 2] = indices[i * 3 + 2];
    }

    collection._makeDirty(DirtyFlags.GEOMETRY, this._index);
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * 返回一个可序列化为 JSON 的对象来表示该多边形。这种编码方式
   * 不节省内存，通常适用于调试和
   * 测试。
   *
   * @returns {object} JSON-serializable object.
   * @override
   */
  toJSON() {
    return {
      ...super.toJSON(),
      positions: Array.from(this.getPositions()),
      holes: Array.from(this.getHoles()),
      triangles: Array.from(this.getTriangles()),
    };
  }
}

export default BufferPolygon;
