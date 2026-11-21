import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Check,
  DeveloperError,
  Matrix2,
  Matrix3,
  Matrix4,
} from "@cesium/core";

/**
 * 元数据值的实例。<br>
 * <br>
 * 此值可以是以下类型之一：
 * <ul>
 * <li>对于类型 <code>SCALAR</code> 和除 <code>INT64</code> 或 <code>UINT64</code> 之外的数值组件类型，使用 <code>number</code> 类型</li>
 * <li>对于类型 <code>SCALAR</code> 和 <code>INT64</code> 或 <code>UINT64</code> 组件类型，使用 <code>bigint</code> 类型</li>
 * <li>对于类型 <code>STRING</code> 或 <code>ENUM</code>，使用 <code>string</code> 类型</li>
 * <li>对于类型 <code>BOOLEAN</code>，使用 <code>boolean</code> 类型</li>
 * <li>对于类型 <code>VEC2</code>，使用 <code>Cartesian2</code> 类型</li>
 * <li>对于类型 <code>VEC3</code>，使用 <code>Cartesian3</code> 类型</li>
 * <li>对于类型 <code>VEC4</code>，使用 <code>Cartesian4</code> 类型</li>
 * <li>对于类型 <code>MAT2</code>，使用 <code>Matrix2</code> 类型</li>
 * <li>对于类型 <code>MAT3</code>，使用 <code>Matrix3</code> 类型</li>
 * <li>对于类型 <code>MAT4</code>，使用 <code>Matrix4</code> 类型</li>
 * <li>当元数据值为数组时，这些类型的数组</li>
 * </ul>
 * @typedef {(number|bigint|string|boolean|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4|number[]|bigint[]|string[]|boolean[]|Cartesian2[]|Cartesian3[]|Cartesian4[]|Matrix2[]|Matrix3[]|Matrix4[])} MetadataValue
 */

/**
 * 元数据类型的枚举。这些元数据类型是包含
 * one or more components of type {@link MetadataComponentType}
 *
 * @enum {string}
 * @experimental This 该特性使用了 3D Tiles 规范中尚未最终定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 */
const MetadataType = {
  /**
   * 单个组件
   *
   * @type {string}
   * @constant
   */
  SCALAR: "SCALAR",
  /**
   * 包含两个组件的向量
   *
   * @type {string}
   * @constant
   */
  VEC2: "VEC2",
  /**
   * 包含三个组件的向量
   *
   * @type {string}
   * @constant
   */
  VEC3: "VEC3",
  /**
   * 包含四个组件的向量
   *
   * @type {string}
   * @constant
   */
  VEC4: "VEC4",
  /**
   * 以列主格式存储的 2x2 矩阵。
   *
   * @type {string}
   * @constant
   */
  MAT2: "MAT2",
  /**
   * 以列主格式存储的 3x3 矩阵。
   *
   * @type {string}
   * @constant
   */
  MAT3: "MAT3",
  /**
   * 以列主格式存储的 4x4 矩阵。
   *
   * @type {string}
   * @constant
   */
  MAT4: "MAT4",
  /**
   * 布尔值（true/false）
   *
   * @type {string}
   * @constant
   */
  BOOLEAN: "BOOLEAN",
  /**
   * UTF-8 编码的字符串值
   *
   * @type {string}
   * @constant
   */
  STRING: "STRING",
  /**
   * An enumerated value. This type is used in conjunction with a {@link MetadataEnum} to describe the valid values.
   *
   * @see MetadataEnum
   *
   * @type {string}
   * @constant
   */
  ENUM: "ENUM",
};

/**
 * 检查类型是否为 VEC2、VEC3 或 VEC4
 *
 * @param {MetadataType} type 类型
 * @return {boolean} <code>true</code> 如果类型为向量，则为 <code>false</code>，否则为 <code>true</code>
 * @private
 */
MetadataType.isVectorType = function (type) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  //>>includeEnd('debug');

  switch (type) {
    case MetadataType.VEC2:
    case MetadataType.VEC3:
    case MetadataType.VEC4:
      return true;
    default:
      return false;
  }
};

/**
 * 检查类型是否为 MAT2、MAT3 或 MAT4
 *
 * @param {MetadataType} type 类型
 * @return {boolean} <code>true</code> 如果类型为矩阵，则为 <code>false</code>，否则为 <code>true</code>
 * @private
 */
MetadataType.isMatrixType = function (type) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  //>>includeEnd('debug');

  switch (type) {
    case MetadataType.MAT2:
    case MetadataType.MAT3:
    case MetadataType.MAT4:
      return true;
    default:
      return false;
  }
};

/**
 * 获取向量或矩阵类型的组件数量。例如：
 * VECN 返回 N，MATN 返回 N*N。其他类型返回 1。
 *
 * @param {MetadataType} type 用于获取组件数量的类型
 * @return {number} The 组件数量
 * @private
 */
MetadataType.getComponentCount = function (type) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("type", type);
  //>>includeEnd('debug');

  switch (type) {
    case MetadataType.SCALAR:
    case MetadataType.STRING:
    case MetadataType.ENUM:
    case MetadataType.BOOLEAN:
      return 1;
    case MetadataType.VEC2:
      return 2;
    case MetadataType.VEC3:
      return 3;
    case MetadataType.VEC4:
      return 4;
    case MetadataType.MAT2:
      return 4;
    case MetadataType.MAT3:
      return 9;
    case MetadataType.MAT4:
      return 16;
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError(`Invalid metadata type ${type}`);
    //>>includeEnd('debug');
  }
};

/**
 * 获取相应的向量或矩阵类。这用于简化
 * 打包和解包代码。
 * @param {MetadataType} type 元数据类型
 * @return {object} The 向量类型对应的 CartesianN 类，矩阵类型对应的 MatrixN 类，否则未定义。
 * @private
 */
MetadataType.getMathType = function (type) {
  switch (type) {
    case MetadataType.VEC2:
      return Cartesian2;
    case MetadataType.VEC3:
      return Cartesian3;
    case MetadataType.VEC4:
      return Cartesian4;
    case MetadataType.MAT2:
      return Matrix2;
    case MetadataType.MAT3:
      return Matrix3;
    case MetadataType.MAT4:
      return Matrix4;
    default:
      return undefined;
  }
};

Object.freeze(MetadataType);

export default MetadataType;