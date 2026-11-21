// @ts-check

import { Cartographic, DeveloperError, Rectangle, defined } from "@cesium/core";
import QuadtreeTileLoadState from "./QuadtreeTileLoadState.js";
import TileSelectionResult from "./TileSelectionResult.js";

/** @import TilingScheme from "../Core/TilingScheme.js"; */

/**
 * 一个简单的最近最少使用（LRU）缓存实现。
 *
 * @private
 */
class LRUCache {
  /** @param {number} maxSize */
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * @param {unknown} key
   * @returns {unknown}
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }
    // Move accessed item to the end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * @param {unknown} key
   * @param {unknown} value
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove the least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * @type {number}
   * @readonly
   */
  get size() {
    return this.cache.size;
  }

  clear() {
    this.cache.clear();
  }
}

// Maximum cache entries per tile
const MAX_CACHE_ENTRIES = 1000;

/**
 * {@link QuadtreePrimitive} 中的一个瓦片。
 *
 * @private
 */
class QuadtreeTile {
  /**
   * @param {object} options
   * @param {number} options.level 该瓦片在四叉树中的层级。
   * @param {number} options.x 该瓦片在四叉树中的 X 坐标。0 为最西边的瓦片。
   * @param {number} options.y 该瓦片在四叉树中的 Y 坐标。0 为最北边的瓦片。
   * @param {TilingScheme} options.tilingScheme 该瓦片所在的分块方案。
   * @param {QuadtreeTile} [options.parent] 该瓦片的父瓦片，如果是根瓦片则为空。
   */
  constructor(options) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(options)) {
      throw new DeveloperError("options is required.");
    }
    if (!defined(options.x)) {
      throw new DeveloperError("options.x is required.");
    } else if (!defined(options.y)) {
      throw new DeveloperError("options.y is required.");
    } else if (options.x < 0 || options.y < 0) {
      throw new DeveloperError(
        "options.x and options.y must be greater than or equal to zero.",
      );
    }
    if (!defined(options.level)) {
      throw new DeveloperError(
        "options.level is required and must be greater than or equal to zero.",
      );
    }
    if (!defined(options.tilingScheme)) {
      throw new DeveloperError("options.tilingScheme is required.");
    }
    //>>includeEnd('debug');

    this._tilingScheme = options.tilingScheme;
    this._x = options.x;
    this._y = options.y;
    this._level = options.level;
    this._parent = options.parent;

    /** @type {Rectangle} */
    this._rectangle = this._tilingScheme.tileXYToRectangle(
      this._x,
      this._y,
      this._level,
    );

    this._southwestChild = undefined;
    this._southeastChild = undefined;
    this._northwestChild = undefined;
    this._northeastChild = undefined;

    // TileReplacementQueue gets/sets these private properties.
    this.replacementPrevious = undefined;
    this.replacementNext = undefined;

    // The distance from the camera to this tile, updated when the tile is selected
    // for rendering.  We can get rid of this if we have a better way to sort by
    // distance - for example, by using the natural ordering of a quadtree.
    // QuadtreePrimitive gets/sets this private property.
    this._distance = 0.0;
    this._loadPriority = 0.0;

    this._customData = new Set();
    this._customDataIterator = undefined;
    /** @type {unknown[]} */
    this._addedCustomData = [];
    /** @type {unknown[]} */
    this._removedCustomData = [];
    this._lastSelectionResult = TileSelectionResult.NONE;
    this._lastSelectionResultFrame = undefined;
    this._loadedCallbacks = {};

    // Cache for storing computed position values per tile to avoid redundant calculations
    this._positionCache = new LRUCache(MAX_CACHE_ENTRIES);

    /**
     * 获取或设置瓦片在加载管道中的当前状态。
     * @type {QuadtreeTileLoadState}
     * @default {@link QuadtreeTileLoadState.START}
     */
    this.state = QuadtreeTileLoadState.START;

    /**
     * 获取或设置指示该瓦片是否可渲染的值。
     * @type {boolean}
     * @default false
     */
    this.renderable = false;

    /**
     * 获取或设置该瓦片是否完全从其父瓦片上-upsample 的值。
     * 如果父瓦片的四个子瓦片都从父瓦片上-upsample 了，
     * 即使 LOD 表明子瓦片更合适，我们也会渲染父瓦片而不是子瓦片。
     * 获取或设置与该瓦片相关的附加数据。具体内容取决于
     * @type {boolean}
     * @default false
     */
    this.upsampledFromParent = false;

    /**
     * {@link QuadtreeTileProvider}。
     * {@link QuadtreeTileProvider}.
     * @type {object}
     * @default undefined
     */
    this.data = undefined;
  }

  /**
   * 将要创建的瓦片的分块方案。
   *
   *
   * @param {TilingScheme} tilingScheme 用于创建瓦片的分块模式。
   * @returns {QuadtreeTile[]} An 包含细节层级零的瓦片数组，从西北角的瓦片开始，接着是东边的瓦片（如果有的话）。
   * 生成给定地图位置的唯一缓存键。
   */
  static createLevelZeroTiles(tilingScheme) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(tilingScheme)) {
      throw new DeveloperError("tilingScheme is required.");
    }
    //>>includeEnd('debug');

    const numberOfLevelZeroTilesX = tilingScheme.getNumberOfXTilesAtLevel(0);
    const numberOfLevelZeroTilesY = tilingScheme.getNumberOfYTilesAtLevel(0);

    const result = new Array(numberOfLevelZeroTilesX * numberOfLevelZeroTilesY);

    let index = 0;
    for (let y = 0; y < numberOfLevelZeroTilesY; ++y) {
      for (let x = 0; x < numberOfLevelZeroTilesX; ++x) {
        result[index++] = new QuadtreeTile({
          tilingScheme: tilingScheme,
          x: x,
          y: y,
          level: 0,
        });
      }
    }

    return result;
  }

  /**
   * 地图坐标。
   *
   * @param {Cartographic} cartographic 允许的最大屏幕空间误差，以像素为单位。
   * @param {number} maximumScreenSpaceError 允许的最大屏幕空间误差，以像素为单位。
   * 更高的最大误差会渲染更少的瓦片并提升性能，而较低的
   * 值会提升视觉质量。
   * @returns {string} A 表示空间哈希键的字符串。
   */
  _getCacheKey(cartographic, maximumScreenSpaceError) {
    return createSpatialHashKey(
      cartographic.longitude,
      cartographic.latitude,
      this._rectangle,
      maximumScreenSpaceError,
    );
  }

  /**
   * 获取指定地图位置的缓存位置。
   *
   *
   * @param {Cartographic} cartographic - 地图坐标。
   * @param {number} maximumScreenSpaceError 允许的最大屏幕空间误差，以像素为单位。
   * 更高的最大误差会渲染更少的瓦片并提升性能，而较低的
   * 值会提升视觉质量。
   * @returns {object|undefined} The 缓存位置数据，如果未找到则为空。
   */
  getPositionCacheEntry(cartographic, maximumScreenSpaceError) {
    const result = this._positionCache.get(
      this._getCacheKey(cartographic, maximumScreenSpaceError),
    );
    return /** @type {object|undefined} */ (result);
  }

  /**
   * 为该瓦片在缓存中设置位置。
   *
   *
   * @param {Cartographic} cartographic - 地图坐标。
   * @param {number} maximumScreenSpaceError 允许的最大屏幕空间误差，以像素为单位。
   * 更高的最大误差会渲染更少的瓦片并提升性能，而较低的
   * 值会提升视觉质量。
   * @param {object} value - 要缓存的对象。
   */
  setPositionCacheEntry(cartographic, maximumScreenSpaceError, value) {
    this._positionCache.set(
      this._getCacheKey(cartographic, maximumScreenSpaceError),
      value,
    );
  }

  /**
   * 清除该瓦片的位置缓存。
   * 此函数移除之前存储的所有缓存位置。
   * 用于优化高度计算。
   *
   */
  clearPositionCache() {
    if (this._positionCache.size > 0) {
      this._positionCache.clear();
    }
  }

  updateCustomData() {
    const added = this._addedCustomData;
    const removed = this._removedCustomData;
    if (added.length === 0 && removed.length === 0) {
      return;
    }

    const customData = this.customData;
    for (let i = 0; i < added.length; ++i) {
      const data = /** @type {*} */ (added[i]);
      customData.add(data);

      const child = childTileAtPosition(this, data.positionCartographic);
      child._addedCustomData.push(data);
    }
    this._addedCustomData.length = 0;

    for (let i = 0; i < removed.length; ++i) {
      const data = /** @type {*} */ (removed[i]);
      if (customData.has(data)) {
        customData.delete(data);
      }

      const child = childTileAtPosition(this, data.positionCartographic);
      child._removedCustomData.push(data);
    }
    this._removedCustomData.length = 0;
  }

  /**
   * 获取用于铺满表面的铺砌方案。
   * @type {TilingScheme}
   */
  get tilingScheme() {
    return this._tilingScheme;
  }

  /**
   * 获取铺砌块的 X 坐标。
   * @type {number}
   */
  get x() {
    return this._x;
  }

  /**
   * 获取铺砌块的 Y 坐标。
   * @type {number}
   */
  get y() {
    return this._y;
  }

  /**
   * 获取细节级别，其中零表示最粗糙、最不精细。
   * @type {number}
   */
  get level() {
    return this._level;
  }

  /**
   * 获取该铺砌块所属的父铺砌块。
   * @type {QuadtreeTile}
   */
  get parent() {
    return this._parent;
  }

  /**
   * 获取铺砌块的地图矩形，包含北、南、东和西方向属性（以弧度为单位）。
   * 位于铺砌块树中更高层级的铺砌块数组。
   * @type {Rectangle}
   */
  get rectangle() {
    return this._rectangle;
  }

  /**
   * 获取西南方向的子铺砌块。
   * @type {QuadtreeTile[]}
   */
  get children() {
    return [
      this.northwestChild,
      this.northeastChild,
      this.southwestChild,
      this.southeastChild,
    ];
  }

  /**
   * 获取东南方向的子铺砌块。
   * @type {QuadtreeTile}
   */
  get southwestChild() {
    if (!defined(this._southwestChild)) {
      this._southwestChild = new QuadtreeTile({
        tilingScheme: this.tilingScheme,
        x: this.x * 2,
        y: this.y * 2 + 1,
        level: this.level + 1,
        parent: this,
      });
    }
    return this._southwestChild;
  }

  /**
   * 获取西北方向的子铺砌块。
   * @type {QuadtreeTile}
   */
  get southeastChild() {
    if (!defined(this._southeastChild)) {
      this._southeastChild = new QuadtreeTile({
        tilingScheme: this.tilingScheme,
        x: this.x * 2 + 1,
        y: this.y * 2 + 1,
        level: this.level + 1,
        parent: this,
      });
    }
    return this._southeastChild;
  }

  /**
   * 获取东北方向的子铺砌块。
   * @type {QuadtreeTile}
   */
  get northwestChild() {
    if (!defined(this._northwestChild)) {
      this._northwestChild = new QuadtreeTile({
        tilingScheme: this.tilingScheme,
        x: this.x * 2,
        y: this.y * 2,
        level: this.level + 1,
        parent: this,
      });
    }
    return this._northwestChild;
  }

  /**
   * 获取东南方向的子铺砌块。
   * @type {QuadtreeTile}
   */
  get northeastChild() {
    if (!defined(this._northeastChild)) {
      this._northeastChild = new QuadtreeTile({
        tilingScheme: this.tilingScheme,
        x: this.x * 2 + 1,
        y: this.y * 2,
        level: this.level + 1,
        parent: this,
      });
    }
    return this._northeastChild;
  }

  /**
   * 与该铺砌块相关的对象集合。
   * @type {Set<*>}
   */
  get customData() {
    return this._customData;
  }

  /**
   * 获取指示该铺砌块是否需要进一步加载的值。
   * 如果 {@link QuadtreeTile#state} 为
   * <code>START</code> 或 <code>LOADING</code>，则此属性返回 true。
   * @type {boolean}
   */
  get needsLoading() {
    return this.state < QuadtreeTileLoadState.DONE;
  }

  /**
   * 获取指示该铺砌块是否适合被卸载的值。
   * 通常，当异步操作（例如数据请求）正在进行时，铺砌块不适合被卸载。无论此属性的值如何，铺砌块在需要渲染时永远不会被卸载。
   * 如果 {@link QuadtreeTile#data} 已定义且具有
   * <code>eligibleForUnloading</code> 属性，则返回该属性的值。否则，此属性返回 true。
   * property.  If {@link QuadtreeTile#data} is defined and has an
   * {@link QuadtreeTileLoadState}。如果 {@link QuadtreeTile#data} 已定义且具有
   * <code>freeResources</code> 方法，则调用该方法。
   * @type {boolean}
   */
  get eligibleForUnloading() {
    let result = true;

    if (defined(this.data)) {
      result = /** @type {*} */ (this.data).eligibleForUnloading;
      if (!defined(result)) {
        result = true;
      }
    }

    return result;
  }

  /**
   * @param {QuadtreeTile[]} levelZeroTiles
   * @param {number} x
   * @param {number} y
   * @returns {QuadtreeTile}
   */
  findLevelZeroTile(levelZeroTiles, x, y) {
    const xTiles = this.tilingScheme.getNumberOfXTilesAtLevel(0);
    if (x < 0) {
      x += xTiles;
    } else if (x >= xTiles) {
      x -= xTiles;
    }

    if (y < 0 || y >= this.tilingScheme.getNumberOfYTilesAtLevel(0)) {
      return undefined;
    }

    return levelZeroTiles.filter(function (tile) {
      return tile.x === x && tile.y === y;
    })[0];
  }

  /**
   * @param {QuadtreeTile[]} levelZeroTiles
   * @returns {QuadtreeTile|undefined}
   */
  findTileToWest(levelZeroTiles) {
    const parent = this.parent;
    if (parent === undefined) {
      return this.findLevelZeroTile(levelZeroTiles, this.x - 1, this.y);
    }

    if (parent.southeastChild === this) {
      return parent.southwestChild;
    } else if (parent.northeastChild === this) {
      return parent.northwestChild;
    }

    const westOfParent = parent.findTileToWest(levelZeroTiles);
    if (westOfParent === undefined) {
      return undefined;
    } else if (parent.southwestChild === this) {
      return westOfParent.southeastChild;
    }
    return westOfParent.northeastChild;
  }

  /**
   * @param {QuadtreeTile[]} levelZeroTiles
   * @returns {QuadtreeTile|undefined}
   */
  findTileToEast(levelZeroTiles) {
    const parent = this.parent;
    if (parent === undefined) {
      return this.findLevelZeroTile(levelZeroTiles, this.x + 1, this.y);
    }

    if (parent.southwestChild === this) {
      return parent.southeastChild;
    } else if (parent.northwestChild === this) {
      return parent.northeastChild;
    }

    const eastOfParent = parent.findTileToEast(levelZeroTiles);
    if (eastOfParent === undefined) {
      return undefined;
    } else if (parent.southeastChild === this) {
      return eastOfParent.southwestChild;
    }
    return eastOfParent.northwestChild;
  }

  /**
   * @param {QuadtreeTile[]} levelZeroTiles
   * @returns {QuadtreeTile|undefined}
   */
  findTileToSouth(levelZeroTiles) {
    const parent = this.parent;
    if (parent === undefined) {
      return this.findLevelZeroTile(levelZeroTiles, this.x, this.y + 1);
    }

    if (parent.northwestChild === this) {
      return parent.southwestChild;
    } else if (parent.northeastChild === this) {
      return parent.southeastChild;
    }

    const southOfParent = parent.findTileToSouth(levelZeroTiles);
    if (southOfParent === undefined) {
      return undefined;
    } else if (parent.southwestChild === this) {
      return southOfParent.northwestChild;
    }
    return southOfParent.northeastChild;
  }

  /**
   * @param {QuadtreeTile[]} levelZeroTiles
   * @returns {QuadtreeTile|undefined}
   */
  findTileToNorth(levelZeroTiles) {
    const parent = this.parent;
    if (parent === undefined) {
      return this.findLevelZeroTile(levelZeroTiles, this.x, this.y - 1);
    }

    if (parent.southwestChild === this) {
      return parent.northwestChild;
    } else if (parent.southeastChild === this) {
      return parent.northeastChild;
    }

    const northOfParent = parent.findTileToNorth(levelZeroTiles);
    if (northOfParent === undefined) {
      return undefined;
    } else if (parent.northwestChild === this) {
      return northOfParent.southwestChild;
    }
    return northOfParent.southeastChild;
  }

  /**
   * 为给定的经纬度和铺砌层级创建空间哈希键。
   * {@link QuadtreeTileLoadState}.  If the {@link QuadtreeTile#data} property is defined and it
   * - 父铺砌块。
   *
   */
  freeResources() {
    // Clears cached heights when the tile is freed
    this.clearPositionCache();
    this.state = QuadtreeTileLoadState.START;
    this.renderable = false;
    this.upsampledFromParent = false;

    const data = /** @type {*} */ (this.data);
    if (defined(data) && defined(data.freeResources)) {
      data.freeResources();
    }

    freeTile(this._southwestChild);
    this._southwestChild = undefined;
    freeTile(this._southeastChild);
    this._southeastChild = undefined;
    freeTile(this._northwestChild);
    this._northwestChild = undefined;
    freeTile(this._northeastChild);
    this._northeastChild = undefined;
  }
}

const TILE_SIZE = 256;

/**
 * - 地图位置。
 *
 * @param {number} longitude
 * @param {number} latitude
 * @param {Rectangle} rectangle
 * @param {number} maximumScreenSpaceError
 * @returns {string}
 * @ignore
 */
function createSpatialHashKey(
  longitude,
  latitude,
  rectangle,
  maximumScreenSpaceError,
) {
  // Adjust precision based on quadtree level - higher levels get finer precision
  const maxError = (rectangle.width / TILE_SIZE) * maximumScreenSpaceError;
  // Round to the grid precision
  const lonGrid = Math.floor(longitude / maxError) * maxError;
  const latGrid = Math.floor(latitude / maxError) * maxError;
  return `${lonGrid.toFixed(10)},${latGrid.toFixed(10)}`;
}

const splitPointScratch = new Cartographic();

/**
 * 包含该位置的子铺砌块。
 * the bounds of the parent tile.
 * @private
 * @param {QuadtreeTile} tile - The parent tile.
 * @param {Cartographic} positionCartographic - The cartographic position.
 * @returns {QuadtreeTile} The child tile that contains the position.
 */
function childTileAtPosition(tile, positionCartographic) {
  // Can't assume that a given tiling scheme divides a parent into four tiles at its rectangle's center.
  // But we can safely take any child tile's rectangle and take its center-facing corner as the parent's split point.
  const nwChildRectangle = tile.northwestChild.rectangle;
  const tileSplitPoint = Rectangle.southeast(
    nwChildRectangle,
    splitPointScratch,
  );

  const x = positionCartographic.longitude >= tileSplitPoint.longitude ? 1 : 0;
  const y = positionCartographic.latitude < tileSplitPoint.latitude ? 1 : 0;

  switch (y * 2 + x) {
    case 0:
      return tile.northwestChild;
    case 1:
      return tile.northeastChild;
    case 2:
      return tile.southwestChild;
    default:
      return tile.southeastChild;
  }
}

/**
 * @param {QuadtreeTile} tile
 * @ignore
 */
function freeTile(tile) {
  if (defined(tile)) {
    tile.freeResources();
  }
}

export default QuadtreeTile;