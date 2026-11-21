import {
  DeveloperError,
  Event,
  Math as CesiumMath,
  defined,
  destroyObject,
} from "@cesium/core";

/**
 * 一个 {@link DataSource} 实例的集合。
 * @alias DataSourceCollection
 * @constructor
 */
function DataSourceCollection() {
  this._dataSources = [];
  this._dataSourceAdded = new Event();
  this._dataSourceRemoved = new Event();
  this._dataSourceMoved = new Event();
}

Object.defineProperties(DataSourceCollection.prototype, {
  /**
   * 获取该集合中的数据源数量。
   * @memberof DataSourceCollection.prototype
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._dataSources.length;
    },
  },

  /**
   * 当数据源被添加到集合中时引发的事件。
   * 事件处理器接收被添加的数据源。
   * @memberof DataSourceCollection.prototype
   * @type {Event}
   * @readonly
   */
  dataSourceAdded: {
    get: function () {
      return this._dataSourceAdded;
    },
  },

  /**
   * 当数据源从集合中移除时引发的事件。
   * 事件处理器接收被移除的数据源。
   * @memberof DataSourceCollection.prototype
   * @type {Event}
   * @readonly
   */
  dataSourceRemoved: {
    get: function () {
      return this._dataSourceRemoved;
    },
  },

  /**
   * 当数据源在集合中的位置发生变化时引发的事件。事件处理器接收被移动的数据源、其新的索引以及其旧索引。
   * 将数据源添加到集合中。
   * @memberof DataSourceCollection.prototype
   * @type {Event}
   * @readonly
   */
  dataSourceMoved: {
    get: function () {
      return this._dataSourceMoved;
    },
  },
});

/**
 * 将数据源或数据源的承诺添加到集合中。
 *
 * @param {DataSource|Promise<DataSource>} dataSource 传递承诺时，数据源实际上不会添加到集合中，直到承诺成功解析。
 * 承诺在数据源被添加到集合后解析。
 * 从集合中移除数据源（如果存在）。
 * @returns {Promise<DataSource>} A 要移除的数据源。
 */
DataSourceCollection.prototype.add = function (dataSource) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(dataSource)) {
    throw new DeveloperError("dataSource is required.");
  }
  //>>includeEnd('debug');

  const that = this;
  const dataSources = this._dataSources;
  return Promise.resolve(dataSource).then(function (value) {
    //Only add the data source if removeAll has not been called
    //Since it was added.
    if (dataSources === that._dataSources) {
      that._dataSources.push(value);
      that._dataSourceAdded.raiseEvent(that, value);
    }
    return value;
  });
};

/**
 * 是否除了移除外还销毁数据源。
 *
 * @param {DataSource} dataSource 被移除的数据源。
 * @param {boolean} [destroy=false] 如果数据源不在集合中，则是否销毁该数据源。
 * @returns {boolean} true 如果数据源在集合中且被移除，
 * 如果数据源不在集合中，则为 false。
 */
DataSourceCollection.prototype.remove = function (dataSource, destroy) {
  destroy = destroy ?? false;

  const index = this._dataSources.indexOf(dataSource);
  if (index !== -1) {
    this._dataSources.splice(index, 1);
    this._dataSourceRemoved.raiseEvent(this, dataSource);

    if (destroy && typeof dataSource.destroy === "function") {
      dataSource.destroy();
    }

    return true;
  }

  return false;
};

/**
 * 从集合中移除所有数据源。
 *
 * @param {boolean} [destroy=false] 是否除了移除外还销毁数据源。
 */
DataSourceCollection.prototype.removeAll = function (destroy) {
  destroy = destroy ?? false;

  const dataSources = this._dataSources;
  for (let i = 0, len = dataSources.length; i < len; ++i) {
    const dataSource = dataSources[i];
    this._dataSourceRemoved.raiseEvent(this, dataSource);

    if (destroy && typeof dataSource.destroy === "function") {
      dataSource.destroy();
    }
  }
  this._dataSources = [];
};

/**
 * 检查集合中是否包含给定的数据源。
 *
 * @param {DataSource} dataSource 要检查的数据源。
 * @returns {boolean} true 如果集合中包含该数据源，则为 true，否则为 false。
 */
DataSourceCollection.prototype.contains = function (dataSource) {
  return this.indexOf(dataSource) !== -1;
};

/**
 * 确定给定数据源在集合中的索引。
 *
 * @param {DataSource} dataSource 查找索引的数据源。
 * @returns {number} The 数据源在集合中的索引，如果不存在则为 -1。
 */
DataSourceCollection.prototype.indexOf = function (dataSource) {
  return this._dataSources.indexOf(dataSource);
};

/**
 * 按索引从集合中获取数据源。
 *
 * @param {number} index 要检索的索引。
 * @returns {DataSource} The 指定索引处的数据源。
 */
DataSourceCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index)) {
    throw new DeveloperError("index is required.");
  }
  //>>includeEnd('debug');

  return this._dataSources[index];
};

/**
 * 按名称从集合中获取数据源。
 *
 * @param {string} name 要检索的名称。
 * @returns {DataSource[]} A 与提供名称匹配的所有数据源的列表。
 */
DataSourceCollection.prototype.getByName = function (name) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(name)) {
    throw new DeveloperError("name is required.");
  }
  //>>includeEnd('debug');

  return this._dataSources.filter(function (dataSource) {
    return dataSource.name === name;
  });
};

function getIndex(dataSources, dataSource) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(dataSource)) {
    throw new DeveloperError("dataSource is required.");
  }
  //>>includeEnd('debug');

  const index = dataSources.indexOf(dataSource);

  //>>includeStart('debug', pragmas.debug);
  if (index === -1) {
    throw new DeveloperError("dataSource is not in this collection.");
  }
  //>>includeEnd('debug');

  return index;
}

function swapDataSources(collection, i, j) {
  const arr = collection._dataSources;
  const length = arr.length - 1;
  i = CesiumMath.clamp(i, 0, length);
  j = CesiumMath.clamp(j, 0, length);

  if (i === j) {
    return;
  }

  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;

  collection.dataSourceMoved.raiseEvent(temp, j, i);
}

/**
 * 将数据源在集合中的位置向上移动一位。
 *
 * @param {DataSource} dataSource 要移动的数据源。
 *
 * @exception {DeveloperError} dataSource 不在该集合中。
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 */
DataSourceCollection.prototype.raise = function (dataSource) {
  const index = getIndex(this._dataSources, dataSource);
  swapDataSources(this, index, index + 1);
};

/**
 * 将数据源在集合中的位置向下移动一位。
 *
 * @param {DataSource} dataSource 要移动的数据源。
 *
 * @exception {DeveloperError} dataSource 不在该集合中。
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 */
DataSourceCollection.prototype.lower = function (dataSource) {
  const index = getIndex(this._dataSources, dataSource);
  swapDataSources(this, index, index - 1);
};

/**
 * 将数据源移动到集合的顶部。
 *
 * @param {DataSource} dataSource 要移动的数据源。
 *
 * @exception {DeveloperError} dataSource 不在该集合中。
 * @exception {DeveloperError} This 实体被销毁，即调用了 destroy() 方法。
 */
DataSourceCollection.prototype.raiseToTop = function (dataSource) {
  const index = getIndex(this._dataSources, dataSource);
  if (index === this._dataSources.length - 1) {
    return;
  }
  this._dataSources.splice(index, 1);
  this._dataSources.push(dataSource);

  this.dataSourceMoved.raiseEvent(
    dataSource,
    this._dataSources.length - 1,
    index,
  );
};

/**
 * 将数据源降至集合的最底部。
 *
 * @param {DataSource} dataSource 需要移动的数据源。
 *
 * @exception {DeveloperError} dataSource 不在该集合中。
 * @exception {DeveloperError} This 实体被销毁，即调用了 destroy() 方法。
 */
DataSourceCollection.prototype.lowerToBottom = function (dataSource) {
  const index = getIndex(this._dataSources, dataSource);
  if (index === 0) {
    return;
  }
  this._dataSources.splice(index, 1);
  this._dataSources.splice(0, 0, dataSource);

  this.dataSourceMoved.raiseEvent(dataSource, 0, index);
};

/**
 * 如果此实体被销毁，则返回 true；否则返回 false。
 * 如果此实体被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} true 如果此实体被销毁，则不应使用它；否则返回 false。
 *
 * @see DataSourceCollection#destroy
 */
DataSourceCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁该集合中所有数据源所持有的资源。明确销毁此
 * 实体可以确保 WebGL 资源的确定性释放，而不是依赖垃圾收集器。一旦此实体被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给该对象，如示例中所示。
 * 实体被销毁，即调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This 实体被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * dataSourceCollection = dataSourceCollection && dataSourceCollection.destroy();
 *
 * @see DataSourceCollection#isDestroyed
 */
DataSourceCollection.prototype.destroy = function () {
  this.removeAll(true);
  return destroyObject(this);
};
export default DataSourceCollection;
