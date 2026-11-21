import { Check, Frozen, defined } from "@cesium/core";

/**
 * 来自 EXT_structural_metadata 的属性属性中的属性。
 *
 * <p>
 * 请参阅 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension}
 * </p>
 *
 * @param {object} options 包含以下属性的对象：
 * @param {object} options.property 属性 JSON 对象。
 * @param {MetadataClassProperty} options.classProperty 类属性。
 *
 * @alias PropertyAttributeProperty
 * @constructor
 *
 * @private
 * @experimental This feature 使用了 3D Tiles 规范中的部分内容，该内容尚未最终确定，可能会根据 Cesium 的标准弃用政策进行更改。
 */
function PropertyAttributeProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const property = options.property;
  const classProperty = options.classProperty;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.property", property);
  Check.typeOf.object("options.classProperty", classProperty);
  //>>includeEnd('debug');

  this._attribute = property.attribute;
  this._classProperty = classProperty;
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

  this._extras = property.extras;
  this._extensions = property.extensions;
}

Object.defineProperties(PropertyAttributeProperty.prototype, {
  /**
   * 属性语义。
   *
   * @memberof PropertyAttributeProperty.prototype
   * @type {string}
   * @readonly
   * @private
   */
  attribute: {
    get: function () {
      return this._attribute;
    },
  },

  /**
   * 如果应应用偏移/缩放，则为 true。如果偏移/缩放都为
   * 未定义，则默认为身份，因此此属性设置为 false。
   *
   * @memberof PropertyAttributeProperty.prototype
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
   * 作为值变换的一部分，添加到属性值中的偏移量。
   *
   * 即使 `hasValueTransform` 为 `false`，此值也始终被定义。如果
   * 属性 JSON 本身未定义此值，则它将继承来自 `MetadataClassProperty` 的值。在那里，它也始终被定义，如果不在类属性 JSON 中，则初始化为默认值。
   * 作为值变换的一部分，乘以属性值的比例。
   * 即使 `hasValueTransform` 为 `false`，此值也始终被定义。如果
   * 属性 JSON 本身未定义此值，则它将继承来自 `MetadataClassProperty` 的值。在那里，它也始终被定义，如果不在类属性 JSON 中，则初始化为默认值。
   *
   * @memberof PropertyAttributeProperty.prototype
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
   * 作为值变换的一部分，乘以属性值的比例。
   *
   * 即使 `hasValueTransform` 为 `false`，此值也始终被定义。如果
   * 属性 JSON 本身未定义此值，则它将继承来自 `MetadataClassProperty` 的值。在那里，它也始终被定义，如果不在类属性 JSON 中，则初始化为默认值。
   * 作为值变换的一部分，乘以属性值的比例。
   * 即使 `hasValueTransform` 为 `false`，此值也始终被定义。如果
   * 属性 JSON 本身未定义此值，则它将继承来自 `MetadataClassProperty` 的值。在那里，它也始终被定义，如果不在类属性 JSON 中，则初始化为默认值。
   *
   * @memberof PropertyAttributeProperty.prototype
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
   * 从此类继承的属性。
   *
   * @memberof PropertyAttributeProperty.prototype
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
   * 额外的用户自定义属性。
   *
   * @memberof PropertyAttributeProperty.prototype
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
   * @memberof PropertyAttributeProperty.prototype
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

export default PropertyAttributeProperty;
