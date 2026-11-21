import {
  DeveloperError,
  Event,
  Frozen,
  createGuid,
  defined,
  destroyObject,
} from "@cesium/core";

/**
 * 一组基本元素。通常与 {@link Scene#primitives} 一起使用。
 * 但 <code>PrimitiveCollection</code> 本身也是一种基本元素，因此集合可以
 * 被添加到构成层次结构的集合中。
 *
 * @alias PrimitiveCollection
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.show=true] 决定集合中的基本元素是否会被显示。
 * @param {boolean} [options.destroyPrimitives=true] 决定集合中的基本元素在移除时是否会被破坏。
 * @privateParam {boolean} [options.countReferences=false] 指定从该集合中添加和移除基本元素是否会改变其引用计数。如果是，向该集合添加
 * 一个基本元素会增加其引用计数。移除该基本元素会减少其引用计数，如果计数达到零 **并且** destroyPrimitives 为 true，则会破坏该基本元素。
 * 这允许基本元素在多个集合之间共享。
 *
 * @example
 * const billboards = new Cesium.BillboardCollection();
 * const labels = new Cesium.LabelCollection();
 *
 * const collection = new Cesium.PrimitiveCollection();
 * collection.add(billboards);
 *
 * scene.primitives.add(collection);  // 添加集合
 * scene.primitives.add(labels);      // 添加常规基本元素
 */
function PrimitiveCollection(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._primitives = [];
  this._guid = createGuid();
  this._primitiveAdded = new Event();
  this._primitiveRemoved = new Event();

  // Used by the OrderedGroundPrimitiveCollection
  this._zIndex = undefined;

  /**
   * 决定该集合中的基本元素是否会被显示。
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  /**
   * 决定集合中的基本元素在通过
   * {@link PrimitiveCollection#destroy}、 {@link PrimitiveCollection#remove} 或隐式地
   * 通过 {@link PrimitiveCollection#removeAll} 移除时是否会被破坏。
   *
   * @type {boolean}
   * @default true
   *
   * @example
   * // 示例 1。默认情况下基本元素会被破坏。
   * const primitives = new Cesium.PrimitiveCollection();
   * const labels = primitives.add(new Cesium.LabelCollection());
   * primitives = primitives.destroy();
   * const b = labels.isDestroyed(); // true
   *
   * @example
   * // 示例 2。不要在集合中破坏基本元素。
   * const primitives = new Cesium.PrimitiveCollection();
   * primitives.destroyPrimitives = false;
   * const labels = primitives.add(new Cesium.LabelCollection());
   * primitives = primitives.destroy();
   * const b = labels.isDestroyed(); // false
   * labels = labels.destroy();    // 显式破坏
   */
  this.destroyPrimitives = options.destroyPrimitives ?? true;

  this._countReferences = options.countReferences ?? false;
}

Object.defineProperties(PrimitiveCollection.prototype, {
  /**
   * 获取集合中的基本元素数量。
   *
   * @memberof PrimitiveCollection.prototype
   *
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._primitives.length;
    },
  },

  /**
   * 当基本元素被添加到集合时引发的事件。
   * 事件处理程序会接收被添加的基本元素。
   * @memberof PrimitiveCollection.prototype
   * @type {Event}
   * @readonly
   */
  primitiveAdded: {
    get: function () {
      return this._primitiveAdded;
    },
  },

  /**
   * 当基本元素从集合中被移除时引发的事件。
   * 事件处理程序会接收被移除的基本元素。
   * <p>
   * 注意：根据 destroyPrimitives 构造函数选项，基本元素可能已经被破坏。
   * </p>
   * @memberof PrimitiveCollection.prototype
   * @type {Event}
   * @readonly
   */
  primitiveRemoved: {
    get: function () {
      return this._primitiveRemoved;
    },
  },
});

/**
 * 向集合中添加一个原始对象。
 *
 * @template T
 * @param {T} primitive 要添加的原始对象。
 * @param {number} [index] 要添加图层的索引。如果省略，该原始对象将添加到所有现有原始对象的底部。
 * @returns {T} The 已添加到集合中的原始对象。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @example
 * const billboards = scene.primitives.add(new Cesium.BillboardCollection());
 */
PrimitiveCollection.prototype.add = function (primitive, index) {
  const hasIndex = defined(index);

  //>>includeStart('debug', pragmas.debug);
  if (!defined(primitive)) {
    throw new DeveloperError("primitive is required.");
  }
  if (hasIndex) {
    if (index < 0) {
      throw new DeveloperError("index must be greater than or equal to zero.");
    } else if (index > this._primitives.length) {
      throw new DeveloperError(
        "index must be less than or equal to the number of primitives.",
      );
    }
  }
  //>>includeEnd('debug');

  const external = (primitive._external = primitive._external || {});
  const composites = (external._composites = external._composites || {});
  composites[this._guid] = {
    collection: this,
  };

  if (!hasIndex) {
    this._primitives.push(primitive);
  } else {
    this._primitives.splice(index, 0, primitive);
  }

  if (this._countReferences) {
    if (!defined(external._referenceCount)) {
      external._referenceCount = 1;
    } else {
      ++external._referenceCount;
    }
  }

  this._primitiveAdded.raiseEvent(primitive);

  return primitive;
};

/**
 * 从集合中移除一个原始对象。
 *
 * @param {object} [primitive] 要移除的原始对象。
 * @returns {boolean} <code>true</code> 如果原始对象被移除；如果原始对象为 undefined 或在集合中未找到，则返回 <code>false</code>。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * const billboards = scene.primitives.add(new Cesium.BillboardCollection());
 * scene.primitives.remove(billboards);  // 返回 true
 *
 * @see PrimitiveCollection#destroyPrimitives
 */
PrimitiveCollection.prototype.remove = function (primitive) {
  // PERFORMANCE_IDEA:  We can obviously make this a lot faster.
  if (this.contains(primitive)) {
    const index = this._primitives.indexOf(primitive);
    if (index !== -1) {
      this._primitives.splice(index, 1);

      delete primitive._external._composites[this._guid];
      if (this._countReferences) {
        primitive._external._referenceCount--;
      }

      if (
        this.destroyPrimitives &&
        (!this._countReferences || primitive._external._referenceCount <= 0)
      ) {
        primitive.destroy();
      }

      this._primitiveRemoved.raiseEvent(primitive);

      return true;
    }
    // else ... this is not possible, I swear.
  }

  return false;
};

/**
 * 移除并销毁一个原始对象，与 destroyPrimitives 或 countReferences 设置无关。
 * @private
 */
PrimitiveCollection.prototype.removeAndDestroy = function (primitive) {
  const removed = this.remove(primitive);
  if (removed && !this.destroyPrimitives) {
    primitive.destroy();
  }
  return removed;
};

/**
 * 移除集合中的所有原始对象。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see PrimitiveCollection#destroyPrimitives
 */
PrimitiveCollection.prototype.removeAll = function () {
  const primitives = this._primitives;
  const length = primitives.length;
  for (let i = 0; i < length; ++i) {
    const primitive = primitives[i];
    delete primitive._external._composites[this._guid];
    if (this._countReferences) {
      primitive._external._referenceCount--;
    }

    if (
      this.destroyPrimitives &&
      (!this._countReferences || primitive._external._referenceCount <= 0)
    ) {
      primitive.destroy();
    }

    this._primitiveRemoved.raiseEvent(primitive);
  }
  this._primitives = [];
};

/**
 * 判断此集合是否包含一个原始对象。
 *
 * @param {object} [primitive] 要检查的原始对象。
 * @returns {boolean} <code>true</code> 如果原始对象在集合中；如果原始对象为 undefined 或在集合中未找到，则返回 <code>false</code>。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see PrimitiveCollection#get
 */
PrimitiveCollection.prototype.contains = function (primitive) {
  return !!(
    defined(primitive) &&
    primitive._external &&
    primitive._external._composites &&
    primitive._external._composites[this._guid]
  );
};

function getPrimitiveIndex(compositePrimitive, primitive) {
  //>>includeStart('debug', pragmas.debug);
  if (!compositePrimitive.contains(primitive)) {
    throw new DeveloperError("primitive is not in this collection.");
  }
  //>>includeEnd('debug');

  return compositePrimitive._primitives.indexOf(primitive);
}

/**
 * 将原始对象在集合中“向上移动”一个位置。如果集合中的所有原始对象都在地球表面绘制，
 * 则视觉上会看到该原始对象向上移动一个位置。
 *
 * @param {object} [primitive] 要提升的原始对象。
 *
 * @exception {DeveloperError} primitive 不在此集合中。
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see PrimitiveCollection#raiseToTop
 * @see PrimitiveCollection#lower
 * @see PrimitiveCollection#lowerToBottom
 */
PrimitiveCollection.prototype.raise = function (primitive) {
  if (defined(primitive)) {
    const index = getPrimitiveIndex(this, primitive);
    const primitives = this._primitives;

    if (index !== primitives.length - 1) {
      const p = primitives[index];
      primitives[index] = primitives[index + 1];
      primitives[index + 1] = p;
    }
  }
};

/**
 * 将原始对象提升到集合的“顶部”。如果集合中的所有原始对象都在地球表面绘制，
 * 则视觉上会看到该原始对象移动到顶部。
 *
 * @param {object} [primitive] 要提升至顶部的原始对象。
 *
 * @exception {DeveloperError} primitive 不在此集合中。
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see PrimitiveCollection#raise
 * @see PrimitiveCollection#lower
 * @see PrimitiveCollection#lowerToBottom
 */
PrimitiveCollection.prototype.raiseToTop = function (primitive) {
  if (defined(primitive)) {
    const index = getPrimitiveIndex(this, primitive);
    const primitives = this._primitives;

    if (index !== primitives.length - 1) {
      // PERFORMANCE_IDEA:  Could be faster
      primitives.splice(index, 1);
      primitives.push(primitive);
    }
  }
};

/**
 * 将原始对象在集合中“向下移动”一个位置。如果集合中的所有原始对象都在地球表面绘制，
 * 则视觉上会看到该原始对象向下移动一个位置。
 *
 * @param {object} [primitive] 要降低的原始对象。
 *
 * @exception {DeveloperError} primitive 不在此集合中。
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see PrimitiveCollection#lowerToBottom
 * @see PrimitiveCollection#raise
 * @see PrimitiveCollection#raiseToTop
 */
PrimitiveCollection.prototype.lower = function (primitive) {
  if (defined(primitive)) {
    const index = getPrimitiveIndex(this, primitive);
    const primitives = this._primitives;

    if (index !== 0) {
      const p = primitives[index];
      primitives[index] = primitives[index - 1];
      primitives[index - 1] = p;
    }
  }
};

/**
 * 将原始对象降低至集合的“底部”。如果集合中的所有原始对象都在地球表面绘制，
 * 则视觉上会看到该原始对象移动到底部。
 *
 * @param {object} [primitive] 要降低至底部的原始对象。
 *
 * @exception {DeveloperError} primitive 不在此集合中。
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see PrimitiveCollection#lower
 * @see PrimitiveCollection#raise
 * @see PrimitiveCollection#raiseToTop
 */
PrimitiveCollection.prototype.lowerToBottom = function (primitive) {
  if (defined(primitive)) {
    const index = getPrimitiveIndex(this, primitive);
    const primitives = this._primitives;

    if (index !== 0) {
      // PERFORMANCE_IDEA:  Could be faster
      primitives.splice(index, 1);
      primitives.unshift(primitive);
    }
  }
};

/**
 * 返回集合中指定索引处的原始对象。
 *
 * @param {number} index 返回原始对象的零基索引。
 * @returns {object} The <code>index</code> 处的原始对象。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * // 切换集合中所有原始对象的显示属性。
 * const primitives = scene.primitives;
 * const length = primitives.length;
 * for (let i = 0; i < length; ++i) {
 * const p = primitives.get(i);
 * p.show = !p.show;
 * }
 *
 * @see PrimitiveCollection#length
 */
PrimitiveCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index)) {
    throw new DeveloperError("index is required.");
  }
  //>>includeEnd('debug');

  return this._primitives[index];
};

/**
 * @private
 */
PrimitiveCollection.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  const primitives = this._primitives;
  // Using primitives.length in the loop is a temporary workaround
  // to allow quadtree updates to add and remove primitives in
  // update().  This will be changed to manage added and removed lists.
  for (let i = 0; i < primitives.length; ++i) {
    primitives[i].update(frameState);
  }
};

/**
 * @private
 */
PrimitiveCollection.prototype.prePassesUpdate = function (frameState) {
  const primitives = this._primitives;
  // Using primitives.length in the loop is a temporary workaround
  // to allow quadtree updates to add and remove primitives in
  // update().  This will be changed to manage added and removed lists.
  for (let i = 0; i < primitives.length; ++i) {
    const primitive = primitives[i];
    if (defined(primitive.prePassesUpdate)) {
      primitive.prePassesUpdate(frameState);
    }
  }
};

/**
 * @private
 */
PrimitiveCollection.prototype.updateForPass = function (frameState, passState) {
  const primitives = this._primitives;
  // Using primitives.length in the loop is a temporary workaround
  // to allow quadtree updates to add and remove primitives in
  // update().  This will be changed to manage added and removed lists.
  for (let i = 0; i < primitives.length; ++i) {
    const primitive = primitives[i];
    if (defined(primitive.updateForPass)) {
      primitive.updateForPass(frameState, passState);
    }
  }
};

/**
 * @private
 */
PrimitiveCollection.prototype.postPassesUpdate = function (frameState) {
  const primitives = this._primitives;
  // Using primitives.length in the loop is a temporary workaround
  // to allow quadtree updates to add and remove primitives in
  // update().  This will be changed to manage added and removed lists.
  for (let i = 0; i < primitives.length; ++i) {
    const primitive = primitives[i];
    if (defined(primitive.postPassesUpdate)) {
      primitive.postPassesUpdate(frameState);
    }
  }
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} True 如果此对象被销毁，则不应使用它；否则返回 false。
 *
 * @see PrimitiveCollection#destroy
 */
PrimitiveCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁该集合中所有原始对象所持有的 WebGL 资源。明确销毁此集合允许
 * WebGL 资源被确定性释放，而不是依赖垃圾收集器来销毁该集合。
 * 来销毁此集合。
 * <br /><br />
 * 由于销毁集合会销毁所有包含的原始对象，因此只有在确保没有其他代码仍使用这些原始对象时，才应销毁集合。
 * 一旦该集合被销毁，则不应使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * 对象被销毁，即调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 *
 * @example
 * primitives = primitives && primitives.destroy();
 *
 * @see PrimitiveCollection#isDestroyed
 */
PrimitiveCollection.prototype.destroy = function () {
  this.removeAll();
  return destroyObject(this);
};
export default PrimitiveCollection;