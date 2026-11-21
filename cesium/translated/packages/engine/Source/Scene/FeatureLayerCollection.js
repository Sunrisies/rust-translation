// @ts-check

import { Check, defined, Event } from "@cesium/core";
import FeatureLayer from "./FeatureLayer.js";
import MetadataSemantic from "./MetadataSemantic.js";

/** @import Cesium3DTilesetMetadata from "./Cesium3DTilesetMetadata.js"; */
/** @import GroupMetadata from "./GroupMetadata.js"; */

/**
 * 一个 {@link Cesium3DTileset} 或 {@link FeatureLayerProvider} 的特征图层。
 * 只读：这些图层来自提供者的数据。
 * <p>
 * 当前，tileset 的图层是从根 tileset JSON 的 3D Tiles 1.1 中的 groups 创建的，并在 {@link Cesium3DTileset.fromUrl} 解析后只存在一次。外部 tilesets 中的 groups 目前尚未支持。
 * groups, and exist once {@link Cesium3DTileset.fromUrl} resolves. Groups in external
 * 目前还不支持外部 tilesets。
 * </p>
 *
 * @example
 * const tileset = await Cesium.Cesium3DTileset.fromUrl(url);
 * // 根 tileset 中的图层在 fromUrl 解析后只存在一次。
 * tileset.featureLayers.getByName("Roads")[0].show = false;
 * // 后续发现的图层会在加载时添加。
 * tileset.featureLayers.layerAdded.addEventListener((layer) => {
 * layer.show = layer.name !== "Vegetation";
 * });
 *
 * @internalConstructor
 *
 * @experimental This 该特征尚未确定，且可能根据 Cesium 的标准弃用政策发生变化。
 */
class FeatureLayerCollection {
  constructor() {
    /**
     * @type {FeatureLayer[]}
     * @private
     */
    this._layers = [];
    /**
     * @type {Map<GroupMetadata, FeatureLayer>}
     * @private
     */
    this._layerByGroup = new Map();
    /**
     * @type {Map<string, FeatureLayer>}
     * @private
     */
    this._layerByName = new Map();

    /**
     * 在图层被添加时同步调用，在其特征渲染之前执行。
     *
     * @type {Event<function(FeatureLayer):void>}
     */
    this.layerAdded = new Event();
  }

  /**
   * 图层的数量。
   *
   * @type {number}
   * @readonly
   */
  get length() {
    return this._layers.length;
  }

  /**
   * 获取指定索引的图层。
   *
   * @param {number} index 索引。
   * @returns {FeatureLayer} The 图层。
   */
  get(index) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number("index", index);
    //>>includeEnd('debug');
    return this._layers[index];
  }

  /**
   * 检查此集合是否包含指定的图层。
   *
   * @param {FeatureLayer} [layer] 要检查的图层。
   * @returns {boolean} <code>true</code> 如果集合中包含该图层，返回 <code>true</code>，否则返回 <code>false</code>。
   */
  contains(layer) {
    return this._layers.includes(layer);
  }

  /**
   * 获取所有具有给定名称的图层。名称不需要唯一。
   *
   * @param {string} name 图层名称。
   * @returns {FeatureLayer[]} The 匹配的图层。
   */
  getByName(name) {
    return this._layers.filter((layer) => layer.name === name);
  }

  /**
   * 根据 tileset JSON 元数据中的每个 group 添加一个图层。
   *
   * @param {Cesium3DTilesetMetadata} metadataExtension 解析后的 tileset JSON 元数据。
   * @private
   */
  _addGroups(metadataExtension) {
    if (!defined(metadataExtension)) {
      return;
    }
    // @ts-expect-error Cesium3DTilesetMetadata defines groups with Object.defineProperties.
    const groups = metadataExtension.groups;
    for (let i = 0; i < groups.length; i++) {
      const layer = new FeatureLayer({ name: getDefaultName(groups[i]) });
      this._layerByGroup.set(groups[i], layer);
      this._add(layer);
    }
  }

  /**
   * 添加一个图层。
   *
   * @param {FeatureLayer} layer 要添加的图层。
   * @ignore
   */
  _add(layer) {
    this._layers.push(layer);
    this.layerAdded.raiseEvent(layer);
  }

  /**
   * 获取由给定 group 元数据支持的图层。
   *
   * @param {GroupMetadata} [groupMetadata] group 元数据。
   * @returns {FeatureLayer|undefined} The 任何图层，如果有的话。
   * @private
   */
  _getByGroup(groupMetadata) {
    return defined(groupMetadata)
      ? this._layerByGroup.get(groupMetadata)
      : undefined;
  }

  /**
   * 获取给定源图层名称的图层，如果需要则添加该图层。
   *
   * @param {string} name 源图层名称。
   * @returns {FeatureLayer} The 图层。
   * @ignore
   */
  _getOrAddByName(name) {
    let layer = this._layerByName.get(name);
    if (!defined(layer)) {
      layer = new FeatureLayer({ name: name });
      this._layerByName.set(name, layer);
      this._add(layer);
    }
    return layer;
  }

  /**
   * 获取给定源图层名称的图层。
   *
   * @param {string} [name] 源图层名称。
   * @returns {FeatureLayer|undefined} The 任何图层，如果有的话。
   * @ignore
   */
  _getByName(name) {
    return defined(name) ? this._layerByName.get(name) : undefined;
  }
}

/**
 * @param {*} metadata 一个 {@link GroupMetadata}，由于其访问器为 <code>@private</code>，因此类型较为宽松。
 * @returns {string|undefined} The 如果有的话，group 的图层名称。
 * @private
 */
function getDefaultName(metadata) {
  if (metadata.hasPropertyBySemantic(MetadataSemantic.NAME)) {
    return metadata.getPropertyBySemantic(MetadataSemantic.NAME);
  }
  return metadata.hasProperty("name")
    ? metadata.getProperty("name")
    : undefined;
}

export default FeatureLayerCollection;
