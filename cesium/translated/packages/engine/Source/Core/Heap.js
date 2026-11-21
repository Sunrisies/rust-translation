import { Check, defined } from "@cesium/core";

/**
 * 堆的数组实现。
 *
 * @alias Heap
 * @constructor
 * @private
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Heap.ComparatorCallback} options.comparator 用于堆的比较器。如果 comparator(a, b) 小于 0，则将 a 排序到比 b 更低的索引；否则将 a 排序到更高的索引。
 */
function Heap(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options", options);
  Check.defined("options.comparator", options.comparator);
  //>>includeEnd('debug');

  this._comparator = options.comparator;
  this._array = [];
  this._length = 0;
  this._maximumLength = undefined;
}

Object.defineProperties(Heap.prototype, {
  /**
   * 获取堆的长度。
   *
   * @memberof Heap.prototype
   *
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._length;
    },
  },

  /**
   * 获取内部数组。
   *
   * @memberof Heap.prototype
   *
   * @type {Array}
   * @readonly
   */
  internalArray: {
    get: function () {
      return this._array;
    },
  },

  /**
   * 获取并设置堆的最大长度。
   *
   * @memberof Heap.prototype
   *
   * @type {number}
   */
  maximumLength: {
    get: function () {
      return this._maximumLength;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThanOrEquals("maximumLength", value, 0);
      //>>includeEnd('debug');
      const originalLength = this._length;
      if (value < originalLength) {
        const array = this._array;
        // Remove trailing references
        for (let i = value; i < originalLength; ++i) {
          array[i] = undefined;
        }
        this._length = value;
        array.length = value;
      }
      this._maximumLength = value;
    },
  },

  /**
   * 用于堆的比较器。如果 comparator(a, b) 小于 0，则将 a 排序到比 b 更低的索引；否则将 a 排序到更高的索引。
   *
   * @memberof Heap.prototype
   *
   * @type {Heap.ComparatorCallback}
   */
  comparator: {
    get: function () {
      return this._comparator;
    },
  },
});

function swap(array, a, b) {
  const temp = array[a];
  array[a] = array[b];
  array[b] = temp;
}

/**
 * 调整堆的内部数组大小。
 *
 * @param {number} [length] 调整内部数组的大小。默认为当前堆的长度。
 */
Heap.prototype.reserve = function (length) {
  length = length ?? this._length;
  this._array.length = length;
};

/**
 * 更新堆，使索引及其所有后代满足堆性质。
 *
 * @param {number} [index=0] 开始整序化的起始索引。
 */
Heap.prototype.heapify = function (index) {
  index = index ?? 0;
  const length = this._length;
  const comparator = this._comparator;
  const array = this._array;
  let candidate;
  let inserting = true;

  while (inserting) {
    const right = 2 * (index + 1);
    const left = right - 1;

    if (left < length && comparator(array[left], array[index]) < 0) {
      candidate = left;
    } else {
      candidate = index;
    }

    if (right < length && comparator(array[right], array[candidate]) < 0) {
      candidate = right;
    }
    if (candidate !== index) {
      swap(array, candidate, index);
      index = candidate;
    } else {
      inserting = false;
    }
  }
};

/**
 * 重新排序堆。
 */
Heap.prototype.resort = function () {
  const length = this._length;
  for (let i = Math.ceil(length / 2); i >= 0; --i) {
    this.heapify(i);
  }
};

/**
 * 将元素插入堆中。如果长度增长超过堆的最大长度
 * 则移除多余的元素。
 *
 * @param {*} element 要插入的元素。
 *
 * @return {*} The 当堆达到最大容量时从堆中移除的元素。
 */
Heap.prototype.insert = function (element) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("element", element);
  //>>includeEnd('debug');

  const array = this._array;
  const comparator = this._comparator;
  const maximumLength = this._maximumLength;

  let index = this._length++;
  if (index < array.length) {
    array[index] = element;
  } else {
    array.push(element);
  }

  while (index !== 0) {
    const parent = Math.floor((index - 1) / 2);
    if (comparator(array[index], array[parent]) < 0) {
      swap(array, index, parent);
      index = parent;
    } else {
      break;
    }
  }

  let removedElement;

  if (defined(maximumLength) && this._length > maximumLength) {
    removedElement = array[maximumLength];
    array[maximumLength] = undefined; // Remove trailing reference
    this._length = maximumLength;
  }

  return removedElement;
};

/**
 * 从堆中移除指定索引的元素并返回该元素。
 *
 * @param {number} [index=0] 要移除的索引。
 * @returns {*} The 堆中指定的元素。
 */
Heap.prototype.pop = function (index) {
  index = index ?? 0;
  if (this._length === 0) {
    return undefined;
  }
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.lessThan("index", index, this._length);
  //>>includeEnd('debug');

  const array = this._array;
  const root = array[index];
  swap(array, index, --this._length);
  this.heapify(index);
  array[this._length] = undefined; // Remove trailing reference
  return root;
};

/**
 * 用于堆的比较器。
 * @callback Heap.ComparatorCallback
 * @param {*} a 堆中的一个元素。
 * @param {*} b 堆中的一个元素。
 * @returns {number} If 比较结果小于 0 时，将 a 排序到比 b 更低的索引；否则将 a 排序到更高的索引。
 */
export default Heap;
