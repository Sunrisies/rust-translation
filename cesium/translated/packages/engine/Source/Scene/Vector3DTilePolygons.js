import {
  Cartesian3,
  Color,
  Ellipsoid,
  IndexDatatype,
  OrientedBoundingBox,
  Rectangle,
  defined,
  destroyObject,
} from "@cesium/core";
import TaskProcessor from "../Core/TaskProcessor.js";
import ClassificationType from "./ClassificationType.js";
import Vector3DTileBatch from "./Vector3DTileBatch.js";
import Vector3DTilePrimitive from "./Vector3DTilePrimitive.js";

/**
 * 创建一组覆盖在地形和/或 3D Tiles 上的预三角化多边形。
 *
 * @alias Vector3DTilePolygons
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Float32Array|Uint16Array} options.positions 多边形的位置。这些位置必须是连续的。
 * 即，第 n 个多边形的位置位于 [c, c + counts[n]] 范围内，其中 c = sum{counts[0], counts[n - 1]}，且这些位置构成该多边形的外环。
 * 按逆时针顺序排列。
 * @param {Uint32Array} options.counts 每个多边形中的位置数量。
 * @param {Uint32Array} options.indices 三角化多边形的索引。这些索引必须是连续的，以便
 * 第 n 个多边形的索引位于 [i, i + indexCounts[n]] 范围内，其中 i = sum{indexCounts[0], indexCounts[n - 1]}。
 * @param {Uint32Array} options.indexCounts 每个多边形中的索引数量。
 * @param {number} options.minimumHeight 被 Tiles 覆盖的地形的最小高度。
 * @param {number} options.maximumHeight 被 Tiles 覆盖的地形的最大高度。
 * @param {Float32Array} [options.polygonMinimumHeights] 包含每个多边形最小高度的数组。
 * @param {Float32Array} [options.polygonMaximumHeights] 包含每个多边形最大高度的数组。
 * @param {Rectangle} options.rectangle 包含 Tiles 的矩形区域。
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.WGS84] 椭球体。
 * @param {Cartesian3} [options.center=Cartesian3.ZERO] RTC 中心。
 * @param {Cesium3DTileBatchTable} options.batchTable 包含批量多边形的 Tiles 的批处理表。
 * @param {Uint16Array} options.batchIds 每个多边形的批处理 ID。
 * @param {BoundingSphere} options.boundingVolume 整个多边形组的边界体积。
 *
 * @private
 */
function Vector3DTilePolygons(options) {
  // All of the private properties will be released except _primitive after the Vector3DTilePrimitive is created.
  this._batchTable = options.batchTable;

  this._batchIds = options.batchIds;
  this._positions = options.positions;
  this._counts = options.counts;

  this._indices = options.indices;
  this._indexCounts = options.indexCounts;
  this._indexOffsets = undefined;

  this._batchTableColors = undefined;
  this._packedBuffer = undefined;

  this._batchedPositions = undefined;
  this._transferrableBatchIds = undefined;
  this._vertexBatchIds = undefined;

  this._ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
  this._minimumHeight = options.minimumHeight;
  this._maximumHeight = options.maximumHeight;
  this._polygonMinimumHeights = options.polygonMinimumHeights;
  this._polygonMaximumHeights = options.polygonMaximumHeights;
  this._center = options.center ?? Cartesian3.ZERO;
  this._rectangle = options.rectangle;

  this._center = undefined;

  this._boundingVolume = options.boundingVolume;
  this._boundingVolumes = undefined;

  this._batchedIndices = undefined;

  this._ready = false;
  this._promise = undefined;
  this._error = undefined;
  this._primitive = undefined;

  /**
   * 绘制分类网格的线框图。
   * @type {boolean}
   * @default false
   */
  this.debugWireframe = false;

  /**
   * 强制重新进行批处理，而不是在渲染若干帧后等待。仅用于测试。
   * @type {boolean}
   * @default false
   */
  this.forceRebatch = false;

  /**
   * 此 Tiles 将分类的内容。
   * @type {ClassificationType}
   * @default ClassificationType.BOTH
   */
  this.classificationType = ClassificationType.BOTH;
}

Object.defineProperties(Vector3DTilePolygons.prototype, {
  /**
   * 获取三角形的数量。
   *
   * @memberof Vector3DTilePolygons.prototype
   *
   * @type {number}
   * @readonly
   * @private
   */
  trianglesLength: {
    get: function () {
      if (defined(this._primitive)) {
        return this._primitive.trianglesLength;
      }
      return 0;
    },
  },

  /**
   * 获取几何内存大小（以字节为单位）。
   *
   * @memberof Vector3DTilePolygons.prototype
   *
   * @type {number}
   * @readonly
   * @private
   */
  geometryByteLength: {
    get: function () {
      if (defined(this._primitive)) {
        return this._primitive.geometryByteLength;
      }
      return 0;
    },
  },

  /**
   * 当原始对象准备渲染时返回 true。
   * @memberof Vector3DTilePolygons.prototype
   * @type {boolean}
   * @readonly
   * @private
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },
});

function packBuffer(polygons) {
  const packedBuffer = new Float64Array(
    3 +
      Cartesian3.packedLength +
      Ellipsoid.packedLength +
      Rectangle.packedLength,
  );

  let offset = 0;
  packedBuffer[offset++] = polygons._indices.BYTES_PER_ELEMENT;

  packedBuffer[offset++] = polygons._minimumHeight;
  packedBuffer[offset++] = polygons._maximumHeight;

  Cartesian3.pack(polygons._center, packedBuffer, offset);
  offset += Cartesian3.packedLength;

  Ellipsoid.pack(polygons._ellipsoid, packedBuffer, offset);
  offset += Ellipsoid.packedLength;

  Rectangle.pack(polygons._rectangle, packedBuffer, offset);

  return packedBuffer;
}

function unpackBuffer(polygons, packedBuffer) {
  let offset = 1;

  const numBVS = packedBuffer[offset++];
  const bvs = (polygons._boundingVolumes = new Array(numBVS));

  for (let i = 0; i < numBVS; ++i) {
    bvs[i] = OrientedBoundingBox.unpack(packedBuffer, offset);
    offset += OrientedBoundingBox.packedLength;
  }

  const numBatchedIndices = packedBuffer[offset++];
  const bis = (polygons._batchedIndices = new Array(numBatchedIndices));

  for (let j = 0; j < numBatchedIndices; ++j) {
    const color = Color.unpack(packedBuffer, offset);
    offset += Color.packedLength;

    const indexOffset = packedBuffer[offset++];
    const count = packedBuffer[offset++];

    const length = packedBuffer[offset++];
    const batchIds = new Array(length);

    for (let k = 0; k < length; ++k) {
      batchIds[k] = packedBuffer[offset++];
    }

    bis[j] = new Vector3DTileBatch({
      color: color,
      offset: indexOffset,
      count: count,
      batchIds: batchIds,
    });
  }
}

const createVerticesTaskProcessor = new TaskProcessor(
  "createVectorTilePolygons",
  5,
);
const scratchColor = new Color();

function createPrimitive(polygons) {
  if (defined(polygons._primitive)) {
    return;
  }

  let positions = polygons._positions;
  let counts = polygons._counts;
  let indexCounts = polygons._indexCounts;
  let indices = polygons._indices;

  let batchIds = polygons._transferrableBatchIds;
  let batchTableColors = polygons._batchTableColors;

  let packedBuffer = polygons._packedBuffer;

  if (!defined(batchTableColors)) {
    // Copy because they may be the views on the same buffer.
    positions = polygons._positions = polygons._positions.slice();
    counts = polygons._counts = polygons._counts.slice();
    indexCounts = polygons._indexCounts = polygons._indexCounts.slice();
    indices = polygons._indices = polygons._indices.slice();

    polygons._center = polygons._ellipsoid.cartographicToCartesian(
      Rectangle.center(polygons._rectangle),
    );

    batchIds = polygons._transferrableBatchIds = new Uint32Array(
      polygons._batchIds,
    );
    batchTableColors = polygons._batchTableColors = new Uint32Array(
      batchIds.length,
    );
    const batchTable = polygons._batchTable;

    const length = batchTableColors.length;
    for (let i = 0; i < length; ++i) {
      const color = batchTable.getColor(i, scratchColor);
      batchTableColors[i] = color.toRgba();
    }

    packedBuffer = polygons._packedBuffer = packBuffer(polygons);
  }

  const transferrableObjects = [
    positions.buffer,
    counts.buffer,
    indexCounts.buffer,
    indices.buffer,
    batchIds.buffer,
    batchTableColors.buffer,
    packedBuffer.buffer,
  ];
  const parameters = {
    packedBuffer: packedBuffer.buffer,
    positions: positions.buffer,
    counts: counts.buffer,
    indexCounts: indexCounts.buffer,
    indices: indices.buffer,
    batchIds: batchIds.buffer,
    batchTableColors: batchTableColors.buffer,
  };

  let minimumHeights = polygons._polygonMinimumHeights;
  let maximumHeights = polygons._polygonMaximumHeights;
  if (defined(minimumHeights) && defined(maximumHeights)) {
    minimumHeights = minimumHeights.slice();
    maximumHeights = maximumHeights.slice();

    transferrableObjects.push(minimumHeights.buffer, maximumHeights.buffer);
    parameters.minimumHeights = minimumHeights;
    parameters.maximumHeights = maximumHeights;
  }

  const verticesPromise = createVerticesTaskProcessor.scheduleTask(
    parameters,
    transferrableObjects,
  );
  if (!defined(verticesPromise)) {
    // Postponed
    return;
  }

  return verticesPromise
    .then((result) => {
      if (polygons.isDestroyed()) {
        return;
      }

      polygons._positions = undefined;
      polygons._counts = undefined;
      polygons._polygonMinimumHeights = undefined;
      polygons._polygonMaximumHeights = undefined;

      const packedBuffer = new Float64Array(result.packedBuffer);
      const indexDatatype = packedBuffer[0];
      unpackBuffer(polygons, packedBuffer);

      polygons._indices =
        IndexDatatype.getSizeInBytes(indexDatatype) === 2
          ? new Uint16Array(result.indices)
          : new Uint32Array(result.indices);
      polygons._indexOffsets = new Uint32Array(result.indexOffsets);
      polygons._indexCounts = new Uint32Array(result.indexCounts);

      // will be released
      polygons._batchedPositions = new Float32Array(result.positions);
      polygons._vertexBatchIds = new Uint16Array(result.batchIds);

      finishPrimitive(polygons);

      polygons._ready = true;
    })
    .catch((error) => {
      if (polygons.isDestroyed()) {
        return;
      }

      // Throw the error next frame
      polygons._error = error;
    });
}

function finishPrimitive(polygons) {
  if (!defined(polygons._primitive)) {
    polygons._primitive = new Vector3DTilePrimitive({
      batchTable: polygons._batchTable,
      positions: polygons._batchedPositions,
      batchIds: polygons._batchIds,
      vertexBatchIds: polygons._vertexBatchIds,
      indices: polygons._indices,
      indexOffsets: polygons._indexOffsets,
      indexCounts: polygons._indexCounts,
      batchedIndices: polygons._batchedIndices,
      boundingVolume: polygons._boundingVolume,
      boundingVolumes: polygons._boundingVolumes,
      center: polygons._center,
    });

    polygons._batchTable = undefined;
    polygons._batchIds = undefined;
    polygons._positions = undefined;
    polygons._counts = undefined;
    polygons._indices = undefined;
    polygons._indexCounts = undefined;
    polygons._indexOffsets = undefined;
    polygons._batchTableColors = undefined;
    polygons._packedBuffer = undefined;
    polygons._batchedPositions = undefined;
    polygons._transferrableBatchIds = undefined;
    polygons._vertexBatchIds = undefined;
    polygons._ellipsoid = undefined;
    polygons._minimumHeight = undefined;
    polygons._maximumHeight = undefined;
    polygons._polygonMinimumHeights = undefined;
    polygons._polygonMaximumHeights = undefined;
    polygons._center = undefined;
    polygons._rectangle = undefined;
    polygons._boundingVolume = undefined;
    polygons._boundingVolumes = undefined;
    polygons._batchedIndices = undefined;
  }
}

/**
 * 为每个多边形创建特征，并将其放置在特征批处理 ID 的位置。
 *
 * @param {Vector3DTileContent} content 矢量 Tiles 内容。
 * @param {Cesium3DTileFeature[]} features 包含多边形特征位置的特征数组。
 */
Vector3DTilePolygons.prototype.createFeatures = function (content, features) {
  this._primitive.createFeatures(content, features);
};

/**
 * 当启用时，为整个 Tiles 着色。最终颜色为 (多边形批处理表颜色 * 颜色)。
 *
 * @param {boolean} enabled 是否启用调试着色。
 * @param {Color} color 调试颜色。
 */
Vector3DTilePolygons.prototype.applyDebugSettings = function (enabled, color) {
  this._primitive.applyDebugSettings(enabled, color);
};

/**
 * 对内容应用样式。
 *
 * @param {Cesium3DTileStyle} style 样式。
 * @param {Cesium3DTileFeature[]} features 特征数组。
 */
Vector3DTilePolygons.prototype.applyStyle = function (style, features) {
  this._primitive.applyStyle(style, features);
};

/**
 * 在多边形颜色发生更改时更新颜色时调用。这些多边形需要在下一次更新时重新进行批处理。
 * 
 *
 * @param {number} batchId 颜色发生变化的多边形的批处理 ID。
 * @param {Color} color 新的多边形颜色。
 */
Vector3DTilePolygons.prototype.updateCommands = function (batchId, color) {
  this._primitive.updateCommands(batchId, color);
};

/**
 * 更新批处理并排队渲染命令。
 *
 * @param {FrameState} frameState 当前帧状态。
 */
Vector3DTilePolygons.prototype.update = function (frameState) {
  if (!this._ready) {
    if (!defined(this._promise)) {
      this._promise = createPrimitive(this);
    }

    if (defined(this._error)) {
      const error = this._error;
      this._error = undefined;
      throw error;
    }

    return;
  }

  this._primitive.debugWireframe = this.debugWireframe;
  this._primitive.forceRebatch = this.forceRebatch;
  this._primitive.classificationType = this.classificationType;
  this._primitive.update(frameState);
};

/**
 * 如果此对象被销毁，返回 true；否则返回 false。
 * <p>
 * 如果此对象被销毁，不应使用它；调用任何除
 * <code>isDestroyed</code> 之外的函数将导致 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则为 <code>true</code>；否则为 <code>false</code>。
 */
Vector3DTilePolygons.prototype.isDestroyed = function () {
  return false;
};

/**
 * 会释放此对象所持有的 WebGL 资源。销毁对象可以实现确定性
 * WebGL 资源的释放，而无需依赖垃圾收集器来销毁此对象。
 * <p>
 * 一旦对象被销毁，就不应再使用它；调用除 <code>isDestroyed</code> 之外的任何函数
 * 都会引发 {@link DeveloperError} 异常。因此，
 * 应将返回值 (<code>undefined</code>) 赋给该对象，如示例中所示。
 * </p>
 *
 * @exception {DeveloperError} This 即表示对象已被销毁，也就是调用了 destroy() 方法。
 */
Vector3DTilePolygons.prototype.destroy = function () {
  this._primitive = this._primitive && this._primitive.destroy();
  return destroyObject(this);
};
export default Vector3DTilePolygons;
