import { Check, defined } from "@cesium/core";
import BillboardLoadState from "./BillboardLoadState.js";

/**
 * 跟踪图像的引用及其加载状态，该状态在 BillboardCollection 中使用，并存储在纹理图集里。
 * @constructor
 * @private
 * @see BillboardCollection
 * @see Billboard#image
 * @alias BillboardTexture
 * @param {BillboardCollection} billboardCollection 相关的广告牌集合。
 */
function BillboardTexture(billboardCollection) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("billboardCollection", billboardCollection);
  //>>includeEnd('debug');

  this._billboardCollection = billboardCollection;

  this._id = undefined;
  this._loadState = BillboardLoadState.NONE;
  this._loadError = undefined;

  this._index = -1;
  this._width = undefined;
  this._height = undefined;

  this._hasSubregion = false;

  /**
   * 由 BillboardCollection 使用以跟踪需要更新的广告牌。
   * @type {boolean}
   * @private
   */
  this.dirty = false;
}

Object.defineProperties(BillboardTexture.prototype, {
  /**
   * 如果定义了此属性，则在此加载过程中遇到了错误。
   * @memberof BillboardTexture.prototype
   * @type {Error|undefined}
   * @readonly
   * @private
   */
  loadError: {
    get: function () {
      return this._loadError;
    },
  },

  /**
   * 图像加载的当前状态。当为 <code>BillboardLoadState.LOADED</code> 时，该广告牌已准备好渲染，即图像
   * 已下载完成，WebGL 资源也已创建。
   * @memberof BillboardTexture.prototype
   * @type {BillboardLoadState}
   * @readonly
   * @default BillboardLoadState.NONE
   * @private
   */
  loadState: {
    get: function () {
      return this._loadState;
    },
  },

  /**
   * 当为 <code>true</code> 时，此纹理已准备好渲染，即图像
   * 已下载完成，WebGL 资源也已创建。
   * @memberof BillboardTexture.prototype
   * @type {boolean}
   * @readonly
   * @default false
   * @private
   */
  ready: {
    get: function () {
      return this._loadState === BillboardLoadState.LOADED;
    },
  },

  /**
   * 如果此实例关联有图像数据，则返回 <code>true</code>。
   * @memberof BillboardTexture.prototype
   * @type {boolean}
   * @readonly
   * @private
   */
  hasImage: {
    get: function () {
      return this._loadState !== BillboardLoadState.NONE;
    },
  },

  /**
   * 图像的唯一标识符，如果没有关联图像数据，则定义为未定义。
   * @memberof BillboardTexture.prototype
   * @type {string|undefined}
   * @readonly
   * @private
   */
  id: {
    get: function () {
      return this._id;
    },
  },

  /**
   * 关联图像的宽度。在实例为 <code>ready</code> 之前，该值将为 <code>undefined</code>。
   * @memberof BillboardTexture.prototype
   * @type {number|undefined}
   * @readonly
   * @private
   */
  width: {
    get: function () {
      return this._width;
    },
  },

  /**
   * 关联图像的高度。在实例为 <code>ready</code> 之前，该值将为 <code>undefined</code>。
   * @memberof BillboardTexture.prototype
   * @type {number|undefined}
   * @readonly
   * @private
   */
  height: {
    get: function () {
      return this._height;
    },
  },
});

/**
 * 释放对任何关联图像数据的引用。
 * @private
 */
BillboardTexture.prototype.unload = async function () {
  if (this._loadState === BillboardLoadState.NONE) {
    return;
  }

  this._id = undefined;
  this._loadError = undefined;
  this._loadState = BillboardLoadState.NONE;

  this._index = -1;
  this._width = undefined;
  this._height = undefined;

  this.dirty = true;
};

/**
 * 开始将图像加载到纹理图集中。
 * @see {TextureAtlas#addImage}
 * @private
 * @param {string} id 用于检测图像是否已存在于图集中的标识符。
 * @param {HTMLImageElement|HTMLCanvasElement|string|Resource|Promise|TextureAtlas.CreateImageCallback} image 要添加到纹理图集中的图像或画布，
 * 或指向 Image 的 URL、针对图像的 Promise，或创建图像的函数。
 * @param {number} width 指定纹理宽度的数字。如果未定义，则使用图像宽度。
 * @param {number} height 指定纹理高度的数字。如果未定义，则使用图像高度。
 */
BillboardTexture.prototype.loadImage = async function (
  id,
  image,
  width,
  height,
) {
  if (this._id === id) {
    // This image has already been loaded
    return;
  }

  const collection = this._billboardCollection;
  const cache = collection.billboardTextureCache;
  let billboardTexture = cache.get(id);
  if (
    (defined(billboardTexture) &&
      image.loadState === BillboardLoadState.LOADING) ||
    image.loadState === BillboardLoadState.LOADED
  ) {
    // Use the cached texture if it is in progress or successful.
    BillboardTexture.clone(billboardTexture, this);
    return;
  }
  // Otherwise, load if not yet assigned an image, and try the load again if anything failed during the last billboard creation
  if (!defined(billboardTexture)) {
    billboardTexture = new BillboardTexture(collection);
    cache.set(id, billboardTexture);
  }

  billboardTexture._id = this._id = id;
  billboardTexture._loadState = this._loadState = BillboardLoadState.LOADING;
  billboardTexture._loadError = this._loadError = undefined;

  let index;
  const atlas = this._billboardCollection.textureAtlas;
  try {
    const indexOrPromise = atlas.addImage(id, image, width, height);
    if (typeof indexOrPromise === "number") {
      index = indexOrPromise;
    } else {
      index = await indexOrPromise;
    }
  } catch (error) {
    // There was an error loading the image
    billboardTexture._loadState = BillboardLoadState.ERROR;
    billboardTexture._loadError = error;

    if (this._id !== id) {
      // Another load was initiated and resolved resolved before this one. This operation is cancelled.
      return;
    }

    this._loadState = BillboardLoadState.ERROR;
    this._loadError = error;
    return;
  }

  if (!defined(index) || index === -1) {
    // Resources destroyed or otherwise
    billboardTexture._loadState = BillboardLoadState.FAILED;
    billboardTexture._index = -1;

    if (this._id !== id) {
      // Another load was initiated and resolved resolved before this one. This operation is cancelled.
      return;
    }

    this._loadState = BillboardLoadState.FAILED;
    this._index = -1;

    return;
  }

  billboardTexture._index = index;
  billboardTexture._loadState = BillboardLoadState.LOADED;

  const rectangle = atlas.rectangles[index];
  billboardTexture._width = rectangle.width;
  billboardTexture._height = rectangle.height;

  if (this._id !== id) {
    // Another load was initiated and resolved resolved before this one. This operation is cancelled.
    return;
  }

  this._index = index;
  this._loadState = BillboardLoadState.LOADED;
  this._width = rectangle.width;
  this._height = rectangle.height;

  this.dirty = true;
};

/**
 * 跟踪现有图像子区域的引用。
 * @see {TextureAtlas#addImageSubRegion}
 * @private
 * @param {string} id 用于检测图像是否已存在于图集中的标识符。
 * @param {BoundingRectangle} subRegion 定义现有图像区域的 {@link BoundingRectangle}，以图像左下角的像素为单位测量。
 */
BillboardTexture.prototype.addImageSubRegion = function (id, subRegion) {
  this._id = id;
  this._loadError = undefined;
  this._hasSubregion = true;

  const atlas = this._billboardCollection.textureAtlas;
  const indexOrPromise = atlas.addImageSubRegion(id, subRegion);

  if (typeof indexOrPromise === "number") {
    this.setImageSubRegion(indexOrPromise, subRegion);
    return;
  }

  this.loadImageSubRegion(id, subRegion, indexOrPromise);
};

/**
 * @see {TextureAtlas#addImageSubRegion}
 * @private
 * @param {string} id 用于检测图像是否已存在于图集中的标识符。
 * @param {BoundingRectangle} subRegion 定义现有图像区域的 {@link BoundingRectangle}，以图像左下角的像素为单位测量。
 * @param {Promise<number>} indexPromise 解析为图像区域索引的 Promise。
 */
BillboardTexture.prototype.loadImageSubRegion = async function (
  id,
  subRegion,
  indexPromise,
) {
  let index;
  try {
    this._loadState = BillboardLoadState.LOADING;
    index = await indexPromise;
  } catch (error) {
    // There was an error loading the referenced image
    this._loadState = BillboardLoadState.ERROR;
    this._loadError = error;
    return;
  }

  if (this._id !== id) {
    // Another load was initiated and resolved resolved before this one. This operation is cancelled.
    return;
  }

  this._loadState = BillboardLoadState.LOADED;

  this.setImageSubRegion(index, subRegion);
};

/**
 * @see {TextureAtlas#addImageSubRegion}
 * @private
 * @param {number} index 在 {@link TextureAtlas} 中解析后的索引。
 * @param {BoundingRectangle} subRegion 定义现有图像区域的 {@link BoundingRectangle}，以图像左下角的像素为单位测量。
 */
BillboardTexture.prototype.setImageSubRegion = function (index, subRegion) {
  if (this._index === index) {
    return;
  }

  if (!defined(index) || index === -1) {
    this._loadState = BillboardLoadState.FAILED;
    this._index = -1;
    this._width = undefined;
    this._height = undefined;
    return;
  }

  this._width = subRegion.width;
  this._height = subRegion.height;

  this._index = index;

  this.dirty = true;
};

/**
 * 获取在着色器中读取已加载纹理的纹理坐标。
 * @private
 * @param {BoundingRectangle} [result] 修改后的结果参数，或一个新的 BoundingRectangle 实例（如果未提供）。
 * @return {BoundingRectangle} The 修改后的结果参数，或一个新的 BoundingRectangle 实例（如果未提供）。
 */
BillboardTexture.prototype.computeTextureCoordinates = function (result) {
  const atlas = this._billboardCollection.textureAtlas;
  return atlas.computeTextureCoordinates(this._index, result);
};

/**
 * 将现有的广告牌纹理及其所有飞行跟踪信息克隆到目标广告牌纹理中。
 * @param {BillboardTexture} billboardTexture
 * @param {BillboardTexture} target
 * @returns {BillboardTexture} target
 */
BillboardTexture.clone = function (billboardTexture, target) {
  target._id = billboardTexture._id;
  target._loadState = billboardTexture._loadState;
  target._loadError = undefined;
  target._index = billboardTexture._index;
  target._width = billboardTexture._width;
  target._height = billboardTexture._height;
  target._hasSubregion = billboardTexture._hasSubregion;

  if (billboardTexture.ready) {
    target.dirty = true;
    return;
  }

  const completeLoad = async () => {
    const id = billboardTexture._id;
    const atlas = billboardTexture._billboardCollection.textureAtlas;
    await atlas._indexPromiseById.get(id);

    // Any errors should have already been handled
    if (target._id !== id) {
      // Another load was initiated and resolved resolved before this one. This operation is cancelled.
      return;
    }

    if (billboardTexture._hasSubregion) {
      // Subregions must wait an additional frame to be ready
      await Promise.resolve();
    }

    target._id = id;
    target._loadState = billboardTexture._loadState;
    target._loadError = billboardTexture._loadError;
    target._index = billboardTexture._index;
    target._width = billboardTexture._width;
    target._height = billboardTexture._height;
    target.dirty = true;
  };

  completeLoad();
  return target;
};

export default BillboardTexture;
