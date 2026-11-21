import { defined } from "@cesium/core";

/**
 * 这是一个待替换的瓦片优先级队列，以便在空间上腾出位置给新瓦片。该队列采用链表实现。
 * 链表结构使得队列操作更加高效。
 *
 * @alias TileReplacementQueue
 * @private
 */
function TileReplacementQueue() {
  this.head = undefined;
  this.tail = undefined;
  this.count = 0;
  this._lastBeforeStartOfFrame = undefined;
}

/**
 * 标记渲染帧的开始点。列表中位于此瓦片之前的瓦片在上一帧被使用过，因此不得卸载。
 * 通过卸载使用最少的瓦片，将队列大小缩减到指定值。即使导致瓦片数量超过规定上限，上一帧使用的瓦片也不会被卸载。
 */
TileReplacementQueue.prototype.markStartOfRenderFrame = function () {
  this._lastBeforeStartOfFrame = this.head;
};

/**
 * 该操作会卸载使用最少的瓦片，从而缩小队列规模。
 * 被渲染的瓦片会被标记为当前帧已渲染，并排在本帧未渲染的瓦片之前。
 * 本帧实际渲染的瓦片数量。
 *
 * @param {number} maximumTiles The maximum number of tiles in the queue.
 */
TileReplacementQueue.prototype.trimTiles = function (maximumTiles) {
  let tileToTrim = this.tail;
  let keepTrimming = true;
  while (
    keepTrimming &&
    defined(this._lastBeforeStartOfFrame) &&
    this.count > maximumTiles &&
    defined(tileToTrim)
  ) {
    // Stop trimming after we process the last tile not used in the
    // current frame.
    keepTrimming = tileToTrim !== this._lastBeforeStartOfFrame;

    const previous = tileToTrim.replacementPrevious;

    if (tileToTrim.eligibleForUnloading) {
      tileToTrim.freeResources();
      remove(this, tileToTrim);
    }

    tileToTrim = previous;
  }
};

function remove(tileReplacementQueue, item) {
  const previous = item.replacementPrevious;
  const next = item.replacementNext;

  if (item === tileReplacementQueue._lastBeforeStartOfFrame) {
    tileReplacementQueue._lastBeforeStartOfFrame = next;
  }

  if (item === tileReplacementQueue.head) {
    tileReplacementQueue.head = next;
  } else {
    previous.replacementNext = next;
  }

  if (item === tileReplacementQueue.tail) {
    tileReplacementQueue.tail = previous;
  } else {
    next.replacementPrevious = previous;
  }

  item.replacementPrevious = undefined;
  item.replacementNext = undefined;

  --tileReplacementQueue.count;
}

/**
 * Marks a tile as rendered this frame and moves it before the first tile that was not rendered
 * this frame.
 *
 * @param {TileReplacementQueue} item The tile that was rendered.
 */
TileReplacementQueue.prototype.markTileRendered = function (item) {
  const head = this.head;
  if (head === item) {
    if (item === this._lastBeforeStartOfFrame) {
      this._lastBeforeStartOfFrame = item.replacementNext;
    }
    return;
  }

  ++this.count;

  if (!defined(head)) {
    // no other tiles in the list
    item.replacementPrevious = undefined;
    item.replacementNext = undefined;
    this.head = item;
    this.tail = item;
    return;
  }

  if (defined(item.replacementPrevious) || defined(item.replacementNext)) {
    // tile already in the list, remove from its current location
    remove(this, item);
  }

  item.replacementPrevious = undefined;
  item.replacementNext = head;
  head.replacementPrevious = item;

  this.head = item;
};
export default TileReplacementQueue;
