/**
 * 收集一组可注册到场景中的 Controller 对象，用于处理输入事件、相机动画及其他交互。
 * @class
 * @see {@link Controller}
 * @see {@link Scene#controllerHost}
 */
class ControllerHost {
  /**
   * 创建 <code>ControllerHost</code> 的实例。通常，<code>ControllerHost</code> 由场景构造函数创建，并通过 {@link Scene#controllerHost} 访问。
   * @see {@link Scene#controllerHost}
   */
  constructor() {
    /**
     * @type {Controller[]}
     * @private
     */
    this._controllers = [];
    this._needsUpdate = new Set();
  }

  /**
   * 注册到该主机中的控制器数量。
   * @type {number}
   * @readonly
   */
  get controllerCount() {
    return this._controllers.length;
  }

  /**
   * 向该主机注册一个控制器实现。
   * @param {Controller} controller 用于向该主机注册的 Controller 接口实现。
   * @param {HTMLElement} element 包含 Cesium 场景的 DOM 元素。
   * @param {number} [priority=0] 一个索引，小于或等于已注册的控制器数量，用于定义新控制器相对于之前注册控制器的优先级。优先级为 <code>0</code> 表示新控制器会在其他控制器之前应用其更新。当后续控制器被更新时，其效果会覆盖之前的更新效果。如果省略，新控制器将具有最高优先级，即其更新会在所有其他控制器之后应用。
   */
  registerController(controller, element, priority) {
    const index = priority ?? this.controllerCount;
    this._controllers.splice(index, 0, controller);
    this._needsUpdate.add(controller);
    controller.connectedCallback(element);
  }

  /**
   * 从该主机中取消注册一个控制器实现。
   * @param {Controller} controller 用于从该主机中取消注册的 Controller 接口实现。
   * @param {HTMLElement} element 包含 Cesium 场景的 DOM 元素。
   */
  unregisterController(controller, element) {
    const controllers = this._controllers;
    const index = controllers.indexOf(controller);
    if (index !== -1) {
      controllers.splice(index, 1);
      controller.disconnectedCallback(element);
    }
  }

  /**
   * 由主机场景每帧调用一次，按优先级顺序更新所有已注册的控制器。
   * @param {Scene} scene 主机场景。
   * @param {JulianDate} time 当前模拟时间。
   */
  update(scene, time) {
    for (const controller of this._controllers) {
      if (!controller.enabled) {
        continue;
      }

      if (this._needsUpdate.has(controller)) {
        controller.firstUpdate(scene, time);
        this._needsUpdate.delete(controller);
      }

      controller.update(scene, time);
    }
  }
}

export default ControllerHost;
