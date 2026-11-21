// @ts-check

import {
  AttributeCompression,
  AttributeType,
  BoundingSphere,
  Cartesian3,
  Check,
  ComponentDatatype,
  DeveloperError,
  Frozen,
  Matrix4,
  assert,
  defined,
  oneTimeWarning,
} from "@cesium/core";
import SceneMode from "./SceneMode.js";
import BlendOption from "../Scene/BlendOption.js";
import HeightReference, { isHeightReferenceClamp } from "./HeightReference.js";
import PickId from "../Renderer/PickId.js";

/** @import { Destroyable } from "../Core/globalTypes.js"; */
/** @import { TypedArray } from "@cesium/core"; */
/** @import Context from "../Renderer/Context.js"; */
/** @import FrameState from "./FrameState.js"; */
/** @import BufferPrimitive from "./BufferPrimitive.js"; */
/** @import BufferPrimitiveMaterial from "./BufferPrimitiveMaterial.js"; */

/**
 * @typedef {object} BufferPrimitiveOptions
 * @property {Matrix4} [modelMatrix=Matrix4.IDENTITY] 将几何图形从模型坐标转换为世界坐标。
 * @property {boolean} [show=true]
 * @property {BufferPrimitiveMaterial} [material]
 * @property {number} [featureId]
 * @property {object} [pickObject]
 * @experimental This 该特性尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * @typedef {object} BufferPrimitiveCollectionOptions
 * @property {Matrix4} [modelMatrix=Matrix4.IDENTITY] 将几何图形从模型坐标转换为世界坐标。
 * @property {number} [primitiveCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY] 最大实体数量。
 * @property {number} [vertexCountMax=BufferPrimitiveCollection.DEFAULT_CAPACITY] 最大顶点数量。
 * @property {boolean} [show=true]
 * @property {ComponentDatatype} [positionDatatype=ComponentDatatype.DOUBLE] 用于存储位置值的组件数据类型。
 * @property {boolean} [positionNormalized=false] 当 <code>true</code> 时，整数位置值被视为归一化值，
 * 其中完整的整数范围映射到 [-1, 1]（有符号）或 [0, 1]（无符号）。仅适用于整数位置数据类型。
 * （BYTE、UNSIGNED_BYTE、SHORT、UNSIGNED_SHORT）。
 * @property {boolean} [allowPicking=false] 当 <code>true</code> 时，实体可以通过 {@link Scene#pick} 选择。当 <code>false</code> 时，内存和初始化成本更低。
 * @property {BoundingSphere} [boundingVolume] 集合在世界空间中的边界体积。当
 * 未指定时，边界体积会自动计算并在实体位置发生变化时更新。当
 * 指定时，用户需负责根据需要更新边界体积。预先计算边界体积
 * 并仅按需更新，可提升大型动态集合的性能。
 * @property {boolean} [debugShowBoundingVolume=false]
 * @property {BlendOption} [blendOption=BlendOption.TRANSLUCENT] 决定集合中的实体如何与场景混合。必须为 {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}；不支持 {@link BlendOption.OPAQUE_AND_TRANSLUCENT}。
 * @property {HeightReference} [options.heightReference=HeightReference.NONE] 当设置为限制值时，
 *   collection is draped onto the surfaces selected by the value: {@link HeightReference.CLAMP_TO_TERRAIN} drapes
 *   onto the globe, {@link HeightReference.CLAMP_TO_3D_TILE} drapes onto 3D Tiles, and
 *   {@link HeightReference.CLAMP_TO_GROUND} drapes onto both. Only {@link BufferPolylineCollection} and
 * {@link Scene#primitives} 之后才支持。覆盖后的集合不会作为独立几何图形绘制。
 *   {@link Scene#primitives}. A draped collection is not also drawn as geometry of its own.
 */

/**
 * 变化范围内的第一个实体。
 *
 * @typedef {object} BufferPrimitiveChangeTracker
 * @property {number} offset First primitive in the changed range.
 * @property {number} count 变化范围内实体数量，可能包含未改变的实体。
 * @property {number} flags 变化范围内的 {@link BufferPrimitiveCollection.DirtyFlags} 标志。
 * @property {boolean} full 无论其 dirty 标志如何，是否必须读取范围内的每个实体。
 * @ignore
 */

/**
 * 用于 ArrayBuffer 存储的实体集合，旨在优化性能和内存使用。
 *
 * <p>要充分利用包含“N”个实体的 BufferPrimitiveCollection 的性能优势，请
 * 注意避免为任何相关 JavaScript 对象分配 “N” 个实例。 {@link BufferPrimitive},
 * {@link Color}、{@link Cartesian3} 及其他对象在处理大量集合时均可被复用,
 * 使用 {@link https://en.wikipedia.org/wiki/Flyweight_pattern|flyweight pattern}。</p>
 *
 * @abstract
 * @template T 继承于 BufferPrimitive
 * @experimental This 该特性尚未定稿，可能根据 Cesium 的标准弃用政策进行变更。
 *
 * @see BufferPrimitive
 * @see BufferPrimitiveMaterial
 * @see BufferPointCollection
 * @see BufferPolylineCollection
 * @see BufferPolygonCollection
 */
class BufferPrimitiveCollection {
  /** @ignore */
  static Error = {
    ERR_RESIZE: "BufferPrimitive range cannot be resized after initialization.",
    ERR_CAPACITY: "BufferPrimitiveCollection capacity exceeded.",
    ERR_MULTIPLE_OF_FOUR:
      "BufferPrimitive byte length must be a multiple of 4.",
    ERR_OUT_OF_RANGE: "BufferPrimitive buffer access out of range.",
  };

  /** @ignore */
  static DirtyFlags = {
    NONE: 0b00,
    GEOMETRY: 0b01,
    PROPERTIES: 0b10,
    ALL: 0b11,
  };

  /**
   * 由集合渲染器管理的资源。集合可能有多个渲染器实现，
   * 因此集合不应关注渲染器的具体实现方式
   * 以及上下文数据。集合一次只有一个渲染器处于活动状态。
   *
   * @type {Destroyable|null}
   * @ignore
   */
  _renderContext = null;

  /**
   * @param {BufferPrimitiveCollectionOptions} [options]
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    /**
     * 决定该集合中的原语是否会被显示。
     * @type {boolean}
     * @default true
     */
    this.show = options.show ?? true;

    /**
     * @type {HeightReference}
     * @readonly
     * @protected
     */
    this._heightReference = options.heightReference ?? HeightReference.NONE;

    /**
     * 集合混合选项；必须是 OPAQUE 或 TRANSLUCENT。
     * @type {BlendOption}
     * @ignore
     */
    this._blendOption = options.blendOption ?? BlendOption.TRANSLUCENT;

    /**
     * 将几何图形从模型坐标转换为世界坐标。
     * @type {Matrix4}
     * @default Matrix4.IDENTITY
     * @readonly
     * @protected
     */
    this._modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);

    /**
     * @type {BoundingSphere}
     * @readonly
     * @protected
     */
    this._boundingVolume = BoundingSphere.clone(
      options.boundingVolume ?? new BoundingSphere(),
      new BoundingSphere(),
    );

    /**
     * @type {boolean}
     * @readonly
     * @protected
     */
    this._boundingVolumeAutoUpdate = !defined(options.boundingVolume);

    /**
     * 当 <code>true</code> 时，原语可通过 {@link Scene#pick} 进行选择。
     * 当 <code>false</code> 时，内存和初始化成本更低。
     * @type {boolean}
     * @readonly
     * @ignore
     * @default false
     */
    this._allowPicking = options.allowPicking ?? false;

    /**
     * @type {Map<Context, PickId[]>}
     * @readonly
     * @ignore
     */
    this._pickIds = new Map();

    /**
     * 用户定义的选择对象。没有自定义选择对象的原语将使用默认选择对象。
     * 替代地分配自定义选择对象。
     *
     * @type {object[]}
     * @readonly
     * @ignore
     */
    this._customPickObjects = [];

    /**
     * 此属性仅用于调试；不用于生产环境，也未经过优化。
     * <p>
     * 为原语中的每个绘制命令绘制边界球体。
     * </p>
     *
     * @type {boolean}
     * @default false
     */
    this.debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;

    /**
     * @type {number}
     * @protected
     * @ignore
     */
    this._primitiveCount = 0;

    /**
     * @type {number}
     * @protected
     * @ignore
     */
    this._primitiveCountMax =
      options.primitiveCountMax ?? BufferPrimitiveCollection.DEFAULT_CAPACITY;

    /**
     * @type {DataView<ArrayBuffer>}
     * @ignore
     */
    this._primitiveView = null;

    /**
     * @type {number}
     * @ignore
     */
    this._positionCount = 0;

    /**
     * @type {number}
     * @ignore
     */
    this._positionCountMax =
      options.vertexCountMax ?? BufferPrimitiveCollection.DEFAULT_CAPACITY;

    /**
     * @type {TypedArray}
     * @ignore
     */
    this._positionView = null;

    /**
     * @type {ComponentDatatype}
     * @ignore
     */
    this._positionDatatype =
      options.positionDatatype ?? ComponentDatatype.DOUBLE;

    /**
     * 当 <code>true</code> 时，整数位置值表示归一化浮点数
     * 在 [-1, 1] 范围内（有符号）或 [0, 1] 范围内（无符号）。仅适用于整数数据类型。
     * @type {boolean}
     * @ignore
     */
    this._positionNormalized = options.positionNormalized ?? false;

    /**
     * @type {DataView<ArrayBuffer>}
     * @ignore
     */
    this._materialView = null;

    /**
     * 读取了集合变化范围的消费者，如渲染器。
     *
     * @type {Set<BufferPrimitiveChangeTracker>}
     * @ignore
     */
    this._changeTrackers = new Set();

    /**
     * 连续的原语范围，其 ‘dirty’ 标志可能被设置，因为至少有一个变化跟踪器尚未读取它们。每个原语的
     * ‘dirty’ 标志都是真实来源。
     * 单调递增的计数器，每次集合发生变化时递增。
     *
     * @type {{offset: number, count: number}}
     * @ignore
     */
    this._dirtyRange = { offset: 0, count: 0 };

    /**
     * @type {boolean}
     * @ignore
     */
    this._dirtyBoundingVolume = false;

    /**
     * 访问 `this.constructor` 可能导致 JSDoc 构建失败，因此应使用此
     * @type {number}
     * @ignore
     */
    this._version = 0;

    this._allocatePrimitiveBuffer();
    this._allocatePositionBuffer();
    this._allocateMaterialBuffer();
  }

  /**
   * 受保护获取函数代替。
   * 如果此对象被销毁则返回 true；否则返回 false。
   * @protected
   * @return {*}
   * @ignore
   */
  _getCollectionClass() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * @protected
   * @return {*}
   * @ignore
   */
  _getPrimitiveClass() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * @return {*}
   * @ignore
   */
  _getMaterialClass() {
    DeveloperError.throwInstantiationError();
  }

  /////////////////////////////////////////////////////////////////////////////
  // COLLECTION LIFECYCLE

  /**
   * @private
   * @ignore
   */
  _allocatePrimitiveBuffer() {
    const layout = this._getPrimitiveClass().Layout;

    //>>includeStart('debug', pragmas.debug);
    const { ERR_MULTIPLE_OF_FOUR } = BufferPrimitiveCollection.Error;
    assert(layout.__BYTE_LENGTH % 4 === 0, ERR_MULTIPLE_OF_FOUR);
    //>>includeEnd('debug');

    this._primitiveView = new DataView(
      new ArrayBuffer(this._primitiveCountMax * layout.__BYTE_LENGTH),
    );
  }

  /**
   * @private
   * @ignore
   */
  _allocatePositionBuffer() {
    // @ts-expect-error https://github.com/CesiumGS/cesium/issues/13420
    this._positionView = ComponentDatatype.createTypedArray(
      this._positionDatatype,
      this._positionCountMax * 3,
    );
  }

  /**
   * @private
   * @ignore
   */
  _allocateMaterialBuffer() {
    const MaterialClass = this._getMaterialClass();
    this._materialView = new DataView(
      new ArrayBuffer(this._primitiveCountMax * MaterialClass.packedLength),
    );
  }

  /**
   * 如果此对象被销毁则返回 true；否则返回 false。
   *
   * @returns {boolean} True 如果此对象被销毁则返回 true；否则返回 false。
   */
  isDestroyed() {
    return false;
  }

  /** Destroys collection and its GPU resources. */
  destroy() {
    this._customPickObjects.length = 0;

    for (const contextPickIds of this._pickIds.values()) {
      for (const pickId of contextPickIds) {
        pickId.destroy();
      }
    }

    if (defined(this._renderContext)) {
      this._renderContext.destroy();
      this._renderContext = undefined;
    }
  }

  /**
   * 对集合中的原语进行排序。
   *
   * 由于排序会改变集合中原语的索引（但不改变特征 ID），
   * 该函数还返回一个数组，将之前的
   * 索引映射到新索引。当反复排序时，该数组可以被复用，并
   * 作为每次调用的 ‘result’ 参数传递。
   *
   * @param {Function} sortFn
   * @param {Uint32Array} result
   * @returns {Uint32Array} Mapping 从之前的索引到新的索引。
   */
  sort(sortFn, result = new Uint32Array(this.primitiveCount)) {
    const PrimitiveClass = this._getPrimitiveClass();
    const CollectionClass = this._getCollectionClass();

    const { primitiveCount } = this;

    const a = new PrimitiveClass();
    const b = new PrimitiveClass();

    // Mapping from NEW index to PREVIOUS index.
    const dstSrcMap = new Uint32Array(primitiveCount);
    for (let i = 0; i < primitiveCount; i++) {
      dstSrcMap[i] = i;
    }
    dstSrcMap.sort((indexA, indexB) =>
      sortFn(this.get(indexA, a), this.get(indexB, b)),
    );

    // Mapping from PREVIOUS index to NEW index.
    for (let i = 0; i < primitiveCount; i++) {
      result[dstSrcMap[i]] = i;
    }

    // Copy primitives to temporary collection, in sort order.
    const tmp = this._cloneEmpty();
    for (let i = 0; i < primitiveCount; i++) {
      const src = this.get(dstSrcMap[i], a);
      const dst = tmp.add({}, b);
      PrimitiveClass.clone(src, dst);
    }

    // Assign buffers from temporary collection onto this one.
    CollectionClass._replaceBuffers(tmp, this);
    this._makeDirtyAll();

    return result;
  }

  /**
   * 将此集合的内容复制到结果集合中。
   * 结果集合不会调整大小，并且必须拥有足够的空间来容纳源集合中的所有基本实体。
   * 结果集合将覆盖原集合中的现有基本实体。
   * 原集合将被覆盖。
   *
   * <p>当集合达到其容量并需要高效地将特征转移到新集合时，使用此功能可以分配更多空间。</p>
   * <p>通过从“集合”复制到“结果”的控件，可以高效地转移特征。</p>
   *
   * @example
   * const result = new BufferPrimitiveCollection({ ... }); // 分配更大的“结果”集合
   * BufferPrimitiveCollection.clone(collection, result);   // 将“集合”中的基本实体复制到“结果”中
   *
   * @param {BufferPrimitiveCollection<T>} collection
   * @param {BufferPrimitiveCollection<T>} result
   * @param {function(BufferPrimitive, number): boolean} [predicate] 如果提供参数，只有返回 <code>true</code> 的基本实体会被复制。存活的实体会被压缩到连续索引中。
   * @template T 继承 BufferPrimitive
   */
  static clone(collection, result, predicate) {
    if (defined(predicate)) {
      return this._cloneFiltered(collection, result, predicate);
    }

    //>>includeStart('debug', pragmas.debug);
    const { ERR_CAPACITY } = BufferPrimitiveCollection.Error;
    assert(collection.primitiveCount <= result.primitiveCountMax, ERR_CAPACITY);
    assert(collection.vertexCount <= result.vertexCountMax, ERR_CAPACITY);
    //>>includeEnd('debug');

    const layout = collection._getPrimitiveClass().Layout;
    const MaterialClass = collection._getMaterialClass();
    const PrimitiveClass = collection._getPrimitiveClass();

    this._copySubDataView(
      collection._primitiveView,
      result._primitiveView,
      collection.primitiveCount * layout.__BYTE_LENGTH,
    );

    this._copySubArray(
      collection._positionView,
      result._positionView,
      collection.vertexCount * 3,
    );

    this._copySubDataView(
      collection._materialView,
      result._materialView,
      collection.primitiveCount * MaterialClass.packedLength,
    );

    // Collection-level display flags (show, debugShowBoundingVolume) are carried
    // by the constructor, so they are intentionally not copied here.
    result._primitiveCount = collection._primitiveCount;
    result._positionCount = collection._positionCount;

    // Copy per-primitive pick objects and unset each GPU PickId.
    // PickIds are regenerated for the result collection on next render.
    const srcPickObjects = collection._customPickObjects;
    const dstPickObjects = result._customPickObjects;
    dstPickObjects.length = 0;
    const primitive = new PrimitiveClass();
    for (let i = 0, il = result.primitiveCount; i < il; i++) {
      dstPickObjects[i] = srcPickObjects[i];
      result.get(i, primitive)._pickId = PickId.NULL_PICK_ID;
    }

    result._makeDirtyAll();

    collection.boundingVolume.clone(result.boundingVolume);

    return result;
  }

  /**
   * 是 {@link BufferPrimitiveCollection.clone} 的过滤版本。逐实体复制
   * 通过 {@link BufferPrimitive.clone}，因此它可以通用地处理所有子类数据，无需每个子类进行重写。
   * 继承 BufferPrimitive
   *
   * @param {BufferPrimitiveCollection<T>} collection
   * @param {BufferPrimitiveCollection<T>} result
   * @param {function(BufferPrimitive, number): boolean} predicate
   * @template T 返回给定集合的副本，覆盖提供的构造函数选项。未提供的选项从源集合继承。任何
   * @protected
   * @ignore
   */
  static _cloneFiltered(collection, result, predicate) {
    const PrimitiveClass = collection._getPrimitiveClass();
    const src = new PrimitiveClass();
    const dst = new PrimitiveClass();

    const srcPickObjects = collection._customPickObjects;
    const dstPickObjects = result._customPickObjects;
    dstPickObjects.length = 0;

    for (let i = 0, il = collection._primitiveCount; i < il; i++) {
      collection.get(i, src);
      if (!predicate(src, i)) {
        continue;
      }

      const dstIndex = result._primitiveCount;
      PrimitiveClass.clone(src, result.add({}, dst));

      if (defined(srcPickObjects[i])) {
        dstPickObjects[dstIndex] = srcPickObjects[i];
      }
    }

    return result;
  }

  /**
   * 调整大小的缓冲区必须足够大以容纳所有基本实体。
   * <p>集合级别的状态（模型矩阵、混合选项、选择、边界体积模式等）会被保留，但GPU资源不会：源集合
   * 保留其渲染器资源的所有权，因此调用者负责在不再需要时调用 {@link BufferPrimitiveCollection#destroy} 来释放源集合的GPU资源。
   *
   * <p>当不再需要时，源集合的GPU资源将被释放。</p>
   * const grown = BufferPrimitiveCollection.fromCollection(collection, {
   * primitiveCountMax: collection.primitiveCountMax * 2,
   * calling {@link BufferPrimitiveCollection#destroy} on the source once it is no
   * collection.destroy(); // 释放源集合的GPU资源
   *
   * @example
   * // 在删除隐藏实体时扩展集合。
   * const compacted = BufferPrimitiveCollection.fromCollection(
   * collection,
   * });
   * { primitiveCountMax: collection.primitiveCountMax * 2 },
   *
   * @example
   * (primitive) => primitive.show,
   * 要复制的源集合。
   * 要覆盖的构造函数选项。未提供的选项从源集合继承。
   * 如果提供参数，只有返回 <code>true</code> 的基本实体会被复制。存活的实体会被压缩到连续索引中。
   * (primitive) => primitive.show,
   * );
   *
   * @param {BufferPrimitiveCollection<T>} collection Source collection to copy.
   * @param {BufferPrimitiveCollectionOptions} [options] Constructor options to override. Omitted options are inherited from the source collection.
   * @param {function(BufferPrimitive, number): boolean} [predicate] When provided, only primitives for which this returns <code>true</code> are copied. Surviving primitives are compacted into contiguous indices.
   * @returns {BufferPrimitiveCollection<T>}
   * @template T 继承 BufferPrimitive
   */
  static fromCollection(collection, options = Frozen.EMPTY_OBJECT, predicate) {
    const result = collection._cloneEmpty(options);
    collection._getCollectionClass().clone(collection, result, predicate);
    return result;
  }

  /**
   * 基础构造函数参数会传递集合级别的状态到由 {@link BufferPrimitiveCollection.fromCollection} 创建的
   * empty copy created by {@link BufferPrimitiveCollection.fromCollection}.
   * 子类应在其构造函数参数中传递结果，并添加任何特定类型的选项。提供的选项会覆盖继承的
   * adding any type-specific options. Provided options override inherited
   * 状态；省略的选项则从此集合继承。
   *
   * @param {BufferPrimitiveCollectionOptions} options
   * @returns {object}
   * @protected
   * @ignore
   */
  _cloneEmptyBaseArgs(options) {
    return {
      primitiveCountMax: this.primitiveCountMax,
      vertexCountMax: this.vertexCountMax,
      positionDatatype: this.positionDatatype,
      positionNormalized: this.positionNormalized,
      modelMatrix: this._modelMatrix,
      show: this.show,
      debugShowBoundingVolume: this.debugShowBoundingVolume,
      blendOption: this._blendOption,
      allowPicking: this._allowPicking,
      boundingVolume: this._boundingVolumeAutoUpdate
        ? undefined
        : this._boundingVolume,
      ...options,
    };
  }

  /**
   * 返回一个与当前结构相同的空集合，会覆盖
   * 任何提供的构造函数选项。省略的选项则从此
   * 集合继承。
   *
   * @param {BufferPrimitiveCollectionOptions} [options]
   * @returns {BufferPrimitiveCollection<T>}
   * @protected
   * @abstract
   * @ignore
   */
  _cloneEmpty(options) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 将源集合中的缓冲区分配到目标集合中，无需
   * 验证或副作用。调用者必须处理任何验证、脏
   * 标志更新等。
   *
   * @param {BufferPrimitiveCollection<T>} src
   * @param {BufferPrimitiveCollection<T>} dst
   * @template T 继承 BufferPrimitive
   * @protected
   * @ignore
   */
  static _replaceBuffers(src, dst) {
    dst._primitiveView = src._primitiveView;
    dst._positionView = src._positionView;
    dst._materialView = src._materialView;
  }

  /**
   * 重建集合边界体积。
   * @protected
   * @ignore
   */
  _updateBoundingVolume() {
    // Exclude unused space in the position buffer.
    let vertices = this._positionView.subarray(0, this._positionCount * 3);

    if (this._positionNormalized) {
      vertices = AttributeCompression.dequantize(
        /** @type {Int8Array|Uint8Array|Int16Array|Uint16Array|Int32Array|Uint32Array} */ (
          vertices
        ),
        this._positionDatatype,
        AttributeType.VEC3,
        this._positionCount,
      );
    }

    BoundingSphere.fromVertices(
      vertices,
      Cartesian3.ZERO,
      3,
      this._boundingVolume,
    );
    BoundingSphere.transform(
      this._boundingVolume,
      this._modelMatrix,
      this._boundingVolume,
    );

    this._dirtyBoundingVolume = false;
  }

  /**
   * 根据给定上下文更新 PickIds。
   * @param {Context} context
   * @protected
   * @ignore
   */
  _updatePickIds(context) {
    let pickIds = this._pickIds.get(context);
    if (pickIds && pickIds.length === this._primitiveCount) {
      return;
    }

    if (!pickIds) {
      pickIds = [];
      this._pickIds.set(context, pickIds);
    }

    const collection = this;
    const PrimitiveClass = this._getPrimitiveClass();
    const primitive = new PrimitiveClass();

    // Fill in missing PickIDs for recently-added primitives.
    for (let i = pickIds.length, il = this._primitiveCount; i < il; i++) {
      this.get(i, primitive);

      const pickObject = this._customPickObjects[i] || {
        collection: this,
        index: i,
        get primitive() {
          // Cannot reuse primitives; scene.drillPick() appends to a list.
          return collection.get(i, new PrimitiveClass());
        },
      };

      const pickId = context.createPickId(pickObject);
      primitive._pickId = pickId.key;
      pickIds.push(pickId);
    }
  }

  /////////////////////////////////////////////////////////////////////////////
  // PRIMITIVE LIFECYCLE

  /**
   * 将给定的 {@link BufferPrimitive} 作为对当前集合中指定索引的
   * 原始体的视图，用于读取/写入原始体属性时使用。当遍历大型集合时，最好在整个循环中使用
   * properties. When iterating over a large collection, prefer to reuse
   * 同一个 BufferPrimitive 实例——重新绑定
   * 现有实例到不同原始体是高效的，并且避免了为每个对象分配内存对象。
   * const primitive = new BufferPrimitive();
   *
   * @example
   * for (let i = 0; i < collection.primitiveCount; i++) {
   * collection.get(i, primitive);
   * primitive.setColor(Color.RED);
   * 将作为
   * }
   *
   * @param {number} index
   * @param {BufferPrimitive} result
   * @returns {BufferPrimitive} The BufferPrimitive instance passed as the
   * 'result' 参数传递的 BufferPrimitive 实例，现在绑定到指定的原始体索引。
   */
  get(index, result) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number.greaterThanOrEquals("index", index, 0);
    Check.typeOf.number.lessThan("index", index, this._primitiveCount);
    //>>includeEnd('debug');

    result._collection = this;
    result._index = index;
    result._byteOffset = index * this._getPrimitiveClass().Layout.__BYTE_LENGTH;
    return result;
  }

  /**
   * 向集合中添加一个新的原始体，并指定选项。一个
   * {@link BufferPrimitive} 实例与新的原始体关联，如果提供 'result' 参数则使用该参数，否则使用新实例。对于重复调用，
   * the 'result' argument if given, or a new instance if not. For repeated
   * 最好重用同一个 BufferPrimitive 实例，而不是每次调用时都分配新实例。
   * 将范围 [offset, offset + count) 内的原始体标记为 'dirty'，将在下次渲染时更新。
   *
   * @param {BufferPrimitiveOptions} options
   * @param {BufferPrimitive} result
   * @returns {BufferPrimitive}
   */
  add(options = Frozen.EMPTY_OBJECT, result) {
    //>>includeStart('debug', pragmas.debug);
    const { ERR_CAPACITY } = BufferPrimitiveCollection.Error;
    assert(this.primitiveCount < this.primitiveCountMax, ERR_CAPACITY);
    //>>includeEnd('debug');

    const MaterialClass = this._getMaterialClass();
    const index = this._primitiveCount++;

    result = this.get(index, result);
    result.featureId = options.featureId ?? index;
    result.show = options.show ?? true;
    result.setMaterial(options.material ?? MaterialClass.DEFAULT_MATERIAL);
    result._pickId = PickId.NULL_PICK_ID;

    this._makeDirty(BufferPrimitiveCollection.DirtyFlags.ALL, index);

    if (defined(options.pickObject)) {
      this._customPickObjects[index] = options.pickObject;
    }

    return result;
  }

  /**
   * 将所有原始体标记为 'dirty'，以便所有变更跟踪器进行更新，无论
   * 每个原始体的脏标志如何。
   *
   * @param {number} flags
   * @param {number} offset
   * @param {number} [count=1]
   * @ignore
   */
  _makeDirty(flags, offset, count = 1) {
    this._version++;

    if (this._changeTrackers.size === 0) {
      return;
    }

    for (const tracker of this._changeTrackers) {
      expandRange(tracker, offset, count);
      tracker.flags |= flags;
    }

    expandRange(this._dirtyRange, offset, count);

    // Write to primitive view directly: performance-critical path.
    const Layout = this._getPrimitiveClass().Layout;
    for (let i = offset, il = offset + count; i < il; i++) {
      const byteOffset = i * Layout.__BYTE_LENGTH;
      this._primitiveView.setUint8(byteOffset + Layout.DIRTY_U8, 1);
    }
  }

  /**
   * 将所有原始体标记为 'clean'，以便给定变更跟踪器使用。
   * 注册一个消费者，用于读取集合中已更改的范围。新的
   * @ignore
   */
  _makeDirtyAll() {
    const count = this._primitiveCount;

    for (const tracker of this._changeTrackers) {
      tracker.offset = 0;
      tracker.count = count;
      tracker.flags = BufferPrimitiveCollection.DirtyFlags.ALL;
      tracker.full = true;
    }

    this._dirtyRange.offset = 0;
    this._dirtyRange.count = count;
    this._version++;
  }

  /**
   * 跟踪器覆盖所有原始体。
   *
   * @param {BufferPrimitiveChangeTracker} tracker
   * @ignore
   */
  _makeClean(tracker) {
    tracker.offset = 0;
    tracker.count = 0;
    tracker.flags = BufferPrimitiveCollection.DirtyFlags.NONE;
    tracker.full = false;
    this._clearDirtyPrimitives();
  }

  /**
   * 清除每个变更跟踪器读取过的每个原始体的脏标志。
   * 将集合边界体积标记为 'dirty'，将在下次渲染时更新。
   *
   * @returns {BufferPrimitiveChangeTracker}
   * @ignore
   */
  _addChangeTracker() {
    const tracker = {
      offset: 0,
      count: this._primitiveCount,
      flags: BufferPrimitiveCollection.DirtyFlags.ALL,
      full: true,
    };
    this._changeTrackers.add(tracker);
    return tracker;
  }

  /**
   * @param {BufferPrimitiveChangeTracker} tracker
   * @ignore
   */
  _removeChangeTracker(tracker) {
    this._changeTrackers.delete(tracker);
    this._clearDirtyPrimitives();
  }

  /**
   * Clears per-primitive dirty flags once every change tracker has read them.
   * @ignore
   */
  _clearDirtyPrimitives() {
    const range = this._dirtyRange;

    if (range.count === 0) {
      return;
    }

    for (const tracker of this._changeTrackers) {
      if (tracker.count > 0) {
        return;
      }
    }

    // Write to primitive view directly: performance-critical path.
    const Layout = this._getPrimitiveClass().Layout;
    for (let i = range.offset, il = range.offset + range.count; i < il; i++) {
      const byteOffset = i * Layout.__BYTE_LENGTH;
      this._primitiveView.setUint8(byteOffset + Layout.DIRTY_U8, 0);
    }

    range.offset = 0;
    range.count = 0;
  }

  /**
   * Marks collection bounding volume as 'dirty', to be updated on next render,
   * 如果启用了自动边界体积更新。
   * @ignore
   */
  _makeDirtyBoundingVolume() {
    if (this._boundingVolumeAutoUpdate) {
      this._dirtyBoundingVolume = true;
    }
  }

  /////////////////////////////////////////////////////////////////////////////
  // RENDER

  /** @param {object} frameState */
  update(frameState) {
    if (/** @type {FrameState} */ (frameState).mode !== SceneMode.SCENE3D) {
      oneTimeWarning(
        "bufferprim-scenemode",
        "BufferPrimitiveCollection requires SceneMode.SCENE3D.",
      );
    }

    if (this._dirtyBoundingVolume) {
      this._updateBoundingVolume();
    }
    // Not gated on a dirty range: a draped collection has no renderer, but the
    // surface it is draped onto reads the pick ids.
    if (this._allowPicking) {
      this._updatePickIds(/** @type {FrameState} */ (frameState).context);
    }
  }

  /**
   * 该集合是否在本帧绘制自身。若使用覆盖式绘制，则
   * 由其所覆盖的表面进行渲染。
   *
   * @param {FrameState} frameState
   * @returns {boolean}
   * @protected
   * @ignore
   */
  _isRendered(frameState) {
    const passes = frameState.passes;
    return (
      this.show &&
      !isHeightReferenceClamp(this._heightReference) &&
      (passes.render || passes.pick)
    );
  }

  /////////////////////////////////////////////////////////////////////////////
  // ACCESSORS

  /**
   * 集合中基体的数量。必须 <= {@link primitiveCountMax}。
   *
   * @type {number}
   * @readonly
   */
  get primitiveCount() {
    return this._primitiveCount;
  }

  /**
   * 该集合能包含的最大基体数量。必须 >=
   * {@link primitiveCount}。
   *
   * @type {number}
   * @readonly
   * @default {@link BufferPrimitiveCollection.DEFAULT_CAPACITY}
   */
  get primitiveCountMax() {
    return this._primitiveCountMax;
  }

  /**
   * 该集合拥有的缓冲区的总字节长度。包括任何未使用的
   * 由 {@link primitiveCountMax} 分配的空间，即使尚未添加任何基体。
   * 该空间内也没有任何基体。
   *
   * @type {number}
   * @readonly
   */
  get byteLength() {
    return (
      this._primitiveView.byteLength +
      this._positionView.byteLength +
      this._materialView.byteLength
    );
  }

  /**
   * 集合中顶点的数量。必须 <= {@link vertexCountMax}。
   *
   * @type {number}
   * @readonly
   */
  get vertexCount() {
    return this._positionCount;
  }

  /**
   * 该集合能包含的最大顶点数量。必须 >=
   * {@link vertexCount}。
   *
   * @type {number}
   * @readonly
   * @default {@link BufferPrimitiveCollection.DEFAULT_CAPACITY}
   */
  get vertexCountMax() {
    return this._positionCountMax;
  }

  /**
   * 将几何图形从模型坐标转换为世界坐标的变换。
   * @type {Matrix4}
   * @default Matrix4.IDENTITY
   * @readonly
   */
  get modelMatrix() {
    return this._modelMatrix;
  }

  /**
   * 包含于集合中的所有基体的世界空间边界体积，包括
   * 显示和隐藏的基体。
   * @type {BoundingSphere}
   * @readonly
   */
  get boundingVolume() {
    if (this._dirtyBoundingVolume) {
      this._updateBoundingVolume();
    }
    return this._boundingVolume;
  }

  /**
   * 用于存储位置值的组件数据类型。
   * @type {ComponentDatatype}
   * @readonly
   */
  get positionDatatype() {
    return this._positionDatatype;
  }

  /**
   * 当 <code>true</code> 时，整数位置值被视为归一化
   * 值，其中完整的整数范围对应 [-1, 1]（有符号）或 [0, 1]
   * (无符号)。
   * @type {boolean}
   * @readonly
   */
  get positionNormalized() {
    return this._positionNormalized;
  }

  /**
   * 确定该集合覆盖哪些表面，以及
   * 作为独立几何图形进行绘制。覆盖式绘制要求该集合
   * 已添加到 {@link Scene#primitives}。
   *
   * @type {HeightReference}
   * @readonly
   * @default HeightReference.NONE
   */
  get heightReference() {
    return this._heightReference;
  }

  /**
   * 确定集合中的基体如何与场景混合。
   * 必须为 {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}；
   * {@link BlendOption.OPAQUE_AND_TRANSLUCENT} 不受支持。
   *
   * <p>{@link BlendOption.OPAQUE} 禁用混合并写入深度，因此基体
   * 相互遮挡以及其背后的几何图形。 {@link BlendOption.TRANSLUCENT}
   * 使用 alpha 混合基体而不写入深度，因此通过
   * 非顺序依赖的半透明效果来解析它们。</p>
   *
   * @type {BlendOption}
   * @default BlendOption.TRANSLUCENT
   */
  get blendOption() {
    return this._blendOption;
  }

  set blendOption(value) {
    //>>includeStart('debug', pragmas.debug);
    if (value !== BlendOption.OPAQUE && value !== BlendOption.TRANSLUCENT) {
      throw new DeveloperError(
        "blendOption must be BlendOption.OPAQUE or BlendOption.TRANSLUCENT.",
      );
    }
    //>>includeEnd('debug');

    this._blendOption = value;
  }

  /**
   * 在指定的基体范围内更新顶点位置。对于
   * 对多个基体仅更新位置的情况，`setPositions()` 更
   * 高效于单独更新每个基体。
   *
   * 参数 `positions` 必须包含与
   * 目标基体范围相同的顶点总数；该方法不能添加或移除顶点。
   *
   * @param {TypedArray} positions
   * @param {number} primitiveOffset
   * @param {number} primitiveCount
   * @abstract
   */
  setPositions(positions, primitiveOffset, primitiveCount) {
    DeveloperError.throwInstantiationError();
  }

  /////////////////////////////////////////////////////////////////////////////
  // UTILS

  /**
   * @param {TypedArray} src
   * @param {TypedArray} dst
   * @param {number} count
   * @protected
   * @ignore
   */
  static _copySubArray(src, dst, count) {
    for (let i = 0; i < count; i++) {
      dst[i] = src[i];
    }
  }

  /**
   * @param {DataView} src
   * @param {DataView} dst
   * @param {number} byteLength
   * @protected
   * @ignore
   */
  static _copySubDataView(src, dst, byteLength) {
    // No need to match the original array type, just copy in 4-byte chunks.
    this._copySubArray(
      new Uint32Array(src.buffer, src.byteOffset, src.byteLength / 4),
      new Uint32Array(dst.buffer, dst.byteOffset, dst.byteLength / 4),
      byteLength / 4,
    );
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * 返回表示集合的 JSON 可序列化数组。这种编码方式
   * 不节省内存，通常用于调试和
   * 测试。
   *
   * @example
   * console.table(collection.toJSON());
   *
   * @returns {Array<object>} List 每个集合中有一个用于 JSON 序列化的可序列化对象。
   * 该集合中primitive的数量。
   */
  toJSON() {
    const PrimitiveClass = this._getPrimitiveClass();
    const primitive = new PrimitiveClass();

    const results = [];
    for (let i = 0, il = this.primitiveCount; i < il; i++) {
      results.push(this.get(i, primitive).toJSON());
    }

    return results;
  }
}

/**
 * 新集合中缓冲区的默认容量。即元素的数量：
 * 顶点缓冲区中的顶点数量，primitive中的primitive数量。
 * 缓冲区等。该值具有任意性，集合无法调整大小，
 * 因此应针对每个缓冲区的容量在集合中指定。
 * 构造函数可用时。
 *
 * @type {number}
 * @static
 * @constant
 */
BufferPrimitiveCollection.DEFAULT_CAPACITY = 1024;

/**
 * 扩展连续的primitive范围，以包含[offset, offset + count)。
 *
 * @param {{offset: number, count: number}} 范围
 * @param {number} offset
 * @param {number} count
 * @ignore
 */
function expandRange(range, offset, count) {
  if (range.count === 0) {
    range.offset = offset;
    range.count = count;
    return;
  }

  const end = Math.max(range.offset + range.count, offset + count);
  range.offset = Math.min(range.offset, offset);
  range.count = end - range.offset;
}

export default BufferPrimitiveCollection;