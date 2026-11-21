import {
  AttributeCompression,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Check,
  Color,
  DeveloperError,
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
import ContextLimits from "../Renderer/ContextLimits.js";
import Sampler from "../Renderer/Sampler.js";
import Texture from "../Renderer/Texture.js";
import ClippingPlane from "./ClippingPlane.js";

/**
 * 指定一组裁剪平面。这些裁剪平面会选择性地禁用指定列表中的 {@link ClippingPlane} 对象在单个 gltf 模型、3D Tileset 或地球仪上的渲染。
 * outside of the specified list of {@link ClippingPlane} objects for a single gltf model, 3D Tileset, or the globe.
 * <p>
 * 对于 3D Tiles，使用根瓦片的变换来定位裁剪平面。如果未定义变换，则使用根瓦片的 {@link Cesium3DTile#boundingSphere}。
 * 具有以下属性的物体：
 * </p>
 * <p>
 * ] 用于选择性地禁用每个平面外部渲染的 {@link ClippingPlane} 对象数组。
 * </p>
 *
 * @alias ClippingPlaneCollection
 * @constructor
 *
 * @param {object} [options] 确定裁剪平面是否处于活动状态。
 * @param {ClippingPlane[]} [options.planes=[]] An array of {@link ClippingPlane} objects used to selectively disable rendering on the outside of each plane.
 * @param {boolean} [options.enabled=true] 如果为真，则任何位于集合中所有平面外部的区域都会被裁剪；否则，只有位于所有平面外部的区域才会被裁剪。
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 用于突出显示被裁剪物体边缘的颜色。
 * @param {boolean} [options.unionClippingRegions=false] 用于突出显示被裁剪物体边缘的亮度的像素宽度。
 * @param {Color} [options.edgeColor=Color.WHITE] // 该裁剪平面的距离为正，意味着其法线
 * @param {number} [options.edgeWidth=0.0] // 指向原点。这将裁剪所有位于平面后面的内容。
 *
 * @demo {@link https://sandcastle.cesium.com/?id=3d-tiles-clipping-planes|Clipping 3D Tiles and glTF models.}
 * @demo {@link https://sandcastle.cesium.com/?id=terrain-clipping-planes|Clipping the Globe.}
 *
 * @example
 * // 平面，即 y 坐标小于 -5 的所有内容。
 * const clippingPlanes = new Cesium.ClippingPlaneCollection({
 * planes : [
 * new Cesium.ClippingPlane(new Cesium.Cartesian3(0.0, 1.0, 0.0), 5.0)
 * // 创建一个实体并将 ClippingPlaneCollection 附加到模型上。
 * const entity = viewer.entities.add({
 *     ],
 * });
 * position : Cesium.Cartesian3.fromDegrees(-123.0744619, 44.0503706, 10000),
 * model : {
 * uri : 'model.gltf',
 * minimumPixelSize : 128,
 * maximumScale : 20000,
 * clippingPlanes : clippingPlanes
 * viewer.zoomTo(entity);
 * 指定相对于裁剪平面原始坐标系的额外变换的 4x4 变换矩阵。
 *     }
 * });
 * 用于突出显示被裁剪物体边缘的颜色。
 */
function ClippingPlaneCollection(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._planes = [];

  // Do partial texture updates if just one plane is dirty.
  // If many planes are dirty, refresh the entire texture.
  this._dirtyIndex = -1;
  this._multipleDirtyPlanes = false;

  this._enabled = options.enabled ?? true;

  /**
   * 用于突出显示被裁剪物体边缘的亮度的像素宽度。
   * 当集合中添加新的裁剪平面时触发的事件。事件处理程序
   *
   * @type {Matrix4}
   * @default Matrix4.IDENTITY
   */
  this.modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);

  /**
   * The color applied to highlight the edge along which an object is clipped.
   *
   * @type {Color}
   * @default Color.WHITE
   */
  this.edgeColor = Color.clone(options.edgeColor ?? Color.WHITE);

  /**
   * The width, in pixels, of the highlight applied to the edge along which an object is clipped.
   *
   * @type {number}
   * @default 0.0
   */
  this.edgeWidth = options.edgeWidth ?? 0.0;

  /**
   * An event triggered when a new clipping plane is added to the collection.  Event handlers
   * 传递新的平面及其添加的索引。
   * @type {Event}
   * @readonly
   */
  this.planeAdded = new Event();

  /**
   * 当新的裁剪平面从集合中移除时触发的事件。事件处理程序
   * 传递新的平面及其移除的索引。
   * @type {Event}
   * @readonly
   */
  this.planeRemoved = new Event();

  // If this ClippingPlaneCollection has an owner, only its owner should update or destroy it.
  // This is because in a Cesium3DTileset multiple models may reference the tileset's ClippingPlaneCollection.
  this._owner = undefined;

  const unionClippingRegions = options.unionClippingRegions ?? false;
  this._unionClippingRegions = unionClippingRegions;
  this._testIntersection = unionClippingRegions
    ? unionIntersectFunction
    : defaultIntersectFunction;

  this._uint8View = undefined;
  this._float32View = undefined;

  this._clippingPlanesTexture = undefined;

  // Add each ClippingPlane object.
  const planes = options.planes;
  if (defined(planes)) {
    const planesLength = planes.length;
    for (let i = 0; i < planesLength; ++i) {
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

Object.defineProperties(ClippingPlaneCollection.prototype, {
  /**
   * 返回该集合中平面的数量。此函数通常与
   * {@link ClippingPlaneCollection#get} 一起使用，以遍历集合中的所有平面。
   * 在集合中。
   *
   * @memberof ClippingPlaneCollection.prototype
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._planes.length;
    },
  },

  /**
   * 如果为 true，如果某个区域位于集合中任何平面的外部，则该区域将被裁剪。否则，只有该区域位于所有平面的外部时才会被裁剪。
   * 才进行裁剪。
   * 如果为 true，则启用裁剪功能。
   *
   * @memberof ClippingPlaneCollection.prototype
   * @type {boolean}
   * @default false
   */
  unionClippingRegions: {
    get: function () {
      return this._unionClippingRegions;
    },
    set: function (value) {
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
   * 返回包含打包且未转换的裁剪平面的纹理。
   *
   * @memberof ClippingPlaneCollection.prototype
   * @type {boolean}
   * @default true
   */
  enabled: {
    get: function () {
      return this._enabled;
    },
    set: function (value) {
      if (this._enabled === value) {
        return;
      }
      this._enabled = value;
    },
  },

  /**
   * ClippingPlaneCollection 的拥有者引用（如果存在）。
   *
   * @memberof ClippingPlaneCollection.prototype
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
   * 封装此 ClippingPlaneCollection 状态的数字。
   *
   * @memberof ClippingPlaneCollection.prototype
   * @readonly
   * @private
   */
  owner: {
    get: function () {
      return this._owner;
    },
  },

  /**
   * 裁剪模式通过数字的符号编码，该数字即平面数量。
   *
   * 如果此值发生变化，则需要对着色器进行重新生成。
   * 描述 ClippingPlaneCollection 状态的数字。
   *
   * @memberof ClippingPlaneCollection.prototype
   * @returns {number} A 将指定的 {@link ClippingPlane} 添加到集合中，用于选择性地禁用每个平面的外部渲染。使用 {@link ClippingPlaneCollection#unionClippingRegions} 来修改多个平面的裁剪行为。
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

function setIndexDirty(collection, index) {
  // If there's already a different _dirtyIndex set, more than one plane has changed since update.
  // Entire texture must be reloaded
  collection._multipleDirtyPlanes =
    collection._multipleDirtyPlanes ||
    (collection._dirtyIndex !== -1 && collection._dirtyIndex !== index);
  collection._dirtyIndex = index;
}

/**
 * 将指定的 {@link ClippingPlane} 添加到集合中。
 * 在集合中。使用 {@link ClippingPlaneCollection#length} 来遍历集合中的所有平面。
 * 在集合中。
 *
 * @param {ClippingPlane} plane 要添加到集合中的裁剪平面。
 *
 * @see ClippingPlaneCollection#unionClippingRegions
 * @see ClippingPlaneCollection#remove
 * @see ClippingPlaneCollection#removeAll
 */
ClippingPlaneCollection.prototype.add = function (plane) {
  const newPlaneIndex = this._planes.length;

  const that = this;
  plane.onChangeCallback = function (index) {
    setIndexDirty(that, index);
  };
  plane.index = newPlaneIndex;

  setIndexDirty(this, newPlaneIndex);
  this._planes.push(plane);
  this.planeAdded.raiseEvent(plane, newPlaneIndex);
};

/**
 * 返回集合中指定索引的平面。索引从零开始，并随着平面的添加而增加。移除一个平面会将所有平面向左移动，从而改变它们的索引。此函数通常与
 * {@link ClippingPlaneCollection#length} 一起使用，以遍历集合中的所有平面。
 * 在集合中。
 * {@link ClippingPlaneCollection#length} to iterate over all the planes
 * 指定索引下的裁剪平面。
 *
 * @param {number} index 检查该集合是否包含与给定裁剪平面相等的裁剪平面。
 * @returns {ClippingPlane} The 要检查的裁剪平面。
 *
 * @see ClippingPlaneCollection#length
 */
ClippingPlaneCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  return this._planes[index];
};

function indexOf(planes, plane) {
  const length = planes.length;
  for (let i = 0; i < length; ++i) {
    if (Plane.equals(planes[i], plane)) {
      return i;
    }
  }

  return -1;
}

/**
 * 如果集合中包含该裁剪平面，则返回 true；否则返回 false。
 *
 * @param {ClippingPlane} [clippingPlane] 如果集合中包含该裁剪平面，则移除首次出现的该裁剪平面；否则返回 false。
 * @returns {boolean} true 从集合中移除首次出现的给定裁剪平面。如果未找到该平面，则返回 <code>false</code>。
 *
 * @see ClippingPlaneCollection#get
 */
ClippingPlaneCollection.prototype.contains = function (clippingPlane) {
  return indexOf(this._planes, clippingPlane) !== -1;
};

/**
 * 从集合中移除所有平面。
 *
 * @param {ClippingPlane} clippingPlane
 * @returns {boolean} <code>true</code> 当 {@link Viewer} 或 {@link CesiumWidget} 渲染场景时调用此函数，以构建裁剪平面的资源。
 *
 * @see ClippingPlaneCollection#add
 * @see ClippingPlaneCollection#contains
 * @see ClippingPlaneCollection#removeAll
 */
ClippingPlaneCollection.prototype.remove = function (clippingPlane) {
  const planes = this._planes;
  const index = indexOf(planes, clippingPlane);

  if (index === -1) {
    return false;
  }

  // Unlink this ClippingPlaneCollection from the ClippingPlane
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

  // Indicate planes texture is dirty
  this._multipleDirtyPlanes = true;
  planes.length = length;

  this.planeRemoved.raiseEvent(clippingPlane, index);

  return true;
};

/**
 * 确定此 ClippingPlaneCollection 实例的平面与指定 {@link TileBoundingVolume} 之间的类型交集。
 *
 * @see ClippingPlaneCollection#add
 * @see ClippingPlaneCollection#remove
 */
ClippingPlaneCollection.prototype.removeAll = function () {
  // Dereference this ClippingPlaneCollection from all ClippingPlanes
  const planes = this._planes;
  const planesCount = planes.length;
  for (let i = 0; i < planesCount; ++i) {
    const plane = planes[i];
    if (plane instanceof ClippingPlane) {
      plane.onChangeCallback = undefined;
      plane.index = -1;
    }
    this.planeRemoved.raiseEvent(plane, i);
  }
  this._multipleDirtyPlanes = true;
  this._planes = [];
};

const distanceEncodeScratch = new Cartesian4();
const oct32EncodeScratch = new Cartesian4();
function packPlanesAsUint8(clippingPlaneCollection, startIndex, endIndex) {
  const uint8View = clippingPlaneCollection._uint8View;
  const planes = clippingPlaneCollection._planes;
  let byteIndex = 0;
  for (let i = startIndex; i < endIndex; ++i) {
    const plane = planes[i];

    const oct32Normal = AttributeCompression.octEncodeToCartesian4(
      plane.normal,
      oct32EncodeScratch,
    );
    uint8View[byteIndex] = oct32Normal.x;
    uint8View[byteIndex + 1] = oct32Normal.y;
    uint8View[byteIndex + 2] = oct32Normal.z;
    uint8View[byteIndex + 3] = oct32Normal.w;

    const encodedDistance = Cartesian4.packFloat(
      plane.distance,
      distanceEncodeScratch,
    );
    uint8View[byteIndex + 4] = encodedDistance.x;
    uint8View[byteIndex + 5] = encodedDistance.y;
    uint8View[byteIndex + 6] = encodedDistance.z;
    uint8View[byteIndex + 7] = encodedDistance.w;

    byteIndex += 8;
  }
}

// Pack starting at the beginning of the buffer to allow partial update
function packPlanesAsFloats(clippingPlaneCollection, startIndex, endIndex) {
  const float32View = clippingPlaneCollection._float32View;
  const planes = clippingPlaneCollection._planes;

  let floatIndex = 0;
  for (let i = startIndex; i < endIndex; ++i) {
    const plane = planes[i];
    const normal = plane.normal;

    float32View[floatIndex] = normal.x;
    float32View[floatIndex + 1] = normal.y;
    float32View[floatIndex + 2] = normal.z;
    float32View[floatIndex + 3] = plane.distance;

    floatIndex += 4; // each plane is 4 floats
  }
}

function computeTextureResolution(pixelsNeeded, result) {
  const maxSize = ContextLimits.maximumTextureSize;
  result.x = Math.min(pixelsNeeded, maxSize);
  result.y = Math.ceil(pixelsNeeded / result.x);
  return result;
}

const textureResolutionScratch = new Cartesian2();
/**
 * Called when {@link Viewer} or {@link CesiumWidget} render the scene to
 * build the resources for clipping planes.
 * <p>
 * Do not call this function directly.
 * </p>
 */
ClippingPlaneCollection.prototype.update = function (frameState) {
  let clippingPlanesTexture = this._clippingPlanesTexture;
  const context = frameState.context;
  const useFloatTexture = ClippingPlaneCollection.useFloatTexture(context);

  // Compute texture requirements for current planes
  // In RGBA FLOAT, A plane is 4 floats packed to a RGBA.
  // In RGBA UNSIGNED_BYTE, A plane is a float in [0, 1) packed to RGBA and an Oct32 quantized normal,
  // so 8 bytes or 2 pixels in RGBA.
  const pixelsNeeded = useFloatTexture ? this.length : this.length * 2;

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

  // If there are no clipping planes, there's nothing to update.
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

    if (useFloatTexture) {
      clippingPlanesTexture = new Texture({
        context: context,
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
    } else {
      clippingPlanesTexture = new Texture({
        context: context,
        width: requiredResolution.x,
        height: requiredResolution.y,
        pixelFormat: PixelFormat.RGBA,
        pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
        sampler: Sampler.NEAREST,
        flipY: false,
      });
      this._uint8View = new Uint8Array(
        requiredResolution.x * requiredResolution.y * 4,
      );
    }

    this._clippingPlanesTexture = clippingPlanesTexture;
    this._multipleDirtyPlanes = true;
  }

  const dirtyIndex = this._dirtyIndex;
  if (!this._multipleDirtyPlanes && dirtyIndex === -1) {
    return;
  }
  if (!this._multipleDirtyPlanes) {
    // partial updates possible
    let offsetX;
    let offsetY;
    if (useFloatTexture) {
      offsetY = Math.floor(dirtyIndex / clippingPlanesTexture.width);
      offsetX = Math.floor(dirtyIndex - offsetY * clippingPlanesTexture.width);

      packPlanesAsFloats(this, dirtyIndex, dirtyIndex + 1);
      clippingPlanesTexture.copyFrom({
        source: {
          width: 1,
          height: 1,
          arrayBufferView: this._float32View,
        },
        xOffset: offsetX,
        yOffset: offsetY,
      });
    } else {
      offsetY = Math.floor((dirtyIndex * 2) / clippingPlanesTexture.width);
      offsetX = Math.floor(
        dirtyIndex * 2 - offsetY * clippingPlanesTexture.width,
      );
      packPlanesAsUint8(this, dirtyIndex, dirtyIndex + 1);
      clippingPlanesTexture.copyFrom({
        source: {
          width: 2,
          height: 1,
          arrayBufferView: this._uint8View,
        },
        xOffset: offsetX,
        yOffset: offsetY,
      });
    }
  } else if (useFloatTexture) {
    packPlanesAsFloats(this, 0, this._planes.length);
    clippingPlanesTexture.copyFrom({
      source: {
        width: clippingPlanesTexture.width,
        height: clippingPlanesTexture.height,
        arrayBufferView: this._float32View,
      },
    });
  } else {
    packPlanesAsUint8(this, 0, this._planes.length);
    clippingPlanesTexture.copyFrom({
      source: {
        width: clippingPlanesTexture.width,
        height: clippingPlanesTexture.height,
        arrayBufferView: this._uint8View,
      },
    });
  }

  this._multipleDirtyPlanes = false;
  this._dirtyIndex = -1;
};

const scratchMatrix = new Matrix4();
const scratchPlane = new Plane(Cartesian3.UNIT_X, 0.0);
/**
 * Determines the type intersection with the planes of this ClippingPlaneCollection instance and the specified {@link TileBoundingVolume}.
 * @ignore
 *
 * @param {object} tileBoundingVolume 用于确定与平面相交的体积。
 * @param {Matrix4} [transform] 一个可选的额外矩阵，用于将平面转换为世界坐标。
 * @returns {Intersect} {@link Intersect.INSIDE} if the entire volume is on the side of the planes
 * 法线指向该方向且应完全渲染，参见 {@link Intersect.OUTSIDE}。
 * 如果整个体积位于平面外侧且被裁剪，则使用此参数。
 * {@link Intersect.INTERSECTING}，表示体积与平面相交。
 */
ClippingPlaneCollection.prototype.computeIntersectionWithBoundingVolume =
  function (tileBoundingVolume, transform) {
    const planes = this._planes;
    const length = planes.length;

    let modelMatrix = this.modelMatrix;
    if (defined(transform)) {
      modelMatrix = Matrix4.multiply(transform, modelMatrix, scratchMatrix);
    }

    // If the collection is not set to union the clipping regions, the volume must be outside of all planes to be
    // considered completely clipped. If the collection is set to union the clipping regions, if the volume can be
    // outside any the planes, it is considered completely clipped.
    // Lastly, if not completely clipped, if any plane is intersecting, more calculations must be performed.
    let intersection = Intersect.INSIDE;
    if (!this.unionClippingRegions && length > 0) {
      intersection = Intersect.OUTSIDE;
    }

    for (let i = 0; i < length; ++i) {
      const plane = planes[i];

      Plane.transform(plane, modelMatrix, scratchPlane); // ClippingPlane can be used for Plane math

      const value = tileBoundingVolume.intersectPlane(scratchPlane);
      if (value === Intersect.INTERSECTING) {
        intersection = value;
      } else if (this._testIntersection(value)) {
        return value;
      }
    }

    return intersection;
  };

/**
 * 如果没有其他所有者，则设置输入 ClippingPlaneCollection 的所有者。
 * 如果设置成功，则移除之前所有者的 ClippingPlaneCollection。
 *
 * @param {ClippingPlaneCollection} [clippingPlaneCollection] 一个附加到对象的 ClippingPlaneCollection（或 undefined）。
 * @param {object} owner 一个应接收新 ClippingPlaneCollection 的对象。
 * @param {string} key 对象用于引用 ClippingPlaneCollection 的键。
 * @ignore
 */
ClippingPlaneCollection.setOwner = function (
  clippingPlaneCollection,
  owner,
  key,
) {
  // Don't destroy the ClippingPlaneCollection if it is already owned by newOwner
  if (clippingPlaneCollection === owner[key]) {
    return;
  }
  // Destroy the existing ClippingPlaneCollection, if any
  owner[key] = owner[key] && owner[key].destroy();
  if (defined(clippingPlaneCollection)) {
    //>>includeStart('debug', pragmas.debug);
    if (defined(clippingPlaneCollection._owner)) {
      throw new DeveloperError(
        "ClippingPlaneCollection should only be assigned to one object",
      );
    }
    //>>includeEnd('debug');
    clippingPlaneCollection._owner = owner;
    owner[key] = clippingPlaneCollection;
  }
};

/**
 * 用于检查上下文是否允许使用浮点纹理进行平面裁剪的函数。
 *
 * @param {Context} context 包含被裁剪对象和裁剪纹理的上下文。
 * @returns {boolean} <code>true</code> 如果可以使用浮点纹理进行平面裁剪。
 * @private
 */
ClippingPlaneCollection.useFloatTexture = function (context) {
  return context.floatingPointTexture;
};

/**
 * 用于获取 Clipping Plane Collection 纹理分辨率的函数。
 * 如果 ClippingPlaneCollection 未更新，则返回根据当前平面数量将分配的分辨率。
 * 根据当前平面数量分配的分辨率。
 *
 * @param {ClippingPlaneCollection} clippingPlaneCollection Clipping Plane Collection
 * @param {Context} context 渲染上下文
 * @param {Cartesian2} result 结果的 Cartesian2 坐标。
 * @returns {Cartesian2} The 必需的分辨率。
 * @private
 */
ClippingPlaneCollection.getTextureResolution = function (
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

  const pixelsNeeded = ClippingPlaneCollection.useFloatTexture(context)
    ? clippingPlaneCollection.length
    : clippingPlaneCollection.length * 2;
  const requiredResolution = computeTextureResolution(pixelsNeeded, result);

  // Allocate twice as much space as needed to avoid frequent texture reallocation.
  requiredResolution.y *= 2;
  return requiredResolution;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 true。
 *
 * @see ClippingPlaneCollection#destroy
 */
ClippingPlaneCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而无需依赖垃圾收集器来销毁该对象。
 * 一旦对象被销毁，不应再使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * 表示对象被销毁，即调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 *
 * @example
 * clippingPlanes = clippingPlanes && clippingPlanes.destroy();
 *
 * @see ClippingPlaneCollection#isDestroyed
 */
ClippingPlaneCollection.prototype.destroy = function () {
  this._clippingPlanesTexture =
    this._clippingPlanesTexture && this._clippingPlanesTexture.destroy();
  return destroyObject(this);
};
export default ClippingPlaneCollection;