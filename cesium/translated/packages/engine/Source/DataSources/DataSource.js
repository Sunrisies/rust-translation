import { DeveloperError } from "@cesium/core";

/**
 * 定义数据源的接口，可将任意数据转换为
 * {@link EntityCollection}供通用使用。该对象是一个接口
 * 仅用于文档说明，不用于直接实例化。
 * @alias DataSource
 * @constructor
 *
 * @see Entity
 * @see DataSourceDisplay
 */
function DataSource() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(DataSource.prototype, {
  /**
   * 获取此实例的可读名称。
   * @memberof DataSource.prototype
   * @type {string}
   */
  name: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取此数据源的优先时钟设置。
   * @memberof DataSource.prototype
   * @type {DataSourceClock}
   */
  clock: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取 {@link Entity} 实例的集合。
   * @memberof DataSource.prototype
   * @type {EntityCollection}
   */
  entities: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取指示数据源是否正在加载数据的值。
   * @memberof DataSource.prototype
   * @type {boolean}
   */
  isLoading: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取当底层数据发生变化时触发的事件。
   * @memberof DataSource.prototype
   * @type {Event}
   */
  changedEvent: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取在处理过程中出现错误时触发的事件。
   * @memberof DataSource.prototype
   * @type {Event<function(this, RequestErrorEvent)>}
   */
  errorEvent: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取 isLoading 值发生变化时触发的事件。
   * @memberof DataSource.prototype
   * @type {Event<function(this, boolean)>}
   */
  loadingEvent: {
    get: DeveloperError.throwInstantiationError,
  },
  /**
   * 获取此数据源是否应被显示。
   * @memberof DataSource.prototype
   * @type {boolean}
   */
  show: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 获取或设置此数据源的聚类选项。该对象可以在多个数据源之间共享。
   *
   * @memberof DataSource.prototype
   * @type {EntityCluster}
   */
  clustering: {
    get: DeveloperError.throwInstantiationError,
  },
});

/**
 * 将数据源更新到提供的时间。此函数可选，
 * 无需实现。它适用于基于当前动画时间或场景状态检索数据的数据源。
 * 如果实现，@link DataSourceDisplay 将在每一帧调用更新函数。
 * If implemented, update will be called by {@link DataSourceDisplay} once a frame.
 *
 * @param {JulianDate} time The simulation time.
 * @returns {boolean} True 如果此数据源在提供的时间准备好显示，则为真；否则为假。
 */
DataSource.prototype.update = function (time) {
  DeveloperError.throwInstantiationError();
};

/**
 * @private
 */
DataSource.setLoading = function (dataSource, isLoading) {
  if (dataSource._isLoading !== isLoading) {
    if (isLoading) {
      dataSource._entityCollection.suspendEvents();
    } else {
      dataSource._entityCollection.resumeEvents();
    }
    dataSource._isLoading = isLoading;
    dataSource._loading.raiseEvent(dataSource, isLoading);
  }
};
export default DataSource;