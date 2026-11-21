import { Check, Frozen, clone } from "@cesium/core";
import MetadataEnumValue from "./MetadataEnumValue.js";
import MetadataComponentType from "./MetadataComponentType.js";

/**
 * 一个元数据枚举类型。
 * <p>
 * 有关 3D Tiles 的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata|3D Metadata Specification}。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.id 枚举类型的 ID。
 * @param {MetadataEnumValue[]} options.values 枚举值。
 * @param {MetadataComponentType} [options.valueType=MetadataComponentType.UINT16] 枚举值类型。
 * @param {string} [options.name] 枚举类型的名称。
 * @param {string} [options.description] 枚举类型的描述。
 * @param {*} [options.extras] 额外的用户自定义属性。
 * @param {object} [options.extensions] 包含扩展的对象。
 *
 * @alias MetadataEnum
 * @constructor
 * @experimental This 该特性使用了 3D Tiles 规范中尚未最终定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
function MetadataEnum(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const id = options.id;
  const values = options.values;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.id", id);
  Check.defined("options.values", values);
  //>>includeEnd('debug');

  const namesByValue = {};
  const valuesByName = {};

  const valuesLength = values.length;
  for (let i = 0; i < valuesLength; ++i) {
    const value = values[i];
    namesByValue[value.value] = value.name;
    valuesByName[value.name] = value.value;
  }

  const valueType = options.valueType ?? MetadataComponentType.UINT16;

  this._values = values;
  this._namesByValue = namesByValue;
  this._valuesByName = valuesByName;
  this._valueType = valueType;
  this._id = id;
  this._name = options.name;
  this._description = options.description;
  this._extras = clone(options.extras, true);
  this._extensions = clone(options.extensions, true);
}

/**
 * 从 3D Tiles 1.1、3DTILES_metadata、EXT_structural_metadata 或 EXT_feature_metadata 创建 {@link MetadataEnum}。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.id 枚举类型的 ID。
 * @param {object} options.enum 枚举值的 JSON 对象。
 *
 * @returns {MetadataEnum} The 新创建的元数据枚举类型。
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中尚未最终定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
MetadataEnum.fromJson = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const id = options.id;
  const enumDefinition = options.enum;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.id", id);
  Check.typeOf.object("options.enum", enumDefinition);
  //>>includeEnd('debug');

  const values = enumDefinition.values.map(function (value) {
    return MetadataEnumValue.fromJson(value);
  });

  return new MetadataEnum({
    id: id,
    values: values,
    valueType: MetadataComponentType[enumDefinition.valueType],
    name: enumDefinition.name,
    description: enumDefinition.description,
    extras: enumDefinition.extras,
    extensions: enumDefinition.extensions,
  });
};

Object.defineProperties(MetadataEnum.prototype, {
  /**
   * 枚举值。
   *
   * @memberof MetadataEnum.prototype
   * @type {MetadataEnumValue[]}
   * @readonly
   */
  values: {
    get: function () {
      return this._values;
    },
  },

  /**
   * 将枚举整数值映射到名称的字典。
   *
   * @memberof MetadataEnum.prototype
   * @type {Object<number, string>}
   * @readonly
   *
   * @private
   */
  namesByValue: {
    get: function () {
      return this._namesByValue;
    },
  },

  /**
   * 将枚举名称映射到整数值的字典。
   *
   * @memberof MetadataEnum.prototype
   * @type {Object<string, number>}
   * @readonly
   *
   * @private
   */
  valuesByName: {
    get: function () {
      return this._valuesByName;
    },
  },

  /**
   * 枚举值类型。
   *
   * @memberof MetadataEnum.prototype
   * @type {MetadataComponentType}
   * @readonly
   */
  valueType: {
    get: function () {
      return this._valueType;
    },
  },

  /**
   * 枚举类型的 ID。
   *
   * @memberof MetadataEnum.prototype
   * @type {string}
   * @readonly
   */
  id: {
    get: function () {
      return this._id;
    },
  },

  /**
   * 枚举类型的名称。
   *
   * @memberof MetadataEnum.prototype
   * @type {string}
   * @readonly
   */
  name: {
    get: function () {
      return this._name;
    },
  },

  /**
   * 枚举类型的描述。
   *
   * @memberof MetadataEnum.prototype
   * @type {string}
   * @readonly
   */
  description: {
    get: function () {
      return this._description;
    },
  },

  /**
   * 额外的用户自定义属性。
   *
   * @memberof MetadataEnum.prototype
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
   * @memberof MetadataEnum.prototype
   * @type {object}
   * @readonly
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },
});

export default MetadataEnum;
