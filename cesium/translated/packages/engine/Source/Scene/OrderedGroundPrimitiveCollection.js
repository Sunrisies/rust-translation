import { Check, defined, destroyObject } from "@cesium/core";
import PrimitiveCollection from "./PrimitiveCollection.js";

/**
 * 用于根据 z-index 保持顺序或管理地面控件的基本集合。
 *
 * @private
 */
function OrderedGroundPrimitiveCollection() {
  this._length = 0;
  this._collections = {};
  this._collectionsArray = [];

  this.show = true;
}

Object.defineProperties(OrderedGroundPrimitiveCollection.prototype, {
  /**
   * 获取集合中的控件数量。
   *
   * @memberof OrderedGroundPrimitiveCollection.prototype
   *
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._length;
    },
  },
});

/**
 * 将控件添加到集合中。
 *
 * @param {GroundPrimitive} primitive 要添加的控件。
 * @param {number} [zIndex = 0] 控件的索引。
 * @returns {GroundPrimitive} The 已添加到集合中的控件。
 */
OrderedGroundPrimitiveCollection.prototype.add = function (primitive, zIndex) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("primitive", primitive);
  if (defined(zIndex)) {
    Check.typeOf.number("zIndex", zIndex);
  }
  //>>includeEnd('debug');

  zIndex = zIndex ?? 0;
  let collection = this._collections[zIndex];
  if (!defined(collection)) {
    collection = new PrimitiveCollection({ destroyPrimitives: false });
    collection._zIndex = zIndex;
    this._collections[zIndex] = collection;
    const array = this._collectionsArray;
    let i = 0;
    while (i < array.length && array[i]._zIndex < zIndex) {
      i++;
    }
    array.splice(i, 0, collection);
  }

  collection.add(primitive);
  this._length++;
  primitive._zIndex = zIndex;

  return primitive;
};

/**
 * 调整 z-index 值。
 * @param {GroundPrimitive} primitive
 * @param {number} zIndex
 */
OrderedGroundPrimitiveCollection.prototype.set = function (primitive, zIndex) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("primitive", primitive);
  Check.typeOf.number("zIndex", zIndex);
  //>>includeEnd('debug');

  if (zIndex === primitive._zIndex) {
    return primitive;
  }

  this.remove(primitive, true);
  this.add(primitive, zIndex);

  return primitive;
};

/**
 * 从集合中移除控件。
 *
 * @param {object} primitive 要移除的控件。
 * @param {boolean} [doNotDestroy = false]
 * @returns {boolean} <code>true</code> 如果控件被移除；如果控件为 <code>undefined</code> 或未在集合中找到，则返回 <code>false</code>。
 */
OrderedGroundPrimitiveCollection.prototype.remove = function (
  primitive,
  doNotDestroy,
) {
  if (this.contains(primitive)) {
    const index = primitive._zIndex;
    const collection = this._collections[index];
    let result;
    if (doNotDestroy) {
      result = collection.remove(primitive);
    } else {
      result = collection.removeAndDestroy(primitive);
    }

    if (result) {
      this._length--;
    }

    if (collection.length === 0) {
      this._collectionsArray.splice(
        this._collectionsArray.indexOf(collection),
        1,
      );
      this._collections[index] = undefined;
      collection.destroy();
    }

    return result;
  }

  return false;
};

/**
 * 移除集合中的所有控件。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see OrderedGroundPrimitiveCollection#destroyPrimitives
 */
OrderedGroundPrimitiveCollection.prototype.removeAll = function () {
  const collections = this._collectionsArray;
  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i];
    collection.destroyPrimitives = true;
    collection.destroy();
  }

  this._collections = {};
  this._collectionsArray = [];
  this._length = 0;
};

/**
 * 判断此集合是否包含控件。
 *
 * @param {object} primitive 要检查的控件。
 * @returns {boolean} <code>true</code> 如果控件在集合中；如果控件为 <code>undefined</code> 或未在集合中找到，则返回 <code>false</code>。
 */
OrderedGroundPrimitiveCollection.prototype.contains = function (primitive) {
  if (!defined(primitive)) {
    return false;
  }
  const collection = this._collections[primitive._zIndex];
  return defined(collection) && collection.contains(primitive);
};

/**
 * @private
 */
OrderedGroundPrimitiveCollection.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  const collections = this._collectionsArray;
  for (let i = 0; i < collections.length; i++) {
    collections[i].update(frameState);
  }
};

/**
 * 如果此对象被销毁，返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除 <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 * 如果此对象被销毁；否则返回 false。
 *
 * @returns {boolean} True 销毁此集合中包含的每个控件的 WebGL 资源。明确销毁此集合允许确定性地释放 WebGL 资源，而不是依赖垃圾收集器来销毁该集合。
 *
 * @see OrderedGroundPrimitiveCollection#destroy
 */
OrderedGroundPrimitiveCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此集合中每个控件所持有的 WebGL 资源。明确销毁此集合允许确定性地释放 WebGL 资源，而不是依赖垃圾收集器来销毁该集合。
 * 由于销毁集合会销毁所有包含的控件，因此只有在确保没有其他代码仍使用这些控件时，才应销毁此集合。
 * 一旦此集合被销毁，不应使用它；调用除 <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * <br /><br />
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * 对象被销毁，即调用了 destroy() 方法。
 * <br /><br />
 * 控件 = 控件 && 控件.destroy();
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * assign the return value (<code>undefined</code>) to the object as done in the example.
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 *
 * @example
 * primitives = primitives && primitives.destroy();
 *
 * @see OrderedGroundPrimitiveCollection#isDestroyed
 */
OrderedGroundPrimitiveCollection.prototype.destroy = function () {
  this.removeAll();
  return destroyObject(this);
};
export default OrderedGroundPrimitiveCollection;
