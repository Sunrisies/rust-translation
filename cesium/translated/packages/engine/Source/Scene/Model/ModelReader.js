import {
  AttributeCompression,
  AttributeType,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Check,
  ComponentDatatype,
  DeveloperError,
  FixedFrameTransforms,
  IndexDatatype,
  Matrix4,
  PrimitiveType,
  Quaternion,
  defined,
} from "@cesium/core";
import InstanceAttributeSemantic from "../InstanceAttributeSemantic.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";
import ModelUtility from "./ModelUtility.js";

/**
 * 一个用于从 <code>ModelComponents.Attribute</code> 读取数据的类。
 *
 * 注意：此处的大部分功能已存在于多个地方。
 * 在大多数情况下，这些功能是为“特定情况”而设计的（例如仅处理
 * 位置、或仅处理法线、或不考虑量化、或不处理
 * 交错缓冲区等）。在许多情况下，这些功能是为特定情况而设计的。
 * “访问器”（通常，函数还期望提供 ‘gltf’ 数据）。
 * 此处（以及现有函数中）所做的大部分工作都是相当低级的
 * 且通用性较强：这些函数通常可以接受一些参数（数量、类型、
 * 组件类型），并且可能存在从“访问器”或“属性”获取这些值的便利函数。简而言之：大部分内容
 * 可以变得“更美观”、“更通用”，并在所有维度上“更好”。
 * 只需给我一些时间……
 * 注意：所有这些都必须在 TypedArray 上操作，这很不幸。
 *
 * 后续的大部分处理可以在某种抽象之上进行。TypedArray 可以以“批量”方式读取/写入，
 * 并且提供“尽可能高效”的访问方式，这可能是一种
 * 作为性能与通用性权衡的一部分的合理性理由。
 * 注意：所有这些都没有正确处理 MATn 类型。应该有一些
 * 针对元素和组件级别的数据访问的抽象。请参阅
 *
 * https://github.com/javagl/JglTF/blob/84ce6d019fec3b75b6af1649bbe834005b2c620f/jgltf-model/src/main/java/de/javagl/jgltf/model/AbstractAccessorData.java#L149
 * 将给定属性的数据读入类型化数组。
 * 这将把数据读入一个紧凑的扁平数组，其数据类型与属性数据类型一致。
 *
 * @private
 */
class ModelReader {
  /**
   * 如果属性包含于交错缓冲区中，并被标记为
   *
   * “标准化”、“量化”或“八进制编码”，则会对数据进行解交错处理，
   * 将应用标准化处理，进行去量化和八进制解码
   *
   * 根据需要。
   * 结果将是实际的属性数据。
   * 属性
   * 属性数据
   *
   * 将给定属性的数据读入紧凑的类型化数组。
   *
   * @param {ModelComponents.Attribute} attribute 如果属性以交错数据形式存储，则结果
   * @returns {TypedArray} The 将是解交错后的数据。如果数据被量化或
   */
  static readAttributeAsTypedArray(attribute) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("attribute", attribute);
    //>>includeEnd('debug');

    // Obtain a compact (non-interleaved) typed array that contains
    // the components.
    const compactTypedArray =
      ModelReader.readAttributeAsRawCompactTypedArray(attribute);

    // If the attribute is not normalized and the data is not quantized
    // and not normalized, then this can be returned directly
    const normalized = attribute.normalized;
    const quantization = attribute.quantization;
    if (!defined(quantization) && !normalized) {
      return compactTypedArray;
    }

    const elementType = attribute.type;
    const elementCount = attribute.count;

    // If the attribute is normalized, normalize the data from
    // the typed array
    let normalizedTypedArray = compactTypedArray;
    if (normalized) {
      // Note that although this is called "dequantize", it does
      // not really "dequantize" based on the quantization. It only
      // performs the conversion from the (normalized) integer
      // component types into floating point.
      normalizedTypedArray = AttributeCompression.dequantize(
        compactTypedArray,
        attribute.componentDatatype,
        elementType,
        elementCount,
      );
    }

    if (!defined(quantization)) {
      return normalizedTypedArray;
    }
    // Now, this one actually DOES dequantize...
    const dequantizedTypedArray = ModelReader.dequantize(
      normalizedTypedArray,
      elementCount,
      elementType,
      quantization,
    );
    return dequantizedTypedArray;
  }

  /**
   * 标准化，则最终数据将是“原始”数据。
   *
   * If the attribute is stored as interleaved data, then the result
   * will be the deinterleaved data. If the data is quantized or
   * normalized, then the resulting data will be the "raw" data,
   * 无需应用归一化或去量化操作。
   *
   * @param {ModelComponents.Attribute} attribute 属性
   * @returns {TypedArray} The 原始属性数据
   */
  static readAttributeAsRawCompactTypedArray(attribute) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("attribute", attribute);
    //>>includeEnd('debug');

    const elementType = attribute.type;
    const elementCount = attribute.count;

    const componentsPerElement =
      AttributeType.getNumberOfComponents(elementType);
    const totalComponentCount = elementCount * componentsPerElement;

    // If the data is quantized, use the quantized component type
    let componentType = attribute.componentDatatype;
    const quantization = attribute.quantization;
    if (defined(quantization)) {
      componentType = quantization.componentDatatype;
    }
    const buffer = attribute.buffer;

    // If the byte stride is the default (i.e. the total element size),
    // then just fetch the whole buffer data into a typed array of the
    // desired target type, and return it
    const byteOffset = attribute.byteOffset;
    const byteStride = attribute.byteStride;
    const bytesPerComponent = ComponentDatatype.getSizeInBytes(componentType);
    const defaultByteStride = componentsPerElement * bytesPerComponent;

    const isDefaultStride =
      !defined(byteStride) || byteStride === defaultByteStride;
    const hasTypedArray = defined(attribute.typedArray);

    // If in-memory — return as-is
    // Important: typedArray is already tightly-packed on creation (See: ModelComponents.typedArray and GltfLoader.getPackedTypedArray)
    //            byteOffset and byteStride should thus be ignored
    if (hasTypedArray) {
      return attribute.typedArray;
    }

    // Non-interleaved — copy from typedArray or read from GPU
    if (isDefaultStride) {
      const typedArray = ComponentDatatype.createTypedArray(
        componentType,
        totalComponentCount,
      );
      buffer.getBufferData(typedArray, byteOffset);
      return typedArray;
    }

    // Fetch the whole buffer in its raw form, to pick out the
    // interleaved values.
    // Note: When ALL attributes have to be fetched from an
    // interleaved buffer, then this getBufferData call will
    // be performed multiple times. It would be preferable to
    // have ONE "TypedArray[] getThemFrom(buffer)" call that
    // returns all of the (interleaved) attributes at once,
    // but this requires abstractions that we don't have.

    // Read back from GPU if not available in memory
    const fullTypedArray = new Uint8Array(buffer.sizeInBytes);
    buffer.getBufferData(fullTypedArray);

    // Read the components of each element, and write them into
    // a typed array in a compact form
    const compactTypedArray = ComponentDatatype.createTypedArray(
      componentType,
      totalComponentCount,
    );
    const elementByteStride = byteStride ?? defaultByteStride;
    const dataView = new DataView(
      fullTypedArray.buffer,
      fullTypedArray.byteOffset,
      fullTypedArray.byteLength,
    );
    const components = new Array(componentsPerElement);
    const componentsReader = ModelReader.createComponentsReader(componentType);
    for (let i = 0; i < elementCount; ++i) {
      const elementByteOffset = byteOffset + i * elementByteStride;
      componentsReader(
        dataView,
        elementByteOffset,
        componentsPerElement,
        components,
      );
      for (let j = 0; j < componentsPerElement; ++j) {
        compactTypedArray[i * componentsPerElement + j] = components[j];
      }
    }
    return compactTypedArray;
  }

  /**
   * 根据给定的量化信息，从给定输入数组中去量化数据，并返回结果。
   * 此操作假设已进行归一化处理。这意味着
   *
   * 当 <code>quantization.normalized</code> 标志为 <code>true</code> 时，
   * 则输入假定包含在指定范围内的浮点值
   * 量化后的类型数组
   * [-1, 1].
   *
   * @param {TypedArray} quantizedTypedArray 元素数量
   * @param {number} elementCount 元素类型
   * @param {AttributeType} elementType 量化方式
   * @param {ModelComponents.Quantization} quantization 结果
   * @returns {TypedArray} The 当元素类型为 SCALAR、VEC2、
   * @throws DeveloperError VEC3 或 VEC4 时
   * 从给定输入中解码八进制编码的法线，并将结果写入
   */
  static dequantize(
    quantizedTypedArray,
    elementCount,
    elementType,
    quantization,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("quantizedTypedArray", quantizedTypedArray);
    Check.typeOf.number.greaterThanOrEquals("elementCount", elementCount, 0);
    Check.defined("elementType", elementType);
    Check.defined("quantization", quantization);
    //>>includeEnd('debug');

    if (quantization.octEncoded) {
      const dequantizedTypedArray = ModelReader.octDecode(
        quantizedTypedArray,
        elementCount,
        quantization.normalizationRange,
        undefined,
      );
      if (quantization.octEncodedZXY) {
        ModelReader.convertZxyToXyz(
          dequantizedTypedArray,
          dequantizedTypedArray,
        );
      }
      return dequantizedTypedArray;
    }

    // These could be generalized, if the offset/stepSize were not
    // CartesianX objects, but arrays...
    const stepSize = quantization.quantizedVolumeStepSize;
    const offset = quantization.quantizedVolumeOffset;
    if (elementType === AttributeType.SCALAR) {
      return ModelReader.dequantize1D(
        quantizedTypedArray,
        elementCount,
        stepSize,
        offset,
        undefined,
      );
    }
    if (elementType === AttributeType.VEC2) {
      return ModelReader.dequantize2D(
        quantizedTypedArray,
        elementCount,
        stepSize,
        offset,
        undefined,
      );
    }
    if (elementType === AttributeType.VEC3) {
      return ModelReader.dequantize3D(
        quantizedTypedArray,
        elementCount,
        stepSize,
        offset,
        undefined,
      );
    }
    if (elementType === AttributeType.VEC4) {
      return ModelReader.dequantize4D(
        quantizedTypedArray,
        elementCount,
        stepSize,
        offset,
        undefined,
      );
    }
    throw new DeveloperError(
      `Element type for dequantization must be SCALAR, VEC2, VEC3, or VEC4, but is ${elementType}`,
    );
  }

  /**
   * 给定输出数组，如果结果为未定义，则分配并返回新数组。
   * 此操作将 <code>AttributeCompression.octDecodeInRange</code>
   * 函数应用于输入的三个分量。
   *
   * 输入
   * 元素数量
   *
   * @param {TypedArray} quantizedTypedArray 归一化范围
   * @param {number} elementCount 结果
   * @param {number} normalizationRange 归一化范围
   * @param {TypedArray} [dequantizedTypedArray] 结果
   * @returns {TypedArray} The 结果
   */
  static octDecode(
    quantizedTypedArray,
    elementCount,
    normalizationRange,
    dequantizedTypedArray,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("quantizedTypedArray", quantizedTypedArray);
    Check.typeOf.number.greaterThanOrEquals("elementCount", elementCount, 0);
    Check.typeOf.number.greaterThan(
      "normalizationRange",
      normalizationRange,
      0,
    );
    //>>includeEnd('debug');

    if (!defined(dequantizedTypedArray)) {
      dequantizedTypedArray = new Float32Array(quantizedTypedArray.length);
    }
    const c = new Cartesian3();
    for (let i = 0; i < elementCount; i++) {
      Cartesian3.unpack(quantizedTypedArray, i * 3, c);
      AttributeCompression.octDecodeInRange(c.x, c.y, normalizationRange, c);
      Cartesian3.pack(c, dequantizedTypedArray, i * 3);
    }
    return dequantizedTypedArray;
  }

  /**
   * 对给定输入数组中的连续三个元素进行旋转变换，从 (z, x, y) 到 (x, y, z)，并将结果写入
   * 给定输出数组，如果给定输出数组未定义，则创建新数组。
   * 输入
   * 元素数量
   *
   * @param {TypedArray} input 结果
   * @param {number} elementCount 元素数量
   * @param {TypedArray} [output] 结果
   * @returns {TypedArray} The 结果
   */
  static convertZxyToXyz(input, elementCount, output) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("input", input);
    Check.typeOf.number.greaterThanOrEquals("elementCount", elementCount, 0);
    //>>includeEnd('debug');

    if (!defined(output)) {
      output = new Float32Array(input.length);
    }
    let offset = 0;
    for (let i = 0; i < elementCount; i++, offset += 3) {
      const z = input[offset + 0];
      const x = input[offset + 1];
      const y = input[offset + 2];
      output[offset + 0] = x;
      output[offset + 1] = y;
      output[offset + 2] = z;
    }
    return output;
  }

  /**
   * 根据给定的量化信息，对给定量化后的数组进行去量化操作，并将结果写入给定输出数组，同时创建
   * 输出数组，如果输出数组未定义。
   * 此操作将简单地将输出数组填充为
   *
   * <code>output[i] = input[i] * stepSize + offset</code>
   * 量化后的数组
   *
   * @param {TypedArray} quantizedTypedArray 元素数量
   * @param {number} elementCount 元素类型
   * @param {number} stepSize 量化步长
   * @param {number} offset 量化偏移量
   * @param {TypedArray} [dequantizedTypedArray] 结果
   * @returns {TypedArray} The 结果
   */
  static dequantize1D(
    quantizedTypedArray,
    elementCount,
    stepSize,
    offset,
    dequantizedTypedArray,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("quantizedTypedArray", quantizedTypedArray);
    Check.typeOf.number.greaterThanOrEquals("elementCount", elementCount, 0);
    Check.defined("stepSize", stepSize);
    Check.defined("offset", offset);
    //>>includeEnd('debug');

    if (!defined(dequantizedTypedArray)) {
      dequantizedTypedArray = new Float32Array(quantizedTypedArray.length);
    }
    for (let i = 0; i < elementCount; i++) {
      const q = quantizedTypedArray[i];
      const d = q * stepSize + offset;
      dequantizedTypedArray[i] = d;
    }
    return dequantizedTypedArray;
  }

  /**
   * 根据给定的量化信息，对给定量化后的数组进行去量化操作，并将结果写入给定输出数组，同时创建
   * 输出数组，如果输出数组未定义。
   * 此操作将简单地将输出数组填充为
   *
   * <code>output[i] = input[i] * stepSize + offset</code>
   * 当将输入和输出解释为 Cartesian2 数组时。
   * 量化后的数组
   *
   * @param {TypedArray} quantizedTypedArray 元素数量
   * @param {number} elementCount 元素类型
   * @param {Cartesian2} stepSize 量化步长
   * @param {Cartesian2} offset 量化偏移量
   * @param {TypedArray} [dequantizedTypedArray] 结果
   * @returns {TypedArray} The 结果
   */
  static dequantize2D(
    quantizedTypedArray,
    elementCount,
    stepSize,
    offset,
    dequantizedTypedArray,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("quantizedTypedArray", quantizedTypedArray);
    Check.typeOf.number.greaterThanOrEquals("elementCount", elementCount, 0);
    Check.defined("stepSize", stepSize);
    Check.defined("offset", offset);
    //>>includeEnd('debug');

    if (!defined(dequantizedTypedArray)) {
      dequantizedTypedArray = new Float32Array(quantizedTypedArray.length);
    }
    const c = new Cartesian2();
    for (let i = 0; i < elementCount; i++) {
      Cartesian2.unpack(quantizedTypedArray, i * 2, c);
      Cartesian2.multiplyComponents(c, stepSize, c);
      Cartesian2.add(c, offset, c);
      Cartesian2.pack(c, dequantizedTypedArray, i * 2);
    }
    return dequantizedTypedArray;
  }

  /**
   * 根据给定的量化信息，对给定量化后的数组进行去量化操作，并将结果写入给定输出数组，同时创建
   * 输出数组，如果输出数组未定义。
   * 此操作将简单地将输出数组填充为
   *
   * <code>output[i] = input[i] * stepSize + offset</code>
   * 量化后的数组
   * 当将输入和输出解释为 Cartesian3 数组时。
   *
   * @param {TypedArray} quantizedTypedArray 量化后的数组
   * @param {number} elementCount 元素数量
   * @param {Cartesian3} stepSize 量化步长
   * @param {Cartesian3} offset 量化偏移量
   * @param {TypedArray} [dequantizedTypedArray] 结果
   * @returns {TypedArray} The result
   */
  static dequantize3D(
    quantizedTypedArray,
    elementCount,
    stepSize,
    offset,
    dequantizedTypedArray,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("quantizedTypedArray", quantizedTypedArray);
    Check.typeOf.number.greaterThanOrEquals("elementCount", elementCount, 0);
    Check.defined("stepSize", stepSize);
    Check.defined("offset", offset);
    //>>includeEnd('debug');

    if (!defined(dequantizedTypedArray)) {
      dequantizedTypedArray = new Float32Array(quantizedTypedArray.length);
    }
    const c = new Cartesian3();
    for (let i = 0; i < elementCount; i++) {
      Cartesian3.unpack(quantizedTypedArray, i * 3, c);
      Cartesian3.multiplyComponents(c, stepSize, c);
      Cartesian3.add(c, offset, c);
      Cartesian3.pack(c, dequantizedTypedArray, i * 3);
    }
    return dequantizedTypedArray;
  }

  /**
   * 根据给定的量化信息对给定的量化数组进行反量化，并将结果写入给定的输出数组，如果输出数组未定义则创建它。
   * 这将简单地用
   * <code>output[i] = input[i] * stepSize + offset</code> 填充输出数组，当将输入和输出解释为 Cartesian4 数组时。
   *
   * 量化后的数组
   * 元素数量
   * 量化步长
   *
   * @param {TypedArray} quantizedTypedArray 量化步长
   * @param {number} elementCount 元素数量
   * @param {Cartesian4} stepSize 量化步长
   * @param {Cartesian4} offset 量化偏移量
   * @param {TypedArray} [dequantizedTypedArray] 结果
   * @returns {TypedArray} The result
   */
  static dequantize4D(
    quantizedTypedArray,
    elementCount,
    stepSize,
    offset,
    dequantizedTypedArray,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("quantizedTypedArray", quantizedTypedArray);
    Check.typeOf.number.greaterThanOrEquals("elementCount", elementCount, 0);
    Check.defined("stepSize", stepSize);
    Check.defined("offset", offset);
    //>>includeEnd('debug');

    if (!defined(dequantizedTypedArray)) {
      dequantizedTypedArray = new Float32Array(quantizedTypedArray.length);
    }
    const c = new Cartesian4();
    for (let i = 0; i < elementCount; i++) {
      Cartesian4.unpack(quantizedTypedArray, i * 4, c);
      Cartesian4.multiplyComponents(c, stepSize, c);
      Cartesian4.add(c, offset, c);
      Cartesian4.pack(c, dequantizedTypedArray, i * 4);
    }
    return dequantizedTypedArray;
  }

  /**
   * 读取并返回给定类型的值
   * 在数据视图的给定字节偏移处，采用小端序格式
   * 顺序
   * @callback ComponentsReaderCallback
   * @param {DataView} dataView 将类型化数据视图转换为二进制缓冲区
   * @param {number} byteOffset 从视图开始到读取数据的字节数偏移量
   * @param {number} numberOfComponents 要读取的组件数量
   * @param {number[]} result 用于读取结果的数组
   */

  /**
   * 创建一个函数，该函数从给定数据视图中读取指定数量的组件，采用小端序格式
   * 顺序，并将它们写入给定的结果数组。
   * 组件类型
   *
   * @param {ComponentDatatype} componentType 读取器
   * @returns {ComponentsReaderCallback} The 读取并返回给定类型的值
   */
  static createComponentsReader(componentType) {
    const componentReader = ModelReader.createComponentReader(componentType);
    const sizeInBytes = ComponentDatatype.getSizeInBytes(componentType);
    return function (dataView, byteOffset, numberOfComponents, result) {
      let offset = byteOffset;
      for (let i = 0; i < numberOfComponents; ++i) {
        result[i] = componentReader(dataView, offset);
        offset += sizeInBytes;
      }
    };
  }

  /**
   * 在数据视图的给定字节偏移处，采用小端序格式
   * 顺序
   * 将类型化数据视图转换为二进制缓冲区
   * @callback ComponentReaderCallback
   * @param {DataView} dataView 从视图开始到读取数据的字节数偏移量
   * @param {number} byteOffset 从 dataView 中读取的值
   * @returns {number|bigint} The 创建并读取具有给定类型的值的函数
   */

  /**
   * 在数据视图的给定字节偏移处，采用小端序格式
   * 顺序
   * 组件类型
   * @param {ComponentDatatype} componentType 读取器
   * @returns {ComponentReaderCallback} The 将给定数组的元素用给定的 4x4 矩阵进行变换，
   */
  static createComponentReader(componentType) {
    switch (componentType) {
      case ComponentDatatype.BYTE:
        return function (dataView, byteOffset) {
          return dataView.getInt8(byteOffset);
        };
      case ComponentDatatype.UNSIGNED_BYTE:
        return function (dataView, byteOffset) {
          return dataView.getUint8(byteOffset);
        };
      case ComponentDatatype.SHORT:
        return function (dataView, byteOffset) {
          return dataView.getInt16(byteOffset, true);
        };
      case ComponentDatatype.UNSIGNED_SHORT:
        return function (dataView, byteOffset) {
          return dataView.getUint16(byteOffset, true);
        };
      case ComponentDatatype.INT:
        return function (dataView, byteOffset) {
          return dataView.getInt32(byteOffset, true);
        };
      case ComponentDatatype.UNSIGNED_INT:
        return function (dataView, byteOffset) {
          return dataView.getUint32(byteOffset, true);
        };
      case ComponentDatatype.FLOAT:
        return function (dataView, byteOffset) {
          return dataView.getFloat32(byteOffset, true);
        };
      case ComponentDatatype.DOUBLE:
        return function (dataView, byteOffset) {
          return dataView.getFloat64(byteOffset, true);
        };
    }
    throw new DeveloperError(
      `The componentType must be a valid ComponentDatatype, but is ${componentType}`,
    );
  }

  /**
   * 将连续的 3 个元素解释为 3D 点，并将结果写入给定的结果数组，如果结果数组未定义则创建它。
   * 输入数组
   * 矩阵
   * 结果
   *
   * @param {TypedArray} input 输入数组
   * @param {Matrix4} matrix 矩阵
   * @param {TypedArray} [result] 结果
   * @returns {TypedArray} The result
   */
  static transform3D(input, matrix, result) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("input", input);
    Check.defined("matrix", matrix);
    //>>includeEnd('debug');

    if (!defined(result)) {
      result = new Float32Array(input.length);
    }
    const c = new Cartesian3();
    const elementCount = input.length / 3;
    for (let i = 0; i < elementCount; i++) {
      Cartesian3.unpack(input, i * 3, c);
      Matrix4.multiplyByPoint(matrix, c, c);
      Cartesian3.pack(c, result, i * 3);
    }
    return result;
  }

  /**
   * 从隐式范围特征 ID 集合中读取特征 ID，并将其放入类型化数组中。
   *
   * 使用 <code>offset + Math.floor(i / repeat)</code> 生成每个顶点的值。如果 <code>repeat</code> 未定义，则所有值设为
   * <code>offset</code>。
   * 隐式范围特征 ID 集合。
   *
   * @param {ModelComponents.FeatureIdImplicitRange} featureIdSet 具有 <code>attributes</code> 数组的对象
   * @param {object} attributeOwner （原始对象或实例对象）
   * 生成的特征 ID 值。
   * @returns {Float32Array} The 从给定的原始索引中读取索引值
   */
  static readImplicitRangeAsTypedArray(featureIdSet, attributeOwner) {
    const count = attributeOwner.attributes[0]?.count ?? 0;
    const offset = featureIdSet.offset;
    const repeat = featureIdSet.repeat;
    const typedArray = new Float32Array(count);
    if (defined(repeat)) {
      for (let i = 0; i < count; i++) {
        typedArray[i] = offset + Math.floor(i / repeat);
      }
    } else {
      typedArray.fill(offset);
    }
    return typedArray;
  }

  /**
   * Read the indices values from the given primitive indices, and
   * 将其作为类型化数组返回。
   *
   * 如果给定的对象已经具有 <code>typedArray/code</code> 属性，那么它
   * 假定该属性包含正确的索引，并会被返回。
   *
   * 否则，会从给定的
   * 原始索引对象中的 <code>buffer</code> 中读取数据，并将其转换为与
   * <code>indexDataType</code> 匹配的类型化的数组，然后返回。
   *
   * 客户端不得修改返回的类型化数组。
   *
   * @param {ModelComponents.Indices} primitiveIndices 原始索引
   * @returns {TypedArray} The 索引值
   * @throws {DeveloperError} If 给定对象的 <code>indexDataType</code> 既不是 <code>UNSIGNED_BYTE</code>，也不是 <code>UNSIGNED_SHORT</code>，
   * 也不是 <code>UNSIGNED_INT</code>
   * 从给定的原始索引对象中读取索引值，并将其作为三角形顶点索引的类型化数组返回。
   */
  static readIndicesAsTypedArray(primitiveIndices) {
    const existingIndices = primitiveIndices.typedArray;
    if (defined(existingIndices)) {
      return existingIndices;
    }
    const indicesBuffer = primitiveIndices.buffer;
    const indicesCount = primitiveIndices.count;
    const indexDatatype = primitiveIndices.indexDatatype;
    const indices = ModelReader.createIndexTypedArray(
      indexDatatype,
      indicesCount,
    );
    indicesBuffer.getBufferData(indices);
    return indices;
  }

  /**
   * 如果给定的原始类型为 <code>TRIANGLES</code>，则索引值将从给定对象中读取并返回。
   * 如果原始类型为 <code>TRIANGLE_STRIP</code> 或 <code>TRIANGLE_FAN</code>，
   *
   * 则原始索引值将被读取，转换为三角形索引（即其等效的 <code>TRIANGLES</code> 表示形式），结果将返回。
   * 返回数组的类型将与给定对象的 <code>indexDataType</code> 一致。
   *
   * 客户端不得修改返回的类型化数组。
   * 原始索引
   * 索引值
   * 给定对象的 <code>indexDataType</code> 既不是 <code>UNSIGNED_BYTE</code>，也不是 <code>UNSIGNED_SHORT</code>，
   *
   * 也不是 <code>UNSIGNED_INT</code>，或给定的 <code>primitiveType</code>
   * 既不是 <code>TRIANGLES</code>，也不是 <code>TRIANGLE_STRIP</code>，
   *
   * 也不是 <code>TRIANGLE_FAN</code>
   *
   * @param {ModelComponents.Indices} primitiveIndices 将给定的 <code>TRIANGLE_STRIP</code> 表示形式的索引转换为 <code>TRIANGLES</code> 表示形式，并返回结果。
   * @returns {TypedArray} The 结果的类型将与输入数组的类型相同。
   * @throws {DeveloperError} If 输入索引
   * 得到的三角形索引
   * 将给定的 <code>TRIANGLE_FAN</code> 表示形式的索引转换为 <code>TRIANGLES</code> 表示形式，并返回结果。
   * 结果的类型将与输入数组的类型相同。
   * 输入索引
   */
  static readIndicesAsTriangleIndicesTypedArray(
    primitiveIndices,
    primitiveType,
  ) {
    const originalIndices =
      ModelReader.readIndicesAsTypedArray(primitiveIndices);
    if (primitiveType === PrimitiveType.TRIANGLES) {
      return originalIndices;
    }
    if (primitiveType === PrimitiveType.TRIANGLE_STRIP) {
      const triangleIndices =
        ModelReader.convertTriangleStripToTriangleIndices(originalIndices);
      return triangleIndices;
    }
    if (primitiveType === PrimitiveType.TRIANGLE_FAN) {
      const triangleIndices =
        ModelReader.convertTriangleFanToTriangleIndices(originalIndices);
      return triangleIndices;
    }
    throw new DeveloperError(
      `The primitiveType must be TRIANGLES (${PrimitiveType.TRIANGLES}, ` +
        `TRIANGLE_STRIP (${PrimitiveType.TRIANGLE_STRIP}, or ` +
        `TRIANGLE_FAN (${PrimitiveType.TRIANGLE_FAN}, but is ${primitiveType}`,
    );
  }

  /**
   * 将给定的 <code>TRIANGLE_STRIP</code> 表示形式的索引转换为 <code>TRIANGLES</code> 表示形式，并返回结果。
   * 结果的类型将与输入数组的类型相同。
   *
   * 结果的类型将与输入数组的类型相同。
   *
   * @param {TypedArray} indices 输入索引
   * @returns {TypedArray} The 得到的三角形索引
   */
  static convertTriangleStripToTriangleIndices(indices) {
    const triangleIndices = indices.constructor((indices.length - 2) * 3);
    for (let i = 0; i < indices.length - 2; i++) {
      if (i % 2 === 1) {
        triangleIndices[i * 3 + 0] = indices[i + 0];
        triangleIndices[i * 3 + 1] = indices[i + 2];
        triangleIndices[i * 3 + 2] = indices[i + 1];
      } else {
        triangleIndices[i * 3 + 0] = indices[i + 0];
        triangleIndices[i * 3 + 1] = indices[i + 1];
        triangleIndices[i * 3 + 2] = indices[i + 2];
      }
    }
    return triangleIndices;
  }

  /**
   * 将给定的 <code>TRIANGLE_FAN</code> 表示形式的索引转换为 <code>TRIANGLES</code> 表示形式，并返回结果。
   * 结果的类型将与输入数组的类型相同。
   *
   * 结果的类型将与输入数组的类型相同。
   *
   * @param {TypedArray} indices 输入索引
   * @returns {TypedArray} The 得到的三角形索引
   */
  static convertTriangleFanToTriangleIndices(indices) {
    const triangleIndices = indices.constructor((indices.length - 2) * 3);
    for (let i = 0; i < indices.length - 2; i++) {
      triangleIndices[i * 3 + 0] = indices[i + 0];
      triangleIndices[i * 3 + 1] = indices[i + 1];
      triangleIndices[i * 3 + 2] = indices[i + 2];
    }
    return triangleIndices;
  }

  /**
   * 创建一个与给定索引数据类型和给定大小匹配的类型化数组。
   * and the given size.
   *
   * @param {number} indexDatatype <code>IndexDataType</code>
   * @param {number} size 将创建的数组大小
   * @returns {TypedArray} The 类型化数组
   * @throws {DeveloperError} If <code>indexDataType</code> 既不是
   * <code>UNSIGNED_BYTE</code>，也不是 <code>UNSIGNED_SHORT</code>，
   * 也不是 <code>UNSIGNED_INT</code>，或者大小为负。
   */
  static createIndexTypedArray(indexDatatype, size) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number.greaterThanOrEquals("size", size, 0);
    //>>includeEnd('debug');

    switch (indexDatatype) {
      case IndexDatatype.UNSIGNED_BYTE:
        return new Uint8Array(size);
      case IndexDatatype.UNSIGNED_SHORT:
        return new Uint16Array(size);
      case IndexDatatype.UNSIGNED_INT:
        return new Uint32Array(size);
    }
    throw new DeveloperError(
      `The indexDatatype must be UNSIGNED_BYTE (${IndexDatatype.UNSIGNED_BYTE}, ` +
        `UNSIGNED_SHORT (${IndexDatatype.UNSIGNED_SHORT}, or ` +
        `UNSIGNED_INT (${IndexDatatype.UNSIGNED_INT}, but is ${indexDatatype}`,
    );
  }

  /**
   * 每个实例的数据，包含变换矩阵和可选的特征 ID。
   *
   * @typedef {object} ModelReader.Instance
   * @property {Matrix4} transform 实例变换矩阵。
   * @property {number} [featureId] 每个实例的特征 ID，或未定义。
   *
   * @private
   */

  /**
   * 由 {@link ModelReader.forEachPrimitive} 调用的回调，用于每个
   * 模型中的运行时原语。
   *
   * @callback ModelReader.ForEachPrimitiveCallback
   * @param {object} runtimePrimitive 运行时原语包装器。
   * @param {object} primitive 底层模型原语 (runtimePrimitive.primitive)。
   * @param {ModelReader.Instance[]} instances 每个实例的数据（变换和可选特征 ID）。
   * @param {Matrix4} computedModelMatrix 节点的计算模型矩阵。
   *
   * @private
   */

  /**
   * 遍历模型场景图中的每个原语，计算
   * 每个节点一次节点变换和实例变换，并调用
   * 每个运行时原语的回调。
   * <p>
   * 当提供地图投影时，计算模型矩阵通过 {@link FixedFrameTransforms.basisTo2D} 投影到 2D 空间。
   * 通过 {@link FixedFrameTransforms.basisTo2D} 投影到 2D 空间。
   * </p>
   *
   * @param {Model} model 要遍历的场景图模型。
   * @param {object} [options] 具有以下属性的对象：
   * @param {MapProjection} [options.mapProjection] 2D 模式的地图投影。当定义时，计算模型矩阵被投影到 2D 空间。
   * @param {string} [options.instanceFeatureIdLabel] 用于选择要读取的实例特征 ID 集的标签。当定义时，获取每个实例的特征 ID；当未定义时，不获取特征 ID。
   * @param {ModelReader.ForEachPrimitiveCallback} callback 为每个原语调用的函数。
   */
  static forEachPrimitive(model, options, callback) {
    const mapProjection = options?.mapProjection;
    const instanceFeatureIdLabel = options?.instanceFeatureIdLabel;
    const sceneGraph = model.sceneGraph;
    if (!defined(sceneGraph)) {
      return;
    }

    const scratchNodeTransforms = {
      nodeComputedTransform: new Matrix4(),
      modelMatrix: new Matrix4(),
      computedModelMatrix: new Matrix4(),
    };

    const nodes = sceneGraph._runtimeNodes;
    const nodesLength = nodes.length;

    for (let n = 0; n < nodesLength; n++) {
      const runtimeNode = nodes[n];

      const nodeTransforms = ModelReader.computeNodeTransforms(
        runtimeNode,
        sceneGraph,
        model,
        scratchNodeTransforms,
      );

      let computedModelMatrix = nodeTransforms.computedModelMatrix;

      if (defined(mapProjection)) {
        computedModelMatrix = FixedFrameTransforms.basisTo2D(
          mapProjection,
          computedModelMatrix,
          computedModelMatrix,
        );
      }

      const instanceTransforms = ModelReader.computeInstanceTransforms(
        runtimeNode,
        computedModelMatrix,
        nodeTransforms.nodeComputedTransform,
        nodeTransforms.modelMatrix,
      );

      const instanceFeatureIds = defined(instanceFeatureIdLabel)
        ? ModelReader.computeInstanceFeatureIds(
            runtimeNode,
            instanceFeatureIdLabel,
          )
        : undefined;

      const instances = [];
      for (let i = 0; i < instanceTransforms.length; i++) {
        instances.push({
          transform: instanceTransforms[i],
          featureId: defined(instanceFeatureIds)
            ? instanceFeatureIds[i]
            : undefined,
        });
      }

      const primitivesLength = runtimeNode.runtimePrimitives.length;
      for (let p = 0; p < primitivesLength; p++) {
        const runtimePrimitive = runtimeNode.runtimePrimitives[p];
        callback(
          runtimePrimitive,
          runtimePrimitive.primitive,
          instances,
          computedModelMatrix,
        );
      }
    }
  }

  /**
   * 计算运行时节点的模型矩阵，考虑实例化和世界空间变换。
   * 运行时节点。
   *
   * @param {object} runtimeNode 模型场景图。
   * @param {ModelSceneGraph} sceneGraph 模型。
   * @param {Model} model 具有临时矩阵的对象：{ nodeComputedTransform: Matrix4, modelMatrix: Matrix4, computedModelMatrix: Matrix4 }。
   * @param {object} result 结果参数，包含计算出的变换。
   * @returns {object} The 构建节点的实例变换数组。
   *
   */
  static computeNodeTransforms(runtimeNode, sceneGraph, model, result) {
    const node = runtimeNode.node;

    let nodeComputedTransform = Matrix4.clone(
      runtimeNode.computedTransform,
      result.nodeComputedTransform,
    );
    let modelMatrix = Matrix4.clone(
      sceneGraph.computedModelMatrix,
      result.modelMatrix,
    );

    const instances = node.instances;
    if (defined(instances)) {
      if (instances.transformInWorldSpace) {
        // Replicate the multiplication order in LegacyInstancingStageVS.
        modelMatrix = Matrix4.multiplyTransformation(
          model.modelMatrix,
          sceneGraph.components.transform,
          modelMatrix,
        );
        nodeComputedTransform = Matrix4.multiplyTransformation(
          sceneGraph.axisCorrectionMatrix,
          runtimeNode.computedTransform,
          nodeComputedTransform,
        );
      }
    }

    const computedModelMatrix = Matrix4.multiplyTransformation(
      modelMatrix,
      nodeComputedTransform,
      result.computedModelMatrix,
    );

    result.computedModelMatrix = computedModelMatrix;
    result.nodeComputedTransform = nodeComputedTransform;
    result.modelMatrix = modelMatrix;
    return result;
  }

  /**
   * 如果节点未实例化，则返回仅包含
   * 计算模型矩阵的数组。
   * 运行时节点。
   *
   * @param {object} runtimeNode 计算模型矩阵。
   * @param {Matrix4} computedModelMatrix 节点计算出的变换。
   * @param {Matrix4} nodeComputedTransform 节点计算出的变换。
   * @param {Matrix4} modelMatrix 模型矩阵。
   * @returns {Matrix4[]}
   */
  static computeInstanceTransforms(
    runtimeNode,
    computedModelMatrix,
    nodeComputedTransform,
    modelMatrix,
  ) {
    const transforms = [];
    const node = runtimeNode.node;
    const instances = node.instances;

    if (defined(instances)) {
      const transformsCount = instances.attributes[0].count;
      const instanceComponentDatatype =
        instances.attributes[0].componentDatatype;

      const transformElements = 12;
      let transformsTypedArray = runtimeNode.transformsTypedArray;

      if (!defined(transformsTypedArray)) {
        const instanceTransformsBuffer = runtimeNode.instancingTransformsBuffer;
        if (defined(instanceTransformsBuffer)) {
          transformsTypedArray = ComponentDatatype.createTypedArray(
            instanceComponentDatatype,
            transformsCount * transformElements,
          );
          instanceTransformsBuffer.getBufferData(transformsTypedArray);
        }
      }

      if (defined(transformsTypedArray)) {
        ModelReader.computeInstanceTransformsFromTypedArray(
          transformsTypedArray,
          transformsCount,
          transforms,
        );
      } else {
        ModelReader.computeInstanceTransformsFromAttributes(
          instances,
          transformsCount,
          transforms,
        );
      }

      for (let i = 0; i < transforms.length; i++) {
        const transform = transforms[i];
        if (instances.transformInWorldSpace) {
          Matrix4.multiplyTransformation(
            transform,
            nodeComputedTransform,
            transform,
          );
          Matrix4.multiplyTransformation(modelMatrix, transform, transform);
        } else {
          Matrix4.multiplyTransformation(
            computedModelMatrix,
            transform,
            transform,
          );
        }
      }
    }

    if (transforms.length === 0) {
      transforms.push(computedModelMatrix);
    }

    return transforms;
  }

  /**
   * 构建节点的每个实例特征 ID 数组。
   * 如果节点未实例化或没有匹配的特征 ID 集，
   * 返回 <code>undefined</code>。
   *
   * @param {object} runtimeNode 运行时节点。
   * @param {string} instanceFeatureIdLabel 用于选择特征 ID 集的标签。
   * @returns {number[]|undefined} The 每个实例的特征 ID，或未定义。
   */
  static computeInstanceFeatureIds(runtimeNode, instanceFeatureIdLabel) {
    const node = runtimeNode.node;
    const instances = node.instances;

    if (!defined(instances)) {
      return undefined;
    }

    const featureIdSet = ModelUtility.getFeatureIdsByLabel(
      instances.featureIds,
      instanceFeatureIdLabel,
    );

    if (!defined(featureIdSet)) {
      return undefined;
    }

    let typedArray;

    // Case: FeatureIdAttribute
    if ("setIndex" in featureIdSet) {
      const attribute = ModelUtility.getAttributeBySemantic(
        instances,
        VertexAttributeSemantic.FEATURE_ID,
        featureIdSet.setIndex,
      );
      if (defined(attribute)) {
        typedArray = ModelReader.readAttributeAsTypedArray(attribute);
      }
    }

    // Case: FeatureIdImplicitRange
    if ("offset" in featureIdSet) {
      typedArray = ModelReader.readImplicitRangeAsTypedArray(
        featureIdSet,
        instances,
      );
    }

    if (!defined(typedArray)) {
      return undefined;
    }

    const featureIds = new Array(typedArray.length);
    for (let i = 0; i < typedArray.length; i++) {
      featureIds[i] = typedArray[i];
    }
    return featureIds;
  }

  /**
   * 从打包的类型化数组构建实例变换，其中每个实例
   * 存储为 12 个浮点数（3 行，每行 4 列，行优先）。
   *
   * @param {TypedArray} transformsTypedArray 打包后的变换数组。
   * @param {number} count 实体数量。
   * @param {Matrix4[]} transforms 用于推送变换的输出数组。
   */
  static computeInstanceTransformsFromTypedArray(
    transformsTypedArray,
    count,
    transforms,
  ) {
    const transformElements = 12;
    for (let i = 0; i < count; i++) {
      const index = i * transformElements;

      const transform = new Matrix4(
        transformsTypedArray[index],
        transformsTypedArray[index + 1],
        transformsTypedArray[index + 2],
        transformsTypedArray[index + 3],
        transformsTypedArray[index + 4],
        transformsTypedArray[index + 5],
        transformsTypedArray[index + 6],
        transformsTypedArray[index + 7],
        transformsTypedArray[index + 8],
        transformsTypedArray[index + 9],
        transformsTypedArray[index + 10],
        transformsTypedArray[index + 11],
        0,
        0,
        0,
        1,
      );

      transforms.push(transform);
    }
  }

  /**
   * 从单独的平移、旋转和缩放属性构建实体变换。
   * 在无法使用打包变换 TypedArray 时使用的属性。
   *
   * @param {object} instances 实体对象。
   * @param {number} count 实体数量。
   * @param {Matrix4[]} transforms 用于推送变换的输出数组。
   */
  static computeInstanceTransformsFromAttributes(instances, count, transforms) {
    const translationAttribute = ModelUtility.getAttributeBySemantic(
      instances,
      InstanceAttributeSemantic.TRANSLATION,
    );
    const rotationAttribute = ModelUtility.getAttributeBySemantic(
      instances,
      InstanceAttributeSemantic.ROTATION,
    );
    const scaleAttribute = ModelUtility.getAttributeBySemantic(
      instances,
      InstanceAttributeSemantic.SCALE,
    );

    const hasTranslation = defined(translationAttribute);
    const hasRotation = defined(rotationAttribute);
    const hasScale = defined(scaleAttribute);

    if (!hasTranslation && !hasRotation && !hasScale) {
      return;
    }

    let translationTypedArray, rotationTypedArray, scaleTypedArray;
    if (hasTranslation) {
      translationTypedArray =
        ModelReader.readAttributeAsRawCompactTypedArray(translationAttribute);
    }
    if (hasRotation) {
      rotationTypedArray =
        ModelReader.readAttributeAsRawCompactTypedArray(rotationAttribute);
    }
    if (hasScale) {
      scaleTypedArray =
        ModelReader.readAttributeAsRawCompactTypedArray(scaleAttribute);
    }

    for (let i = 0; i < count; i++) {
      const translation = hasTranslation
        ? new Cartesian3(
            translationTypedArray[i * 3],
            translationTypedArray[i * 3 + 1],
            translationTypedArray[i * 3 + 2],
          )
        : Cartesian3.ZERO;

      const rotation = hasRotation
        ? new Quaternion(
            rotationTypedArray[i * 4],
            rotationTypedArray[i * 4 + 1],
            rotationTypedArray[i * 4 + 2],
            rotationTypedArray[i * 4 + 3],
          )
        : Quaternion.IDENTITY;

      const scale = hasScale
        ? new Cartesian3(
            scaleTypedArray[i * 3],
            scaleTypedArray[i * 3 + 1],
            scaleTypedArray[i * 3 + 2],
          )
        : Cartesian3.ONE;

      const transform = Matrix4.fromTranslationQuaternionRotationScale(
        translation,
        rotation,
        scale,
        new Matrix4(),
      );

      transforms.push(transform);
    }
  }
}

export default ModelReader;
