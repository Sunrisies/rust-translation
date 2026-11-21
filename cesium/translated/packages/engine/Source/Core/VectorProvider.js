// @ts-check

import {
  Cartesian2,
  DeveloperError,
  Math as CesiumMath,
  Rectangle,
  defined,
} from "@cesium/core";
import BufferPolygonCollection from "../Scene/BufferPolygonCollection.js";
import BufferPolylineCollection from "../Scene/BufferPolylineCollection.js";
import HeightReference, {
  isHeightReferenceClamp,
} from "../Scene/HeightReference.js";
import VectorPipeline from "./VectorPipeline.js";

/** @import BufferPrimitive from "../Scene/BufferPrimitive.js"; */
/** @import BufferPrimitiveCollection from "../Scene/BufferPrimitiveCollection.js"; */
/** @import Context from "../Renderer/Context.js"; */
/** @import { Ellipsoid } from "@cesium/core"; */
/** @import TilingScheme from "./TilingScheme.js"; */
/** @import { VectorCollectionData, VectorTileData } from "./VectorPipeline.js"; */

/** @ignore */
const scratchTileRectangle = new Rectangle();
const scratchCollectionRectangle = new Rectangle();
const scratchIntersectRectangle = new Rectangle();
const scratchDirtyTileData = /** @type {VectorTileData} */ ({});

/**
 * 绘制的地图区域及其最宽线。
 * 遵循 <code>VectorCollectionData#widths</code> 的约定。
 *
 * @typedef {object} VectorDirtyRegion
 * @property {Rectangle} rectangle
 * @property {number} maximumWidth
 * @private
 */

/**
 * 提取集合的投影位置及每个基元对应的材料属性快照。
 * 将集合的基元打包到瓦片向量数据中。
 *
 * @callback PackCollectionData
 * @param {*} collection
 * @param {Ellipsoid} ellipsoid
 * @param {VectorCollectionData} [result]
 * @returns {VectorCollectionData}
 * @private
 */

/**
 * 针对集合类型提供打包函数。
 *
 * @callback PackTilePrimitives
 * @param {*} collection
 * @param {VectorCollectionData} collectionData
 * @param {Rectangle} rectangle
 * @param {VectorTileData} result
 * @returns {void}
 * @private
 */

/**
 * 提取集合的快照。
 *
 * @typedef {object} CollectionPacker
 * @property {PackCollectionData} packCollectionData 将集合的基元打包到瓦片中。
 * @property {PackTilePrimitives} packTilePrimitives 按集合类键名进行瓦片类型的打包函数。
 * @private
 */

/**
 * 是否使覆盖像素上的曲线边缘淡出。禁用此功能会更快，但会导致边缘失真。
 * @type {Map<Function, CollectionPacker>}
 * @private
 */
const collectionPackers = new Map();
collectionPackers.set(BufferPolylineCollection, {
  packCollectionData: VectorPipeline.packPolylineCollectionData,
  packTilePrimitives: VectorPipeline.packPolylineSegments,
});
collectionPackers.set(BufferPolygonCollection, {
  packCollectionData: VectorPipeline.packPolygonCollectionData,
  packTilePrimitives: VectorPipeline.packPolygonRings,
});

/**
 * @typedef {object} VectorProviderConstructorOptions
 * @property {TilingScheme} tilingScheme
 * @property {boolean} [antialias=true] 由该提供器生成的瓦片的屏幕尺寸下限，以像素为单位。
 * 曲线边缘在覆盖像素上发生淡出。禁用此功能会更快，但会导致边缘失真。
 * @property {number} [minimumTileScreenPixels=256] 由该提供器生成的瓦片的屏幕尺寸下限，以像素为单位。线条宽度以屏幕像素为单位，但由于没有相机参数，因此这是将尺寸转换为瓦片 UV 数据的方式。
 * 消耗瓦片的表面应从其自身的细化标准中获取此尺寸。
 * @private
 */

/**
 * @ignore
 */
class VectorProvider {
  /** @param {VectorProviderConstructorOptions} options */
  constructor(options) {
    /** @private */
    this._tilingScheme = options.tilingScheme;

    /**
     * 是否使覆盖像素上的曲线边缘淡出。
     * 禁用此功能会更快，但会导致边缘失真。
     *
     * @type {boolean}
     * @default true
     */
    this.antialias = options.antialias ?? true;

    /**
     * 由该提供器生成的瓦片的屏幕尺寸下限，以像素为单位。线条宽度以屏幕像素为单位，但由于没有相机参数，因此这是将尺寸转换为瓦片 UV 数据的方式。
     * 以屏幕像素为单位，但由于没有相机参数，因此这是将尺寸转换为瓦片 UV 数据的方式。
     * 消耗瓦片的表面应从其自身的细化标准中获取此尺寸。
     *
     * @type {number}
     * @default 256
     */
    this.minimumTileScreenPixels = options.minimumTileScreenPixels ?? 256.0;

    /**
     * 被标记的集合会映射到其被标记的 {@link HeightReference}。
     * 该值决定了它们被覆盖的表面。
     * @type {Map<BufferPrimitiveCollection<BufferPrimitive>, HeightReference>}
     * @private
     */
    this._heightReferenceByCollection = new Map();

    /**
     * 集合的投影位置及每个基元对应的材料属性快照。
     * 按集合版本键名的快照。
     * @type {WeakMap<BufferPrimitiveCollection<BufferPrimitive>, VectorCollectionData>}
     * @private
     */
    this._collectionDataCache = new WeakMap();

    /**
     * 此帧中被标记为的收集，只有这些会被生成。
     * @type {Set<BufferPrimitiveCollection<BufferPrimitive>>}
     * @private
     */
    this._markedThisFrame = new Set();

    /** @private */
    this._markedFrameNumber = -1;

    /**
     * 自该帧开始以来，集合是否被添加或移除。
     * @private
     */
    this._changedThisFrame = false;

    /**
     * 自上次更新后改变的地图区域。
     * {@link VectorProvider#makeClean}，因此只有重叠的地形瓦片会重新生成。
     * 瓦片会被重新生成。
     * @type {VectorDirtyRegion[]}
     * @private
     */
    this._dirtyRegions = [];
  }

  /** @type {TilingScheme} */
  get tilingScheme() {
    return this._tilingScheme;
  }

  set tilingScheme(value) {
    this._tilingScheme = value;
  }

  /** @type {Ellipsoid} */
  get ellipsoid() {
    return this._tilingScheme.ellipsoid;
  }

  /**
   * 立即删除集合，而不是等待下一次 {@link VectorProvider#update} 时自动删除。
   * 当集合被销毁时调用此函数，以确保其缓冲区释放后不会被覆盖。
   * 当前集合是否正在被覆盖，即它是否已被标记但尚未被删除。
   *
   * @param {BufferPrimitiveCollection<BufferPrimitive>} collection
   */
  remove(collection) {
    this._markedThisFrame.delete(collection);
    if (this._heightReferenceByCollection.delete(collection)) {
      this._markCollectionRegionDirty(collection);
      this._changedThisFrame = true;
    }
  }

  /**
   * 给定集合类型是否支持覆盖功能。调用者必须自行渲染不支持的收集。
   * 表面着色器绑定到给定向量数据的纹理采样器数量，包括用于选择通道的选色纹理。
   *
   * @param {BufferPrimitiveCollection<BufferPrimitive>} collection
   * @returns {boolean}
   */
  has(collection) {
    return this._heightReferenceByCollection.has(collection);
  }

  /**
   * 此帧将集合标记为被覆盖；未被标记的收集将在下一帧被删除，使被覆盖的集合与渲染的 LOD 保持一致。
   * render unsupported collections themselves.
   *
   * @param {BufferPrimitiveCollection<BufferPrimitive>} collection
   * @returns {boolean}
   */
  static isSupported(collection) {
    return collectionPackers.has(collection.constructor);
  }

  /**
   * Number of texture samplers a surface shader binds to drape the given
   * vector data, including the pick color texture used by the pick pass.
   *
   * @param {VectorTileData|undefined} vectorData
   * @returns {number}
   */
  static getTextureCount(vectorData) {
    if (!defined(vectorData) || !vectorData.show) {
      return 0;
    }
    return (
      2 + (vectorData.hasPolylines ? 4 : 0) + (vectorData.hasPolygons ? 3 : 0)
    );
  }

  /**
   * Marks a collection as draped for this frame; collections not marked are
   * pruned next frame, keeping the draped set aligned with the rendered LOD.
   *
   * @param {BufferPrimitiveCollection<BufferPrimitive>} collection
   * @param {number} frameNumber
   * @param {HeightReference} heightReference 该集合中的表面
   * 被覆盖在： {@link HeightReference.CLAMP_TO_TERRAIN} 上用于地球仪，
   * {@link HeightReference.CLAMP_TO_3D_TILE} 用于 3D Tiles，或
   * {@link HeightReference.CLAMP_TO_GROUND} 用于两者。
   */
  markForFrame(collection, frameNumber, heightReference) {
    //>>includeStart('debug', pragmas.debug);
    if (!VectorProvider.isSupported(collection)) {
      throw new DeveloperError(
        `Draping is not supported for ${collection.constructor.name}. Check VectorProvider.isSupported before marking a collection.`,
      );
    }
    if (!isHeightReferenceClamp(heightReference)) {
      throw new DeveloperError(
        "heightReference must be CLAMP_TO_GROUND, CLAMP_TO_TERRAIN, or CLAMP_TO_3D_TILE.",
      );
    }
    //>>includeEnd('debug');

    this._beginFrame(frameNumber);
    this._markedThisFrame.add(collection);

    if (!this._heightReferenceByCollection.has(collection)) {
      this._markCollectionRegionDirty(collection);
      this._changedThisFrame = true;
    }

    this._heightReferenceByCollection.set(collection, heightReference);
  }

  /**
   * 当新帧开始时，会修剪之前帧中未标记的集合。
   * 从 {@link VectorProvider#markForFrame} 和每帧调用一次
   * 从 {@link VectorProvider#update} 调用，因此在一个没有任何
   * 标记的帧中，仍然会修剪前帧留下的集合。
   *
   * @param {number} frameNumber
   * @private
   */
  _beginFrame(frameNumber) {
    if (frameNumber === this._markedFrameNumber) {
      return;
    }

    for (const collection of this._heightReferenceByCollection.keys()) {
      if (!this._markedThisFrame.has(collection)) {
        this._heightReferenceByCollection.delete(collection);
        this._markCollectionRegionDirty(collection);
      }
    }
    this._markedThisFrame.clear();
    this._changedThisFrame = false;

    this._markedFrameNumber = frameNumber;
  }

  /**
   * 在给定帧内，被覆盖的集合是否发生了变化，在
   * 表面被烘焙之后，因此需要另一个帧来显示变化。在每集合都被标记为该帧后调用一次。
   * 记录已变化的集合区域，以便下一次重新烘焙只处理重叠的瓦片。
   *
   * @param {number} frameNumber
   * @returns {boolean}
   */
  changedDuringFrame(frameNumber) {
    if (frameNumber !== this._markedFrameNumber) {
      return false;
    }
    if (this._changedThisFrame) {
      return true;
    }
    for (const collection of this._heightReferenceByCollection.keys()) {
      if (!this._markedThisFrame.has(collection)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 数据被烘焙的表面的类型，要么是 {@link HeightReference.CLAMP_TO_TERRAIN}，要么是
   * {@link HeightReference.CLAMP_TO_3D_TILE}。只有覆盖在该表面上的集合被包含。
   * @param {BufferPrimitiveCollection<BufferPrimitive>} collection
   * @private
   */
  _markCollectionRegionDirty(collection) {
    this._dirtyRegions.push({
      rectangle: Rectangle.fromBoundingSphere(
        collection.boundingVolume,
        this._tilingScheme.ellipsoid,
        new Rectangle(),
      ),
      maximumWidth:
        this._collectionDataCache.get(collection)?.maximumWidth ?? 0.0,
    });
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} level
   * @param {Context} context
   * @param {HeightReference} targetHeightReference 数据被烘焙的表面的类型，要么是 {@link HeightReference.CLAMP_TO_TERRAIN}，要么是
   * {@link HeightReference.CLAMP_TO_3D_TILE}。只有覆盖在该表面上的集合被包含。
   * 为任意地图矩形烘焙向量查找数据，例如
   * 3D Tiles 内容的边界区域。
   * @returns {VectorTileData}
   */
  requestTileData(x, y, level, context, targetHeightReference) {
    const tileRectangle = this._tilingScheme.tileXYToRectangle(
      x,
      y,
      level,
      scratchTileRectangle,
    );
    return this.requestDataForRectangle(
      tileRectangle,
      context,
      targetHeightReference,
    );
  }

  /**
   * 数据被烘焙的表面的类型，要么是 {@link HeightReference.CLAMP_TO_TERRAIN}，要么是
   * {@link HeightReference.CLAMP_TO_3D_TILE}。只有覆盖在该表面上的集合被包含。
   *
   * @param {Rectangle} rectangle
   * @param {Context} context
   * @param {HeightReference} targetHeightReference 数据被烘焙的表面的类型，要么是 {@link HeightReference.CLAMP_TO_TERRAIN}，要么是
   * {@link HeightReference.CLAMP_TO_3D_TILE}。只有覆盖在该表面上的集合被包含。
   * 一个瓦片是否与自上次变化后改变的区域重叠
   * {@link VectorProvider#makeClean}。
   * @returns {VectorTileData}
   */
  requestDataForRectangle(rectangle, context, targetHeightReference) {
    const tilingScheme = this._tilingScheme;
    const heightReferenceByCollection = this._heightReferenceByCollection;

    /** @type {VectorTileData} */
    const result = {
      show: true,
      hasPolylines: false,
      hasPolygons: false,
      rectangle: Rectangle.clone(rectangle),
      collectionVersions: new Map(),
      minimumTileScreenPixels: this.minimumTileScreenPixels,
      metersPerUv: computeMetersPerUv(rectangle, tilingScheme.ellipsoid),
    };

    for (const [collection, heightReference] of heightReferenceByCollection) {
      if (!targetsSurface(heightReference, targetHeightReference)) {
        continue;
      }

      // Guaranteed by the VectorProvider.isSupported check in markForFrame.
      const packer = /** @type {CollectionPacker} */ (
        collectionPackers.get(collection.constructor)
      );

      const collectionData = this._getCollectionDataCached(
        collection,
        packer.packCollectionData,
      );

      const collectionRectangle = computePaintedRectangle(
        collectionData,
        rectangle,
        result,
        scratchCollectionRectangle,
      );

      const isIntersected = !!Rectangle.intersection(
        rectangle,
        collectionRectangle,
        scratchIntersectRectangle,
      );

      if (!isIntersected) {
        continue;
      }

      result.collectionVersions.set(collection, collectionData.version);
      packer.packTilePrimitives(collection, collectionData, rectangle, result);
    }

    const hasPolylines =
      defined(result.polylineSegments) && result.polylineSegments.length > 0;
    const hasPolygons =
      defined(result.polygonRings) && result.polygonRings.length > 0;
    result.hasPolylines = hasPolylines;
    result.hasPolygons = hasPolygons;

    if (!hasPolylines && !hasPolygons) {
      result.show = false;
      return result;
    }

    if (hasPolylines) {
      VectorPipeline.packPolylineGrid(result);
      VectorPipeline.packPolylineTextures(context, result);
    }

    if (hasPolygons) {
      VectorPipeline.packPolygonGrid(result);
      VectorPipeline.packPolygonTextures(context, result);
    }

    VectorPipeline.packPrimitiveTextures(context, result);

    return result;
  }

  /**
   * @param {VectorTileData} data
   */
  releaseTileData(data) {
    VectorPipeline.freeResources(data);
  }

  /**
   * 当从
   * {@link VectorProvider#makeClean} 重新烘焙的向量数据发生变化时，为任意矩形重新烘焙向量数据。与 {@link VectorProvider#isTileDirty} 不同，此操作不查询 {@link VectorProvider#_dirtyRegions} — 它们会在每帧通过 {@link VectorProvider#makeClean} 清除，而地形外的消费者无法依赖观察到这些区域 — 因此陈旧性是通过比较数据烘焙时记录的集合版本来检测的。
   *
   * @param {number} x
   * @param {number} y
   * @param {number} level
   * @returns {boolean}
   */
  isTileDirty(x, y, level) {
    return intersectRegions(
      x,
      y,
      level,
      this._dirtyRegions,
      this._tilingScheme,
      this.minimumTileScreenPixels,
    );
  }

  /**
   * 要么是
   * {@link HeightReference.CLAMP_TO_TERRAIN}，要么是 {@link HeightReference.CLAMP_TO_3D_TILE}。
   * 烘焙后的数据是否不再反映其矩形内重叠的集合。当从其中烘焙的集合发生变化时，或者
   * 集合离开矩形或被修剪，或者集合自烘焙后进入矩形时，即为陈旧。
   * 清除被记录为已变化的区域。在重新烘焙通过后调用一次。
   * comparing the collection versions recorded when the data was baked.
   *
   * @param {Rectangle} rectangle
   * @param {Context} context
   * @param {VectorTileData} currentData
   * @param {HeightReference} targetHeightReference Either
   * {@link HeightReference.CLAMP_TO_TERRAIN} or {@link HeightReference.CLAMP_TO_3D_TILE}.
   * @returns {VectorTileData}
   */
  updateDataForRectangle(
    rectangle,
    context,
    currentData,
    targetHeightReference,
  ) {
    if (!this._isStale(currentData, rectangle, targetHeightReference)) {
      return currentData;
    }

    this.releaseTileData(currentData);

    return this.requestDataForRectangle(
      rectangle,
      context,
      targetHeightReference,
    );
  }

  /**
   * Whether baked data no longer reflects the collections overlapping its
   * rectangle. Stale when a collection it was baked from has changed, when a
   * collection has left the rectangle or been pruned, or when a collection has
   * moved into the rectangle since the bake.
   *
   * @param {VectorTileData} data
   * @param {Rectangle} rectangle
   * @param {HeightReference} targetHeightReference
   * @returns {boolean}
   * @private
   */
  _isStale(data, rectangle, targetHeightReference) {
    // The rectangle itself can change, such as when a model moves.
    if (!Rectangle.equals(data.rectangle, rectangle)) {
      return true;
    }

    const bakedVersions = data.collectionVersions;
    const heightReferenceByCollection = this._heightReferenceByCollection;
    let bakedVersionsVisited = 0;

    for (const [collection, heightReference] of heightReferenceByCollection) {
      if (!targetsSurface(heightReference, targetHeightReference)) {
        continue;
      }

      // Guaranteed by the VectorProvider.isSupported check in markForFrame.
      const packer = /** @type {CollectionPacker} */ (
        collectionPackers.get(collection.constructor)
      );
      const collectionRectangle = computePaintedRectangle(
        this._getCollectionDataCached(collection, packer.packCollectionData),
        rectangle,
        data,
        scratchCollectionRectangle,
      );
      const isIntersected = !!Rectangle.intersection(
        rectangle,
        collectionRectangle,
        scratchIntersectRectangle,
      );
      const bakedVersion = bakedVersions.get(collection);

      if (!isIntersected) {
        // Left the rectangle since the bake.
        if (defined(bakedVersion)) {
          return true;
        }
        continue;
      }

      // Moved into the rectangle since the bake.
      if (!defined(bakedVersion)) {
        return true;
      }

      bakedVersionsVisited++;

      if (bakedVersion !== collection._version) {
        return true;
      }
    }

    // A collection the data was baked from is no longer marked.
    return bakedVersionsVisited !== bakedVersions.size;
  }

  /**
   * Clears the regions recorded as changed. Call once after a re-bake pass has
   * 释放与 {@link VectorProvider#isTileDirty} 检测到的重叠瓦片。
   */
  makeClean() {
    this._dirtyRegions.length = 0;
  }

  /**
   * 修剪上一帧未被标记的集合，并记录脏区域。
   * 对于自上次提取后内容发生变化的集合，
   * 重新生成重叠瓦片。每帧调用一次，在
   * {@link VectorProvider#isTileDirty} 之前执行。
   *
   * @param {number} [frameNumber] 当前帧数。如果省略，
   * 被标记的集合保持不变，仅记录脏区域。
   */
  update(frameNumber) {
    if (defined(frameNumber)) {
      this._beginFrame(frameNumber);
    }

    for (const collection of this._heightReferenceByCollection.keys()) {
      const cache = this._collectionDataCache.get(collection);
      if (!defined(cache)) {
        // Never extracted; new tiles bake on request.
        continue;
      }
      if (cache.version === collection._version) {
        continue;
      }
      // Re-bake the previously baked region; content may have moved away from it.
      if (defined(cache.rectangle)) {
        this._dirtyRegions.push({
          rectangle: Rectangle.clone(cache.rectangle),
          maximumWidth: cache.maximumWidth,
        });
      }

      // Guaranteed by the VectorProvider.isSupported check in markForFrame.
      const packer = /** @type {CollectionPacker} */ (
        collectionPackers.get(collection.constructor)
      );

      // Extract first, so a stroke that widened reaches tiles its old width missed.
      this._getCollectionDataCached(collection, packer.packCollectionData);
      this._markCollectionRegionDirty(collection);
    }
  }

  /**
   * 返回集合的 {@link VectorCollectionData} 快照，
   * 当集合发生变化时重新提取。
   *
   * @param {BufferPrimitiveCollection<BufferPrimitive>} collection
   * @param {PackCollectionData} packCollectionData
   * @returns {VectorCollectionData}
   * @private
   */
  _getCollectionDataCached(collection, packCollectionData) {
    const cache = this._collectionDataCache.get(collection);

    if (defined(cache) && cache.version === collection._version) {
      return cache;
    }

    const ellipsoid = this.ellipsoid;
    const data = packCollectionData(collection, ellipsoid, cache);

    data.rectangle = Rectangle.fromBoundingSphere(
      collection.boundingVolume,
      ellipsoid,
      data.rectangle,
    );
    this._collectionDataCache.set(collection, data);

    return data;
  }
}

/**
 * 使用 <code>collectionHeightReference</code> 覆盖的集合是否能够落在
 * 具有 <code>targetHeightReference</code> 类型的表面上。
 *
 * @param {HeightReference} collectionHeightReference
 * @param {HeightReference} targetHeightReference 要么
 * {@link HeightReference.CLAMP_TO_TERRAIN} 或 {@link HeightReference.CLAMP_TO_3D_TILE}。
 * @returns {boolean}
 * @private
 */
function targetsSurface(collectionHeightReference, targetHeightReference) {
  return (
    collectionHeightReference === HeightReference.CLAMP_TO_GROUND ||
    collectionHeightReference === targetHeightReference
  );
}

/**
 * 矩形 UV 域中的地面尺寸，以米为单位。在中心纬度处计算，因此
 * 东西向比例会向南北边缘偏移。
 *
 * @param {Rectangle} rectangle
 * @param {Ellipsoid} ellipsoid
 * @returns {Cartesian2}
 * @private
 */
function computeMetersPerUv(rectangle, ellipsoid) {
  const radius = ellipsoid.maximumRadius;
  const centerLatitude = (rectangle.south + rectangle.north) * 0.5;
  return new Cartesian2(
    rectangle.width * radius * Math.cos(centerLatitude),
    rectangle.height * radius,
  );
}

/**
 * 集合绘制的地面：其几何形状占据的矩形区域，通过
 * 最宽半边长度增长而成。边缘使用与裁剪为瓦片的相同 UV 转换规则，
 * 因此与结果重叠的瓦片是接收了几何数据的瓦片。
 * 在生成时包含几何数据。
 *
 * @param {VectorDirtyRegion} region
 * @param {Rectangle} tileRectangle 边缘所测量的参照瓦片。
 * @param {VectorTileData} tileData
 * @param {Rectangle} result
 * @returns {Rectangle}
 * @private
 */
function computePaintedRectangle(region, tileRectangle, tileData, result) {
  const uvMargin = VectorPipeline.maximumHalfWidthToTileUv(
    region.maximumWidth,
    tileData,
  );
  const marginLongitude = uvMargin * tileRectangle.width;
  const collectionRectangle = region.rectangle;

  Rectangle.clone(collectionRectangle, result);

  // Latitude does not wrap, so a margin reaching past a pole is harmless.
  result.south -= uvMargin * tileRectangle.height;
  result.north += uvMargin * tileRectangle.height;

  if (collectionRectangle.width + 2.0 * marginLongitude >= CesiumMath.TWO_PI) {
    result.west = -CesiumMath.PI;
    result.east = CesiumMath.PI;
  } else {
    result.west = CesiumMath.negativePiToPi(result.west - marginLongitude);
    result.east = CesiumMath.negativePiToPi(result.east + marginLongitude);
  }

  return result;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} level
 * @param {VectorDirtyRegion[]} regions
 * @param {TilingScheme} tilingScheme
 * @param {number} minimumTileScreenPixels
 * @returns {boolean}
 * @private
 */
function intersectRegions(
  x,
  y,
  level,
  regions,
  tilingScheme,
  minimumTileScreenPixels,
) {
  // No dirty regions recorded — nothing to re-bake. A caller needing a full
  // re-bake should record Rectangle.MAX_VALUE instead.
  if (regions.length === 0) {
    return false;
  }

  const tileRectangle = tilingScheme.tileXYToRectangle(
    x,
    y,
    level,
    scratchTileRectangle,
  );

  // Matches the predicate the tile was baked with, so a region painting into
  // the tile without reaching it geometrically still marks it for re-bake.
  scratchDirtyTileData.minimumTileScreenPixels = minimumTileScreenPixels;
  scratchDirtyTileData.metersPerUv = computeMetersPerUv(
    tileRectangle,
    tilingScheme.ellipsoid,
  );

  for (let i = 0; i < regions.length; i++) {
    const paintedRectangle = computePaintedRectangle(
      regions[i],
      tileRectangle,
      scratchDirtyTileData,
      scratchCollectionRectangle,
    );

    const isIntersected = Rectangle.intersection(
      tileRectangle,
      paintedRectangle,
      scratchIntersectRectangle,
    );

    if (isIntersected) {
      return true;
    }
  }

  return false;
}

export default VectorProvider;
