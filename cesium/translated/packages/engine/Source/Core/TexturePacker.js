import { BoundingRectangle, Check, defined } from "@cesium/core";

/**
 * @typedef {object} TexturePacker.PackableObject
 * 任何对象，例如具有以下属性的 <code>Image**：
 * @private
 * @property {number} width 图像的宽度，或其他对象的宽度，通常以像素为单位
 * @property {number} height 图像的高度，或其他对象的高度，通常以像素为单位
 */

/**
 * 纹理图集被递归地分解为称为节点的空间区域。
 * 节点包含图像引用或子节点。
 * @private
 * @constructor
 * @param {object} options 一个具有以下属性的选项对象：
 * @param {number} options.x 纹理节点的 x 偏移量
 * @param {number} options.y 纹理节点的 y 偏移量
 * @param {number} options.width 纹理节点的宽度
 * @param {number} options.height 纹理节点的宽度
 */
function TextureNode({ x, y, width, height }) {
  /**
   * @type {BoundingRectangle}
   */
  this.rectangle = new BoundingRectangle(x, y, width, height);

  /**
   * @type {TextureNode|undefined}
   */
  this.childNode1 = undefined;
  /**
   * @type {TextureNode|undefined}
   */
  this.childNode2 = undefined;

  /**
   * 引用图像或打包数据的标识符
   * @type {number|undefined}
   */
  this.index = undefined;
}

/**
 * 通常与 {@link TextureAtlas} 一起使用，以计算存储图像或其他数据的高效区域。通常，所有单位都以像素为单位表示。
 * @alias TexturePacker
 * @constructor
 * @private
 * @param {object} options 具有以下属性的对象：
 * @param {number} options.width 图集的宽度，以像素为单位
 * @param {number} options.height 图集的高度，以像素为单位
 * @param {number} options.borderPadding 边框填充量，以像素为单位
 */
function TexturePacker({ width, height, borderPadding }) {
  this._width = width;
  this._height = height;

  this._borderPadding = borderPadding;

  this._root = new TextureNode({
    x: borderPadding,
    y: borderPadding,
    width: width - 2 * borderPadding,
    height: height - 2 * borderPadding,
  });
}

/**
 * 根据对象的尺寸，将其插入下一个可用区域。在方便的情况下，按从大到小的顺序打包项目是最有效的。
 * @private
 * @param {number} index 引用图像或其他存储数据的标识符
 * @param {TexturePacker.PackableObject} packableObject 一个对象，例如 <code>Image》，具有以像素为单位的 <code>width</code> 和 <code>height</code> 属性。
 * @returns {TextureNode|undefined} The 如果没有足够大的区域可以容纳对象的尺寸，则创建该区域，或设置为 <code>undefined</code>。
 */
TexturePacker.prototype.pack = function (index, { width, height }) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThanOrEquals("index", index, 0);
  Check.typeOf.number.greaterThanOrEquals("image.width", width, 1);
  Check.typeOf.number.greaterThanOrEquals("image.height", height, 1);
  //>>includeEnd('debug');

  const node = this._findNode(this._root, { width, height });
  if (!defined(node)) {
    return;
  }

  node.index = index;
  return node;
};

// A recursive function that finds the best place to insert
// a new image based on existing image 'nodes'.
// Inspired by: http://blackpawn.com/texts/lightmaps/default.html
TexturePacker.prototype._findNode = function (node, { width, height }) {
  if (!defined(node)) {
    return undefined;
  }

  // Leaf node
  if (!defined(node.childNode1) && !defined(node.childNode2)) {
    if (defined(node.index)) {
      // Node already contains an image: Skip it.
      return undefined;
    }

    const { rectangle } = node;

    const nodeWidth = rectangle.width;
    const nodeHeight = rectangle.height;
    const widthDifference = nodeWidth - width;
    const heightDifference = nodeHeight - height;

    // Node is smaller than the image.
    if (widthDifference < 0 || heightDifference < 0) {
      return undefined;
    }

    // If the node is the same size as the image, return the node
    if (widthDifference === 0 && heightDifference === 0) {
      return node;
    }

    const borderPadding = this._borderPadding;

    // Vertical split (childNode1 = left half, childNode2 = right half).
    if (widthDifference > heightDifference) {
      node.childNode1 = new TextureNode({
        x: rectangle.x,
        y: rectangle.y,
        width,
        height: nodeHeight,
      });

      // Apply padding only along the vertical "cut".
      const widthDifferencePadded = widthDifference - borderPadding;

      if (widthDifferencePadded > 0) {
        node.childNode2 = new TextureNode({
          x: rectangle.x + width + borderPadding,
          y: rectangle.y,
          width: widthDifferencePadded,
          height: nodeHeight,
        });
      }

      return this._findNode(node.childNode1, { width, height });
    }

    // Horizontal split (childNode1 = bottom half, childNode2 = top half).
    node.childNode1 = new TextureNode({
      x: rectangle.x,
      y: rectangle.y,
      width: nodeWidth,
      height,
    });

    // Apply padding only along the horizontal "cut".
    const heightDifferencePadded = heightDifference - borderPadding;

    if (heightDifferencePadded > 0) {
      node.childNode2 = new TextureNode({
        x: rectangle.x,
        y: rectangle.y + height + borderPadding,
        width: nodeWidth,
        height: heightDifferencePadded,
      });
    }

    return this._findNode(node.childNode1, { width, height });
  }

  // If not a leaf node
  return (
    this._findNode(node.childNode1, { width, height }) ||
    this._findNode(node.childNode2, { width, height })
  );
};

export default TexturePacker;
