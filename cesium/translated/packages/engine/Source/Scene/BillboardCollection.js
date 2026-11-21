import {
  AttributeCompression,
  BoundingRectangle,
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Check,
  Color,
  ComponentDatatype,
  DeveloperError,
  Ellipsoid,
  EncodedCartesian3,
  Frozen,
  IndexDatatype,
  Math as CesiumMath,
  Matrix4,
  WebGLConstants,
  defined,
  destroyObject,
} from "@cesium/core";
import Buffer from "../Renderer/Buffer.js";
import BufferUsage from "../Renderer/BufferUsage.js";
import ContextLimits from "../Renderer/ContextLimits.js";
import DrawCommand from "../Renderer/DrawCommand.js";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import ShaderProgram from "../Renderer/ShaderProgram.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import VertexArrayFacade from "../Renderer/VertexArrayFacade.js";
import BillboardCollectionFS from "../Shaders/BillboardCollectionFS.js";
import BillboardCollectionVS from "../Shaders/BillboardCollectionVS.js";
import Billboard from "./Billboard.js";
import BlendingState from "./BlendingState.js";
import BlendOption from "./BlendOption.js";
import HeightReference, { isHeightReferenceClamp } from "./HeightReference.js";
import HorizontalOrigin from "./HorizontalOrigin.js";
import SceneMode from "./SceneMode.js";
import SDFSettings from "./SDFSettings.js";
import TextureAtlas from "../Renderer/TextureAtlas.js";
import VerticalOrigin from "./VerticalOrigin.js";

const SHOW_INDEX = Billboard.SHOW_INDEX;
const POSITION_INDEX = Billboard.POSITION_INDEX;
const PIXEL_OFFSET_INDEX = Billboard.PIXEL_OFFSET_INDEX;
const EYE_OFFSET_INDEX = Billboard.EYE_OFFSET_INDEX;
const HORIZONTAL_ORIGIN_INDEX = Billboard.HORIZONTAL_ORIGIN_INDEX;
const VERTICAL_ORIGIN_INDEX = Billboard.VERTICAL_ORIGIN_INDEX;
const SCALE_INDEX = Billboard.SCALE_INDEX;
const IMAGE_INDEX_INDEX = Billboard.IMAGE_INDEX_INDEX;
const COLOR_INDEX = Billboard.COLOR_INDEX;
const ROTATION_INDEX = Billboard.ROTATION_INDEX;
const ALIGNED_AXIS_INDEX = Billboard.ALIGNED_AXIS_INDEX;
const SCALE_BY_DISTANCE_INDEX = Billboard.SCALE_BY_DISTANCE_INDEX;
const TRANSLUCENCY_BY_DISTANCE_INDEX = Billboard.TRANSLUCENCY_BY_DISTANCE_INDEX;
const PIXEL_OFFSET_SCALE_BY_DISTANCE_INDEX =
  Billboard.PIXEL_OFFSET_SCALE_BY_DISTANCE_INDEX;
const DISTANCE_DISPLAY_CONDITION_INDEX = Billboard.DISTANCE_DISPLAY_CONDITION;
const DISABLE_DEPTH_DISTANCE = Billboard.DISABLE_DEPTH_DISTANCE;
const TEXTURE_COORDINATE_BOUNDS = Billboard.TEXTURE_COORDINATE_BOUNDS;
const SDF_INDEX = Billboard.SDF_INDEX;
const SPLIT_DIRECTION_INDEX = Billboard.SPLIT_DIRECTION_INDEX;
const NUMBER_OF_PROPERTIES = Billboard.NUMBER_OF_PROPERTIES;

const attributeLocations = {
  direction: 0,
  positionHighAndScale: 1,
  positionLowAndRotation: 2, // texture offset in w
  compressedAttribute0: 3,
  compressedAttribute1: 4,
  compressedAttribute2: 5,
  eyeOffset: 6, // texture range in w
  scaleByDistance: 7,
  pixelOffsetScaleByDistance: 8,
  compressedAttribute3: 9,
  textureCoordinateBoundsOrLabelTranslate: 10,
  a_batchId: 11,
  sdf: 12,
  splitDirection: 13,
};

/**
 * 一个可渲染的广告牌集合。这些广告牌与视口对齐。
 * 位于3D场景中的图像。
 * <br /><br />
 * <div align='center'>
 * <img src='Images/Billboard.png' width='400' height='300' /><br />
 * 示例广告牌
 * </div>
 * <br /><br />
 * 使用 {@link BillboardCollection#add} 和 {@link BillboardCollection#remove} 添加或移除集合中的广告牌。集合中的广告牌会自动共享纹理。
 * and {@link BillboardCollection#remove}.  Billboards in a collection automatically share textures
 * 对于具有相同标识符的图像。
 *
 * @alias BillboardCollection
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 将每个广告牌从模型坐标转换为世界坐标的4x4变换矩阵。
 * @param {boolean} [options.debugShowBoundingVolume=false] 仅用于调试。确定该基本体的命令边界球是否显示。
 * @param {Scene} [options.scene] 对于使用高度参考属性的广告牌，必须传入此参数，否则将针对地球球体进行深度测试。
 * @param {BlendOption} [options.blendOption=BlendOption.OPAQUE_AND_TRANSLUCENT] 广告牌混合选项。默认值为
 * 用于渲染不透明和半透明广告牌。然而，如果所有广告牌完全不透明或完全半透明，
 * 将技术设置为 BlendOption.OPAQUE 或 BlendOption.TRANSLUCENT 可以将性能提高至2倍。
 * @param {boolean} [options.show=true] 确定集合中的广告牌是否显示。
 * @param {number} [options.coarseDepthTestDistance] 相机距离，超过该距离后，广告牌将针对地球球体椭球体的近似模型进行深度测试，而非完整的地球深度缓冲区。如果未指定，默认值相对于 {@link Ellipsoid.default} 的值确定。
 * @param {number} [options.threePointDepthTestDistance] 相机距离，在此范围内，具有 {@link Billboard#heightReference} 值为 {@link HeightReference.CLAMP_TO_GROUND} 或 {@link HeightReference.CLAMP_TO_TERRAIN} 的广告牌将针对三个关键点进行深度测试。这确保如果广告牌的任何关键点可见，则整个广告牌也可见。如果未指定，默认值相对于 {@link Ellipsoid.default} 的值确定。
 * @performance For 为了最佳性能，建议采用少数多个广告牌的集合，每个集合包含许多广告牌。组织集合时，将具有相同更新频率的广告牌放在同一集合中，即不
 * 变化的广告牌应放在一个集合中；每帧都变化的广告牌应放在另一个集合中；等等。
 * // 创建一个包含两个广告牌的广告牌集合
 * change should be in one collection; billboards that change every frame should be in another
 * collection; and so on.
 *
 * @see BillboardCollection#add
 * @see BillboardCollection#remove
 * @see Billboard
 * @see LabelCollection
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=billboards|Cesium Sandcastle Billboard Demo}
 *
 * @example
 * // Create a billboard collection with two billboards
 * const billboards = scene.primitives.add(new Cesium.BillboardCollection());
 * billboards.add({
 * position : new Cesium.Cartesian3(1.0, 2.0, 3.0),
 * image : 'url/to/image'
 * });
 * billboards.add({
 * position : new Cesium.Cartesian3(4.0, 5.0, 6.0),
 * image : 'url/to/another/image'
 * });
 */
function BillboardCollection(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._scene = options.scene;
  this._batchTable = options.batchTable;

  let textureAtlas = options.textureAtlas; // Hidden option for internal use
  if (!defined(textureAtlas)) {
    textureAtlas = new TextureAtlas();
  }
  this._textureAtlas = textureAtlas;
  this._textureAtlasGUID = textureAtlas.guid;
  this._destroyTextureAtlas = true;
  this._billboardTextureCache = new Map();

  this._sp = undefined;
  this._spTranslucent = undefined;
  this._rsOpaque = undefined;
  this._rsTranslucent = undefined;
  this._vaf = undefined;

  this._billboards = [];
  this._billboardsToUpdate = [];
  this._billboardsToUpdateIndex = 0;
  this._billboardsRemoved = false;
  this._createVertexArray = false;

  this._shaderRotation = false;
  this._compiledShaderRotation = false;

  this._shaderAlignedAxis = false;
  this._compiledShaderAlignedAxis = false;

  this._shaderScaleByDistance = false;
  this._compiledShaderScaleByDistance = false;

  this._shaderTranslucencyByDistance = false;
  this._compiledShaderTranslucencyByDistance = false;

  this._shaderPixelOffsetScaleByDistance = false;
  this._compiledShaderPixelOffsetScaleByDistance = false;

  this._shaderDistanceDisplayCondition = false;
  this._compiledShaderDistanceDisplayCondition = false;

  this._shaderDisableDepthDistance = false;
  this._compiledShaderDisableDepthDistance = false;

  this._shaderClampToGround = false;
  this._compiledShaderClampToGround = false;

  this._propertiesChanged = new Uint32Array(NUMBER_OF_PROPERTIES);

  this._maxSize = 0.0;
  this._maxEyeOffset = 0.0;
  this._maxScale = 1.0;
  this._maxPixelOffset = 0.0;
  this._allHorizontalCenter = true;
  this._allVerticalCenter = true;
  this._allSizedInMeters = true;

  this._baseVolume = new BoundingSphere();
  this._baseVolumeWC = new BoundingSphere();
  this._baseVolume2D = new BoundingSphere();
  this._boundingVolume = new BoundingSphere();
  this._boundingVolumeDirty = false;

  this._colorCommands = [];

  this._allBillboardsReady = false;

  /**
   * 决定此集合中的广告牌是否显示。
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  /**
   * 将此集合中的每个广告牌从模型坐标转换为世界坐标的 4x4 变换矩阵。
   * 当该矩阵为单位矩阵时，广告牌将以世界坐标绘制，即地球 WGS84 坐标。
   * 可以通过提供不同的变换矩阵来使用本地参考框架，例如
   * {@link Transforms.eastNorthUpToFixedFrame} 返回的矩阵。
   *
   * @type {Matrix4}
   * @default {@link Matrix4.IDENTITY}
   *
   *
   * @example
   * const center = Cesium.Cartesian3.fromDegrees(-75.59777, 40.03883);
   * billboards.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(center);
   * billboards.add({
   * image : 'url/to/image',
   * position : new Cesium.Cartesian3(0.0, 0.0, 0.0) // center
   * });
   * billboards.add({
   * image : 'url/to/image',
   * position : new Cesium.Cartesian3(1000000.0, 0.0, 0.0) // east
   * });
   * billboards.add({
   * image : 'url/to/image',
   * position : new Cesium.Cartesian3(0.0, 1000000.0, 0.0) // north
   * });
   * billboards.add({
   * image : 'url/to/image',
   * position : new Cesium.Cartesian3(0.0, 0.0, 1000000.0) // up
   * });
   *
   * @see Transforms.eastNorthUpToFixedFrame
   */
  this.modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);
  this._modelMatrix = Matrix4.clone(Matrix4.IDENTITY);

  /**
   * 此属性仅用于调试；不用于生产环境，也未经过优化。
   * <p>
   * 绘制primitive中每个绘制命令的边界球体。
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;

  /**
   * 此属性仅用于调试；不用于生产环境，也未经过优化。
   * <p>
   * 将此 BillboardCollection 的纹理图集作为全屏四边形绘制出来。
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowTextureAtlas = options.debugShowTextureAtlas ?? false;

  /**
   * 广告牌混合选项。默认设置适用于渲染不透明和半透明广告牌。
   * 然而，如果所有广告牌完全不透明或完全半透明，
   * 将技术设置为 BlendOption.OPAQUE 或 BlendOption.TRANSLUCENT 可以提升
   * 性能高达 2 倍。
   * @type {BlendOption}
   * @default BlendOption.OPAQUE_AND_TRANSLUCENT
   */
  this.blendOption = options.blendOption ?? BlendOption.OPAQUE_AND_TRANSLUCENT;
  this._blendOption = undefined;

  this._mode = SceneMode.SCENE3D;

  // The buffer usage for each attribute is determined based on the usage of the attribute over time.
  this._buffersUsage = [
    BufferUsage.STATIC_DRAW, // SHOW_INDEX
    BufferUsage.STATIC_DRAW, // POSITION_INDEX
    BufferUsage.STATIC_DRAW, // PIXEL_OFFSET_INDEX
    BufferUsage.STATIC_DRAW, // EYE_OFFSET_INDEX
    BufferUsage.STATIC_DRAW, // HORIZONTAL_ORIGIN_INDEX
    BufferUsage.STATIC_DRAW, // VERTICAL_ORIGIN_INDEX
    BufferUsage.STATIC_DRAW, // SCALE_INDEX
    BufferUsage.STATIC_DRAW, // IMAGE_INDEX_INDEX
    BufferUsage.STATIC_DRAW, // COLOR_INDEX
    BufferUsage.STATIC_DRAW, // ROTATION_INDEX
    BufferUsage.STATIC_DRAW, // ALIGNED_AXIS_INDEX
    BufferUsage.STATIC_DRAW, // SCALE_BY_DISTANCE_INDEX
    BufferUsage.STATIC_DRAW, // TRANSLUCENCY_BY_DISTANCE_INDEX
    BufferUsage.STATIC_DRAW, // PIXEL_OFFSET_SCALE_BY_DISTANCE_INDEX
    BufferUsage.STATIC_DRAW, // DISTANCE_DISPLAY_CONDITION_INDEX
    BufferUsage.STATIC_DRAW, // TEXTURE_COORDINATE_BOUNDS
    BufferUsage.STATIC_DRAW, // SPLIT_DIRECTION_INDEX
  ];

  this._highlightColor = Color.clone(Color.WHITE); // Only used by Vector3DTilePoints
  this._coarseDepthTestDistance =
    options.coarseDepthTestDistance ?? Ellipsoid.default.minimumRadius / 10.0;
  this._threePointDepthTestDistance =
    options.threePointDepthTestDistance ??
    Ellipsoid.default.minimumRadius / 1000.0;

  this._uniforms = {
    u_atlas: () => {
      return this.textureAtlas.texture;
    },
    u_highlightColor: () => {
      return this._highlightColor;
    },
    u_coarseDepthTestDistance: () => {
      return this._coarseDepthTestDistance;
    },
    u_threePointDepthTestDistance: () => {
      return this._threePointDepthTestDistance;
    },
  };

  const scene = this._scene;
  if (defined(scene) && defined(scene.terrainProviderChanged)) {
    this._removeCallbackFunc = scene.terrainProviderChanged.addEventListener(
      function () {
        const billboards = this._billboards;
        const length = billboards.length;
        for (let i = 0; i < length; ++i) {
          if (defined(billboards[i])) {
            billboards[i]._updateClamping();
          }
        }
      },
      this,
    );
  }
}

Object.defineProperties(BillboardCollection.prototype, {
  /**
   * 返回此集合中的广告牌数量。通常用于与
   * {@link BillboardCollection#get} 结合使用，以遍历集合中的所有广告牌。
   * 在集合中。
   * @memberof BillboardCollection.prototype
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      removeBillboards(this);
      return this._billboards.length;
    },
  },

  /**
   * 获取或设置纹理图集。
   * @memberof BillboardCollection.prototype
   * @type {TextureAtlas}
   * @private
   */
  textureAtlas: {
    get: function () {
      return this._textureAtlas;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.defined("textureAtlas", value);
      //>>includeEnd('debug');

      if (this._textureAtlas !== value) {
        this._textureAtlas =
          this._destroyTextureAtlas &&
          this._textureAtlas &&
          this._textureAtlas.destroy();
        this._textureAtlas = value;
      }
    },
  },

  /**
   * 获取或设置决定纹理图集是否在集合被销毁时被销毁的值。
   * 如果多个集合使用纹理图集，将此值设置为 <code>false</code>，
   *
   * If the texture atlas is used by more than one collection, set this to <code>false</code>,
   * 并明确销毁地图集，避免多次尝试销毁。
   *
   * @memberof BillboardCollection.prototype
   * @type {boolean}
   * @private
   *
   * @example
   * // 设置 destroyTextureAtlas
   * // 销毁广告牌集合，但不销毁其纹理地图集。
   *
   * const atlas = new TextureAtlas();
   * billboards.textureAtlas = atlas;
   * billboards.destroyTextureAtlas = false;
   *
   * billboards = billboards.destroy();
   * console.log(atlas.isDestroyed()); // False
   */
  destroyTextureAtlas: {
    get: function () {
      return this._destroyTextureAtlas;
    },
    set: function (value) {
      this._destroyTextureAtlas = value;
    },
  },

  /**
   * 返回 WebGL 纹理资源的大小（以字节为单位）。
   * @private
   * @memberof BillboardCollection.prototype
   * @type {number}
   * @readonly
   */
  sizeInBytes: {
    get: function () {
      return this._textureAtlas.sizeInBytes;
    },
  },

  /**
   * 当集合中所有的广告牌都准备好渲染时，返回 true。
   * @private
   * @memberof BillboardCollection.prototype
   * @type {boolean}
   * @readonly
   */
  ready: {
    get: function () {
      return this._allBillboardsReady;
    },
  },

  /**
   * 已加载广告牌图像的缓存。
   * @private
   * @memberof BillboardCollection.prototype
   * @type {Map<string, BillboardTexture>}
   * @readonly
   */
  billboardTextureCache: {
    get: function () {
      return this._billboardTextureCache;
    },
  },

  /**
   * 与相机的距离，超过该距离后，广告牌将根据近似的
   * 地球椭球体而不是完整的地球深度缓冲区进行深度测试。设置为 <code>0</code> 时，
   * 近似深度测试始终被应用。设置为 <code>Number.POSITIVE_INFINITY</code> 时，
   * 近似深度测试永远不会被应用。
   * <br/><br/>
   * 此设置仅在广告牌的 {@link Billboard#disableDepthTestDistance} 值
   * 否则允许深度测试——即广告牌与相机的距离小于
   * 广告牌的 {@link Billboard#disableDepthTestDistance} 值时适用。
   * @memberof BillboardCollection.prototype
   * @type {number}
   */
  coarseDepthTestDistance: {
    get: function () {
      return this._coarseDepthTestDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("coarseDepthTestDistance", value);
      //>>includeEnd('debug');
      this._coarseDepthTestDistance = value;
    },
  },

  /**
   * 与相机的距离，在此范围内，具有 {@link Billboard#heightReference} 值的广告牌
   * 为 {@link HeightReference.CLAMP_TO_GROUND} 或 {@link HeightReference.CLAMP_TO_TERRAIN} 的广告牌将根据三个关键点进行深度测试。这确保如果广告牌的任何关键点可见，整个
   * against three key points. This ensures that if any key point of the billboard is visible, the whole
   * 广告牌也将可见。设置为 <code>0</code> 时，此功能被禁用，地形后面的部分将被裁剪。
   * 此设置仅在广告牌的 {@link Billboard#disableDepthTestDistance} 值
   * <br/><br/>
   * 否则允许深度测试——即广告牌与相机的距离小于
   * 广告牌的 {@link Billboard#disableDepthTestDistance} 值时适用。
   * 创建并添加具有指定初始属性的广告牌到集合中。
   * @see {@link https://cesium.com/blog/2018/07/30/billboards-on-terrain-improvements/|Billboards and Labels on Terrain Improvements}
   * @memberof BillboardCollection.prototype
   * @type {number}
   */
  threePointDepthTestDistance: {
    get: function () {
      return this._threePointDepthTestDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("threePointDepthTestDistance", value);
      //>>includeEnd('debug');
      this._threePointDepthTestDistance = value;
    },
  },
});

function destroyBillboards(billboards) {
  const length = billboards.length;
  for (let i = 0; i < length; ++i) {
    if (billboards[i]) {
      billboards[i]._destroy();
    }
  }
}

/**
 * 将具有指定初始属性的广告牌添加到集合中。
 * 添加的广告牌会被返回，以便之后可以修改或从集合中移除。
 *
 * @param {Billboard.ConstructorOptions}[options] 描述广告牌属性的模板，如示例 1 所示。
 * @returns {Billboard} The 被添加到集合中的广告牌。
 *
 * @performance Calling <code>add</code> 预期为常数时间操作。然而，集合的顶点缓冲区
 * 会被重新写入——这是一个 <code>O(n)</code> 操作，还会产生 CPU 到 GPU 的开销。
 * 为了获得最佳性能，在调用 <code>update</code> 之前添加尽可能多的广告牌。
 *
 * @exception {DeveloperError} This 实体被销毁，即调用了 destroy()。
 *
 *
 * @example
 * // 示例 1：添加广告牌，指定所有默认参数。
 * const b = billboards.add({
 * show : true,
 * position : Cesium.Cartesian3.ZERO,
 * pixelOffset : Cesium.Cartesian2.ZERO,
 * eyeOffset : Cesium.Cartesian3.ZERO,
 * heightReference : Cesium.HeightReference.NONE,
 * horizontalOrigin : Cesium.HorizontalOrigin.CENTER,
 * verticalOrigin : Cesium.VerticalOrigin.CENTER,
 * scale : 1.0,
 * image : 'url/to/image',
 * imageSubRegion : undefined,
 * color : Cesium.Color.WHITE,
 * id : undefined,
 * rotation : 0.0,
 * alignedAxis : Cesium.Cartesian3.ZERO,
 * width : undefined,
 * height : undefined,
 * scaleByDistance : undefined,
 * transluencyByDistance : undefined,
 * pixelOffsetScaleByDistance : undefined,
 * sizeInMeters : false,
 * distanceDisplayCondition : undefined
 * });
 *
 * @example
 * // 示例 2：仅指定广告牌的地图位置。
 * const b = billboards.add({
 * position : Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
 * });
 *
 * @see BillboardCollection#remove
 * @see BillboardCollection#removeAll
 */
BillboardCollection.prototype.add = function (options) {
  const billboard = new Billboard(options, this);
  billboard._index = this._billboards.length;

  this._billboards.push(billboard);
  this._createVertexArray = true;

  return billboard;
};

/**
 * 从集合中移除广告牌。
 *
 * @param {Billboard} billboard 要移除的广告牌。
 * @returns {boolean} <code>true</code> 如果广告牌被移除；如果未在集合中找到则返回 <code>false</code>。
 *
 * @performance Calling <code>remove</code> 预期为常数时间操作。然而，集合的顶点缓冲区
 * 会被重新写入——这是一个 <code>O(n)</code> 操作，还会产生 CPU 到 GPU 的开销。为了获得最佳性能，在调用 <code>update</code> 之前移除尽可能多的广告牌。
 * 如果打算暂时隐藏广告牌，通常更高效的做法是调用
 * {@link Billboard#show} 而不是移除并重新添加广告牌。
 * 实体被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This const b = billboards.add(...);
 *
 *
 * @example
 * billboards.remove(b);  // 返回 true
 * 从集合中移除所有广告牌。
 *
 * @see BillboardCollection#add
 * @see BillboardCollection#removeAll
 * @see Billboard#show
 */
BillboardCollection.prototype.remove = function (billboard) {
  if (this.contains(billboard)) {
    this._billboards[billboard._index] = undefined; // Removed later
    this._billboardsRemoved = true;
    this._createVertexArray = true;
    billboard._destroy();
    return true;
  }

  return false;
};

/**
 * 从集合中移除所有广告牌更为高效。
 *
 * @performance <code>O(n)</code>.  比完全创建新集合更有效率的做法是先从集合中移除所有广告牌，然后再添加新的广告牌。
 * 实体被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This billboards.add(...);
 *
 *
 * @example
 * billboards.add(...);
 * billboards.add(...);
 * billboards.removeAll();
 *
 * @see BillboardCollection#add
 * @see BillboardCollection#remove
 */
BillboardCollection.prototype.removeAll = function () {
  destroyBillboards(this._billboards);
  this._billboards = [];
  this._billboardsToUpdate = [];
  this._billboardsToUpdateIndex = 0;
  this._billboardsRemoved = false;

  this._createVertexArray = true;
};

function removeBillboards(billboardCollection) {
  if (billboardCollection._billboardsRemoved) {
    billboardCollection._billboardsRemoved = false;

    const newBillboards = [];
    const billboards = billboardCollection._billboards;
    const length = billboards.length;
    for (let i = 0, j = 0; i < length; ++i) {
      const billboard = billboards[i];
      if (defined(billboard)) {
        billboard._index = j++;
        newBillboards.push(billboard);
      }
    }

    billboardCollection._billboards = newBillboards;
  }
}

BillboardCollection.prototype._updateBillboard = function (
  billboard,
  propertyChanged,
) {
  if (!billboard._dirty) {
    this._billboardsToUpdate[this._billboardsToUpdateIndex++] = billboard;
  }

  ++this._propertiesChanged[propertyChanged];
};

/**
 * 检查该集合是否包含指定的广告牌。
 *
 * @param {Billboard} [billboard] 要检查的广告牌。
 * @returns {boolean} true 如果集合中包含该广告牌，返回 false；否则返回 true。
 *
 * @see BillboardCollection#get
 */
BillboardCollection.prototype.contains = function (billboard) {
  return defined(billboard) && billboard._billboardCollection === this;
};

/**
 * 返回集合中指定索引的广告牌。索引从零开始。
 * 随着广告牌的添加而增加。移除一个广告牌会将其后的所有广告牌位置左移，并改变它们的索引。此函数常用于
 * {@link BillboardCollection#length} 以遍历集合中的所有广告牌。
 * 该集合中。
 * 广告牌的零基索引。
 *
 * @param {number} index 指定索引处的广告牌。
 * @returns {Billboard} The 指定索引处的广告牌。
 *
 * @performance Expected 常数时间。如果广告牌从集合中移除且
 * {@link BillboardCollection#update} 未被调用，则执行一个隐含的 <code>O(n)</code> 操作。
 * 对象被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This // 切换集合中每个广告牌的 show 属性
 *
 *
 * @example
 * // 切换集合中每个广告牌的 show 属性
 * const len = billboards.length;
 * for (let i = 0; i < len; ++i) {
 * const b = billboards.get(i);
 * b.show = !b.show;
 * }
 *
 * @see BillboardCollection#length
 */
BillboardCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  //>>includeEnd('debug');

  removeBillboards(this);
  return this._billboards[index];
};

function getIndexBuffer(context) {
  let indexBuffer = context.cache.billboardCollection_indexBufferInstanced;
  if (defined(indexBuffer)) {
    return indexBuffer;
  }

  indexBuffer = Buffer.createIndexBuffer({
    context: context,
    typedArray: new Uint16Array([0, 1, 2, 0, 2, 3]),
    usage: BufferUsage.STATIC_DRAW,
    indexDatatype: IndexDatatype.UNSIGNED_SHORT,
  });

  indexBuffer.vertexArrayDestroyable = false;
  context.cache.billboardCollection_indexBufferInstanced = indexBuffer;
  return indexBuffer;
}

function getVertexBufferInstanced(context) {
  let vertexBuffer = context.cache.billboardCollection_vertexBufferInstanced;
  if (defined(vertexBuffer)) {
    return vertexBuffer;
  }

  vertexBuffer = Buffer.createVertexBuffer({
    context: context,
    typedArray: new Float32Array([0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0]),
    usage: BufferUsage.STATIC_DRAW,
  });

  vertexBuffer.vertexArrayDestroyable = false;
  context.cache.billboardCollection_vertexBufferInstanced = vertexBuffer;
  return vertexBuffer;
}

BillboardCollection.prototype.computeNewBuffersUsage = function () {
  const buffersUsage = this._buffersUsage;
  let usageChanged = false;

  const properties = this._propertiesChanged;
  for (let k = 0; k < NUMBER_OF_PROPERTIES; ++k) {
    const newUsage =
      properties[k] === 0 ? BufferUsage.STATIC_DRAW : BufferUsage.STREAM_DRAW;
    usageChanged = usageChanged || buffersUsage[k] !== newUsage;
    buffersUsage[k] = newUsage;
  }

  return usageChanged;
};

function createVAF(context, numberOfBillboards, buffersUsage, batchTable, sdf) {
  const attributes = [
    {
      index: attributeLocations.positionHighAndScale,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[POSITION_INDEX],
    },
    {
      index: attributeLocations.positionLowAndRotation,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[POSITION_INDEX],
    },
    {
      index: attributeLocations.compressedAttribute0,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[PIXEL_OFFSET_INDEX],
    },
    {
      index: attributeLocations.compressedAttribute1,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[TRANSLUCENCY_BY_DISTANCE_INDEX],
    },
    {
      index: attributeLocations.compressedAttribute2,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[COLOR_INDEX],
    },
    {
      index: attributeLocations.eyeOffset,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[EYE_OFFSET_INDEX],
    },
    {
      index: attributeLocations.scaleByDistance,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[SCALE_BY_DISTANCE_INDEX],
    },
    {
      index: attributeLocations.pixelOffsetScaleByDistance,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[PIXEL_OFFSET_SCALE_BY_DISTANCE_INDEX],
    },
    {
      index: attributeLocations.compressedAttribute3,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[DISTANCE_DISPLAY_CONDITION_INDEX],
    },
    {
      index: attributeLocations.textureCoordinateBoundsOrLabelTranslate,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[TEXTURE_COORDINATE_BOUNDS],
    },
    {
      index: attributeLocations.splitDirection,
      componentsPerAttribute: 1,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[SPLIT_DIRECTION_INDEX],
    },
    // Instancing requires one non-instanced attribute.
    {
      index: attributeLocations.direction,
      componentsPerAttribute: 2,
      componentDatatype: ComponentDatatype.FLOAT,
      vertexBuffer: getVertexBufferInstanced(context),
    },
  ];

  if (defined(batchTable)) {
    attributes.push({
      index: attributeLocations.a_batchId,
      componentsPerAttribute: 1,
      componentDatatype: ComponentDatatype.FLOAT,
      bufferUsage: BufferUsage.STATIC_DRAW,
    });
  }

  if (sdf) {
    attributes.push({
      index: attributeLocations.sdf,
      componentsPerAttribute: 2,
      componentDatatype: ComponentDatatype.FLOAT,
      usage: buffersUsage[SDF_INDEX],
    });
  }

  // One vertex is needed for each (instanced) billboard.
  return new VertexArrayFacade(context, attributes, numberOfBillboards, true);
}

///////////////////////////////////////////////////////////////////////////

// Four vertices per billboard.  Each has the same position, etc., but a different screen-space direction vector.

// PERFORMANCE_IDEA:  Save memory if a property is the same for all billboards, use a latched attribute state,
// instead of storing it in a vertex buffer.

const writePositionScratch = new EncodedCartesian3();

function writePositionScaleAndRotation(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const positionHighWriter =
    vafWriters[attributeLocations.positionHighAndScale];
  const positionLowWriter =
    vafWriters[attributeLocations.positionLowAndRotation];
  const position = billboard._getActualPosition();

  if (billboardCollection._mode === SceneMode.SCENE3D) {
    BoundingSphere.expand(
      billboardCollection._baseVolume,
      position,
      billboardCollection._baseVolume,
    );
    billboardCollection._boundingVolumeDirty = true;
  }

  EncodedCartesian3.fromCartesian(position, writePositionScratch);
  const scale = billboard.scale;
  const rotation = billboard.rotation;

  if (rotation !== 0.0) {
    billboardCollection._shaderRotation = true;
  }

  billboardCollection._maxScale = Math.max(
    billboardCollection._maxScale,
    scale,
  );

  const high = writePositionScratch.high;
  const low = writePositionScratch.low;

  positionHighWriter(billboard._index, high.x, high.y, high.z, scale);
  positionLowWriter(billboard._index, low.x, low.y, low.z, rotation);
}

const scratchCartesian2 = new Cartesian2();

const UPPER_BOUND = 32768.0; // 2^15

const LEFT_SHIFT16 = 65536.0; // 2^16
const LEFT_SHIFT12 = 4096.0; // 2^12
const LEFT_SHIFT8 = 256.0; // 2^8
const LEFT_SHIFT7 = 128.0;
const LEFT_SHIFT5 = 32.0;
const LEFT_SHIFT3 = 8.0;
const LEFT_SHIFT2 = 4.0;

const RIGHT_SHIFT8 = 1.0 / 256.0;

const scratchBoundingRectangle = new BoundingRectangle();

function writeCompressedAttrib0(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const writer = vafWriters[attributeLocations.compressedAttribute0];
  const pixelOffset = billboard.pixelOffset;
  const pixelOffsetX = pixelOffset.x;
  const pixelOffsetY = pixelOffset.y;

  const translate = billboard._translate;
  const translateX = translate.x;
  const translateY = translate.y;

  billboardCollection._maxPixelOffset = Math.max(
    billboardCollection._maxPixelOffset,
    Math.abs(pixelOffsetX + translateX),
    Math.abs(-pixelOffsetY + translateY),
  );

  const horizontalOrigin = billboard.horizontalOrigin;
  let verticalOrigin = billboard._verticalOrigin;
  let show = billboard.show && billboard.clusterShow;

  // If the color alpha is zero, do not show this billboard.  This lets us avoid providing
  // color during the pick pass and also eliminates a discard in the fragment shader.
  if (billboard.color.alpha === 0.0) {
    show = false;
  }

  // Raw billboards don't distinguish between BASELINE and BOTTOM, only LabelCollection does that.
  if (verticalOrigin === VerticalOrigin.BASELINE) {
    verticalOrigin = VerticalOrigin.BOTTOM;
  }

  billboardCollection._allHorizontalCenter =
    billboardCollection._allHorizontalCenter &&
    horizontalOrigin === HorizontalOrigin.CENTER;
  billboardCollection._allVerticalCenter =
    billboardCollection._allVerticalCenter &&
    verticalOrigin === VerticalOrigin.CENTER;

  let bottomLeftX = 0;
  let bottomLeftY = 0;
  if (billboard.ready) {
    const imageRectangle = billboard.computeTextureCoordinates(
      scratchBoundingRectangle,
    );

    bottomLeftX = imageRectangle.x;
    bottomLeftY = imageRectangle.y;
  }

  let compressed0 =
    Math.floor(
      CesiumMath.clamp(pixelOffsetX, -UPPER_BOUND, UPPER_BOUND) + UPPER_BOUND,
    ) * LEFT_SHIFT7;
  compressed0 += (horizontalOrigin + 1.0) * LEFT_SHIFT5;
  compressed0 += (verticalOrigin + 1.0) * LEFT_SHIFT3;
  compressed0 += (show ? 1.0 : 0.0) * LEFT_SHIFT2;

  let compressed1 =
    Math.floor(
      CesiumMath.clamp(pixelOffsetY, -UPPER_BOUND, UPPER_BOUND) + UPPER_BOUND,
    ) * LEFT_SHIFT8;

  // We scale `translate` by LEFT_SHIFT2 before encoding it (and unscale after decoding in the shader)
  // to preserve some subpixel precision (1 / 4 = 0.25 pixels). This mitigates rounding errors in aligning glyphs.
  // The cost of increasing this scaling factor is that it decreases the range of representable `translate` values
  // by the same scaling factor. Value must be kept in sync with the shader.
  let compressed2 =
    Math.floor(
      CesiumMath.clamp(translateX * LEFT_SHIFT2, -UPPER_BOUND, UPPER_BOUND) +
        UPPER_BOUND,
    ) * LEFT_SHIFT8;

  const tempTanslateY =
    (CesiumMath.clamp(translateY * LEFT_SHIFT2, -UPPER_BOUND, UPPER_BOUND) +
      UPPER_BOUND) *
    RIGHT_SHIFT8;
  const upperTranslateY = Math.floor(tempTanslateY);
  const lowerTranslateY = Math.floor(
    (tempTanslateY - upperTranslateY) * LEFT_SHIFT8,
  );

  compressed1 += upperTranslateY;
  compressed2 += lowerTranslateY;

  scratchCartesian2.x = bottomLeftX;
  scratchCartesian2.y = bottomLeftY;
  const compressedTexCoordsLL =
    AttributeCompression.compressTextureCoordinates(scratchCartesian2);

  writer(
    billboard._index,
    compressed0,
    compressed1,
    compressed2,
    compressedTexCoordsLL,
  );
}

function writeCompressedAttrib1(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const writer = vafWriters[attributeLocations.compressedAttribute1];
  let alignedAxis = billboard.alignedAxis;
  if (!Cartesian3.equals(alignedAxis, Cartesian3.ZERO)) {
    alignedAxis = Cartesian3.normalize(alignedAxis, new Cartesian3());
    billboardCollection._shaderAlignedAxis = true;
  }

  let near = 0.0;
  let nearValue = 1.0;
  let far = 1.0;
  let farValue = 1.0;

  const translucency = billboard.translucencyByDistance;
  if (defined(translucency)) {
    near = translucency.near;
    nearValue = translucency.nearValue;
    far = translucency.far;
    farValue = translucency.farValue;

    if (nearValue !== 1.0 || farValue !== 1.0) {
      // translucency by distance calculation in shader need not be enabled
      // until a billboard with near and far !== 1.0 is found
      billboardCollection._shaderTranslucencyByDistance = true;
    }
  }

  const imageWidth = Math.round(billboard.width ?? 0);
  billboardCollection._maxSize = Math.max(
    billboardCollection._maxSize,
    imageWidth,
  );

  let compressed0 = CesiumMath.clamp(imageWidth, 0.0, LEFT_SHIFT16);
  let compressed1 = 0.0;

  if (
    Math.abs(Cartesian3.magnitudeSquared(alignedAxis) - 1.0) <
    CesiumMath.EPSILON6
  ) {
    compressed1 = AttributeCompression.octEncodeFloat(alignedAxis);
  }

  nearValue = CesiumMath.clamp(nearValue, 0.0, 1.0);
  nearValue = nearValue === 1.0 ? 255.0 : (nearValue * 255.0) | 0;
  compressed0 = compressed0 * LEFT_SHIFT8 + nearValue;

  farValue = CesiumMath.clamp(farValue, 0.0, 1.0);
  farValue = farValue === 1.0 ? 255.0 : (farValue * 255.0) | 0;
  compressed1 = compressed1 * LEFT_SHIFT8 + farValue;

  writer(billboard._index, compressed0, compressed1, near, far);
}

function writeCompressedAttrib2(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const writer = vafWriters[attributeLocations.compressedAttribute2];
  const color = billboard.color;
  const pickColor = !defined(billboardCollection._batchTable)
    ? billboard.getPickId(frameState.context).color
    : Color.WHITE;
  const sizeInMeters = billboard.sizeInMeters ? 1.0 : 0.0;
  const rawAxis = billboard.alignedAxis;
  const normalizedAxis = !Cartesian3.equals(rawAxis, Cartesian3.ZERO)
    ? Cartesian3.normalize(rawAxis, new Cartesian3())
    : rawAxis;
  const validAlignedAxis =
    Math.abs(Cartesian3.magnitudeSquared(normalizedAxis) - 1.0) <
    CesiumMath.EPSILON6
      ? 1.0
      : 0.0;
  billboardCollection._allSizedInMeters =
    billboardCollection._allSizedInMeters && sizeInMeters === 1.0;

  const imageHeight = billboard.height ?? 0;
  billboardCollection._maxSize = Math.max(
    billboardCollection._maxSize,
    imageHeight,
  );
  let labelHorizontalOrigin = billboard._labelHorizontalOrigin ?? -2;
  labelHorizontalOrigin += 2;

  const compressed0 = AttributeCompression.encodeRGB8(color);
  const compressed1 = AttributeCompression.encodeRGB8(pickColor);
  const compressed2 =
    Color.floatToByte(color.alpha) * LEFT_SHIFT16 +
    Color.floatToByte(pickColor.alpha) * LEFT_SHIFT8 +
    (sizeInMeters * 2.0 + validAlignedAxis);
  const compressed3 = imageHeight * LEFT_SHIFT2 + labelHorizontalOrigin;

  writer(billboard._index, compressed0, compressed1, compressed2, compressed3);
}

function writeEyeOffset(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const writer = vafWriters[attributeLocations.eyeOffset];
  const eyeOffset = billboard.eyeOffset;

  // For billboards that are clamped to ground, move it slightly closer to the camera
  let eyeOffsetZ = eyeOffset.z;
  if (billboard._heightReference !== HeightReference.NONE) {
    eyeOffsetZ *= 1.005;
  }
  billboardCollection._maxEyeOffset = Math.max(
    billboardCollection._maxEyeOffset,
    Math.abs(eyeOffset.x),
    Math.abs(eyeOffset.y),
    Math.abs(eyeOffsetZ),
  );

  scratchCartesian2.x = 0;
  scratchCartesian2.y = 0;

  if (billboard.ready) {
    const imageRectangle = billboard.computeTextureCoordinates(
      scratchBoundingRectangle,
    );

    scratchCartesian2.x = imageRectangle.width;
    scratchCartesian2.y = imageRectangle.height;
  }

  const compressedTexCoordsRange =
    AttributeCompression.compressTextureCoordinates(scratchCartesian2);

  writer(
    billboard._index,
    eyeOffset.x,
    eyeOffset.y,
    eyeOffsetZ,
    compressedTexCoordsRange,
  );
}

function writeScaleByDistance(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const writer = vafWriters[attributeLocations.scaleByDistance];
  let near = 0.0;
  let nearValue = 1.0;
  let far = 1.0;
  let farValue = 1.0;

  const scale = billboard.scaleByDistance;
  if (defined(scale)) {
    near = scale.near;
    nearValue = scale.nearValue;
    far = scale.far;
    farValue = scale.farValue;

    if (nearValue !== 1.0 || farValue !== 1.0) {
      // scale by distance calculation in shader need not be enabled
      // until a billboard with near and far !== 1.0 is found
      billboardCollection._shaderScaleByDistance = true;
    }
  }

  writer(billboard._index, near, nearValue, far, farValue);
}

function writePixelOffsetScaleByDistance(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const writer = vafWriters[attributeLocations.pixelOffsetScaleByDistance];
  let near = 0.0;
  let nearValue = 1.0;
  let far = 1.0;
  let farValue = 1.0;

  const pixelOffsetScale = billboard.pixelOffsetScaleByDistance;
  if (defined(pixelOffsetScale)) {
    near = pixelOffsetScale.near;
    nearValue = pixelOffsetScale.nearValue;
    far = pixelOffsetScale.far;
    farValue = pixelOffsetScale.farValue;

    if (nearValue !== 1.0 || farValue !== 1.0) {
      // pixelOffsetScale by distance calculation in shader need not be enabled
      // until a billboard with near and far !== 1.0 is found
      billboardCollection._shaderPixelOffsetScaleByDistance = true;
    }
  }

  writer(billboard._index, near, nearValue, far, farValue);
}

function writeCompressedAttribute3(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const writer = vafWriters[attributeLocations.compressedAttribute3];
  let near = 0.0;
  let far = Number.MAX_VALUE;

  const distanceDisplayCondition = billboard.distanceDisplayCondition;
  if (defined(distanceDisplayCondition)) {
    near = distanceDisplayCondition.near;
    far = distanceDisplayCondition.far;

    near *= near;
    far *= far;

    billboardCollection._shaderDistanceDisplayCondition = true;
  }

  let disableDepthTestDistance = billboard.disableDepthTestDistance;
  const clampToGround =
    isHeightReferenceClamp(billboard.heightReference) &&
    frameState.context.depthTexture;

  disableDepthTestDistance *= disableDepthTestDistance;
  if (clampToGround || disableDepthTestDistance > 0.0) {
    billboardCollection._shaderDisableDepthDistance = true;
    if (disableDepthTestDistance === Number.POSITIVE_INFINITY) {
      disableDepthTestDistance = -1.0;
    }
  }

  let imageHeight;
  let imageWidth;

  if (!defined(billboard._labelDimensions)) {
    imageWidth = billboard.width ?? 0;
    imageHeight = billboard.height ?? 0;
  } else {
    imageWidth = billboard._labelDimensions.x;
    imageHeight = billboard._labelDimensions.y;
  }

  const w = Math.floor(CesiumMath.clamp(imageWidth, 0.0, LEFT_SHIFT12));
  const h = Math.floor(CesiumMath.clamp(imageHeight, 0.0, LEFT_SHIFT12));
  const dimensions = w * LEFT_SHIFT12 + h;

  writer(billboard._index, near, far, disableDepthTestDistance, dimensions);
}

function writeTextureCoordinateBoundsOrLabelTranslate(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  if (isHeightReferenceClamp(billboard.heightReference)) {
    const scene = billboardCollection._scene;
    const context = frameState.context;
    const globeTranslucent = frameState.globeTranslucencyState.translucent;
    const depthTestAgainstTerrain =
      defined(scene.globe) && scene.globe.depthTestAgainstTerrain;

    // Only do manual depth test if the globe is opaque and writes depth
    billboardCollection._shaderClampToGround =
      context.depthTexture && !globeTranslucent && depthTestAgainstTerrain;
  }
  const writer =
    vafWriters[attributeLocations.textureCoordinateBoundsOrLabelTranslate];

  //write _labelTranslate, used by depth testing in the vertex shader
  let translateX = 0;
  let translateY = 0;
  if (defined(billboard._labelTranslate)) {
    translateX = billboard._labelTranslate.x;
    translateY = billboard._labelTranslate.y;
  }

  writer(billboard._index, translateX, translateY, 0.0, 0.0);
}

function writeBatchId(billboardCollection, frameState, vafWriters, billboard) {
  if (!defined(billboardCollection._batchTable)) {
    return;
  }

  const writer = vafWriters[attributeLocations.a_batchId];
  const id = billboard._batchIndex;

  writer(billboard._index, id);
}

function writeSDF(billboardCollection, frameState, vafWriters, billboard) {
  if (!billboardCollection._sdf) {
    return;
  }

  const writer = vafWriters[attributeLocations.sdf];

  const outlineColor = billboard.outlineColor;
  const outlineWidth = billboard.outlineWidth;

  const compressed0 = AttributeCompression.encodeRGB8(outlineColor);

  // Compute the relative outline distance
  const outlineDistance = outlineWidth / SDFSettings.RADIUS;
  const compressed1 =
    Color.floatToByte(outlineColor.alpha) * LEFT_SHIFT16 +
    Color.floatToByte(outlineDistance) * LEFT_SHIFT8;

  writer(billboard._index, compressed0, compressed1);
}

function writeSplitDirection(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  const writer = vafWriters[attributeLocations.splitDirection];
  let direction = 0.0;

  const split = billboard.splitDirection;
  if (defined(split)) {
    direction = split;
  }

  writer(billboard._index, direction);
}

function writeBillboard(
  billboardCollection,
  frameState,
  vafWriters,
  billboard,
) {
  writePositionScaleAndRotation(
    billboardCollection,
    frameState,
    vafWriters,
    billboard,
  );
  writeCompressedAttrib0(
    billboardCollection,
    frameState,
    vafWriters,
    billboard,
  );
  writeCompressedAttrib1(
    billboardCollection,
    frameState,
    vafWriters,
    billboard,
  );
  writeCompressedAttrib2(
    billboardCollection,
    frameState,
    vafWriters,
    billboard,
  );
  writeEyeOffset(billboardCollection, frameState, vafWriters, billboard);
  writeScaleByDistance(billboardCollection, frameState, vafWriters, billboard);
  writePixelOffsetScaleByDistance(
    billboardCollection,
    frameState,
    vafWriters,
    billboard,
  );
  writeCompressedAttribute3(
    billboardCollection,
    frameState,
    vafWriters,
    billboard,
  );
  writeTextureCoordinateBoundsOrLabelTranslate(
    billboardCollection,
    frameState,
    vafWriters,
    billboard,
  );
  writeBatchId(billboardCollection, frameState, vafWriters, billboard);
  writeSDF(billboardCollection, frameState, vafWriters, billboard);
  writeSplitDirection(billboardCollection, frameState, vafWriters, billboard);
}

function recomputeActualPositions(
  billboardCollection,
  billboards,
  length,
  frameState,
  modelMatrix,
  recomputeBoundingVolume,
) {
  let boundingVolume;
  if (frameState.mode === SceneMode.SCENE3D) {
    boundingVolume = billboardCollection._baseVolume;
    billboardCollection._boundingVolumeDirty = true;
  } else {
    boundingVolume = billboardCollection._baseVolume2D;
  }

  const positions = [];
  for (let i = 0; i < length; ++i) {
    const billboard = billboards[i];
    const position = billboard.position;
    const actualPosition = Billboard._computeActualPosition(
      billboard,
      position,
      frameState,
      modelMatrix,
    );
    if (defined(actualPosition)) {
      billboard._setActualPosition(actualPosition);

      if (recomputeBoundingVolume) {
        positions.push(billboard._getActualPosition());
      } else {
        BoundingSphere.expand(boundingVolume, actualPosition, boundingVolume);
      }
    }
  }

  if (recomputeBoundingVolume) {
    BoundingSphere.fromPoints(positions, boundingVolume);
  }
}

function updateMode(billboardCollection, frameState) {
  const mode = frameState.mode;

  const billboards = billboardCollection._billboards;
  const billboardsToUpdate = billboardCollection._billboardsToUpdate;
  const modelMatrix = billboardCollection._modelMatrix;

  if (
    billboardCollection._createVertexArray ||
    billboardCollection._mode !== mode ||
    (mode !== SceneMode.SCENE3D &&
      !Matrix4.equals(modelMatrix, billboardCollection.modelMatrix))
  ) {
    billboardCollection._mode = mode;
    Matrix4.clone(billboardCollection.modelMatrix, modelMatrix);
    billboardCollection._createVertexArray = true;

    if (
      mode === SceneMode.SCENE3D ||
      mode === SceneMode.SCENE2D ||
      mode === SceneMode.COLUMBUS_VIEW
    ) {
      recomputeActualPositions(
        billboardCollection,
        billboards,
        billboards.length,
        frameState,
        modelMatrix,
        true,
      );
    }
  } else if (mode === SceneMode.MORPHING) {
    recomputeActualPositions(
      billboardCollection,
      billboards,
      billboards.length,
      frameState,
      modelMatrix,
      true,
    );
  } else if (mode === SceneMode.SCENE2D || mode === SceneMode.COLUMBUS_VIEW) {
    recomputeActualPositions(
      billboardCollection,
      billboardsToUpdate,
      billboardCollection._billboardsToUpdateIndex,
      frameState,
      modelMatrix,
      false,
    );
  }
}

function updateBoundingVolume(collection, frameState, boundingVolume) {
  let pixelScale = 1.0;
  if (!collection._allSizedInMeters || collection._maxPixelOffset !== 0.0) {
    pixelScale = frameState.camera.getPixelSize(
      boundingVolume,
      frameState.context.drawingBufferWidth,
      frameState.context.drawingBufferHeight,
    );
  }

  let size = pixelScale * collection._maxScale * collection._maxSize * 2.0;
  if (collection._allHorizontalCenter && collection._allVerticalCenter) {
    size *= 0.5;
  }

  const offset =
    pixelScale * collection._maxPixelOffset + collection._maxEyeOffset;
  boundingVolume.radius += size + offset;
}

function createDebugCommand(billboardCollection, context) {
  const fs =
    "uniform sampler2D billboard_texture; \n" +
    "in vec2 v_textureCoordinates; \n" +
    "void main() \n" +
    "{ \n" +
    "    out_FragColor = texture(billboard_texture, v_textureCoordinates); \n" +
    "} \n";

  const drawCommand = context.createViewportQuadCommand(fs, {
    uniformMap: {
      billboard_texture: function () {
        return billboardCollection.textureAtlas.texture;
      },
    },
  });
  drawCommand.pass = Pass.OVERLAY;
  return drawCommand;
}

const scratchWriterArray = [];

/**
 * 在 {@link Viewer} 或 {@link CesiumWidget} 将场景渲染时调用此函数，以获取渲染该基本元素所需的绘制命令。
 * 获取渲染此基本元素所需的绘制命令。
 * <p>
 * 不要直接调用此函数。此文档仅用于列出场景渲染时可能传播的异常：
 * id 必须存在于地图集中。
 * </p>
 *
 * @exception {RuntimeError} image 返回 true 表示此对象已被销毁；否则返回 false。
 */
BillboardCollection.prototype.update = function (frameState) {
  removeBillboards(this);

  if (!this.show) {
    return;
  }

  const context = frameState.context;

  if (
    !context.instancedArrays ||
    !(ContextLimits.maximumVertexTextureImageUnits > 0)
  ) {
    throw new DeveloperError(
      "Beginning in CesiumJS 1.140, billboards and labels require device support for WebGL 2, " +
        "or WebGL 1 with ANGLE_instanced_arrays and MAX_VERTEX_TEXTURE_IMAGE_UNITS > 0. For more " +
        "information or to share feedback, see: https://github.com/CesiumGS/cesium/issues/13053",
    );
  }

  let billboards = this._billboards;
  let billboardsLength = billboards.length;
  let allBillboardsReady = true;
  for (let i = 0; i < billboardsLength; ++i) {
    const billboard = billboards[i];
    if (defined(billboard.loadError)) {
      console.error(
        `Error loading image for billboard: ${billboard.loadError}`,
      );
      billboard.image = undefined;
    }

    if (billboard.textureDirty) {
      this._updateBillboard(billboard, IMAGE_INDEX_INDEX);
    }

    if (billboard.show) {
      allBillboardsReady = allBillboardsReady && billboard.ready;
    }
  }

  // Queue any texture resource updates for after the frame is rendered
  const textureAtlas = this._textureAtlas;
  frameState.afterRender.push(() => {
    if (this.isDestroyed()) {
      return;
    }

    return textureAtlas.update(frameState.context);
  });

  if (!defined(textureAtlas.texture)) {
    // Can't write billboard vertices until the texture atlas
    // has been updated once
    return;
  }

  updateMode(this, frameState);

  billboards = this._billboards;
  billboardsLength = billboards.length;
  const billboardsToUpdate = this._billboardsToUpdate;
  const billboardsToUpdateLength = this._billboardsToUpdateIndex;

  const properties = this._propertiesChanged;

  const textureAtlasGUID = textureAtlas.guid;
  const createVertexArray =
    this._createVertexArray || this._textureAtlasGUID !== textureAtlasGUID;
  this._textureAtlasGUID = textureAtlasGUID;

  let vafWriters;
  const pass = frameState.passes;
  const picking = pass.pick;

  // PERFORMANCE_IDEA: Round robin multiple buffers.
  if (createVertexArray || (!picking && this.computeNewBuffersUsage())) {
    this._createVertexArray = false;

    for (let k = 0; k < NUMBER_OF_PROPERTIES; ++k) {
      properties[k] = 0;
    }

    this._vaf = this._vaf && this._vaf.destroy();

    if (billboardsLength > 0) {
      // PERFORMANCE_IDEA:  Instead of creating a new one, resize like std::vector.
      this._vaf = createVAF(
        context,
        billboardsLength,
        this._buffersUsage,
        this._batchTable,
        this._sdf,
      );
      vafWriters = this._vaf.writers;

      // Rewrite entire buffer if billboards were added or removed.
      for (let i = 0; i < billboardsLength; ++i) {
        const billboard = this._billboards[i];
        billboard._dirty = false; // In case it needed an update.
        billboard.textureDirty = false;
        writeBillboard(this, frameState, vafWriters, billboard);
      }

      // Different billboard collections share the same index buffer.
      this._vaf.commit(getIndexBuffer(context));
    }

    this._billboardsToUpdateIndex = 0;
  } else if (billboardsToUpdateLength > 0) {
    // Billboards were modified, but none were added or removed.
    const writers = scratchWriterArray;
    writers.length = 0;

    if (
      properties[POSITION_INDEX] ||
      properties[ROTATION_INDEX] ||
      properties[SCALE_INDEX]
    ) {
      writers.push(writePositionScaleAndRotation);
    }

    if (
      properties[IMAGE_INDEX_INDEX] ||
      properties[PIXEL_OFFSET_INDEX] ||
      properties[HORIZONTAL_ORIGIN_INDEX] ||
      properties[VERTICAL_ORIGIN_INDEX] ||
      properties[SHOW_INDEX]
    ) {
      writers.push(writeCompressedAttrib0);
      writers.push(writeEyeOffset);
    }

    if (
      properties[IMAGE_INDEX_INDEX] ||
      properties[ALIGNED_AXIS_INDEX] ||
      properties[TRANSLUCENCY_BY_DISTANCE_INDEX]
    ) {
      writers.push(writeCompressedAttrib1);
      writers.push(writeCompressedAttrib2);
    }

    if (properties[IMAGE_INDEX_INDEX] || properties[COLOR_INDEX]) {
      writers.push(writeCompressedAttrib2);
    }

    if (properties[IMAGE_INDEX_INDEX] || properties[EYE_OFFSET_INDEX]) {
      writers.push(writeEyeOffset);
    }

    if (properties[SCALE_BY_DISTANCE_INDEX]) {
      writers.push(writeScaleByDistance);
    }

    if (properties[PIXEL_OFFSET_SCALE_BY_DISTANCE_INDEX]) {
      writers.push(writePixelOffsetScaleByDistance);
    }

    if (
      properties[DISTANCE_DISPLAY_CONDITION_INDEX] ||
      properties[DISABLE_DEPTH_DISTANCE] ||
      properties[IMAGE_INDEX_INDEX] ||
      properties[POSITION_INDEX]
    ) {
      writers.push(writeCompressedAttribute3);
    }

    if (properties[IMAGE_INDEX_INDEX] || properties[POSITION_INDEX]) {
      writers.push(writeTextureCoordinateBoundsOrLabelTranslate);
    }

    if (properties[SDF_INDEX]) {
      writers.push(writeSDF);
    }

    if (properties[SPLIT_DIRECTION_INDEX]) {
      writers.push(writeSplitDirection);
    }

    const numWriters = writers.length;
    vafWriters = this._vaf.writers;

    if (billboardsToUpdateLength / billboardsLength > 0.1) {
      // If more than 10% of billboard change, rewrite the entire buffer.

      // PERFORMANCE_IDEA:  I totally made up 10% :).

      for (let m = 0; m < billboardsToUpdateLength; ++m) {
        const b = billboardsToUpdate[m];
        b._dirty = false;
        b.textureDirty = false;

        for (let n = 0; n < numWriters; ++n) {
          writers[n](this, frameState, vafWriters, b);
        }
      }
      this._vaf.commit(getIndexBuffer(context));
    } else {
      for (let h = 0; h < billboardsToUpdateLength; ++h) {
        const bb = billboardsToUpdate[h];
        bb._dirty = false;
        bb.textureDirty = false;

        for (let o = 0; o < numWriters; ++o) {
          writers[o](this, frameState, vafWriters, bb);
        }

        this._vaf.subCommit(bb._index, 1);
      }
      this._vaf.endSubCommits();
    }

    this._billboardsToUpdateIndex = 0;
  }

  // If the number of total billboards ever shrinks considerably
  // Truncate billboardsToUpdate so that we free memory that we're
  // not going to be using.
  if (billboardsToUpdateLength > billboardsLength * 1.5) {
    billboardsToUpdate.length = billboardsLength;
  }

  if (!defined(this._vaf) || !defined(this._vaf.va)) {
    return;
  }

  if (this._boundingVolumeDirty) {
    this._boundingVolumeDirty = false;
    BoundingSphere.transform(
      this._baseVolume,
      this.modelMatrix,
      this._baseVolumeWC,
    );
  }

  let boundingVolume;
  let modelMatrix = Matrix4.IDENTITY;
  if (frameState.mode === SceneMode.SCENE3D) {
    modelMatrix = this.modelMatrix;
    boundingVolume = BoundingSphere.clone(
      this._baseVolumeWC,
      this._boundingVolume,
    );
  } else {
    boundingVolume = BoundingSphere.clone(
      this._baseVolume2D,
      this._boundingVolume,
    );
  }
  updateBoundingVolume(this, frameState, boundingVolume);

  const blendOptionChanged = this._blendOption !== this.blendOption;
  this._blendOption = this.blendOption;

  if (blendOptionChanged) {
    if (
      this._blendOption === BlendOption.OPAQUE ||
      this._blendOption === BlendOption.OPAQUE_AND_TRANSLUCENT
    ) {
      this._rsOpaque = RenderState.fromCache({
        depthTest: {
          enabled: true,
          func: WebGLConstants.LESS,
        },
        depthMask: true,
      });
    } else {
      this._rsOpaque = undefined;
    }

    // If OPAQUE_AND_TRANSLUCENT is in use, only the opaque pass gets the benefit of the depth buffer,
    // not the translucent pass.  Otherwise, if the TRANSLUCENT pass is on its own, it turns on
    // a depthMask in lieu of full depth sorting (because it has opaque-ish fragments that look bad in OIT).
    const useTranslucentDepthMask =
      this._blendOption === BlendOption.TRANSLUCENT;

    if (
      this._blendOption === BlendOption.TRANSLUCENT ||
      this._blendOption === BlendOption.OPAQUE_AND_TRANSLUCENT
    ) {
      this._rsTranslucent = RenderState.fromCache({
        depthTest: {
          enabled: true,
          func: useTranslucentDepthMask
            ? WebGLConstants.LEQUAL
            : WebGLConstants.LESS,
        },
        depthMask: useTranslucentDepthMask,
        blending: BlendingState.ALPHA_BLEND,
      });
    } else {
      this._rsTranslucent = undefined;
    }
  }

  this._shaderDisableDepthDistance =
    this._shaderDisableDepthDistance ||
    frameState.minimumDisableDepthTestDistance !== 0.0;

  let vsSource;
  let fsSource;
  let vs;
  let fs;
  let vertDefines;

  if (
    blendOptionChanged ||
    this._shaderRotation !== this._compiledShaderRotation ||
    this._shaderAlignedAxis !== this._compiledShaderAlignedAxis ||
    this._shaderScaleByDistance !== this._compiledShaderScaleByDistance ||
    this._shaderTranslucencyByDistance !==
      this._compiledShaderTranslucencyByDistance ||
    this._shaderPixelOffsetScaleByDistance !==
      this._compiledShaderPixelOffsetScaleByDistance ||
    this._shaderDistanceDisplayCondition !==
      this._compiledShaderDistanceDisplayCondition ||
    this._shaderDisableDepthDistance !==
      this._compiledShaderDisableDepthDistance ||
    this._shaderClampToGround !== this._compiledShaderClampToGround ||
    this._sdf !== this._compiledSDF
  ) {
    vsSource = BillboardCollectionVS;
    fsSource = BillboardCollectionFS;

    vertDefines = ["INSTANCED"];
    if (defined(this._batchTable)) {
      vertDefines.push("VECTOR_TILE");
      vsSource = this._batchTable.getVertexShaderCallback(
        false,
        "a_batchId",
        undefined,
      )(vsSource);
      fsSource = this._batchTable.getFragmentShaderCallback(
        false,
        undefined,
      )(fsSource);
    }

    vs = new ShaderSource({
      defines: vertDefines,
      sources: [vsSource],
    });

    if (this._shaderRotation) {
      vs.defines.push("ROTATION");
    }
    if (this._shaderAlignedAxis) {
      vs.defines.push("ALIGNED_AXIS");
    }
    if (this._shaderScaleByDistance) {
      vs.defines.push("EYE_DISTANCE_SCALING");
    }
    if (this._shaderTranslucencyByDistance) {
      vs.defines.push("EYE_DISTANCE_TRANSLUCENCY");
    }
    if (this._shaderPixelOffsetScaleByDistance) {
      vs.defines.push("EYE_DISTANCE_PIXEL_OFFSET");
    }
    if (this._shaderDistanceDisplayCondition) {
      vs.defines.push("DISTANCE_DISPLAY_CONDITION");
    }
    if (this._shaderDisableDepthDistance) {
      vs.defines.push("DISABLE_DEPTH_DISTANCE");
    }
    if (this._shaderClampToGround) {
      vs.defines.push("VS_THREE_POINT_DEPTH_CHECK");
    }

    const sdfEdge = 1.0 - SDFSettings.CUTOFF;

    if (this._sdf) {
      vs.defines.push("SDF");
    }

    const vectorFragDefine = defined(this._batchTable) ? "VECTOR_TILE" : "";

    if (this._blendOption === BlendOption.OPAQUE_AND_TRANSLUCENT) {
      fs = new ShaderSource({
        defines: ["OPAQUE", vectorFragDefine],
        sources: [fsSource],
      });
      if (this._shaderClampToGround) {
        fs.defines.push("VS_THREE_POINT_DEPTH_CHECK");
      }

      if (this._sdf) {
        fs.defines.push("SDF");
        fs.defines.push(`SDF_EDGE ${sdfEdge}`);
      }

      this._sp = ShaderProgram.replaceCache({
        context: context,
        shaderProgram: this._sp,
        vertexShaderSource: vs,
        fragmentShaderSource: fs,
        attributeLocations: attributeLocations,
      });

      fs = new ShaderSource({
        defines: ["TRANSLUCENT", vectorFragDefine],
        sources: [fsSource],
      });
      if (this._shaderClampToGround) {
        fs.defines.push("VS_THREE_POINT_DEPTH_CHECK");
      }
      if (this._sdf) {
        fs.defines.push("SDF");
        fs.defines.push(`SDF_EDGE ${sdfEdge}`);
      }
      this._spTranslucent = ShaderProgram.replaceCache({
        context: context,
        shaderProgram: this._spTranslucent,
        vertexShaderSource: vs,
        fragmentShaderSource: fs,
        attributeLocations: attributeLocations,
      });
    }

    if (this._blendOption === BlendOption.OPAQUE) {
      fs = new ShaderSource({
        defines: [vectorFragDefine],
        sources: [fsSource],
      });
      if (this._shaderClampToGround) {
        fs.defines.push("VS_THREE_POINT_DEPTH_CHECK");
      }
      if (this._sdf) {
        fs.defines.push("SDF");
        fs.defines.push(`SDF_EDGE ${sdfEdge}`);
      }
      this._sp = ShaderProgram.replaceCache({
        context: context,
        shaderProgram: this._sp,
        vertexShaderSource: vs,
        fragmentShaderSource: fs,
        attributeLocations: attributeLocations,
      });
    }

    if (this._blendOption === BlendOption.TRANSLUCENT) {
      fs = new ShaderSource({
        defines: [vectorFragDefine],
        sources: [fsSource],
      });
      if (this._shaderClampToGround) {
        fs.defines.push("VS_THREE_POINT_DEPTH_CHECK");
      }
      if (this._sdf) {
        fs.defines.push("SDF");
        fs.defines.push(`SDF_EDGE ${sdfEdge}`);
      }
      this._spTranslucent = ShaderProgram.replaceCache({
        context: context,
        shaderProgram: this._spTranslucent,
        vertexShaderSource: vs,
        fragmentShaderSource: fs,
        attributeLocations: attributeLocations,
      });
    }

    this._compiledShaderRotation = this._shaderRotation;
    this._compiledShaderAlignedAxis = this._shaderAlignedAxis;
    this._compiledShaderScaleByDistance = this._shaderScaleByDistance;
    this._compiledShaderTranslucencyByDistance =
      this._shaderTranslucencyByDistance;
    this._compiledShaderPixelOffsetScaleByDistance =
      this._shaderPixelOffsetScaleByDistance;
    this._compiledShaderDistanceDisplayCondition =
      this._shaderDistanceDisplayCondition;
    this._compiledShaderDisableDepthDistance = this._shaderDisableDepthDistance;
    this._compiledShaderClampToGround = this._shaderClampToGround;
    this._compiledSDF = this._sdf;
  }

  const commandList = frameState.commandList;

  if (pass.render || pass.pick) {
    const colorList = this._colorCommands;

    const opaque = this._blendOption === BlendOption.OPAQUE;
    const opaqueAndTranslucent =
      this._blendOption === BlendOption.OPAQUE_AND_TRANSLUCENT;

    const va = this._vaf.va;
    const vaLength = va.length;

    let uniforms = this._uniforms;
    let pickId;
    if (defined(this._batchTable)) {
      uniforms = this._batchTable.getUniformMapCallback()(uniforms);
      pickId = this._batchTable.getPickId();
    } else {
      pickId = "v_pickColor";
    }

    colorList.length = vaLength;
    const totalLength = opaqueAndTranslucent ? vaLength * 2 : vaLength;
    for (let j = 0; j < totalLength; ++j) {
      let command = colorList[j];
      if (!defined(command)) {
        command = colorList[j] = new DrawCommand();
      }

      const opaqueCommand = opaque || (opaqueAndTranslucent && j % 2 === 0);

      command.pass =
        opaqueCommand || !opaqueAndTranslucent ? Pass.OPAQUE : Pass.TRANSLUCENT;
      command.owner = this;

      const index = opaqueAndTranslucent ? Math.floor(j / 2.0) : j;
      command.boundingVolume = boundingVolume;
      command.modelMatrix = modelMatrix;
      command.count = va[index].indicesCount;
      command.shaderProgram = opaqueCommand ? this._sp : this._spTranslucent;
      command.uniformMap = uniforms;
      command.vertexArray = va[index].va;
      command.renderState = opaqueCommand
        ? this._rsOpaque
        : this._rsTranslucent;
      command.debugShowBoundingVolume = this.debugShowBoundingVolume;
      command.pickId = pickId;

      command.count = 6;
      command.instanceCount = billboardsLength;

      commandList.push(command);
    }

    if (this.debugShowTextureAtlas) {
      if (!defined(this.debugCommand)) {
        this.debugCommand = createDebugCommand(this, frameState.context);
      }

      commandList.push(this.debugCommand);
    }
  }

  this._allBillboardsReady = allBillboardsReady;
};

/**
 * 如果此对象被销毁，则不应使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 * 如果此对象被销毁；否则返回 <code>false</code>。
 *
 * @returns {boolean} <code>true</code> 销毁此对象所持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而不依赖垃圾收集器来销毁该对象。
 *
 * @see BillboardCollection#destroy
 */
BillboardCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 一旦对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * <br /><br />
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * 此对象被销毁，即调用了 destroy()。
 * billboards = billboards && billboards.destroy();
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 *
 * @example
 * billboards = billboards && billboards.destroy();
 *
 * @see BillboardCollection#isDestroyed
 */
BillboardCollection.prototype.destroy = function () {
  if (defined(this._removeCallbackFunc)) {
    this._removeCallbackFunc();
    this._removeCallbackFunc = undefined;
  }

  this._textureAtlas =
    this._destroyTextureAtlas &&
    this._textureAtlas &&
    this._textureAtlas.destroy();
  this._sp = this._sp && this._sp.destroy();
  this._spTranslucent = this._spTranslucent && this._spTranslucent.destroy();
  this._vaf = this._vaf && this._vaf.destroy();
  destroyBillboards(this._billboards);

  return destroyObject(this);
};
export default BillboardCollection;
