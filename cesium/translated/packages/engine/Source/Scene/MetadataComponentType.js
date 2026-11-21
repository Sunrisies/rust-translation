import {
  Check,
  ComponentDatatype,
  DeveloperError,
  Math as CesiumMath,
  defined,
} from "@cesium/core";
import FeatureDetection from "../Core/FeatureDetection.js";

/**
 * 元数据组件类型的枚举。
 *
 * @enum {string}
 * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
const MetadataComponentType = {
  /**
   * 8 位有符号整数
   *
   * @type {string}
   * @constant
   */
  INT8: "INT8",
  /**
   * 8 位无符号整数
   *
   * @type {string}
   * @constant
   */
  UINT8: "UINT8",
  /**
   * 16 位有符号整数
   *
   * @type {string}
   * @constant
   */
  INT16: "INT16",
  /**
   * 16 位无符号整数
   *
   * @type {string}
   * @constant
   */
  UINT16: "UINT16",
  /**
   * 32 位有符号整数
   *
   * @type {string}
   * @constant
   */
  INT32: "INT32",
  /**
   * 32 位无符号整数
   *
   * @type {string}
   * @constant
   */
  UINT32: "UINT32",
  /**
   * 64 位有符号整数
   *
   * @type {string}
   * @constant
   */
  INT64: "INT64",
  /**
   * 64 位有符号整数
   *
   * @type {string}
   * @constant
   */
  UINT64: "UINT64",
  /**
   * 32 位（单精度）浮点数
   *
   * @type {string}
   * @constant
   */
  FLOAT32: "FLOAT32",
  /**
   * 64 位（双精度）浮点数
   *
   * @type {string}
   * @constant
   */
  FLOAT64: "FLOAT64",
};

export const ScalarCategories = {
  INTEGER: "int",
  UNSIGNED_INTEGER: "uint",
  FLOAT: "float",
};

MetadataComponentType.typeInfo = {
  INT8: {
    vectorCompatible: true,
    size: 1,
    maximumValue: 127,
    minimumValue: -128,
    category: ScalarCategories.INTEGER,
  },
  UINT8: {
    vectorCompatible: true,
    size: 1,
    maximumValue: 255,
    minimumValue: 0,
    category: ScalarCategories.UNSIGNED_INTEGER,
  },
  INT16: {
    vectorCompatible: true,
    size: 2,
    maximumValue: 32767,
    minimumValue: -32768,
    category: ScalarCategories.INTEGER,
  },
  UINT16: {
    vectorCompatible: true,
    size: 2,
    maximumValue: 65535,
    minimumValue: 0,
    category: ScalarCategories.UNSIGNED_INTEGER,
  },
  INT32: {
    vectorCompatible: true,
    size: 4,
    maximumValue: 2147483647,
    minimumValue: -2147483648,
    category: ScalarCategories.INTEGER,
  },
  UINT32: {
    vectorCompatible: true,
    size: 4,
    maximumValue: 4294967295,
    minimumValue: 0,
    category: ScalarCategories.UNSIGNED_INTEGER,
  },
  INT64: {
    vectorCompatible: false,
    size: 8,
    maximumValue: BigInt("9223372036854775807"),
    minimumValue: BigInt("-9223372036854775808"),
    category: ScalarCategories.INTEGER,
    downcastFunction: (value) =>
      MetadataComponentType.clampToLimits(value, MetadataComponentType.INT32),
  },
  UINT64: {
    vectorCompatible: false,
    size: 8,
    maximumValue: BigInt("18446744073709551615"),
    minimumValue: BigInt(0),
    category: ScalarCategories.UNSIGNED_INTEGER,
    downcastFunction: (value) =>
      MetadataComponentType.clampToLimits(value, MetadataComponentType.UINT32),
  },
  FLOAT32: {
    vectorCompatible: true,
    size: 4,
    maximumValue: 340282346638528859811704183484516925440.0,
    minimumValue: -340282346638528859811704183484516925440.0,
    category: ScalarCategories.FLOAT,
  },
  FLOAT64: {
    vectorCompatible: true,
    size: 8,
    maximumValue: Number.MAX_VALUE,
    minimumValue: -Number.MAX_VALUE,
    category: ScalarCategories.FLOAT,
    downcastFunction: (value) => Math.fround(value),
  },
};

/**
 * 获取数值类型的最小值。
 * <p>
 * 对于 INT64 和 UINT64 类型，返回 BigInt。
 * </p>
 *
 * @param {MetadataComponentType} type 类型。
 * @returns {number|bigint} The 最小值。
 *
 * @private
 */
MetadataComponentType.getMinimum = function (type) {
  const typeInfo = MetadataComponentType.typeInfo[type];

  //>>includeStart('debug', pragmas.debug);
  if (!defined(typeInfo)) {
    throw new DeveloperError(`Invalid MetadataComponentType: ${type}`);
  }
  //>>includeEnd('debug');

  return typeInfo.minimumValue;
};

/**
 * 获取数值类型的最大值。
 * <p>
 * 对于 INT64 和 UINT64 类型，返回 BigInt。
 * </p>
 *
 * @param {MetadataComponentType} type 类型。
 * @returns {number|bigint} The 最大值。
 *
 * @private
 */
MetadataComponentType.getMaximum = function (type) {
  const typeInfo = MetadataComponentType.typeInfo[type];

  //>>includeStart('debug', pragmas.debug);
  if (!defined(typeInfo)) {
    throw new DeveloperError(`Invalid MetadataComponentType: ${type}`);
  }
  //>>includeEnd('debug');

  return typeInfo.maximumValue;
};

/**
 * 返回该类型是否为整数类型。
 *
 * @param {MetadataComponentType} type 类型。
 * @returns {boolean} Whether 该类型为整数类型。
 *
 * @private
 */
MetadataComponentType.isIntegerType = function (type) {
  const typeInfo = MetadataComponentType.typeInfo[type];
  //>>includeStart('debug', pragmas.debug);
  if (!defined(typeInfo)) {
    throw new DeveloperError(`Invalid MetadataComponentType: ${type}`);
  }
  //>>includeEnd('debug');

  return typeInfo.category !== ScalarCategories.FLOAT;
};

/**
 * 返回该类型是否为无符号整数类型。
 *
 * @param {MetadataComponentType} type 类型。
 * @returns {boolean} Whether 该类型为无符号整数类型。
 *
 * @private
 */
MetadataComponentType.isUnsignedIntegerType = function (type) {
  const typeInfo = MetadataComponentType.typeInfo[type];
  //>>includeStart('debug', pragmas.debug);
  if (!defined(typeInfo)) {
    throw new DeveloperError(`Invalid MetadataComponentType: ${type}`);
  }
  //>>includeEnd('debug');

  return typeInfo.category === ScalarCategories.UNSIGNED_INTEGER;
};

/**
 * 返回该类型是否可用于向量中，即 {@link Cartesian2}、
 * {@link Cartesian3} 或 {@link Cartesian4} 类。这包括所有数值类型，
 * 除了需要 64 位整数的类型。
 * @param {MetadataComponentType} type 要检查的类型。
 * @return {boolean} <code>true</code> 如果该类型可以编码为向量类型，否则返回 <code>false</code>。
 * @private
 */
MetadataComponentType.isVectorCompatible = function (type) {
  const typeInfo = MetadataComponentType.typeInfo[type];

  //>>includeStart('debug', pragmas.debug);
  if (!defined(typeInfo)) {
    throw new DeveloperError(`Invalid MetadataComponentType: ${type}`);
  }
  //>>includeEnd('debug');

  return typeInfo.vectorCompatible;
};

/**
 * 获取数值类型的类别（有符号整数、无符号整数或浮点数）。
 * @param {MetadataComponentType} type 类型。
 * @returns {ScalarCategories} The 类别。
 */
MetadataComponentType.category = function (type) {
  const typeInfo = MetadataComponentType.typeInfo[type];
  //>>includeStart('debug', pragmas.debug);
  if (!defined(typeInfo)) {
    throw new DeveloperError(`Invalid MetadataComponentType: ${type}`);
  }
  //>>includeEnd('debug');

  return typeInfo.category;
};

/**
 * 获取在 GPU 上表示的组件类型（考虑下转型）。
 * 这与获取整个元数据属性的 glsl 变量类型不同。这仅针对组件。
 * @param {MetadataComponentType} type 组件类型。
 * @returns {MetadataComponentType} The GPU 组件类型。
 */
MetadataComponentType.gpuComponentType = function (type) {
  switch (type) {
    case MetadataComponentType.INT64:
      return "INT32";
    case MetadataComponentType.UINT64:
      return "UINT32";
    case MetadataComponentType.FLOAT64:
      return "FLOAT32";
    default:
      return type;
  }
};

/**
 * 将有符号整数归一化为 [-1.0, 1.0] 范围，并将无符号整数归一化为
 * [0.0, 1.0] 范围。
 * <p>
 * 对于 INT64 和 UINT64 类型，值可以是 BigInt。在归一化过程中，值被转换为
 * 64 位浮点数，这可能导致
 * 微小的精度差异。
 * </p>
 *
 * @param {number|bigint} value 整数值。
 * @param {MetadataComponentType} type 类型。
 * @returns {number} The 归一化后的值。
 *
 * @exception {DeveloperError} value 必须是数字或 BigInt。
 * @exception {DeveloperError} type 必须是整数类型。
 *
 * @private
 */
MetadataComponentType.normalize = function (value, type) {
  //>>includeStart('debug', pragmas.debug);
  if (typeof value !== "number" && typeof value !== "bigint") {
    throw new DeveloperError("value must be a number or a BigInt");
  }
  if (!MetadataComponentType.isIntegerType(type)) {
    throw new DeveloperError("type must be an integer type");
  }
  //>>includeEnd('debug');

  return Math.max(
    Number(value) / Number(MetadataComponentType.getMaximum(type)),
    -1.0,
  );
};

/**
 * 将范围 [-1.0, 1.0] 内的有符号数归一化为有符号整数，并将
 * 范围 [0.0, 1.0] 内的无符号数归一化为无符号整数。超出范围的数值被限制在该范围内。
 * 如果此平台支持 BigInt，则对于 INT64 和 UINT64 类型返回 BigInt。
 * <p>
 * 归一化后的值。
 * </p>
 *
 * @param {number} value 类型。
 * @param {MetadataComponentType} type 类型。
 * @returns {number|bigint} The 整数值。
 *
 * @exception {DeveloperError} type 必须是整数类型。
 *
 * @private
 */
MetadataComponentType.unnormalize = function (value, type) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("value", value);
  if (!MetadataComponentType.isIntegerType(type)) {
    throw new DeveloperError("type must be an integer type");
  }
  //>>includeEnd('debug');

  const max = MetadataComponentType.getMaximum(type);
  const min = MetadataComponentType.isUnsignedIntegerType(type) ? 0 : -max;

  value = CesiumMath.sign(value) * Math.round(Math.abs(value) * Number(max));

  if (
    (type === MetadataComponentType.INT64 ||
      type === MetadataComponentType.UINT64) &&
    FeatureDetection.supportsBigInt()
  ) {
    value = BigInt(value);
  }

  if (value > max) {
    return max;
  }

  if (value < min) {
    return min;
  }

  return value;
};

/**
 * 对值应用偏移量和缩放比例，即 <code>scale * value + offset</code>。
 *
 * @param {number} value 需要转换的值。
 * @param {number} offset 要添加的偏移量。
 * @param {number} scale 要乘以的缩放比例。
 * @returns {number} The 转换后的值。
 *
 * @private
 */
MetadataComponentType.applyValueTransform = function (value, offset, scale) {
  return scale * value + offset;
};

/**
 * 反转对值应用的偏移量和缩放比例。如果缩放比例为 0，则返回 0。
 *
 * @param {number} value 转换后的值。
 * @param {number} offset 被添加的偏移量。
 * @param {number} scale 被乘以的缩放比例。
 * @returns {number} The 原始值。
 *
 * @private
 */
MetadataComponentType.unapplyValueTransform = function (value, offset, scale) {
  // if the scale is 0, avoid a divide by zero error. The result can be any
  // finite number, so 0.0 will do nicely.
  if (scale === 0) {
    return 0.0;
  }

  return (value - offset) / scale;
};

/**
 * 获取数值类型的大小（以字节为单位）。
 *
 * @param {MetadataComponentType} type 类型。
 * @returns {number} The 大小（以字节为单位）。
 *
 * @private
 */
MetadataComponentType.getSizeInBytes = function (type) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  //>>includeEnd('debug');

  return MetadataComponentType.typeInfo[type].size;
};

/**
 * 将值限制在给定组件类型的最小和最大范围内。
 *
 * @param {number|bigint} value 需要限制的值。
 * @param {MetadataComponentType} type 组件类型。
 * @returns {number} The 被限制的值。
 *
 * @private
 */
MetadataComponentType.clampToLimits = function (value, type) {
  const min = MetadataComponentType.getMinimum(type);
  const max = MetadataComponentType.getMaximum(type);

  if (typeof value === "bigint") {
    const minBigInt = BigInt(min);
    const maxBigInt = BigInt(max);

    if (value < minBigInt) {
      return min;
    }
    if (value > maxBigInt) {
      return max;
    }

    return Number(value);
  }

  return Math.max(min, Math.min(max, value));
};

MetadataComponentType.downcastFunction = function (type) {
  const typeInfo = MetadataComponentType.typeInfo[type];
  //>>includeStart('debug', pragmas.debug);
  if (!defined(typeInfo)) {
    throw new DeveloperError("type must be a valid MetadataComponentType");
  }
  //>>includeEnd('debug');

  const func = typeInfo.downcastFunction;
  if (!defined(func)) {
    return (value) => value;
  }

  return func;
};

/**
 * 从 {@link ComponentDatatype} 获取 {@link MetadataComponentType}。
 *
 * @param {ComponentDatatype} componentDatatype 组件数据类型。
 * @returns {MetadataComponentType} The 类型。
 *
 * @private
 */
MetadataComponentType.fromComponentDatatype = function (componentDatatype) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("componentDatatype", componentDatatype);
  //>>includeEnd('debug');

  switch (componentDatatype) {
    case ComponentDatatype.BYTE:
      return MetadataComponentType.INT8;
    case ComponentDatatype.UNSIGNED_BYTE:
      return MetadataComponentType.UINT8;
    case ComponentDatatype.SHORT:
      return MetadataComponentType.INT16;
    case ComponentDatatype.UNSIGNED_SHORT:
      return MetadataComponentType.UINT16;
    case ComponentDatatype.INT:
      return MetadataComponentType.INT32;
    case ComponentDatatype.UNSIGNED_INT:
      return MetadataComponentType.UINT32;
    case ComponentDatatype.FLOAT:
      return MetadataComponentType.FLOAT32;
    case ComponentDatatype.DOUBLE:
      return MetadataComponentType.FLOAT64;
  }
};

/**
 * 从 {@link MetadataComponentType} 获取 {@link ComponentDatatype}。
 *
 * @param {MetadataComponentType} type 类型。
 * @returns {ComponentDatatype} The 组件数据类型。
 *
 * @private
 */
MetadataComponentType.toComponentDatatype = function (type) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  //>>includeEnd('debug');

  switch (type) {
    case MetadataComponentType.INT8:
      return ComponentDatatype.BYTE;
    case MetadataComponentType.UINT8:
      return ComponentDatatype.UNSIGNED_BYTE;
    case MetadataComponentType.INT16:
      return ComponentDatatype.SHORT;
    case MetadataComponentType.UINT16:
      return ComponentDatatype.UNSIGNED_SHORT;
    case MetadataComponentType.INT32:
      return ComponentDatatype.INT;
    case MetadataComponentType.UINT32:
      return ComponentDatatype.UNSIGNED_INT;
    case MetadataComponentType.FLOAT32:
      return ComponentDatatype.FLOAT;
    case MetadataComponentType.FLOAT64:
      return ComponentDatatype.DOUBLE;
  }
};

/**
 * 获取在 DataView 上获取和设置给定组件类型值的函数。
 *
 * @param {DataView} view DataView。
 * @param {MetadataComponentType} componentType 组件类型。
 * @returns {object} An 包含 getter 和 setter 函数的对象。
 *
 * @private
 */
MetadataComponentType.getDataViewAccessors = function (view, componentType) {
  const accessors = {
    [MetadataComponentType.UINT8]: {
      get: view.getUint8.bind(view),
      set: view.setUint8.bind(view),
    },
    [MetadataComponentType.INT8]: {
      get: view.getInt8.bind(view),
      set: view.setInt8.bind(view),
    },
    [MetadataComponentType.UINT16]: {
      get: (offset) => view.getUint16(offset, true),
      set: (offset, value) => view.setUint16(offset, value, true),
    },
    [MetadataComponentType.INT16]: {
      get: (offset) => view.getInt16(offset, true),
      set: (offset, value) => view.setInt16(offset, value, true),
    },
    [MetadataComponentType.UINT32]: {
      get: (offset) => view.getUint32(offset, true),
      set: (offset, value) => view.setUint32(offset, value, true),
    },
    [MetadataComponentType.INT32]: {
      get: (offset) => view.getInt32(offset, true),
      set: (offset, value) => view.setInt32(offset, value, true),
    },
    [MetadataComponentType.FLOAT32]: {
      get: (offset) => view.getFloat32(offset, true),
      set: (offset, value) => view.setFloat32(offset, value, true),
    },
    [MetadataComponentType.FLOAT64]: {
      get: (offset) => view.getFloat64(offset, true),
      set: (offset, value) => view.setFloat64(offset, value, true),
    },
    [MetadataComponentType.UINT64]: {
      get: (offset) => view.getBigUint64(offset, true),
      set: (offset, value) => view.setBigUint64(offset, BigInt(value), true),
    },
    [MetadataComponentType.INT64]: {
      get: (offset) => view.getBigInt64(offset, true),
      set: (offset, value) => view.setBigInt64(offset, BigInt(value), true),
    },
  };

  return accessors[componentType];
};

Object.freeze(MetadataComponentType);

export default MetadataComponentType;
