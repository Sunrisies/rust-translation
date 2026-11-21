import {
  AttributeType,
  BoundingRectangle,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Check,
  ComponentDatatype,
  Matrix4,
  Rectangle,
  defined,
} from "@cesium/core";
import ModelReader from "./ModelReader.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";

/**
 * 这是一个用于计算影像纹理坐标的类，
 * 用于映射到 <code>ModelComponents.Primitive</code> 上。
 *
 * @private
 */
class ModelImageryMapping {
  /**
   * 创建一个包含纹理坐标的类型化数组，
   * 用于给定的 <code>MappedPositions</code>，使用指定的
   * 投影方式。
   *
   * 这将是一个包含纹理坐标的类型化数组，
   * 这些坐标是通过使用给定的
   * 投影方式将给定位置进行投影后，并归一化到其边界矩形得到的。
   *
   * @param {MappedPositions} mappedPositions 位置
   * @param {MapProjection} projection 应使用的投影方式
   * @returns {TypedArray} The 结果
   */
  static createTextureCoordinatesForMappedPositions(
    mappedPositions,
    projection,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("mappedPositions", mappedPositions);
    Check.defined("projection", projection);
    //>>includeEnd('debug');

    const cartographicPositions = mappedPositions.cartographicPositions;
    const cartographicBoundingRectangle =
      mappedPositions.cartographicBoundingRectangle;
    const numPositions = mappedPositions.numPositions;
    return ModelImageryMapping._createTextureCoordinates(
      cartographicPositions,
      numPositions,
      cartographicBoundingRectangle,
      projection,
    );
  }

  /**
   * 创建一个包含纹理坐标的类型化数组，
   * 用于具有给定位置的primitive，使用给定的
   * 投影方式。
   *
   * 这将是一个大小为 <code>numPositions*2</code> 的类型化数组，
   * 包含通过
   * 使用给定投影将给定位置进行投影后，
   * 并归一化到给定边界矩形得到的纹理坐标。
   *
   * @param {Iterable<Cartographic>} cartographicPositions 该
   * 地图坐标
   * @param {number} numPositions 位置数量（顶点数）
   * @param {Rectangle} cartographicBoundingRectangle 地图坐标的边界
   * 矩形
   * @param {MapProjection} projection 应使用的投影方式
   * @returns {TypedArray} The 结果
   * @private
   */
  static _createTextureCoordinates(
    cartographicPositions,
    numPositions,
    cartographicBoundingRectangle,
    projection,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("cartographicPositions", cartographicPositions);
    Check.typeOf.number.greaterThanOrEquals("numPositions", numPositions, 0);
    Check.defined(
      "cartographicBoundingRectangle",
      cartographicBoundingRectangle,
    );
    Check.defined("projection", projection);
    //>>includeEnd('debug');

    // Convert the bounding `Rectangle`(!) of the cartographic positions
    // into a `BoundingRectangle`(!) using the given projection
    const boundingRectangle = new BoundingRectangle();
    BoundingRectangle.fromRectangle(
      cartographicBoundingRectangle,
      projection,
      boundingRectangle,
    );

    // Compute the projected positions, using the given projection
    const projectedPositions = ModelImageryMapping.createProjectedPositions(
      cartographicPositions,
      projection,
    );

    // Relativize the projected positions into the bounding rectangle
    // to obtain texture coordinates
    const texCoords = ModelImageryMapping.computeTexCoords(
      projectedPositions,
      boundingRectangle,
    );

    // Convert the texture coordinates into a typed array
    const texCoordsTypedArray =
      ModelImageryMapping.createTypedArrayFromCartesians2(
        numPositions,
        texCoords,
      );

    return texCoordsTypedArray;
  }

  /**
   * 为primitive创建 `ModelComponents.Attribute` 用于纹理坐标，
   * 用于
   *
   * 这将创建一个具有
   * - 语义：VertexAttributeSemantic.TEXCOORD - 类型：AttributeType.VEC2 - 数量：mappedPositions.numPositions 的属性，
   * 包含给定顶点位置的纹理坐标，
   * 在它们使用给定投影进行投影后，并归一化到
   * 其边界矩形上。
   * 该
   * 地图坐标
   *
   * @param {Iterable<Cartographic>} cartographicPositions 位置数量（顶点数）
   * 地图坐标的边界
   * @param {number} numPositions 矩形
   * @param {Rectangle} cartographicBoundingRectangle 地图坐标的边界
   * 矩形
   * @param {MapProjection} projection 应使用的投影方式
   * @returns {ModelComponents.Attribute} The 新属性
   */
  static createTextureCoordinatesAttributeForMappedPositions(
    mappedPositions,
    projection,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("mappedPositions", mappedPositions);
    Check.defined("projection", projection);
    //>>includeEnd('debug');

    // Create the typed array that contains the texture coordinates
    const texCoordsTypedArray =
      ModelImageryMapping.createTextureCoordinatesForMappedPositions(
        mappedPositions,
        projection,
      );

    // Create an attribute from the texture coordinates typed array
    const texCoordAttribute =
      ModelImageryMapping.createTexCoordAttribute(texCoordsTypedArray);

    return texCoordAttribute;
  }

  /**
   * 创建一个可迭代对象，提供基于给定椭球体的
   * 给定 POSITION 属性的地图坐标，
   *
   * @param {ModelComponents.Attribute} primitivePositionAttribute
   * 即 primitive 的 "POSITION" 属性。
   * @param {Matrix4} primitivePositionTransform primitive 的完整变换
   * @param {Ellipsoid} ellipsoid 应使用的椭球体
   * @returns {Iterable<Cartographic>} The 对 `Cartographic` 对象的可迭代对象
   */
  static createCartographicPositions(
    primitivePositionAttribute,
    primitivePositionTransform,
    ellipsoid,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("primitivePositionAttribute", primitivePositionAttribute);
    Check.defined("primitivePositionTransform", primitivePositionTransform);
    Check.defined("ellipsoid", ellipsoid);
    //>>includeEnd('debug');

    // Extract the positions as a typed array
    const typedArray = ModelReader.readAttributeAsTypedArray(
      primitivePositionAttribute,
    );

    // Create an iterable over the positions
    const type = primitivePositionAttribute.type;
    const numComponents = AttributeType.getNumberOfComponents(type);
    const positions =
      ModelImageryMapping.createIterableCartesian3FromTypedArray(
        typedArray,
        numComponents,
      );

    // Compute the positions after they are transformed with the given matrix
    const transformedPositions = ModelImageryMapping.transformCartesians3(
      positions,
      primitivePositionTransform,
    );

    // Compute the cartographic positions for the given ellipsoid
    const cartographicPositions = ModelImageryMapping.transformToCartographic(
      transformedPositions,
      ellipsoid,
    );
    return cartographicPositions;
  }

  /**
   * 从给定的
   * 类型化数组创建 `Cartesian3` 对象的可迭代对象。
   *
   * 结果的可迭代对象将始终返回相同的 `Cartesian3`
   * 对象。客户端不应存储和修改此对象。
   *
   * @param {TypedArray} typedArray 类型化数组
   * @param {number} stride 给定数组中连续
   * `Cartesian3` 元素之间的步长。必须至少为 3。
   * @returns {Iterable<Cartesian3>} The 可迭代对象
   */
  static createIterableCartesian3FromTypedArray(typedArray, stride) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("typedArray", typedArray);
    Check.typeOf.number.greaterThanOrEquals("stride", stride, 3);
    //>>includeEnd('debug');

    const cartesian = new Cartesian3();
    const numElements = typedArray.length / stride;
    const result = {
      [Symbol.iterator]: function* () {
        for (let i = 0; i < numElements; i++) {
          cartesian.x = typedArray[i * stride + 0];
          cartesian.y = typedArray[i * stride + 1];
          cartesian.z = typedArray[i * stride + 2];
          yield cartesian;
        }
      },
    };
    return result;
  }

  /**
   * 创建一个新可迭代对象，将给定映射器应用于给定的可迭代对象。
   *
   * @param {Iterable} iterable 输入可迭代对象
   * @param {Function} mapper 映射器
   * @returns {Iterable} The 可映射的可迭代对象
   */
  static map(iterable, mapper) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("iterable", iterable);
    Check.defined("mapper", mapper);
    //>>includeEnd('debug');

    const result = {
      [Symbol.iterator]: function* () {
        for (const element of iterable) {
          yield mapper(element);
        }
      },
    };
    return result;
  }

  /**
   * 计算给定地图坐标的边界矩形，
   * 将其存储在结果中，并返回它。
   *
   * 如果结果为 `undefined`，则将创建新的矩形
   * 并返回。
   *
   * @param {Iterable<Cartographic>} cartographicPositions 地图坐标
   * @param {Rectangle} [result] 结果
   * @returns {Rectangle} The 结果
   */
  static computeCartographicBoundingRectangle(cartographicPositions, result) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("cartographicPositions", cartographicPositions);
    //>>includeEnd('debug');

    if (!defined(result)) {
      result = new Rectangle();
    }
    // One could store these directly in the result, but that would
    // violate the constraint of the PI-related ranges..
    let north = Number.NEGATIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let west = Number.POSITIVE_INFINITY;
    for (const cartographicPosition of cartographicPositions) {
      north = Math.max(north, cartographicPosition.latitude);
      south = Math.min(south, cartographicPosition.latitude);
      east = Math.max(east, cartographicPosition.longitude);
      west = Math.min(west, cartographicPosition.longitude);
    }
    result.north = north;
    result.south = south;
    result.east = east;
    result.west = west;
    return result;
  }

  /**
   * 创建一个新可迭代对象，提供 `Cartesian3` 对象，这些对象是通过
   * 将给定可迭代对象中的 `Cartesian3` 对象与给定矩阵进行转换生成的。
   * 生成的可迭代对象将始终返回相同的 `Cartesian3`
   *
   * 对象。客户端不应存储或修改该对象。
   * 位置
   *
   * @param {Iterable<Cartesian3>} positions 矩阵
   * @param {Matrix4} matrix 转换后的地图坐标
   * @returns {Iterable<Cartesian3>} The 生成的可迭代对象，提供 `Cartographic` 对象，这些对象是通过
   */
  static transformCartesians3(positions, matrix) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("positions", positions);
    Check.defined("matrix", matrix);
    //>>includeEnd('debug');

    const transformedPosition = new Cartesian3();
    const transformedPositions = ModelImageryMapping.map(positions, (p) => {
      Matrix4.multiplyByPoint(matrix, p, transformedPosition);
      return transformedPosition;
    });
    return transformedPositions;
  }

  /**
   * 将给定 `Cartesian3` 对象转换为
   * 基于给定椭球体的地图坐标生成的。
   * 生成的可迭代对象将始终返回相同的 `Cartographic`
   *
   * 对象。客户端不应存储或修改该对象。
   * 地图坐标
   *
   * @param {Iterable<Cartesian3>} positions 椭球体
   * @param {Ellipsoid} ellipsoid 地图坐标
   * @returns {Iterable<Cartographic>} The 地图坐标位置
   */
  static transformToCartographic(positions, ellipsoid) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("positions", positions);
    Check.defined("ellipsoid", ellipsoid);
    //>>includeEnd('debug');

    const cartographicPosition = new Cartographic();
    const cartographicPositions = ModelImageryMapping.map(positions, (p) => {
      // Note: This will not yield valid results for p=(0,0,0).
      // But there is no sensible cartographic position for
      // that, so simply accept the unspecified output here.
      ellipsoid.cartesianToCartographic(p, cartographicPosition);
      return cartographicPosition;
    });
    return cartographicPositions;
  }

  /**
   * 创建一个可迭代对象，包含对给定地图坐标应用给定投影后的结果。
   * 生成的可迭代对象将始终返回相同的 `Cartesian3`
   *
   * 对象。客户端不应存储或修改该对象。
   * 地图坐标
   *
   * @param {Iterable<Cartographic>} cartographicPositions 地图坐标
   * 使用的投影
   * @param {MapProjection} projection 投影后的位置
   * @returns {Iterable<Cartesian3>} The 投影位置
   */
  static createProjectedPositions(cartographicPositions, projection) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("cartographicPositions", cartographicPositions);
    Check.defined("projection", projection);
    //>>includeEnd('debug');

    const projectedPosition = new Cartesian3();
    const projectedPositions = ModelImageryMapping.map(
      cartographicPositions,
      (c) => {
        projection.project(c, projectedPosition);
        return projectedPosition;
      },
    );
    return projectedPositions;
  }

  /**
   * 计算给定位置的纹理坐标，相对于
   * 给定的边界矩形。
   *
   * 这将使给定地图坐标的 x/y 坐标相对于
   * 边界矩形，并将其限制在 [0,0]-[1,1] 范围内。
   *
   * 注意：这可以分解为
   * 1. 映射到 2D 空间
   * 2. 针对边界矩形进行相对调整
   * 3. 限制在 [0,0]-[1,1] 范围内
   *
   * @param {Iterable<Cartesian3>} positions 位置
   * @param {BoundingRectangle} boundingRectangle 矩形
   * @returns {Iterable<Cartesian2>} The 纹理坐标
   */
  static computeTexCoords(positions, boundingRectangle) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("positions", positions);
    Check.defined("boundingRectangle", boundingRectangle);
    //>>includeEnd('debug');

    const texCoord = new Cartesian2();
    const invSizeX = 1.0 / boundingRectangle.width;
    const invSizeY = 1.0 / boundingRectangle.height;
    const texCoords = ModelImageryMapping.map(positions, (p) => {
      const uRaw = (p.x - boundingRectangle.x) * invSizeX;
      const vRaw = (p.y - boundingRectangle.y) * invSizeY;
      const u = Math.min(Math.max(uRaw, 0.0), 1.0);
      const v = Math.min(Math.max(vRaw, 0.0), 1.0);
      texCoord.x = u;
      texCoord.y = v;
      return texCoord;
    });
    return texCoords;
  }

  /**
   * 从给定的 `Cartesian2` 对象创建新的类型数组。
   *
   * @param {number} numElements 元素数量
   * @param {Iterable<Cartesian2>} elements 元素
   * @returns {TypedArray} The 类型数组
   */
  static createTypedArrayFromCartesians2(numElements, elements) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number.greaterThanOrEquals("numElements", numElements, 0);
    Check.defined("elements", elements);
    //>>includeEnd('debug');

    const typedArray = new Float32Array(numElements * 2);
    let index = 0;
    for (const element of elements) {
      typedArray[index * 2 + 0] = element.x;
      typedArray[index * 2 + 1] = element.y;
      index++;
    }
    return typedArray;
  }

  /**
   * 从给定数据创建新的纹理坐标属性。
   *
   * 这将创建一个具有
   * - 语义：VertexAttributeSemantic.TEXCOORD
   * - 类型：AttributeType.VEC2
   * - 数量：texCoordsTypedArray.length / 2 的属性，该属性包含来自给定类型数组的数据。
   * 类型数组
   *
   * @param {TypedArray} texCoordsTypedArray 属性
   * @returns {ModelComponents.Attribute} The attribute
   */
  static createTexCoordAttribute(texCoordsTypedArray) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("texCoordsTypedArray", texCoordsTypedArray);
    //>>includeEnd('debug');

    const texCoordAttribute = {
      name: "Imagery Texture Coordinates",
      semantic: VertexAttributeSemantic.TEXCOORD,
      setIndex: 0,
      componentDatatype: ComponentDatatype.FLOAT,
      type: AttributeType.VEC2,
      normalized: false,
      count: texCoordsTypedArray.length / 2,
      min: undefined,
      max: undefined,
      constant: new Cartesian2(0, 0),
      quantization: undefined,
      typedArray: texCoordsTypedArray,
      byteOffset: 0,
      byteStride: undefined,
    };
    return texCoordAttribute;
  }
}
export default ModelImageryMapping;
