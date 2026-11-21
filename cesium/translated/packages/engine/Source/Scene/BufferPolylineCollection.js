// @ts-check

import { assert, DeveloperError, Frozen, defined } from "@cesium/core";
import BufferPrimitiveCollection from "./BufferPrimitiveCollection.js";
import BufferPolyline from "./BufferPolyline.js";
import renderPolylines from "./renderBufferPolylineCollection.js";
import BufferPolylineMaterial from "./BufferPolylineMaterial.js";

/** @import { BoundingSphere, ComponentDatatype, Matrix4, TypedArray } from "@cesium/core"; */
/** @import BlendOption from "./BlendOption.js"; */
/** @import HeightReference from "./HeightReference.js"; */
/** @import FrameState from "./FrameState.js" */
/** @import { BufferPrimitiveCollectionOptions } from "./BufferPrimitiveCollection.js"; */

const { DirtyFlags } = BufferPrimitiveCollection;

const polylineScratch = new BufferPolyline();

/**
 * @typedef {object} BufferPolylineOptions
 * @property {Matrix4} [modelMatrix=Matrix4.IDENTITY] 将几何图形从模型坐标转换为世界坐标。
 * @property {boolean} [show=true]
 * @property {BufferPolylineMaterial} [material=BufferPolylineMaterial.DEFAULT_MATERIAL]
 * @property {number} [featureId]
 * @property {object} [pickObject]
 * @property {TypedArray} [positions]
 * @experimental This 此特性尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * 为优化性能和内存使用，多段线形物存储在 ArrayBuffer 中。
 *
 * <p>默认的缓冲区内存分配是任意的，集合无法调整大小，
 * 因此应在集合中指定每个缓冲区的具体容量。
 * 当可用时，提供构造函数。</p>
 *
 * @example
 * const collection = new BufferPolylineCollection({
 * primitiveCountMax: 1024,
 * vertexCountMax: 4096,
 * });
 *
 * const polyline = new BufferPolyline();
 * const material = new BufferPolylineMaterial({color: Color.WHITE});
 *
 * // 创建新的多段线，暂时绑定到 'polyline' 局部变量。
 * collection.add({
 * positions: new Float64Array([ ... ]),
 * material,
 * }, polyline);
 *
 * // 遍历集合中的所有多段线，暂时将 'polyline' 绑定到每个元素，并更新多段线材质。
 * // 使用局部变量，并针对每个元素进行更新。
 * for (let i = 0; i < collection.primitiveCount; i++) {
 * collection.get(i, polyline);
 * polyline.setMaterial(material);
 * }
 *
 * @see BufferPolyline
 * @see BufferPolylineMaterial
 * @see BufferPrimitiveCollection
 * @extends BufferPrimitiveCollection<BufferPolyline>
 * @experimental This 此特性尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */
class BufferPolylineCollection extends BufferPrimitiveCollection {
  /**
   * @param {object} [options]
   * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 将几何图形从模型坐标转换为世界坐标。
   * @param {number} [options.primitiveCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY]
   * @param {number} [options.vertexCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY]
   * @param {boolean} [options.show=true]
   * @param {ComponentDatatype} [options.positionDatatype=ComponentDatatype.DOUBLE]
   * @param {boolean} [options.positionNormalized=false]
   * @param {boolean} [options.allowPicking=false] 当 <code>true</code> 时，原语可通过 {@link Scene#pick} 选择。当 <code>false</code> 时，内存和初始化成本更低。
   * @param {BoundingSphere} [options.boundingVolume] 集合在世界空间中的边界体积。
   * @param {boolean} [options.debugShowBoundingVolume=false]
   * @param {BlendOption} [options.blendOption=BlendOption.TRANSLUCENT] 决定集合中的原语如何与场景混合。必须为 {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}；不支持 {@link BlendOption.OPAQUE_AND_TRANSLUCENT}。
   * @param {HeightReference} [options.heightReference=HeightReference.NONE]
   * @param {"pixels"|"meters"} [options.widthUnits="pixels"] 此集合中多段线宽的单位：
   * 在屏幕上为 <code>"pixels"</code>，在世界空间中为 <code>"meters"</code>。经过限制后
   * {@link HeightReference} 在椭球面上测量这些米数，因此海拔和地形
   * 会拉伸绘制宽度。以米为单位的宽度有上限，以减少
   * 瓦片接缝处的不连续性。
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    super(options);

    const widthUnits = options.widthUnits ?? "pixels";

    //>>includeStart('debug', pragmas.debug);
    if (widthUnits !== "pixels" && widthUnits !== "meters") {
      throw new DeveloperError(
        'options.widthUnits must be "pixels" or "meters".',
      );
    }
    //>>includeEnd('debug');

    /**
     * @type {"pixels"|"meters"}
     * @private
     */
    this._widthUnits = widthUnits;
  }

  /**
   * 此集合中多段线宽的单位：在屏幕上为 <code>"pixels"</code>，或
   * 在世界空间中为 <code>"meters"</code>，在限制后按椭球面测量。
   *
   * @type {"pixels"|"meters"}
   * @readonly
   */
  get widthUnits() {
    return this._widthUnits;
  }

  _getCollectionClass() {
    return BufferPolylineCollection;
  }

  _getPrimitiveClass() {
    return BufferPolyline;
  }

  _getMaterialClass() {
    return BufferPolylineMaterial;
  }

  /////////////////////////////////////////////////////////////////////////////
  // COLLECTION LIFECYCLE

  /**
   * @param {BufferPrimitiveCollectionOptions} [options]
   * @returns {BufferPolylineCollection}
   * @override
   * @ignore
   */
  _cloneEmpty(options = Frozen.EMPTY_OBJECT) {
    return new BufferPolylineCollection({
      widthUnits: this._widthUnits,
      ...this._cloneEmptyBaseArgs(options),
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  // PRIMITIVE LIFECYCLE

  /**
   * 根据指定选项向集合中添加新多段线。一个
   * {@link BufferPolyline} 实例与新的多段线关联，使用
   * 'result' 参数（如果提供）或新实例（如果不提供）。对于重复操作
   * 调用时，建议复用同一个 BufferPolyline 实例，而非每次调用都创建新实例。
   * 这样能避免重复分配新实例。
   *
   * @param {BufferPolylineOptions} options
   * @param {BufferPolyline} result
   * @returns {BufferPolyline}
   * @override
   */
  add(options, result = new BufferPolyline()) {
    super.add(options, result);

    const vertexOffset = this._positionCount;
    result._setUint32(BufferPolyline.Layout.POSITION_OFFSET_U32, vertexOffset);
    result._setUint32(BufferPolyline.Layout.POSITION_COUNT_U32, 0);

    if (defined(options.positions)) {
      result.setPositions(options.positions);
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
      this._renderContext = renderPolylines(
        this,
        frameState,
        this._renderContext,
      );
    }
  }

  /////////////////////////////////////////////////////////////////////////////
  // ACCESSORS

  /**
   * 在指定的图元范围内更新顶点位置。对于
   * 仅更新位置的多个图元，`setPositions()` 比单独更新每个图元更
   * 高效。
   *
   * 参数 `positions` 必须包含与目标图元范围相同数量的顶点；该方法无法添加或移除顶点。
   * target primitive range; vertices cannot be added/removed by this method.
   *
   * @param {TypedArray} positions
   * @param {number} primitiveOffset
   * @param {number} primitiveCount
   */
  setPositions(positions, primitiveOffset, primitiveCount) {
    const polyline = polylineScratch;

    this.get(primitiveOffset, polyline);
    const vertexOffset = polyline.vertexOffset;

    this.get(primitiveOffset + primitiveCount - 1, polyline);
    const vertexCount =
      polyline.vertexOffset + polyline.vertexCount - vertexOffset;

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

export default BufferPolylineCollection;
