import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Matrix2,
  Matrix3,
  Matrix4,
  RuntimeError,
  defined,
} from "@cesium/core";
import MetadataClassProperty from "./MetadataClassProperty.js";
import MetadataComponentType from "./MetadataComponentType.js";
import MetadataType from "./MetadataType.js";

/**
 * 用于元数据选取的实用函数。
 *
 * 这些函数被 `Picking.pickMetadata` 函数使用，以根据
 * 帧缓冲区中读取到的元数据值结构
 * 将其解码为实际的元数据值。
 * 由 `MetadataClassProperty` 定义的结构。
 *
 * @private
 */
const MetadataPicking = {};

/**
 * 返回给定数据视图指定索引处的值，
 * 并解释该数据具有给定的组件类型。
 *
 * @param {MetadataComponentType} componentType `MetadataComponentType`
 * @param {DataView} dataView 数据视图
 * @param {number} index 索引（字节偏移量）
 * @returns {number|bigint|undefined} The 值
 * @throws RuntimeError 如果给定的组件类型无效
 * `MetadataComponentType`
 * @throws RangeError 如果从给定数据视图读取数据会导致
 * 越界访问
 *
 * @private
 */
MetadataPicking.decodeRawMetadataValue = function (
  componentType,
  dataView,
  index,
) {
  switch (componentType) {
    case MetadataComponentType.INT8:
      return dataView.getInt8(index);
    case MetadataComponentType.UINT8:
      return dataView.getUint8(index);
    case MetadataComponentType.INT16:
      return dataView.getInt16(index, true);
    case MetadataComponentType.UINT16:
      return dataView.getUint16(index, true);
    case MetadataComponentType.INT32:
      return dataView.getInt32(index, true);
    case MetadataComponentType.UINT32:
      return dataView.getUint32(index, true);
    case MetadataComponentType.INT64:
      return dataView.getBigInt64(index, true);
    case MetadataComponentType.UINT64:
      return dataView.getBigUint64(index, true);
    case MetadataComponentType.FLOAT32:
      return dataView.getFloat32(index, true);
    case MetadataComponentType.FLOAT64:
      return dataView.getFloat64(index, true);
  }
  throw new RuntimeError(`Invalid component type: ${componentType}`);
};

/**
 * 根据给定的属性类型解码元数据值的一个组件。
 * 从给定数据视图中。
 *
 * 这将解码一个组件（例如，SCALAR 数组中的一个条目，
 * 或 VEC2 元素中的一个组件）。
 *
 * 如果给定的类属性为 'normalized'，则会对原始组件值进行归一化。
 * 类属性
 *
 * @param {MetadataClassProperty} classProperty 包含原始元数据值的数据视图
 * @param {DataView} dataView 数据视图中的字节偏移量
 * @param {number} dataViewOffset 应读取组件的起始位置
 * 在数组类型中，该索引是数组内的索引；对于非数组类型，为 0。
 * @returns {number|bigint|undefined} The 元数据值组件
 * @throws RuntimeError 如果给定属性的组件不是
 * 有效的 `MetadataComponentType`
 * @throws RangeError 如果从给定数据视图读取数据会导致
 * 越界访问
 */
MetadataPicking.decodeRawMetadataValueComponent = function (
  classProperty,
  dataView,
  dataViewOffset,
) {
  const componentType = classProperty.componentType;
  const component = MetadataPicking.decodeRawMetadataValue(
    componentType,
    dataView,
    dataViewOffset,
  );
  if (classProperty.normalized) {
    return MetadataComponentType.normalize(component, componentType);
  }
  return component;
};

/**
 * 根据给定的属性类型解码元数据值的一个元素。
 * 从给定数据视图中。
 *
 * 当给定的类属性为向量或矩阵类型时，结果将是一个数组，其长度与
 * 向量或矩阵组件的数量相对应。
 * 否则，将是一个单一的值。
 *
 * 无论如何，返回值将是“原始”值，该值
 *
 * 考虑了归一化，但不考虑默认/无数据值的处理。
 * 元数据类属性
 * 包含原始元数据值的数据视图
 *
 * @param {MetadataClassProperty} classProperty 元素索引。对于数组类型属性，这是数组内的索引；对于非数组类型，为 0。
 * @param {DataView} dataView 解码后的元数据值元素
 * @param {number} elementIndex 如果给定属性的组件不是
 * 有效的 `MetadataComponentType`
 * @returns {number|number[]|bigint|bigint[]|undefined} The 如果读取数据会导致
 * @throws RuntimeError 越界访问
 * 将给定的原始值解码为元数据属性值的原始（基于数组）形式。
 * @throws RangeError （对于解码为 `CartesianN` 等类型，可以使用 `decodeMetadataValues` 函数）
 * cause an out-of-bounds access
 *
 */
MetadataPicking.decodeRawMetadataValueElement = function (
  classProperty,
  dataView,
  elementIndex,
) {
  const componentType = classProperty.componentType;
  const componentSizeInBytes =
    MetadataComponentType.getSizeInBytes(componentType);
  const type = classProperty.type;
  const componentCount = MetadataType.getComponentCount(type);
  const elementSizeInBytes = componentSizeInBytes * componentCount;
  if (componentCount > 1) {
    const result = Array(componentCount);
    for (let i = 0; i < componentCount; i++) {
      const offset =
        elementIndex * elementSizeInBytes + i * componentSizeInBytes;
      const component = MetadataPicking.decodeRawMetadataValueComponent(
        classProperty,
        dataView,
        offset,
      );
      result[i] = component;
    }
    return result;
  }
  const offset = elementIndex * elementSizeInBytes;
  const result = MetadataPicking.decodeRawMetadataValueComponent(
    classProperty,
    dataView,
    offset,
  );
  return result;
};

/**
 * Decode the given raw values into the raw (array-based) form of
 * a metadata property value.
 *
 * (For decoding to types like `CartesianN`, the `decodeMetadataValues`
 * function can be used)
 *
 * 给定值是一个包含 RGBA 值的 `Uint8Array`。
 * 从元数据拾取中读取的值。
 * 帧缓冲区。假设它们包含以下值：
 * 给定类属性的值，由
 * `MetadataPickingPipelineStage` 用于元数据拾取。
 *
 * 当给定类属性是一个数组时，那么（它必须是一个固定长度的数组），结果将是一个具有相应长度的数组。
 * 当给定类属性是向量或矩阵类型时，
 * 结果将是一个数组，其长度与向量或矩阵组件的数量相对应。
 *
 * （一般元数据
 * 着色器基础设施不支持属性为向量或矩阵元素的数组情况，但此处仍进行处理。对于此类输入，结果将是一个数组的数组，每个元素代表一个向量或矩阵）。
 * 无论如何，返回值将是“原始”值，它
 *
 * 考虑了归一化，但不考虑任何偏移/缩放或默认/无数据值处理。
 * `MetadataClassProperty`
 * 原始值
 * 值
 * 如果类属性具有无效的组件类型，
 *
 * 将给定的类型转换为适当的对象表示形式。
 * 当给定类型为 `SCALAR`、`STRING`、`BOOLEAN` 或 `ENUM` 时，或者
 * 当给定值为 `undefined` 时，则直接返回该值。
 *
 * @param {MetadataClassProperty} classProperty `MetadataClassProperty`
 * @param {Uint8Array} rawPixelValues 原始值
 * @returns {number|bigint|number[]|bigint[]|undefined} The 值
 * @throws RuntimeError 如果类属性具有无效的组件类型，
 *
 * @private
 */
MetadataPicking.decodeRawMetadataValues = function (
  classProperty,
  rawPixelValues,
) {
  const dataView = new DataView(
    rawPixelValues.buffer,
    rawPixelValues.byteOffset,
    rawPixelValues.byteLength,
  );
  if (classProperty.isArray) {
    const arrayLength = classProperty.arrayLength;
    const result = Array(arrayLength);
    for (let i = 0; i < arrayLength; i++) {
      const element = MetadataPicking.decodeRawMetadataValueElement(
        classProperty,
        dataView,
        i,
      );
      result[i] = element;
    }
    return result;
  }
  const result = MetadataPicking.decodeRawMetadataValueElement(
    classProperty,
    dataView,
    0,
  );
  return result;
};

/**
 * 将给定的类型转换为适当的对象表示形式。
 *
 * 当给定类型为 `SCALAR`、`STRING`、`BOOLEAN` 或 `ENUM` 时，或者
 * 当给定值为 `undefined` 时，则直接返回该值。
 * 否则，对于 `VECn/MATn` 类型，给定值被假设为数值数组，并转换为相应的 `CartesianN/MatrixN` 值。
 *
 * `ClassProperty` 类型
 * 输入值
 * 对象表示形式
 *
 * @param {string} type 如果类型不是有效的 `MetadataType`
 * @param {number|bigint|number[]|bigint[]|undefined} value 将给定类型转换为原始值或数组表示形式。
 * @returns {undefined|number|bigint|string|boolean|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4} The 对于 `VECn/MATn` 类型，给定值被转换为数组。
 * @throws RuntimeError 对于其他类型，直接返回该值。
 */
MetadataPicking.convertToObjectType = function (type, value) {
  if (!defined(value)) {
    return value;
  }
  if (
    type === MetadataType.SCALAR ||
    type === MetadataType.STRING ||
    type === MetadataType.BOOLEAN ||
    type === MetadataType.ENUM
  ) {
    return value;
  }
  const numbers = value.map((n) => Number(n));
  switch (type) {
    case MetadataType.VEC2:
      return Cartesian2.unpack(numbers, 0, new Cartesian2());
    case MetadataType.VEC3:
      return Cartesian3.unpack(numbers, 0, new Cartesian3());
    case MetadataType.VEC4:
      return Cartesian4.unpack(numbers, 0, new Cartesian4());
    case MetadataType.MAT2:
      return Matrix2.unpack(numbers, 0, new Matrix2());
    case MetadataType.MAT3:
      return Matrix3.unpack(numbers, 0, new Matrix3());
    case MetadataType.MAT4:
      return Matrix4.unpack(numbers, 0, new Matrix4());
  }
  // Should never happen:
  throw new RuntimeError(`Invalid metadata object type: ${type}`);
};

/**
 * `ClassProperty` 类型
 *
 * 输入值
 * 数组表示形式
 *
 * @param {string} type 如果类型不是有效的 `MetadataType`
 * @param {undefined|number|bigint|string|boolean|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4} value 将给定原始值解码为元数据属性值。
 * @returns {undefined|number|bigint|string|boolean|number[]} The 将偏移/缩放值变换应用于 `decodeRawMetadataValues` 的结果，并将这种基于数组的类型转换为 `CartesianN` 等对象类型。
 * @throws RuntimeError `MetadataClassProperty`
 */
MetadataPicking.convertFromObjectType = function (type, value) {
  if (!defined(value)) {
    return value;
  }
  if (
    type === MetadataType.SCALAR ||
    type === MetadataType.STRING ||
    type === MetadataType.BOOLEAN ||
    type === MetadataType.ENUM
  ) {
    return value;
  }
  switch (type) {
    case MetadataType.VEC2:
      return Cartesian2.pack(value, Array(2));
    case MetadataType.VEC3:
      return Cartesian3.pack(value, Array(3));
    case MetadataType.VEC4:
      return Cartesian4.pack(value, Array(4));
    case MetadataType.MAT2:
      return Matrix2.pack(value, Array(4));
    case MetadataType.MAT3:
      return Matrix3.pack(value, Array(9));
    case MetadataType.MAT4:
      return Matrix4.pack(value, Array(16));
  }
  // Should never happen:
  throw new RuntimeError(`Invalid metadata object type: ${type}`);
};

/**
 * 解码给定的原始值为元数据属性值。
 *
 * 将值变换（偏移/缩放）应用于 `decodeRawMetadataValues` 的结果，并将这种基于数组的类型转换为 `CartesianN` 等对象类型。
 * `PropertyTextureProperty` 或 `PropertyAttributeProperty`
 * 原始值
 *
 * @param {MetadataClassProperty} classProperty The `MetadataClassProperty`
 * @param {object} metadataProperty The
 * `PropertyTextureProperty` or `PropertyAttributeProperty`
 * @param {Uint8Array} rawPixelValues The raw values
 * @returns {MetadataValue} The 值
 * @throws RuntimeError 如果类属性具有无效类型
 * 或组件类型
 * @throws RangeError 如果给定的像素值没有足够的
 * 大小来包含预期的值类型
 *
 * @private
 */
MetadataPicking.decodeMetadataValues = function (
  classProperty,
  metadataProperty,
  rawPixelValues,
) {
  let arrayBasedResult = MetadataPicking.decodeRawMetadataValues(
    classProperty,
    rawPixelValues,
  );

  if (metadataProperty.hasValueTransform) {
    // In the MetadataClassProperty, these offset/scale are always in
    // their array-based form (e.g. a number[3] for `VEC3`). But for
    // the PropertyTextureProperty and PropertyAttributeProperty,
    // the type of the offset/scale is defined to be
    // number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4
    // So these types are converted into their array-based form here, before
    // applying them with `MetadataClassProperty.valueTransformInPlace`

    const offset = MetadataPicking.convertFromObjectType(
      classProperty.type,
      metadataProperty.offset,
    );
    const scale = MetadataPicking.convertFromObjectType(
      classProperty.type,
      metadataProperty.scale,
    );
    arrayBasedResult = MetadataClassProperty.valueTransformInPlace(
      arrayBasedResult,
      offset,
      scale,
      MetadataComponentType.applyValueTransform,
    );
  }

  if (classProperty.isArray) {
    const arrayLength = classProperty.arrayLength;
    const result = Array(arrayLength);
    for (let i = 0; i < arrayLength; i++) {
      const arrayBasedValue = arrayBasedResult[i];
      const objectBasedValue = MetadataPicking.convertToObjectType(
        classProperty.type,
        arrayBasedValue,
      );
      result[i] = objectBasedValue;
    }
    return result;
  }
  const objectResult = MetadataPicking.convertToObjectType(
    classProperty.type,
    arrayBasedResult,
  );
  return objectResult;
};

export default Object.freeze(MetadataPicking);
