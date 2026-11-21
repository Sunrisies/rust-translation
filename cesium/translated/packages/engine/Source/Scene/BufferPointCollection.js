// @ts-check

import { assert, Cartesian3, Frozen } from "@cesium/core";
import BufferPrimitiveCollection from "./BufferPrimitiveCollection.js";
import BufferPoint from "./BufferPoint.js";
import renderPoints from "./renderBufferPointCollection.js";
import BufferPointMaterial from "./BufferPointMaterial.js";

/** @import BlendOption from "./BlendOption.js"; */
/** @import { BoundingSphere } from "@cesium/core"; */
/** @import { ComponentDatatype } from "@cesium/core"; */
/** @import { Matrix4 } from "@cesium/core"; */
/** @import FrameState from "./FrameState.js"; */
/** @import { BufferPrimitiveCollectionOptions } from "./BufferPrimitiveCollection.js"; */
/** @import { TypedArray } from "@cesium/core"; */

const { DirtyFlags } = BufferPrimitiveCollection;

/**
 * @typedef {object} BufferPointOptions
 * @property {Matrix4} [modelMatrix=Matrix4.IDENTITY] 将几何图形从模型坐标转换为世界坐标。
 * @property {boolean} [show=true]
 * @property {BufferPointMaterial} [material=BufferPointMaterial.DEFAULT_MATERIAL]
 * @property {number} [featureId]
 * @property {object} [pickObject]
 * @property {Cartesian3} [position=Cartesian3.ZERO]
 * @experimental This 该特性尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * 为优化性能和内存使用，点集存储在 ArrayBuffer 中。
 *
 * <p>默认的缓冲区内存分配是任意的，且无法调整大小，
 * 因此应在集合中指定每个缓冲区的容量。
 * 当构造函数可用时。</p>
 *
 * @example
 * const collection = new BufferPointCollection({primitiveCountMax: 1024});
 *
 * const point = new BufferPoint();
 * const material = new BufferPointMaterial({color: Color.WHITE});
 *
 * // 创建新点，暂时绑定到 'point' 局部变量。
 * collection.add({
 * position: new Cartesian3(0.0, 0.0, 0.0),
 * material
 * }, point);
 *
 * // 遍历集合中的所有点，暂时将 'point'
 * // 局部变量绑定到每个点，并更新点材质。
 * for (let i = 0; i < collection.primitiveCount; i++) {
 * collection.get(i, point);
 * point.setMaterial(material);
 * }
 *
 * @see BufferPoint
 * @see BufferPrimitiveCollection
 * @extends BufferPrimitiveCollection<BufferPoint>
 * @experimental This 该特性尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */
class BufferPointCollection extends BufferPrimitiveCollection {
  /**
   * @param {object} options
   * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 将几何图形从模型坐标转换为世界坐标。
   * @param {number} [options.primitiveCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY]
   * @param {ComponentDatatype} [options.positionDatatype=ComponentDatatype.DOUBLE]
   * @param {boolean} [options.positionNormalized=false]
   * @param {boolean} [options.show=true]
   * @param {boolean} [options.allowPicking=false] 当 <code>true</code> 时，原语可通过 {@link Scene#pick} 选择。当 <code>false</code> 时，内存和初始化成本更低。
   * @param {BoundingSphere} [options.boundingVolume] 集合在世界空间中的边界体积。当
   * 未指定时，边界体积自动计算并在原语位置变化时更新。当
   * 指定时，用户需负责根据需求更新边界体积。手动预计算边界体积
   * 并仅按需更新，可提升大型动态集合的性能。
   * @param {boolean} [options.debugShowBoundingVolume=false]
   * @param {BlendOption} [options.blendOption=BlendOption.TRANSLUCENT] 决定集合中的原语如何与场景混合。必须是 {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}；不支持 {@link BlendOption.OPAQUE_AND_TRANSLUCENT}。
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    super({ ...options, vertexCountMax: options.primitiveCountMax });
  }

  _getCollectionClass() {
    return BufferPointCollection;
  }

  _getPrimitiveClass() {
    return BufferPoint;
  }

  _getMaterialClass() {
    return BufferPointMaterial;
  }

  /////////////////////////////////////////////////////////////////////////////
  // COLLECTION LIFECYCLE

  /**
   * @param {BufferPrimitiveCollectionOptions} [options]
   * @returns {BufferPointCollection}
   * @override
   * @ignore
   */
  _cloneEmpty(options = Frozen.EMPTY_OBJECT) {
    return new BufferPointCollection(this._cloneEmptyBaseArgs(options));
  }

  /////////////////////////////////////////////////////////////////////////////
  // PRIMITIVE LIFECYCLE

  /**
   * 根据指定选项向集合添加新点。一个
   * {@link BufferPoint} 实例与新点关联，如果提供 'result' 参数则使用该值，否则创建新实例。对于重复
   * the 'result' argument if given, or a new instance if not. For repeated
   * 调用，最好重用单个 BufferPoint 实例，而不是
   * 每次调用时都分配新实例。
   *
   * @param {BufferPointOptions} options
   * @param {BufferPoint} result
   * @returns {BufferPoint}
   * @override
   */
  add(options, result = new BufferPoint()) {
    super.add(options, result);

    result._setUint32(
      BufferPoint.Layout.POSITION_OFFSET_U32,
      this._positionCount++,
    );
    result.setPosition(options.position ?? Cartesian3.ZERO);

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

    const passes = frameState.passes;
    if (this.show && (passes.render || passes.pick)) {
      this._renderContext = renderPoints(this, frameState, this._renderContext);
    }
  }

  /////////////////////////////////////////////////////////////////////////////
  // ACCESSORS

  /**
   * 在指定的原语范围内更新顶点位置。对于
   * 仅位置更新的多个原语，使用 `setPositions()` 更为高效。
   * 比单独更新每个primitive更高效。
   *
   * 参数 `positions` 必须包含与
   * 目标primitive范围相同的顶点总数；此方法不能添加或移除顶点。
   *
   * @param {TypedArray} positions
   * @param {number} primitiveOffset
   * @param {number} primitiveCount
   */
  setPositions(positions, primitiveOffset, primitiveCount) {
    //>>includeStart('debug', pragmas.debug);
    const srcConstructor = positions.constructor;
    const dstConstructor = this._positionView.constructor;
    assert(dstConstructor === srcConstructor, "Invalid array type");
    assert(primitiveCount * 3 === positions.length, "Invalid array length");
    assert(
      primitiveOffset + primitiveCount <= this._primitiveCount,
      "Invalid primitive range",
    );
    //>>includeEnd('debug');

    this._positionView.set(positions, primitiveOffset * 3);

    this._makeDirty(DirtyFlags.GEOMETRY, primitiveOffset, primitiveCount);
    this._makeDirtyBoundingVolume();
  }
}

export default BufferPointCollection;
