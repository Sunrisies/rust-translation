import { DeveloperError, Event, defined } from "@cesium/core";
import DataSource from "./DataSource.js";
import EntityCluster from "./EntityCluster.js";
import EntityCollection from "./EntityCollection.js";

/**
 * 一种可用于手动管理一组实体的 {@link DataSource} 实现。
 *
 * @alias CustomDataSource
 * @constructor
 *
 * @param {string} [name] 此实例的可读名称。
 *
 * @example
 * const dataSource = new Cesium.CustomDataSource('myData');
 *
 * const entity = dataSource.entities.add({
 * position : Cesium.Cartesian3.fromDegrees(1, 2, 0),
 * billboard : {
 * image : 'image.png'
 *    }
 * });
 *
 * viewer.dataSources.add(dataSource);
 */
function CustomDataSource(name) {
  this._name = name;
  this._clock = undefined;
  this._changed = new Event();
  this._error = new Event();
  this._isLoading = false;
  this._loading = new Event();
  this._entityCollection = new EntityCollection(this);
  this._entityCluster = new EntityCluster();
}

Object.defineProperties(CustomDataSource.prototype, {
  /**
   * 获取或设置此实例的可读名称。
   * @memberof CustomDataSource.prototype
   * @type {string}
   */
  name: {
    get: function () {
      return this._name;
    },
    set: function (value) {
      if (this._name !== value) {
        this._name = value;
        this._changed.raiseEvent(this);
      }
    },
  },
  /**
   * 获取或设置此实例的时钟。
   * @memberof CustomDataSource.prototype
   * @type {DataSourceClock}
   */
  clock: {
    get: function () {
      return this._clock;
    },
    set: function (value) {
      if (this._clock !== value) {
        this._clock = value;
        this._changed.raiseEvent(this);
      }
    },
  },
  /**
   * 获取 {@link Entity} 实例的集合。
   * @memberof CustomDataSource.prototype
   * @type {EntityCollection}
   */
  entities: {
    get: function () {
      return this._entityCollection;
    },
  },
  /**
   * 获取或设置数据源是否正在加载数据。
   * @memberof CustomDataSource.prototype
   * @type {boolean}
   */
  isLoading: {
    get: function () {
      return this._isLoading;
    },
    set: function (value) {
      DataSource.setLoading(this, value);
    },
  },
  /**
   * 获取当底层数据发生变化时触发的事件。
   * @memberof CustomDataSource.prototype
   * @type {Event}
   */
  changedEvent: {
    get: function () {
      return this._changed;
    },
  },
  /**
   * 获取在处理过程中出现错误时触发的事件。
   * @memberof CustomDataSource.prototype
   * @type {Event}
   */
  errorEvent: {
    get: function () {
      return this._error;
    },
  },
  /**
   * 获取当数据源开始或停止加载数据时触发的事件。
   * @memberof CustomDataSource.prototype
   * @type {Event}
   */
  loadingEvent: {
    get: function () {
      return this._loading;
    },
  },
  /**
   * 获取此数据源是否应被显示。
   * @memberof CustomDataSource.prototype
   * @type {boolean}
   */
  show: {
    get: function () {
      return this._entityCollection.show;
    },
    set: function (value) {
      this._entityCollection.show = value;
    },
  },

  /**
   * 获取或设置此数据源的聚类选项。该对象可以在多个数据源之间共享。
   *
   * @memberof CustomDataSource.prototype
   * @type {EntityCluster}
   */
  clustering: {
    get: function () {
      return this._entityCluster;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value)) {
        throw new DeveloperError("value must be defined.");
      }
      //>>includeEnd('debug');
      this._entityCluster = value;
    },
  },
});

/**
 * 将数据源更新到提供的时间。此函数可选，
 * 无需实现。它适用于基于当前动画时间或场景状态来检索数据的数据源。
 * 如果实现，每帧都会由 {@link DataSourceDisplay} 调用更新。
 * If implemented, update will be called by {@link DataSourceDisplay} once a frame.
 *
 * @param {JulianDate} time 如果此数据源在提供的时间点准备好显示，则为真；否则为假。
 * @returns {boolean} True if this data source is ready to be displayed at the provided time, false otherwise.
 */
CustomDataSource.prototype.update = function (time) {
  return true;
};

export default CustomDataSource;