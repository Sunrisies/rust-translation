import { Check, Frozen, defined } from "@cesium/core";
import PropertyAttributeProperty from "./PropertyAttributeProperty.js";

/**
 * 属性属性；作为自定义数据存储的每点属性集合
 * 顶点属性。
 * <p>
 * 请参阅 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension}
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} [options.name] 用于描述该属性的可选人类可读名称
 * @param {number} [options.id] 用于识别属性属性的唯一 ID，对调试很有帮助。这是属性属性数组中的索引值
 * @param {object} options.propertyAttribute 遵循 EXT_structural_metadata 模式的属性属性 JSON 数据
 * @param {MetadataClass} options.class 属性所符合的类
 *
 * @alias PropertyAttribute
 * @constructor
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容
 */
function PropertyAttribute(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const propertyAttribute = options.propertyAttribute;
  const classDefinition = options.class;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.propertyAttribute", propertyAttribute);
  Check.typeOf.object("options.class", classDefinition);
  //>>includeEnd('debug');

  const properties = {};
  if (defined(propertyAttribute.properties)) {
    for (const propertyId in propertyAttribute.properties) {
      if (propertyAttribute.properties.hasOwnProperty(propertyId)) {
        properties[propertyId] = new PropertyAttributeProperty({
          property: propertyAttribute.properties[propertyId],
          classProperty: classDefinition.properties[propertyId],
        });
      }
    }
  }

  this._name = options.name;
  this._id = options.id;
  this._class = classDefinition;
  this._properties = properties;
  this._extras = propertyAttribute.extras;
  this._extensions = propertyAttribute.extensions;
}

Object.defineProperties(PropertyAttribute.prototype, {
  /**
   * 该属性的人类可读名称
   *
   * @memberof PropertyAttribute.prototype
   *
   * @type {string}
   * @readonly
   * @private
   */
  name: {
    get: function () {
      return this._name;
    },
  },
  /**
   * 该属性的标识符。对调试很有帮助
   *
   * @memberof PropertyAttribute.prototype
   *
   * @type {string|number}
   * @readonly
   * @private
   */
  id: {
    get: function () {
      return this._id;
    },
  },
  /**
   * 属性所符合的类
   *
   * @memberof PropertyAttribute.prototype
   *
   * @type {MetadataClass}
   * @readonly
   * @private
   */
  class: {
    get: function () {
      return this._class;
    },
  },

  /**
   * 此属性中的属性
   *
   * @memberof PropertyAttribute.prototype
   *
   * @type {Object<string, PropertyAttributeProperty>}
   * @readonly
   * @private
   */
  properties: {
    get: function () {
      return this._properties;
    },
  },

  /**
   * 额外的用户自定义属性
   *
   * @memberof PropertyAttribute.prototype
   *
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
   * 包含扩展的对象
   *
   * @memberof PropertyAttribute.prototype
   *
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

/**
 * 获取具有给定属性 ID 的属性
 *
 * @param {string} propertyId 属性的大小写敏感 ID
 * @returns {PropertyAttributeProperty|undefined} The 该属性，如果属性不存在则返回 <code>undefined</code>
 * @private
 */
PropertyAttribute.prototype.getProperty = function (propertyId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  //>>includeEnd('debug');

  return this._properties[propertyId];
};

export default PropertyAttribute;
