import { DeveloperError } from "@cesium/core";

/**
 * 成功执行 {@link SnapService#snap} 的结果。
 *
 * 实现可能返回此处列出的之外的额外属性。
 *
 * @typedef {object} SnapService.Result
 * @property {Cartesian3} [snapPoint] 被捕捉的点。这是需要被使用的点。
 * @property {Cartesian3} [hitPoint] 光标与几何图形碰撞的位置：在捕捉范围内时，为最近的边缘点；否则为光标下方的表面点。
 */

/**
 * 通过外部服务提供对几何图形的捕捉功能，该服务根据
 * 远程托管的源几何图形进行捕捉，而非在场景中加载的几何图形。
 * 此类型描述了一个接口，并不打算被使用。
 *
 * @experimental This 该特性尚未定稿，可能会根据 Cesium 的标准弃用政策发生变化。
 *
 * @see IonSnapService
 */
class SnapService {
  constructor() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 请求对服务已知的几何图形进行捕捉。
   *
   * 相机和画布尺寸描述了当前视图，以便
   * 实现能够正确地执行视场依赖的捕捉（最近排序、
   * 像素孔径、表面跟踪）操作。
   *
   * 实现可能接受此处列出的之外的额外选项。
   *
   * @param {object} options 具有以下属性的对象：
   * @param {string} options.elementId 要被捕捉的几何图形的实现定义标识符。
   * @param {Cartesian3} options.testPoint 要被捕捉的起点，通常是光标选取的位置。
   * @param {Camera} options.camera 定义当前视图的相机。
   * @param {number} options.canvasWidth 画布宽度以 CSS 像素为单位。
   * @param {number} options.canvasHeight 画布高度以 CSS 像素为单位。
   * @param {Cartesian3} [options.closePoint=options.testPoint] 靠近目标几何图形的参考点，用于启动捕捉搜索。
   * @param {number} [options.snapAperture=SnapService.DEFAULT_SNAP_APERTURE] 捕捉容差以 CSS 像素为单位。
   * @returns {Promise<SnapService.Result|undefined>} The 捕捉结果，如果无法捕捉则为 <code>undefined</code>。
   */
  async snap(options) {
    DeveloperError.throwInstantiationError();
  }
}

/**
 * 当未提供 <code>options.snapAperture</code> 时，{@link SnapService#snap} 使用的默认捕捉容差，以 CSS 像素为单位。
 * 该值由实现定义。
 * 该特性尚未定稿，可能会根据 Cesium 的标准弃用政策发生变化。
 *
 * @experimental This feature is not final and is subject to change without Cesium's standard deprecation policy.
 *
 * @type {number}
 * @constant
 */
SnapService.DEFAULT_SNAP_APERTURE = undefined;

export default SnapService;
