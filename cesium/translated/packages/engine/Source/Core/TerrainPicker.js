// @ts-check

import {
  AxisAlignedBoundingBox,
  Cartesian3,
  Cartographic,
  Check,
  DeveloperError,
  IntersectionTests,
  Interval,
  Math as CesiumMath,
  Matrix4,
  Ray,
  defined,
} from "@cesium/core";
import TaskProcessor from "./TaskProcessor.js";
import SceneMode from "../Scene/SceneMode.js";

/** @import TerrainEncoding from "./TerrainEncoding.js"; */
/** @import { MapProjection } from "@cesium/core"; */

/**
 * 地形选择器可以深入 4 层（0-3）。
 * @ignore
 */
const MAXIMUM_TERRAIN_PICKER_LEVEL = 3;

/**
 * 使用空间加速结构处理与地形网格相交的任意光线，并生成相应的对象。
 *
 * @private
 */
class TerrainPicker {
  /**
   * @param {Float64Array} vertices 地形网格的顶点缓冲区。
   * @param {Uint8Array|Uint16Array|Uint32Array} indices 地形网格的索引缓冲区。
   * @param {TerrainEncoding} encoding 地形网格的顶点编码。
   */
  constructor(vertices, indices, encoding) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("vertices", vertices);
    Check.defined("indices", indices);
    Check.defined("encoding", encoding);
    //>>includeEnd('debug');

    /**
     * 地形网格的顶点缓冲区。
     * @type {Float64Array}
     */
    this._vertices = vertices;
    /**
     * 地形网格的索引缓冲区。
     * @type {Uint8Array|Uint16Array|Uint32Array}
     */
    this._indices = indices;
    /**
     * 地形网格的顶点编码。
     * @type {TerrainEncoding}
     */
    this._encoding = encoding;
    /**
     * 从世界空间到局部空间的地形瓦片变换的逆变换。
     * @type {Matrix4}
     */
    this._inverseTransform = new Matrix4(); // Compute as-needed on rebuild
    /**
     * 在下一个光线相交时是否重置该地形网格的选择器。
     * @type {boolean}
     */
    this._needsRebuild = true;
    /**
     * 地形选择器的四叉树根节点。
     * @type {TerrainPickerNode}
     */
    this._rootNode = new TerrainPickerNode();
  }

  /**
   * 指示由于底层地形网格的顶点或索引发生变化，是否需要重建地形选择器。
   * @type {boolean}
   */
  get needsRebuild() {
    return this._needsRebuild;
  }

  set needsRebuild(value) {
    this._needsRebuild = value;
  }

  /**
   * 确定光线在网格上的交点位置。
   * @param {Ray} ray 需要测试的光线。
   * @param {Matrix4} tileTransform 从局部空间到世界空间的地形瓦片变换。
   * @param {boolean} cullBackFaces 是否将背向三角形的点视为相交点。
   * @param {SceneMode} mode 场景模式（2D/3D/Columbus View）。
   * @param {MapProjection} projection 地图投影方式。
   * @returns {Cartesian3 | undefined} result 相交点，如果没有相交则显示为未定义。
   * @private
   */
  rayIntersect(ray, tileTransform, cullBackFaces, mode, projection) {
    // Lazily (re)create the terrain picker
    if (this._needsRebuild) {
      reset(this, tileTransform);
    }

    const invTransform = this._inverseTransform;

    const transformedRay = scratchTransformedRay;

    transformedRay.origin = Matrix4.multiplyByPoint(
      invTransform,
      ray.origin,
      transformedRay.origin,
    );
    transformedRay.direction = Matrix4.multiplyByPointAsVector(
      invTransform,
      ray.direction,
      transformedRay.direction,
    );

    /** @type {IntersectingNode[]} */
    const intersections = [];
    getNodesIntersectingRay(this._rootNode, transformedRay, intersections);

    return findClosestPointInClosestNode(
      this,
      intersections,
      ray,
      cullBackFaces,
      mode,
      projection,
    );
  }
}

const incrementallyBuildTerrainPickerTaskProcessor = new TaskProcessor(
  "incrementallyBuildTerrainPicker",
);

/**
 * 地形选择器四叉树中的一个节点。
 * @private
 */
class TerrainPickerNode {
  constructor() {
    /**
     * 该节点的树空间 x 坐标。
     * @type {number}
     */
    this.x = 0;
    /**
     * 该节点的树空间 y 坐标。
     * @type {number}
     */
    this.y = 0;
    /**
     * 该节点在四叉树中的层级。
     * @type {number}
     */
    this.level = 0;
    /**
     * 该节点在树本地空间中的轴对齐边界框。
     * @type {AxisAlignedBoundingBox}
     */
    this.aabb = createAABBForNode(this.x, this.y, this.level);
    /**
     * 与该节点相交的三角形的索引。
     * @type {Uint32Array}
     */
    this.intersectingTriangles = new Uint32Array(0);
    /**
     * 该节点的子地形选择器节点。
     * @type {TerrainPickerNode[]}
     */
    this.children = [];
    /**
     * 当前节点是否在 worker 上构建其子节点。
     * @type {boolean}
     */
    this.buildingChildren = false;
  }

  /**
   * 向该节点添加子节点。
   *
   * @param {number} childIdx 要添加的子节点的索引（0-3）。
   */
  addChild(childIdx) {
    //>>includeStart('debug', pragmas.debug);
    if (childIdx < 0 || childIdx > 3) {
      throw new DeveloperError(
        "TerrainPickerNode child index must be between 0 and 3, inclusive.",
      );
    }
    //>>includeEnd('debug');

    const childNode = new TerrainPickerNode();
    // Use bitwise operations to get child x,y from child index and parent x,y
    childNode.x = this.x * 2 + (childIdx & 1);
    childNode.y = this.y * 2 + ((childIdx >> 1) & 1);
    childNode.level = this.level + 1;
    childNode.aabb = createAABBForNode(
      childNode.x,
      childNode.y,
      childNode.level,
    );

    this.children[childIdx] = childNode;
  }
}

const scratchTransformedRay = new Ray();
const scratchTrianglePoints = [
  new Cartesian3(),
  new Cartesian3(),
  new Cartesian3(),
];

/**
 * 将地形选择器的四叉树结构重置为仅包含根节点。每当底层地形网格发生变化时执行此操作。
 * @param {TerrainPicker} terrainPicker 要重置的地形选择器。
 * @param {Matrix4} tileTransform
 * @private
 */
function reset(terrainPicker, tileTransform) {
  // PERFORMANCE_IDEA: warm-start the terrain picker by building a level on a worker.
  // This currently isn't feasible because you can only copy the vertex buffer to a worker (slow) or transfer ownership (can't do picking on main thread in meantime).
  // SharedArrayBuffers could be used, but most environments do not support them.
  Matrix4.inverse(tileTransform, terrainPicker._inverseTransform);

  terrainPicker._needsRebuild = false;
  const triangleCount = terrainPicker._indices.length / 3;
  const intersectingTriangles = new Uint32Array(triangleCount);

  for (let i = 0; i < triangleCount; ++i) {
    intersectingTriangles[i] = i;
  }

  terrainPicker._rootNode.intersectingTriangles = intersectingTriangles;
  terrainPicker._rootNode.children.length = 0;
}

const scratchAABBMin = new Cartesian3();
const scratchAABBMax = new Cartesian3();

/**
 * 在给定的树空间坐标和层级下为四叉树节点创建轴对齐边界框。
 * 该 AABB 位于树的本地空间（树的根节点在其本地空间内是一个单位立方体）。
 *
 * @param {number} x 节点的 x 坐标。
 * @param {number} y 节点的 y 坐标。
 * @param {number} level 节点的层级。
 * @returns {AxisAlignedBoundingBox} The 节点的轴对齐边界框。
 * @ignore
 */
function createAABBForNode(x, y, level) {
  const sizeAtLevel = 1.0 / Math.pow(2, level);

  const aabbMin = Cartesian3.fromElements(
    x * sizeAtLevel - 0.5,
    y * sizeAtLevel - 0.5,
    -0.5,
    scratchAABBMin,
  );

  const aabbMax = Cartesian3.fromElements(
    (x + 1) * sizeAtLevel - 0.5,
    (y + 1) * sizeAtLevel - 0.5,
    0.5,
    scratchAABBMax,
  );

  return AxisAlignedBoundingBox.fromCorners(aabbMin, aabbMax);
}

/**
 * 将三角形顶点位置和索引打包到提供的缓冲区中，供 worker 处理。
 * （worker）对三角形进行组织，将其作为四叉树中的子节点。
 * @param {Float64Array} trianglePositionsBuffer 用于打包三角形顶点位置的缓冲区。
 * @param {Uint32Array} triangleIndicesBuffer 用于打包三角形索引的缓冲区。
 * @param {Cartesian3[]} trianglePositions 三角形的顶点位置。
 * @param {number} triangleIndex 三角形在整体瓦片索引缓冲区中的索引。
 * @param {number} bufferIndex 用于打包到缓冲区的索引。
 * @private
 */
function packTriangleBuffers(
  trianglePositionsBuffer,
  triangleIndicesBuffer,
  trianglePositions,
  triangleIndex,
  bufferIndex,
) {
  Cartesian3.pack(
    trianglePositions[0],
    // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
    trianglePositionsBuffer,
    9 * bufferIndex,
  );
  Cartesian3.pack(
    trianglePositions[1],
    // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
    trianglePositionsBuffer,
    9 * bufferIndex + 3,
  );
  Cartesian3.pack(
    trianglePositions[2],
    // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
    trianglePositionsBuffer,
    9 * bufferIndex + 6,
  );
  triangleIndicesBuffer[bufferIndex] = triangleIndex;
}

/**
 * @typedef {object} IntersectingNode
 * @property {TerrainPickerNode} node - 相交的四叉树节点。
 * @property {Interval} interval - 光线与射线相交的区间。
 * @private
 */

const scratchInterval = new Interval();

/**
 * 递归地收集所有与射线相交的四叉树节点。
 *
 * @param {TerrainPickerNode} currentNode 当前正在测试的节点。
 * @param {Ray} ray 要测试的射线。
 * @param {IntersectingNode[]} intersectingNodes 存储相交节点的数组。
 * @private
 */
function getNodesIntersectingRay(currentNode, ray, intersectingNodes) {
  const interval = IntersectionTests.rayAxisAlignedBoundingBox(
    ray,
    currentNode.aabb,
    scratchInterval,
  );

  if (!defined(interval)) {
    return;
  }

  const isLeaf = !currentNode.children.length || currentNode.buildingChildren;
  if (isLeaf) {
    intersectingNodes.push({
      node: currentNode,
      interval: new Interval(interval.start, interval.stop),
    });
    return;
  }

  for (let i = 0; i < currentNode.children.length; i++) {
    getNodesIntersectingRay(currentNode.children[i], ray, intersectingNodes);
  }
}

/**
 * 在世界空间中找到沿射线最近的相交节点，以及该节点中的最近点。
 * 通过测试最近节点中的所有三角形与射线的交点来得出。
 *
 * @param {TerrainPicker} terrainPicker 地形选择器。
 * @param {IntersectingNode[]} intersections 与射线相交的节点，以及沿该射线发生的相交区间。
 * @param {Ray} ray 要测试的射线。
 * @param {boolean} cullBackFaces 是否剔除背面面片。
 * @param {SceneMode} mode 场景模式（2D/3D/Columbus View）。
 * @param {MapProjection} projection 地图投影方式。
 * @returns The 世界空间中的最近点，如果没有相交则定义为未定义。
 * @private
 */
function findClosestPointInClosestNode(
  terrainPicker,
  intersections,
  ray,
  cullBackFaces,
  mode,
  projection,
) {
  const sortedIntersections = intersections.sort(function (a, b) {
    return a.interval.start - b.interval.start;
  });

  let minT = Number.MAX_VALUE;
  for (let i = 0; i < sortedIntersections.length; i++) {
    const intersection = sortedIntersections[i];
    const intersectionResult = getClosestTriangleInNode(
      terrainPicker,
      ray,
      intersection.node,
      cullBackFaces,
      mode,
      projection,
    );
    minT = Math.min(intersectionResult, minT);
    if (minT !== Number.MAX_VALUE) {
      break;
    }
  }

  if (minT !== Number.MAX_VALUE) {
    return Ray.getPoint(ray, minT);
  }

  return undefined;
}

/**
 * 测试给定节点中的所有三角形与射线的交点，返回沿射线最近的相交 t 值。
 * 此外，收集沿途的三角形位置和索引，启动工作进程利用它们构建子节点。
 *
 * @param {TerrainPicker} terrainPicker 地形选择器。
 * @param {Ray} ray 要测试的射线。
 * @param {TerrainPickerNode} node 要测试的节点。
 * @param {boolean} cullBackFaces 是否剔除背面面片。
 * @param {SceneMode} mode 场景模式（2D/3D/Columbus View）。
 * @param {MapProjection} projection 地图投影方式。
 * @returns {number} The 沿射线的最近相交 t 值，如果没有相交则为 Number.MAX_VALUE。
 * @private
 */
function getClosestTriangleInNode(
  terrainPicker,
  ray,
  node,
  cullBackFaces,
  mode,
  projection,
) {
  let result = Number.MAX_VALUE;
  const encoding = terrainPicker._encoding;
  const indices = terrainPicker._indices;
  const vertices = terrainPicker._vertices;
  const triangleCount = node.intersectingTriangles.length;
  const isMaxLevel = node.level >= MAXIMUM_TERRAIN_PICKER_LEVEL;
  const shouldBuildChildren = !isMaxLevel && !node.buildingChildren;

  let trianglePositions;
  let triangleIndices;
  if (shouldBuildChildren) {
    // If the tree can be built deeper, prepare buffers to store triangle data for child nodes
    trianglePositions = new Float64Array(triangleCount * 9); // 3 vertices per triangle * 3 floats per vertex
    triangleIndices = new Uint32Array(triangleCount);
  }

  for (let i = 0; i < triangleCount; i++) {
    const triIndex = node.intersectingTriangles[i];
    const v0 = getVertexPosition(
      encoding,
      mode,
      projection,
      ray,
      vertices,
      indices[3 * triIndex],
      scratchTrianglePoints[0],
    );
    const v1 = getVertexPosition(
      encoding,
      mode,
      projection,
      ray,
      vertices,
      indices[3 * triIndex + 1],
      scratchTrianglePoints[1],
    );
    const v2 = getVertexPosition(
      encoding,
      mode,
      projection,
      ray,
      vertices,
      indices[3 * triIndex + 2],
      scratchTrianglePoints[2],
    );

    const triT = IntersectionTests.rayTriangleParametric(
      ray,
      v0,
      v1,
      v2,
      cullBackFaces,
    );

    if (defined(triT) && triT < result && triT >= 0) {
      result = triT;
    }

    if (shouldBuildChildren) {
      packTriangleBuffers(
        trianglePositions,
        triangleIndices,
        scratchTrianglePoints,
        triIndex,
        i,
      );
    }
  }

  if (shouldBuildChildren) {
    for (let childIdx = 0; childIdx < 4; childIdx++) {
      node.addChild(childIdx);
    }

    addTrianglesToChildrenNodes(
      terrainPicker._inverseTransform,
      node,
      triangleIndices,
      trianglePositions,
    );
  }

  return result;
}

const scratchCartographic = new Cartographic();

/**
 * 从缓冲区获取顶点位置，同时考虑地形的夸张和场景模式。
 *
 * @param {TerrainEncoding} encoding 地形编码方式。
 * @param {SceneMode} mode 场景模式（2D/3D/Columbus View）。
 * @param {MapProjection} projection 地图投影方式。
 * @param {Ray} ray 正在测试的选择射线（在 2D/Columbus View 中用于解决反午线缠绕问题）。
 * @param {Float64Array} vertices 地形网格的顶点缓冲区。
 * @param {number} index 要获取的顶点的索引。
 * @param {Cartesian3} result 解码后的、夸张的以及可能经过投影的顶点位置。
 * @returns {Cartesian3} The 结果顶点位置。
 * @private
 */
function getVertexPosition(
  encoding,
  mode,
  projection,
  ray,
  vertices,
  index,
  result,
) {
  let position = encoding.getExaggeratedPosition(vertices, index, result);
  if (mode === SceneMode.SCENE3D) {
    return position;
  }

  const ellipsoid = projection.ellipsoid;
  const positionCartographic = ellipsoid.cartesianToCartographic(
    position,
    scratchCartographic,
  );
  position = projection.project(positionCartographic, result);
  // Swizzle because coordinate basis are different in 2D/Columbus View
  position = Cartesian3.fromElements(
    position.z,
    position.x,
    position.y,
    result,
  );

  // Due to wrapping in 2D/CV modes, near the antimeridian, the vertex
  // position may correspond to the other side of the world from the ray origin.
  // Compare the vertex position to the ray origin and adjust it accordingly.
  // A spherical approximation is sufficient for cylindrical projections,
  // like mercator and geographic.
  const worldWidth = CesiumMath.TWO_PI * projection.ellipsoid.maximumRadius;
  const k = Math.round((ray.origin.y - position.y) / worldWidth);
  position.y += k * worldWidth;
  return position;
}

/**
 * 通过启动工作进程进行 AABB-三角形测试，将三角形添加到给定节点的子节点中。
 *
 * @param {Matrix4} inverseTransform
 * @param {TerrainPickerNode} node
 * @param {Uint32Array} triangleIndices
 * @param {Float64Array} trianglePositions
 * @returns {Promise<void>} A 当三角形被添加到子节点时解决的承诺。
 * @private
 */
async function addTrianglesToChildrenNodes(
  inverseTransform,
  node,
  triangleIndices,
  trianglePositions,
) {
  node.buildingChildren = true;

  // Prepare data to be sent to a worker
  const inverseTransformPacked = new Float64Array(16);
  // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
  Matrix4.pack(inverseTransform, inverseTransformPacked, 0);

  const aabbArray = new Float64Array(6 * 4); // 6 elements per AABB, 4 children
  for (let i = 0; i < 4; i++) {
    // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
    Cartesian3.pack(node.children[i].aabb.minimum, aabbArray, i * 6);
    // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
    Cartesian3.pack(node.children[i].aabb.maximum, aabbArray, i * 6 + 3);
  }

  const parameters = {
    aabbs: aabbArray,
    inverseTransform: inverseTransformPacked,
    triangleIndices: triangleIndices,
    trianglePositions: trianglePositions,
  };

  const transferableObjects = [
    aabbArray.buffer,
    inverseTransformPacked.buffer,
    triangleIndices.buffer,
    trianglePositions.buffer,
  ];

  const incrementallyBuildTerrainPickerPromise =
    incrementallyBuildTerrainPickerTaskProcessor.scheduleTask(
      parameters,
      transferableObjects,
    );

  if (!defined(incrementallyBuildTerrainPickerPromise)) {
    // Failed to schedule task, retry on next pick
    node.buildingChildren = false;
    return;
  }

  // After worker completes, it transfers back a buffer of intersecting triangles for each child node
  // Assign these to the child nodes
  const result = /** @type {{intersectingTrianglesArrays: ArrayBuffer[]}} */ (
    await incrementallyBuildTerrainPickerPromise
  );
  result.intersectingTrianglesArrays.forEach((buffer, index) => {
    // Guard against case where tree is reset while waiting for worker
    if (defined(node.children[index])) {
      node.children[index].intersectingTriangles = new Uint32Array(buffer);
    }
  });

  // The node's triangles have been distributed to its children
  node.intersectingTriangles = new Uint32Array(0);
  node.buildingChildren = false;
}

export default TerrainPicker;
