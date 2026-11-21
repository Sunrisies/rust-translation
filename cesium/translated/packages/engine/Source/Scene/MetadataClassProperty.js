import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Check,
  DeveloperError,
  Frozen,
  Matrix2,
  Matrix3,
  Matrix4,
  clone,
  defined,
} from "@cesium/core";
import MetadataType from "./MetadataType.js";
import MetadataComponentType, {
  ScalarCategories,
} from "./MetadataComponentType.js";

/**
 * 作为 {@link MetadataClass} 的一部分的元数据属性。
 * <p>
 * 有关 3D Tiles 的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata|3D Metadata Specification}。
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.id 属性的 ID。
 * @param {MetadataType} options.type 属性的类型，例如 SCALAR、VEC2、VEC3。
 * @param {MetadataComponentType} [options.componentType] 属性的组件类型。包括整数（如 INT8 或 UINT16）和浮点数（FLOAT32 和 FLOAT64）值。
 * @param {MetadataEnum} [options.enumType] 属性的枚举类型。仅在类型为 ENUM 时定义。
 * @param {boolean} [options.isArray=false] 如果属性是数组（固定长度或可变长度），则为真；否则为假。
 * @param {boolean} [options.isVariableLengthArray=false] 如果属性是可变长度数组，则为真；否则为假。
 * @param {number} [options.arrayLength] 数组元素的数量。仅针对固定长度数组定义。
 * @param {boolean} [options.normalized=false] 属性是否经过归一化。
 * @param {number|number[]|number[][]} [options.min] 存储该属性最小允许值的数字或数字数组。仅在类型为数字类型时定义。
 * @param {number|number[]|number[][]} [options.max] 存储该属性最大允许值的数字或数字数组。仅在类型为数字类型时定义。
 * @param {number|number[]|number[][]} [options.offset] 作为值变换的一部分，需加到属性值上的偏移量。
 * @param {number|number[]|number[][]} [options.scale] 作为值变换的一部分，需乘以的属性值比例。
 * @param {number|string|Array} [options.noData] 表示空值的无数据哨兵值。
 * @param {number|string|Array} [options.default] 当实体属性值未定义时使用的默认值。
 * @param {boolean} [options.required=false] 属性是否必填。
 * @param {string} [options.name] 属性的名称。
 * @param {string} [options.description] 属性的描述。
 * @param {string} [options.semantic] 描述该属性应如何解释的标识符。
 * @param {*} [options.extras] 额外的用户自定义属性。
 * @param {object} [options.extensions] 包含扩展的对象。
 *
 * @alias MetadataClassProperty
 * @constructor
 * @experimental This feature 使用的是 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
 */
function MetadataClassProperty(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const id = options.id;
  const type = options.type;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.id", id);
  Check.typeOf.string("options.type", type);
  //>>includeEnd('debug');

  const componentType = options.componentType;
  const enumType = options.enumType;

  const normalized =
    defined(componentType) &&
    (options.normalized ?? false) &&
    MetadataComponentType.isIntegerType(componentType);

  // Basic information about this property
  this._id = id;
  this._name = options.name;
  this._description = options.description;
  this._semantic = options.semantic;

  // Only for unit testing purposes, not documented in the API
  this._isLegacyExtension = options.isLegacyExtension;

  // Details about basic types
  this._type = type;
  this._componentType = componentType;
  this._enumType = enumType;
  this._valueType = defined(enumType) ? enumType.valueType : componentType;

  // Details about arrays
  this._isArray = options.isArray ?? false;
  this._isVariableLengthArray = options.isVariableLengthArray ?? false;
  this._arrayLength = options.arrayLength;

  // min and max allowed values
  this._min = clone(options.min, true);
  this._max = clone(options.max, true);

  // properties that adjust the range of metadata values
  this._normalized = normalized;

  let offset = clone(options.offset, true);
  let scale = clone(options.scale, true);
  const hasValueTransform = defined(offset) || defined(scale);

  const enableNestedArrays = true;
  if (!defined(offset)) {
    offset = this.expandConstant(0, enableNestedArrays);
  }

  if (!defined(scale)) {
    scale = this.expandConstant(1, enableNestedArrays);
  }

  this._offset = offset;
  this._scale = scale;
  this._hasValueTransform = hasValueTransform;

  // sentinel value for missing data, and a default value to use
  // in its place if needed.
  this._noData = clone(options.noData, true);
  // For vector and array types, this is stored as an array of values.
  this._default = clone(options.default, true);

  this._required = options.required ?? true;

  // extras and extensions
  this._extras = clone(options.extras, true);
  this._extensions = clone(options.extensions, true);
}

/**
 * 从 3D Tiles 1.1、3DTILES_metadata、EXT_structural_metadata 或 EXT_feature_metadata 创建 {@link MetadataClassProperty}。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.id 属性的 ID。
 * @param {object} options.property 属性 JSON 对象。
 * @param {Object<string, MetadataEnum>} [options.enums] 枚举值的字典。
 *
 * @returns {MetadataClassProperty} The 新创建的元数据类属性。
 *
 * @private
 * @experimental This feature 使用的是 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
 */
MetadataClassProperty.fromJson = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const id = options.id;
  const property = options.property;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.id", id);
  Check.typeOf.object("options.property", property);
  Check.typeOf.string("options.property.type", property.type);
  //>>includeEnd('debug');

  // Try to determine if this is the legacy extension. This is not
  // always possible, as there are some types that are valid in both
  // extensions.
  const isLegacyExtension = isLegacy(property);
  const parsedType = parseType(property, options.enums);

  // EXT_feature_metadata had an optional flag, while EXT_structural_metadata
  // has a required flag. The defaults are not the same, and there's some cases
  // like {type: BOOLEAN} that are ambiguous. Coalesce this into a single
  // required flag
  let required;
  if (!defined(isLegacyExtension)) {
    // Impossible to tell which extension was used, so don't require
    // the property
    required = false;
  } else if (isLegacyExtension) {
    required = defined(property.optional) ? !property.optional : true;
  } else {
    required = property.required ?? false;
  }

  return new MetadataClassProperty({
    id: id,
    type: parsedType.type,
    componentType: parsedType.componentType,
    enumType: parsedType.enumType,
    isArray: parsedType.isArray,
    isVariableLengthArray: parsedType.isVariableLengthArray,
    arrayLength: parsedType.arrayLength,
    normalized: property.normalized,
    min: property.min,
    max: property.max,
    offset: property.offset,
    scale: property.scale,
    noData: property.noData,
    default: property.default,
    required: required,
    name: property.name,
    description: property.description,
    semantic: property.semantic,
    extras: property.extras,
    extensions: property.extensions,
    isLegacyExtension: isLegacyExtension,
  });
};

Object.defineProperties(MetadataClassProperty.prototype, {
  /**
   * 属性的 ID。
   *
   * @memberof MetadataClassProperty.prototype
   * @type {string}
   * @readonly
   */
  id: {
    get: function () {
      return this._id;
    },
  },

  /**
   * 属性的名称。
   *
   * @memberof MetadataClassProperty.prototype
   * @type {string}
   * @readonly
   */
  name: {
    get: function () {
      return this._name;
    },
  },

  /**
   * 属性的描述。
   *
   * @memberof MetadataClassProperty.prototype
   * @type {string}
   * @readonly
   */
  description: {
    get: function () {
      return this._description;
    },
  },

  /**
   * 属性的类型，例如 SCALAR、VEC2、VEC3。
   *
   * @memberof MetadataClassProperty.prototype
   * @type {MetadataType}
   * @readonly
   */
  type: {
    get: function () {
      return this._type;
    },
  },

  /**
   * 属性的枚举类型。仅在类型为 ENUM 时定义。
   *
   * @memberof MetadataClassProperty.prototype
   * @type {MetadataEnum}
   * @readonly
   */
  enumType: {
    get: function () {
      return this._enumType;
    },
  },

  /**
   * 属性的组件类型。包括整数
   * （例如 INT8 或 UINT16），以及浮点值（FLOAT32 和 FLOAT64）
   *
   * @memberof MetadataClassProperty.prototype
   * @type {MetadataComponentType}
   * @readonly
   */
  componentType: {
    get: function () {
      return this._componentType;
    },
  },

  /**
   * 用于存储属性各组件的数据类型。这通常与 componentType 相同，除了 ENUM 类型，此时返回的是整数类型
   * 如果属性是数组（固定长度或可变长度），则为真；否则为假
   * 如果属性是可变长度数组，则为真；否则为假
   *
   * @memberof MetadataClassProperty.prototype
   * @type {MetadataComponentType}
   * @readonly
   * @private
   */
  valueType: {
    get: function () {
      return this._valueType;
    },
  },

  /**
   * 数组元素的数量。仅适用于固定大小的数组
   * 属性是否经过归一化
   *
   * @memberof MetadataClassProperty.prototype
   * @type {boolean}
   * @readonly
   */
  isArray: {
    get: function () {
      return this._isArray;
    },
  },

  /**
   * 存储该属性最大允许值的数字或数字数组。仅在类型为数字类型时定义
   *
   * @memberof MetadataClassProperty.prototype
   * @type {boolean}
   * @readonly
   */
  isVariableLengthArray: {
    get: function () {
      return this._isVariableLengthArray;
    },
  },

  /**
   * 存储该属性最小允许值的数字或数字数组。仅在类型为数字类型时定义
   * 表示空值的无数据哨兵值
   *
   * @memberof MetadataClassProperty.prototype
   * @type {number}
   * @readonly
   */
  arrayLength: {
    get: function () {
      return this._arrayLength;
    },
  },

  /**
   * 当实体属性值未定义时使用的默认值
   *
   * @memberof MetadataClassProperty.prototype
   * @type {boolean}
   * @readonly
   */
  normalized: {
    get: function () {
      return this._normalized;
    },
  },

  /**
   * 存储该属性最大允许值的数字或数字数组。仅在类型为数字类型时定义
   *
   * @memberof MetadataClassProperty.prototype
   * @type {number|number[]|number[][]}
   * @readonly
   */
  max: {
    get: function () {
      return this._max;
    },
  },

  /**
   * 存储该属性最小允许值的数字或数字数组。仅在类型为数字类型时定义
   *
   * @memberof MetadataClassProperty.prototype
   * @type {number|number[]|number[][]}
   * @readonly
   */
  min: {
    get: function () {
      return this._min;
    },
  },

  /**
   * 表示空值的无数据哨兵值
   *
   * @memberof MetadataClassProperty.prototype
   * @type {number|string|Array}
   * @readonly
   */
  noData: {
    get: function () {
      return this._noData;
    },
  },

  /**
   * 当实体属性值未定义时使用的默认值
   *
   * @memberof MetadataClassProperty.prototype
   * @type {number|string|Array}
   * @readonly
   */
  default: {
    get: function () {
      return this._default;
    },
  },

  /**
   * 属性是否必填
   *
   * @memberof MetadataClassProperty.prototype
   * @type {boolean}
   * @readonly
   */
  required: {
    get: function () {
      return this._required;
    },
  },

  /**
   * 描述该属性应如何解释的标识符
   *
   * @memberof MetadataClassProperty.prototype
   * @type {string}
   * @readonly
   */
  semantic: {
    get: function () {
      return this._semantic;
    },
  },

  /**
   * 如果应应用偏移/缩放，则为真；如果偏移/缩放均未定义，则默认为 identity，因此该属性设为假
   * 作为值变换的一部分，需添加到属性值中的偏移量
   *
   * @memberof MetadataClassProperty.prototype
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
   * 始终定义的参数，即使 `hasValueTransform` 为 `false`。如果
   *
   * 类属性 JSON 本身未定义该参数，则将其初始化为默认值
   * 作为值变换的一部分，需乘以到属性值的缩放比例
   * 始终定义的参数，即使 `hasValueTransform` 为 `false`。如果
   *
   * @memberof MetadataClassProperty.prototype
   * @type {number|number[]|number[][]}
   * @readonly
   */
  offset: {
    get: function () {
      return this._offset;
    },
  },

  /**
   * 类属性 JSON 本身未定义该参数，则将其初始化为默认值
   *
   * 额外的用户自定义属性
   * 包含扩展的对象
   * 归一化整数属性值。如果属性未归一化
   *
   * @memberof MetadataClassProperty.prototype
   * @type {number|number[]|number[][]}
   * @readonly
   */
  scale: {
    get: function () {
      return this._scale;
    },
  },

  /**
   * 则返回值保持不变
   *
   * @memberof MetadataClassProperty.prototype
   * @type {*}
   * @readonly
   */
  extras: {
    get: function () {
      return this._extras;
    },
  },

  /**
   * 根据 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata#normalized-values|3D 元数据规范}，
   *
   * @memberof MetadataClassProperty.prototype
   * @type {object}
   * @readonly
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },
});

function isLegacy(property) {
  if (property.type === "ARRAY") {
    return true;
  }

  // New property types in EXT_structural_metadata
  const type = property.type;
  if (
    type === MetadataType.SCALAR ||
    MetadataType.isMatrixType(type) ||
    MetadataType.isVectorType(type)
  ) {
    return false;
  }

  // EXT_feature_metadata allowed numeric types as a type. Now they are
  // represented as {type: SINGLE, componentType: type}
  if (defined(MetadataComponentType[type])) {
    return true;
  }

  // New properties in EXT_structural_metadata
  if (
    defined(property.noData) ||
    defined(property.scale) ||
    defined(property.offset) ||
    defined(property.required) ||
    defined(property.count) ||
    defined(property.array)
  ) {
    return false;
  }

  // Properties that only exist in EXT_feature_metadata
  if (defined(property.optional)) {
    return false;
  }

  // impossible to tell, give up.
  return undefined;
}

function parseType(property, enums) {
  const type = property.type;
  const componentType = property.componentType;

  // EXT_feature_metadata had an ARRAY type. This is now handled
  // with array + count, so some details need to be transcoded
  const isLegacyArray = type === "ARRAY";
  let isArray;
  let arrayLength;
  let isVariableLengthArray;
  if (isLegacyArray) {
    // definitely EXT_feature_metadata
    isArray = true;
    arrayLength = property.componentCount;
    isVariableLengthArray = !defined(arrayLength);
  } else if (property.array) {
    isArray = true;
    arrayLength = property.count;
    isVariableLengthArray = !defined(property.count);
  } else {
    // Could be either extension. Some cases are impossible to distinguish
    // Default to a single value
    isArray = false;
    arrayLength = undefined;
    isVariableLengthArray = false;
  }

  let enumType;
  if (defined(property.enumType)) {
    enumType = enums[property.enumType];
  }

  // In both EXT_feature_metadata and EXT_structural_metadata, ENUM appears
  // as a type.
  if (type === MetadataType.ENUM) {
    return {
      type: type,
      componentType: undefined,
      enumType: enumType,
      valueType: enumType.valueType,
      isArray: isArray,
      isVariableLengthArray: isVariableLengthArray,
      arrayLength: arrayLength,
    };
  }

  // In EXT_feature_metadata, ENUM also appears as an ARRAY componentType
  if (isLegacyArray && componentType === MetadataType.ENUM) {
    return {
      type: componentType,
      componentType: undefined,
      enumType: enumType,
      valueType: enumType.valueType,
      isArray: isArray,
      isVariableLengthArray: isVariableLengthArray,
      arrayLength: arrayLength,
    };
  }

  // EXT_structural_metadata only: SCALAR, VECN and MATN
  if (
    type === MetadataType.SCALAR ||
    MetadataType.isMatrixType(type) ||
    MetadataType.isVectorType(type)
  ) {
    return {
      type: type,
      componentType: componentType,
      enumType: undefined,
      valueType: componentType,
      isArray: isArray,
      isVariableLengthArray: isVariableLengthArray,
      arrayLength: arrayLength,
    };
  }

  // In both EXT_structural_metadata and EXT_feature_metadata,
  // BOOLEAN and STRING appear as types
  if (type === MetadataType.BOOLEAN || type === MetadataType.STRING) {
    return {
      type: type,
      componentType: undefined,
      enumType: undefined,
      valueType: undefined,
      isArray: isArray,
      isVariableLengthArray: isVariableLengthArray,
      arrayLength: arrayLength,
    };
  }

  // EXT_feature_metadata also allows BOOLEAN and STRING as an ARRAY
  // componentType
  if (
    isLegacyArray &&
    (componentType === MetadataType.BOOLEAN ||
      componentType === MetadataType.STRING)
  ) {
    return {
      type: componentType,
      componentType: undefined,
      enumType: undefined,
      valueType: undefined,
      isArray: isArray,
      isVariableLengthArray: isVariableLengthArray,
      arrayLength: arrayLength,
    };
  }

  // Both EXT_feature_metadata and EXT_structural_metadata allow numeric types like
  // INT32 or FLOAT64 as a componentType.
  if (defined(componentType) && defined(MetadataComponentType[componentType])) {
    return {
      type: MetadataType.SCALAR,
      componentType: componentType,
      enumType: undefined,
      valueType: componentType,
      isArray: isArray,
      isVariableLengthArray: isVariableLengthArray,
      arrayLength: arrayLength,
    };
  }

  // EXT_feature_metadata: integer and float types were allowed as types,
  // but now these are expressed as {type: SCALAR, componentType: type}
  if (defined(MetadataComponentType[type])) {
    return {
      type: MetadataType.SCALAR,
      componentType: type,
      enumType: undefined,
      valueType: type,
      isArray: isArray,
      isVariableLengthArray: isVariableLengthArray,
      arrayLength: arrayLength,
    };
  }

  //>>includeStart('debug', pragmas.debug);
  throw new DeveloperError(
    `unknown metadata type {type: ${type}, componentType: ${componentType})`,
  );
  //>>includeEnd('debug');
}

/**
 * 归一化和反归一化几乎是互为逆运算，但不完全如此。特别是，
 * 最小的有符号整数值在归一化和反归一化后会相差一。
 * <p>
 * Given the way normalization is defined in {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata#normalized-values|the 3D Metadata Specification},
 * {@link https://www.desmos.com/calculator/nledg1evut|此 Desmos 图表}
 * 以 INT8 为例。
 * unnormalizing. See
 * {@link https://www.desmos.com/calculator/nledg1evut|this Desmos graph} for
 * an example using INT8.
 * </p>
 * <p>
 * 此外，对于 64 位整数类型，由于转换为 Number 格式，可能会损失精度。
 * 由于转换过程导致。
 * </p>
 *
 * @param {*} value 整数值或整数值数组。
 * @returns {*} The 归一化后的值或归一化后的值数组。
 *
 * @private
 */
MetadataClassProperty.prototype.normalize = function (value) {
  if (!this._normalized) {
    return value;
  }

  return normalizeInPlace(
    value,
    this._valueType,
    MetadataComponentType.normalize,
  );
};

/**
 * 不进行归一化操作，直接返回整数属性值。如果属性未进行归一化，
 * 则保持原样返回。
 * <p>
 * Given the way normalization is defined in {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata#normalized-values|the 3D Metadata Specification},
 * “归一化”和“去归一化”几乎是互为逆操作，但并非完全如此。特别是，
 * 最小的有符号整数值在归一化后会偏差一个，
 * 在去归一化后也会如此。参见
 * {@link https://www.desmos.com/calculator/nledg1evut|this Desmos graph} for
 * 以 INT8 为例。
 * </p>
 * <p>
 * 此外，对于 64 位整数类型，由于转换为 Number 格式，可能会损失精度。
 * 由于转换过程导致。
 * </p>
 *
 * @param {*} value 归一化后的值或归一化后的值数组。
 * @returns {*} The 整数值或整数值数组。
 *
 * @private
 */
MetadataClassProperty.prototype.unnormalize = function (value) {
  if (!this._normalized) {
    return value;
  }

  return normalizeInPlace(
    value,
    this._valueType,
    MetadataComponentType.unnormalize,
  );
};

/**
 * @private
 */
MetadataClassProperty.prototype.applyValueTransform = function (value) {
  // variable length arrays do not have a well-defined offset/scale so this
  // is forbidden by the spec
  if (!this._hasValueTransform || this._isVariableLengthArray) {
    return value;
  }

  return MetadataClassProperty.valueTransformInPlace(
    value,
    this._offset,
    this._scale,
    MetadataComponentType.applyValueTransform,
  );
};

/**
 * @private
 */
MetadataClassProperty.prototype.unapplyValueTransform = function (value) {
  // variable length arrays do not have a well-defined offset/scale so this
  // is forbidden by the spec
  if (!this._hasValueTransform || this._isVariableLengthArray) {
    return value;
  }

  return MetadataClassProperty.valueTransformInPlace(
    value,
    this._offset,
    this._scale,
    MetadataComponentType.unapplyValueTransform,
  );
};

/**
 * @private
 */
MetadataClassProperty.prototype.expandConstant = function (
  constant,
  enableNestedArrays,
) {
  enableNestedArrays = enableNestedArrays ?? false;
  const isArray = this._isArray;
  const arrayLength = this._arrayLength;
  const componentCount = MetadataType.getComponentCount(this._type);
  const isNested = isArray && componentCount > 1;

  // scalar values can be returned directly
  if (!isArray && componentCount === 1) {
    return constant;
  }

  // vector and matrix values
  if (!isArray) {
    return new Array(componentCount).fill(constant);
  }

  // arrays of scalars
  if (!isNested) {
    return new Array(arrayLength).fill(constant);
  }

  // arrays of vectors/matrices: flattened
  if (!enableNestedArrays) {
    return new Array(this._arrayLength * componentCount).fill(constant);
  }

  // array of vectors/matrices: nested
  const innerConstant = new Array(componentCount).fill(constant);
  // This array fill duplicates the pointer to the inner arrays. Since this is
  // intended for use with constants, no need to clone the array.
  return new Array(this._arrayLength).fill(innerConstant);
};

/**
 * 如果值为 noData 哨兵值，则返回 undefined。否则，返回
 * 该值。
 * @param {*} value 原始值。
 * @returns {*} Either 该值，或者如果值为 noData 则返回 undefined。
 *
 * @private
 */
MetadataClassProperty.prototype.handleNoData = function (value) {
  const sentinel = this._noData;
  if (!defined(sentinel)) {
    return value;
  }

  if (arrayEquals(value, sentinel)) {
    return undefined;
  }

  return value;
};

function arrayEquals(left, right) {
  if (!Array.isArray(left)) {
    return left === right;
  }

  if (!Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i++) {
    if (!arrayEquals(left[i], right[i])) {
      return false;
    }
  }

  return true;
}

/**
 * 将 VECN 值打包为 {@link Cartesian2}、{@link Cartesian3} 或
 * {@link Cartesian4}，并将 MATN 值打包为 {@link Matrix2}、{@link Matrix3} 或
 * {@link Matrix4}，具体取决于 N 的值。所有其他值（包括其他大小的数组）
 * 均保持原样通过。
 *
 * @param {*} value 原始归一化后的值。
 * @param {boolean} [enableNestedArrays=false] 如果为 true，向量数组将表示为嵌套数组。此方式用于 JSON 编码，但不用于二进制编码。
 * @returns {*} The 如果值为向量或矩阵类型，则使用相应的向量或矩阵类型。如果属性是向量或矩阵数组，则返回相应类型的向量或矩阵数组。否则，保持原样返回。
 * @private
 */
MetadataClassProperty.prototype.unpackVectorAndMatrixTypes = function (
  value,
  enableNestedArrays,
) {
  enableNestedArrays = enableNestedArrays ?? false;
  const MathType = MetadataType.getMathType(this._type);
  const isArray = this._isArray;
  const componentCount = MetadataType.getComponentCount(this._type);
  const isNested = isArray && componentCount > 1;

  if (!defined(MathType)) {
    return value;
  }

  if (enableNestedArrays && isNested) {
    return value.map(function (x) {
      return MathType.unpack(x);
    });
  }

  if (isArray) {
    return MathType.unpackArray(value);
  }

  return MathType.unpack(value);
};

/**
 * 如果此属性为 <code>VECN</code>，则将 {@link Cartesian2}、{@link Cartesian3} 或 {@link Cartesian4} 打包为
 * 数组。
 * 如果此属性为 <code>MATN</code>，则将 {@link Matrix2}、{@link Matrix3} 或 {@link Matrix4} 打包为
 * 数组。
 * 所有其他值（包括其他大小的数组）均保持原样通过。
 *
 * @param {*} value 此属性的值。
 * @param {boolean} [enableNestedArrays=false] 如果为 true，向量数组将表示为嵌套数组。此方式用于 JSON 编码，但不用于二进制编码。
 * @returns {*} An 如果属性为向量或矩阵类型，则返回相应长度的数组。否则，保持原样返回。
 * @private
 */
MetadataClassProperty.prototype.packVectorAndMatrixTypes = function (
  value,
  enableNestedArrays,
) {
  enableNestedArrays = enableNestedArrays ?? false;
  const MathType = MetadataType.getMathType(this._type);
  const isArray = this._isArray;
  const componentCount = MetadataType.getComponentCount(this._type);
  const isNested = isArray && componentCount > 1;

  if (!defined(MathType)) {
    return value;
  }

  if (enableNestedArrays && isNested) {
    return value.map(function (x) {
      return MathType.pack(x, []);
    });
  }

  if (isArray) {
    return MathType.packArray(value, []);
  }

  return MathType.pack(value, []);
};

/**
 * 验证给定值是否符合该属性要求。
 *
 * @param {*} value 值本身。
 * @returns {string|undefined} An 如果值不符合属性要求，则显示错误信息，否则为 undefined。
 * @private
 */
MetadataClassProperty.prototype.validate = function (value) {
  if (!defined(value) && defined(this._default)) {
    // no value, but we have a default to use.
    return undefined;
  }

  if (this._required && !defined(value)) {
    return `required property must have a value`;
  }

  if (this._isArray) {
    return validateArray(this, value);
  }

  return validateSingleValue(this, value);
};

function validateArray(classProperty, value) {
  if (!Array.isArray(value)) {
    return `value ${value} must be an array`;
  }

  const length = value.length;
  if (
    !classProperty._isVariableLengthArray &&
    length !== classProperty._arrayLength
  ) {
    return "Array length does not match property.arrayLength";
  }

  for (let i = 0; i < length; i++) {
    const message = validateSingleValue(classProperty, value[i]);
    if (defined(message)) {
      return message;
    }
  }
}

function validateSingleValue(classProperty, value) {
  const type = classProperty._type;
  const componentType = classProperty._componentType;
  const enumType = classProperty._enumType;
  const normalized = classProperty._normalized;

  if (MetadataType.isVectorType(type)) {
    return validateVector(value, type, componentType);
  } else if (MetadataType.isMatrixType(type)) {
    return validateMatrix(value, type, componentType);
  } else if (type === MetadataType.STRING) {
    return validateString(value);
  } else if (type === MetadataType.BOOLEAN) {
    return validateBoolean(value);
  } else if (type === MetadataType.ENUM) {
    return validateEnum(value, enumType);
  }

  return validateScalar(value, componentType, normalized);
}

function validateVector(value, type, componentType) {
  if (!MetadataComponentType.isVectorCompatible(componentType)) {
    return `componentType ${componentType} is incompatible with vector type ${type}`;
  }

  if (type === MetadataType.VEC2 && !(value instanceof Cartesian2)) {
    return `vector value ${value} must be a Cartesian2`;
  }

  if (type === MetadataType.VEC3 && !(value instanceof Cartesian3)) {
    return `vector value ${value} must be a Cartesian3`;
  }

  if (type === MetadataType.VEC4 && !(value instanceof Cartesian4)) {
    return `vector value ${value} must be a Cartesian4`;
  }
}

function validateMatrix(value, type, componentType) {
  if (!MetadataComponentType.isVectorCompatible(componentType)) {
    return `componentType ${componentType} is incompatible with matrix type ${type}`;
  }

  if (type === MetadataType.MAT2 && !(value instanceof Matrix2)) {
    return `matrix value ${value} must be a Matrix2`;
  }

  if (type === MetadataType.MAT3 && !(value instanceof Matrix3)) {
    return `matrix value ${value} must be a Matrix3`;
  }

  if (type === MetadataType.MAT4 && !(value instanceof Matrix4)) {
    return `matrix value ${value} must be a Matrix4`;
  }
}

function validateString(value) {
  if (typeof value !== "string") {
    return getTypeErrorMessage(value, MetadataType.STRING);
  }
}

function validateBoolean(value) {
  if (typeof value !== "boolean") {
    return getTypeErrorMessage(value, MetadataType.BOOLEAN);
  }
}

function validateEnum(value, enumType) {
  const javascriptType = typeof value;
  if (defined(enumType)) {
    if (javascriptType !== "string" || !defined(enumType.valuesByName[value])) {
      return `value ${value} is not a valid enum name for ${enumType.id}`;
    }
    return;
  }
}

function validateScalar(value, componentType, normalized) {
  const javascriptType = typeof value;

  switch (componentType) {
    case MetadataComponentType.INT8:
    case MetadataComponentType.UINT8:
    case MetadataComponentType.INT16:
    case MetadataComponentType.UINT16:
    case MetadataComponentType.INT32:
    case MetadataComponentType.UINT32:
    case MetadataComponentType.FLOAT32:
    case MetadataComponentType.FLOAT64:
      if (javascriptType !== "number") {
        return getTypeErrorMessage(value, componentType);
      }
      if (!isFinite(value)) {
        return getNonFiniteErrorMessage(value, componentType);
      }
      return checkInRange(value, componentType, normalized);
    case MetadataComponentType.INT64:
    case MetadataComponentType.UINT64:
      if (javascriptType !== "number" && javascriptType !== "bigint") {
        return getTypeErrorMessage(value, componentType);
      }
      if (javascriptType === "number" && !isFinite(value)) {
        return getNonFiniteErrorMessage(value, componentType);
      }
      return checkInRange(value, componentType, normalized);
  }
}

function getTypeErrorMessage(value, type) {
  return `value ${value} does not match type ${type}`;
}

function getOutOfRangeErrorMessage(value, type, normalized) {
  let errorMessage = `value ${value} is out of range for type ${type}`;
  if (normalized) {
    errorMessage += " (normalized)";
  }
  return errorMessage;
}

function checkInRange(value, componentType, normalized) {
  if (normalized) {
    const min = MetadataComponentType.isUnsignedIntegerType(componentType)
      ? 0.0
      : -1.0;
    const max = 1.0;
    if (value < min || value > max) {
      return getOutOfRangeErrorMessage(value, componentType, normalized);
    }
    return;
  }

  if (
    value < MetadataComponentType.getMinimum(componentType) ||
    value > MetadataComponentType.getMaximum(componentType)
  ) {
    return getOutOfRangeErrorMessage(value, componentType, normalized);
  }
}

function getNonFiniteErrorMessage(value, type) {
  return `value ${value} of type ${type} must be finite`;
}

function normalizeInPlace(values, valueType, normalizeFunction) {
  if (!Array.isArray(values)) {
    return normalizeFunction(values, valueType);
  }

  for (let i = 0; i < values.length; i++) {
    values[i] = normalizeInPlace(values[i], valueType, normalizeFunction);
  }

  return values;
}

/**
 * 应用以给定偏移量定义的数值变换，并按照给定值进行缩放。
 * 如果给定值不是数组，则直接应用该变换函数。
 *
 * 如果值是数组，则递归调用此函数，对数组元素逐一应用变换函数。
 * 将变换函数应用于最内层的数组元素。
 *
 * 如果值是数组，则递归调用此函数。
 * 对数组元素逐一应用变换函数。
 * 将变换函数应用于最内层的数组元素。
 *
 * @param {number|number[]|number[][]} values 输入值。
 * @param {number|number[]|number[][]} offsets 偏移量。
 * @param {number|number[]|number[][]} scales 缩放比例。
 * @param {Function} transformationFunction 具有以下签名的函数：
 * `(value:number, offset:number, scale:number) : number`，该函数将应用于最内层元素。
 * 应用于最内层元素。
 * @returns The 输入值（或应用变换函数后的结果）。
 * 如果值不是数组，则将该值转换为单一值。
 * @private
 */
MetadataClassProperty.valueTransformInPlace = function (
  values,
  offsets,
  scales,
  transformationFunction,
) {
  if (!Array.isArray(values)) {
    // transform a single value
    return transformationFunction(values, offsets, scales);
  }

  for (let i = 0; i < values.length; i++) {
    // offsets and scales must be the same array shape as values.
    values[i] = MetadataClassProperty.valueTransformInPlace(
      values[i],
      offsets[i],
      scales[i],
      transformationFunction,
    );
  }

  return values;
};

/**
 * 确定存储在 CPU 上的单个属性元素的字节大小。
 * 例如，如果元数据类型为 VEC3，组件类型为 FLOAT32，则返回 12 字节。
 *
 * @returns {number} The 单个属性元素的字节大小。
 *
 * @private
 */
MetadataClassProperty.prototype.cpuBytesPerElement = function () {
  return bytesPerElement(this, this.valueType);
};

/**
 * 确定存储在 GPU 上的单个属性元素的字节大小。
 * 如果元素类型为 64 位类型且可以降位为 32 位类型以进行纹理打包，则这与 CPU 的字节大小不同（仅适用于从属性表创建的纹理）。
 * 存储在 GPU 上的单个属性元素的字节大小。
 *
 * @returns {number} The 确定该属性是否可以存储在纹理中，取决于属性的数据类型和用于存储该属性值的纹理通道数。
 */
MetadataClassProperty.prototype.gpuBytesPerElement = function () {
  const packedType = MetadataComponentType.gpuComponentType(this.valueType);
  return bytesPerElement(this, packedType);
};

function bytesPerElement(classProperty, valueType) {
  const type = classProperty.type;
  const componentCount = MetadataType.getComponentCount(type);
  const arrayLength = classProperty.isArray ? classProperty.arrayLength : 1;
  const bytesPerComponent = MetadataComponentType.getSizeInBytes(valueType);
  return componentCount * arrayLength * bytesPerComponent;
}

/**
 * 将每个属性值打包到多少个纹理通道中。
 * 如果属性可以存储在具有给定数量通道的纹理中，则为真；否则为假。
 *
 * @param {number} channelsLength The number of texture channels to pack each property value into
 * @returns {boolean} true if the property can be stored in a texture with the given number of channels, false otherwise
 *
 * @private
 */
MetadataClassProperty.prototype.isGpuCompatible = function (channelsLength) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(channelsLength) || channelsLength <= 0) {
    throw new DeveloperError("channelsLength must be a positive number.");
  }
  //>>includeEnd('debug');

  const type = this.type;

  if (this.isVariableLengthArray) {
    return false;
  }

  if (type === MetadataType.STRING) {
    return false;
  }

  // For the time being, boolean properties are not considered GPU compatible, because they are
  // packed as bitstreams and the texture-unpacking logic does not currently support this.
  if (type === MetadataType.BOOLEAN) {
    return false;
  }

  // For all other properties, make sure the components fit in the sampled channels.
  // (64-bit types can be downcast to 32-bit types for texture packing. In the future, support for full 64-bit types may be added)
  if (this.gpuBytesPerElement() > channelsLength) {
    return false;
  }

  return true;
};

const floatTypesByComponentCount = [undefined, "float", "vec2", "vec3", "vec4"];

const integerTypesByComponentCount = [
  undefined,
  "int",
  "ivec2",
  "ivec3",
  "ivec4",
];

const unsignedIntegerTypesByComponentCount = [
  undefined,
  "uint",
  "uvec2",
  "uvec3",
  "uvec4",
];

// Map from scalar component type to the GLSL function used to reinterpret from uint bits to the scalar type
const uintBitsToScalarType = {
  [ScalarCategories.FLOAT]: "uintBitsToFloat",
  [ScalarCategories.INTEGER]: "int",
  [ScalarCategories.UNSIGNED_INTEGER]: "",
};

MetadataClassProperty.prototype.getGlslTypeWebGL1 = function () {
  let componentCount = MetadataType.getComponentCount(this.type);
  if (this.isArray) {
    // fixed-sized arrays of length 2-4 UINT8s are represented as vectors as the
    // shader since those are more useful in GLSL.
    componentCount = this.arrayLength;
  }

  // Normalized UINT8 properties are float types in the shader
  if (this.normalized) {
    return floatTypesByComponentCount[componentCount];
  }

  // other UINT8-based properties are represented as integer types.
  return integerTypesByComponentCount[componentCount];
};

MetadataClassProperty.prototype.getGlslType = function () {
  const valueType = this.valueType;

  let componentCount = MetadataType.getComponentCount(this.type);
  const arrayLength = this.isArray ? this.arrayLength : 1;
  componentCount *= arrayLength;

  // Normalized fields are integers represented as float types ([0, 1] or [-1, 1] depending if signed)
  if (!MetadataComponentType.isIntegerType(valueType) || this.normalized) {
    return floatTypesByComponentCount[componentCount];
  }

  if (MetadataComponentType.isUnsignedIntegerType(valueType)) {
    return unsignedIntegerTypesByComponentCount[componentCount];
  }

  return integerTypesByComponentCount[componentCount];
};

MetadataClassProperty.prototype.unpackTextureInShader = function (
  sampledTextureExpression,
  channelsString,
  metadataVariableName,
  shaderLines,
) {
  const glslType = this.getGlslType();
  const valueType = MetadataComponentType.gpuComponentType(this.valueType);
  const numChannels = channelsString.length;
  const type = this.type;

  // Calculate total number of components
  // (e.g. a length-2 fixed-sized array of VEC2 has 4 components - isGpuCompatible checks this fits in the channels)
  const componentCount =
    MetadataType.getComponentCount(type) *
    (this.isArray ? this.arrayLength : 1);
  const channelsPerComponent = Math.floor(numChannels / componentCount);

  const rawChannelsName = `${metadataVariableName}_rawChannels`;
  const rawBitsName = `${metadataVariableName}_rawBits`;
  const unpackedValueName = `${metadataVariableName}_unpackedValue`;

  const declareUnpackedValueLine = `${glslType} ${unpackedValueName};`;
  const declareRawBitsLine = `uint ${rawBitsName};`;
  shaderLines.push(declareUnpackedValueLine);
  shaderLines.push(declareRawBitsLine);

  // Sample all (specified) channels of the texture
  const assignRawValuesLine = `${floatTypesByComponentCount[numChannels]} ${rawChannelsName} = ${sampledTextureExpression};`;
  shaderLines.push(assignRawValuesLine);

  const castFunction =
    uintBitsToScalarType[MetadataComponentType.category(valueType)];
  const hasMultipleComponents = componentCount > 1;

  // Unpack each component of the output property from the raw channel values
  // E.g. if the output type is a vec2, and 4 channels are given, unpack x from `rg` and y from `ba`
  for (let i = 0; i < componentCount; i++) {
    const channelSlice = "rgba".slice(
      i * channelsPerComponent,
      (i + 1) * channelsPerComponent,
    );
    const subChannels = numChannels > 1 ? `.${channelSlice}` : "";
    const assignRawBitsLine = `${rawBitsName} = czm_unpackTexture(${rawChannelsName}${subChannels});`;

    let indexExpression = "";
    if (hasMultipleComponents) {
      indexExpression = `[${i}]`;
    }

    let normalize = "";
    let toFloatIfNormalize = "";
    if (this.normalized) {
      const maxValue = MetadataComponentType.getMaximum(valueType);
      normalize = ` * ${1.0 / Number(maxValue)}`;
      toFloatIfNormalize = "float";
    }

    const assignUnpackedValueLine = `${unpackedValueName}${indexExpression} = ${toFloatIfNormalize}(${castFunction}(${rawBitsName}))${normalize};`;

    shaderLines.push(assignRawBitsLine);
    shaderLines.push(assignUnpackedValueLine);
  }

  return unpackedValueName;
};

// In WebGL 1, we limit property texture support to UINT8 properties.
MetadataClassProperty.prototype.unpackTextureInShaderWebGL1 = function (
  sampledTextureExpression,
) {
  // no unpacking needed if for normalized types
  if (this.normalized) {
    return sampledTextureExpression;
  }

  // integer types are read from the texture as normalized float values.
  // these need to be rescaled to [0, 255] and cast to the appropriate integer
  // type.
  const glslType = this.getGlslTypeWebGL1();
  return `${glslType}(255.0 * ${sampledTextureExpression})`;
};

export default MetadataClassProperty;