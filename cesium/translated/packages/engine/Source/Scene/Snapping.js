import {
  BoundingRectangle,
  Cartesian2,
  Cartesian3,
  Check,
  Ray,
  defined,
  oneTimeWarning,
} from "@cesium/core";
import { pickBegin, pickEnd } from "./Picking.js";
import SnapFramebuffer from "./SnapFramebuffer.js";

/**
 * {@link Scene#snap} 的实现：几何点吸附选择。
 *
 * 吸附通道是一个离屏选择渲染过程（它复用该渲染过程
 * 通过 <code>pickBegin</code>/<code>pickEnd</code> 进行，目标是
 * 一个专用的 RGBA32F 帧缓冲区，而非 RGBA8 选择帧缓冲区。每个
 * 像素携带的数据比颜色信息更丰富：
 * <ul>
 * <li>R: 选择 ID（uint32）</li>
 * <li>G: isEdge 标志（0.0/1.0）</li>
 * <li>B: 线性眼空间深度（米）</li>
 * <li>A: 未使用</li>
 * </ul>
 * 数据表达式在 PickingPipelineStage 中构建（DrawCommand.snapId），
 * 并由
 * DerivedCommand.createSnapDerivedCommand 编译成基于吸附的着色器。只有具有
 * <code>snapId</code> 的命令（即模型管道原语）在
 * 吸附通道期间进行渲染。
 *
 * @namespace Snapping
 *
 * @private
 */
const Snapping = {};

const scratchRectangle = new BoundingRectangle(0.0, 0.0, 3.0, 3.0);
const scratchSnapCoord = new Cartesian2();
const scratchSurfaceCoord = new Cartesian2();
const scratchSnapRay = new Ray();
const scratchSnapOffset = new Cartesian3();

// Radius around the crosshair, in pixels, used to sample the nearest surface
// (the occluder the cursor is on).
const SNAP_OCCLUDER_RADIUS_PIXELS = 3.0;

// An edge more than this fraction deeper than that surface is treated as
// occluded by it (the edge is only visible because it pokes through a gap in a
// nearer silhouette), so snap doesn't punch through to geometry behind the
// object the cursor is on.
const SNAP_OCCLUSION_TOLERANCE = 0.1;

// Width of the region, centered on a winning edge hit, read to find the
// adjacent surface fragment for surfacePosition. Deliberately centered on the
// edge hit rather than the cursor: the cursor-centered snap region can clip
// away the object's surface, potentially causing the server-side backend to
// give a mismatched snap.
const SNAP_SURFACE_REGION_WIDTH = 9.0;

function cursorDist(hit) {
  return Math.sqrt(hit.x * hit.x + hit.y * hit.y);
}

function selectBestHit(hits) {
  // Depth of the nearest surface under the crosshair; edges well behind it are
  // occluded by the object the cursor is on and must not win.
  let occluderDepth = Number.POSITIVE_INFINITY;
  for (const hit of hits) {
    if (!hit.isEdge && cursorDist(hit) <= SNAP_OCCLUDER_RADIUS_PIXELS) {
      occluderDepth = Math.min(occluderDepth, hit.depth);
    }
  }
  const maxEdgeDepth = occluderDepth * (1.0 + SNAP_OCCLUSION_TOLERANCE);

  // Edges outrank surfaces, but only edges in front of (or at) the occluder;
  // otherwise fall back to the closest surface. Within the chosen group the
  // hit closest to the crosshair wins.
  const visible = hits.filter(
    (hit) => !hit.isEdge || hit.depth <= maxEdgeDepth,
  );
  const wantEdge = visible.some((hit) => hit.isEdge);
  const group = visible.filter((hit) => hit.isEdge === wantEdge);
  return group.reduce((best, hit) =>
    cursorDist(hit) < cursorDist(best) ? hit : best,
  );
}

// Find the surface hit belonging to the same object that lies closest to the
// region center, if any. Unlike an edge hit, whose position lies exactly on
// the object's silhouette, this point is unambiguously on the object.
function nearestSurfaceHit(hits, object) {
  let best;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const hit of hits) {
    if (hit.isEdge || hit.object !== object) {
      continue;
    }
    const dist = hit.x * hit.x + hit.y * hit.y;
    if (dist < bestDist) {
      best = hit;
      bestDist = dist;
    }
  }
  return best;
}

// Unproject a snap hit's eye-space depth (channel B of the snap framebuffer,
// written by the snap shader at the edge fragment itself) into a world
// position.
function snapHitToWorld(scene, windowPosition, hit) {
  const coords = scratchSnapCoord;
  coords.x = windowPosition.x + hit.x;
  coords.y = windowPosition.y + hit.y;

  const ray = scene.camera.getPickRay(coords, scratchSnapRay);
  if (!defined(ray)) {
    return undefined;
  }

  // hit.depth is perpendicular distance from the camera plane along the view
  // direction; convert to distance along the (non-axis-aligned) pick ray.
  const cos = Cartesian3.dot(ray.direction, scene.camera.directionWC);
  if (cos <= 0.0) {
    return undefined;
  }
  const t = hit.depth / cos;

  const offset = Cartesian3.multiplyByScalar(
    ray.direction,
    t,
    scratchSnapOffset,
  );
  return Cartesian3.add(ray.origin, offset, new Cartesian3());
}

/**
 * 返回围绕
 * <code>windowPosition</code> 的屏幕空间区域中最佳吸附目标。有关公共 API，请参阅 {@link Scene#snap}。
 *
 * @param {Scene} scene
 * @param {Cartesian2} windowPosition 搜索区域中心的窗口坐标。
 * @param {object} [options] 具有以下属性的对象：
 * @param {number} [options.width=25] 搜索区域的像素宽度。
 * @param {number} [options.height=options.width] 搜索区域的像素高度。
 * @returns {SceneSnapResult | undefined}
 *
 * @private
 */
Snapping.snap = function (scene, windowPosition, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("windowPosition", windowPosition);
  //>>includeEnd('debug');

  const width = options?.width ?? 25;
  const height = options?.height ?? width;

  const { context, defaultView } = scene;

  // The snap framebuffer is RGBA32F; rendering to it requires float color
  // attachment support.
  if (!context.colorBufferFloat) {
    oneTimeWarning(
      "snap-color-buffer-float",
      "Scene.snap requires the EXT_color_buffer_float extension, which is not supported on this platform.",
    );
    return undefined;
  }

  // Created lazily so applications that never snap pay no framebuffer cost.
  if (!defined(defaultView.snapFramebuffer)) {
    defaultView.snapFramebuffer = new SnapFramebuffer(context);
  }
  const snapFramebuffer = defaultView.snapFramebuffer;

  const drawingBufferRectangle = scratchRectangle;
  pickBegin(scene, windowPosition, drawingBufferRectangle, width, height, {
    framebuffer: snapFramebuffer,
    snap: true,
  });
  const hits = snapFramebuffer.end(drawingBufferRectangle);
  pickEnd(scene);

  if (hits.length === 0) {
    return undefined;
  }

  const best = selectBestHit(hits);
  if (!defined(best)) {
    return undefined;
  }

  const position = snapHitToWorld(scene, windowPosition, best);
  if (!defined(position)) {
    return undefined;
  }

  // For edge hits, also unproject the nearest same-object surface fragment so
  // consumers have a seed point that is on the object but off its silhouette.
  // Found with a read centered on the edge hit itself, so the seed does not
  // depend on where in the snap region the cursor was.
  let surfacePosition = position;
  if (best.isEdge) {
    const surfaceOrigin = scratchSurfaceCoord;
    surfaceOrigin.x = windowPosition.x + best.x;
    surfaceOrigin.y = windowPosition.y + best.y;
    pickBegin(
      scene,
      surfaceOrigin,
      drawingBufferRectangle,
      SNAP_SURFACE_REGION_WIDTH,
      SNAP_SURFACE_REGION_WIDTH,
      {
        framebuffer: snapFramebuffer,
        snap: true,
      },
    );
    const surfaceHits = snapFramebuffer.end(drawingBufferRectangle);
    pickEnd(scene);
    const surfaceHit = nearestSurfaceHit(surfaceHits, best.object);
    surfacePosition = defined(surfaceHit)
      ? snapHitToWorld(scene, surfaceOrigin, surfaceHit)
      : undefined;
  }

  return {
    object: best.object,
    isEdge: best.isEdge,
    position: position,
    surfacePosition: surfacePosition,
    screenPosition: new Cartesian2(
      windowPosition.x + best.x,
      windowPosition.y + best.y,
    ),
  };
};

// Exposed for testing.
Snapping._selectBestHit = selectBestHit;
Snapping._nearestSurfaceHit = nearestSurfaceHit;
Snapping._snapHitToWorld = snapHitToWorld;

export default Snapping;
