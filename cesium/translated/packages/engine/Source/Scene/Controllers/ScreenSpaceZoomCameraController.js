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
import ScreenSpaceEventType from "../../Core/ScreenSpaceEventType.js";
import defaultPickWorldPosition from "./defaultPickWorldPosition.js";
import ScreenSpaceInputBindings from "./ScreenSpaceInputBindings.js";
import MouseButton from "./MouseButton.js";

/**
 * @typedef {object} ControllerOptions
 * @memberof ScreenSpaceZoomCameraController
 * @property {ScreenSpaceInputBindings.InputBinding[]} [dragInputs] 控制缩放的拖拽输入绑定。
 * @property {ScreenSpaceEventType[]} [scrollInputs] 控制缩放的滚动输入绑定。
 */

/**
 * 一个相机控制器，可根据屏幕空间中的指针位置实现相机的放大和缩小。
 * @class
 * @implements Controller
 * @example
 * viewer.scene.screenSpaceCameraController.enableInputs = false;
 * viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
 *
 * const zoomCameraController = new Cesium.ScreenSpaceZoomCameraController();
 * viewer.addController(zoomCameraController);
 */
class ScreenSpaceZoomCameraController {
  /**
   * @private
   * @returns {ScreenSpaceInputBindings.InputBinding[]} The 默认拖拽输入绑定。
   */
  static _getDefaultDragInputs() {
    return [
      Object.freeze({
        button: MouseButton.MIDDLE,
      }),
    ];
  }

  /**
   * @private
   * @returns {ScreenSpaceEventType[]} The 默认滚动输入绑定。
   */
  static _getDefaultScrollInputs() {
    return [ScreenSpaceEventType.WHEEL];
  }

  /**
   * 创建 <code>ScreenSpaceZoomCameraController</code> 的新实例。
   * @param {ScreenSpaceZoomCameraController.ControllerOptions} [options] 配置控制器的选项。
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    this._enabled = true;
    this._handler = undefined;
    this._lastUpdateTime = undefined;

    /**
     * 如果为 false，相机将把镜头缩放到屏幕中心位置；如果为 true，相机将在鼠标指针下方或拖拽开始时、使用滚动滚轮滚动时定位。
     * @type {boolean}
     * @default false
     */
    this.usePointerPosition = false;

    /**
     * 控制缩放的拖拽输入绑定。每个绑定都是鼠标按钮与可选键盘修饰符的组合。
     * 控制缩放的滚动输入绑定。
     * @type {ScreenSpaceInputBindings.InputBinding[]}
     * @see ScreenSpaceEventHandler
     */
    this.dragInputs =
      options.dragInputs ??
      ScreenSpaceZoomCameraController._getDefaultDragInputs();

    /**
     * 控制缩放的滚动输入绑定。
     * @type {ScreenSpaceEventType[]}
     * @see ScreenSpaceEventHandler
     * @default [ScreenSpaceEventType.WHEEL]
     */
    this.scrollInputs =
      options.scrollInputs ??
      ScreenSpaceZoomCameraController._getDefaultScrollInputs();

    this._dragInputState = undefined;
    this._dragDelta = new Cartesian2();
    this._scrollDelta = 0.0;
    this._zoomInputVelocity = 0.0;
    this._screenSpaceScrollPosition = new Cartesian2();
    this._screenSpaceDragPosition = new Cartesian2();
    this._screenSpaceOrigin = new Cartesian2();

    /**
     * 根据鼠标滚轮增量决定相机放大和缩小的速度。
     * @type {number}
     * @default 0.2
     */
    this.zoomSensitivity = 0.2;

    /**
     * 用于选择缩放起始世界的位置的函数。该函数接受 {@link Scene}、屏幕空间位置 {@link Cartesian2} 和存储结果的 {@link Cartesian3} 实例作为参数。该函数应返回用于缩放的世界位置 {@link Cartesian3}，如果无法选择位置则返回 <code>undefined</code>。
     * @type {Function(Scene, Cartesian2, Cartesian3): Cartesian3|undefined}
     * @default defaultPickWorldPosition
     * @example
     * const zoomCameraController = new Cesium.ScreenSpaceZoomCameraController();
     * zoomCameraController.pickWorldPosition = function (scene, windowPosition, result) {
     * // 从深度缓冲区选择世界位置
     * return scene.pickPosition(windowPosition, result);
     * };
     * viewer.addController(zoomCameraController);
     */
    this.pickWorldPosition = defaultPickWorldPosition;

    /**
     * 定义相机每秒放大和缩小多少的比例，即相机距离缩放目标的距离比率。
     * @type {number}
     * @default 0.4
     */
    this.zoomDistanceRatio = 0.4;

    /**
     * 启用或禁用缩放时的惯性效果。当启用时，在用户输入停止后，相机将继续移动，并根据 {@link ScreenSpaceZoomCameraController#inertialDecay} 逐渐减速。
     * @type {boolean}
     * @default true
     */
    this.inertiaEnabled = false;

    /**
     * 相机缩放速度随时间衰减的比率。
     * @type {number}
     * @default 6.0
     */
    this.inertialDecay = 6.0;

    /**
     * @private
     * @type number
     * @default 0.0
     */
    this.minimumZoomDistance = 0.0;

    /**
     * 相机可以远离缩放目标的最大距离。
     * @type {number}
     * @default 100000.0
     */
    this.maximumZoomDistance = 100000.0;

    /**
     * @private
     * @type {number}
     * @default CesiumMath.EPSILON20
     */
    this.minimumZoomVelocity = CesiumMath.EPSILON20;

    /**
     * 以米/秒为单位的最大缩放速度。这限制了相机放大和缩小的速度。
     * @type {number}
     * @default 1.0
     */
    this.maximumZoomVelocity = 1.0;

    /**
     * 启用或禁用缩放时的阻尼效果。阻尼会平滑相机移动，使操作显得更自然或更有重量感，但也可能导致相机响应出现轻微延迟。如果禁用阻尼，相机将立即响应用户输入。
     * @type {boolean}
     * @default true
     */
    this.dampingEnabled = true;

    /**
     * 指定单个缩放动画完成所需的秒数长度。
     * @type {number}
     * @default 0.45
     */
    this.zoomAnimationDuration = 0.45;

    this._target = new Cartesian3();
    this._zoomDirection = new Cartesian3();
    this._zoomDampenedResults = {
      velocity: 0.0,
      value: 0.0,
    };
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
      this._scrollDelta = 0.0;
      this._dragDelta.x = 0.0;
      this._dragDelta.y = 0.0;
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

    for (const input of this.scrollInputs) {
      handler.setInputAction(this._handleZoom.bind(this), input);
    }

    handler.setInputAction(
      this._handleZoomPosition.bind(this),
      ScreenSpaceEventType.MOUSE_MOVE,
    );

    this._dragInputState = ScreenSpaceInputBindings.registerDragInputBindings(
      handler,
      this.dragInputs,
      {
        start: this._handleStartDrag.bind(this),
        change: this._handleDrag.bind(this),
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
    this._scrollDelta = 0.0;
    this._dragDelta.x = 0.0;
    this._dragDelta.y = 0.0;
  }

  /**
   * 相机当前的缩放距离，以米为单位。这是相机到缩放目标的距离。
   * @type {number}
   * @private
   */
  get zoomDistance() {
    return this._zoomDampenedResults.value;
  }

  /**
   * 相机当前的缩放速度，以弧度/秒为单位。
   * @type {number}
   * @private
   */
  get zoomVelocity() {
    return this._zoomDampenedResults.velocity;
  }

  /**
   * 相机当前的缩放速度，以弧度/秒为单位。
   * @type {number}
   * @private
   */
  set zoomVelocity(value) {
    this._zoomDampenedResults.velocity = value;
  }

  /**
   * @inheritdoc
   * @param {Scene} scene
   */
  update(scene) {
    const now = getTimestamp();
    const dt =
      (now - this._lastUpdateTime) * TimeConstants.SECONDS_PER_MILLISECOND;

    const { canvas } = scene;
    const { clientWidth, clientHeight } = canvas;
    if (dt === 0 || clientWidth === 0 || clientHeight === 0) {
      this._lastUpdateTime = getTimestamp();
      this._scrollDelta = 0.0;
      this._dragDelta.x = 0;
      this._dragDelta.y = 0;
      return;
    }

    let dz = this._scrollDelta + this._dragDelta.y;
    if (dz === 0.0 && this.inertiaEnabled) {
      const damping = Math.exp(-this.inertialDecay * dt);
      this._zoomInputVelocity *= damping;
      dz = this._zoomInputVelocity * dt;
    }

    if (
      Math.abs(this.zoomVelocity) < this.minimumZoomVelocity &&
      dz <= CesiumMath.EPSILON3 &&
      dz >= -CesiumMath.EPSILON3 &&
      this.zoomVelocity <= CesiumMath.EPSILON3
    ) {
      this._lastUpdateTime = getTimestamp();
      this._scrollDelta = 0.0;
      this._dragDelta.x = 0;
      this._dragDelta.y = 0;
      this.zoomVelocity = 0.0;
      return;
    }

    this._zoomInputVelocity = CesiumMath.clamp(
      dz / dt,
      -this.maximumZoomVelocity,
      this.maximumZoomVelocity,
    );

    const { camera, ellipsoid } = scene;

    let direction = camera.direction;
    let distance =
      Cartesian3.magnitude(camera.positionWC) - ellipsoid.maximumRadius;

    let windowPosition = this.isDragging
      ? this._screenSpaceDragPosition
      : this._screenSpaceScrollPosition;
    if (!this.useDragPosition) {
      windowPosition = this._screenSpaceOrigin;
      windowPosition.x = clientWidth / 2.0;
      windowPosition.y = clientHeight / 2.0;
    }
    const target = this.pickWorldPosition(scene, windowPosition, this._target);
    if (defined(target)) {
      direction = Cartesian3.subtract(
        target,
        camera.positionWC,
        this._zoomDirection,
      );
      direction = Cartesian3.normalize(direction, this._zoomDirection);
      distance = Cartesian3.distance(target, camera.positionWC);
    }

    distance = CesiumMath.clamp(
      distance,
      distance > 0.0 ? this.minimumZoomDistance : -this.maximumZoomDistance,
      distance > 0.0 ? this.maximumZoomDistance : -this.minimumZoomDistance,
    );

    const zoom = dz * distance * this.zoomDistanceRatio;

    const smoothTime = this.dampingEnabled
      ? this.zoomAnimationDuration
      : undefined;
    this._zoomDampenedResults = CesiumMath.smoothDamp(
      0.0,
      zoom,
      this.zoomVelocity,
      dt,
      undefined,
      smoothTime,
      this._zoomDampenedResults,
    );

    camera.move(direction, this.zoomDistance);

    // Reset for next frame
    this._lastUpdateTime = getTimestamp();
    this._scrollDelta = 0.0;
    this._dragDelta.x = 0;
    this._dragDelta.y = 0;
  }

  /**
   * @private
   * @param {number} amount
   */
  _handleZoom(amount) {
    this._scrollDelta += amount * this.zoomSensitivity;
  }

  /**
   * @private
   */
  _handleZoomPosition(event) {
    this._screenSpaceScrollPosition.x = event.endPosition.x;
    this._screenSpaceScrollPosition.y = event.endPosition.y;
  }

  /**
   * @private
   */
  _handleStartDrag(event) {
    if (!this.enabled) {
      return;
    }

    this._screenSpaceDragPosition.x = event.position.x;
    this._screenSpaceDragPosition.y = event.position.y;
    this._dragDelta.x = 0.0;
    this._dragDelta.y = 0.0;
  }

  /**
   * @private
   */
  _handleDrag(event) {
    this._dragDelta.x += event.endPosition.x - event.startPosition.x;
    this._dragDelta.y += event.endPosition.y - event.startPosition.y;
  }
}

export default ScreenSpaceZoomCameraController;
