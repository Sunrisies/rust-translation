import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Check,
  Color,
  DeveloperError,
  DistanceDisplayCondition,
  Ellipsoid,
  Event,
  Frozen,
  Matrix3,
  Matrix4,
  Rectangle,
  RuntimeError,
  defined,
  destroyObject,
  oneTimeWarning,
} from "@cesium/core";
import Credit from "../../Core/Credit.js";
import Resource from "../../Core/Resource.js";
import Pass from "../../Renderer/Pass.js";
import ClippingPlaneCollection from "../ClippingPlaneCollection.js";
import ClippingPolygonCollection from "../ClippingPolygonCollection.js";
import DynamicEnvironmentMapManager from "../DynamicEnvironmentMapManager.js";
import ColorBlendMode from "../ColorBlendMode.js";
import EdgeDisplayMode from "../EdgeDisplayMode.js";
import GltfLoader from "../GltfLoader.js";
import HeightReference, {
  isHeightReferenceRelative,
} from "../HeightReference.js";
import ImageBasedLighting from "../ImageBasedLighting.js";
import PointCloudShading from "../PointCloudShading.js";
import SceneMode from "../SceneMode.js";
import SceneTransforms from "../SceneTransforms.js";
import ShadowMode from "../ShadowMode.js";
import SplitDirection from "../SplitDirection.js";
import B3dmLoader from "./B3dmLoader.js";
import GeoJsonLoader from "./GeoJsonLoader.js";
import I3dmLoader from "./I3dmLoader.js";
import ModelAnimationCollection from "./ModelAnimationCollection.js";
import ModelFeatureTable from "./ModelFeatureTable.js";
import ModelSceneGraph from "./ModelSceneGraph.js";
import ModelStatistics from "./ModelStatistics.js";
import ModelType from "./ModelType.js";
import ModelUtility from "./ModelUtility.js";
import PntsLoader from "./PntsLoader.js";
import StyleCommandsNeeded from "./StyleCommandsNeeded.js";
import pickModel from "./pickModel.js";
import ModelImagery from "./ModelImagery.js";

/** @import { VectorTileData } from "../../Core/VectorPipeline.js"; */

/**
 * <div class="notice">
 * 要构建模型，请调用 {@link Model.fromGltfAsync}。不要直接调用构造函数。
 * </div>
 * 基于 glTF 的 3D 模型，glTF 是 WebGL、OpenGL ES 和 OpenGL 的运行时资产格式。
 * <p>
 * Cesium 支持以下扩展的 glTF 资产：
 * <ul>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/AGI_articulations/README.md|AGI_articulations}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/blob/master/extensions/1.0/Vendor/CESIUM RTC/README.md|CESIUM RTC}
 *  </li>
 *  <li>
 * {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_instance_features|EXT_instance_features}
 *  </li>
 *  <li>
 * {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_mesh_features|EXT_mesh_features}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing|EXT_mesh_gpu_instancing} *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_restart|EXT_mesh_primitive_restart}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility}
 *  (edges are hidden by default; set {@link EdgeDisplayMode} via
 *  {@link Model#edgeDisplayMode} or {@link Cesium3DTileset#edgeDisplayMode} to display them)
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression|EXT_meshopt_compression}
 *  </li>
 *  <li>
 * {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_texture_webp|EXT_texture_webp}
 *  </li>
 *  <li>
 * {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-2.0/extensions/2.1/Vendor/EXT_voxels|EXT_voxels} (实验性)
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_draco_mesh_compression/README.md|KHR_draco_mesh_compression}
 *  </li>
 *  <li>
 * {@link https://github.com/CesiumGS/glTF/tree/draft-splat-spz/extensions/2.0/Khronos/KHR_gaussian_splatting|KHR_gaussian_splatting} (实验性)
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Archived/KHR_techniques_webgl/README.md|KHR_techniques_webgl}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_anisotropy|KHR_materials_anisotropy}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_clearcoat|KHR_materials_clearcoat}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/blob/main/extensions/1.0/Khronos/KHR_materials_common/README.md|KHR_materials_common}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_materials_pbrSpecularGlossiness|KHR_materials_pbrSpecularGlossiness}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_specular|KHR_materials_specular}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit/README.md|KHR_materials_unlit}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/pull/2569|KHR_mesh_primitive_restart}
 * （需要 WebGL 2 上下文；WebGL 1 下的行为未定义）
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization|KHR_mesh_quantization}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_meshopt_compression|KHR_meshopt_compression}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_texture_basisu|KHR_texture_basisu}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_texture_transform/README.md|KHR_texture_transform}
 *  </li>
 *  <li>
 * {@link https://github.com/KhronosGroup/glTF/blob/main/extensions/1.0/Vendor/WEB3D_quantized_attributes/README.md|WEB3D_quantized_attributes}
 *  </li>
 *  <li>
 *  {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local (experimental)}
 *  </li>
 * </ul>
 * </p>
 * <p>
 * 注意：对于使用 KHR_texture_basisu 扩展的压缩纹理模型，我们建议在两个维度上采用 2 的幂纹理格式
 * for maximum compatibility. This is because some samplers require power of 2 textures ({@link https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL|Using textures in WebGL})
 * and KHR_texture_basisu requires multiple of 4 dimensions ({@link https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_texture_basisu/README.md#additional-requirements|KHR_texture_basisu additional requirements}).
 * </p>
 *
 * @alias Model
 * @internalConstructor
 *
 * @privateParam {object} options 具有以下属性的对象：
 * @privateParam {ResourceLoader} options.loader 用于加载该模型资源的加载器。
 * @privateParam {ModelType} options.type 该模型的类型，用于在内部区分独立的 glTF 文件和 3D Tiles。
 * @privateParam {Resource} options.resource 指向 3D 模型的资源。
 * @privateParam {boolean} [options.show=true] 是否渲染该模型。
 * @privateParam {Matrix4} [options.modelMatrix=Matrix4.IDENTITY]  将模型从模型坐标转换为世界坐标的 4x4 变换矩阵。
 * @privateParam {number} [options.scale=1.0] 应用于该模型的统一比例。
 * @privateParam {boolean} [options.enableVerticalExaggeration=true] 如果为 <code>true</code>，当 {@link Scene.verticalExaggeration} 的值不为 <code>1.0</code> 时，模型将在椭球法线方向上被放大。
 * @privateParam {number} [options.minimumPixelSize=0.0] 无论缩放如何，模型的最小像素尺寸近似值。
 * @privateParam {number} [options.maximumScale] 模型的最大比例大小。是 minimumPixelSize 的上限。
 * @privateParam {object} [options.id] 当使用 {@link Scene#pick} 选中模型时返回的自定义对象。
 * @privateParam {boolean} [options.allowPicking=true] 如果为 <code>true</code>，每个基本体都可以通过 {@link Scene#pick} 被选中。
 * @privateParam {boolean} [options.clampAnimations=true] 决定模型的动画是否在未指定关键帧的帧中保持姿态。
 * @privateParam {ShadowMode} [options.shadows=ShadowMode.ENABLED] 决定模型是否从光源接收或投射阴影。
 * @privateParam {boolean} [options.debugShowBoundingVolume=false] 仅用于调试。在模型的每个绘制指令中绘制边界球体。
 * @privateParam {boolean} [options.enableDebugWireframe=false] 仅用于调试。在 WebGL1 中，必须设置为 true 才能使用 debugWireframe。在模型加载后无法设置此值。
 * @privateParam {boolean} [options.debugWireframe=false] 仅用于调试。以线框形式绘制模型。只有在 enableDebugWireframe 设置为 true 且使用 WebGL1 时才能生效。
 * @privateParam {boolean} [options.cull=true]  是否使用视锥体/地平线剔除来剔除模型。如果模型是 3D Tiles 图集的一部分，此属性将始终为 false，因为使用 3D Tiles 剔除系统。
 * @privateParam {boolean} [options.opaquePass=Pass.OPAQUE] 在 {@link DrawCommand} 中用于绘制模型不透明部分的通道。
 * @privateParam {CustomShader} [options.customShader] 自定义着色器。这将向顶点和片段着色器添加用户定义的 GLSL 代码。使用自定义着色器与 {@link Cesium3DTileStyle} 结合使用可能导致未定义行为。
 * @privateParam {Cesium3DTileContent} [options.content] 该模型所属的图块内容。如果模型未作为图集的一部分加载，此属性将未定义。
 * @privateParam {HeightReference} [options.heightReference=HeightReference.NONE] 决定模型相对于地形的绘制方式。
 * @privateParam {Scene} [options.scene] 对于使用高度参考属性的模型，必须传入此值。
 * @privateParam {DistanceDisplayCondition} [options.distanceDisplayCondition] 指定模型在距相机多远的距离下显示的条件。
 * @privateParam {Color} [options.color] 与模型渲染颜色混合的颜色。
 * @privateParam {ColorBlendMode} [options.colorBlendMode=ColorBlendMode.HIGHLIGHT] 定义颜色与模型之间的混合方式。
 * @privateParam {number} [options.colorBlendAmount=0.5] 当 <code>colorBlendMode</code> 为 <code>MIX</code> 时，用于确定颜色强度的数值。0.0 表示模型的渲染颜色，1.0 表示纯色，中间值则表示两者的混合。
 * @privateParam {EdgeDisplayMode} [options.edgeDisplayMode=EdgeDisplayMode.SURFACES_ONLY] 控制来自 {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility} 扩展的边缘如何相对于表面几何结构进行渲染。
 * @privateParam {Color} [options.silhouetteColor=Color.RED] 轮廓颜色。如果启用了超过 256 个模型的轮廓，重叠模型可能会出现轻微伪影。
 * @privateParam {number} [options.silhouetteSize=0.0] 轮廓在像素中的大小。
 * @privateParam {boolean} [options.enableShowOutline=true] 是否启用使用 {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展的模型轮廓。可以设置为 false，以避免在加载时对几何图形进行额外处理。当设置为 false 时，showOutlines 和 outlineColor 选项将被忽略。
 * @privateParam {boolean} [options.showOutline=true] 是否显示使用 {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展的模型轮廓。当设置为 true 时，将显示轮廓；当设置为 false 时，不显示轮廓。
 * @privateParam {Color} [options.outlineColor=Color.BLACK] 渲染轮廓时使用的颜色。
 * @privateParam {ClippingPlaneCollection} [options.clippingPlanes] 用于选择性地禁用模型渲染的 {@link ClippingPlaneCollection}。
 * @privateParam {ClippingPolygonCollection} [options.clippingPolygons] 用于选择性地禁用模型渲染的 {@link ClippingPolygonCollection}。
 * @privateParam {Cartesian3} [options.lightColor] 对模型进行着色时的光颜色。当为 <code>undefined</code> 时，将使用场景的光色。
 * @privateParam {ImageBasedLighting} [options.imageBasedLighting] 用于管理该模型基于图像的照明效果的属性。
 * @privateParam {DynamicEnvironmentMapManager.ConstructorOptions} [options.environmentMapOptions] 用于管理该模型动态环境地图的属性。会影响照明效果。
 * @privateParam {boolean} [options.backFaceCulling=true] 是否剔除背向方向的几何图形。当设置为 true 时，背面剔除由材料的 doubleSided 属性决定；当设置为 false 时，背面剔除被禁用。如果模型的颜色是半透明的，则不会剔除背面。
 * @privateParam {Credit|string} [options.credit] 显示在画布上的数据来源说明文字。
 * @privateParam {boolean} [options.showCreditsOnScreen=false] 是否在屏幕上显示该模型的说明文字。
 * @privateParam {SplitDirection} [options.splitDirection=SplitDirection.NONE] 应用于该模型的 {@link SplitDirection} 分割方式。
 * @privateParam {boolean} [options.projectTo2D=false] 是否准确将模型位置投影到 2D 空间。如果设置为 true，模型将被准确投影到 2D 空间，但会消耗更多内存。如果设置为 false，模型将消耗较少内存，但仍以 2D / CV 模式渲染，其位置可能不准确。此设置会禁用 minimumPixelSize，并防止后续修改模型矩阵。此外，在模型加载后无法再次设置此值。
 * @privateParam {boolean} [options.enablePick=false] 在未使用 WebGL 2 或更高版本时，是否允许使用 <code>pick</code> 进行点选择。如果使用了 WebGL 2 或更高版本，此选项将被忽略。如果使用 WebGL 1 且为 true，<code>pick</code> 操作将正常工作，但会消耗更多内存。如果使用 WebGL 1 且为 false，模型将占用较少内存，但 <code>pick</code> 将始终返回 <code>undefined</code>。此设置在模型加载后无法更改。
 * @privateParam {string|number} [options.featureIdLabel="featureId_0"] 用于选择和样式化的特征 ID 标签。对于 EXT_mesh_features，这是特征 ID 的标签属性；如果未指定，则显示为 "featureId_N"（其中 N 是 featureIds 数组中的索引）。EXT_feature_metadata 没有标签字段，因此此类特征 ID 设置始终被标记为 "featureId_N"，其中 N 是所有特征 ID 列表中的索引，特征 ID 属性位于特征 ID 纹理之前。如果 featureIdLabel 是一个整数 N，它将自动转换为字符串 "featureId_N"。如果存在 per-primitive 和 per-instance 特征 ID，则实例特征 ID 具有优先权。
 * @privateParam {string|number} [options.instanceFeatureIdLabel="instanceFeatureId_0"] 用于选择和样式化的实例特征 ID 标签。如果 instanceFeatureIdLabel 被设置为一个整数 N，它将自动转换为字符串 "instanceFeatureId_N"。如果存在 per-primitive 和 per-instance 特征 ID，则实例特征 ID 具有优先权。
 * @privateParam {object} [options.pointCloudShading] 用于构建 {@link PointCloudShading} 对象的选项，以根据几何误差和光照控制点衰减。
 * @privateParam {ClassificationType} [options.classificationType] 决定此模型是否对地形、3D Tiles 或两者进行分类。此设置在模型加载后无法更改。
 *
 *
 * @see Model.fromGltfAsync
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=3d-models|Cesium Sandcastle Models Demo}
 */
function Model(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.loader", options.loader);
  Check.typeOf.object("options.resource", options.resource);
  //>>includeEnd('debug');

  /**
   * 用于加载此模型资源的加载器。
   *
   * @type {ResourceLoader}
   * @private
   */
  this._loader = options.loader;
  this._resource = options.resource;

  /**
   * 此模型的类型，用于区分单个 glTF 文件和 3D Tiles。
   * 内部。
   *
   * @type {ModelType}
   * @readonly
   *
   * @private
   */
  this.type = options.type ?? ModelType.GLTF;

  /**
   * 将模型从模型坐标转换为世界坐标的 4x4 变换矩阵。
   * 当此矩阵为单位矩阵时，模型将在世界坐标下绘制，即地球的 Cartesian WGS84 坐标。
   * 可以通过提供不同的变换矩阵来使用本地参考框架，例如 {@link Transforms.eastNorthUpToFixedFrame} 返回的矩阵。
   * by {@link Transforms.eastNorthUpToFixedFrame}.
   *
   * @type {Matrix4}

   * @default {@link Matrix4.IDENTITY}
   *
   * @example
   * const origin = Cesium.Cartesian3.fromDegrees(-95.0, 40.0, 200000.0);
   * m.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
   */
  this.modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);
  this._modelMatrix = Matrix4.clone(this.modelMatrix);
  this._scale = options.scale ?? 1.0;

  this._minimumPixelSize = options.minimumPixelSize ?? 0.0;

  this._maximumScale = options.maximumScale;

  /**
   * 经过最大比例参数限制后的比例值。
   * 用于调整边界球体，避免重复计算。
   *
   * @type {number}
   * @private
   */
  this._clampedScale = defined(this._maximumScale)
    ? Math.min(this._scale, this._maximumScale)
    : this._scale;

  this._computedScale = this._clampedScale;

  /**
   * 是否应调用 updateModelMatrix 方法。
   * 如果模型矩阵、比例、最小像素大小或最大比例中的任何一项存在问题，则为真。
   *
   * @type {number}
   * @private
   */
  this._updateModelMatrix = false;

  /**
   * 如果定义此参数，该矩阵将用于转换其他属性，例如
   * 裁剪平面和基于影像的照明，而不是使用 modelMatrix。这
   * 使得当模型属于瓦片集时，这些属性能够相对于一个共同参考点（如根节点）进行变换。
   * 场景中的 VectorProvider 为模型的边界区域烘焙的向量查找数据，用于将向量数据覆盖在模型表面。
   *
   * @type {Matrix4}
   * @private
   */
  this.referenceMatrix = undefined;
  this._iblReferenceFrameMatrix = Matrix3.clone(Matrix3.IDENTITY); // Derived from reference matrix and the current view matrix
  this._clippingPlanesMatrix = Matrix4.clone(Matrix4.IDENTITY); // Derived from the reference matrix and the clipping planes' own model matrix

  this._resourcesLoaded = false;
  this._drawCommandsBuilt = false;

  this._ready = false;
  this._customShader = options.customShader;
  this._content = options.content;

  this._texturesLoaded = false;
  this._defaultTexture = undefined;

  this._activeAnimations = new ModelAnimationCollection(this);
  this._clampAnimations = options.clampAnimations ?? true;

  // This flag is true when the Cesium API, not a glTF animation, changes
  // the transform of a node in the model.
  this._userAnimationDirty = false;

  this._id = options.id;
  this._idDirty = false;

  this._color = Color.clone(options.color);
  this._colorBlendMode = options.colorBlendMode ?? ColorBlendMode.HIGHLIGHT;
  this._colorBlendAmount = options.colorBlendAmount ?? 0.5;

  const silhouetteColor = options.silhouetteColor ?? Color.RED;
  this._silhouetteColor = Color.clone(silhouetteColor);
  this._silhouetteSize = options.silhouetteSize ?? 0.0;
  this._silhouetteDirty = false;

  // If silhouettes are used for the model, this will be set to the number
  // of the stencil buffer used for rendering the silhouette. This is set
  // by ModelSilhouettePipelineStage, not by Model itself.
  this._silhouetteId = undefined;

  this._cull = options.cull ?? true;
  this._opaquePass = options.opaquePass ?? Pass.OPAQUE;
  this._allowPicking = options.allowPicking ?? true;
  this._show = options.show ?? true;

  this._style = undefined;
  this._styleDirty = false;
  this._styleCommandsNeeded = undefined;

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

  this._featureTables = [];
  this._featureTableId = undefined;
  this._featureTableIdDirty = true;

  // Keeps track of resources that need to be destroyed when the draw commands are reset.
  this._pipelineResources = [];

  // Keeps track of resources that need to be destroyed when the Model is destroyed.
  this._modelResources = [];

  // Keeps track of the pick IDs for this model. These are stored and destroyed in the
  // pipeline resources array; the purpose of this array is to separate them from other
  // resources and update their ID objects when necessary.
  this._pickIds = [];

  // The model's bounding sphere and its initial radius are computed
  // in ModelSceneGraph.
  this._boundingSphere = new BoundingSphere();
  this._initialRadius = undefined;

  this._heightReference = options.heightReference ?? HeightReference.NONE;
  this._heightDirty = this._heightReference !== HeightReference.NONE;
  this._removeUpdateHeightCallback = undefined;

  this._enableVerticalExaggeration = options.enableVerticalExaggeration ?? true;
  this._hasVerticalExaggeration = false;

  this._clampedModelMatrix = undefined; // For use with height reference

  const scene = options.scene;
  if (defined(scene) && defined(scene.terrainProviderChanged)) {
    this._terrainProviderChangedCallback =
      scene.terrainProviderChanged.addEventListener(() => {
        this._heightDirty = true;
      });
  }
  this._scene = scene;

  this._distanceDisplayCondition = options.distanceDisplayCondition;

  const pointCloudShading = new PointCloudShading(options.pointCloudShading);
  this._pointCloudShading = pointCloudShading;
  this._attenuation = pointCloudShading.attenuation;
  this._pointCloudBackFaceCulling = pointCloudShading.backFaceCulling;

  // If the given clipping planes don't have an owner, make this model its owner.
  // Otherwise, the clipping planes are passed down from a tileset.
  const clippingPlanes = options.clippingPlanes;
  if (defined(clippingPlanes) && clippingPlanes.owner === undefined) {
    ClippingPlaneCollection.setOwner(clippingPlanes, this, "_clippingPlanes");
  } else {
    this._clippingPlanes = clippingPlanes;
  }
  this._clippingPlanesState = 0; // If this value changes, the shaders need to be regenerated.

  // If the given clipping polygons don't have an owner, make this model its owner.
  // Otherwise, the clipping polygons are passed down from a tileset.
  const clippingPolygons = options.clippingPolygons;
  if (defined(clippingPolygons) && clippingPolygons.owner === undefined) {
    ClippingPolygonCollection.setOwner(
      clippingPolygons,
      this,
      "_clippingPolygons",
    );
  } else {
    this._clippingPolygons = clippingPolygons;
  }
  this._clippingPolygonsState = 0; // If this value changes, the shaders need to be regenerated.
  this._clippingPolygonsNeedRebake = false; // If true, the clipping textures are rebaked.
  this._removeClippingPolygonAdded = undefined;
  this._removeClippingPolygonRemoved = undefined;
  updateClippingPolygonListeners(this);

  /**
   * 是否使用
   * {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展来显示模型的轮廓。
   * @type {VectorTileData|undefined}
   * @ignore
   */
  this._vectorData = undefined;

  this._vectorLookupFlags = 0; // If this value changes, the shaders need to be regenerated.

  /*
   * Textures and other intermediate data used in polygon clipping workflows.
   * Clipping polygons build on top of the vector tile data system (both rely on the same rendering technique), thus the type.
   * @type {VectorTileData | undefined}
   * @private
   */
  this._clippingPolygonData = undefined;

  this._rectangle = new Rectangle();

  this._modelImagery = new ModelImagery(this);

  this._lightColor = Cartesian3.clone(options.lightColor);

  this._imageBasedLighting = defined(options.imageBasedLighting)
    ? options.imageBasedLighting
    : new ImageBasedLighting();
  this._shouldDestroyImageBasedLighting = !defined(options.imageBasedLighting);

  this._environmentMapManager = undefined;
  const environmentMapManager = new DynamicEnvironmentMapManager(
    options.environmentMapOptions,
  );
  DynamicEnvironmentMapManager.setOwner(
    environmentMapManager,
    this,
    "_environmentMapManager",
  );

  this._backFaceCulling = options.backFaceCulling ?? true;
  this._backFaceCullingDirty = false;

  this._shadows = options.shadows ?? ShadowMode.ENABLED;
  this._shadowsDirty = false;

  this._debugShowBoundingVolumeDirty = false;
  this._debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;

  this._enableDebugWireframe = options.enableDebugWireframe ?? false;
  this._enableShowOutline = options.enableShowOutline ?? true;
  this._debugWireframe = options.debugWireframe ?? false;
  this._edgeDisplayMode =
    options.edgeDisplayMode ?? EdgeDisplayMode.SURFACES_ONLY;
  // Edge geometry is built lazily; see updateEdgeGeometryNeeded.
  this._edgeGeometryNeeded =
    this._edgeDisplayMode !== EdgeDisplayMode.SURFACES_ONLY;
  this._edgeGeometryNeededForSnapping = false;
  this._hasEdgeVisibilityData = undefined;

  // Warning for improper setup of debug wireframe
  if (
    this._debugWireframe === true &&
    this._enableDebugWireframe === false &&
    this.type === ModelType.GLTF
  ) {
    oneTimeWarning(
      "model-debug-wireframe-ignored",
      "enableDebugWireframe must be set to true in Model.fromGltf, otherwise debugWireframe will be ignored.",
    );
  }

  // Credit specified by the user.
  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }

  this._credits = [];
  this._credit = credit;

  // Credits to be added from the Resource (if it is an IonResource)
  this._resourceCredits = [];

  // Credits parsed from the glTF by GltfLoader.
  this._gltfCredits = [];

  this._showCreditsOnScreen = options.showCreditsOnScreen ?? false;
  this._showCreditsOnScreenDirty = true;

  this._splitDirection = options.splitDirection ?? SplitDirection.NONE;

  this._enableShowOutline = options.enableShowOutline ?? true;

  /**
   * 当为 true 时，将显示轮廓；当为 false 时，不显示轮廓。
   * {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} extension.
   * 按名称存储 glTF 中的节点。
   *
   * @type {boolean}
   *
   * @default true
   */
  this.showOutline = options.showOutline ?? true;

  /**
   * 未设置 'name' 属性的 glTF 节点不会包含在此映射中。如果输入中存在重复名称，
   *
   * @type {Color}
   *
   * @default Color.BLACK
   */
  this.outlineColor = options.outlineColor ?? Color.BLACK;

  this._classificationType = options.classificationType;

  this._statistics = new ModelStatistics();

  this._sceneMode = undefined;
  this._projectTo2D = options.projectTo2D ?? false;
  this._enablePick = options.enablePick ?? false;

  this._fogRenderable = undefined;

  this._skipLevelOfDetail = false;
  this._ignoreCommands = options.ignoreCommands ?? false;

  this._errorEvent = new Event();
  this._readyEvent = new Event();
  this._texturesReadyEvent = new Event();

  this._sceneGraph = undefined;

  /**
   * 则此处存储的节点将被视为未指定，因此...
   *
   * 应确保不要有重复的名称...
   * 用于选择包裹模型的基本体。
   * 返回 alpha 状态在不可见、半透明或不透明之间是否发生变化。
   * 当 <code>true</code> 时，该模型已准备好渲染，即外部二进制文件、图像和着色器文件已下载且 WebGL 资源已创建。
   *
   * @private
   * @readonly
   */
  this._nodesByName = new Map();

  /**
   * 当模型遇到异步渲染错误时触发事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   *
   * @private
   */
  this.pickObject = options.pickObject;
}

function handleError(model, error) {
  if (model._errorEvent.numberOfListeners > 0) {
    model._errorEvent.raiseEvent(error);
    return;
  }

  console.log(error);
}

function createModelFeatureTables(model, structuralMetadata) {
  const featureTables = model._featureTables;

  const propertyTables = structuralMetadata.propertyTables;
  const length = propertyTables.length;
  for (let i = 0; i < length; i++) {
    const propertyTable = propertyTables[i];
    const modelFeatureTable = new ModelFeatureTable({
      model: model,
      propertyTable: propertyTable,
    });

    featureTables.push(modelFeatureTable);
  }

  return featureTables;
}

function selectFeatureTableId(components, model) {
  const featureIdLabel = model._featureIdLabel;
  const instanceFeatureIdLabel = model._instanceFeatureIdLabel;

  let i, j;
  let featureIdAttribute;

  let node;
  // Scan the nodes till we find one with instances, get the feature table ID
  // if the feature ID attribute of the user-selected index is present.
  for (i = 0; i < components.nodes.length; i++) {
    node = components.nodes[i];
    if (defined(node.instances)) {
      featureIdAttribute = ModelUtility.getFeatureIdsByLabel(
        node.instances.featureIds,
        instanceFeatureIdLabel,
      );
      if (
        defined(featureIdAttribute) &&
        defined(featureIdAttribute.propertyTableId)
      ) {
        return featureIdAttribute.propertyTableId;
      }
    }
  }

  // Scan the primitives till we find one with textures or attributes, get the feature table ID
  // if the feature ID attribute/texture of the user-selected index is present.
  for (i = 0; i < components.nodes.length; i++) {
    node = components.nodes[i];
    for (j = 0; j < node.primitives.length; j++) {
      const primitive = node.primitives[j];
      const featureIds = ModelUtility.getFeatureIdsByLabel(
        primitive.featureIds,
        featureIdLabel,
      );

      if (defined(featureIds)) {
        return featureIds.propertyTableId;
      }
    }
  }

  // If there's only one feature table, then select it by default. This is
  // to ensure backwards compatibility with the older handling of b3dm models.
  if (model._featureTables.length === 1) {
    return 0;
  }
}

/**
 * 接收 {@link ModelError} 的实例。
 * 当模型加载并准备好渲染时触发事件，即外部资源已下载且 WebGL 资源已创建。事件监听器
 *
 *  @private
 */
function isColorAlphaDirty(currentColor, previousColor) {
  if (!defined(currentColor) && !defined(previousColor)) {
    return false;
  }

  if (defined(currentColor) !== defined(previousColor)) {
    return true;
  }

  const currentAlpha = currentColor.alpha;
  const previousAlpha = previousColor.alpha;
  return (
    Math.floor(currentAlpha) !== Math.floor(previousAlpha) ||
    Math.ceil(currentAlpha) !== Math.ceil(previousAlpha)
  );
}

Object.defineProperties(Model.prototype, {
  /**
   * 接收 {@link Model} 的实例。
   * 如果 {@link Model.incrementallyLoadTextures} 为 true，此事件将在所有纹理加载并准备好渲染之前触发。订阅 {@link Model.texturesReadyEvent} 以在纹理准备就绪时收到通知。
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @default false
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },

  /**
   * Gets an event that is raised when the model encounters an asynchronous rendering error.  By subscribing
   * to the event, you will be notified of the error and can potentially recover from it.  Event listeners
   * are passed an instance of {@link ModelError}.
   * @memberof Model.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * Gets an event that is raised when the model is loaded and ready for rendering, i.e. when the external resources
   * have been downloaded and the WebGL resources are created. Event listeners
   * are passed an instance of the {@link Model}.
   *
   * <p>
   * If {@link Model.incrementallyLoadTextures} is true, this event will be raised before all textures are loaded and ready for rendering. Subscribe to {@link Model.texturesReadyEvent} to be notified when the textures are ready.
   * </p>
   *
   * @memberof Model.prototype
   * @type {Event}
   * @readonly
   */
  readyEvent: {
    get: function () {
      return this._readyEvent;
    },
  },

  /**
   * 返回布尔值，指示纹理是否独立于其他 glTF 资源加载。
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   * @readonly
   * @private
   */
  incrementallyLoadTextures: {
    get: function () {
      return this._loader.incrementallyLoadTextures ?? false;
    },
  },

  /**
   * 获取一个事件，当 {@link Model.incrementallyLoadTextures} 为 true 时触发，表示模型纹理已加载并准备好渲染，即外部资源
   * 已下载且 WebGL 资源已创建。事件监听器
   * 被传递一个 {@link Model} 的实例。
   *
   * @memberof Model.prototype
   * @type {Event}
   * @readonly
   */
  texturesReadyEvent: {
    get: function () {
      return this._texturesReadyEvent;
    },
  },

  /**
   * @private
   */
  loader: {
    get: function () {
      return this._loader;
    },
  },

  /**
   * 获取该模型的估计内存使用统计信息。
   *
   * @memberof Model.prototype
   *
   * @type {ModelStatistics}
   * @readonly
   *
   * @private
   */
  statistics: {
    get: function () {
      return this._statistics;
    },
  },

  /**
   * 当前正在播放的 glTF 动画。
   *
   * @memberof Model.prototype
   *
   * @type {ModelAnimationCollection}
   * @readonly
   */
  activeAnimations: {
    get: function () {
      return this._activeAnimations;
    },
  },

  /**
   * 确定模型的动画是否应在未指定关键帧的帧中保持姿态。
   *
   * @memberof Model.prototype
   * @type {boolean}
   *
   * @default true
   */
  clampAnimations: {
    get: function () {
      return this._clampAnimations;
    },
    set: function (value) {
      this._clampAnimations = value;
    },
  },

  /**
   * 是否使用视锥体/地平线剔除来剔除模型。如果模型是 3D Tiles 瓦片集的一部分，此属性
   * 将始终为 false，因为使用 3D Tiles 剔除系统。
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  cull: {
    get: function () {
      return this._cull;
    },
  },

  /**
   * 在 {@link DrawCommand} 中用于模型不透明部分的绘制通道。
   *
   * @memberof Model.prototype
   *
   * @type {Pass}
   * @readonly
   *
   * @private
   */
  opaquePass: {
    get: function () {
      return this._opaquePass;
    },
  },

  /**
   * 点云着色设置，用于控制点云的衰减和照明。对于 3D Tiles，此设置从
   * {@link Cesium3DTileset} 继承而来。
   * 获取模型的自定义着色器，如果存在的话。使用自定义着色器与 {@link Cesium3DTileStyle} 一起使用
   *
   * @memberof Model.prototype
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
      if (value !== this._pointCloudShading) {
        this.resetDrawCommands();
      }
      this._pointCloudShading = value;
    },
  },

  /**
   * The model's custom shader, if it exists. Using custom shaders with a {@link Cesium3DTileStyle}
   * 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿且可能随 Cesium 标准弃用政策而变更。
   *
   * @memberof Model.prototype
   *
   * @type {CustomShader}
   * @experimental This 此模型的场景图。
   */
  customShader: {
    get: function () {
      return this._customShader;
    },
    set: function (value) {
      if (value !== this._customShader) {
        this.resetDrawCommands();
      }
      this._customShader = value;
    },
  },

  /**
   * 如果模型作为 {@link Cesium3DTileset} 的一部分被加载，则确定该模型所属的瓦片内容。
   *
   * @memberof Model.prototype
   *
   * @type {ModelSceneGraph}
   * @private
   */
  sceneGraph: {
    get: function () {
      return this._sceneGraph;
    },
  },

  /**
   * The tile content this model belongs to, if it is loaded as part of a {@link Cesium3DTileset}.
   *
   * @memberof Model.prototype
   *
   * @type {Cesium3DTileContent}
   * @readonly
   *
   * @private
   */
  content: {
    get: function () {
      return this._content;
    },
  },

  /**
   * 获取或设置距离显示条件，指定在距相机多远的距离下
   * 显示该模型。
   *
   * @memberof Model.prototype
   *
   * @type {HeightReference}
   * @default {HeightReference.NONE}
   *
   */
  heightReference: {
    get: function () {
      return this._heightReference;
    },
    set: function (value) {
      if (value !== this._heightReference) {
        this._heightDirty = true;
      }
      this._heightReference = value;
    },
  },

  /**
   * 获取或设置距离显示条件，指定在距相机多远的距离下
   * 显示该模型。
   *
   * @memberof Model.prototype
   *
   * @type {DistanceDisplayCondition}
   *
   * @default undefined
   *
   */
  distanceDisplayCondition: {
    get: function () {
      return this._distanceDisplayCondition;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value.far <= value.near) {
        throw new DeveloperError("far must be greater than near");
      }
      //>>includeEnd('debug');
      this._distanceDisplayCondition = DistanceDisplayCondition.clone(
        value,
        this._distanceDisplayCondition,
      );
    },
  },

  /**
   * 来自 EXT_structural_metadata 扩展的结构化元数据。
   *
   * @memberof Model.prototype
   *
   * @type {StructuralMetadata}
   * @readonly
   *
   * @private
   */
  structuralMetadata: {
    get: function () {
      return this._sceneGraph.components.structuralMetadata;
    },
  },

  /**
   * 用于此模型中拾取和样式化的特征表 ID。
   *
   * @memberof Model.prototype
   *
   * @type {number}
   *
   * @private
   */
  featureTableId: {
    get: function () {
      return this._featureTableId;
    },
    set: function (value) {
      this._featureTableId = value;
    },
  },

  /**
   * 此模型的特征表。
   *
   * @memberof Model.prototype
   *
   * @type {Array}
   * @readonly
   *
   * @private
   */
  featureTables: {
    get: function () {
      return this._featureTables;
    },
    set: function (value) {
      this._featureTables = value;
    },
  },

  /**
   * 用户定义的对象，当模型被拾取时返回。
   *
   * @memberof Model.prototype
   *
   * @type {object}
   *
   * @default undefined
   *
   * @see Scene#pick
   */
  id: {
    get: function () {
      return this._id;
    },
    set: function (value) {
      if (value !== this._id) {
        this._idDirty = true;
      }

      this._id = value;
    },
  },

  /**
   * 当 <code>true</code> 时，每个基本体都可以通过 {@link Scene#pick} 拾取。当 <code>false</code> 时，节省 GPU 内存。
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  allowPicking: {
    get: function () {
      return this._allowPicking;
    },
  },

  /**
   * 应用于模型中特征的样式。如果同时应用了 {@link CustomShader}，则无法应用此样式。
   *
   * @memberof Model.prototype
   *
   * @type {Cesium3DTileStyle}
   */
  style: {
    get: function () {
      return this._style;
    },
    set: function (value) {
      this._style = value;
      this._styleDirty = true;
    },
  },

  /**
   * 与模型渲染颜色混合的颜色。
   *
   * @memberof Model.prototype
   *
   * @type {Color}
   *
   * @default undefined
   */
  color: {
    get: function () {
      return this._color;
    },
    set: function (value) {
      if (isColorAlphaDirty(value, this._color)) {
        this.resetDrawCommands();
      }
      this._color = Color.clone(value, this._color);
    },
  },

  /**
   * 定义颜色与模型的混合方式。
   *
   * @memberof Model.prototype
   *
   * @type {Cesium3DTileColorBlendMode|ColorBlendMode}
   *
   * @default ColorBlendMode.HIGHLIGHT
   */
  colorBlendMode: {
    get: function () {
      return this._colorBlendMode;
    },
    set: function (value) {
      this._colorBlendMode = value;
    },
  },

  /**
   * 在 <code>colorBlendMode</code> 为 <code>MIX</code> 时用于确定颜色强度的数值。0.0 值表示模型的渲染颜色，1.0 值表示纯色，中间值则表示两者的混合。
   *
   * @memberof Model.prototype
   *
   * @type {number}
   *
   * @default 0.5
   */
  colorBlendAmount: {
    get: function () {
      return this._colorBlendAmount;
    },
    set: function (value) {
      this._colorBlendAmount = value;
    },
  },

  /**
   * 轮廓颜色。
   *
   * @memberof Model.prototype
   *
   * @type {Color}
   *
   * @default Color.RED
   */
  silhouetteColor: {
    get: function () {
      return this._silhouetteColor;
    },
    set: function (value) {
      if (!Color.equals(value, this._silhouetteColor)) {
        const alphaDirty = isColorAlphaDirty(value, this._silhouetteColor);
        this._silhouetteDirty = this._silhouetteDirty || alphaDirty;
      }

      this._silhouetteColor = Color.clone(value, this._silhouetteColor);
    },
  },

  /**
   * 轮廓在像素上的大小。
   *
   * @memberof Model.prototype
   *
   * @type {number}
   *
   * @default 0.0
   */
  silhouetteSize: {
    get: function () {
      return this._silhouetteSize;
    },
    set: function (value) {
      if (value !== this._silhouetteSize) {
        const currentSize = this._silhouetteSize;
        const sizeDirty =
          (value > 0.0 && currentSize === 0.0) ||
          (value === 0.0 && currentSize > 0.0);
        this._silhouetteDirty = this._silhouetteDirty || sizeDirty;

        // Back-face culling needs to be updated in case the silhouette size
        // is greater than zero.
        this._backFaceCullingDirty = this._backFaceCullingDirty || sizeDirty;
      }

      this._silhouetteSize = value;
    },
  },

  /**
   * 获取模型在世界空间中的边界球体。此功能未考虑
   * glTF 动画、皮肤或变形目标。它也不考虑
   * {@link Model#minimumPixelSize}。
   *
   * @memberof Model.prototype
   *
   * @type {BoundingSphere}
   * @readonly
   */
  boundingSphere: {
    get: function () {
      //>>includeStart('debug', pragmas.debug);
      if (!this._ready) {
        throw new DeveloperError(
          "The model is not loaded. Use Model.readyEvent or wait for Model.ready to be true.",
        );
      }
      //>>includeEnd('debug');

      const modelMatrix = defined(this._clampedModelMatrix)
        ? this._clampedModelMatrix
        : this.modelMatrix;
      updateBoundingSphere(this, modelMatrix);

      return this._boundingSphere;
    },
  },

  /**
   * 此属性仅用于调试；不用于生产环境使用，也未进行优化。
   * <p>
   * 为模型中的每个绘制命令绘制边界球体。
   * </p>
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   *
   * @default false
   */
  debugShowBoundingVolume: {
    get: function () {
      return this._debugShowBoundingVolume;
    },
    set: function (value) {
      if (this._debugShowBoundingVolume !== value) {
        this._debugShowBoundingVolumeDirty = true;
      }
      this._debugShowBoundingVolume = value;
    },
  },

  /**
   * 此属性仅用于调试；不用于生产环境使用，也未进行优化。
   * <p>
   * 以线框形式绘制模型。
   * </p>
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   *
   * @default false
   */
  debugWireframe: {
    get: function () {
      return this._debugWireframe;
    },
    set: function (value) {
      if (this._debugWireframe !== value) {
        this.resetDrawCommands();
      }
      this._debugWireframe = value;

      // Warning for improper setup of debug wireframe
      if (
        this._debugWireframe === true &&
        this._enableDebugWireframe === false &&
        this.type === ModelType.GLTF
      ) {
        oneTimeWarning(
          "model-debug-wireframe-ignored",
          "enableDebugWireframe must be set to true in Model.fromGltfAsync, otherwise debugWireframe will be ignored.",
        );
      }
    },
  },

  /**
   * 控制来自的边缘如何显示
   * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility}
   * glTF 扩展的渲染是相对于表面几何形状进行的。未声明该扩展的图元不受此设置影响。
   * 是否渲染模型。
   *
   * @memberof Model.prototype
   *
   * @type {EdgeDisplayMode}
   *
   * @default EdgeDisplayMode.SURFACES_ONLY
   */
  edgeDisplayMode: {
    get: function () {
      return this._edgeDisplayMode;
    },
    set: function (value) {
      this._edgeDisplayMode = value;
    },
  },

  /**
   * 用于选择和操作时使用的特征 ID 标签。
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   *
   * @default true
   */
  show: {
    get: function () {
      return this._show;
    },
    set: function (value) {
      this._show = value;
    },
  },

  /**
   * 对于 EXT_mesh_features，这是特征 ID 的标签属性，或者
   * <p>
   * 在未指定时，为“featureId_N” (其中 N 是 featureIds 数组中的索引)。EXT_feature_metadata 没有标签字段，因此此类
   * 特征 ID 设置始终被标记为“featureId_N”，其中 N 是
   * 所有特征 ID 列表中的索引，特征 ID 属性位于
   * 特征 ID 纹理之前。
   * 如果 featureIdLabel 设置为整数 N，它将自动转换为字符串“featureId_N”。如果同时存在每个图元和每个实例的特征 ID，则实例特征 ID 具有优先级。
   * 此功能使用尚未定稿的 3D Tiles 规范的一部分，且可能根据 Cesium 的标准弃用政策发生变化。
   * </p>
   * <p>
   * 用于选择和操作时使用的实例特征 ID 标签。
   * 如果 instanceFeatureIdLabel 设置为整数 N，它将自动转换为字符串“instanceFeatureId_N”。
   * 如果同时存在每个图元和每个实例的特征 ID，则
   * 实例特征 ID 具有优先级。
   * </p>
   *
   * @memberof Model.prototype
   *
   * @type {string}
   * @experimental This 此功能使用尚未定稿的 3D Tiles 规范的一部分，且可能根据 Cesium 的标准弃用政策发生变化。
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

      if (value !== this._featureIdLabel) {
        this._featureTableIdDirty = true;
      }

      this._featureIdLabel = value;
    },
  },

  /**
   * 用于选择和操作时使用的实例特征 ID 标签。
   * <p>
   * 如果 instanceFeatureIdLabel 设置为整数 N，它将自动转换为字符串“instanceFeatureId_N”。
   * 如果同时存在每个图元和每个实例的特征 ID，则
   * 实例特征 ID 具有优先级。
   * 此功能使用尚未定稿的 3D Tiles 规范的一部分，且可能根据 Cesium 的标准弃用政策发生变化。
   * </p>
   *
   * @memberof Model.prototype
   *
   * @type {string}
   * @experimental This 此功能使用尚未定稿的 3D Tiles 规范的一部分，且可能根据 Cesium 的标准弃用政策发生变化。
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

      if (value !== this._instanceFeatureIdLabel) {
        this._featureTableIdDirty = true;
      }

      this._instanceFeatureIdLabel = value;
    },
  },

  /**
   * 用于选择性地禁用模型渲染的 {@link ClippingPlaneCollection}。
   *
   * @memberof Model.prototype
   *
   * @type {ClippingPlaneCollection}
   */
  clippingPlanes: {
    get: function () {
      return this._clippingPlanes;
    },
    set: function (value) {
      if (value !== this._clippingPlanes) {
        // Handle destroying old clipping planes, new clipping planes ownership
        ClippingPlaneCollection.setOwner(value, this, "_clippingPlanes");
        this.resetDrawCommands();
      }
    },
  },

  /**
   * 用于选择性地禁用模型渲染的 {@link ClippingPolygonCollection}。
   *
   * @memberof Model.prototype
   *
   * @type {ClippingPolygonCollection}
   */
  clippingPolygons: {
    get: function () {
      return this._clippingPolygons;
    },
    set: function (value) {
      if (value !== this._clippingPolygons) {
        // Handle destroying old clipping polygons, new clipping polygons ownership
        ClippingPolygonCollection.setOwner(value, this, "_clippingPolygons");
        updateClippingPolygonListeners(this);
        this.resetDrawCommands();

        this._clippingPolygonsState = 0;
        this._clippingPolygonsNeedRebake = true;
        if (defined(this._clippingPolygonData)) {
          ClippingPolygonCollection.releaseRectangleData(
            this._clippingPolygonData,
          );
          this._clippingPolygonData = undefined;
        }
      }
    },
  },

  /**
   * 如果 <code>true</code>，当 {@link Scene.verticalExaggeration} 设置为不同于 <code>1.0</code> 的值时，模型将在椭球法线方向上被放大。
   *
   * @memberof Model.prototype
   * @type {boolean}
   * @default true
   *
   * @example
   * // 将地形放大2倍，但禁止模型本身被放大
   * scene.verticalExaggeration = 2.0;
   * model.enableVerticalExaggeration = false;
   */
  enableVerticalExaggeration: {
    get: function () {
      return this._enableVerticalExaggeration;
    },
    set: function (value) {
      if (value !== this._enableVerticalExaggeration) {
        this.resetDrawCommands();
      }
      this._enableVerticalExaggeration = value;
    },
  },

  /**
   * 如果为 <code>true</code>，则模型将沿椭球法线方向垂直放大。
   *
   * @memberof Model.prototype
   * @type {boolean}
   * @default true
   * @readonly
   * @private
   */
  hasVerticalExaggeration: {
    get: function () {
      return this._hasVerticalExaggeration;
    },
  },

  /**
   * 如果此模型是 tileset 中的 <code>Model3DTileContent</code> 的一部分，
   * 则将返回该 tileset 的 <code>ImageryLayerCollection</code>。否则，返回 <code>undefined</code>。
   * 用于给模型打阴影的方向光颜色。当为 <code>undefined</code> 时，使用场景中的光颜色。
   *
   * @memberof Model.prototype
   * @type {ImageryLayerCollection|undefined}
   * @readonly
   * @private
   */
  imageryLayers: {
    get: function () {
      if (defined(this._content)) {
        const tileset = this._content.tileset;
        if (defined(tileset)) {
          return tileset.imageryLayers;
        }
      }
      return undefined;
    },
  },

  /**
   * 通过设置此值可以禁用额外的光源。
   * <p>
   * 将 <code>model.imageBasedLighting.imageBasedLightingFactor = new Cartesian2(0.0, 0.0)</code> 可以使模型变暗许多。此处，增加光源强度会使模型更亮。
   * 用于管理此模型基于图像的照明特性的属性。
   * 用于管理此模型动态环境图的属性。会影响照明效果。
   * </p>
   * @memberof Model.prototype
   *
   * @type {Cartesian3}
   *
   * @default undefined
   */
  lightColor: {
    get: function () {
      return this._lightColor;
    },
    set: function (value) {
      if (defined(value) !== defined(this._lightColor)) {
        this.resetDrawCommands();
      }

      this._lightColor = Cartesian3.clone(value, this._lightColor);
    },
  },

  /**
   * // 将模型环境图使用的地面颜色改为森林绿色
   *
   * @memberof Model.prototype
   *
   * @type {ImageBasedLighting}
   */
  imageBasedLighting: {
    get: function () {
      return this._imageBasedLighting;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("imageBasedLighting", value);
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
        this.resetDrawCommands();
      }
    },
  },

  /**
   * const environmentMapManager = model.environmentMapManager;
   * @memberof Model.prototype
   * @readonly
   *
   * @example
   * environmentMapManager.groundColor = Cesium.Color.fromCssColorString("#203b34");
   * 是否剔除背向视角的几何图形。当为 <code>true</code> 时，背面剔除由材料的双面属性决定；当为 <code>false</code> 时，背面剔除被禁用。如果 {@link Model#color} 是半透明或 {@link Model#silhouetteSize} 大于 0.0，则不会剔除背面。
   * 在 {@link Model#modelMatrix} 应用之前，此模型会应用统一比例。
   *
   * @type {DynamicEnvironmentMapManager}
   */
  environmentMapManager: {
    get: function () {
      return this._environmentMapManager;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("environmentMapManager", value);
      //>>includeEnd('debug');

      if (value !== this.environmentMapManager) {
        DynamicEnvironmentMapManager.setOwner(
          value,
          this,
          "_environmentMapManager",
        );
        this.resetDrawCommands();
      }
    },
  },

  /**
   * 大于 <code>1.0</code> 的值会增加模型的大小；小于 <code>1.0</code> 的值则会减小。
   * 受模型比例、最小像素尺寸和最大比例参数影响的模型真实比例。
   * culling is disabled. Back faces are not culled if {@link Model#color}
   * is translucent or {@link Model#silhouetteSize} is greater than 0.0.
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   *
   * @default true
   */
  backFaceCulling: {
    get: function () {
      return this._backFaceCulling;
    },
    set: function (value) {
      if (value !== this._backFaceCulling) {
        this._backFaceCullingDirty = true;
      }

      this._backFaceCulling = value;
    },
  },

  /**
   * 模型的最大比例大小。这可用于设定 {@link Model#minimumPixelSize} 的上限，确保模型的比例始终合理。
   * 决定模型是否投射或接收来自光源的阴影。
   * 获取将显示给用户的模型标签。
   *
   * @memberof Model.prototype
   *
   * @type {number}
   *
   * @default 1.0
   */
  scale: {
    get: function () {
      return this._scale;
    },
    set: function (value) {
      if (value !== this._scale) {
        this._updateModelMatrix = true;
      }
      this._scale = value;
    },
  },

  /**
   * The true scale of the model after being affected by the model's scale,
   * minimum pixel size, and maximum scale parameters.
   *
   * @memberof Model.prototype
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  computedScale: {
    get: function () {
      return this._computedScale;
    },
  },

  /**
   * The approximate minimum pixel size of the model regardless of zoom.
   * This can be used to ensure that a model is visible even when the viewer
   * zooms out.  When <code>0.0</code>, no minimum size is enforced.
   *
   * @memberof Model.prototype
   *
   * @type {number}
   *
   * @default 0.0
   */
  minimumPixelSize: {
    get: function () {
      return this._minimumPixelSize;
    },
    set: function (value) {
      if (value !== this._minimumPixelSize) {
        this._updateModelMatrix = true;
      }
      this._minimumPixelSize = value;
    },
  },

  /**
   * The maximum scale size for a model. This can be used to give
   * an upper limit to the {@link Model#minimumPixelSize}, ensuring that the model
   * is never an unreasonable scale.
   *
   * @memberof Model.prototype
   *
   * @type {number}
   */
  maximumScale: {
    get: function () {
      return this._maximumScale;
    },
    set: function (value) {
      if (value !== this._maximumScale) {
        this._updateModelMatrix = true;
      }
      this._maximumScale = value;
    },
  },

  /**
   * Determines whether the model casts or receives shadows from light sources.

   * @memberof Model.prototype
   *
   * @type {ShadowMode}
   *
   * @default ShadowMode.ENABLED
   */
  shadows: {
    get: function () {
      return this._shadows;
    },
    set: function (value) {
      if (value !== this._shadows) {
        this._shadowsDirty = true;
      }

      this._shadows = value;
    },
  },

  /**
   * Gets the credit that will be displayed for the model.
   *
   * @memberof Model.prototype
   *
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 获取或设置模型字幕是否显示
   * 在屏幕上显示。
   *
   * @memberof Model.prototype
   *
   * @type {boolean}
   *
   * @default false
   */
  showCreditsOnScreen: {
    get: function () {
      return this._showCreditsOnScreen;
    },
    set: function (value) {
      if (this._showCreditsOnScreen !== value) {
        this._showCreditsOnScreenDirty = true;
      }

      this._showCreditsOnScreen = value;
    },
  },

  /**
   * 应用于该模型的 {@link SplitDirection}。
   *
   * @memberof Model.prototype
   *
   * @type {SplitDirection}
   *
   * @default {@link SplitDirection.NONE}
   */
  splitDirection: {
    get: function () {
      return this._splitDirection;
    },
    set: function (value) {
      if (this._splitDirection !== value) {
        this.resetDrawCommands();
      }
      this._splitDirection = value;
    },
  },

  /**
   * 获取模型的分类类型。这决定了地形、
   * 3D Tiles 还是两者都会被该模型分类。
   * <p>
   * 此外，还有一些要求和限制：
   * <ul>
   * <li>glTF 不能包含 morph target、皮肤或动画。</li>
   * <li>glTF 不能包含 <code>EXT_mesh_gpu_instancing</code> 扩展。</li>
   * <li>用于分类其他资产的网格必须包含 TRIANGLES。</li>
   * <li>网格必须是水密的。</li>
   * <li>需要 POSITION 属性。</li>
   * <li>如果同时存在特征 ID 和索引缓冲区，所有具有相同特征 ID 的索引必须占据索引缓冲区的连续部分。</li>
   * <li>如果只有特征 ID 而没有索引缓冲区，所有具有相同特征 ID 的位置必须占据位置缓冲区的连续部分。</li>
   * </ul>
   * </p>
   * <p>
   * 接受分类的 3D Tiles 或地形必须是不透明的。
   * </p>
   *
   * @memberof Model.prototype
   *
   * @type {ClassificationType}
   * @default undefined
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿且可能根据 Cesium 的标准弃用政策发生变化。
   * @readonly
   */
  classificationType: {
    get: function () {
      return this._classificationType;
    },
  },

  /**
   * 对 pick ID 的引用。这仅用于内部使用，例如在
   * {@link PostProcessStage} 中的每特征后处理中。
   *
   * @memberof Model.prototype
   *
   * @type {PickId[]}
   * @readonly
   *
   * @private
   */
  pickIds: {
    get: function () {
      return this._pickIds;
    },
  },

  /**
   * The {@link StyleCommandsNeeded} for the style currently applied to
   * the features in the model. This is used internally by the {@link ModelDrawCommand}
   * 以大地坐标限定的矩形。对于具有
   *
   * @memberof Model.prototype
   *
   * @type {StyleCommandsNeeded}
   * @readonly
   *
   * @private
   */
  styleCommandsNeeded: {
    get: function () {
      return this._styleCommandsNeeded;
    },
  },
});

/**
 * 区域边界体积的 3D tile 内容，这是 tiles 的矩形。否则模型的边界球体
 * 被投影到给定的椭球面上。
 * 投影边界球体（对于没有区域边界体积的模型）。
 *
 * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] 投影边界矩形。
 * @returns {Rectangle} The 模型未加载。使用 Model.readyEvent 或等待 Model.ready 为 true。
 *
 * @exception {DeveloperError} The 返回 glTF 中具有给定 <code>name</code> 的节点。这用于
 *
 * @private
 */
Model.prototype.getRectangle = function (ellipsoid) {
  //>>includeStart('debug', pragmas.debug);
  if (!this._ready) {
    throw new DeveloperError(
      "The model is not loaded. Use Model.readyEvent or wait for Model.ready to be true.",
    );
  }
  //>>includeEnd('debug');

  // A region bounding volume's rectangle is fixed in WGS84, so the ellipsoid argument does not apply.
  const bv = this._content?.tile?.contentBoundingVolume;
  if (defined(bv?.rectangle)) {
    return bv.rectangle;
  }

  ellipsoid = ellipsoid ?? this._scene?.ellipsoid ?? Ellipsoid.default;
  return Rectangle.fromBoundingSphere(
    this.boundingSphere,
    ellipsoid,
    this._rectangle,
  );
};

/**
 * 修改节点的变换以实现用户自定义动画。
 * 如果 glTF 中有多个具有相同 <code>name</code> 的节点，
 *
 * 则返回的节点为未指定。
 * glTF 中节点的名称。
 *
 * @param {string} name 节点，或者如果不存在具有 <code>name</code> 的节点则为 <code>undefined</code>。
 * @returns {ModelNode} The 模型未加载。使用 Model.readyEvent 或等待 Model.ready 为 true。
 *
 * @exception {DeveloperError} The model is not loaded.  Use Model.readyEvent or wait for Model.ready to be true.
 *
 * @example
 * // 对节点 "Hand" 应用非均匀缩放
 * const node = model.getNode("Hand");
 * node.matrix = Cesium.Matrix4.fromScale(new Cesium.Cartesian3(5.0, 1.0, 1.0), node.matrix);
 */
Model.prototype.getNode = function (name) {
  //>>includeStart('debug', pragmas.debug);
  if (!this._ready) {
    throw new DeveloperError(
      "The model is not loaded. Use Model.readyEvent or wait for Model.ready to be true.",
    );
  }
  Check.typeOf.string("name", name);
  //>>includeEnd('debug');

  return this._nodesByName.get(name);
};

/**
 * 设置关节阶段的当前值。设置了一个或多个阶段值后，调用 Model.applyArticulations() 以重新计算节点矩阵。
 * 该关节的名称、空间以及阶段名称。
 * 该关节的阶段的数值。
 *
 * @param {string} articulationStageKey model 未加载。使用 Model.readyEvent 或等待 Model.ready 为 true。
 * @param {number} value // 设置属于名为 "SampleArticulation" 的关节的名为 "MoveX" 的阶段值
 *
 * @exception {DeveloperError} The model.setArticulationStage("SampleArticulation MoveX", 50.0);
 *
 * @see Model#applyArticulations
 *
 * @example
 * 将修改过的关节阶段应用到参与任何关节的每个节点的矩阵中。注意，这将覆盖参与节点上的所有变换。
 * model 未加载。使用 Model.readyEvent 或等待 Model.ready 为 true。
 */
Model.prototype.setArticulationStage = function (articulationStageKey, value) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("value", value);
  if (!this._ready) {
    throw new DeveloperError(
      "The model is not loaded. Use Model.readyEvent or wait for Model.ready to be true.",
    );
  }
  //>>includeEnd('debug');

  this._sceneGraph.setArticulationStage(articulationStageKey, value);
};

/**
 * 返回为给定扩展创建的对象。
 * 给定名称可能是 glTF 扩展的名称，例如 `"EXT_example_extension"`。
 * 如果指定的扩展存在于底层 glTF 资源的根中，并且该扩展的加载器已处理扩展数据，那么将返回该扩展的模型表示。
 *
 * @exception {DeveloperError} The 扩展的名称
 */
Model.prototype.applyArticulations = function () {
  //>>includeStart('debug', pragmas.debug);
  if (!this._ready) {
    throw new DeveloperError(
      "The model is not loaded. Use Model.readyEvent or wait for Model.ready to be true.",
    );
  }
  //>>includeEnd('debug');

  this._sceneGraph.applyArticulations();
};

/**
 * 对象，或 `undefined`
 *
 * model 未加载。使用 Model.readyEvent 或等待 Model.ready 为 true。
 * 功能尚未最终确定，可能会根据 Cesium 的标准弃用政策发生变化。
 * 将模型的 {@link Model#style} 标记为脏状态，迫使所有特性在模型可见的下一个帧中重新评估样式。
 * 重置该模型的绘制命令。
 *
 * @param {string} extensionName 当 {@link Viewer} 或 {@link CesiumWidget} 渲染场景时调用此函数，以获取渲染该基本体所需的绘制命令。
 * @returns {object|undefined} The 不要直接调用此函数。仅记录在场景渲染时可能传播的异常：
 * @exception {DeveloperError} The 加载外部参考。
 *
 * @experimental This 确定模型是否因逆裁剪而完全被裁剪掉。在逆模式下，没有多边形几何的模型完全位于每个多边形之外，因此全部被裁剪且不应被绘制。
 */
Model.prototype.getExtension = function (extensionName) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("extensionName", extensionName);
  if (!this._ready) {
    throw new DeveloperError(
      "The model is not loaded. Use Model.readyEvent or wait for Model.ready to be true.",
    );
  }
  //>>includeEnd('debug');
  const components = this._loader.components;
  return components.extensions[extensionName];
};

/**
 * Marks the model's {@link Model#style} as dirty, which forces all features
 * to re-evaluate the style in the next frame the model is visible.
 */
Model.prototype.makeStyleDirty = function () {
  this._styleDirty = true;
};

/**
 * Resets the draw commands for this model.
 *
 * @private
 */
Model.prototype.resetDrawCommands = function () {
  this._drawCommandsBuilt = false;
};

const scratchIBLReferenceFrameMatrix4 = new Matrix4();
const scratchIBLReferenceFrameMatrix3 = new Matrix3();
const scratchClippingPlanesMatrix = new Matrix4();

/**
 * Called when {@link Viewer} or {@link CesiumWidget} render the scene to
 * get the draw commands needed to render this primitive.
 * <p>
 * Do not call this function directly.  This is documented just to
 * list the exceptions that may be propagated when the scene is rendered:
 * </p>
 *
 * @exception {RuntimeError} Failed to load external reference.
 */
Model.prototype.update = function (frameState) {
  let finishedProcessing = false;
  try {
    // Keep processing the model every frame until the main resources
    // (buffer views) and textures (which may be loaded asynchronously)
    // are processed.
    finishedProcessing = processLoader(this, frameState);
  } catch (error) {
    if (
      !this._loader.incrementallyLoadTextures &&
      error.name === "TextureError"
    ) {
      handleError(this, error);
    } else {
      const runtimeError = ModelUtility.getError(
        "model",
        this._resource,
        error,
      );
      handleError(this, runtimeError);
    }
  }

  // A custom shader may have to load texture uniforms.
  updateCustomShader(this, frameState);

  // Environment maps, specular maps, and spherical harmonics may need to be updated or regenerated
  updateEnvironmentMap(this, frameState);

  // The image-based lighting may have to load texture uniforms
  // for specular maps.
  updateImageBasedLighting(this, frameState);

  if (!this._resourcesLoaded && finishedProcessing) {
    this._resourcesLoaded = true;

    const components = this._loader.components;
    if (!defined(components)) {
      if (this._loader.isUnloaded()) {
        return;
      }

      const error = ModelUtility.getError(
        "model",
        this._resource,
        new RuntimeError("Failed to load model."),
      );
      handleError(error);
      this._rejectLoad = this._rejectLoad && this._rejectLoad(error);
    }

    const structuralMetadata = components.structuralMetadata;
    if (
      defined(structuralMetadata) &&
      structuralMetadata.propertyTableCount > 0
    ) {
      createModelFeatureTables(this, structuralMetadata);
    }

    const sceneGraph = new ModelSceneGraph({
      model: this,
      modelComponents: components,
    });

    this._sceneGraph = sceneGraph;
    this._gltfCredits = sceneGraph.components.asset.credits;
  }

  // Short-circuit if the model resources aren't ready or the scene
  // is currently morphing.
  if (!this._resourcesLoaded || frameState.mode === SceneMode.MORPHING) {
    return;
  }

  const modelImagery = this._modelImagery;
  modelImagery.update(frameState);
  if (!modelImagery.ready) {
    // If the imagery loading should not happen asynchronously,
    // then do not let the model count as 'ready' until the
    // modelImagery is 'ready'
    const asynchronouslyLoadImagery =
      this._content?.tileset?._asynchronouslyLoadImagery ?? false;
    if (!asynchronouslyLoadImagery) {
      return;
    }
  }

  updateFeatureTableId(this);
  updateStyle(this);
  updateFeatureTables(this, frameState);
  updatePointCloudShading(this);
  updateSilhouette(this, frameState);
  updateSkipLevelOfDetail(this, frameState);
  updateClippingPlanes(this, frameState);
  updateClippingPolygons(this, frameState);
  updateVectorLookup(this, frameState);
  updateSceneMode(this, frameState);
  updateFog(this, frameState);
  updateVerticalExaggeration(this, frameState);
  updateEdgeGeometryNeeded(this, frameState);

  this._defaultTexture = frameState.context.defaultTexture;

  buildDrawCommands(this, frameState);
  updateModelMatrix(this, frameState);

  // Many features (e.g. image-based lighting, clipping planes) depend on the model
  // matrix being updated for the current height reference, so update it first.
  updateClamping(this);

  updateBoundingSphereAndScale(this, frameState);
  updateReferenceMatrices(this, frameState);

  // This check occurs after the bounding sphere has been updated so that
  // zooming to the bounding sphere can account for any modifications
  // from the clamp-to-ground setting.
  if (!this._ready) {
    // Set the model as ready after the first frame render since the user might set up events subscribed to
    // the post render event, and the model may not be ready for those past the first frame.
    frameState.afterRender.push(() => {
      this._ready = true;
      this._readyEvent.raiseEvent(this);
    });

    // Don't render until the next frame after the ready event has been raised.
    return;
  }

  if (
    this._loader.incrementallyLoadTextures &&
    !this._texturesLoaded &&
    this._loader.texturesLoaded
  ) {
    // Re-run the pipeline so texture memory statistics are re-computed
    this.resetDrawCommands();

    this._texturesLoaded = true;
    this._texturesReadyEvent.raiseEvent(this);
  }

  updatePickIds(this);

  // Update the scene graph and draw commands for any changes in model's properties
  // (e.g. model matrix, back-face culling)
  updateSceneGraph(this, frameState);
  updateShowCreditsOnScreen(this);
  submitDrawCommands(this, frameState);
};

function processLoader(model, frameState) {
  if (
    !model._resourcesLoaded ||
    (model._loader.incrementallyLoadTextures && !model._texturesLoaded)
  ) {
    // Ensures frames continue to render in requestRender mode while resources are processing
    frameState.afterRender.push(() => true);
    return model._loader.process(frameState);
  }

  return true;
}

function updateCustomShader(model, frameState) {
  if (defined(model._customShader)) {
    model._customShader.update(frameState);
  }
}

function updateEnvironmentMap(model, frameState) {
  const environmentMapManager = model._environmentMapManager;
  const picking = frameState.passes.pick || frameState.passes.pickVoxel;
  if (model._ready && environmentMapManager.owner === model && !picking) {
    environmentMapManager.position = model._boundingSphere.center;
    environmentMapManager.shouldUpdate =
      !defined(model._imageBasedLighting.sphericalHarmonicCoefficients) ||
      !defined(model._imageBasedLighting.specularEnvironmentMaps);

    environmentMapManager.update(frameState);

    if (environmentMapManager.shouldRegenerateShaders) {
      model.resetDrawCommands();
    }
  }
}

function updateImageBasedLighting(model, frameState) {
  model._imageBasedLighting.update(frameState);
  if (model._imageBasedLighting.shouldRegenerateShaders) {
    model.resetDrawCommands();
  }
}

function updateFeatureTableId(model) {
  if (!model._featureTableIdDirty) {
    return;
  }
  model._featureTableIdDirty = false;

  const components = model._sceneGraph.components;
  const structuralMetadata = components.structuralMetadata;

  if (
    defined(structuralMetadata) &&
    structuralMetadata.propertyTableCount > 0
  ) {
    model.featureTableId = selectFeatureTableId(components, model);

    // Mark the style dirty to re-apply it and reflect the new feature ID table.
    model._styleDirty = true;

    // Trigger a rebuild of the draw commands.
    model.resetDrawCommands();
  }
}

function updateStyle(model) {
  if (model._styleDirty) {
    model.applyStyle(model._style);
    model._styleDirty = false;
  }
}

function updateFeatureTables(model, frameState) {
  const featureTables = model._featureTables;
  const length = featureTables.length;

  let styleCommandsNeededDirty = false;
  for (let i = 0; i < length; i++) {
    featureTables[i].update(frameState);
    // Check if the types of style commands needed have changed and trigger a reset of the draw commands
    // to ensure that translucent and opaque features are handled in the correct passes.
    if (featureTables[i].styleCommandsNeededDirty) {
      styleCommandsNeededDirty = true;
    }
  }

  if (styleCommandsNeededDirty) {
    updateStyleCommandsNeeded(model);
  }
}

function updateStyleCommandsNeeded(model) {
  const featureTable = model.featureTables[model.featureTableId];
  model._styleCommandsNeeded = StyleCommandsNeeded.getStyleCommandsNeeded(
    featureTable.featuresLength,
    featureTable.batchTexture.translucentFeaturesLength,
  );
}

function updatePointCloudShading(model) {
  const pointCloudShading = model.pointCloudShading;

  // Check if the shader needs to be updated for point cloud attenuation
  // settings.
  if (pointCloudShading.attenuation !== model._attenuation) {
    model.resetDrawCommands();
    model._attenuation = pointCloudShading.attenuation;
  }

  if (pointCloudShading.backFaceCulling !== model._pointCloudBackFaceCulling) {
    model.resetDrawCommands();
    model._pointCloudBackFaceCulling = pointCloudShading.backFaceCulling;
  }
}

function updateSilhouette(model, frameState) {
  if (model._silhouetteDirty) {
    // Only rebuild draw commands if silhouettes are supported in the first place.
    if (supportsSilhouettes(frameState)) {
      model.resetDrawCommands();
    }

    model._silhouetteDirty = false;
  }
}

function updateSkipLevelOfDetail(model, frameState) {
  const skipLevelOfDetail = model.hasSkipLevelOfDetail(frameState);
  if (skipLevelOfDetail !== model._skipLevelOfDetail) {
    model.resetDrawCommands();
    model._skipLevelOfDetail = skipLevelOfDetail;
  }
}

function updateClippingPlanes(model, frameState) {
  // Update the clipping planes collection / state for this model to detect any changes.
  let currentClippingPlanesState = 0;
  if (model.isClippingEnabled()) {
    if (model._clippingPlanes.owner === model) {
      model._clippingPlanes.update(frameState);
    }
    currentClippingPlanesState = model._clippingPlanes.clippingPlanesState;
  }

  if (currentClippingPlanesState !== model._clippingPlanesState) {
    model.resetDrawCommands();
    model._clippingPlanesState = currentClippingPlanesState;
  }
}

// Only the collection's owner subscribes to its add/remove events. Tileset-owned
// collections are handled by the tileset, which marks its tiles dirty instead.
function updateClippingPolygonListeners(model) {
  model._removeClippingPolygonAdded =
    model._removeClippingPolygonAdded && model._removeClippingPolygonAdded();
  model._removeClippingPolygonRemoved =
    model._removeClippingPolygonRemoved &&
    model._removeClippingPolygonRemoved();

  const clippingPolygons = model._clippingPolygons;
  if (!defined(clippingPolygons) || clippingPolygons.owner !== model) {
    return;
  }

  const markDirty = () => {
    model._clippingPolygonsNeedRebake = true;
  };
  model._removeClippingPolygonAdded =
    clippingPolygons.polygonAdded.addEventListener(markDirty);
  model._removeClippingPolygonRemoved =
    clippingPolygons.polygonRemoved.addEventListener(markDirty);
}

function updateClippingPolygons(model, frameState) {
  const clippingPolygons = model._clippingPolygons;
  const enabled = model.isClippingPolygonsEnabled();

  // Detect enabled/inverse changes, which require shader regeneration.
  let currentClippingPolygonsState = 0;
  if (enabled) {
    if (clippingPolygons.owner === model) {
      clippingPolygons.update(frameState);
    }
    currentClippingPolygonsState = clippingPolygons.clippingPolygonsState;
  }

  if (currentClippingPolygonsState !== model._clippingPolygonsState) {
    model.resetDrawCommands();
    model._clippingPolygonsState = currentClippingPolygonsState;
  }

  const wasClipped = (model._clippingPolygonData?.polygonRings.length ?? 0) > 0;

  // A polygon add/remove or a model move only requires rebaking the clipping textures.
  if (model._clippingPolygonsNeedRebake) {
    model._clippingPolygonsNeedRebake = false;
    if (defined(model._clippingPolygonData)) {
      ClippingPolygonCollection.releaseRectangleData(
        model._clippingPolygonData,
      );
      model._clippingPolygonData = undefined;
    }
  }

  if (!enabled || !model._ready) {
    return;
  }

  if (!defined(model._clippingPolygonData)) {
    model._clippingPolygonData = clippingPolygons.requestRectangleData(
      model.getRectangle(clippingPolygons.ellipsoid),
      frameState.context,
    );
  }

  const isClipped = (model._clippingPolygonData?.polygonRings.length ?? 0) > 0;
  if (wasClipped !== isClipped) {
    // Rerun the model pipeline to enable/disable clipping
    model.resetDrawCommands();
  }
}

const scratchVectorRectangle = new Rectangle();

function releaseVectorData(model) {
  if (!defined(model._vectorData)) {
    return;
  }

  model._scene?.vectorProvider?.releaseTileData(model._vectorData);
  model._vectorData = undefined;
}

// Each kind of geometry declares its own lookup textures, so the mix drives the shader.
function vectorLookupFlags(vectorData) {
  if (vectorData?.show !== true) {
    return 0;
  }

  let flags = 1;
  flags |= vectorData.hasPolylines ? 2 : 0;
  flags |= vectorData.hasPolygons ? 4 : 0;
  return flags;
}

function updateVectorLookup(model, frameState) {
  const provider = model._scene?.vectorProvider;
  // HeightReference.CLAMP_TO_3D_TILE covers tileset content only, not standalone glTF.
  const active =
    defined(provider) &&
    defined(model._content) &&
    model.ready &&
    frameState.mode === SceneMode.SCENE3D;

  if (active) {
    // A tile's content region is far tighter than a rectangle circumscribing the bounding sphere.
    const rectangle =
      model._content?.tile?.contentBoundingVolume.rectangle ??
      Rectangle.fromBoundingSphere(
        model.boundingSphere,
        provider.ellipsoid,
        scratchVectorRectangle,
      );
    model._vectorData = defined(model._vectorData)
      ? provider.updateDataForRectangle(
          rectangle,
          frameState.context,
          model._vectorData,
          HeightReference.CLAMP_TO_3D_TILE,
        )
      : provider.requestDataForRectangle(
          rectangle,
          frameState.context,
          HeightReference.CLAMP_TO_3D_TILE,
        );
  } else {
    releaseVectorData(model);
  }

  const flags = vectorLookupFlags(model._vectorData);
  if (flags !== model._vectorLookupFlags) {
    model.resetDrawCommands();
    model._vectorLookupFlags = flags;
  }
}

function updateSceneMode(model, frameState) {
  if (frameState.mode !== model._sceneMode) {
    if (model._projectTo2D) {
      model.resetDrawCommands();
    } else {
      model._updateModelMatrix = true;
    }
    model._sceneMode = frameState.mode;
  }
}

function updateFog(model, frameState) {
  const fogRenderable = frameState.fog.enabled && frameState.fog.renderable;
  if (fogRenderable !== model._fogRenderable) {
    model.resetDrawCommands();
    model._fogRenderable = fogRenderable;
  }
}

function updateVerticalExaggeration(model, frameState) {
  if (model.enableVerticalExaggeration) {
    const verticalExaggerationNeeded = frameState.verticalExaggeration !== 1.0;
    if (model.hasVerticalExaggeration !== verticalExaggerationNeeded) {
      model.resetDrawCommands();
      model._hasVerticalExaggeration = verticalExaggerationNeeded;
    }
  } else if (model.hasVerticalExaggeration) {
    model.resetDrawCommands(); //if verticalExaggeration was on, reset.
    model._hasVerticalExaggeration = false;
  }
}

// Edge geometry is built only when edges are displayed, or once a snapping
// pass has touched this model (snapping targets edges even in SURFACES_ONLY).
function updateEdgeGeometryNeeded(model, frameState) {
  if (frameState.passes.snap) {
    model._edgeGeometryNeededForSnapping = true;
  }

  const needed =
    model._edgeDisplayMode !== EdgeDisplayMode.SURFACES_ONLY ||
    model._edgeGeometryNeededForSnapping;
  if (needed !== model._edgeGeometryNeeded) {
    model._edgeGeometryNeeded = needed;
    if (hasEdgeVisibilityData(model)) {
      model.resetDrawCommands();
    }
  }
}

function hasEdgeVisibilityData(model) {
  if (!defined(model._hasEdgeVisibilityData)) {
    model._hasEdgeVisibilityData = model._sceneGraph.components.nodes.some(
      (node) =>
        node.primitives.some((primitive) => defined(primitive.edgeVisibility)),
    );
  }
  return model._hasEdgeVisibilityData;
}

function buildDrawCommands(model, frameState) {
  if (!model._drawCommandsBuilt) {
    model.destroyPipelineResources();
    model._sceneGraph.buildDrawCommands(frameState);
    model._drawCommandsBuilt = true;
  }
}

function updateModelMatrix(model, frameState) {
  // This is done without a dirty flag so that the model matrix can be updated in-place
  // without needing to use a setter.
  if (!Matrix4.equals(model.modelMatrix, model._modelMatrix)) {
    //>>includeStart('debug', pragmas.debug);
    if (frameState.mode !== SceneMode.SCENE3D && model._projectTo2D) {
      throw new DeveloperError(
        "Model.modelMatrix cannot be changed in 2D or Columbus View if projectTo2D is true.",
      );
    }
    //>>includeEnd('debug');
    model._updateModelMatrix = true;
    model._modelMatrix = Matrix4.clone(model.modelMatrix, model._modelMatrix);
  }
}

const scratchPosition = new Cartesian3();
const scratchCartographic = new Cartographic();

function updateClamping(model) {
  if (
    !model._updateModelMatrix &&
    !model._heightDirty &&
    model._minimumPixelSize === 0.0
  ) {
    return;
  }

  if (defined(model._removeUpdateHeightCallback)) {
    model._removeUpdateHeightCallback();
    model._removeUpdateHeightCallback = undefined;
  }

  const scene = model._scene;
  if (!defined(scene) || model.heightReference === HeightReference.NONE) {
    //>>includeStart('debug', pragmas.debug);
    if (model.heightReference !== HeightReference.NONE) {
      throw new DeveloperError(
        "Height reference is not supported without a scene.",
      );
    }
    //>>includeEnd('debug');
    model._clampedModelMatrix = undefined;
    return;
  }

  const ellipsoid = scene.ellipsoid ?? Ellipsoid.default;

  // Compute cartographic position so we don't recompute every update
  const modelMatrix = model.modelMatrix;
  scratchPosition.x = modelMatrix[12];
  scratchPosition.y = modelMatrix[13];
  scratchPosition.z = modelMatrix[14];
  const cartoPosition = ellipsoid.cartesianToCartographic(scratchPosition);

  if (!defined(model._clampedModelMatrix)) {
    model._clampedModelMatrix = Matrix4.clone(modelMatrix, new Matrix4());
  }

  // Install callback to handle updating of terrain tiles
  model._removeUpdateHeightCallback = scene.updateHeight(
    cartoPosition,
    getUpdateHeightCallback(model, ellipsoid, cartoPosition),
    model.heightReference,
  );

  // Set the correct height now
  const height = scene.getHeight(cartoPosition, model.heightReference);
  if (defined(height)) {
    // Get callback with cartoPosition being the non-clamped position
    const callback = getUpdateHeightCallback(model, ellipsoid, cartoPosition);

    // Compute the clamped cartesian and call updateHeight callback
    Cartographic.clone(cartoPosition, scratchCartographic);
    scratchCartographic.height = height;
    callback(scratchCartographic);
  }

  model._heightDirty = false;
  model._updateModelMatrix = true;
}

function updateBoundingSphereAndScale(model, frameState) {
  if (!model._updateModelMatrix && model._minimumPixelSize === 0.0) {
    return;
  }

  const modelMatrix = defined(model._clampedModelMatrix)
    ? model._clampedModelMatrix
    : model.modelMatrix;

  updateBoundingSphere(model, modelMatrix);
  updateComputedScale(model, modelMatrix, frameState);
}

function updateBoundingSphere(model, modelMatrix) {
  model._clampedScale = defined(model._maximumScale)
    ? Math.min(model._scale, model._maximumScale)
    : model._scale;

  model._boundingSphere.center = Cartesian3.multiplyByScalar(
    model._sceneGraph.boundingSphere.center,
    model._clampedScale,
    model._boundingSphere.center,
  );
  model._boundingSphere.radius = model._initialRadius * model._clampedScale;

  model._boundingSphere = BoundingSphere.transform(
    model._boundingSphere,
    modelMatrix,
    model._boundingSphere,
  );
}

function updateComputedScale(model, modelMatrix, frameState) {
  let scale = model.scale;

  if (model.minimumPixelSize !== 0.0 && !model._projectTo2D) {
    // Compute size of bounding sphere in pixels
    const context = frameState.context;
    const maxPixelSize = Math.max(
      context.drawingBufferWidth,
      context.drawingBufferHeight,
    );

    Matrix4.getTranslation(modelMatrix, scratchPosition);

    if (model._sceneMode !== SceneMode.SCENE3D) {
      SceneTransforms.computeActualEllipsoidPosition(
        frameState,
        scratchPosition,
        scratchPosition,
      );
    }

    const radius = model._boundingSphere.radius;
    const metersPerPixel = scaleInPixels(scratchPosition, radius, frameState);

    // metersPerPixel is always > 0.0
    const pixelsPerMeter = 1.0 / metersPerPixel;
    const diameterInPixels = Math.min(
      pixelsPerMeter * (2.0 * radius),
      maxPixelSize,
    );

    // Maintain model's minimum pixel size
    if (diameterInPixels < model.minimumPixelSize) {
      scale =
        (model.minimumPixelSize * metersPerPixel) /
        (2.0 * model._initialRadius);
    }
  }

  model._computedScale = defined(model.maximumScale)
    ? Math.min(model.maximumScale, scale)
    : scale;
}

function updatePickIds(model) {
  if (!model._idDirty) {
    return;
  }
  model._idDirty = false;

  const id = model._id;
  const pickIds = model._pickIds;
  const length = pickIds.length;
  for (let i = 0; i < length; ++i) {
    pickIds[i].object.id = id;
  }
}

// Matrix3 is a row-major constructor.
// The same constructor in GLSL will produce the transpose of this.
const yUpToZUp = new Matrix3(1, 0, 0, 0, 0, 1, 0, -1, 0);

function updateReferenceMatrices(model, frameState) {
  const modelMatrix = defined(model._clampedModelMatrix)
    ? model._clampedModelMatrix
    : model.modelMatrix;
  const referenceMatrix = model.referenceMatrix ?? modelMatrix;
  const context = frameState.context;

  let iblReferenceFrameMatrix3 = scratchIBLReferenceFrameMatrix3;
  let iblReferenceFrameMatrix4 = scratchIBLReferenceFrameMatrix4;

  iblReferenceFrameMatrix4 = Matrix4.multiply(
    context.uniformState.view3D,
    referenceMatrix,
    iblReferenceFrameMatrix4,
  );
  iblReferenceFrameMatrix3 = Matrix4.getRotation(
    iblReferenceFrameMatrix4,
    iblReferenceFrameMatrix3,
  );
  iblReferenceFrameMatrix3 = Matrix3.transpose(
    iblReferenceFrameMatrix3,
    iblReferenceFrameMatrix3,
  );
  model._iblReferenceFrameMatrix = Matrix3.multiply(
    yUpToZUp,
    iblReferenceFrameMatrix3,
    model._iblReferenceFrameMatrix,
  );

  if (model.isClippingEnabled()) {
    const clippingPlanesMatrix = Matrix4.multiply(
      referenceMatrix,
      model._clippingPlanes.modelMatrix,
      scratchClippingPlanesMatrix,
    );
    model._clippingPlanesMatrix = Matrix4.inverseTranspose(
      clippingPlanesMatrix,
      model._clippingPlanesMatrix,
    );
  }
}

function updateSceneGraph(model, frameState) {
  const sceneGraph = model._sceneGraph;
  if (model._updateModelMatrix || model._minimumPixelSize !== 0.0) {
    const modelMatrix = defined(model._clampedModelMatrix)
      ? model._clampedModelMatrix
      : model.modelMatrix;
    sceneGraph.updateModelMatrix(modelMatrix, frameState);
    if (model._updateModelMatrix) {
      // The model moved, so re-bake the clipping textures for its new rectangle.
      model._clippingPolygonsNeedRebake = true;
    }
    model._updateModelMatrix = false;
  }

  if (model._backFaceCullingDirty) {
    sceneGraph.updateBackFaceCulling(model._backFaceCulling);
    model._backFaceCullingDirty = false;
  }

  if (model._shadowsDirty) {
    sceneGraph.updateShadows(model._shadows);
    model._shadowsDirty = false;
  }

  if (model._debugShowBoundingVolumeDirty) {
    sceneGraph.updateShowBoundingVolume(model._debugShowBoundingVolume);
    model._debugShowBoundingVolumeDirty = false;
  }

  let updateForAnimations = false;
  // Animations are only applied to models that are shown,
  // but always disabled for classification models.
  if (model.show && !defined(model.classificationType)) {
    updateForAnimations =
      model._userAnimationDirty || model._activeAnimations.update(frameState);
  }
  sceneGraph.update(frameState, updateForAnimations);
  model._userAnimationDirty = false;
}

function updateShowCreditsOnScreen(model) {
  if (!model._showCreditsOnScreenDirty) {
    return;
  }
  model._showCreditsOnScreenDirty = false;
  model._credits.length = 0;

  const showOnScreen = model._showCreditsOnScreen;
  if (defined(model._credit)) {
    const credit = Credit.clone(model._credit);
    credit.showOnScreen = credit.showOnScreen || showOnScreen;
    model._credits.push(credit);
  }

  const resourceCredits = model._resourceCredits;
  const resourceCreditsLength = resourceCredits.length;
  for (let i = 0; i < resourceCreditsLength; i++) {
    const credit = Credit.clone(resourceCredits[i]);
    credit.showOnScreen = credit.showOnScreen || showOnScreen;
    model._credits.push(credit);
  }

  const gltfCredits = model._gltfCredits;
  const gltfCreditsLength = gltfCredits.length;
  for (let i = 0; i < gltfCreditsLength; i++) {
    const credit = Credit.clone(gltfCredits[i]);
    credit.showOnScreen = credit.showOnScreen || showOnScreen;
    model._credits.push(credit);
  }
}

/**
 * Determines whether a model is wholly clipped away by inverse clipping. In
 * inverse mode a model with no polygon geometry lies entirely outside every
 * polygon, so all of it is clipped and it should not be drawn.
 * @param {Model} model
 * @returns {boolean}
 * @private
 */
function isModelClippedAwayByInversePolygons(model) {
  return (
    model.isClippingPolygonsEnabled() &&
    model._clippingPolygons.inverse &&
    (model._clippingPolygonData?.polygonRings.length ?? 0) === 0
  );
}

function submitDrawCommands(model, frameState) {
  // Check that show is true after draw commands are built;
  // we want the user to be able to instantly see the model
  // when show is set to true.

  const displayConditionPassed = passesDistanceDisplayCondition(
    model,
    frameState,
  );

  const invisible = model.isInvisible();
  const silhouette = model.hasSilhouette(frameState);

  // If the model is invisible but has a silhouette, it still
  // needs to draw in order to write to the stencil buffer and
  // render the silhouette.
  const showModel =
    model._show &&
    model._computedScale !== 0 &&
    displayConditionPassed &&
    (!invisible || silhouette) &&
    !isModelClippedAwayByInversePolygons(model);

  const passes = frameState.passes;
  const submitCommandsForPass =
    passes.render || (passes.pick && model.allowPicking);

  if (showModel && !model._ignoreCommands && submitCommandsForPass) {
    addCreditsToCreditDisplay(model, frameState);
    model._sceneGraph.pushDrawCommands(frameState);
  }
}

const scratchBoundingSphere = new BoundingSphere();

function scaleInPixels(positionWC, radius, frameState) {
  scratchBoundingSphere.center = positionWC;
  scratchBoundingSphere.radius = radius;
  return frameState.camera.getPixelSize(
    scratchBoundingSphere,
    frameState.context.drawingBufferWidth,
    frameState.context.drawingBufferHeight,
  );
}

const scratchUpdateHeightCartesian = new Cartesian3();
function getUpdateHeightCallback(model, ellipsoid, originalPostition) {
  return function (clampedPosition) {
    if (isHeightReferenceRelative(model.heightReference)) {
      clampedPosition.height += originalPostition.height;
    }

    ellipsoid.cartographicToCartesian(
      clampedPosition,
      scratchUpdateHeightCartesian,
    );

    const clampedModelMatrix = model._clampedModelMatrix;

    // Modify clamped model matrix to use new height
    Matrix4.clone(model.modelMatrix, clampedModelMatrix);
    clampedModelMatrix[12] = scratchUpdateHeightCartesian.x;
    clampedModelMatrix[13] = scratchUpdateHeightCartesian.y;
    clampedModelMatrix[14] = scratchUpdateHeightCartesian.z;

    model._heightDirty = true;
  };
}

const scratchDisplayConditionCartesian = new Cartesian3();

function passesDistanceDisplayCondition(model, frameState) {
  const condition = model.distanceDisplayCondition;
  if (!defined(condition)) {
    return true;
  }

  const nearSquared = condition.near * condition.near;
  const farSquared = condition.far * condition.far;
  let distanceSquared;

  if (frameState.mode === SceneMode.SCENE2D) {
    const frustum2DWidth =
      frameState.camera.frustum.right - frameState.camera.frustum.left;
    const distance = frustum2DWidth * 0.5;
    distanceSquared = distance * distance;
  } else {
    // Distance to center of primitive's reference frame
    const position = Matrix4.getTranslation(
      model.modelMatrix,
      scratchDisplayConditionCartesian,
    );

    // This will project the position if the scene is in Columbus View,
    // but leave the position as-is in 3D mode.
    SceneTransforms.computeActualEllipsoidPosition(
      frameState,
      position,
      position,
    );

    distanceSquared = Cartesian3.distanceSquared(
      position,
      frameState.camera.positionWC,
    );
  }

  return distanceSquared >= nearSquared && distanceSquared <= farSquared;
}

function addCreditsToCreditDisplay(model, frameState) {
  const creditDisplay = frameState.creditDisplay;
  const credits = model._credits;
  const creditsLength = credits.length;
  for (let c = 0; c < creditsLength; c++) {
    creditDisplay.addCreditToNextFrame(credits[c]);
  }
}

/**
 * Gets whether or not the model is translucent based on its assigned model color.
 * 如果模型颜色的 alpha 值等于零，则视为不可见。
 * 不半透明。
 *
 * @returns {boolean} <code>true</code> 如果模型是半透明的，则为 <code>true</code>，否则为 <code>false</code>。
 * @private
 */
Model.prototype.isTranslucent = function () {
  const color = this.color;
  return defined(color) && color.alpha > 0.0 && color.alpha < 1.0;
};

/**
 * 判断模型是否不可见，即模型颜色的 alpha 值是否等于零。
 * 如果模型不可见，则为 <code>false</code>；否则为 <code>true</code>。
 *
 * @returns {boolean} <code>true</code> 如果模型不可见，则为 <code>false</code>；否则为 <code>true</code>。
 * @private
 */
Model.prototype.isInvisible = function () {
  const color = this.color;
  return defined(color) && color.alpha === 0.0;
};

function supportsSilhouettes(frameState) {
  return frameState.context.stencilBuffer;
}

/**
 * 判断模型是否有轮廓。这涉及到是否支持轮廓（即上下文是否支持模板缓冲区）。
 * 如果支持轮廓（即上下文支持模板缓冲区），则模型会有轮廓；否则没有轮廓。
 * <p>
 * 如果模型用于分类其他模型，其轮廓将被禁用。
 * </p>
 *
 * @param {FrameState} The 帧状态。
 * @returns {boolean} <code>true</code> 如果模型有轮廓，则为 <code>true</code>，否则为 <code>false</code>。
 * @private
 */
Model.prototype.hasSilhouette = function (frameState) {
  return (
    supportsSilhouettes(frameState) &&
    this._silhouetteSize > 0.0 &&
    this._silhouetteColor.alpha > 0.0 &&
    !defined(this._classificationType)
  );
};

/**
 * 判断模型是否属于使用
 * 细节层次跳过优化的瓦片集。这涉及到是否支持细节层次跳过优化（即上下文是否支持模板缓冲区）。
 * 帧状态。
 *
 * @param {FrameState} frameState 如果模型属于使用细节层次跳过优化的瓦片集，则为 <code>false</code>；否则为 <code>true</code>。
 * @returns {boolean} <code>true</code> 判断此模型是否启用了裁剪平面。
 * @private
 */
Model.prototype.hasSkipLevelOfDetail = function (frameState) {
  if (!ModelType.is3DTiles(this.type)) {
    return false;
  }

  const supportsSkipLevelOfDetail = frameState.context.stencilBuffer;
  const tileset = this._content.tileset;
  return supportsSkipLevelOfDetail && tileset.isSkippingLevelOfDetail;
};

/**
 * 如果此模型启用了裁剪平面，则为 <code>false</code>。
 *
 * @returns {boolean} <code>true</code> 查找光线与已渲染的模型表面的交点。光线必须以世界坐标给出。
 * @private
 */
Model.prototype.isClippingEnabled = function () {
  const clippingPlanes = this._clippingPlanes;
  return (
    defined(clippingPlanes) &&
    clippingPlanes.enabled &&
    clippingPlanes.length !== 0
  );
};

/**
 * 用于测试相交的射线。
 *
 * @param {Ray} ray 用于检测相交的射线。
 * @param {FrameState} frameState 帧状态。
 * @param {number} [verticalExaggeration=1.0] 用于放大位置相对于椭球体的高度值的标量。如果值为 1.0，则没有效果。
 * @param {number} [relativeHeight=0.0] 相对于椭球体放大位置的高度值。如果值为 0.0，则位置将相对于椭球体表面放大。
 * @param {Cartesian3|undefined} [result] 交点或 <code>undefined</code>，如果未找到交点。
 * @returns {Cartesian3|undefined} The 交点或 <code>undefined</code>，如果未找到交点。
 *
 * @private
 */
Model.prototype.pick = function (
  ray,
  frameState,
  verticalExaggeration,
  relativeHeight,
  result,
) {
  return pickModel(
    this,
    ray,
    frameState,
    verticalExaggeration,
    relativeHeight,
    result,
  );
};

/**
 * 判断此模型是否启用了裁剪多边形。
 *
 * @returns {boolean} <code>true</code> 如果此模型启用了裁剪多边形，则为 <code>false</code>。
 * @private
 */
Model.prototype.isClippingPolygonsEnabled = function () {
  const clippingPolygons = this._clippingPolygons;
  return (
    defined(clippingPolygons) &&
    clippingPolygons.enabled &&
    clippingPolygons.length !== 0
  );
};

/**
 * 判断此模型是否对披风式矢量数据进行烘焙并可以渲染。
 *
 * @returns {boolean} <code>true</code> 如果模型使用披风式矢量数据。
 * @private
 */
Model.prototype.hasDrapedVectors = function () {
  return this._vectorData?.show === true;
};

/**
 * 如果此对象被销毁，返回 <code>true</code>；否则返回 <code>false</code>。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则 <code>false</code>；否则为 <code>true</code>。
 *
 * @see Model#destroy
 */
Model.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象可确保确定性。
 * 释放 WebGL 资源，而不依赖垃圾收集器来销毁该对象。
 * <br /><br />
 * 一旦对象被销毁，就不应再使用它；调用除
 * <code>isDestroyed</code>之外的任何函数都将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>)赋给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * model = model && model.destroy();
 *
 * @see Model#isDestroyed
 */
Model.prototype.destroy = function () {
  const loader = this._loader;
  if (defined(loader)) {
    loader.destroy();
  }

  const featureTables = this._featureTables;
  if (defined(featureTables)) {
    const length = featureTables.length;
    for (let i = 0; i < length; i++) {
      featureTables[i].destroy();
    }
  }

  this.destroyPipelineResources();
  this.destroyModelResources();

  releaseVectorData(this);

  // Remove callbacks for height reference behavior.
  if (defined(this._removeUpdateHeightCallback)) {
    this._removeUpdateHeightCallback();
    this._removeUpdateHeightCallback = undefined;
  }

  if (defined(this._terrainProviderChangedCallback)) {
    this._terrainProviderChangedCallback();
    this._terrainProviderChangedCallback = undefined;
  }

  // Remove clipping polygon event listeners if this model subscribed to them.
  this._removeClippingPolygonAdded =
    this._removeClippingPolygonAdded && this._removeClippingPolygonAdded();
  this._removeClippingPolygonRemoved =
    this._removeClippingPolygonRemoved && this._removeClippingPolygonRemoved();

  // Only destroy the ClippingPlaneCollection if this is the owner.
  const clippingPlaneCollection = this._clippingPlanes;
  if (
    defined(clippingPlaneCollection) &&
    !clippingPlaneCollection.isDestroyed() &&
    clippingPlaneCollection.owner === this
  ) {
    clippingPlaneCollection.destroy();
  }
  this._clippingPlanes = undefined;

  if (defined(this._clippingPolygonData)) {
    ClippingPolygonCollection.releaseRectangleData(this._clippingPolygonData);
  }
  this._clippingPolygonData = undefined;

  this._clippingPolygons = undefined;

  // Only destroy the ImageBasedLighting if this is the owner.
  if (
    this._shouldDestroyImageBasedLighting &&
    !this._imageBasedLighting.isDestroyed()
  ) {
    this._imageBasedLighting.destroy();
  }
  this._imageBasedLighting = undefined;

  // Only destroy the environment map manager if this is the owner.
  const environmentMapManager = this._environmentMapManager;
  if (
    !environmentMapManager.isDestroyed() &&
    environmentMapManager.owner === this
  ) {
    environmentMapManager.destroy();
  }
  this._environmentMapManager = undefined;

  destroyObject(this);
};

/**
 * 销毁在管道阶段生成的资源
 * 这些资源在重新构建绘制命令时必须被销毁。
 * @private
 */
Model.prototype.destroyPipelineResources = function () {
  const resources = this._pipelineResources;
  for (let i = 0; i < resources.length; i++) {
    resources[i].destroy();
  }
  this._pipelineResources.length = 0;
  this._pickIds.length = 0;
};

/**
 * 销毁在管道阶段生成的资源
 * 这些资源存在于模型的生命周期内。
 * @private
 */
Model.prototype.destroyModelResources = function () {
  const resources = this._modelResources;
  for (let i = 0; i < resources.length; i++) {
    resources[i].destroy();
  }
  this._modelResources.length = 0;
};

/**
 * <p>
 * 异步地从 glTF 资产创建模型。此函数返回一个承诺，当模型准备好渲染时即会解决，即外部二进制文件、图像，
 * 以及着色器文件下载并 WebGL 资源创建完成时。
 * </p>
 * <p>
 * 模型可以是具有 .gltf 扩展名的传统 glTF 资产，也可以是使用 .glb 扩展名的二进制 glTF。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string|Resource} options.url .gltf 或 .glb 文件的 URL。
 * @param {string|Resource} [options.basePath=''] glTF JSON 中的路径所依赖的基础路径。
 * @param {boolean} [options.show=true] 是否渲染模型。
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 将模型从模型坐标转换为世界坐标的 4x4 变换矩阵。
 * @param {number} [options.scale=1.0] 应用于该模型的统一缩放比例。
 * @param {boolean} [options.enableVerticalExaggeration=true] 如果 <code>true</code>，当 {@link Scene.verticalExaggeration} 的值不为 <code>1.0</code> 时，模型将在椭球法线方向被放大。
 * @param {number} [options.minimumPixelSize=0.0] 无论缩放如何，模型的最小近似像素尺寸。
 * @param {number} [options.maximumScale] 模型的最大比例大小。作为 minimumPixelSize 的上限。
 * @param {object} [options.id] 当使用 {@link Scene#pick} 选择模型时返回的用户定义对象。
 * @param {boolean} [options.allowPicking=true] 如果 <code>true</code>，每个primitive都可以通过 {@link Scene#pick} 被选择。
 * @param {boolean} [options.incrementallyLoadTextures=true] 确定在模型加载后是否仍可以继续流式传输纹理。
 * @param {boolean} [options.asynchronous=true] 确定模型 WebGL 资源创建是否会在多个帧中分散进行，或直到所有 glTF 文件加载完成才完成。
 * @param {boolean} [options.clampAnimations=true] 确定模型的动画是否在未指定关键帧的帧中保持姿势。
 * @param {ShadowMode} [options.shadows=ShadowMode.ENABLED] 确定模型是否投射或接收来自光源的阴影。
 * @param {boolean} [options.releaseGltfJson=false] 如果为 true，在加载 glTF 后就会释放 glTF JSON。这对于 3D Tiles 等场景特别有用，因为每个 .gltf 模型都是唯一的，缓存 glTF JSON 并不有效。
 * @param {boolean} [options.debugShowBoundingVolume=false] 仅用于调试。绘制模型中每个绘制命令的边界球体。
 * @param {boolean} [options.enableDebugWireframe=false] 仅用于调试。在 WebGL1 中使 debugWireframe 正常工作时，必须设置为 true。模型加载后无法再次设置。
 * @param {boolean} [options.debugWireframe=false] 仅用于调试。以线框形式绘制模型。只有在 enableDebugWireframe 设置为 true 且使用 WebGL1 时才能生效。
 * @param {boolean} [options.cull=true]  是否使用视锥体/地平线剔除机制来剔除模型。如果模型是 3D Tiles 瓦片集的一部分，此属性将始终为 false，因为使用 3D Tiles 剔除系统。
 * @param {boolean} [options.opaquePass=Pass.OPAQUE] 在 {@link DrawCommand}中用于绘制模型不透明部分的通道。
 * @param {Axis} [options.upAxis=Axis.Y] glTF 模型的上轴。
 * @param {Axis} [options.forwardAxis=Axis.Z] glTF 模型的前轴。
 * @param {CustomShader} [options.customShader] 自定义着色器。此选项会在顶点和片段着色器中添加用户定义的 GLSL 代码。使用自定义着色器与 {@link Cesium3DTileStyle} 结合使用可能导致未定义行为。
 * @param {Cesium3DTileContent} [options.content] 该模型所属的瓦片内容。如果模型未作为瓦片集的一部分加载，此属性将无效。
 * @param {HeightReference} [options.heightReference=HeightReference.NONE] 决定模型相对于地形的绘制方式。
 * @param {Scene} [options.scene] 使用高度参考属性的模型必须传入此参数。
 * @param {DistanceDisplayCondition} [options.distanceDisplayCondition] 指定模型在距相机多远的距离下显示的条件。
 * @param {Color} [options.color] 与模型渲染颜色混合的颜色。
 * @param {ColorBlendMode} [options.colorBlendMode=ColorBlendMode.HIGHLIGHT] 定义颜色与模型的混合方式。
 * @param {number} [options.colorBlendAmount=0.5] 当 <code>colorBlendMode</code> 为 <code>MIX</code> 时，用于确定颜色强度的数值。0.0 表示使用模型的渲染颜色，1.0 表示纯色，中间值则表示两者的混合。
 * @param {EdgeDisplayMode} [options.edgeDisplayMode=EdgeDisplayMode.SURFACES_ONLY] 控制来自 {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility} 扩展的边缘相对于表面几何体的渲染方式。
 * @param {Color} [options.silhouetteColor=Color.RED] 轮廓颜色。如果启用了超过 256 个模型的轮廓，重叠模型可能会出现轻微伪影。
 * @param {number} [options.silhouetteSize=0.0] 轮廓在像素中的大小。
 * @param {boolean} [options.enableShowOutline=true] 是否启用使用 {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展的模型的轮廓线。可以设置为 false 以在加载时避免后处理几何图形。当设置为 false 时，showOutlines 和 outlineColor 选项将被忽略。
 * @param {boolean} [options.showOutline=true] 是否显示使用 {@link https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/CESIUM_primitive_outline|CESIUM_primitive_outline} 扩展的模型轮廓。当为 true 时，将显示轮廓；当为 false 时，不显示轮廓。
 * @param {Color} [options.outlineColor=Color.BLACK] 渲染轮廓时使用的颜色。
 * @param {ClippingPlaneCollection} [options.clippingPlanes] 用于选择性地禁用模型渲染的 {@link ClippingPlaneCollection}。
 * @param {ClippingPolygonCollection} [options.clippingPolygons] 用于选择性地禁用模型渲染的 {@link ClippingPolygonCollection}。
 * @param {Cartesian3} [options.lightColor] 对模型进行阴影渲染时的光颜色。当为 <code>undefined</code> 时，将使用场景的光色。
 * @param {ImageBasedLighting} [options.imageBasedLighting] 用于管理该模型基于影像的照明特性的属性。
 * @param {DynamicEnvironmentMapManager.ConstructorOptions} [options.environmentMapOptions] 用于管理该模型动态环境图的属性。
 * @param {boolean} [options.backFaceCulling=true] 是否剔除背向面的几何图形。当为 true 时，背面剔除由材料的双面属性决定；当为 false 时，背面剔除被禁用。如果模型的颜色是半透明的，则不会剔除背面。
 * @param {Credit|string} [options.credit] 显示在画布上的数据来源标识。
 * @param {boolean} [options.showCreditsOnScreen=false] 是否在屏幕上显示该模型的标识。
 * @param {SplitDirection} [options.splitDirection=SplitDirection.NONE] 应用于该模型的 {@link SplitDirection} 分割方式。
 * @param {boolean} [options.projectTo2D=false] 是否准确将模型位置投影到 2D 空间。如果为 true，模型将被准确投影到 2D 空间，但会消耗更多内存。如果为 false，模型将消耗较少内存，但仍以 2D / CV 模式渲染，其位置可能不准确。此设置会禁用最小像素大小设置，并防止后续修改模型矩阵。在模型加载后无法再次设置。
 * @param {boolean} [options.enablePick=false] 在不使用 WebGL 2 或更高版本时，是否允许使用 <code>pick</code> 进行 CPU 选择操作。如果使用 WebGL 2 或更高版本，此选项将被忽略。如果使用 WebGL 1 且为 true，<code>pick</code> 操作将正常工作，但会消耗更多内存。如果使用 WebGL 1 且为 false，模型将消耗较少内存，但 <code>pick</code> 始终返回 <code>undefined</code>。在模型加载后无法再次设置。
 * @param {string|number} [options.featureIdLabel="featureId_0"] 用于选择和样式化的特征 ID 的标签。对于 EXT_mesh_features，这是特征 ID 的标签属性；如果未指定，则显示为 "featureId_N"（其中 N 是 featureIds 数组中的索引）。EXT_feature_metadata 没有标签字段，因此此类特征 ID 设置总是标记为 "featureId_N"，其中 N 是所有特征 ID 列表中的索引，特征 ID 属性位于特征 ID 纹理之前。如果 featureIdLabel 是一个整数 N，它将自动转换为字符串 "featureId_N"。如果存在按元素和按实例的特征 ID，则实例特征 ID 具有优先权。
 * @param {string|number} [options.instanceFeatureIdLabel="instanceFeatureId_0"] 用于选择和操作样式时使用的实例特征ID集标签。如果 instanceFeatureIdLabel 被设置为整数 N，则自动转换为字符串 "instanceFeatureId_N"。如果存在按元素和按实例的特征ID，则实例特征ID具有优先权。
 * @param {object} [options.pointCloudShading] 用于构建 {@link PointCloudShading} 对象以控制点衰减和光照的选项。
 * @param {ClassificationType} [options.classificationType] 决定该模型是否对地形、3D Tiles或两者进行分类。此设置在模型加载后无法更改。
 * @param {Model.GltfCallback} [options.gltfCallback] 在加载后的 gltf 对象被调用时执行的函数。
 *
 * @returns {Promise<Model>} A 当模型准备渲染时， resolve 为创建的模型。
 *
 * @exception {RuntimeError} The 模型未能加载。
 * @exception {RuntimeError} Unsupported glTF 版本。
 * @exception {RuntimeError} Unsupported glTF 扩展。
 *
 * @example
 * // 加载模型并将其添加到场景中
 * try {
 * const model = await Cesium.Model.fromGltfAsync({
 * url: "../../SampleData/models/CesiumMan/Cesium_Man.glb"
 *  });
 * viewer.scene.primitives.add(model);
 * } catch (error) {
 * console.log(`Failed to load model. ${error}`);
 * }
 *
 * @example
 * // 使用 modelMatrix 定位模型，并使其最小尺寸为 128 像素
 * const position = Cesium.Cartesian3.fromDegrees(
 *   -123.0744619,
 *   44.0503706,
 *   5000.0
 * );
 * const headingPositionRoll = new Cesium.HeadingPitchRoll();
 * const fixedFrameTransform = Cesium.Transforms.localFrameToFixedFrameGenerator(
 * "north",
 * "west"
 * );
 * try {
 * const model = await Cesium.Model.fromGltfAsync({
 * url: "../../SampleData/models/CesiumAir/Cesium_Air.glb",
 * modelMatrix: Cesium.Transforms.headingPitchRollToFixedFrame(
 * position,
 * headingPositionRoll,
 * Cesium.Ellipsoid.WGS84,
 * fixedFrameTransform
 *    ),
 * minimumPixelSize: 128,
 *  });
 * viewer.scene.primitives.add(model);
 * } catch (error) {
 * console.log(`Failed to load model. ${error}`);
 * }
 *
 * @example
 * // 加载模型并以半速播放最后动画
 * let animations;
 * try {
 * const model = await Cesium.Model.fromGltfAsync({
 * url: "../../SampleData/models/CesiumMan/Cesium_Man.glb",
 * gltfCallback: gltf => {
 * animations = gltf.animations
 *    }
 *  });
 * viewer.scene.primitives.add(model);
 * model.readyEvent.addEventListener(() => {
 * model.activeAnimations.add({
 * index: animations.length - 1,
 * loop: Cesium.ModelAnimationLoop.REPEAT,
 * multiplier: 0.5,
 *    });
 *  });
 * } catch (error) {
 * console.log(`Failed to load model. ${error}`);
 * }
 */
Model.fromGltfAsync = async function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(options.url) && !defined(options.gltf)) {
    throw new DeveloperError("options.url is required.");
  }
  //>>includeEnd('debug');

  // options.gltf is used internally for 3D Tiles. It can be a Resource, a URL
  // to a glTF/glb file, a binary glTF buffer, or a JSON object containing the
  // glTF contents.
  const gltf = options.url ?? options.gltf;

  const loaderOptions = {
    releaseGltfJson: options.releaseGltfJson,
    asynchronous: options.asynchronous,
    incrementallyLoadTextures: options.incrementallyLoadTextures,
    upAxis: options.upAxis,
    forwardAxis: options.forwardAxis,
    loadAttributesFor2D: options.projectTo2D,
    enablePick: options.enablePick,
    loadIndicesForWireframe: options.enableDebugWireframe,
    loadPrimitiveOutline: options.enableShowOutline,
    loadForClassification: defined(options.classificationType),
  };

  const basePath = options.basePath ?? "";
  const baseResource = Resource.createIfNeeded(basePath);

  if (defined(gltf.asset)) {
    loaderOptions.gltfJson = gltf;
    loaderOptions.baseResource = baseResource;
    loaderOptions.gltfResource = baseResource;
  } else if (gltf instanceof Uint8Array) {
    loaderOptions.typedArray = gltf;
    loaderOptions.baseResource = baseResource;
    loaderOptions.gltfResource = baseResource;
  } else {
    loaderOptions.gltfResource = Resource.createIfNeeded(gltf);
  }

  const loader = new GltfLoader(loaderOptions);

  const is3DTiles = defined(options.content);
  const type = is3DTiles ? ModelType.TILE_GLTF : ModelType.GLTF;

  const resource = loaderOptions.gltfResource;

  const modelOptions = makeModelOptions(loader, type, options);
  modelOptions.resource = resource;
  modelOptions.environmentMapOptions = options.environmentMapOptions;

  try {
    // This load the gltf JSON and ensures the gltf is valid
    // Further resource loading is handled synchronously in loader.process(), and requires
    // hooking into model's update() as the frameState is needed
    await loader.load();
  } catch (error) {
    loader.destroy();
    throw ModelUtility.getError("model", resource, error);
  }

  const gltfCallback = options.gltfCallback;
  if (defined(gltfCallback)) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.func("options.gltfCallback", gltfCallback);
    //>>includeEnd('debug');

    gltfCallback(loader.gltfJson);
  }

  const model = new Model(modelOptions);

  const resourceCredits = model._resource.credits;
  if (defined(resourceCredits)) {
    const length = resourceCredits.length;
    for (let i = 0; i < length; i++) {
      model._resourceCredits.push(Credit.clone(resourceCredits[i]));
    }
  }

  return model;
};

/*
 * @private
 */
Model.fromB3dm = async function (options) {
  const loaderOptions = {
    b3dmResource: options.resource,
    arrayBuffer: options.arrayBuffer,
    byteOffset: options.byteOffset,
    releaseGltfJson: options.releaseGltfJson,
    asynchronous: options.asynchronous,
    incrementallyLoadTextures: options.incrementallyLoadTextures,
    upAxis: options.upAxis,
    forwardAxis: options.forwardAxis,
    loadAttributesFor2D: options.projectTo2D,
    enablePick: options.enablePick,
    loadIndicesForWireframe: options.enableDebugWireframe,
    loadPrimitiveOutline: options.enableShowOutline,
    loadForClassification: defined(options.classificationType),
  };

  const loader = new B3dmLoader(loaderOptions);

  try {
    await loader.load();

    const modelOptions = makeModelOptions(loader, ModelType.TILE_B3DM, options);
    const model = new Model(modelOptions);
    return model;
  } catch (error) {
    loader.destroy();
    throw error;
  }
};

/**
 * @private
 */
Model.fromPnts = async function (options) {
  const loaderOptions = {
    arrayBuffer: options.arrayBuffer,
    byteOffset: options.byteOffset,
    loadAttributesFor2D: options.projectTo2D,
  };
  const loader = new PntsLoader(loaderOptions);

  try {
    await loader.load();
    const modelOptions = makeModelOptions(loader, ModelType.TILE_PNTS, options);
    const model = new Model(modelOptions);
    return model;
  } catch (error) {
    loader.destroy();
    throw error;
  }
};

/*
 * @private
 */
Model.fromI3dm = async function (options) {
  const loaderOptions = {
    i3dmResource: options.resource,
    arrayBuffer: options.arrayBuffer,
    byteOffset: options.byteOffset,
    releaseGltfJson: options.releaseGltfJson,
    asynchronous: options.asynchronous,
    incrementallyLoadTextures: options.incrementallyLoadTextures,
    upAxis: options.upAxis,
    forwardAxis: options.forwardAxis,
    loadAttributesFor2D: options.projectTo2D,
    enablePick: options.enablePick,
    loadIndicesForWireframe: options.enableDebugWireframe,
    loadPrimitiveOutline: options.enableShowOutline,
  };
  const loader = new I3dmLoader(loaderOptions);

  try {
    await loader.load();

    const modelOptions = makeModelOptions(loader, ModelType.TILE_I3DM, options);
    const model = new Model(modelOptions);
    return model;
  } catch (error) {
    loader.destroy();
    throw error;
  }
};

/*
 * @private
 */
Model.fromGeoJson = async function (options) {
  const loaderOptions = {
    geoJson: options.geoJson,
  };
  const loader = new GeoJsonLoader(loaderOptions);
  const modelOptions = makeModelOptions(
    loader,
    ModelType.TILE_GEOJSON,
    options,
  );
  const model = new Model(modelOptions);
  return model;
};

const scratchColor = new Color();

/**
 * @private
 */
Model.prototype.applyColorAndShow = function (style) {
  const previousColor = Color.clone(this._color, scratchColor);
  const hasColorStyle = defined(style) && defined(style.color);
  const hasShowStyle = defined(style) && defined(style.show);

  this._color = hasColorStyle
    ? style.color.evaluateColor(undefined, this._color)
    : Color.clone(Color.WHITE, this._color);
  this._show = hasShowStyle ? style.show.evaluate(undefined) : true;

  if (isColorAlphaDirty(previousColor, this._color)) {
    this.resetDrawCommands();
  }
};

/**
 * @private
 */
Model.prototype.applyStyle = function (style) {
  const isPnts = this.type === ModelType.TILE_PNTS;

  const hasFeatureTable =
    defined(this.featureTableId) &&
    this.featureTables[this.featureTableId].featuresLength > 0;

  const propertyAttributes = defined(this.structuralMetadata)
    ? this.structuralMetadata.propertyAttributes
    : undefined;
  const hasPropertyAttributes =
    defined(propertyAttributes) && defined(propertyAttributes[0]);

  // Point clouds will be styled on the GPU unless they contain a batch table.
  // That is, CPU styling will not be applied if:
  // - points have no metadata at all, or
  // - points have metadata stored as a property attribute
  if (isPnts && (!hasFeatureTable || hasPropertyAttributes)) {
    // Commands are rebuilt for point cloud styling since the new style may
    // contain different shader functions.
    this.resetDrawCommands();
    return;
  }

  // The style is only set by the ModelFeatureTable. If there are no features,
  // the color and show from the style are directly applied.
  if (hasFeatureTable) {
    const featureTable = this.featureTables[this.featureTableId];
    featureTable.applyStyle(style);
    updateStyleCommandsNeeded(this, style);
  } else {
    this.applyColorAndShow(style);
    this._styleCommandsNeeded = undefined;
  }
};

function makeModelOptions(loader, modelType, options) {
  return {
    loader: loader,
    type: modelType,
    resource: options.resource,
    show: options.show,
    modelMatrix: options.modelMatrix,
    scale: options.scale,
    enableVerticalExaggeration: options.enableVerticalExaggeration,
    minimumPixelSize: options.minimumPixelSize,
    maximumScale: options.maximumScale,
    id: options.id,
    allowPicking: options.allowPicking,
    clampAnimations: options.clampAnimations,
    shadows: options.shadows,
    debugShowBoundingVolume: options.debugShowBoundingVolume,
    enableDebugWireframe: options.enableDebugWireframe,
    debugWireframe: options.debugWireframe,
    cull: options.cull,
    opaquePass: options.opaquePass,
    customShader: options.customShader,
    content: options.content,
    heightReference: options.heightReference,
    scene: options.scene,
    distanceDisplayCondition: options.distanceDisplayCondition,
    color: options.color,
    colorBlendAmount: options.colorBlendAmount,
    colorBlendMode: options.colorBlendMode,
    edgeDisplayMode: options.edgeDisplayMode,
    silhouetteColor: options.silhouetteColor,
    silhouetteSize: options.silhouetteSize,
    enableShowOutline: options.enableShowOutline,
    showOutline: options.showOutline,
    outlineColor: options.outlineColor,
    clippingPlanes: options.clippingPlanes,
    clippingPolygons: options.clippingPolygons,
    lightColor: options.lightColor,
    imageBasedLighting: options.imageBasedLighting,
    backFaceCulling: options.backFaceCulling,
    credit: options.credit,
    showCreditsOnScreen: options.showCreditsOnScreen,
    splitDirection: options.splitDirection,
    projectTo2D: options.projectTo2D,
    enablePick: options.enablePick,
    featureIdLabel: options.featureIdLabel,
    instanceFeatureIdLabel: options.instanceFeatureIdLabel,
    pointCloudShading: options.pointCloudShading,
    classificationType: options.classificationType,
    pickObject: options.pickObject,
  };
}

/**
 * 加载后的 gltf 对象被调用时使用的函数接口。
 * @callback Model.GltfCallback
 *
 * @param {object} gltf gltf 对象
 */

export default Model;