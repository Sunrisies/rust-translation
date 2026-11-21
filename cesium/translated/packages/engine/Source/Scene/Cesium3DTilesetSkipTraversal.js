import { defined } from "@cesium/core";
import ManagedArray from "../Core/ManagedArray.js";
import Cesium3DTileRefine from "./Cesium3DTileRefine.js";
import Cesium3DTilesetTraversal from "./Cesium3DTilesetTraversal.js";

/**
 * 深度优先遍历，遍历所有可见图块并标记待选择的图块。
 * 允许跳过树层级，同时渲染子图块和父图块。
 *
 * @alias Cesium3DTilesetSkipTraversal
 * @constructor
 *
 * @private
 */
function Cesium3DTilesetSkipTraversal() {}

const traversal = {
  stack: new ManagedArray(),
  stackMaximumLength: 0,
};

const descendantTraversal = {
  stack: new ManagedArray(),
  stackMaximumLength: 0,
};

const selectionTraversal = {
  stack: new ManagedArray(),
  stackMaximumLength: 0,
  ancestorStack: new ManagedArray(),
  ancestorStackMaximumLength: 0,
};

const descendantSelectionDepth = 2;

/**
 * 遍历 {@link Cesium3DTileset} 以确定要加载和渲染的图块。
 *
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
Cesium3DTilesetSkipTraversal.selectTiles = function (tileset, frameState) {
  tileset._requestedTiles.length = 0;

  if (tileset.debugFreezeFrame) {
    return;
  }

  tileset._selectedTiles.length = 0;
  tileset._selectedTilesToStyle.length = 0;
  tileset._emptyTiles.length = 0;
  tileset.hasMixedContent = false;

  const root = tileset.root;
  Cesium3DTilesetTraversal.updateTile(root, frameState);

  if (!root.isVisible) {
    return;
  }

  if (
    root.getScreenSpaceError(frameState, true) <=
    tileset.memoryAdjustedScreenSpaceError
  ) {
    return;
  }

  executeTraversal(root, frameState);
  traverseAndSelect(root, frameState);

  traversal.stack.trim(traversal.stackMaximumLength);
  descendantTraversal.stack.trim(descendantTraversal.stackMaximumLength);
  selectionTraversal.stack.trim(selectionTraversal.stackMaximumLength);
  selectionTraversal.ancestorStack.trim(
    selectionTraversal.ancestorStackMaximumLength,
  );

  // Update the priority for any requests found during traversal
  // Update after traversal so that min and max values can be used to normalize priority values
  const requestedTiles = tileset._requestedTiles;
  for (let i = 0; i < requestedTiles.length; ++i) {
    requestedTiles[i].updatePriority();
  }
};

/**
 * 标记后代图块用于渲染，并根据需要更新。
 *
 * @private
 * @param {Cesium3DTile} root
 * @param {FrameState} frameState
 */
function selectDescendants(root, frameState) {
  const { updateTile, touchTile, selectTile } = Cesium3DTilesetTraversal;
  const stack = descendantTraversal.stack;
  stack.push(root);
  while (stack.length > 0) {
    descendantTraversal.stackMaximumLength = Math.max(
      descendantTraversal.stackMaximumLength,
      stack.length,
    );
    const tile = stack.pop();
    const children = tile.children;
    for (let i = 0; i < children.length; ++i) {
      const child = children[i];
      if (child.isVisible) {
        if (child.contentAvailable) {
          updateTile(child, frameState);
          touchTile(child, frameState);
          selectTile(child, frameState);
        } else if (child._depth - root._depth < descendantSelectionDepth) {
          // Continue traversing, but not too far
          stack.push(child);
        }
      }
    }
  }
}

/**
 * 如果图块有可用内容，则将其标记为选中状态。
 * 如果其内容不可用，且我们正在跳过细节层级，
 * 则选择祖先或后代图块 instead。
 *
 * @private
 * @param {Cesium3DTile} tile
 * @param {FrameState} frameState
 */
function selectDesiredTile(tile, frameState) {
  // If this tile is not loaded attempt to select its ancestor instead
  const loadedTile = tile.contentAvailable
    ? tile
    : tile._ancestorWithContentAvailable;
  if (defined(loadedTile)) {
    // Tiles will actually be selected in traverseAndSelect
    loadedTile._shouldSelect = true;
  } else {
    // If no ancestors are ready traverse down and select tiles to minimize empty regions.
    // This happens often for immediatelyLoadDesiredLevelOfDetail where parent tiles are not necessarily loaded before zooming out.
    selectDescendants(tile, frameState);
  }
}

/**
 * 更新具有内容的祖先图块的链接。
 *
 * @private
 * @param {Cesium3DTile} tile
 * @param {FrameState} frameState
 */
function updateTileAncestorContentLinks(tile, frameState) {
  tile._ancestorWithContent = undefined;
  tile._ancestorWithContentAvailable = undefined;

  const { parent } = tile;
  if (!defined(parent)) {
    return;
  }
  const parentHasContent =
    !parent.hasUnloadedRenderableContent ||
    parent._requestedFrame === frameState.frameNumber;

  // ancestorWithContent is an ancestor that has content or has the potential to have
  // content. Used in conjunction with tileset.skipLevels to know when to skip a tile.
  tile._ancestorWithContent = parentHasContent
    ? parent
    : parent._ancestorWithContent;

  // ancestorWithContentAvailable is an ancestor that is rendered if a desired tile is not loaded
  tile._ancestorWithContentAvailable = parent.contentAvailable
    ? parent
    : parent._ancestorWithContentAvailable;
}

/**
 * 判断图块是否已达到跳过细节层级的限制。
 * 如果是，它不应被跳过：应加载并渲染。
 *
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 * @returns {boolean} true 如果此图块不应被跳过。
 */
function reachedSkippingThreshold(tileset, tile) {
  const ancestor = tile._ancestorWithContent;
  return (
    !tileset.immediatelyLoadDesiredLevelOfDetail &&
    (tile._priorityProgressiveResolutionScreenSpaceErrorLeaf ||
      (defined(ancestor) &&
        tile._screenSpaceError <
          ancestor._screenSpaceError / tileset.skipScreenSpaceErrorFactor &&
        tile._depth > ancestor._depth + tileset.skipLevels))
  );
}

/**
 * @private
 * @param {Cesium3DTile} tile
 * @param {ManagedArray} stack
 * @param {FrameState} frameState
 * @returns {boolean}
 */
function updateAndPushChildren(tile, stack, frameState) {
  const { tileset, children } = tile;
  const { updateTile, loadTile, touchTile } = Cesium3DTilesetTraversal;

  for (let i = 0; i < children.length; ++i) {
    updateTile(children[i], frameState);
  }

  // Sort by distance to take advantage of early Z and reduce artifacts
  children.sort(Cesium3DTilesetTraversal.sortChildrenByDistanceToCamera);

  let anyChildrenVisible = false;

  for (let i = 0; i < children.length; ++i) {
    const child = children[i];
    if (child.isVisible) {
      stack.push(child);
      anyChildrenVisible = true;
    } else if (tileset.loadSiblings) {
      loadTile(child, frameState);
      touchTile(child, frameState);
    }
  }

  return anyChildrenVisible;
}

/**
 * 判断图块是否属于基础遍历范围。
 * 如果不是，该图块可以考虑被跳过以节省细节层级。
 *
 * @private
 * @param {Cesium3DTile} tile
 * @param {number} baseScreenSpaceError
 * @returns {boolean}
 */
function inBaseTraversal(tile, baseScreenSpaceError) {
  const { tileset } = tile;
  if (tileset.immediatelyLoadDesiredLevelOfDetail) {
    return false;
  }
  if (!defined(tile._ancestorWithContent)) {
    // Include root or near-root tiles in the base traversal so there is something to select up to
    return true;
  }
  if (tile._screenSpaceError === 0.0) {
    // If a leaf, use parent's SSE
    return tile.parent._screenSpaceError > baseScreenSpaceError;
  }
  return tile._screenSpaceError > baseScreenSpaceError;
}

/**
 * 深度优先遍历，遍历所有可见图块并标记待选择的图块。
 * 屏幕空间误差大于基础屏幕空间误差的图块属于基础遍历范围，
 * 其他所有图块都属于跳过遍历范围。跳过遍历允许跳过树层级。
 * 同时渲染子图块和父图块。
 *
 * @private
 * @param {Cesium3DTile} root
 * @param {FrameState} frameState
 */
function executeTraversal(root, frameState) {
  const { tileset } = root;
  const baseScreenSpaceError = tileset.immediatelyLoadDesiredLevelOfDetail
    ? Number.MAX_VALUE
    : Math.max(
        tileset.baseScreenSpaceError,
        tileset.memoryAdjustedScreenSpaceError,
      );
  const { canTraverse, loadTile, visitTile, touchTile } =
    Cesium3DTilesetTraversal;
  const stack = traversal.stack;
  stack.push(root);

  while (stack.length > 0) {
    traversal.stackMaximumLength = Math.max(
      traversal.stackMaximumLength,
      stack.length,
    );

    const tile = stack.pop();

    updateTileAncestorContentLinks(tile, frameState);
    const parent = tile.parent;
    const parentRefines = !defined(parent) || parent._refines;

    tile._refines = canTraverse(tile)
      ? updateAndPushChildren(tile, stack, frameState) && parentRefines
      : false;

    const stoppedRefining = !tile._refines && parentRefines;

    if (!tile.hasRenderableContent) {
      // Add empty tile just to show its debug bounding volume
      // If the tile has tileset content load the external tileset
      // If the tile cannot refine further select its nearest loaded ancestor
      tileset._emptyTiles.push(tile);
      loadTile(tile, frameState);
      if (stoppedRefining) {
        selectDesiredTile(tile, frameState);
      }
    } else if (tile.refine === Cesium3DTileRefine.ADD) {
      // Additive tiles are always loaded and selected
      selectDesiredTile(tile, frameState);
      loadTile(tile, frameState);
    } else if (tile.refine === Cesium3DTileRefine.REPLACE) {
      if (inBaseTraversal(tile, baseScreenSpaceError)) {
        // Always load tiles in the base traversal
        // Select tiles that can't refine further
        loadTile(tile, frameState);
        if (stoppedRefining) {
          selectDesiredTile(tile, frameState);
        }
      } else if (stoppedRefining) {
        // In skip traversal, load and select tiles that can't refine further
        selectDesiredTile(tile, frameState);
        loadTile(tile, frameState);
      } else if (reachedSkippingThreshold(tileset, tile)) {
        // In skip traversal, load tiles that aren't skipped
        loadTile(tile, frameState);
      }
    }

    visitTile(tile, frameState);
    touchTile(tile, frameState);
  }
}

/**
 * 遍历树并检查所选帧是否为当前帧。如果是，则将其加入选择队列。
 * 这是前序遍历，因此子图块在祖先图块之前被选中。
 *
 * 前序遍历的目的是使图块能够轻松地被标记其
 * 选择深度。图块的_selectionDepth 表示其在树中的深度，所有未被选中的图块都会被移除。
 * 此属性对于 stencil 测试非常重要，因为我们希望将更深的图块绘制在它们的
 * 祖先图块之上。如果图块集非常深，其深度可能无法适应 stencil 缓冲区。
 *
 * 我们希望在祖先图块之前选择子图块，因为无法保证子图块的 z-depth 与祖先图块的 z-depth 之间的关系。我们不能依赖 Z 值，因为我们希望子图块始终出现在祖先图块之上，无论真实深度如何。使用的 stencil 测试要求先绘制子图块。
 * the children's z-depth and the ancestor's z-depth. We cannot rely on Z because we want the child to appear on top
 * of ancestor regardless of true depth. The stencil tests used require children to be drawn first.
 *
 * 注意：3D Tiles 使用 stencil 缓冲区的 3 位数据，这意味着当存在超过 7 层的选择图块时，此功能将不起作用。这种情况不太可能发生。
 * selected tiles that is deeper than 7. This is not very likely.
 *
 * @private
 * @param {Cesium3DTile} root
 * @param {FrameState} frameState
 */
function traverseAndSelect(root, frameState) {
  const { selectTile, canTraverse } = Cesium3DTilesetTraversal;
  const { stack, ancestorStack } = selectionTraversal;
  let lastAncestor;

  stack.push(root);

  while (stack.length > 0 || ancestorStack.length > 0) {
    selectionTraversal.stackMaximumLength = Math.max(
      selectionTraversal.stackMaximumLength,
      stack.length,
    );
    selectionTraversal.ancestorStackMaximumLength = Math.max(
      selectionTraversal.ancestorStackMaximumLength,
      ancestorStack.length,
    );

    if (ancestorStack.length > 0) {
      const waitingTile = ancestorStack.peek();
      if (waitingTile._stackLength === stack.length) {
        ancestorStack.pop();
        if (waitingTile !== lastAncestor) {
          waitingTile._finalResolution = false;
        }
        selectTile(waitingTile, frameState);
        continue;
      }
    }

    const tile = stack.pop();
    if (!defined(tile)) {
      // stack is empty but ancestorStack isn't
      continue;
    }

    const traverse = canTraverse(tile);

    if (tile._shouldSelect) {
      if (tile.refine === Cesium3DTileRefine.ADD) {
        selectTile(tile, frameState);
      } else {
        tile._selectionDepth = ancestorStack.length;
        if (tile._selectionDepth > 0) {
          tile.tileset.hasMixedContent = true;
        }
        lastAncestor = tile;
        if (!traverse) {
          selectTile(tile, frameState);
          continue;
        }
        ancestorStack.push(tile);
        tile._stackLength = stack.length;
      }
    }

    if (traverse) {
      const children = tile.children;
      for (let i = 0; i < children.length; ++i) {
        const child = children[i];
        if (child.isVisible) {
          stack.push(child);
        }
      }
    }
  }
}

export default Cesium3DTilesetSkipTraversal;
