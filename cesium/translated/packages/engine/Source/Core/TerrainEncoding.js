import {
  AttributeCompression,
  Cartesian2,
  Cartesian3,
  Check,
  ComponentDatatype,
  Math as CesiumMath,
  Matrix4,
  VerticalExaggeration,
  defined,
} from "@cesium/core";
import TerrainQuantization from "./TerrainQuantization.js";

const cartesian3Scratch = new Cartesian3();
const cartesian3DimScratch = new Cartesian3();
const cartesian2Scratch = new Cartesian2();
const matrix4Scratch = new Matrix4();
const matrix4Scratch2 = new Matrix4();

const SHIFT_LEFT_12 = Math.pow(2.0, 12.0);

/**
 * 用于量化和打包地形网格的数据。该位置可被解包用于选择操作，且所有属性均可被解包。
 * 在顶点着色器中被解包。
 *
 * @alias TerrainEncoding
 * @constructor
 *
 * @param {Cartesian3} center 顶点的中心点。
 * @param {AxisAlignedBoundingBox} [axisAlignedBoundingBox] 在网格中心的东-北-上坐标下的瓦片边界。
 * @param {number} [minimumHeight] 最低高度。
 * @param {number} [maximumHeight] 最高高度。
 * @param {Matrix4} [fromENU] 地形网格中心的东-北-上到固定帧矩阵。
 * @param {boolean} [hasVertexNormals=false] 如果网格包含顶点法线。
 * @param {boolean} [hasWebMercatorT=false] 如果地形数据包含 Web Mercator 纹理坐标，则为 true；否则为 false。
 * @param {boolean} [hasGeodeticSurfaceNormals=false] 如果地形数据包含大地表面法线，则为 true；否则为 false。
 * @param {number} [exaggeration=1.0] 用于放大地形的标量。
 * @param {number} [exaggerationRelativeHeight=0.0] 放大地形的相对高度。
 *
 * @private
 */
function TerrainEncoding(
  center,
  axisAlignedBoundingBox,
  minimumHeight,
  maximumHeight,
  fromENU,
  hasVertexNormals,
  hasWebMercatorT,
  hasGeodeticSurfaceNormals,
  exaggeration,
  exaggerationRelativeHeight,
) {
  let quantization = TerrainQuantization.NONE;
  let toENU;
  let matrix;

  if (
    defined(axisAlignedBoundingBox) &&
    defined(minimumHeight) &&
    defined(maximumHeight) &&
    defined(fromENU)
  ) {
    const minimum = axisAlignedBoundingBox.minimum;
    const maximum = axisAlignedBoundingBox.maximum;

    const dimensions = Cartesian3.subtract(
      maximum,
      minimum,
      cartesian3DimScratch,
    );
    const hDim = maximumHeight - minimumHeight;
    const maxDim = Math.max(Cartesian3.maximumComponent(dimensions), hDim);

    if (maxDim < SHIFT_LEFT_12 - 1.0) {
      quantization = TerrainQuantization.BITS12;
    } else {
      quantization = TerrainQuantization.NONE;
    }

    // Scale and bias from [0,1] to [ENU min, ENU max]
    // Also compute the inverse of the scale and bias
    let st = Matrix4.fromScale(dimensions, matrix4Scratch);
    st = Matrix4.setTranslation(st, minimum, st);

    let invSt = Matrix4.fromScale(
      Cartesian3.fromElements(
        1.0 / dimensions.x,
        1.0 / dimensions.y,
        1.0 / dimensions.z,
        cartesian3Scratch,
      ),
      matrix4Scratch2,
    );
    invSt = Matrix4.multiplyByTranslation(
      invSt,
      Cartesian3.negate(minimum, cartesian3Scratch),
      invSt,
    );

    matrix = Matrix4.clone(fromENU, new Matrix4());
    let rtcOffset = Matrix4.getTranslation(fromENU, cartesian3Scratch);
    rtcOffset = Cartesian3.subtract(rtcOffset, center, cartesian3Scratch);
    matrix = Matrix4.setTranslation(matrix, rtcOffset, matrix);
    matrix = Matrix4.multiply(matrix, st, matrix);

    toENU = Matrix4.inverseTransformation(fromENU, new Matrix4());
    toENU = Matrix4.multiply(invSt, toENU, toENU);

    fromENU = Matrix4.multiply(fromENU, st, new Matrix4());
  }

  /**
   * 网格顶点被压缩的方式。
   * @type {TerrainQuantization}
   */
  this.quantization = quantization;

  /**
   * 包含边缘的瓦片最低高度。
   * @type {number|undefined}
   */
  this.minimumHeight = minimumHeight;

  /**
   * 瓦片的最高高度。
   * @type {number|undefined}
   */
  this.maximumHeight = maximumHeight;

  /**
   * 瓦片的中心点。
   * @type {Cartesian3}
   */
  this.center = Cartesian3.clone(center);

  /**
   * 将瓦片中的一个顶点转换为中心处的东-北-上坐标并进行缩放的矩阵，使得每个分量都在 [0, 1] 范围内。
   * 将经过 toScaledENU 缩放后的顶点恢复为地球固定参考系的矩阵。
   * @type {Matrix4|undefined}
   */
  this.toScaledENU = toENU;

  /**
   * 用于将经过 toScaledENU 缩放后的顶点恢复到地球固定参考系的矩阵。
   * @type {Matrix4|undefined}
   */
  this.fromScaledENU = fromENU;

  /**
   * 在 RTE 渲染的着色器中用于解压地形顶点的矩阵。
   * @type {Matrix4|undefined}
   */
  this.matrix = matrix;

  /**
   * 地形网格包含法线。
   * @type {boolean}
   */
  this.hasVertexNormals = hasVertexNormals ?? false;

  /**
   * 地形网格包含遵循 Web Mercator 投影的垂直纹理坐标。
   * @type {boolean}
   */
  this.hasWebMercatorT = hasWebMercatorT ?? false;

  /**
   * 地形网格包含用于地形放大的大地表面法线。
   * @type {boolean}
   */
  this.hasGeodeticSurfaceNormals = hasGeodeticSurfaceNormals ?? false;

  /**
   * 用于放大地形的标量。
   * @type {number}
   */
  this.exaggeration = exaggeration ?? 1.0;

  /**
   * 放大地形的相对高度。
   */
  this.exaggerationRelativeHeight = exaggerationRelativeHeight ?? 0.0;

  /**
   * 每个顶点中的分量数量。该值可能因不同的量化方式而不同。
   * @type {number}
   */
  this.stride = 0;

  this._offsetGeodeticSurfaceNormal = 0;
  this._offsetVertexNormal = 0;

  // Calculate the stride and offsets declared above
  this._calculateStrideAndOffsets();
}

/**
 * 将给定位置的地形信息编码到顶点缓冲区中。
 * 位置、纹理坐标、高度以及（可选）法线、投影信息，
 * 和大地表面法线都打包在同一个缓冲区中。
 *
 * @param {Float32Array} vertexBuffer 要写入的缓冲区。
 * @param {number} bufferIndex 开始写入的缓冲区索引。
 * @param {Cartesian3} position 顶点的位置。
 * @param {Cartesian2} uv 顶点的纹理坐标。
 * @param {number} height 顶点的高度。
 * @param {Cartesian2} [normalToPack] 顶点的法向量。
 * @param {number} [webMercatorT] 顶点的 Web Mercator 纹理坐标。
 * @param {Cartesian3} [geodeticSurfaceNormal] 顶点的大地表面法线。
 */
TerrainEncoding.prototype.encode = function (
  vertexBuffer,
  bufferIndex,
  position,
  uv,
  height,
  normalToPack,
  webMercatorT,
  geodeticSurfaceNormal,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("vertexBuffer", vertexBuffer);
  Check.typeOf.number("bufferIndex", bufferIndex);
  Check.typeOf.object("position", position);
  Check.typeOf.object("uv", uv);
  Check.typeOf.number("height", height);
  //>>includeEnd('debug');

  const u = uv.x;
  const v = uv.y;

  if (this.quantization === TerrainQuantization.BITS12) {
    position = Matrix4.multiplyByPoint(
      this.toScaledENU,
      position,
      cartesian3Scratch,
    );

    position.x = CesiumMath.clamp(position.x, 0.0, 1.0);
    position.y = CesiumMath.clamp(position.y, 0.0, 1.0);
    position.z = CesiumMath.clamp(position.z, 0.0, 1.0);

    const hDim = this.maximumHeight - this.minimumHeight;
    const h = CesiumMath.clamp((height - this.minimumHeight) / hDim, 0.0, 1.0);

    Cartesian2.fromElements(position.x, position.y, cartesian2Scratch);
    const compressed0 =
      AttributeCompression.compressTextureCoordinates(cartesian2Scratch);

    Cartesian2.fromElements(position.z, h, cartesian2Scratch);
    const compressed1 =
      AttributeCompression.compressTextureCoordinates(cartesian2Scratch);

    Cartesian2.fromElements(u, v, cartesian2Scratch);
    const compressed2 =
      AttributeCompression.compressTextureCoordinates(cartesian2Scratch);

    vertexBuffer[bufferIndex++] = compressed0;
    vertexBuffer[bufferIndex++] = compressed1;
    vertexBuffer[bufferIndex++] = compressed2;

    if (this.hasWebMercatorT) {
      Cartesian2.fromElements(webMercatorT, 0.0, cartesian2Scratch);
      const compressed3 =
        AttributeCompression.compressTextureCoordinates(cartesian2Scratch);
      vertexBuffer[bufferIndex++] = compressed3;
    }
  } else {
    vertexBuffer[bufferIndex++] = position.x - this.center.x;
    vertexBuffer[bufferIndex++] = position.y - this.center.y;
    vertexBuffer[bufferIndex++] = position.z - this.center.z;
    vertexBuffer[bufferIndex++] = height;
    vertexBuffer[bufferIndex++] = u;
    vertexBuffer[bufferIndex++] = v;

    if (this.hasWebMercatorT) {
      vertexBuffer[bufferIndex++] = webMercatorT;
    }
  }

  if (this.hasVertexNormals) {
    vertexBuffer[bufferIndex++] =
      AttributeCompression.octPackFloat(normalToPack);
  }

  if (this.hasGeodeticSurfaceNormals) {
    vertexBuffer[bufferIndex++] = geodeticSurfaceNormal.x;
    vertexBuffer[bufferIndex++] = geodeticSurfaceNormal.y;
    vertexBuffer[bufferIndex++] = geodeticSurfaceNormal.z;
  }

  return bufferIndex;
};

const scratchPosition = new Cartesian3();
const scratchGeodeticSurfaceNormal = new Cartesian3();

/**
 * 将大地表面法线添加到地形顶点缓冲区中。
 * 新的缓冲区将比旧的缓冲区更大。
 *
 * @param {Float32Array} oldBuffer 没有大地表面法线的缓冲区。
 * @param {Float32Array} newBuffer 包含大地表面法线的缓冲区。
 * @param {Ellipsoid} ellipsoid 用于计算大地表面法线的椭球体。
 */
TerrainEncoding.prototype.addGeodeticSurfaceNormals = function (
  oldBuffer,
  newBuffer,
  ellipsoid,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("oldBuffer", oldBuffer);
  Check.typeOf.object("newBuffer", newBuffer);
  Check.typeOf.object("ellipsoid", ellipsoid);
  //>>includeEnd('debug');

  if (this.hasGeodeticSurfaceNormals) {
    return;
  }

  const oldStride = this.stride;
  const vertexCount = oldBuffer.length / oldStride;
  this.hasGeodeticSurfaceNormals = true;
  this._calculateStrideAndOffsets();
  const newStride = this.stride;

  for (let index = 0; index < vertexCount; index++) {
    for (let offset = 0; offset < oldStride; offset++) {
      const oldIndex = index * oldStride + offset;
      const newIndex = index * newStride + offset;
      newBuffer[newIndex] = oldBuffer[oldIndex];
    }
    const position = this.decodePosition(newBuffer, index, scratchPosition);
    const geodeticSurfaceNormal = ellipsoid.geodeticSurfaceNormal(
      position,
      scratchGeodeticSurfaceNormal,
    );

    const bufferIndex = index * newStride + this._offsetGeodeticSurfaceNormal;
    newBuffer[bufferIndex] = geodeticSurfaceNormal.x;
    newBuffer[bufferIndex + 1] = geodeticSurfaceNormal.y;
    newBuffer[bufferIndex + 2] = geodeticSurfaceNormal.z;
  }
};

/**
 * 从地形顶点缓冲区中移除大地表面法线。
 *
 * @param {Float32Array} oldBuffer 包含大地表面法线的缓冲区。
 * @param {Float32Array} newBuffer 不包含大地表面法线的缓冲区。
 */
TerrainEncoding.prototype.removeGeodeticSurfaceNormals = function (
  oldBuffer,
  newBuffer,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("oldBuffer", oldBuffer);
  Check.typeOf.object("newBuffer", newBuffer);
  //>>includeEnd('debug');

  if (!this.hasGeodeticSurfaceNormals) {
    return;
  }

  const oldStride = this.stride;
  const vertexCount = oldBuffer.length / oldStride;
  this.hasGeodeticSurfaceNormals = false;
  this._calculateStrideAndOffsets();
  const newStride = this.stride;

  for (let index = 0; index < vertexCount; index++) {
    for (let offset = 0; offset < newStride; offset++) {
      const oldIndex = index * oldStride + offset;
      const newIndex = index * newStride + offset;
      newBuffer[newIndex] = oldBuffer[oldIndex];
    }
  }
};

/**
 * 从顶点缓冲区中解码位置。
 *
 * @param {Float32Array} buffer 要解码的缓冲区。
 * @param {number} index 要解码的顶点的索引。
 * @param {Cartesian3} [result] 存储结果的对象。
 * @returns {Cartesian3} The 解码后的位置。
 */
TerrainEncoding.prototype.decodePosition = function (buffer, index, result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  if (!defined(result)) {
    result = new Cartesian3();
  }

  index *= this.stride;

  if (this.quantization === TerrainQuantization.BITS12) {
    const xy = AttributeCompression.decompressTextureCoordinates(
      buffer[index],
      cartesian2Scratch,
    );
    result.x = xy.x;
    result.y = xy.y;

    const zh = AttributeCompression.decompressTextureCoordinates(
      buffer[index + 1],
      cartesian2Scratch,
    );
    result.z = zh.x;

    return Matrix4.multiplyByPoint(this.fromScaledENU, result, result);
  }

  result.x = buffer[index];
  result.y = buffer[index + 1];
  result.z = buffer[index + 2];
  return Cartesian3.add(result, this.center, result);
};

/**
 * 从顶点缓冲区中解码位置并应用垂直放大。
 *
 * @param {Float32Array|Float64Array} buffer
 * @param {number} index
 * @param {Cartesian3} [result]
 * @returns {Cartesian3} The 放大后的位置。
 */
TerrainEncoding.prototype.getExaggeratedPosition = function (
  buffer,
  index,
  result,
) {
  result = this.decodePosition(buffer, index, result);

  const exaggeration = this.exaggeration;
  const exaggerationRelativeHeight = this.exaggerationRelativeHeight;
  const hasExaggeration = exaggeration !== 1.0;
  if (hasExaggeration && this.hasGeodeticSurfaceNormals) {
    const geodeticSurfaceNormal = this.decodeGeodeticSurfaceNormal(
      buffer,
      index,
      scratchGeodeticSurfaceNormal,
    );
    const rawHeight = this.decodeHeight(buffer, index);
    const heightDifference =
      VerticalExaggeration.getHeight(
        rawHeight,
        exaggeration,
        exaggerationRelativeHeight,
      ) - rawHeight;

    // some math is unrolled for better performance
    result.x += geodeticSurfaceNormal.x * heightDifference;
    result.y += geodeticSurfaceNormal.y * heightDifference;
    result.z += geodeticSurfaceNormal.z * heightDifference;
  }

  return result;
};

/**
 * 从顶点缓冲区中解码纹理坐标。
 *
 * @param {Float32Array} buffer 要解码的缓冲区。
 * @param {number} index 要解码的顶点的索引。
 * @param {Cartesian2} [result] 存储结果的对象。
 * @returns {Cartesian2} The 解码后的纹理坐标。
 */
TerrainEncoding.prototype.decodeTextureCoordinates = function (
  buffer,
  index,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  if (!defined(result)) {
    result = new Cartesian2();
  }

  index *= this.stride;

  if (this.quantization === TerrainQuantization.BITS12) {
    return AttributeCompression.decompressTextureCoordinates(
      buffer[index + 2],
      result,
    );
  }

  return Cartesian2.fromElements(buffer[index + 4], buffer[index + 5], result);
};

/**
 * 从顶点缓冲区中解码高度。
 *
 * @param {Float32Array} buffer 要解码的缓冲区。
 * @param {number} index 要解码的顶点的索引。
 * @returns {number} The 解码后的高度。
 */
TerrainEncoding.prototype.decodeHeight = function (buffer, index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  index *= this.stride;

  if (this.quantization === TerrainQuantization.BITS12) {
    const zh = AttributeCompression.decompressTextureCoordinates(
      buffer[index + 1],
      cartesian2Scratch,
    );
    return (
      zh.y * (this.maximumHeight - this.minimumHeight) + this.minimumHeight
    );
  }

  return buffer[index + 3];
};

/**
 * 从顶点缓冲区中解码 Web Mercator T 坐标。
 *
 * @param {Float32Array} buffer 要解码的缓冲区。
 * @param {number} index 要解码的顶点的索引。
 * @returns {number} The 解码后的 Web Mercator T 坐标。
 */
TerrainEncoding.prototype.decodeWebMercatorT = function (buffer, index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  index *= this.stride;

  if (this.quantization === TerrainQuantization.BITS12) {
    return AttributeCompression.decompressTextureCoordinates(
      buffer[index + 3],
      cartesian2Scratch,
    ).x;
  }

  return buffer[index + 6];
};

/**
 * 从顶点缓冲区中解码八进制编码的法线。
 *
 * @param {Float32Array} buffer 要解码的缓冲区。
 * @param {number} index 要解码的顶点的索引。
 * @param {Cartesian2} [result] 存储结果的对象。
 * @returns {Cartesian2} The 解码后的八进制编码法线。
 */
TerrainEncoding.prototype.getOctEncodedNormal = function (
  buffer,
  index,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  index = index * this.stride + this._offsetVertexNormal;

  const temp = buffer[index] / 256.0;
  const x = Math.floor(temp);
  const y = (temp - x) * 256.0;

  return Cartesian2.fromElements(x, y, result);
};

/**
 * @param {Float32Array} buffer
 * @param {number} index
 * @param {Cartesian3} result
 * @returns {Cartesian3}
 */
TerrainEncoding.prototype.decodeNormal = function (buffer, index, result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  Check.typeOf.number("index", index);
  Check.typeOf.object("result", result);
  //>>includeEnd('debug');

  const bufferIndex = index * this.stride + this._offsetVertexNormal;
  return AttributeCompression.octDecodeFloat(buffer[bufferIndex], result);
};

/**
 * 从顶点缓冲区中解码大地表面法线。
 *
 * @param {Float32Array} buffer 要解码的缓冲区。
 * @param {number} index 要解码的顶点的索引。
 * @param {Cartesian3} result 存储结果的对象。
 * @returns {Cartesian3} The 解码后的大地表面法线。
 */
TerrainEncoding.prototype.decodeGeodeticSurfaceNormal = function (
  buffer,
  index,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  Check.typeOf.number("index", index);
  Check.typeOf.object("result", result);
  //>>includeEnd('debug');

  index = index * this.stride + this._offsetGeodeticSurfaceNormal;

  result.x = buffer[index];
  result.y = buffer[index + 1];
  result.z = buffer[index + 2];
  return result;
};

/**
 * 计算采样顶点缓冲区的步长和偏移量。
 */
TerrainEncoding.prototype._calculateStrideAndOffsets = function () {
  let vertexStride = 0;

  switch (this.quantization) {
    case TerrainQuantization.BITS12:
      vertexStride += 3;
      break;
    default:
      vertexStride += 6;
  }
  if (this.hasWebMercatorT) {
    vertexStride += 1;
  }
  if (this.hasVertexNormals) {
    this._offsetVertexNormal = vertexStride;
    vertexStride += 1;
  }
  if (this.hasGeodeticSurfaceNormals) {
    this._offsetGeodeticSurfaceNormal = vertexStride;
    vertexStride += 3;
  }

  this.stride = vertexStride;
};

const attributesIndicesNone = {
  position3DAndHeight: 0,
  textureCoordAndEncodedNormals: 1,
  geodeticSurfaceNormal: 2,
};
const attributesIndicesBits12 = {
  compressed0: 0,
  compressed1: 1,
  geodeticSurfaceNormal: 2,
};

/**
 * 获取顶点缓冲区中存储的属性描述符。
 *
 * @param {Float32Array} buffer 顶点缓冲区。
 * @returns {object[]} The 属性。
 */
TerrainEncoding.prototype.getAttributes = function (buffer) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("buffer", buffer);
  //>>includeEnd('debug');

  const datatype = ComponentDatatype.FLOAT;
  const sizeInBytes = ComponentDatatype.getSizeInBytes(datatype);
  const strideInBytes = this.stride * sizeInBytes;
  let offsetInBytes = 0;

  const attributes = [];
  function addAttribute(index, componentsPerAttribute) {
    attributes.push({
      index: index,
      vertexBuffer: buffer,
      componentDatatype: datatype,
      componentsPerAttribute: componentsPerAttribute,
      offsetInBytes: offsetInBytes,
      strideInBytes: strideInBytes,
    });
    offsetInBytes += componentsPerAttribute * sizeInBytes;
  }

  if (this.quantization === TerrainQuantization.NONE) {
    addAttribute(attributesIndicesNone.position3DAndHeight, 4);

    let componentsTexCoordAndNormals = 2;
    componentsTexCoordAndNormals += this.hasWebMercatorT ? 1 : 0;
    componentsTexCoordAndNormals += this.hasVertexNormals ? 1 : 0;
    addAttribute(
      attributesIndicesNone.textureCoordAndEncodedNormals,
      componentsTexCoordAndNormals,
    );

    if (this.hasGeodeticSurfaceNormals) {
      addAttribute(attributesIndicesNone.geodeticSurfaceNormal, 3);
    }
  } else {
    // When there is no webMercatorT or vertex normals, the attribute only needs 3 components: x/y, z/h, u/v.
    // WebMercatorT and vertex normals each take up one component, so if only one of them is present the first
    // attribute gets a 4th component. If both are present, we need an additional attribute that has 1 component.
    const usingAttribute0Component4 =
      this.hasWebMercatorT || this.hasVertexNormals;
    const usingAttribute1Component1 =
      this.hasWebMercatorT && this.hasVertexNormals;
    addAttribute(
      attributesIndicesBits12.compressed0,
      usingAttribute0Component4 ? 4 : 3,
    );

    if (usingAttribute1Component1) {
      addAttribute(attributesIndicesBits12.compressed1, 1);
    }

    if (this.hasGeodeticSurfaceNormals) {
      addAttribute(attributesIndicesBits12.geodeticSurfaceNormal, 3);
    }
  }

  return attributes;
};

/**
 * 获取指向顶点缓冲区中属性位置的索引。
 *
 * @returns {object} The 属性索引。
 */
TerrainEncoding.prototype.getAttributeLocations = function () {
  if (this.quantization === TerrainQuantization.NONE) {
    return attributesIndicesNone;
  }
  return attributesIndicesBits12;
};

/**
 * 克隆 TerrainEncoding 对象。
 *
 * @param {TerrainEncoding} [encoding] 要克隆的编码。
 * @param {TerrainEncoding} [result] 存储克隆编码的对象。
 * @returns {TerrainEncoding|undefined} The 克隆后的编码。
 */
TerrainEncoding.clone = function (encoding, result) {
  if (!defined(encoding)) {
    return undefined;
  }
  if (!defined(result)) {
    result = new TerrainEncoding();
  }

  result.quantization = encoding.quantization;
  result.minimumHeight = encoding.minimumHeight;
  result.maximumHeight = encoding.maximumHeight;
  result.center = Cartesian3.clone(encoding.center);
  result.toScaledENU = Matrix4.clone(encoding.toScaledENU);
  result.fromScaledENU = Matrix4.clone(encoding.fromScaledENU);
  result.matrix = Matrix4.clone(encoding.matrix);
  result.hasVertexNormals = encoding.hasVertexNormals;
  result.hasWebMercatorT = encoding.hasWebMercatorT;
  result.hasGeodeticSurfaceNormals = encoding.hasGeodeticSurfaceNormals;
  result.exaggeration = encoding.exaggeration;
  result.exaggerationRelativeHeight = encoding.exaggerationRelativeHeight;

  result._calculateStrideAndOffsets();

  return result;
};
export default TerrainEncoding;
