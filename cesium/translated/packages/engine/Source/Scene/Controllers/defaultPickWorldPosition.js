import {
  Cartesian2,
  Cartesian3,
  Check,
  IntersectionTests,
  Plane,
  Ray,
  defined,
} from "@cesium/core";

const scratchSurfaceCartesian = new Cartesian3();
const scratchPlane = new Plane(Cartesian3.UNIT_X, 0.0);
const scratchRay = new Ray();
const defaultTargetPixelSize = new Cartesian2(1.0, 1.0, 1.0);

/**
 * 根据指定的窗口坐标以及相机当前位置和朝向，选择一个笛卡尔世界空间位置。
 * <ol>
 * <li>如果相机位于场景定义的椭球体上方，则位置在椭球体上选取。</li>
 * <li>如果相机位于椭球体下方，则基于相机的位置和朝向创建一个临时平面，位置在该平面上选取。</li>
 * </ol>
 * @param {Scene} scene 用于选取世界位置的场景。
 * @param {Cartesian2} windowPosition 像素的 x 和 y 坐标。
 * @param {Cartesian3} result 存储结果的对象。
 * @param {Cartesian2} targetPixelSize 目标位置的像素大小，用于在导航时保持相机与目标位置的相对距离。
 * @returns {Cartesian3|undefined} The 选取的笛卡尔世界空间位置，如果无法选取位置则返回 <code>undefined</code>。
 * @see {@link ScreenSpaceMapCameraController#pickWorldPosition}
 * @see {@link ScreenSpaceElevatorCameraController#pickWorldPosition}
 * @see {@link ScreenSpaceTiltOrbitCameraController#pickWorldPosition}
 * @see {@link ScreenSpaceZoomCameraController#pickWorldPosition}
 */
export default function (
  scene,
  windowPosition,
  result,
  targetPixelSize = defaultTargetPixelSize,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("scene", scene);
  Check.typeOf.object("windowPosition", windowPosition);
  Check.typeOf.object("result", result);
  //>>includeEnd('debug');

  const { camera, ellipsoid } = scene;
  const surface = ellipsoid.scaleToGeodeticSurface(
    camera.positionWC,
    scratchSurfaceCartesian,
  );

  // Camera is at the origin
  if (!defined(surface)) {
    return undefined;
  }

  const cameraMagnitude = Cartesian3.magnitude(camera.positionWC);
  const surfaceMagnitude = Cartesian3.magnitude(surface);
  const belowEllipsoid = cameraMagnitude <= surfaceMagnitude;

  const normal = ellipsoid.geodeticSurfaceNormal(
    camera.positionWC,
    scratchSurfaceCartesian,
  );
  const dot = Cartesian3.dot(normal, camera.directionWC);
  const lookingUp = dot > 0.0;

  if (belowEllipsoid || lookingUp) {
    // Camera is inside the ellipsoid. When underground, create a temporary plane beneath the ellipsoid surface to avoid picking a position on the inside and opposite side of the ellipsoid.

    const plane = Plane.fromPointNormal(
      camera.positionWC,
      normal,
      scratchPlane,
    );

    const { clientHeight } = scene.canvas;
    const focusDistance =
      (targetPixelSize.y * clientHeight) /
      (2.0 * Math.tan(camera.frustum.fovy * 0.5));

    plane.distance -= dot * focusDistance;
    const ray = camera.getPickRay(windowPosition, scratchRay);
    return IntersectionTests.rayPlane(ray, plane, result);
  }

  return camera.pickEllipsoid(windowPosition, ellipsoid, result);
}
