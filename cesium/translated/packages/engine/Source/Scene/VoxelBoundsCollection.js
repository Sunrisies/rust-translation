import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Check,
  Event,
  Frozen,
  Intersect,
  Matrix4,
  PixelDatatype,
  PixelFormat,
  Plane,
  defined,
  destroyObject,
} from "@cesium/core";
import ClippingPlane from "./ClippingPlane.js";
import ContextLimits from "../Renderer/ContextLimits.js";
import Sampler from "../Renderer/Sampler.js";
import Texture from "../Renderer/Texture.js";

/**
 * 指定了一组裁剪平面，用于定义 {@link VoxelPrimitive} 的渲染范围。
 *
 * @alias VoxelBoundsCollection
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {ClippingPlane[]} [options.planes=[]] 一个 {@link ClippingPlane} 对象的数组，用于选择性地禁用每个平面外侧的渲染。
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 4x4 变换矩阵，指定相对于裁剪平面原始坐标系的额外变换。
 * @param {boolean} [options.unionClippingRegions=false] 如果为 true，则位于集合中所有平面外侧的区域将被裁剪。否则，只有位于所有平面外侧的区域才会被裁剪。
 *
 * @private
 */
function VoxelBoundsCollection(options) {
  const {
    planes,
    modelMatrix = Matrix4.IDENTITY,
    unionClippingRegions = false,
  } = options ?? Frozen.EMPTY_OBJECT;

  this._planes = [];

  /**
   * 4x4 变换矩阵，指定相对于裁剪平面的额外变换。
   * 原始坐标系。
   *
   * @type {Matrix4}
   * @default Matrix4.IDENTITY
   */
  this.modelMatrix = Matrix4.clone(modelMatrix);

  /**
   * 当向集合中添加新的裁剪平面时触发的事件。事件处理程序
   * 会接收新平面及其添加索引。
   * @type {Event}
   * @readonly
   */
  this.planeAdded = new Event();

  /**
   * 当从集合中移除新的裁剪平面时触发的事件。事件处理程序
   * 会接收新平面及其移除索引。
   * @type {Event}
   * @readonly
   */
  this.planeRemoved = new Event();

  this._unionClippingRegions = unionClippingRegions;
  this._testIntersection = unionClippingRegions
    ? unionIntersectFunction
    : defaultIntersectFunction;

  this._float32View = undefined;

  this._clippingPlanesTexture = undefined;

  // Add each ClippingPlane object.
  if (defined(planes)) {
    for (let i = 0; i < planes.length; ++i) {
      this.add(planes[i]);
    }
  }
}

function unionIntersectFunction(value) {
  return value === Intersect.OUTSIDE;
}

function defaultIntersectFunction(value) {
  return value === Intersect.INSIDE;
}

Object.defineProperties(VoxelBoundsCollection.prototype, {
  /**
   * 返回该集合中平面的数量。通常与
   * {@link VoxelBoundsCollection#get} 一起使用，以遍历集合中的所有平面。
   * 在集合中的所有平面。
   *
   * @memberof VoxelBoundsCollection.prototype
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._planes.length;
    },
  },

  /**
   * 如果为 true，则位于集合中所有平面外侧的区域将被裁剪。否则，只有位于所有平面外侧的区域才会被裁剪。
   * 裁剪。否则，只有位于所有平面外侧的区域才会被裁剪。
   * 裁剪。
   *
   * @memberof VoxelBoundsCollection.prototype
   * @type {boolean}
   * @default false
   */
  unionClippingRegions: {
    get: function () {
      return this._unionClippingRegions;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("value", value);
      //>>includeEnd('debug');
      if (this._unionClippingRegions === value) {
        return;
      }
      this._unionClippingRegions = value;
      this._testIntersection = value
        ? unionIntersectFunction
        : defaultIntersectFunction;
    },
  },

  /**
   * 返回包含打包且未变换的裁剪平面的纹理。
   *
   * @memberof VoxelBoundsCollection.prototype
   * @type {Texture}
   * @readonly
   * @private
   */
  texture: {
    get: function () {
      return this._clippingPlanesTexture;
    },
  },

  /**
   * 返回封装此 VoxelBoundsCollection 状态的数字。
   *
   * 裁剪模式编码在数字的符号中，该数字即平面数量。
   * 如果此值发生变化，则需要进行着色器重新生成。
   *
   * @memberof VoxelBoundsCollection.prototype
   * @returns {number} A 描述 VoxelBoundsCollection 状态的数字。
   * @readonly
   * @private
   */
  clippingPlanesState: {
    get: function () {
      return this._unionClippingRegions
        ? this._planes.length
        : -this._planes.length;
    },
  },
});

/**
 * Adds the specified {@link ClippingPlane} to the collection to be used to selectively disable rendering
 * on the outside of each plane. Use {@link VoxelBoundsCollection#unionClippingRegions} to modify
 * 要添加到集合中的 ClippingPlane。
 *
 * @param {ClippingPlane} plane 要添加到集合中的 ClippingPlane。
 *
 * @see VoxelBoundsCollection#unionClippingRegions
 * @see VoxelBoundsCollection#remove
 * @see VoxelBoundsCollection#removeAll
 */
VoxelBoundsCollection.prototype.add = function (plane) {
  const newPlaneIndex = this._planes.length;
  plane.index = newPlaneIndex;
  this._planes.push(plane);
  this.planeAdded.raiseEvent(plane, newPlaneIndex);
};

/**
 * 返回集合中指定索引的平面。索引从零开始，并随着平面的添加而增加。移除一个平面会将所有平面左移
 * 一个位置，从而改变它们的索引。此函数通常与
 * {@link VoxelBoundsCollection#length} 一起使用，以遍历所有平面。
 * {@link VoxelBoundsCollection#length} to iterate over all the planes
 * 在该集合中。
 *
 * @param {number} index 平面的零基索引。
 * @returns {ClippingPlane} The 指定索引处的裁剪平面。
 *
 * @see VoxelBoundsCollection#length
 */
VoxelBoundsCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  return this._planes[index];
};

function indexOf(planes, plane) {
  for (let i = 0; i < planes.length; ++i) {
    if (Plane.equals(planes[i], plane)) {
      return i;
    }
  }
  return -1;
}

/**
 * 检查该集合是否包含与给定裁剪平面相同的裁剪平面。
 *
 * @param {ClippingPlane} [clippingPlane] 要检查的裁剪平面。
 * @returns {boolean} true 如果集合中包含该裁剪平面，返回 true；否则返回 false。
 *
 * @see VoxelBoundsCollection#get
 */
VoxelBoundsCollection.prototype.contains = function (clippingPlane) {
  return indexOf(this._planes, clippingPlane) !== -1;
};

/**
 * 从集合中移除首次出现的给定裁剪平面。
 *
 * @param {ClippingPlane} clippingPlane
 * @returns {boolean} <code>true</code> 如果平面被移除，返回 true；如果集合中未找到该平面，返回 <code>false</code>。
 *
 * @see VoxelBoundsCollection#add
 * @see VoxelBoundsCollection#contains
 * @see VoxelBoundsCollection#removeAll
 */
VoxelBoundsCollection.prototype.remove = function (clippingPlane) {
  const planes = this._planes;
  const index = indexOf(planes, clippingPlane);

  if (index === -1) {
    return false;
  }

  // Unlink this VoxelBoundsCollection from the ClippingPlane
  if (clippingPlane instanceof ClippingPlane) {
    clippingPlane.onChangeCallback = undefined;
    clippingPlane.index = -1;
  }

  // Shift and update indices
  const length = planes.length - 1;
  for (let i = index; i < length; ++i) {
    const planeToKeep = planes[i + 1];
    planes[i] = planeToKeep;
    if (planeToKeep instanceof ClippingPlane) {
      planeToKeep.index = i;
    }
  }

  planes.length = length;

  this.planeRemoved.raiseEvent(clippingPlane, index);

  return true;
};

/**
 * 从集合中移除所有平面。
 *
 * @see VoxelBoundsCollection#add
 * @see VoxelBoundsCollection#remove
 */
VoxelBoundsCollection.prototype.removeAll = function () {
  // Dereference this VoxelBoundsCollection from all ClippingPlanes
  const planes = this._planes;
  for (let i = 0; i < planes.length; ++i) {
    const plane = planes[i];
    if (plane instanceof ClippingPlane) {
      plane.onChangeCallback = undefined;
      plane.index = -1;
    }
    this.planeRemoved.raiseEvent(plane, i);
  }
  this._planes = [];
};

const scratchPlane = new Plane(Cartesian3.fromElements(1.0, 0.0, 0.0), 0.0);

// Pack starting at the beginning of the buffer to allow partial update
function transformAndPackPlanes(clippingPlaneCollection, transform) {
  const float32View = clippingPlaneCollection._float32View;
  const planes = clippingPlaneCollection._planes;

  let floatIndex = 0;
  for (let i = 0; i < planes.length; ++i) {
    const { normal, distance } = transformPlane(
      planes[i],
      transform,
      scratchPlane,
    );

    float32View[floatIndex] = normal.x;
    float32View[floatIndex + 1] = normal.y;
    float32View[floatIndex + 2] = normal.z;
    float32View[floatIndex + 3] = distance;

    floatIndex += 4; // each plane is 4 floats
  }
}

const scratchPlaneCartesian4 = new Cartesian4();
const scratchTransformedNormal = new Cartesian3();

function transformPlane(plane, transform, result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("plane", plane);
  Check.typeOf.object("transform", transform);
  //>>includeEnd('debug');

  const { normal, distance } = plane;
  const planeAsCartesian4 = Cartesian4.fromElements(
    normal.x,
    normal.y,
    normal.z,
    distance,
    scratchPlaneCartesian4,
  );
  let transformedPlane = Matrix4.multiplyByVector(
    transform,
    planeAsCartesian4,
    scratchPlaneCartesian4,
  );

  // Convert the transformed plane to Hessian Normal Form
  const transformedNormal = Cartesian3.fromCartesian4(
    transformedPlane,
    scratchTransformedNormal,
  );
  transformedPlane = Cartesian4.divideByScalar(
    transformedPlane,
    Cartesian3.magnitude(transformedNormal),
    scratchPlaneCartesian4,
  );

  return Plane.fromCartesian4(transformedPlane, result);
}

function computeTextureResolution(pixelsNeeded, result) {
  result.x = Math.min(pixelsNeeded, ContextLimits.maximumTextureSize);
  result.y = Math.ceil(pixelsNeeded / result.x);
  return result;
}

const textureResolutionScratch = new Cartesian2();
/**
 * 在 {@link Viewer} 或 {@link CesiumWidget} 将场景渲染为
 * 构建裁剪平面资源时调用此函数。
 * <p>
 * 不要直接调用此函数。
 * </p>
 */
VoxelBoundsCollection.prototype.update = function (frameState, transform) {
  let clippingPlanesTexture = this._clippingPlanesTexture;

  // Compute texture requirements for current planes
  // In RGBA FLOAT, a plane is 4 floats packed to a single RGBA pixel.
  const pixelsNeeded = this.length;

  if (defined(clippingPlanesTexture)) {
    const currentPixelCount =
      clippingPlanesTexture.width * clippingPlanesTexture.height;
    // Recreate the texture to double current requirement if it isn't big enough or is 4 times larger than it needs to be.
    // Optimization note: this isn't exactly the classic resizeable array algorithm
    // * not necessarily checking for resize after each add/remove operation
    // * random-access deletes instead of just pops
    // * alloc ops likely more expensive than demonstrable via big-O analysis
    if (
      currentPixelCount < pixelsNeeded ||
      pixelsNeeded < 0.25 * currentPixelCount
    ) {
      clippingPlanesTexture.destroy();
      clippingPlanesTexture = undefined;
      this._clippingPlanesTexture = undefined;
    }
  }

  // If there are no bound planes, there's nothing to update.
  if (this.length === 0) {
    return;
  }

  if (!defined(clippingPlanesTexture)) {
    const requiredResolution = computeTextureResolution(
      pixelsNeeded,
      textureResolutionScratch,
    );
    // Allocate twice as much space as needed to avoid frequent texture reallocation.
    // Allocate in the Y direction, since texture may be as wide as context texture support.
    requiredResolution.y *= 2;

    clippingPlanesTexture = new Texture({
      context: frameState.context,
      width: requiredResolution.x,
      height: requiredResolution.y,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.FLOAT,
      sampler: Sampler.NEAREST,
      flipY: false,
    });
    this._float32View = new Float32Array(
      requiredResolution.x * requiredResolution.y * 4,
    );

    this._clippingPlanesTexture = clippingPlanesTexture;
  }

  const { width, height } = clippingPlanesTexture;
  transformAndPackPlanes(this, transform);
  clippingPlanesTexture.copyFrom({
    source: {
      width: width,
      height: height,
      arrayBufferView: this._float32View,
    },
  });
};

/**
 * 用于获取裁剪平面集合的纹理分辨率的函数。
 * 如果 VoxelBoundsCollection 未更新，则返回基于当前平面数量将分配的分辨率。
 * 裁剪平面集合
 *
 * @param {VoxelBoundsCollection} clippingPlaneCollection 渲染上下文
 * @param {Context} context 结果使用的 Cartesian2 坐标。
 * @param {Cartesian2} result 必需的分辨率。
 * @returns {Cartesian2} The 如果此对象被销毁，返回 true；否则返回 false。
 * @private
 */
VoxelBoundsCollection.getTextureResolution = function (
  clippingPlaneCollection,
  context,
  result,
) {
  const texture = clippingPlaneCollection.texture;
  if (defined(texture)) {
    result.x = texture.width;
    result.y = texture.height;
    return result;
  }

  const pixelsNeeded = clippingPlaneCollection.length;
  const requiredResolution = computeTextureResolution(pixelsNeeded, result);

  // Allocate twice as much space as needed to avoid frequent texture reallocation.
  requiredResolution.y *= 2;
  return requiredResolution;
};

/**
 * 如果此对象被销毁，不应使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
 *
 * @returns {boolean} <code>true</code> 销毁此对象所持有的 WebGL 资源。销毁对象允许确定性的
 *
 * @see VoxelBoundsCollection#destroy
 */
VoxelBoundsCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 释放 WebGL 资源，而不是依赖垃圾收集器来销毁此对象。
 * 一旦对象被销毁，不应使用它；调用除
 * <br />
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * 对象被销毁，即调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This voxelBounds = voxelBounds && voxelBounds.destroy();
 *
 * @example
 * voxelBounds = voxelBounds && voxelBounds.destroy();
 *
 * @see VoxelBoundsCollection#isDestroyed
 */
VoxelBoundsCollection.prototype.destroy = function () {
  this._clippingPlanesTexture =
    this._clippingPlanesTexture && this._clippingPlanesTexture.destroy();
  return destroyObject(this);
};
export default VoxelBoundsCollection;