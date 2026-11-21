import {
  Cartesian2,
  Cartesian3,
  Frozen,
  Math as CesiumMath,
  TimeConstants,
  defined,
  getTimestamp,
} from "@cesium/core";
import ScreenSpaceEventHandler from "../../Core/ScreenSpaceEventHandler.js";
import defaultPickWorldPosition from "./defaultPickWorldPosition.js";
import ScreenSpaceInputBindings from "./ScreenSpaceInputBindings.js";
import MouseButton from "./MouseButton.js";

/**
 * @typedef {object} ControllerOptions
 * @memberof ScreenSpaceElevatorCameraController
 * @property {ScreenSpaceInputBindings.InputBinding[]} [dragInputs] 控制平移的拖拽输入绑定。
 */

/**
 * 一个相机控制器，允许在屏幕空间中沿椭球面切向平移相机，即相对于椭球法线上下移动。
 * 通过点击并拖动鼠标实现。
 * @class
 * @implements Controller
 * @example
 * viewer.scene.screenSpaceCameraController.enableInputs = false;
 * viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
 *
 * const elevatorCameraController = new Cesium.ScreenSpaceElevatorCameraController();
 * viewer.addController(elevatorCameraController);
 *
 * @example
 * // 配置控制器使用右鼠标按钮进行平移，而非默认的左鼠标按钮。
 * const elevatorCameraController = new Cesium.ScreenSpaceElevatorCameraController({
 * dragInputs: [{ button: Cesium.MouseButton.RIGHT}]
 * });
 * viewer.addController(elevatorCameraController);
 */
class ScreenSpaceElevatorCameraController {
  /**
   * @private
   * @returns {ScreenSpaceInputBindings.InputBinding[]} The 默认拖拽输入绑定。
   */
  static _getDefaultDragInputs() {
    return [
      Object.freeze({
        button: MouseButton.LEFT,
      }),
    ];
  }

  /**
   * 创建 ScreenSpaceElevatorCameraController 的实例。
   * @param {ScreenSpaceElevatorCameraController.ControllerOptions} [options] 配置控制器的选项。
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    this._enabled = true;
    this._handler = undefined;
    this._lastUpdateTime = undefined;

    /**
     * 控制垂直平移的拖拽输入绑定。每个绑定都是鼠标按钮与可选键盘修饰符的组合。
     * 一个用于选择平移起点的世界位置的回调函数。该函数接受 {@link Scene}、屏幕空间位置 {@link Cartesian2} 和用于存储结果的 {@link Cartesian3} 实例作为参数。该函数应返回需要平移的世界位置 {@link Cartesian3}，如果无法选择位置则返回 <code>undefined</code>。如果返回 <code>undefined</code>，相机将相对于相机下方的椭球面进行平移。
     * @type {ScreenSpaceInputBindings.InputBinding[]}
     * @see ScreenSpaceEventHandler
     */
    this.dragInputs =
      options.dragInputs ??
      ScreenSpaceElevatorCameraController._getDefaultDragInputs();

    this._dragInputState = undefined;
    this._panDelta = new Cartesian2();
    this._panPosition = new Cartesian2();

    /**
     * A callback function used to pick the world position from which to pan. The function is called with {@link Scene}, the {@link Cartesian2} screen space position, and a {@link Cartesian3} instance to store the result. The function should return the {@link Cartesian3} world position from which to pan, or <code>undefined</code> if no position could be picked. If <code>undefined</code> is returned, the camera will pan relative to the ellipsoid surface below the camera.
     * @type {Function(Scene, Cartesian2, Cartesian3): Cartesian3|undefined}
     * @default defaultPickWorldPosition
     * @example
     * const elevatorCameraController = new Cesium.ScreenSpaceElevatorCameraController();
     * elevatorCameraController.pickWorldPosition = function (scene, windowPosition, result) {
     * // 从深度缓冲区选择世界位置
     * return scene.pickPosition(windowPosition, result);
     * };
     * viewer.addController(elevatorCameraController);
     */
    this.pickWorldPosition = defaultPickWorldPosition;

    this._ellipsoidNormal = new Cartesian3();
    this._ellipsoidSurfacePosition = new Cartesian3();
    this._panDirectionX = new Cartesian3();
    this._panDirectionY = new Cartesian3();
    this._pixelSize = new Cartesian2();
    this._panVelocity = new Cartesian2();

    /**
     * 相机平移的米每像素速度。
     * @type {number}
     * @default 1.0
     */
    this.panSpeed = 1.0;

    /**
     * 启用或禁用平移时的惯性。当启用时，用户停止拖拽后相机仍会继续移动，并根据 {@link ScreenSpaceMapCameraController#inertialDecay} 逐渐减速。
     * @type {boolean}
     * @default true
     */
    this.inertiaEnabled = true;

    /**
     * 相机平移速度随时间衰减的速率。
     * @type {number}
     * @default 6.0
     */
    this.inertialDecay = 6.0;

    /**
     * 一个位于 <code>[0, 1)</code> 范围内的参数，用于限制范围。
     * 每个动画帧中，输入量占窗口宽度/高度的百分比。
     * 这有助于在低帧率情况下控制相机位置。
     * @type {number}
     * @default 0.1
     */
    this.maximumMovementRatio = 0.1;
  }

  /**
   * @inheritdoc
   */
  get enabled() {
    return this._enabled;
  }
  set enabled(value) {
    this._enabled = value;

    if (value) {
      this._lastUpdateTime = getTimestamp();
      this._panDelta.x = 0;
      this._panDelta.y = 0;
    } else if (defined(this._dragInputState)) {
      this._dragInputState.isDragging = false;
    }
  }

  /**
   * @private
   * @type {boolean}
   */
  get isDragging() {
    return defined(this._dragInputState) && this._dragInputState.isDragging;
  }

  /**
   * @inheritdoc
   * @param {HTMLElement} element 包含 Cesium 场景的 DOM 元素。
   */
  connectedCallback(element) {
    const handler = new ScreenSpaceEventHandler(element);
    this._handler = handler;

    this._dragInputState = ScreenSpaceInputBindings.registerDragInputBindings(
      handler,
      this.dragInputs,
      {
        start: this._handleStartPan.bind(this),
        change: this._handlePan.bind(this),
      },
    );
  }

  /**
   * @inheritdoc
   * @param {HTMLElement} element 包含 Cesium 场景的 DOM 元素。
   */
  disconnectedCallback(element) {
    const handler = this._handler;
    if (defined(handler) && !handler.isDestroyed()) {
      handler.destroy();
    }
  }

  /**
   * @inheritdoc
   */
  firstUpdate() {
    this._lastUpdateTime = getTimestamp();
    this._panDelta.x = 0;
    this._panDelta.y = 0;
  }

  /**
   * @inheritdoc
   * @param {any} scene
   */
  update(scene) {
    const dt =
      (getTimestamp() - this._lastUpdateTime) *
      TimeConstants.SECONDS_PER_MILLISECOND;

    const { camera, ellipsoid, canvas } = scene;

    let dx = -this._panDelta.x;
    let dy = this._panDelta.y;

    if (this.inertiaEnabled && !this.isDragging) {
      const damping = Math.exp(-this.inertialDecay * dt);
      this._panVelocity.x *= damping;
      this._panVelocity.y *= damping;

      dx = this._panVelocity.x * dt;
      dy = this._panVelocity.y * dt;
    }

    const { clientWidth, clientHeight } = canvas;
    if (
      dt === 0 ||
      clientWidth === 0 ||
      clientHeight === 0 ||
      (Math.abs(dx) <= CesiumMath.EPSILON3 &&
        Math.abs(dy) <= CesiumMath.EPSILON3)
    ) {
      // Reset for next frame
      this._lastUpdateTime = getTimestamp();
      this._panDelta.x = 0;
      this._panDelta.y = 0;
      return;
    }

    const windowPosition = this._panPosition;
    let surface = this.pickWorldPosition(
      scene,
      windowPosition,
      this._ellipsoidSurfacePosition,
    );

    if (!defined(surface)) {
      surface = ellipsoid.scaleToGeodeticSurface(
        camera.positionWC,
        this._ellipsoidSurfacePosition,
      );
    }

    let xAxis = Cartesian3.clone(camera.rightWC, this._panDirectionX);
    xAxis = Cartesian3.normalize(xAxis, this._panDirectionX);
    const zAxis = Cartesian3.normalize(surface, this._panDirectionY);

    const distance = Cartesian3.distance(camera.positionWC, surface);
    const { drawingBufferWidth, drawingBufferHeight, pixelRatio } = scene;
    const pixelSize = camera.frustum.getPixelDimensions(
      drawingBufferWidth,
      drawingBufferHeight,
      distance,
      pixelRatio,
      this._pixelSize,
    );

    const maxPixels =
      this.maximumMovementRatio * Math.max(clientWidth, clientHeight);
    dx = CesiumMath.clamp(dx, -maxPixels, maxPixels);
    this._panVelocity.x = dx / dt;
    dx *= this.panSpeed * pixelSize.x;

    dy = CesiumMath.clamp(dy, -maxPixels, maxPixels);
    this._panVelocity.y = dy / dt;
    dy *= this.panSpeed * pixelSize.y;

    camera.move(xAxis, dx);
    camera.move(zAxis, dy);

    // Reset for next frame
    this._lastUpdateTime = getTimestamp();
    this._panDelta.x = 0;
    this._panDelta.y = 0;
  }

  _handleStartPan() {
    if (!this.enabled) {
      return;
    }

    this._panDelta.x = 0;
    this._panDelta.y = 0;
  }

  /**
   * @private
   */
  _handlePan(event) {
    this._panDelta.x += event.endPosition.x - event.startPosition.x;
    this._panDelta.y += event.endPosition.y - event.startPosition.y;
    this._panPosition.x = event.endPosition.x;
    this._panPosition.y = event.endPosition.y;
  }
}

export default ScreenSpaceElevatorCameraController;
