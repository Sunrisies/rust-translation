import { Cartesian3, Math as CesiumMath } from "@cesium/core";
import ScreenSpaceElevatorCameraController from "./ScreenSpaceElevatorCameraController.js";
import ScreenSpaceMapCameraController from "./ScreenSpaceMapCameraController.js";

/**
 * 这是一个结合屏幕空间地图平移和屏幕空间电梯平移的上下文相机控制器。该控制器根据相机相对于垂直方向的角度自动在两者之间切换。如果相机主要向下看（在垂直方向的 angleThreshold 范围内），则使用 <code>ScreenSpaceMapCameraController</code>。
 * 如果相机朝向地平线（超出垂直方向的 angleThreshold），则使用 <code>ScreenSpaceElevatorCameraController</code>。
 * @implements Controller
 * @example
 * viewer.scene.screenSpaceCameraController.enableInputs = false;
 * viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
 *
 * const hybridController = new HybridScreenSpacePanCameraController();
 * viewer.addController(hybridController);
 */
class HybridScreenSpacePanCameraController {
  constructor() {
    this._elevatorController = new ScreenSpaceElevatorCameraController();
    this._mapController = new ScreenSpaceMapCameraController();

    this._enabled = true;
    this._ellipsoidNormal = new Cartesian3();

    /**
     * 决定使用哪种控制器的弧度角度阈值。如果相机在垂直方向的该角度范围内，则使用地图控制器；否则，使用电梯控制器。
     * @type {number}
     * @default CesiumMath.toRadians(125)
     */
    this.angleThreshold = CesiumMath.toRadians(125);
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(value) {
    this._enabled = value;
  }

  /**
   * 当相机主要水平方向看（超出垂直方向的 angleThreshold）时使用的控制器。
   * @type {ScreenSpaceElevatorCameraController}
   * @readonly
   */
  get elevatorController() {
    return this._elevatorController;
  }

  /**
   * 当相机主要向下看（在垂直方向的 angleThreshold 范围内）时使用的控制器。
   * @type {ScreenSpaceMapCameraController}
   * @readonly
   */
  get mapController() {
    return this._mapController;
  }

  /**
   * @inheritdoc
   * @param {HTMLElement} element 包含 Cesium 场景的 DOM 元素。
   */
  connectedCallback(element) {
    this._elevatorController.connectedCallback(element);
    this._mapController.connectedCallback(element);
  }

  /**
   * @inheritdoc
   * @param {HTMLElement} element 包含 Cesium 场景的 DOM 元素。
   */
  disconnectedCallback(element) {
    this._elevatorController.disconnectedCallback(element);
    this._mapController.disconnectedCallback(element);
  }

  /**
   * @inheritdoc
   */
  firstUpdate() {
    this._elevatorController.firstUpdate();
    this._mapController.firstUpdate();
  }

  /**
   * @inheritdoc
   * @param {Scene} scene
   */
  update(scene) {
    const camera = scene.camera;
    const normal = scene.ellipsoid.geodeticSurfaceNormal(
      camera.positionWC,
      this._ellipsoidNormal,
    );

    const angle = Math.abs(Cartesian3.angleBetween(normal, camera.directionWC));
    const activeController =
      angle < this.angleThreshold && angle > Math.PI - this.angleThreshold
        ? this._elevatorController
        : this._mapController;

    activeController.update(scene);
  }
}

export default HybridScreenSpacePanCameraController;
