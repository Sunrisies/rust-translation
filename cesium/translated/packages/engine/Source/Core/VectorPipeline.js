// @ts-check

import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  Math as CesiumMath,
  Matrix4,
  PixelDatatype,
  PixelFormat,
  Rectangle,
  defined,
  oneTimeWarning,
} from "@cesium/core";
import Sampler from "../Renderer/Sampler.js";
import Texture from "../Renderer/Texture.js";
import BufferPolygon from "../Scene/BufferPolygon.js";
import BufferPolygonMaterial from "../Scene/BufferPolygonMaterial.js";
import BufferPolyline from "../Scene/BufferPolyline.js";
import BufferPolylineMaterial from "../Scene/BufferPolylineMaterial.js";

/** @import BufferPrimitive from "../Scene/BufferPrimitive.js"; */
/** @import BufferPrimitiveCollection from "../Scene/BufferPrimitiveCollection.js"; */
/** @import BufferPolygonCollection from "../Scene/BufferPolygonCollection.js"; */
/** @import BufferPolylineCollection from "../Scene/BufferPolylineCollection.js"; */
/** @import Context from "../Renderer/Context.js"; */
/** @import { Ellipsoid } from "@cesium/core"; */
/** @import TilingScheme from "./TilingScheme.js"; */
/** @import {TypedArray, TypedArrayConstructor} from "@cesium/core"; */

const GRID_TARGET_SEGMENTS_PER_CELL = 16;
const GRID_NEIGHBOR_PADDING_SCALE = 0.35;

// Each tile measures distance on a plane tangent at its center, so beyond this ground angle a
// stroke's edges no longer line up across tile seams.
const MAXIMUM_GROUND_WIDTH_ANGLE = 0.1;

const scratchPolyline = new BufferPolyline();
const scratchPolylineMaterial = new BufferPolylineMaterial();
const scratchPolygon = new BufferPolygon();
const scratchPolygonMaterial = new BufferPolygonMaterial();
const scratchLocalPosition = new Cartesian3();
const scratchWorldPosition = new Cartesian3();
const scratchCartographic = new Cartographic();
const scratchSegmentStart = new Cartesian2();
const scratchSegmentEnd = new Cartesian2();
const scratchPickColor = new Color();

/**
 * 与地形瓦片相交的向量几何图形，映射到瓦片的 [0,1]^2 UV 域中。
 *
 * @typedef {object} VectorTileData
 *
 * @property {boolean} show 是否应渲染此向量数据。
 * @property {boolean} hasPolylines 折线查找数据是否已预计算。
 * @property {boolean} hasPolygons 多边形查找数据是否已预计算。
 * @property {Map<BufferPrimitiveCollection<BufferPrimitive>, number>} collectionVersions 每个的版本。
 * 用于检查数据是否过时，数据从哪个集合预计算而来。
 * @property {Rectangle} rectangle 数据预计算的地图矩形范围。
 * @property {number} minimumTileScreenPixels 瓦片屏幕尺寸的下限，以像素为单位。
 * 用于将屏幕空间线宽转换为瓦片 UV 坐标。
 * @property {Cartesian2} metersPerUv 瓦片的地面尺寸，沿每个 UV 轴以米为单位。测量在
 * 一个与瓦片中心相切的平面上，因此会从真实表面距离向瓦片边缘偏移。
 * @property {boolean} [hasPixelWidths] 任何折线宽度是否以屏幕像素为单位。
 * @property {boolean} [hasMeterWidths] 任何折线宽度是否以米为单位。
 *
 * 阶段 1：收集与瓦片相交的向量段和多边形环。
 * @property {number[][]} [polylineSegments] 被瓦片裁剪的折线段，以 [ax, ay, bx, by] 的形式出现在瓦片 UV 空间中。
 * @property {number[]} [polylineSegmentPrimitiveIndices] 每个段的索引，用于映射该段对应的材质。
 * @property {Float64Array[]} [polygonRings] 被瓦片裁剪的多边形环，以平坦的 [x0, y0, x1, y1, ...] 形式出现在瓦片 UV 空间中。
 * @property {number[]} [polygonRingPrimitiveIndices] 每个环的索引，用于映射该环对应的材质。
 * @property {Float32Array[]} [widths] 有符号原始体宽度，按原始体索引计算。
 * @property {Uint8Array[]} [colors] 原始体颜色，按原始体索引计算。
 * @property {Uint8Array[]} [pickColors] 原始体选择颜色，按原始体索引计算。
 * @property {number} [primitiveCount] 瓦片中向量原始体的数量。
 *
 * 阶段 2：构建 CPU 网格结构。
 * @property {Float32Array} [polylineSegmentTexels] 打包的 RGBA 线段（ax, ay, bx, by），在瓦片 UV 空间中，-1 表示填充。
 * @property {number} [polylineSegmentTextureWidth] 线段纹理的宽度，以 texels 为单位。
 * @property {number} [polylineSegmentTextureHeight] 线段纹理的高度，以 texels 为单位。
 * @property {Float32Array} [polylineSegmentPrimitiveIndicesTexels] 每个段的索引，用于映射该段对应的材质。
 * @property {Uint32Array} [polylineGridCellIndices] 折线网格头信息 [gridWidth, gridHeight, ...每单元格结束偏移量]。
 * @property {Float32Array} [polygonEdgeTexels] 打包的 RGBA 多边形环边缘（ax, ay, bx, by），按网格单元裁剪，-1 表示填充。
 * @property {number} [polygonEdgeTextureWidth] 多边形边缘纹理的宽度，以 texels 为单位。
 * @property {number} [polygonEdgeTextureHeight] 多边形边缘纹理的高度，以 texels 为单位。
 * @property {Float32Array} [polygonEdgePrimitiveIndicesTexels] 每个多边形边缘的索引，用于映射该边缘对应的材质。
 * @property {Uint32Array} [polygonGridCellIndices] 多边形网格头信息 [gridWidth, gridHeight, ...每单元格结束偏移量]。
 *
 * 阶段 3：构建 GPU 纹理资源，在绘制时延迟上传。
 * @property {Texture} [polylineSegmentTexture] 多边形段纹理的 GPU 纹理，大小为 polylineSegmentTexels。
 * @property {Texture} [polylineSegmentPrimitiveIndicesTexture] 每个段的原始体索引的 GPU 纹理。
 * @property {Texture} [widthTexture] 原始体宽度对应的 GPU 纹理，按原始体索引计算。
 * @property {Texture} [colorTexture] 原始体颜色对应的 GPU 纹理，按原始体索引计算。
 * @property {Texture} [pickColorTexture] 原始体选择颜色对应的 GPU 纹理，按原始体索引计算。
 * @property {Texture} [polylineGridCellIndicesTexture] 多边形网格单元索引的 GPU 纹理。
 * @property {Texture} [polygonEdgeTexture] 多边形边缘纹理的 GPU 纹理。
 * @property {Texture} [polygonEdgePrimitiveIndicesTexture] 每个多边形边缘的原始体索引对应的 GPU 纹理。
 * @property {Texture} [polygonGridCellIndicesTexture] `polygonGridCellIndices` 的 GPU 纹理。
 *
 * @private
 */

/**
 * 向量集合的快照 — 投影后的顶点位置以及
 * 每个基元材质属性 — 在单次遍历中提取。
 *
 * @typedef {object} VectorCollectionData
 *
 * @property {number} version `collection._version` 在数据最后更新时的状态。
 * @property {Rectangle} rectangle 向量集合边界体积的矩形区域。
 * @property {Float64Array} positions 集合位置，以 [lng, lat] 弧度形式投影到椭球上。
 * @property {Float32Array} widths 按基元索引表示的带符号基元宽度。负数值表示
 * 地面上的米级宽度；正数值表示屏幕像素级宽度。对于
 * 多边形集合，则填充为零。
 * @property {number} maximumWidth 最宽基元的带符号宽度，遵循与 `widths` 相同的约定。对于多边形集合，则填充为零。
 * 宽度是否以地面上的米为单位而非屏幕像素。
 * @property {boolean} [widthInMeters] 宽度是地面上的米还是屏幕像素。
 * @property {Uint8Array} colors 按基元索引表示的基元颜色。
 * @property {Uint8Array} pickColors 按基元索引表示的基元拾取颜色。当
 * 集合不允许拾取时，则填充为零。
 *
 * @private
 */

/**
 * 使用受限 {@link HeightReference} 模式渲染向量数据的管道。
 *
 * 将向量数据投影到给定 {@link TilingScheme} 的 [0,1]^2 UV 域中，裁剪至瓦片边界，并打包由 Globe 和 3D Tiles 渲染器使用的网格索引段查找表。
 * 多边形集合中最宽线的半长加上其抗锯齿边缘，作为
 *
 * @see VectorProvider
 * @ignore
 */
class VectorPipeline {
  /**
   * @param {BufferPolylineCollection} collection
   * @param {Ellipsoid} ellipsoid
   * @param {VectorCollectionData} [result]
   * @returns {VectorCollectionData}
   */
  static packPolylineCollectionData(collection, ellipsoid, result) {
    if (defined(result) && collection._version === result.version) {
      return result;
    }

    const primitiveCount = collection.primitiveCount;
    const boundingVolume = collection.boundingVolume;

    const rectangle = Rectangle.fromBoundingSphere(boundingVolume, ellipsoid);
    const positions = _getProjectedPositions(collection, ellipsoid);

    const widths = new Float32Array(primitiveCount);
    const colors = new Uint8Array(primitiveCount * 4);
    const pickColors = new Uint8Array(primitiveCount * 4);
    const widthInMeters = collection.widthUnits === "meters";
    const maximumGroundWidth = widthInMeters
      ? MAXIMUM_GROUND_WIDTH_ANGLE * ellipsoid.maximumRadius
      : Number.POSITIVE_INFINITY;
    let maximumWidthMagnitude = 0.0;
    let isWidthClamped = false;

    for (let i = 0; i < primitiveCount; i++) {
      const polyline = /** @type {BufferPolyline} */ (
        collection.get(i, scratchPolyline)
      );

      // Append materials unconditionally, to simplify indexing and updates.
      const polylineMaterial = /** @type {BufferPolylineMaterial} */ (
        polyline.getMaterial(scratchPolylineMaterial)
      );

      const width = Math.min(polylineMaterial.width, maximumGroundWidth);
      isWidthClamped ||= width < polylineMaterial.width;

      widths[i] = widthInMeters ? -width : width;
      maximumWidthMagnitude = Math.max(maximumWidthMagnitude, Math.abs(width));

      colors[i * 4] = Color.floatToByte(polylineMaterial.color.red);
      colors[i * 4 + 1] = Color.floatToByte(polylineMaterial.color.green);
      colors[i * 4 + 2] = Color.floatToByte(polylineMaterial.color.blue);
      colors[i * 4 + 3] = Color.floatToByte(polylineMaterial.color.alpha);

      _writePickColor(pickColors, i, polyline._pickId);
    }

    if (isWidthClamped) {
      oneTimeWarning(
        "vector-ground-width-clamped",
        `Polyline widths in meters are clamped to ${maximumGroundWidth.toFixed(0)} meters. Wider strokes have edges that do not line up across tile seams.`,
      );
    }

    return Object.assign(
      result ?? {},
      /** @type {VectorCollectionData} */ ({
        version: collection._version,
        rectangle: rectangle,
        positions: positions,
        widths: widths,
        maximumWidth: widthInMeters
          ? -maximumWidthMagnitude
          : maximumWidthMagnitude,
        widthInMeters: widthInMeters,
        colors: colors,
        pickColors: pickColors,
      }),
    );
  }

  /**
   * 瓦片 UV 域的一部分。这表示集合在几何形状占据的矩形之外绘制的范围。
   * 将集合中所有可见多线投影到瓦片本地 UV 段中，
   * 裁剪至瓦片，并将 [ax, ay, bx, by] 添加到段数组中。
   *
   * @param {number} maximumWidth
   * @param {VectorTileData} tileData
   * @returns {number}
   */
  static maximumHalfWidthToTileUv(maximumWidth, tileData) {
    if (maximumWidth === 0.0) {
      return 0.0;
    }
    return _halfWidthToTileUv(maximumWidth, tileData);
  }

  /**
   * 将 UV 空间段打包成网格索引段查找表。返回打包后的
   * 段纹理像素（RGBA，填充值为 -1）以及网格单元索引头信息。
   *
   * @param {BufferPolylineCollection} collection
   * @param {VectorCollectionData} collectionData
   * @param {Rectangle} rectangle
   * @param {VectorTileData} result
   */
  static packPolylineSegments(collection, collectionData, rectangle, result) {
    result.polylineSegments ??= [];
    result.widths ??= [];
    result.colors ??= [];
    result.pickColors ??= [];
    result.polylineSegmentPrimitiveIndices ??= [];
    result.primitiveCount ??= 0;
    result.rectangle ??= Rectangle.clone(rectangle);

    const width = rectangle.width;
    const primitiveCount = collection.primitiveCount;
    const positions = collectionData.positions;

    for (let i = 0; i < primitiveCount; i++) {
      const polyline = /** @type {BufferPolyline} */ (
        collection.get(i, scratchPolyline)
      );
      if (!polyline.show) {
        continue;
      }

      const vertexCount = polyline.vertexCount;
      const vertexOffset = polyline.vertexOffset;

      // A line whose centerline lies outside the tile still covers pixels inside it.
      const margin = Math.max(
        CesiumMath.EPSILON3,
        _halfWidthToTileUv(collectionData.widths[i], result),
      );

      for (let j = 0; j + 1 < vertexCount; j++) {
        const segmentStart = Cartesian2.fromArray(
          // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
          positions,
          (vertexOffset + j) * 2,
          scratchSegmentStart,
        );

        const segmentEnd = Cartesian2.fromArray(
          // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
          positions,
          (vertexOffset + j + 1) * 2,
          scratchSegmentEnd,
        );

        _projectSegmentToTileUv(segmentStart, segmentEnd, rectangle, width);

        const clipped = _clipSegmentToTile(segmentStart, segmentEnd, margin);

        if (clipped) {
          result.polylineSegments.push([
            segmentStart.x,
            segmentStart.y,
            segmentEnd.x,
            segmentEnd.y,
          ]);
          result.polylineSegmentPrimitiveIndices.push(
            result.primitiveCount + i,
          );
        }
      }
    }

    // Append materials unconditionally, to simplify indexing and updates.
    result.widths.push(collectionData.widths);
    result.colors.push(collectionData.colors);
    result.pickColors.push(collectionData.pickColors);
    if (primitiveCount > 0) {
      result.hasPixelWidths ||= !collectionData.widthInMeters;
      result.hasMeterWidths ||= collectionData.widthInMeters;
    }

    result.primitiveCount += primitiveCount;
  }

  /**
   * 将集合中所有可见多边形环（外环和洞）投影到瓦片本地 UV 空间，裁剪至瓦片，并将每个存活的
   * 环作为闭合的 [x0, y0, x1, y1, ...] 循环添加到中。
   *
   * @param {VectorTileData} result
   */
  static packPolylineGrid(result) {
    const segments = result.polylineSegments;
    const segmentPrimitiveIndices = result.polylineSegmentPrimitiveIndices;

    const gridSize = Math.max(
      1,
      Math.ceil(Math.sqrt(segments.length / GRID_TARGET_SEGMENTS_PER_CELL)),
    );

    const grid = new Array(gridSize * gridSize);
    for (let i = 0; i < grid.length; i++) {
      grid[i] = [];
    }

    let packedSegmentCount = 0;
    // Each segment is assigned to every cell its padded bounding box overlaps, so
    // the shader also sees lines just outside the cell it samples.
    const cellPadding = GRID_NEIGHBOR_PADDING_SCALE / gridSize;
    const widths = _concatTypedArrays(result.widths);
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const padding = Math.max(
        cellPadding,
        _halfWidthToTileUv(widths[segmentPrimitiveIndices[i]], result),
      );
      const minX = Math.max(0.0, Math.min(segment[0], segment[2]) - padding);
      const maxX = Math.min(1.0, Math.max(segment[0], segment[2]) + padding);
      const minY = Math.max(0.0, Math.min(segment[1], segment[3]) - padding);
      const maxY = Math.min(1.0, Math.max(segment[1], segment[3]) + padding);

      const startCellX = _clampCellIndex(Math.floor(minX * gridSize), gridSize);
      const endCellX = _clampCellIndex(Math.floor(maxX * gridSize), gridSize);
      const startCellY = _clampCellIndex(Math.floor(minY * gridSize), gridSize);
      const endCellY = _clampCellIndex(Math.floor(maxY * gridSize), gridSize);

      for (let y = startCellY; y <= endCellY; y++) {
        for (let x = startCellX; x <= endCellX; x++) {
          grid[y * gridSize + x].push(i);
          packedSegmentCount++;
        }
      }
    }

    const [textureWidth, textureHeight] =
      _nextPowerOfTwoSize(packedSegmentCount);
    const capacity = textureWidth * textureHeight;

    const segmentTexels = new Float32Array(capacity * 4).fill(-1.0);
    const segmentPrimitiveIndicesTexels = new Float32Array(capacity).fill(-1.0);

    const gridCellIndices = new Uint32Array(grid.length + 2);
    gridCellIndices[0] = gridSize;
    gridCellIndices[1] = gridSize;

    let offset = 0;
    for (let i = 0; i < grid.length; i++) {
      const cellSegments = grid[i];
      for (let j = 0; j < cellSegments.length; j++) {
        const segmentIndex = cellSegments[j];
        const segment = segments[segmentIndex];
        segmentTexels[offset * 4] = segment[0]; // R
        segmentTexels[offset * 4 + 1] = segment[1]; // G
        segmentTexels[offset * 4 + 2] = segment[2]; // B
        segmentTexels[offset * 4 + 3] = segment[3]; // A

        const primitiveIndex = segmentPrimitiveIndices[segmentIndex];
        segmentPrimitiveIndicesTexels[offset] = primitiveIndex;

        offset++;
      }
      gridCellIndices[i + 2] = offset;
    }

    result.polylineSegmentTexels = segmentTexels;
    result.polylineSegmentTextureWidth = textureWidth;
    result.polylineSegmentTextureHeight = textureHeight;
    result.polylineSegmentPrimitiveIndicesTexels =
      segmentPrimitiveIndicesTexels;
    result.polylineGridCellIndices = gridCellIndices;
  }

  /**
   * @param {BufferPolygonCollection} collection
   * @param {Ellipsoid} ellipsoid
   * @param {VectorCollectionData} [result]
   * @returns {VectorCollectionData}
   */
  static packPolygonCollectionData(collection, ellipsoid, result) {
    if (defined(result) && collection._version === result.version) {
      return result;
    }

    const primitiveCount = collection.primitiveCount;
    const boundingVolume = collection.boundingVolume;

    const rectangle = Rectangle.fromBoundingSphere(boundingVolume, ellipsoid);
    const positions = _getProjectedPositions(collection, ellipsoid);

    // Widths are unused by polygon fills; zero-filled so polygons share the
    // primitive index space (and width/color textures) with polylines.
    const widths = new Float32Array(primitiveCount);
    const colors = new Uint8Array(primitiveCount * 4);
    const pickColors = new Uint8Array(primitiveCount * 4);

    for (let i = 0; i < primitiveCount; i++) {
      const polygon = /** @type {BufferPolygon} */ (
        collection.get(i, scratchPolygon)
      );

      // Append materials unconditionally, to simplify indexing and updates.
      const polygonMaterial = /** @type {BufferPolygonMaterial} */ (
        polygon.getMaterial(scratchPolygonMaterial)
      );

      colors[i * 4] = Color.floatToByte(polygonMaterial.color.red);
      colors[i * 4 + 1] = Color.floatToByte(polygonMaterial.color.green);
      colors[i * 4 + 2] = Color.floatToByte(polygonMaterial.color.blue);
      colors[i * 4 + 3] = Color.floatToByte(polygonMaterial.color.alpha);

      _writePickColor(pickColors, i, polygon._pickId);
    }

    return Object.assign(
      result ?? {},
      /** @type {VectorCollectionData} */ ({
        version: collection._version,
        rectangle: rectangle,
        positions: positions,
        widths: widths,
        maximumWidth: 0.0,
        colors: colors,
        pickColors: pickColors,
      }),
    );
  }

  /**
   * 将集合中所有可见多边形环（外环和洞）投影到瓦片本地 UV 空间，裁剪至瓦片，并将每个存活的
   * 环作为扁平的 [x0, y0, x1, y1, ...] 闭合环添加到中。
   * 将 UV 空间多边形环打包成网格索引边缘查找表。每个环
   *
   * @param {BufferPolygonCollection} collection
   * @param {VectorCollectionData} collectionData
   * @param {Rectangle} rectangle
   * @param {VectorTileData} result
   */
  static packPolygonRings(collection, collectionData, rectangle, result) {
    result.polygonRings ??= [];
    result.polygonRingPrimitiveIndices ??= [];
    result.widths ??= [];
    result.colors ??= [];
    result.pickColors ??= [];
    result.primitiveCount ??= 0;
    result.rectangle ??= Rectangle.clone(rectangle);

    const width = rectangle.width;
    const primitiveCount = collection.primitiveCount;
    const positions = collectionData.positions;

    for (let i = 0; i < primitiveCount; i++) {
      const polygon = /** @type {BufferPolygon} */ (
        collection.get(i, scratchPolygon)
      );
      if (!polygon.show) {
        continue;
      }

      const vertexOffset = polygon.vertexOffset;
      const vertexCount = polygon.vertexCount;
      const holes = polygon.getHoles();

      // Ring r spans [ringStart, ringEnd): the outer ring, then each hole.
      // The shader's even-odd test makes hole rings cancel enclosing coverage.
      for (let r = 0; r <= holes.length; r++) {
        const ringStart = r === 0 ? 0 : holes[r - 1];
        const ringEnd = r === holes.length ? vertexCount : holes[r];
        const ringVertexCount = ringEnd - ringStart;
        if (ringVertexCount < 3) {
          continue;
        }

        const ringUv = _projectRingToTileUv(
          positions,
          vertexOffset + ringStart,
          ringVertexCount,
          rectangle,
          width,
        );

        // Clip to the tile plus the shared tile clip margin. A ring enclosing
        // the whole tile clips to the tile rectangle itself, so tiles
        // interior to a large polygon remain covered.
        const clipped = _clipRingToRect(
          ringUv,
          ringVertexCount,
          -CesiumMath.EPSILON3,
          1.0 + CesiumMath.EPSILON3,
          -CesiumMath.EPSILON3,
          1.0 + CesiumMath.EPSILON3,
          scratchClippedRing,
        );
        if (clipped.vertexCount < 3) {
          continue;
        }

        result.polygonRings.push(
          clipped.positions.slice(0, clipped.vertexCount * 2),
        );
        result.polygonRingPrimitiveIndices.push(result.primitiveCount + i);
      }
    }

    // Append materials unconditionally, to simplify indexing and updates.
    result.widths.push(collectionData.widths);
    result.colors.push(collectionData.colors);
    result.pickColors.push(collectionData.pickColors);

    result.primitiveCount += primitiveCount;
  }

  /**
   * 被裁剪到它重叠的每个网格单元 — 与多线段不同，
   * 多线段仅被分配到特定单元 — 因此一个单元的边缘形成闭合环
   * 并且一个片段可以单独根据其自身单元评估奇偶覆盖情况。
   * 创建由基元索引空间索引的宽度和颜色纹理，
   *
   * @param {VectorTileData} result
   */
  static packPolygonGrid(result) {
    const rings = result.polygonRings;
    const ringPrimitiveIndices = result.polygonRingPrimitiveIndices;

    let ringEdgeCount = 0;
    for (let i = 0; i < rings.length; i++) {
      ringEdgeCount += rings[i].length / 2;
    }

    const gridSize = Math.max(
      1,
      Math.ceil(Math.sqrt(ringEdgeCount / GRID_TARGET_SEGMENTS_PER_CELL)),
    );

    // Per-cell packed edges [ax, ay, bx, by, primitiveIndex, ...].
    /** @type {number[][]} */
    const grid = new Array(gridSize * gridSize);
    for (let i = 0; i < grid.length; i++) {
      grid[i] = [];
    }

    // Rings are appended in primitive order, so each cell's edge list stays
    // grouped by primitive; the shader resolves parity per group.
    let packedEdgeCount = 0;
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      const primitiveIndex = ringPrimitiveIndices[r];
      const ringVertexCount = ring.length / 2;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let k = 0; k < ringVertexCount; k++) {
        minX = Math.min(minX, ring[k * 2]);
        maxX = Math.max(maxX, ring[k * 2]);
        minY = Math.min(minY, ring[k * 2 + 1]);
        maxY = Math.max(maxY, ring[k * 2 + 1]);
      }

      const startCellX = _clampCellIndex(Math.floor(minX * gridSize), gridSize);
      const endCellX = _clampCellIndex(Math.floor(maxX * gridSize), gridSize);
      const startCellY = _clampCellIndex(Math.floor(minY * gridSize), gridSize);
      const endCellY = _clampCellIndex(Math.floor(maxY * gridSize), gridSize);

      for (let y = startCellY; y <= endCellY; y++) {
        for (let x = startCellX; x <= endCellX; x++) {
          // Expand the clip rectangle slightly so fragments at shared cell
          // boundaries fall strictly inside the clipped loops. Smaller than
          // the tile clip margin above: that one is a fraction of a tile and
          // preserves geometry across the shared tile boundary, while this is
          // a fraction of a grid cell and only has to exceed the float32
          // rounding of a UV coordinate.
          const clipped = _clipRingToRect(
            ring,
            ringVertexCount,
            x / gridSize - CesiumMath.EPSILON5,
            (x + 1) / gridSize + CesiumMath.EPSILON5,
            y / gridSize - CesiumMath.EPSILON5,
            (y + 1) / gridSize + CesiumMath.EPSILON5,
            scratchClippedRing,
          );
          const clippedCount = clipped.vertexCount;
          if (clippedCount < 3) {
            continue;
          }

          const clippedPositions = clipped.positions;
          const cell = grid[y * gridSize + x];
          for (let k = 0; k < clippedCount; k++) {
            const k2 = (k + 1) % clippedCount;
            const ax = clippedPositions[k * 2];
            const ay = clippedPositions[k * 2 + 1];
            const bx = clippedPositions[k2 * 2];
            const by = clippedPositions[k2 * 2 + 1];
            // Horizontal edges never toggle parity against the shader's
            // horizontal ray; clipping produces many along cell bounds.
            if (ay === by) {
              continue;
            }
            cell.push(ax, ay, bx, by, primitiveIndex);
            packedEdgeCount++;
          }
        }
      }
    }

    const [textureWidth, textureHeight] = _nextPowerOfTwoSize(packedEdgeCount);
    const capacity = textureWidth * textureHeight;

    const edgeTexels = new Float32Array(capacity * 4).fill(-1.0);
    const edgePrimitiveIndicesTexels = new Float32Array(capacity).fill(-1.0);

    const gridCellIndices = new Uint32Array(grid.length + 2);
    gridCellIndices[0] = gridSize;
    gridCellIndices[1] = gridSize;

    let offset = 0;
    for (let i = 0; i < grid.length; i++) {
      const cellEdges = grid[i];
      for (let j = 0; j < cellEdges.length; j += 5) {
        edgeTexels[offset * 4] = cellEdges[j]; // R
        edgeTexels[offset * 4 + 1] = cellEdges[j + 1]; // G
        edgeTexels[offset * 4 + 2] = cellEdges[j + 2]; // B
        edgeTexels[offset * 4 + 3] = cellEdges[j + 3]; // A

        edgePrimitiveIndicesTexels[offset] = cellEdges[j + 4];

        offset++;
      }
      gridCellIndices[i + 2] = offset;
    }

    result.polygonEdgeTexels = edgeTexels;
    result.polygonEdgeTextureWidth = textureWidth;
    result.polygonEdgeTextureHeight = textureHeight;
    result.polygonEdgePrimitiveIndicesTexels = edgePrimitiveIndicesTexels;
    result.polygonGridCellIndices = gridCellIndices;
  }

  /**
   * 在多线和多边形之间共享。
   * 将基元拾取颜色以 RGBA 字节形式写入给定基元索引处。
   *
   * @param {Context} context
   * @param {VectorTileData} result
   */
  static packPrimitiveTextures(context, result) {
    const [primTextureWidth, primTextureHeight] = _nextPowerOfTwoSize(
      result.primitiveCount,
    );

    const widthTextureView = new Float32Array(
      primTextureWidth * primTextureHeight,
    );
    widthTextureView.set(_concatTypedArrays(result.widths));
    result.widthTexture = new Texture({
      context,
      pixelFormat: PixelFormat.RED,
      pixelDatatype: PixelDatatype.FLOAT,
      source: {
        width: primTextureWidth,
        height: primTextureHeight,
        arrayBufferView: widthTextureView,
      },
      sampler: Sampler.NEAREST,
      flipY: false,
    });

    const colorTextureView = new Uint8Array(
      primTextureWidth * primTextureHeight * 4,
    );
    colorTextureView.set(_concatTypedArrays(result.colors));
    result.colorTexture = new Texture({
      context,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
      source: {
        width: primTextureWidth,
        height: primTextureHeight,
        arrayBufferView: colorTextureView,
      },
      sampler: Sampler.NEAREST,
      flipY: false,
    });

    const pickColorTextureView = new Uint8Array(
      primTextureWidth * primTextureHeight * 4,
    );
    pickColorTextureView.set(_concatTypedArrays(result.pickColors));
    result.pickColorTexture = new Texture({
      context,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
      source: {
        width: primTextureWidth,
        height: primTextureHeight,
        arrayBufferView: pickColorTextureView,
      },
      sampler: Sampler.NEAREST,
      flipY: false,
    });
  }

  /**
   * @param {Context} context
   * @param {VectorTileData} result
   */
  static packPolylineTextures(context, result) {
    result.polylineSegmentTexture = new Texture({
      context,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.FLOAT,
      source: {
        width: result.polylineSegmentTextureWidth,
        height: result.polylineSegmentTextureHeight,
        arrayBufferView: result.polylineSegmentTexels,
      },
      sampler: Sampler.NEAREST,
      flipY: false,
    });

    result.polylineSegmentPrimitiveIndicesTexture = new Texture({
      context,
      pixelFormat: PixelFormat.RED,
      pixelDatatype: PixelDatatype.FLOAT,
      source: {
        width: result.polylineSegmentTextureWidth,
        height: result.polylineSegmentTextureHeight,
        arrayBufferView: result.polylineSegmentPrimitiveIndicesTexels,
      },
      sampler: Sampler.NEAREST,
      flipY: false,
    });

    result.polylineGridCellIndicesTexture = _createGridCellIndicesTexture(
      context,
      result.polylineGridCellIndices,
    );
  }

  /**
   * @param {Context} context
   * @param {VectorTileData} result
   */
  static packPolygonTextures(context, result) {
    result.polygonEdgeTexture = new Texture({
      context,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.FLOAT,
      source: {
        width: result.polygonEdgeTextureWidth,
        height: result.polygonEdgeTextureHeight,
        arrayBufferView: result.polygonEdgeTexels,
      },
      sampler: Sampler.NEAREST,
      flipY: false,
    });

    result.polygonEdgePrimitiveIndicesTexture = new Texture({
      context,
      pixelFormat: PixelFormat.RED,
      pixelDatatype: PixelDatatype.FLOAT,
      source: {
        width: result.polygonEdgeTextureWidth,
        height: result.polygonEdgeTextureHeight,
        arrayBufferView: result.polygonEdgePrimitiveIndicesTexels,
      },
      sampler: Sampler.NEAREST,
      flipY: false,
    });

    result.polygonGridCellIndicesTexture = _createGridCellIndicesTexture(
      context,
      result.polygonGridCellIndices,
    );
  }

  /**
   * @param {VectorTileData} data
   */
  static freeResources(data) {
    data.polylineSegmentTexture?.destroy();
    data.widthTexture?.destroy();
    data.colorTexture?.destroy();
    data.pickColorTexture?.destroy();
    data.polylineSegmentPrimitiveIndicesTexture?.destroy();
    data.polylineGridCellIndicesTexture?.destroy();
    data.polygonEdgeTexture?.destroy();
    data.polygonEdgePrimitiveIndicesTexture?.destroy();
    data.polygonGridCellIndicesTexture?.destroy();
  }
}

/////////////////////////////////////////////////////////////////////////////
// INTERNAL METHODS

/**
 * Writes a primitive's pick color, as RGBA bytes, at the given primitive index.
 *
 * @param {Uint8Array} pickColors
 * @param {number} index
 * @param {number} pickId 选择基元的颜色，以压缩的 RGBA 值形式提供。
 * @private
 */
function _writePickColor(pickColors, index, pickId) {
  Color.fromRgba(pickId, scratchPickColor);
  pickColors[index * 4] = Color.floatToByte(scratchPickColor.red);
  pickColors[index * 4 + 1] = Color.floatToByte(scratchPickColor.green);
  pickColors[index * 4 + 2] = Color.floatToByte(scratchPickColor.blue);
  pickColors[index * 4 + 3] = Color.floatToByte(scratchPickColor.alpha);
}

/**
 * 将线条宽度的一半及其抗锯齿边缘转换为瓦片 UV 坐标。
 *
 * @param {number} width 有符号线宽；负值为米，正值为像素。
 * @param {VectorTileData} tileData
 * @returns {number}
 * @private
 */
function _halfWidthToTileUv(width, tileData) {
  if (width >= 0.0) {
    return ((width + 1.0) * 0.5) / tileData.minimumTileScreenPixels;
  }

  // A meter is a different amount of UV on each axis; callers apply one isotropic
  // margin, so use the axis that yields the larger of the two.
  const metersPerUv = tileData.metersPerUv;
  return (-width * 0.5) / Math.min(metersPerUv.x, metersPerUv.y);
}

/**
 * 将多段线线段（起始/结束 Cartesian2s，x=lng, y=lat，以弧度为单位）投影到
 * 瓦片的 [0,1]^2 UV 域中。端点 B 的经度首先展开至
 * A 的 π 倍，从而使反子午线交叉线段在几何上保持较短，而不是跨越整个地球；然后两个端点一起移动至 2π
 * 框架，该框架靠近瓦片中心，使与瓦片边缘相邻或交叉的线段正确投影。结果写入输入的 Cartesian2s。
 * 仅支持地理瓦片方案（UV 映射线性映射到 lon/lat）。
 * [lonA, latA] 弧度，在原地修改。
 *
 * [lonB, latB] 弧度，在原地修改。
 *
 * @param {Cartesian2} a 将 UV 空间中的线段裁剪至瓦片域，该域在每侧扩展 `margin`（[-margin, 1 + margin]^2），使用 Liang-Barsky 算法，因此刚好位于
 * @param {Cartesian2} b 瓦片边界外的线段仍被保留。将裁剪后的端点写入结果中。
 * @param {Rectangle} rectangle
 * @param {number} width
 * @private
 */
function _projectSegmentToTileUv(a, b, rectangle, width) {
  let lonA = a.x;
  let lonB = b.x;

  // Unwrap B relative to A so the segment follows the shortest longitudinal
  // path (handles antimeridian-crossing segments).
  lonB = lonA + CesiumMath.negativePiToPi(lonB - lonA);

  // Shift the whole segment to the 2π frame nearest the tile center.
  const center = rectangle.west + width * 0.5;
  const shift = center + CesiumMath.negativePiToPi(lonA - center) - lonA;
  lonA += shift;
  lonB += shift;

  const height = rectangle.north - rectangle.south;
  a.x = (lonA - rectangle.west) / width;
  a.y = (a.y - rectangle.south) / height;
  b.x = (lonB - rectangle.west) / width;
  b.y = (b.y - rectangle.south) / height;
}

/**
 * 当线段完全位于外部时返回 false。
 * 由 {@link _clipRingToRect} 裁剪的环。
 * `positions` 在裁剪出的环超出其范围时重新分配，因此调用者必须每次调用后从该对象读取，而不是缓存。
 * 平坦的 [x0, y0, x1, y1, ...] 环坐标。
 *
 * @param {Cartesian2} a
 * @param {Cartesian2} b
 * @param {number} margin
 * @returns {boolean}
 * @private
 */
function _clipSegmentToTile(a, b, margin) {
  const lo = -margin;
  const hi = 1.0 + margin;

  let tMin = 0.0;
  let tMax = 1.0;

  const ax = a.x;
  const ay = a.y;
  const bx = b.x;
  const by = b.y;

  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - lo, hi - ax, ay - lo, hi - ay];

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1.0e-12) {
      if (q[i] < 0.0) {
        return false;
      }
      continue;
    }

    const t = q[i] / p[i];
    if (p[i] < 0.0) {
      tMin = Math.max(tMin, t);
    } else {
      tMax = Math.min(tMax, t);
    }

    if (tMin > tMax) {
      return false;
    }
  }

  a.x = ax + tMin * dx;
  a.y = ay + tMin * dy;
  b.x = ax + tMax * dx;
  b.y = ay + tMax * dy;

  return true;
}

/**
 * @param {number} index
 * @param {number} gridSize
 * @returns {number}
 * @private
 */
function _clampCellIndex(index, gridSize) {
  return Math.max(0, Math.min(gridSize - 1, index));
}

// Growable module scratch for ring projection and Sutherland-Hodgman clipping.
/**
 * @type {Float64Array}
 * @private
 */
let scratchRingUv = new Float64Array(512);
/**
 * @type {Float64Array}
 * @private
 */
let scratchClipWorking = new Float64Array(512);

/**
 * A ring clipped by {@link _clipRingToRect}.
 *
 * 将多边形环（[lng, lat] 弧度对来自 `positions`）投影到
 * 瓦片的 [0,1]^2 UV 域中。经度依次展开，使反子午线交叉环保持连续，然后整个环移动至
 *
 * @typedef {object} ClippedRing
 * @property {Float64Array} positions 2π 框架，该框架靠近瓦片中心（与多段线投影匹配）。
 * @property {number} vertexCount 返回模块临时空间，直到下一次调用为止。
 * @private
 */

/**
 * @type {ClippedRing}
 * @private
 */
const scratchClippedRing = {
  positions: new Float64Array(512),
  vertexCount: 0,
};

/**
 * 仅支持地理瓦片方案（UV 映射线性映射到 lon/lat）。
 * 投影后的集合位置（[lng, lat] 弧度）。
 * 环的第一个顶点的索引。
 * 环中的顶点数量。
 * [u0, v0, u1, v1, ...] 环坐标。
 *
 * 使用 Sutherland-Hodgman 算法将闭合环裁剪为轴对齐矩形。
 *
 * @param {Float64Array} positions 将裁剪后的环写入 `result`，当该环完全位于矩形外部时，`vertexCount` 为 0。
 * @param {number} vertexStart 平坦的 [x0, y0, x1, y1, ...] 环坐标。
 * @param {number} vertexCount 修改后的结果参数。
 * @param {Rectangle} rectangle
 * @param {number} width
 * @returns {Float64Array} Flat [u0, v0, u1, v1, ...] 环坐标。
 * @private
 */
function _projectRingToTileUv(
  positions,
  vertexStart,
  vertexCount,
  rectangle,
  width,
) {
  if (scratchRingUv.length < vertexCount * 2) {
    scratchRingUv = new Float64Array(vertexCount * 4);
  }
  const result = scratchRingUv;
  const height = rectangle.north - rectangle.south;

  let previousLon = positions[vertexStart * 2];
  result[0] = previousLon;
  result[1] = positions[vertexStart * 2 + 1];
  for (let i = 1; i < vertexCount; i++) {
    const lon =
      previousLon +
      CesiumMath.negativePiToPi(positions[(vertexStart + i) * 2] - previousLon);
    result[i * 2] = lon;
    result[i * 2 + 1] = positions[(vertexStart + i) * 2 + 1];
    previousLon = lon;
  }

  const center = rectangle.west + width * 0.5;
  const lon0 = result[0];
  const shift = center + CesiumMath.negativePiToPi(lon0 - center) - lon0;

  for (let i = 0; i < vertexCount; i++) {
    result[i * 2] = (result[i * 2] + shift - rectangle.west) / width;
    result[i * 2 + 1] = (result[i * 2 + 1] - rectangle.south) / height;
  }

  return result;
}

/**
 * 使用 Sutherland-Hodgman 算法将闭合环裁剪为轴对齐矩形。
 * 将裁剪后的环写入 `result`，当该环完全位于矩形外部时，`vertexCount` 为 0。
 * 平坦的 [x0, y0, x1, y1, ...] 环坐标。
 *
 * @param {Float64Array} ring 修改后的结果参数。
 * @param {number} vertexCount
 * @param {number} minX
 * @param {number} maxX
 * @param {number} minY
 * @param {number} maxY
 * @param {ClippedRing} result
 * @returns {ClippedRing} The 创建网格标题纹理，并扩展为 2D 二幂大小。
 * @private
 */
function _clipRingToRect(ring, vertexCount, minX, maxX, minY, maxY, result) {
  let input = ring;
  let inputCount = vertexCount;

  // axis (0 = x, 1 = y), keep side (1 = keep >= limit, -1 = keep <= limit).
  for (let plane = 0; plane < 4; plane++) {
    const axis = plane >> 1;
    const sign = (plane & 1) === 0 ? 1.0 : -1.0;
    const limit =
      plane === 0 ? minX : plane === 1 ? maxX : plane === 2 ? minY : maxY;

    // Ping-pong between the working scratch and the result, writing odd
    // planes to the result so the fourth and final plane lands there.
    // Each input vertex emits at most 2 output vertices.
    const requiredLength = inputCount * 4 + 4;
    const isWorkingPlane = (plane & 1) === 0;
    let output = isWorkingPlane ? scratchClipWorking : result.positions;
    if (output.length < requiredLength) {
      output = new Float64Array(requiredLength * 2);
      if (isWorkingPlane) {
        scratchClipWorking = output;
      } else {
        result.positions = output;
      }
    }

    let outputCount = 0;
    let prevX = input[(inputCount - 1) * 2];
    let prevY = input[(inputCount - 1) * 2 + 1];
    let prevInside = sign * ((axis === 0 ? prevX : prevY) - limit) >= 0.0;

    for (let i = 0; i < inputCount; i++) {
      const x = input[i * 2];
      const y = input[i * 2 + 1];
      const inside = sign * ((axis === 0 ? x : y) - limit) >= 0.0;

      if (inside !== prevInside) {
        // Pin the clipped coordinate exactly to the plane so boundary edges
        // stay axis-aligned.
        const t =
          axis === 0
            ? (limit - prevX) / (x - prevX)
            : (limit - prevY) / (y - prevY);
        output[outputCount * 2] = axis === 0 ? limit : prevX + t * (x - prevX);
        output[outputCount * 2 + 1] =
          axis === 0 ? prevY + t * (y - prevY) : limit;
        outputCount++;
      }
      if (inside) {
        output[outputCount * 2] = x;
        output[outputCount * 2 + 1] = y;
        outputCount++;
      }

      prevX = x;
      prevY = y;
      prevInside = inside;
    }

    if (outputCount === 0) {
      result.vertexCount = 0;
      return result;
    }

    input = output;
    inputCount = outputCount;
  }

  result.vertexCount = inputCount;
  return result;
}

/**
 * @param {number} count
 * @returns {number[]}
 * @private
 */
function _nextPowerOfTwoSize(count) {
  const width = CesiumMath.nextPowerOfTwo(
    Math.max(1, Math.ceil(Math.sqrt(count))),
  );
  const height = CesiumMath.nextPowerOfTwo(
    Math.max(1, Math.ceil(count / width)),
  );
  return [width, height];
}

/**
 * Creates a grid header texture, wrapped to a 2D power-of-two size so the
 * 标题长度不受最大纹理宽度的限制。
 *
 * @param {Context} context
 * @param {Uint32Array} gridCellIndices
 * @returns {Texture}
 * @private
 */
function _createGridCellIndicesTexture(context, gridCellIndices) {
  const [width, height] = _nextPowerOfTwoSize(gridCellIndices.length);
  const texels = new Float32Array(width * height);
  texels.set(gridCellIndices);
  return new Texture({
    context: context,
    pixelFormat: PixelFormat.RED,
    pixelDatatype: PixelDatatype.FLOAT,
    source: {
      width: width,
      height: height,
      arrayBufferView: texels,
    },
    sampler: Sampler.NEAREST,
    flipY: false,
  });
}

/**
 * 返回集合的顶点位置，这些位置被投影到 [lng, lat] 坐标系中。
 * 在给定椭球面上的坐标，单位为弧度。
 *
 * @param {BufferPrimitiveCollection<BufferPrimitive>} collection
 * @param {Ellipsoid} ellipsoid
 * @param {Float64Array} [result]
 * @ignore
 */
function _getProjectedPositions(collection, ellipsoid, result) {
  if (!defined(result)) {
    result = new Float64Array(collection._positionCountMax * 2);
  }

  const positions = collection._positionView;
  const modelMatrix = collection.modelMatrix;

  for (let i = 0; i < collection._positionCount; i++) {
    const local = Cartesian3.fromArray(
      // @ts-expect-error https://github.com/CesiumGS/cesium/pull/13302
      positions,
      i * 3,
      scratchLocalPosition,
    );
    const world = Matrix4.multiplyByPoint(
      modelMatrix,
      local,
      scratchWorldPosition,
    );
    const cartographic = ellipsoid.cartesianToCartographic(
      world,
      scratchCartographic,
    );

    result[i * 2] = cartographic.longitude;
    result[i * 2 + 1] = cartographic.latitude;
  }

  return result;
}

/**
 * 将 N 个数组合并为一个数组。
 * @template {TypedArray} T
 * @param {T[]} arrays
 * @returns {T}
 * @ignore
 */
function _concatTypedArrays(arrays) {
  let byteLength = 0;
  for (const array of arrays) {
    byteLength += array.byteLength;
  }

  const TypedArray = /** @type {TypedArrayConstructor} */ (
    arrays[0].constructor
  );
  const result = new TypedArray(byteLength / TypedArray.BYTES_PER_ELEMENT);

  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return /** @type {T} */ (result);
}

export default VectorPipeline;