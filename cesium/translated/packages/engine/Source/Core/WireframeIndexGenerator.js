import { IndexDatatype, PrimitiveType, defined } from "@cesium/core";

/**
 * 用于生成模型线框索引的函数。这些索引以类型数组的形式输出，随后可将其放入缓冲区中进行渲染。
 * 为primitive生成线框索引缓冲区，可以通过重新生成现有索引来实现，
 *
 * @namespace WireframeIndexGenerator
 * @private
 */
const WireframeIndexGenerator = {};

function createWireframeFromTriangles(vertexCount) {
  const wireframeIndices = IndexDatatype.createTypedArray(
    vertexCount,
    vertexCount * 2,
  );
  const length = vertexCount;
  let index = 0;
  for (let i = 0; i < length; i += 3) {
    wireframeIndices[index++] = i;
    wireframeIndices[index++] = i + 1;
    wireframeIndices[index++] = i + 1;
    wireframeIndices[index++] = i + 2;
    wireframeIndices[index++] = i + 2;
    wireframeIndices[index++] = i;
  }

  return wireframeIndices;
}

function createWireframeFromTriangleIndices(vertexCount, originalIndices) {
  const originalIndicesCount = originalIndices.length;
  const wireframeIndices = IndexDatatype.createTypedArray(
    vertexCount,
    originalIndicesCount * 2,
  );
  let index = 0;
  for (let i = 0; i < originalIndicesCount; i += 3) {
    const point0 = originalIndices[i];
    const point1 = originalIndices[i + 1];
    const point2 = originalIndices[i + 2];

    wireframeIndices[index++] = point0;
    wireframeIndices[index++] = point1;
    wireframeIndices[index++] = point1;
    wireframeIndices[index++] = point2;
    wireframeIndices[index++] = point2;
    wireframeIndices[index++] = point0;
  }

  return wireframeIndices;
}

function createWireframeFromTriangleStrip(vertexCount) {
  const numberOfTriangles = vertexCount - 2;
  const wireframeIndicesCount = 2 + numberOfTriangles * 4;
  const wireframeIndices = IndexDatatype.createTypedArray(
    vertexCount,
    wireframeIndicesCount,
  );
  let index = 0;

  // Handle the first edge
  wireframeIndices[index++] = 0;
  wireframeIndices[index++] = 1;

  // Add two edges for every triangle in the strip
  for (let i = 0; i < numberOfTriangles; i++) {
    wireframeIndices[index++] = i + 1;
    wireframeIndices[index++] = i + 2;
    wireframeIndices[index++] = i + 2;
    wireframeIndices[index++] = i;
  }

  return wireframeIndices;
}

function createWireframeFromTriangleStripIndices(vertexCount, originalIndices) {
  const originalIndicesCount = originalIndices.length;
  const numberOfTriangles = originalIndicesCount - 2;
  const wireframeIndicesCount = 2 + numberOfTriangles * 4;
  const wireframeIndices = IndexDatatype.createTypedArray(
    vertexCount,
    wireframeIndicesCount,
  );
  let index = 0;

  // Handle the first edge
  wireframeIndices[index++] = originalIndices[0];
  wireframeIndices[index++] = originalIndices[1];

  // Add two edges for every triangle in the strip
  for (let i = 0; i < numberOfTriangles; i++) {
    const point0 = originalIndices[i];
    const point1 = originalIndices[i + 1];
    const point2 = originalIndices[i + 2];

    wireframeIndices[index++] = point1;
    wireframeIndices[index++] = point2;
    wireframeIndices[index++] = point2;
    wireframeIndices[index++] = point0;
  }

  return wireframeIndices;
}

function createWireframeFromTriangleFan(vertexCount) {
  const numberOfTriangles = vertexCount - 2;
  const wireframeIndicesCount = 2 + numberOfTriangles * 4;
  const wireframeIndices = IndexDatatype.createTypedArray(
    vertexCount,
    wireframeIndicesCount,
  );
  let index = 0;

  // Handle the first edge
  wireframeIndices[index++] = 0;
  wireframeIndices[index++] = 1;

  // Add two edges for every triangle in the fan
  for (let i = 0; i < numberOfTriangles; i++) {
    wireframeIndices[index++] = i + 1;
    wireframeIndices[index++] = i + 2;
    wireframeIndices[index++] = i + 2;
    wireframeIndices[index++] = 0;
  }

  return wireframeIndices;
}

function createWireframeFromTriangleFanIndices(vertexCount, originalIndices) {
  const originalIndicesCount = originalIndices.length;
  const numberOfTriangles = originalIndicesCount - 2;
  const wireframeIndicesCount = 2 + numberOfTriangles * 4;
  const wireframeIndices = IndexDatatype.createTypedArray(
    vertexCount,
    wireframeIndicesCount,
  );
  let index = 0;

  // Handle the first edge
  const firstPoint = originalIndices[0];
  wireframeIndices[index++] = firstPoint;
  wireframeIndices[index++] = originalIndices[1];

  // Add two edges for every triangle in the fan
  for (let i = 0; i < numberOfTriangles; i++) {
    const point1 = originalIndices[i + 1];
    const point2 = originalIndices[i + 2];

    wireframeIndices[index++] = point1;
    wireframeIndices[index++] = point2;
    wireframeIndices[index++] = point2;
    wireframeIndices[index++] = firstPoint;
  }

  return wireframeIndices;
}

/**
 * 或者如果模型中不存在索引，则从头开始创建。
 * primitive类型。
 *
 * @param {PrimitiveType} primitiveType primitive中的顶点数量。
 * @param {number} vertexCount 包含primitive原始索引的类型数组。
 * @param {Uint8Array|Uint16Array|Uint32Array} [originalIndices] 包含线框索引的类型数组，如果primitive类型不使用三角形，则为空。
 *
 * @return {Uint16Array|Uint32Array} A 线框索引的类型数组，如果primitive类型不使用三角形，则为空。
 *
 * @private
 */
WireframeIndexGenerator.createWireframeIndices = function (
  primitiveType,
  vertexCount,
  originalIndices,
) {
  const hasOriginalIndices = defined(originalIndices);
  if (primitiveType === PrimitiveType.TRIANGLES) {
    return hasOriginalIndices
      ? createWireframeFromTriangleIndices(vertexCount, originalIndices)
      : createWireframeFromTriangles(vertexCount);
  }

  if (primitiveType === PrimitiveType.TRIANGLE_STRIP) {
    return hasOriginalIndices
      ? createWireframeFromTriangleStripIndices(vertexCount, originalIndices)
      : createWireframeFromTriangleStrip(vertexCount);
  }

  if (primitiveType === PrimitiveType.TRIANGLE_FAN) {
    return hasOriginalIndices
      ? createWireframeFromTriangleFanIndices(vertexCount, originalIndices)
      : createWireframeFromTriangleFan(vertexCount);
  }

  return undefined;
};

/**
 * 获取primitive类型线框索引缓冲区中的索引数量。
 *
 * @param {PrimitiveType} primitiveType primitive类型。
 * @param {number} originalCount primitive中原始的顶点或索引数量。
 * @return {number} The primitive的线框索引数量。
 *
 * @private
 */
WireframeIndexGenerator.getWireframeIndicesCount = function (
  primitiveType,
  originalCount,
) {
  // For TRIANGLES, the wireframe takes every triangle (i.e. three of the original
  // indices) and turns it into lines. Each triangle has three lines, and each line
  // requires two indices, so the final count is twice the original.
  if (primitiveType === PrimitiveType.TRIANGLES) {
    return originalCount * 2;
  }

  // For TRIANGLE_STRIP and TRIANGLE_FAN, the number of triangles in the primitive
  // is equal to the total number of vertices minus two. This is because after the
  // first edge is specified by the first two indices, every point afterwards
  // contributes two more edges with two of the previous points, forming a new triangle.
  // Each of these edges requires two indices, so each triangle in the primitive
  // results in four indices in addition to the first two.
  if (
    primitiveType === PrimitiveType.TRIANGLE_STRIP ||
    primitiveType === PrimitiveType.TRIANGLE_FAN
  ) {
    const numberOfTriangles = originalCount - 2;
    return 2 + numberOfTriangles * 4;
  }

  return originalCount;
};

export default WireframeIndexGenerator;
