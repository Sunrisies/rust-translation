import {
  Cartesian2,
  Cartesian3,
  Check,
  Ellipsoid,
  FixedFrameTransforms,
  Frozen,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Quaternion,
  TimeConstants,
  defined,
  getTimestamp,
} from "@cesium/core";
import KeyboardEventModifier from "../../Core/KeyboardEventModifier.js";
import ScreenSpaceEventHandler from "../../Core/ScreenSpaceEventHandler.js";
import defaultPickWorldPosition from "./defaultPickWorldPosition.js";
import ScreenSpaceInputBindings from "./ScreenSpaceInputBindings.js";
import MouseButton from "./MouseButton.js";

/**
 * @typedef {object} ControllerOptions
 * @memberof ScreenSpaceTiltOrbitCameraController
 * @property {ScreenSpaceInputBindings.InputBinding[]} [dragInputs] 控制倾斜和旋转的拖拽输入绑定。
 */

/**
 * 一个相机控制器，允许通过点击和拖动鼠标或在触摸屏上触摸并拖动来在屏幕空间中将相机围绕目标位置进行倾斜和旋转。
 * @class
 * @implements Controller
 * @example
 * viewer.scene.screenSpaceCameraController.enableInputs = false;
 * viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
 *
 * const tiltOrbitController = new Cesium.ScreenSpaceTiltOrbitCameraController();
 * viewer.addController(tiltOrbitController);
 *
 * @example
 * // 在光标下的位置进行倾斜，或在拖动开始时点击该位置，而不是屏幕中心的固定位置。
 * viewer.scene.screenSpaceCameraController.enableInputs = false;
 * viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
 *
 * const tiltOrbitController = new Cesium.ScreenSpaceTiltOrbitCameraController();
 * tiltOrbitController.useDragPosition = true;
 * viewer.addController(tiltOrbitController);
 *
 * @example
 * // 配置控制器使用左鼠标按钮进行倾斜和旋转，而不是默认的右鼠标按钮。
 * const tiltOrbitController = new Cesium.ScreenSpaceTiltOrbitCameraController({
 * dragInputs: [{ button: Cesium.MouseButton.LEFT }]
 * });
 * viewer.addController(tiltOrbitController);
 */
class ScreenSpaceTiltOrbitCameraController {
  /**
   * @private
   * @returns {ScreenSpaceInputBindings.InputBinding[]} The 默认拖拽输入绑定。
   */
  static _getDefaultDragInputs() {
    return [
      Object.freeze({
        button: MouseButton.LEFT,
        modifier: KeyboardEventModifier.CTRL,
      }),
      Object.freeze({
        button: MouseButton.RIGHT,
      }),
    ];
  }

  /**
   * 创建 <code>ScreenSpaceTiltOrbitCameraController</code> 的新实例。
   * @param {ScreenSpaceTiltOrbitCameraController.ControllerOptions} [options] 配置控制器的选项。
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    this._enabled = true;
    this._handler = undefined;
    this._lastUpdateTime = undefined;

    /**
     * 启用拖拽以倾斜相机。
     * @type {boolean}
     * @default true
     */
    this.tiltEnabled = true;

    /**
     * 启用拖拽以旋转相机。
     * @type {boolean}
     * @default true
     */
    this.orbitEnabled = true;

    /**
     * 如果为 false，相机将围绕屏幕中心的固定位置进行旋转和倾斜。如果为 true，相机将围绕光标下的位置或拖动开始时点击的位置进行旋转和倾斜。
     * @type {boolean}
     * @default false
     */
    this.useDragPosition = false;

    /**
     * 控制倾斜的拖拽输入绑定。每个绑定都是鼠标按钮
     * 和可选键盘修饰键的组合。
     * @type {ScreenSpaceInputBindings.InputBinding[]}
     * @see ScreenSpaceEventHandler
     */
    this.dragInputs =
      options.dragInputs ??
      ScreenSpaceTiltOrbitCameraController._getDefaultDragInputs();

    this._dragInputState = undefined;
    this._dragDelta = new Cartesian2();
    this._screenSpaceDragPosition = new Cartesian2();
    this._screenSpaceOrigin = new Cartesian2();

    /**
     * 用于选择用于倾斜或旋转的世界位置的回调函数。该函数接受 {@link Scene}、{@link Cartesian2} 屏幕空间位置和 {@link Cartesian3} 实例作为参数来返回结果。该函数应返回用于倾斜或旋转的 {@link Cartesian3} 世界位置，如果无法选择位置则返回 <code>undefined</code>。
     * @type {Function(Scene, Cartesian2, Cartesian3): Cartesian3|undefined}
     * @default defaultPickWorldPosition
     * @example
     * const tiltOrbitCameraController = new Cesium.ScreenSpaceTiltOrbitCameraController();
     * tiltOrbitCameraController.pickWorldPosition = function (scene, windowPosition, result) {
     * // 从深度缓冲区选择世界位置
     * return scene.pickPosition(windowPosition, result);
     * };
     * viewer.addController(tiltOrbitCameraController);
     */
    this.pickWorldPosition = defaultPickWorldPosition;

    this._hasTarget = false;
    this._target = new Cartesian3();
    this._axis = new Cartesian3();

    /**
     * 每次拖动像素时相机倾斜的幅度。1.0 表示在整个画布上拖动鼠标会使相机倾斜 90 度。
     * @type {number}
     * @default 2.0
     */
    this.tiltMagnitude = 2.0;

    /**
     * 启用或禁用倾斜和轨道动画的阻尼效果。阻尼可以平滑相机运动，使其看起来更自然或更有重量感，但也会带来轻微的响应延迟。如果禁用阻尼，相机会立即响应用户输入。
     * @type {boolean}
     * @default true
     */
    this.dampingEnabled = true;

    /**
     * 指定单个倾斜动画完成所需的秒数。
     * @type {number}
     * @default 0.0045
     */
    this.tiltAnimationDuration = 0.0045;

    /**
     * 每秒弧度的最大倾斜速度。Number.POSITIVE_INFINITY 表示最大倾斜速度无限制。
     * @type {number}
     * @default CesiumMath.PI
     */
    this.maximumTiltVelocity = CesiumMath.PI;

    /**
     * @private
     * @type {number}
     * @default CesiumMath.EPSILON20
     */
    this.minimumTiltVelocity = CesiumMath.EPSILON20;

    /**
     * 每次拖动像素时相机轨道运动的幅度。1.0 表示在整个画布上拖动鼠标会使相机轨道运动 180 度。
     * @type {number}
     * @default 2.0
     */
    this.orbitMagnitude = 2.0;

    /**
     * 指定单个轨道动画完成所需的秒数。
     * @type {number}
     * @default 0.0045
     */
    this.orbitAnimationDuration = 0.0045;

    /**
     * 每秒弧度的最大轨道速度。Number.POSITIVE_INFINITY 表示最大轨道速度无限制。
     * @type {number}
     * @default CesiumMath.TWO_PI
     */
    this.maximumOrbitVelocity = CesiumMath.TWO_PI;

    /**
     * @private
     * @type {number}
     * @default CesiumMath.EPSILON20
     */
    this.minimumOrbitVelocity = CesiumMath.EPSILON20;

    this._tiltAxis = new Cartesian3();
    this._tiltQuaternion = new Quaternion();
    this._tiltOffset = new Cartesian3();
    this._tiltOrigin = new Cartesian3();
    this._tiltDampenedResults = {
      velocity: 0.0,
      value: 0.0,
    };

    this._orbitTargetEnu = new Matrix4();
    this._orbitTargetEast = new Cartesian3();
    this._orbitQuaternion = new Quaternion();
    this._orbitOffset = new Cartesian3();
    this._orbitLookOffset = new Cartesian3();
    this._orbitOrigin = new Cartesian3();
    this._orbitDampenedResults = {
      velocity: 0.0,
      value: 0.0,
    };

    /**
     * 一个位于 [0, 1) 范围内的参数，用于限制输入范围
     * 为每一帧动画中窗口宽度/高度的百分比。
     * 这有助于在低帧率情况下控制相机。
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
    this._dragDelta.x = 0.0;
    this._dragDelta.y = 0.0;
  }

  /**
   * @private
   */
  _handleStartDrag(event) {
    if (!this.enabled) {
      return;
    }

    this._hasTarget = false;
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

  /**
   * 相机当前的倾斜角度，以弧度为单位。0.0 表示相机直视椭球体下方，PI/2 表示相机看向地平线。
   * @type {number}
   * @private
   */
  get tiltAngle() {
    return this._tiltDampenedResults.value;
  }

  /**
   * 相机当前的倾斜速度，以每秒弧度为单位。
   * @type {number}
   * @private
   */
  get tiltVelocity() {
    return this._tiltDampenedResults.velocity;
  }

  /**
   * 相机当前的倾斜速度，以每秒弧度为单位。
   * @type {number}
   * @private
   */
  set tiltVelocity(value) {
    this._tiltDampenedResults.velocity = value;
  }

  /**
   * 相机当前的轨道角度，以弧度为单位，围绕目标点。0.0 表示相机从东方看目标点，PI/2 表示相机从北方看目标点。
   * @type {number}
   * @private
   */
  get orbitAngle() {
    return this._orbitDampenedResults.value;
  }

  /**
   * 相机当前的轨道速度，以每秒弧度为单位。
   * @type {number}
   * @private
   */
  get orbitVelocity() {
    return this._orbitDampenedResults.velocity;
  }

  /**
   * 相机当前的轨道速度，单位：弧度/秒。
   * @type {number}
   * @private
   */
  set orbitVelocity(value) {
    this._orbitDampenedResults.velocity = value;
  }

  /**
   * 尝试以指定的弧度值在指定原点周围绕相机旋转。正值表示顺时针旋转，负值表示逆时针旋转。如果拖拽原点不在椭球上，则不会应用任何旋转。
   * @param {Camera} camera 要旋转的相机。
   * @param {Cartesian3} target 在世界坐标中旋转的原点位置。
   * @param {Cartesian3} axis 旋转的轴，通常是目标位置处表面法线的负方向。
   * @param {number} amount 相机旋转的弧度值。正值表示顺时针旋转，负值表示逆时针旋转。
   * @param {number} dt 自上次更新以来的时间差，单位：秒。
   * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] 选择作为旋转原点的椭球。如果未定义，则使用默认椭球。
   */
  orbit(camera, target, axis, amount, dt, ellipsoid = Ellipsoid.default) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("camera", camera);
    Check.typeOf.object("target", target);
    Check.typeOf.object("axis", axis);
    Check.typeOf.number("amount", amount);
    Check.typeOf.number.greaterThan("dt", dt, 0);
    Check.typeOf.object("ellipsoid", ellipsoid);
    //>>includeEnd('debug');

    const enu = FixedFrameTransforms.eastNorthUpToFixedFrame(
      target,
      ellipsoid,
      this._orbitTargetEnu,
    );
    const east = Matrix4.multiplyByPointAsVector(
      enu,
      Cartesian3.UNIT_X,
      this._orbitTargetEast,
    );
    const currentOrbitAngle = Cartesian3.angleBetween(camera.directionWC, east);

    if (Math.abs(this.orbitVelocity) < this.minimumOrbitVelocity) {
      this.orbitVelocity = 0.0;
    }

    // Apply inertia
    if (!this.isDragging && this.dampingEnabled) {
      amount += this.orbitVelocity * dt;
    }

    if (amount === 0.0) {
      return;
    }

    const targetOrbitAngle = currentOrbitAngle + amount;

    // Apply critical damping
    const maxSpeed = this.dampingEnabled
      ? this.maximumOrbitVelocity * this.orbitMagnitude
      : undefined;
    const smoothTime = this.dampingEnabled
      ? this.orbitAnimationDuration
      : undefined;
    this._orbitDampenedResults = CesiumMath.smoothDamp(
      currentOrbitAngle,
      targetOrbitAngle,
      this.orbitVelocity,
      dt,
      maxSpeed,
      smoothTime,
      this._orbitDampenedResults,
    );

    const rho = this.orbitAngle - currentOrbitAngle;
    const rotation = Matrix3.fromQuaternion(
      Quaternion.fromAxisAngle(axis, -rho, this._orbitQuaternion),
    );

    const targetOffset = Cartesian3.subtract(
      camera.positionWC,
      target,
      this._orbitOffset,
    );
    const t = Cartesian3.dot(targetOffset, camera.directionWC);
    const offset = Cartesian3.multiplyByScalar(
      camera.directionWC,
      t,
      this._orbitLookOffset,
    );
    const lookOffset = Cartesian3.subtract(
      targetOffset,
      offset,
      this._orbitLookOffset,
    );

    const rotatedTargetOffset = Matrix3.multiplyByVector(
      rotation,
      targetOffset,
      this._orbitOffset,
    );

    const rotatedLookOffset = Matrix3.multiplyByVector(
      rotation,
      lookOffset,
      this._orbitLookOffset,
    );

    Cartesian3.add(target, rotatedTargetOffset, camera.position);

    const lookTarget = Cartesian3.add(
      target,
      rotatedLookOffset,
      this._orbitOrigin,
    );
    camera.lookAtWorldPosition(lookTarget, ellipsoid);
  }

  /**
   * 尝试以指定的弧度值倾斜相机。正值表示向下倾斜，负值表示向上倾斜。如果拖拽原点不在椭球上，则不会应用任何倾斜。
   * @param {Camera} camera 要倾斜的相机。
   * @param {Cartesian3} target 在世界坐标中倾斜的原点位置。
   * @param {Cartesian3} axis 倾斜的轴，通常是目标位置处表面法线的负方向。
   * @param {number} amount 相机倾斜的弧度值。正值表示向下倾斜，负值表示向上倾斜。
   * @param {number} dt 自上次更新以来的时间差，单位：秒。值必须大于0。
   * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] 选择作为倾斜原点的椭球。如果未定义，则使用默认椭球。
   */
  tilt(camera, target, axis, amount, dt, ellipsoid = Ellipsoid.default) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("camera", camera);
    Check.typeOf.object("target", target);
    Check.typeOf.object("axis", axis);
    Check.typeOf.number("amount", amount);
    Check.typeOf.number.greaterThan("dt", dt, 0);
    Check.typeOf.object("ellipsoid", ellipsoid);
    //>>includeEnd('debug');

    if (Math.abs(this.tiltVelocity) < this.minimumTiltVelocity) {
      this.tiltVelocity = 0.0;
    }

    // Apply inertia
    if (!this.isDragging && this.dampingEnabled) {
      amount += this.tiltVelocity * dt;
    }

    if (amount === 0.0) {
      return;
    }

    const currentTiltAngle = Cartesian3.angleBetween(camera.direction, axis);

    // Avoid large deltas when the sign is close to flipping, which can happen when the camera is looking straight down at the ellipsoid.
    if (
      (currentTiltAngle < CesiumMath.PI_OVER_TWO && amount > 0.0) ||
      (currentTiltAngle > CesiumMath.PI_OVER_TWO && amount < 0.0)
    ) {
      amount *= Math.abs(Math.sin(currentTiltAngle));
    }

    const targetTiltAngle = currentTiltAngle + amount;

    const maxSpeed = this.dampingEnabled
      ? this.maximumTiltVelocity * this.tiltMagnitude
      : undefined;
    const smoothTime = this.dampingEnabled
      ? this.tiltAnimationDuration
      : undefined;
    CesiumMath.smoothDamp(
      currentTiltAngle,
      targetTiltAngle,
      this.tiltVelocity,
      dt,
      maxSpeed,
      smoothTime,
      this._tiltDampenedResults,
    );

    const theta = this.tiltAngle - currentTiltAngle;
    const rotation = Matrix3.fromQuaternion(
      Quaternion.fromAxisAngle(camera.rightWC, -theta, this._tiltQuaternion),
    );

    const offset = Cartesian3.subtract(
      camera.position,
      target,
      this._tiltOffset,
    );
    const t = Cartesian3.dot(offset, camera.directionWC);
    const lookOffset = Cartesian3.multiplyByScalar(
      camera.directionWC,
      t,
      this._tiltOffset,
    );

    const lookTarget = Cartesian3.subtract(
      camera.position,
      lookOffset,
      this._tiltOrigin,
    );

    const rotatedOffset = Matrix3.multiplyByVector(
      rotation,
      lookOffset,
      this._tiltOffset,
    );

    Cartesian3.add(lookTarget, rotatedOffset, camera.position);
    camera.lookAtWorldPosition(lookTarget, ellipsoid);
  }

  /**
   * @inheritdoc
   * @param {Scene} scene
   */
  update(scene) {
    const dt =
      (getTimestamp() - this._lastUpdateTime) *
      TimeConstants.SECONDS_PER_MILLISECOND;

    const { canvas } = scene;
    const { clientWidth, clientHeight } = canvas;
    if (dt === 0 || clientWidth === 0 || clientHeight === 0) {
      // Reset for next frame
      this._lastUpdateTime = getTimestamp();
      this._dragDelta.x = 0;
      this._dragDelta.y = 0;
      return;
    }

    // Target position to orbit and tilt around. Pick the world position when dragging begins, and use that position for the duration of the drag.
    let target = this._target;
    if (this.isDragging && !this._hasTarget) {
      let windowPosition = this._screenSpaceDragPosition;
      if (!this.useDragPosition) {
        windowPosition = this._screenSpaceOrigin;
        windowPosition.x = clientWidth / 2.0;
        windowPosition.y = clientHeight / 2.0;
      }

      const dragPositionTarget = this.pickWorldPosition(
        scene,
        windowPosition,
        this._target,
      );
      const picked = defined(dragPositionTarget);
      this._hasTarget = picked;
      target = dragPositionTarget;
    }

    if (this._hasTarget) {
      const { camera, ellipsoid } = scene;
      const normal = ellipsoid.geodeticSurfaceNormal(target, this._axis);
      const axis = Cartesian3.negate(normal, this._axis);

      if (this.orbitEnabled) {
        let dx = this._dragDelta.x / clientWidth;
        dx = CesiumMath.clamp(
          dx,
          -this.maximumMovementRatio,
          this.maximumMovementRatio,
        );
        dx *= this.orbitMagnitude * CesiumMath.TWO_PI;

        this.orbit(camera, target, axis, dx, dt, ellipsoid);
      }

      if (this.tiltEnabled) {
        let dy = this._dragDelta.y / clientHeight;
        dy = CesiumMath.clamp(
          dy,
          -this.maximumMovementRatio,
          this.maximumMovementRatio,
        );
        dy *= this.tiltMagnitude * CesiumMath.PI;
        this.tilt(camera, target, axis, dy, dt, ellipsoid);
      }
    }

    // Reset for next frame
    this._lastUpdateTime = getTimestamp();
    this._dragDelta.x = 0;
    this._dragDelta.y = 0;
  }
}

export default ScreenSpaceTiltOrbitCameraController;
