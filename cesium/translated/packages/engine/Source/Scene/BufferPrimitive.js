// @ts-check

import { assert } from "@cesium/core";
import PickId from "../Renderer/PickId.js";
import BufferPrimitiveCollection from "./BufferPrimitiveCollection.js";

/** @import BufferPrimitiveMaterial from "./BufferPrimitiveMaterial.js"; */

const { DirtyFlags } = BufferPrimitiveCollection;

/**
 * 该视图绑定于 {@link BufferPrimitiveCollection} 的底层缓冲区数据。抽象概念。
 *
 * <p>当遍历大型集合时，BufferPrimitive 实例旨在被重复使用，
 * 并在对该原始类型执行读写操作时临时绑定到原始索引，
 * 随后使用
 * {@link https://en.wikipedia.org/wiki/Flyweight_pattern|flyweight pattern} 重新绑定到下一个原始类型。
 *
 * @see BufferPrimitiveCollection
 * @see BufferPrimitiveMaterial
 * @see BufferPoint
 * @see BufferPolyline
 * @see BufferPolygon
 *
 * @abstract
 * @experimental This 此功能尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 */
class BufferPrimitive {
  /**
   * 包含当前该实例提供视图的原始类型的集合。
   * 当前该实例提供视图的原始类型的索引。
   *
   * @type {BufferPrimitiveCollection<BufferPrimitive>}
   * @ignore
   */
  _collection = null;

  /**
   * 当前该实例提供视图的原始类型的字节偏移量，位于集合的缓冲区中。
   *
   * @type {number}
   * @ignore
   */
  _index = -1;

  /**
   * 当前该实例提供视图的原始类型在集合缓冲区中的二进制布局。
   * 每个 `Layout.MY_KEY_U32` 条目都是相对于原始起始偏移量的字节偏移量，后缀表示存储在该偏移量处的数据类型。
   *
   * @type {number}
   * @ignore
   */
  _byteOffset = -1;

  /**
   * 最后一条条目 `__BYTE_LENGTH` 不是指向缓冲区的指针——其
   * 字面值即为原始类型在缓冲区中的总字节长度，不包括其他缓冲区。
   * 与原始类型相关的功能ID；不要求唯一。
   * 表示原始类型是否显示的布尔（0或1）标志。
   *
   * 表示原始类型是否脏的布尔（0或1）标志。
   * 原始类型的Pick ID（uint32）。
   * 原始类型在缓冲区中的字节长度，不包括其他缓冲区。字面值，而非指针。
   *
   * @ignore
   */
  static Layout = {
    /**
     * 与原始类型相关的功能ID；不要求唯一。
     * @type {number}
     * @ignore
     */
    FEATURE_ID_U32: 0,

    /**
     * 表示原始类型是否显示的布尔（0或1）标志。
     * @type {number}
     * @ignore
     */
    SHOW_U8: 4,

    /**
     * 表示原始类型是否脏的布尔（0或1）标志。
     * @type {number}
     * @ignore
     */
    DIRTY_U8: 5,

    /**
     * 原始类型的Pick ID（uint32）。
     * @type {number}
     * @ignore
     */
    PICK_ID_U32: 8,

    /**
     * 原始类型在缓冲区中的字节长度，不包括其他缓冲区。字面值，而非指针。
     * 从源原始类型复制数据到结果。如果结果原始类型不是新的（集合中的最后一个原始类型），则源和结果原始类型
     * @type {number}
     * @ignore
     */
    __BYTE_LENGTH: 12,
  };

  /////////////////////////////////////////////////////////////////////////////
  // LIFECYCLE

  /**
   * 必须具有相同的顶点数量，以保证快速且稳定的性能。
   * 与原始类型相关的功能ID；不要求唯一。
   * 表示原始类型是否显示的布尔（0或1）标志。
   *
   * @param {BufferPrimitive} primitive
   * @param {BufferPrimitive} result
   * @returns {BufferPrimitive}
   */
  static clone(primitive, result) {
    const SrcMaterialClass = primitive._collection._getMaterialClass();

    //>>includeStart('debug', pragmas.debug);
    const DstMaterialClass = result._collection._getMaterialClass();
    assert(SrcMaterialClass === DstMaterialClass, "Incompatible materials");
    //>>includeEnd('debug');

    result.featureId = primitive.featureId;
    result.show = primitive.show;
    result.setMaterial(primitive.getMaterial(new SrcMaterialClass()));
    return result;
  }

  /**
   * 表示此原始类型的内存占用是否可调整大小。只有集合中最新的（最近创建的）原始类型可以调整大小，
   * 以确保性能快速且稳定。
   * 与原始类型相关的功能ID；不要求唯一。
   *
   * @returns {boolean}
   * @protected
   * @ignore
   */
  _isResizable() {
    return this._index === this._collection.primitiveCount - 1;
  }

  /////////////////////////////////////////////////////////////////////////////
  // ACCESSORS

  /**
   * 与原始类型相关的功能ID；不要求唯一。
   * @type {number}
   */
  get featureId() {
    return this._getUint32(BufferPrimitive.Layout.FEATURE_ID_U32);
  }

  set featureId(featureId) {
    this._setUint32(BufferPrimitive.Layout.FEATURE_ID_U32, featureId);
  }

  /**
   * 表示原始类型是否显示的布尔（0或1）标志。
   * @type {boolean}
   */
  get show() {
    return this._getUint8(BufferPrimitive.Layout.SHOW_U8) === 1;
  }

  set show(show) {
    this._setUint8(BufferPrimitive.Layout.SHOW_U8, show ? 1 : 0);
  }

  /**
   * @param {BufferPrimitiveMaterial} result
   * @returns {BufferPrimitiveMaterial}
   */
  getMaterial(result) {
    const collection = this._collection;
    const MaterialClass = collection._getMaterialClass();

    return MaterialClass.unpack(
      collection._materialView,
      this._index * MaterialClass.packedLength,
      result,
    );
  }

  /**
   * @param {BufferPrimitiveMaterial} material
   */
  setMaterial(material) {
    const collection = this._collection;
    const MaterialClass = collection._getMaterialClass();

    MaterialClass.pack(
      material,
      collection._materialView,
      this._index * MaterialClass.packedLength,
    );

    this._collection._makeDirty(DirtyFlags.PROPERTIES, this._index);

    return material;
  }

  /**
   * 表示自父集合上次读取以来该原始类型是否发生变化。渲染器不应在每一帧中遍历所有原始类型，而只需检查其范围。
   * parent collection last read it. Renderers should _not_ iterate over all
   * primitives each frame, but must instead inspect only the range of their
   * 变更跟踪器。此标志由原始对象的设置器自动管理。
   * 以及父集合。
   *
   * @type {boolean}
   * @ignore
   *
   * @see BufferPrimitiveCollection#_addChangeTracker
   * @see BufferPrimitiveCollection#_makeClean
   */
  get _dirty() {
    return this._getUint8(BufferPrimitive.Layout.DIRTY_U8) === 1;
  }

  /**
   * 原始对象的 Pick ID (uint32)。
   * @type {number}
   * @ignore
   */
  get _pickId() {
    return this._getUint32(BufferPrimitive.Layout.PICK_ID_U32);
  }

  set _pickId(pickId) {
    this._setUint32(BufferPrimitive.Layout.PICK_ID_U32, pickId);
  }

  /**
   * 用户定义的拾取对象，如有。当原始对象被渲染后，
   * 拾取对象便无法再被更改。
   *
   * @type {object|undefined}
   */
  get pickObject() {
    return this._collection._customPickObjects[this._index];
  }

  set pickObject(pickObject) {
    //>>includeStart('debug', pragmas.debug);
    assert(this._pickId === PickId.NULL_PICK_ID, ".pickObject locked");
    //>>includeEnd('debug');

    this._collection._customPickObjects[this._index] = pickObject;
  }

  /////////////////////////////////////////////////////////////////////////////
  // BUFFER ACCESSORS

  /**
   * @param {number} itemByteOffset
   * @returns {number}
   * @ignore
   */
  _getUint8(itemByteOffset) {
    return this._collection._primitiveView.getUint8(
      this._byteOffset + itemByteOffset,
    );
  }

  /**
   * @param {number} itemByteOffset
   * @param {number} itemValue
   * @ignore
   */
  _setUint8(itemByteOffset, itemValue) {
    this._collection._primitiveView.setUint8(
      this._byteOffset + itemByteOffset,
      itemValue,
    );
    this._collection._makeDirty(DirtyFlags.PROPERTIES, this._index);
  }

  /**
   * @param {number} itemByteOffset
   * @returns {number}
   * @ignore
   */
  _getUint32(itemByteOffset) {
    return this._collection._primitiveView.getUint32(
      this._byteOffset + itemByteOffset,
      true,
    );
  }

  /**
   * @param {number} itemByteOffset
   * @param {number} itemValue
   * @ignore
   */
  _setUint32(itemByteOffset, itemValue) {
    this._collection._primitiveView.setUint32(
      this._byteOffset + itemByteOffset,
      itemValue,
      true,
    );
    this._collection._makeDirty(DirtyFlags.PROPERTIES, this._index);
  }

  /**
   * @param {number} itemByteOffset
   * @returns {number}
   * @ignore
   */
  _getFloat32(itemByteOffset) {
    return this._collection._primitiveView.getFloat32(
      this._byteOffset + itemByteOffset,
      true,
    );
  }

  /**
   * @param {number} itemByteOffset
   * @param {number} itemValue
   * @ignore
   */
  _setFloat32(itemByteOffset, itemValue) {
    this._collection._primitiveView.setFloat32(
      this._byteOffset + itemByteOffset,
      itemValue,
      true,
    );
    this._collection._makeDirty(DirtyFlags.PROPERTIES, this._index);
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * 返回一个可序列化为 JSON 的对象，代表原始对象。此编码方式
   * 不会节省内存，通常仅用于调试和测试。
   * 对象。
   *
   * @returns {object} JSON-serializable object.
   */
  toJSON() {
    const collection = this._collection;
    const MaterialClass = collection._getMaterialClass();

    return {
      featureId: this.featureId,
      show: this.show,
      dirty: this._dirty,
      material: this.getMaterial(new MaterialClass()).toJSON(),
    };
  }
}

export default BufferPrimitive;
