/**
 * 定义了图像加载状态，此时任何请求均已解决且 WebGL 资源已更新。
 * @private
 * @enum {number}
 */
const BillboardLoadState = Object.freeze({
  /**
   * 没有图像数据需要加载。
   * @private
   * @type {number}
   * @constant
   */
  NONE: 0,
  /**
   * 图像数据正在下载中，或 WebGL 资源正在更新。
   * @private
   * @type {number}
   * @constant
   */
  LOADING: 2,
  /**
   * 图像数据已下载完成，WebGL 资源也已创建，准备进行渲染。
   * @private
   * @type {number}
   * @constant
   */
  LOADED: 3,
  /**
   * 在下载图像或更新 WebGL 资源时出现了错误。
   * @private
   * @type {number}
   * @constant
   */
  ERROR: 4,
  /**
   * 由于资源被销毁或其他错误，WebGL 资源的更新失败。
   * @private
   * @type {number}
   * @constant
   */
  FAILED: 5,
});

export default BillboardLoadState;
