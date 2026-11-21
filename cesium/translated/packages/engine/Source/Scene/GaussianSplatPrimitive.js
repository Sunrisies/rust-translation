import {
  AttributeType,
  Cartesian3,
  ComponentDatatype,
  DeveloperError,
  Event,
  FixedFrameTransforms,
  Frozen,
  Geometry,
  GeometryAttribute,
  Matrix3,
  Matrix4,
  PixelDatatype,
  PixelFormat,
  PrimitiveType,
  Quaternion,
  clone,
  defined,
  destroyObject,
  oneTimeWarning,
} from "@cesium/core";
import ModelUtility from "./Model/ModelUtility.js";
import GaussianSplatSorter from "./GaussianSplatSorter.js";
import GaussianSplatTextureGenerator from "./GaussianSplatTextureGenerator.js";
import Sampler from "../Renderer/Sampler.js";
import Texture from "../Renderer/Texture.js";
import GaussianSplatRenderResources from "./GaussianSplatRenderResources.js";
import BlendingState from "./BlendingState.js";
import Pass from "../Renderer/Pass.js";
import ShaderDestination from "../Renderer/ShaderDestination.js";
import GaussianSplatVS from "../Shaders/PrimitiveGaussianSplatVS.js";
import GaussianSplatFS from "../Shaders/PrimitiveGaussianSplatFS.js";
import DrawCommand from "../Renderer/DrawCommand.js";
import VertexArray from "../Renderer/VertexArray.js";
import BufferUsage from "../Renderer/BufferUsage.js";
import RenderState from "../Renderer/RenderState.js";
import VertexAttributeSemantic from "./VertexAttributeSemantic.js";
import ModelComponents from "./ModelComponents.js";
import Axis from "./Axis.js";
import SplitDirection from "./SplitDirection.js";
import ContextLimits from "../Renderer/ContextLimits.js";
import CustomShader from "./Model/CustomShader.js";
import CustomShaderTranslucencyMode from "./Model/CustomShaderTranslucencyMode.js";
const scratchMatrix4A = new Matrix4();
const scratchMatrix4C = new Matrix4();
const scratchMatrix4D = new Matrix4();
const scratchMatrix3 = new Matrix3();
const scratchTransformQuat = new Quaternion();
const scratchTransformPosition = new Cartesian3();
const scratchTransformRotation = new Quaternion();
const scratchTransformScale = new Cartesian3();
const TRANSFORM_CACHE_EPSILON = 1e-12;
const RIGID_TRANSFORM_EPSILON = 1e-5;
const UNIT_SCALE_FAST_PATH_EPSILON = 1e-7;
// A single RGBA32UI texel stores up to 4 feature IDs (one per channel). The
// feature ID texture and vertex shader currently address exactly one texel per
// splat, so at most 4 feature ID sets are supported.
const MAX_FEATURE_ID_SETS = 4;

/**
 * 用于已提交快照的稳态重新排序的运行时状态机。
 *
 * 转换点位于 {@link GaussianSplatPrimitive#update} 中：
 * - IDLE -> WAITING/SORTING 当新的稳态排序请求被安排时
 * - WAITING -> SORTING 当排序承诺可用时
 * - SORTING -> SORTED 当活动承诺以有效结果解决时
 * - SORTED -> IDLE 在使用新索引重建绘制命令后
 * - 任何状态 -> ERROR 当活动排序承诺被拒绝时
 *
 * @private
 */
const GaussianSplatSortingState = {
  // No steady sort request is in flight. update() may decide to start one.
  IDLE: 0,
  // A steady sort was requested, but sorter capacity was unavailable this frame.
  WAITING: 1,
  // A steady sort promise is in flight and results are pending.
  SORTING: 2,
  // A valid sorted index buffer is available and waiting to be committed to draw command.
  SORTED: 3,
  // The active sort request failed; update() throws the captured error.
  ERROR: 4,
};

/**
 * 用于重建聚合斑点数据的快照生命周期。
 *
 * 转换顺序：
 * BUILDING -> TEXTURE_PENDING -> TEXTURE_READY -> SORTING -> READY
 *
 * 转换点分布在两个函数中：
 * - {@link GaussianSplatPrimitive#update} 驱动 BUILDING/SORTING/READY
 * - {@link GaussianSplatPrimitive.generateSplatTexture} 驱动 TEXTURE_PENDING/TEXTURE_READY
 *
 * 快照只有在到达 READY 状态时才被提交，因此所有 GPU 资源
 * 和排序索引会作为一个整体原子交换。
 *
 * @private
 */
const SnapshotState = {
  // CPU aggregation is complete and this snapshot is ready to start async texture generation.
  BUILDING: "BUILDING",
  // Async texture generation/upload is in flight for this snapshot.
  TEXTURE_PENDING: "TEXTURE_PENDING",
  // Attribute textures are ready; snapshot can now request index sorting.
  TEXTURE_READY: "TEXTURE_READY",
  // Sort request is in flight for this snapshot generation.
  SORTING: "SORTING",
  // Sorted indexes were validated for this generation and may be committed.
  READY: "READY",
};

/**
 * 异步构建的聚合高斯斑点快照数据，并且
 * 在所有所需资源准备就绪后原子性地提交。
 *
 * @typedef {object} GaussianSplatPrimitive.Snapshot
 * @property {number} generation 单调的数据生成令牌。
 * @property {Float32Array} positions 打包的斑点位置 (xyz)。
 * @property {Float32Array} rotations 打包的斑点旋转 (xyzw)。
 * @property {Float32Array} scales 打包的斑点缩放 (xyz)。
 * @property {Uint8Array} colors 打包的斑点颜色 (rgba)。
 * @property {Uint32Array|undefined} shData 打包的球谐函数数据。
 * @property {number} sphericalHarmonicsDegree 球谐函数的度数。
 * @property {number} shCoefficientCount 每个斑点的系数。
 * @property {number} numSplats 此快照中的总斑点数量。
 * @property {Uint32Array|undefined} indexes READY 时的排序索引缓冲区。
 * @property {Texture|undefined} gaussianSplatTexture 打包的斑点属性纹理。
 * @property {Texture|undefined} sphericalHarmonicsTexture 打包的 SH 纹理。
 * @property {number} lastTextureWidth 最后一个斑点纹理宽度。
 * @property {number} lastTextureHeight 最后一个斑点纹理高度。
 * @property {string} state 来自 {@link SnapshotState} 的当前快照生命周期状态。
 * @private
 */

/**
 * 打包的球谐函数纹理负载。
 *
 * @typedef {object} GaussianSplatPrimitive.SphericalHarmonicsTextureData
 * @property {number} width 纹理宽度以 texels 为单位。
 * @property {number} height 纹理高度以 texels 为单位。
 * @property {ArrayBufferView} data 打包的无符号整数纹理数据。
 * @private
 */

/**
 * 打包的高斯斑点属性纹理负载。
 *
 * @typedef {object} GaussianSplatPrimitive.AttributeTextureData
 * @property {number} width 纹理宽度以 texels 为单位。
 * @property {number} height 纹理高度以 texels 为单位。
 * @property {ArrayBufferView} data 打包的无符号整数纹理数据。
 * @private
 */

// Two stable frames avoids rebuilding during brief selected-tile jitter.
const DEFAULT_STABLE_FRAMES = 2;
// If selection keeps changing, force a rebuild after ~0.5s at 60fps to guarantee progress.
// Lower values react faster but can thrash on noisy LOD transitions.
// Higher values reduce rebuild churn but keep stale snapshots visible longer.
const DEFAULT_MAX_SNAPSHOT_STALL_FRAMES = 30;
// Minimum delay between steady re-sort requests once the camera is moving.
const DEFAULT_SORT_MIN_FRAME_INTERVAL = 3;
// ~0.5 degree camera direction change threshold before triggering steady re-sort.
const DEFAULT_SORT_MIN_ANGLE_RADIANS = 0.008726646259971648;
// Minimum camera movement in world units before triggering steady re-sort.
const DEFAULT_SORT_MIN_POSITION_DELTA = 1.0;

/**
 * 确定相机是否自上次
 * 稳态排序以来已经移动或旋转足够多，以安排新的排序。
 *
 * 当满足以下任一条件时返回 {@code true}：
 * - 尚未记录之前的稳态排序。
 * - 相机位置至少移动了 {@link DEFAULT_SORT_MIN_POSITION_DELTA} 世界单位。
 * - 相机方向至少改变了 {@link DEFAULT_SORT_MIN_ANGLE_RADIANS} 弧度。
 *
 * 最小帧间隔 ({@link DEFAULT_SORT_MIN_FRAME_INTERVAL})
 * 强制实施以防止每一帧都进行重新排序。
 *
 * @param {GaussianSplatPrimitive} primitive 用于检查的斑点原语。
 * @param {FrameState} frameState 当前帧状态。
 * @returns {boolean} Whether 新的稳定排序应开始。
 * @private
 */
function shouldStartSteadySort(primitive, frameState) {
  const framesSinceLastSort =
    primitive._lastSteadySortFrameNumber >= 0
      ? frameState.frameNumber - primitive._lastSteadySortFrameNumber
      : Number.POSITIVE_INFINITY;
  if (
    primitive._lastSteadySortFrameNumber >= 0 &&
    framesSinceLastSort < DEFAULT_SORT_MIN_FRAME_INTERVAL
  ) {
    return false;
  }

  const camera = frameState.camera;
  if (!defined(camera)) {
    return false;
  }
  if (
    !primitive._hasLastSteadySortCameraPosition ||
    !primitive._hasLastSteadySortCameraDirection
  ) {
    return true;
  }

  const positionDelta = Cartesian3.distance(
    camera.positionWC,
    primitive._lastSteadySortCameraPosition,
  );
  if (positionDelta >= DEFAULT_SORT_MIN_POSITION_DELTA) {
    return true;
  }

  const angleDelta = Cartesian3.angleBetween(
    camera.directionWC,
    primitive._lastSteadySortCameraDirection,
  );
  return angleDelta >= DEFAULT_SORT_MIN_ANGLE_RADIANS;
}

/**
 * 在稳定排序开始时记录帧号和相机姿态，以便
 * {@link shouldStartSteadySort} 之后可以计算差异。
 *
 * @param {GaussianSplatPrimitive} primitive 用于更新的斑点原语。
 * @param {FrameState} frameState 当前帧状态。
 * @private
 */
function markSteadySortStart(primitive, frameState) {
  primitive._lastSteadySortFrameNumber = frameState.frameNumber;
  const camera = frameState.camera;
  if (!defined(camera)) {
    return;
  }
  Cartesian3.clone(camera.positionWC, primitive._lastSteadySortCameraPosition);
  primitive._hasLastSteadySortCameraPosition = true;
  Cartesian3.clone(
    camera.directionWC,
    primitive._lastSteadySortCameraDirection,
  );
  primitive._hasLastSteadySortCameraDirection = true;
}

/**
 * 检查当前选中的瓦片集合是否与原语中记录的集合不同。这用于检测需要
 * 快照重建的 LOD 过渡。
 * 斑点原语。
 *
 * @param {GaussianSplatPrimitive} primitive 本帧选中的瓦片。
 * @param {Cesium3DTile[]} selectedTiles 如果瓦片集合发生变化，则返回 {true}。
 * @returns {boolean} {@code 返回给定的排序结果是否仍与原语当前的排序请求和数据生成一致，即未被替换。
 * @private
 */
function haveSelectedTilesChanged(primitive, selectedTiles) {
  const prevSet = primitive._selectedTileSet;
  if (!defined(prevSet) || prevSet.size !== selectedTiles.length) {
    return true;
  }

  for (let i = 0; i < selectedTiles.length; i++) {
    if (!prevSet.has(selectedTiles[i])) {
      return true;
    }
  }

  return false;
}

/**
 * 返回排序结果是否仍然符合原语当前的排序请求和数据生成，即未被替换。
 * 破坏快照拥有的 GPU 纹理（如果有的话），并清除相关引用，使其在破坏后不再使用。
 *
 * @param {GaussianSplatPrimitive} primitive 斑点原语。
 * @param {object} activeSort 用于验证的排序结果。
 * @returns {boolean} {@code 如果排序结果仍然有效，则返回 {true}。
 * @private
 */
function isActiveSort(primitive, activeSort) {
  return (
    defined(activeSort) &&
    activeSort.requestId === primitive._sortRequestId &&
    activeSort.dataGeneration === primitive._splatDataGeneration
  );
}

/**
 * 如果有的话，则破坏快照拥有的 GPU 纹理，并清除相关引用，使其在破坏后不再使用。
 * 已退休的纹理的 grace period（一帧）已过去。
 *
 * @param {GaussianSplatPrimitive.Snapshot|undefined} snapshot 需要被破坏的纹理的快照。
 * @private
 */
function destroySnapshotTextures(snapshot) {
  if (!defined(snapshot)) {
    return;
  }
  if (defined(snapshot.gaussianSplatTexture)) {
    snapshot.gaussianSplatTexture.destroy();
    snapshot.gaussianSplatTexture = undefined;
  }
  if (defined(snapshot.sphericalHarmonicsTexture)) {
    snapshot.sphericalHarmonicsTexture.destroy();
    snapshot.sphericalHarmonicsTexture = undefined;
  }
  if (defined(snapshot.featureIdTexture)) {
    snapshot.featureIdTexture.destroy();
    snapshot.featureIdTexture = undefined;
  }
}

/**
 * 安排 GPU 纹理的延迟破坏。该纹理保持活跃
 * 再持续一帧，以便引用它的任何正在执行的绘制命令能在底层 GPU 资源释放前完成。
 * 原语。
 *
 * @param {GaussianSplatPrimitive} primitive 要退休的纹理。
 * @param {Texture|undefined} texture 纹理被退休时的帧号。
 * @param {number} frameNumber 纹理被退休时的帧号。
 * @private
 */
function retireTexture(primitive, texture, frameNumber) {
  if (!defined(texture)) {
    return;
  }
  const retired = primitive._retiredTextures;
  retired.push({
    texture: texture,
    frameNumber: frameNumber,
  });
}

/**
 * 如果退休后的 grace period（一帧）已过去，则破坏所有已退休的纹理。
 * 每帧调用一次，以从被新快照替换的纹理中回收 GPU 内存。
 * 原语。
 *
 * @param {GaussianSplatPrimitive} primitive 原语。
 * @param {number} frameNumber 当前帧号。
 * @private
 */
function releaseRetiredTextures(primitive, frameNumber) {
  const retired = primitive._retiredTextures;
  if (!defined(retired) || retired.length === 0) {
    return;
  }
  const next = [];
  for (let i = 0; i < retired.length; i++) {
    const entry = retired[i];
    if (frameNumber - entry.frameNumber > 0) {
      entry.texture.destroy();
    } else {
      next.push(entry);
    }
  }
  primitive._retiredTextures = next;
}

function getSnapshotArrayBuffer(snapshot, key) {
  const value = snapshot?.[key];
  return defined(value) ? value.buffer : undefined;
}

function acquireAggregateScratchBuffer(
  primitive,
  key,
  componentDatatype,
  requiredLength,
) {
  let pool = primitive._aggregateScratchBuffers[key];
  if (!defined(pool)) {
    pool = [];
    primitive._aggregateScratchBuffers[key] = pool;
  }

  const activeBuffer = getSnapshotArrayBuffer(primitive._snapshot, key);
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[i];
    if (
      candidate.length >= requiredLength &&
      candidate.buffer !== activeBuffer
    ) {
      return candidate;
    }
  }

  const created = ComponentDatatype.createTypedArray(
    componentDatatype,
    requiredLength,
  );
  pool.push(created);
  return created;
}

function trimAggregateScratchBuffer(buffer, length) {
  if (buffer.length === length) {
    return buffer;
  }
  return buffer.subarray(0, length);
}

/**
 * 原子性地将完全构建的快照提升为原语的活跃斑点数据。这包括交换属性数组、GPU 纹理和
 * 排序索引，以及退休任何之前活跃的纹理，以便它们在当前帧结束后可以安全被破坏。
 * 快照<b>必须</b>处于 {@link SnapshotState.READY} 状态；否则将抛出 {@link DeveloperError}。
 * 原语。
 *
 * The snapshot <b>must</b> be in the {@link SnapshotState.READY} state;
 * otherwise a {@link DeveloperError} is thrown.
 *
 * @param {GaussianSplatPrimitive} primitive 快照尚未准备好。
 * @param {GaussianSplatPrimitive.Snapshot} snapshot 最终完成快照的异步斑点纹理生成。解决的数据
 * @param {FrameState} frameState 更新或重新创建 GPU 纹理，快照在完成后转变为
 * @throws {DeveloperError} If {@link SnapshotState.TEXTURE_READY} 状态。
 * @private
 */
function commitSnapshot(primitive, snapshot, frameState) {
  if (!defined(snapshot.indexes) || snapshot.state !== SnapshotState.READY) {
    throw new DeveloperError("Committing snapshot before it is READY.");
  }

  const frameNumber = frameState.frameNumber;
  const currentSnapshot = primitive._snapshot;
  const splatTexture = defined(currentSnapshot)
    ? currentSnapshot.gaussianSplatTexture
    : primitive.gaussianSplatTexture;
  if (defined(splatTexture) && splatTexture !== snapshot.gaussianSplatTexture) {
    retireTexture(primitive, splatTexture, frameNumber);
  }

  const sphericalHarmonicsTexture = defined(currentSnapshot)
    ? currentSnapshot.sphericalHarmonicsTexture
    : primitive.sphericalHarmonicsTexture;
  if (
    defined(sphericalHarmonicsTexture) &&
    sphericalHarmonicsTexture !== snapshot.sphericalHarmonicsTexture
  ) {
    retireTexture(primitive, sphericalHarmonicsTexture, frameNumber);
  }

  const featureIdTexture = defined(currentSnapshot)
    ? currentSnapshot.featureIdTexture
    : primitive._splatFeatureIdTexture;
  if (
    defined(featureIdTexture) &&
    featureIdTexture !== snapshot.featureIdTexture
  ) {
    retireTexture(primitive, featureIdTexture, frameNumber);
  }

  primitive._snapshot = snapshot;
  primitive._positions = snapshot.positions;
  primitive._rotations = snapshot.rotations;
  primitive._scales = snapshot.scales;
  primitive._colors = snapshot.colors;
  primitive._allFeatureIds = snapshot.allFeatureIds ?? [];
  primitive._featureIdCount = snapshot.featureIdCount ?? 0;
  primitive._hasFeatureIds =
    defined(snapshot.allFeatureIds) && snapshot.allFeatureIds.length > 0;
  primitive._splatFeatureIdTexture = snapshot.featureIdTexture;
  primitive._shData = snapshot.shData;
  primitive._sphericalHarmonicsDegree = snapshot.sphericalHarmonicsDegree;
  primitive._numSplats = snapshot.numSplats;
  primitive._indexes = snapshot.indexes;
  primitive.gaussianSplatTexture = snapshot.gaussianSplatTexture;
  primitive.sphericalHarmonicsTexture = snapshot.sphericalHarmonicsTexture;
  primitive._lastTextureWidth = snapshot.lastTextureWidth;
  primitive._lastTextureHeight = snapshot.lastTextureHeight;
  // Commit row-addressing params alongside the texture; the shader must
  // always see the mask/shift that matches the active texture layout.
  primitive._splatRowMask = snapshot.splatRowMask;
  primitive._splatRowShift = snapshot.splatRowShift;
  // Above 1.0 when the previous snapshot hit the hard cap; used in
  // _wrappedUpdate to inflate traversal SSE and reduce tile load.
  primitive._splatBudgetSSEScale = snapshot.splatBudgetSSEScale ?? 1.0;
  primitive._hasGaussianSplatTexture = defined(snapshot.gaussianSplatTexture);
  primitive._needsGaussianSplatTexture = false;
  primitive._gaussianSplatTexturePending = false;

  primitive._vertexArray = undefined;
  primitive._vertexArrayLen = -1;
  primitive._drawCommand = undefined;
  primitive._sorterPromise = undefined;
  primitive._activeSort = undefined;
  primitive._sorterState = GaussianSplatSortingState.IDLE;
  primitive._dirty = false;
}

/**
 * 原语。
 * 当前帧状态。
 * {@link SnapshotState.TEXTURE_READY} when complete.
 *
 * @param {GaussianSplatPrimitive} primitive The owning primitive.
 * @param {FrameState} frameState The current frame state.
 * @param {GaussianSplatPrimitive.Snapshot} snapshot 快照正在被填充。
 * @param {Promise<GaussianSplatPrimitive.AttributeTextureData>} promise Promise 将解析为打包的 Splat 纹理数据。
 * @returns {Promise<void>}
 * @private
 */
async function processGeneratedSplatTextureData(
  primitive,
  frameState,
  snapshot,
  promise,
) {
  try {
    const splatTextureData = await promise;

    // The pending snapshot may have been replaced (or the primitive destroyed)
    // while texture generation was in flight. Its textures were already
    // released, so bail out before allocating any new GPU resources.
    if (primitive._pendingSnapshot !== snapshot) {
      snapshot.state = SnapshotState.BUILDING;
      return;
    }

    const maxTex = ContextLimits.maximumTextureSize;

    // Use maximumTextureSize as the texture width; splatsPerRow = maxTex / 2
    // (each splat occupies 2 side-by-side texels). The WASM buffer layout is
    // width-independent, so the raw data is reused as-is.
    const optimalWidth = maxTex;
    let optimalHeight = Math.ceil(snapshot.numSplats / (maxTex / 2));
    const splatRowShift = Math.log2(maxTex / 2);
    const splatRowMask = maxTex / 2 - 1;

    // Hard cap: >maxTex*(maxTex/2) splats cannot fit in any valid texture.
    if (optimalHeight > maxTex) {
      const originalCount = snapshot.numSplats;
      optimalHeight = maxTex;
      const splatsPerRow = optimalWidth / 2;
      snapshot.numSplats = maxTex * splatsPerRow;
      // Truncate CPU attribute arrays to match numSplats.
      snapshot.positions = snapshot.positions.subarray(
        0,
        snapshot.numSplats * 3,
      );
      snapshot.rotations = snapshot.rotations.subarray(
        0,
        snapshot.numSplats * 4,
      );
      snapshot.scales = snapshot.scales.subarray(0, snapshot.numSplats * 3);
      snapshot.colors = snapshot.colors.subarray(0, snapshot.numSplats * 4);
      if (defined(snapshot.allFeatureIds)) {
        snapshot.allFeatureIds = snapshot.allFeatureIds.map((fids) =>
          fids.subarray(0, snapshot.numSplats),
        );
      }
      // shData is allocated independently and must be truncated separately.
      if (defined(snapshot.shData)) {
        const shPerSplat = snapshot.shData.length / originalCount;
        snapshot.shData = snapshot.shData.subarray(
          0,
          Math.floor(snapshot.numSplats * shPerSplat),
        );
      }
      // Scale up SSE next frame so traversal selects fewer tiles.
      snapshot.splatBudgetSSEScale = originalCount / snapshot.numSplats;
      console.warn(
        `[GaussianSplat][HARD CAP] ${originalCount} splats exceed the maximum texture capacity ` +
          `(${maxTex}\u00d7${splatsPerRow} = ${snapshot.numSplats} splats at width=${optimalWidth}). ` +
          `Rendering only the first ${snapshot.numSplats} splats to avoid a WebGL crash. ` +
          `Increasing maximumScreenSpaceError by ${snapshot.splatBudgetSSEScale.toFixed(2)}x next frame.`,
      );
    } else {
      // Within budget; clear any SSE inflation carried over from a previous cap.
      snapshot.splatBudgetSSEScale = 1.0;
    }

    // Trim or zero-pad the raw WASM buffer to match the chosen dimensions.
    const requiredLen = optimalWidth * optimalHeight * 4;
    let effectiveData;
    if (requiredLen <= splatTextureData.data.length) {
      effectiveData = splatTextureData.data.subarray(0, requiredLen);
    } else {
      effectiveData = new Uint32Array(requiredLen);
      effectiveData.set(splatTextureData.data);
    }
    const effectiveTextureData = {
      width: optimalWidth,
      height: optimalHeight,
      data: effectiveData,
    };

    // Create a separate feature ID texture holding ALL feature ID sets so
    // that custom shaders can reference featureId_0 through featureId_N.
    const allFids = snapshot.allFeatureIds;
    if (defined(allFids) && allFids.length > 0) {
      const oldFidTex = snapshot.featureIdTexture;
      snapshot.featureIdTexture = createFeatureIdTexture(
        frameState.context,
        allFids,
        snapshot.numSplats,
      );
      if (defined(oldFidTex)) {
        oldFidTex.destroy();
      }
    }

    snapshot.splatRowMask = splatRowMask;
    snapshot.splatRowShift = splatRowShift;

    if (!defined(snapshot.gaussianSplatTexture)) {
      snapshot.gaussianSplatTexture = createGaussianSplatTexture(
        frameState.context,
        effectiveTextureData,
      );
    } else if (
      snapshot.lastTextureHeight !== effectiveTextureData.height ||
      snapshot.lastTextureWidth !== effectiveTextureData.width
    ) {
      const oldTex = snapshot.gaussianSplatTexture;
      snapshot.gaussianSplatTexture = createGaussianSplatTexture(
        frameState.context,
        effectiveTextureData,
      );
      oldTex.destroy();
    } else {
      snapshot.gaussianSplatTexture.copyFrom({
        source: {
          width: effectiveTextureData.width,
          height: effectiveTextureData.height,
          arrayBufferView: effectiveTextureData.data,
        },
      });
    }
    snapshot.lastTextureHeight = effectiveTextureData.height;
    snapshot.lastTextureWidth = effectiveTextureData.width;

    if (defined(snapshot.shData) && snapshot.sphericalHarmonicsDegree > 0) {
      const oldTex = snapshot.sphericalHarmonicsTexture;
      const width = ContextLimits.maximumTextureSize;
      const dims = snapshot.shCoefficientCount / 3;
      const splatsPerRow = Math.floor(width / dims);
      const floatsPerRow = splatsPerRow * (dims * 2);

      const shHeight = Math.ceil(snapshot.numSplats / splatsPerRow);

      // SH texture width is already maxTex and cannot be widened further.
      // When height would exceed the GPU limit, gracefully disable SH for this
      // snapshot and fall back to base color rendering rather than crashing.
      if (shHeight > width) {
        console.warn(
          `[GaussianSplat][SHTexture] ${snapshot.numSplats} splats require SH height ${shHeight} > maxTex ${width}. ` +
            `Disabling spherical harmonics for this snapshot (color-only fallback).`,
        );
        snapshot.sphericalHarmonicsDegree = 0;
        if (defined(oldTex)) {
          oldTex.destroy();
        }
        snapshot.sphericalHarmonicsTexture = undefined;
      } else {
        const texBuf = new Uint32Array(width * shHeight * 2);

        let dataIndex = 0;
        for (let i = 0; dataIndex < snapshot.shData.length; i += width * 2) {
          texBuf.set(
            snapshot.shData.subarray(dataIndex, dataIndex + floatsPerRow),
            i,
          );
          dataIndex += floatsPerRow;
        }
        snapshot.sphericalHarmonicsTexture = createSphericalHarmonicsTexture(
          frameState.context,
          {
            data: texBuf,
            width: width,
            height: shHeight,
          },
        );
        if (defined(oldTex)) {
          oldTex.destroy();
        }
      }
    }

    snapshot.state = SnapshotState.TEXTURE_READY;
  } catch (error) {
    console.error("Error generating Gaussian splat texture:", error);
    snapshot.state = SnapshotState.BUILDING;
  }
}

/**
 * 对待处理的快照执行排序操作，验证结果
 * 仍然符合当前生成/请求要求，并在满足条件时提交快照。
 * 时提交。
 *
 * @param {GaussianSplatPrimitive} primitive 所属的原始体。
 * @param {FrameState} frameState 当前帧状态。
 * @param {object|undefined} pendingSort 待处理的排序元数据。
 * @param {Promise<Uint32Array>} sortPromise Promise 将解析为排序索引。
 * @returns {Promise<void>}
 * @private
 */
async function resolvePendingSnapshotSort(
  primitive,
  frameState,
  pendingSort,
  sortPromise,
) {
  try {
    const sortedData = await sortPromise;
    if (
      !defined(pendingSort) ||
      pendingSort.snapshot !== primitive._pendingSnapshot
    ) {
      return;
    }
    const expectedCount = pendingSort.expectedCount;
    const currentCount = expectedCount;
    const sortedLen = sortedData?.length;
    if (expectedCount !== currentCount || sortedLen !== expectedCount) {
      primitive._pendingSortPromise = undefined;
      primitive._pendingSort = undefined;
      if (pendingSort.snapshot.state === SnapshotState.SORTING) {
        pendingSort.snapshot.state = SnapshotState.TEXTURE_READY;
      }
      return;
    }

    const pending = pendingSort.snapshot;
    pending.indexes = sortedData;
    pending.state = SnapshotState.READY;
    primitive._pendingSortPromise = undefined;
    primitive._pendingSort = undefined;
    commitSnapshot(primitive, pending, frameState);
    primitive._pendingSnapshot = undefined;
    GaussianSplatPrimitive.buildGSplatDrawCommand(primitive, frameState);
  } catch (err) {
    if (
      !defined(pendingSort) ||
      pendingSort.snapshot !== primitive._pendingSnapshot
    ) {
      return;
    }
    primitive._pendingSortPromise = undefined;
    primitive._pendingSort = undefined;
    if (pendingSort.snapshot.state === SnapshotState.SORTING) {
      pendingSort.snapshot.state = SnapshotState.TEXTURE_READY;
    }
    primitive._sorterState = GaussianSplatSortingState.ERROR;
    primitive._sorterError = err;
  }
}

/**
 * 对当前已提交快照执行稳态排序操作。
 * 当结果被覆盖时将被忽略；否则会更新排序状态
 * 到 {@link GaussianSplatSortingState.SORTED}。
 *
 * @param {GaussianSplatPrimitive} primitive 所属的原始体。
 * @param {object|undefined} activeSort 活跃的排序元数据。
 * @param {Promise<Uint32Array>} sortPromise Promise 将解析为排序索引。
 * @returns {Promise<void>}
 * @private
 */
async function resolveSteadySort(primitive, activeSort, sortPromise) {
  try {
    const sortedData = await sortPromise;
    const isActive = isActiveSort(primitive, activeSort);
    const expectedCount = activeSort?.expectedCount;
    const currentCount = expectedCount;
    const sortedLen = sortedData?.length;
    const isMismatch =
      expectedCount !== currentCount || sortedLen !== expectedCount;
    if (!isActive || isMismatch) {
      if (isActive) {
        primitive._sorterPromise = undefined;
        primitive._sorterState = GaussianSplatSortingState.IDLE;
      }
      return;
    }
    primitive._indexes = sortedData;
    primitive._sorterState = GaussianSplatSortingState.SORTED;
  } catch (err) {
    if (!isActiveSort(primitive, activeSort)) {
      return;
    }
    primitive._sorterState = GaussianSplatSortingState.ERROR;
    primitive._sorterError = err;
  }
}

/**
 * 创建存储打包球谐系数数据的 GPU 纹理
 * 用于所有 Splat 的数据。该纹理使用两通道无符号整数格式
 * ({@link PixelFormat.RG_INTEGER}) 和最近邻采样。
 *
 * @param {Context} context WebGL 上下文。
 * @param {GaussianSplatPrimitive.SphericalHarmonicsTextureData} shData 打包的 SH 纹理负载。
 * @returns {Texture} The 创建的纹理。
 * @private
 */
function createSphericalHarmonicsTexture(context, shData) {
  const texture = new Texture({
    context: context,
    source: {
      width: shData.width,
      height: shData.height,
      arrayBufferView: shData.data,
    },
    preMultiplyAlpha: false,
    skipColorSpaceConversion: true,
    pixelFormat: PixelFormat.RG_INTEGER,
    pixelDatatype: PixelDatatype.UNSIGNED_INT,
    flipY: false,
    sampler: Sampler.NEAREST,
  });

  return texture;
}

/**
 * 创建存储打包高斯 Splat 属性的 GPU 纹理
 * （位置、缩放、旋转、颜色）。该纹理使用 RGBA
 * 无符号整数格式 ({@link PixelFormat.RGBA_INTEGER}) 和
 * 最近邻采样。
 *
 * @param {Context} context WebGL 上下文。
 * @param {GaussianSplatPrimitive.AttributeTextureData} splatTextureData 打包的 Splat 纹理负载。
 * @returns {Texture} The 创建的纹理。
 * @private
 */
function createGaussianSplatTexture(context, splatTextureData) {
  return new Texture({
    context: context,
    source: {
      width: splatTextureData.width,
      height: splatTextureData.height,
      arrayBufferView: splatTextureData.data,
    },
    preMultiplyAlpha: false,
    skipColorSpaceConversion: true,
    pixelFormat: PixelFormat.RGBA_INTEGER,
    pixelDatatype: PixelDatatype.UNSIGNED_INT,
    flipY: false,
    sampler: Sampler.NEAREST,
  });
}

/**
 * 创建存储每个 Splat 特征 ID 的 GPU 纹理。该纹理使用
 * RGBA 无符号整数格式；每个纹素可存储多达 4 个特征 ID（每个
 * 通道一个）。每个 Splat 仅使用一个纹素，因此最多支持
 * {@link MAX_FEATURE_ID_SETS} 个特征 ID 集。调用者必须在调用此函数前将
 * <code>allFeatureIds</code> 限制在该长度内。
 *
 * @param {Context} context WebGL 上下文。
 * @param {Array<Uint32Array>} allFeatureIds 特征 ID 集数组（长度 <= {@link MAX_FEATURE_ID_SETS}）。
 * @param {number} numSplats Splat 的数量。
 * @returns {Texture} The 创建的纹理。
 * @private
 */
function createFeatureIdTexture(context, allFeatureIds, numSplats) {
  const featureIdCount = allFeatureIds.length;
  const maxTex = ContextLimits.maximumTextureSize;
  // Use maximumTextureSize as width to match the splat attribute texture
  // convention. The VS derives the width from the same row-addressing
  // uniforms (u_splatRowMask + 1) << 1, and reads one texel per splat.
  const width = maxTex;
  const height = Math.ceil(numSplats / width);
  const data = new Uint32Array(width * height * 4);

  for (let i = 0; i < numSplats; i++) {
    const col = i % width;
    const row = Math.floor(i / width);
    const base = (row * width + col) * 4;
    for (let f = 0; f < featureIdCount; f++) {
      data[base + f] = allFeatureIds[f][i];
    }
  }

  return new Texture({
    context: context,
    source: {
      width: width,
      height: height,
      arrayBufferView: data,
    },
    preMultiplyAlpha: false,
    skipColorSpaceConversion: true,
    pixelFormat: PixelFormat.RGBA_INTEGER,
    pixelDatatype: PixelDatatype.UNSIGNED_INT,
    flipY: false,
    sampler: Sampler.NEAREST,
  });
}

/** A primitive that renders Gaussian splats.
 * <p>
 * 该原始体用于在 3D Tileset 中渲染高斯 Splat。
 * 设计用于与 KHR_gaussian_splatting 和 KHR_gaussian_splatting_compression_spz_2 扩展兼容。
 * </p>
 * @alias GaussianSplatPrimitive
 * @constructor
 * @param {object} options 具有以下属性的对象：
 * @param {Cesium3DTileset} options.tileset 该原始体所属的 Tileset。
 * @param {boolean} [options.debugShowBoundingVolume=false] 是否显示原始体的边界体积以用于调试。
 * @private
 */

function GaussianSplatPrimitive(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 原始体中高斯 Splat 的位置。
   * @type {undefined|Float32Array}
   * @private
   */
  this._positions = undefined;
  /**
   * 原始体中高斯 Splat 的旋转角度。
   * @type {undefined|Float32Array}
   * @private
   */
  this._rotations = undefined;
  /**
   * 原始体中高斯 Splat 的缩放比例。
   * @type {undefined|Float32Array}
   * @private
   */
  this._scales = undefined;
  /**
   * 原始体中高斯 Splat 的颜色。
   * @type {undefined|Uint8Array}
   * @private
   */
  this._colors = undefined;
  /**
   * 从选定 tiles 聚合的所有每个 Splat 特征 ID 集。
   * 每个特征ID集对应一个 Uint32Array 数组（featureId_0, featureId_1, ...）。
   * @type {Array<Uint32Array>}
   * @private
   */
  this._allFeatureIds = [];
  /**
   * 可用的特征ID集数量。
   * @type {number}
   * @private
   */
  this._featureIdCount = 0;
  /**
   * 存储所有集合中每个splat特征ID的GPU纹理。
   * RGBA32UI格式，每个纹理像素可容纳最多4个特征ID。
   * @type {undefined|Texture}
   * @private
   */
  this._splatFeatureIdTexture = undefined;
  /**
   * 当前快照是否包含splat特征ID。
   * @type {boolean}
   * @private
   */
  this._hasFeatureIds = false;
  /**
   * 基元中高斯splat的索引。
   * 用于在顶点着色器中索引splat属性纹理。
   * @type {undefined|Uint32Array}
   * @private
   */
  this._indexes = undefined;
  /**
   * 基元中的splat数量。
   * 所有选中瓦片中的总splat数量。
   * @type {number}
   * @private
   */
  this._numSplats = 0;
  /**
   * 指示基元是否需要使用高斯splat纹理。
   * 当基元首次创建或splat属性发生变化时，此值设为true。
   * @type {boolean}
   * @private
   */
  this._needsGaussianSplatTexture = true;
  this._snapshot = undefined;
  this._pendingSnapshot = undefined;
  this._retiredTextures = [];
  this._aggregateScratchBuffers = {
    positions: [],
    scales: [],
    rotations: [],
    colors: [],
  };

  /**
   * 帧间重复使用的刮擦缓冲区，用于聚合打包的球谐数据，以避免在每次瓦片选择时重新分配类型数组。
   * 在每次瓦片选择变化时，避免进行新的类型数组分配。
   * 用于确定基元是否需要更新的前序视图矩阵。
   * @type {undefined|Uint32Array}
   * @private
   */
  this._scratchAggregateShBuffer = undefined;
  this._selectedTilesStableFrames = 0;
  this._needsSnapshotRebuild = false;
  this._snapshotRebuildStallFrames = 0;

  /**
   * 当视图矩阵未改变时，用于避免不必要的更新。
   * 指示是否为了调试而显示基元的边界体积。
   * @type {Matrix4}
   * @private
   */
  this._prevViewMatrix = new Matrix4();

  /**
   * 用于在场景中可视化基元的边界体积。
   * 用于存储高斯splat属性的纹理。
   * @type {boolean}
   * @private
   */
  this._debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;

  /**
   * 从splat属性（位置、缩放、旋转、颜色）生成的纹理，并在顶点着色器中用于渲染splat。
   * 用于存储高斯splat的球谐系数纹理。
   * 高斯splat纹理的最后宽度。
   * @type {undefined|Texture}
   * @private
   * @see {@link GaussianSplatTextureGenerator}
   */
  this.gaussianSplatTexture = undefined;

  /**
   * 用于跟踪纹理大小的变化并相应更新基元。
   * @type {undefined|Texture}
   * @private
   */
  this.sphericalHarmonicsTexture = undefined;

  /**
   * 高斯splat纹理的最后高度。
   * 用于跟踪纹理大小的变化并相应更新基元。
   * @type {number}
   * @private
   */
  this._lastTextureWidth = 0;
  /**
   * 渲染高斯splat的顶点数组。
   * 该顶点数组包含渲染splat所需的属性，如位置和索引。
   * @type {number}
   * @private
   */
  this._lastTextureHeight = 0;
  /**
   * 顶点数组的长度，用于跟踪splat数量的变化。
   * 用于确定是否需要重建顶点数组。
   * @type {undefined|VertexArray}
   * @private
   */
  this._vertexArray = undefined;
  /**
   * “脏”标志强制基元在此帧进行渲染。
   * 跟踪当前选中的瓦片数量。
   * @type {number}
   * @private
   */
  this._vertexArrayLen = -1;
  this._splitDirection = SplitDirection.NONE;

  /**
   * 此值用于确定基元是否需要重建。
   * @type {boolean}
   * @private
   */
  this._dirty = false;

  this._tileset = options.tileset;

  this._baseTilesetUpdate = this._tileset.update;
  this._tileset.update = this._wrappedUpdate.bind(this);

  this._tileset.tileLoad.addEventListener(this.onTileLoad, this);
  this._tileset.tileVisible.addEventListener(this.onTileVisible, this);

  /**
   * 指示基元是否准备好使用。
   * This is used to determine if the primitive needs to be rebuilt.
   * @type {number}
   * @private
   */
  this.selectedTileLength = 0;
  this._selectedTileSet = new Set();

  /**
   * Indicates whether or not the primitive is ready for use.
   * @type {boolean}
   * @private
   */
  this._ready = false;

  /**
   * 指示该原始实体是否具有高斯斑点纹理。
   * @type {boolean}
   * @private
   */
  this._hasGaussianSplatTexture = false;

  /**
   * 指示该原始实体当前是否正在生成高斯斑点纹理。
   * @type {boolean}
   * @private
   */
  this._gaussianSplatTexturePending = false;

  /**
   * 用于渲染高斯斑点图的绘制命令。
   * @type {undefined|DrawCommand}
   * @private
   */
  this._drawCommand = undefined;
  this._drawCommandModelMatrix = new Matrix4();
  /**
   * 瓦片集的根变换矩阵。
   * 用于将斑点图转换为世界空间。
   * @type {undefined|Matrix4}
   * @private
   */
  this._rootTransform = undefined;

  /**
   * 将斑点从 Y 向上转换为 Z 向上的轴校正矩阵。
   * @type {Matrix4}
   * @private
   */
  this._axisCorrectionMatrix = ModelUtility.getAxisCorrectionMatrix(
    Axis.Y,
    Axis.X,
    new Matrix4(),
  );

  /**
   * 用于计算 SH 值的缓存逆旋转，在每次快照重建时更新。
   * 将世界空间视图方向转换为原始的 GLB Y 向上模型空间。
   * 以便球谐系数能在正确的框架中计算。
   * @type {Matrix3}
   * @private
   */
  this._shInverseRotation = new Matrix3();

  /**
   * 指示该原始实体是否已被销毁。
   * @type {boolean}
   * @private
   */
  this._isDestroyed = false;

  /**
   * 高斯斑点排序过程的状态。
   * 用于跟踪排序操作的进度。
   * @type {GaussianSplatSortingState}
   * @private
   */
  this._sorterState = GaussianSplatSortingState.IDLE;
  /**
   * 高斯斑点排序操作完成时的承诺。
   * 用于跟踪排序操作的进度。
   * @type {undefined|Promise}
   * @private
   */
  this._sorterPromise = undefined;
  this._splatDataGeneration = 0;
  this._sortRequestId = 0;
  this._activeSort = undefined;
  this._pendingSortPromise = undefined;
  this._pendingSort = undefined;
  this._lastSteadySortFrameNumber = -1;
  this._lastSteadySortCameraPosition = new Cartesian3();
  this._hasLastSteadySortCameraPosition = false;
  this._lastSteadySortCameraDirection = new Cartesian3();
  this._hasLastSteadySortCameraDirection = false;

  /**
   * 高斯斑点排序操作过程中发生的错误。
   * 当状态为 ERROR 时抛出。
   * @type {undefined|Error}
   * @private
   */
  this._sorterError = undefined;

  // Splat texture row-addressing params; forwarded to the shader as uniforms.
  // The texture width is always maximumTextureSize (varies by GPU), so these
  // are computed per-snapshot and initialized here as safe placeholders.
  this._splatRowMask = 0; // overwritten on first snapshot commit
  this._splatRowShift = 0; // overwritten on first snapshot commit

  /**
   * 在瓦片遍历过程中对最大ScreenSpaceError 应用的乘数，当
   * 前一次快照超出斑点纹理预算时。该值大于 1.0 时
   * 会偏向较粗的 LOD，从而减少总斑点数。
   * 当斑点数在预算范围内时，重置为 1.0。
   * @type {number}
   * @private
   */
  this._splatBudgetSSEScale = 1.0;

  /**
   * 指示着色器程序是否需要重建，因为
   * 自定义着色器在运行时发生了更改。
   * @type {boolean}
   * @private
   */
  this._shaderDirty = false;

  /**
   * 当前活动的自定义着色器。它反映了拥有该瓦片集的 customShader，并且
   * 从 {@link GaussianSplatPrimitive#update} 中的 tileset.customShader 同步而来，
   * 因此并非故意作为构造函数选项。
   * @type {CustomShader}
   * @private
   */
  this._customShader = GaussianSplatPrimitive.DefaultCustomShader;

  /**
   * @type {Event}
   * @private
   */
  this._customShaderCompilationEvent = new Event();
}

Object.defineProperties(GaussianSplatPrimitive.prototype, {
  /**
   * 指示该原始实体是否准备好使用。
   * @memberof GaussianSplatPrimitive.prototype
   * @type {boolean}
   * @readonly
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },

  /**
   * 指示该原始实体是否已完成加载和排序。
   * @memberof GaussianSplatPrimitive.prototype
   * @type {boolean}
   * @private
   * @readonly
   */
  isStable: {
    get: function () {
      return (
        !this._dirty &&
        (!defined(this._pendingSnapshot) ||
          this._pendingSnapshot.state === SnapshotState.READY)
      );
    },
  },

  /**
   * 应用于此点的 {@link SplitDirection}。
   * @memberof GaussianSplatPrimitive.prototype
   * @type {SplitDirection}
   * @default {@link SplitDirection.NONE}
   */
  splitDirection: {
    get: function () {
      return this._splitDirection;
    },
    set: function (value) {
      if (this._splitDirection !== value) {
        this._splitDirection = value;
        this._dirty = true;
      }
    },
  },

  /**
   * 获取或设置自定义着色器。如果未定义，则设置为 {@link GaussianSplatPrimitive.DefaultCustomShader}。
   *
   * @memberof GaussianSplatPrimitive.prototype
   * @type {CustomShader}
   * @see {@link https://github.com/CesiumGS/cesium/tree/main/Documentation/CustomShaderGuide|Custom Shader Guide}
   * @private
   */
  customShader: {
    get: function () {
      return this._customShader;
    },
    set: function (customShader) {
      if (this._customShader !== customShader) {
        // Delete old custom shader entries from the uniform map. The map is
        // undefined until the first draw command is built (e.g. while tiles
        // are still loading), in which case there is nothing to remove.
        const uniformMap = this._uniformMap;
        const oldCustomShader = this._customShader;
        const oldCustomShaderUniformMap = oldCustomShader.uniformMap;
        if (defined(uniformMap)) {
          for (const uniformName in oldCustomShaderUniformMap) {
            if (oldCustomShaderUniformMap.hasOwnProperty(uniformName)) {
              // If the custom shader was set but the splat shader was never
              // built, the custom shader uniforms wouldn't have been added to
              // the uniform map. But it doesn't matter because the delete
              // operator ignores if the key doesn't exist.
              delete uniformMap[uniformName];
            }
          }
        }

        if (!defined(customShader)) {
          this._customShader = GaussianSplatPrimitive.DefaultCustomShader;
        } else {
          this._customShader = customShader;
        }
        this._shaderDirty = true;
      }
    },
  },

  /**
   * 在自定义着色器编译时引发的事件。
   *
   * @memberof GaussianSplatPrimitive.prototype
   * @type {Event}
   * @readonly
   * @private
   */
  customShaderCompilationEvent: {
    get: function () {
      return this._customShaderCompilationEvent;
    },
  },
});

/**
 * 该原始实体使用的默认自定义着色器。
 *
 * @type {CustomShader}
 * @constant
 * @readonly
 *
 * @private
 */
GaussianSplatPrimitive.DefaultCustomShader = new CustomShader({});

/**
 * 替换瓦片集自身的更新函数，使得该原始实体在
 * 瓦片遍历后同一帧内立即更新。当
 * _splatBudgetSSEScale 大于 1.0 时，最大ScreenSpaceError 会被放大
 * 以减少被选择的瓦片数量。
 * @param {FrameState} frameState
 * @private
 */
GaussianSplatPrimitive.prototype._wrappedUpdate = function (frameState) {
  const tileset = this._tileset;
  if (this._splatBudgetSSEScale !== 1.0) {
    // Inflate SSE for this traversal only; the original value is restored
    // immediately so the user-visible tileset property is never permanently changed.
    const originalSSE = tileset.maximumScreenSpaceError;
    tileset.maximumScreenSpaceError *= this._splatBudgetSSEScale;
    this._baseTilesetUpdate.call(tileset, frameState);
    tileset.maximumScreenSpaceError = originalSSE;
  } else {
    this._baseTilesetUpdate.call(tileset, frameState);
  }
  this.update(frameState);
};

/**
 * 以确定性的方式销毁原始对象并释放其资源。
 * @private
 */
GaussianSplatPrimitive.prototype.destroy = function () {
  this._positions = undefined;
  this._rotations = undefined;
  this._scales = undefined;
  this._colors = undefined;
  this._indexes = undefined;
  destroySnapshotTextures(this._pendingSnapshot);
  destroySnapshotTextures(this._snapshot);
  if (defined(this._retiredTextures)) {
    for (let i = 0; i < this._retiredTextures.length; i++) {
      this._retiredTextures[i].texture.destroy();
    }
  }
  this._retiredTextures = [];
  this._pendingSnapshot = undefined;
  this._snapshot = undefined;
  this._aggregateScratchBuffers = undefined;
  this._splatFeatureIdTexture = undefined;
  this.gaussianSplatTexture = undefined;
  this.sphericalHarmonicsTexture = undefined;

  const drawCommand = this._drawCommand;
  if (defined(drawCommand)) {
    drawCommand.shaderProgram =
      drawCommand.shaderProgram && drawCommand.shaderProgram.destroy();
  }

  if (defined(this._vertexArray)) {
    this._vertexArray.destroy();
    this._vertexArray = undefined;
  }

  this._tileset.update = this._baseTilesetUpdate.bind(this._tileset);

  return destroyObject(this);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 * @returns {boolean} Returns 如果原始对象已被销毁，则返回 true；否则返回 false。
 * @private
 */
GaussianSplatPrimitive.prototype.isDestroyed = function () {
  return this._isDestroyed;
};

/**
 * 当瓦片加载时触发的事件回调。
 * 当瓦片加载且原始对象需要更新时，调用此方法。
 * 将 dirty 标志设置为 true，表示原始对象需要重建。
 * @param {Cesium3DTile} tile
 * @private
 */
GaussianSplatPrimitive.prototype.onTileLoad = function (tile) {
  this._dirty = true;
};

/**
 * 可见瓦片的回调。
 * @param {Cesium3DTile} tile
 * @private
 */
GaussianSplatPrimitive.prototype.onTileVisible = function (tile) {};

/**
 * 将瓦片的 splat 原始对象的属性转换为世界空间。
 * <br /><br />
 * 此方法应用瓦片及瓦片集边界球体的计算变换到 splat 原始对象的位置、旋转和缩放属性上。
 * 它直接修改这些属性，将其从局部空间转换为世界空间。
 * 修改这些属性，将其从局部空间转换为世界空间。
 *
 * @param {Cesium3DTile} tile
 * @private
 */
GaussianSplatPrimitive.transformTile = function (tile) {
  const computedTransform = tile.computedTransform;
  const gltfPrimitive = tile.content.gltfPrimitive;
  const gaussianSplatPrimitive = tile.tileset.gaussianSplatPrimitive;

  if (gaussianSplatPrimitive._rootTransform === undefined) {
    gaussianSplatPrimitive._rootTransform =
      FixedFrameTransforms.eastNorthUpToFixedFrame(
        tile.tileset.boundingSphere.center,
      );
  }
  const rootTransform = gaussianSplatPrimitive._rootTransform;

  const computedModelMatrix = Matrix4.multiplyTransformation(
    computedTransform,
    gaussianSplatPrimitive._axisCorrectionMatrix,
    scratchMatrix4A,
  );

  Matrix4.multiplyTransformation(
    computedModelMatrix,
    tile.content.worldTransform,
    computedModelMatrix,
  );

  // toLocal is inverse(rootTransform) only. tileset.modelMatrix is already
  // factored into computedModelMatrix via tile.computedTransform, so its effect
  // is baked directly into the splat values rather than split into the draw
  // command's modelMatrix. This keeps czm_view * modelMatrix numerically small,
  // avoiding float32 precision loss at ECEF-scale translations.
  const toLocal = Matrix4.inverse(rootTransform, scratchMatrix4C);
  const transform = Matrix4.multiplyTransformation(
    toLocal,
    computedModelMatrix,
    scratchMatrix4A,
  );
  const cachedTransform = tile.content._lastSplatTransform;
  if (
    tile.content._transformed &&
    defined(cachedTransform) &&
    Matrix4.equalsEpsilon(transform, cachedTransform, TRANSFORM_CACHE_EPSILON)
  ) {
    return;
  }
  const positions = tile.content.positions;
  const rotations = tile.content.rotations;
  const scales = tile.content.scales;

  // Extract the rotation quaternion from transform once, before the per-splat
  // loop. The columns of transform's upper-left 3x3 have magnitude ≈ 1 (rigid
  // body placement), so normalizing is numerically stable. We cannot decompose
  // the per-splat combined matrix (transform × TRS_i) instead, because each
  // splat's scale can be very small, causing catastrophic cancellation when
  // dividing to recover a pure rotation matrix.
  const col0Len = Math.sqrt(
    transform[0] * transform[0] +
      transform[1] * transform[1] +
      transform[2] * transform[2],
  );
  const col1Len = Math.sqrt(
    transform[4] * transform[4] +
      transform[5] * transform[5] +
      transform[6] * transform[6],
  );
  const col2Len = Math.sqrt(
    transform[8] * transform[8] +
      transform[9] * transform[9] +
      transform[10] * transform[10],
  );
  scratchMatrix3[0] = transform[0] / col0Len;
  scratchMatrix3[1] = transform[1] / col0Len;
  scratchMatrix3[2] = transform[2] / col0Len;
  scratchMatrix3[3] = transform[4] / col1Len;
  scratchMatrix3[4] = transform[5] / col1Len;
  scratchMatrix3[5] = transform[6] / col1Len;
  scratchMatrix3[6] = transform[8] / col2Len;
  scratchMatrix3[7] = transform[9] / col2Len;
  scratchMatrix3[8] = transform[10] / col2Len;
  const dot01 =
    scratchMatrix3[0] * scratchMatrix3[3] +
    scratchMatrix3[1] * scratchMatrix3[4] +
    scratchMatrix3[2] * scratchMatrix3[5];
  const dot02 =
    scratchMatrix3[0] * scratchMatrix3[6] +
    scratchMatrix3[1] * scratchMatrix3[7] +
    scratchMatrix3[2] * scratchMatrix3[8];
  const dot12 =
    scratchMatrix3[3] * scratchMatrix3[6] +
    scratchMatrix3[4] * scratchMatrix3[7] +
    scratchMatrix3[5] * scratchMatrix3[8];
  const hasUnitScale =
    Math.abs(col0Len - 1.0) <= UNIT_SCALE_FAST_PATH_EPSILON &&
    Math.abs(col1Len - 1.0) <= UNIT_SCALE_FAST_PATH_EPSILON &&
    Math.abs(col2Len - 1.0) <= UNIT_SCALE_FAST_PATH_EPSILON;
  const isOrthogonal =
    Math.abs(dot01) <= RIGID_TRANSFORM_EPSILON &&
    Math.abs(dot02) <= RIGID_TRANSFORM_EPSILON &&
    Math.abs(dot12) <= RIGID_TRANSFORM_EPSILON;
  const determinant =
    scratchMatrix3[0] *
      (scratchMatrix3[4] * scratchMatrix3[8] -
        scratchMatrix3[5] * scratchMatrix3[7]) -
    scratchMatrix3[3] *
      (scratchMatrix3[1] * scratchMatrix3[8] -
        scratchMatrix3[2] * scratchMatrix3[7]) +
    scratchMatrix3[6] *
      (scratchMatrix3[1] * scratchMatrix3[5] -
        scratchMatrix3[2] * scratchMatrix3[4]);
  const useFastPath =
    hasUnitScale &&
    isOrthogonal &&
    Math.abs(determinant - 1.0) <= RIGID_TRANSFORM_EPSILON;
  Quaternion.fromRotationMatrix(scratchMatrix3, scratchTransformQuat);
  Quaternion.normalize(scratchTransformQuat, scratchTransformQuat);
  const attributePositions = ModelUtility.getAttributeBySemantic(
    gltfPrimitive,
    VertexAttributeSemantic.POSITION,
  ).typedArray;

  const attributeRotations = ModelUtility.getAttributeBySemantic(
    gltfPrimitive,
    VertexAttributeSemantic.ROTATION,
  ).typedArray;

  const attributeScales = ModelUtility.getAttributeBySemantic(
    gltfPrimitive,
    VertexAttributeSemantic.SCALE,
  ).typedArray;

  const position = scratchTransformPosition;
  const rotation = scratchTransformRotation;
  const scale = scratchTransformScale;
  for (let i = 0; i < attributePositions.length / 3; ++i) {
    position.x = attributePositions[i * 3];
    position.y = attributePositions[i * 3 + 1];
    position.z = attributePositions[i * 3 + 2];

    rotation.x = attributeRotations[i * 4];
    rotation.y = attributeRotations[i * 4 + 1];
    rotation.z = attributeRotations[i * 4 + 2];
    rotation.w = attributeRotations[i * 4 + 3];

    scale.x = attributeScales[i * 3];
    scale.y = attributeScales[i * 3 + 1];
    scale.z = attributeScales[i * 3 + 2];

    if (useFastPath) {
      Matrix4.multiplyByPoint(transform, position, position);
      Quaternion.multiply(scratchTransformQuat, rotation, rotation);
      Quaternion.normalize(rotation, rotation);
    } else {
      Matrix4.fromTranslationQuaternionRotationScale(
        position,
        rotation,
        scale,
        scratchMatrix4D,
      );

      Matrix4.multiplyTransformation(
        transform,
        scratchMatrix4D,
        scratchMatrix4D,
      );

      Matrix4.getTranslation(scratchMatrix4D, position);
      Matrix4.getScale(scratchMatrix4D, scale);
      // rotation still holds the original splat quaternion from attributeRotations.
      // Apply the transform's rotation by left-multiplying the transform quaternion.
      Quaternion.multiply(scratchTransformQuat, rotation, rotation);
      Quaternion.normalize(rotation, rotation);
    }

    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;

    rotations[i * 4] = rotation.x;
    rotations[i * 4 + 1] = rotation.y;
    rotations[i * 4 + 2] = rotation.z;
    rotations[i * 4 + 3] = rotation.w;

    scales[i * 3] = scale.x;
    scales[i * 3 + 1] = scale.y;
    scales[i * 3 + 2] = scale.z;
  }
  tile.content._lastSplatTransform = Matrix4.clone(
    transform,
    tile.content._lastSplatTransform,
  );
  tile.content._transformed = true;
};

/**
 * 为原始对象生成高斯 splat 纹理。
 * 此方法根据 splat 属性（位置、缩放、旋转、颜色）创建纹理，并相应地更新原始对象的状态。
 * 拥有该原始对象的对象。
 *
 * @see {@link GaussianSplatTextureGenerator}
 *
 * @param {GaussianSplatPrimitive} primitive 当前帧状态。
 * @param {FrameState} frameState 当前帧状态快照正在生成中。
 * @param {GaussianSplatPrimitive.Snapshot} snapshot 正在填充快照。
 * @private
 */
GaussianSplatPrimitive.generateSplatTexture = function (
  primitive,
  frameState,
  snapshot,
) {
  if (!defined(snapshot) || snapshot.state !== SnapshotState.BUILDING) {
    return;
  }
  snapshot.state = SnapshotState.TEXTURE_PENDING;
  const promise = GaussianSplatTextureGenerator.generateFromAttributes({
    attributes: {
      positions: new Float32Array(snapshot.positions),
      scales: new Float32Array(snapshot.scales),
      rotations: new Float32Array(snapshot.rotations),
      colors: new Uint8Array(snapshot.colors),
    },
    count: snapshot.numSplats,
  });
  if (!defined(promise)) {
    snapshot.state = SnapshotState.BUILDING;
    return;
  }
  void processGeneratedSplatTextureData(
    primitive,
    frameState,
    snapshot,
    promise,
  );
};

/**
 * 为高斯 splat 原始对象构建绘制命令。
 * 此方法设置着色器程序、渲染状态和顶点数组，以渲染高斯 splats。
 * 它还配置渲染所需的属性和统一变量。
 *
 * @param {GaussianSplatPrimitive} primitive
 * @param {FrameState} frameState
 *
 * @private
 */
GaussianSplatPrimitive.buildGSplatDrawCommand = function (
  primitive,
  frameState,
) {
  const tileset = primitive._tileset;
  const renderResources = new GaussianSplatRenderResources(primitive);
  const { shaderBuilder } = renderResources;
  const renderStateOptions = renderResources.renderStateOptions;

  // Splats are inherently translucent, so TRANSLUCENT (like INHERIT) keeps the
  // dedicated GAUSSIAN_SPLATS pass. Routing them through Pass.TRANSLUCENT would
  // darken them under OIT, which premultiplies the already-premultiplied color.
  let drawPass = Pass.GAUSSIAN_SPLATS;
  if (
    primitive._customShader.translucencyMode ===
    CustomShaderTranslucencyMode.OPAQUE
  ) {
    drawPass = Pass.CESIUM_3D_TILE;
    renderStateOptions.blending = BlendingState.DISABLED;
    renderStateOptions.depthMask = true;
  }

  shaderBuilder.addAttribute("vec2", "a_screenQuadPosition");
  shaderBuilder.addAttribute("float", "a_splatIndex");
  shaderBuilder.addVarying("vec4", "v_splatColor");
  shaderBuilder.addVarying("vec2", "v_vertPos");
  shaderBuilder.addUniform(
    "float",
    "u_splitDirection",
    ShaderDestination.VERTEX,
  );
  shaderBuilder.addVarying("float", "v_splitDirection");
  shaderBuilder.addUniform(
    "highp usampler2D",
    "u_splatAttributeTexture",
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addUniform(
    "float",
    "u_sphericalHarmonicsDegree",
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addUniform("float", "u_splatScale", ShaderDestination.VERTEX);

  shaderBuilder.addUniform(
    "vec3",
    "u_cameraPositionWC",
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addUniform(
    "mat3",
    "u_inverseModelRotation",
    ShaderDestination.VERTEX,
  );

  const uniformMap = renderResources.uniformMap;
  // GaussianSplatRenderResources builds the combined (base + custom shader)
  // uniform map without mutating the primitive; store it back here in the
  // caller so later custom shader changes can prune stale uniform entries.
  primitive._uniformMap = uniformMap;

  // Row-addressing uniforms: read from primitive each draw so they stay in sync
  // with the texture width chosen for the current snapshot.
  shaderBuilder.addUniform("int", "u_splatRowMask", ShaderDestination.VERTEX);
  shaderBuilder.addUniform("int", "u_splatRowShift", ShaderDestination.VERTEX);

  const textureCache = primitive.gaussianSplatTexture;
  uniformMap.u_splatAttributeTexture = function () {
    return textureCache;
  };
  uniformMap.u_splatRowMask = function () {
    return primitive._splatRowMask;
  };
  uniformMap.u_splatRowShift = function () {
    return primitive._splatRowShift;
  };

  if (primitive._sphericalHarmonicsDegree > 0) {
    shaderBuilder.addDefine(
      "HAS_SPHERICAL_HARMONICS",
      "1",
      ShaderDestination.VERTEX,
    );
    shaderBuilder.addUniform(
      "highp usampler2D",
      "u_sphericalHarmonicsTexture",
      ShaderDestination.VERTEX,
    );
    uniformMap.u_sphericalHarmonicsTexture = function () {
      return primitive.sphericalHarmonicsTexture;
    };
  }
  uniformMap.u_sphericalHarmonicsDegree = function () {
    return primitive._sphericalHarmonicsDegree;
  };

  uniformMap.u_cameraPositionWC = function () {
    return Cartesian3.clone(frameState.camera.positionWC);
  };

  uniformMap.u_inverseModelRotation = function () {
    // SH coefficients are encoded in the GLB Y-up training space. To evaluate
    // them the world-space view direction must be rotated by
    //   inverse(computedTransform × axisCorrectionMatrix × worldTransform).
    // This matrix is pre-computed each snapshot rebuild and stored on the
    // primitive so the uniform closure just returns the cached value.
    return primitive._shInverseRotation;
  };

  uniformMap.u_splitDirection = function () {
    return primitive.splitDirection;
  };

  // Feature ID support: declare varyings, texture uniform, and defines for
  // each feature ID set so custom shaders can reference featureId_0..N.
  const featureIdCount = primitive._featureIdCount;
  if (primitive._hasFeatureIds && featureIdCount > 0) {
    shaderBuilder.addDefine(
      "HAS_FEATURE_IDS",
      undefined,
      ShaderDestination.BOTH,
    );
    shaderBuilder.addDefine(
      "FEATURE_ID_COUNT",
      `${featureIdCount}`,
      ShaderDestination.BOTH,
    );

    // Declare one flat int varying per feature ID set.
    for (let i = 0; i < featureIdCount; i++) {
      shaderBuilder.addVarying("int", `v_featureId_${i}`, "flat");
    }

    // Feature ID texture uniform.
    shaderBuilder.addUniform(
      "highp usampler2D",
      "u_featureIdTexture",
      ShaderDestination.VERTEX,
    );
    uniformMap.u_featureIdTexture = function () {
      return primitive._splatFeatureIdTexture;
    };
  }

  const instanceCount = defined(primitive._indexes)
    ? primitive._indexes.length
    : primitive._numSplats;
  renderResources.instanceCount = instanceCount;
  renderResources.count = 4;
  renderResources.primitiveType = PrimitiveType.TRIANGLE_STRIP;
  shaderBuilder.addVertexLines(GaussianSplatVS);
  shaderBuilder.addFragmentLines(GaussianSplatFS);
  let shaderProgram;
  try {
    shaderProgram = shaderBuilder.buildShaderProgram(frameState.context);
    // Shader programs are compiled lazily on first bind. Force compilation
    // here so custom shader errors are reported through the compilation event.
    shaderProgram._bind();
  } catch (error) {
    if (defined(shaderProgram)) {
      shaderProgram.destroy();
    }
    primitive._customShaderCompilationEvent.raiseEvent(error);
    throw error;
  }
  primitive._customShaderCompilationEvent.raiseEvent();
  let renderState = clone(
    RenderState.fromCache(renderResources.renderStateOptions),
    true,
  );

  renderState.cull.face = ModelUtility.getCullFace(
    tileset.modelMatrix,
    PrimitiveType.TRIANGLE_STRIP,
  );

  renderState = RenderState.fromCache(renderState);
  const splatQuadAttrLocations = {
    screenQuadPosition: 0,
    splatIndex: 2,
  };

  const idxAttr = new ModelComponents.Attribute();
  idxAttr.name = "_SPLAT_INDEXES";
  idxAttr.typedArray = primitive._indexes;
  idxAttr.componentDatatype = ComponentDatatype.UNSIGNED_INT;
  idxAttr.type = AttributeType.SCALAR;
  idxAttr.normalized = false;
  idxAttr.count = renderResources.instanceCount;
  idxAttr.constant = 0;
  idxAttr.instanceDivisor = 1;

  const needsRebuild =
    !defined(primitive._vertexArray) ||
    primitive._indexes.length > primitive._vertexArrayLen;
  if (needsRebuild) {
    const geometry = new Geometry({
      attributes: {
        screenQuadPosition: new GeometryAttribute({
          componentDatatype: ComponentDatatype.FLOAT,
          componentsPerAttribute: 2,
          values: [-1, -1, 1, -1, 1, 1, -1, 1],
          name: "_SCREEN_QUAD_POS",
          variableName: "screenQuadPosition",
        }),
        splatIndex: { ...idxAttr, variableName: "splatIndex" },
      },
      primitiveType: PrimitiveType.TRIANGLE_STRIP,
    });

    primitive._vertexArray = VertexArray.fromGeometry({
      context: frameState.context,
      geometry: geometry,
      attributeLocations: splatQuadAttrLocations,
      bufferUsage: BufferUsage.DYNAMIC_DRAW,
      interleave: false,
    });
  } else {
    primitive._vertexArray
      .getAttribute(1)
      .vertexBuffer.copyFromArrayView(primitive._indexes);
  }

  primitive._vertexArrayLen = primitive._indexes.length;

  // The draw command uses rootTransform as its modelMatrix. tileset.modelMatrix
  // is baked into the splat positions by transformTile and must not appear here
  // as well. This keeps czm_view * modelMatrix numerically small (ENU frame),
  // avoiding float32 precision loss from ECEF-scale translations.
  const modelMatrix = Matrix4.clone(
    primitive._rootTransform,
    primitive._drawCommandModelMatrix,
  );

  const vertexArrayCache = primitive._vertexArray;
  const command = new DrawCommand({
    boundingVolume: tileset.boundingSphere,
    modelMatrix: modelMatrix,
    uniformMap: uniformMap,
    renderState: renderState,
    vertexArray: vertexArrayCache,
    shaderProgram: shaderProgram,
    cull: renderStateOptions.cull.enabled,
    pass: drawPass,
    count: renderResources.count,
    owner: primitive,
    instanceCount: renderResources.instanceCount,
    primitiveType: PrimitiveType.TRIANGLE_STRIP,
    debugShowBoundingVolume: tileset.debugShowBoundingVolume,
    castShadows: false,
    receiveShadows: false,
  });

  // Release the previous draw command's shader program. Programs built by
  // ShaderBuilder come from the ShaderCache, which defers the actual GL
  // deletion, so a command already queued this frame can still render.
  const previousCommand = primitive._drawCommand;
  if (defined(previousCommand?.shaderProgram)) {
    previousCommand.shaderProgram.destroy();
  }

  primitive._drawCommand = command;
  primitive._shaderDirty = false;
};

/**
 * 更新当前帧的高斯 splat 原始对象。
 * 此方法根据当前帧状态检查是否需要更新原始对象，
 * 如果需要，则处理选中的瓦片，聚合其属性，
 * 并在必要时生成高斯 splat 纹理。
 * 它还处理 splat 索引的排序，并构建渲染绘制命令。
 *
 * @param {FrameState} frameState
 * @private
 */
GaussianSplatPrimitive.prototype.update = function (frameState) {
  const tileset = this._tileset;

  const targetCustomShader = defined(tileset.customShader)
    ? tileset.customShader
    : GaussianSplatPrimitive.DefaultCustomShader;
  if (this._customShader !== targetCustomShader) {
    this.customShader = tileset.customShader;
  }

  // Update the custom shader in case it has texture uniforms.
  this._customShader.update(frameState);

  if (
    this._shaderDirty &&
    defined(this._drawCommand) &&
    defined(this._indexes) &&
    defined(this.gaussianSplatTexture)
  ) {
    GaussianSplatPrimitive.buildGSplatDrawCommand(this, frameState);
  }

  releaseRetiredTextures(this, frameState.frameNumber);

  if (!tileset.show) {
    return;
  }

  if (this._drawCommand) {
    frameState.commandList.push(this._drawCommand);
  }

  if (tileset._modelMatrixChanged) {
    this._dirty = true;
    return;
  }
  const hasRootTransform = defined(this._rootTransform);

  if (frameState.passes.pick === true) {
    return;
  }

  if (this.splitDirection !== tileset.splitDirection) {
    this.splitDirection = tileset.splitDirection;
  }
  const camera = frameState.camera;
  if (!defined(camera)) {
    return;
  }

  if (this._sorterState === GaussianSplatSortingState.IDLE) {
    const selectedTilesChanged =
      tileset._selectedTiles.length !== 0 &&
      haveSelectedTilesChanged(this, tileset._selectedTiles);
    if (tileset._selectedTiles.length === 0) {
      this._selectedTilesStableFrames = 0;
      this._needsSnapshotRebuild = false;
      this._snapshotRebuildStallFrames = 0;
    } else if (selectedTilesChanged) {
      this._selectedTilesStableFrames = 0;
    } else {
      this._selectedTilesStableFrames++;
    }
    if (selectedTilesChanged || this._dirty) {
      this._needsSnapshotRebuild = true;
    }
    const isStable = this._selectedTilesStableFrames >= DEFAULT_STABLE_FRAMES;
    const isBootstrap =
      !defined(this._snapshot) &&
      !defined(this._pendingSnapshot) &&
      !defined(this._drawCommand);
    // This prevents an indefinite wait if selected tiles never settle completely.
    // In practice, this is the upper bound on "wait-for-stability" before forcing
    // a rebuild to avoid visible starvation.
    if (this._needsSnapshotRebuild && tileset._selectedTiles.length !== 0) {
      this._snapshotRebuildStallFrames++;
    } else {
      this._snapshotRebuildStallFrames = 0;
    }
    const allowRebuild =
      isStable ||
      isBootstrap ||
      this._snapshotRebuildStallFrames >= DEFAULT_MAX_SNAPSHOT_STALL_FRAMES;
    const hasPendingWork =
      this._dirty ||
      this._needsSnapshotRebuild ||
      selectedTilesChanged ||
      defined(this._pendingSnapshot) ||
      defined(this._pendingSortPromise) ||
      !defined(this._drawCommand);
    if (
      !hasPendingWork &&
      Matrix4.equals(camera.viewMatrix, this._prevViewMatrix)
    ) {
      return;
    }

    if (
      tileset._selectedTiles.length !== 0 &&
      this._needsSnapshotRebuild &&
      allowRebuild
    ) {
      this._splatDataGeneration++;
      this._activeSort = undefined;
      this._sorterPromise = undefined;
      this._sorterState = GaussianSplatSortingState.IDLE;
      this._pendingSortPromise = undefined;
      this._pendingSort = undefined;
      if (defined(this._pendingSnapshot)) {
        destroySnapshotTextures(this._pendingSnapshot);
      }

      const tiles = tileset._selectedTiles;

      // Rebuild the ENU origin from the current tileset world center so that
      // baked splat positions remain in a numerically small (meter-scale) local
      // frame, regardless of the current tileset.modelMatrix value.
      this._rootTransform = FixedFrameTransforms.eastNorthUpToFixedFrame(
        tileset.boundingSphere.center,
      );

      // Compute the SH inverse rotation from the first tile's coordinate frame.
      // SH coefficients are encoded in the GLB Y-up training space. To evaluate
      // them correctly the view direction must be transformed by
      //   inverse(computedTransform × axisCorrectionMatrix × worldTransform).
      // All tiles in a typical GS tileset share the same root coordinate frame,
      // so using the first tile is sufficient.
      {
        const ft = tiles[0];
        const shFwd = Matrix4.multiplyTransformation(
          ft.computedTransform,
          this._axisCorrectionMatrix,
          scratchMatrix4C,
        );
        Matrix4.multiplyTransformation(
          shFwd,
          ft.content.worldTransform ?? Matrix4.IDENTITY,
          shFwd,
        );
        Matrix4.getRotation(
          Matrix4.inverse(shFwd, shFwd),
          this._shInverseRotation,
        );
      }

      for (const tile of tiles) {
        GaussianSplatPrimitive.transformTile(tile);
      }

      const totalElements = tiles.reduce(
        (total, tile) => total + tile.content.pointsLength,
        0,
      );
      const aggregateAttributeValues = (
        key,
        componentDatatype,
        getAttributeCallback,
        numberOfComponents,
      ) => {
        let aggregate;
        let offset = 0;
        let requiredLength = 0;
        for (const tile of tiles) {
          const attribute = getAttributeCallback(tile.content);
          const componentsPerAttribute = defined(numberOfComponents)
            ? numberOfComponents
            : AttributeType.getNumberOfComponents(attribute.type);
          const buffer = defined(attribute.typedArray)
            ? attribute.typedArray
            : attribute;
          requiredLength += buffer.length;
          if (!defined(aggregate)) {
            aggregate = acquireAggregateScratchBuffer(
              this,
              key,
              componentDatatype,
              totalElements * componentsPerAttribute,
            );
          }
        }

        if (!defined(aggregate)) {
          return ComponentDatatype.createTypedArray(componentDatatype, 0);
        }

        for (const tile of tiles) {
          const content = tile.content;
          const attribute = getAttributeCallback(content);
          const buffer = defined(attribute.typedArray)
            ? attribute.typedArray
            : attribute;
          aggregate.set(buffer, offset);
          offset += buffer.length;
        }
        return trimAggregateScratchBuffer(aggregate, requiredLength);
      };

      const aggregateShData = () => {
        // Determine the SH degree from the first tile with SH data so we can
        // pre-allocate the aggregate buffer once, outside the tile loop.
        let coefs = 0;
        for (const tile of tiles) {
          if (tile.content.sphericalHarmonicsDegree > 0) {
            switch (tile.content.sphericalHarmonicsDegree) {
              case 1:
                coefs = 9;
                break;
              case 2:
                coefs = 24;
                break;
              case 3:
                coefs = 45;
                break;
            }
            break;
          }
        }

        if (coefs === 0) {
          return undefined;
        }

        const requiredLength = totalElements * (coefs * (2 / 3));

        // Re-use the class-level scratch buffer when it is already large
        // enough, avoiding a fresh allocation (and eventual GC) every frame.
        if (
          !defined(this._scratchAggregateShBuffer) ||
          this._scratchAggregateShBuffer.length < requiredLength
        ) {
          this._scratchAggregateShBuffer = new Uint32Array(requiredLength);
        }
        const aggregate = this._scratchAggregateShBuffer;

        let offset = 0;
        for (const tile of tiles) {
          const tileShData = tile.content.packedSphericalHarmonicsData;
          if (tile.content.sphericalHarmonicsDegree > 0) {
            aggregate.set(tileShData, offset);
            offset += tileShData.length;
          }
        }

        // Return a correctly-sized view so downstream consumers see the
        // exact element count they expect.
        if (offset < aggregate.length) {
          return aggregate.subarray(0, offset);
        }
        return aggregate;
      };

      const positions = aggregateAttributeValues(
        "positions",
        ComponentDatatype.FLOAT,
        (content) => content.positions,
        3,
      );

      const scales = aggregateAttributeValues(
        "scales",
        ComponentDatatype.FLOAT,
        (content) => content.scales,
        3,
      );

      const rotations = aggregateAttributeValues(
        "rotations",
        ComponentDatatype.FLOAT,
        (content) => content.rotations,
        4,
      );

      const colors = aggregateAttributeValues(
        "colors",
        ComponentDatatype.UNSIGNED_BYTE,
        (content) =>
          ModelUtility.getAttributeBySemantic(
            content.gltfPrimitive,
            VertexAttributeSemantic.COLOR,
          ),
      );

      // Aggregate feature ID sets from all tiles so custom shaders can
      // reference featureId_0 through featureId_N. Only up to
      // MAX_FEATURE_ID_SETS sets are supported because the feature ID texture
      // and vertex shader address a single RGBA texel (4 IDs) per splat.
      const availableFeatureIdCount = tiles.reduce(
        (max, t) => Math.max(max, t.content.featureIdCount ?? 0),
        0,
      );
      const maxFeatureIdCount = Math.min(
        availableFeatureIdCount,
        MAX_FEATURE_ID_SETS,
      );
      if (availableFeatureIdCount > MAX_FEATURE_ID_SETS) {
        oneTimeWarning(
          "GaussianSplatFeatureIdSetsExceeded",
          `This tileset has ${availableFeatureIdCount} feature ID sets, but Gaussian splats currently support at most ${MAX_FEATURE_ID_SETS}. Only the first ${MAX_FEATURE_ID_SETS} sets (featureId_0..featureId_${MAX_FEATURE_ID_SETS - 1}) will be available in custom shaders.`,
        );
      }
      let allFeatureIds;
      if (maxFeatureIdCount > 0) {
        allFeatureIds = [];
        for (let setIdx = 0; setIdx < maxFeatureIdCount; setIdx++) {
          const fids = new Uint32Array(totalElements);
          let offset = 0;
          for (const tile of tiles) {
            const tileAllFids = tile.content.allFeatureIds;
            const count = tile.content.pointsLength;
            if (
              defined(tileAllFids) &&
              setIdx < tileAllFids.length &&
              defined(tileAllFids[setIdx])
            ) {
              fids.set(tileAllFids[setIdx], offset);
            }
            offset += count;
          }
          allFeatureIds.push(fids);
        }
      }

      const sphericalHarmonicsDegree =
        tiles[0].content.sphericalHarmonicsDegree;
      const shCoefficientCount =
        sphericalHarmonicsDegree > 0
          ? tiles[0].content.sphericalHarmonicsCoefficientCount
          : 0;
      const shData = aggregateShData();

      this._pendingSnapshot = {
        generation: this._splatDataGeneration,
        positions: positions,
        rotations: rotations,
        scales: scales,
        colors: colors,
        allFeatureIds: allFeatureIds,
        featureIdCount: maxFeatureIdCount,
        featureIdTexture: undefined,
        shData: shData,
        sphericalHarmonicsDegree: sphericalHarmonicsDegree,
        shCoefficientCount: shCoefficientCount,
        numSplats: totalElements,
        indexes: undefined,
        gaussianSplatTexture: undefined,
        sphericalHarmonicsTexture: undefined,
        lastTextureWidth: 0,
        lastTextureHeight: 0,
        splatRowMask: 0, // set by processGeneratedSplatTextureData
        splatRowShift: 0, // set by processGeneratedSplatTextureData
        state: SnapshotState.BUILDING,
      };

      this.selectedTileLength = tileset._selectedTiles.length;
      this._selectedTileSet = new Set(tileset._selectedTiles);
      this._dirty = false;
      this._needsSnapshotRebuild = false;
      this._snapshotRebuildStallFrames = 0;
    }

    if (defined(this._pendingSnapshot)) {
      const pending = this._pendingSnapshot;
      if (pending.state === SnapshotState.BUILDING) {
        GaussianSplatPrimitive.generateSplatTexture(this, frameState, pending);
        return;
      }
      if (pending.state === SnapshotState.TEXTURE_PENDING) {
        return;
      }
      if (
        pending.state === SnapshotState.TEXTURE_READY &&
        !defined(pending.gaussianSplatTexture)
      ) {
        return;
      }

      if (!hasRootTransform) {
        return;
      }

      Matrix4.clone(camera.viewMatrix, this._prevViewMatrix);
      Matrix4.multiply(camera.viewMatrix, this._rootTransform, scratchMatrix4A);

      if (
        pending.state === SnapshotState.TEXTURE_READY &&
        !defined(this._pendingSortPromise)
      ) {
        const requestId = ++this._sortRequestId;
        const dataGeneration = this._splatDataGeneration;
        this._pendingSort = {
          requestId: requestId,
          dataGeneration: dataGeneration,
          expectedCount: pending.numSplats,
          snapshot: pending,
        };
        const sortPromise = GaussianSplatSorter.radixSortIndexes({
          primitive: {
            positions: new Float32Array(pending.positions),
            modelView: Float32Array.from(scratchMatrix4A),
            count: pending.numSplats,
          },
          sortType: "Index",
        });
        if (!defined(sortPromise)) {
          this._pendingSortPromise = undefined;
          this._pendingSort = undefined;
          pending.state = SnapshotState.TEXTURE_READY;
          return;
        }
        this._pendingSortPromise = sortPromise;
        pending.state = SnapshotState.SORTING;
        const pendingSort = this._pendingSort;
        void resolvePendingSnapshotSort(
          this,
          frameState,
          pendingSort,
          sortPromise,
        );
        return;
      }

      if (!defined(this._pendingSortPromise)) {
        if (pending.state === SnapshotState.SORTING) {
          pending.state = SnapshotState.TEXTURE_READY;
        }
        return;
      }
      return;
    }

    if (this._numSplats === 0) {
      return;
    }

    if (!hasRootTransform) {
      return;
    }

    Matrix4.clone(camera.viewMatrix, this._prevViewMatrix);
    Matrix4.multiply(camera.viewMatrix, this._rootTransform, scratchMatrix4A);

    if (!defined(this._sorterPromise)) {
      if (!shouldStartSteadySort(this, frameState)) {
        return;
      }
      const requestId = ++this._sortRequestId;
      const dataGeneration = this._splatDataGeneration;
      const expectedCount = this._numSplats;
      this._activeSort = {
        requestId: requestId,
        dataGeneration: dataGeneration,
        expectedCount: expectedCount,
      };
      const rawPromise = GaussianSplatSorter.radixSortIndexes({
        primitive: {
          positions: new Float32Array(this._positions),
          modelView: Float32Array.from(scratchMatrix4A),
          count: this._numSplats,
        },
        sortType: "Index",
      });
      this._sorterPromise = rawPromise;
      if (defined(rawPromise)) {
        markSteadySortStart(this, frameState);
        const activeSort = this._activeSort;
        this._sorterState = GaussianSplatSortingState.SORTING;
        void resolveSteadySort(this, activeSort, rawPromise);
        return;
      }
    }

    if (!defined(this._sorterPromise)) {
      this._sorterState = GaussianSplatSortingState.WAITING;
      return;
    }
    this._sorterState = GaussianSplatSortingState.SORTING;
    return;
  } else if (this._sorterState === GaussianSplatSortingState.WAITING) {
    if (!defined(this._sorterPromise)) {
      const requestId = ++this._sortRequestId;
      const dataGeneration = this._splatDataGeneration;
      const expectedCount = this._numSplats;
      this._activeSort = {
        requestId: requestId,
        dataGeneration: dataGeneration,
        expectedCount: expectedCount,
      };
      const rawPromise = GaussianSplatSorter.radixSortIndexes({
        primitive: {
          positions: new Float32Array(this._positions),
          modelView: Float32Array.from(scratchMatrix4A),
          count: this._numSplats,
        },
        sortType: "Index",
      });
      this._sorterPromise = rawPromise;
      if (defined(rawPromise)) {
        markSteadySortStart(this, frameState);
        const activeSort = this._activeSort;
        this._sorterState = GaussianSplatSortingState.SORTING;
        void resolveSteadySort(this, activeSort, rawPromise);
        return;
      }
    }
    if (!defined(this._sorterPromise)) {
      this._sorterState = GaussianSplatSortingState.WAITING;
      return;
    }
    this._sorterState = GaussianSplatSortingState.SORTING;
    return;
  } else if (this._sorterState === GaussianSplatSortingState.SORTING) {
    return; //still sorting, wait for next frame
  } else if (this._sorterState === GaussianSplatSortingState.SORTED) {
    //update the draw command if sorted
    GaussianSplatPrimitive.buildGSplatDrawCommand(this, frameState);
    this._sorterState = GaussianSplatSortingState.IDLE; //reset state for next frame
    this._dirty = false;
    this._sorterPromise = undefined; //reset promise for next frame
    this._activeSort = undefined;
  } else if (this._sorterState === GaussianSplatSortingState.ERROR) {
    throw this._sorterError;
  }

  this._dirty = false;
};

export default GaussianSplatPrimitive;