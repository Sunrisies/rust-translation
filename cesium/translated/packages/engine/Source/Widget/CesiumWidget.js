import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Clock,
  DeveloperError,
  Ellipsoid,
  Event,
  EventHelper,
  Frozen,
  HeadingPitchRange,
  Matrix4,
  defined,
  destroyObject,
  formatError,
} from "@cesium/core";
import FeatureDetection from "../Core/FeatureDetection.js";
import BoundingSphereState from "../DataSources/BoundingSphereState.js";
import DataSourceCollection from "../DataSources/DataSourceCollection.js";
import DataSourceDisplay from "../DataSources/DataSourceDisplay.js";
import EntityView from "../DataSources/EntityView.js";
import getElement from "../DataSources/getElement.js";
import Property from "../DataSources/Property.js";
import Cesium3DTileset from "../Scene/Cesium3DTileset.js";
import computeFlyToLocationForRectangle from "../Scene/computeFlyToLocationForRectangle.js";
import Globe from "../Scene/Globe.js";
import ImageryLayer from "../Scene/ImageryLayer.js";
import Moon from "../Scene/Moon.js";
import Scene from "../Scene/Scene.js";
import SceneMode from "../Scene/SceneMode.js";
import ScreenSpaceEventHandler from "../Core/ScreenSpaceEventHandler.js";
import ShadowMode from "../Scene/ShadowMode.js";
import SkyAtmosphere from "../Scene/SkyAtmosphere.js";
import SkyBox from "../Scene/SkyBox.js";
import Sun from "../Scene/Sun.js";
import TimeDynamicPointCloud from "../Scene/TimeDynamicPointCloud.js";
import VoxelPrimitive from "../Scene/VoxelPrimitive.js";
import BufferPrimitiveCollection from "../Scene/BufferPrimitiveCollection.js";

function trackDataSourceClock(clock, dataSource) {
  if (defined(dataSource)) {
    const dataSourceClock = dataSource.clock;
    if (defined(dataSourceClock)) {
      dataSourceClock.getValue(clock);
    }
  }
}

function startRenderLoop(widget) {
  widget._renderLoopRunning = true;

  let lastFrameTime = 0;
  function render(frameTime) {
    if (widget.isDestroyed()) {
      return;
    }

    if (widget._useDefaultRenderLoop) {
      try {
        const targetFrameRate = widget._targetFrameRate;
        if (!defined(targetFrameRate)) {
          widget.resize();
          widget.render();
          requestAnimationFrame(render);
        } else {
          const interval = 1000.0 / targetFrameRate;
          const delta = frameTime - lastFrameTime;

          if (delta > interval) {
            widget.resize();
            widget.render();
            lastFrameTime = frameTime - (delta % interval);
          }
          requestAnimationFrame(render);
        }
      } catch (error) {
        widget._useDefaultRenderLoop = false;
        widget._renderLoopRunning = false;
        if (widget._showRenderLoopErrors) {
          const title =
            "An error occurred while rendering.  Rendering has stopped.";
          widget.showErrorPanel(title, undefined, error);
        }
      }
    } else {
      widget._renderLoopRunning = false;
    }
  }

  requestAnimationFrame(render);
}

function configurePixelRatio(widget) {
  let pixelRatio = widget._useBrowserRecommendedResolution
    ? 1.0
    : window.devicePixelRatio;
  pixelRatio *= widget._resolutionScale;
  if (defined(widget._scene)) {
    widget._scene.pixelRatio = pixelRatio;
  }

  return pixelRatio;
}

function configureCanvasSize(widget) {
  const canvas = widget._canvas;
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  const pixelRatio = configurePixelRatio(widget);

  widget._canvasClientWidth = width;
  widget._canvasClientHeight = height;

  width *= pixelRatio;
  height *= pixelRatio;

  canvas.width = width;
  canvas.height = height;

  widget._canRender = width !== 0 && height !== 0;
  widget._lastDevicePixelRatio = window.devicePixelRatio;
}

function configureCameraFrustum(widget) {
  const canvas = widget._canvas;
  const width = canvas.width;
  const height = canvas.height;
  if (width !== 0 && height !== 0) {
    const frustum = widget._scene.camera.frustum;
    if (defined(frustum.aspectRatio)) {
      frustum.aspectRatio = width / height;
    } else {
      frustum.top = frustum.right * (height / width);
      frustum.bottom = -frustum.top;
    }
  }
}

/**
 * 一个包含 Cesium 场景的控件。
 *
 * @alias CesiumWidget
 * @constructor
 *
 * @param {Element|string} container 将包含该控件의 DOM 元素或 ID。
 * @param {object} [options] 具有以下属性的对象：
 * @param {Clock} [options.clock=new Clock()] 用于控制当前时间的时钟。
 * @param {boolean} [options.shouldAnimate=false] 如果应默认尝试推进模拟时间，则输出 <code>true</code>，否则输出 <code>false</code>。
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default] 默认椭球体。
 * @param {ImageryLayer|false} [options.baseLayer=ImageryLayer.fromWorldImagery()] 应用于地球仪的最底部影像图层。如果设置为 <code>false</code>，则不会添加任何影像提供器。
 * @param {TerrainProvider} [options.terrainProvider=new EllipsoidTerrainProvider(options.ellipsoid)] 地形提供器。
 * @param {Terrain} [options.terrain] 处理异步地形提供器的地形对象。只能指定 <code>options.terrainProvider</code> 未定义的情况。
 * @param {SkyBox| false} [options.skyBox] 用于渲染星星的天空盒。当设置为 <code>undefined</code> 且使用 WGS84 椭球体时，使用默认星星。如果设置为 <code>false</code>，则不会添加天空盒、太阳或月亮。
 * @param {SkyAtmosphere | false} [options.skyAtmosphere] 蓝色天空及地球边缘的辉光。当使用默认椭球体时启用。设置为 <code>false</code> 可关闭此功能。
 * @param {SceneMode} [options.sceneMode=SceneMode.SCENE3D] 初始场景模式。
 * @param {boolean} [options.scene3DOnly=false] 如果为 <code>true</code>，每个几何实例仅以 3D 形式渲染以节省 GPU 内存。
 * @param {boolean} [options.orderIndependentTranslucency=true] 如果为 true 且配置支持，则使用顺序无关的半透明效果。
 * @param {MapProjection} [options.mapProjection=new GeographicProjection(options.ellipsoid)] 在 2D 和 Columbus View 模式下使用的地图投影。
 * @param {Globe | false} [options.globe=new Globe(options.ellipsoid)] 场景中使用的地球仪。如果设置为 <code>false</code>，则不会添加地球仪，并且默认隐藏天空大气层。
 * @param {boolean} [options.useDefaultRenderLoop=true] 如果此控件应控制渲染循环，则输出 true，否则输出 false。
 * @param {boolean} [options.useBrowserRecommendedResolution=true] 如果为 true，则按浏览器推荐的分辨率进行渲染，并忽略 <code>window.devicePixelRatio</code>。
 * @param {number} [options.targetFrameRate] 使用默认渲染循环时的目标帧率。
 * @param {boolean} [options.showRenderLoopErrors=true] 如果为 true，当发生渲染循环错误时，此控件将自动向用户显示包含错误的 HTML 面板。
 * @param {boolean} [options.automaticallyTrackDataSourceClocks=true] 如果为 true，此控件将自动跟踪新添加的 DataSource 的时钟设置，并在 DataSource 的时钟发生变化时更新。如果要独立配置时钟，则设置为 <code>false</code>。
 * @param {ContextOptions} [options.contextOptions] 传递给 {@link Scene} 的上下文和 WebGL 创建属性。
 * @param {Element|string} [options.creditContainer] 将包含 {@link CreditDisplay} 的 DOM 元素或 ID。如果未指定，徽标将添加到控件本身的底部。
 * 将包含由 {@linkCreditDisplay} 创建的徽标弹出窗口的 DOM 元素或 ID。如果未指定，该窗口将出现在控件本身之上。
 * @param {Element|string} [options.creditViewport] 由该控件可视化的数据源集合。如果提供此参数，则...
 * @param {DataSourceCollection} [options.dataSources=new DataSourceCollection()] The collection of data sources visualized by the widget.  If this parameter is provided,
 * 该实例假定由调用者拥有，在控件被销毁时不会被销毁。
 * @param {boolean} [options.shadows=false] 确定阴影是否由光源产生。
 * @param {ShadowMode} [options.terrainShadows=ShadowMode.RECEIVE_ONLY] 确定地形是向光源投射阴影还是接收阴影。
 * @param {MapMode2D} [options.mapMode2D=MapMode2D.INFINITE_SCROLL] 确定2D地图是否可以旋转或在水平方向上无限滚动。
 * @param {boolean} [options.blurActiveElementOnCanvasFocus=true] 如果为true，当点击控件的画布时，活动元素会模糊。将此值设为false在仅点击画布以检索位置或实体数据而不实际将画布设置为活动元素时非常有用。
 * @param {boolean} [options.requestRenderMode=false] 如果为true，渲染帧仅在根据场景中的变化需要时发生。启用此功能可提升应用程序性能，但需要在这种模式下使用 {@link Scene#requestRender} 显式地渲染新帧。在API的其他部分对场景进行更改后，许多情况下都需要这样做。请参阅 {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}。
 * @param {number} [options.maximumRenderTimeChange=0.0] 如果requestRenderMode为true，此值定义了请求渲染前允许的最大模拟时间变化量。请参阅 {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/|Improving Performance with Explicit Rendering}。
 * @param {number} [options.msaaSamples=4] 如果提供，此值控制多样本抗锯齿的速率。典型的多样本采样率为每像素2、4或有时8个样本。更高的MSAA采样率可能会因提升视觉质量而影响性能。此值仅适用于支持多样本渲染目标的WebGL2上下文。设置为1可禁用MSAA。
 *
 * @exception {DeveloperError} Element id为"container"的控件在文档中不存在。
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=cesium-widget|Cesium Sandcastle Cesium Widget Demo}
 *
 * @example
 * // 对于每个示例，在HTML头部中包含指向CesiumWidget.css样式的链接，
 * // 并在主体中包含：<div id="cesiumContainer"></div>
 *
 * // 没有地形且使用默认Bing Maps影像提供商的控件。
 * const widget = new Cesium.CesiumWidget("cesiumContainer");
 *
 * // 使用离子影像和Cesium World Terrain的控件。
 * const widget2 = new Cesium.CesiumWidget("cesiumContainer", {
 * baseLayer: Cesium.ImageryLayer.fromWorldTerrain(),
 * terrain: Cesium.Terrain.fromWorldTerrain()
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
 * // 显示采用Web Mercator投影的Columbus View地图
 * sceneMode: Cesium.SceneMode.COLUMBUS_VIEW,
 * mapProjection: new Cesium.WebMercatorProjection()
 * });
 */
function CesiumWidget(container, options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(container)) {
    throw new DeveloperError("container is required.");
  }
  //>>includeEnd('debug');

  container = getElement(container);

  options = options ?? Frozen.EMPTY_OBJECT;

  //Configure the widget DOM elements
  const element = document.createElement("div");
  element.className = "cesium-widget";
  container.appendChild(element);

  const canvas = document.createElement("canvas");
  const supportsImageRenderingPixelated =
    FeatureDetection.supportsImageRenderingPixelated();
  this._supportsImageRenderingPixelated = supportsImageRenderingPixelated;
  if (supportsImageRenderingPixelated) {
    canvas.style.imageRendering = FeatureDetection.imageRenderingValue();
  }

  canvas.oncontextmenu = function () {
    return false;
  };
  canvas.onselectstart = function () {
    return false;
  };

  // Interacting with a canvas does not automatically blur the previously focused element.
  // This leads to unexpected interaction if the last element was an input field.
  // For example, clicking the mouse wheel could lead to the value in  the field changing
  // unexpectedly. The solution is to blur whatever has focus as soon as canvas interaction begins.
  // Although in some cases the active element needs to stay active even after interacting with the canvas,
  // for example when clicking on it only for getting the data of a clicked position or an entity.
  // For this case, the `blurActiveElementOnCanvasFocus` can be passed with false to avoid blurring
  // the active element after interacting with the canvas.
  function blurActiveElement() {
    if (canvas !== canvas.ownerDocument.activeElement) {
      canvas.ownerDocument.activeElement.blur();
    }
  }

  const blurActiveElementOnCanvasFocus =
    options.blurActiveElementOnCanvasFocus ?? true;

  if (blurActiveElementOnCanvasFocus) {
    canvas.addEventListener("mousedown", blurActiveElement);
    canvas.addEventListener("pointerdown", blurActiveElement);
  }

  element.appendChild(canvas);

  const innerCreditContainer = document.createElement("div");
  innerCreditContainer.className = "cesium-widget-credits";

  const creditContainer = defined(options.creditContainer)
    ? getElement(options.creditContainer)
    : element;
  creditContainer.appendChild(innerCreditContainer);

  const creditViewport = defined(options.creditViewport)
    ? getElement(options.creditViewport)
    : element;

  const showRenderLoopErrors = options.showRenderLoopErrors ?? true;

  const useBrowserRecommendedResolution =
    options.useBrowserRecommendedResolution ?? true;

  this._element = element;
  this._container = container;
  this._canvas = canvas;
  this._canvasClientWidth = 0;
  this._canvasClientHeight = 0;
  this._lastDevicePixelRatio = 0;
  this._creditViewport = creditViewport;
  this._creditContainer = creditContainer;
  this._innerCreditContainer = innerCreditContainer;
  this._canRender = false;
  this._renderLoopRunning = false;
  this._showRenderLoopErrors = showRenderLoopErrors;
  this._resolutionScale = 1.0;
  this._useBrowserRecommendedResolution = useBrowserRecommendedResolution;
  this._forceResize = false;
  this._entityView = undefined;
  this._clockTrackedDataSource = undefined;
  this._trackedEntity = undefined;
  this._needTrackedEntityUpdate = false;
  this._zoomIsFlight = false;
  this._zoomTarget = undefined;
  this._zoomPromise = undefined;
  this._zoomOptions = undefined;
  this._trackedEntityChanged = new Event();
  this._allowDataSourcesToSuspendAnimation = true;

  this._clock = defined(options.clock) ? options.clock : new Clock();

  if (defined(options.shouldAnimate)) {
    this._clock.shouldAnimate = options.shouldAnimate;
  }

  configureCanvasSize(this);

  try {
    const ellipsoid = options.ellipsoid ?? Ellipsoid.default;

    const scene = new Scene({
      canvas: canvas,
      contextOptions: options.contextOptions,
      creditContainer: innerCreditContainer,
      creditViewport: creditViewport,
      ellipsoid: ellipsoid,
      mapProjection: options.mapProjection,
      orderIndependentTranslucency: options.orderIndependentTranslucency,
      scene3DOnly: options.scene3DOnly ?? false,
      shadows: options.shadows,
      mapMode2D: options.mapMode2D,
      requestRenderMode: options.requestRenderMode,
      maximumRenderTimeChange: options.maximumRenderTimeChange,
      depthPlaneEllipsoidOffset: options.depthPlaneEllipsoidOffset,
      msaaSamples: options.msaaSamples,
    });
    this._scene = scene;

    scene.camera.constrainedAxis = Cartesian3.UNIT_Z;

    configurePixelRatio(this);
    configureCameraFrustum(this);

    let globe = options.globe;
    if (!defined(globe)) {
      globe = new Globe(ellipsoid);
    }
    if (globe !== false) {
      scene.globe = globe;
      scene.globe.shadows = options.terrainShadows ?? ShadowMode.RECEIVE_ONLY;
    }

    let skyBox = options.skyBox;
    if (!defined(skyBox) && Ellipsoid.WGS84.equals(ellipsoid)) {
      skyBox = SkyBox.createEarthSkyBox();
    }
    if (skyBox !== false) {
      scene.skyBox = skyBox;
      scene.sun = new Sun();

      if (Ellipsoid.WGS84.equals(ellipsoid)) {
        scene.moon = new Moon();
      }
    }

    // Blue sky, and the glow around the Earth's limb.
    let skyAtmosphere = options.skyAtmosphere;
    if (!defined(skyAtmosphere) && Ellipsoid.WGS84.equals(ellipsoid)) {
      skyAtmosphere = new SkyAtmosphere(ellipsoid);
      skyAtmosphere.show = options.globe !== false && globe.show;
    }
    if (skyAtmosphere !== false) {
      scene.skyAtmosphere = skyAtmosphere;
    }

    // Set the base imagery layer
    let baseLayer = options.baseLayer;
    if (options.globe !== false && baseLayer !== false) {
      if (!defined(baseLayer)) {
        baseLayer = ImageryLayer.fromWorldImagery();
      }
      scene.imageryLayers.add(baseLayer);
    }

    // Set the terrain provider if one is provided.
    if (defined(options.terrainProvider) && options.globe !== false) {
      scene.terrainProvider = options.terrainProvider;
    }

    if (defined(options.terrain) && options.globe !== false) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(options.terrainProvider)) {
        throw new DeveloperError(
          "Specify either options.terrainProvider or options.terrain.",
        );
      }
      //>>includeEnd('debug');

      scene.setTerrain(options.terrain);
    }

    this._screenSpaceEventHandler = new ScreenSpaceEventHandler(canvas);

    if (defined(options.sceneMode)) {
      if (options.sceneMode === SceneMode.SCENE2D) {
        this._scene.morphTo2D(0);
      }
      if (options.sceneMode === SceneMode.COLUMBUS_VIEW) {
        this._scene.morphToColumbusView(0);
      }
    }

    this._useDefaultRenderLoop = undefined;
    this.useDefaultRenderLoop = options.useDefaultRenderLoop ?? true;

    this._targetFrameRate = undefined;
    this.targetFrameRate = options.targetFrameRate;

    const that = this;
    this._onRenderError = function (scene, error) {
      that._useDefaultRenderLoop = false;
      that._renderLoopRunning = false;
      if (that._showRenderLoopErrors) {
        const title =
          "An error occurred while rendering.  Rendering has stopped.";
        that.showErrorPanel(title, undefined, error);
      }
    };
    scene.renderError.addEventListener(this._onRenderError);

    let dataSourceCollection = options.dataSources;
    let destroyDataSourceCollection = false;
    if (!defined(dataSourceCollection)) {
      dataSourceCollection = new DataSourceCollection();
      destroyDataSourceCollection = true;
    }

    const dataSourceDisplay = new DataSourceDisplay({
      scene: scene,
      dataSourceCollection: dataSourceCollection,
    });

    const eventHelper = new EventHelper();
    this._dataSourceChangedListeners = {};
    this._automaticallyTrackDataSourceClocks =
      options.automaticallyTrackDataSourceClocks ?? true;

    this._dataSourceCollection = dataSourceCollection;
    this._destroyDataSourceCollection = destroyDataSourceCollection;
    this._dataSourceDisplay = dataSourceDisplay;
    this._eventHelper = eventHelper;
    this._canAnimateUpdateCallback = this._updateCanAnimate;

    eventHelper.add(this._clock.onTick, CesiumWidget.prototype._onTick, this);
    eventHelper.add(
      scene.morphStart,
      CesiumWidget.prototype._clearTrackedObject,
      this,
    );

    //Listen to data source events in order to track clock changes.
    eventHelper.add(
      dataSourceCollection.dataSourceAdded,
      CesiumWidget.prototype._onDataSourceAdded,
      this,
    );
    eventHelper.add(
      dataSourceCollection.dataSourceRemoved,
      CesiumWidget.prototype._onDataSourceRemoved,
      this,
    );

    eventHelper.add(scene.postRender, CesiumWidget.prototype._postRender, this);

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
      CesiumWidget.prototype._dataSourceAdded,
      this,
    );
    eventHelper.add(
      dataSourceCollection.dataSourceRemoved,
      CesiumWidget.prototype._dataSourceRemoved,
      this,
    );
  } catch (error) {
    if (showRenderLoopErrors) {
      const title = "Error constructing CesiumWidget.";
      const message =
        'Visit <a href="http://get.webgl.org">http://get.webgl.org</a> to verify that your web browser and hardware support WebGL.  Consider trying a different web browser or updating your video drivers.  Detailed error information is below:';
      this.showErrorPanel(title, message, error);
    }
    throw error;
  }
}

Object.defineProperties(CesiumWidget.prototype, {
  /**
   * 获取父容器。
   * @memberof CesiumWidget.prototype
   *
   * @type {Element}
   * @readonly
   */
  container: {
    get: function () {
      return this._container;
    },
  },

  /**
   * 获取画布。
   * @memberof CesiumWidget.prototype
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
   * 获取徽标容器。
   * @memberof CesiumWidget.prototype
   *
   * @type {Element}
   * @readonly
   */
  creditContainer: {
    get: function () {
      return this._creditContainer;
    },
  },

  /**
   * 获取徽标视口
   * @memberof CesiumWidget.prototype
   *
   * @type {Element}
   * @readonly
   */
  creditViewport: {
    get: function () {
      return this._creditViewport;
    },
  },

  /**
   * 获取场景。
   * @memberof CesiumWidget.prototype
   *
   * @type {Scene}
   * @readonly
   */
  scene: {
    get: function () {
      return this._scene;
    },
  },

  /**
   * 获取将在地球仪上渲染的影像图层集合。
   * @memberof CesiumWidget.prototype
   *
   * @type {ImageryLayerCollection}
   * @readonly
   */
  imageryLayers: {
    get: function () {
      return this._scene.imageryLayers;
    },
  },

  /**
   * 提供地球仪表面几何数据的地形提供器。
   * @memberof CesiumWidget.prototype
   *
   * @type {TerrainProvider}
   */
  terrainProvider: {
    get: function () {
      return this._scene.terrainProvider;
    },
    set: function (terrainProvider) {
      this._scene.terrainProvider = terrainProvider;
    },
  },

  /**
   * 管理在屏幕上和灯箱中显示的徽标列表。
   * @memberof CesiumWidget.prototype
   *
   * @type {CreditDisplay}
   */
  creditDisplay: {
    get: function () {
      return this._scene.frameState.creditDisplay;
    },
  },

  /**
   * 获取用于 {@link DataSource} 可视化的显示方式。
   * @memberof CesiumWidget.prototype
   * @type {DataSourceDisplay}
   * @readonly
   */
  dataSourceDisplay: {
    get: function () {
      return this._dataSourceDisplay;
    },
  },

  /**
   * 获取未绑定特定数据源的实体集合。
   * 这是通往 [dataSourceDisplay.defaultDataSource.entities]{@link CesiumWidget#dataSourceDisplay} 的快捷路径。
   * @memberof CesiumWidget.prototype
   * @type {EntityCollection}
   * @readonly
   */
  entities: {
    get: function () {
      return this._dataSourceDisplay.defaultDataSource.entities;
    },
  },

  /**
   * 获取要被可视化的 {@link DataSource} 实例集合。
   * @memberof CesiumWidget.prototype
   * @type {DataSourceCollection}
   * @readonly
   */
  dataSources: {
    get: function () {
      return this._dataSourceCollection;
    },
  },

  /**
   * 获取相机。
   * @memberof CesiumWidget.prototype
   *
   * @type {Camera}
   * @readonly
   */
  camera: {
    get: function () {
      return this._scene.camera;
    },
  },

  /**
   * 获取场景的默认椭球体。
   * @memberof CesiumWidget.prototype
   *
   * @type {Ellipsoid}
   * @readonly
   */
  ellipsoid: {
    get: function () {
      return this._scene.ellipsoid;
    },
  },

  /**
   * 获取时钟。
   * @memberof CesiumWidget.prototype
   *
   * @type {Clock}
   * @readonly
   */
  clock: {
    get: function () {
      return this._clock;
    },
  },

  /**
   * 获取屏幕空间事件处理器。
   * @memberof CesiumWidget.prototype
   *
   * @type {ScreenSpaceEventHandler}
   * @readonly
   */
  screenSpaceEventHandler: {
    get: function () {
      return this._screenSpaceEventHandler;
    },
  },

  /**
   * 在 <code>useDefaultRenderLoop</code> 为 true 时，获取或设置控件的目标帧率。如果未定义，浏览器中的 requestAnimationFrame 实现将确定帧率。如果已定义，该值必须大于0。高于底层 requestAnimationFrame 实现的值将无效。
   * 获取或设置此控件是否应控制渲染循环。
   * 如果为 true，控件将使用 requestAnimationFrame 进行
   * 渲染和控件调整，以及驱动模拟时钟。如果设置为 false，必须手动调用
   * @memberof CesiumWidget.prototype
   *
   * @type {number}
   */
  targetFrameRate: {
    get: function () {
      return this._targetFrameRate;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (value <= 0) {
        throw new DeveloperError(
          "targetFrameRate must be greater than 0, or undefined.",
        );
      }
      //>>includeEnd('debug');
      this._targetFrameRate = value;
    },
  },

  /**
   * <code>resize</code>、<code>render</code> 方法作为自定义渲染循环的一部分。如果在渲染过程中发生错误，{@link Scene}的
   * <code>renderError</code> 事件将被触发，此属性将设置为 false。必须在错误后将其设置回 true 以继续渲染。
   * 获取或设置渲染分辨率的缩放因子。小于1.0的值可以在较弱设备上提升性能，而大于1.0的值将以更高的分辨率渲染。
   * simulation clock. If set to false, you must manually call the
   * <code>resize</code>, <code>render</code> methods as part of a custom
   * render loop.  If an error occurs during rendering, {@link Scene}'s
   * <code>renderError</code> event will be raised and this property
   * will be set to false.  It must be set back to true to continue rendering
   * after the error.
   * @memberof CesiumWidget.prototype
   *
   * @type {boolean}
   */
  useDefaultRenderLoop: {
    get: function () {
      return this._useDefaultRenderLoop;
    },
    set: function (value) {
      if (this._useDefaultRenderLoop !== value) {
        this._useDefaultRenderLoop = value;
        if (value && !this._renderLoopRunning) {
          startRenderLoop(this);
        }
      }
    },
  },

  /**
   * Gets or sets a scaling factor for rendering resolution.  Values less than 1.0 can improve
   * performance on less powerful devices while values greater than 1.0 will render at a higher
   * 降低分辨率并缩小尺寸，从而提升视觉保真度。
   * 例如，如果控件的大小为 640x480，将此值设置为 0.5
   * 会导致场景以 320x240 的比例渲染，然后随着值的增加而放大。
   * 将其设置为 2.0 会导致场景以 1280x960 的比例渲染，然后缩小。
   * @memberof CesiumWidget.prototype
   *
   * @type {number}
   * @default 1.0
   */
  resolutionScale: {
    get: function () {
      return this._resolutionScale;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (value <= 0) {
        throw new DeveloperError("resolutionScale must be greater than 0.");
      }
      //>>includeEnd('debug');
      if (this._resolutionScale !== value) {
        this._resolutionScale = value;
        this._forceResize = true;
      }
    },
  },

  /**
   * 布尔标志，指示是否使用浏览器推荐的分辨率。
   * 如果为 true，则忽略浏览器的设备像素比，使用 1.0，
   * 根据 CSS 像素而非设备像素进行渲染。这可以在像素密度较高的低性能设备上提升性能。当为 false 时，渲染
   * 将基于设备像素进行。 {@link CesiumWidget#resolutionScale} 仍然生效，无论
   * 此标志是 true 还是 false。
   * 获取或设置数据源是否可以暂时暂停
   * @memberof CesiumWidget.prototype
   *
   * @type {boolean}
   * @default true
   */
  useBrowserRecommendedResolution: {
    get: function () {
      return this._useBrowserRecommendedResolution;
    },
    set: function (value) {
      if (this._useBrowserRecommendedResolution !== value) {
        this._useBrowserRecommendedResolution = value;
        this._forceResize = true;
      }
    },
  },

  /**
   * 动画，以避免向用户展示不完整的画面。
   * 例如，如果在后台处理异步原语，
   * 时钟将不会前进，直到几何数据准备就绪。
   * 获取或设置当前被相机跟踪的实体实例。
   *
   * @memberof CesiumWidget.prototype
   *
   * @type {boolean}
   */
  allowDataSourcesToSuspendAnimation: {
    get: function () {
      return this._allowDataSourcesToSuspendAnimation;
    },
    set: function (value) {
      this._allowDataSourcesToSuspendAnimation = value;
    },
  },

  /**
   * 获取被跟踪实体发生变化时引发的事件。
   * @memberof CesiumWidget.prototype
   * @type {Entity | undefined}
   */
  trackedEntity: {
    get: function () {
      return this._trackedEntity;
    },
    set: function (value) {
      if (this._trackedEntity !== value) {
        this._trackedEntity = value;

        //Cancel any pending zoom
        cancelZoom(this);

        const scene = this.scene;
        const sceneMode = scene.mode;

        //Stop tracking
        if (!defined(value) || !defined(value.position)) {
          this._needTrackedEntityUpdate = false;
          if (
            sceneMode === SceneMode.COLUMBUS_VIEW ||
            sceneMode === SceneMode.SCENE2D
          ) {
            scene.screenSpaceCameraController.enableTranslate = true;
          }

          if (
            sceneMode === SceneMode.COLUMBUS_VIEW ||
            sceneMode === SceneMode.SCENE3D
          ) {
            scene.screenSpaceCameraController.enableTilt = true;
          }

          this._entityView = undefined;
          this.camera.lookAtTransform(Matrix4.IDENTITY);
        } else {
          //We can't start tracking immediately, so we set a flag and start tracking
          //when the bounding sphere is ready (most likely next frame).
          this._needTrackedEntityUpdate = true;
        }

        this._trackedEntityChanged.raiseEvent(value);
        this.scene.requestRender();
      }
    },
  },

  /**
   * 获取与控件时钟同步的跟踪数据源。
   * @memberof CesiumWidget.prototype
   * @type {Event}
   * @readonly
   */
  trackedEntityChanged: {
    get: function () {
      return this._trackedEntityChanged;
    },
  },

  /**
   * 向用户显示包含标题和更长错误信息的错误面板，
   * @memberof CesiumWidget.prototype
   * @type {DataSource}
   */
  clockTrackedDataSource: {
    get: function () {
      return this._clockTrackedDataSource;
    },
    set: function (value) {
      if (this._clockTrackedDataSource !== value) {
        this._clockTrackedDataSource = value;
        trackDataSourceClock(this.clock, value);
      }
    },
  },
});

/**
 * 可以使用 OK 按钮关闭该面板。当发生渲染循环错误时，如果 showRenderLoopErrors 不是 false，则自动显示此面板。
 * 该标题在错误面板中显示。此字符串被解释为文本。
 * 在详细错误信息显示之前，向用户显示的有用、面向用户的消息。此字符串被解释为 HTML。
 * 在错误面板中显示的错误信息。此字符串使用 {@link formatError} 格式化后作为文本显示。
 *
 * @param {string} title 错误面板上显示的标题。此字符串被解释为文本。
 * @param {string} [message] 在详细错误信息显示之前，向用户显示的有用提示信息。此字符串被解释为 HTML。
 * @param {string} [error] 在错误面板中显示的错误信息。此字符串使用 {@link formatError} 格式化后作为文本显示。
 */
CesiumWidget.prototype.showErrorPanel = function (title, message, error) {
  const element = this._element;
  const overlay = document.createElement("div");
  overlay.className = "cesium-widget-errorPanel";

  const content = document.createElement("div");
  content.className = "cesium-widget-errorPanel-content";
  overlay.appendChild(content);

  const errorHeader = document.createElement("div");
  errorHeader.className = "cesium-widget-errorPanel-header";
  errorHeader.appendChild(document.createTextNode(title));
  content.appendChild(errorHeader);

  const errorPanelScroller = document.createElement("div");
  errorPanelScroller.className = "cesium-widget-errorPanel-scroll";
  content.appendChild(errorPanelScroller);
  function resizeCallback() {
    errorPanelScroller.style.maxHeight = `${Math.max(
      Math.round(element.clientHeight * 0.9 - 100),
      30,
    )}px`;
  }
  resizeCallback();
  if (defined(window.addEventListener)) {
    window.addEventListener("resize", resizeCallback, false);
  }

  const hasMessage = defined(message);
  const hasError = defined(error);

  if (hasMessage || hasError) {
    const errorMessage = document.createElement("div");
    errorMessage.className = "cesium-widget-errorPanel-message";
    errorPanelScroller.appendChild(errorMessage);

    if (hasError) {
      let errorDetails = formatError(error);
      if (!hasMessage) {
        if (typeof error === "string") {
          error = new Error(error);
        }

        message = formatError({
          name: error.name,
          message: error.message,
        });
        errorDetails = error.stack;
      }

      //IE8 does not have a console object unless the dev tools are open.
      if (typeof console !== "undefined") {
        console.error(`${title}\n${message}\n${errorDetails}`);
      }

      const errorMessageDetails = document.createElement("div");
      errorMessageDetails.className =
        "cesium-widget-errorPanel-message-details collapsed";

      const moreDetails = document.createElement("span");
      moreDetails.className = "cesium-widget-errorPanel-more-details";
      moreDetails.appendChild(document.createTextNode("See more..."));
      errorMessageDetails.appendChild(moreDetails);

      errorMessageDetails.onclick = function (e) {
        errorMessageDetails.removeChild(moreDetails);
        errorMessageDetails.appendChild(document.createTextNode(errorDetails));
        errorMessageDetails.className =
          "cesium-widget-errorPanel-message-details";
        content.className = "cesium-widget-errorPanel-content expanded";
        errorMessageDetails.onclick = undefined;
      };

      errorPanelScroller.appendChild(errorMessageDetails);
    }

    errorMessage.innerHTML = `<p>${message}</p>`;
  }

  const buttonPanel = document.createElement("div");
  buttonPanel.className = "cesium-widget-errorPanel-buttonPanel";
  content.appendChild(buttonPanel);

  const okButton = document.createElement("button");
  okButton.setAttribute("type", "button");
  okButton.className = "cesium-button";
  okButton.appendChild(document.createTextNode("OK"));
  okButton.onclick = function () {
    if (defined(resizeCallback) && defined(window.removeEventListener)) {
      window.removeEventListener("resize", resizeCallback, false);
    }
    element.removeChild(overlay);
  };

  buttonPanel.appendChild(okButton);

  element.appendChild(overlay);
};

/**
 * @returns {boolean} true 如果对象已被销毁，则为 false，否则为 true。
 */
CesiumWidget.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁控件。如果需要永久移除控件，应调用此函数。
 * 将控件从布局中移除。
 */
CesiumWidget.prototype.destroy = function () {
  // Unsubscribe from data sources
  const dataSources = this.dataSources;
  const dataSourceLength = dataSources.length;
  for (let i = 0; i < dataSourceLength; i++) {
    this._dataSourceRemoved(dataSources, dataSources.get(i));
  }
  this._dataSourceRemoved(undefined, this._dataSourceDisplay.defaultDataSource);

  this._dataSourceDisplay = this._dataSourceDisplay.destroy();

  if (defined(this._scene)) {
    this._scene.renderError.removeEventListener(this._onRenderError);
    this._scene = this._scene.destroy();
  }
  this._container.removeChild(this._element);
  this._creditContainer.removeChild(this._innerCreditContainer);

  this._eventHelper.removeAll();

  if (this._destroyDataSourceCollection) {
    this._dataSourceCollection = this._dataSourceCollection.destroy();
  }

  destroyObject(this);
};

/**
 * 更新画布大小、相机宽高比和视口大小。
 * 此函数根据需求自动调用，除非
 * <code>useDefaultRenderLoop</code> 被设置为 false。
 */
CesiumWidget.prototype.resize = function () {
  const canvas = this._canvas;
  if (
    !this._forceResize &&
    this._canvasClientWidth === canvas.clientWidth &&
    this._canvasClientHeight === canvas.clientHeight &&
    this._lastDevicePixelRatio === window.devicePixelRatio
  ) {
    return;
  }
  this._forceResize = false;

  configureCanvasSize(this);
  configureCameraFrustum(this);

  this._scene.requestRender();
};

/**
 * 渲染场景。此函数自动调用
 * 除非 <code>useDefaultRenderLoop</code> 被设置为 false；
 */
CesiumWidget.prototype.render = function () {
  if (this._canRender) {
    this._scene.initializeFrame();
    const currentTime = this._clock.tick();
    this._scene.render(currentTime);
  } else {
    this._clock.tick();
  }
};

/**
 * @private
 */
CesiumWidget.prototype._dataSourceAdded = function (
  dataSourceCollection,
  dataSource,
) {
  const entityCollection = dataSource.entities;
  entityCollection.collectionChanged.addEventListener(
    CesiumWidget.prototype._onEntityCollectionChanged,
    this,
  );
};

/**
 * @private
 */
CesiumWidget.prototype._dataSourceRemoved = function (
  dataSourceCollection,
  dataSource,
) {
  const entityCollection = dataSource.entities;
  entityCollection.collectionChanged.removeEventListener(
    CesiumWidget.prototype._onEntityCollectionChanged,
    this,
  );

  if (defined(this.trackedEntity)) {
    if (
      entityCollection.getById(this.trackedEntity.id) === this.trackedEntity
    ) {
      this.trackedEntity = undefined;
    }
  }
};

/**
 * @private
 */
CesiumWidget.prototype._updateCanAnimate = function (isUpdated) {
  this._clock.canAnimate = isUpdated;
};

const boundingSphereScratch = new BoundingSphere();

/**
 * @private
 */
CesiumWidget.prototype._onTick = function (clock) {
  const time = clock.currentTime;

  const isUpdated = this._dataSourceDisplay.update(time);
  if (this._allowDataSourcesToSuspendAnimation) {
    this._canAnimateUpdateCallback(isUpdated);
  }

  const entityView = this._entityView;
  if (defined(entityView)) {
    const trackedEntity = this._trackedEntity;
    const trackedState = this._dataSourceDisplay.getBoundingSphere(
      trackedEntity,
      false,
      entityView.boundingSphere ?? boundingSphereScratch,
    );
    if (trackedState === BoundingSphereState.DONE) {
      entityView.update(time);
    }
  }
};

/**
 * @private
 */
CesiumWidget.prototype._onEntityCollectionChanged = function (
  collection,
  added,
  removed,
) {
  const length = removed.length;
  for (let i = 0; i < length; i++) {
    const removedObject = removed[i];
    if (this.trackedEntity === removedObject) {
      this.trackedEntity = undefined;
    }
  }
};

/**
 * @private
 */
CesiumWidget.prototype._clearTrackedObject = function () {
  this.trackedEntity = undefined;
};

/**
 * @private
 */
CesiumWidget.prototype._onDataSourceChanged = function (dataSource) {
  if (this.clockTrackedDataSource === dataSource) {
    trackDataSourceClock(this.clock, dataSource);
  }
};

/**
 * @private
 */
CesiumWidget.prototype._onDataSourceAdded = function (
  dataSourceCollection,
  dataSource,
) {
  if (this._automaticallyTrackDataSourceClocks) {
    this.clockTrackedDataSource = dataSource;
  }
  const id = dataSource.entities.id;
  const removalFunc = this._eventHelper.add(
    dataSource.changedEvent,
    CesiumWidget.prototype._onDataSourceChanged,
    this,
  );
  this._dataSourceChangedListeners[id] = removalFunc;
};

/**
 * @private
 */
CesiumWidget.prototype._onDataSourceRemoved = function (
  dataSourceCollection,
  dataSource,
) {
  const resetClock = this.clockTrackedDataSource === dataSource;
  const id = dataSource.entities.id;
  this._dataSourceChangedListeners[id]();
  this._dataSourceChangedListeners[id] = undefined;
  if (resetClock) {
    const numDataSources = dataSourceCollection.length;
    if (this._automaticallyTrackDataSourceClocks && numDataSources > 0) {
      this.clockTrackedDataSource = dataSourceCollection.get(
        numDataSources - 1,
      );
    } else {
      this.clockTrackedDataSource = undefined;
    }
  }
};

/**
 * 向控件场景中添加一个控制器——即实现 {@link Controller} 接口的类，用于处理输入事件、相机动画和其他交互。
 * @param {Controller} controller 实现 <code>Controller</code> 接口的类。
 * @example
 * widget.scene.screenSpaceCameraController.enableInputs = false;
 * widget.scene.screenSpaceCameraController.enableCollisionDetection = false;
 *
 * const tiltOrbitController = new Cesium.ScreenSpaceTiltOrbitCameraController();
 * widget.addController(tiltOrbitController);
 */
CesiumWidget.prototype.addController = function (controller) {
  return this.scene.controllerHost.registerController(
    controller,
    this.container,
  );
};

/**
 * 从控件场景中移除一个控制器——即实现 {@link Controller} 接口的类，用于处理输入事件、相机动画和其他交互。
 * @param {Controller} controller 实现 <code>Controller</code> 接口的类。
 * @example
 * widget.removeController(tiltOrbitController);
 */
CesiumWidget.prototype.removeController = function (controller) {
  return this.scene.controllerHost.unregisterController(
    controller,
    this.container,
  );
};

/**
 * 异步地将相机设置为查看指定的实体、实体集合或数据源。
 * 如果数据源仍在加载中，或者可视化过程仍在进行中，
 * 该方法会在执行缩放操作前等待数据准备完成。
 *
 * <p>偏移量是在以边界球中心为原点的本地东北上坐标系中的航向/俯仰/范围。</p>
 * 航向和俯仰角度都是在本地东北上坐标系中定义的。
 * 航向是从 y 轴开始向 x 轴方向增加的角度。俯仰是从 xy 平面开始的旋转角度。正俯仰角度
 * 表示位于平面之上。负俯仰角度表示位于平面之下。范围是从中心的距离。如果范围
 * 为零，则计算一个范围，使得整个边界球都能被看到。</p>
 *
 * <p>在 2D 中，必须有一个从上方的视角。相机将置于目标上方向下观察的位置。高于目标的高度即为范围。航向由偏移量决定。如果无法
 * 从偏移量确定航向，则航向将定为北方。</p>
 * 要查看的实体、实体数组、实体集合、数据源、Cesium3DTileset、点云或影像图层。您也可以传递一个承诺值，该值指向上述类型之一。
 *
 * @param {Entity|Entity[]|EntityCollection|DataSource|ImageryLayer|Cesium3DTileset|TimeDynamicPointCloud|Promise<Entity|Entity[]|EntityCollection|DataSource|ImageryLayer|Cesium3DTileset|TimeDynamicPointCloud|VoxelPrimitive|BufferPrimitiveCollection<BufferPrimitive>>} target 在本地东北上坐标系中，从实体中心到实体的偏移量。
 * @param {HeadingPitchRange} [offset] 如果缩放成功，则承诺值为 true；如果目标当前未在场景中可视化或缩放被取消，则承诺值为 false。
 * @returns {Promise<boolean>} A Promise that resolves to true if the zoom was successful or false if the target is not currently visualized in the scene or the zoom was cancelled.
 */
CesiumWidget.prototype.zoomTo = function (target, offset) {
  const options = {
    offset: offset,
  };
  return zoomToOrFly(this, target, options, false);
};

/**
 * 将相机移动到指定的实体、实体集合或数据源处。
 * 如果数据源仍在加载中，或可视化效果仍处于加载状态，
 * 该方法会在数据准备就绪后等待执行飞行操作。
 *
 * <p>偏移量以以边界球中心为原点的本地东北向上参考框架表示，包含航向/俯仰/距离参数。</p>
 * 航向和俯仰角度以本地东北向上参考框架定义。
 * 航向是从y轴开始并向x轴方向增加的角度。俯仰是从xy平面开始的旋转角度。正俯仰角度表示在平面之上，负俯仰角度表示在平面之下。距离是从中心计算出的长度。如果距离为
 * angles are above the plane. Negative pitch angles are below the plane. The range is the distance from the center. If the range is
 * 零，则计算一个使得整个边界球可见的距离。</p>
 *
 * <p>在2D场景中，必须有一个俯视视角。相机将位于目标上方，从下方观察。相对于目标的高度即为距离。航向由偏移量决定。如果无法从偏移量确定航向，
 * 则航向将定为北方。</p>
 * 要查看的实体、实体集合、数据源、Cesium3DTileset、点云或影像图层。您也可以传递一个承诺值，该值会解析为上述类型之一。
 *
 * @param {Entity|Entity[]|EntityCollection|DataSource|ImageryLayer|Cesium3DTileset|TimeDynamicPointCloud|Promise<Entity|Entity[]|EntityCollection|DataSource|ImageryLayer|Cesium3DTileset|TimeDynamicPointCloud|VoxelPrimitive|BufferPrimitiveCollection<BufferPrimitive>>} target 可以指定要查看的实体、实体数组、实体集合、数据源、Cesium3DTileset、点云或影像图层。您还可以传递一个承诺值，其解析结果为上述类型之一。</p>
 * @param {object} [options] 具有以下属性的对象：
 * @param {number} [options.duration=3.0] 飞行的持续时间，以秒为单位。
 * @param {number} [options.maximumHeight] 飞行高峰时的最大高度。
 * @param {HeadingPitchRange} [options.offset] 以以目标为中心的本地东北向上参考框架表示的相对于目标的偏移量。
 * @returns {Promise<boolean>} A 如果飞行成功，则承诺值为true；如果目标当前不在场景中或飞行被取消，则承诺值为false。 //TODO: 清理与实体相关的提及
 */
CesiumWidget.prototype.flyTo = function (target, options) {
  return zoomToOrFly(this, target, options, true);
};

function zoomToOrFly(that, zoomTarget, options, isFlight) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(zoomTarget)) {
    throw new DeveloperError("zoomTarget is required.");
  }
  //>>includeEnd('debug');

  cancelZoom(that);

  //We can't actually perform the zoom until all visualization is ready and
  //bounding spheres have been computed.  Therefore we create and return
  //a deferred which will be resolved as part of the post-render step in the
  //frame that actually performs the zoom.
  const zoomPromise = new Promise((resolve) => {
    that._completeZoom = function (value) {
      resolve(value);
    };
  });
  that._zoomPromise = zoomPromise;
  that._zoomIsFlight = isFlight;
  that._zoomOptions = options;

  Promise.resolve(zoomTarget).then(function (zoomTarget) {
    //Only perform the zoom if it wasn't cancelled before the promise resolved.
    if (that._zoomPromise !== zoomPromise) {
      return;
    }

    //If the zoom target is a rectangular imagery in an ImageLayer
    if (zoomTarget instanceof ImageryLayer) {
      let rectanglePromise;

      if (defined(zoomTarget.imageryProvider)) {
        rectanglePromise = Promise.resolve(zoomTarget.getImageryRectangle());
      } else {
        rectanglePromise = new Promise((resolve) => {
          const removeListener = zoomTarget.readyEvent.addEventListener(() => {
            removeListener();
            resolve(zoomTarget.getImageryRectangle());
          });
        });
      }
      rectanglePromise
        .then(function (rectangle) {
          return computeFlyToLocationForRectangle(rectangle, that.scene);
        })
        .then(function (position) {
          //Only perform the zoom if it wasn't cancelled before the promise was resolved
          if (that._zoomPromise === zoomPromise) {
            that._zoomTarget = position;
          }
        });
      return;
    }

    if (
      zoomTarget instanceof Cesium3DTileset ||
      zoomTarget instanceof TimeDynamicPointCloud ||
      zoomTarget instanceof VoxelPrimitive ||
      zoomTarget instanceof BufferPrimitiveCollection
    ) {
      that._zoomTarget = zoomTarget;
      return;
    }

    //If the zoom target is a data source, and it's in the middle of loading, wait for it to finish loading.
    if (zoomTarget.isLoading && defined(zoomTarget.loadingEvent)) {
      const removeEvent = zoomTarget.loadingEvent.addEventListener(function () {
        removeEvent();

        //Only perform the zoom if it wasn't cancelled before the data source finished.
        if (that._zoomPromise === zoomPromise) {
          that._zoomTarget = zoomTarget.entities.values.slice(0);
        }
      });
      return;
    }

    //Zoom target is already an array, just copy it and return.
    if (Array.isArray(zoomTarget)) {
      that._zoomTarget = zoomTarget.slice(0);
      return;
    }

    //If zoomTarget is an EntityCollection, this will retrieve the array
    zoomTarget = zoomTarget.values ?? zoomTarget;

    //If zoomTarget is a DataSource, this will retrieve the array.
    if (defined(zoomTarget.entities)) {
      zoomTarget = zoomTarget.entities.values;
    }

    //Zoom target is already an array, just copy it and return.
    if (Array.isArray(zoomTarget)) {
      that._zoomTarget = zoomTarget.slice(0);
    } else {
      //Single entity
      that._zoomTarget = [zoomTarget];
    }
  });

  that.scene.requestRender();
  return zoomPromise;
}

function clearZoom(widget) {
  widget._zoomPromise = undefined;
  widget._zoomTarget = undefined;
  widget._zoomOptions = undefined;
}

function cancelZoom(widget) {
  const zoomPromise = widget._zoomPromise;
  if (defined(zoomPromise)) {
    clearZoom(widget);
    widget._completeZoom(false);
  }
}

/**
 * @private
 */
CesiumWidget.prototype._postRender = function () {
  updateZoomTarget(this);
  updateTrackedEntity(this);
};

const zoomTargetBoundingSphereScratch = new BoundingSphere();

function updateZoomTarget(widget) {
  const target = widget._zoomTarget;
  if (!defined(target) || widget.scene.mode === SceneMode.MORPHING) {
    return;
  }

  const scene = widget.scene;
  const camera = scene.camera;
  const zoomOptions = widget._zoomOptions ?? {};
  let options;
  function zoomToBoundingSphere(boundingSphere) {
    // If offset was originally undefined then give it base value instead of empty object
    if (!defined(zoomOptions.offset)) {
      zoomOptions.offset = new HeadingPitchRange(
        0.0,
        -0.5,
        boundingSphere.radius,
      );
    }

    options = {
      offset: zoomOptions.offset,
      duration: zoomOptions.duration,
      maximumHeight: zoomOptions.maximumHeight,
      complete: function () {
        widget._completeZoom(true);
      },
      cancel: function () {
        widget._completeZoom(false);
      },
    };

    if (widget._zoomIsFlight) {
      camera.flyToBoundingSphere(boundingSphere, options);
    } else {
      camera.viewBoundingSphere(boundingSphere, zoomOptions.offset);
      camera.lookAtTransform(Matrix4.IDENTITY);

      // Finish the promise
      widget._completeZoom(true);
    }

    clearZoom(widget);
  }

  if (target instanceof TimeDynamicPointCloud) {
    if (defined(target.boundingSphere)) {
      zoomToBoundingSphere(target.boundingSphere);
      return;
    }

    // Otherwise, the first "frame" needs to have been rendered
    const removeEventListener = target.frameChanged.addEventListener(
      function (timeDynamicPointCloud) {
        zoomToBoundingSphere(timeDynamicPointCloud.boundingSphere);
        removeEventListener();
      },
    );
    return;
  }

  if (target instanceof Cesium3DTileset || target instanceof VoxelPrimitive) {
    zoomToBoundingSphere(target.boundingSphere);
    return;
  }

  if (target instanceof BufferPrimitiveCollection) {
    zoomToBoundingSphere(target.boundingVolume);
    return;
  }

  // If zoomTarget was an ImageryLayer
  if (target instanceof Cartographic) {
    options = {
      destination: scene.ellipsoid.cartographicToCartesian(target),
      duration: zoomOptions.duration,
      maximumHeight: zoomOptions.maximumHeight,
      complete: function () {
        widget._completeZoom(true);
      },
      cancel: function () {
        widget._completeZoom(false);
      },
    };

    if (widget._zoomIsFlight) {
      camera.flyTo(options);
    } else {
      camera.setView(options);
      widget._completeZoom(true);
    }
    clearZoom(widget);
    return;
  }

  const entities = target;

  const boundingSpheres = [];
  for (let i = 0, len = entities.length; i < len; i++) {
    const state = widget._dataSourceDisplay.getBoundingSphere(
      entities[i],
      false,
      zoomTargetBoundingSphereScratch,
    );

    if (state === BoundingSphereState.PENDING) {
      return;
    } else if (state !== BoundingSphereState.FAILED) {
      boundingSpheres.push(
        BoundingSphere.clone(zoomTargetBoundingSphereScratch),
      );
    }
  }

  if (boundingSpheres.length === 0) {
    cancelZoom(widget);
    return;
  }

  // Stop tracking the current entity.
  widget.trackedEntity = undefined;

  const boundingSphere = BoundingSphere.fromBoundingSpheres(boundingSpheres);

  if (!widget._zoomIsFlight) {
    camera.viewBoundingSphere(boundingSphere, zoomOptions.offset);
    camera.lookAtTransform(Matrix4.IDENTITY);
    clearZoom(widget);
    widget._completeZoom(true);
  } else {
    clearZoom(widget);
    camera.flyToBoundingSphere(boundingSphere, {
      duration: zoomOptions.duration,
      maximumHeight: zoomOptions.maximumHeight,
      complete: function () {
        widget._completeZoom(true);
      },
      cancel: function () {
        widget._completeZoom(false);
      },
      offset: zoomOptions.offset,
    });
  }
}

const trackedEntityBoundingSphereScratch = new BoundingSphere();

function updateTrackedEntity(widget) {
  if (!widget._needTrackedEntityUpdate) {
    return;
  }

  const trackedEntity = widget._trackedEntity;
  const currentTime = widget.clock.currentTime;

  //Verify we have a current position at this time. This is only triggered if a position
  //has become undefined after trackedEntity is set but before the boundingSphere has been
  //computed. In this case, we will track the entity once it comes back into existence.
  const currentPosition = Property.getValueOrUndefined(
    trackedEntity.position,
    currentTime,
  );

  if (!defined(currentPosition)) {
    return;
  }

  const scene = widget.scene;

  const state = widget._dataSourceDisplay.getBoundingSphere(
    trackedEntity,
    false,
    trackedEntityBoundingSphereScratch,
  );
  if (state === BoundingSphereState.PENDING) {
    return;
  }

  const sceneMode = scene.mode;
  if (
    sceneMode === SceneMode.COLUMBUS_VIEW ||
    sceneMode === SceneMode.SCENE2D
  ) {
    scene.screenSpaceCameraController.enableTranslate = false;
  }

  if (
    sceneMode === SceneMode.COLUMBUS_VIEW ||
    sceneMode === SceneMode.SCENE3D
  ) {
    scene.screenSpaceCameraController.enableTilt = false;
  }

  const bs =
    state !== BoundingSphereState.FAILED
      ? trackedEntityBoundingSphereScratch
      : undefined;
  widget._entityView = new EntityView(trackedEntity, scene, scene.ellipsoid);
  widget._entityView.update(currentTime, bs);
  widget._needTrackedEntityUpdate = false;
}

export default CesiumWidget;
