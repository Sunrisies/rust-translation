import { DeveloperError, Frozen } from "@cesium/core";
import DoubleEndedPriorityQueue from "../Core/DoubleEndedPriorityQueue.js";

/**
 * @alias ImplicitSubtreeCache
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象
 * @param {number} [options.maximumSubtreeCount=0] 此缓存可以存储的子树总数。如果添加新子树会超出此限制，则按优先级从高到低依次移除低优先级的子树，直到有空间为止；除非要移除的子树是新子树的父节点，在这种情况下不会移除该子树，新子树仍会被添加，从而超出内存限制。
 *
 * @private
 */
function ImplicitSubtreeCache(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * @type {number}
   * @private
   */
  this._maximumSubtreeCount = options.maximumSubtreeCount ?? 0;

  /**
   * 一个计数器，每当添加一个子树时就会增加。用于按最近添加的顺序对子树进行排序。
   * @type {number}
   * @private
   */
  this._subtreeRequestCounter = 0;

  /**
   * @type {DoubleEndedPriorityQueue}
   * @private
   */
  this._queue = new DoubleEndedPriorityQueue({
    comparator: ImplicitSubtreeCache.comparator,
  });
}

/**
 * @param {ImplicitSubtree} subtree
 */
ImplicitSubtreeCache.prototype.addSubtree = function (subtree) {
  const cacheNode = new ImplicitSubtreeCacheNode(
    subtree,
    this._subtreeRequestCounter,
  );
  this._subtreeRequestCounter++;
  this._queue.insert(cacheNode);

  // Make sure the parent subtree exists in the cache
  const subtreeCoord = subtree.implicitCoordinates;
  if (subtreeCoord.level > 0) {
    const parentCoord = subtreeCoord.getParentSubtreeCoordinates();
    const parentNode = this.find(parentCoord);

    //>>includeStart('debug', pragmas.debug)
    if (parentNode === undefined) {
      throw new DeveloperError("parent node needs to exist");
    }
    //>>includeEnd('debug');
  }

  if (this._maximumSubtreeCount > 0) {
    while (this._queue.length > this._maximumSubtreeCount) {
      const lowestPriorityNode = this._queue.getMinimum();
      if (lowestPriorityNode === cacheNode) {
        // Don't remove itself
        break;
      }

      this._queue.removeMinimum();
    }
  }
};

/**
 * @param {ImplicitTileCoordinates} subtreeCoord
 * @returns {ImplicitSubtree|undefined}
 */
ImplicitSubtreeCache.prototype.find = function (subtreeCoord) {
  const queue = this._queue;
  const array = queue.internalArray;
  const arrayLength = queue.length;

  for (let i = 0; i < arrayLength; i++) {
    const other = array[i];
    const otherSubtree = other.subtree;
    const otherCoord = otherSubtree.implicitCoordinates;
    if (subtreeCoord.isEqual(otherCoord)) {
      return other.subtree;
    }
  }
  return undefined;
};

/**
 * @param {ImplicitSubtreeCacheNode} a
 * @param {ImplicitSubtreeCacheNode} b
 * @returns {number}
 */
ImplicitSubtreeCache.comparator = function (a, b) {
  const aCoord = a.subtree.implicitCoordinates;
  const bCoord = b.subtree.implicitCoordinates;
  if (aCoord.isAncestor(bCoord)) {
    // Technically this shouldn't happen because the ancestor subtree was supposed to be added to the cache first.
    return +1.0;
  } else if (bCoord.isAncestor(aCoord)) {
    return -1.0;
  }
  return a.stamp - b.stamp;
};

/**
 * @alias ImplicitSubtreeCacheNode
 * @constructor
 *
 * @param {ImplicitSubtree} subtree
 * @param {number} stamp
 *
 * @private
 */
function ImplicitSubtreeCacheNode(subtree, stamp) {
  this.subtree = subtree;
  this.stamp = stamp;
}

export default ImplicitSubtreeCache;
