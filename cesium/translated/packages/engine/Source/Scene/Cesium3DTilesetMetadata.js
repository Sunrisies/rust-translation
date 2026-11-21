import { Check, Frozen, defined } from "@cesium/core";
import GroupMetadata from "./GroupMetadata.js";
import TilesetMetadata from "./TilesetMetadata.js";

/**
 * 包含 3D Tileset 元数据的对象。
 * <p>
 * 有关 3D Tiles 的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}。
 * </p>
 * <p>
 * 该对象代表 tileset JSON (3D Tiles 1.1) 或包含以下内容的 <code>3DTILES_metadata</code> 对象：
 * 模式定义 ({@link MetadataSchema})、tileset 元数据 ({@link TilesetMetadata})、组元数据（{@link GroupMetadata} 字典）以及元数据统计信息（字典）。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.metadataJson 要么是 tileset JSON (3D Tiles 1.1)，要么是包含 tileset 元数据的 <code>3DTILES_metadata</code> 扩展对象。
 * @param {MetadataSchema} options.schema 解析后的模式定义。
 *
 * @alias Cesium3DTilesetMetadata
 * @constructor
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，且尚未最终确定，可能根据 Cesium 标准弃用政策进行更改。
 */
function Cesium3DTilesetMetadata(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const metadataJson = options.metadataJson;

  // The calling code is responsible for loading the schema.
  // This keeps metadata parsing synchronous.
  const schema = options.schema;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.metadataJson", metadataJson);
  Check.typeOf.object("options.schema", schema);
  //>>includeEnd('debug');

  // An older schema stored the tileset metadata in the "tileset" property.
  const metadata = metadataJson.metadata ?? metadataJson.tileset;

  let tileset;
  if (defined(metadata)) {
    tileset = new TilesetMetadata({
      tileset: metadata,
      class: schema.classes[metadata.class],
    });
  }

  let groupIds = [];
  const groups = [];
  const groupsJson = metadataJson.groups;
  if (Array.isArray(groupsJson)) {
    const length = groupsJson.length;
    for (let i = 0; i < length; i++) {
      const group = groupsJson[i];
      groups.push(
        new GroupMetadata({
          group: group,
          class: schema.classes[group.class],
        }),
      );
    }
  } else if (defined(groupsJson)) {
    // An older version of group metadata stored groups in a dictionary
    // instead of an array.
    groupIds = Object.keys(groupsJson).sort();
    const length = groupIds.length;
    for (let i = 0; i < length; i++) {
      const groupId = groupIds[i];
      if (groupsJson.hasOwnProperty(groupId)) {
        const group = groupsJson[groupId];
        groups.push(
          new GroupMetadata({
            id: groupId,
            group: groupsJson[groupId],
            class: schema.classes[group.class],
          }),
        );
      }
    }
  }

  this._schema = schema;
  this._groups = groups;
  this._groupIds = groupIds;
  this._tileset = tileset;

  this._statistics = metadataJson.statistics;
  this._extras = metadataJson.extras;
  this._extensions = metadataJson.extensions;
}

Object.defineProperties(Cesium3DTilesetMetadata.prototype, {
  /**
   * 包含类和枚举的模式定义。
   *
   * @memberof Cesium3DTilesetMetadata.prototype
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
   * 关于内容组的元数据。
   *
   * @memberof Cesium3DTilesetMetadata.prototype
   * @type {GroupMetadata[]}
   * @readonly
   * @private
   */
  groups: {
    get: function () {
      return this._groups;
    },
  },

  /**
   * 对应组字典中组元数据的 ID。
   * 仅在使用旧版模式时才会填充。
   *
   * @memberof Cesium3DTilesetMetadata.prototype
   * @type {}
   * @readonly
   * @private
   */
  groupIds: {
    get: function () {
      return this._groupIds;
    },
  },

  /**
   * 关于整个 tileset 的元数据。
   *
   * @memberof Cesium3DTilesetMetadata.prototype
   * @type {TilesetMetadata}
   * @readonly
   * @private
   */
  tileset: {
    get: function () {
      return this._tileset;
    },
  },

  /**
   * 元数据统计信息。
   * <p>
   * 有关完整属性集的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/blob/main/extensions/3DTILES_metadata/schema/statistics.schema.json|statistics schema reference}
   * 位于 3D Tiles 规范中。
   * </p>
   *
   * @memberof Cesium3DTilesetMetadata.prototype
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
   * @memberof Cesium3DTilesetMetadata.prototype
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
   * 包含扩展对象的对象。
   *
   * @memberof Cesium3DTilesetMetadata.prototype
   * @type {object}
   * @readonly
   * @private
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },
});

export default Cesium3DTilesetMetadata;
