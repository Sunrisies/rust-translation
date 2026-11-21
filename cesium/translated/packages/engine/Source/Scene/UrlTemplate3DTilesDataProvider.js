// @ts-check

import {
  Cartographic,
  DeveloperError,
  Ellipsoid,
  Math as CesiumMath,
  Rectangle,
  defined,
  destroyObject,
  getAbsoluteUri,
} from "@cesium/core";
import Cesium3DTile from "./Cesium3DTile.js";
import Cesium3DTileOptimizations from "./Cesium3DTileOptimizations.js";
import Cesium3DTileset from "./Cesium3DTileset.js";
import Resource from "../Core/Resource.js";
import WebMercatorTilingScheme from "../Core/WebMercatorTilingScheme.js";

/** @import FrameState from "./FrameState.js"; */
/** @import HeightReference from "./HeightReference.js"; */
/** @import PassState from "../Renderer/PassState.js"; */
/** @import Scene from "./Scene.js"; */
/** @import TilingScheme from "../Core/TilingScheme.js"; */

const DEFAULT_MIN_ZOOM = 0;
const DEFAULT_MAX_ZOOM = 14;
const DEFAULT_REGION_MINIMUM_HEIGHT = -1000.0;
const DEFAULT_REGION_MAXIMUM_HEIGHT = 10000.0;
const EARTH_CIRCUMFERENCE_METERS =
  2.0 * Math.PI * Ellipsoid.WGS84.maximumRadius;
const WEB_MERCATOR_TILE_SIZE = 256.0;

const scratchTileRectangle = new Rectangle();
const scratchIntersectionRectangle = new Rectangle();

/**
 * 用于通过运行时生成的 3D Tiles 瓦片集渲染的 URL-模板向量源的基础提供器。
 * 用于运行时生成的 3D Tiles 瓦片集。
 *
 * @experimental This 该功能尚未定稿，可能根据 Cesium 的标准弃用政策进行变更。
 */
class UrlTemplate3DTilesDataProvider {
  /**
   * @param {Resource|string} urlTemplate 包含 {z}、{x} 和 {y} 占位符的 URL 模板。
   * @param {object} [options] 提供器选项。
   * @param {number} [options.minZoom=0] 生成的瓦片集中所表示的最小缩放级别。
   * @param {number} [options.maxZoom=14] 生成瓦片集中所表示的最大缩放级别。
   * @param {Rectangle} [options.extent] 以弧度表示的可选地理范围，用于限制生成的瓦片树。
   * @param {string} [options.featureIdProperty] 当内容解码支持时，用作实体 ID 的特性属性名称。
   * @param {HeightReference} [options.heightReference] 将向量内容覆盖在由
   * 值选定的表面之上。需要 <code>options.scene</code>。
   * @param {Scene} [options.scene] 生成瓦片集所渲染的场景，当
   * <code>options.heightReference</code> 为限制值时必需。
   */
  constructor(urlTemplate, options) {
    options = options ?? {};
    this._resource = Resource.createIfNeeded(urlTemplate);
    // @ts-expect-error Missing types.
    this._urlTemplate = this._resource.url;
    this._extent = Rectangle.clone(options.extent);
    this._minZoom = options.minZoom ?? DEFAULT_MIN_ZOOM;
    this._maxZoom = options.maxZoom ?? DEFAULT_MAX_ZOOM;
    this._featureIdProperty = options.featureIdProperty;
    this._heightReference = options.heightReference;
    this._scene = options.scene;
    this._show = true;
    this._tileset = undefined;
    this._tilesetJsonUrl = undefined;
  }

  /**
   * 从 URL 模板创建提供器。
   *
   * @param {Resource|string} url 包含 {z}、{x} 和 {y} 占位符的 URL 模板。
   * @param {object} [options] 提供器选项。
   * @returns {Promise<UrlTemplate3DTilesDataProvider>}
   */
  static async fromUrl(url, options) {
    const provider = new this(url, options);
    await provider._initializeTileset();
    return provider;
  }

  /**
   * 包含 {z}/{x}/{y} 的 URL 模板。
   *
   * @type {string}
   * @readonly
   */
  get urlTemplate() {
    return this._urlTemplate;
  }

  /**
   * 从 URL 模板派生的资源。
   *
   * @type {Resource}
   * @readonly
   */
  get resource() {
    return this._resource;
  }

  /**
   * 用于生成瓦片标题的以弧度表示的可选地理范围。
   *
   * @type {Rectangle|undefined}
   * @readonly
   */
  get extent() {
    return this._extent;
  }

  /**
   * 3D Tileset 背景层。
   *
   * @type {Cesium3DTileset|undefined}
   * @readonly
   */
  get tileset() {
    return this._tileset;
  }

  /**
   * 决定生成的瓦片集是否显示。
   *
   * @type {boolean}
   */
  get show() {
    return this._show;
  }

  set show(value) {
    this._show = value;
    if (defined(this._tileset)) {
      this._tileset.show = value;
    }
  }

  /** @protected */
  _createRuntimeTilesetOptions() {
    return {
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      extent: this._extent,
    };
  }

  /**
   * @protected
   * @returns {object}
   */
  _createTilesetLoadOptions() {
    return {
      heightReference: this._heightReference,
      scene: this._scene,
    };
  }

  /**
   * @protected
   * @param {Cesium3DTileset} _tileset
   */
  _configureTileset(_tileset) {}

  /**
   * 子类必须返回一个运行时内容编解码器，描述如何将
   * 下载的瓦片数据转换为 {@link Cesium3DTileContent}。有关预期格式，请参见
   * {@link Cesium3DTileset#_runtimeContentCodec}。
   *
   * @protected
   * @returns {object}
   */
  _createCodec() {
    //>>includeStart('debug', pragmas.debug);
    throw new DeveloperError(
      "UrlTemplate3DTilesDataProvider subclasses must implement _createCodec().",
    );
    //>>includeEnd('debug');
  }

  /**
   * @private
   */
  async _initializeTileset() {
    const options = this._createRuntimeTilesetOptions();
    const tilingScheme = new WebMercatorTilingScheme();
    const extent = Rectangle.clone(options.extent ?? tilingScheme.rectangle);
    const tilesetJson = buildRuntimeTilesetJson(extent);
    const tilesetBlob = new Blob([JSON.stringify(tilesetJson)], {
      type: "application/json",
    });
    const tilesetUrl = URL.createObjectURL(tilesetBlob);
    this._tilesetJsonUrl = tilesetUrl;

    try {
      this._tileset = await Cesium3DTileset.fromUrl(
        tilesetUrl,
        this._createTilesetLoadOptions(),
      );
    } catch (error) {
      URL.revokeObjectURL(tilesetUrl);
      this._tilesetJsonUrl = undefined;
      throw error;
    }
    URL.revokeObjectURL(tilesetUrl);
    this._tilesetJsonUrl = undefined;

    this._configureTileset(this._tileset);
    this._tileset._runtimeContentCodec = this._createCodec();
    this._tileset.show = this._show;

    const source = {
      tileset: this._tileset,
      tilingScheme: tilingScheme,
      resource: this._resource,
      extent: extent,
      minZoom: options.minZoom,
      maxZoom: Math.max(options.minZoom, options.maxZoom),
    };
    const root = this._tileset._root;
    const range = computeTileRangeForExtent(tilingScheme, extent, 0);
    root._implicitChildrenCallback = () =>
      deriveTiles(
        source,
        root,
        0,
        range.minX,
        range.maxX,
        range.minY,
        range.maxY,
      );
  }

  /**
   * @private
   * @param {FrameState} frameState
   */
  update(frameState) {
    if (defined(this._tileset)) {
      this._tileset.update(frameState);
    }
  }

  /**
   * @private
   * @param {FrameState} frameState
   */
  prePassesUpdate(frameState) {
    if (defined(this._tileset)) {
      this._tileset.prePassesUpdate(frameState);
    }
  }

  /**
   * @private
   * @param {FrameState} frameState
   */
  postPassesUpdate(frameState) {
    if (defined(this._tileset)) {
      this._tileset.postPassesUpdate(frameState);
    }
  }

  /**
   * @private
   * @param {FrameState} frameState
   * @param {PassState} passState
   */
  updateForPass(frameState, passState) {
    if (defined(this._tileset)) {
      this._tileset.updateForPass(frameState, passState);
    }
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    if (defined(this._tileset)) {
      this._tileset.destroy();
      this._tileset = undefined;
    }
    if (defined(this._tilesetJsonUrl)) {
      URL.revokeObjectURL(this._tilesetJsonUrl);
      this._tilesetJsonUrl = undefined;
    }
    this._resource = undefined;
    this._extent = undefined;
    this._featureIdProperty = undefined;
    return destroyObject(this);
  }
}

/**
 * 构建仅包含根节点的瓦片集 JSON 文件；其下的瓦片是在
 * 通过 <code>deriveTiles</code> 按需生成的。
 *
 * @param {Rectangle} extent
 * @returns {object}
 * @ignore
 */
function buildRuntimeTilesetJson(extent) {
  // Root has no renderable content, so keep a coarse error to ensure
  // refinement reaches the first renderable zoom even when minZoom is high.
  const geometricError = computeGeometricError(0);
  return {
    asset: {
      version: "1.1",
    },
    geometricError: geometricError,
    root: {
      boundingVolume: {
        region: rectangleToRegion(extent),
      },
      geometricError: geometricError,
      refine: "REPLACE",
    },
  };
}

/**
 * @typedef {object} TileSource
 * @property {Cesium3DTileset} tileset
 * @property {TilingScheme} tilingScheme
 * @property {Resource} resource
 * @property {Rectangle} extent
 * @property {number} minZoom
 * @property {number} maxZoom
 * @ignore
 */

/**
 * 在给定瓦片范围内创建一层级的瓦片，作为
 * <code>parent</code> 的子节点，跳过超出范围的瓦片。
 *
 * @param {TileSource} source
 * @param {Cesium3DTile} parent
 * @param {number} level
 * @param {number} minX
 * @param {number} maxX
 * @param {number} minY
 * @param {number} maxY
 * @ignore
 */
function deriveTiles(source, parent, level, minX, maxX, minY, maxY) {
  const { tileset, tilingScheme, resource, extent, minZoom, maxZoom } = source;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (
        !tileIntersectsExtent(
          tilingScheme,
          level,
          x,
          y,
          extent,
          scratchTileRectangle,
          scratchIntersectionRectangle,
        )
      ) {
        continue;
      }

      let geometricError = 0.0;
      if (level < minZoom) {
        geometricError = computeGeometricError(0);
      } else if (level < maxZoom) {
        geometricError = computeGeometricError(level);
      }

      const tile = new Cesium3DTile(
        tileset,
        tileset._resource,
        {
          boundingVolume: {
            region: rectangleToRegion(scratchTileRectangle),
          },
          geometricError: geometricError,
          refine: "REPLACE",
          content:
            level >= minZoom
              ? { uri: resolveTileUrl(resource, level, x, y) }
              : undefined,
        },
        parent,
      );
      tile._depth = parent._depth + 1;
      if (level < maxZoom) {
        // @ts-expect-error Cesium3DTile has no public way to set its implicit children.
        tile._implicitChildrenCallback = () =>
          deriveTiles(
            source,
            tile,
            level + 1,
            2 * x,
            2 * x + 1,
            2 * y,
            2 * y + 1,
          );
      }
      // @ts-expect-error Requires Cesium3DTile conversion to ES6 class.
      parent.children.push(tile);
      ++tileset._statistics.numberOfTilesTotal;
    }
  }

  if (tileset._cullWithChildrenBounds) {
    Cesium3DTileOptimizations.checkChildrenWithinParent(parent);
  }
}

/**
 * @param {Resource} resource
 * @param {number} level
 * @param {number} x
 * @param {number} y
 * @ignore
 */
function resolveTileUrl(resource, level, x, y) {
  // @ts-expect-error Missing types.
  const template = resource.url;
  const tileUrl = template
    .replace(/\{z\}/gi, `${level}`)
    .replace(/\{x\}/gi, `${x}`)
    .replace(/\{y\}/gi, `${y}`);
  return getAbsoluteUri(tileUrl);
}

/**
 * @param {number} level
 * @ignore
 */
function computeGeometricError(level) {
  return EARTH_CIRCUMFERENCE_METERS / ((1 << level) * WEB_MERCATOR_TILE_SIZE);
}

/**
 * @param {Rectangle} rectangle
 * @returns {number[]}
 * @ignore
 */
function rectangleToRegion(rectangle) {
  return [
    rectangle.west,
    rectangle.south,
    rectangle.east,
    rectangle.north,
    DEFAULT_REGION_MINIMUM_HEIGHT,
    DEFAULT_REGION_MAXIMUM_HEIGHT,
  ];
}

/**
 * @param {TilingScheme} tilingScheme
 * @param {Rectangle} extent
 * @param {number} level
 * @ignore
 */
function computeTileRangeForExtent(tilingScheme, extent, level) {
  const maxIndex = (1 << level) - 1;
  const nw = Cartographic.fromRadians(extent.west, extent.north);
  const se = Cartographic.fromRadians(extent.east, extent.south);
  const nwTile = tilingScheme.positionToTileXY(nw, level);
  const seTile = tilingScheme.positionToTileXY(se, level);
  if (!defined(nwTile) || !defined(seTile) || extent.west > extent.east) {
    return {
      minX: 0,
      maxX: maxIndex,
      minY: 0,
      maxY: maxIndex,
    };
  }
  return {
    minX: CesiumMath.clamp(Math.min(nwTile.x, seTile.x), 0, maxIndex),
    maxX: CesiumMath.clamp(Math.max(nwTile.x, seTile.x), 0, maxIndex),
    minY: CesiumMath.clamp(Math.min(nwTile.y, seTile.y), 0, maxIndex),
    maxY: CesiumMath.clamp(Math.max(nwTile.y, seTile.y), 0, maxIndex),
  };
}

/**
 * @param {TilingScheme} tilingScheme
 * @param {number} level
 * @param {number} x
 * @param {number} y
 * @param {Rectangle} extent
 * @param {Rectangle} tileRectangleScratch
 * @param {Rectangle} intersectionScratch
 * @ignore
 */
function tileIntersectsExtent(
  tilingScheme,
  level,
  x,
  y,
  extent,
  tileRectangleScratch,
  intersectionScratch,
) {
  const tileRectangle = tilingScheme.tileXYToRectangle(
    x,
    y,
    level,
    tileRectangleScratch,
  );
  return defined(
    Rectangle.intersection(tileRectangle, extent, intersectionScratch),
  );
}

export default UrlTemplate3DTilesDataProvider;
