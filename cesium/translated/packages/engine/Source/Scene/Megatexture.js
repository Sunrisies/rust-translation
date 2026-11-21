import {
  Cartesian3,
  Check,
  DeveloperError,
  PixelDatatype,
  PixelFormat,
  RuntimeError,
  defined,
  destroyObject,
} from "@cesium/core";
import ContextLimits from "../Renderer/ContextLimits.js";
import MetadataComponentType from "./MetadataComponentType.js";
import Sampler from "../Renderer/Sampler.js";
import Texture3D from "../Renderer/Texture3D.js";
import TextureMagnificationFilter from "../Renderer/TextureMagnificationFilter.js";
import TextureMinificationFilter from "../Renderer/TextureMinificationFilter.js";
import TextureWrap from "../Renderer/TextureWrap.js";

/**
 * @alias Megatexture
 * @constructor
 *
 * @param {Context} context 创建 GPU 资源的上下文环境。
 * @param {Cartesian3} dimensions 瓦片各维度中的体素数量。
 * @param {number} channelCount 元数据中通道的数量。
 * @param {MetadataComponentType} componentType 元数据的组件类型。
 * @param {number} [availableTextureMemoryBytes=134217728] 纹理内存大小的上限，以字节为单位。
 *
 * @exception {RuntimeError} The GL 上下文不支持包含给定尺寸瓦片的足够大的 3D 纹理。
 * @exception {RuntimeError} Not 拥有足够的纹理内存来创建具有给定瓦片尺寸的百万级纹理。
 *
 * @private
 */
function Megatexture(
  context,
  dimensions,
  channelCount,
  componentType,
  availableTextureMemoryBytes = 134217728, // 128 MB
  tileCount,
) {
  // TODO there are a lot of texture packing rules, see https://github.com/CesiumGS/cesium/issues/9572
  const pixelDataType = getPixelDataType(componentType);
  const pixelFormat = getPixelFormat(channelCount);

  const bytesPerSample =
    channelCount * MetadataComponentType.getSizeInBytes(componentType);
  const textureDimension = Megatexture.get3DTextureDimension(
    dimensions,
    bytesPerSample,
    availableTextureMemoryBytes,
    tileCount,
  );

  const tileCounts = Cartesian3.divideComponents(
    textureDimension,
    dimensions,
    new Cartesian3(),
  );

  /**
   * @type {number}
   * @readonly
   */
  this.channelCount = channelCount;

  /**
   * @type {MetadataComponentType}
   * @readonly
   */
  this.componentType = componentType;

  /**
   * @type {number}
   * @readonly
   */
  this.textureMemoryByteLength =
    bytesPerSample *
    textureDimension.x *
    textureDimension.y *
    textureDimension.z;

  /**
   * @type {Cartesian3}
   * @readonly
   */
  this.tileCounts = Cartesian3.clone(tileCounts, new Cartesian3());

  /**
   * @type {Cartesian3}
   * @readonly
   */
  this.voxelCountPerTile = Cartesian3.clone(dimensions, new Cartesian3());

  /**
   * @type {number}
   * @readonly
   */
  this.maximumTileCount = tileCounts.x * tileCounts.y * tileCounts.z;

  /**
   * @type {Texture3D}
   * @readonly
   */
  this.texture = new Texture3D({
    context: context,
    pixelFormat: pixelFormat,
    pixelDatatype: pixelDataType,
    flipY: false,
    width: textureDimension.x,
    height: textureDimension.y,
    depth: textureDimension.z,
    sampler: new Sampler({
      wrapR: TextureWrap.CLAMP_TO_EDGE,
      wrapS: TextureWrap.CLAMP_TO_EDGE,
      wrapT: TextureWrap.CLAMP_TO_EDGE,
      minificationFilter: TextureMinificationFilter.LINEAR,
      magnificationFilter: TextureMagnificationFilter.LINEAR,
    }),
  });

  /**
   * @type {MegatextureNode[]}
   * @readonly
   */
  this.nodes = new Array(this.maximumTileCount);
  for (let tileIndex = 0; tileIndex < this.maximumTileCount; tileIndex++) {
    this.nodes[tileIndex] = new MegatextureNode(tileIndex);
  }
  for (let tileIndex = 0; tileIndex < this.maximumTileCount; tileIndex++) {
    const node = this.nodes[tileIndex];
    node.previousNode = tileIndex > 0 ? this.nodes[tileIndex - 1] : undefined;
    node.nextNode =
      tileIndex < this.maximumTileCount - 1
        ? this.nodes[tileIndex + 1]
        : undefined;
  }

  /**
   * @type {MegatextureNode}
   * @readonly
   */
  this.occupiedList = undefined;

  /**
   * @type {MegatextureNode}
   * @readonly
   */
  this.emptyList = this.nodes[0];

  /**
   * @type {number}
   * @readonly
   */
  this.occupiedCount = 0;

  this._nearestSampling = false;
}

Object.defineProperties(Megatexture.prototype, {
  /**
   * 获取或设置最近采样标志。
   * @memberof Megatexture.prototype
   * @type {boolean}
   */
  nearestSampling: {
    get: function () {
      return this._nearestSampling;
    },
    set: function (nearestSampling) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("nearestSampling", nearestSampling);
      //>>includeEnd('debug');
      if (this._nearestSampling === nearestSampling) {
        return;
      }
      if (nearestSampling) {
        this.texture.sampler = Sampler.NEAREST;
      } else {
        this.texture.sampler = new Sampler({
          wrapR: TextureWrap.CLAMP_TO_EDGE,
          wrapS: TextureWrap.CLAMP_TO_EDGE,
          wrapT: TextureWrap.CLAMP_TO_EDGE,
          minificationFilter: TextureMinificationFilter.LINEAR,
          magnificationFilter: TextureMagnificationFilter.LINEAR,
        });
      }
      this._nearestSampling = nearestSampling;
    },
  },
});

/**
 * 在百万级纹理中使用的像素数据类型。
 * TODO 支持更多功能。
 *
 * @param {MetadataComponentType} componentType 元数据的组件类型。
 * @returns {PixelDatatype} The 用于百万级纹理的像素数据类型。
 *
 * @private
 */
function getPixelDataType(componentType) {
  if (
    componentType === MetadataComponentType.FLOAT32 ||
    componentType === MetadataComponentType.FLOAT64
  ) {
    return PixelDatatype.FLOAT;
  } else if (componentType === MetadataComponentType.UINT8) {
    return PixelDatatype.UNSIGNED_BYTE;
  }
}

/**
 * 用于百万级纹理的像素格式。
 *
 * @param {number} channelCount 元数据中通道的数量。必须为 1 到 4 之间。
 * @returns {PixelFormat} The 用于百万级纹理的像素格式。
 *
 * @private
 */
function getPixelFormat(channelCount) {
  switch (channelCount) {
    case 1:
      return PixelFormat.RED;
    case 2:
      return PixelFormat.RG;
    case 3:
      return PixelFormat.RGB;
    case 4:
      return PixelFormat.RGBA;
  }
}

/**
 * @alias MegatextureNode
 * @constructor
 *
 * @param {number} index
 *
 * @private
 */
function MegatextureNode(index) {
  /**
   * @type {number}
   */
  this.index = index;

  /**
   * @type {MegatextureNode}
   */
  this.nextNode = undefined;

  /**
   * @type {MegatextureNode}
   */
  this.previousNode = undefined;
}

/**
 * 向百万级纹理中添加瓦片元数据数组。
 * @param {Array} data 要添加的数据。
 * @returns {number} The 瓦片在百万级纹理中的位置索引。
 *
 * @exception {DeveloperError} Trying 在没有空位时添加的内容。
 */
Megatexture.prototype.add = function (data) {
  if (this.isFull()) {
    throw new DeveloperError("Trying to add when there are no empty spots");
  }

  // remove head of empty list
  const node = this.emptyList;
  this.emptyList = this.emptyList.nextNode;
  if (defined(this.emptyList)) {
    this.emptyList.previousNode = undefined;
  }

  // make head of occupied list
  node.nextNode = this.occupiedList;
  if (defined(node.nextNode)) {
    node.nextNode.previousNode = node;
  }
  this.occupiedList = node;

  const index = node.index;
  this.writeDataToTexture(index, data);

  this.occupiedCount++;
  return index;
};

/**
 * @param {number} index
 * @exception {DeveloperError} Megatexture 超出范围的索引。
 */
Megatexture.prototype.remove = function (index) {
  if (index < 0 || index >= this.maximumTileCount) {
    throw new DeveloperError("Megatexture index out of bounds");
  }

  // remove from list
  const node = this.nodes[index];
  if (defined(node.previousNode)) {
    node.previousNode.nextNode = node.nextNode;
  }
  if (defined(node.nextNode)) {
    node.nextNode.previousNode = node.previousNode;
  }

  // make head of empty list
  node.nextNode = this.emptyList;
  if (defined(node.nextNode)) {
    node.nextNode.previousNode = node;
  }
  node.previousNode = undefined;
  this.emptyList = node;
  this.occupiedCount--;
};

/**
 * @returns {boolean}
 */
Megatexture.prototype.isFull = function () {
  return this.emptyList === undefined;
};

/**
 * 计算包含给定数量瓦片的 3D 纹理尺寸，或能在可用纹理内存中容纳的最大瓦片数量。
 * 该方法在类外部未使用，但为测试而暴露。
 * @param {Cartesian3} tileDimensions 一个瓦片在体素数量上的维度。
 * @param {number} bytesPerSample 每个体素样本所需的字节数。
 * @param {number} availableTextureMemoryBytes 纹理内存大小的上限，以字节为单位。
 * @param {number} [tileCount] tileset中总瓦片数量。
 * @returns {Cartesian3} The 计算出的 3D 纹理尺寸。
 *
 * @exception {RuntimeError} The GL 上下文不支持包含给定尺寸瓦片的足够大的 3D 纹理。
 * @exception {RuntimeError} Not 拥有足够的纹理内存来创建具有给定瓦片尺寸的百万级纹理。
 * @private
 */
Megatexture.get3DTextureDimension = function (
  tileDimensions,
  bytesPerSample,
  availableTextureMemoryBytes,
  tileCount,
) {
  const { maximum3DTextureSize } = ContextLimits;
  if (Cartesian3.maximumComponent(tileDimensions) > maximum3DTextureSize) {
    throw new RuntimeError(
      "The GL context does not support a 3D texture large enough to contain a tile with the given dimensions.",
    );
  }

  // Find the number of tiles we can fit.
  const tileSizeInBytes =
    bytesPerSample * tileDimensions.x * tileDimensions.y * tileDimensions.z;
  const maxTileCount = Math.floor(
    availableTextureMemoryBytes / tileSizeInBytes,
  );
  if (maxTileCount < 1) {
    throw new RuntimeError(
      "Not enough texture memory available to create a megatexture with the given tile dimensions.",
    );
  }

  if (defined(tileCount)) {
    tileCount = Math.min(tileCount, maxTileCount);
  } else {
    tileCount = maxTileCount;
  }

  // Sort the tile dimensions from largest to smallest.
  const sortedDimensions = Object.entries(tileDimensions).sort(
    (a, b) => b[1] - a[1],
  );

  // Compute the number of tiles that we can fit along each axis of a 3D texture,
  // starting from the largest texture the context can support
  const tilesPerDimension = sortedDimensions.map(([axis, dimension]) =>
    Math.floor(maximum3DTextureSize / dimension),
  );

  // Reduce the number of tiles along each dimension until the total number of
  // tiles is close to but not less than tileCount.
  // Start from the dimension along which the tiles are largest, since
  // along this dimension each removed slice will contain the most tiles.
  for (let i = 0; i < 3; i++) {
    const currentTileCount = getVolume(tilesPerDimension);
    if (currentTileCount < tileCount) {
      break;
    }
    const sliceDimensions = tilesPerDimension.slice();
    sliceDimensions.splice(i, 1);
    const tilesPerSlice = sliceDimensions[0] * sliceDimensions[1];
    const excessTiles = currentTileCount - tileCount;
    const slicesToRemove = Math.floor(excessTiles / tilesPerSlice);
    tilesPerDimension[i] -= slicesToRemove;
  }

  // Make sure we are less than maximumTileCount (to fit within memory)
  if (getVolume(tilesPerDimension) > maxTileCount) {
    tilesPerDimension[2] = Math.floor(
      maxTileCount / (tilesPerDimension[0] * tilesPerDimension[1]),
    );
  }

  // Compute the final texture dimensions
  const textureDimension = new Cartesian3();
  for (let i = 0; i < 3; i++) {
    const [axis, dimension] = sortedDimensions[i];
    textureDimension[axis] = tilesPerDimension[i] * dimension;
  }

  return textureDimension;
};

function getVolume(dimensionsArray) {
  return dimensionsArray.reduce((p, d) => p * d);
}

/**
 * 将瓦片元数据数组写入百万级纹理。
 * @param {number} index 瓦片在百万级纹理中的位置索引。
 * @param {Float32Array|Uint16Array|Uint8Array} tileData 要写入的数据。
 */
Megatexture.prototype.writeDataToTexture = function (index, tileData) {
  const { tileCounts, voxelCountPerTile } = this;

  const source = {
    arrayBufferView: tileData,
    width: voxelCountPerTile.x,
    height: voxelCountPerTile.y,
    depth: voxelCountPerTile.z,
  };

  const tilesPerZ = tileCounts.x * tileCounts.y;
  const iz = Math.floor(index / tilesPerZ);
  const remainder = index - iz * tilesPerZ;
  const iy = Math.floor(remainder / tileCounts.x);
  const ix = remainder - iy * tileCounts.x;

  const copyOptions = {
    source: source,
    xOffset: ix * voxelCountPerTile.x,
    yOffset: iy * voxelCountPerTile.y,
    zOffset: iz * voxelCountPerTile.z,
  };

  this.texture.copyFrom(copyOptions);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code>之外的任何函数将导致 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁；否则为 <code>false</code>。
 *
 * @see Megatexture#destroy
 */
Megatexture.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而不依赖垃圾收集器来销毁此对象。
 * 释放 WebGL 资源，而不是依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code>之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 按照示例方式，将返回值 (<code>undefined</code>) 赋给该对象。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see Megatexture#isDestroyed
 *
 * @example
 * megatexture = megatexture && megatexture.destroy();
 */
Megatexture.prototype.destroy = function () {
  this.texture = this.texture && this.texture.destroy();
  return destroyObject(this);
};

export default Megatexture;
