import SceneMode from "./SceneMode.js";

/**
 * 当前帧的状态信息。此类的实例
 * 被提供给更新函数。
 *
 * @param {Context} context 渲染上下文
 * @param {CreditDisplay} creditDisplay 处理从 HTML 元素中添加和移除字幕的功能
 * @param {JobScheduler} jobScheduler 作业调度器
 *
 * @alias FrameState
 * @constructor
 *
 * @private
 */
function FrameState(context, creditDisplay, jobScheduler) {
  /**
   * 渲染上下文。
   *
   * @type {Context}
   */
  this.context = context;

  /**
   * 一组渲染命令。
   *
   * @type {DrawCommand[]}
   */
  this.commandList = [];

  /**
   * 一组全景渲染命令。
   *
   * @type {DrawCommand[]}
   */
  this.panoramaCommandList = [];

  /**
   * 一组阴影图。
   * @type {ShadowMap[]}
   */
  this.shadowMaps = [];

  /**
   * 用于 PBR 模型基于图像的照明效果的 BRDF 查找纹理生成器
   * @type {BrdfLutGenerator}
   */
  this.brdfLutGenerator = undefined;

  /**
   * 用于 PBR 模型基于图像的照明效果的环境贴图
   * @type {CubeMap}
   */
  this.environmentMap = undefined;

  /**
   * 用于 PBR 模型基于图像的照明效果的球谐系数。
   * @type {Cartesian3[]}
   */
  this.sphericalHarmonicCoefficients = undefined;

  /**
   * 用于 PBR 模型基于图像的照明效果的镜面环境图集。
   * @type {Texture}
   */
  this.specularEnvironmentMaps = undefined;

  /**
   * 用于 PBR 模型基于图像的照明效果的镜面环境图集的最大细节级别。
   * @type {number}
   */
  this.specularEnvironmentMapsMaximumLOD = undefined;

  /**
   * 场景当前模式。
   *
   * @type {SceneMode}
   * @default {@link SceneMode.SCENE3D}
   */
  this.mode = SceneMode.SCENE3D;

  /**
   * 2D/Columbus View 与 3D 之间的当前形态过渡时间，
   * 其中 0.0 表示 2D 或 Columbus View，1.0 表示 3D。
   *
   * @type {number}
   */
  this.morphTime = SceneMode.getMorphTime(SceneMode.SCENE3D);

  /**
   * 当前帧号。
   *
   * @type {number}
   * @default 0
   */
  this.frameNumber = 0;

  /**
   * 如果已发布新帧且帧号已更新，则输出 <code>true</code>。
   *
   * @type {boolean}
   * @default false
   */
  this.newFrame = false;

  /**
   * 场景当前时间。
   *
   * @type {JulianDate}
   * @default undefined
   */
  this.time = undefined;

  /**
   * 作业调度器。
   *
   * @type {JobScheduler}
   */
  this.jobScheduler = jobScheduler;

  /**
   * 在 2D 和 Columbus View 模式下使用的地图投影。
   *
   * @type {MapProjection}
   * @default undefined
   */
  this.mapProjection = undefined;

  /**
   * 当前相机。
   *
   * @type {Camera}
   * @default undefined
   */
  this.camera = undefined;

  /**
   * 相机是否位于地下。
   *
   * @type {boolean}
   * @default false
   */
  this.cameraUnderground = false;

  /**
   * 场景使用的 {@link GlobeTranslucencyState} 对象。
   *
   * @type {GlobeTranslucencyState}
   * @default undefined
   */
  this.globeTranslucencyState = undefined;

  /**
   * 剔除体积。
   *
   * @type {CullingVolume}
   * @default undefined
   */
  this.cullingVolume = undefined;

  /**
   * 当前遮挡器。
   *
   * @type {Occluder}
   * @default undefined
   */
  this.occluder = undefined;

  /**
   * 用于驱动细节级别优化的最大屏幕空间误差。更高的
   * 值将提供更好的性能，但视觉质量较低。
   *
   * @type {number}
   * @default 2
   */
  this.maximumScreenSpaceError = undefined;

  /**
   * 像素与密度独立像素之间的比例。提供了一个标准单位，
   * 用于衡量适合特定设备的真实像素尺寸。
   *
   * @type {number}
   * @default 1.0
   */
  this.pixelRatio = 1.0;

  /**
   * @typedef FrameState.Passes
   * @type {object}
   * @property {boolean} render 如果基元应在渲染通道中更新，则输出 <code>true</code>，否则输出 <code>false</code>。
   * @property {boolean} pick 如果基元应在拾取通道中更新，则输出 <code>true</code>，否则输出 <code>false</code>。
   * @property {boolean} pickVoxel 如果基元应在体素拾取通道中更新，则输出 <code>true</code>，否则输出 <code>false</code>。
   * @property {boolean} snap 如果当前拾取通道是吸附通道（参见 {@link Scene#snap}），则输出 <code>true</code>，否则输出 <code>false</code>。当 <code>pick</code> 也为 <code>true</code> 时，仅输出 <code>true</code>。
   * @property {boolean} depth 如果基元应在仅深度通道中更新，则输出 <code>true</code>，否则输出 <code>false</code>。
   * @property {boolean} postProcess 如果基元应在每个特性后处理通道中更新，则输出 <code>true</code>，否则输出 <code>false</code>。
   * @property {boolean} offscreen 如果控件应在屏幕外通过更新来刷新，则输出 <code>true</code>，否则输出 <code>false</code>。
   */

  /**
   * @type {FrameState.Passes}
   */
  this.passes = {
    /**
     * @default false
     */
    render: false,
    /**
     * @default false
     */
    pick: false,
    /**
     * @default false
     */
    pickVoxel: false,
    /**
     * @default false
     */
    snap: false,
    /**
     * @default false
     */
    depth: false,
    /**
     * @default false
     */
    postProcess: false,
    /**
     * @default false
     */
    offscreen: false,
  };

  /**
   * 信用显示。
   *
   * @type {CreditDisplay}
   */
  this.creditDisplay = creditDisplay;

  /**
   * 在帧结束时调用的函数数组。该数组
   * 在每帧结束后会被清空。
   * <p>
   * 这允许在 <code>update</code> 函数中排队事件，并在订阅者有空时
   * 一次性触发这些事件，而不是直接在 <code>update</code> 函数中触发事件。
   * 如果数组中的任何函数返回 <code>true</code>，则在请求渲染模式下
   * 将渲染下一帧。
   * </p>
   * <p>
   * 如果数组中的任何函数返回 <code>true</code>，在请求渲染模式下
   * 将渲染下一帧。
   * </p>
   *
   * @type {FrameState.AfterRenderCallback[]}
   *
   * @example
   * frameState.afterRender.push(function() {
   * // 执行某些操作，触发事件等。
   * });
   */
  this.afterRender = [];

  /**
   * 用于决定是否仅优化为 3D 效果。
   *
   * @type {boolean}
   * @default false
   */
  this.scene3DOnly = false;

  /**
   * @typedef FrameState.Fog
   * @type {object}
   * @property {boolean} enabled 如果雾效被启用，则输出 <code>true</code>，否则输出 <code>false</code>。这影响雾效的剔除和渲染。
   * @property {boolean} renderable 如果应渲染雾效，则输出 <code>true</code>，否则输出 <code>false</code>。此标志应与 fog.enabled 结合使用。
   * @property {number | undefined} density 用于根据相机距离混合颜色和雾色的正数值。
   * @property {number | undefined} visualDensityScalar 用于根据密度调整雾效的影响程度的正数。
   * @property {number | undefined} sse 用于在雾效中部分修改几何体的屏幕空间误差的标量。
   * @property {number | undefined} minimumBrightness 应用了雾效后的地形最小亮度。
   */

  /**
   * @type {FrameState.Fog}
   */

  this.fog = {
    /**
     * @default false
     */
    enabled: false,
    renderable: false,
    density: undefined,
    visualDensityScalar: undefined,
    sse: undefined,
    minimumBrightness: undefined,
  };

  /**
   * 当前大气效果。
   * @type {Atmosphere}
   */
  this.atmosphere = undefined;

  /**
   * 用于垂直放大场景的标量。
   * @type {number}
   * @default 1.0
   */
  this.verticalExaggeration = 1.0;

  /**
   * 场景被垂直放大的高度。
   * @type {number}
   * @default 0.0
   */
  this.verticalExaggerationRelativeHeight = 0.0;

  /**
   * @typedef FrameState.ShadowState
   * @type {object}
   * @property {boolean} shadowsEnabled 本帧是否有活跃的阴影映射。
   * @property {boolean} lightShadowsEnabled 是否有来自光源的活跃阴影映射。不包括用于分析目的的阴影映射。
   * @property {ShadowMap[]} shadowMaps 本帧启用的所有阴影映射。
   * @property {ShadowMap[]} lightShadowMaps 来自光源的阴影映射。不包括用于分析目的的阴影映射。只有这些阴影映射会被用于生成接收阴影着色器。
   * @property {number} nearPlane 场景视锥体的近平面命令。用于适配级联阴影映射。
   * @property {number} farPlane 场景视锥体的远平面命令。用于适配级联阴影映射。
   * @property {number} closestObjectSize 最接近相机的边界体积大小。用于在物体附近放置更多阴影细节。
   * @property {number} lastDirtyTime 阴影映射上次被清除的时间。
   * @property {boolean} outOfView 本帧阴影映射是否不在视野中。
   */

  /**
   * @type {FrameState.ShadowState}
   */

  this.shadowState = {
    /**
     * @default true
     */
    shadowsEnabled: true,
    shadowMaps: [],
    lightShadowMaps: [],
    /**
     * @default 1.0
     */
    nearPlane: 1.0,
    /**
     * @default 5000.0
     */
    farPlane: 5000.0,
    /**
     * @default 1000.0
     */
    closestObjectSize: 1000.0,
    /**
     * @default 0
     */
    lastDirtyTime: 0,
    /**
     * @default true
     */
    outOfView: true,
  };

  /**
   * 在渲染分割两侧不同内容时使用的分割器位置。
   * 该值应在 0.0 到 1.0 之间，其中 0 表示视口最左端，1 表示视口最右端。
   * @type {number}
   * @default 0.0
   */
  this.splitPosition = 0.0;

  /**
   * 相机视锥体近平面和远平面的距离。
   * @type {number[]}
   * @default []
   */
  this.frustumSplits = [];

  /**
   * 当前场景的背景颜色。
   *
   * @type {Color}
   */
  this.backgroundColor = undefined;

  /**
   * 用于遮蔽场景的灯光。
   *
   * @type {Light}
   */
  this.light = undefined;

  /**
   * 在距相机多远的位置禁用公告板、标签和点的深度测试。
   * 例如，用于防止与地形发生裁剪。设置为 0 时，深度测试应始终被应用；小于 0 时，深度测试不应被应用。
   * 当设置为 `false` 时，3D Tiles 将正常渲染。当设置为 `true` 时，分类后的 3D Tile 几何图形将正常渲染，而
   * @type {number}
   */
  this.minimumDisableDepthTestDistance = undefined;

  /**
   * 未分类的 3D Tile 几何图形将使用乘以 {@link FrameState#invertClassificationColor}后的颜色进行渲染。
   * 在 {@link FrameState#invertClassification} 为 `true` 时，未分类的 3D Tile 几何图形的高亮颜色。
   * @type {boolean}
   * @default false
   */
  this.invertClassification = false;

  /**
   * The highlight color of unclassified 3D Tile geometry when {@link FrameState#invertClassification} is <code>true</code>.
   * @type {Color}
   */
  this.invertClassificationColor = undefined;

  /**
   * 场景是否使用对数深度缓冲区。
   *
   * @type {boolean}
   * @default false
   */
  this.useLogDepth = false;

  /**
   * 用于更新 3D Tilesets 的额外状态。
   *
   * @type {Cesium3DTilePassState}
   */
  this.tilesetPassState = undefined;

  /**
   * 所有渲染的地形瓦片中的最小地形高度。用于优化椭圆体下方但高于地形的对象的剔除。
   *
   * @type {number}
   * @default 0.0
   */
  this.minimumTerrainHeight = 0.0;

  /**
   * 当前是否正在进行元数据拾取操作。
   *
   * 在 `Picking.pickMetadata` 函数中，该值被设置为 `true`，
   * 在更新和执行绘制命令之前立即执行。
   * 之后立即恢复为 `false`。它将被用于确定是否应执行元数据拾取的绘制命令，
   * 在 `Scene.executeCommand` 函数中。
   * 元数据拾取信息。
   *
   * @type {boolean}
   * @default false
   */
  this.pickingMetadata = false;

  /**
   * 描述了应在 `Picking.pickMetadata` 调用中拾取的元数据属性。
   *
   * 该信息存储在帧状态中，并包含在元数据拾取绘制命令中。在 `Scene.updateDerivedCommands` 调用中，将检查存储在帧状态的实例与绘制命令中的实例是否不同，如有必要，
   * 将基于此信息更新用于元数据拾取的派生命令。
   *
   * 内部切换标志，表示该帧至少有一个原始对象请求边缘可见性渲染（EXT_mesh_primitive_edge_visibility）。这允许
   * 在帧状态中不存储 Scene 引用，从而延迟分配/激活边缘 MRT。
   * 检查存储在帧状态的实例是否与绘制命令中的实例不同，如有必要，
   * 将基于此信息更新用于元数据拾取的派生命令。
   * the derived commands for metadata picking will be updated based
   * on this information.
   *
   * @type {PickedMetadataInfo|undefined}
   */
  this.pickedMetadataInfo = undefined;

  /**
   * Internal toggle indicating that at least one primitive for this frame requested
   * edge visibility rendering (EXT_mesh_primitive_edge_visibility). This allows
   * lazy allocation/activation of the edge MRT without storing a Scene reference
   * on the frame state (avoids passing entire Scene through internal APIs).
   * 在 MRT 边缘命令执行时，由 ModelDrawCommand 每帧更新。
   * 场景用于切换其 _enableEdgeVisibility 标志。
   * @type {boolean}
   * @private
   */
  this.edgeVisibilityRequested = false;

  /**
   * 内部开关，表示该帧至少有一个原始对象具备
   * BENTLEY_materials_planar_fill 扩展功能。这允许延迟分配
   * 平面填充特征-ID 帧缓冲区。
   * 在绘制命令构建时由 MaterialPipelineStage 设置，并在模型场景图每帧更新。
   * 平面填充原始对象渲染时，由 ModelSceneGraph 每帧更新。
   * 场景用于更新其 _enablePlanarFillId 标志。
   * @type {boolean}
   * @private
   */
  this.planarFillRequested = false;
}

/**
 * 在帧结束时将调用的函数。
 *
 * @callback FrameState.AfterRenderCallback
 * @returns {boolean} true 如果请求渲染模式下需要再次渲染。
 */
export default FrameState;
