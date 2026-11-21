import { Check, Frozen, defined, destroyObject } from "@cesium/core";

/**
 * 包含结构元数据对象的实体。
 * <p>
 * 请参阅 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension} 以及之前的
 * {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata|EXT_feature_metadata Extension} 关于 glTF 的内容。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {MetadataSchema} options.schema 解析后的模式。
 * @param {PropertyTable[]} [options.propertyTables] 属性表对象的数组。对于旧的 <code>EXT_feature_metadata</code> 扩展，该数组按 propertyTables 字典中的键排序。
 * @param {PropertyTexture[]} [options.propertyTextures] 属性纹理对象的数组。对于旧的 <code>EXT_feature_metadata</code> 扩展，该数组按 propertyTextures 字典中的键排序。
 * @param {PropertyAttribute[]} [options.propertyAttributes] 属性属性对象的数组。此功能在 <code>EXT_structural_metadata</code> 中 mới。
 * @param {object} [options.statistics] 元数据的统计信息。
 * @param {object} [options.extras] 用户自定义额外属性。
 * @param {object} [options.extensions] 包含扩展的实体。
 *
 * @alias StructuralMetadata
 * @constructor
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未最终定稿，可能根据 Cesium 的标准弃用政策进行更改。
 */
function StructuralMetadata(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.schema", options.schema);
  //>>includeEnd('debug');

  this._schema = options.schema;
  const propertyTables = options.propertyTables;
  this._propertyTableCount = defined(propertyTables)
    ? propertyTables.length
    : 0;
  this._propertyTables = propertyTables ?? [];
  this._propertyTextures = options.propertyTextures ?? [];
  this._propertyAttributes = options.propertyAttributes ?? [];
  this._statistics = options.statistics;
  this._extras = options.extras;
  this._extensions = options.extensions;
}

Object.defineProperties(StructuralMetadata.prototype, {
  /**
   * 包含类和枚举的模式。
   *
   * @memberof StructuralMetadata.prototype
   * @type {MetadataSchema}
   * @readonly
   * @private
   */
  schema: {
    get: function () {
      return this._schema;
    },
  },

  /**
   * 元数据的统计信息。
   * <p>
   * 有关完整属性集，请参阅 {@link https://github.com/CesiumGS/glTF/blob/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata/schema/statistics.schema.json|statistics schema reference}。
   * </p>
   *
   * @memberof StructuralMetadata.prototype
   * @type {object}
   * @readonly
   * @private
   */
  statistics: {
    get: function () {
      return this._statistics;
    },
  },

  /**
   * 用户自定义额外属性。
   *
   * @memberof StructuralMetadata.prototype
   * @type {*}
   * @readonly
   * @private
   */
  extras: {
    get: function () {
      return this._extras;
    },
  },

  /**
   * 包含扩展的实体。
   *
   * @memberof StructuralMetadata.prototype
   * @type {object}
   * @readonly
   * @private
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },

  /**
   * 元数据中属性表的数量。
   *
   * @memberof StructuralMetadata.prototype
   * @type {number}
   * @readonly
   * @private
   */
  propertyTableCount: {
    get: function () {
      return this._propertyTableCount;
    },
  },

  /**
   * 元数据中的属性表。
   *
   * @memberof StructuralMetadata.prototype
   * @type {PropertyTable[]}
   * @readonly
   * @private
   */
  propertyTables: {
    get: function () {
      return this._propertyTables;
    },
  },

  /**
   * 元数据中的属性纹理。
   *
   * @memberof StructuralMetadata.prototype
   * @type {PropertyTexture[]}
   * @readonly
   * @private
   */
  propertyTextures: {
    get: function () {
      return this._propertyTextures;
    },
  },

  /**
   * 来自结构元数据扩展的属性属性。
   *
   * @memberof StructuralMetadata.prototype
   * @type {PropertyAttribute[]}
   * @readonly
   * @private
   */
  propertyAttributes: {
    get: function () {
      return this._propertyAttributes;
    },
  },

  /**
   * 所有属性表的总字节大小。
   *
   * @memberof StructuralMetadata.prototype
   * @type {number}
   * @readonly
   * @private
   */
  propertyTablesByteLength: {
    get: function () {
      if (!defined(this._propertyTables)) {
        return 0;
      }

      let totalByteLength = 0;
      const length = this._propertyTables.length;
      for (let i = 0; i < length; i++) {
        totalByteLength += this._propertyTables[i].byteLength;
      }

      return totalByteLength;
    },
  },
});

/**
 * 获取具有给定 ID 的属性表。
 * <p>
 * 对于旧的 <code>EXT_feature_metadata</code>，纹理存储在数组中，并按
 * propertyTables 字典中的键排序。
 * </p>
 *
 * @param {number} propertyTableId 属性表 ID。
 * @returns {PropertyTable} The 属性表。
 * @private
 */
StructuralMetadata.prototype.getPropertyTable = function (propertyTableId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("propertyTableId", propertyTableId);
  //>>includeEnd('debug');

  return this._propertyTables[propertyTableId];
};

/**
 * 获取具有给定 ID 的属性纹理。
 * <p>
 * 对于旧的 <code>EXT_feature_metadata</code>，纹理存储在数组中，并按
 * propertyTextures 字典中的键排序。
 * </p>
 *
 * @param {number} propertyTextureId 进入属性纹理数组的索引。
 * @returns {PropertyTexture} The 属性纹理。
 * @private
 */
StructuralMetadata.prototype.getPropertyTexture = function (propertyTextureId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("propertyTextureId", propertyTextureId);
  //>>includeEnd('debug');

  return this._propertyTextures[propertyTextureId];
};

/**
 * 获取具有给定 ID 的属性属性。此概念在
 * EXT_structural_metadata 中 mới。
 *
 * @param {number} propertyAttributeId 进入属性属性数组的索引。
 * @returns {PropertyAttribute} The 属性属性。
 * @private
 */
StructuralMetadata.prototype.getPropertyAttribute = function (
  propertyAttributeId,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("propertyAttributeId", propertyAttributeId);
  //>>includeEnd('debug');

  return this._propertyAttributes[propertyAttributeId];
};

/**
 * 销毁结构元数据中需要清理的资源。
 *
 * @private
 */
StructuralMetadata.prototype.destroy = function () {
  const propertyTables = this._propertyTables;
  for (let i = 0; i < propertyTables.length; i++) {
    propertyTables[i] = propertyTables[i] && propertyTables[i].destroy();
  }

  return destroyObject(this);
};

export default StructuralMetadata;
