import {
  BoundingRectangle,
  BoundingSphere,
  BoxGeometry,
  Cartesian3,
  Cartographic,
  Check,
  Color,
  ColorGeometryInstanceAttribute,
  CullingVolume,
  DeveloperError,
  Ellipsoid,
  EllipsoidGeometry,
  Event,
  FixedFrameTransforms,
  Frozen,
  GeographicProjection,
  GeometryInstance,
  GeometryPipeline,
  Intersect,
  JulianDate,
  Math as CesiumMath,
  Matrix4,
  Occluder,
  OrthographicFrustum,
  OrthographicOffCenterFrustum,
  PerspectiveFrustum,
  PerspectiveOffCenterFrustum,
  Rectangle,
  clone,
  createGuid,
  defined,
  destroyObject,
  mergeSort,
} from "@cesium/core";
import HeightReference, { isHeightReferenceClamp } from "./HeightReference.js";
import RequestScheduler from "../Core/RequestScheduler.js";
import TaskProcessor from "../Core/TaskProcessor.js";
import VectorProvider from "../Core/VectorProvider.js";
import ClearCommand from "../Renderer/ClearCommand.js";
import ComputeEngine from "../Renderer/ComputeEngine.js";
import Context from "../Renderer/Context.js";
import ContextLimits from "../Renderer/ContextLimits.js";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import Atmosphere from "./Atmosphere.js";
import BrdfLutGenerator from "./BrdfLutGenerator.js";
import Camera from "./Camera.js";
import Cesium3DTilePass from "./Cesium3DTilePass.js";
import Cesium3DTilePassState from "./Cesium3DTilePassState.js";
import ControllerHost from "./Controllers/ControllerHost.js";
import CreditDisplay from "./CreditDisplay.js";
import DebugCameraPrimitive from "./DebugCameraPrimitive.js";
import DepthPlane from "./DepthPlane.js";
import DerivedCommand from "./DerivedCommand.js";
import DeviceOrientationCameraController from "./DeviceOrientationCameraController.js";
import DynamicAtmosphereLightingType from "./DynamicAtmosphereLightingType.js";
import Fog from "./Fog.js";
import FrameState from "./FrameState.js";
import GlobeTranslucencyState from "./GlobeTranslucencyState.js";
import InvertClassification from "./InvertClassification.js";
import JobScheduler from "./JobScheduler.js";
import MapMode2D from "./MapMode2D.js";
import PerformanceDisplay from "./PerformanceDisplay.js";
import PerInstanceColorAppearance from "./PerInstanceColorAppearance.js";
import Picking from "./Picking.js";
import PostProcessStageCollection from "./PostProcessStageCollection.js";
import Primitive from "./Primitive.js";
import PrimitiveCollection from "./PrimitiveCollection.js";
import SceneMode from "./SceneMode.js";
import SceneTransforms from "./SceneTransforms.js";
import SceneTransitioner from "./SceneTransitioner.js";
import ScreenSpaceCameraController from "./ScreenSpaceCameraController.js";
import ShadowMap from "./ShadowMap.js";
import SharedContext from "../Renderer/SharedContext.js";
import Snapping from "./Snapping.js";
import SpecularEnvironmentCubeMap from "./SpecularEnvironmentCubeMap.js";
import StencilConstants from "./StencilConstants.js";
import SunLight from "./SunLight.js";
import SunPostProcess from "./SunPostProcess.js";
import TweenCollection from "./TweenCollection.js";
import View from "./View.js";
import DebugInspector from "./DebugInspector.js";
import VoxelCell from "./VoxelCell.js";
import VoxelPrimitive from "./VoxelPrimitive.js";
import getMetadataClassProperty from "./getMetadataClassProperty.js";
import PickedMetadataInfo from "./PickedMetadataInfo.js";
import getMetadataProperty from "./getMetadataProperty.js";

/** @ignore */
const requestRenderAfterFrame = function (scene) {
  return function () {
    scene.frameState.afterRender.push(function () {
      scene.requestRender();
    });
  };
};

/**
 * 这是 Cesium 虚拟场景中所有 3D 图形对象和状态的容器。通常，
 * 场景不会直接创建，而是由 {@link CesiumWidget} 隐式创建。
 *
 * @alias Scene
 * @constructor
 *
 * @param {object} options 具有以下属性的实体：
 * @param {HTMLCanvasElement} options.canvas 用于创建场景的 HTML canvas 元素。
 * @param {ContextOptions} [options.contextOptions] 上下文和 WebGL 创建属性。
 * @param {Element} [options.creditContainer] 用于显示字幕的 HTML 元素。如果未指定，将创建一个字幕容器并作为 canvas 的兄弟元素添加。
 * @param {Element} [options.creditViewport] 用于显示字幕弹窗的 HTML 元素。如果未指定，将添加一个视口作为 canvas 的兄弟元素。
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 默认椭球体。如果未指定，则使用默认椭球体。
 * @param {MapProjection} [options.mapProjection=new GeographicProjection(options.ellipsoid)] 在 2D 和 Columbus View 模式下使用的地图投影。
 * @param {boolean} [options.orderIndependentTranslucency=true] 如果为 true 且配置支持，则使用顺序无关的半透明效果。
 * @param {boolean} [options.scene3DOnly=false] 如果为 true，将优化 3D 模式下的内存使用和性能，但会禁用 2D 或 Columbus View 的使用能力。
 * @param {boolean} [options.shadows=false] 决定光源是否产生阴影。
 * @param {MapMode2D} [options.mapMode2D=MapMode2D.INFINITE_SCROLL] 决定 2D 地图是否可以旋转或在水平方向无限滚动。
 * @param {boolean} [options.requestRenderMode=false] 如果为 true，渲染帧仅在根据场景变化需要时发生。启用此功能可提升应用性能，但需要在这种模式下使用 {@link Scene#requestRender} 显式渲染新帧。在 API 的其他部分对场景进行更改后，许多情况下都需要这样做。请参阅 {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}。
 * @param {number} [options.maximumRenderTimeChange=0.0] 如果 requestRenderMode 为 true，此值定义了在请求渲染之前允许的最大模拟时间变化量。请参阅 {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}。
 * @param {number} [options.depthPlaneEllipsoidOffset=0.0] 调整 DepthPlane 以解决椭球体零高度以下的渲染伪影问题。
 * @param {number} [options.msaaSamples=4] 如果提供，此值控制多样本抗锯齿的速率。常见的多样本率分别为每像素 2、4 或有时 8 个样本。更高的 MSAA 采样率可能会提升视觉质量，但会影响性能。此值仅适用于支持多样本渲染目标的 WebGL2 上下文。设置为 1 可禁用 MSAA。
 *
 * @see CesiumWidget
 * @see {@link http://www.khronos.org/registry/webgl/specs/latest/#5.2|WebGLContextAttributes}
 *
 * @exception {DeveloperError} options 需要 options.canvas。
 *
 * @example
 * // 创建场景时禁用各向异性纹理过滤
 * const scene = new Cesium.Scene({
 * canvas : canvas,
 * contextOptions : {
 * allowTextureFilterAnisotropic : false
 *   }
 * });
 */
function Scene(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const canvas = options.canvas;
  let creditContainer = options.creditContainer;
  let creditViewport = options.creditViewport;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(canvas)) {
    throw new DeveloperError("options and options.canvas are required.");
  }
  //>>includeEnd('debug');

  const countReferences = options.contextOptions instanceof SharedContext;
  if (countReferences) {
    this._context = options.contextOptions.createSceneContext(canvas);
  } else {
    const contextOptions = clone(options.contextOptions);
    this._context = new Context(canvas, contextOptions);
  }
  const context = this._context;

  const hasCreditContainer = defined(creditContainer);
  if (!hasCreditContainer) {
    creditContainer = document.createElement("div");
    creditContainer.style.position = "absolute";
    creditContainer.style.bottom = "0";
    creditContainer.style["text-shadow"] = "0 0 2px #000000";
    creditContainer.style.color = "#ffffff";
    creditContainer.style["font-size"] = "10px";
    creditContainer.style["padding-right"] = "5px";
    canvas.parentNode.appendChild(creditContainer);
  }
  if (!defined(creditViewport)) {
    creditViewport = canvas.parentNode;
  }

  this._id = createGuid();
  this._jobScheduler = new JobScheduler();
  this._frameState = new FrameState(
    context,
    new CreditDisplay(creditContainer, "•", creditViewport),
    this._jobScheduler,
  );
  this._frameState.scene3DOnly = options.scene3DOnly ?? false;
  this._removeCreditContainer = !hasCreditContainer;
  this._creditContainer = creditContainer;

  this._canvas = canvas;
  this._computeEngine = new ComputeEngine(context);

  this._ellipsoid = options.ellipsoid ?? Ellipsoid.default;
  this._globe = undefined;
  this._globeTranslucencyState = new GlobeTranslucencyState();
  this._primitives = new PrimitiveCollection({ countReferences });
  this._groundPrimitives = new PrimitiveCollection({ countReferences });

  this._globeHeight = undefined;
  this._globeHeightDirty = true;
  this._cameraUnderground = false;
  this._removeUpdateHeightCallback = undefined;

  this._logDepthBuffer = Scene.defaultLogDepthBuffer && context.fragmentDepth;
  this._logDepthBufferDirty = true;

  this._tweens = new TweenCollection();

  this._shaderFrameCount = 0;

  this._sunPostProcess = undefined;

  this._computeCommandList = [];
  this._overlayCommandList = [];

  this._useOIT = options.orderIndependentTranslucency ?? true;
  /**
   * 该函数用于在
   * useOIT 为 true 时执行半透明命令。此函数在
   * obtainTranslucentCommandExecutionFunction 中创建一次，然后在此缓存。
   * @private
   */
  this._executeOITFunction = undefined;

  this._depthPlane = new DepthPlane(options.depthPlaneEllipsoidOffset);

  this._clearColorCommand = new ClearCommand({
    color: new Color(),
    stencil: 0,
    owner: this,
  });
  this._depthClearCommand = new ClearCommand({
    depth: 1.0,
    owner: this,
  });
  this._stencilClearCommand = new ClearCommand({
    stencil: 0,
  });
  this._classificationStencilClearCommand = new ClearCommand({
    stencil: 0,
    renderState: RenderState.fromCache({
      stencilMask: StencilConstants.CLASSIFICATION_MASK,
    }),
  });

  this._depthOnlyRenderStateCache = {};

  this._transitioner = new SceneTransitioner(this);

  this._preUpdate = new Event();
  this._postUpdate = new Event();

  this._renderError = new Event();
  this._preRender = new Event();
  this._postRender = new Event();

  this._controllerHost = new ControllerHost();

  this._minimumDisableDepthTestDistance = 0.0;
  this._debugInspector = new DebugInspector();

  this._msaaSamples = options.msaaSamples ?? 4;

  /**
   * 在 <code>render</code> 中发生的异常总是被捕获，以触发
   * <code>renderError</code> 事件。如果此属性为 true，则错误会在事件触发后重新抛出。如果此属性为 false，则 <code>render</code> 函数会在触发事件后正常返回。
   * 决定是否在用户输入时立即完成
   * 场景过渡动画。
   *
   * @type {boolean}
   * @default false
   */
  this.rethrowRenderErrors = false;

  /**
   * 在场景过渡开始时触发该事件。
   * 在场景过渡完成时触发该事件。
   *
   * @type {boolean}
   * @default true
   */
  this.completeMorphOnUserInput = true;

  /**
   * 用于绘制星星的 {@link SkyBox}。
   * @type {Event}
   * @default Event()
   */
  this.morphStart = new Event();

  /**
   * 围绕地球绘制的天空氛围。
   * @type {Event}
   * @default Event()
   */
  this.morphComplete = new Event();

  /**
   * 绘制星星的 {@link Sun}。
   *
   * @type {SkyBox | undefined}
   * @default undefined
   *
   * @see Scene#backgroundColor
   */
  this.skyBox = undefined;

  /**
   * 启用时，太阳上使用光晕滤镜。
   *
   * @type {SkyAtmosphere | undefined}
   * @default undefined
   */
  this.skyAtmosphere = undefined;

  /**
   * 绘制 {@link Moon}。
   *
   * @type {Sun | undefined}
   * @default undefined
   */
  this.sun = undefined;

  /**
   * 启用时，太阳上使用光晕滤镜。
   *
   * @type {boolean}
   * @default true
   */
  this.sunBloom = true;
  this._sunBloom = undefined;

  /**
   * 绘制 {@link Moon}。
   *
   * @type {Moon | undefined}
   * @default undefined
   */
  this.moon = undefined;

  /**
   * 背景颜色，仅当没有天空框且 {@link Scene#skyBox} 为 <code>undefined</code> 时可见。
   *
   * @type {Color}
   * @default {@link Color.BLACK}
   *
   * @see Scene#skyBox
   */
  this.backgroundColor = Color.clone(Color.BLACK);

  this._mode = SceneMode.SCENE3D;

  this._mapProjection = defined(options.mapProjection)
    ? options.mapProjection
    : new GeographicProjection(this._ellipsoid);

  /**
   * 2D/Columbus View 与 3D 之间的当前形态过渡时间，
   * 0.0 表示 2D 或 Columbus View，1.0 表示 3D。
   *
   * @type {number}
   * @default 1.0
   */
  this.morphTime = 1.0;

  /**
   * 使用常规深度缓冲时多视锥体的远近比例。
   * <p>
   * 该值用于创建多视锥体的每个视锥体的近值和远值。它仅在
   * {@link Scene#logarithmicDepthBuffer} 为 <code>false</code> 时使用。当 <code>logarithmicDepthBuffer</code> 为
   * <code>true</code> 时，使用 {@link Scene#logarithmicDepthFarToNearRatio}。
   * </p>
   *
   * @type {number}
   * @default 1000.0
   */
  this.farToNearRatio = 1000.0;

  /**
   * 使用对数深度缓冲时多视锥体的远近比例。
   * <p>
   * 该值用于创建多视锥体的每个视锥体的近值和远值。它仅在
   * {@link Scene#logarithmicDepthBuffer} 为 <code>true</code> 时使用。当 <code>logarithmicDepthBuffer</code> 为
   * <code>false</code> 时，使用 {@link Scene#farToNearRatio}。
   * </p>
   *
   * @type {number}
   * @default 1e9
   */
  this.logarithmicDepthFarToNearRatio = 1e9;

  /**
   * 确定 2D 中多视锥体的每个视锥体的均匀深度大小（以米为单位）。如果任何原始对象或模型靠近表面导致 z 重叠，减小此值可以消除伪影，但会降低性能。
   * 另一方面，增加此值会提高性能，但可能导致靠近表面的原始对象出现 z 重叠。
   * other hand, increasing this will increase performance but may cause z-fighting among primitives close to the surface.
   *
   * @type {number}
   * @default 1.75e6
   */
  this.nearToFarDistance2D = 1.75e6;

  /**
   * 场景的垂直放大比例。
   * 设置为 1.0 时，不应用放大。
   *
   * @type {number}
   * @default 1.0
   */
  this.verticalExaggeration = 1.0;

  /**
   * 场景垂直放大的参考高度。
   * 设置为 0.0 时，放大是相对于椭球表面进行的。
   *
   * @type {number}
   * @default 0.0
   */
  this.verticalExaggerationRelativeHeight = 0.0;

  /**
   * 此属性仅用于调试，不用于生产环境使用。
   * <p>
   * 一个决定执行哪些命令的函数。如下例所示，
   * 该函数将命令的 <code>owner</code> 作为参数传入，并返回布尔值指示是否应执行该命令。
   * 默认值为 <code>undefined</code>，表示所有命令均被执行。
   * </p>
   * <p>
   * // 不执行任何命令。
   * </p>
   *
   * @type {Function | undefined}
   *
   * @default undefined
   *
   * @example
   * scene.debugCommandFilter = function(command) {
   * return false;
   * // 仅执行广告牌的命令。即只绘制广告牌。
   * };
   *
   * const billboards = new Cesium.BillboardCollection();
   * scene.debugCommandFilter = function(command) {
   * return command.owner === billboards;
   * 此属性仅用于调试，不用于生产环境使用。
   * };
   */
  this.debugCommandFilter = undefined;

  /**
   * 当 <code>true</code> 时，命令会随机着色。这有助于
   * <p>
   * 进行性能分析，以查看场景或模型中的哪些部分
   * 命令密集且适合批量处理。
   * 此属性仅用于调试，不用于生产环境使用。
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowCommands = false;

  /**
   * 当 <code>true</code> 时，命令根据它们重叠的视锥体进行着色。
   * <p>
   * 在最近的视锥体中，命令被染成红色；在次近的视锥体中，命令被染成绿色；在最远的视锥体中，命令被染成蓝色。如果一个命令同时与多个视锥体重叠，颜色成分会被合并，例如，与前两个视锥体重叠的命令被染成黄色。
   * 此属性仅用于调试，不用于生产环境使用。
   * 显示每秒帧数及帧间时间。
   * 此属性仅用于调试，不用于生产环境使用。
   * 指示哪个视锥体将显示深度信息。
   * 此属性仅用于调试，不用于生产环境使用。
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowFrustums = false;

  /**
   * 当 <code>true</code> 时，绘制轮廓线以显示相机视锥体的边界。
   * <p>
   * 当 <code>true</code> 时，启用使用深度缓冲进行拾取。
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowFramesPerSecond = false;

  /**
   * 当 <code>true</code> 时，启用使用深度缓冲对半透明几何图形进行拾取。注意，要使此功能生效，还必须使 {@link Scene#useDepthPicking} 为 true。
   * <p>
   * 启用后性能会下降。需要额外的绘制调用来写入深度信息。
   * </p>
   *
   * @type {number}
   *
   * @default 1
   */
  this.debugShowDepthFrustum = 1;

  /**
   * This property is for debugging only; it is not for production use.
   * <p>
   * When <code>true</code>, draws outlines to show the boundaries of the camera frustums
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowFrustumPlanes = false;
  this._debugShowFrustumPlanes = false;
  this._debugFrustumPlanes = undefined;

  /**
   * When <code>true</code>, enables picking using the depth buffer.
   *
   * @type {boolean}
   * @default true
   */
  this.useDepthPicking = true;

  /**
   * When <code>true</code>, enables picking translucent geometry using the depth buffer. Note that {@link Scene#useDepthPicking} must also be true for enabling this to work.
   *
   * <p>
   * There is a decrease in performance when enabled. There are extra draw calls to write depth for
   * 半透明几何图形。
   * </p>
   *
   * @example
   * // 选择半透明基体的位置
   * viewer.screenSpaceEventHandler.setInputAction(function onLeftClick(movement) {
   * const pickedFeature = viewer.scene.pick(movement.position);
   * if (!Cesium.defined(pickedFeature)) {
   * // 未选择任何内容
   * return;
   *      }
   * const worldPosition = viewer.scene.pickPosition(movement.position);
   * }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
   *
   * @type {boolean}
   * @default false
   */
  this.pickTranslucentDepth = false;

  /**
   * 在检查相机是否未移动并触发 cameraMoveEnd 事件之前等待的毫秒数。
   * @type {number}
   * @default 500.0
   * @private
   */
  this.cameraEventWaitTime = 500.0;

  /**
   * 用于影响 3D Tiles 和模型渲染的氛围照明效果设置。此设置不应与
   * {@link Scene#skyAtmosphere} 混淆，后者负责渲染天空。
   *
   * @type {Atmosphere}
   */
  this.atmosphere = new Atmosphere();

  /**
   * 在距离相机较远的几何图形上混合氛围，以呈现地平线视图。允许通过渲染更少的几何图形和发送更少的地形请求来提升性能。
   * 如果使用非 WGS84 的椭球体，此功能将被默认禁用。
   *
   * 场景光源的阴影图。当启用时，模型、基体和地球仪可以投射和接收阴影。
   * @type {Fog}
   */
  this.fog = new Fog();
  this.fog.enabled = Ellipsoid.WGS84.equals(this._ellipsoid);

  if (!Ellipsoid.WGS84.equals(this._ellipsoid)) {
    Camera.DEFAULT_VIEW_RECTANGLE = Rectangle.fromDegrees(
      -45.0,
      -45.0,
      45.0,
      45.0,
    );
  }

  this._shadowMapCamera = new Camera(this);

  /**
   * 当 <code>false</code> 时，3D Tiles 将正常渲染。当 <code>true</code> 时，分类后的 3D Tile 几何图形将正常渲染，而
   * @type {ShadowMap}
   */
  this.shadowMap = new ShadowMap({
    context: context,
    lightCamera: this._shadowMapCamera,
    enabled: options.shadows ?? false,
  });

  /**
   * 未分类的 3D Tile 几何图形将使用 {@link Scene#invertClassificationColor} 乘以的颜色进行渲染。
   * 当 {@link Scene#invertClassification} 为 <code>true</code> 时，未分类 3D Tile 几何图形的高亮颜色。
   * @type {boolean}
   * @default false
   */
  this.invertClassification = false;

  /**
   * 当 {@link Scene#invertClassification} 为 <code>true</code> 时，未分类 3D Tile 几何图形的高亮颜色。
   * <p>当颜色的 alpha 值小于 1.0 时，3D Tiles 的未分类部分将无法与分类后的位置正确混合。</p>
   * <p>此外，当颜色的 alpha 值小于 1.0 时，必须支持 WEBGL_depth_texture 和 EXT_frag_depth WebGL 扩展。</p>
   * @type {Color}
   * @default Color.WHITE
   */
  this.invertClassificationColor = Color.clone(Color.WHITE);

  this._actualInvertClassificationColor = Color.clone(
    this._invertClassificationColor,
  );
  this._invertClassification = new InvertClassification();

  /**
   * 在 cardboard 或 WebVR 中使用的焦距。
   * @type {number}
   */
  this.focalLength = undefined;

  /**
   * 用于 cardboard 或 WebVR 的眼睛间距距离（以米为单位）。
   * @type {number}
   */
  this.eyeSeparation = undefined;

  /**
   * 应用于最终渲染的后处理效果。
   * @type {PostProcessStageCollection}
   */
  this.postProcessStages = new PostProcessStageCollection();

  this._brdfLutGenerator = new BrdfLutGenerator();

  this._performanceDisplay = undefined;
  this._debugVolume = undefined;

  this._screenSpaceCameraController = new ScreenSpaceCameraController(this);
  this._cameraUnderground = false;
  this._mapMode2D = options.mapMode2D ?? MapMode2D.INFINITE_SCROLL;

  // Keeps track of the state of a frame. FrameState is the state across
  // the primitives of the scene. This state is for internally keeping track
  // of celestial and environment effects that need to be updated/rendered in
  // a certain order as well as updating/tracking framebuffer usage.
  this._environmentState = {
    skyBoxCommand: undefined,
    skyAtmosphereCommand: undefined,
    sunDrawCommand: undefined,
    sunComputeCommand: undefined,
    moonCommand: undefined,

    isSunVisible: false,
    isMoonVisible: false,
    isReadyForAtmosphere: false,
    isSkyAtmosphereVisible: false,

    clearGlobeDepth: false,
    useDepthPlane: false,
    renderTranslucentDepthForPick: false,

    originalFramebuffer: undefined,
    useGlobeDepthFramebuffer: false,
    useOIT: false,
    useInvertClassification: false,
    usePostProcess: false,
    usePostProcessSelected: false,
    useWebVR: false,
  };

  this._useWebVR = false;
  this._cameraVR = undefined;
  this._aspectRatioVR = undefined;

  /**
   * 当 <code>true</code> 时，渲染帧仅在根据场景变化需要时才发生。
   * 启用此功能可提升应用性能，但需要在此模式下显式使用 {@link Scene#requestRender} 来渲染新帧。在许多情况下，在 API 的其他部分对场景进行更改后，这将是必要的。
   * to render a new frame explicitly in this mode. This will be necessary in many cases after making changes
   * to the scene in other parts of the API.
   *
   * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}
   * @see Scene#maximumRenderTimeChange
   * @see Scene#requestRender
   *
   * @type {boolean}
   * @default false
   */
  this.requestRenderMode = options.requestRenderMode ?? false;
  this._renderRequested = true;

  /**
   * 如果 {@link Scene#requestRenderMode} 为 <code>true</code>，则此值定义了允许模拟时间变化的最大范围。
   * 在请求渲染之前，模拟时间允许变化的幅度。较低的值会渲染更多帧；较高的值则会减少渲染帧数。如果为 <code>undefined</code>，则模拟时间的任何变化都不会触发渲染。
   * 此值影响场景变化时的渲染速率，例如光照变化和实体属性更新，以及动画效果。
   * 场景相机飞行目的地的相机视图。用于预加载飞行目的地瓦片。
   * 场景相机飞行目的地的剔除体积。用于预加载飞行目的地瓦片。
   * 用于基于图像的 PBR 模型光照的球面调和系数。
   *
   * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}
   * @see Scene#requestRenderMode
   *
   * @type {number}
   * @default 0.0
   */
  this.maximumRenderTimeChange = options.maximumRenderTimeChange ?? 0.0;
  this._lastRenderTime = undefined;
  this._frameRateMonitor = undefined;

  this._removeRequestListenerCallback =
    RequestScheduler.requestCompletedEvent.addEventListener(
      requestRenderAfterFrame(this),
    );
  this._removeTaskProcessorListenerCallback =
    TaskProcessor.taskCompletedEvent.addEventListener(
      requestRenderAfterFrame(this),
    );
  this._removeGlobeCallbacks = [];
  this._removeTerrainProviderReadyListener = undefined;

  const viewport = new BoundingRectangle(
    0,
    0,
    context.drawingBufferWidth,
    context.drawingBufferHeight,
  );
  const camera = new Camera(this);

  if (this._logDepthBuffer) {
    camera.frustum.near = 0.1;
    camera.frustum.far = 10000000000.0;
  }

  /**
   * 包含用于基于图像的 PBR 模型镜面环境图和复杂 MIP 映射的 KTX2 文件链接地址。
   * @type {Camera}
   * @private
   */
  this.preloadFlightCamera = new Camera(this);

  /**
   * 用于基于图像的 PBR 模型光照的平面填充功能 ID 预处理。场景相机飞行目的地的剔除体积。用于预加载飞行目的地瓦片。
   * @type {CullingVolume}
   * @private
   */
  this.preloadFlightCullingVolume = undefined;

  this._picking = new Picking(this);
  this._defaultView = new View(this, camera, viewport);
  this._view = this._defaultView;

  this._hdr = undefined;
  this._hdrDirty = undefined;
  this.highDynamicRange = false;
  this.gamma = 2.2;

  /**
   * 用于基于图像的 PBR 模型光照的球面调和系数。
   * @type {Cartesian3[]}
   */
  this.sphericalHarmonicCoefficients = undefined;

  /**
   * 包含镜面环境图和复杂 MIP 映射的 KTX2 文件链接地址。
   * @type {string}
   */
  this.specularEnvironmentMaps = undefined;
  this._specularEnvironmentCubeMap = undefined;

  /**
   * 用于着色的光源。默认从太阳发出的定向光。
   * @type {Light}
   */
  this.light = new SunLight();

  /**
   * 是否启用 3D 瓦片的边缘可见性渲染。
   * 启用后，会创建一个具有多个渲染目标的帧缓冲区，用于高级边缘检测和可见性技术。
   * 是否启用平面填充功能 ID 预处理。
   * @type {boolean}
   * @default false
   */
  this._enableEdgeVisibility = false;

  /**
   * 是否启用平面填充功能 ID 预处理。
   * 每帧从 FrameState.planarFillRequested 更新。
   * @type {boolean}
   * @default false
   * @private
   */
  this._enablePlanarFillId = false;

  // Give frameState, camera, and screen space camera controller initial state before rendering
  updateFrameNumber(this, 0.0, JulianDate.now());
  this.updateFrameState();
  this.initializeFrame();
}

/**
 * 用于在新构建的场景中设置 {@link Scene#logarithmicDepthBuffer} 的默认值。
 * 此属性依赖于 fragmentDepth 的支持。
 * @type {boolean}
 */
Scene.defaultLogDepthBuffer = true;

function updateGlobeListeners(scene, globe) {
  for (let i = 0; i < scene._removeGlobeCallbacks.length; ++i) {
    scene._removeGlobeCallbacks[i]();
  }
  scene._removeGlobeCallbacks.length = 0;

  const removeGlobeCallbacks = [];
  if (defined(globe)) {
    removeGlobeCallbacks.push(
      globe.imageryLayersUpdatedEvent.addEventListener(
        requestRenderAfterFrame(scene),
      ),
    );
    removeGlobeCallbacks.push(
      globe.terrainProviderChanged.addEventListener(
        requestRenderAfterFrame(scene),
      ),
    );
  }
  scene._removeGlobeCallbacks = removeGlobeCallbacks;
}

Object.defineProperties(Scene.prototype, {
  /**
   * 获取该场景所绑定的画布元素。
   * @memberof Scene.prototype
   *
   * @type {HTMLCanvasElement}
   * @readonly
   */
  canvas: {
    get: function () {
      return this._canvas;
    },
  },

  /**
   * 底层 GL 上下文的 drawingBufferHeight。
   * @memberof Scene.prototype
   *
   * @type {number}
   * @readonly
   *
   * @see {@link https://www.khronos.org/registry/webgl/specs/1.0/#DOM-WebGLRenderingContext-drawingBufferHeight|drawingBufferHeight}
   */
  drawingBufferHeight: {
    get: function () {
      return this._context.drawingBufferHeight;
    },
  },

  /**
   * 底层 GL 上下文的 drawingBufferWidth。
   * @memberof Scene.prototype
   *
   * @type {number}
   * @readonly
   *
   * @see {@link https://www.khronos.org/registry/webgl/specs/1.0/#DOM-WebGLRenderingContext-drawingBufferWidth|drawingBufferWidth}
   */
  drawingBufferWidth: {
    get: function () {
      return this._context.drawingBufferWidth;
    },
  },

  /**
   * 此 WebGL 实现支持的最大伪影线宽度，以像素为单位。至少为 1。
   * @memberof Scene.prototype
   *
   * @type {number}
   * @readonly
   *
   * @see {@link https://www.khronos.org/opengles/sdk/docs/man/xhtml/glGet.xml|glGet} with <code>ALIASED_LINE_WIDTH_RANGE</code>。
   */
  maximumAliasedLineWidth: {
    get: function () {
      return ContextLimits.maximumAliasedLineWidth;
    },
  },

  /**
   * 此 WebGL 实现支持的立方体映射边缘最大长度，以像素为单位。至少为 16。
   * @memberof Scene.prototype
   *
   * @type {number}
   * @readonly
   *
   * @see {@link https://www.khronos.org/opengles/sdk/docs/man/xhtml/glGet.xml|glGet} with <code>GL_MAX_CUBE_MAP_TEXTURE_SIZE</code>。
   */
  maximumCubeMapSize: {
    get: function () {
      return ContextLimits.maximumCubeMapSize;
    },
  },

  /**
   * 如果 {@link Scene#pickPosition} 函数被支持，则返回 <code>true</code>。
   * @memberof Scene.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @see Scene#pickPosition
   */
  pickPositionSupported: {
    get: function () {
      return this._context.depthTexture;
    },
  },

  /**
   * 如果 {@link Scene#sampleHeight} 和 {@link Scene#sampleHeightMostDetailed} 函数被支持，则返回 <code>true</code>。
   * @memberof Scene.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @see Scene#sampleHeight
   * @see Scene#sampleHeightMostDetailed
   */
  sampleHeightSupported: {
    get: function () {
      return this._context.depthTexture;
    },
  },

  /**
   * 如果 {@link Scene#clampToHeight} 和 {@link Scene#clampToHeightMostDetailed} 函数被支持，则返回 <code>true</code>。
   * @memberof Scene.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @see Scene#clampToHeight
   * @see Scene#clampToHeightMostDetailed
   */
  clampToHeightSupported: {
    get: function () {
      return this._context.depthTexture;
    },
  },

  /**
   * 如果支持 {@link Scene#invertClassification}，则返回 <code>true</code>。
   * @memberof Scene.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @see Scene#invertClassification
   */
  invertClassificationSupported: {
    get: function () {
      return this._context.depthTexture;
    },
  },

  /**
   * 如果支持镜面环境映射，则返回 <code>true</code>。
   * @memberof Scene.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @see Scene#specularEnvironmentMaps
   */
  specularEnvironmentMapsSupported: {
    get: function () {
      return SpecularEnvironmentCubeMap.isSupported(this._context);
    },
  },

  /**
   * 椭球体。如果未指定，则使用默认椭球体。
   * @memberof Scene.prototype
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
   * 获取或设置深度测试椭球体。
   * @memberof Scene.prototype
   *
   * @type {Globe}
   */
  globe: {
    get: function () {
      return this._globe;
    },

    set: function (globe) {
      this._globe = this._globe && this._globe.destroy();
      this._globe = globe;

      updateGlobeListeners(this, globe);
    },
  },

  /**
   * 获取primitive集合。
   * @memberof Scene.prototype
   *
   * @type {PrimitiveCollection}
   * @readonly
   */
  primitives: {
    get: function () {
      return this._primitives;
    },
  },

  /**
   * 获取地面primitive集合。
   * @memberof Scene.prototype
   *
   * @type {PrimitiveCollection}
   * @readonly
   */
  groundPrimitives: {
    get: function () {
      return this._groundPrimitives;
    },
  },

  /**
   * 获取或设置相机。
   * @memberof Scene.prototype
   *
   * @type {Camera}
   * @readonly
   */
  camera: {
    get: function () {
      return this._view.camera;
    },
    set: function (camera) {
      // For internal use only. Documentation is still @readonly.
      this._view.camera = camera;
    },
  },

  /**
   * 获取或设置视角。
   * @memberof Scene.prototype
   *
   * @type {View}
   * @readonly
   *
   * @private
   */
  view: {
    get: function () {
      return this._view;
    },
    set: function (view) {
      // For internal use only. Documentation is still @readonly.
      this._view = view;
    },
  },

  /**
   * 获取默认视角。
   * @memberof Scene.prototype
   *
   * @type {View}
   * @readonly
   *
   * @private
   */
  defaultView: {
    get: function () {
      return this._defaultView;
    },
  },

  /**
   * 获取拾取函数和状态信息。
   * @memberof Scene.prototype
   *
   * @type {Picking}
   * @readonly
   *
   * @private
   */
  picking: {
    get: function () {
      return this._picking;
    },
  },

  /**
   * 收集可注册到场景中的 <code>Controller</code> 对象数组，用于处理输入事件、相机动画和其他交互。
   * @see {@link Controller}
   * @type {ControllerHost}
   * @memberof Scene.prototype
   * @readonly
   * @example
   * scene.screenSpaceCameraController.enableInputs = false;
   * scene.screenSpaceCameraController.enableCollisionDetection = false;
   *
   * const tiltOrbitController = new Cesium.ScreenSpaceTiltOrbitCameraController();
   * scene.controllerHost.registerController(tiltOrbitController, scene.canvas.parentNode);
   */
  controllerHost: {
    get: function () {
      return this._controllerHost;
    },
  },

  /**
   * 获取用于处理相机输入的控制器。
   * @memberof Scene.prototype
   *
   * @type {ScreenSpaceCameraController}
   * @readonly
   */
  screenSpaceCameraController: {
    get: function () {
      return this._screenSpaceCameraController;
    },
  },

  /**
   * 获取在2D和Columbus视图模式下使用的地图投影。
   * @memberof Scene.prototype
   *
   * @type {MapProjection}
   * @readonly
   *
   * @default new GeographicProjection()
   */
  mapProjection: {
    get: function () {
      return this._mapProjection;
    },
  },

  /**
   * 获取作业调度器。
   * @memberof Scene.prototype
   * @type {JobScheduler}
   * @readonly
   *
   * @private
   */
  jobScheduler: {
    get: function () {
      return this._jobScheduler;
    },
  },

  /**
   * 获取当前场景的状态信息。如果在primitive的 <code>update</code> 函数之外调用，则返回上一帧的状态。
   * function，
   * @memberof Scene.prototype
   *
   * @type {FrameState}
   * @readonly
   *
   * @private
   */
  frameState: {
    get: function () {
      return this._frameState;
    },
  },

  /**
   * 获取环境状态。
   * @memberof Scene.prototype
   *
   * @type {EnvironmentState}
   * @readonly
   *
   * @private
   */
  environmentState: {
    get: function () {
      return this._environmentState;
    },
  },

  /**
   * 获取场景中正在进行的tween集合。
   * @memberof Scene.prototype
   *
   * @type {TweenCollection}
   * @readonly
   *
   * @private
   */
  tweens: {
    get: function () {
      return this._tweens;
    },
  },

  /**
   * 获取将在地球仪上渲染的影像图层集合。
   * @memberof Scene.prototype
   *
   * @type {ImageryLayerCollection}
   * @readonly
   */
  imageryLayers: {
    get: function () {
      if (!defined(this.globe)) {
        return undefined;
      }

      return this.globe.imageryLayers;
    },
  },

  /**
   * 为地球仪提供表面几何数据的地形提供器。
   * @memberof Scene.prototype
   *
   * @type {TerrainProvider}
   */
  terrainProvider: {
    get: function () {
      if (!defined(this.globe)) {
        return undefined;
      }

      return this.globe.terrainProvider;
    },
    set: function (terrainProvider) {
      // Cancel any in-progress terrain update
      this._removeTerrainProviderReadyListener =
        this._removeTerrainProviderReadyListener &&
        this._removeTerrainProviderReadyListener();

      if (defined(this.globe)) {
        this.globe.terrainProvider = terrainProvider;
      }
    },
  },

  /**
   * 获取地形提供器更改时引发的事件。
   * @memberof Scene.prototype
   *
   * @type {Event}
   * @readonly
   */
  terrainProviderChanged: {
    get: function () {
      if (!defined(this.globe)) {
        return undefined;
      }

      return this.globe.terrainProviderChanged;
    },
  },

  /**
   * @memberof Scene.prototype
   * @type {VectorProvider}
   * @ignore
   */
  vectorProvider: {
    get: function () {
      return this.globe?.vectorProvider;
    },
  },

  /**
   * 获取场景更新或渲染前会引发的事件。该事件的订阅者
   * 将接收Scene实例作为第一个参数，以及当前时间作为第二个参数。
   * @memberof Scene.prototype
   *
   * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}
   * @see Scene#postUpdate
   * @see Scene#preRender
   * @see Scene#postRender
   *
   * @type {Event}
   * @readonly
   */
  preUpdate: {
    get: function () {
      return this._preUpdate;
    },
  },

  /**
   * 获取场景更新后、渲染前会引发的事件。
   * 该事件的订阅者将接收Scene实例作为第一个参数，以及当前时间作为第二个
   * 参数。
   * @memberof Scene.prototype
   *
   * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}
   * @see Scene#preUpdate
   * @see Scene#preRender
   * @see Scene#postRender
   *
   * @type {Event}
   * @readonly
   */
  postUpdate: {
    get: function () {
      return this._postUpdate;
    },
  },

  /**
   * 获取在 <code>render</code> 函数内部抛出异常时引发的事件。
   * 传递给事件处理器的唯一两个参数是Scene实例和抛出的异常。
   * 默认情况下，此事件触发后错误不会再次抛出，但可以通过设置
   * <code>rethrowRenderErrors</code> 属性来更改此行为。
   * @memberof Scene.prototype
   *
   * @type {Event}
   * @readonly
   */
  renderError: {
    get: function () {
      return this._renderError;
    },
  },

  /**
   * 获取场景更新后、渲染前立即会引发的事件。
   * 事件订阅者接收第一个参数为场景实例，第二个参数为当前时间。
   * 参数。
   * @memberof Scene.prototype
   *
   * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}
   * @see Scene#preUpdate
   * @see Scene#postUpdate
   * @see Scene#postRender
   *
   * @type {Event}
   * @readonly
   */
  preRender: {
    get: function () {
      return this._preRender;
    },
  },

  /**
   * 获取场景渲染后立即会引发的事件。事件订阅者
   * 接收第一个参数为场景实例，第二个参数为当前时间。
   * @memberof Scene.prototype
   *
   * @see {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}
   * @see Scene#preUpdate
   * @see Scene#postUpdate
   * @see Scene#postRender
   *
   * @type {Event}
   * @readonly
   */
  postRender: {
    get: function () {
      return this._postRender;
    },
  },

  /**
   * 获取场景上次渲染时的模拟时间。返回值为 <code>undefined</code>
   * 如果场景尚未渲染。
   * @memberof Scene.prototype
   *
   * @type {JulianDate | undefined}
   * @readonly
   */
  lastRenderTime: {
    get: function () {
      return this._lastRenderTime;
    },
  },

  /**
   * @memberof Scene.prototype
   * @private
   * @readonly
   */
  context: {
    get: function () {
      return this._context;
    },
  },

  /**
   * 此属性仅用于调试，不用于生产环境使用。
   * <p>
   * 当 {@link Scene.debugShowFrustums} 为 <code>true</code> 时，此属性包含
   * 关于每个视锥体下命令执行次数的统计信息。
   * <code>totalCommands</code> 是执行的命令总数，忽略
   * 重叠情况。<code>commandsInFrustums</code> 是一个数组，表示
   * 命令在多少个视锥体内重复执行，例如，有多少命令在两个或
   * 三个视锥体内重叠。
   * </p>
   *
   * @memberof Scene.prototype
   *
   * @type {object | undefined}
   * @readonly
   *
   * @default undefined
   */
  debugFrustumStatistics: {
    get: function () {
      return this._view.debugFrustumStatistics;
    },
  },

  /**
   * 获取场景是否仅针对3D查看进行优化。
   * @memberof Scene.prototype
   * @type {boolean}
   * @readonly
   */
  scene3DOnly: {
    get: function () {
      return this._frameState.scene3DOnly;
    },
  },

  /**
   * 获取场景是否启用了顺序无关的半透明效果。
   * 注意，这仅反映原始构建选项，还有其他因素可能导致特定系统配置下OIT无法正常工作。
   * 获取此场景的唯一标识符。
   * @memberof Scene.prototype
   * @type {boolean}
   * @readonly
   */
  orderIndependentTranslucency: {
    get: function () {
      return this._useOIT;
    },
  },

  /**
   * 获取或设置场景当前模式。
   * @memberof Scene.prototype
   * @type {string}
   * @readonly
   */
  id: {
    get: function () {
      return this._id;
    },
  },

  /**
   * 获取上帧中使用的视锥体数量。
   * @memberof Scene.prototype
   * @type {SceneMode}
   * @default {@link SceneMode.SCENE3D}
   */
  mode: {
    get: function () {
      return this._mode;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (this.scene3DOnly && value !== SceneMode.SCENE3D) {
        throw new DeveloperError(
          "Only SceneMode.SCENE3D is valid when scene3DOnly is true.",
        );
      }
      //>>includeEnd('debug');
      if (value === SceneMode.SCENE2D) {
        this.morphTo2D(0);
      } else if (value === SceneMode.SCENE3D) {
        this.morphTo3D(0);
      } else if (value === SceneMode.COLUMBUS_VIEW) {
        this.morphToColumbusView(0);
        //>>includeStart('debug', pragmas.debug);
      } else {
        throw new DeveloperError(
          "value must be a valid SceneMode enumeration.",
        );
        //>>includeEnd('debug');
      }
      this._mode = value;
    },
  },

  /**
   * 获取上帧中使用的视锥体数量。
   * @memberof Scene.prototype
   * @type {FrustumCommands[]}
   *
   * @private
   */
  frustumCommandsList: {
    get: function () {
      return this._view.frustumCommandsList;
    },
  },

  /**
   * 获取上帧中使用的视锥体数量。
   * @memberof Scene.prototype
   * @type {number}
   *
   * @private
   */
  numberOfFrustums: {
    get: function () {
      return this._view.frustumCommandsList.length;
    },
  },

  /**
   * 当 <code>true</code> 时，将场景分为两个视口，左眼和右眼分别使用立体视图。
   * 用于 cardboard 和 WebVR 场景。
   * @memberof Scene.prototype
   * @type {boolean}
   * @default false
   */
  useWebVR: {
    get: function () {
      return this._useWebVR;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (this.camera.frustum instanceof OrthographicFrustum) {
        throw new DeveloperError(
          "VR is unsupported with an orthographic projection.",
        );
      }
      //>>includeEnd('debug');
      this._useWebVR = value;
      if (this._useWebVR) {
        this._frameState.creditDisplay.container.style.visibility = "hidden";
        this._cameraVR = new Camera(this);
        if (!defined(this._deviceOrientationCameraController)) {
          this._deviceOrientationCameraController =
            new DeviceOrientationCameraController(this);
        }

        this._aspectRatioVR = this.camera.frustum.aspectRatio;
      } else {
        this._frameState.creditDisplay.container.style.visibility = "visible";
        this._cameraVR = undefined;
        this._deviceOrientationCameraController =
          this._deviceOrientationCameraController &&
          !this._deviceOrientationCameraController.isDestroyed() &&
          this._deviceOrientationCameraController.destroy();

        this.camera.frustum.aspectRatio = this._aspectRatioVR;
        this.camera.frustum.xOffset = 0.0;
      }
    },
  },

  /**
   * 确定2D地图是否可旋转或在水平方向无限滚动。
   * @memberof Scene.prototype
   * @type {MapMode2D}
   * @readonly
   */
  mapMode2D: {
    get: function () {
      return this._mapMode2D;
    },
  },

  /**
   * 获取或设置视口内分割器位置。有效值介于 0.0 和 1.0 之间。
   * @memberof Scene.prototype
   *
   * @type {number}
   */
  splitPosition: {
    get: function () {
      return this._frameState.splitPosition;
    },
    set: function (value) {
      this._frameState.splitPosition = value;
    },
  },

  /**
   * 从相机到禁用平面、标签和点的深度测试的距离
   * 例如，用于防止与地形发生裁剪。设置为零时，深度测试应始终
   * 应用。设置小于零时，深度测试不应应用。设置 billboard、标签或点的
   * 属性 disableDepthTestDistance 将覆盖此值。
   * @memberof Scene.prototype
   * @type {number}
   * @default 0.0
   */
  minimumDisableDepthTestDistance: {
    get: function () {
      return this._minimumDisableDepthTestDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value) || value < 0.0) {
        throw new DeveloperError(
          "minimumDisableDepthTestDistance must be greater than or equal to 0.0.",
        );
      }
      //>>includeEnd('debug');
      this._minimumDisableDepthTestDistance = value;
    },
  },

  /**
   * 是否使用对数深度缓冲区。启用此选项将在多视锥体中减少视锥体数量。
   * 提升性能。此属性依赖于 fragmentDepth 的支持。
   * @memberof Scene.prototype
   * @type {boolean}
   */
  logarithmicDepthBuffer: {
    get: function () {
      return this._logDepthBuffer;
    },
    set: function (value) {
      value = this._context.fragmentDepth && value;
      if (this._logDepthBuffer !== value) {
        this._logDepthBuffer = value;
        this._logDepthBufferDirty = true;
      }
    },
  },

  /**
   * 用于伽马校正的值。仅在使用高动态范围渲染时使用。
   * @memberof Scene.prototype
   * @type {number}
   * @default 2.2
   */
  gamma: {
    get: function () {
      return this._context.uniformState.gamma;
    },
    set: function (value) {
      this._context.uniformState.gamma = value;
    },
  },

  /**
   * 是否使用高动态范围渲染。
   * @memberof Scene.prototype
   * @type {boolean}
   * @default false
   */
  highDynamicRange: {
    get: function () {
      return this._hdr;
    },
    set: function (value) {
      const context = this._context;
      const hdr =
        value &&
        context.depthTexture &&
        (context.colorBufferFloat || context.colorBufferHalfFloat);
      this._hdrDirty = hdr !== this._hdr;
      this._hdr = hdr;
    },
  },

  /**
   * 是否支持高动态范围渲染。
   * @memberof Scene.prototype
   * @type {boolean}
   * @readonly
   * @default true
   */
  highDynamicRangeSupported: {
    get: function () {
      const context = this._context;
      return (
        context.depthTexture &&
        (context.colorBufferFloat || context.colorBufferHalfFloat)
      );
    },
  },

  /**
   * 相机是否位于地球下方。
   * @memberof Scene.prototype
   * @type {boolean}
   * @readonly
   * @default false
   */
  cameraUnderground: {
    get: function () {
      return this._cameraUnderground;
    },
  },

  /**
   * 多采样抗锯齿的采样率（值大于 1 启用 MSAA）。
   * @memberof Scene.prototype
   * @type {number}
   * @default 4
   */
  msaaSamples: {
    get: function () {
      return this._msaaSamples;
    },
    set: function (value) {
      value = Math.min(value, ContextLimits.maximumSamples);
      this._msaaSamples = value;
    },
  },

  /**
   * 如果场景上下文支持 MSAA，则返回 <code>true</code>。
   * @memberof Scene.prototype
   * @type {boolean}
   * @readonly
   */
  msaaSupported: {
    get: function () {
      return this._context.msaa;
    },
  },

  /**
   * 像素与密度独立像素之间的比例。提供适用于特定设备的真实像素测量的标准单位。
   * 确定是否支持压缩纹理格式。
   *
   * @memberof Scene.prototype
   * @type {number}
   * @default 1.0
   * @private
   */
  pixelRatio: {
    get: function () {
      return this._frameState.pixelRatio;
    },
    set: function (value) {
      this._frameState.pixelRatio = value;
    },
  },

  /**
   * @private
   */
  opaqueFrustumNearOffset: {
    get: function () {
      return 0.9999;
    },
  },

  /**
   * @private
   */
  globeHeight: {
    get: function () {
      return this._globeHeight;
    },
  },
});

/**
 * 纹理格式。可以是格式名称或 WebGL 扩展名称，例如 s3tc 或 WEBGL_compressed_texture_s3tc。
 * @param {string} format 或者不支持该格式。
 * @return {boolean} Whether 获取场景的中心主体遮挡器。
 */
Scene.prototype.getCompressedTextureFormatSupported = function (format) {
  const context = this.context;
  return (
    ((format === "WEBGL_compressed_texture_s3tc" || format === "s3tc") &&
      context.s3tc) ||
    ((format === "WEBGL_compressed_texture_pvrtc" || format === "pvrtc") &&
      context.pvrtc) ||
    ((format === "WEBGL_compressed_texture_etc" || format === "etc") &&
      context.etc) ||
    ((format === "WEBGL_compressed_texture_etc1" || format === "etc1") &&
      context.etc1) ||
    ((format === "WEBGL_compressed_texture_astc" || format === "astc") &&
      context.astc) ||
    ((format === "EXT_texture_compression_bptc" || format === "bc7") &&
      context.bc7)
  );
};

function pickedMetadataInfoChanged(command, frameState) {
  const oldPickedMetadataInfo = command.pickedMetadataInfo;
  const newPickedMetadataInfo = frameState.pickedMetadataInfo;
  if (oldPickedMetadataInfo?.schemaId !== newPickedMetadataInfo?.schemaId) {
    return true;
  }
  if (oldPickedMetadataInfo?.className !== newPickedMetadataInfo?.className) {
    return true;
  }
  if (
    oldPickedMetadataInfo?.propertyName !== newPickedMetadataInfo?.propertyName
  ) {
    return true;
  }
  return false;
}

function updateDerivedCommands(scene, command, shadowsDirty) {
  const frameState = scene._frameState;
  const context = scene._context;
  const oit = scene._view.oit;
  const { lightShadowMaps, lightShadowsEnabled } = frameState.shadowState;

  let derivedCommands = command.derivedCommands;

  if (defined(command.pickId)) {
    derivedCommands.picking = DerivedCommand.createPickDerivedCommand(
      scene,
      command,
      context,
      derivedCommands.picking,
    );
  }
  // Snap derived commands are only created on demand, during a snapping pass,
  // so applications that never call Scene.snap pay no shader-derivation cost.
  if (defined(command.snapId) && frameState.passes.snap) {
    derivedCommands.snapping = DerivedCommand.createSnapDerivedCommand(
      scene,
      command,
      context,
      derivedCommands.snapping,
    );
  }
  if (frameState.pickingMetadata && command.pickMetadataAllowed) {
    command.pickedMetadataInfo = frameState.pickedMetadataInfo;
    if (defined(command.pickedMetadataInfo)) {
      derivedCommands.pickingMetadata =
        DerivedCommand.createPickMetadataDerivedCommand(
          scene,
          command,
          context,
          derivedCommands.pickingMetadata,
        );
    }
  }
  if (!command.pickOnly) {
    derivedCommands.depth = DerivedCommand.createDepthOnlyDerivedCommand(
      scene,
      command,
      context,
      derivedCommands.depth,
    );
  }

  derivedCommands.originalCommand = command;

  if (scene._hdr) {
    derivedCommands.hdr = DerivedCommand.createHdrCommand(
      command,
      context,
      derivedCommands.hdr,
    );
    command = derivedCommands.hdr.command;
    derivedCommands = command.derivedCommands;
  }

  if (lightShadowsEnabled && command.receiveShadows) {
    derivedCommands.shadows = ShadowMap.createReceiveDerivedCommand(
      lightShadowMaps,
      command,
      shadowsDirty,
      context,
      derivedCommands.shadows,
    );
  }

  if (command.pass === Pass.TRANSLUCENT && defined(oit) && oit.isSupported()) {
    if (lightShadowsEnabled && command.receiveShadows) {
      derivedCommands.oit = defined(derivedCommands.oit)
        ? derivedCommands.oit
        : {};
      derivedCommands.oit.shadows = oit.createDerivedCommands(
        derivedCommands.shadows.receiveCommand,
        context,
        derivedCommands.oit.shadows,
      );
    } else {
      derivedCommands.oit = oit.createDerivedCommands(
        command,
        context,
        derivedCommands.oit,
      );
    }
  }
}

/**
 * @private
 */
Scene.prototype.updateDerivedCommands = function (command) {
  const { derivedCommands } = command;
  if (!defined(derivedCommands)) {
    // Is not a DrawCommand
    return;
  }

  const frameState = this._frameState;
  const { shadowState, useLogDepth } = this._frameState;
  const context = this._context;

  // Update derived commands when any shadow maps become dirty
  let shadowsDirty = false;
  const lastDirtyTime = shadowState.lastDirtyTime;
  if (command.lastDirtyTime !== lastDirtyTime) {
    command.lastDirtyTime = lastDirtyTime;
    command.dirty = true;
    shadowsDirty = true;
  }

  const useHdr = this._hdr;
  const hasLogDepthDerivedCommands = defined(derivedCommands.logDepth);
  const hasHdrCommands = defined(derivedCommands.hdr);
  const hasDerivedCommands = defined(derivedCommands.originalCommand);
  const needsLogDepthDerivedCommands =
    useLogDepth && !hasLogDepthDerivedCommands;
  const needsHdrCommands = useHdr && !hasHdrCommands;
  const needsDerivedCommands = (!useLogDepth || !useHdr) && !hasDerivedCommands;
  const needsUpdateForMetadataPicking =
    frameState.pickingMetadata &&
    pickedMetadataInfoChanged(command, frameState);
  const needsUpdateForSnap =
    frameState.passes.snap &&
    defined(command.snapId) &&
    !defined(derivedCommands.snapping);
  command.dirty =
    command.dirty ||
    needsLogDepthDerivedCommands ||
    needsHdrCommands ||
    needsDerivedCommands ||
    needsUpdateForMetadataPicking ||
    needsUpdateForSnap;

  if (!command.dirty) {
    return;
  }

  command.dirty = false;

  const { shadowsEnabled, shadowMaps } = shadowState;
  if (shadowsEnabled && command.castShadows) {
    derivedCommands.shadows = ShadowMap.createCastDerivedCommand(
      shadowMaps,
      command,
      shadowsDirty,
      context,
      derivedCommands.shadows,
    );
  }

  if (hasLogDepthDerivedCommands || needsLogDepthDerivedCommands) {
    derivedCommands.logDepth = DerivedCommand.createLogDepthCommand(
      command,
      context,
      derivedCommands.logDepth,
    );
    updateDerivedCommands(this, derivedCommands.logDepth.command, shadowsDirty);
  }
  if (hasDerivedCommands || needsDerivedCommands) {
    updateDerivedCommands(this, command, shadowsDirty);
  }
};

const renderTilesetPassState = new Cesium3DTilePassState({
  pass: Cesium3DTilePass.RENDER,
});

const preloadTilesetPassState = new Cesium3DTilePassState({
  pass: Cesium3DTilePass.PRELOAD,
});

const preloadFlightTilesetPassState = new Cesium3DTilePassState({
  pass: Cesium3DTilePass.PRELOAD_FLIGHT,
});

const requestRenderModeDeferCheckPassState = new Cesium3DTilePassState({
  pass: Cesium3DTilePass.REQUEST_RENDER_MODE_DEFER_CHECK,
});

const scratchOccluderBoundingSphere = new BoundingSphere();
let scratchOccluder;
/**
 * 假设只有一个中心主体遮挡器，即顶层地球。
 * 假设只有一个中心主体遮挡器，即顶层地球。
 *
 * @param {Scene} scene
 * @returns {Occluder|undefined}
 *
 * @private
 */
function getOccluder(scene) {
  if (
    scene._mode !== SceneMode.SCENE3D ||
    !scene.globe?.show ||
    scene._cameraUnderground ||
    scene._globeTranslucencyState.translucent
  ) {
    return undefined;
  }

  scratchOccluderBoundingSphere.radius =
    scene.ellipsoid.minimumRadius + scene.frameState.minimumTerrainHeight;
  scratchOccluder = Occluder.fromBoundingSphere(
    scratchOccluderBoundingSphere,
    scene.camera.positionWC,
    scratchOccluder,
  );

  return scratchOccluder;
}

/**
 * @private
 * @param {FrameState.Passes} passes
 */
Scene.prototype.clearPasses = function (passes) {
  passes.render = false;
  passes.pick = false;
  passes.pickVoxel = false;
  passes.snap = false;
  passes.depth = false;
  passes.postProcess = false;
  passes.offscreen = false;
};

function updateFrameNumber(scene, frameNumber, time) {
  const frameState = scene._frameState;
  frameState.frameNumber = frameNumber;
  frameState.time = JulianDate.clone(time, frameState.time);
}

/**
 * @private
 */
Scene.prototype.updateFrameState = function () {
  const camera = this.camera;

  const frameState = this._frameState;
  frameState.commandList.length = 0;
  frameState.shadowMaps.length = 0;
  frameState.brdfLutGenerator = this._brdfLutGenerator;
  frameState.environmentMap = this.skyBox && this.skyBox._cubeMap;
  frameState.mode = this._mode;
  frameState.morphTime = this.morphTime;
  frameState.mapProjection = this.mapProjection;
  frameState.camera = camera;
  frameState.cullingVolume = camera.frustum.computeCullingVolume(
    camera.positionWC,
    camera.directionWC,
    camera.upWC,
  );
  frameState.occluder = getOccluder(this);
  frameState.minimumTerrainHeight = 0.0;
  frameState.minimumDisableDepthTestDistance =
    this._minimumDisableDepthTestDistance;
  frameState.invertClassification = this.invertClassification;
  frameState.useLogDepth =
    this._logDepthBuffer &&
    !(
      this.camera.frustum instanceof OrthographicFrustum ||
      this.camera.frustum instanceof OrthographicOffCenterFrustum
    );
  frameState.light = this.light;
  frameState.cameraUnderground = this._cameraUnderground;
  frameState.globeTranslucencyState = this._globeTranslucencyState;

  const { globe } = this;
  if (defined(globe) && globe._terrainExaggerationChanged) {
    // Honor a user-set value for the old deprecated globe.terrainExaggeration.
    // This can be removed when Globe.terrainExaggeration is removed.
    this.verticalExaggeration = globe._terrainExaggeration;
    this.verticalExaggerationRelativeHeight =
      globe._terrainExaggerationRelativeHeight;
    globe._terrainExaggerationChanged = false;
  }
  frameState.verticalExaggeration = this.verticalExaggeration;
  frameState.verticalExaggerationRelativeHeight =
    this.verticalExaggerationRelativeHeight;

  if (
    defined(this._specularEnvironmentCubeMap) &&
    this._specularEnvironmentCubeMap.ready
  ) {
    frameState.specularEnvironmentMaps =
      this._specularEnvironmentCubeMap.texture;
    frameState.specularEnvironmentMapsMaximumLOD =
      this._specularEnvironmentCubeMap.maximumMipmapLevel;
  } else {
    frameState.specularEnvironmentMaps = undefined;
    frameState.specularEnvironmentMapsMaximumLOD = undefined;
  }

  frameState.sphericalHarmonicCoefficients = this.sphericalHarmonicCoefficients;

  this._actualInvertClassificationColor = Color.clone(
    this.invertClassificationColor,
    this._actualInvertClassificationColor,
  );
  if (!InvertClassification.isTranslucencySupported(this._context)) {
    this._actualInvertClassificationColor.alpha = 1.0;
  }

  frameState.invertClassificationColor = this._actualInvertClassificationColor;

  if (defined(this.globe)) {
    frameState.maximumScreenSpaceError = this.globe.maximumScreenSpaceError;
  } else {
    frameState.maximumScreenSpaceError = 2;
  }

  this.clearPasses(frameState.passes);

  frameState.tilesetPassState = undefined;
};

/**
 * 检查绘制命令是否会在当前场景中渲染可见内容，
 * 基于其边界体积。
 *
 * @param {CullingVolume} cullingVolume 当前场景的剔除体积。
 * @param {DrawCommand} [command] 绘制命令。
 * @param {Occluder} [occluder] 可能位于命令边界体积前方的遮挡器。
 * @returns {boolean} <code>true</code> 如果命令的边界体积在场景中可见。
 *
 * @private
 */
Scene.prototype.isVisible = function (cullingVolume, command, occluder) {
  if (!defined(command)) {
    return false;
  }
  const { boundingVolume } = command;
  if (!defined(boundingVolume) || !command.cull) {
    return true;
  }
  if (cullingVolume.computeVisibility(boundingVolume) === Intersect.OUTSIDE) {
    return false;
  }
  return (
    !defined(occluder) ||
    !command.occlude ||
    !boundingVolume.isOccluded(occluder)
  );
};

let transformFrom2D = new Matrix4(
  0.0,
  0.0,
  1.0,
  0.0,
  1.0,
  0.0,
  0.0,
  0.0,
  0.0,
  1.0,
  0.0,
  0.0,
  0.0,
  0.0,
  0.0,
  1.0,
);
transformFrom2D = Matrix4.inverseTransformation(
  transformFrom2D,
  transformFrom2D,
);

/**
 * 用于绘制命令边界体积的调试代码。未优化！
 * 假设边界体积为球体或盒子。
 *
 * @param {DrawCommand} command 用于渲染边界体积的绘制命令。
 * @param {Scene} scene 场景。
 * @param {PassState} passState 当前渲染通道的状态。
 * @param {Framebuffer} debugFramebuffer 将边界体积渲染到的帧缓冲区。
 *
 * @private
 */
function debugShowBoundingVolume(command, scene, passState, debugFramebuffer) {
  const frameState = scene._frameState;
  const context = frameState.context;
  const boundingVolume = command.boundingVolume;

  if (defined(scene._debugVolume)) {
    scene._debugVolume.destroy();
  }

  let center = Cartesian3.clone(boundingVolume.center);
  if (frameState.mode !== SceneMode.SCENE3D) {
    center = Matrix4.multiplyByPoint(transformFrom2D, center, center);
    const projection = frameState.mapProjection;
    const centerCartographic = projection.unproject(center);
    center = projection.ellipsoid.cartographicToCartesian(centerCartographic);
  }

  let geometry;
  let modelMatrix;
  const { radius } = boundingVolume;
  if (defined(radius)) {
    geometry = EllipsoidGeometry.createGeometry(
      new EllipsoidGeometry({
        radii: new Cartesian3(radius, radius, radius),
        vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
      }),
    );
    modelMatrix = Matrix4.fromTranslation(center);
  } else {
    geometry = BoxGeometry.createGeometry(
      BoxGeometry.fromDimensions({
        dimensions: new Cartesian3(2.0, 2.0, 2.0),
        vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
      }),
    );
    modelMatrix = Matrix4.fromRotationTranslation(
      boundingVolume.halfAxes,
      center,
      new Matrix4(),
    );
  }
  scene._debugVolume = new Primitive({
    geometryInstances: new GeometryInstance({
      geometry: GeometryPipeline.toWireframe(geometry),
      modelMatrix: modelMatrix,
      attributes: {
        color: new ColorGeometryInstanceAttribute(1.0, 0.0, 0.0, 1.0),
      },
    }),
    appearance: new PerInstanceColorAppearance({
      flat: true,
      translucent: false,
    }),
    asynchronous: false,
  });

  const savedCommandList = frameState.commandList;
  const commandList = (frameState.commandList = []);
  scene._debugVolume.update(frameState);

  command = commandList[0];

  if (frameState.useLogDepth) {
    const logDepth = DerivedCommand.createLogDepthCommand(command, context);
    command = logDepth.command;
  }

  let framebuffer;
  if (defined(debugFramebuffer)) {
    framebuffer = passState.framebuffer;
    passState.framebuffer = debugFramebuffer;
  }

  command.execute(context, passState);

  if (defined(framebuffer)) {
    passState.framebuffer = framebuffer;
  }

  frameState.commandList = savedCommandList;
}

/**
 * 执行单个绘制命令，或根据当前渲染状态执行其派生命令之一。
 *
 * @param {DrawCommand} command 要执行的命令。
 * @param {Scene} scene 场景。
 * @param {PassState} passState 当前渲染通道的状态。
 * @param {Framebuffer} debugFramebuffer 将调试 QCs渲染到的帧缓冲区。
 *
 * @private
 */
function executeCommand(command, scene, passState, debugFramebuffer) {
  const frameState = scene._frameState;
  const context = scene._context;

  if (defined(scene.debugCommandFilter) && !scene.debugCommandFilter(command)) {
    return;
  }

  if (command instanceof ClearCommand) {
    command.execute(context, passState);
    return;
  }

  if (command.debugShowBoundingVolume && defined(command.boundingVolume)) {
    debugShowBoundingVolume(command, scene, passState, debugFramebuffer);
  }

  if (frameState.useLogDepth && defined(command.derivedCommands.logDepth)) {
    command = command.derivedCommands.logDepth.command;
  }

  const passes = frameState.passes;
  if (
    !passes.pick &&
    !passes.pickVoxel &&
    !passes.depth &&
    scene._hdr &&
    defined(command.derivedCommands) &&
    defined(command.derivedCommands.hdr)
  ) {
    command = command.derivedCommands.hdr.command;
  }

  if (passes.pick || passes.depth) {
    if (passes.pick && !passes.depth) {
      if (frameState.passes.snap) {
        // Snapping pass: only commands with a snap variant write the float
        // snap payload. Commands without one (no snapId, e.g. globe/terrain)
        // execute depth-only so they still occlude snappable geometry behind
        // them without polluting the RGBA32F snap framebuffer with RGBA8
        // pick colors.
        if (defined(command.derivedCommands.snapping)) {
          command = command.derivedCommands.snapping.snapCommand;
          command.execute(context, passState);
        } else if (defined(command.derivedCommands.depth)) {
          command = command.derivedCommands.depth.depthOnlyCommand;
          command.execute(context, passState);
        }
        return;
      }
      if (
        frameState.pickingMetadata &&
        defined(command.derivedCommands.pickingMetadata)
      ) {
        command = command.derivedCommands.pickingMetadata.pickMetadataCommand;
        command.execute(context, passState);
        return;
      }
      if (
        !frameState.pickingMetadata &&
        defined(command.derivedCommands.picking)
      ) {
        command = command.derivedCommands.picking.pickCommand;
        command.execute(context, passState);
        return;
      }
    } else if (defined(command.derivedCommands.depth)) {
      command = command.derivedCommands.depth.depthOnlyCommand;
      command.execute(context, passState);
      return;
    }
  }

  if (scene.debugShowCommands || scene.debugShowFrustums) {
    scene._debugInspector.executeDebugShowFrustumsCommand(
      scene,
      command,
      passState,
    );
    return;
  }

  if (
    frameState.shadowState.lightShadowsEnabled &&
    command.receiveShadows &&
    defined(command.derivedCommands.shadows)
  ) {
    // If the command receives shadows, execute the derived shadows command.
    // Some commands, such as OIT derived commands, do not have derived shadow commands themselves
    // and instead shadowing is built-in. In this case execute the command regularly below.
    command.derivedCommands.shadows.receiveCommand.execute(context, passState);
  } else {
    command.execute(context, passState);
  }
}

/**
 * 执行单个 ID 绘制命令，用于渲染用于拾取的信息。
 *
 * @param {DrawCommand} command 要执行的命令。
 * @param {Scene} scene 场景。
 * @param {PassState} passState 当前渲染通道的状态。
 *
 * @private
 */
function executeIdCommand(command, scene, passState) {
  const { derivedCommands } = command;
  if (!defined(derivedCommands)) {
    return;
  }

  const frameState = scene._frameState;
  const context = scene._context;

  if (frameState.useLogDepth && defined(derivedCommands.logDepth)) {
    command = derivedCommands.logDepth.command;
  }

  const { picking, pickingMetadata, depth } = command.derivedCommands;
  if (defined(pickingMetadata)) {
    command = derivedCommands.pickingMetadata.pickMetadataCommand;
    command.execute(context, passState);
  }
  if (defined(picking)) {
    command = picking.pickCommand;
    command.execute(context, passState);
  } else if (defined(depth)) {
    command = depth.depthOnlyCommand;
    command.execute(context, passState);
  }
}

function backToFront(a, b, position) {
  return (
    b.boundingVolume.distanceSquaredTo(position) -
    a.boundingVolume.distanceSquaredTo(position)
  );
}

const scratchCart3 = new Cartesian3();
function distanceSquaredToCenter(center, position) {
  const diff = Cartesian3.subtract(center, position, scratchCart3);
  const distance = Math.max(0.0, Cartesian3.magnitude(diff));
  return distance * distance;
}

function backToFrontSplats(a, b, position) {
  const boxA = a.boundingVolume;
  const boxB = b.boundingVolume;

  return (
    distanceSquaredToCenter(boxB.center, position) -
    distanceSquaredToCenter(boxA.center, position)
  );
}

function frontToBack(a, b, position) {
  // When distances are equal equal favor sorting b before a. This gives render priority to commands later in the list.
  return (
    a.boundingVolume.distanceSquaredTo(position) -
    b.boundingVolume.distanceSquaredTo(position) +
    CesiumMath.EPSILON12
  );
}

function executeTranslucentCommandsBackToFront(
  scene,
  executeFunction,
  passState,
  commands,
  invertClassification,
) {
  mergeSort(commands, backToFront, scene.camera.positionWC);

  if (defined(invertClassification)) {
    executeFunction(invertClassification.unclassifiedCommand, scene, passState);
  }

  for (let i = 0; i < commands.length; ++i) {
    executeFunction(commands[i], scene, passState);
  }
}

function executeTranslucentCommandsFrontToBack(
  scene,
  executeFunction,
  passState,
  commands,
  invertClassification,
) {
  mergeSort(commands, frontToBack, scene.camera.positionWC);

  if (defined(invertClassification)) {
    executeFunction(invertClassification.unclassifiedCommand, scene, passState);
  }

  for (let i = 0; i < commands.length; ++i) {
    executeFunction(commands[i], scene, passState);
  }
}
/**
 * 执行命令以在场景中渲染体素。
 *
 * @param {Scene} scene 场景。
 * @param {PassState} passState 当前渲染通道的状态。
 * @param {FrustumCommands} frustumCommands 当前视锥体的绘制命令。
 *
 * @private
 */
function performVoxelsPass(scene, passState, frustumCommands) {
  scene.context.uniformState.updatePass(Pass.VOXELS);

  const commands = frustumCommands.commands[Pass.VOXELS];
  commands.length = frustumCommands.indices[Pass.VOXELS];

  mergeSort(commands, backToFront, scene.camera.positionWC);

  for (let i = 0; i < commands.length; ++i) {
    executeCommand(commands[i], scene, passState);
  }
}

function performGaussianSplatPass(scene, passState, frustumCommands) {
  scene.context.uniformState.updatePass(Pass.GAUSSIAN_SPLATS);

  const commands = frustumCommands.commands[Pass.GAUSSIAN_SPLATS];
  commands.length = frustumCommands.indices[Pass.GAUSSIAN_SPLATS];

  mergeSort(commands, backToFrontSplats, scene.camera.positionWC);

  for (let i = 0; i < commands.length; ++i) {
    executeCommand(commands[i], scene, passState);
  }
}

const scratchPerspectiveFrustum = new PerspectiveFrustum();
const scratchPerspectiveOffCenterFrustum = new PerspectiveOffCenterFrustum();
const scratchOrthographicFrustum = new OrthographicFrustum();
const scratchOrthographicOffCenterFrustum = new OrthographicOffCenterFrustum();
/**
 * 从原始相机视锥体中创建工作视锥体。
 *
 * @param {Camera} camera 相机
 * @returns {PerspectiveFrustum|PerspectiveOffCenterFrustum|OrthographicFrustum|OrthographicOffCenterFrustum} The 工作视锥体
 *
 * @private
 */
function createWorkingFrustum(camera) {
  const { frustum } = camera;
  if (defined(frustum.fov)) {
    return frustum.clone(scratchPerspectiveFrustum);
  }
  if (defined(frustum.infiniteProjectionMatrix)) {
    return frustum.clone(scratchPerspectiveOffCenterFrustum);
  }
  if (defined(frustum.width)) {
    return frustum.clone(scratchOrthographicFrustum);
  }
  return frustum.clone(scratchOrthographicOffCenterFrustum);
}

/**
 * 确定半透明表面将如何被处理。
 *
 * 当 OIT 启用时，这将委托给 OIT.executeCommands。
 * 否则将执行 `executeTranslucentCommandsBackToFront`。
 * 对于渲染通道，或执行 `executeTranslucentCommandsFrontToBack` 用于其他通道。
 * 其他通道。
 *
 * @param {Scene} scene 场景。
 * @returns {Function} A 执行半透明命令的函数。
 * @ignore
 */
function obtainTranslucentCommandExecutionFunction(scene) {
  if (scene._environmentState.useOIT) {
    if (!defined(scene._executeOITFunction)) {
      const { view, context } = scene;
      scene._executeOITFunction = function (
        scene,
        executeFunction,
        passState,
        commands,
        invertClassification,
      ) {
        view.globeDepth.prepareColorTextures(context);
        view.oit.executeCommands(
          scene,
          executeFunction,
          passState,
          commands,
          invertClassification,
        );
      };
    }
    return scene._executeOITFunction;
  }
  if (scene.frameState.passes.render) {
    return executeTranslucentCommandsBackToFront;
  }
  return executeTranslucentCommandsFrontToBack;
}

/**
 * 执行绘制命令以在场景中渲染半透明对象。
 *
 * @param {Scene} scene 场景。
 * @param {PassState} passState 当前渲染通道的状态。
 * @param {FrustumCommands} frustumCommands 当前视锥体的绘制命令。
 *
 * @private
 */
function performTranslucentPass(scene, passState, frustumCommands) {
  const { frameState, context } = scene;
  const { pick, pickVoxel } = frameState.passes;
  const picking = pick || pickVoxel;

  let invertClassification;
  if (
    !picking &&
    scene._environmentState.useInvertClassification &&
    frameState.invertClassificationColor.alpha < 1.0
  ) {
    // Fullscreen pass to copy unclassified fragments when alpha < 1.0.
    // Not executed when undefined.
    invertClassification = scene._invertClassification;
  }

  const executeTranslucentCommands =
    obtainTranslucentCommandExecutionFunction(scene);

  context.uniformState.updatePass(Pass.TRANSLUCENT);
  const commands = frustumCommands.commands[Pass.TRANSLUCENT];
  commands.length = frustumCommands.indices[Pass.TRANSLUCENT];
  executeTranslucentCommands(
    scene,
    executeCommand,
    passState,
    commands,
    invertClassification,
  );
}

/**
 * 执行用于分类半透明 3D Tiles 的命令。
 *
 * @param {Scene} scene 场景。
 * @param {PassState} passState 当前渲染通道的状态。
 * @param {FrustumCommands} frustumCommands 当前视锥体的绘制命令。
 *
 * @private
 */
function performTranslucent3DTilesClassification(
  scene,
  passState,
  frustumCommands,
) {
  const { translucentTileClassification, globeDepth } = scene._view;
  const has3DTilesClassificationCommands =
    frustumCommands.indices[Pass.CESIUM_3D_TILE_CLASSIFICATION] > 0;
  if (
    !has3DTilesClassificationCommands ||
    !translucentTileClassification.isSupported()
  ) {
    return;
  }

  const commands = frustumCommands.commands[Pass.TRANSLUCENT];
  translucentTileClassification.executeTranslucentCommands(
    scene,
    executeCommand,
    passState,
    commands,
    globeDepth.depthStencilTexture,
  );
  translucentTileClassification.executeClassificationCommands(
    scene,
    executeCommand,
    passState,
    frustumCommands,
  );
}

function performCesium3DTileEdgesPass(scene, passState, frustumCommands) {
  scene.context.uniformState.updatePass(Pass.CESIUM_3D_TILE_EDGES);

  const originalFramebuffer = passState.framebuffer;

  scene.context.uniformState.edgeColorTexture = scene.context.defaultTexture;
  scene.context.uniformState.edgeIdTexture = scene.context.defaultTexture;
  scene.context.uniformState.edgeDepthTexture = scene.context.defaultTexture;

  // Set edge framebuffer for rendering
  if (
    scene._enableEdgeVisibility &&
    defined(scene._view) &&
    defined(scene._view.edgeFramebuffer)
  ) {
    passState.framebuffer = scene._view.edgeFramebuffer.framebuffer;
  }

  // performPass
  const commands = frustumCommands.commands[Pass.CESIUM_3D_TILE_EDGES];
  const commandCount = frustumCommands.indices[Pass.CESIUM_3D_TILE_EDGES];

  // clear edge framebuffer
  if (
    scene._enableEdgeVisibility &&
    defined(scene._view) &&
    defined(scene._view.edgeFramebuffer)
  ) {
    const clearCommand = scene._view.edgeFramebuffer.getClearCommand(
      new Color(0.0, 0.0, 0.0, 0.0),
    );
    clearCommand.execute(scene.context, passState);
  }

  // Then execute edge rendering commands
  for (let j = 0; j < commandCount; ++j) {
    executeCommand(commands[j], scene, passState);
  }

  passState.framebuffer = originalFramebuffer;
}

/**
 * 执行平面填充特征 ID 预渲染通道。
 *
 * 非背景平面填充几何图形将其片段级特征 ID 写入
 * 平面填充 ID 帧缓冲区中。这允许在主要 3D Tiles 中检测背景填充。
 * 通道以判断现有像素是否属于同一逻辑对象。
 *
 * @param {Scene} scene
 * @param {PassState} passState
 * @param {FrustumCommands} frustumCommands
 * @private
 */
function performPlanarFillIdPass(scene, passState, frustumCommands) {
  const { context } = scene;
  const { uniformState } = context;

  uniformState.updatePass(Pass.CESIUM_3D_TILE_PLANAR_FILL_ID);

  // Default to a blank texture so shaders always have something to sample.
  uniformState.planarFillIdTexture = context.defaultTexture;

  const view = scene._view;
  const fb = view && view.planarFillIdFramebuffer;

  const commands = frustumCommands.commands[Pass.CESIUM_3D_TILE_PLANAR_FILL_ID];
  const commandCount =
    frustumCommands.indices[Pass.CESIUM_3D_TILE_PLANAR_FILL_ID];

  if (commandCount === 0) {
    return;
  }

  if (scene._enablePlanarFillId && defined(fb) && defined(fb.framebuffer)) {
    const originalFramebuffer = passState.framebuffer;
    passState.framebuffer = fb.framebuffer;

    // Clear to (0,0,0,0) — feature ID 0 means "no planar fill here".
    const clearCommand = fb.getClearCommand(new Color(0.0, 0.0, 0.0, 0.0));
    clearCommand.execute(context, passState);

    for (let j = 0; j < commandCount; ++j) {
      executeCommand(commands[j], scene, passState);
    }

    passState.framebuffer = originalFramebuffer;
  }
}

/**
 * 执行应直接渲染到主帧缓冲区的边缘命令。
 * （EDGES_ONLY 模式）。这些边缘绕过 MRT 边缘帧缓冲区并渲染在表面几何图形之上。
 * 执行所有渲染通道的绘制命令。
 *
 * @param {Scene} scene
 * @param {PassState} passState
 * @param {FrustumCommands} frustumCommands
 *
 * @private
 */
function performCesium3DTileEdgesDirectPass(scene, passState, frustumCommands) {
  scene.context.uniformState.updatePass(Pass.CESIUM_3D_TILE_EDGES_DIRECT);

  const commands = frustumCommands.commands[Pass.CESIUM_3D_TILE_EDGES_DIRECT];
  const commandCount =
    frustumCommands.indices[Pass.CESIUM_3D_TILE_EDGES_DIRECT];

  for (let j = 0; j < commandCount; ++j) {
    executeCommand(commands[j], scene, passState);
  }
}

/**
 * 执行所有渲染通道的绘制命令。
 *
 * @param {Scene} scene
 * @param {PassState} passState
 *
 * @private
 */
function executeCommands(scene, passState) {
  const { camera, context, frameState } = scene;
  const { uniformState } = context;

  uniformState.updateCamera(camera);

  // Ensure planar fill ID texture is always available (even during edge pass)
  // so that shaders referencing czm_planarFillIdTexture never see undefined.
  uniformState.planarFillIdTexture = context.defaultTexture;

  const frustum = createWorkingFrustum(camera);
  frustum.near = camera.frustum.near;
  frustum.far = camera.frustum.far;

  const passes = frameState.passes;
  const picking = passes.pick || passes.pickVoxel;

  // Ideally, we would render the sky box and atmosphere last for
  // early-z, but we would have to draw it in each frustum.
  // Do not render environment primitives during a pick pass since they do not generate picking commands.
  if (!picking) {
    renderEnvironment(scene, passState);
  }

  const {
    clearGlobeDepth,
    renderTranslucentDepthForPick,
    useDepthPlane,
    useGlobeDepthFramebuffer,
    useInvertClassification,
    usePostProcessSelected,
  } = scene._environmentState;

  const {
    globeDepth,
    globeTranslucencyFramebuffer,
    sceneFramebuffer,
    frustumCommandsList,
  } = scene._view;
  const numFrustums = frustumCommandsList.length;

  const globeTranslucencyState = scene._globeTranslucencyState;
  const clearDepth = scene._depthClearCommand;
  const clearStencil = scene._stencilClearCommand;
  const clearClassificationStencil = scene._classificationStencilClearCommand;
  const depthPlane = scene._depthPlane;

  const height2D = camera.position.z;

  function performPass(frustumCommands, passId) {
    uniformState.updatePass(passId);
    const commands = frustumCommands.commands[passId];
    const commandCount = frustumCommands.indices[passId];
    for (let j = 0; j < commandCount; ++j) {
      executeCommand(commands[j], scene, passState);
    }
    return commandCount;
  }

  function performIdPass(frustumCommands, passId) {
    uniformState.updatePass(passId);
    const commands = frustumCommands.commands[passId];
    const commandCount = frustumCommands.indices[passId];
    for (let j = 0; j < commandCount; ++j) {
      executeIdCommand(commands[j], scene, passState);
    }
  }

  // Execute commands in each frustum in back to front order
  for (let i = 0; i < numFrustums; ++i) {
    const index = numFrustums - i - 1;
    const frustumCommands = frustumCommandsList[index];

    if (scene.mode === SceneMode.SCENE2D) {
      // To avoid z-fighting in 2D, move the camera to just before the frustum
      // and scale the frustum depth to be in [1.0, nearToFarDistance2D].
      camera.position.z = height2D - frustumCommands.near + 1.0;
      frustum.far = Math.max(1.0, frustumCommands.far - frustumCommands.near);
      frustum.near = 1.0;
      uniformState.update(frameState);
      uniformState.updateFrustum(frustum);
    } else {
      // Avoid tearing artifacts between adjacent frustums in the opaque passes
      frustum.near =
        index !== 0
          ? frustumCommands.near * scene.opaqueFrustumNearOffset
          : frustumCommands.near;
      frustum.far = frustumCommands.far;
      uniformState.updateFrustum(frustum);
    }

    clearDepth.execute(context, passState);

    if (context.stencilBuffer) {
      clearStencil.execute(context, passState);
    }

    if (globeTranslucencyState.translucent) {
      uniformState.updatePass(Pass.GLOBE);
      globeTranslucencyState.executeGlobeCommands(
        frustumCommands,
        executeCommand,
        globeTranslucencyFramebuffer,
        scene,
        passState,
      );
    } else {
      performPass(frustumCommands, Pass.GLOBE);
    }

    if (useGlobeDepthFramebuffer) {
      globeDepth.executeCopyDepth(context, passState);
    }

    // Draw terrain classification
    if (!renderTranslucentDepthForPick) {
      if (globeTranslucencyState.translucent) {
        uniformState.updatePass(Pass.TERRAIN_CLASSIFICATION);
        globeTranslucencyState.executeGlobeClassificationCommands(
          frustumCommands,
          executeCommand,
          globeTranslucencyFramebuffer,
          scene,
          passState,
        );
      } else {
        performPass(frustumCommands, Pass.TERRAIN_CLASSIFICATION);
      }
    }

    if (clearGlobeDepth) {
      clearDepth.execute(context, passState);
      if (useDepthPlane) {
        depthPlane.execute(context, passState);
      }
    }

    let commandCount;

    // Draw edges FIRST - before binding textures to avoid feedback loop
    performCesium3DTileEdgesPass(scene, passState, frustumCommands);

    if (
      scene._enableEdgeVisibility &&
      defined(scene._view) &&
      defined(scene._view.edgeFramebuffer)
    ) {
      // Get edge color texture (attachment 0)
      const colorTexture = scene._view.edgeFramebuffer.colorTexture;
      if (defined(colorTexture)) {
        scene.context.uniformState.edgeColorTexture = colorTexture;
      } else {
        scene.context.uniformState.edgeColorTexture =
          scene.context.defaultTexture;
      }

      // Get edge ID texture (attachment 1)
      const idTexture = scene._view.edgeFramebuffer.idTexture;
      if (defined(idTexture)) {
        scene.context.uniformState.edgeIdTexture = idTexture;
      } else {
        scene.context.uniformState.edgeIdTexture = scene.context.defaultTexture;
      }

      // Get edge depth texture (attachment 2)
      const edgeDepthTexture = scene._view.edgeFramebuffer.depthTexture;
      if (defined(edgeDepthTexture)) {
        scene.context.uniformState.edgeDepthTexture = edgeDepthTexture;
      } else {
        scene.context.uniformState.edgeDepthTexture =
          scene.context.defaultTexture;
      }
    } else {
      scene.context.uniformState.edgeColorTexture =
        scene.context.defaultTexture;
      scene.context.uniformState.edgeIdTexture = scene.context.defaultTexture;
      scene.context.uniformState.edgeDepthTexture =
        scene.context.defaultTexture;
    }

    // Planar fill feature-ID pre-pass: write feature IDs from non-behind
    // planar fill geometry so that behind fills can test same-object.
    performPlanarFillIdPass(scene, passState, frustumCommands);

    if (
      scene._enablePlanarFillId &&
      defined(scene._view) &&
      defined(scene._view.planarFillIdFramebuffer)
    ) {
      const pfIdTexture = scene._view.planarFillIdFramebuffer.idTexture;
      uniformState.planarFillIdTexture = defined(pfIdTexture)
        ? pfIdTexture
        : context.defaultTexture;
    } else {
      uniformState.planarFillIdTexture = context.defaultTexture;
    }

    if (!useInvertClassification || picking || renderTranslucentDepthForPick) {
      // Common/fastest path. Draw 3D Tiles and classification normally.

      // Draw 3D Tiles
      commandCount = performPass(frustumCommands, Pass.CESIUM_3D_TILE);

      if (commandCount > 0) {
        if (useGlobeDepthFramebuffer) {
          globeDepth.prepareColorTextures(context, clearGlobeDepth);
          globeDepth.executeUpdateDepth(
            context,
            passState,
            globeDepth.depthStencilTexture,
          );
        }

        // Draw classifications. Modifies 3D Tiles color.
        if (!renderTranslucentDepthForPick) {
          commandCount = performPass(
            frustumCommands,
            Pass.CESIUM_3D_TILE_CLASSIFICATION,
          );
        }
      }
    } else {
      // When the invert classification color is opaque:
      //    Main FBO (FBO1):                   Main_Color   + Main_DepthStencil
      //    Invert classification FBO (FBO2) : Invert_Color + Main_DepthStencil
      //
      //    1. Clear FBO2 color to vec4(0.0) for each frustum
      //    2. Draw 3D Tiles to FBO2
      //    3. Draw classification to FBO2
      //    4. Fullscreen pass to FBO1, draw Invert_Color when:
      //           * Main_DepthStencil has the stencil bit set > 0 (classified)
      //    5. Fullscreen pass to FBO1, draw Invert_Color * czm_invertClassificationColor when:
      //           * Main_DepthStencil has stencil bit set to 0 (unclassified) and
      //           * Invert_Color !== vec4(0.0)
      //
      // When the invert classification color is translucent:
      //    Main FBO (FBO1):                  Main_Color         + Main_DepthStencil
      //    Invert classification FBO (FBO2): Invert_Color       + Invert_DepthStencil
      //    IsClassified FBO (FBO3):          IsClassified_Color + Invert_DepthStencil
      //
      //    1. Clear FBO2 and FBO3 color to vec4(0.0), stencil to 0, and depth to 1.0
      //    2. Draw 3D Tiles to FBO2
      //    3. Draw classification to FBO2
      //    4. Fullscreen pass to FBO3, draw any color when
      //           * Invert_DepthStencil has the stencil bit set > 0 (classified)
      //    5. Fullscreen pass to FBO1, draw Invert_Color when:
      //           * Invert_Color !== vec4(0.0) and
      //           * IsClassified_Color !== vec4(0.0)
      //    6. Fullscreen pass to FBO1, draw Invert_Color * czm_invertClassificationColor when:
      //           * Invert_Color !== vec4(0.0) and
      //           * IsClassified_Color === vec4(0.0)
      //
      // NOTE: Step six when translucent invert color occurs after the TRANSLUCENT pass
      //
      scene._invertClassification.clear(context, passState);

      const opaqueClassificationFramebuffer = passState.framebuffer;
      passState.framebuffer = scene._invertClassification._fbo.framebuffer;

      // Draw normally
      performPass(frustumCommands, Pass.CESIUM_3D_TILE);

      if (useGlobeDepthFramebuffer) {
        scene._invertClassification.prepareTextures(context);
        globeDepth.executeUpdateDepth(
          context,
          passState,
          scene._invertClassification._fbo.getDepthStencilTexture(),
        );
      }

      // Set stencil
      commandCount = performPass(
        frustumCommands,
        Pass.CESIUM_3D_TILE_CLASSIFICATION_IGNORE_SHOW,
      );

      passState.framebuffer = opaqueClassificationFramebuffer;

      // Fullscreen pass to copy classified fragments
      scene._invertClassification.executeClassified(context, passState);
      if (frameState.invertClassificationColor.alpha === 1.0) {
        // Fullscreen pass to copy unclassified fragments when alpha == 1.0
        scene._invertClassification.executeUnclassified(context, passState);
      }

      // Clear stencil set by the classification for the next classification pass
      if (commandCount > 0 && context.stencilBuffer) {
        clearClassificationStencil.execute(context, passState);
      }

      // Draw style over classification.
      commandCount = performPass(
        frustumCommands,
        Pass.CESIUM_3D_TILE_CLASSIFICATION,
      );
    }

    if (commandCount > 0 && context.stencilBuffer) {
      clearStencil.execute(context, passState);
    }

    performVoxelsPass(scene, passState, frustumCommands);

    performPass(frustumCommands, Pass.OPAQUE);

    // Draw direct edges (EDGES_ONLY mode) after opaque surfaces
    performCesium3DTileEdgesDirectPass(scene, passState, frustumCommands);

    performGaussianSplatPass(scene, passState, frustumCommands);

    if (index !== 0 && scene.mode !== SceneMode.SCENE2D) {
      // Do not overlap frustums in the translucent pass to avoid blending artifacts
      frustum.near = frustumCommands.near;
      uniformState.updateFrustum(frustum);
    }

    performTranslucentPass(scene, passState, frustumCommands);

    performTranslucent3DTilesClassification(scene, passState, frustumCommands);

    if (
      context.depthTexture &&
      scene.useDepthPicking &&
      (useGlobeDepthFramebuffer || renderTranslucentDepthForPick)
    ) {
      // PERFORMANCE_IDEA: Use MRT to avoid the extra copy.
      const pickDepth = scene._picking.getPickDepth(scene, index);
      pickDepth.update(context, globeDepth.depthStencilTexture);
      pickDepth.executeCopyDepth(context, passState);
    }

    if (picking || !usePostProcessSelected) {
      continue;
    }

    const originalFramebuffer = passState.framebuffer;
    passState.framebuffer = sceneFramebuffer.getIdFramebuffer();

    // reset frustum
    frustum.near =
      index !== 0
        ? frustumCommands.near * scene.opaqueFrustumNearOffset
        : frustumCommands.near;
    frustum.far = frustumCommands.far;
    uniformState.updateFrustum(frustum);

    if (globeTranslucencyState.translucent) {
      uniformState.updatePass(Pass.GLOBE);
      globeTranslucencyState.executeGlobeCommands(
        frustumCommands,
        executeIdCommand,
        globeTranslucencyFramebuffer,
        scene,
        passState,
      );
    } else {
      performIdPass(frustumCommands, Pass.GLOBE);
    }

    if (clearGlobeDepth) {
      clearDepth.framebuffer = passState.framebuffer;
      clearDepth.execute(context, passState);
      clearDepth.framebuffer = undefined;
    }

    if (clearGlobeDepth && useDepthPlane) {
      depthPlane.execute(context, passState);
    }

    performIdPass(frustumCommands, Pass.CESIUM_3D_TILE);
    performIdPass(frustumCommands, Pass.OPAQUE);
    performIdPass(frustumCommands, Pass.TRANSLUCENT);

    passState.framebuffer = originalFramebuffer;
  }
}

/**
 * 渲染天空、大气、太阳和月亮。
 *
 * @param {Scene} scene 场景。
 * @param {PassState} passState 该通道的渲染状态。
 *
 * @private
 */
function renderEnvironment(scene, passState) {
  const { context, environmentState, view } = scene;

  context.uniformState.updatePass(Pass.ENVIRONMENT);

  if (defined(environmentState.skyBoxCommand)) {
    executeCommand(environmentState.skyBoxCommand, scene, passState);
  }

  if (environmentState.isSkyAtmosphereVisible) {
    executeCommand(environmentState.skyAtmosphereCommand, scene, passState);
  }

  if (environmentState.isSunVisible) {
    environmentState.sunDrawCommand.execute(context, passState);
    if (scene.sunBloom && !environmentState.useWebVR) {
      let framebuffer;
      if (environmentState.useGlobeDepthFramebuffer) {
        framebuffer = view.globeDepth.framebuffer;
      } else if (environmentState.usePostProcess) {
        framebuffer = view.sceneFramebuffer.framebuffer;
      } else {
        framebuffer = environmentState.originalFramebuffer;
      }
      scene._sunPostProcess.execute(context);
      scene._sunPostProcess.copy(context, framebuffer);
      passState.framebuffer = framebuffer;
    }
  }

  // Moon can be seen through the atmosphere, since the sun is rendered after the atmosphere.
  if (environmentState.isMoonVisible) {
    environmentState.moonCommand.execute(context, passState);
  }

  // execute panorama commands, drop removed primitives
  const panoramaCommandList = scene.frameState.panoramaCommandList;
  for (let i = panoramaCommandList.length - 1; i >= 0; i--) {
    const panoramaCommand = panoramaCommandList[i];
    if (defined(panoramaCommand.shaderProgram)) {
      executeCommand(panoramaCommandList[i], scene, passState);
    } else {
      //primitive was removed
      panoramaCommandList.splice(i, 1);
    }
  }
}

/**
 * 从场景环境状态和 `computeCommandList` 中执行计算命令。
 *
 * @param {Scene} scene
 *
 * @private
 */
function executeComputeCommands(scene) {
  scene.context.uniformState.updatePass(Pass.COMPUTE);

  const sunComputeCommand = scene._environmentState.sunComputeCommand;
  if (defined(sunComputeCommand)) {
    sunComputeCommand.execute(scene._computeEngine);
  }

  const commandList = scene._computeCommandList;
  for (let i = 0; i < commandList.length; ++i) {
    commandList[i].execute(scene._computeEngine);
  }
}

/**
 * 执行覆盖层的绘制命令。
 *
 * @param {Scene} scene
 * @param {PassState} passState
 *
 * @private
 */
function executeOverlayCommands(scene, passState) {
  scene.context.uniformState.updatePass(Pass.OVERLAY);

  const context = scene.context;
  const commandList = scene._overlayCommandList;
  for (let i = 0; i < commandList.length; ++i) {
    commandList[i].execute(context, passState);
  }
}

/**
 * 将场景的绘制命令添加到阴影图通道中。
 *
 * @param {Scene} scene
 * @param {DrawCommand[]} commandList
 * @param {ShadowMap} shadowMap
 *
 * @private
 */
function insertShadowCastCommands(scene, commandList, shadowMap) {
  const { shadowMapCullingVolume, isPointLight, passes } = shadowMap;
  const numberOfPasses = passes.length;

  const shadowedPasses = [
    Pass.GLOBE,
    Pass.CESIUM_3D_TILE,
    Pass.OPAQUE,
    Pass.TRANSLUCENT,
  ];

  for (let i = 0; i < commandList.length; ++i) {
    const command = commandList[i];
    scene.updateDerivedCommands(command);

    if (
      !command.castShadows ||
      shadowedPasses.indexOf(command.pass) < 0 ||
      !scene.isVisible(shadowMapCullingVolume, command)
    ) {
      continue;
    }

    if (isPointLight) {
      for (let k = 0; k < numberOfPasses; ++k) {
        passes[k].commandList.push(command);
      }
    } else if (numberOfPasses === 1) {
      passes[0].commandList.push(command);
    } else {
      let wasVisible = false;
      // Loop over cascades from largest to smallest
      for (let j = numberOfPasses - 1; j >= 0; --j) {
        const cascadeVolume = passes[j].cullingVolume;
        if (scene.isVisible(cascadeVolume, command)) {
          passes[j].commandList.push(command);
          wasVisible = true;
        } else if (wasVisible) {
          // If it was visible in the previous cascade but now isn't
          // then there is no need to check any more cascades
          break;
        }
      }
    }
  }
}

/**
 * 执行绘制命令以在阴影图中投射阴影。
 *
 * @param {Scene} scene
 *
 * @private
 */
function executeShadowMapCastCommands(scene) {
  const { shadowState, commandList } = scene.frameState;
  const { shadowsEnabled, shadowMaps } = shadowState;

  if (!shadowsEnabled) {
    return;
  }

  const { context } = scene;
  const { uniformState } = context;

  for (let i = 0; i < shadowMaps.length; ++i) {
    const shadowMap = shadowMaps[i];
    if (shadowMap.outOfView) {
      continue;
    }

    // Reset the command lists
    const { passes } = shadowMap;
    for (let j = 0; j < passes.length; ++j) {
      passes[j].commandList.length = 0;
    }

    // Insert the primitive/model commands into the shadow map command lists
    insertShadowCastCommands(scene, commandList, shadowMap);

    for (let j = 0; j < passes.length; ++j) {
      const pass = shadowMap.passes[j];
      const { camera, commandList } = pass;
      uniformState.updateCamera(camera);
      shadowMap.updatePass(context, j);
      for (let k = 0; k < commandList.length; ++k) {
        const command = commandList[k];
        // Set the correct pass before rendering into the shadow map because some shaders
        // conditionally render based on whether the pass is translucent or opaque.
        uniformState.updatePass(command.pass);
        const castCommand = command.derivedCommands.shadows.castCommands[i];
        executeCommand(castCommand, scene, pass.passState);
      }
    }
  }
}

const scratchEyeTranslation = new Cartesian3();

/**
 * 更新和清除帧缓冲区，并执行绘制命令。
 *
 * @param {PassState} passState 每个渲染通道特有的状态。
 * @param {Color} backgroundColor
 *
 * @private
 */
Scene.prototype.updateAndExecuteCommands = function (
  passState,
  backgroundColor,
) {
  updateAndClearFramebuffers(this, passState, backgroundColor);

  if (this._environmentState.useWebVR) {
    executeWebVRCommands(this, passState, backgroundColor);
  } else if (
    this._frameState.mode !== SceneMode.SCENE2D ||
    this._mapMode2D === MapMode2D.ROTATE
  ) {
    executeCommandsInViewport(true, this, passState);
  } else {
    execute2DViewportCommands(this, passState);
  }
};

/**
 * 执行绘制命令以在 WebVR 应用的立体视口中渲染场景。
 *
 * @param {Scene} scene
 * @param {PassState} passState
 *
 * @private
 */
function executeWebVRCommands(scene, passState) {
  const view = scene._view;
  const camera = view.camera;
  const environmentState = scene._environmentState;
  const renderTranslucentDepthForPick =
    environmentState.renderTranslucentDepthForPick;

  updateAndRenderPrimitives(scene);

  view.createPotentiallyVisibleSet(scene);

  executeComputeCommands(scene);

  if (!renderTranslucentDepthForPick) {
    executeShadowMapCastCommands(scene);
  }

  // Based on Calculating Stereo pairs by Paul Bourke
  // http://paulbourke.net/stereographics/stereorender/
  const viewport = passState.viewport;
  viewport.x = 0;
  viewport.y = 0;
  viewport.width = viewport.width * 0.5;

  const savedCamera = Camera.clone(camera, scene._cameraVR);
  savedCamera.frustum = camera.frustum;

  const near = camera.frustum.near;
  const fo = near * (scene.focalLength ?? 5.0);
  const eyeSeparation = scene.eyeSeparation ?? fo / 30.0;
  const eyeTranslation = Cartesian3.multiplyByScalar(
    savedCamera.right,
    eyeSeparation * 0.5,
    scratchEyeTranslation,
  );

  camera.frustum.aspectRatio = viewport.width / viewport.height;

  const offset = (0.5 * eyeSeparation * near) / fo;

  Cartesian3.add(savedCamera.position, eyeTranslation, camera.position);
  camera.frustum.xOffset = offset;

  executeCommands(scene, passState);

  viewport.x = viewport.width;

  Cartesian3.subtract(savedCamera.position, eyeTranslation, camera.position);
  camera.frustum.xOffset = -offset;

  executeCommands(scene, passState);

  Camera.clone(savedCamera, camera);
}

const scratch2DViewportCartographic = new Cartographic(
  Math.PI,
  CesiumMath.PI_OVER_TWO,
);
const scratch2DViewportMaxCoord = new Cartesian3();
const scratch2DViewportSavedPosition = new Cartesian3();
const scratch2DViewportTransform = new Matrix4();
const scratch2DViewportCameraTransform = new Matrix4();
const scratch2DViewportEyePoint = new Cartesian3();
const scratch2DViewportWindowCoords = new Cartesian3();
const scratch2DViewport = new BoundingRectangle();

/**
 * 执行绘制命令以在 2D 视口中渲染。
 *
 * @param {Scene} scene
 * @param {PassState} passState
 *
 * @private
 */
function execute2DViewportCommands(scene, passState) {
  const { frameState, camera } = scene;
  const { uniformState } = scene.context;

  const originalViewport = passState.viewport;
  const viewport = BoundingRectangle.clone(originalViewport, scratch2DViewport);
  passState.viewport = viewport;

  const maxCartographic = scratch2DViewportCartographic;
  const maxCoord = scratch2DViewportMaxCoord;

  const projection = scene.mapProjection;
  projection.project(maxCartographic, maxCoord);

  const position = Cartesian3.clone(
    camera.position,
    scratch2DViewportSavedPosition,
  );
  const transform = Matrix4.clone(
    camera.transform,
    scratch2DViewportCameraTransform,
  );
  const frustum = camera.frustum.clone();

  camera._setTransform(Matrix4.IDENTITY);

  const viewportTransformation = Matrix4.computeViewportTransformation(
    viewport,
    0.0,
    1.0,
    scratch2DViewportTransform,
  );
  const projectionMatrix = camera.frustum.projectionMatrix;

  const x = camera.positionWC.y;
  const eyePoint = Cartesian3.fromElements(
    CesiumMath.sign(x) * maxCoord.x - x,
    0.0,
    -camera.positionWC.x,
    scratch2DViewportEyePoint,
  );
  const windowCoordinates = FixedFrameTransforms.pointToGLWindowCoordinates(
    projectionMatrix,
    viewportTransformation,
    eyePoint,
    scratch2DViewportWindowCoords,
  );

  windowCoordinates.x = Math.floor(windowCoordinates.x);

  const viewportX = viewport.x;
  const viewportWidth = viewport.width;

  if (
    x === 0.0 ||
    windowCoordinates.x <= viewportX ||
    windowCoordinates.x >= viewportX + viewportWidth
  ) {
    executeCommandsInViewport(true, scene, passState);
  } else if (
    Math.abs(viewportX + viewportWidth * 0.5 - windowCoordinates.x) < 1.0
  ) {
    viewport.width = windowCoordinates.x - viewport.x;

    camera.position.x *= CesiumMath.sign(camera.position.x);

    camera.frustum.right = 0.0;

    frameState.cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC,
    );
    uniformState.update(frameState);

    executeCommandsInViewport(true, scene, passState);

    viewport.x = windowCoordinates.x;

    camera.position.x = -camera.position.x;

    camera.frustum.right = -camera.frustum.left;
    camera.frustum.left = 0.0;

    frameState.cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC,
    );
    uniformState.update(frameState);

    executeCommandsInViewport(false, scene, passState);
  } else if (windowCoordinates.x > viewportX + viewportWidth * 0.5) {
    viewport.width = windowCoordinates.x - viewportX;

    const right = camera.frustum.right;
    camera.frustum.right = maxCoord.x - x;

    frameState.cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC,
    );
    uniformState.update(frameState);

    executeCommandsInViewport(true, scene, passState);

    viewport.x = windowCoordinates.x;
    viewport.width = viewportX + viewportWidth - windowCoordinates.x;

    camera.position.x = -camera.position.x;

    camera.frustum.left = -camera.frustum.right;
    camera.frustum.right = right - camera.frustum.right * 2.0;

    frameState.cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC,
    );
    uniformState.update(frameState);

    executeCommandsInViewport(false, scene, passState);
  } else {
    viewport.x = windowCoordinates.x;
    viewport.width = viewportX + viewportWidth - windowCoordinates.x;

    const left = camera.frustum.left;
    camera.frustum.left = -maxCoord.x - x;

    frameState.cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC,
    );
    uniformState.update(frameState);

    executeCommandsInViewport(true, scene, passState);

    viewport.x = viewportX;
    viewport.width = windowCoordinates.x - viewportX;

    camera.position.x = -camera.position.x;

    camera.frustum.right = -camera.frustum.left;
    camera.frustum.left = left - camera.frustum.left * 2.0;

    frameState.cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC,
    );
    uniformState.update(frameState);

    executeCommandsInViewport(false, scene, passState);
  }

  camera._setTransform(transform);
  Cartesian3.clone(position, camera.position);
  camera.frustum = frustum.clone();
  passState.viewport = originalViewport;
}

/**
 * 执行绘制命令以在视口中渲染场景。
 * 如果这是第一个被渲染的视口，则帧缓冲区将被清除为背景颜色。
 *
 * @param {boolean} firstViewport 如果这是第一个被渲染的视口，则输出 `true`。
 * @param {Scene} scene
 * @param {PassState} passState
 *
 * @private
 */
function executeCommandsInViewport(firstViewport, scene, passState) {
  const view = scene._view;
  const { renderTranslucentDepthForPick } = scene._environmentState;

  if (!firstViewport) {
    scene.frameState.commandList.length = 0;
  }

  updateAndRenderPrimitives(scene);

  view.createPotentiallyVisibleSet(scene);

  if (firstViewport) {
    executeComputeCommands(scene);
    if (!renderTranslucentDepthForPick) {
      executeShadowMapCastCommands(scene);
    }
  }

  executeCommands(scene, passState);
}

const scratchCullingVolume = new CullingVolume();

/**
 * 标记子树中的每个可覆盖集合，以便向量提供器在此帧中将其烘焙。
 *
 * @param {PrimitiveCollection} collection
 * @param {VectorProvider} vectorProvider
 * @param {number} frameNumber
 * @private
 */
function markVectorCollections(collection, vectorProvider, frameNumber) {
  if (!collection.show) {
    return;
  }

  const length = collection.length;
  for (let i = 0; i < length; ++i) {
    const primitive = collection.get(i);
    if (primitive instanceof PrimitiveCollection) {
      markVectorCollections(primitive, vectorProvider, frameNumber);
      continue;
    }

    if (
      primitive.show &&
      VectorProvider.isSupported(primitive) &&
      isHeightReferenceClamp(primitive.heightReference)
    ) {
      vectorProvider.markForFrame(
        primitive,
        frameNumber,
        primitive.heightReference,
      );
    }
  }
}

/**
 * @param {Scene} scene
 * @param {FrameState} frameState
 * @private
 */
function updateVectorProvider(scene, frameState) {
  const vectorProvider = scene.vectorProvider;
  if (!defined(vectorProvider)) {
    return;
  }

  const frameNumber = frameState.frameNumber;
  markVectorCollections(scene._primitives, vectorProvider, frameNumber);

  if (frameState.passes.render) {
    // Surfaces bake draped collections as a frame begins, so changes made during it show next frame.
    frameState.afterRender.push(() =>
      vectorProvider.changedDuringFrame(frameNumber),
    );
  }
}

/**
 * @private
 */
Scene.prototype.updateEnvironment = function () {
  const frameState = this._frameState;
  const view = this._view;

  // Update celestial and terrestrial environment effects.
  const environmentState = this._environmentState;
  const renderPass = frameState.passes.render;
  const offscreenPass = frameState.passes.offscreen;
  const atmosphere = this.atmosphere;
  const skyAtmosphere = this.skyAtmosphere;
  const globe = this.globe;
  const globeTranslucencyState = this._globeTranslucencyState;

  if (
    !renderPass ||
    (this._mode !== SceneMode.SCENE2D &&
      view.camera.frustum instanceof OrthographicFrustum) ||
    !globeTranslucencyState.environmentVisible
  ) {
    environmentState.skyAtmosphereCommand = undefined;
    environmentState.skyBoxCommand = undefined;
    environmentState.sunDrawCommand = undefined;
    environmentState.sunComputeCommand = undefined;
    environmentState.moonCommand = undefined;
  } else {
    if (defined(skyAtmosphere)) {
      if (defined(globe)) {
        skyAtmosphere.setDynamicLighting(
          DynamicAtmosphereLightingType.fromGlobeFlags(globe),
        );
        environmentState.isReadyForAtmosphere =
          environmentState.isReadyForAtmosphere ||
          !globe.show ||
          globe._surface._tilesToRender.length > 0;
      } else {
        const dynamicLighting = atmosphere.dynamicLighting;
        skyAtmosphere.setDynamicLighting(dynamicLighting);
        environmentState.isReadyForAtmosphere = true;
      }

      environmentState.skyAtmosphereCommand = skyAtmosphere.update(
        frameState,
        globe,
      );
      if (defined(environmentState.skyAtmosphereCommand)) {
        this.updateDerivedCommands(environmentState.skyAtmosphereCommand);
      }
    } else {
      environmentState.skyAtmosphereCommand = undefined;
    }

    environmentState.skyBoxCommand = defined(this.skyBox)
      ? this.skyBox.update(frameState, this._hdr)
      : undefined;
    const sunCommands = defined(this.sun)
      ? this.sun.update(frameState, view.passState, this._hdr)
      : undefined;
    environmentState.sunDrawCommand = defined(sunCommands)
      ? sunCommands.drawCommand
      : undefined;
    environmentState.sunComputeCommand = defined(sunCommands)
      ? sunCommands.computeCommand
      : undefined;
    environmentState.moonCommand = defined(this.moon)
      ? this.moon.update(frameState)
      : undefined;
  }

  const clearGlobeDepth = (environmentState.clearGlobeDepth =
    defined(globe) &&
    globe.show &&
    (!globe.depthTestAgainstTerrain || this.mode === SceneMode.SCENE2D));
  const useDepthPlane = (environmentState.useDepthPlane =
    clearGlobeDepth &&
    this.mode === SceneMode.SCENE3D &&
    globeTranslucencyState.useDepthPlane);
  if (useDepthPlane) {
    // Update the depth plane that is rendered in 3D when the primitives are
    // not depth tested against terrain so primitives on the backface
    // of the globe are not picked.
    this._depthPlane.update(frameState);
  }

  environmentState.renderTranslucentDepthForPick = false;
  environmentState.useWebVR =
    this._useWebVR && this.mode !== SceneMode.SCENE2D && !offscreenPass;

  const occluder =
    frameState.mode === SceneMode.SCENE3D &&
    !globeTranslucencyState.sunVisibleThroughGlobe
      ? frameState.occluder
      : undefined;
  let cullingVolume = frameState.cullingVolume;

  // get user culling volume minus the far plane.
  const planes = scratchCullingVolume.planes;
  for (let k = 0; k < 5; ++k) {
    planes[k] = cullingVolume.planes[k];
  }
  cullingVolume = scratchCullingVolume;

  // Determine visibility of celestial and terrestrial environment effects.
  environmentState.isSkyAtmosphereVisible =
    defined(environmentState.skyAtmosphereCommand) &&
    environmentState.isReadyForAtmosphere;
  environmentState.isSunVisible = this.isVisible(
    cullingVolume,
    environmentState.sunDrawCommand,
    occluder,
  );
  environmentState.isMoonVisible = this.isVisible(
    cullingVolume,
    environmentState.moonCommand,
    occluder,
  );

  const envMaps = this.specularEnvironmentMaps;
  const specularEnvironmentCubeMap = this._specularEnvironmentCubeMap;
  if (defined(envMaps) && specularEnvironmentCubeMap?.url !== envMaps) {
    if (defined(specularEnvironmentCubeMap)) {
      specularEnvironmentCubeMap.destroy();
    }
    this._specularEnvironmentCubeMap = new SpecularEnvironmentCubeMap(envMaps);
  } else if (!defined(envMaps) && defined(specularEnvironmentCubeMap)) {
    specularEnvironmentCubeMap.destroy();
    this._specularEnvironmentCubeMap = undefined;
  }

  if (defined(this._specularEnvironmentCubeMap)) {
    this._specularEnvironmentCubeMap.update(frameState);
  }

  updateVectorProvider(this, frameState);
};

function updateDebugFrustumPlanes(scene) {
  const frameState = scene._frameState;
  if (scene.debugShowFrustumPlanes !== scene._debugShowFrustumPlanes) {
    if (scene.debugShowFrustumPlanes) {
      scene._debugFrustumPlanes = new DebugCameraPrimitive({
        camera: scene.camera,
        updateOnChange: false,
        frustumSplits: frameState.frustumSplits,
      });
    } else {
      scene._debugFrustumPlanes =
        scene._debugFrustumPlanes && scene._debugFrustumPlanes.destroy();
    }
    scene._debugShowFrustumPlanes = scene.debugShowFrustumPlanes;
  }

  if (defined(scene._debugFrustumPlanes)) {
    scene._debugFrustumPlanes.update(frameState);
  }
}

function updateShadowMaps(scene) {
  const frameState = scene._frameState;
  const { passes, shadowState, shadowMaps } = frameState;
  const length = shadowMaps.length;

  const shadowsEnabled =
    length > 0 &&
    !passes.pick &&
    !passes.pickVoxel &&
    scene.mode === SceneMode.SCENE3D;
  if (shadowsEnabled !== shadowState.shadowsEnabled) {
    // Update derived commands when shadowsEnabled changes
    ++shadowState.lastDirtyTime;
    shadowState.shadowsEnabled = shadowsEnabled;
  }

  shadowState.lightShadowsEnabled = false;

  if (!shadowsEnabled) {
    return;
  }

  // Check if the shadow maps are different than the shadow maps last frame.
  // If so, the derived commands need to be updated.
  for (let j = 0; j < length; ++j) {
    if (shadowMaps[j] !== shadowState.shadowMaps[j]) {
      ++shadowState.lastDirtyTime;
      break;
    }
  }

  shadowState.shadowMaps.length = 0;
  shadowState.lightShadowMaps.length = 0;

  for (let i = 0; i < length; ++i) {
    const shadowMap = shadowMaps[i];
    shadowMap.update(frameState);

    shadowState.shadowMaps.push(shadowMap);

    if (shadowMap.fromLightSource) {
      shadowState.lightShadowMaps.push(shadowMap);
      shadowState.lightShadowsEnabled = true;
    }

    if (shadowMap.dirty) {
      ++shadowState.lastDirtyTime;
      shadowMap.dirty = false;
    }
  }
}

function updateAndRenderPrimitives(scene) {
  const frameState = scene._frameState;

  // Reset per-frame edge visibility request flag before primitives update
  frameState.edgeVisibilityRequested = false;
  frameState.planarFillRequested = false;

  scene._groundPrimitives.update(frameState);
  scene._primitives.update(frameState);

  // If any primitive requested edge visibility this frame, flip the scene flag lazily.
  if (
    frameState.edgeVisibilityRequested &&
    scene._enableEdgeVisibility === false
  ) {
    scene._enableEdgeVisibility = true;
    // Framebuffer setup already ran before primitive updates this frame.
    scene._view.edgeFramebuffer.update(
      scene._context,
      scene._view.viewport,
      scene._hdr,
    );
  }

  // True only while at least one planar fill primitive is rendering;
  // the request flag is renewed each frame by ModelSceneGraph.
  scene._enablePlanarFillId = frameState.planarFillRequested;

  updateDebugFrustumPlanes(scene);
  updateShadowMaps(scene);

  if (scene._globe) {
    scene._globe.render(frameState);
  }
}

function updateAndClearFramebuffers(scene, passState, clearColor) {
  const context = scene._context;
  const frameState = scene._frameState;
  const environmentState = scene._environmentState;
  const view = scene._view;

  const passes = frameState.passes;
  const picking = passes.pick || passes.pickVoxel;
  if (defined(view.globeDepth)) {
    view.globeDepth.picking = picking;
    view.globeDepth.snapping = passes.snap;
  }
  const useWebVR = environmentState.useWebVR;

  // Preserve the reference to the original framebuffer.
  environmentState.originalFramebuffer = passState.framebuffer;

  // Manage sun bloom post-processing effect.
  if (defined(scene.sun) && scene.sunBloom !== scene._sunBloom) {
    if (scene.sunBloom && !useWebVR) {
      scene._sunPostProcess = new SunPostProcess();
    } else if (defined(scene._sunPostProcess)) {
      scene._sunPostProcess = scene._sunPostProcess.destroy();
    }

    scene._sunBloom = scene.sunBloom;
  } else if (!defined(scene.sun) && defined(scene._sunPostProcess)) {
    scene._sunPostProcess = scene._sunPostProcess.destroy();
    scene._sunBloom = false;
  }

  // Clear the pass state framebuffer.
  const clear = scene._clearColorCommand;
  Color.clone(clearColor, clear.color);
  clear.execute(context, passState);

  // Update globe depth rendering based on the current context and clear the globe depth framebuffer.
  // Globe depth is copied for the pick pass to support picking batched geometries in GroundPrimitives.
  const useGlobeDepthFramebuffer = (environmentState.useGlobeDepthFramebuffer =
    defined(view.globeDepth));
  if (useGlobeDepthFramebuffer) {
    view.globeDepth.update(
      context,
      passState,
      view.viewport,
      scene.msaaSamples,
      scene._hdr,
      environmentState.clearGlobeDepth,
    );
    view.globeDepth.clear(context, passState, clearColor);
  }

  // If supported, configure OIT to use the globe depth framebuffer and clear the OIT framebuffer.
  const oit = view.oit;
  const useOIT = (environmentState.useOIT =
    !picking && defined(oit) && oit.isSupported());
  if (useOIT) {
    oit.update(
      context,
      passState,
      view.globeDepth.colorFramebufferManager,
      scene._hdr,
      scene.msaaSamples,
    );
    oit.clear(context, passState, clearColor);
    environmentState.useOIT = oit.isSupported();
  }

  const postProcess = scene.postProcessStages;
  let usePostProcess = (environmentState.usePostProcess =
    !picking &&
    (scene._hdr ||
      postProcess.length > 0 ||
      postProcess.ambientOcclusion.enabled ||
      postProcess.fxaa.enabled ||
      postProcess.bloom.enabled));
  environmentState.usePostProcessSelected = false;
  if (usePostProcess) {
    view.sceneFramebuffer.update(
      context,
      view.viewport,
      scene._hdr,
      scene.msaaSamples,
    );
    view.sceneFramebuffer.clear(context, passState, clearColor);

    postProcess.update(context, frameState.useLogDepth, scene._hdr);
    postProcess.clear(context);

    usePostProcess = environmentState.usePostProcess = postProcess.ready;
    environmentState.usePostProcessSelected =
      usePostProcess && postProcess.hasSelected;
  }

  if (environmentState.isSunVisible && scene.sunBloom && !useWebVR) {
    passState.framebuffer = scene._sunPostProcess.update(passState);
    scene._sunPostProcess.clear(context, passState, clearColor);
  } else if (useGlobeDepthFramebuffer) {
    passState.framebuffer = view.globeDepth.framebuffer;
  } else if (usePostProcess) {
    passState.framebuffer = view.sceneFramebuffer.framebuffer;
  }

  if (defined(passState.framebuffer)) {
    clear.execute(context, passState);
  }

  const useInvertClassification = (environmentState.useInvertClassification =
    !picking && defined(passState.framebuffer) && scene.invertClassification);

  // Update edge framebuffer for 3D tile edge rendering
  const useEdgeFramebuffer = !picking && scene._enableEdgeVisibility;
  if (useEdgeFramebuffer) {
    view.edgeFramebuffer.update(context, view.viewport, scene._hdr);
  }

  // Update planar fill ID framebuffer
  const usePlanarFillIdFramebuffer = !picking && scene._enablePlanarFillId;
  if (usePlanarFillIdFramebuffer) {
    view.planarFillIdFramebuffer.update(context, view.viewport, scene._hdr);
  } else if (!picking) {
    // Release GPU resources while unused; recreated on demand by update().
    view.planarFillIdFramebuffer.releaseResources();
  }

  if (useInvertClassification) {
    let depthFramebuffer;
    if (frameState.invertClassificationColor.alpha === 1.0) {
      if (useGlobeDepthFramebuffer) {
        depthFramebuffer = view.globeDepth.framebuffer;
      }
    }

    if (defined(depthFramebuffer) || context.depthTexture) {
      scene._invertClassification.previousFramebuffer = depthFramebuffer;
      scene._invertClassification.update(
        context,
        scene.msaaSamples,
        view.globeDepth.colorFramebufferManager,
      );
      scene._invertClassification.clear(context, passState);

      if (frameState.invertClassificationColor.alpha < 1.0 && useOIT) {
        const command = scene._invertClassification.unclassifiedCommand;
        const derivedCommands = command.derivedCommands;
        derivedCommands.oit = oit.createDerivedCommands(
          command,
          context,
          derivedCommands.oit,
        );
      }
    } else {
      environmentState.useInvertClassification = false;
    }
  }

  if (scene._globeTranslucencyState.translucent) {
    view.globeTranslucencyFramebuffer.updateAndClear(
      scene._hdr,
      view.viewport,
      context,
      passState,
    );
  }
}

/**
 * @private
 */
Scene.prototype.resolveFramebuffers = function (passState) {
  const context = this._context;
  const environmentState = this._environmentState;
  const view = this._view;
  const { globeDepth, translucentTileClassification } = view;
  if (defined(globeDepth)) {
    globeDepth.prepareColorTextures(context);
  }

  const {
    useOIT,
    useGlobeDepthFramebuffer,
    usePostProcess,
    originalFramebuffer,
  } = environmentState;

  const globeFramebuffer = useGlobeDepthFramebuffer
    ? globeDepth.colorFramebufferManager
    : undefined;
  const sceneFramebuffer = view.sceneFramebuffer._colorFramebuffer;
  const idFramebuffer = view.sceneFramebuffer.idFramebuffer;

  if (useOIT) {
    passState.framebuffer = usePostProcess
      ? sceneFramebuffer.framebuffer
      : originalFramebuffer;
    view.oit.execute(context, passState);
  }

  if (
    translucentTileClassification.hasTranslucentDepth &&
    translucentTileClassification.isSupported()
  ) {
    translucentTileClassification.execute(this, passState);
  }

  if (usePostProcess) {
    view.sceneFramebuffer.prepareColorTextures(context);
    let inputFramebuffer = sceneFramebuffer;
    if (useGlobeDepthFramebuffer && !useOIT) {
      inputFramebuffer = globeFramebuffer;
    }

    const postProcess = this.postProcessStages;
    const colorTexture = inputFramebuffer.getColorTexture(0);
    const idTexture = idFramebuffer.getColorTexture(0);
    const depthTexture = (
      globeFramebuffer ?? sceneFramebuffer
    ).getDepthStencilTexture();
    postProcess.execute(context, colorTexture, depthTexture, idTexture);
    postProcess.copy(context, originalFramebuffer);
  }

  if (!useOIT && !usePostProcess && useGlobeDepthFramebuffer) {
    passState.framebuffer = originalFramebuffer;
    globeDepth.executeCopyColor(context, passState);
  }
};

function callAfterRenderFunctions(scene) {
  // Functions are queued up during primitive update and executed here in case
  // the function modifies scene state that should remain constant over the frame.
  const functions = scene._frameState.afterRender;
  const functionsCpy = functions.slice(); // Snapshot before iterate allows callbacks to add functions for next frame
  functions.length = 0;

  for (let i = 0; i < functionsCpy.length; ++i) {
    const shouldRequestRender = functionsCpy[i]();
    if (shouldRequestRender) {
      scene.requestRender();
    }
  }
}

function getGlobeHeight(scene) {
  if (scene.mode === SceneMode.MORPHING) {
    return;
  }
  const cartographic = scene.camera.positionCartographic;
  return scene.getHeight(cartographic);
}

function getMaxPrimitiveHeight(primitive, cartographic, scene) {
  let maxHeight = Number.NEGATIVE_INFINITY;

  if (primitive instanceof PrimitiveCollection) {
    // If it's a PrimitiveCollection, iterate through its children
    const length = primitive.length;
    for (let i = 0; i < length; ++i) {
      const subPrimitive = primitive.get(i);
      const subHeight = getMaxPrimitiveHeight(
        subPrimitive,
        cartographic,
        scene,
      );
      if (defined(subHeight) && subHeight > maxHeight) {
        maxHeight = subHeight;
      }
    }
  } else if (
    primitive.isCesium3DTileset &&
    primitive.show &&
    primitive.enableCollision
  ) {
    // If it's an individual primitive, check its height
    const result = primitive.getHeight(cartographic, scene);
    if (defined(result) && result > maxHeight) {
      return result;
    }
  }

  return maxHeight;
}

/**
 * 获取加载表面在地图位置的高度。
 * @param {Cartographic} cartographic 地图位置。
 * @param {HeightReference} [heightReference=CLAMP_TO_GROUND] 基于高度参考值，决定是否忽略 3D Tiles 或地形的高度信息。
 * @private
 */
Scene.prototype.getHeight = function (cartographic, heightReference) {
  if (!defined(cartographic)) {
    return undefined;
  }

  const ignore3dTiles =
    heightReference === HeightReference.CLAMP_TO_TERRAIN ||
    heightReference === HeightReference.RELATIVE_TO_TERRAIN;

  const ignoreTerrain =
    heightReference === HeightReference.CLAMP_TO_3D_TILE ||
    heightReference === HeightReference.RELATIVE_TO_3D_TILE;

  if (!defined(cartographic)) {
    return;
  }

  let maxHeight = Number.NEGATIVE_INFINITY;

  if (!ignore3dTiles) {
    const maxPrimitiveHeight = getMaxPrimitiveHeight(
      this.primitives,
      cartographic,
      this,
    );
    if (defined(maxPrimitiveHeight) && maxPrimitiveHeight > maxHeight) {
      maxHeight = maxPrimitiveHeight;
    }
  }

  const globe = this._globe;
  if (!ignoreTerrain && defined(globe) && globe.show) {
    const result = globe.getHeight(cartographic);
    if (result > maxHeight) {
      maxHeight = result;
    }
  }

  if (maxHeight > Number.NEGATIVE_INFINITY) {
    return maxHeight;
  }

  return undefined;
};

const updateHeightScratchCartographic = new Cartographic();
/**
 * 当渲染包含给定地图位置的新 tiles 时调用回调。唯一参数
 * 是 tiles 上的笛卡尔位置。
 *
 * @private
 *
 * @param {Cartographic} cartographic 地图位置。
 * @param {Function} callback 当加载包含更新地图数据的新瓦片时调用的函数。
 * @param {HeightReference} [heightReference=CLAMP_TO_GROUND] 根据高度参考值，决定是否忽略 3D Tiles 或地形的高度信息。
 * @returns {Function} The 从四叉树中移除此回调的函数。
 */
Scene.prototype.updateHeight = function (
  cartographic,
  callback,
  heightReference,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.func("callback", callback);
  //>>includeEnd('debug');

  const ellipsoid = this._ellipsoid;
  const callbackWrapper = (clampedCartographic) => {
    Cartographic.clone(cartographic, updateHeightScratchCartographic);

    let height;
    if (defined(clampedCartographic)) {
      height = clampedCartographic.height;
    }
    if (!defined(height)) {
      height = this.getHeight(cartographic, heightReference);
    }
    if (defined(height)) {
      updateHeightScratchCartographic.height = height;
      callback(updateHeightScratchCartographic);
    }
  };

  const ignore3dTiles =
    heightReference === HeightReference.CLAMP_TO_TERRAIN ||
    heightReference === HeightReference.RELATIVE_TO_TERRAIN;

  const ignoreTerrain =
    heightReference === HeightReference.CLAMP_TO_3D_TILE ||
    heightReference === HeightReference.RELATIVE_TO_3D_TILE;

  let terrainRemoveCallback;
  if (!ignoreTerrain && defined(this.globe)) {
    terrainRemoveCallback = this.globe._surface.updateHeight(
      cartographic,
      callbackWrapper,
    );
  }

  let tilesetRemoveCallbacks = {};
  const createPrimitiveEventListener = (primitive) => {
    if (
      ignore3dTiles ||
      primitive.isDestroyed() ||
      !primitive.isCesium3DTileset
    ) {
      return;
    }

    const tilesetRemoveCallback = primitive.updateHeight(
      cartographic,
      callbackWrapper,
      ellipsoid,
    );
    tilesetRemoveCallbacks[primitive.id] = tilesetRemoveCallback;
  };

  if (!ignore3dTiles) {
    const length = this.primitives.length;
    for (let i = 0; i < length; ++i) {
      const primitive = this.primitives.get(i);
      createPrimitiveEventListener(primitive);
    }
  }

  const removeAddedListener = this.primitives.primitiveAdded.addEventListener(
    createPrimitiveEventListener,
  );
  const removeRemovedListener =
    this.primitives.primitiveRemoved.addEventListener((primitive) => {
      if (primitive.isDestroyed() || !primitive.isCesium3DTileset) {
        return;
      }
      if (defined(tilesetRemoveCallbacks[primitive.id])) {
        tilesetRemoveCallbacks[primitive.id]();
      }
      delete tilesetRemoveCallbacks[primitive.id];
    });

  const removeCallback = () => {
    terrainRemoveCallback = terrainRemoveCallback && terrainRemoveCallback();
    Object.values(tilesetRemoveCallbacks).forEach((tilesetRemoveCallback) =>
      tilesetRemoveCallback(),
    );
    tilesetRemoveCallbacks = {};
    removeAddedListener();
    removeRemovedListener();
  };

  return removeCallback;
};

function isCameraUnderground(scene) {
  const camera = scene.camera;
  const mode = scene._mode;
  const cameraController = scene._screenSpaceCameraController;
  const cartographic = camera.positionCartographic;

  if (!defined(cartographic)) {
    return false;
  }

  if (!cameraController.onMap() && cartographic.height < 0.0) {
    // The camera can go off the map while in Columbus View.
    // Make a best guess as to whether it's underground by checking if its height is less than zero.
    return true;
  }

  if (mode === SceneMode.SCENE2D || mode === SceneMode.MORPHING) {
    return false;
  }

  const globeHeight = scene._globeHeight;
  return defined(globeHeight) && cartographic.height < globeHeight;
}

/**
 * @private
 */
Scene.prototype.initializeFrame = function () {
  // Destroy released shaders and textures once every 120 frames to avoid thrashing the cache
  if (this._shaderFrameCount++ === 120) {
    this._shaderFrameCount = 0;
    this._context.shaderCache.destroyReleasedShaderPrograms();
    this._context.textureCache.destroyReleasedTextures();
  }

  this._tweens.update();

  if (this._globeHeightDirty) {
    if (defined(this._removeUpdateHeightCallback)) {
      this._removeUpdateHeightCallback();
      this._removeUpdateHeightCallback = undefined;
    }

    this._globeHeight = getGlobeHeight(this);
    this._globeHeightDirty = false;

    const cartographic = this.camera.positionCartographic;
    this._removeUpdateHeightCallback = this.updateHeight(
      cartographic,
      (updatedCartographic) => {
        if (this.isDestroyed()) {
          return;
        }

        this._globeHeight = updatedCartographic.height;
      },
    );
  }
  this._cameraUnderground = isCameraUnderground(this);
  this._globeTranslucencyState.update(this);

  this._screenSpaceCameraController.update();
  if (defined(this._deviceOrientationCameraController)) {
    this._deviceOrientationCameraController.update();
  }

  this.camera.update(this._mode);
  this.camera._updateCameraChanged();
};

function updateDebugShowFramesPerSecond(scene, renderedThisFrame) {
  if (scene.debugShowFramesPerSecond) {
    if (!defined(scene._performanceDisplay)) {
      const performanceContainer = document.createElement("div");
      performanceContainer.className =
        "cesium-performanceDisplay-defaultContainer";
      const container = scene._canvas.parentNode;
      container.appendChild(performanceContainer);
      const performanceDisplay = new PerformanceDisplay({
        container: performanceContainer,
      });
      scene._performanceDisplay = performanceDisplay;
      scene._performanceContainer = performanceContainer;
    }

    scene._performanceDisplay.throttled = scene.requestRenderMode;
    scene._performanceDisplay.update(renderedThisFrame);
  } else if (defined(scene._performanceDisplay)) {
    scene._performanceDisplay =
      scene._performanceDisplay && scene._performanceDisplay.destroy();
    scene._performanceContainer.parentNode.removeChild(
      scene._performanceContainer,
    );
  }
}

function prePassesUpdate(scene) {
  scene._jobScheduler.resetBudgets();

  const frameState = scene._frameState;
  scene.primitives.prePassesUpdate(frameState);

  if (defined(scene.globe)) {
    scene.globe.update(frameState);
  }

  scene._picking.update();
  frameState.creditDisplay.update();
}

function postPassesUpdate(scene) {
  scene.primitives.postPassesUpdate(scene._frameState);
  RequestScheduler.update();
}

const scratchBackgroundColor = new Color();

/**
 * 渲染场景。
 *
 * @param {Scene} scene
 * @private
 */
function render(scene) {
  const frameState = scene._frameState;

  const context = scene.context;
  const { uniformState } = context;

  const view = scene._defaultView;
  scene._view = view;

  scene.updateFrameState();
  frameState.passes.render = true;
  frameState.passes.postProcess = scene.postProcessStages.hasSelected;
  frameState.tilesetPassState = renderTilesetPassState;

  let backgroundColor = scene.backgroundColor ?? Color.BLACK;
  if (scene._hdr) {
    backgroundColor = Color.clone(backgroundColor, scratchBackgroundColor);
    backgroundColor.red = Math.pow(backgroundColor.red, scene.gamma);
    backgroundColor.green = Math.pow(backgroundColor.green, scene.gamma);
    backgroundColor.blue = Math.pow(backgroundColor.blue, scene.gamma);
  }
  frameState.backgroundColor = backgroundColor;

  frameState.atmosphere = scene.atmosphere;
  scene.fog.update(frameState);

  uniformState.update(frameState);

  const shadowMap = scene.shadowMap;
  if (defined(shadowMap) && shadowMap.enabled) {
    if (!defined(scene.light) || scene.light instanceof SunLight) {
      // Negate the sun direction so that it is from the Sun, not to the Sun
      Cartesian3.negate(
        uniformState.sunDirectionWC,
        scene._shadowMapCamera.direction,
      );
    } else {
      Cartesian3.clone(scene.light.direction, scene._shadowMapCamera.direction);
    }
    frameState.shadowMaps.push(shadowMap);
  }

  scene._computeCommandList.length = 0;
  scene._overlayCommandList.length = 0;

  const viewport = view.viewport;
  viewport.x = 0;
  viewport.y = 0;
  viewport.width = context.drawingBufferWidth;
  viewport.height = context.drawingBufferHeight;

  const passState = view.passState;
  passState.framebuffer = undefined;
  passState.blendingEnabled = undefined;
  passState.scissorTest = undefined;
  passState.viewport = BoundingRectangle.clone(viewport, passState.viewport);

  context.beginFrame();

  if (defined(scene.globe)) {
    scene.globe.beginFrame(frameState);
  }

  scene.updateEnvironment();
  scene.updateAndExecuteCommands(passState, backgroundColor);
  scene.resolveFramebuffers(passState);

  passState.framebuffer = undefined;
  executeOverlayCommands(scene, passState);

  if (defined(scene.globe)) {
    scene.globe.endFrame(frameState);

    if (!scene.globe.tilesLoaded) {
      scene._renderRequested = true;
    }
  }

  context.endFrame();
}

function tryAndCatchError(scene, functionToExecute) {
  try {
    functionToExecute(scene);
  } catch (error) {
    scene._renderError.raiseEvent(scene, error);

    if (scene.rethrowRenderErrors) {
      throw error;
    }
  }
}

function updateMostDetailedRayPicks(scene) {
  return scene._picking.updateMostDetailedRayPicks(scene);
}

/**
 * 更新并渲染场景。通常不需要直接调用此函数，因为 {@link CesiumWidget} 会自动执行。
 * directly because {@link CesiumWidget} will do it automatically.
 * @param {JulianDate} [time] 渲染时的模拟时间。
 */
Scene.prototype.render = function (time) {
  /**
   *
   * 预渲染过程更新。执行在此阶段应运行的任何渲染过程不变性代码。
   *
   */
  this._preUpdate.raiseEvent(this, time);

  const frameState = this._frameState;
  frameState.newFrame = false;

  if (!defined(time)) {
    time = JulianDate.now();
  }

  this._controllerHost.update(this, time);

  const cameraChanged = this._view.checkForCameraUpdates(this);
  if (cameraChanged) {
    this._globeHeightDirty = true;
  }

  // Determine if should render a new frame in request render mode
  let shouldRender =
    !this.requestRenderMode ||
    this._renderRequested ||
    cameraChanged ||
    this._logDepthBufferDirty ||
    this._hdrDirty ||
    this.mode === SceneMode.MORPHING;
  if (
    !shouldRender &&
    defined(this.maximumRenderTimeChange) &&
    defined(this._lastRenderTime)
  ) {
    const difference = Math.abs(
      JulianDate.secondsDifference(this._lastRenderTime, time),
    );
    shouldRender = shouldRender || difference > this.maximumRenderTimeChange;
  }

  if (shouldRender) {
    this._lastRenderTime = JulianDate.clone(time, this._lastRenderTime);
    this._renderRequested = false;
    this._logDepthBufferDirty = false;
    this._hdrDirty = false;

    const frameNumber = CesiumMath.incrementWrap(
      frameState.frameNumber,
      15000000.0,
      1.0,
    );
    updateFrameNumber(this, frameNumber, time);
    frameState.newFrame = true;
  }

  tryAndCatchError(this, prePassesUpdate);

  /**
   * 渲染过程更新。在此阶段添加任何渲染过程。
   */
  if (this.primitives.show) {
    tryAndCatchError(this, updateMostDetailedRayPicks);
    tryAndCatchError(this, updatePreloadPass);
    tryAndCatchError(this, updatePreloadFlightPass);
    if (!shouldRender) {
      tryAndCatchError(this, updateRequestRenderModeDeferCheckPass);
    }
  }

  this._postUpdate.raiseEvent(this, time);

  if (shouldRender) {
    this._preRender.raiseEvent(this, time);
    frameState.creditDisplay.beginFrame();
    tryAndCatchError(this, render);
  }

  /**
   * 后渲染过程更新。执行在此阶段应运行的任何渲染过程不变性代码。
   */
  updateDebugShowFramesPerSecond(this, shouldRender);
  tryAndCatchError(this, postPassesUpdate);

  // Often used to trigger events (so don't want in trycatch) that the user
  // might be subscribed to. Things like the tile load events, promises, etc.
  // We don't want those events to resolve during the render loop because the events might add new primitives
  callAfterRenderFunctions(this);

  if (shouldRender) {
    this._postRender.raiseEvent(this, time);
    frameState.creditDisplay.endFrame();
  }
};

/**
 * 更新并渲染场景。无论之前是否请求过渲染，始终强制生成新的渲染帧。
 * 渲染时的模拟时间。
 * @param {JulianDate} [time] 渲染时的模拟时间。
 *
 * @private
 */
Scene.prototype.forceRender = function (time) {
  this._renderRequested = true;
  this.render(time);
};

/**
 * 当 {@link Scene#requestRenderMode} 设置为 <code>true</code> 时，请求新的渲染帧。
 * 渲染速率不会超过 {@link CesiumWidget#targetFrameRate}。
 *
 * @see Scene#requestRenderMode
 */
Scene.prototype.requestRender = function () {
  this._renderRequested = true;
};

/**
 * @private
 */
Scene.prototype.clampLineWidth = function (width) {
  return Math.max(
    ContextLimits.minimumAliasedLineWidth,
    Math.min(width, ContextLimits.maximumAliasedLineWidth),
  );
};

/**
 * 返回一个包含场景中第一个（顶部）基元的对象，该对象具有 <code>primitive</code> 属性。
 * 在特定的窗口坐标处，或者如果该位置没有内容则为 <code>undefined</code>。其他属性可能根据基元类型被设置，并可用于进一步识别被选取的对象。
 * 可能根据基元类型被设置，并可用于进一步识别被选取的对象。
 * <p>
 * 当选取 3D Tiles 瓦片集中的特征时，<code>pick</code> 返回一个 {@link Cesium3DTileFeature} 对象。
 * </p>
 *
 * @example
 * // 在鼠标悬停时，将特征颜色设为黄色。
 * handler.setInputAction(function(movement) {
 * const feature = scene.pick(movement.endPosition);
 * if (feature instanceof Cesium.Cesium3DTileFeature) {
 * feature.color = Cesium.Color.YELLOW;
 *     }
 * }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 *
 * @param {Cartesian2} windowPosition 用于执行选取的窗口坐标。
 * @param {number} [width=3] 选取矩形的宽度。
 * @param {number} [height=3] 选取矩形的高度。
 * @returns {object | undefined} Object 包含被选取的基元，或者如果该位置没有内容则为 <code>undefined</code>。
 */
Scene.prototype.pick = function (windowPosition, width, height) {
  // Picking one object, result is either [object] or []
  return this._picking.pick(this, windowPosition, width, height, 1)[0];
};

/**
 * 吸附操作的结果。参见 {@link Scene#snap}。
 *
 * @typedef {object} SceneSnapResult
 * @property {object} object 被吸附的基元或特征。
 * @property {Cartesian3} position 吸附点的世界空间位置，从吸附帧缓冲器的眼睛空间深度中未投影出来。
 * @property {Cartesian3|undefined} surfacePosition 与吸附点最近的同一对象表面片段的世界空间位置。对于表面吸附，这等于 <code>position</code>；对于边缘吸附，则是对象表面上的一个点，而不是其轮廓，或者如果搜索区域内没有可见的对象表面片段则为 <code>undefined</code>。
 * @property {Cartesian2} screenPosition 拾取点的窗口坐标。
 * @property {boolean} isEdge 如果拾取点位于边缘，则返回 <code>true</code>；如果位于表面，则返回 <code>false</code>。
 *
 * @experimental This 该特征不是最终确定的，可能会根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * 返回 <code>windowPosition</code> 周围屏幕空间区域中最佳的拾取目标。
 * 相比表面，边缘更优先；对于同类型的击中点中，
 * 离光标最近的那个获胜。如果该区域不包含可拾取的几何图形，则返回 <code>undefined</code>。
 * 只有通过模型管道渲染的原语（例如 3D Tiles 和 glTF 模型）才可被拾取。拾取操作需要浮点颜色附件。
 * <p>
 * （WebGL2 需支持 <code>EXT_color_buffer_float</code>）；如果不受支持，此功能返回 <code>undefined</code>。
 * 搜索区域的中心处的窗口坐标。
 * 具有以下属性的对象：
 * 搜索区域在像素中的宽度。
 * </p>
 *
 * @param {Cartesian2} windowPosition 搜索区域在像素中的高度。
 * @param {object} [options] 该区域中最佳的拾取目标，如果没有则返回 <code>undefined</code>。
 * @param {number} [options.width=25] 包含被拾取的原始体的矩形区域宽度。
 * @param {number} [options.height=options.width] 包含被拾取的原始体的矩形区域高度。
 * @returns {SceneSnapResult | undefined} The 如果区域内没有最佳拾取目标，则返回 <code>undefined</code>。
 *
 * @experimental This 该特征不是最终确定的，可能会根据 Cesium 的标准弃用政策发生变化。
 */
Scene.prototype.snap = function (windowPosition, options) {
  return Snapping.snap(this, windowPosition, options);
};

/**
 * 执行与 Scene.pick 相同的操作，但异步进行且不会阻塞主渲染线程。
 * 需要 WebGL2，否则使用备用方案。
 *
 * @example
 * // 当鼠标悬停时，将特征颜色设为黄色。
 * handler.setInputAction(function(movement) {
 * const feature = scene.pickAsync(movement.endPosition).then(function(feature) {
 * if (feature instanceof Cesium.Cesium3DTileFeature) {
 * feature.color = Cesium.Color.YELLOW;
 *        }
 *     });
 * }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 *
 * @param {Cartesian2} windowPosition 执行拾取操作的窗口坐标。
 * @param {number} [width=3] 拾取矩形的宽度。
 * @param {number} [height=3] 拾取矩形的高度。
 * @returns {Promise<object | undefined>} Object 包含被拾取的原始体，如果位置没有内容则返回 <code>undefined</code>。
 *
 * @see Scene#pick
 */
Scene.prototype.pickAsync = async function (windowPosition, width, height) {
  const result = await this._picking.pickAsync(
    this,
    windowPosition,
    width,
    height,
    1,
  );
  return result[0];
};
/**
 * 返回在特定窗口坐标处渲染的体素样本对应的 {@link VoxelCell}，
 * 如果在该位置没有渲染体素，则返回 <code>undefined</code>。
 *
 * @example
 * 左键点击时，报告该体素样本的“color”属性值。
 * handler.setInputAction(function(movement) {
 * const voxelCell = scene.pickVoxel(movement.position);
 * if (defined(voxelCell)) {
 * console.log(voxelCell.getProperty("color"));
 *   }
 * }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
 *
 * @param {Cartesian2} windowPosition 执行拾取操作的窗口坐标。
 * @param {number} [width=3] 拾取矩形的宽度。
 * @param {number} [height=3] 拾取矩形的高度。
 * @returns {VoxelCell|undefined} Information 在选中位置渲染的体素单元，如果该位置没有体素则返回 <code>undefined</code>。
 *
 * @experimental This 此功能尚未最终确定，可能根据 Cesium 的标准弃用政策进行变更。
 */
Scene.prototype.pickVoxel = function (windowPosition, width, height) {
  const pickedObject = this.pick(windowPosition, width, height);
  if (!defined(pickedObject)) {
    return;
  }
  const voxelPrimitive = pickedObject.primitive;
  if (!(voxelPrimitive instanceof VoxelPrimitive)) {
    return;
  }
  const voxelCoordinate = this._picking.pickVoxelCoordinate(
    this,
    windowPosition,
    width,
    height,
  );
  // The pick pass writes tileIndex * samplesPerTile + sampleIndex + 1,
  // most significant byte first. 0 means no voxel sample was rendered there.
  const pickId =
    voxelCoordinate[0] * 16777216 +
    voxelCoordinate[1] * 65536 +
    voxelCoordinate[2] * 256 +
    voxelCoordinate[3];
  if (pickId === 0) {
    return;
  }
  const { inputDimensions } = voxelPrimitive;
  const samplesPerTile =
    inputDimensions.x * inputDimensions.y * inputDimensions.z;
  // Look up the keyframeNode containing this picked cell
  const tileIndex = Math.floor((pickId - 1) / samplesPerTile);
  const keyframeNode = voxelPrimitive._traversal.findKeyframeNode(tileIndex);
  if (!defined(keyframeNode)) {
    // The tile rendered at the pick position has since been discarded by
    // a traversal update
    return;
  }
  // Look up the metadata for the picked cell
  const sampleIndex = (pickId - 1) % samplesPerTile;
  return VoxelCell.fromKeyframeNode(
    voxelPrimitive,
    tileIndex,
    sampleIndex,
    keyframeNode,
  );
};

/**
 * 在指定的窗口位置选择元数据值。
 *
 * @param {Cartesian2} windowPosition 执行选取操作的窗口坐标。
 * @param {string|undefined} schemaId 用于选择值的元数据模式 ID。
 * 来源。如果为 <code>undefined</code>，则从对象本身选择值。
 * 与给定的类名和属性名匹配的值，与模式 ID 无关。
 * @param {string} className 要选择的元数据类的名称。
 * 来自的值。
 * @param {string} propertyName 要选择的元数据属性的名称。
 * 来自的值。
 * @returns {MetadataValue|undefined} The 元数据值，或 <code>undefined</code> 当
 * 在给定位置没有匹配的元数据时。
 *
 * @experimental This 此功能尚未最终确定，可能根据 Cesium 的标准弃用政策进行变更。
 */
Scene.prototype.pickMetadata = function (
  windowPosition,
  schemaId,
  className,
  propertyName,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("windowPosition", windowPosition);
  Check.typeOf.string("className", className);
  Check.typeOf.string("propertyName", propertyName);
  //>>includeEnd('debug');

  const pickedObject = this.pick(windowPosition);
  if (!defined(pickedObject)) {
    return undefined;
  }

  // Check if the picked object is a model that has structural
  // metadata, with a schema that contains the specified
  // property.
  const structuralMetadata = pickedObject.detail?.model?.structuralMetadata;
  if (!defined(structuralMetadata)) {
    return undefined;
  }
  const schema = structuralMetadata.schema;
  const classProperty = getMetadataClassProperty(
    schema,
    schemaId,
    className,
    propertyName,
  );
  if (!defined(classProperty)) {
    return undefined;
  }
  const metadataProperty = getMetadataProperty(
    structuralMetadata,
    className,
    propertyName,
  );
  if (!defined(metadataProperty)) {
    return undefined;
  }

  const pickedMetadataInfo = new PickedMetadataInfo(
    schemaId,
    className,
    propertyName,
    classProperty,
    metadataProperty,
  );

  const pickedMetadataValues = this._picking.pickMetadata(
    this,
    windowPosition,
    pickedMetadataInfo,
  );

  return pickedMetadataValues;
};

/**
 * 在给定位置选择对象的元数据模式。
 *
 * @param {Cartesian2} windowPosition 执行选取操作的窗口坐标。
 * @returns {MetadataSchema | undefined} The 元数据模式，或 <code>undefined</code> 如果在该位置没有具有相关元数据的对象。
 * 在给定位置没有相关的元数据时。
 *
 * @experimental This 此功能尚未最终确定，可能根据 Cesium 的标准弃用政策进行变更。
 */
Scene.prototype.pickMetadataSchema = function (windowPosition) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("windowPosition", windowPosition);
  //>>includeEnd('debug');

  const pickedObject = this.pick(windowPosition);
  if (!defined(pickedObject)) {
    return undefined;
  }
  const schema = pickedObject.detail?.model?.structuralMetadata?.schema;
  return schema;
};

/**
 * 从深度缓冲和窗口坐标重建出的笛卡尔位置。
 * 返回的位置以世界坐标表示。由相机函数内部使用，以避免转换为投影后的 2D 坐标再转换回来。
 * 将 {@link Scene#pickTranslucentDepth} 设置为 <code>true</code> 以包含半透明基元的深度；否则，此操作实际上会穿透半透明基元。
 * <p>
 * 执行选取操作的窗口坐标。
 * 用于恢复结果的对象。
 * </p>
 *
 * @private
 *
 * @param {Cartesian2} windowPosition 世界坐标中的笛卡尔位置。
 * @param {Cartesian3} [result] 不支持从深度缓冲获取位置。请检查 pickPositionSupported。
 * @returns {Cartesian3} The 从深度缓冲和窗口坐标重建出的笛卡尔位置。
 *
 * @exception {DeveloperError} Picking 从深度缓冲重建出的位置在 2D 中可能与 3D 和 Columbus 视图中重建的位置略有不同。这是由于透视投影和正交投影中深度值分布的不同造成的。
 */
Scene.prototype.pickPositionWorldCoordinates = function (
  windowPosition,
  result,
) {
  return this._picking.pickPositionWorldCoordinates(
    this,
    windowPosition,
    result,
  );
};

/**
 * 将 {@link Scene#pickTranslucentDepth} 设置为 <code>true</code> 以包含半透明基元的深度；否则，此操作实际上会穿透半透明基元。
 * <p>
 * 从深度缓冲重建出的 2D 位置可能与 3D 和 Columbus 视图中重建的位置略有不同。这是由于透视投影和正交投影中深度值分布的不同造成的。
 * reconstructed in 3D and Columbus view. This is caused by the difference in the distribution
 * of depth values of perspective and orthographic projection.
 * </p>
 * <p>
 * Set {@link Scene#pickTranslucentDepth} to <code>true</code> to include the depth of
 * translucent primitives; otherwise, this essentially picks through translucent primitives.
 * </p>
 *
 * @param {Cartesian2} windowPosition 用于进行拾取的窗口坐标。
 * @param {Cartesian3} [result] 用于恢复结果的对象。
 * @returns {Cartesian3} The 笛卡尔位置。
 *
 * @exception {DeveloperError} Picking 不支持从深度缓冲区获取。请检查 pickPositionSupported 属性。
 */
Scene.prototype.pickPosition = function (windowPosition, result) {
  return this._picking.pickPosition(this, windowPosition, result);
};

/**
 * 返回一个对象列表，每个对象包含一个 <code>primitive</code> 属性，包含所有特定窗口坐标位置下的所有原始类型对象。
 * 其他属性也可能根据原始类型的不同而被设置，可用于进一步识别被拾取的实体。列表中的原始类型按场景中的视觉顺序排列（从前到后）。
 * 用于进行拾取的窗口坐标。
 * 如果提供了该值，则收集一定数量的拾取点后停止钻探。
 *
 * @param {Cartesian2} windowPosition 拾取矩形的宽度。
 * @param {number} [limit] 拾取矩形的高度。
 * @param {number} [width=3] 包含1个被拾取的原始类型的对象数量。
 * @param {number} [height=3] 未定义。
 * @returns {any[]} Array 返回一个对象，包含被射线相交的第一个对象和相交位置。如果没有相交，则返回 <code>undefined</code>。被相交的实体具有 <code>primitive</code> 属性，其中包含被相交的原始类型。其他属性也可能根据原始类型的不同而被设置，可用于进一步识别被拾取的实体。射线必须以世界坐标给出。
 *
 * @exception {DeveloperError} windowPosition 此函数仅选择当前视图中渲染的地球瓦片与3D瓦片。会拾取所有其他原始类型，无论其可见性如何。
 *
 * @example
 * const pickedObjects = scene.drillPick(new Cesium.Cartesian2(100.0, 200.0));
 *
 * @see Scene#pick
 */
Scene.prototype.drillPick = function (windowPosition, limit, width, height) {
  return this._picking.drillPick(this, windowPosition, limit, width, height);
};

function updatePreloadPass(scene) {
  const frameState = scene._frameState;
  preloadTilesetPassState.camera = frameState.camera;
  preloadTilesetPassState.cullingVolume = frameState.cullingVolume;

  const primitives = scene.primitives;
  primitives.updateForPass(frameState, preloadTilesetPassState);
}

function updatePreloadFlightPass(scene) {
  const frameState = scene._frameState;
  const camera = frameState.camera;
  if (!camera.canPreloadFlight()) {
    return;
  }

  preloadFlightTilesetPassState.camera = scene.preloadFlightCamera;
  preloadFlightTilesetPassState.cullingVolume =
    scene.preloadFlightCullingVolume;

  const primitives = scene.primitives;
  primitives.updateForPass(frameState, preloadFlightTilesetPassState);
}

function updateRequestRenderModeDeferCheckPass(scene) {
  // Check if any ignored requests are ready to go (to wake rendering up again)
  scene.primitives.updateForPass(
    scene._frameState,
    requestRenderModeDeferCheckPassState,
  );
}

/**
 * 返回一个对象，包含被射线相交的第一个对象和相交位置。
 * 如果没有相交，则返回 <code>undefined</code>。被相交的实体具有 <code>primitive</code> 属性，其中包含被相交的原始类型。其他属性也可能根据原始类型的不同而被设置，可用于进一步识别被拾取的实体。射线必须以世界坐标给出。
 * 此函数仅选择当前视图中渲染的地球瓦片与3D瓦片。会拾取所有其他原始类型，无论其可见性如何。
 * 射线。
 * <p>
 * 一个列表，包含要从射线相交中排除的原始类型、实体或3D瓦片特征。
 * 相交体积的宽度，以米为单位。
 * </p>
 *
 * @private
 *
 * @param {Ray} ray 包含被相交对象的对象及其第一个相交位置，如果没有相交则返回 <code>undefined</code>。
 * @param {object[]} [objectsToExclude] 仅支持在3D模式下进行相交。
 * @param {number} [width=0.1] 返回一个对象列表，每个对象包含被射线相交的对象和相交位置。
 * @returns {object | undefined} An 被相交的实体具有 <code>primitive</code> 属性，其中包含被相交的原始类型。其他属性也可能根据原始类型的不同而被设置，可用于进一步识别被拾取的实体。
 *
 * @exception {DeveloperError} Ray 列表中的原始类型按第一次相交到最后一次相交的顺序排列。射线必须以世界坐标给出。
 */
Scene.prototype.pickFromRay = function (ray, objectsToExclude, width) {
  return this._picking.pickFromRay(this, ray, objectsToExclude, width);
};

/**
 * 此函数仅选择当前视图中渲染的地球瓦片与3D瓦片。会拾取所有其他原始类型，无论其可见性如何。
 * 被相交的实体具有 <code>primitive</code> 属性，其中包含被相交的原始类型。其他属性也可能根据原始类型的不同而被设置，可用于进一步识别被拾取的实体。
 * 列表中的原始类型按第一次相交到最后一次相交的顺序排列。射线必须以世界坐标给出。
 * 列表中的原始类型按第一次相交到最后一次相交的顺序排列。射线必须以世界坐标给出。
 * world coordinates.
 * <p>
 * This function only picks globe tiles and 3D Tiles that are rendered in the current view. Picks all other
 * 无论其可见性如何，所有原始对象。
 * </p>
 *
 * @private
 *
 * @param {Ray} ray 光线。
 * @param {number} [limit=Number.MAX_VALUE] 如果提供，在找到这么多交点后停止查找交点。
 * @param {object[]} [objectsToExclude] 要从光线相交中排除的原始对象、实体或 3D Tiles 特征列表。
 * @param {number} [width=0.1] 相交体积的宽度，单位为米。
 * @returns {object[]} List 包含该对象的对象及其每个交点的位置。
 *
 * @exception {DeveloperError} Ray 仅支持 3D 模式下的交点。
 */
Scene.prototype.drillPickFromRay = function (
  ray,
  limit,
  objectsToExclude,
  width,
) {
  return this._picking.drillPickFromRay(
    this,
    ray,
    limit,
    objectsToExclude,
    width,
  );
};

/**
 * 使用 3D Tilesets 的最大细节级别发起异步的 {@link Scene#pickFromRay} 请求。
 * 无论可见性如何。
 *
 * @private
 *
 * @param {Ray} ray 光线。
 * @param {object[]} [objectsToExclude] 要从光线相交中排除的原始对象、实体或 3D Tiles 特征列表。
 * @param {number} [width=0.1] 相交体积的宽度，单位为米。
 * @returns {Promise<object>} A 承诺返回一个包含该对象及其第一个交点位置的对象列表。
 *
 * @exception {DeveloperError} Ray 仅支持 3D 模式下的交点。
 */
Scene.prototype.pickFromRayMostDetailed = function (
  ray,
  objectsToExclude,
  width,
) {
  return this._picking.pickFromRayMostDetailed(
    this,
    ray,
    objectsToExclude,
    width,
  );
};

/**
 * 使用 3D Tilesets 的最大细节级别发起异步的 {@link Scene#drillPickFromRay} 请求。
 * 无论可见性如何。
 *
 * @private
 *
 * @param {Ray} ray 光线。
 * @param {number} [limit=Number.MAX_VALUE] 如果提供，在找到这么多交点后停止查找交点。
 * @param {object[]} [objectsToExclude] 要从光线相交中排除的原始对象、实体或 3D Tiles 特征列表。
 * @param {number} [width=0.1] 相交体积的宽度，单位为米。
 * @returns {Promise<object[]>} A 承诺返回一个包含该对象及其每个交点位置的对象列表。
 *
 * @exception {DeveloperError} Ray 仅支持 3D 模式下的交点。
 */
Scene.prototype.drillPickFromRayMostDetailed = function (
  ray,
  limit,
  objectsToExclude,
  width,
) {
  return this._picking.drillPickFromRayMostDetailed(
    this,
    ray,
    limit,
    objectsToExclude,
    width,
  );
};

/**
 * 返回给定地图位置处的场景几何高度，如果没有可采样高度的场景几何，则返回 <code>undefined</code>。
 * 如果没有可采样高度的场景几何，则返回 <code>undefined</code>。输入位置的高度将被忽略。可用于将对象限制在
 * 地球、3D Tiles 或场景中的控件上。
 * <p>
 * 此函数仅从当前视图中渲染的地球瓦片与 3D Tiles 中采样高度。其他所有原始对象无论其可见性如何，都将被采样高度。
 * 从所有其他原始对象中采样高度，无论其可见性如何。
 * </p>
 *
 * @param {Cartographic} position 用于采样高度的地图位置。
 * @param {object[]} [objectsToExclude] 不用于采样高度的原始对象、实体或 3D Tiles 特征列表。
 * @param {number} [width=0.1] 相交体积的宽度，单位为米。
 * @returns {number | undefined} The 高度。如果没有可采样高度的场景几何，则返回 <code>undefined</code>。
 *
 * @example
 * const position = new Cesium.Cartographic(-1.31968, 0.698874);
 * const height = viewer.scene.sampleHeight(position);
 * console.log(height);
 *
 * @see Scene#clampToHeight
 * @see Scene#clampToHeightMostDetailed
 * @see Scene#sampleHeightMostDetailed
 *
 * @exception {DeveloperError} sampleHeight 仅支持 3D 模式。
 * @exception {DeveloperError} sampleHeight 需要深度纹理支持。请检查 sampleHeightSupported。
 */
Scene.prototype.sampleHeight = function (position, objectsToExclude, width) {
  return this._picking.sampleHeight(this, position, objectsToExclude, width);
};

/**
 * 将给定的笛卡尔坐标沿大地表面法线约束到场景几何形状上。返回
 * 被约束后的坐标，如果没有场景几何形状可约束，则返回 <code>undefined</code>。可用于将
 * 对象、3D Tiles 或场景中的基本元素约束到地球仪、3D Tiles 或场景中。
 * <p>
 * 此函数仅对当前视图中渲染的地球仪 tiles 和 3D Tiles 进行约束。对于其他所有基本元素，无论其可见性如何，均进行约束。
 * 笛卡尔坐标位置。
 * </p>
 *
 * @param {Cartesian3} cartesian 不被约束的实体、实体或 3D Tiles 特征列表。
 * @param {object[]} [objectsToExclude] 不被约束的 3D Tiles 特征列表。
 * @param {number} [width=0.1] 交集体积的宽度，单位：米。
 * @param {Cartesian3} [result] 可选对象，用于返回被约束后的坐标。
 * @returns {Cartesian3 | undefined} The 修改后的结果参数或新的 Cartesian3 实例。如果没有提供，则返回 <code>undefined</code>。如果没有场景几何形状可约束，则返回 <code>undefined</code>。
 *
 * @example
 * // 将实体约束到底层场景几何形状上
 * const position = entity.position.getValue(Cesium.JulianDate.now());
 * entity.position = viewer.scene.clampToHeight(position);
 *
 * @see Scene#sampleHeight
 * @see Scene#sampleHeightMostDetailed
 * @see Scene#clampToHeightMostDetailed
 *
 * @exception {DeveloperError} clampToHeight 仅在 3D 模式下支持。
 * @exception {DeveloperError} clampToHeight 需要深度纹理支持。请检查 clampToHeightSupported。
 */
Scene.prototype.clampToHeight = function (
  cartesian,
  objectsToExclude,
  width,
  result,
) {
  return this._picking.clampToHeight(
    this,
    cartesian,
    objectsToExclude,
    width,
    result,
  );
};

/**
 * 针对数组中的 {@link Cartographic} 坐标发起异步的 {@link Scene#sampleHeight} 查询，使用场景中 3D Tilesets 的最大细节级别。输入坐标的高度被忽略。
 * 返回一个承诺，当查询完成时该承诺会解析。每个点的高度都会就地修改。
 * 如果由于该位置无法采样几何形状或发生其他错误而无法确定高度，则高度被设置为 <code>undefined</code>。
 * 要更新的地图坐标及采样的高度。
 * 不被采样高度的实体、实体或 3D Tiles 特征列表。
 *
 * @param {Cartographic[]} positions 宽度，单位：米。
 * @param {object[]} [objectsToExclude] 当查询完成时解析为提供的位置列表的承诺。如果无法确定高度，位置可能变为 <code>undefined</code>。
 * @param {number} [width=0.1] const positions = [
 * @returns {Promise<Array<Cartographic | undefined>>} A new Cesium.Cartographic(-1.31968, 0.69887),
 *
 * @example
 * new Cesium.Cartographic(-1.10489, 0.83923)
 * const promise = viewer.scene.sampleHeightMostDetailed(positions);
 * promise.then(function(updatedPosition) {
 * ];
 * // positions[0].height 和 positions[1].height 已更新。
 * // updatedPositions 只是 positions 的引用。
 * 仅在 3D 模式下支持。
 * 需要深度纹理支持。请检查 sampleHeightSupported。
 * }
 *
 * @see Scene#sampleHeight
 *
 * @exception {DeveloperError} sampleHeightMostDetailed is only supported in 3D mode.
 * @exception {DeveloperError} sampleHeightMostDetailed requires depth texture support. Check sampleHeightSupported.
 */
Scene.prototype.sampleHeightMostDetailed = function (
  positions,
  objectsToExclude,
  width,
) {
  return this._picking.sampleHeightMostDetailed(
    this,
    positions,
    objectsToExclude,
    width,
  );
};

/**
 * 针对 {@link Cartesian3} 位置数组，启动一个异步的 {@link Scene#clampToHeight} 查询。
 * 使用场景中 3D Tilesets 的最大细节级别。当
 * 查询完成时，返回一个承诺，该承诺在完成后解析。每个位置都会就地修改。如果某个位置无法被限制，因为该位置没有几何数据可采样，或发生其他错误，数组中的该元素将被设置为 undefined。
 * 被设置为限制后的位置。
 *
 * @param {Cartesian3[]} cartesians 需要更新为限制后位置的笛卡尔坐标。
 * @param {object[]} [objectsToExclude] 不限制的基元、实体或 3D Tiles 特征列表。
 * @param {number} [width=0.1] 交集体积的宽度，单位：米。
 * @returns {Promise<Array<Cartesian3 | undefined>>} A 当查询完成时，返回一个承诺，该承诺解析为提供的位置列表。如果无法被限制，位置可能变为 <code>undefined</code>。
 *
 * @example
 * const cartesians = [
 * entities[0].position.getValue(Cesium.JulianDate.now()),
 * entities[1].position.getValue(Cesium.JulianDate.now())
 * ];
 * const promise = viewer.scene.clampToHeightMostDetailed(cartesians);
 * promise.then(function(updatedCartesians) {
 * entities[0].position = updatedCartesians[0];
 * entities[1].position = updatedCartesians[1];
 * }
 *
 * @see Scene#clampToHeight
 *
 * @exception {DeveloperError} clampToHeightMostDetailed 仅在 3D 模式下支持。
 * @exception {DeveloperError} clampToHeightMostDetailed 需要深度纹理支持。请检查 clampToHeightSupported。
 */
Scene.prototype.clampToHeightMostDetailed = function (
  cartesians,
  objectsToExclude,
  width,
) {
  return this._picking.clampToHeightMostDetailed(
    this,
    cartesians,
    objectsToExclude,
    width,
  );
};

/**
 * 将笛卡尔坐标中的位置转换为画布坐标。这通常用于将
 * HTML 元素放置在与场景中的对象相同的屏幕位置。
 *
 * @param {Cartesian3} position 笛卡尔坐标中的位置。
 * @param {Cartesian2} [result] 一个可选对象，用于将输入位置转换为画布坐标。
 * @returns {Cartesian2 | undefined} The 修改后的结果参数或一个新的 Cartesian2 实例，如果未提供则使用默认值。如果输入位置靠近椭球中心，则可能为 <code>undefined</code>。
 *
 * @example
 * // 每次鼠标移动时输出经纬度对应的画布位置（0, 0）。
 * const scene = widget.scene;
 * const position = Cesium.Cartesian3.fromDegrees(0.0, 0.0);
 * const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
 * handler.setInputAction(function(movement) {
 * console.log(scene.cartesianToCanvasCoordinates(position));
 * }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 */
Scene.prototype.cartesianToCanvasCoordinates = function (position, result) {
  return SceneTransforms.worldToWindowCoordinates(this, position, result);
};

/**
 * 立即完成正在进行的过渡。
 */
Scene.prototype.completeMorph = function () {
  this._transitioner.completeMorph();
};

/**
 * 异步地将场景转换为 2D 模式。
 * @param {number} [duration=2.0] 过渡动画完成的秒数。
 */
Scene.prototype.morphTo2D = function (duration) {
  duration = duration ?? 2.0;
  this._transitioner.morphTo2D(duration, this._ellipsoid);
};

/**
 * 异步地将场景转换为 Columbus View。
 * @param {number} [duration=2.0] 过渡动画完成所需的秒数。
 */
Scene.prototype.morphToColumbusView = function (duration) {
  duration = duration ?? 2.0;
  this._transitioner.morphToColumbusView(duration, this._ellipsoid);
};

/**
 * 异步地将场景转换为 3D 状态。
 * @param {number} [duration=2.0] 过渡动画完成所需的秒数。
 */
Scene.prototype.morphTo3D = function (duration) {
  duration = duration ?? 2.0;
  this._transitioner.morphTo3D(duration, this._ellipsoid);
};

function setTerrain(scene, terrain) {
  // Cancel any in-progress terrain update
  scene._removeTerrainProviderReadyListener =
    scene._removeTerrainProviderReadyListener &&
    scene._removeTerrainProviderReadyListener();

  // If the terrain is already loaded, set it immediately
  if (terrain.ready) {
    if (defined(scene.globe)) {
      scene.globe.terrainProvider = terrain.provider;
    }
    return;
  }
  // Otherwise, set a placeholder
  scene.globe.terrainProvider = undefined;
  scene._removeTerrainProviderReadyListener =
    terrain.readyEvent.addEventListener((provider) => {
      if (defined(scene) && defined(scene.globe)) {
        scene.globe.terrainProvider = provider;
      }

      scene._removeTerrainProviderReadyListener();
    });
}

/**
 * 更新地形，提供地球表面的几何数据。
 *
 * @param {Terrain} terrain 地形提供器异步辅助方法
 * @returns {Terrain} terrain 地形提供器异步辅助方法
 *
 * @example
 * // 使用 Cesium World Terrain
 * scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
 *
 * @example
 * // 使用自定义地形提供器
 * const terrain = new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl("https://myTestTerrain.com"));
 * scene.setTerrain(terrain);
 *
 * terrain.errorEvent.addEventListener(error => {
 * alert(`在创建地形时遇到错误！ ${error}`);
 * });
 */
Scene.prototype.setTerrain = function (terrain) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("terrain", terrain);
  //>>includeEnd('debug');

  setTerrain(this, terrain);

  return terrain;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>false</code>。
 *
 * @see Scene#destroy
 */
Scene.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的 WebGL 资源。销毁对象可以确保
 * WebGL 资源的确定释放，而不依赖垃圾回收器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * scene = scene && scene.destroy();
 *
 * @see Scene#isDestroyed
 */
Scene.prototype.destroy = function () {
  this._tweens.removeAll();
  this._computeEngine = this._computeEngine && this._computeEngine.destroy();
  this._screenSpaceCameraController =
    this._screenSpaceCameraController &&
    this._screenSpaceCameraController.destroy();
  this._deviceOrientationCameraController =
    this._deviceOrientationCameraController &&
    !this._deviceOrientationCameraController.isDestroyed() &&
    this._deviceOrientationCameraController.destroy();
  this._primitives = this._primitives && this._primitives.destroy();
  this._groundPrimitives =
    this._groundPrimitives && this._groundPrimitives.destroy();
  this._globe = this._globe && this._globe.destroy();
  this._removeTerrainProviderReadyListener =
    this._removeTerrainProviderReadyListener &&
    this._removeTerrainProviderReadyListener();
  this.skyBox = this.skyBox && this.skyBox.destroy();
  this.skyAtmosphere = this.skyAtmosphere && this.skyAtmosphere.destroy();
  this._debugSphere = this._debugSphere && this._debugSphere.destroy();
  this.sun = this.sun && this.sun.destroy();
  this._sunPostProcess = this._sunPostProcess && this._sunPostProcess.destroy();
  this._depthPlane = this._depthPlane && this._depthPlane.destroy();
  this._transitioner = this._transitioner && this._transitioner.destroy();
  this._debugFrustumPlanes =
    this._debugFrustumPlanes && this._debugFrustumPlanes.destroy();
  this._brdfLutGenerator =
    this._brdfLutGenerator && this._brdfLutGenerator.destroy();
  this._picking = this._picking && this._picking.destroy();

  this._defaultView = this._defaultView && this._defaultView.destroy();
  this._view = undefined;

  if (this._removeCreditContainer) {
    this._canvas.parentNode.removeChild(this._creditContainer);
  }

  this.postProcessStages =
    this.postProcessStages && this.postProcessStages.destroy();

  this._context = this._context && this._context.destroy();
  this._frameState.creditDisplay =
    this._frameState.creditDisplay && this._frameState.creditDisplay.destroy();

  if (defined(this._performanceDisplay)) {
    this._performanceDisplay =
      this._performanceDisplay && this._performanceDisplay.destroy();
    this._performanceContainer.parentNode.removeChild(
      this._performanceContainer,
    );
  }

  this._removeRequestListenerCallback();
  this._removeTaskProcessorListenerCallback();
  for (let i = 0; i < this._removeGlobeCallbacks.length; ++i) {
    this._removeGlobeCallbacks[i]();
  }
  this._removeGlobeCallbacks.length = 0;

  if (defined(this._removeUpdateHeightCallback)) {
    this._removeUpdateHeightCallback();
    this._removeUpdateHeightCallback = undefined;
  }

  return destroyObject(this);
};
export default Scene;
