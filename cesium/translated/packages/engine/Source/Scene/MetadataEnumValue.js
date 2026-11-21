import { Check, Frozen, clone } from "@cesium/core";

/**
 * 元数据枚举值。
 * <p>
 * 有关 3D Tiles 的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata|3D Metadata Specification}。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {number} options.value 整数值。
 * @param {string} options.name 枚举值的名称。
 * @param {string} [options.description] 枚举值的描述。
 * @param {*} [options.extras] 额外的用户自定义属性。
 * @param {object} [options.extensions] 包含扩展的对象。
 *
 * @alias MetadataEnumValue
 * @constructor
 * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
function MetadataEnumValue(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const value = options.value;
  const name = options.name;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("options.value", value);
  Check.typeOf.string("options.name", name);

  //>>includeEnd('debug');

  this._value = value;
  this._name = name;
  this._description = options.description;
  this._extras = clone(options.extras, true);
  this._extensions = clone(options.extensions, true);
}

/**
 * 从 3D Tiles 1.1、3DTILES_metadata、EXT_structural_metadata 或 EXT_feature_metadata 创建 {@link MetadataEnumValue}。
 *
 * @param {object} value 枚举值的 JSON 对象。
 *
 * @returns {MetadataEnumValue} The 新创建的元数据枚举值。
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
MetadataEnumValue.fromJson = function (value) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("value", value);
  //>>includeEnd('debug');

  return new MetadataEnumValue({
    value: value.value,
    name: value.name,
    description: value.description,
    extras: value.extras,
    extensions: value.extensions,
  });
};

Object.defineProperties(MetadataEnumValue.prototype, {
  /**
   * 整数值。
   *
   * @memberof MetadataEnumValue.prototype
   * @type {number}
   * @readonly
   */
  value: {
    get: function () {
      return this._value;
    },
  },

  /**
   * 枚举值的名称。
   *
   * @memberof MetadataEnumValue.prototype
   * @type {string}
   * @readonly
   */
  name: {
    get: function () {
      return this._name;
    },
  },

  /**
   * 枚举值的描述。
   *
   * @memberof MetadataEnumValue.prototype
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
   * @memberof MetadataEnumValue.prototype
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
   * @memberof MetadataEnumValue.prototype
   * @type {object}
   * @readonly
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },
});

export default MetadataEnumValue;
