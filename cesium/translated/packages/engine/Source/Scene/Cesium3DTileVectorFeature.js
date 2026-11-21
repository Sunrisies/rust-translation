// @ts-check

import { Color, DeveloperError, defined } from "@cesium/core";
import BufferPoint from "./BufferPoint.js";
import BufferPointCollection from "./BufferPointCollection.js";
import BufferPointMaterial from "./BufferPointMaterial.js";
import BufferPolygon from "./BufferPolygon.js";
import BufferPolygonCollection from "./BufferPolygonCollection.js";
import BufferPolygonMaterial from "./BufferPolygonMaterial.js";
import BufferPolyline from "./BufferPolyline.js";
import BufferPolylineCollection from "./BufferPolylineCollection.js";
import BufferPolylineMaterial from "./BufferPolylineMaterial.js";
import Cesium3DTileFeature from "./Cesium3DTileFeature.js";

/** @import BufferPrimitive from "./BufferPrimitive.js"; */
/** @import BufferPrimitiveMaterial from "./BufferPrimitiveMaterial.js"; */
/** @import Cesium3DTileBatchTable from "./Cesium3DTileBatchTable.js"; */
/** @import Cesium3DTileContent from "./Cesium3DTileContent.js"; */
/** @import Cesium3DTileset from "./Cesium3DTileset.js"; */
/** @import FeatureLayer from "./FeatureLayer.js"; */
/** @import VectorGltf3DTileContent from "./VectorGltf3DTileContent.js"; */

const point = new BufferPoint();
const polyline = new BufferPolyline();
const polygon = new BufferPolygon();

const pointMaterial = new BufferPointMaterial();
const polylineMaterial = new BufferPolylineMaterial();
const polygonMaterial = new BufferPolygonMaterial();

/**
 * 一个 {@link Cesium3DTileset} 的向量特性。
 * <p>
 * 提供对存储在瓦片批次表中的特性属性的访问，以及
 * 显示/隐藏和样式化该特性的能力。
 * </p>
 * <p>
 * 对 <code>Cesium3DTileVectorFeature</code> 对象的修改具有该瓦片内容的生命周期。如果瓦片内容被卸载，例如因为其不再可见且需要释放缓存中的空间以显示其他瓦片，请监听 {@link Cesium3DTileset#tileUnload} 事件以保存任何修改。同时监听 {@link Cesium3DTileset#tileVisible} 事件以重新应用这些修改。
 * 不要直接构造此对象。通过 {@link Cesium3DTileContent#getFeature} 或
 * to free space in the cache for visible tiles, listen to the {@link Cesium3DTileset#tileUnload} event to save any
 * modifications. Also listen to the {@link Cesium3DTileset#tileVisible} event to reapply any modifications.
 * </p>
 * <p>
 * Do not construct this directly.  Access it through {@link Cesium3DTileContent#getFeature}
 * or picking using {@link Scene#pick} and {@link Scene#pickPosition}.
 * </p>
 *
 * @experimental This handler.setInputAction(function(movement) {
 *
 * @example
 * const feature = scene.pick(movement.endPosition);
 * if (feature instanceof Cesium.Cesium3DTileVectorFeature) {
 * const propertyIds = feature.getPropertyIds();
 * const length = propertyIds.length;
 * for (let i = 0; i < length; ++i) {
 * const propertyId = propertyIds[i];
 * console.log(`{propertyId}: ${feature.getProperty(propertyId)}`);
 * }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 * 对于每个集合索引 N，此映射返回与该特性相关的所有
 *         }
 *     }
 * 原始对象的索引。
 *
 * @ignore
 */
class Cesium3DTileVectorFeature {
  /** @private  */
  _color = new Color();

  /** @private  */
  _outlineColor = new Color();

  /**
   * @param {VectorGltf3DTileContent} content
   * @param {number} batchId
   * @param {number} [batchTableId=0]
   */
  constructor(content, batchId, batchTableId = 0) {
    this._content = content;
    this._batchId = batchId;
    this._batchTableId = batchTableId;

    /**
     * 获取包含该特性的瓦片集。
     * 获取包含该特性的瓦片集。
     * @type {Map<number, number[]>}
     * @private
     */
    this._primitivesByCollection = new Map();
  }

  /**
   * @param {number} collectionIndex
   * @param {number} primitiveIndex
   */
  addPrimitiveByCollection(collectionIndex, primitiveIndex) {
    let primitiveIndices = this._primitivesByCollection.get(collectionIndex);
    if (!primitiveIndices) {
      primitiveIndices = [];
      this._primitivesByCollection.set(collectionIndex, primitiveIndices);
    }
    primitiveIndices.push(primitiveIndex);
  }

  /**
   * @type {boolean}
   * @default true
   */
  get show() {
    for (const prim of this._iteratePrimitives()) {
      if (prim.show) {
        return true;
      }
    }
    return false;
  }

  set show(value) {
    for (const prim of this._iteratePrimitives()) {
      prim.show = value;
    }
  }

  /**
   * @type {Color}
   * @default Color.WHITE
   */
  get color() {
    for (const material of this._iterateMaterials()) {
      return Color.clone(material.color, this._color);
    }
    return Color.clone(Color.WHITE, this._color);
  }

  set color(value) {
    for (const material of this._iterateMaterials()) {
      Color.clone(value, material.color);
    }
  }

  /**
   * @type {number}
   * @default 1
   */
  get pointSize() {
    for (const material of this._iteratePointMaterials()) {
      return material.size;
    }
    return 1;
  }

  set pointSize(value) {
    for (const material of this._iteratePointMaterials()) {
      material.size = value;
    }
  }

  /**
   * @type {Color}
   * @default Color.WHITE
   */
  get pointOutlineColor() {
    for (const material of this._iteratePointMaterials()) {
      return Color.clone(material.outlineColor, this._outlineColor);
    }
    return Color.clone(Color.WHITE, this._outlineColor);
  }

  set pointOutlineColor(value) {
    for (const material of this._iteratePointMaterials()) {
      Color.clone(value, material.outlineColor);
    }
  }

  /**
   * @type {number}
   * @default 0
   */
  get pointOutlineWidth() {
    for (const material of this._iteratePointMaterials()) {
      return material.outlineWidth;
    }
    return 0;
  }

  set pointOutlineWidth(value) {
    for (const material of this._iteratePointMaterials()) {
      material.outlineWidth = value;
    }
  }

  /**
   * @type {number}
   * @default 1
   */
  get lineWidth() {
    for (const material of this._iteratePolylineMaterials()) {
      return material.width;
    }
    return 1;
  }

  set lineWidth(value) {
    for (const material of this._iteratePolylineMaterials()) {
      material.width = value;
    }
  }

  /**
   * @type {Color}
   * @default Color.WHITE
   */
  get lineOutlineColor() {
    for (const material of this._iteratePolylineMaterials()) {
      return Color.clone(material.outlineColor, this._outlineColor);
    }
    return Color.clone(Color.WHITE, this._outlineColor);
  }

  set lineOutlineColor(value) {
    for (const material of this._iteratePolylineMaterials()) {
      Color.clone(value, material.outlineColor);
    }
  }

  /**
   * @type {number}
   * @default 0
   */
  get lineOutlineWidth() {
    for (const material of this._iteratePolylineMaterials()) {
      return material.outlineWidth;
    }
    return 0;
  }

  set lineOutlineWidth(value) {
    for (const material of this._iteratePolylineMaterials()) {
      material.outlineWidth = value;
    }
  }

  /**
   * @type {Color}
   * @default Color.WHITE
   */
  get polygonOutlineColor() {
    for (const material of this._iteratePolygonMaterials()) {
      return Color.clone(material.outlineColor, this._outlineColor);
    }
    return Color.clone(Color.WHITE, this._outlineColor);
  }

  set polygonOutlineColor(value) {
    for (const material of this._iteratePolygonMaterials()) {
      Color.clone(value, material.outlineColor);
    }
  }

  /**
   * @type {number}
   * @default 0
   */
  get polygonOutlineWidth() {
    for (const material of this._iteratePolygonMaterials()) {
      return material.outlineWidth;
    }
    return 0;
  }

  set polygonOutlineWidth(value) {
    for (const material of this._iteratePolygonMaterials()) {
      material.outlineWidth = value;
    }
  }

  /**
   * 获取包含该特性的瓦片的内容。
   *
   * @type {VectorGltf3DTileContent}
   *
   * @ignore
   */
  get content() {
    return this._content;
  }

  /**
   * 获取包含该特性的瓦片集。
   *
   * @type {Cesium3DTileset}
   */
  get tileset() {
    return this._content.tileset;
  }

  /**
   * 获取包含该特性的特性图层（如果有的话）。
   *
   * @type {FeatureLayer|undefined}
   *
   * @readonly
   * @experimental This 该特性尚未定稿且可能根据 Cesium 的标准弃用政策进行更改。
   */
  get featureLayer() {
    const content = this._content;
    const [collectionIndex] = this._primitivesByCollection.keys();
    return (
      content._collectionFeatureLayers.get(
        content._collections[collectionIndex],
      ) ??
      Cesium3DTileFeature.getFeatureLayer(
        // @ts-expect-error Requires type checking in Cesium3DTileContent.
        content,
      )
    );
  }

  /**
   * {@link Scene#pick} 返回的所有对象都具有 <code>primitive</code> 属性。这返回
   * 包含该特性的瓦片集。
   *
   * @type {Cesium3DTileset}
   */
  get primitive() {
    return this._content.tileset;
  }

  /**
   * 获取与该特性相关的特性 ID。使用 EXT_mesh_features，
   * 这是从选中的特性 ID 集合中得到的特性 ID。
   *
   * @type {number}
   *
   * @readonly
   */
  get featureId() {
    return this._batchId;
  }

  /**
   * @type {Cesium3DTileBatchTable|undefined}
   * @private
   */
  get _batchTable() {
    return this._content.batchTables[this._batchTableId];
  }

  /**
   * @type {number[]}
   * @ignore
   */
  get pickIds() {
    const pickIds = [];
    for (const prim of this._iteratePrimitives()) {
      pickIds.push(prim._pickId);
    }
    return pickIds;
  }

  /**
   * 返回该特性是否包含此属性。这包括该特性的
   * 类及其继承类的属性，当使用批次表层次结构时。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string} name 属性的大小写敏感名称。
   * @returns {boolean} Whether 该特性是否包含此属性。
   */
  hasProperty(name) {
    if (!defined(this._batchTable)) {
      return false;
    }
    return this._batchTable.hasProperty(this._batchId, name);
  }

  /**
   * 返回该特征的属性 ID 数组。这包括该特征及其继承类的属性。
   * 在使用批量表格层次结构时，包含该特征及其继承类的属性。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string[]} [results] 用于存储结果的数组。
   * @returns {string[]} The 特征属性的 ID。
   */
  getPropertyIds(results) {
    if (!defined(this._batchTable)) {
      return [];
    }
    return this._batchTable.getPropertyIds(this._batchId, results);
  }

  /**
   * 返回具有给定名称的特征属性值副本。这包括该特征及其继承类的属性。
   * 在使用批量表格层次结构时，包含该特征及其继承类的属性。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string} name 属性名称的大小写敏感形式。
   * @returns {*} The 属性的值，如果特征没有该属性则返回 <code>undefined</code>。
   *
   * @example
   * // 在控制台日志中显示特征的所有属性。
   * const propertyIds = feature.getPropertyIds();
   * const length = propertyIds.length;
   * for (let i = 0; i < length; ++i) {
   * const propertyId = propertyIds[i];
   * console.log(`{propertyId} : ${feature.getProperty(propertyId)}`);
   * }
   */
  getProperty(name) {
    if (!defined(this._batchTable)) {
      return undefined;
    }
    return this._batchTable.getProperty(this._batchId, name);
  }

  /**
   * 返回具有给定名称的特征属性值副本。
   * 如果特征包含具有元数据的 tileset（3D Tiles 1.1），
   * 或使用 <code>3DTILES_metadata</code> 扩展，则 tileset、组和 tile 的元数据是
   * 继承的。
   * <p>
   * 为了解决名称冲突，此方法按元数据粒度从最具体到最不具体顺序解析名称，依次为：特征、tile、组、tileset。在每种粒度中，先解析语义，再解析其他属性。
   * 属性名称的大小写敏感形式。
   * 属性的值，如果特征没有该属性则返回 <code>undefined</code>。
   * 特征正在使用 3D Tiles 规范中的部分内容，该内容尚未定稿且可能随 Cesium 标准弃用政策而变更。
   * </p>
   * @param {string} name 设置具有给定名称的特征属性值。
   * @returns {*} The 如果具有给定名称的属性不存在，则创建该属性。
   * @private
   * @experimental This 属性名称的大小写敏感形式。
   */
  getPropertyInherited(name) {
    return Cesium3DTileFeature.getPropertyInherited(
      // @ts-expect-error Requires type checking in Cesium3DTileContent.
      this._content,
      this._batchId,
      name,
      this._batchTable,
    );
  }

  /**
   * 具有给定名称的特征属性值。
   * <p>
   * 如果具有给定名称的属性不存在，则创建该属性。
   * </p>
   *
   * @param {string} name 属性名称的大小写敏感形式。
   * @param {*} value 将被复制的属性值。
   *
   * @exception {DeveloperError} Inherited 批量表格层次结构属性为只读。
   *
   * @example
   * const height = feature.getProperty('Height'); // 例如，建筑物的高度
   *
   * @example
   * const name = 'clicked';
   * if (feature.getProperty(name)) {
   * console.log('already clicked');
   * } else {
   * feature.setProperty(name, true);
   * console.log('first click');
   * }
   */
  setProperty(name, value) {
    throw new DeveloperError("Not implemented");
  }

  /**
   * 返回特征类名是否等于 <code>className</code>。与 {@link Cesium3DTileVectorFeature#isClass} 不同，
   * 此函数仅检查特征的精确类名，而不检查继承类。
   * <p>
   * 如果不存在批处理表格层次结构，此函数返回 <code>false</code>。
   * </p>
   *
   * @param {string} className 需要检查的名称。
   * @returns {boolean} Whether 该特征的类名等于 <code>className</code>。
   *
   * @private
   */
  isExactClass(className) {
    if (!defined(this._batchTable)) {
      return false;
    }
    return this._batchTable.isExactClass(this._batchId, className);
  }

  /**
   * 返回该特征的类名或任何继承类是否命名为 <code>className</code>。
   * <p>
   * 如果不存在批处理表格层次结构，此函数返回 <code>false</code>。
   * </p>
   *
   * @param {string} className 需要检查的名称。
   * @returns {boolean} Whether 该特征的类名或继承类命名为 <code>className</code>。
   *
   * @private
   */
  isClass(className) {
    if (!defined(this._batchTable)) {
      return false;
    }
    return this._batchTable.isClass(this._batchId, className);
  }

  /**
   * 返回该特征的类名。
   * <p>
   * 如果不存在批处理表格层次结构，此函数返回 <code>undefined</code>。
   * </p>
   *
   * @returns {string} The 特征的类名。
   *
   * @private
   */
  getExactClassName() {
    if (!defined(this._batchTable)) {
      return undefined;
    }
    return this._batchTable.getExactClassName(this._batchId);
  }

  /////////////////////////////////////////////////////////////////////////////
  // INTERNAL ITERATORS

  /**
   * @returns {Iterable<BufferPrimitive>}
   */
  *_iteratePrimitives() {
    yield* this._iteratePrimitivesWith(BufferPointCollection, point);
    yield* this._iteratePrimitivesWith(BufferPolylineCollection, polyline);
    yield* this._iteratePrimitivesWith(BufferPolygonCollection, polygon);
  }

  /**
   * @param {*} CollectionType
   * @param {BufferPrimitive} result
   * @returns {Iterable<BufferPrimitive>}
   */
  *_iteratePrimitivesWith(CollectionType, result) {
    const collections = this._content._collections;
    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i];
      const primitiveIndices = this._primitivesByCollection.get(i);
      if (primitiveIndices && collection instanceof CollectionType) {
        for (const primitiveIndex of primitiveIndices) {
          collection.get(primitiveIndex, result);
          yield result;
        }
      }
    }
  }

  /** @returns {Iterable<BufferPrimitiveMaterial>} */
  *_iterateMaterials() {
    yield* this._iteratePointMaterials();
    yield* this._iteratePolylineMaterials();
    yield* this._iteratePolygonMaterials();
  }

  /** @returns {Iterable<BufferPointMaterial>} */
  *_iteratePointMaterials() {
    yield* /** @type {Iterable<BufferPointMaterial>} */ (
      this._iterateMaterialsWith(BufferPointCollection, point, pointMaterial)
    );
  }

  /** @returns {Iterable<BufferPolylineMaterial>} */
  *_iteratePolylineMaterials() {
    yield* /** @type {Iterable<BufferPolylineMaterial>} */ (
      this._iterateMaterialsWith(
        BufferPolylineCollection,
        polyline,
        polylineMaterial,
      )
    );
  }

  /** @returns {Iterable<BufferPolygonMaterial>} */
  *_iteratePolygonMaterials() {
    yield* /** @type {Iterable<BufferPolygonMaterial>} */ (
      this._iterateMaterialsWith(
        BufferPolygonCollection,
        polygon,
        polygonMaterial,
      )
    );
  }

  /**
   * @param {*} CollectionType
   * @param {BufferPrimitive} primitive
   * @param {BufferPrimitiveMaterial} result
   * @returns {Iterable<BufferPrimitiveMaterial>}
   */
  *_iterateMaterialsWith(CollectionType, primitive, result) {
    for (const prim of this._iteratePrimitivesWith(CollectionType, primitive)) {
      prim.getMaterial(result);
      yield result;
      prim.setMaterial(result);
    }
  }
}

export default Cesium3DTileVectorFeature;