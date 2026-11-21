import { Check, Frozen, PixelFormat, defined } from "@cesium/core";
import ContextLimits from "../../Renderer/ContextLimits.js";
import Sampler from "../../Renderer/Sampler.js";
import Texture from "../../Renderer/Texture.js";
import TextureMagnificationFilter from "../../Renderer/TextureMagnificationFilter.js";
import TextureMinificationFilter from "../../Renderer/TextureMinificationFilter.js";
import TextureWrap from "../../Renderer/TextureWrap.js";

// glTF does not allow an index value of 65535 because this is the primitive
// restart value in some APIs.
const MAX_GLTF_UINT16_INDEX = 65534;
const MAX_GLTF_UINT8_INDEX = 255;

/**
 * 用于处理索引和顶点处理底层细节的类
 * CESIUM_primitive_outline 扩展的属性
 * <p>
 * 为了渲染轮廓，使用了三次查找纹理，每次针对一个三角形每条边
 * 顶点。为了正确渲染，三个顶点在计算轮廓（纹理）坐标时必须遵循相同的顺序
 * 三条边的排序。有时这不可行，因为多个三角形共享的一个顶点可能会受到限制。在这种情况下，需要复制顶点并更新索引，直到能够定义有效的轮廓坐标
 * 实体。
 * 具有以下属性的对象：
 * copied and indices are updated until valid outline coordinates can be
 * defined.
 * </p>
 *
 * @see {@link https://www.researchgate.net/publication/220067637_Fast_and_versatile_texture-based_wireframe_rendering|Fast and versatile texture-based wireframe rendering}
 *
 * @alias PrimitiveOutlineGenerator
 * @constructor
 *
 * @param {number} options Object with the following properties:
 * @param {Uint8Array|Uint16Array|Uint32Array} options.triangleIndices 原三角形的索引。构造函数负责管理此类型数组，因为它会在内部被修改。使用 updatedTriangleIndices 获取器可以获取最终结果
 * @param {number[]} options.outlineIndices 来自 CESIUM_primitive_outline 扩展的三角形中边的索引
 * @param {number} options.originalVertexCount 原顶点数
 * @example
 * // 构造函数将计算更新后的索引并生成轮廓坐标
 * // 坐标。
 * const outlineGenerator = new PrimitiveOutlineGenerator({
 * triangleIndices: primitive.indices.typedArray,
 * outlineIndices: outlineIndices,
 * originalVertexCount: primitive.attributes[0].count
 * });
 *
 * // 调用者必须更新索引（数据类型可能已升级！）
 * primitive.indices.typedArray = outlineGenerator.updatedTriangleIndices;
 * primitive.indices.indexDatatype =
 * IndexDatatype.fromTypedArray(primitive.indices.typedArray);
 *
 * // 为生成的轮廓坐标创建新属性
 * primitive.outlineCoordinates = new ModelComponents.Attribute();
 * // ... 初始化为 vec3 属性
 * primitive.outlineCoordinates.typedArray =
 * outlineGenerator.outlineCoordinates;
 *
 * // 更新属性
 * const attribute = primitive.attributes[i];
 * attribute.typedArray = outlineGenerator.updateAttribute(
 * attribute.typedArray
 * );
 *
 * @private
 */
function PrimitiveOutlineGenerator(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const triangleIndices = options.triangleIndices;
  const outlineIndices = options.outlineIndices;
  const originalVertexCount = options.originalVertexCount;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.triangleIndices", triangleIndices);
  Check.typeOf.object("options.outlineIndices", outlineIndices);
  Check.typeOf.number("options.originalVertexCount", originalVertexCount);
  //>>includeEnd('debug');

  /**
   * 三角形索引。将就地修改。
   *
   * @type {Uint8Array|Uint16Array|Uint32Array}
   *
   * @private
   */
  this._triangleIndices = triangleIndices;

  /**
   * 原顶点数
   *
   * @type {number}
   *
   * @private
   */
  this._originalVertexCount = originalVertexCount;

  /**
   * 轮廓索引表示三角形网格中必须绘制轮廓的边。这作为哈希集合存储，以便高效检查边是否存在
   * 轮廓纹理坐标存储的类型数组
   * 一旦计算完成。此类型数组应转换为顶点属性
   *
   * @type {EdgeSet}
   *
   * @private
   */
  this._edges = new EdgeSet(outlineIndices, originalVertexCount);

  /**
   * The typed array that will store the outline texture coordinates
   * once computed. This typed array should be turned into a vertex attribute
   * 在渲染轮廓时。
   *
   * @type {Float32Array}
   *
   * @private
   */
  this._outlineCoordinatesTypedArray = undefined;

  /**
   * 包含必须被复制并添加到列表中的任何顶点的索引的数组。
   * 生成轮廓后的更新后的三角形索引。调用者负责
   *
   * @type {number[]}
   *
   * @private
   */
  this._extraVertices = [];

  initialize(this);
}

Object.defineProperties(PrimitiveOutlineGenerator.prototype, {
  /**
   * 更新基元的索引以使用此数组。
   * 负责将计算出的轮廓坐标转换为用于渲染的 vec3 属性。
   *
   * @memberof PrimitiveOutlineGenerator.prototype
   *
   * @type {Uint8Array|Uint16Array|Uint32Array}
   * @readonly
   *
   * @private
   */
  updatedTriangleIndices: {
    get: function () {
      return this._triangleIndices;
    },
  },

  /**
   * 计算出的轮廓坐标。调用者负责
   * 将其转换为用于渲染的 vec3 属性。
   *
   * @memberof PrimitiveOutlineGenerator.prototype
   *
   * @type {Float32Array}
   * @readonly
   *
   * @private
   */
  outlineCoordinates: {
    get: function () {
      return this._outlineCoordinatesTypedArray;
    },
  },
});

/**
 * 从 CESIUM_primitive_outline 扩展数据中初始化轮廓生成器。这会更新三角形索引并生成轮廓坐标，但不更新其他属性（参见
 * {@link PrimitiveOutlineGenerator#updateAttribute})
 * 轮廓生成器
 * {@link PrimitiveOutlineGenerator#updateAttribute})
 *
 * @param {PrimitiveOutlineGenerator} outlineGenerator 计算，则返回一个顶点以便复制。
 *
 * @private
 */
function initialize(outlineGenerator) {
  // triangle indices may be extended from 16-bits to 32 bits if needed.
  let triangleIndices = outlineGenerator._triangleIndices;

  const edges = outlineGenerator._edges;
  const outlineCoordinates = [];
  const extraVertices = outlineGenerator._extraVertices;
  const vertexCount = outlineGenerator._originalVertexCount;

  // Dictionary of unmatchable vertex index -> copied vertex index. This is
  // used so we don't copy the same vertex more than necessary.
  const vertexCopies = {};

  // For each triangle, adjust vertex data so that the correct edges are outlined.
  for (let i = 0; i < triangleIndices.length; i += 3) {
    let i0 = triangleIndices[i];
    let i1 = triangleIndices[i + 1];
    let i2 = triangleIndices[i + 2];

    // Check which edges need to be outlined based on the contents of the
    // outline indices from the extension.
    const all = false; // set this to true to draw a full wireframe.
    const hasEdge01 = all || edges.hasEdge(i0, i1);
    const hasEdge12 = all || edges.hasEdge(i1, i2);
    const hasEdge20 = all || edges.hasEdge(i2, i0);

    // Attempt to compute outline coordinates. If no consistent ordering of
    // edges can be computed (due to constraints from adjacent faces), the
    // first attempt may fail. In such cases, make a copy of a vertex and
    // try again. This relaxes the constraints, so the while loop will
    // eventually finish.
    let unmatchableVertexIndex = matchAndStoreCoordinates(
      outlineCoordinates,
      i0,
      i1,
      i2,
      hasEdge01,
      hasEdge12,
      hasEdge20,
    );
    while (defined(unmatchableVertexIndex)) {
      // Copy the unmatchable index and try again.
      let copy = vertexCopies[unmatchableVertexIndex];

      // Only copy if we haven't already
      if (!defined(copy)) {
        // The new vertex will appear at the end of the vertex list
        copy = vertexCount + extraVertices.length;

        // Sometimes the copied vertex will in turn be a copy, so search
        // for the original one
        let original = unmatchableVertexIndex;
        while (original >= vertexCount) {
          original = extraVertices[original - vertexCount];
        }

        // Store the original vertex that needs to be copied
        extraVertices.push(original);

        // mark that we've seen this unmatchable vertex before so we don't
        // copy it multiple times.
        vertexCopies[unmatchableVertexIndex] = copy;
      }

      // Corner case: copying a vertex may overflow the range of an
      // 8- or 16- bit index buffer, so upgrade to a larger data type.
      if (
        copy > MAX_GLTF_UINT16_INDEX &&
        (triangleIndices instanceof Uint16Array ||
          triangleIndices instanceof Uint8Array)
      ) {
        triangleIndices = new Uint32Array(triangleIndices);
      } else if (
        copy > MAX_GLTF_UINT8_INDEX &&
        triangleIndices instanceof Uint8Array
      ) {
        triangleIndices = new Uint16Array(triangleIndices);
      }

      // Update the triangle indices buffer to use the copied vertex instead
      // of the original one.
      if (unmatchableVertexIndex === i0) {
        i0 = copy;
        triangleIndices[i] = copy;
      } else if (unmatchableVertexIndex === i1) {
        i1 = copy;
        triangleIndices[i + 1] = copy;
      } else {
        i2 = copy;
        triangleIndices[i + 2] = copy;
      }

      // Attempt to generate outline coordinates again. This is more likely
      // to succeed since the copied vertex has no constraints on which order
      // of the 3 edges to use.
      unmatchableVertexIndex = matchAndStoreCoordinates(
        outlineCoordinates,
        i0,
        i1,
        i2,
        hasEdge01,
        hasEdge12,
        hasEdge20,
      );
    }
  }

  // Store the triangle indices in case we had to expand to 32-bit indices
  outlineGenerator._triangleIndices = triangleIndices;
  outlineGenerator._outlineCoordinatesTypedArray = new Float32Array(
    outlineCoordinates,
  );
}

/**
 * 存储计算出的轮廓坐标的数组。每个顶点有 3 个分量。该数组将就地修改。
 * 三角形的第一个顶点的索引。
 * 三角形的第二个顶点的索引。
 *
 * @param {number[]} outlineCoordinates 三角形的第三个顶点的索引。
 * @param {number} i0 三角形顶点 0 和 1 之间的轮廓边是否存在。
 * @param {number} i1 三角形顶点 1 和 2 之间的轮廓边是否存在。
 * @param {number} i2 三角形顶点 2 和 0 之间的轮廓边是否存在。
 * @param {boolean} hasEdge01 如果三角形顶点 0 和 1 之间存在轮廓边，则返回该边的索引；否则返回最受限顶点的索引 i0、i1 或 i2。否则，函数返回 undefined 表示匹配成功。
 * @param {boolean} hasEdge12 每个顶点有三个坐标：a、b 和 c。
 * @param {boolean} hasEdge20 a 是适用于该顶点边 2-0 的坐标。
 * @returns {number} If b 是适用于该顶点边 0-1 的坐标。
 *
 * @private
 */
function matchAndStoreCoordinates(
  outlineCoordinates,
  i0,
  i1,
  i2,
  hasEdge01,
  hasEdge12,
  hasEdge20,
) {
  const a0 = hasEdge20 ? 1.0 : 0.0;
  const b0 = hasEdge01 ? 1.0 : 0.0;
  const c0 = 0.0;

  const i0Mask = computeOrderMask(outlineCoordinates, i0, a0, b0, c0);
  if (i0Mask === 0) {
    return i0;
  }

  const a1 = 0.0;
  const b1 = hasEdge01 ? 1.0 : 0.0;
  const c1 = hasEdge12 ? 1.0 : 0.0;

  const i1Mask = computeOrderMask(outlineCoordinates, i1, a1, b1, c1);
  if (i1Mask === 0) {
    return i1;
  }

  const a2 = hasEdge20 ? 1.0 : 0.0;
  const b2 = 0.0;
  const c2 = hasEdge12 ? 1.0 : 0.0;

  const i2Mask = computeOrderMask(outlineCoordinates, i2, a2, b2, c2);
  if (i2Mask === 0) {
    return i2;
  }

  const workingOrders = i0Mask & i1Mask & i2Mask;

  let a, b, c;

  if (workingOrders & (1 << 0)) {
    // 0 - abc
    a = 0;
    b = 1;
    c = 2;
  } else if (workingOrders & (1 << 1)) {
    // 1 - acb
    a = 0;
    c = 1;
    b = 2;
  } else if (workingOrders & (1 << 2)) {
    // 2 - bac
    b = 0;
    a = 1;
    c = 2;
  } else if (workingOrders & (1 << 3)) {
    // 3 - bca
    b = 0;
    c = 1;
    a = 2;
  } else if (workingOrders & (1 << 4)) {
    // 4 - cab
    c = 0;
    a = 1;
    b = 2;
  } else if (workingOrders & (1 << 5)) {
    // 5 - cba
    c = 0;
    b = 1;
    a = 2;
  } else {
    // No ordering works. Report the most constrained vertex (i.e. the one with
    // fewest valid orderings) as unmatched so we copy that one.
    const i0ValidOrderCount = popcount6Bit(i0Mask);
    const i1ValidOrderCount = popcount6Bit(i1Mask);
    const i2ValidOrderCount = popcount6Bit(i2Mask);
    if (
      i0ValidOrderCount < i1ValidOrderCount &&
      i0ValidOrderCount < i2ValidOrderCount
    ) {
      return i0;
    } else if (i1ValidOrderCount < i2ValidOrderCount) {
      return i1;
    }
    return i2;
  }

  // We found a valid ordering of the edges, so store the outline coordinates
  // for this triangle.
  const i0Start = i0 * 3;
  outlineCoordinates[i0Start + a] = a0;
  outlineCoordinates[i0Start + b] = b0;
  outlineCoordinates[i0Start + c] = c0;

  const i1Start = i1 * 3;
  outlineCoordinates[i1Start + a] = a1;
  outlineCoordinates[i1Start + b] = b1;
  outlineCoordinates[i1Start + c] = c1;

  const i2Start = i2 * 3;
  outlineCoordinates[i2Start + a] = a2;
  outlineCoordinates[i2Start + b] = b2;
  outlineCoordinates[i2Start + c] = c2;

  // successful match
  return undefined;
}

/**
 * c 是适用于该顶点边 1-2 的坐标。
 * 所有边都被高亮的单个三角形：
 * 边 0-1 /     \ 边 2-0
 * | 0 | 1 | 1 |    边 1-2      | 1 | 0 | 1 |
 *
 * 坐标 a、b 和 c 有 6 种可能的顺序：
 *
 *                 | a | b | c |
 *                 | 1 | 1 | 0 |
 *                       0
 *                      / \
 *                     /   \
 * 0 - abc
 *                   /       \
 *                  /         \
 * | a | b | c |   1-----------2   | a | b | c |
 * 1 - acb
 *
 * 坐标 a、b 和 c 有 6 种可能的顺序：
 * 2 - bac
 * 3 - bca
 * 4 - cab
 * 5 - cba
 * 6 - abc
 * 所有顶点必须使用_相同的顺序_，才能正确渲染边。因此，我们为每个顶点计算一个位掩码，其中每个位置上的位表示该顺序对该顶点是否有效（即不与已分配的坐标冲突）。
 *
 * All vertices must use the _same ordering_ for the edges to be rendered
 * correctly. So we compute a bitmask for each vertex, where the bit at
 * each position indicates whether that ordering works (i.e. doesn't
 * conflict with already-assigned coordinates) for that vertex.
 *
 * 然后我们可以通过
 * 按位与运算
 *
 * @param {number[]} outlineCoordinates 轮廓坐标数组
 * @param {number} vertexIndex 用于计算掩码的顶点的索引
 * @param {number} a 边 2-0 的轮廓坐标
 * @param {number} b 边 0-1 的轮廓坐标
 * @param {number} c 边 1-2 的轮廓坐标
 * @returns {number} A 6位位掩码，其中1表示对应的排序有效。
 *
 * @private
 */
function computeOrderMask(outlineCoordinates, vertexIndex, a, b, c) {
  const startIndex = vertexIndex * 3;
  const first = outlineCoordinates[startIndex];
  const second = outlineCoordinates[startIndex + 1];
  const third = outlineCoordinates[startIndex + 2];

  // If one coordinate is undefined, they all are since matchAndStoreCoordinates sets
  // all 3 components at once. In this case, all orderings are fine.
  if (!defined(first)) {
    return 0b111111;
  }

  return (
    ((first === a && second === b && third === c) << 0) |
    ((first === a && second === c && third === b) << 1) |
    ((first === b && second === a && third === c) << 2) |
    ((first === b && second === c && third === a) << 3) |
    ((first === c && second === a && third === b) << 4) |
    ((first === c && second === b && third === a) << 5)
  );
}

/**
 * 计算6位整数（值0-63）的 popcount。这是
 * 该数值二进制表示中1的个数。
 *
 * @param {number} value 用于计算popcount的值
 * @returns {number} The 数值二进制表示中1的个数
 *
 * @private
 */
function popcount6Bit(value) {
  return (
    (value & 1) +
    ((value >> 1) & 1) +
    ((value >> 2) & 1) +
    ((value >> 3) & 1) +
    ((value >> 4) & 1) +
    ((value >> 5) & 1)
  );
}

/**
 * 计算轮廓坐标后，某些顶点可能需要被
 * 复制并添加到顶点列表的末尾。此函数会更新
 * 单个属性的类型数组（例如 POSITION 或 NORMAL）。
 *
 * @param {Uint8Array|Int8Array|Uint16Array|Int16Array|Uint32Array|Int32Array|Float32Array} attributeTypedArray 要更新的属性值。此函数将拥有该类型数组的所有权
 * @returns {Uint8Array|Int8Array|Uint16Array|Int16Array|Uint32Array|Int32Array|Float32Array} A 包含现有属性值以及末尾复制值的新的类型数组。
 *
 * @private
 */
PrimitiveOutlineGenerator.prototype.updateAttribute = function (
  attributeTypedArray,
) {
  const extraVertices = this._extraVertices;

  const originalLength = attributeTypedArray.length;

  // This is a stride in number of typed elements. For example, a VEC3 would
  // have a stride of 3 (floats)
  const stride = originalLength / this._originalVertexCount;

  const extraVerticesLength = extraVertices.length;

  // Make a larger typed array of the same type as the input
  const ArrayType = attributeTypedArray.constructor;
  const result = new ArrayType(
    attributeTypedArray.length + extraVerticesLength * stride,
  );

  // Copy original vertices
  result.set(attributeTypedArray);

  // Copy the vertices added for outlining
  for (let i = 0; i < extraVerticesLength; i++) {
    const sourceIndex = extraVertices[i] * stride;
    const resultIndex = originalLength + i * stride;
    for (let j = 0; j < stride; j++) {
      result[resultIndex + j] = result[sourceIndex + j];
    }
  }

  return result;
};

/**
 * 创建用于渲染轮廓的 mip 映射查找纹理。该纹理是
 * 固定的，因此会在上下文中被缓存。
 *
 * @param {Context} context 用于创建纹理的上下文
 * @returns {Texture} The 轮廓查找纹理。
 *
 * @private
 */
PrimitiveOutlineGenerator.createTexture = function (context) {
  let cache = context.cache.modelOutliningCache;
  if (!defined(cache)) {
    cache = context.cache.modelOutliningCache = {};
  }

  if (defined(cache.outlineTexture)) {
    return cache.outlineTexture;
  }

  const maxSize = Math.min(4096, ContextLimits.maximumTextureSize);

  let size = maxSize;
  const levelZero = createMipLevel(size);

  const mipLevels = [];

  while (size > 1) {
    size >>= 1;
    mipLevels.push(createMipLevel(size));
  }

  const texture = new Texture({
    context: context,
    source: {
      arrayBufferView: levelZero,
      mipLevels: mipLevels,
    },
    width: maxSize,
    height: 1,
    pixelFormat: PixelFormat.LUMINANCE,
    sampler: new Sampler({
      wrapS: TextureWrap.CLAMP_TO_EDGE,
      wrapT: TextureWrap.CLAMP_TO_EDGE,
      minificationFilter: TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
      magnificationFilter: TextureMagnificationFilter.LINEAR,
    }),
  });

  cache.outlineTexture = texture;

  return texture;
};

/**
 * 创建单个 mip 级别的轮廓查找纹理。这是一个
 * 大部分为0值的纹理，除了最后一个值更亮以表示
 * 轮廓。
 *
 * @param {number} size 此 mip 级别的纹理宽度
 * @returns {Uint8Array} A 包含 mip 级别 texels 的类型数组
 *
 * @private
 */
function createMipLevel(size) {
  const texture = new Uint8Array(size);

  // This lookup texture creates an outline with width 0.75 px in screen space.
  texture[size - 1] = 192;

  // As we reach the top of the mip pyramid, a single set pixel becomes a
  // significant portion of the texture. This doesn't look great when zoomed
  // out, so attenuate the value by 50% at each level.
  if (size === 8) {
    texture[size - 1] = 96;
  } else if (size === 4) {
    texture[size - 1] = 48;
  } else if (size === 2) {
    texture[size - 1] = 24;
  } else if (size === 1) {
    texture[size - 1] = 12;
  }
  return texture;
}

/**
 * 一个哈希集，用于快速判断两个顶点之间是否存在边。
 * 元素个数为偶数的顶点索引数组，每对索引定义一个边。
 *
 * @alias EdgeSet
 * @constructor
 *
 * @param {number[]} edgeIndices 原始顶点数。用于计算哈希函数。
 * @param {number} originalVertexCount 原 primitives 中的顶点数。用于计算
 *
 * @private
 */
function EdgeSet(edgeIndices, originalVertexCount) {
  /**
   * Original number of vertices in the primitive. This is used for computing
   * 哈希键。
   *
   * @type {number}
   *
   * @private
   */
  this._originalVertexCount = originalVertexCount;

  /**
   * 用于存储边的内部哈希集。边的哈希方式如下：
   * <p>
   * smallerVertexIndex * originalVertexCount + biggerVertexIndex
   * <p>
   * @type {Set}
   *
   * @private
   */
  this._edges = new Set();
  for (let i = 0; i < edgeIndices.length; i += 2) {
    const a = edgeIndices[i];
    const b = edgeIndices[i + 1];
    const small = Math.min(a, b);
    const big = Math.max(a, b);
    const hash = small * this._originalVertexCount + big;
    this._edges.add(hash);
  }
}

/**
 * 检查集合中是否存在边。输入顶点的顺序
 * 并不重要。
 * @param {number} a 第一个索引
 * @param {number} b 第二个索引
 * @returns {boolean} true 如果 a 和 b 之间存在边
 *
 * @private
 */
EdgeSet.prototype.hasEdge = function (a, b) {
  const small = Math.min(a, b);
  const big = Math.max(a, b);
  const hash = small * this._originalVertexCount + big;
  return this._edges.has(hash);
};

export default PrimitiveOutlineGenerator;