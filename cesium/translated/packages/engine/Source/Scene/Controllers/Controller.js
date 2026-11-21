import { DeveloperError } from "@cesium/core";

/**
 * 这是一个相机控制器接口，可用于在场景中注册以处理输入事件、相机动画和其他交互。该接口的实现应通过 {@link ControllerHost} 在场景中注册。
 * 此类型描述了一个
 * 接口，不用于直接实例化。
 * @class
 * @abstract
 * @see {@link HybridScreenSpacePanCameraController}
 * @see {@link ScreenSpaceElevatorCameraController}
 * @see {@link ScreenSpaceMapCameraController}
 * @see {@link ScreenSpaceTiltOrbitCameraController}
 */
class Controller {
  /**
   * 决定控制器是否启用以及是否由宿主场景进行更新。
   * @type {boolean}
   */
  get enabled() {
    return DeveloperError.throwInstantiationError();
  }
  set enabled(value) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 当控制器被添加到 DOM 时调用。需实现 <code>connectedCallback</code> 来设置任何 DOM 事件监听器。
   * @param {HTMLElement} element 包含 Cesium 场景的 DOM 元素。
   */
  connectedCallback(element) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 当控制器从 DOM 中移除时调用。需实现 <code>disconnectedCallback</code> 来取消任何 DOM 事件监听器。
   * @param {HTMLElement} element 包含 Cesium 场景的 DOM 元素。
   */
  disconnectedCallback(element) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 每帧调用一次。需实现 <code>update</code> 来修改相机或场景的其他部分。
   * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/#updaterender-cycle-events|Update/Render Cycle Events}
   * @param {Scene} scene
   * @param {JulianDate} time 当前模拟时间。
   */
  update(scene, time) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 当控制器首次更新时调用，即在调用 <code>update</code> 之前。需实现 <code>firstUpdate</code> 以在相关场景开始渲染循环后执行一次性操作。例如初始化模拟时间值或将primitive添加到场景中。
   * @see Controller#update
   * @param {Scene} scene
   * @param {JulianDate} time 当前模拟时间。
   */
  firstUpdate(scene, time) {
    DeveloperError.throwInstantiationError();
  }
}

export default Controller;
