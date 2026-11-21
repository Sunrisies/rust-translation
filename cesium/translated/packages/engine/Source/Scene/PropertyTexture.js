import { Check, Frozen, defined } from "@cesium/core";
import PropertyTextureProperty from "./PropertyTextureProperty.js";

/**
 * 属性纹理。
 * <p>
 * 请参阅 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension} 以及之前的 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata|EXT_feature_metadata Extension} 关于 glTF 的说明。
 * 具有以下属性的对象：
 * </p>
 *
 * @param {object} options 可选的人类可读名称，用于描述纹理。
 * @param {string} [options.name] 用于识别属性纹理的唯一 ID，有助于调试。对于 <code>EXT_structural_metadata</code>，这是属性纹理数组中的索引；对于 <code>EXT_feature_metadata</code>，这是属性纹理字典中的键。
 * @param {string|number} [options.id] 遵循 EXT_structural_metadata 模式的属性纹理 JSON 数据。
 * @param {object} options.propertyTexture 属性纹理所遵循的类。
 * @param {MetadataClass} options.class 将属性映射到 {@link Texture} 对象的对象。
 * @param {Object<string, Texture>} options.textures 使用 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分。
 *
 * @alias PropertyTexture
 * @constructor
 *
 * @private
 * @experimental This 此纹理的人类可读名称。
 */
function PropertyTexture(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const propertyTexture = options.propertyTexture;
  const classDefinition = options.class;
  const textures = options.textures;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.propertyTexture", propertyTexture);
  Check.typeOf.object("options.class", classDefinition);
  Check.typeOf.object("options.textures", textures);
  //>>includeEnd('debug');

  const extensions = propertyTexture.extensions;
  const extras = propertyTexture.extras;

  const properties = {};
  if (defined(propertyTexture.properties)) {
    for (const propertyId in propertyTexture.properties) {
      if (propertyTexture.properties.hasOwnProperty(propertyId)) {
        properties[propertyId] = new PropertyTextureProperty({
          property: propertyTexture.properties[propertyId],
          classProperty: classDefinition.properties[propertyId],
          textures: textures,
        });
      }
    }
  }

  this._name = options.name;
  this._id = options.id;
  this._class = classDefinition;
  this._properties = properties;
  this._extras = extras;
  this._extensions = extensions;
}

Object.defineProperties(PropertyTexture.prototype, {
  /**
   * 此纹理的标识符，有助于调试。
   *
   * @memberof PropertyTexture.prototype
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
   * 属性纹理所遵循的类。
   *
   * @memberof PropertyTexture.prototype
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
   * 此属性纹理中的属性。
   *
   * @memberof PropertyTexture.prototype
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
   * 此属性纹理中的额外用户定义属性。
   *
   * @memberof PropertyTexture.prototype
   *
   * @type {Object<string, PropertyTextureProperty>}
   * @readonly
   * @private
   */
  properties: {
    get: function () {
      return this._properties;
    },
  },

  /**
   * 包含扩展的对象。
   *
   * @memberof PropertyTexture.prototype
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
   * 包含扩展的对象。
   *
   * @memberof PropertyTexture.prototype
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
 * 获取具有给定属性 ID 的属性。
 *
 * @param {string} propertyId 属性的大小写敏感 ID。
 * @returns {PropertyTextureProperty|undefined} The 属性值，如果属性不存在则返回 <code>undefined</code>。
 * @private
 */
PropertyTexture.prototype.getProperty = function (propertyId) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  //>>includeEnd('debug');

  return this._properties[propertyId];
};

export default PropertyTexture;
