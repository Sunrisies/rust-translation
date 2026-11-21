// @ts-check

import { Frozen, IndexDatatype, assert, defined } from "@cesium/core";
import BufferPrimitiveCollection from "./BufferPrimitiveCollection.js";
import BufferPolygon from "./BufferPolygon.js";
import renderPolygons from "./renderBufferPolygonCollection.js";
import BufferPolygonMaterial from "./BufferPolygonMaterial.js";

/** @import BlendOption from "./BlendOption.js"; */
/** @import { BoundingSphere } from "@cesium/core"; */
/** @import { TypedArray } from "@cesium/core"; */
/** @import { Matrix4 } from "@cesium/core"; */
/** @import FrameState from "./FrameState.js" */
/** @import HeightReference from "./HeightReference.js"; */
/** @import { ComponentDatatype } from "@cesium/core"; */

const { DirtyFlags, Error } = BufferPrimitiveCollection;
const { ERR_CAPACITY } = Error;

const polygonScratch = new BufferPolygon();

/**
 * @typedef {object} BufferPolygonOptions
 * @property {Matrix4} [modelMatrix=Matrix4.IDENTITY] 将几何图形从模型坐标转换为世界坐标。
 * @property {boolean} [show=true]
 * @property {BufferPolygonMaterial} [material=BufferPolygonMaterial.DEFAULT_MATERIAL]
 * @property {number} [featureId]
 * @property {object} [pickObject]
 * @property {TypedArray} [positions]
 * @property {TypedArray} [holes]
 * @property {TypedArray} [triangles]
 * @experimental This 此功能尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * @typedef {object} BufferPolygonCollectionOptions
 * @property {number} [primitiveCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY] 最多多边形数量。
 * @property {number} [vertexCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY] 最多顶点数量。
 * @property {number} [holeCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY] 最多孔洞数量。
 * @property {number} [triangleCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY] 最多三角形数量。
 * @property {ComponentDatatype} [positionDatatype=ComponentDatatype.DOUBLE] 用于存储位置值的组件数据类型。
 * @property {boolean} [positionNormalized=false] 当 <code>true</code> 时，整数位置值被视为归一化值，
 * 其中完整的整数范围映射到 [-1, 1]（有符号）或 [0, 1]（无符号）。仅适用于整数位置数据类型
 * （BYTE、UNSIGNED_BYTE、SHORT、UNSIGNED_SHORT）。
 * @property {boolean} [show=true]
 * @property {boolean} [allowPicking=true] 当 <code>true</code> 时，原语可通过 {@link Scene#pick} 选择。当 <code>false</code> 时，内存和初始化成本更低。
 * @property {BoundingSphere} [boundingVolume] 集合在世界空间中的边界体积。当
 * 未指定时，边界体积会自动计算并在原语位置变化时更新。当
 * 指定时，用户需负责根据需要更新边界体积。预先计算边界体积
 * 并仅按需更新，可提升大型动态集合的性能。
 * @property {boolean} [debugShowBoundingVolume=false]
 * @property {BlendOption} [blendOption=BlendOption.TRANSLUCENT] 决定集合中的原语如何与场景混合。必须为 {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}；不支持 {@link BlendOption.OPAQUE_AND_TRANSLUCENT}。
 * @property {HeightReference} [heightReference=HeightReference.NONE] 当设置为限制值时，
 * 集合会覆盖在地形和/或 3D Tiles 上，而不是作为独立几何图形绘制。
 * @experimental This 此功能尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * 以 ArrayBuffer 存储的多边形集合，用于优化性能与内存使用。
 *
 * <p>默认缓冲区内存分配是任意的，集合无法调整大小，
 * 因此应在集合构造函数中提供每个缓冲区的具体容量。</p>
 * constructor when available.</p>
 *
 * @example
 * import earcut from "earcut";
 *
 * const collection = new BufferPolygonCollection({
 * primitiveCountMax: 1024,
 * vertexCountMax: 4096,
 * holeCountMax: 1024,
 * triangleCountMax: 2048,
 * });
 *
 * const polygon = new BufferPolygon();
 * const positions = [ ... ];
 * const holes = [ ... ];
 * const material = new BufferPolygonMaterial({color: Color.WHITE});
 *
 * // 创建一个新多边形，暂时绑定到 'polygon' 局部变量。
 * collection.add({
 * positions: new Float64Array(positions),
 * holes: new Uint32Array(holes),
 * 三角形：新的 Uint32Array(earcut(positions, holes, 3))，
 * 材质
 * }, polygon);
 *
 * // 遍历集合中的所有多边形，临时绑定 'polygon'
 * // 为每个多边形创建本地变量，并更新多边形材质。
 * for (let i = 0; i < collection.primitiveCount; i++) {
 * collection.get(i, polygon);
 * polygon.setMaterial(material);
 * }
 *
 * @see BufferPolygon
 * @see BufferPolygonMaterial
 * @see BufferPrimitiveCollection
 * @extends BufferPrimitiveCollection<BufferPolygon>
 * @experimental This 该特征并非最终确定，可能会根据 Cesium 的标准弃用政策发生变化。
 */
class BufferPolygonCollection extends BufferPrimitiveCollection {
  /**
   * @param {BufferPolygonCollectionOptions} [options]
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    super(options);

    /**
     * @type {number}
     * @ignore
     */
    this._holeCount = 0;

    /**
     * @type {number}
     * @protected
     * @ignore
     */
    this._holeCountMax =
      options.holeCountMax ?? BufferPrimitiveCollection.DEFAULT_CAPACITY;

    /**
     * @type {TypedArray}
     * @ignore
     */
    this._holeIndexView = null;

    /**
     * @type {number}
     * @ignore
     */
    this._triangleCount = 0;

    /**
     * @type {number}
     * @protected
     * @ignore
     */
    this._triangleCountMax =
      options.triangleCountMax ?? BufferPrimitiveCollection.DEFAULT_CAPACITY;

    /**
     * @type {TypedArray}
     * @ignore
     */
    this._triangleIndexView = null;

    this._allocateHoleIndexBuffer();
    this._allocateTriangleIndexBuffer();
  }

  _getCollectionClass() {
    return BufferPolygonCollection;
  }

  _getPrimitiveClass() {
    return BufferPolygon;
  }

  _getMaterialClass() {
    return BufferPolygonMaterial;
  }

  /////////////////////////////////////////////////////////////////////////////
  // COLLECTION LIFECYCLE

  /**
   * @private
   * @ignore
   */
  _allocateHoleIndexBuffer() {
    // @ts-expect-error Requires https://github.com/CesiumGS/cesium/pull/13203.
    this._holeIndexView = IndexDatatype.createTypedArray(
      this._positionCountMax,
      this._holeCountMax,
    );
  }

  /**
   * @private
   * @ignore
   */
  _allocateTriangleIndexBuffer() {
    // @ts-expect-error Requires https://github.com/CesiumGS/cesium/pull/13203.
    this._triangleIndexView = IndexDatatype.createTypedArray(
      this._positionCountMax,
      this._triangleCountMax * 3,
    );
  }

  /**
   * 将此集合的内容复制到结果集合中。
   * 结果集合不会调整大小，必须为源集合中的所有
   * 原语提供足够空间。结果集合中现有的多边形
   * 将被覆盖。
   *
   * <p>当集合达到其容量并需要分配更多空间时非常有用，可以高效地将多边形转移到新集合中。</p>
   * const result = new BufferPolygonCollection({ ... }); // 分配更大的 'result' 集合
   *
   * @example
   * BufferPolygonCollection.clone(collection, result);   // 将 'collection' 中的多边形复制到 'result'
   * 当提供时，仅复制返回值为 <code>true</code> 的多边形。存活的多边形会被压缩到连续索引中。
   *
   * @param {BufferPolygonCollection} collection
   * @param {BufferPolygonCollection} result
   * @param {function(BufferPolygon, number): boolean} [predicate] 返回给定集合的副本，覆盖任何提供的构造函数选项。未提供的选项则继承自源集合。任何
   * @returns {BufferPolygonCollection}
   */
  static clone(collection, result, predicate) {
    super.clone(collection, result, predicate);

    // Base class's filtered clone uses PrimitiveClass.clone, which handles holes and triangles, so just return the result.
    if (defined(predicate)) {
      return result;
    }

    //>>includeStart('debug', pragmas.debug);
    assert(collection.holeCount <= result.holeCountMax, ERR_CAPACITY);
    assert(collection.triangleCount <= result.triangleCountMax, ERR_CAPACITY);
    //>>includeEnd('debug');

    this._copySubArray(
      collection._holeIndexView,
      result._holeIndexView,
      collection.holeCount,
    );

    this._copySubArray(
      collection._triangleIndexView,
      result._triangleIndexView,
      collection._triangleCount * 3,
    );

    result._holeCount = collection._holeCount;
    result._triangleCount = collection._triangleCount;

    return result;
  }

  /**
   * 调整大小的缓冲区必须足够大以容纳所有多边形。
   * 要复制的源集合。
   * 要覆盖的构造函数选项。未提供的选项则继承自源集合。
   *
   * @param {BufferPolygonCollection} collection 当提供时，仅复制返回值为 <code>true</code> 的多边形。存活的多边形会被压缩到连续索引中。
   * @param {BufferPolygonCollectionOptions} [options] 向集合中添加新多边形，并指定选项。一个
   * @param {function(BufferPolygon, number): boolean} [predicate] {@link BufferPolygon} 实例与新多边形关联，使用
   * @returns {BufferPolygonCollection}
   * @override
   */
  static fromCollection(collection, options, predicate) {
    return /** @type {BufferPolygonCollection} */ (
      super.fromCollection(collection, options, predicate)
    );
  }

  /**
   * @param {BufferPolygonCollectionOptions} [options]
   * @returns {BufferPolygonCollection}
   * @override
   * @ignore
   */
  _cloneEmpty(options = Frozen.EMPTY_OBJECT) {
    return new BufferPolygonCollection({
      holeCountMax: this.holeCountMax,
      triangleCountMax: this.triangleCountMax,
      ...this._cloneEmptyBaseArgs(options),
    });
  }

  /**
   * @param {BufferPolygonCollection} src
   * @param {BufferPolygonCollection} dst
   * @override
   * @ignore
   */
  static _replaceBuffers(src, dst) {
    super._replaceBuffers(src, dst);
    dst._holeIndexView = src._holeIndexView;
    dst._triangleIndexView = src._triangleIndexView;
  }

  /////////////////////////////////////////////////////////////////////////////
  // PRIMITIVE LIFECYCLE

  /**
   * 提供的 'result' 参数，否则使用新实例。对于重复调用，
   * {@link BufferPolygon} instance is linked to the new polygon, using
   * 此集合拥有的缓冲区总字节长度。包括由 {@link primitiveCountMax} 分配的任何未使用空间，即使该空间中尚未添加任何多边形。
   * 集合中洞的数量。必须 <= {@link holeCountMax}。
   * 集合中洞的最大数量。必须 >= {@link holeCount}。
   *
   * @param {BufferPolygonOptions} options
   * @param {BufferPolygon} result
   * @returns {BufferPolygon}
   * @override
   */
  add(options, result = new BufferPolygon()) {
    super.add(options, result);

    const vertexOffset = this._positionCount;
    result._setUint32(BufferPolygon.Layout.POSITION_OFFSET_U32, vertexOffset);
    result._setUint32(BufferPolygon.Layout.POSITION_COUNT_U32, 0);

    const holeOffset = this._holeCount;
    result._setUint32(BufferPolygon.Layout.HOLE_OFFSET_U32, holeOffset);
    result._setUint32(BufferPolygon.Layout.HOLE_COUNT_U32, 0);

    const triangleOffset = this._triangleCount;
    result._setUint32(BufferPolygon.Layout.TRIANGLE_OFFSET_U32, triangleOffset);
    result._setUint32(BufferPolygon.Layout.TRIANGLE_COUNT_U32, 0);

    if (defined(options.positions)) {
      result.setPositions(options.positions);
    }

    if (defined(options.holes)) {
      result.setHoles(options.holes);
    }

    if (defined(options.triangles)) {
      result.setTriangles(options.triangles);
    }

    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // RENDER

  /**
   * @param {FrameState} frameState
   * @ignore
   */
  update(frameState) {
    super.update(frameState);

    if (this._isRendered(frameState)) {
      this._renderContext = renderPolygons(
        this,
        frameState,
        this._renderContext,
      );
    }
  }

  /////////////////////////////////////////////////////////////////////////////
  // ACCESSORS

  /**
   * 集合中三角形的数量。必须 <= {@link triangleCountMax}。
   * space allocated by {@link primitiveCountMax}, even if no polygons have
   * yet been added in that space.
   *
   * @type {number}
   * @readonly
   * @override
   */
  get byteLength() {
    return (
      super.byteLength +
      this._holeIndexView.byteLength +
      this._triangleIndexView.byteLength
    );
  }

  /**
   * Number of holes in collection. Must be <= {@link holeCountMax}.
   *
   * @type {number}
   * @readonly
   */
  get holeCount() {
    return this._holeCount;
  }

  /**
   * Maximum number of holes in collection. Must be >= {@link holeCount}.
   *
   * @type {number}
   * @readonly
   * @default {@link BufferPrimitiveCollection.DEFAULT_CAPACITY}
   */
  get holeCountMax() {
    return this._holeCountMax;
  }

  /**
   * Number of triangles in collection. Must be <= {@link triangleCountMax}.
   *
   * @type {number}
   * @readonly
   */
  get triangleCount() {
    return this._triangleCount;
  }

  /**
   * 集合中三角形的最大数量。必须 >= {@link triangleCount}。
   *
   * @type {number}
   * @readonly
   * @default {@link BufferPrimitiveCollection.DEFAULT_CAPACITY}
   */
  get triangleCountMax() {
    return this._triangleCountMax;
  }

  /**
   * 在指定的基础体对象范围内更新顶点位置。对于
   * 许多基础体对象的仅位置更新，使用 `setPositions()` 更为
   * 高效，无需单独更新每个基础体对象。
   *
   * 参数 `positions` 必须包含与
   * 目标基础体对象范围相同的顶点总数；该方法无法添加或移除顶点。
   *
   * @param {TypedArray} positions
   * @param {number} primitiveOffset
   * @param {number} primitiveCount
   */
  setPositions(positions, primitiveOffset, primitiveCount) {
    const polygon = polygonScratch;

    this.get(primitiveOffset, polygon);
    const vertexOffset = polygon.vertexOffset;

    this.get(primitiveOffset + primitiveCount - 1, polygon);
    const vertexCount =
      polygon.vertexOffset + polygon.vertexCount - vertexOffset;

    //>>includeStart('debug', pragmas.debug);
    const srcConstructor = positions.constructor;
    const dstConstructor = this._positionView.constructor;
    assert(dstConstructor === srcConstructor, "Invalid array type");
    assert(vertexCount * 3 === positions.length, "Invalid array length");
    assert(
      primitiveOffset + primitiveCount <= this._primitiveCount,
      "Invalid primitive range",
    );
    //>>includeEnd('debug');

    this._positionView.set(positions, vertexOffset * 3);

    this._makeDirty(DirtyFlags.GEOMETRY, primitiveOffset, primitiveCount);
    this._makeDirtyBoundingVolume();
  }
}
export default BufferPolygonCollection;