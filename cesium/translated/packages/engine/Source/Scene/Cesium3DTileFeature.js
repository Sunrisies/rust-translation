import { Color, defined } from "@cesium/core";

/** @import Cesium3DTileBatchTable from "./Cesium3DTileBatchTable.js"; */
/** @import Cesium3DTileContent from "./Cesium3DTileContent.js"; */
/** @import Cesium3DTileset from "./Cesium3DTileset.js"; */
/** @import FeatureLayer from "./FeatureLayer.js"; */

/**
 * 这是 {@link Cesium3DTileset} 的一个特性。
 * <p>
 * 提供对瓦片批次表中存储的特性的访问权限，以及
 * 通过 {@link Cesium3DTileFeature#show} 和 {@link Cesium3DTileFeature#color} 分别显示/隐藏特性及更改其高亮颜色的能力。
 * 。
 * </p>
 * <p>
 * 对 <code>Cesium3DTileFeature</code> 对象的修改具有该瓦片内容的生命周期。如果瓦片内容被卸载，例如因超出视野范围而需要释放缓存中的空间以保留可见瓦片，请监听 {@link Cesium3DTileset#tileUnload} 事件以保存任何修改。同时监听 {@link Cesium3DTileset#tileVisible} 事件以重新应用这些修改。
 * 不要直接构造此对象。通过 {@link Cesium3DTileContent#getFeature} 或利用 {@link Scene#pick} 选择的方式访问它。
 * // 当鼠标悬停时，在控制台日志中显示所有特性的属性。
 * handler.setInputAction(function(movement) {
 * </p>
 * <p>
 * const feature = scene.pick(movement.endPosition);
 * if (feature instanceof Cesium.Cesium3DTileFeature) {
 * </p>
 *
 * @example
 * const propertyIds = feature.getPropertyIds();
 * const length = propertyIds.length;
 * for (let i = 0; i < length; ++i) {
 * const propertyId = propertyIds[i];
 * console.log(`{propertyId}: ${feature.getProperty(propertyId)}`);
 * }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 * 用于获取或设置特性是否显示。此值在所有特性上都被设置，
 * 当样式中的显示策略被评估时。
 * 用于获取或设置与特性颜色相乘的高亮颜色。当
 *         }
 *     }
 * 此值为白色时，特性颜色不会改变。此值在所有特性上都被设置，
 */
class Cesium3DTileFeature {
  /**
   * @param {Cesium3DTileContent} content
   * @param {number} batchId
   */
  constructor(content, batchId) {
    this._content = content;
    this._batchId = batchId;
    this._color = undefined; // for calling getColor
  }

  /**
   * 当样式中的颜色策略被评估时。
   * 返回一个包含多段线 ECEF 位置的类型化数组。
   *
   * @type {boolean}
   *
   * @default true
   */
  get show() {
    return this._content.batchTable.getShow(this._batchId);
  }

  set show(value) {
    this._content.batchTable.setShow(this._batchId, value);
  }

  /**
   * 如果 {@link Cesium3DTileset#vectorKeepDecodedPositions} 为 false
   * 或特性不是矢量瓦片中的多段线，则返回 undefined。
   * 此特性使用的是 3D Tiles 规范中尚未定稿的部分内容，可能根据 Cesium 的标准弃用政策发生变化。
   *
   * @type {Color}
   *
   * @default {@link Color.WHITE}
   */
  get color() {
    if (!defined(this._color)) {
      this._color = new Color();
    }
    return this._content.batchTable.getColor(this._batchId, this._color);
  }

  set color(value) {
    this._content.batchTable.setColor(this._batchId, value);
  }

  /**
   * 获取包含该特性的瓦片内容。
   * 获取包含该特性的瓦片集。
   * 获取包含该特性的特性图层（如果有的话）。
   *
   * @experimental This 此特性尚未定稿，可能根据 Cesium 的标准弃用政策发生变化。
   *
   * @type {Float64Array}
   */
  get polylinePositions() {
    if (!defined(this._content.getPolylinePositions)) {
      return undefined;
    }

    return this._content.getPolylinePositions(this._batchId);
  }

  /**
   * 获取包含该特性的瓦片内容。
   *
   * @type {Cesium3DTileContent}
   *
   * @readonly
   * @private
   */
  get content() {
    return this._content;
  }

  /**
   * 获取包含该特性的瓦片集。
   *
   * @type {Cesium3DTileset}
   *
   * @readonly
   */
  get tileset() {
    return this._content.tileset;
  }

  /**
   * 获取包含该特性的特性图层，如果有的话。
   *
   * @type {FeatureLayer|undefined}
   *
   * @readonly
   * @experimental This 此特性尚未定稿，可能根据 Cesium 的标准弃用政策发生变化。
   */
  get featureLayer() {
    return Cesium3DTileFeature.getFeatureLayer(this._content);
  }

  /**
   * {@link Scene#pick} 返回的所有对象都具有 <code>primitive</code> 属性。此属性会返回
   * 包含该特征的瓦片集。
   *
   * @type {Cesium3DTileset}
   *
   * @readonly
   */
  get primitive() {
    return this._content.tileset;
  }

  /**
   * 获取与该特征相关的特征 ID。对于 3D Tiles 1.0，将返回
   * 批次 ID。对于 EXT_mesh_features，这是来自
   * 所选特征 ID 集的特征 ID。
   *
   * @type {number}
   *
   * @readonly
   * @experimental This 该特征使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
   */
  get featureId() {
    return this._batchId;
  }

  /**
   * @private
   */
  get pickId() {
    return this._content.batchTable.getPickColor(this._batchId);
  }

  /**
   * 返回该特征是否包含此属性。这包括来自该特征的
   * 类以及使用批次表层次结构时继承的类中的属性。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string} name 属性的大小写敏感名称。
   * @returns {boolean} Whether 该特征包含此属性。
   */
  hasProperty(name) {
    return this._content.batchTable.hasProperty(this._batchId, name);
  }

  /**
   * 返回该特征的属性 ID 数组。这包括来自该特征的
   * 类以及使用批次表层次结构时继承的类中的属性。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string[]} [results] 用于存储结果的数组。
   * @returns {string[]} The 特征属性的 ID。
   */
  getPropertyIds(results) {
    return this._content.batchTable.getPropertyIds(this._batchId, results);
  }

  /**
   * 返回具有给定名称的特征属性的值副本。这包括来自该特征的
   * 类以及使用批次表层次结构时继承的类中的属性。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_batch_table_hierarchy}
   *
   * @param {string} name 属性的大小写敏感名称。
   * @returns {*} The 属性值，如果特征没有此属性则返回 <code>undefined</code>。
   *
   * @example
   * // 在控制台日志中显示特征的所有属性。
   * const propertyIds = feature.getPropertyIds();
   * const length = propertyIds.length;
   * for (let i = 0; i < length; ++i) {
   * const propertyId = propertyIds[i];
   * console.log(`{propertyId}: ${feature.getProperty(propertyId)}`);
   * }
   */
  getProperty(name) {
    return this._content.batchTable.getProperty(this._batchId, name);
  }

  /**
   * 获取内容中特征的特征层。瓦片的层优先；
   * 具有多个内容的瓦片内部内容会回退到其自身组。
   *
   * @param {Cesium3DTileContent} content 包含特征的内容。
   * @returns {FeatureLayer|undefined} The 特征层（如有）。
   *
   * @ignore
   */
  static getFeatureLayer(content) {
    return (
      content.tile._featureLayer ??
      content.tileset.featureLayers._getByGroup(content.group?.metadata)
    );
  }

  /**
   * 返回具有给定名称的特征属性副本，检查所有
   * 来自 3D Tiles 1.0 格式、EXT_structural_metadata 和遗留
   * EXT_feature_metadata glTF 扩展的元数据，以及存在于
   * 瓦片集 JSON（3D Tiles 1.1）或 3DTILES_metadata 3D Tiles 扩展中的元数据。
   * 元数据按从最具体到最通用的顺序进行匹配，并返回第一个匹配项。元数据按此顺序检查：
   * <li>按语义的批次表（结构元数据）属性</li>
   *
   * <ol>
   * <li>按属性 ID 的批次表（结构元数据）属性</li>
   * <li>按语义的内容元数据属性</li>
   * <li>Content metadata property by semantic</li>
   * <li>按属性划分的内容元数据属性</li>
   * <li>按语义划分的瓦片元数据属性</li>
   * <li>按属性 ID 划分的瓦片元数据属性</li>
   * <li>按语义划分的子树元数据属性</li>
   * <li>按属性 ID 划分的子树元数据属性</li>
   * <li>按语义划分的组元数据属性</li>
   * <li>按属性 ID 划分的组元数据属性</li>
   * <li>按语义划分的瓦片集元数据属性</li>
   * <li>按属性 ID 划分的瓦片集元数据属性</li>
   * <li>否则，返回 undefined</li>
   * </ol>
   * <p>
   * 关于 3D Tiles 的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}
   * 对于 3D Tiles，以及 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension}
   * 针对 glTF。关于旧版 glTF 扩展，请参阅 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata|EXT_feature_metadata Extension}
   * </p>
   *
   * @param {Cesium3DTileContent} content 用于访问元数据的内容
   * @param {number} batchId 获取该属性所需的特征的批处理 ID（或特征 ID）
   * @param {string} name 特征的语义或属性 ID。在元数据每个粒度中，先检查语义，再检查属性 ID。
   * @privateParam {Cesium3DTileBatchTable} [batchTable] 查找特征属性的批处理表。如果未指定，则使用 `content.batchTable`。
   * @return {*} The 该属性的值，或者如果特征没有该属性则返回 <code>undefined</code>。
   *
   * @experimental This 该特征使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
   */
  static getPropertyInherited(
    content,
    batchId,
    name,
    batchTable = content.batchTable,
  ) {
    if (defined(batchTable)) {
      if (batchTable.hasPropertyBySemantic(batchId, name)) {
        return batchTable.getPropertyBySemantic(batchId, name);
      }

      if (batchTable.hasProperty(batchId, name)) {
        return batchTable.getProperty(batchId, name);
      }
    }

    const contentMetadata = content.metadata;
    if (defined(contentMetadata)) {
      if (contentMetadata.hasPropertyBySemantic(name)) {
        return contentMetadata.getPropertyBySemantic(name);
      }

      if (contentMetadata.hasProperty(name)) {
        return contentMetadata.getProperty(name);
      }
    }

    const tile = content.tile;
    const tileMetadata = tile.metadata;
    if (defined(tileMetadata)) {
      if (tileMetadata.hasPropertyBySemantic(name)) {
        return tileMetadata.getPropertyBySemantic(name);
      }

      if (tileMetadata.hasProperty(name)) {
        return tileMetadata.getProperty(name);
      }
    }

    let subtreeMetadata;
    if (defined(tile.implicitSubtree)) {
      subtreeMetadata = tile.implicitSubtree.metadata;
    }

    if (defined(subtreeMetadata)) {
      if (subtreeMetadata.hasPropertyBySemantic(name)) {
        return subtreeMetadata.getPropertyBySemantic(name);
      }

      if (subtreeMetadata.hasProperty(name)) {
        return subtreeMetadata.getProperty(name);
      }
    }

    const groupMetadata = defined(content.group)
      ? content.group.metadata
      : undefined;
    if (defined(groupMetadata)) {
      if (groupMetadata.hasPropertyBySemantic(name)) {
        return groupMetadata.getPropertyBySemantic(name);
      }

      if (groupMetadata.hasProperty(name)) {
        return groupMetadata.getProperty(name);
      }
    }

    const tilesetMetadata = content.tileset.metadata;
    if (defined(tilesetMetadata)) {
      if (tilesetMetadata.hasPropertyBySemantic(name)) {
        return tilesetMetadata.getPropertyBySemantic(name);
      }

      if (tilesetMetadata.hasProperty(name)) {
        return tilesetMetadata.getProperty(name);
      }
    }

    return undefined;
  }

  /**
   * 返回具有给定名称的特征属性值的副本。
   * 如果特征包含具有元数据的瓦片集（3D Tiles 1.1），
   * 或者使用了 <code>3DTILES_metadata</code> 扩展，即瓦片集、组和瓦片，
   * 则元数据会被继承。
   * <p>
   * 为了解决名称冲突，该方法按元数据的粒度从最具体到最不具体顺序解析名称，依次为：特征、瓦片、组、
   * 瓦片集。在每个粒度中，先解析语义，再解析其他属性。
   * 该属性的大小写敏感名称。
   * 该属性的值，或者如果特征没有该属性则返回 <code>undefined</code>。
   * </p>
   * @param {string} name 设置具有给定名称的特征属性的值。
   * @returns {*} The 如果具有给定名称的属性不存在，则创建该属性。
   * @private
   */
  getPropertyInherited(name) {
    return Cesium3DTileFeature.getPropertyInherited(
      this._content,
      this._batchId,
      name,
    );
  }

  /**
   * Sets the value of the feature's property with the given name.
   * <p>
   * If a property with the given name doesn't exist, it is created.
   * </p>
   *
   * @param {string} name 属性的区分大小写的名称。
   * @param {*} value 将被复制的属性值。
   *
   * @exception {DeveloperError} Inherited batch table hierarchy 属性为只读。
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
    this._content.batchTable.setProperty(this._batchId, name, value);

    // PERFORMANCE_IDEA: Probably overkill, but maybe only mark the tile dirty if the
    // property is in one of the style's expressions or - if it can be done quickly -
    // if the new property value changed the result of an expression.
    this._content.featurePropertiesDirty = true;
  }

  /**
   * 返回该实体的类名是否等于 <code>className</code>。与 {@link Cesium3DTileFeature#isClass} 不同。
   * 此函数仅检查实体的精确类名，而不检查继承类。
   * <p>
   * 如果不存在 batch table hierarchy，此函数返回 <code>false</code>。
   * </p>
   *
   * @param {string} className 需要检查的名称。
   * @returns {boolean} Whether 实体的类名等于 <code>className</code>
   *
   * @private
   */
  isExactClass(className) {
    return this._content.batchTable.isExactClass(this._batchId, className);
  }

  /**
   * 返回实体的类名或任何继承类的名字是否为 <code>className</code>。
   * <p>
   * 如果不存在 batch table hierarchy，此函数返回 <code>false</code>。
   * </p>
   *
   * @param {string} className 需要检查的名称。
   * @returns {boolean} Whether 实体的类名或继承类的名字为 <code>className</code>
   *
   * @private
   */
  isClass(className) {
    return this._content.batchTable.isClass(this._batchId, className);
  }

  /**
   * 返回实体的类名。
   * <p>
   * 如果不存在 batch table hierarchy，此函数返回 <code>undefined</code>。
   * </p>
   *
   * @returns {string} The 实体的类名。
   *
   * @private
   */
  getExactClassName() {
    return this._content.batchTable.getExactClassName(this._batchId);
  }
}

export default Cesium3DTileFeature;
