import {
  Cartesian3,
  Check,
  DeveloperError,
  Ellipsoid,
  Event,
  Frozen,
  Intersect,
  Math as CesiumMath,
  Rectangle,
  RuntimeError,
  defined,
  deprecationWarning,
  destroyObject,
} from "@cesium/core";
import ClippingPolygon from "./ClippingPolygon.js";
import BufferPolygonCollection from "./BufferPolygonCollection.js";
import BufferPolygon from "./BufferPolygon.js";
import VectorPipeline from "../Core/VectorPipeline.js";

/** @import { VectorCollectionData } from "../Core/VectorPipeline.js" */

// Reused flyweight for reading/writing individual BufferPolygons.
const bufferPolygonScratch = new BufferPolygon();

const qualityDeprecationMessage =
  "ClippingPolygonCollection.quality is deprecated as of CesiumJS 1.145 and will be removed in 1.147. Signed distance field clipping was replaced with vector clipping, so this property no longer has any effect.";
const debugShowDistanceTextureDeprecationMessage =
  "ClippingPolygonCollection.debugShowDistanceTexture is deprecated as of CesiumJS 1.145 and will be removed in 1.147. Signed distance field clipping was replaced with vector clipping, so this property no longer has any effect.";
const isDestroyedDeprecationMessage =
  "ClippingPolygonCollection.isDestroyed is deprecated as of CesiumJS 1.145 and will be removed in 1.147. The collection no longer holds any GPU resources of its own, so it does not need to be destroyed.";
const destroyDeprecationMessage =
  "ClippingPolygonCollection.destroy is deprecated as of CesiumJS 1.145 and will be removed in 1.147. The collection no longer holds any GPU resources of its own, so it does not need to be destroyed.";

/**
 * 与集合中的镜像原始对象索引对应的裁剪多边形。
 *
 * @typedef {object} ClippingPolygonEntry
 * @property {ClippingPolygon} clippingPolygon
 * @property {number} bufferIndex
 * @private
 */

/**
 * 指定一组裁剪多边形。这些裁剪多边形会选择性地禁用特定区域的渲染。
 * 适用于单个 glTF 模型、3D Tileset 或地球仪中的 {@link ClippingPolygon} 对象列表内或外。
 *
 * 裁剪多边形仅支持 WebGL 2 环境。
 *
 * @alias ClippingPolygonCollection
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {ClippingPolygon[]} [options.polygons=[]] 用于选择性地禁用每个多边形内部渲染的 {@link ClippingPolygon} 对象数组。
 * @param {boolean} [options.enabled=true] 决定裁剪多边形是否处于活动状态。
 * @param {boolean} [options.inverse=false] 如果为 true，当区域位于集合中所有多边形的外部时，该区域将被裁剪；否则，只有当区域位于任何多边形内部时，该区域才会被裁剪。
 * @param {number} [options.quality=1.0] 控制用于裁剪的带符号距离纹理分辨率的标量值。大于 1.0 的值会提高质量，小于 1.0 的值会降低质量。必须大于 0.0。<p>此属性在 CesiumJS 1.145 中被弃用，并将在 1.147 中移除。带符号距离场裁剪已被向量裁剪取代，因此该属性不再生效。</p>
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 用于将裁剪多边形投影到地球仪上的椭球体。
 *
 * @example
 * const positions = Cesium.Cartesian3.fromRadiansArray([
 *     -1.3194369277314022,
 *     0.6988062530900625,
 *     -1.31941,
 *     0.69879,
 *     -1.3193955980204217,
 *     0.6988091578771254,
 *     -1.3193931220959367,
 *     0.698743632490865,
 *     -1.3194358224045408,
 *     0.6987471965556998,
 * ]);
 *
 * const polygon = new Cesium.ClippingPolygon({
 * positions: positions
 * });
 *
 * const polygons = new Cesium.ClippingPolygonCollection({
 * polygons: [ polygon ]
 * });
 */
function ClippingPolygonCollection(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * @type {ClippingPolygonEntry[]}
   * @private
   */
  this._polygons = [];

  const polygons = options.polygons ?? [];
  let numVertices = 0;
  let numHoles = 0;
  for (let i = 0; i < polygons.length; ++i) {
    numVertices += polygons[i].length;
    numHoles += polygons[i].holes.length;
  }

  // Marks the packed vector data as stale.
  this._dirty = false;

  // For now: this is a write-through mirror of the polygons array. In upcoming work,
  // this will be the source of truth. To maintain backwards compatibility, though, we will still
  // have to wrap BufferPolygons in ClippingPolygons for the public API.
  this._bufferPolygonCollection = new BufferPolygonCollection({
    // We just need it as a data structure, set show to false to prevent unnecessary render buffer allocations.
    show: false,
    // Clipping polygons are never picked, so skip allocating pick ids for them.
    allowPicking: false,
    // Preallocate double the initial data.
    primitiveCountMax: 2 * polygons.length,
    vertexCountMax: 2 * numVertices,
    holeCountMax: numHoles > 0 ? 2 * numHoles : 0,
    // This may be fine to stay as 0: we do not need the triangulation for Vector-based clipping.
    triangleCountMax: 0,
  });

  for (let i = 0; i < polygons.length; ++i) {
    const bufferIndex = this._bufferPolygonCollection.primitiveCount;
    this._bufferPolygonCollection.add(
      packClippingPolygon(polygons[i]),
      bufferPolygonScratch,
    );
    this._polygons.push({
      clippingPolygon: polygons[i],
      bufferIndex: bufferIndex,
    });
  }

  if (defined(options.debugShowDistanceTexture)) {
    deprecationWarning(
      "ClippingPolygonCollection.debugShowDistanceTexture",
      debugShowDistanceTextureDeprecationMessage,
    );
  }
  this._debugShowDistanceTexture = options.debugShowDistanceTexture ?? false;

  /**
   * 如果为 true，则启用裁剪功能。
   *
   * @type {boolean}
   * @default true
   */
  this.enabled = options.enabled ?? true;

  /**
   * 如果为 true，当区域位于集合中所有多边形的外部时，该区域将被裁剪；否则，只有当区域位于任何多边形内部时，该区域才会被裁剪。
   * 否则，只有当区域位于任何多边形内部时，该区域才会被裁剪。
   * 当新裁剪多边形被添加到集合中时触发的事件。事件处理程序
   *
   * @type {boolean}
   * @default false
   */
  this.inverse = options.inverse ?? false;

  if (defined(options.quality)) {
    deprecationWarning(
      "ClippingPolygonCollection.quality",
      qualityDeprecationMessage,
    );
  }
  this._quality = options.quality ?? 1.0;

  /**
   * 接收新多边形及其添加索引的事件。
   * 当新裁剪多边形从集合中移除时触发的事件。事件处理程序
   * @type {Event}
   * @default Event()
   */
  this.polygonAdded = new Event();

  /**
   * 接收新多边形及其移除索引的事件。
   * 使用椭球体将裁剪多边形投影到地球仪上。
   * @type {Event}
   * @default Event()
   */
  this.polygonRemoved = new Event();

  /**
   * 返回该集合中的多边形数量。此属性常用于
   * @type {Ellipsoid}
   * @default Ellipsoid.default
   */
  this.ellipsoid = options.ellipsoid ?? Ellipsoid.default;

  // If this ClippingPolygonCollection has an owner, only its owner should update or destroy it.
  // This is because in a Cesium3DTileset multiple models may reference the tileset's ClippingPolygonCollection.
  this._owner = undefined;

  /**
   * @type {VectorCollectionData}
   * @private
   */
  this._vectorCollectionData = VectorPipeline.packPolygonCollectionData(
    this._bufferPolygonCollection,
    this.ellipsoid,
  );
}

Object.defineProperties(ClippingPolygonCollection.prototype, {
  /**
   * {@link ClippingPolygonCollection#get} 以遍历集合中的所有多边形。
   * 
   * 如果为 true，将显示可视化带符号距离场的调试纹理。
   *
   * @memberof ClippingPolygonCollection.prototype
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._polygons.length;
    },
  },

  /**
   * 此属性在 CesiumJS 1.145 中被弃用，并将在 1.147 中移除。带符号距离场裁剪已被向量裁剪取代，因此该属性不再生效。
   *
   * @memberof ClippingPolygonCollection.prototype
   * @type {boolean}
   * @default false
   * @deprecated This property was deprecated in CesiumJS 1.145 and will be removed in 1.147. Signed distance field clipping was replaced with vector clipping, so this property no longer has any effect.
   */
  debugShowDistanceTexture: {
    get: function () {
      deprecationWarning(
        "ClippingPolygonCollection.debugShowDistanceTexture",
        debugShowDistanceTextureDeprecationMessage,
      );
      return this._debugShowDistanceTexture;
    },
    set: function (value) {
      deprecationWarning(
        "ClippingPolygonCollection.debugShowDistanceTexture",
        debugShowDistanceTextureDeprecationMessage,
      );
      this._debugShowDistanceTexture = value;
    },
  },

  /**
   * 控制用于裁剪的带符号距离纹理分辨率的标量值。
   *
   * @memberof ClippingPolygonCollection.prototype
   * @type {number}
   * @default 1.0
   * @deprecated This 该属性在 CesiumJS 1.145 中已被弃用，将在 1.147 中移除。带符号距离场的裁剪被向量裁剪取代，因此该属性不再具有任何效果。
   */
  quality: {
    get: function () {
      deprecationWarning(
        "ClippingPolygonCollection.quality",
        qualityDeprecationMessage,
      );
      return this._quality;
    },
    set: function (value) {
      deprecationWarning(
        "ClippingPolygonCollection.quality",
        qualityDeprecationMessage,
      );
      this._quality = value;
    },
  },

  /**
   * 指向 ClippingPolygonCollection 的拥有者（如果有的话）的引用。
   *
   * @memberof ClippingPolygonCollection.prototype
   * @readonly
   * @private
   */
  owner: {
    get: function () {
      return this._owner;
    },
  },

  /**
   * 返回一个数字，表示此 ClippingPolygonCollection 的状态。
   *
   * 当裁剪处于非活动状态（禁用或为空）时，值为 0；对于正常裁剪，值为 1；对于逆裁剪，值为 -1。如果此值发生变化，则需要进行着色器重新生成。
   * clipping, and -1 for inverse clipping. If this value changes, then shader
   * 需要重新生成。
   *
   * @memberof ClippingPolygonCollection.prototype
   * @returns {number} A 描述 ClippingPolygonCollection 状态的数字。
   * @readonly
   * @private
   */
  clippingPolygonsState: {
    get: function () {
      if (!this.enabled || this.length === 0) {
        return 0;
      }
      return this.inverse ? -1 : 1;
    },
  },
});

/**
 * 将 ClippingPolygon 的外环和孔洞展平为位置及
 * 孔洞偏移数组，供 BufferPolygonCollection.add 使用。
 *
 * @param {ClippingPolygon} polygon
 * @returns {{positions: Float64Array, holes: (Uint32Array|undefined)}}
 * @private
 */
function packClippingPolygon(polygon) {
  const outer = polygon.positions;
  const holeRings = polygon.holes;
  const positions = new Float64Array(polygon.length * 3);

  let vertexOffset = 0;
  for (let i = 0; i < outer.length; i++) {
    Cartesian3.pack(outer[i], positions, vertexOffset * 3);
    vertexOffset++;
  }

  if (holeRings.length === 0) {
    return { positions, holes: undefined };
  }

  // Each hole offset marks the vertex where that ring begins in positions.
  const holes = new Uint32Array(holeRings.length);
  for (let i = 0; i < holeRings.length; i++) {
    const ring = holeRings[i];
    holes[i] = vertexOffset;
    for (let j = 0; j < ring.length; j++) {
      Cartesian3.pack(ring[j], positions, vertexOffset * 3);
      vertexOffset++;
    }
  }
  return { positions, holes };
}

/**
 * 如果给定数量的顶点和孔洞超过容量，则增加 backing BufferPolygonCollection 的数量，使集合能够继续添加。
 * 隐藏给定条目的镜像 BufferPolygon，并清除其缓冲区索引，因为 BufferPolygonCollection 不支持移除操作。
 *
 * @param {ClippingPolygonCollection} collection
 * @param {number} addedVertexCount
 * @param {number} addedHoleCount
 * @returns {BufferPolygonCollection}
 * @private
 */
function reserveBufferCapacity(collection, addedVertexCount, addedHoleCount) {
  const buffer = collection._bufferPolygonCollection;

  const neededPrimitives = buffer.primitiveCount + 1;
  const neededVertices = buffer.vertexCount + addedVertexCount;
  const neededHoles = buffer.holeCount + addedHoleCount;

  if (
    neededPrimitives <= buffer.primitiveCountMax &&
    neededVertices <= buffer.vertexCountMax &&
    neededHoles <= buffer.holeCountMax
  ) {
    return buffer;
  }

  const hasHiddenPolygons =
    collection._polygons.length !== buffer.primitiveCount;

  const grown = BufferPolygonCollection.fromCollection(
    buffer,
    {
      primitiveCountMax: CesiumMath.nextPowerOfTwo(neededPrimitives),
      vertexCountMax: CesiumMath.nextPowerOfTwo(neededVertices),
      holeCountMax: CesiumMath.nextPowerOfTwo(neededHoles),
    },
    hasHiddenPolygons ? (polygon) => polygon.show : undefined,
  );

  buffer.destroy();
  collection._bufferPolygonCollection = grown;

  if (hasHiddenPolygons) {
    // Reassign indices after compaction (note that this assumes compaction keeps order contiguous)
    const polygons = collection._polygons;
    for (let i = 0; i < polygons.length; ++i) {
      polygons[i].bufferIndex = i;
    }
  }

  return grown;
}

/**
 * Hides the mirrored BufferPolygon for the given entry and clears its buffer index, since BufferPolygonCollection does not support removal.
 *
 * @param {ClippingPolygonCollection} collection
 * @param {ClippingPolygonEntry} entry
 * @private
 */
function hideBufferPolygon(collection, entry) {
  collection._bufferPolygonCollection.get(
    entry.bufferIndex,
    bufferPolygonScratch,
  ).show = false;
  entry.bufferIndex = -1;
}

/**
 * 将指定的 {@link ClippingPolygon} 添加到集合中，用于选择性地禁用每个多边形的内部渲染。
 * 使用 {@link ClippingPolygonCollection#unionClippingRegions} 来修改多个多边形的裁剪行为。
 * 如何修改裁剪行为。
 *
 * @param {ClippingPolygon} polygon 要添加到集合中的 ClippingPolygon。
 * @returns {ClippingPolygon} The 添加的 ClippingPolygon。
 *
 * @example
 * const polygons = new Cesium.ClippingPolygonCollection();
 *
 * const positions = Cesium.Cartesian3.fromRadiansArray([
 *     -1.3194369277314022,
 *     0.6988062530900625,
 *     -1.31941,
 *     0.69879,
 *     -1.3193955980204217,
 *     0.6988091578771254,
 *     -1.3193931220959367,
 *     0.698743632490865,
 *     -1.3194358224045408,
 *     0.6987471965556998,
 * ]);
 *
 * polygons.add(new Cesium.ClippingPolygon({
 * positions: positions
 * }));
 *
 *
 *
 * @see ClippingPolygonCollection#remove
 * @see ClippingPolygonCollection#removeAll
 */
ClippingPolygonCollection.prototype.add = function (polygon) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("polygon", polygon);
  //>>includeEnd('debug');

  const newPlaneIndex = this._polygons.length;

  const bufferPolygonCollection = reserveBufferCapacity(
    this,
    polygon.length,
    polygon.holes.length,
  );
  this._polygons.push({
    clippingPolygon: polygon,
    bufferIndex: bufferPolygonCollection.primitiveCount,
  });
  bufferPolygonCollection.add(
    packClippingPolygon(polygon),
    bufferPolygonScratch,
  );

  this._dirty = true;
  this.polygonAdded.raiseEvent(polygon, newPlaneIndex);
  return polygon;
};

/**
 * 返回集合中指定索引处的裁剪多边形。索引从零开始
 * 并且随着多边形的增加而增加。移除一个多边形会使其所有后续多边形
 * 的索引发生变化。此函数通常与
 * {@link ClippingPolygonCollection#length} 一起使用，以遍历集合中的所有多边形。
 * 从零开始的多边形索引。
 *
 * @param {number} index 指定索引处的 ClippingPolygon。
 * @returns {ClippingPolygon} The ClippingPolygon at the specified index.
 *
 * @see ClippingPolygonCollection#length
 */
ClippingPolygonCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  return this._polygons[index]?.clippingPolygon;
};

/**
 * 检查该集合是否包含与给定 ClippingPolygon 相等的 ClippingPolygon。
 *
 * @param {ClippingPolygon} polygon 要检查的 ClippingPolygon。
 * @returns {boolean} true 如果集合中包含该 ClippingPolygon，则为 false，否则为 true。
 *
 * @see ClippingPolygonCollection#get
 */
ClippingPolygonCollection.prototype.contains = function (polygon) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("polygon", polygon);
  //>>includeEnd('debug');

  return this._polygons.some((entry) =>
    ClippingPolygon.equals(entry.clippingPolygon, polygon),
  );
};

/**
 * 从集合中移除首次出现的给定 ClippingPolygon。
 *
 * @param {ClippingPolygon} polygon
 * @returns {boolean} <code>true</code> 如果多边形被移除；如果在集合中未找到该多边形，则返回 <code>false</code>。
 *
 * @see ClippingPolygonCollection#add
 * @see ClippingPolygonCollection#contains
 * @see ClippingPolygonCollection#removeAll
 */
ClippingPolygonCollection.prototype.remove = function (polygon) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("polygon", polygon);
  //>>includeEnd('debug');

  const polygons = this._polygons;
  const index = polygons.findIndex((entry) =>
    ClippingPolygon.equals(entry.clippingPolygon, polygon),
  );

  if (index === -1) {
    return false;
  }

  const [entry] = polygons.splice(index, 1);

  hideBufferPolygon(this, entry);

  this._dirty = true;
  this.polygonRemoved.raiseEvent(entry.clippingPolygon, index);
  return true;
};

/**
 * 从集合中移除所有多边形。
 *
 * @see ClippingPolygonCollection#add
 * @see ClippingPolygonCollection#remove
 */
ClippingPolygonCollection.prototype.removeAll = function () {
  const polygons = this._polygons;
  const polygonsCount = polygons.length;
  for (let i = 0; i < polygonsCount; ++i) {
    const entry = polygons[i];
    hideBufferPolygon(this, entry);
    this.polygonRemoved.raiseEvent(entry.clippingPolygon, i);
  }
  this._dirty = true;
  this._polygons = [];
};

/**
 * 在场景更新期间，由集合的拥有者（如 {@link Cesium3DTileset}、{@link Model} 或
 * 地球表面瓦片提供器）调用此函数，以构建用于裁剪多边形的资源。
 * 不要直接调用此函数。
 * <p>
 * 仅支持 WebGL 2 版本。
 * </p>
 * @private
 * @throws {RuntimeError} ClippingPolygonCollections 用于确定与当前 ClippingPolygonCollection 实例及指定 {@link TileBoundingVolume} 之间的交集类型。
 */
ClippingPolygonCollection.prototype.update = function (frameState) {
  if (!ClippingPolygonCollection.isSupported(frameState)) {
    throw new RuntimeError(
      "ClippingPolygonCollections are only supported for WebGL 2.",
    );
  }

  if (!this._dirty) {
    return;
  }

  this._dirty = false;

  // If there are no clipping polygons, there's nothing to update.
  if (this.length === 0) {
    return;
  }

  // Update the vector polygon data
  this._vectorCollectionData = VectorPipeline.packPolygonCollectionData(
    this._bufferPolygonCollection,
    this.ellipsoid,
  );
};

const scratchRectangleTile = new Rectangle();
const scratchRectangleIntersection = new Rectangle();
/**
 * 用于确定与多边形之间的交集的体积。
 * @ignore
 *
 * @param {object} tileBoundingVolume 定义边界体积的椭球体。
 * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] 交集类型：如果整个体积未被裁剪，则为 {@link Intersect.OUTSIDE}；如果整个体积被裁剪，则为 {@link Intersect.INSIDE}；如果体积与多边形相交且部分被裁剪，则为 {@link Intersect.INTERSECTING}。
 * @returns {Intersect} The 如果不存在其他拥有者，则设置此 ClippingPolygonCollection 的拥有者。
 * 如果设置成功，则销毁拥有者之前的 ClippingPolygonCollection。
 */
ClippingPolygonCollection.prototype.computeIntersectionWithBoundingVolume =
  function (tileBoundingVolume, ellipsoid) {
    const polygons = this._polygons;
    const length = polygons.length;

    let intersection = Intersect.OUTSIDE;
    if (this.inverse) {
      intersection = Intersect.INSIDE;
    }

    let tileBoundingRectangle = tileBoundingVolume.rectangle;
    if (
      !defined(tileBoundingRectangle) &&
      defined(tileBoundingVolume.boundingVolume?.computeCorners)
    ) {
      const points = tileBoundingVolume.boundingVolume.computeCorners();
      tileBoundingRectangle = Rectangle.fromCartesianArray(
        points,
        ellipsoid,
        scratchRectangleTile,
      );
    }

    if (!defined(tileBoundingRectangle)) {
      tileBoundingRectangle = Rectangle.fromBoundingSphere(
        tileBoundingVolume.boundingSphere,
        ellipsoid,
        scratchRectangleTile,
      );
    }

    for (let i = 0; i < length; ++i) {
      const polygon = polygons[i].clippingPolygon;

      const result = Rectangle.intersection(
        tileBoundingRectangle,
        polygon.rectangle,
        scratchRectangleIntersection,
      );

      if (defined(result)) {
        return Intersect.INTERSECTING;
      }
    }

    return intersection;
  };

/**
 * 将新的 ClippingPolygonCollection 附加到对象上。
 * 应接收新 ClippingPolygonCollection 的对象。
 *
 * @param {ClippingPolygonCollection} [clippingPolygonsCollection] 用于引用 ClippingPolygonCollection 的对象的键。
 * @param {object} owner 用于计算数据并将数据打包成纹理，以进行矢量风格裁剪。
 * @param {string} key 消费者应监听 {@link ClippingPolygonCollection#polygonAdded} 和 {@link ClippingPolygonCollection#polygonRemoved} 事件，以了解数据何时变得过时。数据将在下一次更新调用时刷新（注意：更新由集合的拥有者触发）。
 * @ignore
 */
ClippingPolygonCollection.setOwner = function (
  clippingPolygonsCollection,
  owner,
  key,
) {
  // Don't detach the ClippingPolygonCollection if it is already owned by newOwner
  if (clippingPolygonsCollection === owner[key]) {
    return;
  }
  // Detach the existing ClippingPolygonCollection, if any. It holds no GPU
  // resources of its own, so dropping the reference is sufficient.
  owner[key] = undefined;
  if (defined(clippingPolygonsCollection)) {
    //>>includeStart('debug', pragmas.debug);
    if (defined(clippingPolygonsCollection._owner)) {
      throw new DeveloperError(
        "ClippingPolygonCollection should only be assigned to one object",
      );
    }
    //>>includeEnd('debug');
    clippingPolygonsCollection._owner = owner;
    owner[key] = clippingPolygonsCollection;
  }
};

/**
 * 用于裁剪的空间区域。位于此矩形外的多边形
 * 将不会包含在返回的数据中。
 * 用于创建纹理的上下文。
 *
 * @param {Rectangle} rectangle 指定矩形内的裁剪多边形的数据（包括纹理）。
 * 销毁与给定矩形数据相关的资源。
 * @param {Context} context 用于创建纹理的上下文。
 * @returns {VectorTileData} The 指定矩形内的裁剪多边形的数据（包括纹理）。
 *
 * @ignore
 */
ClippingPolygonCollection.prototype.requestRectangleData = function (
  rectangle,
  context,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("rectangle", rectangle);
  Check.typeOf.object("context", context);
  //>>includeEnd('debug');

  const vectorTileData = {
    rectangle: Rectangle.clone(rectangle),
    polygonRings: [],
  };

  if (this.length === 0) {
    return vectorTileData;
  }

  VectorPipeline.packPolygonRings(
    this._bufferPolygonCollection,
    this._vectorCollectionData,
    rectangle,
    vectorTileData,
  );

  // No overlapping polygons means no textures to pack (and the caller can skip the clipping rendering step)
  if (vectorTileData.polygonRings.length === 0) {
    return vectorTileData;
  }

  VectorPipeline.packPolygonGrid(vectorTileData);

  VectorPipeline.packPolygonTextures(context, vectorTileData);

  return vectorTileData;
};

/**
 * 销毁与给定矩形数据相关的资源。
 *
 * @param {VectorTileData} data 指定矩形内的裁剪多边形的数据（包括纹理）。
 * @ignore
 */
ClippingPolygonCollection.releaseRectangleData = function (data) {
  VectorPipeline.freeResources(data);
};

/**
 * 用于检查上下文是否允许使用需要浮点纹理的裁剪多边形的函数。
 *
 * @param {Scene|object} scene 将包含被裁剪对象和裁剪纹理的场景。
 * @returns {boolean} <code>true</code> 如果上下文支持裁剪多边形。
 */
ClippingPolygonCollection.isSupported = function (scene) {
  return scene?.context.webgl2;
};

/**
 * 如果此对象被销毁，则返回 <code>true</code>；否则返回 <code>false</code>。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁；否则为 <code>false</code>。
 *
 * @deprecated This 该函数在 CesiumJS 1.145 中已被弃用，并将在 1.147 中移除。该集合不再拥有任何 GPU 资源，因此无需将其销毁。
 * @see ClippingPolygonCollection#destroy
 */
ClippingPolygonCollection.prototype.isDestroyed = function () {
  deprecationWarning(
    "ClippingPolygonCollection.isDestroyed",
    isDestroyedDeprecationMessage,
  );
  return false;
};

/**
 * 会销毁此对象所持有的 WebGL 资源。销毁对象可以实现
 * WebGL 资源的确定性释放，而无需依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 应像示例中那样将返回值 (<code>undefined</code>) 赋给该对象。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * clippingPolygons = clippingPolygons && clippingPolygons.destroy();
 *
 * @deprecated This 该函数在 CesiumJS 1.145 中已被弃用，并将在 1.147 中移除。该集合不再拥有任何 GPU 资源，因此无需将其销毁。
 * @see ClippingPolygonCollection#isDestroyed
 */
ClippingPolygonCollection.prototype.destroy = function () {
  deprecationWarning(
    "ClippingPolygonCollection.destroy",
    destroyDeprecationMessage,
  );
  return destroyObject(this);
};

export default ClippingPolygonCollection;
