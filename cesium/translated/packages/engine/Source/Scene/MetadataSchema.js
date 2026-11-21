import { Check, Frozen, clone, defined } from "@cesium/core";
import MetadataClass from "./MetadataClass.js";
import MetadataEnum from "./MetadataEnum.js";

/**
 * 包含类与枚举的规范文件。
 * <p>
 * 有关 3D Tiles 的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata|3D Metadata Specification}。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} [options.id] 规范的 ID。
 * @param {string} [options.name] 规范的名称。
 * @param {string} [options.description] 规范的描述。
 * @param {string} [options.version] 应用特定的规范版本。
 * @param {Object<string, MetadataClass>} [options.classes] 规范中定义的类，其中每个键对应一个类 ID。
 * @param {Object<string, MetadataEnum>} [options.enums] 规范中定义的枚举，其中每个键对应一个枚举 ID。
 * @param {*} [options.extras] 额外的用户自定义属性。
 * @param {object} [options.extensions] 包含扩展的对象。
 *
 * @alias MetadataSchema
 * @constructor
 * @experimental This feature 使用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
function MetadataSchema(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const classes = options.classes ?? {};
  const enums = options.enums ?? {};

  this._classes = classes;
  this._enums = enums;
  this._id = options.id;
  this._name = options.name;
  this._description = options.description;
  this._version = options.version;
  this._extras = clone(options.extras, true);
  this._extensions = clone(options.extensions, true);
}

/**
 * 从 3D Tiles 1.1、3DTILES_metadata、EXT_structural_metadata 或 EXT_feature_metadata 创建 {@link MetadataSchema}。
 *
 * @param {object} schema 规范的 JSON 对象。
 *
 * @returns {MetadataSchema} The 新创建的元数据规范。
 *
 * @private
 * @experimental This feature 使用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
MetadataSchema.fromJson = function (schema) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("schema", schema);
  //>>includeEnd('debug');

  const enums = {};
  if (defined(schema.enums)) {
    for (const enumId in schema.enums) {
      if (schema.enums.hasOwnProperty(enumId)) {
        enums[enumId] = MetadataEnum.fromJson({
          id: enumId,
          enum: schema.enums[enumId],
        });
      }
    }
  }

  const classes = {};
  if (defined(schema.classes)) {
    for (const classId in schema.classes) {
      if (schema.classes.hasOwnProperty(classId)) {
        classes[classId] = MetadataClass.fromJson({
          id: classId,
          class: schema.classes[classId],
          enums: enums,
        });
      }
    }
  }

  return new MetadataSchema({
    id: schema.id,
    name: schema.name,
    description: schema.description,
    version: schema.version,
    classes: classes,
    enums: enums,
    extras: schema.extras,
    extensions: schema.extensions,
  });
};

Object.defineProperties(MetadataSchema.prototype, {
  /**
   * 规范中定义的类。
   *
   * @memberof MetadataSchema.prototype
   * @type {Object<string, MetadataClass>}
   * @readonly
   */
  classes: {
    get: function () {
      return this._classes;
    },
  },

  /**
   * 规范中定义的枚举。
   *
   * @memberof MetadataSchema.prototype
   * @type {Object<string, MetadataEnum>}
   * @readonly
   */
  enums: {
    get: function () {
      return this._enums;
    },
  },

  /**
   * 规范的 ID。
   *
   * @memberof MetadataSchema.prototype
   * @type {string}
   * @readonly
   */
  id: {
    get: function () {
      return this._id;
    },
  },

  /**
   * 规范的名称。
   *
   * @memberof MetadataSchema.prototype
   * @type {string}
   * @readonly
   */
  name: {
    get: function () {
      return this._name;
    },
  },

  /**
   * 规范的描述。
   *
   * @memberof MetadataSchema.prototype
   * @type {string}
   * @readonly
   */
  description: {
    get: function () {
      return this._description;
    },
  },

  /**
   * 应用特定的规范版本。
   *
   * @memberof MetadataSchema.prototype
   * @type {string}
   * @readonly
   */
  version: {
    get: function () {
      return this._version;
    },
  },

  /**
   * 额外的用户自定义属性。
   *
   * @memberof MetadataSchema.prototype
   * @type {*}
   * @readonly
   */
  extras: {
    get: function () {
      return this._extras;
    },
  },

  /**
   * 包含扩展的对象。
   *
   * @memberof MetadataSchema.prototype
   * @type {object}
   * @readonly
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },
});

export default MetadataSchema;
