import {
  Check,
  DeveloperError,
  RuntimeError,
  defined,
  destroyObject,
} from "@cesium/core";

/**
 * 缓存资源。
 * <p>
 * 此类型描述一个接口，不用于直接实例化。
 * </p>
 *
 * @see ResourceCache
 * @private
 */
class ResourceLoader {
  /**
   * 资源的缓存键。
   *
   *
   * @type {string}
   * @readonly
   * @private
   */
  // eslint-disable-next-line getter-return
  get cacheKey() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 加载资源。
   * @returns {Promise<ResourceLoader>} A 当资源加载完成时，该承诺会解析为加载器。
   * @private
   */
  load() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 卸载资源。
   * @private
   */
  unload() {}

  /**
   * 处理资源直至其准备就绪。
   *
   * @param {FrameState} frameState 帧状态。
   * @returns {boolean} true 一旦所有资源准备就绪。
   * @private
   */
  process(frameState) {
    return false;
  }

  /**
   * 根据错误信息及错误对象构造一个 {@link RuntimeError}。
   *
   * @param {string} errorMessage 错误信息。
   * @param {Error} [error] 错误。
   *
   * @returns {RuntimeError} The 运行时错误。
   * @private
   */
  getError(errorMessage, error) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.string("errorMessage", errorMessage);
    //>>includeEnd('debug');

    if (defined(error) && defined(error.message)) {
      errorMessage += `\n${error.message}`;
    }

    const runtimeError = new RuntimeError(errorMessage);
    if (defined(error)) {
      runtimeError.stack = `Original stack:\n${error.stack}\nHandler stack:\n${runtimeError.stack}`;
    }

    return runtimeError;
  }

  /**
   * 如果此对象被销毁，则返回 true；否则返回 false。
   * <br /><br />
   * 如果此对象被销毁，不应使用它；调用除
   * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
   *
   * @returns {boolean} <code>true</code> 如果此对象被销毁；否则为 <code>false</code>。
   *
   * @see ResourceLoader#destroy
   * @private
   */
  isDestroyed() {
    return false;
  }

  /**
   * 销毁已加载的资源。
   * <br /><br />
   * 一旦对象被销毁，不应使用它；调用除
   * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
   * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
   *
   * @exception {DeveloperError} This 对象被销毁，即调用了 destroy()。
   *
   * @example
   * resourceLoader = resourceLoader && resourceLoader.destroy();
   *
   * @see ResourceLoader#isDestroyed
   * @private
   */
  destroy() {
    this.unload();
    return destroyObject(this);
  }
}

export default ResourceLoader;
