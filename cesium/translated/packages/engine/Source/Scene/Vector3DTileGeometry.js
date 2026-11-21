import {
  BoundingSphere,
  Cartesian3,
  Color,
  Matrix4,
  defined,
  destroyObject,
} from "@cesium/core";
import TaskProcessor from "../Core/TaskProcessor.js";
import ClassificationType from "./ClassificationType.js";
import Vector3DTileBatch from "./Vector3DTileBatch.js";
import Vector3DTilePrimitive from "./Vector3DTilePrimitive.js";

/**
 * 创建一组与地形或 3D Tiles 相交的盒子、圆柱体、椭球体和/或球体的几何形状。
 *
 * @alias Vector3DTileGeometry
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Float32Array} [options.boxes] 瓦片中的盒子。
 * @param {Uint16Array} [options.boxBatchIds] 每个盒子的批次 ID。
 * @param {Float32Array} [options.cylinders] 瓦片中的圆柱体。
 * @param {Uint16Array} [options.cylinderBatchIds] 每个圆柱体的批次 ID。
 * @param {Float32Array} [options.ellipsoids] 瓦片中的椭球体。
 * @param {Uint16Array} [options.ellipsoidBatchIds] 每个椭球体的批次 ID。
 * @param {Float32Array} [options.spheres] 瓦片中的球体。
 * @param {Uint16Array} [options.sphereBatchIds] 每个球体的批次 ID。
 * @param {Cartesian3} options.center 所有几何形状的 RTC 中心。
 * @param {Matrix4} options.modelMatrix 所有几何形状的模型矩阵。在单个几何形状模型矩阵之后应用。
 * @param {Cesium3DTileBatchTable} options.batchTable 批次表。
 * @param {BoundingSphere} options.boundingVolume 包含瓦片中所有几何形状的边界体积。
 *
 * @private
 */
function Vector3DTileGeometry(options) {
  // these will all be released after the primitive is created
  this._boxes = options.boxes;
  this._boxBatchIds = options.boxBatchIds;
  this._cylinders = options.cylinders;
  this._cylinderBatchIds = options.cylinderBatchIds;
  this._ellipsoids = options.ellipsoids;
  this._ellipsoidBatchIds = options.ellipsoidBatchIds;
  this._spheres = options.spheres;
  this._sphereBatchIds = options.sphereBatchIds;
  this._modelMatrix = options.modelMatrix;
  this._batchTable = options.batchTable;
  this._boundingVolume = options.boundingVolume;

  this._center = options.center;
  if (!defined(this._center)) {
    if (defined(this._boundingVolume)) {
      this._center = Cartesian3.clone(this._boundingVolume.center);
    } else {
      this._center = Cartesian3.clone(Cartesian3.ZERO);
    }
  }

  this._boundingVolumes = undefined;
  this._batchedIndices = undefined;

  this._indices = undefined;
  this._indexOffsets = undefined;
  this._indexCounts = undefined;

  this._positions = undefined;
  this._vertexBatchIds = undefined;

  this._batchIds = undefined;

  this._batchTableColors = undefined;
  this._packedBuffer = undefined;

  this._ready = false;
  this._promise = undefined;
  this._error = undefined;

  this._verticesPromise = undefined;

  this._primitive = undefined;

  /**
   * 绘制分类几何形状的线框图。
   * @type {boolean}
   * @default false
   */
  this.debugWireframe = false;

  /**
   * 强制重新批次，而不是在渲染一定帧数后等待。仅用于测试。
   * @type {boolean}
   * @default false
   */
  this.forceRebatch = false;

  /**
   * 此瓦片将分类的内容。
   * @type {ClassificationType}
   * @default ClassificationType.BOTH
   */
  this.classificationType = ClassificationType.BOTH;
}

Object.defineProperties(Vector3DTileGeometry.prototype, {
  /**
   * 获取三角形的数量。
   *
   * @memberof Vector3DTileGeometry.prototype
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
   * 获取几何形状的内存大小（以字节为单位）。
   *
   * @memberof Vector3DTileGeometry.prototype
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
   * 当原始形状准备渲染时返回 true。
   * @memberof Vector3DTileGeometry.prototype
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

Vector3DTileGeometry.packedBoxLength =
  Matrix4.packedLength + Cartesian3.packedLength;
Vector3DTileGeometry.packedCylinderLength = Matrix4.packedLength + 2;
Vector3DTileGeometry.packedEllipsoidLength =
  Matrix4.packedLength + Cartesian3.packedLength;
Vector3DTileGeometry.packedSphereLength = Cartesian3.packedLength + 1;

function packBuffer(geometries) {
  const packedBuffer = new Float64Array(
    Matrix4.packedLength + Cartesian3.packedLength,
  );

  let offset = 0;
  Cartesian3.pack(geometries._center, packedBuffer, offset);
  offset += Cartesian3.packedLength;
  Matrix4.pack(geometries._modelMatrix, packedBuffer, offset);

  return packedBuffer;
}

function unpackBuffer(geometries, packedBuffer) {
  let offset = 0;

  const indicesBytesPerElement = packedBuffer[offset++];
  const numBVS = packedBuffer[offset++];
  const bvs = (geometries._boundingVolumes = new Array(numBVS));

  for (let i = 0; i < numBVS; ++i) {
    bvs[i] = BoundingSphere.unpack(packedBuffer, offset);
    offset += BoundingSphere.packedLength;
  }

  const numBatchedIndices = packedBuffer[offset++];
  const bis = (geometries._batchedIndices = new Array(numBatchedIndices));

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

  return indicesBytesPerElement;
}

const createVerticesTaskProcessor = new TaskProcessor(
  "createVectorTileGeometries",
  5,
);
const scratchColor = new Color();

function createPrimitive(geometries) {
  if (defined(geometries._primitive)) {
    return;
  }

  if (!defined(geometries._verticesPromise)) {
    let boxes = geometries._boxes;
    let boxBatchIds = geometries._boxBatchIds;
    let cylinders = geometries._cylinders;
    let cylinderBatchIds = geometries._cylinderBatchIds;
    let ellipsoids = geometries._ellipsoids;
    let ellipsoidBatchIds = geometries._ellipsoidBatchIds;
    let spheres = geometries._spheres;
    let sphereBatchIds = geometries._sphereBatchIds;

    let batchTableColors = geometries._batchTableColors;
    let packedBuffer = geometries._packedBuffer;

    if (!defined(batchTableColors)) {
      // Copy because they may be the views on the same buffer.
      let length = 0;
      if (defined(geometries._boxes)) {
        boxes = geometries._boxes = boxes.slice();
        boxBatchIds = geometries._boxBatchIds = boxBatchIds.slice();
        length += boxBatchIds.length;
      }
      if (defined(geometries._cylinders)) {
        cylinders = geometries._cylinders = cylinders.slice();
        cylinderBatchIds = geometries._cylinderBatchIds =
          cylinderBatchIds.slice();
        length += cylinderBatchIds.length;
      }
      if (defined(geometries._ellipsoids)) {
        ellipsoids = geometries._ellipsoids = ellipsoids.slice();
        ellipsoidBatchIds = geometries._ellipsoidBatchIds =
          ellipsoidBatchIds.slice();
        length += ellipsoidBatchIds.length;
      }
      if (defined(geometries._spheres)) {
        spheres = geometries._sphere = spheres.slice();
        sphereBatchIds = geometries._sphereBatchIds = sphereBatchIds.slice();
        length += sphereBatchIds.length;
      }

      batchTableColors = geometries._batchTableColors = new Uint32Array(length);
      const batchTable = geometries._batchTable;

      for (let i = 0; i < length; ++i) {
        const color = batchTable.getColor(i, scratchColor);
        batchTableColors[i] = color.toRgba();
      }

      packedBuffer = geometries._packedBuffer = packBuffer(geometries);
    }

    const transferrableObjects = [];
    if (defined(boxes)) {
      transferrableObjects.push(boxes.buffer, boxBatchIds.buffer);
    }
    if (defined(cylinders)) {
      transferrableObjects.push(cylinders.buffer, cylinderBatchIds.buffer);
    }
    if (defined(ellipsoids)) {
      transferrableObjects.push(ellipsoids.buffer, ellipsoidBatchIds.buffer);
    }
    if (defined(spheres)) {
      transferrableObjects.push(spheres.buffer, sphereBatchIds.buffer);
    }
    transferrableObjects.push(batchTableColors.buffer, packedBuffer.buffer);

    const parameters = {
      boxes: defined(boxes) ? boxes.buffer : undefined,
      boxBatchIds: defined(boxes) ? boxBatchIds.buffer : undefined,
      cylinders: defined(cylinders) ? cylinders.buffer : undefined,
      cylinderBatchIds: defined(cylinders)
        ? cylinderBatchIds.buffer
        : undefined,
      ellipsoids: defined(ellipsoids) ? ellipsoids.buffer : undefined,
      ellipsoidBatchIds: defined(ellipsoids)
        ? ellipsoidBatchIds.buffer
        : undefined,
      spheres: defined(spheres) ? spheres.buffer : undefined,
      sphereBatchIds: defined(spheres) ? sphereBatchIds.buffer : undefined,
      batchTableColors: batchTableColors.buffer,
      packedBuffer: packedBuffer.buffer,
    };

    const verticesPromise = (geometries._verticesPromise =
      createVerticesTaskProcessor.scheduleTask(
        parameters,
        transferrableObjects,
      ));
    if (!defined(verticesPromise)) {
      // Postponed
      return;
    }

    return verticesPromise
      .then(function (result) {
        if (geometries.isDestroyed()) {
          return;
        }

        const packedBuffer = new Float64Array(result.packedBuffer);
        const indicesBytesPerElement = unpackBuffer(geometries, packedBuffer);

        if (indicesBytesPerElement === 2) {
          geometries._indices = new Uint16Array(result.indices);
        } else {
          geometries._indices = new Uint32Array(result.indices);
        }

        geometries._indexOffsets = new Uint32Array(result.indexOffsets);
        geometries._indexCounts = new Uint32Array(result.indexCounts);

        geometries._positions = new Float32Array(result.positions);
        geometries._vertexBatchIds = new Uint16Array(result.vertexBatchIds);

        geometries._batchIds = new Uint16Array(result.batchIds);

        finishPrimitive(geometries);

        geometries._ready = true;
      })
      .catch((error) => {
        if (geometries.isDestroyed()) {
          return;
        }

        geometries._error = error;
      });
  }
}

function finishPrimitive(geometries) {
  if (!defined(geometries._primitive)) {
    geometries._primitive = new Vector3DTilePrimitive({
      batchTable: geometries._batchTable,
      positions: geometries._positions,
      batchIds: geometries._batchIds,
      vertexBatchIds: geometries._vertexBatchIds,
      indices: geometries._indices,
      indexOffsets: geometries._indexOffsets,
      indexCounts: geometries._indexCounts,
      batchedIndices: geometries._batchedIndices,
      boundingVolume: geometries._boundingVolume,
      boundingVolumes: geometries._boundingVolumes,
      center: geometries._center,
      pickObject: geometries._pickObject ?? geometries,
    });

    geometries._boxes = undefined;
    geometries._boxBatchIds = undefined;
    geometries._cylinders = undefined;
    geometries._cylinderBatchIds = undefined;
    geometries._ellipsoids = undefined;
    geometries._ellipsoidBatchIds = undefined;
    geometries._spheres = undefined;
    geometries._sphereBatchIds = undefined;
    geometries._center = undefined;
    geometries._modelMatrix = undefined;
    geometries._batchTable = undefined;
    geometries._boundingVolume = undefined;

    geometries._boundingVolumes = undefined;
    geometries._batchedIndices = undefined;

    geometries._indices = undefined;
    geometries._indexOffsets = undefined;
    geometries._indexCounts = undefined;

    geometries._positions = undefined;
    geometries._vertexBatchIds = undefined;

    geometries._batchIds = undefined;

    geometries._batchTableColors = undefined;
    geometries._packedBuffer = undefined;

    geometries._verticesPromise = undefined;
  }
}

/**
 * 为每个几何形状创建特征，并将其放置在特征批次 ID 的位置。
 *
 * @param {Vector3DTileContent} content 矢量瓦片内容。
 * @param {Cesium3DTileFeature[]} features 特征数组，多边形特征将放置在此数组中。
 */
Vector3DTileGeometry.prototype.createFeatures = function (content, features) {
  this._primitive.createFeatures(content, features);
};

/**
 * 当启用时，给整个瓦片着色。结果颜色为（几何形状批次表颜色 * 颜色）。
 *
 * @param {boolean} enabled 是否启用调试着色。
 * @param {Color} color 调试颜色。
 */
Vector3DTileGeometry.prototype.applyDebugSettings = function (enabled, color) {
  this._primitive.applyDebugSettings(enabled, color);
};

/**
 * 对内容应用样式。
 *
 * @param {Cesium3DTileStyle} style 样式。
 * @param {Cesium3DTileFeature[]} features 特征数组。
 */
Vector3DTileGeometry.prototype.applyStyle = function (style, features) {
  this._primitive.applyStyle(style, features);
};

/**
 * 在更新几何形状的颜色且批次 ID 发生变化时调用。几何形状需要重新批次。
 * 在下一次更新中。
 *
 * @param {number} batchId 颜色发生变化的几何形状的批次 ID。
 * @param {Color} color 新的多边形颜色。
 */
Vector3DTileGeometry.prototype.updateCommands = function (batchId, color) {
  this._primitive.updateCommands(batchId, color);
};

/**
 * 更新批次并排队渲染命令。
 *
 * @param {FrameState} frameState 当前帧状态。
 */
Vector3DTileGeometry.prototype.update = function (frameState) {
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
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code>之外的任何函数将导致 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，返回 <code>false</code>；否则返回 <code>false</code>。
 */
Vector3DTileGeometry.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性的
 * WebGL 资源释放，而不是依赖垃圾收集器来销毁此对象。
 * <p>
 * 一旦对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code>之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所做。
 * </p>
 *
 * @exception {DeveloperError} This 实体已被销毁，即调用了 destroy() 方法。
 */
Vector3DTileGeometry.prototype.destroy = function () {
  this._primitive = this._primitive && this._primitive.destroy();
  return destroyObject(this);
};
export default Vector3DTileGeometry;
