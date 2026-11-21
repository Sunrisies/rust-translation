import { Check, Frozen, defined } from "@cesium/core";
import GltfLoaderUtil from "./GltfLoaderUtil.js";

/**
 * 属性纹理中的属性。
 *
 * <p>
 * 请参阅 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension} 以及
 * 之前的 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata|EXT_feature_metadata Extension} 关于 glTF 的说明。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.property 属性 JSON 对象。
 * @param {MetadataClassProperty} options.classProperty 类属性。
 * @param {Object<number, Texture>} options.textures 将纹理 ID 映射到 {@link Texture} 对象的对象。
 *
 * @alias PropertyTextureProperty
 * @constructor
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未最终确定，可能会根据 Cesium 的标准弃用政策进行更改。
 */
function PropertyTextureProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const property = options.property;
  const classProperty = options.classProperty;
  const textures = options.textures;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.property", property);
  Check.typeOf.object("options.classProperty", classProperty);
  Check.typeOf.object("options.textures", textures);
  //>>includeEnd('debug');

  // in EXT_structural_metadata, the property is a valid glTF textureInfo
  const channels = defined(property.channels) ? property.channels : [0];
  const textureInfo = property;
  const textureReader = GltfLoaderUtil.createModelTextureReader({
    textureInfo: textureInfo,
    channels: reformatChannels(channels),
    texture: textures[textureInfo.index],
  });

  this._min = property.min;
  this._max = property.max;

  let offset = property.offset;
  let scale = property.scale;

  // This needs to be set before handling default values
  const hasValueTransform =
    classProperty.hasValueTransform || defined(offset) || defined(scale);

  // If the property attribute does not define an offset/scale, it inherits from
  // the class property. The class property handles setting the default of
  // identity: (offset 0, scale 1) with the same scalar/vector/matrix types.
  // array types are disallowed by the spec.
  offset = offset ?? classProperty.offset;
  scale = scale ?? classProperty.scale;

  // offset and scale are applied on the GPU, so unpack the values
  // as math types we can use in uniform callbacks.
  offset = classProperty.unpackVectorAndMatrixTypes(offset);
  scale = classProperty.unpackVectorAndMatrixTypes(scale);

  this._offset = offset;
  this._scale = scale;
  this._hasValueTransform = hasValueTransform;

  this._textureReader = textureReader;
  this._classProperty = classProperty;
  this._extras = property.extras;
  this._extensions = property.extensions;
}

Object.defineProperties(PropertyTextureProperty.prototype, {
  /**
   * 纹理读取器。
   *
   * @memberof PropertyTextureProperty.prototype
   * @type {ModelComponents.TextureReader}
   * @readonly
   * @private
   */
  textureReader: {
    get: function () {
      return this._textureReader;
    },
  },

  /**
   * 如果应应用偏移/缩放，则设为 true。如果偏移/缩放均
   * 为 undefined，则默认设置为 identity，因此此属性设为 false。
   *
   * @memberof PropertyTextureProperty.prototype
   * @type {boolean}
   * @readonly
   * @private
   */
  hasValueTransform: {
    get: function () {
      return this._hasValueTransform;
    },
  },

  /**
   * 作为值变换的一部分，需添加到属性值中的偏移量。
   *
   * 即使 `hasValueTransform` 为 `false`，此值也始终被定义。如果
   * 属性 JSON 本身未定义该值，则它将继承
   * `MetadataClassProperty` 中的值。在那里，该值也始终被定义，如果不在类属性 JSON 中，则初始化为默认值。
   * 作为值变换的一部分，需乘以到属性值中的比例。
   * 即使 `hasValueTransform` 为 `false`，此值也始终被定义。如果
   *
   * @memberof PropertyTextureProperty.prototype
   * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
   * @readonly
   * @private
   */
  offset: {
    get: function () {
      return this._offset;
    },
  },

  /**
   * 属性 JSON 本身未定义该比例，则它将继承
   *
   * `MetadataClassProperty` 中的值。在那里，该比例也始终被定义，如果不在类属性 JSON 中，则初始化为默认值。
   * 从此类继承的属性。
   * 额外的用户自定义属性。
   * 包含扩展的对象。
   * 将数组形式的通道索引重新格式化为
   *
   * @memberof PropertyTextureProperty.prototype
   * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
   * @readonly
   * @private
   */
  scale: {
    get: function () {
      return this._scale;
    },
  },

  /**
   * 如 [0, 1] 这样的字符串，以便用于 GLSL swizzling 中（例如 "rg"）。
   *
   * @memberof PropertyTextureProperty.prototype
   * @type {MetadataClassProperty}
   * @readonly
   * @private
   */
  classProperty: {
    get: function () {
      return this._classProperty;
    },
  },

  /**
   * 通道索引。
   *
   * @memberof PropertyTextureProperty.prototype
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
   * 以 "r"、"g"、"b" 或 "a" 字符组成的字符串形式表示通道。
   *
   * @memberof PropertyTextureProperty.prototype
   * @type {*}
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
 * Reformat from an array of channel indices like <code>[0, 1]</code> to a
 * string of channels as would be used in GLSL swizzling (e.g. "rg")
 *
 * @param {number[]} channels the channel indices
 * @return {string} The channels as a string of "r", "g", "b" or "a" characters.
 * @private
 */
function reformatChannels(channels) {
  return channels
    .map(function (channelIndex) {
      return "rgba".charAt(channelIndex);
    })
    .join("");
}

export default PropertyTextureProperty;
