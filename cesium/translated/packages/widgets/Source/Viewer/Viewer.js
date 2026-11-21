import {
  BoundingSphere,
  Cartesian3,
  Clock,
  DeveloperError,
  Event,
  EventHelper,
  Frozen,
  JulianDate,
  Math as CesiumMath,
  defined,
  destroyObject,
} from "@cesium/core";
import {
  BoundingSphereState,
  CesiumWidget,
  Cesium3DTileFeature,
  Cesium3DTileVectorFeature,
  Cesium3DTileset,
  ConstantPositionProperty,
  Entity,
  getElement,
  Property,
  ScreenSpaceEventType,
  IonGeocoderService,
} from "@cesium/engine";
import Animation from "../Animation/Animation.js";
import AnimationViewModel from "../Animation/AnimationViewModel.js";
import BaseLayerPicker from "../BaseLayerPicker/BaseLayerPicker.js";
import createDefaultImageryProviderViewModels from "../BaseLayerPicker/createDefaultImageryProviderViewModels.js";
import createDefaultTerrainProviderViewModels from "../BaseLayerPicker/createDefaultTerrainProviderViewModels.js";
import ClockViewModel from "../ClockViewModel.js";
import FullscreenButton from "../FullscreenButton/FullscreenButton.js";
import Geocoder from "../Geocoder/Geocoder.js";
import HomeButton from "../HomeButton/HomeButton.js";
import InfoBox from "../InfoBox/InfoBox.js";
import NavigationHelpButton from "../NavigationHelpButton/NavigationHelpButton.js";
import ProjectionPicker from "../ProjectionPicker/ProjectionPicker.js";
import SceneModePicker from "../SceneModePicker/SceneModePicker.js";
import SelectionIndicator from "../SelectionIndicator/SelectionIndicator.js";
import subscribeAndEvaluate from "../subscribeAndEvaluate.js";
import Timeline from "../Timeline/Timeline.js";
import VRButton from "../VRButton/VRButton.js";

const boundingSphereScratch = new BoundingSphere();

function onTimelineScrubfunction(e) {
  const clock = e.clock;
  clock.currentTime = e.timeJulian;
  clock.shouldAnimate = false;
}

function getCesium3DTileFeatureDescription(feature) {
  const propertyIds = feature.getPropertyIds();

  let html = "";
  propertyIds.forEach(function (propertyId) {
    const value = feature.getProperty(propertyId);
    if (defined(value)) {
      html += `<tr><th>${propertyId}</th><td>${value}</td></tr>`;
    }
  });

  if (html.length > 0) {
    html = `<table class="cesium-infoBox-defaultTable"><tbody>${html}</tbody></table>`;
  }

  return html;
}

function getCesium3DTileFeatureName(feature) {
  // We need to iterate all property IDs to find potential
  // candidates, but since we prefer some property IDs
  // over others, we store them in an indexed array
  // and then use the first defined element in the array
  // as the preferred choice.

  let i;
  const possibleIds = [];
  const propertyIds = feature.getPropertyIds();
  for (i = 0; i < propertyIds.length; i++) {
    const propertyId = propertyIds[i];
    if (/^name$/i.test(propertyId)) {
      possibleIds[0] = feature.getProperty(propertyId);
    } else if (/name/i.test(propertyId)) {
      possibleIds[1] = feature.getProperty(propertyId);
    } else if (/^title$/i.test(propertyId)) {
      possibleIds[2] = feature.getProperty(propertyId);
    } else if (/^(id|identifier)$/i.test(propertyId)) {
      possibleIds[3] = feature.getProperty(propertyId);
    } else if (/element/i.test(propertyId)) {
      possibleIds[4] = feature.getProperty(propertyId);
    } else if (/(id|identifier)$/i.test(propertyId)) {
      possibleIds[5] = feature.getProperty(propertyId);
    }
  }

  const length = possibleIds.length;
  for (i = 0; i < length; i++) {
    const item = possibleIds[i];
    if (defined(item) && item !== "") {
      return item;
    }
  }
  return "Unnamed Feature";
}

function pickEntity(viewer, e) {
  const picked = viewer.scene.pick(e.position);
  if (defined(picked)) {
    const id = picked.id ?? picked.primitive.id;
    if (id instanceof Entity) {
      return id;
    }

    if (
      picked instanceof Cesium3DTileFeature ||
      picked instanceof Cesium3DTileVectorFeature
    ) {
      return new Entity({
        name: getCesium3DTileFeatureName(picked),
        description: getCesium3DTileFeatureDescription(picked),
        feature: picked,
      });
    }
  }

  // No regular entity picked.  Try picking features from imagery layers.
  return pickImageryLayerFeature(viewer, e.position);
}

const scratchStopTime = new JulianDate();

function linkTimelineToDataSourceClock(timeline, dataSource) {
  if (defined(dataSource)) {
    const dataSourceClock = dataSource.clock;
    if (defined(dataSourceClock) && defined(timeline)) {
      const startTime = dataSourceClock.startTime;
      let stopTime = dataSourceClock.stopTime;
      // When the start and stop times are equal, set the timeline to the shortest interval
      // starting at the start time. This prevents an invalid timeline configuration.
      if (JulianDate.equals(startTime, stopTime)) {
        stopTime = JulianDate.addSeconds(
          startTime,
          CesiumMath.EPSILON2,
          scratchStopTime,
        );
      }
      timeline.updateFromClock();
      timeline.zoomTo(startTime, stopTime);
    }
  }
}

const cartesian3Scratch = new Cartesian3();

function findFirstTileset(primitives) {
  const length = primitives.length;
  for (let i = 0; i < length; ++i) {
    const primitive = primitives.get(i);
    if (primitive instanceof Cesium3DTileset) {
      return primitive;
    }
  }
  return undefined;
}

function pickImageryLayerFeature(viewer, windowPosition) {
  const scene = viewer.scene;
  const pickRay = scene.camera.getPickRay(windowPosition);
  if (!defined(pickRay)) {
    return;
  }

  // When globe is disabled, scene.imageryLayers is undefined. Fall back to the
  // first Cesium3DTileset's imagery layers (e.g. draped imagery on 3D Tiles).
  let imageryLayers = scene.imageryLayers;
  if (!defined(imageryLayers)) {
    const tileset = findFirstTileset(scene.primitives);
    if (!defined(tileset)) {
      return;
    }
    imageryLayers = tileset.imageryLayers;
  }

  const imageryLayerFeaturePromise = imageryLayers.pickImageryLayerFeatures(
    pickRay,
    scene,
  );
  if (!defined(imageryLayerFeaturePromise)) {
    return;
  }

  // Imagery layer feature picking is asynchronous, so put up a message while loading.
  const loadingMessage = new Entity({
    id: "Loading...",
    description: "Loading feature information...",
  });

  imageryLayerFeaturePromise.then(
    function (features) {
      // Has this async pick been superseded by a later one?
      if (viewer.selectedEntity !== loadingMessage) {
        return;
      }

      if (!defined(features) || features.length === 0) {
        viewer.selectedEntity = createNoFeaturesEntity();
        return;
      }

      // Select the first feature.
      const feature = features[0];

      const entity = new Entity({
        id: feature.name,
        description: feature.description,
      });

      if (defined(feature.position)) {
        const ecfPosition = viewer.scene.ellipsoid.cartographicToCartesian(
          feature.position,
          cartesian3Scratch,
        );
        entity.position = new ConstantPositionProperty(ecfPosition);
      }

      viewer.selectedEntity = entity;
    },
    function () {
      // Has this async pick been superseded by a later one?
      if (viewer.selectedEntity !== loadingMessage) {
        return;
      }
      viewer.selectedEntity = createNoFeaturesEntity();
    },
  );

  return loadingMessage;
}

function createNoFeaturesEntity() {
  return new Entity({
    id: "None",
    description: "No features found.",
  });
}

function enableVRUI(viewer, enabled) {
  const geocoder = viewer._geocoder;
  const homeButton = viewer._homeButton;
  const sceneModePicker = viewer._sceneModePicker;
  const projectionPicker = viewer._projectionPicker;
  const baseLayerPicker = viewer._baseLayerPicker;
  const animation = viewer._animation;
  const timeline = viewer._timeline;
  const fullscreenButton = viewer._fullscreenButton;
  const infoBox = viewer._infoBox;
  const selectionIndicator = viewer._selectionIndicator;

  const visibility = enabled ? "hidden" : "visible";

  if (defined(geocoder)) {
    geocoder.container.style.visibility = visibility;
  }
  if (defined(homeButton)) {
    homeButton.container.style.visibility = visibility;
  }
  if (defined(sceneModePicker)) {
    sceneModePicker.container.style.visibility = visibility;
  }
  if (defined(projectionPicker)) {
    projectionPicker.container.style.visibility = visibility;
  }
  if (defined(baseLayerPicker)) {
    baseLayerPicker.container.style.visibility = visibility;
  }
  if (defined(animation)) {
    animation.container.style.visibility = visibility;
  }
  if (defined(timeline)) {
    timeline.container.style.visibility = visibility;
  }
  if (
    defined(fullscreenButton) &&
    fullscreenButton.viewModel.isFullscreenEnabled
  ) {
    fullscreenButton.container.style.visibility = visibility;
  }
  if (defined(infoBox)) {
    infoBox.container.style.visibility = visibility;
  }
  if (defined(selectionIndicator)) {
    selectionIndicator.container.style.visibility = visibility;
  }

  if (viewer._container) {
    const right =
      enabled || !defined(fullscreenButton)
        ? 0
        : fullscreenButton.container.clientWidth;
    viewer._vrButton.container.style.right = `${right}px`;

    viewer.forceResize();
  }
}

/**
 * @typedef {object} Viewer.ConstructorOptions
 *
 * Viewer构造函数初始化选项
 *
 * @property {boolean} [animation=true] 设置为 false 时，动画控件将不会创建。
 * @property {boolean} [baseLayerPicker=true] 设置为 false 时，基础图层选择器控件将不会创建。
 * @property {boolean} [fullscreenButton=true] 设置为 false 时，全屏按钮控件将不会创建。
 * @property {boolean} [vrButton=false] 设置为 true 时，VR按钮控件将创建。
 * @property {boolean|IonGeocodeProviderType|GeocoderService[]} [geocoder=IonGeocodeProviderType.DEFAULT] 使用地理编码服务或服务在 Geocoder 控件中搜索。设置为 false 时，Geocoder 控件将不会创建。
 * @property {boolean} [homeButton=true] 设置为 false 时，主页按钮控件将不会创建。
 * @property {boolean} [infoBox=true] 设置为 false 时，信息框控件将不会创建。
 * @property {boolean} [sceneModePicker=true] 设置为 false 时，场景模式选择器控件将不会创建。
 * @property {boolean} [selectionIndicator=true] 设置为 false 时，选择指示器控件将不会创建。
 * @property {boolean} [timeline=true] 设置为 false 时，时间轴控件将不会创建。
 * @property {boolean} [navigationHelpButton=true] 设置为 false 时，导航帮助按钮将不会创建。
 * @property {boolean} [navigationInstructionsInitiallyVisible=true] 如果应初始显示导航说明，则设为 true；否则在用户明确点击按钮前不显示。
 * @property {boolean} [scene3DOnly=false] 当设置为 <code>true</code> 时，每个几何实例仅以 3D 形式渲染以节省 GPU 内存。
 * @property {boolean} [shouldAnimate=false] 如果默认应推进模拟时间，则设为 <code>true</code>；否则设为 <code>false</code>。此选项优先于设置 {@link Viewer#clockViewModel}。
 * @property {ClockViewModel} [clockViewModel=new ClockViewModel(clock)] 用于控制当前时间的时钟视图模型。
 * @property {ProviderViewModel} [selectedImageryProviderViewModel] 当前基础影像图层的视图模型，若未提供则使用第一个可用的基础图层。此值仅在 `baseLayerPicker` 设置为 true 时有效。
 * @property {ProviderViewModel[]} [imageryProviderViewModels=createDefaultImageryProviderViewModels()] 可从基础图层选择器中选择的多重 ProviderViewModel 数组。此值仅在 `baseLayerPicker` 设置为 true 时有效。
 * @property {ProviderViewModel} [selectedTerrainProviderViewModel] 当前基础地形图层的视图模型，若未提供则使用第一个可用的基础图层。此值仅在 `baseLayerPicker` 设置为 true 时有效。
 * @property {ProviderViewModel[]} [terrainProviderViewModels=createDefaultTerrainProviderViewModels()] 可从基础图层选择器中选择的多重 ProviderViewModel 数组。此值仅在 `baseLayerPicker` 设置为 true 时有效。
 * @property {ImageryLayer|false} [baseLayer=ImageryLayer.fromWorldImagery()] 应用于地球仪的最底部影像图层。如果设置为 <code>false</code>，则不会添加任何影像提供器。此值仅在 `baseLayerPicker` 设置为 false 时有效。当 `globe` 设置为 false 时无法使用。
 * @property {Ellipsoid} [ellipsoid = Ellipsoid.default] 默认椭球体。
 * @property {TerrainProvider} [terrainProvider=new EllipsoidTerrainProvider()] 使用的地形提供器。
 * @property {Terrain} [terrain] 处理异步地形提供器的地形对象。仅可在 options.terrainProvider 未定义时指定。
 * @property {SkyBox|false} [skyBox] 用于渲染星星的天空盒。当使用 <code>undefined</code> 和 WGS84 椭球体时，将显示默认的星星。如果设置为 <code>false</code>，则不会添加天空盒、太阳或月亮。
 * @property {SkyAtmosphere|false} [skyAtmosphere] 蓝色天空以及地球边缘的辉光。当使用 WGS84 椭球体时启用。设置为 <code>false</code> 可关闭此效果。
 * @property {Element|string} [fullscreenElement=document.body] 按下全屏按钮后进入全屏模式的元素或 ID。
 * @property {boolean} [useDefaultRenderLoop=true] 如果此控件应控制渲染循环，则为 true，否则为 false。
 * @property {number} [targetFrameRate] 使用默认渲染循环时的目标帧率。
 * @property {boolean} [showRenderLoopErrors=true] 如果为 true，当发生渲染循环错误时，此控件将自动向用户显示包含错误的 HTML 面板。
 * @property {boolean} [useBrowserRecommendedResolution=true] 如果为 true，将以浏览器推荐的分辨率进行渲染，并忽略 <code>window.devicePixelRatio</code>。
 * @property {boolean} [automaticallyTrackDataSourceClocks=true] 如果为 true，此控件将自动跟踪新添加 DataSource 的时钟设置，当 DataSource 的时钟发生变化时更新。如果要独立配置时钟，请将此参数设置为 false。
 * @property {ContextOptions} [contextOptions] 传递给 {@link Scene} 的上下文和 WebGL 创建属性。
 * @property {SceneMode} [sceneMode=SceneMode.SCENE3D] 初始场景模式。
 * @property {MapProjection} [mapProjection=new GeographicProjection(options.ellipsoid)] 在 2D 模式和 Columbus View 模式下使用的地图投影。
 * @property {Globe|false} [globe=new Globe(options.ellipsoid)] 场景中使用的地球仪。如果设置为 <code>false</code>，则不会添加地球仪，且天空氛围默认会被隐藏。
 * @property {boolean} [orderIndependentTranslucency=true] 如果为 true 且配置支持，将使用顺序独立的半透明效果。
 * @property {Element|string} [creditContainer] 将包含 {@link CreditDisplay} 的 DOM 元素或 ID。如果没有指定，徽标将添加到控件本身的底部。
 * @property {Element|string} [creditViewport] 将包含由 {@linkCreditDisplay} 创建的徽标弹出窗口的 DOM 元素或 ID。如果没有指定，该窗口将出现在控件本身之上。
 * @property {DataSourceCollection} [dataSources=new DataSourceCollection()] 控件所可视化的数据源集合。如果提供此参数，
 * 则假设实例由调用者拥有，并且在查看器被销毁时不会被销毁。
 * @property {boolean} [shadows=false] 确定光源是否产生阴影。
 * @property {ShadowMode} [terrainShadows=ShadowMode.RECEIVE_ONLY] 确定地形是否从光源产生或接收阴影。
 * @property {MapMode2D} [mapMode2D=MapMode2D.INFINITE_SCROLL] 确定 2D 地图是否可以旋转或在水平方向无限滚动。
 * @property {boolean} [projectionPicker=false] 如果设置为 true，将创建 ProjectionPicker 控件。
 * @property {boolean} [blurActiveElementOnCanvasFocus=true] 如果为 true，当查看器的画布被点击时，活动元素将模糊。将此参数设置为 false 在仅点击画布以获取位置或实体数据而不实际将画布设为活动元素时非常有用。
 * @property {boolean} [requestRenderMode=false] 如果为 true，渲染帧仅在场景发生变更时按需进行。启用此功能可降低应用程序的 CPU/GPU 使用率，在移动设备上节省电量，但在此模式下需要调用 {@link Scene#requestRender} 来显式渲染新帧。当在 API 的其他部分对场景进行更改后，许多情况下都需要这样做。请参阅 {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}。
 * @property {number} [maximumRenderTimeChange=0.0] 如果 requestRenderMode 为 true，此值定义了在请求渲染之前允许的模拟时间最大变化量。请参阅 {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}。
 * @property {number} [depthPlaneEllipsoidOffset=0.0] 调整 DepthPlane 以解决椭球体零高度以下的渲染伪影问题。
 * @property {number} [msaaSamples=4] 如果提供，此值控制多样本抗锯齿的速率。常见的多样本采样率为每像素 2、4 或有时 8 个样本。较高的 MSAA 采样率可能会影响性能，但能提升视觉质量。此值仅适用于支持多样本渲染目标的 WebGL2 上下文。设置为 1 可禁用 MSAA。
 */

/**
 * 用于构建应用程序的基础控件。它将所有标准 Cesium 控件合并为一个可复用包。
 * 可以通过使用 mixins 来扩展该控件，从而添加对多种应用有用的功能。
 *
 * @alias Viewer
 * @constructor
 *
 * @param {Element|string} container 将包含该控件的 DOM 元素或 ID。
 * @param {Viewer.ConstructorOptions} [options] 描述初始化选项的对象。
 *
 * @exception {DeveloperError} Element 文档中不存在 id "container" 的节点。
 * @exception {DeveloperError} options.selectedImageryProviderViewModel 当不使用 BaseLayerPicker 控件时不可用，应指定 options.baseLayer 代替。
 * @exception {DeveloperError} options.selectedTerrainProviderViewModel 当不使用 BaseLayerPicker 控件时不可用，应指定 options.terrainProvider 代替。
 *
 * @see Animation
 * @see BaseLayerPicker
 * @see CesiumWidget
 * @see FullscreenButton
 * @see HomeButton
 * @see SceneModePicker
 * @see Timeline
 * @see viewerDragDropMixin
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=hello-world|Cesium Sandcastle Hello World Demo}
 *
 * @example
 * // 使用多个自定义选项和 mixins 初始化查看器控件。
 * try {
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * // 以 Columbus Viewer 模式启动
 * sceneMode: Cesium.SceneMode.COLUMBUS_VIEW,
 * // 使用 Cesium World Terrain
 * terrain: Cesium.Terrain.fromWorldTerrain(),
 * // 隐藏基础层选择器
 * baseLayerPicker: false,
 * // 使用 OpenStreetMaps
 * baseLayer: new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({
 * url: "https://tile.openstreetmap.org/"
 *     })),
 * skyBox: new Cesium.SkyBox({
 * sources: {
 * positiveX: "stars/TychoSkymapII.t3_08192x04096_80_px.jpg",
 * negativeX: "stars/TychoSkymapII.t3_08192x04096_80_mx.jpg",
 * positiveY: "stars/TychoSkymapII.t3_08192x04096_80_py.jpg",
 * negativeY: "stars/TychoSkymapII.t3_08192x04096_80_my.jpg",
 * positiveZ: "stars/TychoSkymapII.t3_08192x04096_80_pz.jpg",
 * negativeZ: "stars/TychoSkymapII.t3_08192x04096_80_mz.jpg"
 *       }
 *     }),
 * // 显示使用Web Mercator投影的Columbus View地图
 * mapProjection: new Cesium.WebMercatorProjection()
 *   });
 * } catch (error) {
 * console.log(error);
 * }
 *
 * // 添加基本的拖拽和放置功能
 * viewer.extend(Cesium.viewerDragDropMixin);
 *
 * // 当处理被放置的文件时遇到错误时显示弹出警告
 * viewer.dropError.addEventListener(function(dropHandler, name, error) {
 * console.log(error);
 * window.alert(error);
 * });
 */
function Viewer(container, options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(container)) {
    throw new DeveloperError("container is required.");
  }
  //>>includeEnd('debug');

  container = getElement(container);
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (
    options.globe === false &&
    defined(options.baseLayer) &&
    options.baseLayer !== false
  ) {
    throw new DeveloperError("Cannot use baseLayer when globe is disabled.");
  }
  //>>includeEnd('debug');

  const createBaseLayerPicker =
    (!defined(options.globe) || options.globe !== false) &&
    (!defined(options.baseLayerPicker) || options.baseLayerPicker !== false);

  //>>includeStart('debug', pragmas.debug);
  // If not using BaseLayerPicker, selectedImageryProviderViewModel is an invalid option
  if (
    !createBaseLayerPicker &&
    defined(options.selectedImageryProviderViewModel)
  ) {
    throw new DeveloperError(
      "options.selectedImageryProviderViewModel is not available when not using the BaseLayerPicker widget. \
Either specify options.baseLayer instead or set options.baseLayerPicker to true.",
    );
  }

  // If not using BaseLayerPicker, selectedTerrainProviderViewModel is an invalid option
  if (
    !createBaseLayerPicker &&
    defined(options.selectedTerrainProviderViewModel)
  ) {
    throw new DeveloperError(
      "options.selectedTerrainProviderViewModel is not available when not using the BaseLayerPicker widget. \
Either specify options.terrainProvider instead or set options.baseLayerPicker to true.",
    );
  }
  //>>includeEnd('debug');

  const that = this;

  const viewerContainer = document.createElement("div");
  viewerContainer.className = "cesium-viewer";
  container.appendChild(viewerContainer);

  // Cesium widget container
  const cesiumWidgetContainer = document.createElement("div");
  cesiumWidgetContainer.className = "cesium-viewer-cesiumWidgetContainer";
  viewerContainer.appendChild(cesiumWidgetContainer);

  // Bottom container
  const bottomContainer = document.createElement("div");
  bottomContainer.className = "cesium-viewer-bottom";

  viewerContainer.appendChild(bottomContainer);

  const scene3DOnly = options.scene3DOnly ?? false;

  let clock;
  let clockViewModel;
  let destroyClockViewModel = false;
  if (defined(options.clockViewModel)) {
    clockViewModel = options.clockViewModel;
    clock = clockViewModel.clock;
  } else {
    clock = new Clock();
    clockViewModel = new ClockViewModel(clock);
    destroyClockViewModel = true;
  }

  // Cesium widget
  const cesiumWidget = new CesiumWidget(cesiumWidgetContainer, {
    baseLayer:
      (createBaseLayerPicker &&
        defined(options.selectedImageryProviderViewModel)) ||
      defined(options.baseLayer) ||
      defined(options.imageryProvider)
        ? false
        : undefined,
    clock: clock,
    shouldAnimate: options.shouldAnimate,
    skyBox: options.skyBox,
    skyAtmosphere: options.skyAtmosphere,
    sceneMode: options.sceneMode,
    ellipsoid: options.ellipsoid,
    mapProjection: options.mapProjection,
    globe: options.globe,
    orderIndependentTranslucency: options.orderIndependentTranslucency,
    automaticallyTrackDataSourceClocks:
      options.automaticallyTrackDataSourceClocks,
    contextOptions: options.contextOptions,
    useDefaultRenderLoop: options.useDefaultRenderLoop,
    targetFrameRate: options.targetFrameRate,
    showRenderLoopErrors: options.showRenderLoopErrors,
    useBrowserRecommendedResolution: options.useBrowserRecommendedResolution,
    creditContainer: defined(options.creditContainer)
      ? options.creditContainer
      : bottomContainer,
    creditViewport: options.creditViewport,
    dataSources: options.dataSources,
    scene3DOnly: scene3DOnly,
    shadows: options.shadows,
    terrainShadows: options.terrainShadows,
    mapMode2D: options.mapMode2D,
    blurActiveElementOnCanvasFocus: options.blurActiveElementOnCanvasFocus,
    requestRenderMode: options.requestRenderMode,
    maximumRenderTimeChange: options.maximumRenderTimeChange,
    depthPlaneEllipsoidOffset: options.depthPlaneEllipsoidOffset,
    msaaSamples: options.msaaSamples,
  });

  const scene = cesiumWidget.scene;

  const eventHelper = new EventHelper();

  eventHelper.add(clock.onTick, Viewer.prototype._onTick, this);

  // Selection Indicator
  let selectionIndicator;
  if (
    !defined(options.selectionIndicator) ||
    options.selectionIndicator !== false
  ) {
    const selectionIndicatorContainer = document.createElement("div");
    selectionIndicatorContainer.className =
      "cesium-viewer-selectionIndicatorContainer";
    viewerContainer.appendChild(selectionIndicatorContainer);
    selectionIndicator = new SelectionIndicator(
      selectionIndicatorContainer,
      scene,
    );
  }

  // Info Box
  let infoBox;
  if (!defined(options.infoBox) || options.infoBox !== false) {
    const infoBoxContainer = document.createElement("div");
    infoBoxContainer.className = "cesium-viewer-infoBoxContainer";
    viewerContainer.appendChild(infoBoxContainer);
    infoBox = new InfoBox(infoBoxContainer);

    const infoBoxViewModel = infoBox.viewModel;
    eventHelper.add(
      infoBoxViewModel.cameraClicked,
      Viewer.prototype._onInfoBoxCameraClicked,
      this,
    );
    eventHelper.add(
      infoBoxViewModel.closeClicked,
      Viewer.prototype._onInfoBoxClockClicked,
      this,
    );
  }

  // Main Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "cesium-viewer-toolbar";
  viewerContainer.appendChild(toolbar);

  // Geocoder
  let geocoder;
  if (!defined(options.geocoder) || options.geocoder !== false) {
    const geocoderContainer = document.createElement("div");
    geocoderContainer.className = "cesium-viewer-geocoderContainer";
    toolbar.appendChild(geocoderContainer);
    let geocoderService;
    if (typeof options.geocoder === "string") {
      geocoderService = [
        new IonGeocoderService({
          scene,
          geocodeProviderType: options.geocoder,
        }),
      ];
    } else if (
      defined(options.geocoder) &&
      typeof options.geocoder !== "boolean"
    ) {
      geocoderService = Array.isArray(options.geocoder)
        ? options.geocoder
        : [options.geocoder];
    }
    geocoder = new Geocoder({
      container: geocoderContainer,
      geocoderServices: geocoderService,
      scene: scene,
    });
    // Subscribe to search so that we can clear the trackedEntity when it is clicked.
    eventHelper.add(
      geocoder.viewModel.search.beforeExecute,
      Viewer.prototype._clearObjects,
      this,
    );
  }

  // HomeButton
  let homeButton;
  if (!defined(options.homeButton) || options.homeButton !== false) {
    homeButton = new HomeButton(toolbar, scene);
    if (defined(geocoder)) {
      eventHelper.add(homeButton.viewModel.command.afterExecute, function () {
        const viewModel = geocoder.viewModel;
        viewModel.searchText = "";
        if (viewModel.isSearchInProgress) {
          viewModel.search();
        }
      });
    }
    // Subscribe to the home button beforeExecute event so that we can clear the trackedEntity.
    eventHelper.add(
      homeButton.viewModel.command.beforeExecute,
      Viewer.prototype._clearTrackedObject,
      this,
    );
  }

  // SceneModePicker
  // By default, we silently disable the scene mode picker if scene3DOnly is true,
  // but if sceneModePicker is explicitly set to true, throw an error.
  //>>includeStart('debug', pragmas.debug);
  if (options.sceneModePicker === true && scene3DOnly) {
    throw new DeveloperError(
      "options.sceneModePicker is not available when options.scene3DOnly is set to true.",
    );
  }
  //>>includeEnd('debug');

  let sceneModePicker;
  if (
    !scene3DOnly &&
    (!defined(options.sceneModePicker) || options.sceneModePicker !== false)
  ) {
    sceneModePicker = new SceneModePicker(toolbar, scene);
  }

  let projectionPicker;
  if (options.projectionPicker) {
    projectionPicker = new ProjectionPicker(toolbar, scene);
  }

  // BaseLayerPicker
  let baseLayerPicker;
  let baseLayerPickerDropDown;
  if (createBaseLayerPicker) {
    const imageryProviderViewModels =
      options.imageryProviderViewModels ??
      createDefaultImageryProviderViewModels();
    const terrainProviderViewModels =
      options.terrainProviderViewModels ??
      createDefaultTerrainProviderViewModels();

    baseLayerPicker = new BaseLayerPicker(toolbar, {
      globe: scene.globe,
      imageryProviderViewModels: imageryProviderViewModels,
      selectedImageryProviderViewModel:
        options.selectedImageryProviderViewModel,
      terrainProviderViewModels: terrainProviderViewModels,
      selectedTerrainProviderViewModel:
        options.selectedTerrainProviderViewModel,
    });

    //Grab the dropdown for resize code.
    const elements = toolbar.getElementsByClassName(
      "cesium-baseLayerPicker-dropDown",
    );
    baseLayerPickerDropDown = elements[0];
  }

  // These need to be set after the BaseLayerPicker is created in order to take effect
  if (defined(options.baseLayer) && options.baseLayer !== false) {
    if (createBaseLayerPicker) {
      baseLayerPicker.viewModel.selectedImagery = undefined;
    }
    scene.imageryLayers.removeAll();
    scene.imageryLayers.add(options.baseLayer);
  }

  if (defined(options.terrainProvider)) {
    if (createBaseLayerPicker) {
      baseLayerPicker.viewModel.selectedTerrain = undefined;
    }
    scene.terrainProvider = options.terrainProvider;
  }

  if (defined(options.terrain)) {
    //>>includeStart('debug', pragmas.debug);
    if (defined(options.terrainProvider)) {
      throw new DeveloperError(
        "Specify either options.terrainProvider or options.terrain.",
      );
    }
    //>>includeEnd('debug');

    if (createBaseLayerPicker) {
      // Required as this is otherwise set by the baseLayerPicker
      scene.globe.depthTestAgainstTerrain = true;
    }

    scene.setTerrain(options.terrain);
  }

  // Navigation Help Button
  let navigationHelpButton;
  if (
    !defined(options.navigationHelpButton) ||
    options.navigationHelpButton !== false
  ) {
    let showNavHelp = true;
    try {
      //window.localStorage is null if disabled in Firefox or undefined in browsers with implementation
      if (defined(window.localStorage)) {
        const hasSeenNavHelp = window.localStorage.getItem(
          "cesium-hasSeenNavHelp",
        );
        if (defined(hasSeenNavHelp) && Boolean(hasSeenNavHelp)) {
          showNavHelp = false;
        } else {
          window.localStorage.setItem("cesium-hasSeenNavHelp", "true");
        }
      }
    } catch (e) {
      //Accessing window.localStorage throws if disabled in Chrome
      //window.localStorage.setItem throws if in Safari private browsing mode or in any browser if we are over quota.
    }
    navigationHelpButton = new NavigationHelpButton({
      container: toolbar,
      instructionsInitiallyVisible:
        options.navigationInstructionsInitiallyVisible ?? showNavHelp,
    });
  }

  // Animation
  let animation;
  if (!defined(options.animation) || options.animation !== false) {
    const animationContainer = document.createElement("div");
    animationContainer.className = "cesium-viewer-animationContainer";
    viewerContainer.appendChild(animationContainer);
    animation = new Animation(
      animationContainer,
      new AnimationViewModel(clockViewModel),
    );
  }

  // Timeline
  let timeline;
  if (!defined(options.timeline) || options.timeline !== false) {
    const timelineContainer = document.createElement("div");
    timelineContainer.className = "cesium-viewer-timelineContainer";
    viewerContainer.appendChild(timelineContainer);
    timeline = new Timeline(timelineContainer, clock);
    timeline.addEventListener("settime", onTimelineScrubfunction, false);
    timeline.zoomTo(clock.startTime, clock.stopTime);
  }

  // Fullscreen
  let fullscreenButton;
  let fullscreenSubscription;
  let fullscreenContainer;
  if (
    !defined(options.fullscreenButton) ||
    options.fullscreenButton !== false
  ) {
    fullscreenContainer = document.createElement("div");
    fullscreenContainer.className = "cesium-viewer-fullscreenContainer";
    viewerContainer.appendChild(fullscreenContainer);
    fullscreenButton = new FullscreenButton(
      fullscreenContainer,
      options.fullscreenElement,
    );

    //Subscribe to fullscreenButton.viewModel.isFullscreenEnabled so
    //that we can hide/show the button as well as size the timeline.
    fullscreenSubscription = subscribeAndEvaluate(
      fullscreenButton.viewModel,
      "isFullscreenEnabled",
      function (isFullscreenEnabled) {
        fullscreenContainer.style.display = isFullscreenEnabled
          ? "block"
          : "none";
        if (defined(timeline)) {
          timeline.container.style.right = `${fullscreenContainer.clientWidth}px`;
          timeline.resize();
        }
      },
    );
  }

  // VR
  let vrButton;
  let vrSubscription;
  let vrModeSubscription;
  if (options.vrButton) {
    const vrContainer = document.createElement("div");
    vrContainer.className = "cesium-viewer-vrContainer";
    viewerContainer.appendChild(vrContainer);
    vrButton = new VRButton(vrContainer, scene, options.fullScreenElement);

    vrSubscription = subscribeAndEvaluate(
      vrButton.viewModel,
      "isVREnabled",
      function (isVREnabled) {
        vrContainer.style.display = isVREnabled ? "block" : "none";
        if (defined(fullscreenButton)) {
          vrContainer.style.right = `${fullscreenContainer.clientWidth}px`;
        }
        if (defined(timeline)) {
          timeline.container.style.right = `${vrContainer.clientWidth}px`;
          timeline.resize();
        }
      },
    );

    vrModeSubscription = subscribeAndEvaluate(
      vrButton.viewModel,
      "isVRMode",
      function (isVRMode) {
        enableVRUI(that, isVRMode);
      },
    );
  }

  //Assign all properties to this instance.  No "this" assignments should
  //take place above this line.
  this._baseLayerPickerDropDown = baseLayerPickerDropDown;
  this._fullscreenSubscription = fullscreenSubscription;
  this._vrSubscription = vrSubscription;
  this._vrModeSubscription = vrModeSubscription;
  this._dataSourceChangedListeners = {};
  this._container = container;
  this._bottomContainer = bottomContainer;
  this._element = viewerContainer;
  this._cesiumWidget = cesiumWidget;
  this._selectionIndicator = selectionIndicator;
  this._infoBox = infoBox;
  this._clockViewModel = clockViewModel;
  this._destroyClockViewModel = destroyClockViewModel;
  this._toolbar = toolbar;
  this._homeButton = homeButton;
  this._sceneModePicker = sceneModePicker;
  this._projectionPicker = projectionPicker;
  this._baseLayerPicker = baseLayerPicker;
  this._navigationHelpButton = navigationHelpButton;
  this._animation = animation;
  this._timeline = timeline;
  this._fullscreenButton = fullscreenButton;
  this._vrButton = vrButton;
  this._geocoder = geocoder;
  this._eventHelper = eventHelper;
  this._lastWidth = 0;
  this._lastHeight = 0;
  this._enableInfoOrSelection = defined(infoBox) || defined(selectionIndicator);
  this._selectedEntity = undefined;
  this._selectedEntityChanged = new Event();

  const dataSourceCollection = this._cesiumWidget.dataSources;
  const dataSourceDisplay = this._cesiumWidget.dataSourceDisplay;

  //Listen to data source events in order to track clock changes.
  eventHelper.add(
    dataSourceCollection.dataSourceAdded,
    Viewer.prototype._onDataSourceAdded,
    this,
  );
  eventHelper.add(
    dataSourceCollection.dataSourceRemoved,
    Viewer.prototype._onDataSourceRemoved,
    this,
  );

  // Prior to each render, check if anything needs to be resized.
  eventHelper.add(scene.postUpdate, Viewer.prototype.resize, this);

  // We need to subscribe to the data sources and collections so that we can clear the
  // tracked object when it is removed from the scene.
  // Subscribe to current data sources
  const dataSourceLength = dataSourceCollection.length;
  for (let i = 0; i < dataSourceLength; i++) {
    this._dataSourceAdded(dataSourceCollection, dataSourceCollection.get(i));
  }
  this._dataSourceAdded(undefined, dataSourceDisplay.defaultDataSource);

  // Hook up events so that we can subscribe to future sources.
  eventHelper.add(
    dataSourceCollection.dataSourceAdded,
    Viewer.prototype._dataSourceAdded,
    this,
  );
  eventHelper.add(
    dataSourceCollection.dataSourceRemoved,
    Viewer.prototype._dataSourceRemoved,
    this,
  );

  // Subscribe to left clicks and zoom to the picked object.
  function pickAndTrackObject(e) {
    const entity = pickEntity(that, e);
    if (defined(entity)) {
      //Only track the entity if it has a valid position at the current time.
      if (
        Property.getValueOrUndefined(entity.position, that.clock.currentTime)
      ) {
        that.trackedEntity = entity;
      } else {
        that.zoomTo(entity);
      }
    } else if (defined(that.trackedEntity)) {
      that.trackedEntity = undefined;
    }
  }

  function pickAndSelectObject(e) {
    that.selectedEntity = pickEntity(that, e);
  }

  cesiumWidget.screenSpaceEventHandler.setInputAction(
    pickAndSelectObject,
    ScreenSpaceEventType.LEFT_CLICK,
  );
  cesiumWidget.screenSpaceEventHandler.setInputAction(
    pickAndTrackObject,
    ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  );

  // This allows to update the Viewer's _clockViewModel instead of the CesiumWidget's _clock
  // when CesiumWidget is created from the Viewer.
  cesiumWidget._canAnimateUpdateCallback = this._updateCanAnimate(this);
}

Object.defineProperties(Viewer.prototype, {
  /**
   * 获取父容器。
   * @memberof Viewer.prototype
   * @type {Element}
   * @readonly
   */
  container: {
    get: function () {
      return this._container;
    },
  },

  /**
   * 管理在屏幕上和光盒中显示的致谢列表。
   * @memberof Viewer.prototype
   *
   * @type {CreditDisplay}
   */
  creditDisplay: {
    get: function () {
      return this._cesiumWidget.creditDisplay;
    },
  },

  /**
   * 获取窗口底部区域的DOM元素，该区域包含
   * {@link CreditDisplay}和其他可能的内容。
   * @memberof Viewer.prototype
   * @type {Element}
   * @readonly
   */
  bottomContainer: {
    get: function () {
      return this._bottomContainer;
    },
  },

  /**
   * 获取CesiumWidget。
   * @memberof Viewer.prototype
   * @type {CesiumWidget}
   * @readonly
   */
  cesiumWidget: {
    get: function () {
      return this._cesiumWidget;
    },
  },

  /**
   * 获取选择指示器。
   * @memberof Viewer.prototype
   * @type {SelectionIndicator}
   * @readonly
   */
  selectionIndicator: {
    get: function () {
      return this._selectionIndicator;
    },
  },

  /**
   * 获取信息框。
   * @memberof Viewer.prototype
   * @type {InfoBox}
   * @readonly
   */
  infoBox: {
    get: function () {
      return this._infoBox;
    },
  },

  /**
   * 获取地理编码器。
   * @memberof Viewer.prototype
   * @type {Geocoder}
   * @readonly
   */
  geocoder: {
    get: function () {
      return this._geocoder;
    },
  },

  /**
   * 获取主页按钮。
   * @memberof Viewer.prototype
   * @type {HomeButton}
   * @readonly
   */
  homeButton: {
    get: function () {
      return this._homeButton;
    },
  },

  /**
   * 获取场景模式选择器。
   * @memberof Viewer.prototype
   * @type {SceneModePicker}
   * @readonly
   */
  sceneModePicker: {
    get: function () {
      return this._sceneModePicker;
    },
  },

  /**
   * 获取投影选择器。
   * @memberof Viewer.prototype
   * @type {ProjectionPicker}
   * @readonly
   */
  projectionPicker: {
    get: function () {
      return this._projectionPicker;
    },
  },

  /**
   * 获取基础层选择器。
   * @memberof Viewer.prototype
   * @type {BaseLayerPicker}
   * @readonly
   */
  baseLayerPicker: {
    get: function () {
      return this._baseLayerPicker;
    },
  },

  /**
   * 获取导航帮助按钮。
   * @memberof Viewer.prototype
   * @type {NavigationHelpButton}
   * @readonly
   */
  navigationHelpButton: {
    get: function () {
      return this._navigationHelpButton;
    },
  },

  /**
   * 获取动画控件。
   * @memberof Viewer.prototype
   * @type {Animation}
   * @readonly
   */
  animation: {
    get: function () {
      return this._animation;
    },
  },

  /**
   * 获取时间轴控件。
   * @memberof Viewer.prototype
   * @type {Timeline}
   * @readonly
   */
  timeline: {
    get: function () {
      return this._timeline;
    },
  },

  /**
   * 获取全屏按钮。
   * @memberof Viewer.prototype
   * @type {FullscreenButton}
   * @readonly
   */
  fullscreenButton: {
    get: function () {
      return this._fullscreenButton;
    },
  },

  /**
   * 获取VR按钮。
   * @memberof Viewer.prototype
   * @type {VRButton}
   * @readonly
   */
  vrButton: {
    get: function () {
      return this._vrButton;
    },
  },

  /**
   * 获取用于 {@link DataSource} 可视化的显示区域。
   * @memberof Viewer.prototype
   * @type {DataSourceDisplay}
   * @readonly
   */
  dataSourceDisplay: {
    get: function () {
      return this._cesiumWidget.dataSourceDisplay;
    },
  },

  /**
   * 获取未绑定特定数据源的实体集合。
   * 这是[dataSourceDisplay.defaultDataSource.entities]{@link Viewer#dataSourceDisplay}的快捷方式。
   * @memberof Viewer.prototype
   * @type {EntityCollection}
   * @readonly
   */
  entities: {
    get: function () {
      return this._cesiumWidget.entities;
    },
  },

  /**
   * 获取要可视化的 {@link DataSource} 实例集合。
   * @memberof Viewer.prototype
   * @type {DataSourceCollection}
   * @readonly
   */
  dataSources: {
    get: function () {
      return this._cesiumWidget.dataSources;
    },
  },

  /**
   * 获取画布。
   * @memberof Viewer.prototype
   * @type {HTMLCanvasElement}
   * @readonly
   */
  canvas: {
    get: function () {
      return this._cesiumWidget.canvas;
    },
  },

  /**
   * 获取场景。
   * @memberof Viewer.prototype
   * @type {Scene}
   * @readonly
   */
  scene: {
    get: function () {
      return this._cesiumWidget.scene;
    },
  },

  /**
   * 确定光源是否产生阴影。
   * @memberof Viewer.prototype
   * @type {boolean}
   */
  shadows: {
    get: function () {
      return this.scene.shadowMap.enabled;
    },
    set: function (value) {
      this.scene.shadowMap.enabled = value;
    },
  },

  /**
   * 确定地形是否从光源产生阴影。
   * @memberof Viewer.prototype
   * @type {ShadowMode}
   */
  terrainShadows: {
    get: function () {
      return this.scene.globe.shadows;
    },
    set: function (value) {
      this.scene.globe.shadows = value;
    },
  },

  /**
   * 获取场景的阴影图。
   * @memberof Viewer.prototype
   * @type {ShadowMap}
   * @readonly
   */
  shadowMap: {
    get: function () {
      return this.scene.shadowMap;
    },
  },

  /**
   * 获取将在地球仪上渲染的影像图层集合。
   * @memberof Viewer.prototype
   *
   * @type {ImageryLayerCollection}
   * @readonly
   */
  imageryLayers: {
    get: function () {
      return this.scene.imageryLayers;
    },
  },

  /**
   * 提供地球仪表面几何形状的地形提供者。
   * @memberof Viewer.prototype
   *
   * @type {TerrainProvider}
   */
  terrainProvider: {
    get: function () {
      return this.scene.terrainProvider;
    },
    set: function (terrainProvider) {
      this.scene.terrainProvider = terrainProvider;
    },
  },

  /**
   * 获取相机。
   * @memberof Viewer.prototype
   *
   * @type {Camera}
   * @readonly
   */
  camera: {
    get: function () {
      return this.scene.camera;
    },
  },

  /**
   * 获取场景的默认椭球体。
   * @memberof Viewer.prototype
   *
   * @type {Ellipsoid}
   * @default Ellipsoid.default
   * @readonly
   */
  ellipsoid: {
    get: function () {
      return this.scene.ellipsoid;
    },
  },

  /**
   * 获取后处理阶段。
   * @memberof Viewer.prototype
   *
   * @type {PostProcessStageCollection}
   * @readonly
   */
  postProcessStages: {
    get: function () {
      return this.scene.postProcessStages;
    },
  },

  /**
   * 获取时钟。
   * @memberof Viewer.prototype
   * @type {Clock}
   * @readonly
   */
  clock: {
    get: function () {
      return this._clockViewModel.clock;
    },
  },

  /**
   * 获取时钟视图模型。
   * @memberof Viewer.prototype
   * @type {ClockViewModel}
   * @readonly
   */
  clockViewModel: {
    get: function () {
      return this._clockViewModel;
    },
  },

  /**
   * 获取屏幕空间事件处理器。
   * @memberof Viewer.prototype
   * @type {ScreenSpaceEventHandler}
   * @readonly
   */
  screenSpaceEventHandler: {
    get: function () {
      return this._cesiumWidget.screenSpaceEventHandler;
    },
  },

  /**
   * 在<code>useDefaultRenderLoop</code>
   * 为true时，获取或设置控件的目标帧率。如果未定义，则使用浏览器的requestAnimationFrame实现。
   * 决定帧率。如果定义此值，则必须大于 0。高于底层 requestAnimationFrame 实现所能支持的值将无效。
   * 高于该值的数值将不会产生效果。
   * @memberof Viewer.prototype
   *
   * @type {number}
   */
  targetFrameRate: {
    get: function () {
      return this._cesiumWidget.targetFrameRate;
    },
    set: function (value) {
      this._cesiumWidget.targetFrameRate = value;
    },
  },

  /**
   * 用于获取或设置此控件是否应控制渲染循环。
   * 如果设置为 true，控件将使用 requestAnimationFrame 来
   * 执行控件的渲染和缩放操作，以及驱动
   * 模拟时钟。如果设置为 false，则必须手动调用
   * `resize` 和 `render` 方法作为自定义渲染循环的一部分。如果在渲染过程中发生错误，{@link Scene} 的
   * `renderError` 事件将被触发，此属性将设置为 false。必须在出现错误后将其重新设置为 true 才能继续渲染。
   * 用于获取或设置渲染分辨率的缩放因子。小于 1.0 的值可以在较弱设备上提升性能，而大于 1.0 的值将以更高
   * 分辨率进行渲染，然后缩小，从而提升视觉保真度。
   * 例如，如果控件的大小为 640x480，将此值设置为 0.5 会导致场景以 320x240 分辨率渲染，然后放大；而设置为 2.0 则会导致场景以 1280x960 分辨率渲染，然后缩小。
   * @memberof Viewer.prototype
   *
   * @type {boolean}
   */
  useDefaultRenderLoop: {
    get: function () {
      return this._cesiumWidget.useDefaultRenderLoop;
    },
    set: function (value) {
      this._cesiumWidget.useDefaultRenderLoop = value;
    },
  },

  /**
   * 布尔标志，指示是否使用浏览器推荐的分辨率。
   * 如果设置为 true，将忽略浏览器的设备像素比，使用 1.0，
   * 实际上基于 CSS 像素而非设备像素进行渲染。这可以在像素密度较高的较弱设备上提升性能。当设置为 false 时，渲染
   * 将以设备像素进行。{@link Viewer#resolutionScale} 仍然生效，无论此标志是 true 还是 false。
   * 用于获取或设置数据源是否可以暂时暂停
   * 动画，以避免向用户显示不完整的画面。
   * @memberof Viewer.prototype
   *
   * @type {number}
   * @default 1.0
   */
  resolutionScale: {
    get: function () {
      return this._cesiumWidget.resolutionScale;
    },
    set: function (value) {
      this._cesiumWidget.resolutionScale = value;
    },
  },

  /**
   * 例如，如果在后台处理异步原语，时钟将不会推进，直到几何数据准备就绪。
   * 用于获取或设置当前被相机跟踪的实体实例。
   * 用于获取或设置要显示选择指示器的对象实例。
   * 如果用户交互式选择了 Cesium3DTilesFeature 实例，则此属性将包含具有名为“feature”属性的临时实体实例。
   * will be in device pixels. {@link Viewer#resolutionScale} will still take effect whether
   * this flag is true or false.
   * @memberof Viewer.prototype
   *
   * @type {boolean}
   * @default true
   */
  useBrowserRecommendedResolution: {
    get: function () {
      return this._cesiumWidget.useBrowserRecommendedResolution;
    },
    set: function (value) {
      this._cesiumWidget.useBrowserRecommendedResolution = value;
    },
  },

  /**
   * Gets or sets whether or not data sources can temporarily pause
   * animation in order to avoid showing an incomplete picture to the user.
   * For example, if asynchronous primitives are being processed in the
   * background, the clock will not advance until the geometry is ready.
   *
   * @memberof Viewer.prototype
   *
   * @type {boolean}
   */
  allowDataSourcesToSuspendAnimation: {
    get: function () {
      return this._cesiumWidget.allowDataSourcesToSuspendAnimation;
    },
    set: function (value) {
      this._cesiumWidget.allowDataSourcesToSuspendAnimation = value;
    },
  },

  /**
   * Gets or sets the Entity instance currently being tracked by the camera.
   * @memberof Viewer.prototype
   * @type {Entity | undefined}
   */
  trackedEntity: {
    get: function () {
      return this._cesiumWidget.trackedEntity;
    },
    set: function (value) {
      this._cesiumWidget.trackedEntity = value;
    },
  },
  /**
   * Gets or sets the object instance for which to display a selection indicator.
   *
   * If a user interactively picks a Cesium3DTilesFeature instance, then this property
   * will contain a transient Entity instance with a property named "feature" that is
   * 被选择的实体实例。
   * @memberof Viewer.prototype
   * @type {Entity | undefined}
   */
  selectedEntity: {
    get: function () {
      return this._selectedEntity;
    },
    set: function (value) {
      if (this._selectedEntity !== value) {
        this._selectedEntity = value;
        const selectionIndicatorViewModel = defined(this._selectionIndicator)
          ? this._selectionIndicator.viewModel
          : undefined;
        if (defined(value)) {
          if (defined(selectionIndicatorViewModel)) {
            selectionIndicatorViewModel.animateAppear();
          }
        } else if (defined(selectionIndicatorViewModel)) {
          // Leave the info text in place here, it is needed during the exit animation.
          selectionIndicatorViewModel.animateDepart();
        }
        this._selectedEntityChanged.raiseEvent(value);
      }
    },
  },
  /**
   * 获取选中实体发生变化时引发的事件。
   * @memberof Viewer.prototype
   * @type {Event}
   * @readonly
   */
  selectedEntityChanged: {
    get: function () {
      return this._selectedEntityChanged;
    },
  },
  /**
   * 获取被跟踪实体发生变化时引发的事件。
   * @memberof Viewer.prototype
   * @type {Event}
   * @readonly
   */
  trackedEntityChanged: {
    get: function () {
      return this._cesiumWidget.trackedEntityChanged;
    },
  },
  /**
   * 获取或设置与查看器时钟同步的跟踪数据源。
   * @memberof Viewer.prototype
   * @type {DataSource}
   */
  clockTrackedDataSource: {
    get: function () {
      return this._cesiumWidget.clockTrackedDataSource;
    },
    set: function (value) {
      if (this._cesiumWidget.clockTrackedDataSource !== value) {
        this._cesiumWidget.clockTrackedDataSource = value;
        linkTimelineToDataSourceClock(this._timeline, value);
      }
    },
  },
});

/**
 * 通过提供的混合类扩展基础查看器功能。
 * 混合类可能添加额外的属性、函数或其他行为
 * 到提供的查看器实例中。
 *
 * @param {Viewer.ViewerMixin} mixin 要添加到此实例的查看器混合类。
 * @param {object} [options] 要传递给混合类的选项对象。
 *
 * @see viewerDragDropMixin
 */
Viewer.prototype.extend = function (mixin, options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(mixin)) {
    throw new DeveloperError("mixin is required.");
  }
  //>>includeEnd('debug');

  mixin(this, options);
};

/**
 * 调整控件大小以匹配容器大小。
 * 此函数会在需要时自动调用，除非
 * <code>useDefaultRenderLoop</code> 被设置为 false。
 */
Viewer.prototype.resize = function () {
  const cesiumWidget = this._cesiumWidget;
  const container = this._container;
  const width = container.clientWidth;
  const height = container.clientHeight;
  const animationExists = defined(this._animation);
  const timelineExists = defined(this._timeline);

  cesiumWidget.resize();

  if (width === this._lastWidth && height === this._lastHeight) {
    return;
  }

  const panelMaxHeight = height - 125;
  const baseLayerPickerDropDown = this._baseLayerPickerDropDown;

  if (defined(baseLayerPickerDropDown)) {
    baseLayerPickerDropDown.style.maxHeight = `${panelMaxHeight}px`;
  }

  if (defined(this._geocoder)) {
    const geocoderSuggestions = this._geocoder.searchSuggestionsContainer;
    geocoderSuggestions.style.maxHeight = `${panelMaxHeight}px`;
  }

  if (defined(this._infoBox)) {
    this._infoBox.viewModel.maxHeight = panelMaxHeight;
  }

  const timeline = this._timeline;
  let animationContainer;
  let animationWidth = 0;
  let creditLeft = 5;
  let creditBottom = 3;
  let creditRight = 0;

  if (
    animationExists &&
    window.getComputedStyle(this._animation.container).visibility !== "hidden"
  ) {
    const lastWidth = this._lastWidth;
    animationContainer = this._animation.container;
    if (width > 900) {
      animationWidth = 169;
      if (lastWidth <= 900) {
        animationContainer.style.width = "169px";
        animationContainer.style.height = "112px";
        this._animation.resize();
      }
    } else if (width >= 600) {
      animationWidth = 136;
      if (lastWidth < 600 || lastWidth > 900) {
        animationContainer.style.width = "136px";
        animationContainer.style.height = "90px";
        this._animation.resize();
      }
    } else {
      animationWidth = 106;
      if (lastWidth > 600 || lastWidth === 0) {
        animationContainer.style.width = "106px";
        animationContainer.style.height = "70px";
        this._animation.resize();
      }
    }
    creditLeft = animationWidth + 5;
  }

  if (
    timelineExists &&
    window.getComputedStyle(this._timeline.container).visibility !== "hidden"
  ) {
    const fullscreenButton = this._fullscreenButton;
    const vrButton = this._vrButton;
    const timelineContainer = timeline.container;
    const timelineStyle = timelineContainer.style;

    creditBottom = timelineContainer.clientHeight + 3;
    timelineStyle.left = `${animationWidth}px`;

    let pixels = 0;
    if (defined(fullscreenButton)) {
      pixels += fullscreenButton.container.clientWidth;
    }
    if (defined(vrButton)) {
      pixels += vrButton.container.clientWidth;
    }

    timelineStyle.right = `${pixels}px`;
    timeline.resize();
  }

  if (!timelineExists && defined(this._fullscreenButton)) {
    // don't let long credits (like the default ion token) go behind the fullscreen button
    creditRight = this._fullscreenButton.container.clientWidth;
  }

  this._bottomContainer.style.left = `${creditLeft}px`;
  this._bottomContainer.style.bottom = `${creditBottom}px`;
  this._bottomContainer.style.right = `${creditRight}px`;

  this._lastWidth = width;
  this._lastHeight = height;
};

/**
 * 这会迫使控件重新考虑其布局，包括
 * 控件大小和徽标位置。
 */
Viewer.prototype.forceResize = function () {
  this._lastWidth = 0;
  this.resize();
};

/**
 * 渲染场景。此函数会在需要时自动调用
 * 除非 <code>useDefaultRenderLoop</code> 被设置为 false；
 */
Viewer.prototype.render = function () {
  this._cesiumWidget.render();
};

/**
 * @returns {boolean} true 如果对象已被销毁，否则返回 false。
 */
Viewer.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁控件。如果永久
 * 从布局中移除控件，则应调用此函数。
 */
Viewer.prototype.destroy = function () {
  if (
    defined(this.screenSpaceEventHandler) &&
    !this.screenSpaceEventHandler.isDestroyed()
  ) {
    this.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
  }

  this._container.removeChild(this._element);
  this._element.removeChild(this._toolbar);

  this._eventHelper.removeAll();

  if (defined(this._geocoder)) {
    this._geocoder = this._geocoder.destroy();
  }

  if (defined(this._homeButton)) {
    this._homeButton = this._homeButton.destroy();
  }

  if (defined(this._sceneModePicker)) {
    this._sceneModePicker = this._sceneModePicker.destroy();
  }

  if (defined(this._projectionPicker)) {
    this._projectionPicker = this._projectionPicker.destroy();
  }

  if (defined(this._baseLayerPicker)) {
    this._baseLayerPicker = this._baseLayerPicker.destroy();
  }

  if (defined(this._animation)) {
    this._element.removeChild(this._animation.container);
    this._animation = this._animation.destroy();
  }

  if (defined(this._timeline)) {
    this._timeline.removeEventListener(
      "settime",
      onTimelineScrubfunction,
      false,
    );
    this._element.removeChild(this._timeline.container);
    this._timeline = this._timeline.destroy();
  }

  if (defined(this._fullscreenButton)) {
    this._fullscreenSubscription.dispose();
    this._element.removeChild(this._fullscreenButton.container);
    this._fullscreenButton = this._fullscreenButton.destroy();
  }

  if (defined(this._vrButton)) {
    this._vrSubscription.dispose();
    this._vrModeSubscription.dispose();
    this._element.removeChild(this._vrButton.container);
    this._vrButton = this._vrButton.destroy();
  }

  if (defined(this._infoBox)) {
    this._element.removeChild(this._infoBox.container);
    this._infoBox = this._infoBox.destroy();
  }

  if (defined(this._selectionIndicator)) {
    this._element.removeChild(this._selectionIndicator.container);
    this._selectionIndicator = this._selectionIndicator.destroy();
  }

  if (this._destroyClockViewModel) {
    this._clockViewModel = this._clockViewModel.destroy();
  }
  this._cesiumWidget = this._cesiumWidget.destroy();

  return destroyObject(this);
};

/**
 * @private
 */
Viewer.prototype._dataSourceAdded = function (
  dataSourceCollection,
  dataSource,
) {
  const entityCollection = dataSource.entities;
  entityCollection.collectionChanged.addEventListener(
    Viewer.prototype._onEntityCollectionChanged,
    this,
  );
};

/**
 * @private
 */
Viewer.prototype._dataSourceRemoved = function (
  dataSourceCollection,
  dataSource,
) {
  const entityCollection = dataSource.entities;
  entityCollection.collectionChanged.removeEventListener(
    Viewer.prototype._onEntityCollectionChanged,
    this,
  );

  if (defined(this.selectedEntity)) {
    if (
      entityCollection.getById(this.selectedEntity.id) === this.selectedEntity
    ) {
      this.selectedEntity = undefined;
    }
  }
};

/**
 * @private
 */
Viewer.prototype._updateCanAnimate = function (that) {
  return function (isUpdated) {
    that._clockViewModel.canAnimate = isUpdated;
  };
};

/**
 * @private
 */
Viewer.prototype._onTick = function (clock) {
  const time = clock.currentTime;

  let position;
  let enableCamera = false;
  const selectedEntity = this.selectedEntity;
  const showSelection = defined(selectedEntity) && this._enableInfoOrSelection;

  if (
    showSelection &&
    selectedEntity.isShowing &&
    selectedEntity.isAvailable(time)
  ) {
    const state = this._cesiumWidget.dataSourceDisplay.getBoundingSphere(
      selectedEntity,
      true,
      boundingSphereScratch,
    );
    if (state !== BoundingSphereState.FAILED) {
      position = boundingSphereScratch.center;
    } else if (defined(selectedEntity.position)) {
      position = selectedEntity.position.getValue(time, position);
    }
    enableCamera = defined(position);
  }

  const selectionIndicatorViewModel = defined(this._selectionIndicator)
    ? this._selectionIndicator.viewModel
    : undefined;
  if (defined(selectionIndicatorViewModel)) {
    selectionIndicatorViewModel.position = Cartesian3.clone(
      position,
      selectionIndicatorViewModel.position,
    );
    selectionIndicatorViewModel.showSelection = showSelection && enableCamera;
    selectionIndicatorViewModel.update();
  }

  const infoBoxViewModel = defined(this._infoBox)
    ? this._infoBox.viewModel
    : undefined;
  if (defined(infoBoxViewModel)) {
    infoBoxViewModel.showInfo = showSelection;
    infoBoxViewModel.enableCamera = enableCamera;
    infoBoxViewModel.isCameraTracking =
      this.trackedEntity === this.selectedEntity;

    if (showSelection) {
      infoBoxViewModel.titleText = selectedEntity.name ?? selectedEntity.id;
      infoBoxViewModel.description = Property.getValueOrDefault(
        selectedEntity.description,
        time,
        "",
      );
    } else {
      infoBoxViewModel.titleText = "";
      infoBoxViewModel.description = "";
    }
  }
};

/**
 * @private
 */
Viewer.prototype._onEntityCollectionChanged = function (
  collection,
  added,
  removed,
) {
  const length = removed.length;
  for (let i = 0; i < length; i++) {
    const removedObject = removed[i];
    if (this.selectedEntity === removedObject) {
      this.selectedEntity = undefined;
    }
  }
};

/**
 * @private
 */
Viewer.prototype._onInfoBoxCameraClicked = function (infoBoxViewModel) {
  if (
    infoBoxViewModel.isCameraTracking &&
    this.trackedEntity === this.selectedEntity
  ) {
    this.trackedEntity = undefined;
  } else {
    const selectedEntity = this.selectedEntity;
    const position = selectedEntity.position;
    if (defined(position)) {
      this.trackedEntity = this.selectedEntity;
    } else {
      this.zoomTo(this.selectedEntity);
    }
  }
};

/**
 * @private
 */
Viewer.prototype._clearTrackedObject = function () {
  this.trackedEntity = undefined;
};

/**
 * @private
 */
Viewer.prototype._onInfoBoxClockClicked = function (infoBoxViewModel) {
  this.selectedEntity = undefined;
};

/**
 * @private
 */
Viewer.prototype._clearObjects = function () {
  this.trackedEntity = undefined;
  this.selectedEntity = undefined;
};

/**
 * @private
 */
Viewer.prototype._onDataSourceChanged = function (dataSource) {
  if (this.clockTrackedDataSource === dataSource) {
    linkTimelineToDataSourceClock(this.timeline, dataSource);
  }
};

/**
 * @private
 */
Viewer.prototype._onDataSourceAdded = function (
  dataSourceCollection,
  dataSource,
) {
  if (
    this._cesiumWidget._automaticallyTrackDataSourceClocks &&
    dataSource === this.clockTrackedDataSource
  ) {
    // When data sources are added to the CesiumWidget they may be automatically
    // tracked in that class but we also need to update the timeline in this class
    linkTimelineToDataSourceClock(this._timeline, dataSource);
  }
  const id = dataSource.entities.id;
  const removalFunc = this._eventHelper.add(
    dataSource.changedEvent,
    Viewer.prototype._onDataSourceChanged,
    this,
  );
  this._dataSourceChangedListeners[id] = removalFunc;
};

/**
 * @private
 */
Viewer.prototype._onDataSourceRemoved = function (
  dataSourceCollection,
  dataSource,
) {
  const id = dataSource.entities.id;
  this._dataSourceChangedListeners[id]();
  this._dataSourceChangedListeners[id] = undefined;
};

/**
 * 向查看器场景中添加控制器——即 {@link Controller} 接口的实现，用于处理输入事件、相机动画和其他交互。
 * @param {Controller} controller <code>Controller</code> 接口的实现。
 * @example
 * viewer.scene.screenSpaceCameraController.enableInputs = false;
 * viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
 *
 * const tiltOrbitController = new Cesium.ScreenSpaceTiltOrbitCameraController();
 * viewer.addController(tiltOrbitController);
 */
Viewer.prototype.addController = function (controller) {
  return this._cesiumWidget.addController(controller);
};

/**
 * 从查看器场景中移除控制器——即 {@link Controller} 接口的实现，用于处理输入事件、相机动画和其他交互。
 * @param {Controller} controller <code>Controller</code> 接口的实现。
 * @example
 * viewer.removeController(tiltOrbitController);
 */
Viewer.prototype.removeController = function (controller) {
  return this._cesiumWidget.removeController(controller);
};

/**
 * 异步设置相机以查看提供的实体、实体或数据源。
 * 如果数据源仍在加载中或可视化过程仍在进行中，
 * 此方法会在数据准备就绪后执行缩放操作。
 *
 * <p>偏移量是在以边界球中心为原点的本地东北上坐标系中的航向/俯仰/范围。
 * 航向和俯仰角度定义在本地东北上坐标系中。
 * 航向是从 y 轴开始向 x 轴方向增加的角度。俯仰是从 xy 平面开始的旋转角度。正俯仰值
 * 角度位于平面之上。负俯仰角位于平面之下。范围是指距中心的距离。如果范围为
 * 零，则计算一个范围，使得整个边界球体都能被看到。</p>
 *
 * <p>在二维中，必须有一个从上方的视角。相机将置于目标上方向下观察的位置。高于目标的高度即为范围。方向角由偏移量决定。如果无法从偏移量确定方向角，
 * 则方向角为北向。</p>
 * 要查看的实体、实体数组、实体集合、数据源、Cesium3DTileset、点云或影像图层。您也可以传递一个承诺，其结果为上述类型之一。</p>
 *
 * @param {Entity|Entity[]|EntityCollection|DataSource|ImageryLayer|Cesium3DTileset|TimeDynamicPointCloud|Promise<Entity|Entity[]|EntityCollection|DataSource|ImageryLayer|Cesium3DTileset|TimeDynamicPointCloud|VoxelPrimitive|BufferPrimitiveCollection<BufferPrimitive>>} target 实体、实体数组、实体集合、数据源、Cesium3DTileset、点云或影像图层。您也可以传递一个承诺，其结果为上述类型之一。</p>
 * @param {HeadingPitchRange} [offset] 在本地东北上参考框架中，距实体的中心偏移量。</p>
 * @returns {Promise<boolean>} A 如果缩放成功则返回 true，如果目标当前未在场景中可视化或缩放被取消则返回 false 的承诺。</p>
 */
Viewer.prototype.zoomTo = function (target, offset) {
  return this._cesiumWidget.zoomTo(target, offset);
};

/**
 * 将相机飞向提供的实体、实体或数据源。</p>
 * 如果数据源仍在加载中或可视化过程仍在进行中，
 * 该方法会在数据准备就绪后执行飞行操作。</p>
 *
 * <p>偏移量是在以边界球中心为原点的本地东北上参考框架中的方向角/俯仰角/范围。</p>
 * 方向角和俯仰角均在本地东北上参考框架中定义。</p>
 * 方向角是从 y 轴开始向 x 轴增加的角度。俯仰角是相对于 xy 平面的旋转角度。正俯仰角
 * 位于平面之上。负俯仰角位于平面之下。范围是指距中心的距离。如果范围为
 * 零，则计算一个范围，使得整个边界球体都能被看到。</p>
 *
 * <p>在二维中，必须有一个从上方的视角。相机将置于目标上方向下观察的位置。高于目标的高度即为范围。方向角由偏移量决定。如果无法从偏移量确定方向角，
 * 则方向角为北向。</p>
 * 若无法从偏移量确定方向角，则方向角为北向。</p>
 *
 * @param {Entity|Entity[]|EntityCollection|DataSource|ImageryLayer|Cesium3DTileset|TimeDynamicPointCloud|Promise<Entity|Entity[]|EntityCollection|DataSource|ImageryLayer|Cesium3DTileset|TimeDynamicPointCloud|VoxelPrimitive|BufferPrimitiveCollection<BufferPrimitive>>} target 要查看的实体、实体数组、实体集合、数据源、Cesium3DTileset、点云或影像图层。您也可以传递一个承诺，其结果为上述类型之一。</p>
 * @param {object} [options] 具有以下属性的对象：
 * @param {number} [options.duration=3.0] 飞行持续时间，单位：秒。
 * @param {number} [options.maximumHeight] 飞行高峰时的最大高度。
 * @param {HeadingPitchRange} [options.offset] 以目标为中心、东-北-上坐标系下的与目标之间的偏移量。
 * @returns {Promise<boolean>} A 如果飞行成功则返回 true，如果目标当前未在场景中显示或飞行被取消则返回 false。 //TODO: 清理实体相关表述
 */
Viewer.prototype.flyTo = function (target, options) {
  return this._cesiumWidget.flyTo(target, options);
};

/**
 * 一个为 Viewer 实例添加额外功能的函数。
 * @callback Viewer.ViewerMixin
 * @param {Viewer} viewer Viewer 实例本身。
 * @param {object} options 传递给混合器函数的选项对象。
 *
 * @see Viewer#extend
 */
export default Viewer;
