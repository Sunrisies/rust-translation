import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Check,
  Color,
  DeveloperError,
  Ellipsoid,
  Event,
  FixedFrameTransforms,
  Frozen,
  IntersectionTests,
  Interval,
  JulianDate,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Ray,
  RuntimeError,
  clone,
  defined,
  deprecationWarning,
  destroyObject,
  oneTimeWarning,
} from "@cesium/core";
import { constructBoundingVolumeJson, getNodeTransform } from "@cesium/gltf";
import ApproximateTerrainHeights from "../Core/ApproximateTerrainHeights.js";
import Credit from "../Core/Credit.js";
import ImageBasedLighting from "./ImageBasedLighting.js";
import IonResource from "../Core/IonResource.js";
import ManagedArray from "../Core/ManagedArray.js";
import Resource from "../Core/Resource.js";
import ClearCommand from "../Renderer/ClearCommand.js";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import Axis from "./Axis.js";
import BlendOption from "./BlendOption.js";
import Cesium3DTile from "./Cesium3DTile.js";
import Cesium3DTileColorBlendMode from "./Cesium3DTileColorBlendMode.js";
import Cesium3DTileContentState from "./Cesium3DTileContentState.js";
import FeatureLayerCollection from "./FeatureLayerCollection.js";
import Cesium3DTilesetMetadata from "./Cesium3DTilesetMetadata.js";
import Cesium3DTileOptimizations from "./Cesium3DTileOptimizations.js";
import Cesium3DTilePass from "./Cesium3DTilePass.js";
import Cesium3DTileRefine from "./Cesium3DTileRefine.js";
import Cesium3DTilesetCache from "./Cesium3DTilesetCache.js";
import Cesium3DTilesetHeatmap from "./Cesium3DTilesetHeatmap.js";
import Cesium3DTilesetStatistics from "./Cesium3DTilesetStatistics.js";
import Cesium3DTileStyleEngine from "./Cesium3DTileStyleEngine.js";
import ClippingPlaneCollection from "./ClippingPlaneCollection.js";
import ClippingPolygonCollection from "./ClippingPolygonCollection.js";
import EdgeDisplayMode from "./EdgeDisplayMode.js";
import hasExtension from "./hasExtension.js";
import { isHeightReferenceClamp } from "./HeightReference.js";
import ImplicitTileset from "./ImplicitTileset.js";
import ImplicitTileCoordinates from "./ImplicitTileCoordinates.js";
import LabelCollection from "./LabelCollection.js";
import ModelUtility from "./Model/ModelUtility.js";
import PointCloudEyeDomeLighting from "./PointCloudEyeDomeLighting.js";
import PointCloudShading from "./PointCloudShading.js";
import ResourceCache from "./ResourceCache.js";
import SceneMode from "./SceneMode.js";
import ShadowMode from "./ShadowMode.js";
import SplitDirection from "./SplitDirection.js";
import StencilConstants from "./StencilConstants.js";
import TileBoundingRegion from "./TileBoundingRegion.js";
import TileBoundingSphere from "./TileBoundingSphere.js";
import TileOrientedBoundingBox from "./TileOrientedBoundingBox.js";
import Cesium3DTilesetMostDetailedTraversal from "./Cesium3DTilesetMostDetailedTraversal.js";
import Cesium3DTilesetBaseTraversal from "./Cesium3DTilesetBaseTraversal.js";
import Cesium3DTilesetSkipTraversal from "./Cesium3DTilesetSkipTraversal.js";
import DynamicEnvironmentMapManager from "./DynamicEnvironmentMapManager.js";
import ImageryLayerCollection from "./ImageryLayerCollection.js";

/**
 * @typedef {object} Cesium3DTileset.ConstructorOptions
 *
 * Cesium3DTileset构造函数初始化选项
 *
 * @property {boolean} [show=true] 决定是否显示该 tileset。
 * @property {Matrix4} [modelMatrix=Matrix4.IDENTITY] 用于转换 tileset 根 tile 的 4x4 变换矩阵。
 * @property {Axis} [modelUpAxis=Axis.Y] 加载 tile 内容模型时，哪个轴被视为向上方向。
 * @property {Axis} [modelForwardAxis=Axis.X] 加载 tile 内容模型时，哪个轴被视为前进方向。
 * @property {ShadowMode} [shadows=ShadowMode.ENABLED] 决定 tileset 是否投射或接收来自光源的阴影。
 * @property {number} [maximumScreenSpaceError=16] 用于驱动细节级别优化的最大屏幕空间误差。
 * @property {number} [cacheBytes=536870912] 如果缓存中包含当前视图不需要的 tile，则会对 tile 缓存进行裁剪的大小（以字节为单位）。
 * @property {number} [maximumCacheOverflowBytes=536870912] 如果当前视图需要超过 {@link Cesium3DTileset#cacheBytes} 的额外内存，则允许缓存预留的空间大小（以字节为单位）。
 * @property {boolean} [cullWithChildrenBounds=true] 优化选项。是否使用子边界体积的并集来剔除 tile。
 * @property {boolean} [cullRequestsWhileMoving=true] 优化选项。不请求那些由于相机移动而可能未被使用的 tile。此优化仅适用于静止的 tileset。
 * @property {number} [cullRequestsWhileMovingMultiplier=60.0] 优化选项。移动时用于剔除请求的倍率。数值越大，剔除越严格；数值越小，剔除越宽松。
 * @property {boolean} [preloadWhenHidden=false] 当 <code>tileset.show</code> 为 <code>false</code> 时预加载 tile。预加载的 tile 看起来像可见的 tileset，但不会渲染。
 * @property {boolean} [preloadFlightDestinations=true] 优化选项。在相机飞行过程中，在相机飞行目的地预加载 tile。
 * @property {boolean} [preferLeaves=false] 优化选项。优先加载叶子节点。
 * @property {boolean} [dynamicScreenSpaceError=true] 优化选项。对于街道级别的地平线视图，使用远离相机的低分辨率 tile。这减少了加载的数据量，并提高了 tileset 的加载速度，但远处视觉质量会略有下降。
 * @property {number} [dynamicScreenSpaceErrorDensity=2.0e-4] 类似于 {@link Fog#density}，此选项控制 {@link Cesium3DTileset#dynamicScreenSpaceError} 优化适用于相机的距离。较大的值会导致靠近相机的 tile 受到影响。
 * @property {number} [dynamicScreenSpaceErrorFactor=24.0] 控制地平线上 tiles 的 {@link Cesium3DTileset#dynamicScreenSpaceError} 优化强度的参数。较大的值会导致低分辨率 tile 被加载，从而在运行时性能得到提升，但视觉质量会略有下降。
 * @property {number} [dynamicScreenSpaceErrorHeightFalloff=0.25] 决定“街道级别”相机视图出现的高度比例。当相机低于此高度时， {@link Cesium3DTileset#dynamicScreenSpaceError} 优化将发挥最大效果，并会在超过此值后逐渐减弱。
 * @property {number} [progressiveResolutionHeightFraction=0.3] 优化选项。如果处于 (0.0, 0.5] 区间，则优先加载在降低的屏幕分辨率 <code>progressiveResolutionHeightFraction*screenHeight</code> 的屏幕空间误差范围内或以上的瓦片。这有助于快速加载部分瓦片，同时完整分辨率的瓦片继续加载。
 * @property {boolean} [foveatedScreenSpaceError=true] 优化选项。通过暂时提高屏幕边缘瓦片的屏幕空间误差，优先加载屏幕中央的瓦片。一旦根据 {@link Cesium3DTileset#foveatedConeSize} 确定的屏幕中央的所有瓦片被加载完成，屏幕空间误差就会恢复正常。
 * @property {number} [foveatedConeSize=0.1] 优化选项。当 {@link Cesium3DTileset#foveatedScreenSpaceError} 为 true 时使用，用于控制决定哪些瓦片被延迟加载的圆锥大小。位于该圆锥内的瓦片会立即加载，而位于圆锥外的瓦片则根据其离圆锥的距离和屏幕空间误差被潜在地延迟加载。此参数由 {@link Cesium3DTileset#foveatedInterpolationCallback} 和 {@link Cesium3DTileset#foveatedMinimumScreenSpaceErrorRelaxation} 控制。将此值设为 0.0 表示圆锥为相机位置和视图方向形成的线；设为 1.0 则表示圆锥覆盖整个相机视野，从而禁用该效果。
 * @property {number} [foveatedMinimumScreenSpaceErrorRelaxation=0.0] 优化选项。当 {@link Cesium3DTileset#foveatedScreenSpaceError} 为 true 时使用，用于控制 foveated 圆锥外的瓦片的起始屏幕空间误差松弛值。根据提供的 {@link Cesium3DTileset#foveatedInterpolationCallback}，从瓦片集值开始，屏幕空间误差会逐步升高至 {@link Cesium3DTileset#maximumScreenSpaceError}。
 * @property {Cesium3DTileset.foveatedInterpolationCallback} [foveatedInterpolationCallback=Math.lerp] 优化选项。当 {@link Cesium3DTileset#foveatedScreenSpaceError} 为 true 时使用，用于控制提升屏幕空间误差的程度，以在 {@link Cesium3DTileset#foveatedMinimumScreenSpaceErrorRelaxation} 和 {@link Cesium3DTileset#maximumScreenSpaceError} 之间插值。
 * @property {number} [foveatedTimeDelay=0.2] 优化选项。当 {@link Cesium3DTileset#foveatedScreenSpaceError} 为 true 时使用，用于控制相机停止移动后开始加载延迟瓦片的等待时间（以秒为单位）。此延迟时间可防止在相机移动时请求屏幕边缘的瓦片。将此值设为 0.0 将立即请求给定视图中的所有瓦片。
 * @property {boolean} [skipLevelOfDetail=false] 优化选项。决定在遍历过程中是否应跳过细节级别。
 * @property {number} [baseScreenSpaceError=1024] 当 <code>skipLevelOfDetail</code> 为 <code>true</code> 时，需要达到的屏幕空间误差，在此误差下才会跳过细节级别。
 * @property {number} [skipScreenSpaceErrorFactor=16] 当 <code>skipLevelOfDetail</code> 为 <code>true</code> 时，用于定义可跳过的最小屏幕空间误差的乘数。与 <code>skipLevels</code> 结合使用，以确定加载哪些瓦片。
 * @property {number} [skipLevels=1] 当 <code>skipLevelOfDetail</code> 为 <code>true</code> 时，用于定义加载瓦片时需跳过的最小级别数目的常数。当值为 0 时，不跳过任何级别。与 <code>skipScreenSpaceErrorFactor</code> 结合使用，以确定加载哪些瓦片。
 * @property {boolean} [immediatelyLoadDesiredLevelOfDetail=false] 当 <code>skipLevelOfDetail</code> 为 <code>true</code> 时，只有满足最大屏幕空间误差的瓦片才会被下载。跳过因子被忽略，仅加载所需的瓦片。
 * @property {boolean} [loadSiblings=false] 当 <code>skipLevelOfDetail</code> 为 <code>true</code> 时，决定在遍历过程中是否始终下载可见瓦片的同级瓦片。
 * @property {ClippingPlaneCollection} [clippingPlanes] 用于选择性禁用瓦片集渲染的 {@link ClippingPlaneCollection}。
 * @property {ClippingPolygonCollection} [clippingPolygons] 用于选择性禁用瓦片集渲染的 {@link ClippingPolygonCollection}。
 * @property {ClassificationType} [classificationType] 决定地形、3D Tiles或两者是否由该瓦片集进行分类。有关限制和限制详情，请参阅 {@link Cesium3DTileset#classificationType}。
 * @property {HeightReference} [heightReference] 设置向量瓦片集中特征的 {@link HeightReference}。
 * @property {Scene} [scene] 瓦片集将渲染所在的 {@link CesiumWidget#scene}，对于指定了 {@link heightReference} 值的瓦片集来说，用于将 3D Tiles 向量数据内容（如点、线和标签）限制在地形或 3D 瓦片上。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] 确定地球大小和形状的椭球体。
 * @property {object} [pointCloudShading] 用于构建 {@link PointCloudShading} 对象的选项，以根据几何误差和光照控制点的衰减。
 * @property {Cartesian3} [lightColor] 着色模型中的灯光颜色。当 <code>undefined</code> 时，使用场景的灯光颜色。
 * @property {ImageBasedLighting} [imageBasedLighting] 用于管理该瓦片集基于图像的照明属性的属性。
 * @property {DynamicEnvironmentMapManager.ConstructorOptions} [environmentMapOptions] 用于管理该瓦片集上的动态环境地图的属性。
 * @property {boolean} [backFaceCulling=true] 是否剔除背向方向的几何图形。当为 <code>true</code> 时，背面对剔除由 glTF 材料的 doubleSided 属性决定；当为 <code>false</code> 时，背面对剔除被禁用。
 * @property {boolean} [enableShowOutline=true] 是否启用使用 {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展的模型轮廓。可以设置为 false，以避免在加载时对几何图形进行额外处理。当设置为 false 时，showOutlines 和 outlineColor 选项将被忽略。
 * @property {boolean} [showOutline=true] 是否显示使用 {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展的模型轮廓。当设置为 true 时，会显示轮廓；当设置为 false 时，不显示轮廓。
 * @property {Color} [outlineColor=Color.BLACK] 渲染轮廓时使用的颜色。
 * @property {boolean} [vectorClassificationOnly=false] 指示仅使用 tileset 的矢量瓦片进行分类。
 * @property {boolean} [vectorKeepDecodedPositions=false] 矢量瓦片是否应在内存中保留解码后的位置。此选项与 {@link Cesium3DTileFeature.getPolylinePositions} 一起使用。
 * @property {BlendOption} [vectorBlendOption=BlendOption.TRANSLUCENT] 确定 tileset 中的矢量原语如何与场景混合。必须设置为 {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}；不支持 {@link BlendOption.OPAQUE_AND_TRANSLUCENT}。
 * @property {boolean} [vectorGeoJson=false] GeoJSON 内容是否作为矢量原语而非模型加载。矢量原语填充多边形，而模型仅绘制其轮廓。
 * @property {string|number} [featureIdLabel="featureId_0"] 用于选择和样式化的特征 ID 标签。对于 EXT_mesh_features，这是特征 ID 的 label 属性；如果未指定，则显示为 "featureId_N"（其中 N 是 featureIds 数组中的索引）。EXT_feature_metadata 没有 label 字段，因此此类特征 ID 标签始终为 "featureId_N"，其中 N 是所有特征 ID 列表中的索引，特征 ID 属性位于特征 ID 纹理之前。如果 featureIdLabel 是一个整数 N，则自动转换为字符串 "featureId_N"。如果同时存在逐原语和逐实例特征 ID，则实例特征 ID 具有优先权。
 * @property {string|number} [instanceFeatureIdLabel="instanceFeatureId_0"] 用于选择和样式化的实例特征 ID 标签。如果 instanceFeatureIdLabel 设置为一个整数 N，则自动转换为字符串 "instanceFeatureId_N"。如果同时存在逐原语和逐实例特征 ID，则实例特征 ID 具有优先权。
 * @property {boolean} [showCreditsOnScreen=false] 是否在屏幕上显示此 tileset 的致谢信息。
 * @property {SplitDirection} [splitDirection=SplitDirection.NONE] 应用于此 tileset 的 {@link SplitDirection} 分割方式。
 * @property {boolean} [enableCollision=false] 当 <code>true</code> 时，启用相机或 CPU 拾取的碰撞功能。在 <code>true</code> 状态下，如果 {@link ScreenSpaceCameraController#enableCollisionDetection} 为 true，则相机无法低于瓦片集表面。这也会影响 {@link HeightReference.CLAMP_TO_GROUND} 在约束到 3D Tiles 表面时的行为。如果 <code>enableCollision</code> 为 <code>false</code>，实体可能无法正确约束到瓦片集几何形状上。
 * @property {boolean} [projectTo2D=false] 是否将瓦片集准确投影到 2D 空间。如果为 true，瓦片集将被准确投影到 2D 空间，但会消耗更多内存。如果为 false，瓦片集会消耗较少内存，并且仍以 2D / CV 模式渲染，但其投影位置可能不准确。此设置无法在瓦片集创建后更改。
 * @property {boolean} [enablePick=false] 在使用 WebGL 1 时，是否允许使用 <code>pick</code> 进行碰撞和 CPU 拾取操作。如果使用 WebGL 2 或更高版本，此选项将被忽略。如果使用 WebGL 1 且为 true，<code>pick</code> 操作将正常工作，但会消耗更多内存。如果使用 WebGL 1 且为 false，模型会消耗较少内存，但 <code>pick</code> 始终返回 <code>undefined</code>。此设置无法在瓦片集加载后更改。
 * @property {boolean} [asynchronouslyLoadImagery=false] 是否应异步加载覆盖在瓦片集上的影像图层。如果为 <code>true</code>，瓦片内容将以其原始纹理显示，直到影像纹理加载完成。如果为 <code>false</code>，瓦片内容将在影像准备就绪后才会显示。
 * @property {string} [debugHeatmapTilePropertyName] 用于作为热图着色的瓦片变量。所有渲染的瓦片将依据彼此指定的变量值进行着色。
 * @property {boolean} [debugFreezeFrame=false] 仅用于调试。决定是否仅使用上一帧的瓦片进行渲染。
 * @property {boolean} [debugColorizeTiles=false] 仅用于调试。当为 true 时，将为每个瓦片分配随机颜色。
 * @property {boolean} [enableDebugWireframe=false] 仅用于调试。对于 WebGL1 中的 debugWireframe 功能，此值必须为 true。此设置无法在瓦片集创建后更改。
 * @property {boolean} [debugWireframe=false] 仅用于调试。当为 true 时，将每个瓦片的内容渲染为线框形式。
 * @property {EdgeDisplayMode} [edgeDisplayMode=EdgeDisplayMode.SURFACES_ONLY] 控制来自 {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility} glTF 扩展的边缘相对于表面几何形状的渲染方式。
 * @property {boolean} [debugShowBoundingVolume=false] 仅用于调试。当为 true 时，会渲染每个瓦片的边界体积。
 * @property {boolean} [debugShowContentBoundingVolume=false] 仅用于调试。当为 true 时，会渲染每个瓦片内容的边界体积。
 * @property {boolean} [debugShowViewerRequestVolume=false] 仅用于调试。当为 true 时，会渲染每个瓦片的查看器请求体积。
 * @property {boolean} [debugShowGeometricError=false] 仅用于调试。当为 true 时，会绘制标签以指示每个瓦片的几何误差。
 * @property {boolean} [debugShowRenderingStatistics=false] 仅用于调试。当为 true 时，会绘制标签以指示每个瓦片中的命令、点、三角形和特征数量。
 * @property {boolean} [debugShowMemoryUsage=false] 仅用于调试。当为 true 时，会绘制标签以指示每个瓦片使用的纹理和几何内存（以兆字节为单位）。
 * @property {boolean} [debugShowUrl=false] 仅用于调试。当为 true 时，会绘制标签以指示每个瓦片的 URL。
 */

/**
 * A {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification|3D Tiles tileset},
 * 用于流式传输庞大的异构 3D 地理空间数据集。
 *
 * <div class="notice">
 * 此对象通常不直接实例化，请使用 {@link Cesium3DTileset.fromUrl}。
 * </div>
 *
 * @alias Cesium3DTileset
 * @constructor
 * @experimental Support 用于加载使用 draft glTF extensions {@link https://github.com/CesiumGS/glTF/tree/draft-splat-spz/extensions/2.0/Khronos/KHR_gaussian_splatting | KHR_gaussian_splatting} 和 {@link https://github.com/CesiumGS/glTF/tree/draft-splat-spz/extensions/2.0/Khronos/KHR_gaussian_splatting_compression_spz_2} 的 SPZ 压缩编码的高斯斑点内容，该功能是实验性的，且可能随 Cesium 标准弃用政策而变更。
 * @param {Cesium3DTileset.ConstructorOptions} options 描述初始化选项的对象。
 *
 * @exception {DeveloperError} The 瓦片集必须是 3D Tiles 版本 0.0 或 1.0。
 * @exception {DeveloperError} Height 没有场景则不支持引用。
 *
 * @example
 * try {
 * const tileset = await Cesium.Cesium3DTileset.fromUrl(
 * "http://localhost:8002/tilesets/Seattle/tileset.json"
 *   );
 * scene.primitives.add(tileset);
 * } catch (error) {
 * console.error(`创建瓦片集时出错：${error}`);
 * }
 *
 * @example
 * // 开启与瓦片集的相机碰撞检测。
 * try {
 * const tileset = await Cesium.Cesium3DTileset.fromUrl(
 * "http://localhost:8002/tilesets/Seattle/tileset.json",
 * { enableCollision: true }
 *   );
 * scene.primitives.add(tileset);
 * } catch (error) {
 * console.error(`创建瓦片集时出错：${error}`);
 * }
 *
 * @example
 * // 用于 skipLevelOfDetail 优化的常见设置
 * const tileset = await Cesium.Cesium3DTileset.fromUrl(
 * "http://localhost:8002/tilesets/Seattle/tileset.json", {
 * skipLevelOfDetail: true,
 * baseScreenSpaceError: 1024,
 * skipScreenSpaceErrorFactor: 16,
 * skipLevels: 1,
 * immediatelyLoadDesiredLevelOfDetail: false,
 * loadSiblings: false,
 * cullWithChildrenBounds: true
 * });
 * scene.primitives.add(tileset);
 *
 * @example
 * // 动态屏幕空间误差优化的常见设置
 * const tileset = await Cesium.Cesium3DTileset.fromUrl(
 * "http://localhost:8002/tilesets/Seattle/tileset.json", {
 * dynamicScreenSpaceError: true,
 * dynamicScreenSpaceErrorDensity: 2.0e-4,
 * dynamicScreenSpaceErrorFactor: 24.0,
 * dynamicScreenSpaceErrorHeightFalloff: 0.25
 * });
 * scene.primitives.add(tileset);
 * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification|3D Tiles specification}
 */
function Cesium3DTileset(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._url = undefined;
  this._basePath = undefined;
  this._root = undefined;
  this._resource = undefined;
  this._asset = undefined; // Metadata for the entire tileset
  this._properties = undefined; // Metadata for per-model/point/etc properties
  this._geometricError = undefined; // Geometric error when the tree is not rendered at all
  this._scaledGeometricError = undefined; // Geometric error scaled by root tile scale
  this._extensionsUsed = undefined;
  this._extensions = undefined;
  this._modelUpAxis = undefined;
  this._modelForwardAxis = undefined;
  this._tilesetUpAxis = undefined; // Up axis of a glTF tileset, applied to the root tile transform
  this._cache = new Cesium3DTilesetCache();
  this._releaseCandidateTiles = new Set();
  this._processingQueue = [];
  this._selectedTiles = [];
  this._emptyTiles = [];
  this._requestedTiles = [];
  this._selectedTilesToStyle = [];
  this._loadTimestamp = undefined;
  this._timeSinceLoad = 0.0;
  this._updatedVisibilityFrame = 0;
  this._updatedModelMatrixFrame = 0;
  this._modelMatrixChanged = false;
  this._previousModelMatrix = undefined;
  this._extras = undefined;
  this._credits = undefined;

  this._showCreditsOnScreen = options.showCreditsOnScreen ?? false;

  this._cullWithChildrenBounds = options.cullWithChildrenBounds ?? true;
  this._allTilesAdditive = true;

  this._hasMixedContent = false;

  this._stencilClearCommand = undefined;
  this._backfaceCommands = new ManagedArray();

  this._maximumScreenSpaceError = options.maximumScreenSpaceError ?? 16;
  this._memoryAdjustedScreenSpaceError = this._maximumScreenSpaceError;
  // Set when memoryAdjustedScreenSpaceError is raised to fit the memory limit, along with the
  // view matrix at that time. See processTiles.
  this._memoryAdjustedScreenSpaceErrorHeld = false;
  this._memoryAdjustedScreenSpaceErrorViewMatrix = new Matrix4();

  this._cacheBytes = options.cacheBytes ?? 512 * 1024 * 1024;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThanOrEquals("cacheBytes", this._cacheBytes, 0);
  //>>includeEnd('debug');

  const maximumCacheOverflowBytes =
    options.maximumCacheOverflowBytes ?? 512 * 1024 * 1024;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThanOrEquals(
    "maximumCacheOverflowBytes",
    maximumCacheOverflowBytes,
    0,
  );
  //>>includeEnd('debug');
  this._maximumCacheOverflowBytes = maximumCacheOverflowBytes;

  this._styleEngine = new Cesium3DTileStyleEngine();
  this._styleApplied = false;

  this._modelMatrix = defined(options.modelMatrix)
    ? Matrix4.clone(options.modelMatrix)
    : Matrix4.clone(Matrix4.IDENTITY);

  this._addHeightCallbacks = [];

  this._statistics = new Cesium3DTilesetStatistics();
  this._statisticsLast = new Cesium3DTilesetStatistics();
  this._statisticsPerPass = new Array(Cesium3DTilePass.NUMBER_OF_PASSES);

  for (let i = 0; i < Cesium3DTilePass.NUMBER_OF_PASSES; ++i) {
    this._statisticsPerPass[i] = new Cesium3DTilesetStatistics();
  }

  this._requestedTilesInFlight = [];

  this._maximumPriority = {
    foveatedFactor: -Number.MAX_VALUE,
    depth: -Number.MAX_VALUE,
    distance: -Number.MAX_VALUE,
    reverseScreenSpaceError: -Number.MAX_VALUE,
  };
  this._minimumPriority = {
    foveatedFactor: Number.MAX_VALUE,
    depth: Number.MAX_VALUE,
    distance: Number.MAX_VALUE,
    reverseScreenSpaceError: Number.MAX_VALUE,
  };
  this._heatmap = new Cesium3DTilesetHeatmap(
    options.debugHeatmapTilePropertyName,
  );

  /**
   * 优化选项。不请求那些由于相机移动而可能未被使用的瓦片，因为该优化仅适用于静止的瓦片集。
   *
   * @type {boolean}
   * @default true
   */
  this.cullRequestsWhileMoving = options.cullRequestsWhileMoving ?? true;
  this._cullRequestsWhileMoving = false;

  /**
   * 优化选项。在移动过程中用于裁剪请求的乘数。数值越大，裁剪越严格；数值越小，裁剪越宽松。
   *
   * @type {number}
   * @default 60.0
   */
  this.cullRequestsWhileMovingMultiplier =
    options.cullRequestsWhileMovingMultiplier ?? 60.0;

  /**
   * 优化选项。如果处于 (0.0, 0.5] 范围内，在降低屏幕分辨率的 <code>progressiveResolutionHeightFraction*screenHeight</code> 下，屏幕空间误差以上的瓦片将优先加载。这有助于在全分辨率瓦片继续加载期间快速加载部分瓦片。
   *
   * @type {number}
   * @default 0.3
   */
  this.progressiveResolutionHeightFraction = CesiumMath.clamp(
    options.progressiveResolutionHeightFraction ?? 0.3,
    0.0,
    0.5,
  );

  /**
   * 优化选项。优先加载边缘区域瓦片。
   *
   * @type {boolean}
   * @default false
   */
  this.preferLeaves = options.preferLeaves ?? false;

  this._tilesLoaded = false;
  this._initialTilesLoaded = false;

  this._tileDebugLabels = undefined;

  this._classificationType = options.classificationType;
  this._heightReference = options.heightReference;
  this._scene = options.scene;

  //>>includeStart('debug', pragmas.debug);
  if (isHeightReferenceClamp(this._heightReference) && !defined(this._scene)) {
    throw new DeveloperError(
      "Height reference is not supported without a scene.",
    );
  }
  //>>includeEnd('debug');

  this._ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;

  this._initialClippingPlanesOriginMatrix = Matrix4.IDENTITY; // Computed from the tileset JSON.
  this._clippingPlanesOriginMatrix = undefined; // Combines the above with any run-time transforms.
  this._clippingPlanesOriginMatrixDirty = true;

  this._vectorClassificationOnly = options.vectorClassificationOnly ?? false;

  this._vectorKeepDecodedPositions =
    options.vectorKeepDecodedPositions ?? false;

  this._vectorBlendOption =
    options.vectorBlendOption ?? BlendOption.TRANSLUCENT;

  this._vectorGeoJson = options.vectorGeoJson ?? false;

  /**
   * 提供2D地理参考的 <code>ImageryLayer</code> 对象集合，
   * 用于在瓦片集上渲染的图像数据。
   *
   * @private
   * @type {ImageryLayerCollection}
   * @readonly
   */
  this._imageryLayers = new ImageryLayerCollection(this);

  /**
   * 用于记录每次对影像图层修改的计数器，
   * 即 layerAdded、layerRemoved、
   * layerMoved 或 layerShownOrHidden 事件时都会增加。该计数器可由 <code>ModelImagery</code> 类使用，
   * 以检测影像的变化，并触发相应的更新。
   * 附加到影像图层 layerAdded、layerRemoved、
   *
   * @private
   */
  this._imageryLayersModificationCounter = 0;

  /**
   * layerMoved 和 layerShownOrHidden 事件的监听器，
   * 并针对每个事件增加影像图层修改计数器。
   * 决定是否异步加载覆盖在瓦片集上的影像。如果为 <code>true</code>，则瓦片内容
   * 将以其原始纹理显示，直到影像纹理被加载完成。如果为 <code>false</code>，则瓦片内容
   *
   * @private
   * @readonly
   */
  this._imageryLayersListener = () => {
    this._imageryLayersModificationCounter++;
  };

  // Attach the imagery layers listener to all events of
  // the imagery layers collection
  this.imageryLayers.layerAdded.addEventListener(this._imageryLayersListener);
  this.imageryLayers.layerRemoved.addEventListener(this._imageryLayersListener);
  this.imageryLayers.layerMoved.addEventListener(this._imageryLayersListener);
  this.imageryLayers.layerShownOrHidden.addEventListener(
    this._imageryLayersListener,
  );

  /**
   * 将在影像准备就绪前不显示。
   * 当 <code>tileset.show</code> 为 <code>false</code> 时预加载瓦片。加载瓦片的行为如同瓦片集可见但不进行渲染。
   * will be displayed with its original texture until the imagery texture
   * is loaded. If this is <code>false</code>, then the tile content will
   * not be displayed until the imagery is ready.
   *
   * @private
   */
  this._asynchronouslyLoadImagery = options.asynchronouslyLoadImagery ?? false;

  /**
   * Preload tiles when <code>tileset.show</code> is <code>false</code>. Loads tiles as if the tileset is visible but does not render them.
   *
   * @type {boolean}
   * @default false
   */
  this.preloadWhenHidden = options.preloadWhenHidden ?? false;

  /**
   * 优化选项。当相机处于飞行状态时，在相机飞行目的地处获取瓦片。
   *
   * @type {boolean}
   * @default true
   */
  this.preloadFlightDestinations = options.preloadFlightDestinations ?? true;
  this._pass = undefined; // Cesium3DTilePass

  /**
   * 优化选项。对于街道级地平线视图，使用远离相机的低分辨率瓦片。这减少了
   * 加载的数据量，并提高了瓦片集加载时间，但远处视觉质量略有下降。
   * <p>
   * 当相机靠近瓦片集的地平面并观察地平线时，此优化效果最显著。
   * 对于紧密贴合的边界体积（如框和区域）来说，结果更为准确。
   *
   * @type {boolean}
   * @default true
   */
  this.dynamicScreenSpaceError = options.dynamicScreenSpaceError ?? true;

  /**
   * 优化选项。通过暂时提高屏幕空间误差，优先加载屏幕中央的瓦片。一旦由 {@link Cesium3DTileset#foveatedConeSize}确定的屏幕中央所有瓦片被加载，屏幕空间误差将恢复正常。
   * 获取或设置回调，以控制屏幕边缘瓦片的屏幕空间误差提升程度。
   * the tiles in the center of the screen as determined by the {@link Cesium3DTileset#foveatedConeSize} are loaded.
   *
   * @type {boolean}
   * @default true
   */
  this.foveatedScreenSpaceError = options.foveatedScreenSpaceError ?? true;
  this._foveatedConeSize = options.foveatedConeSize ?? 0.1;
  this._foveatedMinimumScreenSpaceErrorRelaxation =
    options.foveatedMinimumScreenSpaceErrorRelaxation ?? 0.0;

  /**
   * 获取或设置回调，控制在聚焦锥外的瓦片屏幕空间误差的提升程度。
   * interpolating between {@link Cesium3DTileset#foveatedMinimumScreenSpaceErrorRelaxation} and {@link Cesium3DTileset#maximumScreenSpaceError}.
   *
   * @type {Cesium3DTileset.foveatedInterpolationCallback}
   */
  this.foveatedInterpolationCallback =
    options.foveatedInterpolationCallback ?? CesiumMath.lerp;

  /**
   * 优化选项。当 {@link Cesium3DTileset#foveatedScreenSpaceError}为true时使用，以控制等待时间。
   * 在相机停止移动后开始加载延迟瓦片所需的等待时间（以秒为单位）。
   * 此延迟时间防止在相机移动时请求屏幕边缘的瓦片。
   * 将此值设为0.0会立即请求给定视图中的所有瓦片。
   *
   * @type {number}
   * @default 0.2
   */
  this.foveatedTimeDelay = options.foveatedTimeDelay ?? 0.2;

  /**
   * 类似于 {@link Fog#density}，此选项控制当 {@link Cesium3DTileset#dynamicScreenSpaceError}优化生效时的相机距离。
   * 较大的值会导致更靠近相机的瓦片受到影响。该值必须是非负值。
   * 此优化通过像钟形曲线一样随相机距离衰减屏幕空间误差来实现。
   * <p>
   * 其效果是选择远离相机的低分辨率瓦片。靠近相机时不做调整。对于更远的瓦片，SSE减少量可达 {@link Cesium3DTileset#dynamicScreenSpaceErrorFactor}
   * （以错误像素数计量）。
   * made. For tiles further away, the SSE is reduced by up to {@link Cesium3DTileset#dynamicScreenSpaceErrorFactor}
   * (measured in pixels of error).
   * </p>
   * <p>
   * Increasing the density makes the bell curve narrower so tiles closer to the camera are affected. This is analagous
   * 将雾气移近相机。
   * </p>
   * <p>
   * 当密度为 0 时，优化对瓦片集没有效果。
   * </p>
   *
   * @type {number}
   * @default 2.0e-4
   */
  this.dynamicScreenSpaceErrorDensity =
    options.dynamicScreenSpaceErrorDensity ?? 2.0e-4;

  /**
   * 一个控制针对地平线上瓦片的 {@link Cesium3DTileset#dynamicScreenSpaceError} 优化的强度的参数。
   * 较大的值会导致较低分辨率的瓦片加载，从而在运行时性能上略有提升，
   * 但会降低视觉质量。该值必须为非负值。
   * <p>
   * 更具体地说，此参数表示对远离相机的瓦片的屏幕空间误差（SSE）的最大调整量，单位为像素。
   * 有关此优化的详细机制，请参阅 {@link Cesium3DTileset#dynamicScreenSpaceErrorDensity}。
   * 此优化的工作原理如下。
   * </p>
   * <p>
   * 当 SSE 因子设置为 0 时，优化对瓦片集没有效果。
   * </p>
   *
   * @type {number}
   * @default 24.0
   */
  this.dynamicScreenSpaceErrorFactor =
    options.dynamicScreenSpaceErrorFactor ?? 24.0;

  /**
   * 决定 {@link Cesium3DTileset#dynamicScreenSpaceError} 优化的“街道水平”状态的瓦片集高度比例。当相机低于此高度时，屏幕空间误差优化将发挥最大效果，且高于该值时会逐渐减弱。有效值介于 0.0 和 1.0 之间。
   * 决定瓦片集是否投射或接收光源的阴影。
   * 启用阴影会对性能产生影响。投射阴影的瓦片集需要被渲染两次：一次从相机视角，一次从光源视角。
   * <p>
   *
   * @type {number}
   * @default 0.25
   */
  this.dynamicScreenSpaceErrorHeightFalloff =
    options.dynamicScreenSpaceErrorHeightFalloff ?? 0.25;

  // Updated based on the camera position and direction
  this._dynamicScreenSpaceErrorComputedDensity = 0.0;

  /**
   * 仅当 {@link Viewer#shadows} 为 <code>true</code> 时，阴影才会被渲染。
   * <p>
   * 决定瓦片集是否会被显示。
   * </p>
   * <p>
   * Shadows are rendered only when {@link Viewer#shadows} is <code>true</code>.
   * </p>
   *
   * @type {ShadowMode}
   * @default ShadowMode.ENABLED
   */
  this.shadows = options.shadows ?? ShadowMode.ENABLED;

  /**
   * 定义瓦片集是否显示。
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  /**
   * 定义从 Cesium API 获取的颜色与原始特征的源颜色如何线性插值。
   * 例如，在瓦片中作为 glTF 材质或每点的颜色。
   *
   * @type {Cesium3DTileColorBlendMode}
   * @default Cesium3DTileColorBlendMode.HIGHLIGHT
   */
  this.colorBlendMode = Cesium3DTileColorBlendMode.HIGHLIGHT;

  /**
   * 定义当 {@link Cesium3DTileset#colorBlendMode} 为 <code>MIX</code> 时用于线性插值源颜色和特征颜色的值。
   * 0.0 值对应源颜色，1.0 值对应特征颜色，中间的任何值都会产生源颜色与特征颜色的混合效果。
   * 此事件用于指示新瓦片的加载进度。当请求新的瓦片、已下载的瓦片完成下载或已下载的瓦片被处理并准备渲染时，都会触发此事件。
   *
   * @type {number}
   * @default 0.5
   */
  this.colorBlendAmount = 0.5;

  this._pointCloudShading = new PointCloudShading(options.pointCloudShading);
  this._pointCloudEyeDomeLighting = new PointCloudEyeDomeLighting();

  /**
   * 表示新瓦片加载进度的事件。当请求新的瓦片、已下载的瓦片完成下载或已下载的瓦片被处理并准备渲染时，都会触发此事件。
   * 待处理的瓦片请求数量 <code>numberOfPendingRequests</code> 以及瓦片的数量。
   * processed and is ready to render.
   * <p>
   * The number of pending tile requests, <code>numberOfPendingRequests</code>, and number of tiles
   * 处理过程及 <code>numberOfTilesProcessing</code> 值会被传递给事件监听器。
   * </p>
   * <p>
   * 该事件在场景渲染完成后帧结束时被触发。
   * </p>
   *
   * @type {Event}
   * @default new 事件()
   *
   * @example
   * tileset.loadProgress.addEventListener(函数(numberOfPendingRequests, numberOfTilesProcessing) {
   * 如果 ((numberOfPendingRequests === 0) && (numberOfTilesProcessing === 0)) {
   * console.log('停止加载');
   * return;
   *     }
   *
   * console.log(`加载中: 请求数: ${numberOfPendingRequests}, 处理数: ${numberOfTilesProcessing}`);
   * });
   */
  this.loadProgress = new Event();

  /**
   * 该事件被触发，表示本帧中所有满足屏幕空间错误的瓦片都已加载完成。该 tileset
   * 对于此视图已完全加载。
   * <p>
   * 该事件在场景渲染完成后帧结束时被触发。
   * </p>
   *
   * @type {Event}
   * @default new 事件()
   *
   * @example
   * tileset.allTilesLoaded.addEventListener(函数() {
   * console.log('所有瓦片已加载');
   * });
   *
   * @see Cesium3DTileset#tilesLoaded
   */
  this.allTilesLoaded = new Event();

  /**
   * 该事件被触发，表示本帧中所有满足屏幕空间错误的瓦片都已加载完成。该事件
   * 在初始视图中的所有瓦片加载完成后触发一次。
   * <p>
   * 该事件在场景渲染完成后帧结束时被触发。
   * </p>
   *
   * @type {Event}
   * @default new 事件()
   *
   * @example
   * tileset.initialTilesLoaded.addEventListener(函数() {
   * console.log('初始瓦片已加载');
   * });
   *
   * @see Cesium3DTileset#allTilesLoaded
   */
  this.initialTilesLoaded = new Event();

  /**
   * 该事件被触发，表示某个瓦片的内容已加载完成。
   * <p>
   * 已加载的 {@link Cesium3DTile} 会被传递给事件监听器。
   * </p>
   * <p>
   * 该事件在 tileset 遍历过程中、场景渲染时触发
   * 以便瓦片更新能在同一帧内生效。在事件监听期间不要创建或修改
   * Cesium 实体或基本体。
   * </p>
   *
   * @type {Event}
   * @default new 事件()
   *
   * @example
   * tileset.tileLoad.addEventListener(函数(tile) {
   * console.log('一个瓦片已加载。');
   * });
   */
  this.tileLoad = new Event();

  /**
   * 该事件被触发，表示某个瓦片的内容已卸载。
   * <p>
   * 已卸载的 {@link Cesium3DTile} 会被传递给事件监听器。
   * </p>
   * <p>
   * 该事件在瓦片内容卸载前、场景渲染时立即触发，以便事件监听器能够访问该瓦片的内容。在事件监听期间不要创建
   * 或修改 Cesium 实体或基本体。
   * 事件()
   * </p>
   *
   * @type {Event}
   * @default new tileset.tileUnload.addEventListener(函数(tile) {
   *
   * @example
   * tileset.tileUnload.addEventListener(function(tile) {
   * console.log('一个瓦片从缓存中卸载。');
   * });
   *
   * @see Cesium3DTileset#cacheBytes
   * @see Cesium3DTileset#trimLoadedTiles
   */
  this.tileUnload = new Event();

  /**
   * 该事件被触发，表示某个瓦片的内容加载失败。
   * <p>
   * 如果没有事件监听器，错误信息将记录到控制台。
   * </p>
   * <p>
   * 传递给监听器的错误对象包含两个属性：
   * <ul>
   * <li><code>url</code>: 失败瓦片的网址。</li>
   * <li><code>message</code>: 错误信息。</li>
   * </ul>
   * <p>
   * 如果存在多个内容，此事件将在每个有错误的内部内容时触发一次。
   * </p>
   *
   * @type {Event}
   * @default new Event()
   *
   * @example
   * tileset.tileFailed.addEventListener(function(error) {
   * console.log(`加载瓦片时发生错误：${error.url}`);
   * console.log(`错误：${error.message}`);
   * });
   */
  this.tileFailed = new Event();

  /**
   * 此事件在每一帧中针对每个可见瓦片触发一次。这可用于手动
   * 自定义 tileset 样式。
   * <p>
   * 可见的 {@link Cesium3DTile} 会被传递给事件监听器。
   * </p>
   * <p>
   * 此事件在 tileset 遍历过程中，在帧渲染时触发
   * 以便瓦片的更新在同一帧内生效。不要在事件监听器中创建或修改
   * Cesium 实体或基本体。
   * </p>
   *
   * @type {Event}
   * @default new Event()
   *
   * @example
   * tileset.tileVisible.addEventListener(function(tile) {
   * if (tile.content instanceof Cesium.Model3DTileContent) {
   * console.log('一个 3D 模型瓦片可见。');
   *     }
   * });
   *
   * @example
   * // 应用红色样式，然后当瓦片可见时手动为其他特征设置随机颜色。
   * tileset.style = new Cesium.Cesium3DTileStyle({
   * color : 'color("red")'
   * });
   * tileset.tileVisible.addEventListener(function(tile) {
   * const content = tile.content;
   * const featuresLength = content.featuresLength;
   * for (let i = 0; i < featuresLength; i+=2) {
   * content.getFeature(i).color = Cesium.Color.fromRandom();
   *     }
   * });
   */
  this.tileVisible = new Event();

  /**
   * 优化选项。决定在遍历过程中是否应跳过细节级别。
   * <p>
   * 替换-细化遍历的常见策略是将树的所有层级存储在内存中，并要求
   * 所有子节点加载完成后再对父节点进行细化。通过此优化，可以完全跳过树中的某些层级
   * 并让子节点与父节点一起渲染。使用此优化时，tileset 所需的内存显著减少。
   * 数据提供器注入的可选运行时内容编解码器
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.skipLevelOfDetail = options.skipLevelOfDetail ?? false;

  this._disableSkipLevelOfDetail = false;

  /**
   * (例如 {@link MVTDataProvider})。设置后，{@link Cesium3DTile} 会绕过
   * (e.g. {@link MVTDataProvider}). When set, {@link Cesium3DTile} bypasses
   * 内容构建工作委托给 <code>codec.createContent(...)</code>。这
   * 将格式特定的逻辑移出运行时。
   * 形状：
   *
   * contentType: string,                 // 仅用于诊断
   *   {
   * disableSkipLevelOfDetail?: boolean,
   * createContent: (tileset, tile, resource, arrayBuffer) => Promise<Cesium3DTileContent>,
   * createContent: (tileset, tile, resource, arrayBuffer) => Promise<Cesium3DTileContent>,
   * 缺失瓦片策略？：{ statusCodes？：number[] }
   * // 缺失瓦片策略指定了应解释的 HTTP 状态码
   * // 作为“无内容”处理，并渲染为空白瓦片，而不是抛出异常
   * // 错误或重试请求。允许瓦片被静态托管，
   * // 而不生成和提供不必要的内容用于空白瓦片。
   *   }
   *
   * @type {object|undefined}
   * @ignore
   */
  this._runtimeContentCodec = undefined;

  /**
   * 在跳过细节级别之前必须达到的屏幕空间错误。
   * <p>
   * 仅在 {@link Cesium3DTileset#skipLevelOfDetail} 为 <code>true</code> 时使用。
   * </p>
   *
   * @type {number}
   * @default 1024
   */
  this.baseScreenSpaceError = options.baseScreenSpaceError ?? 1024;

  /**
   * 定义跳过所需最小屏幕空间错误的倍数。
   * 例如，如果某个瓦片的屏幕空间错误为 100，除非它们是叶子或具有 <code><= 100 / skipScreenSpaceErrorFactor</code> 的屏幕空间错误，否则不会加载任何瓦片。
   * 仅在 {@link Cesium3DTileset#skipLevelOfDetail} 为 <code>true</code> 时使用。
   * <p>
   * Only used when {@link Cesium3DTileset#skipLevelOfDetail} is <code>true</code>.
   * </p>
   *
   * @type {number}
   * @default 16
   */
  this.skipScreenSpaceErrorFactor = options.skipScreenSpaceErrorFactor ?? 16;

  /**
   * 例如，如果某个瓦片是第 1 层，除非它们位于第 2 层以上，否则不会加载任何瓦片。
   * 仅在 {@link Cesium3DTileset#skipLevelOfDetail} 为 <code>true</code> 时使用。
   * <p>
   * 仅在 {@link Cesium3DTileset#skipLevelOfDetail} 为 <code>true</code> 时使用。
   * </p>
   *
   * @type {number}
   * @default 1
   */
  this.skipLevels = options.skipLevels ?? 1;

  /**
   * 当为 true 时，只有满足最大屏幕空间错误的瓦片才会被下载。
   * 跳过因子被忽略，仅加载所需的瓦片。
   * <p>
   * 仅在 {@link Cesium3DTileset#skipLevelOfDetail} 为 <code>true</code> 时使用。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.immediatelyLoadDesiredLevelOfDetail =
    options.immediatelyLoadDesiredLevelOfDetail ?? false;

  /**
   * 确定在遍历过程中是否始终下载可见瓦片的兄弟瓦片。
   * 这可能对确保查看器左右转动时瓦片已准备好很有用。
   * <p>
   * 仅在 {@link Cesium3DTileset#skipLevelOfDetail} 为 <code>true</code> 时使用。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.loadSiblings = options.loadSiblings ?? false;

  this._clippingPlanes = undefined;
  if (defined(options.clippingPlanes)) {
    ClippingPlaneCollection.setOwner(
      options.clippingPlanes,
      this,
      "_clippingPlanes",
    );
  }

  this._clippingPolygons = undefined;
  this._clippingPolygonsNeedRebake = false;
  this._removeClippingPolygonAdded = undefined;
  this._removeClippingPolygonRemoved = undefined;
  if (defined(options.clippingPolygons)) {
    ClippingPolygonCollection.setOwner(
      options.clippingPolygons,
      this,
      "_clippingPolygons",
    );
    updateTilesetClippingPolygonListeners(this);
  }

  if (defined(options.imageBasedLighting)) {
    this._imageBasedLighting = options.imageBasedLighting;
    this._shouldDestroyImageBasedLighting = false;
  } else {
    this._imageBasedLighting = new ImageBasedLighting();
    this._shouldDestroyImageBasedLighting = true;
  }

  this._environmentMapManager = new DynamicEnvironmentMapManager(
    options.environmentMapOptions,
  );

  /**
   * 阴影模型时的光照颜色。当为 <code>undefined</code> 时，使用场景的光照颜色。
   * <p>
   * 例如，通过设置
   * <code>tileset.imageBasedLighting.imageBasedLightingFactor = new Cartesian2(0.0, 0.0)</code>
   * 可以禁用额外的光源，从而使瓦片集变暗。这里，增加光源强度会使瓦片集更亮。
   * </p>
   *
   * @type {Cartesian3}
   * @default undefined
   */
  this.lightColor = options.lightColor;

  /**
   * 是否剔除背向几何图形。当为 true 时，背面对剔除由 glTF 材质的 doubleSided 属性决定；当为 false 时，背面对剔除被禁用。
   * 是否显示使用
   *
   * @type {boolean}
   * @default true
   */
  this.backFaceCulling = options.backFaceCulling ?? true;

  this._enableShowOutline = options.enableShowOutline ?? true;

  /**
   * {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展的模型的轮廓。
   * {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} extension.
   * 当为 true 时，会显示轮廓线；当为 false 时，不显示轮廓线。
   *
   * @type {boolean}
   * @default true
   */
  this.showOutline = options.showOutline ?? true;

  /**
   * 渲染轮廓线的颜色。
   *
   * @type {Color}
   * @default Color.BLACK
   */
  this.outlineColor = options.outlineColor ?? Color.BLACK;

  /**
   * 应用于此瓦片集的 {@link SplitDirection}。
   *
   * @type {SplitDirection}
   * @default {@link SplitDirection.NONE}
   */
  this.splitDirection = options.splitDirection ?? SplitDirection.NONE;

  /**
   * 如果 <code>true</code>，则允许相机碰撞或拾取。当此值为 <code>true</code> 时，如果 {@link ScreenSpaceCameraController#enableCollisionDetection} 为 true，相机将无法进入或低于瓦片集表面。如果瓦片集包含顶点数较多的瓦片，这可能会导致性能问题。
   *
   * @type {boolean}
   * @default false
   */
  this.enableCollision = options.enableCollision ?? false;
  this._projectTo2D = options.projectTo2D ?? false;
  this._enablePick = options.enablePick ?? false;

  /**
   * 此属性仅用于调试；未针对生产环境优化。
   * <p>
   * 决定是否仅使用上一帧的瓦片进行渲染。这
   * 实际上将瓦片集“冻结”在上一帧状态，从而可以缩放
   * 并查看已渲染的内容。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugFreezeFrame = options.debugFreezeFrame ?? false;

  /**
   * 此属性仅用于调试；未针对生产环境优化。
   * <p>
   * 当为 true 时，为每个瓦片分配随机颜色。这对于可视化
   * 哪些特征属于哪些瓦片非常有用，尤其是在叠加细化模式下，父瓦片的特征
   * 可能与子瓦片的特征混合在一起。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugColorizeTiles = options.debugColorizeTiles ?? false;

  this._enableDebugWireframe = options.enableDebugWireframe ?? false;

  /**
   * 此属性仅用于调试；未针对生产环境优化。
   * <p>
   * 当为 true 时，将每个瓦片的内容渲染为线框形式。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugWireframe = options.debugWireframe ?? false;

  // Warning for improper setup of debug wireframe
  if (this.debugWireframe === true && this._enableDebugWireframe === false) {
    oneTimeWarning(
      "tileset-debug-wireframe-ignored",
      "enableDebugWireframe must be set to true in the Cesium3DTileset constructor, otherwise debugWireframe will be ignored.",
    );
  }

  /**
   * 控制来自
   * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility}
   * glTF 扩展的边缘如何相对于表面几何图形进行渲染。瓦片内容
   * 未声明该扩展的基本体不受影响。
   *
   * @type {EdgeDisplayMode}
   * @default EdgeDisplayMode.SURFACES_ONLY
   */
  this.edgeDisplayMode =
    options.edgeDisplayMode ?? EdgeDisplayMode.SURFACES_ONLY;

  /**
   * 此属性仅用于调试；未针对生产环境优化。
   * <p>
   * 当为 true 时，渲染每个可见瓦片的边界体积。边界体积为
   * 白色，如果瓦片有内容边界体积或为空；否则为红色。不符合
   * 屏幕空间错误且仍在细化到其后代的瓦片为黄色。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;

  /**
   * 此属性仅用于调试；未针对生产环境优化。
   * <p>
   * 当为 true 时，渲染每个可见瓦片内容的边界体积。边界体积为
   * 蓝色，如果瓦片有内容边界体积；否则为红色。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugShowContentBoundingVolume =
    options.debugShowContentBoundingVolume ?? false;

  /**
   * 此属性仅用于调试；未针对生产环境优化。
   * <p>
   * 当为 true 时，渲染每个瓦片的查看器请求体积。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugShowViewerRequestVolume =
    options.debugShowViewerRequestVolume ?? false;

  /**
   * @private
   * @type {LabelCollection|undefined}
   */
  this._tileDebugLabels = undefined;
  this.debugPickedTileLabelOnly = false;
  this.debugPickedTile = undefined;
  this.debugPickPosition = undefined;

  /**
   * 此属性仅用于调试，未针对生产环境优化。
   * <p>
   * 当为 true 时，会绘制标签以指示每个瓦片的几何误差。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugShowGeometricError = options.debugShowGeometricError ?? false;

  /**
   * 此属性仅用于调试，未针对生产环境优化。
   * <p>
   * 当为 true 时，会绘制标签以指示每个瓦片中的命令、点、三角形和特征数量。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugShowRenderingStatistics =
    options.debugShowRenderingStatistics ?? false;

  /**
   * 此属性仅用于调试，未针对生产环境优化。
   * <p>
   * 当为 true 时，会绘制标签以指示每个瓦片的几何和纹理内存使用情况。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugShowMemoryUsage = options.debugShowMemoryUsage ?? false;

  /**
   * 此属性仅用于调试，未针对生产环境优化。
   * <p>
   * 当为 true 时，会绘制标签以指示每个瓦片的 URL。
   * </p>
   *
   * @type {boolean}
   * @default false
   */
  this.debugShowUrl = options.debugShowUrl ?? false;

  /**
   * 用于检查正在流化的矢量线。
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，尚未定稿，且可能根据 Cesium 的标准弃用政策发生变化。
   *
   * @type {Function}
   */
  this.examineVectorLinesFunction = undefined;

  // this is the underlying Cesium3DTileMetadata object, whether it came from
  // the 3DTILES_metadata extension or a 3D Tiles 1.1 tileset JSON. Getters
  // like tileset.metadata and tileset.schema will delegate to this object.
  this._metadataExtension = undefined;

  this._featureLayers = new FeatureLayerCollection();

  this._customShader = options.customShader;

  let featureIdLabel = options.featureIdLabel ?? "featureId_0";
  if (typeof featureIdLabel === "number") {
    featureIdLabel = `featureId_${featureIdLabel}`;
  }
  this._featureIdLabel = featureIdLabel;

  let instanceFeatureIdLabel =
    options.instanceFeatureIdLabel ?? "instanceFeatureId_0";
  if (typeof instanceFeatureIdLabel === "number") {
    instanceFeatureIdLabel = `instanceFeatureId_${instanceFeatureIdLabel}`;
  }
  this._instanceFeatureIdLabel = instanceFeatureIdLabel;
}

Object.defineProperties(Cesium3DTileset.prototype, {
  /**
   * 注意：此 getter 的存在使得 `Picking.js` 能够区分
   * PrimitiveCollection 和 Cesium3DTileset 对象，而不会通过 `instanceof Cesium3DTileset` 扩大模块规模。
   * 该特性使用了 3D Tiles 规范中的部分内容，尚未定稿，且可能根据 Cesium 的标准弃用政策发生变化。
   * @private
   */
  isCesium3DTileset: {
    get: function () {
      return true;
    },
  },

  /**
   * 获取 tileset 的 asset 对象属性，其中包含关于 tileset 的元数据。
   * <p>
   * 请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification#reference-asset|asset schema reference}
   * 以查看 3D Tiles 规范中的完整属性集。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {object}
   * @readonly
   */
  asset: {
    get: function () {
      return this._asset;
    },
  },

  /**
   * 获取 tileset 的 extensions 对象属性。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {object}
   * @readonly
   */
  extensions: {
    get: function () {
      return this._extensions;
    },
  },

  /**
   * {@link ClippingPlaneCollection} 用于选择性地禁用 tileset 的渲染。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {ClippingPlaneCollection}
   */
  clippingPlanes: {
    get: function () {
      return this._clippingPlanes;
    },
    set: function (value) {
      ClippingPlaneCollection.setOwner(value, this, "_clippingPlanes");
    },
  },

  /**
   * {@link ClippingPolygonCollection} 用于选择性地禁用 tileset 的渲染。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {ClippingPolygonCollection}
   */
  clippingPolygons: {
    get: function () {
      return this._clippingPolygons;
    },
    set: function (value) {
      ClippingPolygonCollection.setOwner(value, this, "_clippingPolygons");
      updateTilesetClippingPolygonListeners(this);
      this._clippingPolygonsNeedRebake = true;
    },
  },

  /**
   * 提供 2D 地理参考的 <code>ImageryLayer</code> 对象集合，包含将渲染在 tileset 上的图像数据。
   * 图像将覆盖在 glTF、B3DM、PNTS 或 GeoJSON 瓦片内容上。
   *
   * 图像将通过 glTF、B3DM、PNTS 或 GeoJSON 瓦片内容覆盖显示。
   *
   * @see ImageryLayer
   *
   * @memberof Cesium3DTileset.prototype
   * @readonly
   * @type {ImageryLayerCollection}
   *
   * @experimental This 该特性尚未定稿，且可能根据 Cesium 的标准弃用政策发生变化。
   *
   * @example
   * // 将 Bing Maps 航空图像覆盖在 tileset 上
   * const imageryProvider = await Cesium.createWorldImageryAsync({
   * style: Cesium.IonWorldImageryStyle.AERIAL,
   * });
   * const imageryLayer = new ImageryLayer(imageryProvider);
   * tileset.imageryLayers.add(imageryLayer);
   */
  imageryLayers: {
    get: function () {
      return this._imageryLayers;
    },
  },

  /**
   * 图像层的修改计数器。
   *
   * 每次图像层的修改（layerAdded、layerMoved、
   * layerRemoved、layerShownOrHidden）都会增加此计数器，并且可以
   * 在<b>内部</b>使用（由 <code>ModelPrimitiveImagery</code> 使用）。
   * 在影像图层集合发生
   * 变化时触发更新。
   *
   * @memberof Cesium3DTileset.prototype
   * @readonly
   * @type {number}
   * @private
   */
  imageryLayersModificationCounter: {
    get: function () {
      return this._imageryLayersModificationCounter;
    },
  },

  /**
   * 是否应异步加载覆盖瓦片集的影像。
   * 进行加载。
   *
   * @memberof Cesium3DTileset.prototype
   * @readonly
   * @type {boolean}
   * @private
   */
  asynchronouslyLoadImagery: {
    get: function () {
      return this._asynchronouslyLoadImagery;
    },
  },

  /**
   * 获取包含每个特性属性元数据的瓦片集属性字典对象。
   * <p>
   * See the {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification#reference-properties|properties schema reference}
   * 在 3D Tiles 规范中可找到完整的属性集合。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {object}
   * @readonly
   *
   * @example
   * console.log(`最大建筑高度: ${tileset.properties.height.maximum}`);
   * console.log(`最小建筑高度: ${tileset.properties.height.minimum}`);
   *
   * @see Cesium3DTileFeature#getProperty
   * @see Cesium3DTileFeature#setProperty
   */
  properties: {
    get: function () {
      return this._properties;
    },
  },

  /**
   * 当 <code>true</code> 时，此帧中满足屏幕空间错误的所有瓦片都会被加载。该瓦片集
   * 对于此视图已完全加载。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @default false
   *
   * @see Cesium3DTileset#allTilesLoaded
   */
  tilesLoaded: {
    get: function () {
      return this._tilesLoaded;
    },
  },

  /**
   * 获取瓦片集 JSON 文件的资源
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {Resource}
   * @readonly
   */
  resource: {
    get: function () {
      return this._resource;
    },
  },

  /**
   * 瓦片集 JSON 文件中的非绝对路径所基于的基础路径。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {string}
   * @readonly
   * @deprecated
   */
  basePath: {
    get: function () {
      deprecationWarning(
        "Cesium3DTileset.basePath",
        "Cesium3DTileset.basePath has been deprecated. All tiles are relative to the url of the tileset JSON file that contains them. Use the url property instead.",
      );
      return this._basePath;
    },
  },

  /**
   * 使用
   * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language},
   * 定义的样式应用于瓦片集中的每个要素。
   * <p>
   * 将 <code>undefined</code> 赋值以移除该样式，这将恢复瓦片集的视觉
   * 外观为默认状态。当未应用样式时。
   * </p>
   * <p>
   * 在 {@link Cesium3DTileset#tileVisible} 事件触发之前，该样式被应用于瓦片，因此 <code>tileVisible</code> 中的代码可以手动设置要素的
   * 属性（例如颜色和显示）在样式应用后生效。当
   * 新样式被分配时，任何手动设置的属性都会被覆盖。
   * 使用始终为 “true” 的条件来指定所有未被
   * </p>
   * <p>
   * 现有条件覆盖的对象的颜色。否则将使用默认颜色 Cesium.Color.White。
   * 类似地，使用始终为 “true” 的条件来指定所有未被现有条件覆盖对象的显示属性。否则将使用
   * 默认显示值 true。
   * 。同样，使用始终为 “true” 的条件来指定所有未被现有条件覆盖对象的显示属性。否则将使用
   * 默认显示值 true。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {Cesium3DTileStyle|undefined}
   *
   * @default undefined
   *
   * @example
   * tileset.style = new Cesium.Cesium3DTileStyle({
   * color : {
   * conditions : [
   * ['${Height} >= 100', 'color("purple", 0.5)'],
   * ['${Height} >= 50', 'color("red")'],
   * ['true', 'color("blue")']
   *        ]
   *    },
   * show : '${Height} > 0',
   * meta : {
   * description : '"Building id ${id} has height ${Height}."'
   *    }
   * });
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language}
   */
  style: {
    get: function () {
      return this._styleEngine.style;
    },
    set: function (value) {
      this._styleEngine.style = value;
    },
  },

  /**
   * 应用于瓦片集中所有瓦片的自定义着色器。仅用于
   * 使用 {@link Model} 的内容。使用自定义着色器与
   * 使用 {@link Cesium3DTileStyle} 可能导致未定义行为。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {CustomShader|undefined}
   *
   * @default undefined
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能根据 Cesium 的标准弃用政策进行更改。
   */
  customShader: {
    get: function () {
      return this._customShader;
    },
    set: function (value) {
      this._customShader = value;
    },
  },

  /**
   * 该 tileset 是否在同一视图中渲染不同细节级别。
   * 仅当 {@link Cesium3DTileset.isSkippingLevelOfDetail} 为 true 时相关。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {boolean}
   * @private
   */
  hasMixedContent: {
    get: function () {
      return this._hasMixedContent;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("value", value);
      //>>includeEnd('debug');

      this._hasMixedContent = value;
    },
  },

  /**
   * 该 tileset 是否实际跳过细节级别。
   * 如果所有 tiles 都使用叠加细化，则用户选项可能被禁用，
   * 或者某些 tiles 的内容类型不支持跳过渲染。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {boolean}
   * @private
   * @readonly
   */
  isSkippingLevelOfDetail: {
    get: function () {
      return (
        this.skipLevelOfDetail &&
        !defined(this._classificationType) &&
        !this._disableSkipLevelOfDetail &&
        !this._allTilesAdditive
      );
    },
  },

  /**
   * tileset 的 feature layers：由其数据定义的命名特征集合。隐藏一个
   * 层以跳过其 tiles 的加载和渲染。当前从根
   * tileset JSON 的 3D Tiles 1.1 groups 创建，每组一个层。一个 tile 继承其父
   * tile 的层，包括跨外部 tilesets 的层。如果父层没有层，则
   * tile 使用其内容组的层。
   *
   * @memberof Cesium3DTileset.prototype
   * @type {FeatureLayerCollection}
   * @readonly
   *
   * @experimental This 该特性尚未定稿，且可能根据 Cesium 的标准弃用政策进行更改。
   */
  featureLayers: {
    get: function () {
      return this._featureLayers;
    },
  },

  /**
   * tileset 的 schema、groups、tileset metadata 和其他细节来自
   * 3DTILES_metadata extension 或 3D Tiles 1.1 tileset JSON。此 getter 用于
   * 其他类内部使用。
   *
   * @memberof Cesium3DTileset.prototype
   * @type {Cesium3DTilesetMetadata}
   * @private
   * @readonly
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能根据 Cesium 的标准弃用政策进行更改。
   */
  metadataExtension: {
    get: function () {
      return this._metadataExtension;
    },
  },

  /**
   * 附加到 tileset 整体的 metadata 属性。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {TilesetMetadata}
   * @private
   * @readonly
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能根据 Cesium 的标准弃用政策进行更改。
   */
  metadata: {
    get: function () {
      if (defined(this._metadataExtension)) {
        return this._metadataExtension.tileset;
      }

      return undefined;
    },
  },

  /**
   * 此 tileset 使用的 metadata schema。简写形式为
   * <code>tileset.metadataExtension.schema</code>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {MetadataSchema}
   * @private
   * @readonly
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能根据 Cesium 的标准弃用政策进行更改。
   */
  schema: {
    get: function () {
      if (defined(this._metadataExtension)) {
        return this._metadataExtension.schema;
      }

      return undefined;
    },
  },

  /**
   * 用于驱动细节级别细化的最大屏幕空间误差。该值有助于确定何时一个 tile
   * 细化到其后代，因此在平衡性能与视觉质量方面起着重要作用。
   * <p>
   * tile 的屏幕空间误差大致相当于如果以
   * 等于 tile 的 <b>几何误差</b> 半径的球体在 tile 位置渲染时将绘制的像素宽度。如果此值超过
   * <code>maximumScreenSpaceError</code> 表示瓦片对其子实体进行优化时的最大屏幕空间误差。
   * </p>
   * <p>
   * 根据瓦片集的不同，可能需要调整 <code>maximumScreenSpaceError</code> 以达到合适的平衡。
   * 较大的值能提升性能，但视觉质量会下降。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {number}
   * @default 16
   *
   * @exception {DeveloperError} <code>maximumScreenSpaceError</code> 必须大于或等于零。
   */
  maximumScreenSpaceError: {
    get: function () {
      return this._maximumScreenSpaceError;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThanOrEquals(
        "maximumScreenSpaceError",
        value,
        0,
      );
      //>>includeEnd('debug');

      this._maximumScreenSpaceError = value;
      this._memoryAdjustedScreenSpaceError = value;
      this._memoryAdjustedScreenSpaceErrorHeld = false;
    },
  },

  /**
   * 用于缓存瓦片的 GPU 内存量（以字节为单位）。此内存使用量是根据
   * 已加载瓦片的几何数据、纹理和批表纹理估算得出的。对于点云，该值还包含
   * 每个点的元数据。
   * <p>
   * 未在视野中的瓦片会被卸载以实现这一点。
   * </p>
   * <p>
   * 如果降低该值会导致瓦片被卸载，那么这些瓦片将在下一帧被卸载。
   * </p>
   * <p>
   * 如果为了满足当前视图下由 {@link Cesium3DTileset#maximumScreenSpaceError} 确定的
   * desired screen space error, determined by {@link Cesium3DTileset#maximumScreenSpaceError},
   * 则加载的瓦片内存使用量将超过
   * <code>cacheBytes</code>，最多达到 <code>maximumCacheOverflowBytes</code>。
   * 例如，如果 <code>cacheBytes</code> 为 500000，但为了满足屏幕空间误差需要 600000 字节的瓦片，
   * 那么可能会加载 600000 字节的瓦片（如果 <code>maximumCacheOverflowBytes</code> 至少为 100000）。
   * 当这些瓦片超出视野时，它们会被卸载。
   * 必须类型为数字且大于或等于 0。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {number}
   * @default 536870912
   *
   * @exception {DeveloperError} <code>cacheBytes</code> 用于缓存瓦片的最大额外 GPU 内存量（以字节为单位）。
   * @see Cesium3DTileset#totalMemoryUsageInBytes
   */
  cacheBytes: {
    get: function () {
      return this._cacheBytes;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThanOrEquals("value", value, 0);
      //>>includeEnd('debug');

      this._cacheBytes = value;
      this._memoryAdjustedScreenSpaceErrorHeld = false;
    },
  },

  /**
   * 为了缓存瓦片将使用的额外最大 GPU 内存量（以字节为单位）。
   * <p>
   * 如果为了满足期望的屏幕空间误差而需要的瓦片大小超过 <code>cacheBytes</code> 加上 <code>maximumCacheOverflowBytes</code>，
   * 由当前视图下的
   * {@link Cesium3DTileset#maximumScreenSpaceError} 确定的，
   * 则 {@link Cesium3DTileset#memoryAdjustedScreenSpaceError} 将被调整。
   * 直到满足调整后的屏幕空间误差所需的瓦片使用量少于
   * <code>cacheBytes</code> 加上 <code>maximumCacheOverflowBytes</code>。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {number}
   * @default 536870912
   *
   * @exception {DeveloperError} <code>maximumCacheOverflowBytes</code> 必须类型为数字且大于或等于 0。
   * @see Cesium3DTileset#totalMemoryUsageInBytes
   */
  maximumCacheOverflowBytes: {
    get: function () {
      return this._maximumCacheOverflowBytes;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThanOrEquals("value", value, 0);
      //>>includeEnd('debug');

      this._maximumCacheOverflowBytes = value;
      this._memoryAdjustedScreenSpaceErrorHeld = false;
    },
  },

  /**
   * 如果加载由 @{link Cesium3DTileset#maximumScreenSpaceError} 确定的细节级别导致
   * 内存使用量超过 @{link Cesium3DTileset#cacheBytes}
   * 加上 @{link Cesium3DTileset#maximumCacheOverflowBytes}，则细节级别的优化
   * 将改用这个更大的调整后的屏幕空间误差来实现
   * 在可用内存范围内最佳的视觉质量。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  memoryAdjustedScreenSpaceError: {
    get: function () {
      return this._memoryAdjustedScreenSpaceError;
    },
  },

  /**
   * 用于根据几何误差和眼罩照明控制点大小的选项。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {PointCloudShading}
   */
  pointCloudShading: {
    get: function () {
      return this._pointCloudShading;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.defined("pointCloudShading", value);
      //>>includeEnd('debug');
      this._pointCloudShading = value;
    },
  },

  /**
   * 根瓦片。
   *
   * @memberOf Cesium3DTileset.prototype
   *
   * @type {Cesium3DTile}
   * @readonly
   */
  root: {
    get: function () {
      return this._root;
    },
  },

  /**
   * 瓦片集的边界球体。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {BoundingSphere}
   * @readonly
   *
   * @example
   * const tileset = await Cesium.Cesium3DTileset.fromUrl("http://localhost:8002/tilesets/Seattle/tileset.json");
   *
   * viewer.scene.primitives.add(tileset);
   *
   * // 将相机设置为可查看新添加的瓦片集
   * viewer.camera.viewBoundingSphere(tileset.boundingSphere, new Cesium.HeadingPitchRange(0, -0.5, 0));
   */
  boundingSphere: {
    get: function () {
      this._root.updateTransform(this._modelMatrix);
      return this._root.boundingSphere;
    },
  },

  /**
   * 用于转换整个瓦片集的 4x4 变换矩阵。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {Matrix4}
   * @default Matrix4.IDENTITY
   *
   * @example
   * // 调整瓦片集的高度，使其从地球表面开始。
   * const heightOffset = 20.0;
   * const boundingSphere = tileset.boundingSphere;
   * const cartographic = Cesium.Cartographic.fromCartesian(boundingSphere.center);
   * const surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
   * const offset = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, heightOffset);
   * const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
   * tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
   */
  modelMatrix: {
    get: function () {
      return this._modelMatrix;
    },
    set: function (value) {
      this._modelMatrix = Matrix4.clone(value, this._modelMatrix);
    },
  },

  /**
   * 返回自瓦片集加载并首次更新以来的时间，以毫秒为单位。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {number}
   * @readonly
   */
  timeSinceLoad: {
    get: function () {
      return this._timeSinceLoad;
    },
  },

  /**
   * 瓦片集使用的 GPU 内存总字节数。该值是根据
   * 几何数据、纹理、批次表纹理和加载瓦片的二进制元数据估算得出的。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {number}
   * @readonly
   *
   * @see Cesium3DTileset#cacheBytes
   */
  totalMemoryUsageInBytes: {
    get: function () {
      const statistics = this._statistics;
      return (
        statistics.texturesByteLength +
        statistics.geometryByteLength +
        statistics.batchTableByteLength
      );
    },
  },

  /**
   * @private
   */
  clippingPlanesOriginMatrix: {
    get: function () {
      if (!defined(this._clippingPlanesOriginMatrix)) {
        return Matrix4.IDENTITY;
      }

      if (this._clippingPlanesOriginMatrixDirty) {
        Matrix4.multiply(
          this.root.computedTransform,
          this._initialClippingPlanesOriginMatrix,
          this._clippingPlanesOriginMatrix,
        );
        this._clippingPlanesOriginMatrixDirty = false;
      }

      return this._clippingPlanesOriginMatrix;
    },
  },

  /**
   * @private
   */
  styleEngine: {
    get: function () {
      return this._styleEngine;
    },
  },

  /**
   * @private
   */
  statistics: {
    get: function () {
      return this._statistics;
    },
  },

  /**
   * 确定地形、3D Tiles 或两者是否将由该瓦片集进行分类。
   * <p>
   * 此选项仅适用于包含批量 3D 模型的瓦片集，
   * glTF 内容、几何数据或向量数据。即使未定义，向量
   * 和几何数据必须作为分类项渲染，并将默认设置为
   * 在地形和其他 3D Tiles 瓦片集中进行渲染。
   * </p>
   * <p>
   * 当针对批量 3D 模型和 glTF 瓦片集启用时，对 glTF 有一些
   * 要求/限制：
   * <ul>
   * <li>glTF 不能包含变形目标、皮肤或动画。</li>
   * <li>glTF 不能包含 <code>EXT_mesh_gpu_instancing</code> 扩展。</li>
   * <li>只能使用带有 TRIANGLES 的网格来分类其他资源。</li>
   * <li>网格必须具有水密性。</li>
   * <li>需要 <code>POSITION</code> 语义。</li>
   * <li>如果同时存在 <code>_BATCHID</code> 和索引缓冲区，所有具有相同批次 id 的索引必须占据索引缓冲区的连续部分。</li>
   * <li>如果 _BATCHID 存在但没有索引缓冲区，则具有相同 batch id 的所有位置必须占据位置缓冲区的连续区域。</li>
   * </ul>
   * </p>
   * <p>
   * 此外，点或实例化的 3D 模型不支持分类功能。
   * 接收分类的 3D Tiles 或地形必须是不透明的。
   * </p>
   * <p>
   * 用于分类的 3D Tiles 规范中的部分内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {ClassificationType}
   * @default undefined
   *
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿的部分内容，可能会根据 Cesium 的标准弃用政策进行更改。
   * @readonly
   */
  classificationType: {
    get: function () {
      return this._classificationType;
    },
  },

  /**
   * 指定高度是相对于地形、3D Tiles 还是两者都而言。
   * <p>
   * 此选项仅适用于包含矢量数据的 tileset 中的点特征。
   * 此选项要求通过 options.scene 传递 Viewer 的场景。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {HeightReference | undefined}
   * @default undefined
   *
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿的部分内容，可能会根据 Cesium 的标准弃用政策进行更改。
   * @readonly
   */
  heightReference: {
    get: function () {
      return this._heightReference;
    },
  },

  /**
   * 用于渲染 tileset 的 {@link CesiumWidget#scene}，对于指定 {@link heightReference} 值以将 3D Tiles 矢量数据内容（如点、线、标签）限制在地形或 3D Tiles 上的 tileset 是必需的。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {Scene | undefined}
   * @default undefined
   * @readonly
   *
   */
  scene: {
    get: function () {
      return this._scene;
    },
  },

  /**
   * 获取描述地球形状的椭球体数据。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {Ellipsoid}
   * @readonly
   */
  ellipsoid: {
    get: function () {
      return this._ellipsoid;
    },
  },

  /**
   * 优化选项。当 {@link Cesium3DTileset#foveatedScreenSpaceError} 为 true 时使用，用于控制决定哪些 tiles 被延迟处理的圆锥大小。
   * 位于该圆锥内的 tiles 会立即加载。位于圆锥外的 tiles 可能会根据其距离圆锥的距离以及 {@link Cesium3DTileset#foveatedInterpolationCallback} 和 {@link Cesium3DTileset#foveatedMinimumScreenSpaceErrorRelaxation} 被延迟处理。
   * 将此值设为 0.0 意味着圆锥将由相机位置和视角方向形成的线构成。将此值设为 1.0 意味着圆锥包含相机的整个视野范围，实际上会禁用该效果。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {number}
   * @default 0.3
   */
  foveatedConeSize: {
    get: function () {
      return this._foveatedConeSize;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThanOrEquals("foveatedConeSize", value, 0.0);
      Check.typeOf.number.lessThanOrEquals("foveatedConeSize", value, 1.0);
      //>>includeEnd('debug');

      this._foveatedConeSize = value;
    },
  },

  /**
   * 优化选项。当 {@link Cesium3DTileset#foveatedScreenSpaceError} 为 true 时使用，用于控制位于圆锥外的 tiles 的起始屏幕空间误差放松程度。
   * 从该值开始，屏幕空间误差将随着提供的 {@link Cesium3DTileset#foveatedInterpolationCallback} 而升高，直至 {@link Cesium3DTileset#maximumScreenSpaceError}。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {number}
   * @default 0.0
   */
  foveatedMinimumScreenSpaceErrorRelaxation: {
    get: function () {
      return this._foveatedMinimumScreenSpaceErrorRelaxation;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThanOrEquals(
        "foveatedMinimumScreenSpaceErrorRelaxation",
        value,
        0.0,
      );
      Check.typeOf.number.lessThanOrEquals(
        "foveatedMinimumScreenSpaceErrorRelaxation",
        value,
        this.maximumScreenSpaceError,
      );
      //>>includeEnd('debug');

      this._foveatedMinimumScreenSpaceErrorRelaxation = value;
    },
  },

  /**
   * 返回 tileset JSON 顶层的 <code>extras</code> 属性，其中包含特定于应用的元数据。
   * 如果 <code>extras</code> 不存在，则返回 <code>undefined</code>。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {*}
   * @readonly
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification#specifying-extensions-and-application-specific-extras|Extras in the 3D Tiles specification.}
   */
  extras: {
    get: function () {
      return this._extras;
    },
  },

  /**
   * 用于管理此瓦片集上的影像照明属性的属性。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {ImageBasedLighting}
   */
  imageBasedLighting: {
    get: function () {
      return this._imageBasedLighting;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("imageBasedLighting", this._imageBasedLighting);
      //>>includeEnd('debug');
      if (value !== this._imageBasedLighting) {
        if (
          this._shouldDestroyImageBasedLighting &&
          !this._imageBasedLighting.isDestroyed()
        ) {
          this._imageBasedLighting.destroy();
        }
        this._imageBasedLighting = value;
        this._shouldDestroyImageBasedLighting = false;
      }
    },
  },

  /**
   * 用于管理此模型上的动态环境地图的属性。会影响照明效果。
   *
   * @memberof Cesium3DTileset.prototype
   * @readonly
   *
   * @example
   * // 将瓦片集的环境地图使用的地面颜色改为森林绿
   * const environmentMapManager = tileset.environmentMapManager;
   * environmentMapManager.groundColor = Cesium.Color.fromCssColorString("#203b34");
   *
   * @type {DynamicEnvironmentMapManager}
   */
  environmentMapManager: {
    get: function () {
      return this._environmentMapManager;
    },
  },

  /**
   * 表示仅使用瓦片集的矢量瓦片进行分类。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能随 Cesium 标准弃用政策而变更。
   *
   * @type {boolean}
   * @default false
   */
  vectorClassificationOnly: {
    get: function () {
      return this._vectorClassificationOnly;
    },
  },

  /**
   * 是否应保留矢量瓦片的解码位置在内存中。
   * 此参数与 {@link Cesium3DTileFeature.getPolylinePositions} 一起使用。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能随 Cesium 标准弃用政策而变更。
   *
   * @type {boolean}
   * @default false
   */
  vectorKeepDecodedPositions: {
    get: function () {
      return this._vectorKeepDecodedPositions;
    },
  },

  /**
   * 确定瓦片集中的矢量基本元素如何与场景融合。
   * 必须设置为 {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}；
   * {@link BlendOption.OPAQUE_AND_TRANSLUCENT} 不受支持。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @experimental This 该特性尚未定稿，且可能随 Cesium 标准弃用政策而变更。
   *
   * @type {BlendOption}
   * @default BlendOption.TRANSLUCENT
   */
  vectorBlendOption: {
    get: function () {
      return this._vectorBlendOption;
    },
    set: function (value) {
      this._vectorBlendOption = value;
    },
  },

  /**
   * GeoJSON 内容是否作为矢量基本元素而非模型加载。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @experimental This 该特性尚未定稿，且可能随 Cesium 标准弃用政策而变更。
   *
   * @type {boolean}
   * @default false
   * @readonly
   */
  vectorGeoJson: {
    get: function () {
      return this._vectorGeoJson;
    },
  },

  /**
   * 确定瓦片集的版权信息是否会在屏幕上显示。
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {boolean}
   * @default false
   */
  showCreditsOnScreen: {
    get: function () {
      return this._showCreditsOnScreen;
    },
    set: function (value) {
      this._showCreditsOnScreen = value;
      createCredits(this);
    },
  },

  /**
   * 用于选择和样式化的特征 ID 标签。
   * <p>
   * 对于 EXT_mesh_features，这是特征 ID 的标签属性，或者
   * 当未指定时，为“featureId_N” (其中 N 是 featureIds 数组中的索引)。EXT_feature_metadata 没有标签字段，因此此类
   * specified. EXT_feature_metadata did not have a label field, so such
   * 特征 ID 标签始终标记为“featureId_N”，其中 N 是
   * 所有特征 ID 列表中的索引，特征 ID 属性列在
   * 特征 ID 纹理之前。
   * </p>
   * <p>
   * 如果 featureIdLabel 设置为整数 N，它会自动转换为
   * 字符串“featureId_N”。如果存在每个基本元素和
   * 每个实例的特征 ID，则实例特征 ID 具有优先级。
   * 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能随 Cesium 标准弃用政策而变更。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {string|number}
   * @experimental This feature is using part of the 3D Tiles spec that is not final and is subject to change without Cesium's standard deprecation policy.
   */
  featureIdLabel: {
    get: function () {
      return this._featureIdLabel;
    },
    set: function (value) {
      // indices get converted into featureId_N
      if (typeof value === "number") {
        value = `featureId_${value}`;
      }

      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.string("value", value);
      //>>includeEnd('debug');

      this._featureIdLabel = value;
    },
  },

  /**
   * 用于选择和样式化的实例特征ID集标签。
   * <p>
   * 如果 instanceFeatureIdLabel 被设置为整数 N，则自动转换为
   * 字符串 "instanceFeatureId_N"。
   * 如果存在 per-primitive 和 per-instance 特征ID，则
   * 实例特征ID具有优先权。
   * </p>
   *
   * @memberof Cesium3DTileset.prototype
   *
   * @type {string|number}
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   */
  instanceFeatureIdLabel: {
    get: function () {
      return this._instanceFeatureIdLabel;
    },
    set: function (value) {
      // indices get converted into instanceFeatureId_N
      if (typeof value === "number") {
        value = `instanceFeatureId_${value}`;
      }

      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.string("value", value);
      //>>includeEnd('debug');

      this._instanceFeatureIdLabel = value;
    },
  },
});

/**
 * 创建 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification|3D Tiles tileset}，
 * 用于从 Cesium ion 资产 ID 流式传输庞大的异构 3D 地理空间数据集。
 *
 * @param {number} assetId Cesium ion 资产 ID。
 * @param {Cesium3DTileset.ConstructorOptions} [options] 描述初始化选项的对象。
 * @returns {Promise<Cesium3DTileset>}
 *
 * @exception {RuntimeError} When tileset 资产版本不是 0.0、1.0 或 1.1，
 * 或者 tileset 包含不支持的必需扩展时。
 *
 * @see Cesium3DTileset#fromUrl
 *
 * @example
 * // 使用 Cesium ion 资产 ID 为 124624234 加载 Cesium3DTileset
 * try {
 * const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(124624234);
 * scene.primitives.add(tileset);
 * } catch (error) {
 * console.error(`创建 tileset 时出错: ${error}`);
 * }
 */
Cesium3DTileset.fromIonAssetId = async function (assetId, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("assetId", assetId);
  //>>includeEnd('debug');

  const resource = await IonResource.fromAssetId(assetId);
  return Cesium3DTileset.fromUrl(resource, options);
};

/**
 * 创建 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification|3D Tiles tileset}，
 * 用于流式传输庞大的异构 3D 地理空间数据集。
 *
 * @param {Resource|string} url tileset JSON 文件的 URL。
 * @param {Cesium3DTileset.ConstructorOptions} [options] 描述初始化选项的对象。
 * @returns {Promise<Cesium3DTileset>}
 *
 * @exception {RuntimeError} When tileset 资产版本不是 0.0、1.0 或 1.1，
 * 或者 tileset 包含不支持的必需扩展时。
 *
 * @see Cesium3DTileset#fromIonAssetId
 *
 * @example
 * try {
 * const tileset = await Cesium.Cesium3DTileset.fromUrl(
 * "http://localhost:8002/tilesets/Seattle/tileset.json"
 *   );
 * scene.primitives.add(tileset);
 * } catch (error) {
 * console.error(`创建 tileset 时出错: ${error}`);
 * }
 *
 * @example
 * // SkipLevelOfDetail 优化的常见设置
 * const tileset = await Cesium.Cesium3DTileset.fromUrl(
 * "http://localhost:8002/tilesets/Seattle/tileset.json", {
 * skipLevelOfDetail: true,
 * baseScreenSpaceError: 1024,
 * skipScreenSpaceErrorFactor: 16,
 * skipLevels: 1,
 * immediatelyLoadDesiredLevelOfDetail: false,
 * loadSiblings: false,
 * cullWithChildrenBounds: true
 * });
 * scene.primitives.add(tileset);
 *
 * @example
 * // DynamicScreenSpaceError 优化的常见设置
 * const tileset = await Cesium.Cesium3DTileset.fromUrl(
 * "http://localhost:8002/tilesets/Seattle/tileset.json", {
 * dynamicScreenSpaceError: true,
 * dynamicScreenSpaceErrorDensity: 2.0e-4,
 * dynamicScreenSpaceErrorFactor: 24.0,
 * dynamicScreenSpaceErrorHeightFalloff: 0.25
 * });
 * scene.primitives.add(tileset);
 */
Cesium3DTileset.fromUrl = async function (url, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;

  const resource = Resource.createIfNeeded(url);
  let basePath;
  if (resource.extension === "json") {
    basePath = resource.getBaseUri(true);
  } else if (resource.isDataUri) {
    basePath = "";
  }

  const tilesetJson = await Cesium3DTileset.loadJson(resource);
  const metadataExtension = await processMetadataExtension(
    resource,
    tilesetJson,
  );

  const tileset = new Cesium3DTileset(options);
  tileset._resource = resource;
  tileset._url = resource.url;
  tileset._basePath = basePath;
  tileset._metadataExtension = metadataExtension;
  // Layers must exist before tiles are created so tiles can resolve them.
  tileset._featureLayers._addGroups(metadataExtension);
  // TODO(#13900): add layers for each external tileset JSON's own groups.
  // Set these before loading the tileset since _geometricError
  // and _scaledGeometricError get accessed during tile creation
  tileset._geometricError = tilesetJson.geometricError;
  tileset._scaledGeometricError = tilesetJson.geometricError;

  const asset = tilesetJson.asset;
  tileset._asset = asset;
  tileset._extras = tilesetJson.extras;

  createCredits(tileset);

  // Handle legacy gltfUpAxis option
  const gltfUpAxis = defined(tilesetJson.asset.gltfUpAxis)
    ? Axis.fromName(tilesetJson.asset.gltfUpAxis)
    : Axis.Y;
  const modelUpAxis = options.modelUpAxis ?? gltfUpAxis;
  const modelForwardAxis = options.modelForwardAxis ?? Axis.X;

  tileset._properties = tilesetJson.properties;
  tileset._extensionsUsed = tilesetJson.extensionsUsed;
  tileset._extensions = tilesetJson.extensions;
  tileset._modelUpAxis = modelUpAxis;
  tileset._modelForwardAxis = modelForwardAxis;

  tileset._root = tileset.loadTileset(resource, tilesetJson);

  // Save the original, untransformed bounding volume position so we can apply
  // the tile transform and model matrix at run time
  const boundingVolume = tileset._root.createBoundingVolume(
    tilesetJson.root.boundingVolume,
    Matrix4.IDENTITY,
  );
  const clippingPlanesOrigin = boundingVolume.boundingSphere.center;
  // If this origin is above the surface of the earth
  // we want to apply an ENU orientation as our best guess of orientation.
  // Otherwise, we assume it gets its position/orientation completely from the
  // root tile transform and the tileset's model matrix
  const originCartographic =
    tileset._ellipsoid.cartesianToCartographic(clippingPlanesOrigin);
  if (
    defined(originCartographic) &&
    originCartographic.height >
      ApproximateTerrainHeights._defaultMinTerrainHeight
  ) {
    tileset._initialClippingPlanesOriginMatrix =
      FixedFrameTransforms.eastNorthUpToFixedFrame(clippingPlanesOrigin);
  }
  tileset._clippingPlanesOriginMatrix = Matrix4.clone(
    tileset._initialClippingPlanesOriginMatrix,
  );

  return tileset;
};

/**
 * 创建一个 {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification|3D Tiles tileset}，
 * 用于流式传输庞大的异构 3D 地理空间数据集。
 *
 * @param {Resource|string} url tileset JSON 文件的 URL。
 * @param {Cesium3DTileset.ConstructorOptions} [options] 描述初始化选项的对象。
 * @returns {Promise<Cesium3DTileset>}
 *
 * @exception {RuntimeError} When tileset 资源版本不是 0.0、1.0 或 1.1，
 * 或者 tileset 包含不支持的必需扩展。
 *
 * @see Cesium3DTileset#fromIonAssetId
 *
 */
Cesium3DTileset.fromGltf = async function (url, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;

  const resource = Resource.createIfNeeded(url);
  let basePath;
  if (resource.extension === "json") {
    basePath = resource.getBaseUri(true);
  } else if (resource.isDataUri) {
    basePath = "";
  }

  const gltfJson = await Cesium3DTileset.loadJson(resource);

  if (!hasExtension(gltfJson, "3DTILES_tileset")) {
    throw new DeveloperError("3DTILES_tileset extension is required.");
  }

  const tileset = new Cesium3DTileset(options);

  tileset._resource = resource;
  tileset._url = resource.url;
  tileset._basePath = basePath;
  // Set these before loading the tileset since _geometricError
  // and _scaledGeometricError get accessed during tile creation
  const tilesetExtension = gltfJson.extensions["3DTILES_tileset"];
  tileset._geometricError = tilesetExtension.geometricError;
  tileset._scaledGeometricError = tilesetExtension.geometricError;
  tileset._asset = gltfJson.asset;
  tileset._extras = gltfJson.extras;

  const gltfUpAxis = hasExtension(gltfJson, "EXT_geospatial_crs")
    ? Axis.Z
    : Axis.Y;
  const modelUpAxis = options.modelUpAxis ?? gltfUpAxis;
  const modelForwardAxis = options.modelForwardAxis ?? Axis.X;

  tileset._properties = gltfJson.properties;
  tileset._extensionsUsed = gltfJson.extensionsUsed;
  tileset._extensions = gltfJson.extensions;
  tileset._tilesetUpAxis = modelUpAxis;
  // The root tile transform converts the tileset to z-up, so contents are already z-up
  tileset._modelUpAxis = Axis.Z;
  tileset._modelForwardAxis = modelForwardAxis;

  tileset._root = tileset.loadTilesetFromGltf(resource, gltfJson);

  // Save the original, untransformed bounding volume position so we can apply
  // the tile transform and model matrix at run time
  const rootNodeIndex = gltfJson.scenes[0].nodes[0];
  const boundingVolumeJson = gltfJson.nodes[rootNodeIndex].boundingVolume;
  const boundingVolume = tileset._root.createBoundingVolume(
    constructBoundingVolumeJson(boundingVolumeJson, gltfJson.shapes),
    Matrix4.IDENTITY,
  );
  const clippingPlanesOrigin = boundingVolume.boundingSphere.center;
  // If this origin is above the surface of the earth
  // we want to apply an ENU orientation as our best guess of orientation.
  // Otherwise, we assume it gets its position/orientation completely from the
  // root tile transform and the tileset's model matrix
  const originCartographic =
    tileset._ellipsoid.cartesianToCartographic(clippingPlanesOrigin);
  if (
    defined(originCartographic) &&
    originCartographic.height >
      ApproximateTerrainHeights._defaultMinTerrainHeight
  ) {
    tileset._initialClippingPlanesOriginMatrix =
      FixedFrameTransforms.eastNorthUpToFixedFrame(clippingPlanesOrigin);
  }
  // The root tile transform includes the up axis correction, but the
  // clipping planes origin matrix must describe a z-up frame
  const upAxisCorrection = ModelUtility.getAxisCorrectionMatrix(
    tileset._tilesetUpAxis,
    Axis.X,
    new Matrix4(),
  );
  tileset._initialClippingPlanesOriginMatrix = Matrix4.multiplyTransformation(
    Matrix4.inverseTransformation(upAxisCorrection, new Matrix4()),
    tileset._initialClippingPlanesOriginMatrix,
    new Matrix4(),
  );
  tileset._clippingPlanesOriginMatrix = Matrix4.clone(
    tileset._initialClippingPlanesOriginMatrix,
  );

  return tileset;
};

/**
 * 提供钩子以覆盖请求 tileset JSON 的方法。
 * 在从远程服务器获取 tileset 时非常有用。
 * @param {Resource|string} tilesetUrl 要获取的 JSON 文件的 URL。
 * @returns {Promise<object>} A 承诺在获取 JSON 数据后解决。
 */
Cesium3DTileset.loadJson = function (tilesetUrl) {
  const resource = Resource.createIfNeeded(tilesetUrl);
  return resource.fetchJson();
};

/**
 * 将 tileset 的 {@link Cesium3DTileset#style} 标记为脏，这强制所有
 * 功能在下一个帧中重新评估其可见性的样式。
 */
Cesium3DTileset.prototype.makeStyleDirty = function () {
  this._styleEngine.makeDirty();
};

/**
 * 加载主 tileset JSON 文件或来自瓦片的 tileset JSON 文件。
 *
 * @exception {RuntimeError} When tileset 资源版本不是 0.0、1.0 或 1.1，
 * 或者 tileset 包含不支持的必需扩展。
 *
 * @private
 */
Cesium3DTileset.prototype.loadTileset = function (
  resource,
  tilesetJson,
  parentTile,
) {
  const asset = tilesetJson.asset;
  if (!defined(asset)) {
    throw new RuntimeError("Tileset must have an asset property.");
  }
  if (
    asset.version !== "0.0" &&
    asset.version !== "1.0" &&
    asset.version !== "1.1"
  ) {
    throw new RuntimeError(
      "The tileset must be 3D Tiles version 0.0, 1.0, or 1.1",
    );
  }

  if (defined(tilesetJson.extensionsRequired)) {
    Cesium3DTileset.checkSupportedExtensions(tilesetJson.extensionsRequired);
  }

  const statistics = this._statistics;

  const tilesetVersion = asset.tilesetVersion;
  if (defined(tilesetVersion)) {
    // Append the tileset version to the resource
    this._basePath += `?v=${tilesetVersion}`;
    resource = resource.clone();
    resource.setQueryParameters({ v: tilesetVersion });
  }

  // A tileset JSON file referenced from a tile may exist in a different directory than the root tileset.
  // Get the basePath relative to the external tileset.
  const rootTile = makeTile(this, resource, tilesetJson.root, parentTile);

  // If there is a parentTile, add the root of the currently loading tileset
  // to parentTile's children, and update its _depth.
  if (defined(parentTile)) {
    parentTile.children.push(rootTile);
    rootTile._depth = parentTile._depth + 1;
  }

  const stack = [];
  stack.push(rootTile);

  while (stack.length > 0) {
    const tile = stack.pop();
    ++statistics.numberOfTilesTotal;
    this._allTilesAdditive =
      this._allTilesAdditive && tile.refine === Cesium3DTileRefine.ADD;
    const children = tile._header.children;
    if (defined(children)) {
      for (let i = 0; i < children.length; ++i) {
        const childHeader = children[i];
        const childTile = makeTile(this, resource, childHeader, tile);
        tile.children.push(childTile);
        childTile._depth = tile._depth + 1;
        stack.push(childTile);
      }
    }

    if (this._cullWithChildrenBounds) {
      Cesium3DTileOptimizations.checkChildrenWithinParent(tile);
    }
  }

  return rootTile;
};

/**
 * 加载主 root.tileset.gltf JSON 文件。
 *
 * @exception {RuntimeError} When glTF 资源版本不是 2.1，
 * 或者 tileset 包含不支持的必需扩展。
 *
 * @private
 */
Cesium3DTileset.prototype.loadTilesetFromGltf = function (
  resource,
  gltfJson,
  parentTile,
) {
  const asset = gltfJson.asset;
  if (!defined(asset)) {
    throw new RuntimeError("Tileset must have an asset property.");
  }
  if (asset.version !== "2.1") {
    throw new RuntimeError("The glTF asset must be version 2.1");
  }
  if (defined(gltfJson.extensionsRequired)) {
    Cesium3DTileset.checkSupportedGltfExtensions(gltfJson.extensionsRequired);
  }

  const statistics = this._statistics;

  const rootNodeIndex = gltfJson.scenes[0].nodes[0];
  const rootTile = makeTileFromGltfNode(
    this,
    resource,
    gltfJson,
    rootNodeIndex,
    parentTile,
  );

  // If there is a parentTile, add the root of the currently loading tileset
  // to parentTile's children, and update its _depth.
  if (defined(parentTile)) {
    parentTile.children.push(rootTile);
    rootTile._depth = parentTile._depth + 1;
  }

  const stack = [];
  stack.push(rootTile);

  while (stack.length > 0) {
    const tile = stack.pop();
    ++statistics.numberOfTilesTotal;
    this._allTilesAdditive =
      this._allTilesAdditive && tile.refine === Cesium3DTileRefine.ADD;
    const children = tile._header.children;
    if (defined(children)) {
      for (let i = 0; i < children.length; ++i) {
        const childIndex = children[i];
        const childTile = makeTileFromGltfNode(
          this,
          resource,
          gltfJson,
          childIndex,
          tile,
        );
        tile.children.push(childTile);
        childTile._depth = tile._depth + 1;
        stack.push(childTile);
      }
    }

    if (this._cullWithChildrenBounds) {
      Cesium3DTileOptimizations.checkChildrenWithinParent(tile);
    }
  }

  return rootTile;
};

/**
 * 为特定瓦片创建 {@link Cesium3DTile}。如果瓦片的头部具有隐式
 * 平铺（3D Tiles 1.1）或使用 <code>3DTILES_implicit_tiling</code> 扩展，
 * 则创建占位瓦片以延迟评估隐式 tileset。
 *
 * @param {Cesium3DTileset} tileset tileset
 * @param {Resource} baseResource tileset 的基础资源。
 * @param {object} tileHeader 瓦片的 JSON 头部。
 * @param {Cesium3DTile} [parentTile] 新瓦片的父瓦片。
 * @returns {Cesium3DTile} The 新创建的瓦片。
 *
 * @private
 */
function makeTile(tileset, baseResource, tileHeader, parentTile) {
  const hasImplicitTiling =
    defined(tileHeader.implicitTiling) ||
    hasExtension(tileHeader, "3DTILES_implicit_tiling");

  if (!hasImplicitTiling) {
    return new Cesium3DTile(tileset, baseResource, tileHeader, parentTile);
  }

  const metadataSchema = tileset.schema;

  const implicitTileset = new ImplicitTileset(
    baseResource,
    tileHeader,
    metadataSchema,
  );
  const rootCoordinates = new ImplicitTileCoordinates({
    subdivisionScheme: implicitTileset.subdivisionScheme,
    subtreeLevels: implicitTileset.subtreeLevels,
    level: 0,
    x: 0,
    y: 0,
    // The constructor will only use this for octrees.
    z: 0,
  });

  // Create a placeholder Cesium3DTile that has an ImplicitTileset
  // object and whose content will resolve to an Implicit3DTileContent
  const contentUri = implicitTileset.subtreeUriTemplate.getDerivedResource({
    templateValues: rootCoordinates.getTemplateValues(),
  }).url;

  const deepCopy = true;
  const tileJson = clone(tileHeader, deepCopy);
  // Replace contents with the subtree
  tileJson.contents = [
    {
      uri: contentUri,
    },
  ];

  delete tileJson.content;

  // The placeholder tile does not have any extensions. If there are any
  // extensions beyond 3DTILES_implicit_tiling, Implicit3DTileContent will
  // copy them to the transcoded tiles.
  delete tileJson.extensions;

  const tile = new Cesium3DTile(tileset, baseResource, tileJson, parentTile);
  tile.implicitTileset = implicitTileset;
  tile.implicitCoordinates = rootCoordinates;
  return tile;
}

/**
 * 为特定瓦片创建 {@link Cesium3DTile}。如果瓦片的头部具有隐式
 * 平铺（3D Tiles 1.1）或使用 <code>3DTILES_implicit_tiling</code> 扩展，
 * 则创建占位瓦片以延迟评估隐式 tileset。
 *
 * @param {Cesium3DTileset} tileset tileset
 * @param {Resource} baseResource tileset 的基础资源。
 * @param {object} gltfJson tileset 的 JSON 数据。
 * @param {number} nodeIndex glTF 文件中节点的索引。
 * @param {Cesium3DTile} [parentTile] 新瓦片的父瓦片。
 * @returns {Cesium3DTile} The 新创建的瓦片。
 *
 * @private
 */
function makeTileFromGltfNode(
  tileset,
  baseResource,
  gltfJson,
  nodeIndex,
  parentTile,
) {
  const nodeJson = gltfJson.nodes[nodeIndex];
  const tilesetExtension = nodeJson.extensions?.["3DTILES_tileset"];
  //>>includeStart('debug', pragmas.debug);
  Check.defined("3DTILES_tileset extension", tilesetExtension);
  //>>includeEnd('debug');
  const boundingVolume = constructBoundingVolumeJson(
    nodeJson.boundingVolume,
    gltfJson.shapes,
  );
  let contentBoundingVolume;
  if (tilesetExtension.content?.boundingVolume) {
    contentBoundingVolume = constructBoundingVolumeJson(
      tilesetExtension.content.boundingVolume,
      gltfJson.shapes,
    );
  }

  const tileHeader = {
    transform: defined(parentTile)
      ? getNodeTransform(nodeJson)
      : getRootTransform(tileset._tilesetUpAxis, nodeJson),
    geometricError: tilesetExtension.geometricError,
    refine: tilesetExtension.refine,
    boundingVolume: boundingVolume,
    children: nodeJson.children,
  };

  const hasImplicitTiling = hasExtension(nodeJson, "3DTILES_implicit_tiling");
  if (!hasImplicitTiling && !defined(nodeJson.externalAsset)) {
    return new Cesium3DTile(tileset, baseResource, tileHeader, parentTile);
  }

  tileHeader.content = {
    boundingVolume: contentBoundingVolume,
  };

  if (!hasImplicitTiling) {
    const externalAsset = gltfJson.externalAssets[nodeJson.externalAsset];
    tileHeader.content.uri = gltfJson.files[externalAsset.file].uri;
    return new Cesium3DTile(tileset, baseResource, tileHeader, parentTile);
  }

  const implicitTilingExtension =
    nodeJson.extensions["3DTILES_implicit_tiling"];
  const { contentUri, subtreeUri } = implicitTilingExtension;
  tileHeader.content.uri = contentUri
    .replace("{right}", "{x}")
    .replace("{forward}", "{y}")
    .replace("{up}", "{z}");
  tileHeader.implicitTiling = implicitTilingExtension;
  tileHeader.implicitTiling.subtrees = {
    uri: subtreeUri
      .replace("{right}", "{x}")
      .replace("{forward}", "{y}")
      .replace("{up}", "{z}"),
  };

  const implicitTileset = new ImplicitTileset(
    baseResource,
    tileHeader,
    undefined,
  );
  const rootCoordinates = new ImplicitTileCoordinates({
    subdivisionScheme: implicitTileset.subdivisionScheme,
    subtreeLevels: implicitTileset.subtreeLevels,
    level: 0,
    x: 0,
    y: 0,
    // The constructor will only use this for octrees.
    z: 0,
  });

  // Create a placeholder Cesium3DTile that has an ImplicitTileset
  // object and whose content will resolve to an Implicit3DTileContent
  const derivedContentUri =
    implicitTileset.subtreeUriTemplate.getDerivedResource({
      templateValues: rootCoordinates.getTemplateValues(),
    }).url;

  const deepCopy = true;
  const tileJson = clone(tileHeader, deepCopy);
  // Replace contents with the subtree
  tileJson.contents = [
    {
      uri: derivedContentUri,
    },
  ];

  delete tileJson.content;

  // The placeholder tile does not have any extensions. If there are any
  // extensions beyond 3DTILES_implicit_tiling, Implicit3DTileContent will
  // copy them to the transcoded tiles.
  delete tileJson.extensions;

  const tile = new Cesium3DTile(tileset, baseResource, tileJson, parentTile);
  tile.implicitTileset = implicitTileset;
  tile.implicitCoordinates = rootCoordinates;
  return tile;
}

/**
 * 获取 glTF tileset 根瓦片的变换，包括
 * 将 tileset 的上轴转换为 z-上轴。
 *
 * @param {Axis} upAxis tileset 的上轴。
 * @param {object} nodeJson 根瓦片的 glTF 节点。
 * @returns {number[]|undefined} The 列主序变换，或如果为恒等变换则为 <code>undefined</code>。
 *
 * @private
 */
function getRootTransform(upAxis, nodeJson) {
  const nodeTransform = getNodeTransform(nodeJson);
  if (upAxis === Axis.Z) {
    return nodeTransform;
  }

  const axisCorrection = ModelUtility.getAxisCorrectionMatrix(
    upAxis,
    Axis.X,
    new Matrix4(),
  );
  if (!defined(nodeTransform)) {
    return Matrix4.pack(axisCorrection, new Array(16));
  }

  const rootTransform = Matrix4.multiplyTransformation(
    axisCorrection,
    Matrix4.unpack(nodeTransform),
    new Matrix4(),
  );
  return Matrix4.pack(rootTransform, new Array(16));
}

/**
 * 如果 tileset 元数据存在，则初始化 {@link Cesium3DTilesetMetadata}
 * 实例。由于元数据模式可能是外部的，因此这是异步的。
 *
 * @param {Cesium3DTileset} tileset 瓦片集
 * @param {object} tilesetJson 瓦片集 JSON 文件
 * @return {Promise<Cesium3DTilesetMetadata>} The 加载的 Cesium3DTilesetMetadata
 * @private
 */
async function processMetadataExtension(resource, tilesetJson) {
  const metadataJson = hasExtension(tilesetJson, "3DTILES_metadata")
    ? tilesetJson.extensions["3DTILES_metadata"]
    : tilesetJson;

  let schemaLoader;
  if (defined(metadataJson.schemaUri)) {
    resource = resource.getDerivedResource({
      url: metadataJson.schemaUri,
    });
    schemaLoader = ResourceCache.getSchemaLoader({
      resource: resource,
    });
  } else if (defined(metadataJson.schema)) {
    schemaLoader = ResourceCache.getSchemaLoader({
      schema: metadataJson.schema,
    });
  } else {
    return;
  }

  await schemaLoader.load();

  const metadataExtension = new Cesium3DTilesetMetadata({
    schema: schemaLoader.schema,
    metadataJson: metadataJson,
  });

  ResourceCache.unload(schemaLoader);

  return metadataExtension;
}

const scratchPositionNormal = new Cartesian3();
const scratchCartographic = new Cartographic();
const scratchMatrix = new Matrix4();
const scratchCenter = new Cartesian3();
const scratchPosition = new Cartesian3();
const scratchDirection = new Cartesian3();
const scratchHalfHeight = new Cartesian3();

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
function updateDynamicScreenSpaceError(tileset, frameState) {
  let up;
  let direction;
  let height;
  let minimumHeight;
  let maximumHeight;

  const camera = frameState.camera;
  const root = tileset._root;
  const tileBoundingVolume = root.contentBoundingVolume;

  if (tileBoundingVolume instanceof TileBoundingRegion) {
    up = Cartesian3.normalize(camera.positionWC, scratchPositionNormal);
    direction = camera.directionWC;
    height = camera.positionCartographic.height;
    minimumHeight = tileBoundingVolume.minimumHeight;
    maximumHeight = tileBoundingVolume.maximumHeight;
  } else {
    // Transform camera position and direction into the local coordinate system of the tileset
    const transformLocal = Matrix4.inverseTransformation(
      root.computedTransform,
      scratchMatrix,
    );
    const ellipsoid = frameState.mapProjection.ellipsoid;
    const boundingVolume = tileBoundingVolume.boundingVolume;
    const centerLocal = Matrix4.multiplyByPoint(
      transformLocal,
      boundingVolume.center,
      scratchCenter,
    );
    if (Cartesian3.magnitude(centerLocal) > ellipsoid.minimumRadius) {
      // The tileset is defined in WGS84. Approximate the minimum and maximum height.
      const centerCartographic = Cartographic.fromCartesian(
        centerLocal,
        ellipsoid,
        scratchCartographic,
      );
      up = Cartesian3.normalize(camera.positionWC, scratchPositionNormal);
      direction = camera.directionWC;
      height = camera.positionCartographic.height;
      minimumHeight = 0.0;
      maximumHeight = centerCartographic.height * 2.0;
    } else {
      // The tileset is defined in local coordinates (z-up)
      const positionLocal = Matrix4.multiplyByPoint(
        transformLocal,
        camera.positionWC,
        scratchPosition,
      );
      up = Cartesian3.UNIT_Z;
      direction = Matrix4.multiplyByPointAsVector(
        transformLocal,
        camera.directionWC,
        scratchDirection,
      );
      direction = Cartesian3.normalize(direction, direction);
      height = positionLocal.z;
      if (tileBoundingVolume instanceof TileOrientedBoundingBox) {
        // Assuming z-up, the last column is the local z direction and
        // represents the height of the bounding box.
        const halfHeightVector = Matrix3.getColumn(
          boundingVolume.halfAxes,
          2,
          scratchHalfHeight,
        );
        const halfHeight = Cartesian3.magnitude(halfHeightVector);
        minimumHeight = centerLocal.z - halfHeight;
        maximumHeight = centerLocal.z + halfHeight;
      } else if (tileBoundingVolume instanceof TileBoundingSphere) {
        const radius = boundingVolume.radius;
        minimumHeight = centerLocal.z - radius;
        maximumHeight = centerLocal.z + radius;
      }
    }
  }

  // The range where the density starts to lessen. Start at the quarter height of the tileset.
  const heightFalloff = tileset.dynamicScreenSpaceErrorHeightFalloff;
  const heightClose =
    minimumHeight + (maximumHeight - minimumHeight) * heightFalloff;
  const heightFar = maximumHeight;

  const t = CesiumMath.clamp(
    (height - heightClose) / (heightFar - heightClose),
    0.0,
    1.0,
  );

  // Increase density as the camera tilts towards the horizon
  let horizonFactor = 1.0 - Math.abs(Cartesian3.dot(direction, up));

  // Weaken the horizon factor as the camera height increases, implying the camera is further away from the tileset.
  // The goal is to increase density for the "street view", not when viewing the tileset from a distance.
  horizonFactor = horizonFactor * (1.0 - t);

  tileset._dynamicScreenSpaceErrorComputedDensity =
    tileset.dynamicScreenSpaceErrorDensity * horizonFactor;
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 */
function requestContent(tileset, tile) {
  if (tile.hasEmptyContent) {
    return;
  }

  const { statistics } = tileset;
  const contentExpired = tile.contentExpired;

  const promise = tile.requestContent();
  if (!defined(promise)) {
    return;
  }

  promise
    .then((content) => {
      if (!defined(content) || tile.isDestroyed() || tileset.isDestroyed()) {
        return;
      }

      tileset._processingQueue.push(tile);
      ++statistics.numberOfTilesProcessing;
    })
    .catch((error) => {
      handleTileFailure(error, tileset, tile);
    });

  if (contentExpired) {
    if (tile.hasTilesetContent || tile.hasImplicitContent) {
      destroySubtree(tileset, tile);
    } else {
      statistics.decrementLoadCounts(tile.content);
      --statistics.numberOfTilesWithContentReady;
    }
  }

  tileset._requestedTilesInFlight.push(tile);
}

function sortTilesByPriority(a, b) {
  return a._priority - b._priority;
}

/**
 * 在此执行任何通过不变性任务。在渲染通过后调用。
 * @ignore
 * @param {FrameState} frameState
 */
Cesium3DTileset.prototype.postPassesUpdate = function (frameState) {
  if (!defined(this._root)) {
    return;
  }

  cancelOutOfViewRequests(this, frameState);
  raiseLoadProgressEvent(this, frameState);
  this._cache.unloadTiles(this, unloadTile);
  releaseImplicitTiles(this, frameState);

  // If the style wasn't able to be applied this frame (for example,
  // the tileset was hidden), keep it dirty so the engine can try
  // to apply the style next frame.
  if (this._styleApplied) {
    this._styleEngine.resetDirty();
  }
  this._styleApplied = false;
};

/**
 * 将所属瓦片集订阅其裁剪多边形添加/移除事件，以便
 * 当几何结构发生变化时，瓦片内容可以重新生成裁剪纹理。
 * @private
 * @param {Cesium3DTileset} tileset
 */
function updateTilesetClippingPolygonListeners(tileset) {
  tileset._removeClippingPolygonAdded =
    tileset._removeClippingPolygonAdded &&
    tileset._removeClippingPolygonAdded();
  tileset._removeClippingPolygonRemoved =
    tileset._removeClippingPolygonRemoved &&
    tileset._removeClippingPolygonRemoved();

  const clippingPolygons = tileset._clippingPolygons;
  if (!defined(clippingPolygons)) {
    return;
  }

  const markDirty = () => {
    tileset._clippingPolygonsNeedRebake = true;
  };
  tileset._removeClippingPolygonAdded =
    clippingPolygons.polygonAdded.addEventListener(markDirty);
  tileset._removeClippingPolygonRemoved =
    clippingPolygons.polygonRemoved.addEventListener(markDirty);
}

/**
 * 在此执行任何通过不变性任务。在所有通过执行之前调用。
 * @ignore
 * @param {FrameState} frameState
 */
Cesium3DTileset.prototype.prePassesUpdate = function (frameState) {
  if (!defined(this._root)) {
    return;
  }

  const memoryExceeded = processTiles(this, frameState);
  updateMemoryAdjustedScreenSpaceError(this, frameState, memoryExceeded);

  // Update clipping planes
  const clippingPlanes = this._clippingPlanes;
  this._clippingPlanesOriginMatrixDirty = true;
  if (defined(clippingPlanes) && clippingPlanes.enabled) {
    clippingPlanes.update(frameState);
  }

  // Update clipping polygons
  const clippingPolygons = this._clippingPolygons;
  if (defined(clippingPolygons) && clippingPolygons.enabled) {
    clippingPolygons.update(frameState);
  }

  // After a polygon add/remove, mark loaded tiles so their content rebakes
  // clipping textures. Done once per frame to dedupe multiple changes.
  if (this._clippingPolygonsNeedRebake) {
    this._clippingPolygonsNeedRebake = false;
    this._cache.forEachLoadedTile((tile) => {
      tile.clippingPolygonsNeedRebake = true;
    });
  }

  if (!defined(this._loadTimestamp)) {
    this._loadTimestamp = JulianDate.clone(frameState.time);
  }
  this._timeSinceLoad = Math.max(
    JulianDate.secondsDifference(frameState.time, this._loadTimestamp) * 1000,
    0.0,
  );

  if (this.dynamicScreenSpaceError) {
    updateDynamicScreenSpaceError(this, frameState);
  }

  if (frameState.newFrame) {
    this._cache.reset();
  }
};

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
function cancelOutOfViewRequests(tileset, frameState) {
  const requestedTilesInFlight = tileset._requestedTilesInFlight;
  let removeCount = 0;
  for (let i = 0; i < requestedTilesInFlight.length; ++i) {
    const tile = requestedTilesInFlight[i];

    // NOTE: This is framerate dependant so make sure the threshold check is small
    const outOfView = frameState.frameNumber - tile._touchedFrame >= 1;
    if (tile._contentState !== Cesium3DTileContentState.LOADING) {
      // No longer fetching from host, don't need to track it anymore. Gets marked as LOADING in Cesium3DTile::requestContent().
      ++removeCount;
      continue;
    } else if (outOfView) {
      // RequestScheduler will take care of cancelling it
      tile.cancelRequests();
      ++removeCount;
      continue;
    }

    if (removeCount > 0) {
      requestedTilesInFlight[i - removeCount] = tile;
    }
  }

  requestedTilesInFlight.length -= removeCount;
}

/**
 * 在发出任何请求之前按优先级对请求进行排序。
 * 这减少了请求在发出后被取消的可能性。
 * @private
 * @param {Cesium3DTileset} tileset
 */
function requestTiles(tileset) {
  const requestedTiles = tileset._requestedTiles;
  requestedTiles.sort(sortTilesByPriority);
  for (let i = 0; i < requestedTiles.length; ++i) {
    requestContent(tileset, requestedTiles[i]);
  }
}

/**
 * @private
 * @param {Error} error
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 */
function handleTileFailure(error, tileset, tile) {
  if (tileset.isDestroyed()) {
    return;
  }

  let url;
  if (!tile.isDestroyed()) {
    url = tile._contentResource.url;
  }

  const message = defined(error.message) ? error.message : error.toString();
  if (tileset.tileFailed.numberOfListeners > 0) {
    tileset.tileFailed.raiseEvent({
      url: url,
      message: message,
    });
  } else {
    console.log(`A 3D tile failed to load: ${url}`);
    console.log(`Error: ${message}`);
    console.log(error.stack);
  }
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 */
function filterProcessingQueue(tileset) {
  const tiles = tileset._processingQueue;

  let removeCount = 0;
  for (let i = 0; i < tiles.length; ++i) {
    const tile = tiles[i];
    if (
      tile.isDestroyed() ||
      tile._contentState !== Cesium3DTileContentState.PROCESSING
    ) {
      ++removeCount;
      continue;
    }
    if (removeCount > 0) {
      tiles[i - removeCount] = tile;
    }
  }
  tiles.length -= removeCount;
}

const scratchUpdateHeightCartographic = new Cartographic();
const scratchUpdateHeightCartographic2 = new Cartographic();
const scratchUpdateHeightCartesian = new Cartesian3();

function processUpdateHeight(tileset, tile, frameState) {
  if (!tileset.enableCollision || !tileset.show) {
    return;
  }

  const heightCallbackData = tileset._addHeightCallbacks;
  const boundingSphere = tile.boundingSphere;

  for (const callbackData of heightCallbackData) {
    // No need to update if the tile was already visible last frame
    if (callbackData.invoked || tile._wasSelectedLastFrame) {
      continue;
    }

    const ellipsoid = callbackData.ellipsoid;
    const positionCartographic = Cartographic.clone(
      callbackData.positionCartographic,
      scratchUpdateHeightCartographic,
    );
    const centerCartographic = Cartographic.fromCartesian(
      boundingSphere.center,
      ellipsoid,
      scratchUpdateHeightCartographic2,
    );

    // This can be undefined when the bounding sphere is at the origin
    if (defined(centerCartographic)) {
      positionCartographic.height = centerCartographic.height;
    }

    const position = Cartographic.toCartesian(
      positionCartographic,
      ellipsoid,
      scratchUpdateHeightCartesian,
    );
    if (
      Cartesian3.distance(position, boundingSphere.center) <=
      boundingSphere.radius
    ) {
      callbackData.invoked = true;
      frameState.afterRender.push(() => {
        // Callback can be removed before it actually invoked at the end of the frame
        if (defined(callbackData.callback)) {
          callbackData.callback();
        }
        callbackData.invoked = false;
      });
    }
  }
}

/**
 * 以 PROCESSING 状态处理瓦片，以便它们最终变为 READY 状态。
 * @private
 * @param {Cesium3DTileset} tileset 正在被处理的瓦片集。
 * @param {FrameState} frameState 当前帧状态。
 * @returns {boolean} <code>true</code> 如果由于瓦片集内存不足而停止处理。
 */
function processTiles(tileset, frameState) {
  filterProcessingQueue(tileset);
  const tiles = tileset._processingQueue;

  const { cacheBytes, maximumCacheOverflowBytes, statistics } = tileset;
  const cacheByteLimit = cacheBytes + maximumCacheOverflowBytes;

  for (let i = 0; i < tiles.length; ++i) {
    if (tileset.totalMemoryUsageInBytes > cacheByteLimit) {
      return true;
    }

    const tile = tiles[i];
    try {
      tile.process(tileset, frameState);

      if (tile.contentReady) {
        --statistics.numberOfTilesProcessing;
        tileset.tileLoad.raiseEvent(tile);
      }
    } catch (error) {
      --statistics.numberOfTilesProcessing;
      handleTileFailure(error, tileset, tile);
    }
  }

  return false;
}

/**
 * 调整屏幕空间误差，使所需的瓦片数量适合内存容量。
 *
 * @private
 * @param {Cesium3DTileset} tileset 调整了屏幕空间误差的瓦片集。
 * @param {FrameState} frameState 当前帧状态。
 * @param {boolean} memoryExceeded 是否由于瓦片集内存不足而停止瓦片处理。
 */
function updateMemoryAdjustedScreenSpaceError(
  tileset,
  frameState,
  memoryExceeded,
) {
  if (tileset._memoryAdjustedScreenSpaceErrorHeld) {
    const viewChanged = !Matrix4.equals(
      frameState.camera.viewMatrix,
      tileset._memoryAdjustedScreenSpaceErrorViewMatrix,
    );
    if (viewChanged || tileset._modelMatrixChanged) {
      tileset._memoryAdjustedScreenSpaceErrorHeld = false;
    }
  }

  const memoryAvailable = tileset.totalMemoryUsageInBytes < tileset.cacheBytes;
  if (memoryAvailable && !tileset._memoryAdjustedScreenSpaceErrorHeld) {
    decreaseScreenSpaceError(tileset);
  } else if (memoryExceeded) {
    increaseScreenSpaceError(tileset, frameState);
  }
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
function increaseScreenSpaceError(tileset, frameState) {
  //>>includeStart('debug', pragmas.debug);
  oneTimeWarning(
    "increase-screenSpaceError",
    `The tiles needed to meet maximumScreenSpaceError would use more memory than allocated for this tileset.
    The tileset will be rendered with a larger screen space error (see memoryAdjustedScreenSpaceError).
    Consider using larger values for cacheBytes and maximumCacheOverflowBytes.`,
  );
  //>>includeEnd('debug');

  tileset._memoryAdjustedScreenSpaceError *= 1.02;
  tileset._memoryAdjustedScreenSpaceErrorHeld = true;
  Matrix4.clone(
    frameState.camera.viewMatrix,
    tileset._memoryAdjustedScreenSpaceErrorViewMatrix,
  );
  const tiles = tileset._processingQueue;
  for (let i = 0; i < tiles.length; ++i) {
    tiles[i].updatePriority();
  }
  tiles.sort(sortTilesByPriority);
}

function decreaseScreenSpaceError(tileset) {
  tileset._memoryAdjustedScreenSpaceError = Math.max(
    tileset.memoryAdjustedScreenSpaceError / 1.02,
    tileset.maximumScreenSpaceError,
  );
}

const scratchCartesian = new Cartesian3();

const stringOptions = {
  maximumFractionDigits: 3,
};

/**
 * @private
 * @param {number} memorySizeInBytes
 * @returns {string}
 */
function formatMemoryString(memorySizeInBytes) {
  const memoryInMegabytes = memorySizeInBytes / 1048576;
  if (memoryInMegabytes < 1.0) {
    return memoryInMegabytes.toLocaleString(undefined, stringOptions);
  }
  return Math.round(memoryInMegabytes).toLocaleString();
}

/**
 * @private
 * @param {Cesium3DTile} tile
 * @returns {Cartesian3}
 */
function computeTileLabelPosition(tile) {
  const { halfAxes, radius, center } = tile.boundingVolume.boundingVolume;

  let position = Cartesian3.clone(center, scratchCartesian);
  if (defined(halfAxes)) {
    position.x += 0.75 * (halfAxes[0] + halfAxes[3] + halfAxes[6]);
    position.y += 0.75 * (halfAxes[1] + halfAxes[4] + halfAxes[7]);
    position.z += 0.75 * (halfAxes[2] + halfAxes[5] + halfAxes[8]);
  } else if (defined(radius)) {
    let normal = Cartesian3.normalize(center, scratchCartesian);
    normal = Cartesian3.multiplyByScalar(
      normal,
      0.75 * radius,
      scratchCartesian,
    );
    position = Cartesian3.add(normal, center, scratchCartesian);
  }
  return position;
}

/**
 * @private
 * @param {Cesium3DTile} tile
 * @param {Cesium3DTileset} tileset
 * @param {Cartesian3} position
 * @returns {Label}
 */
function addTileDebugLabel(tile, tileset, position) {
  let labelString = "";
  let attributes = 0;

  if (tileset.debugShowGeometricError) {
    labelString += `\nGeometric error: ${tile.geometricError}`;
    attributes++;
  }

  if (tileset.debugShowRenderingStatistics) {
    labelString += `\nCommands: ${tile.commandsLength}`;
    attributes++;

    // Don't display number of points or triangles if 0.
    const numberOfPoints = tile.content.pointsLength;
    if (numberOfPoints > 0) {
      labelString += `\nPoints: ${tile.content.pointsLength}`;
      attributes++;
    }

    const numberOfTriangles = tile.content.trianglesLength;
    if (numberOfTriangles > 0) {
      labelString += `\nTriangles: ${tile.content.trianglesLength}`;
      attributes++;
    }

    labelString += `\nFeatures: ${tile.content.featuresLength}`;
    attributes++;
  }

  if (tileset.debugShowMemoryUsage) {
    labelString += `\nTexture Memory: ${formatMemoryString(
      tile.content.texturesByteLength,
    )}`;
    labelString += `\nGeometry Memory: ${formatMemoryString(
      tile.content.geometryByteLength,
    )}`;
    attributes += 2;
  }

  if (tileset.debugShowUrl) {
    if (tile.hasMultipleContents) {
      labelString += "\nUrls:";
      const urls = tile.content.innerContentUrls;
      for (let i = 0; i < urls.length; i++) {
        labelString += `\n- ${urls[i]}`;
      }
      attributes += urls.length;
    } else {
      labelString += `\nUrl: ${tile._contentHeader.uri}`;
      attributes++;
    }
  }

  const newLabel = {
    text: labelString.substring(1),
    position: position,
    font: `${19 - attributes}px sans-serif`,
    showBackground: true,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  };

  return tileset._tileDebugLabels.add(newLabel);
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
function updateTileDebugLabels(tileset, frameState) {
  const selectedTiles = tileset._selectedTiles;
  const selectedLength = selectedTiles.length;
  const emptyTiles = tileset._emptyTiles;
  const emptyLength = emptyTiles.length;
  tileset._tileDebugLabels.removeAll();

  if (tileset.debugPickedTileLabelOnly) {
    if (defined(tileset.debugPickedTile)) {
      const position = defined(tileset.debugPickPosition)
        ? tileset.debugPickPosition
        : computeTileLabelPosition(tileset.debugPickedTile);
      const label = addTileDebugLabel(
        tileset.debugPickedTile,
        tileset,
        position,
      );
      label.pixelOffset = new Cartesian2(15, -15); // Offset to avoid picking the label.
    }
  } else {
    for (let i = 0; i < selectedLength; ++i) {
      const tile = selectedTiles[i];
      addTileDebugLabel(tile, tileset, computeTileLabelPosition(tile));
    }
    for (let i = 0; i < emptyLength; ++i) {
      const tile = emptyTiles[i];
      if (tile.hasTilesetContent || tile.hasImplicitContent) {
        addTileDebugLabel(tile, tileset, computeTileLabelPosition(tile));
      }
    }
  }
  tileset._tileDebugLabels.update(frameState);
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 * @param {object} passOptions
 */
function updateTiles(tileset, frameState, passOptions) {
  tileset._styleEngine.applyStyle(tileset);
  tileset._styleApplied = true;

  const { commandList, context } = frameState;
  const numberOfInitialCommands = commandList.length;
  const selectedTiles = tileset._selectedTiles;

  const bivariateVisibilityTest =
    tileset.isSkippingLevelOfDetail &&
    tileset._hasMixedContent &&
    context.stencilBuffer &&
    selectedTiles.length > 0;

  tileset._backfaceCommands.length = 0;

  if (bivariateVisibilityTest) {
    if (!defined(tileset._stencilClearCommand)) {
      tileset._stencilClearCommand = new ClearCommand({
        stencil: 0,
        pass: Pass.CESIUM_3D_TILE,
        renderState: RenderState.fromCache({
          stencilMask: StencilConstants.SKIP_LOD_MASK,
        }),
      });
    }
    commandList.push(tileset._stencilClearCommand);
  }

  const { statistics, tileVisible } = tileset;
  const isRender = passOptions.isRender;
  const lengthBeforeUpdate = commandList.length;

  for (let i = 0; i < selectedTiles.length; ++i) {
    const tile = selectedTiles[i];
    // Raise the tileVisible event before update in case the tileVisible event
    // handler makes changes that update needs to apply to WebGL resources
    if (isRender) {
      tileVisible.raiseEvent(tile);
    }
    processUpdateHeight(tileset, tile, frameState);
    tile.update(tileset, frameState, passOptions);
    statistics.incrementSelectionCounts(tile.content);
    ++statistics.selected;
  }
  const emptyTiles = tileset._emptyTiles;
  for (let i = 0; i < emptyTiles.length; ++i) {
    const tile = emptyTiles[i];
    tile.update(tileset, frameState, passOptions);
  }

  let addedCommandsLength = commandList.length - lengthBeforeUpdate;

  tileset._backfaceCommands.trim();

  if (bivariateVisibilityTest) {
    /*
     * Consider 'effective leaf' tiles as selected tiles that have no selected descendants. They may have children,
     * but they are currently our effective leaves because they do not have selected descendants. These tiles
     * are those where with tile._finalResolution === true.
     * Let 'unresolved' tiles be those with tile._finalResolution === false.
     *
     * 1. Render just the backfaces of unresolved tiles in order to lay down z
     * 2. Render all frontfaces wherever tile._selectionDepth > stencilBuffer.
     *    Replace stencilBuffer with tile._selectionDepth, when passing the z test.
     *    Because children are always drawn before ancestors {@link Cesium3DTilesetTraversal#traverseAndSelect},
     *    this effectively draws children first and does not draw ancestors if a descendant has already
     *    been drawn at that pixel.
     *    Step 1 prevents child tiles from appearing on top when they are truly behind ancestor content.
     *    If they are behind the backfaces of the ancestor, then they will not be drawn.
     *
     * NOTE: Step 2 sometimes causes visual artifacts when backfacing child content has some faces that
     * partially face the camera and are inside of the ancestor content. Because they are inside, they will
     * not be culled by the depth writes in Step 1, and because they partially face the camera, the stencil tests
     * will draw them on top of the ancestor content.
     *
     * NOTE: Because we always render backfaces of unresolved tiles, if the camera is looking at the backfaces
     * of an object, they will always be drawn while loading, even if backface culling is enabled.
     */

    const backfaceCommands = tileset._backfaceCommands.values;
    const backfaceCommandsLength = backfaceCommands.length;

    commandList.length += backfaceCommandsLength;

    // copy commands to the back of the commandList
    for (let i = addedCommandsLength - 1; i >= 0; --i) {
      commandList[lengthBeforeUpdate + backfaceCommandsLength + i] =
        commandList[lengthBeforeUpdate + i];
    }

    // move backface commands to the front of the commandList
    for (let i = 0; i < backfaceCommandsLength; ++i) {
      commandList[lengthBeforeUpdate + i] = backfaceCommands[i];
    }
  }

  // Number of commands added by each update above
  addedCommandsLength = commandList.length - numberOfInitialCommands;
  statistics.numberOfCommands = addedCommandsLength;

  if (!isRender) {
    return;
  }

  // Only run EDL if simple attenuation is on
  if (
    tileset.pointCloudShading.attenuation &&
    tileset.pointCloudShading.eyeDomeLighting &&
    addedCommandsLength > 0
  ) {
    tileset._pointCloudEyeDomeLighting.update(
      frameState,
      numberOfInitialCommands,
      tileset.pointCloudShading,
      tileset.boundingSphere,
    );
  }

  if (
    tileset.debugShowGeometricError ||
    tileset.debugShowRenderingStatistics ||
    tileset.debugShowMemoryUsage ||
    tileset.debugShowUrl
  ) {
    if (!defined(tileset._tileDebugLabels)) {
      tileset._tileDebugLabels = new LabelCollection();
    }
    updateTileDebugLabels(tileset, frameState);
  } else {
    tileset._tileDebugLabels =
      tileset._tileDebugLabels && tileset._tileDebugLabels.destroy();
  }
}

const scratchStack = [];

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 */
function destroySubtree(tileset, tile) {
  const root = tile;
  const stack = scratchStack;
  stack.push(tile);
  while (stack.length > 0) {
    tile = stack.pop();
    const children = tile._children;
    for (let i = 0; i < children.length; ++i) {
      stack.push(children[i]);
    }
    if (tile !== root) {
      destroyTile(tileset, tile);
      --tileset._statistics.numberOfTilesTotal;
    }
  }
  root.children = [];
}

/**
 * 释放给定瓦片以下的所有隐式瓦片，除非其中任何一项有
 * 内容已加载或正在加载中。给定瓦片保持不变：其父节点仍将其列出，
 * 如果遍历返回到它，它将再次创建其子节点。
 *
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 * @returns {boolean} Whether 这些瓦片已被释放。
 */
function releaseDescendantsIfUnused(tileset, tile) {
  const descendants = tile._children.slice();
  for (let i = 0; i < descendants.length; ++i) {
    const descendant = descendants[i];
    const state = descendant._contentState;
    // Empty tiles are READY without holding any content.
    const hasContent =
      !descendant.hasEmptyContent &&
      (state === Cesium3DTileContentState.LOADING ||
        state === Cesium3DTileContentState.PROCESSING ||
        state === Cesium3DTileContentState.READY ||
        state === Cesium3DTileContentState.EXPIRED);
    if (hasContent) {
      return false;
    }
    const children = descendant._children;
    for (let j = 0; j < children.length; ++j) {
      descendants.push(children[j]);
    }
  }

  for (let i = 0; i < descendants.length; ++i) {
    destroyTile(tileset, descendants[i]);
  }
  tileset._statistics.numberOfTilesTotal -= descendants.length;
  tile._children.length = 0;
  tile._implicitChildrenCreated = false;
  return true;
}

/**
 * 释放缓存未加载内容的分支以下的隐式瓦片。如果遍历返回到它们，它们将再次被创建。
 * 这些瓦片被卸载了。如果遍历返回到它们，它们将再次被创建。
 *
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
function releaseImplicitTiles(tileset, frameState) {
  const candidates = tileset._releaseCandidateTiles;
  const retained = [];
  for (const tile of candidates) {
    candidates.delete(tile);
    // The tile may have been released or destroyed since it was added.
    if (!tile._implicitChildrenCreated) {
      continue;
    }

    // A branch the traversal visited this frame is checked again next frame.
    const visitedThisFrame = tile._children.some(
      (child) => child._touchedFrame === frameState.frameNumber,
    );
    if (visitedThisFrame) {
      retained.push(tile);
      continue;
    }

    const parent = tile.parent;
    if (
      releaseDescendantsIfUnused(tileset, tile) &&
      defined(parent) &&
      parent._implicitChildrenCreated
    ) {
      // Releasing this branch may leave the level above it releasable too.
      candidates.add(parent);
    }
  }

  for (const tile of retained) {
    candidates.add(tile);
  }
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 */
function unloadTile(tileset, tile) {
  tileset.tileUnload.raiseEvent(tile);
  tileset._statistics.decrementLoadCounts(tile.content);
  --tileset._statistics.numberOfTilesWithContentReady;
  tile.unloadContent();

  // Explicit tiles never create implicit children, so they are never candidates.
  const parent = tile.parent;
  if (defined(parent) && parent._implicitChildrenCreated) {
    tileset._releaseCandidateTiles.add(parent);
  }
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 */
function destroyTile(tileset, tile) {
  tileset._cache.unloadTile(tileset, tile, unloadTile);
  tile.destroy();
}

/**
 * 卸载上一帧未被选中的所有瓦片。这可用于
 * 明确管理瓦片缓存并减少下載的瓦片总数
 * {@link Cesium3DTileset#cacheBytes}。
 * <p>
 * 瓦片卸载发生在下一帧，以保持所有 WebGL 删除调用
 * 在渲染循环内。
 * </p>
 */
Cesium3DTileset.prototype.trimLoadedTiles = function () {
  this._cache.trim();
};

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
function raiseLoadProgressEvent(tileset, frameState) {
  const statistics = tileset._statistics;
  const statisticsLast = tileset._statisticsLast;

  const numberOfPendingRequests = statistics.numberOfPendingRequests;
  const numberOfTilesProcessing = statistics.numberOfTilesProcessing;
  const lastNumberOfPendingRequest = statisticsLast.numberOfPendingRequests;
  const lastNumberOfTilesProcessing = statisticsLast.numberOfTilesProcessing;

  Cesium3DTilesetStatistics.clone(statistics, statisticsLast);

  const progressChanged =
    numberOfPendingRequests !== lastNumberOfPendingRequest ||
    numberOfTilesProcessing !== lastNumberOfTilesProcessing;

  if (progressChanged) {
    frameState.afterRender.push(function () {
      tileset.loadProgress.raiseEvent(
        numberOfPendingRequests,
        numberOfTilesProcessing,
      );

      return true;
    });
  }

  tileset._tilesLoaded =
    statistics.numberOfPendingRequests === 0 &&
    statistics.numberOfTilesProcessing === 0 &&
    statistics.numberOfAttemptedRequests === 0;

  // Events are raised (added to the afterRender queue) here since promises
  // may resolve outside of the update loop that then raise events, e.g.,
  // model's readyEvent
  if (progressChanged && tileset._tilesLoaded) {
    frameState.afterRender.push(function () {
      tileset.allTilesLoaded.raiseEvent();
      return true;
    });
    if (!tileset._initialTilesLoaded) {
      tileset._initialTilesLoaded = true;
      frameState.afterRender.push(function () {
        tileset.initialTilesLoaded.raiseEvent();
        return true;
      });
    }
  }
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 */
function resetMinimumMaximum(tileset) {
  tileset._heatmap.resetMinimumMaximum();
  tileset._minimumPriority.depth = Number.MAX_VALUE;
  tileset._maximumPriority.depth = -Number.MAX_VALUE;
  tileset._minimumPriority.foveatedFactor = Number.MAX_VALUE;
  tileset._maximumPriority.foveatedFactor = -Number.MAX_VALUE;
  tileset._minimumPriority.distance = Number.MAX_VALUE;
  tileset._maximumPriority.distance = -Number.MAX_VALUE;
  tileset._minimumPriority.reverseScreenSpaceError = Number.MAX_VALUE;
  tileset._maximumPriority.reverseScreenSpaceError = -Number.MAX_VALUE;
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
function detectModelMatrixChanged(tileset, frameState) {
  if (
    frameState.frameNumber === tileset._updatedModelMatrixFrame &&
    defined(tileset._previousModelMatrix)
  ) {
    return;
  }

  tileset._updatedModelMatrixFrame = frameState.frameNumber;
  tileset._modelMatrixChanged = !Matrix4.equals(
    tileset.modelMatrix,
    tileset._previousModelMatrix,
  );
  if (tileset._modelMatrixChanged) {
    tileset._previousModelMatrix = Matrix4.clone(
      tileset.modelMatrix,
      tileset._previousModelMatrix,
    );
  }
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 * @param {Cesium3DTilesetStatistics} passStatistics
 * @param {object} passOptions
 * @returns {boolean}
 */
function update(tileset, frameState, passStatistics, passOptions) {
  if (frameState.mode === SceneMode.MORPHING) {
    return false;
  }

  if (!defined(tileset._root)) {
    return false;
  }

  const statistics = tileset._statistics;
  statistics.clear();

  // Resets the visibility check for each pass
  ++tileset._updatedVisibilityFrame;

  // Update any tracked min max values
  resetMinimumMaximum(tileset);

  detectModelMatrixChanged(tileset, frameState);
  tileset._cullRequestsWhileMoving =
    tileset.cullRequestsWhileMoving && !tileset._modelMatrixChanged;

  const ready = tileset
    .getTraversal(passOptions)
    .selectTiles(tileset, frameState);

  if (passOptions.requestTiles) {
    requestTiles(tileset);
  }

  updateTiles(tileset, frameState, passOptions);

  // Update pass statistics
  Cesium3DTilesetStatistics.clone(statistics, passStatistics);

  if (passOptions.isRender) {
    const credits = tileset._credits;
    if (defined(credits) && statistics.selected !== 0) {
      for (let i = 0; i < credits.length; ++i) {
        const credit = credits[i];
        frameState.creditDisplay.addCreditToNextFrame(credit);
      }
    }
  }

  return ready;
}

function createCredits(tileset) {
  let credits = tileset._credits;
  if (!defined(credits)) {
    credits = [];
  }
  credits.length = 0;

  if (defined(tileset.resource.credits)) {
    tileset.resource.credits.forEach((credit) => {
      credits.push(Credit.clone(credit));
    });
  }

  const assetExtras = tileset.asset.extras;
  if (
    defined(assetExtras) &&
    defined(assetExtras.cesium) &&
    defined(assetExtras.cesium.credits)
  ) {
    const extraCredits = assetExtras.cesium.credits;
    for (let i = 0; i < extraCredits.length; ++i) {
      const credit = extraCredits[i];
      credits.push(new Credit(credit.html));
    }
  }

  credits.forEach(
    (credit) =>
      (credit.showOnScreen =
        credit.showOnScreen || tileset._showCreditsOnScreen),
  );

  tileset._credits = credits;
}

/**
 * @private
 * @param {object} passOptions
 * @returns {Cesium3DTilesetTraversal}
 */
Cesium3DTileset.prototype.getTraversal = function (passOptions) {
  const { pass } = passOptions;
  if (
    pass === Cesium3DTilePass.MOST_DETAILED_PRELOAD ||
    pass === Cesium3DTilePass.MOST_DETAILED_PICK
  ) {
    return Cesium3DTilesetMostDetailedTraversal;
  }
  return this.isSkippingLevelOfDetail
    ? Cesium3DTilesetSkipTraversal
    : Cesium3DTilesetBaseTraversal;
};

/**
 * @ignore
 * @param {FrameState} frameState
 */
Cesium3DTileset.prototype.update = function (frameState) {
  this.updateForPass(frameState, frameState.tilesetPassState);
};

/**
 * @ignore
 * @param {FrameState} frameState
 * @param {object} tilesetPassState
 */
Cesium3DTileset.prototype.updateForPass = function (
  frameState,
  tilesetPassState,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("frameState", frameState);
  Check.typeOf.object("tilesetPassState", tilesetPassState);
  //>>includeEnd('debug');

  this.imageryLayers._update();

  const pass = tilesetPassState.pass;
  if (
    (pass === Cesium3DTilePass.PRELOAD &&
      (!this.preloadWhenHidden || this.show)) ||
    (pass === Cesium3DTilePass.PRELOAD_FLIGHT &&
      (!this.preloadFlightDestinations ||
        (!this.show && !this.preloadWhenHidden))) ||
    (pass === Cesium3DTilePass.REQUEST_RENDER_MODE_DEFER_CHECK &&
      ((!this._cullRequestsWhileMoving && this.foveatedTimeDelay <= 0) ||
        !this.show))
  ) {
    return;
  }

  const originalCommandList = frameState.commandList;
  const originalCamera = frameState.camera;
  const originalCullingVolume = frameState.cullingVolume;

  tilesetPassState.ready = false;

  const passOptions = Cesium3DTilePass.getPassOptions(pass);
  const ignoreCommands = passOptions.ignoreCommands;

  const commandList = tilesetPassState.commandList ?? originalCommandList;
  const commandStart = commandList.length;

  frameState.commandList = commandList;
  frameState.camera = tilesetPassState.camera ?? originalCamera;
  frameState.cullingVolume =
    tilesetPassState.cullingVolume ?? originalCullingVolume;

  if (passOptions.isRender) {
    const environmentMapManager = this._environmentMapManager;
    if (defined(this._root)) {
      environmentMapManager.position = this.boundingSphere.center;
    }
    environmentMapManager.update(frameState);
  }

  const passStatistics = this._statisticsPerPass[pass];

  if (this.show || ignoreCommands) {
    this._pass = pass;
    tilesetPassState.ready = update(
      this,
      frameState,
      passStatistics,
      passOptions,
    );
  }

  if (ignoreCommands) {
    commandList.length = commandStart;
  }

  frameState.commandList = originalCommandList;
  frameState.camera = originalCamera;
  frameState.cullingVolume = originalCullingVolume;
};

/**
 * 如果瓦片集 JSON 文件在 extensionsUsed 中列出扩展，则为 <code>true</code>；否则为 <code>false</code>。
 * @param {string} extensionName 要检查的扩展名称。
 *
 * @returns {boolean} <code>true</code> 如果瓦片集 JSON 文件在 extensionsUsed 中列出扩展；否则为 <code>false</code>。
 */
Cesium3DTileset.prototype.hasExtension = function (extensionName) {
  if (!defined(this._extensionsUsed)) {
    return false;
  }

  return this._extensionsUsed.indexOf(extensionName) > -1;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用任何非
 * <code>isDestroyed</code> 的函数将导致 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁；否则为 <code>false</code>。
 *
 * @see Cesium3DTileset#destroy
 */
Cesium3DTileset.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象可确保确定性
 * 释放 WebGL 资源，而非依赖垃圾收集器来销毁该对象。
 * <br /><br />
 * 一旦对象被销毁，就不应再使用它；调用除
 * <code>isDestroyed</code>之外的任何函数都将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>)赋给该对象，如示例所示。
 *
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 *
 * @example
 * tileset = tileset && tileset.destroy();
 *
 * @see Cesium3DTileset#isDestroyed
 */
Cesium3DTileset.prototype.destroy = function () {
  this._tileDebugLabels =
    this._tileDebugLabels && this._tileDebugLabels.destroy();

  this._removeClippingPolygonAdded =
    this._removeClippingPolygonAdded && this._removeClippingPolygonAdded();
  this._removeClippingPolygonRemoved =
    this._removeClippingPolygonRemoved && this._removeClippingPolygonRemoved();

  this._clippingPlanes = this._clippingPlanes && this._clippingPlanes.destroy();
  this._clippingPolygons = undefined;

  // Traverse the tree and destroy all tiles
  if (defined(this._root)) {
    const stack = scratchStack;
    stack.push(this._root);

    while (stack.length > 0) {
      const tile = stack.pop();
      tile.destroy();

      const children = tile.children;
      for (let i = 0; i < children.length; ++i) {
        stack.push(children[i]);
      }
    }
  }
  this._root = undefined;

  if (
    this._shouldDestroyImageBasedLighting &&
    !this._imageBasedLighting.isDestroyed()
  ) {
    this._imageBasedLighting.destroy();
  }
  this._imageBasedLighting = undefined;

  if (!this._environmentMapManager.isDestroyed()) {
    this._environmentMapManager.destroy();
  }
  this._environmentMapManager = undefined;

  if (!this._imageryLayers.isDestroyed()) {
    this.imageryLayers.layerAdded.removeEventListener(
      this._imageryLayersListener,
    );
    this.imageryLayers.layerRemoved.removeEventListener(
      this._imageryLayersListener,
    );
    this.imageryLayers.layerMoved.removeEventListener(
      this._imageryLayersListener,
    );
    this.imageryLayers.layerShownOrHidden.removeEventListener(
      this._imageryLayersListener,
    );
    this._imageryLayers.destroy();
  }
  this._imageryLayers = undefined;

  return destroyObject(this);
};

Cesium3DTileset.supportedExtensions = {
  "3DTILES_metadata": true,
  "3DTILES_implicit_tiling": true,
  "3DTILES_content_gltf": true,
  "3DTILES_content_gltf_vector": true,
  "3DTILES_multiple_contents": true,
  "3DTILES_bounding_volume_S2": true,
  "3DTILES_batch_table_hierarchy": true,
  "3DTILES_draco_point_compression": true,
  MAXAR_content_geojson: true,
};

/**
 * 检查特定扩展是否由 Cesium3DTileset 支持。如果
 * 该扩展未被 Cesium3DTileset 支持，则抛出 RuntimeError。
 *
 * @param {object} extensionsRequired 我们想要检查的扩展
 *
 * @private
 */
Cesium3DTileset.checkSupportedExtensions = function (extensionsRequired) {
  for (let i = 0; i < extensionsRequired.length; i++) {
    if (!Cesium3DTileset.supportedExtensions[extensionsRequired[i]]) {
      throw new RuntimeError(
        `Unsupported 3D Tiles Extension: ${extensionsRequired[i]}`,
      );
    }
  }
};

Cesium3DTileset.supportedGltfExtensions = {
  "3DTILES_tileset": true,
  "3DTILES_implicit_tiling": true,
  EXT_geospatial_crs: true,
  EXT_geospatial_crs_wkid: true,
};

/**
 * 检查特定扩展是否由 Cesium3DTileset.fromGltf 支持。如果
 * 该扩展未被 Cesium3DTileset.fromGltf 支持，则抛出 RuntimeError。
 *
 * @param {object} extensionsRequired 我们想要检查的扩展
 *
 * @private
 */
Cesium3DTileset.checkSupportedGltfExtensions = function (extensionsRequired) {
  for (let i = 0; i < extensionsRequired.length; i++) {
    if (!Cesium3DTileset.supportedGltfExtensions[extensionsRequired[i]]) {
      throw new RuntimeError(
        `Unsupported 3D Tiles GLTF Extension: ${extensionsRequired[i]}`,
      );
    }
  }
};

const scratchGetHeightRay = new Ray();
const scratchIntersection = new Cartesian3();
const scratchGetHeightCartographic = new Cartographic();

/**
 * 获取给定地理坐标下加载表面的高度。此函数仅考虑已加载瓦片的网格，不一定代表影像图层中最详细的瓦片。当采样点云时，此函数总是返回 undefined。
 *
 * @param {Cartographic} cartographic 用于计算高度的地理坐标。
 * @param {Scene} scene 进行可视化的场景。
 * @returns {number|undefined} The 该地理坐标的高度，或如果无法找到则返回 undefined。
 *
 * @example
 * const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(124624234);
 * scene.primitives.add(tileset);
 *
 * const height = tileset.getHeight(scene.camera.positionCartographic, scene);
 */
Cesium3DTileset.prototype.getHeight = function (cartographic, scene) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("cartographic", cartographic);
  Check.typeOf.object("scene", scene);
  //>>includeEnd('debug');

  let ellipsoid = scene.ellipsoid;
  if (!defined(ellipsoid)) {
    ellipsoid = Ellipsoid.WGS84;
  }

  const ray = scratchGetHeightRay;
  const position = ellipsoid.cartographicToCartesian(
    cartographic,
    ray.direction,
  );
  Cartesian3.normalize(ray.direction, ray.direction);

  ray.direction = Cartesian3.normalize(position, ray.direction);
  ray.direction = Cartesian3.negate(position, ray.direction);
  ray.origin = Cartesian3.multiplyByScalar(
    ray.direction,
    -2 * ellipsoid.maximumRadius,
    ray.origin,
  );

  const intersection = this.pick(ray, scene.frameState, scratchIntersection);
  if (!defined(intersection)) {
    return;
  }

  return ellipsoid.cartesianToCartographic(
    intersection,
    scratchGetHeightCartographic,
  )?.height;
};

/**
 * 在渲染包含给定地理坐标的新瓦片时调用回调。唯一参数
 * 是瓦片上的地理坐标位置。
 *
 * @private
 *
 * @param {Scene} scene 进行可视化的场景。
 * @param {Cartographic} cartographic 地理坐标位置。
 * @param {Function} callback 新瓦片加载时调用的函数。
 * @param {Ellipsoid} [ellipsoid=Ellipsoid.WGS84] 使用的椭球体。
 * @returns {Function} The 从四叉树中移除此回调的函数。
 */
Cesium3DTileset.prototype.updateHeight = function (
  cartographic,
  callback,
  ellipsoid,
) {
  ellipsoid = ellipsoid ?? Ellipsoid.WGS84;

  const object = {
    positionCartographic: cartographic,
    ellipsoid: ellipsoid,
    callback: callback,
    invoked: false,
  };

  const removeCallback = () => {
    const addedCallbacks = this._addHeightCallbacks;
    const length = addedCallbacks.length;
    for (let i = 0; i < length; ++i) {
      if (addedCallbacks[i] === object) {
        addedCallbacks.splice(i, 1);
        break;
      }
    }

    if (object.callback) {
      object.callback = undefined;
    }
  };

  this._addHeightCallbacks.push(object);
  return removeCallback;
};

const scratchSphereIntersection = new Interval();
const scratchPickIntersection = new Cartesian3();

/**
 * 查找光线与已渲染的 tileset 表面之间的交点。光线必须以世界坐标形式给出。
 *
 * @param {Ray} ray 用于检测相交的光线。
 * @param {FrameState} frameState 帧状态。
 * @param {Cartesian3|undefined} [result] 交点，或如果未找到则返回 <code>undefined</code>。
 * @returns {Cartesian3|undefined} The 交点，或如果未找到则返回 <code>undefined</code>。
 *
 * @private
 */
Cesium3DTileset.prototype.pick = function (ray, frameState, result) {
  if (!frameState.context.webgl2 && !this._enablePick) {
    return;
  }

  const selectedTiles = this._selectedTiles;
  const selectedLength = selectedTiles.length;
  const candidates = [];

  for (let i = 0; i < selectedLength; ++i) {
    const tile = selectedTiles[i];
    const boundsIntersection = IntersectionTests.raySphere(
      ray,
      tile.contentBoundingVolume.boundingSphere,
      scratchSphereIntersection,
    );
    if (!defined(boundsIntersection) || !defined(tile.content)) {
      continue;
    }

    candidates.push(tile);
  }

  const length = candidates.length;
  candidates.sort((a, b) => {
    const aDist = BoundingSphere.distanceSquaredTo(
      a.contentBoundingVolume.boundingSphere,
      ray.origin,
    );
    const bDist = BoundingSphere.distanceSquaredTo(
      b.contentBoundingVolume.boundingSphere,
      ray.origin,
    );

    return aDist - bDist;
  });

  let intersection;
  for (let i = 0; i < length; ++i) {
    const tile = candidates[i];
    const candidate = tile.content.pick(
      ray,
      frameState,
      scratchPickIntersection,
    );

    if (defined(candidate)) {
      intersection = Cartesian3.clone(candidate, result);
      return intersection;
    }
  }
};

/**
 * 如果此 tileset 使用了给定的 glTF 扩展，则返回 true。
 * <br/><br/>
 * 依赖 <code>3DTILES_content_gltf</code> 扩展，并将返回
 * 如果该扩展未被使用，则返回 false。
 *
 * @param {string} gltfExtensionName 需检查的 glTF 扩展名称。
 * @returns {boolean} <code>true</code> 如果该 tileset 使用了该 glTF 扩展，则返回 true；否则返回 <code>false</code>。
 *
 * @private
 */
Cesium3DTileset.prototype.isGltfExtensionUsed = function (gltfExtensionName) {
  if (this.hasExtension("3DTILES_content_gltf")) {
    if (!defined(this.extensions)) {
      return false;
    }
    const extensionsUsed =
      this.extensions["3DTILES_content_gltf"]?.extensionsUsed;

    if (!defined(extensionsUsed)) {
      return false;
    }

    return extensionsUsed.indexOf(gltfExtensionName) > -1;
  }

  return false;
};

/**
 * 如果给定的 glTF 扩展被使用且由该 tileset 需要，则返回 true。
 * <br/><br/>
 * 依赖 <code>3DTILES_content_gltf</code> 扩展，并将返回结果如下：
 * 如果该扩展未使用，则返回 <code>false</code>。
 *
 * @param {string} gltfExtensionName 需检查的 glTF 扩展名称。
 * @returns {boolean} <code>true</code> 如果该 tileset 需要该 glTF 扩展，则返回 true；否则返回 <code>false</code>。
 *
 * @private
 */
Cesium3DTileset.prototype.isGltfExtensionRequired = function (
  gltfExtensionName,
) {
  if (this.isGltfExtensionUsed(gltfExtensionName)) {
    const extensionsRequired =
      this.extensions["3DTILES_content_gltf"].extensionsRequired;

    if (!defined(extensionsRequired)) {
      return false;
    }

    return extensionsRequired.indexOf(gltfExtensionName) > -1;
  }

  return false;
};

/**
 * 优化选项。当 {@link Cesium3DTileset#foveatedScreenSpaceError} 为 true 时，作为回调使用，用于控制超出聚焦锥体的 tiles 的屏幕空间误差调整程度。
 * 在 {@link Cesium3DTileset#foveatedMinimumScreenSpaceErrorRelaxation} 和 {@link Cesium3DTileset#maximumScreenSpaceError} 之间插值。
 *
 * @callback Cesium3DTileset.foveatedInterpolationCallback
 * @default Math.lerp
 *
 * @param {number} p 插值的起始值。
 * @param {number} q 插值的结束值。
 * @param {number} time 插值时间通常在 <code>[0.0, 1.0]</code> 范围内。
 * @returns {number} The 插值后的数值。
 */
export default Cesium3DTileset;