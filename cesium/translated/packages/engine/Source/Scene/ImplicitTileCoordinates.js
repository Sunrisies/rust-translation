import { Check, DeveloperError, Math as CesiumMath } from "@cesium/core";
import MortonOrder from "../Core/MortonOrder.js";
import ImplicitSubdivisionScheme from "./ImplicitSubdivisionScheme.js";

/**
 * 隐式瓦片集中的瓦片坐标。这些坐标
 * 对于四叉树为 (level, x, y)，对于八叉树为 (level, x, y, z)。
 * <p>
 * 层级编号从 0 开始，通常从隐式瓦片集的根节点开始。
 * 瓦片集中的瓦片在 JSON 中具有 implicitTiling 属性（适用于 3D Tiles 1.1）或 <code>3DTILES_implicit_tiling</code> 扩展属性。
 * 该对象还可以表示一组坐标与另一组坐标之间的相对偏移量。请参阅 {@link ImplicitTileCoordinates#getOffsetCoordinates}。其中，
 * This object can also represent the relative offset from one set of coordinates
 * to another. See {@link ImplicitTileCoordinates#getOffsetCoordinates}. The term
 * “局部坐标”指的是相对于子树根节点的坐标，而“全局坐标”指的是相对于隐式瓦片集根节点的坐标。
 * 对于盒状边界体积，x、y、z 沿半轴定义的 +x、+y 和 +z 方向增加。
 * 对于区域边界体积，x 在 +经度方向增加，y 在 +纬度方向增加，z 在 +高度方向增加。
 * </p>
 * <p>
 * 在隐式坐标与莫顿索引之间转换时需注意，因为 {@link MortonOrder#encode2D} 有 16 位限制，而 {@link MortonOrder#encode3D} 有 10 位限制。通常这些转换应在局部坐标上进行，而不是全局坐标，且四叉树子树的最大层级应为 15，八叉树为 9（以包含子子树坐标所需的额外层级）。
 * 具有以下属性的对象：
 * </p>
 * <p>
 * 坐标适用于四叉树还是八叉树
 * 坐标子树中不同的层级数量
 * 与具有扩展属性的瓦片相比，该瓦片的层级
 * </p>
 * <p>
 * 该瓦片的 x 坐标
 * indices because there is a 16-bit limit on {@link MortonOrder#encode2D} and
 * a 10-bit limit on {@link MortonOrder#encode3D}. Typically these conversions
 * 这是 3D Tiles 规范中尚未定稿的部分，可能会根据 Cesium 的标准弃用政策进行更改。
 * 瓦片集是四叉树还是八叉树
 * 坐标子树中不同的层级数量
 * </p>
 *
 * @alias ImplicitTileCoordinates
 * @constructor
 *
 * @param {object} options 该瓦片的层级，相对于其 JSON 中具有 implicit tiling 属性的瓦片
 * @param {ImplicitSubdivisionScheme} options.subdivisionScheme (3D Tiles 1.1) 或 <code>3DTILES_implicit_tiling</code> 扩展属性。
 * @param {number} options.subtreeLevels 层级编号从 0 开始。
 * @param {number} options.level 该瓦片的 x 坐标
 * @param {number} options.x 该瓦片的 y 坐标
 * @param {number} options.y 该瓦片的 z 坐标。仅对八叉树有效。
 * @param {number} [options.z] The z coordinate of the tile. Only required when options.subdivisionScheme is ImplicitSubdivisionScheme.OCTREE
 * @private
 * @experimental This feature is using part of the 3D Tiles spec that is not final and is subject to change without Cesium's standard deprecation policy.
 */
function ImplicitTileCoordinates(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.subdivisionScheme", options.subdivisionScheme);
  Check.typeOf.number("options.subtreeLevels", options.subtreeLevels);
  Check.typeOf.number("options.level", options.level);
  Check.typeOf.number("options.x", options.x);
  Check.typeOf.number("options.y", options.y);
  if (options.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    Check.typeOf.number("options.z", options.z);
  }
  // Check for values that are negative
  if (options.level < 0) {
    throw new DeveloperError("level must be non-negative");
  }
  if (options.x < 0) {
    throw new DeveloperError("x must be non-negative");
  }
  if (options.y < 0) {
    throw new DeveloperError("y must be non-negative");
  }
  if (options.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    if (options.z < 0) {
      throw new DeveloperError("z must be non-negative");
    }
  }

  // Check for values that are too large
  const dimensionAtLevel = 1 << options.level;
  if (options.x >= dimensionAtLevel) {
    throw new DeveloperError("x is out of range");
  }
  if (options.y >= dimensionAtLevel) {
    throw new DeveloperError("y is out of range");
  }
  if (options.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    if (options.z >= dimensionAtLevel) {
      throw new DeveloperError("z is out of range");
    }
  }
  //>>includeEnd('debug');

  /**
   * Whether the tileset is a quadtree or octree
   *
   * @type {ImplicitSubdivisionScheme}
   * @readonly
   * @private
   */
  this.subdivisionScheme = options.subdivisionScheme;

  /**
   * The number of distinct levels within the coordinate's subtree
   *
   * @type {number}
   * @readonly
   * @private
   */
  this.subtreeLevels = options.subtreeLevels;

  /**
   * Level of this tile, relative to the tile with implicit tiling in its JSON
   * (3D Tiles 1.1) or the <code>3DTILES_implicit_tiling</code> extension.
   * Level numbers start at 0.
   *
   * @type {number}
   * @readonly
   * @private
   */
  this.level = options.level;

  /**
   * X coordinate of this tile
   *
   * @type {number}
   * @readonly
   * @private
   */
  this.x = options.x;

  /**
   * Y coordinate of this tile
   *
   * @type {number}
   * @readonly
   * @private
   */
  this.y = options.y;

  /**
   * Z coordinate of this tile. Only defined for octrees.
   *
   * @type {number|undefined}
   * @readonly
   * @private
   */
  this.z = undefined;
  if (options.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    this.z = options.z;
  }
}

Object.defineProperties(ImplicitTileCoordinates.prototype, {
  /**
   * 一个位于 [0, branchingFactor) 范围内的索引，表示
   * 这些坐标对应的父单元格的哪个子实体。
   * 这可以被视为父瓦片内的莫顿索引。
   * <p>
   * 这是瓦片莫顿索引的最后 3 位，但也可以
   * 通过连接 [z0] y0 x0 位来直接计算。
   * </p>
   *
   * @type {number}
   * @readonly
   * @private
   */
  childIndex: {
    get: function () {
      let childIndex = 0;
      childIndex |= this.x & 1;
      childIndex |= (this.y & 1) << 1;
      if (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
        childIndex |= (this.z & 1) << 2;
      }

      return childIndex;
    },
  },

  /**
   * 通过交织 x、y 和 z 坐标的位，获取当前层级中该瓦片的莫顿索引。
   * 通过添加莫顿索引与层级偏移量，获取瓦片索引。
   *
   * @type {number}
   * @readonly
   * @private
   */
  mortonIndex: {
    get: function () {
      if (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
        return MortonOrder.encode3D(this.x, this.y, this.z);
      }
      return MortonOrder.encode2D(this.x, this.y);
    },
  },

  /**
   * 通过将莫顿索引与层级偏移量相加，获取瓦片索引。
   *
   * @type {number}
   * @readonly
   * @private
   */
  tileIndex: {
    get: function () {
      const levelOffset =
        this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE
          ? // (8^N - 1) / (8-1)
            ((1 << (3 * this.level)) - 1) / 7
          : // (4^N - 1) / (4-1)
            ((1 << (2 * this.level)) - 1) / 3;

      const mortonIndex = this.mortonIndex;
      return levelOffset + mortonIndex;
    },
  },
});

/**
 * 检查两个坐标是否兼容。
 * @param {ImplicitTileCoordinates} a
 * @param {ImplicitTileCoordinates} b
 * @private
 */
function checkMatchingSubtreeShape(a, b) {
  if (a.subdivisionScheme !== b.subdivisionScheme) {
    throw new DeveloperError("coordinates must have same subdivisionScheme");
  }
  if (a.subtreeLevels !== b.subtreeLevels) {
    throw new DeveloperError("coordinates must have same subtreeLevels");
  }
}

/**
 * 使用 (level, x, y, [z]) 相对偏移量，计算树中更深的瓦片的坐标。
 *
 * @param {ImplicitTileCoordinates} offsetCoordinates 从祖先到后代的坐标偏移量。
 * @returns {ImplicitTileCoordinates} The 后代的坐标。
 * @private
 */
ImplicitTileCoordinates.prototype.getDescendantCoordinates = function (
  offsetCoordinates,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("offsetCoordinates", offsetCoordinates);
  checkMatchingSubtreeShape(this, offsetCoordinates);
  //>>includeEnd('debug');

  const descendantLevel = this.level + offsetCoordinates.level;
  const descendantX = (this.x << offsetCoordinates.level) + offsetCoordinates.x;
  const descendantY = (this.y << offsetCoordinates.level) + offsetCoordinates.y;

  if (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    const descendantZ =
      (this.z << offsetCoordinates.level) + offsetCoordinates.z;

    return new ImplicitTileCoordinates({
      subdivisionScheme: this.subdivisionScheme,
      subtreeLevels: this.subtreeLevels,
      level: descendantLevel,
      x: descendantX,
      y: descendantY,
      z: descendantZ,
    });
  }

  // Quadtree
  return new ImplicitTileCoordinates({
    subdivisionScheme: this.subdivisionScheme,
    subtreeLevels: this.subtreeLevels,
    level: descendantLevel,
    x: descendantX,
    y: descendantY,
  });
};

/**
 * 通过向上移动一定层级数，计算树中更高层的瓦片坐标。
 *
 * @param {number} offsetLevels 在树中需要向上移动的层级数。
 * @returns {ImplicitTileCoordinates} The 祖先的坐标。
 * @private
 */
ImplicitTileCoordinates.prototype.getAncestorCoordinates = function (
  offsetLevels,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("offsetLevels", offsetLevels);
  if (offsetLevels < 0) {
    throw new DeveloperError("offsetLevels must be non-negative");
  }
  if (offsetLevels > this.level) {
    throw new DeveloperError("ancestor cannot be above the tileset root");
  }
  //>>includeEnd('debug');

  const divisor = 1 << offsetLevels;
  const ancestorLevel = this.level - offsetLevels;
  const ancestorX = Math.floor(this.x / divisor);
  const ancestorY = Math.floor(this.y / divisor);

  if (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    const ancestorZ = Math.floor(this.z / divisor);

    return new ImplicitTileCoordinates({
      subdivisionScheme: this.subdivisionScheme,
      subtreeLevels: this.subtreeLevels,
      level: ancestorLevel,
      x: ancestorX,
      y: ancestorY,
      z: ancestorZ,
    });
  }

  // Quadtree
  return new ImplicitTileCoordinates({
    subdivisionScheme: this.subdivisionScheme,
    subtreeLevels: this.subtreeLevels,
    level: ancestorLevel,
    x: ancestorX,
    y: ancestorY,
  });
};

/**
 * 计算到后代的 (level, x, y, [z]) 偏移量。
 *
 * @param {ImplicitTileCoordinates} descendantCoordinates 后代的坐标。
 * @returns {ImplicitTileCoordinates} The 祖先与后代之间的偏移量。
 */
ImplicitTileCoordinates.prototype.getOffsetCoordinates = function (
  descendantCoordinates,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("descendantCoordinates", descendantCoordinates);
  if (
    !this.isEqual(descendantCoordinates) &&
    !this.isAncestor(descendantCoordinates)
  ) {
    throw new DeveloperError("this is not an ancestor of descendant");
  }
  checkMatchingSubtreeShape(this, descendantCoordinates);
  //>>includeEnd('debug');

  const offsetLevel = descendantCoordinates.level - this.level;
  const dimensionAtOffsetLevel = 1 << offsetLevel;

  const offsetX = descendantCoordinates.x % dimensionAtOffsetLevel;
  const offsetY = descendantCoordinates.y % dimensionAtOffsetLevel;

  if (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    const offsetZ = descendantCoordinates.z % dimensionAtOffsetLevel;

    return new ImplicitTileCoordinates({
      subdivisionScheme: this.subdivisionScheme,
      subtreeLevels: this.subtreeLevels,
      level: offsetLevel,
      x: offsetX,
      y: offsetY,
      z: offsetZ,
    });
  }

  // Quadtree
  return new ImplicitTileCoordinates({
    subdivisionScheme: this.subdivisionScheme,
    subtreeLevels: this.subtreeLevels,
    level: offsetLevel,
    x: offsetX,
    y: offsetY,
  });
};

/**
 * 给定子实体的莫顿索引，计算子实体的坐标。
 * 这是 {@link ImplicitTileCoordinates#getDescendantCoordinates} 的特殊情况。
 *
 * @param {number} childIndex 子瓦片相对于其父实体的莫顿索引。
 * @returns {ImplicitTileCoordinates} The 子瓦片的瓦片坐标。
 * @private
 */
ImplicitTileCoordinates.prototype.getChildCoordinates = function (childIndex) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("childIndex", childIndex);
  const branchingFactor = ImplicitSubdivisionScheme.getBranchingFactor(
    this.subdivisionScheme,
  );
  if (childIndex < 0 || branchingFactor <= childIndex) {
    throw new DeveloperError(
      `childIndex must be at least 0 and less than ${branchingFactor}`,
    );
  }
  //>>includeEnd('debug');

  const level = this.level + 1;
  const x = 2 * this.x + (childIndex % 2);
  const y = 2 * this.y + (Math.floor(childIndex / 2) % 2);

  if (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    const z = 2 * this.z + (Math.floor(childIndex / 4) % 2);
    return new ImplicitTileCoordinates({
      subdivisionScheme: this.subdivisionScheme,
      subtreeLevels: this.subtreeLevels,
      level: level,
      x: x,
      y: y,
      z: z,
    });
  }

  // Quadtree
  return new ImplicitTileCoordinates({
    subdivisionScheme: this.subdivisionScheme,
    subtreeLevels: this.subtreeLevels,
    level: level,
    x: x,
    y: y,
  });
};

/**
 * 获取包含该瓦片的子树坐标。如果该瓦片是
 * 子树的根节点，则返回子树的根节点。
 *
 * @returns {ImplicitTileCoordinates} The 包含该瓦片的子树。
 * @private
 */
ImplicitTileCoordinates.prototype.getSubtreeCoordinates = function () {
  return this.getAncestorCoordinates(this.level % this.subtreeLevels);
};

/**
 * 获取包含该瓦片的父子树坐标。
 *
 * @returns {ImplicitTileCoordinates} The 包含该瓦片的父子树。
 * @private
 */
ImplicitTileCoordinates.prototype.getParentSubtreeCoordinates = function () {
  return this.getAncestorCoordinates(
    (this.level % this.subtreeLevels) + this.subtreeLevels,
  );
};

/**
 * 返回该瓦片是否是另一个瓦片的祖先。
 *
 * @param {ImplicitTileCoordinates} descendantCoordinates 后代的坐标。
 * @returns {boolean} <code>true</code> 如果该瓦片是另一个瓦片的祖先，则...
 * @private
 */
ImplicitTileCoordinates.prototype.isAncestor = function (
  descendantCoordinates,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("descendantCoordinates", descendantCoordinates);
  checkMatchingSubtreeShape(this, descendantCoordinates);
  //>>includeEnd('debug');

  const levelDifference = descendantCoordinates.level - this.level;
  if (levelDifference <= 0) {
    return false;
  }

  const ancestorX = descendantCoordinates.x >> levelDifference;
  const ancestorY = descendantCoordinates.y >> levelDifference;
  const isAncestorX = this.x === ancestorX;
  const isAncestorY = this.y === ancestorY;

  if (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    const ancestorZ = descendantCoordinates.z >> levelDifference;
    const isAncestorZ = this.z === ancestorZ;
    return isAncestorX && isAncestorY && isAncestorZ;
  }

  // Quadtree
  return isAncestorX && isAncestorY;
};

/**
 * 返回提供的坐标是否等于该坐标。
 *
 * @param {ImplicitTileCoordinates} otherCoordinates 其他坐标。
 * @returns {boolean} <code>true</code> 如果坐标相等，则...
 * @private
 */
ImplicitTileCoordinates.prototype.isEqual = function (otherCoordinates) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("otherCoordinates", otherCoordinates);
  //>>includeEnd('debug');

  return (
    this.subdivisionScheme === otherCoordinates.subdivisionScheme &&
    this.subtreeLevels === otherCoordinates.subtreeLevels &&
    this.level === otherCoordinates.level &&
    this.x === otherCoordinates.x &&
    this.y === otherCoordinates.y &&
    (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE
      ? this.z === otherCoordinates.z
      : true)
  );
};

/**
 * 返回该瓦片是否是隐式瓦片集的根节点。
 *
 * @returns {boolean} <code>true</code> 如果该瓦片是根节点，则...
 * @private
 */
ImplicitTileCoordinates.prototype.isImplicitTilesetRoot = function () {
  return this.level === 0;
};

/**
 * 返回该瓦片是否是子树的根节点。
 *
 * @returns {boolean} <code>true</code> 如果该瓦片是子树的根节点，则...
 * @private
 */
ImplicitTileCoordinates.prototype.isSubtreeRoot = function () {
  return this.level % this.subtreeLevels === 0;
};

/**
 * 返回该瓦片是否位于子树的最后一行。
 *
 * @returns {boolean} <code>true</code> 如果该瓦片位于子树的最后一行，则...
 * @private
 */
ImplicitTileCoordinates.prototype.isBottomOfSubtree = function () {
  return this.level % this.subtreeLevels === this.subtreeLevels - 1;
};

/**
 * 获取值字典，用于向隐式模板 URI 模板化。
 *
 * @returns {object} An 适合与 {@link Resource#getDerivedResource} 一起使用的对象。
 * @private
 */
ImplicitTileCoordinates.prototype.getTemplateValues = function () {
  const values = {
    level: this.level,
    x: this.x,
    y: this.y,
  };
  if (this.subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    values.z = this.z;
  }

  return values;
};

const scratchCoordinatesArray = [0, 0, 0];

/**
 * 给定层级数、莫顿索引以及瓦片集是否为
 * 八叉树/四叉树，计算 (level, x, y, [z]) 坐标
 *
 * @param {ImplicitSubdivisionScheme} subdivisionScheme 这些坐标适用于四叉树还是八叉树
 * @param {number} subtreeLevels 该坐标子树中不同层级的数量
 * @param {number} level 树的层级
 * @param {number} mortonIndex 瓦片的莫顿索引
 * @returns {ImplicitTileCoordinates} The 具有给定莫顿索引的瓦片坐标
 * @private
 */
ImplicitTileCoordinates.fromMortonIndex = function (
  subdivisionScheme,
  subtreeLevels,
  level,
  mortonIndex,
) {
  let coordinatesArray;
  if (subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    coordinatesArray = MortonOrder.decode3D(
      mortonIndex,
      scratchCoordinatesArray,
    );
    return new ImplicitTileCoordinates({
      subdivisionScheme: subdivisionScheme,
      subtreeLevels: subtreeLevels,
      level: level,
      x: coordinatesArray[0],
      y: coordinatesArray[1],
      z: coordinatesArray[2],
    });
  }

  coordinatesArray = MortonOrder.decode2D(mortonIndex, scratchCoordinatesArray);
  return new ImplicitTileCoordinates({
    subdivisionScheme: subdivisionScheme,
    subtreeLevels: subtreeLevels,
    level: level,
    x: coordinatesArray[0],
    y: coordinatesArray[1],
  });
};

/**
 * 给定瓦片索引以及瓦片集是八叉树还是四叉树，计算
 * (level, x, y, [z]) 坐标
 *
 * @param {ImplicitSubdivisionScheme} subdivisionScheme 这些坐标适用于四叉树还是八叉树
 * @param {number} subtreeLevels 该坐标子树中不同层级的数量
 * @param {number} tileIndex 瓦片的索引
 * @returns {ImplicitTileCoordinates} The 具有给定瓦片索引的瓦片坐标
 * @private
 */
ImplicitTileCoordinates.fromTileIndex = function (
  subdivisionScheme,
  subtreeLevels,
  tileIndex,
) {
  let level;
  let levelOffset;
  let mortonIndex;

  if (subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    // Node count up to octree level: (8^L - 1) / (8-1)
    // (8^L - 1) / (8-1) <= X < (8^(L+1) - 1) / (8-1)
    // 8^L <= (7x + 1) < 8^(L+1)
    // L <= log8(7x + 1) < L + 1
    // L = floor(log8(7x + 1))
    // L = floor(log2(7x + 1) / log2(8))
    // L = floor(log2(7x + 1) / 3)
    level = Math.floor(CesiumMath.log2(7 * tileIndex + 1) / 3);
    levelOffset = ((1 << (3 * level)) - 1) / 7;
    mortonIndex = tileIndex - levelOffset;
  } else {
    // Node count up to quadtree level: (4^L - 1) / (4-1)
    // (4^L - 1) / (4-1) <= X < (4^(L+1) - 1) / (4-1)
    // 4^L <= (3x + 1) < 4^(L+1)
    // L <= log4(3x + 1) < L + 1
    // L = floor(log4(3x + 1))
    // L = floor(log2(3x + 1) / log2(4))
    // L = floor(log2(3x + 1) / 2)
    level = Math.floor(CesiumMath.log2(3 * tileIndex + 1) / 2);
    levelOffset = ((1 << (2 * level)) - 1) / 3;
    mortonIndex = tileIndex - levelOffset;
  }

  return ImplicitTileCoordinates.fromMortonIndex(
    subdivisionScheme,
    subtreeLevels,
    level,
    mortonIndex,
  );
};

export default ImplicitTileCoordinates;