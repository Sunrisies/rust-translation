import {
  Check,
  DeveloperError,
  Frozen,
  IndexDatatype,
  WebGLConstants,
  createGuid,
  defined,
  destroyObject,
} from "@cesium/core";
import BufferUsage from "./BufferUsage.js";

/**
 * @private
 */
function Buffer(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", options.context);

  if (!defined(options.typedArray) && !defined(options.sizeInBytes)) {
    throw new DeveloperError(
      "Either options.sizeInBytes or options.typedArray is required.",
    );
  }

  if (defined(options.typedArray) && defined(options.sizeInBytes)) {
    throw new DeveloperError(
      "Cannot pass in both options.sizeInBytes and options.typedArray.",
    );
  }

  if (defined(options.typedArray)) {
    Check.typeOf.object("options.typedArray", options.typedArray);
    Check.typeOf.number(
      "options.typedArray.byteLength",
      options.typedArray.byteLength,
    );
  }

  if (!BufferUsage.validate(options.usage)) {
    throw new DeveloperError("usage is invalid.");
  }
  //>>includeEnd('debug');

  const gl = options.context._gl;
  const bufferTarget = options.bufferTarget;
  const typedArray = options.typedArray;
  let sizeInBytes = options.sizeInBytes;
  const usage = options.usage;
  const hasArray = defined(typedArray);

  if (hasArray) {
    sizeInBytes = typedArray.byteLength;
  }

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThan("sizeInBytes", sizeInBytes, 0);
  //>>includeEnd('debug');

  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferTarget, buffer);
  gl.bufferData(bufferTarget, hasArray ? typedArray : sizeInBytes, usage);
  gl.bindBuffer(bufferTarget, null);

  this._id = createGuid();
  this._gl = gl;
  this._webgl2 = options.context._webgl2;
  this._bufferTarget = bufferTarget;
  this._sizeInBytes = sizeInBytes;
  this._usage = usage;
  this._buffer = buffer;
  this.vertexArrayDestroyable = true;
}

Buffer.createPixelBuffer = function (options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", options.context);
  //>>includeEnd('debug');

  if (!options.context._webgl2) {
    throw new DeveloperError(
      "A WebGL 2 context is required to create PixelBuffers.",
    );
  }

  return new Buffer({
    context: options.context,
    bufferTarget: WebGLConstants.PIXEL_PACK_BUFFER,
    typedArray: options.typedArray,
    sizeInBytes: options.sizeInBytes,
    usage: options.usage,
  });
};

/**
 * 创建一个顶点缓冲区，该缓冲区在 GPU 控制的内存中包含未类型化的顶点数据。
 * <br /><br />
 * 顶点数组定义了顶点的实际组成，例如位置、法线、纹理坐标等，通过解析一个或多个顶点缓冲区中的原始数据来实现。
 * 等等。
 *
 * @param {object} options 一个包含以下属性的对象：
 * @param {Context} options.context 创建缓冲区的上下文
 * @param {ArrayBufferView} [options.typedArray] 包含要复制到缓冲区中的数据类型的数组。
 * @param {number} [options.sizeInBytes] 一个 <code>Number</code>，用于定义缓冲区在字节数上的大小。如果未指定 <options.typedArray>，则必须提供此值。
 * @param {BufferUsage} options.usage 指定缓冲区的预期使用模式。在某些 GL 实现中，这可能会显著影响性能。请参阅 {@link BufferUsage}。
 * @returns {Buffer} The 准备好被附加到顶点数组的顶点缓冲区。
 *
 * @exception {DeveloperError} Must 指定 <options.typedArray> 或 <options.sizeInBytes> 中的一个，但不能同时指定两者。
 * @exception {DeveloperError} The 缓冲区大小必须大于零。
 * @exception {DeveloperError} Invalid <code>usage</code>。
 *
 *
 * @example
 * // 示例 1. 创建一个大小为 16 字节的动态顶点缓冲区。
 * const buffer = Buffer.createVertexBuffer({
 * context : context,
 * sizeInBytes : 16,
 * usage : BufferUsage.DYNAMIC_DRAW
 * });
 *
 * @example
 * // 示例 2. 从三个浮点值创建动态顶点缓冲区。
 * // 复制到顶点缓冲区中的数据在未被
 * // 通过顶点数组解释为顶点之前被视为原始字节。
 * const positionBuffer = buffer.createVertexBuffer({
 * context : context,
 * typedArray : new Float32Array([0, 0, 0]),
 * usage : BufferUsage.STATIC_DRAW
 * });
 *
 * @see {@link https://www.khronos.org/opengles/sdk/docs/man/xhtml/glGenBuffer.xml|glGenBuffer}
 * @see {@link https://www.khronos.org/opengles/sdk/docs/man/xhtml/glBindBuffer.xml|glBindBuffer} with <code>ARRAY_BUFFER</code>
 * @see {@link https://www.khronos.org/opengles/sdk/docs/man/xhtml/glBufferData.xml|glBufferData} with <code>ARRAY_BUFFER</code>
 */
Buffer.createVertexBuffer = function (options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", options.context);
  //>>includeEnd('debug');

  return new Buffer({
    context: options.context,
    bufferTarget: WebGLConstants.ARRAY_BUFFER,
    typedArray: options.typedArray,
    sizeInBytes: options.sizeInBytes,
    usage: options.usage,
  });
};

/**
 * 创建一个索引缓冲区，该缓冲区在 GPU 控制的内存中包含已类型化的索引。
 * <br /><br />
 * 索引缓冲区可以附加到顶点数组上，以选择用于渲染的顶点。
 * <code>Context.draw</code> 可以使用整个索引缓冲区或由偏移量和计数定义的索引缓冲区的子集进行渲染。
 * 一个包含以下属性的对象：
 *
 * @param {object} options 创建缓冲区的上下文
 * @param {Context} options.context 包含要复制到缓冲区中的数据类型的数组。
 * @param {ArrayBufferView} [options.typedArray] 一个 <code>Number</code>，用于定义缓冲区在字节数上的大小。如果未指定 <options.typedArray>，则必须提供此值。
 * @param {number} [options.sizeInBytes] 指定缓冲区的预期使用模式。在某些 GL 实现中，这可能会显著影响性能。请参阅 {@link BufferUsage}。
 * @param {BufferUsage} options.usage 缓冲区中索引的数据类型。
 * @param {IndexDatatype} options.indexDatatype 索引缓冲区，准备好被附加到顶点数组上。
 * @returns {Buffer} The 指定 <options.typedArray> 或 <options.sizeInBytes> 中的一个，但不能同时指定两者。
 *
 * @exception {DeveloperError} Must specify either <options.typedArray> or <options.sizeInBytes>, but not both.
 * @exception {DeveloperError} IndexDatatype.UNSIGNED_INT 需要 OES_element_index_uint 参数，但本系统不支持。请检查 context.elementIndexUint。
 * @exception {DeveloperError} The 字节大小必须大于零。
 * @exception {DeveloperError} Invalid <code>usage</code>。
 * @exception {DeveloperError} Invalid <code>indexDatatype</code>。
 *
 *
 * @example
 * // 示例 1. 创建一个包含无符号短整数的流索引缓冲区，其
 * 大小为 16 字节。
 * const buffer = Buffer.createIndexBuffer({
 * context : context,
 * sizeInBytes : 16,
 * usage : BufferUsage.STREAM_DRAW,
 * indexDatatype : IndexDatatype.UNSIGNED_SHORT
 * });
 *
 * @example
 * // 示例 2. 创建一个包含三个无符号短整数的静态索引缓冲区。
 * const buffer = Buffer.createIndexBuffer({
 * context : context,
 * typedArray : new Uint16Array([0, 1, 2]),
 * usage : BufferUsage.STATIC_DRAW,
 * indexDatatype : IndexDatatype.UNSIGNED_SHORT
 * });
 *
 * @see {@link https://www.khronos.org/opengles/sdk/docs/man/xhtml/glGenBuffer.xml|glGenBuffer}
 * @see {@link https://www.khronos.org/opengles/sdk/docs/man/xhtml/glBindBuffer.xml|glBindBuffer} with <code>ELEMENT_ARRAY_BUFFER</code>
 * @see {@link https://www.khronos.org/opengles/sdk/docs/man/xhtml/glBufferData.xml|glBufferData} with <code>ELEMENT_ARRAY_BUFFER</code>
 */
Buffer.createIndexBuffer = function (options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", options.context);

  if (!IndexDatatype.validate(options.indexDatatype)) {
    throw new DeveloperError("Invalid indexDatatype.");
  }

  if (
    options.indexDatatype === IndexDatatype.UNSIGNED_INT &&
    !options.context.elementIndexUint
  ) {
    throw new DeveloperError(
      "IndexDatatype.UNSIGNED_INT requires OES_element_index_uint, which is not supported on this system.  Check context.elementIndexUint.",
    );
  }
  //>>includeEnd('debug');

  const context = options.context;
  const indexDatatype = options.indexDatatype;

  const bytesPerIndex = IndexDatatype.getSizeInBytes(indexDatatype);
  const buffer = new Buffer({
    context: context,
    bufferTarget: WebGLConstants.ELEMENT_ARRAY_BUFFER,
    typedArray: options.typedArray,
    sizeInBytes: options.sizeInBytes,
    usage: options.usage,
  });

  const numberOfIndices = buffer.sizeInBytes / bytesPerIndex;

  Object.defineProperties(buffer, {
    indexDatatype: {
      get: function () {
        return indexDatatype;
      },
    },
    bytesPerIndex: {
      get: function () {
        return bytesPerIndex;
      },
    },
    numberOfIndices: {
      get: function () {
        return numberOfIndices;
      },
    },
  });

  return buffer;
};

Object.defineProperties(Buffer.prototype, {
  sizeInBytes: {
    get: function () {
      return this._sizeInBytes;
    },
  },

  usage: {
    get: function () {
      return this._usage;
    },
  },
});

Buffer.prototype._getBuffer = function () {
  return this._buffer;
};

Buffer.prototype._bind = function () {
  const gl = this._gl;
  const target = this._bufferTarget;
  gl.bindBuffer(target, this._buffer);
};

Buffer.prototype._unBind = function () {
  const gl = this._gl;
  const target = this._bufferTarget;
  gl.bindBuffer(target, null);
};

Buffer.prototype.copyFromArrayView = function (arrayView, offsetInBytes) {
  offsetInBytes = offsetInBytes ?? 0;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("arrayView", arrayView);
  Check.typeOf.number.lessThanOrEquals(
    "offsetInBytes + arrayView.byteLength",
    offsetInBytes + arrayView.byteLength,
    this._sizeInBytes,
  );
  //>>includeEnd('debug');

  const gl = this._gl;
  const target = this._bufferTarget;
  gl.bindBuffer(target, this._buffer);
  gl.bufferSubData(target, offsetInBytes, arrayView);
  gl.bindBuffer(target, null);
};

Buffer.prototype.copyFromBuffer = function (
  readBuffer,
  readOffset,
  writeOffset,
  sizeInBytes,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!this._webgl2) {
    throw new DeveloperError("A WebGL 2 context is required.");
  }
  if (!defined(readBuffer)) {
    throw new DeveloperError("readBuffer must be defined.");
  }
  if (!defined(sizeInBytes) || sizeInBytes <= 0) {
    throw new DeveloperError(
      "sizeInBytes must be defined and be greater than zero.",
    );
  }
  if (
    !defined(readOffset) ||
    readOffset < 0 ||
    readOffset + sizeInBytes > readBuffer._sizeInBytes
  ) {
    throw new DeveloperError(
      "readOffset must be greater than or equal to zero and readOffset + sizeInBytes must be less than of equal to readBuffer.sizeInBytes.",
    );
  }
  if (
    !defined(writeOffset) ||
    writeOffset < 0 ||
    writeOffset + sizeInBytes > this._sizeInBytes
  ) {
    throw new DeveloperError(
      "writeOffset must be greater than or equal to zero and writeOffset + sizeInBytes must be less than of equal to this.sizeInBytes.",
    );
  }
  if (
    this._buffer === readBuffer._buffer &&
    ((writeOffset >= readOffset && writeOffset < readOffset + sizeInBytes) ||
      (readOffset > writeOffset && readOffset < writeOffset + sizeInBytes))
  ) {
    throw new DeveloperError(
      "When readBuffer is equal to this, the ranges [readOffset + sizeInBytes) and [writeOffset, writeOffset + sizeInBytes) must not overlap.",
    );
  }
  if (
    (this._bufferTarget === WebGLConstants.ELEMENT_ARRAY_BUFFER &&
      readBuffer._bufferTarget !== WebGLConstants.ELEMENT_ARRAY_BUFFER) ||
    (this._bufferTarget !== WebGLConstants.ELEMENT_ARRAY_BUFFER &&
      readBuffer._bufferTarget === WebGLConstants.ELEMENT_ARRAY_BUFFER)
  ) {
    throw new DeveloperError(
      "Can not copy an index buffer into another buffer type.",
    );
  }
  //>>includeEnd('debug');

  const readTarget = WebGLConstants.COPY_READ_BUFFER;
  const writeTarget = WebGLConstants.COPY_WRITE_BUFFER;

  const gl = this._gl;
  gl.bindBuffer(writeTarget, this._buffer);
  gl.bindBuffer(readTarget, readBuffer._buffer);
  gl.copyBufferSubData(
    readTarget,
    writeTarget,
    readOffset,
    writeOffset,
    sizeInBytes,
  );
  gl.bindBuffer(writeTarget, null);
  gl.bindBuffer(readTarget, null);
};

Buffer.prototype.getBufferData = function (
  arrayView,
  sourceOffset,
  destinationOffset,
  length,
) {
  sourceOffset = sourceOffset ?? 0;
  destinationOffset = destinationOffset ?? 0;

  //>>includeStart('debug', pragmas.debug);
  if (!this._webgl2) {
    throw new DeveloperError("A WebGL 2 context is required.");
  }
  if (!defined(arrayView)) {
    throw new DeveloperError("arrayView is required.");
  }

  let copyLength;
  let elementSize;
  let arrayLength = arrayView.byteLength;
  if (!defined(length)) {
    if (defined(arrayLength)) {
      copyLength = arrayLength - destinationOffset;
      elementSize = 1;
    } else {
      arrayLength = arrayView.length;
      copyLength = arrayLength - destinationOffset;
      elementSize = arrayView.BYTES_PER_ELEMENT;
    }
  } else {
    copyLength = length;
    if (defined(arrayLength)) {
      elementSize = 1;
    } else {
      arrayLength = arrayView.length;
      elementSize = arrayView.BYTES_PER_ELEMENT;
    }
  }

  if (destinationOffset < 0 || destinationOffset > arrayLength) {
    throw new DeveloperError(
      "destinationOffset must be greater than zero and less than the arrayView length.",
    );
  }
  if (destinationOffset + copyLength > arrayLength) {
    throw new DeveloperError(
      "destinationOffset + length must be less than or equal to the arrayViewLength.",
    );
  }
  if (sourceOffset < 0 || sourceOffset > this._sizeInBytes) {
    throw new DeveloperError(
      "sourceOffset must be greater than zero and less than the buffers size.",
    );
  }
  if (sourceOffset + copyLength * elementSize > this._sizeInBytes) {
    throw new DeveloperError(
      "sourceOffset + length must be less than the buffers size.",
    );
  }
  //>>includeEnd('debug');

  const gl = this._gl;
  const target = WebGLConstants.COPY_READ_BUFFER;
  gl.bindBuffer(target, this._buffer);
  gl.getBufferSubData(
    target,
    sourceOffset,
    arrayView,
    destinationOffset,
    length,
  );
  gl.bindBuffer(target, null);
};

Buffer.prototype.isDestroyed = function () {
  return false;
};

Buffer.prototype.destroy = function () {
  this._gl.deleteBuffer(this._buffer);
  return destroyObject(this);
};
export default Buffer;
