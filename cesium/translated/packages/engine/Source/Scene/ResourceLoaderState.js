// @ts-check

/**
 * {@link ResourceLoader} 状态。
 *
 * @enum {number}
 * @private
 */
const ResourceLoaderState = {
  /**
   * 资源尚未加载完成。
   *
   * @type {number}
   * @constant
   * @private
   */
  UNLOADED: 0,
  /**
   * 资源正在加载中。在此状态下，会根据需要获取外部资源。
   *
   * @type {number}
   * @constant
   * @private
   */
  LOADING: 1,
  /**
   * 资源已完全加载，但需要进一步处理。
   *
   * @type {number}
   * @constant
   * @private
   */
  LOADED: 2,
  /**
   * 资源正在处理中。在此状态下，会根据需要分配 GPU 资源。
   *
   * @type {number}
   * @constant
   * @private
   */
  PROCESSING: 3,
  /**
   * 资源已完全加载并处理完毕，结果已准备好使用。
   *
   * @type {number}
   * @constant
   * @private
   */
  READY: 4,
  /**
   * 由于错误，资源加载或处理失败。
   *
   * @type {number}
   * @constant
   * @private
   */
  FAILED: 5,
};

Object.freeze(ResourceLoaderState);

export default ResourceLoaderState;
