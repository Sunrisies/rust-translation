import { DeveloperError, Event, Frozen, defined } from "@cesium/core";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import NodeTransformationProperty from "./NodeTransformationProperty.js";
import PropertyBag from "./PropertyBag.js";

function createNodeTransformationProperty(value) {
  return new NodeTransformationProperty(value);
}

function createNodeTransformationPropertyBag(value) {
  return new PropertyBag(value, createNodeTransformationProperty);
}

function createArticulationStagePropertyBag(value) {
  return new PropertyBag(value);
}

function createEnvironmentMapPropertyBag(value) {
  return new PropertyBag(value);
}

/**
 * @typedef {object} ModelGraphics.ConstructorOptions
 *
 * ModelGraphics 构造器的初始化选项
 *
 * @property {Property | boolean} [show=true] 一个布尔属性，指定模型的可见性。
 * @property {Property | string | Resource} [uri] 一个字符串或资源属性，指定 glTF 资源的 URI。
 * @property {Property | number} [scale=1.0] 一个数值属性，指定统一的线性比例。
 * @property {Property | boolean} [enableVerticalExaggeration=true] 一个布尔属性，指定当 {@link Scene.verticalExaggeration} 设置为不同于 <code>1.0</code> 的值时，模型是否沿椭球法线被放大。
 * @property {Property | number} [minimumPixelSize=0.0] 一个数值属性，指定无论缩放级别如何，模型的大致最小像素尺寸。
 * @property {Property | number} [maximumScale] 模型的最大比例大小。即 minimumPixelSize 的上限。
 * @property {Property | boolean} [incrementallyLoadTextures=true] 确定模型加载后是否仍可以继续流式传输纹理。
 * @property {Property | boolean} [runAnimations=true] 一个布尔属性，指定模型中指定的 glTF 动画是否应开始播放。
 * @property {Property | boolean} [clampAnimations=true] 一个布尔属性，指定对于没有关键帧的动画时长，glTF 动画是否应保留最后姿态。
 * @property {Property | ShadowMode} [shadows=ShadowMode.ENABLED] 一个枚举属性，指定模型是投射阴影还是接收来自光源的阴影。
 * @property {Property | HeightReference} [heightReference=HeightReference.NONE] 一个属性，指定高度相对于什么基准。
 * @property {Property | Color} [silhouetteColor=Color.RED] 一个属性，指定轮廓的 {@link Color}。
 * @property {Property | number} [silhouetteSize=0.0] 一个数值属性，指定轮廓的像素大小。
 * @property {Property | Color} [color=Color.WHITE] 一个属性，指定与模型渲染颜色混合的 {@link Color}。
 * @property {Property | ColorBlendMode} [colorBlendMode=ColorBlendMode.HIGHLIGHT] 一个枚举属性，指定颜色与模型的混合方式。
 * @property {Property | number} [colorBlendAmount=0.5] 一个数值属性，当 <code>colorBlendMode</code> 为 <code>MIX</code> 时，表示颜色强度。0.0 表示模型渲染颜色，1.0 表示纯色，中间值则表示两种颜色的混合。
 * @property {Property | Cartesian2} [imageBasedLightingFactor=new Cartesian2(1.0, 1.0)] 一个属性，指定漫反射和镜面反射基于图像的光线的贡献比例。
 * @property {PropertyBag | Object<string, *>} [environmentMapOptions] 此实体上管理动态环境地图的属性。
 * @property {Property | Color} [lightColor] 一个属性，指定对模型进行阴影处理时的光源颜色。当为 <code>undefined</code> 时，则使用场景的光源颜色。
 * @property {Property | DistanceDisplayCondition} [distanceDisplayCondition] 一个属性，指定模型在距相机多远的距离下显示。
 * @property {PropertyBag | Object<string, TranslationRotationScale>} [nodeTransformations] 一个对象，其中键是节点名称，值为描述该节点应应用的变换的 {@link TranslationRotationScale} 属性。该变换在 glTF 中规定的节点现有变换之后应用，并不替换节点现有的变换。
 * @property {PropertyBag | Object<string, number>} [articulations] 一个对象，其键由关节名称、单个空格和阶段名称组成，值则是数值属性。
 * @property {Property | ClippingPlaneCollection} [clippingPlanes] 指定用于选择性禁用模型渲染的 {@link ClippingPlaneCollection} 属性。
 * @property {Property | CustomShader} [customShader] 指定应用于该模型的 {@link CustomShader} 属性。
 */

/**
 * 基于 {@link https://github.com/KhronosGroup/glTF|glTF} 的 3D 模型，这是 WebGL、OpenGL ES 和 OpenGL 的运行时资产格式。
 * 模型的位置和方向由包含它的 {@link Entity} 决定。
 * <p>
 * Cesium 支持 glTF 几何图形、材质、动画和蒙皮功能。
 * 目前不支持相机和灯光功能。
 * </p>
 *
 * @alias ModelGraphics
 * @constructor
 *
 * @param {ModelGraphics.ConstructorOptions} [options] 描述初始化选项的对象。
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=3d-models|Cesium Sandcastle 3D Models Demo}
 */
function ModelGraphics(options) {
  this._definitionChanged = new Event();
  this._show = undefined;
  this._showSubscription = undefined;
  this._uri = undefined;
  this._uriSubscription = undefined;
  this._scale = undefined;
  this._scaleSubscription = undefined;
  this._hasVerticalExaggeration = undefined;
  this._hasVerticalExaggerationSubscription = undefined;
  this._enableVerticalExaggeration = undefined;
  this._enableVerticalExaggerationSubscription = undefined;
  this._minimumPixelSize = undefined;
  this._minimumPixelSizeSubscription = undefined;
  this._maximumScale = undefined;
  this._maximumScaleSubscription = undefined;
  this._incrementallyLoadTextures = undefined;
  this._incrementallyLoadTexturesSubscription = undefined;
  this._runAnimations = undefined;
  this._runAnimationsSubscription = undefined;
  this._clampAnimations = undefined;
  this._clampAnimationsSubscription = undefined;
  this._shadows = undefined;
  this._shadowsSubscription = undefined;
  this._heightReference = undefined;
  this._heightReferenceSubscription = undefined;
  this._silhouetteColor = undefined;
  this._silhouetteColorSubscription = undefined;
  this._silhouetteSize = undefined;
  this._silhouetteSizeSubscription = undefined;
  this._color = undefined;
  this._colorSubscription = undefined;
  this._colorBlendMode = undefined;
  this._colorBlendModeSubscription = undefined;
  this._colorBlendAmount = undefined;
  this._colorBlendAmountSubscription = undefined;
  this._imageBasedLightingFactor = undefined;
  this._imageBasedLightingFactorSubscription = undefined;
  this._environmentMapOptions = undefined;
  this._environmentMapOptionsSubscription = undefined;
  this._lightColor = undefined;
  this._lightColorSubscription = undefined;
  this._distanceDisplayCondition = undefined;
  this._distanceDisplayConditionSubscription = undefined;
  this._nodeTransformations = undefined;
  this._nodeTransformationsSubscription = undefined;
  this._articulations = undefined;
  this._articulationsSubscription = undefined;
  this._clippingPlanes = undefined;
  this._clippingPlanesSubscription = undefined;
  this._customShader = undefined;
  this._customShaderSubscription = undefined;

  this.merge(options ?? Frozen.EMPTY_OBJECT);
}

Object.defineProperties(ModelGraphics.prototype, {
  /**
   * 获取当属性或子属性被更改或修改时引发的事件。
   * @memberof ModelGraphics.prototype
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },

  /**
   * 获取或设置指定模型可见性的布尔型属性。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  show: createPropertyDescriptor("show"),

  /**
   * 获取或设置指定 glTF 资源 URI 的字符串属性。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   */
  uri: createPropertyDescriptor("uri"),

  /**
   * 获取或设置指定统一线性比例的数值属性。
   * 对于该模型，值大于 1.0 会增大模型大小，而小于 1.0 则会减小模型大小。
   * 当 {@link Scene.verticalExaggeration} 的值不为 <code>1.0</code> 时，该属性用于确定模型沿椭球法线方向的夸张程度。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default 1.0
   */
  scale: createPropertyDescriptor("scale"),

  /**
   * 获取或设置布尔型属性，指定在 {@link Scene.verticalExaggeration} 设置为其他值时，模型是否沿椭球法线方向被夸大。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  enableVerticalExaggeration: createPropertyDescriptor(
    "enableVerticalExaggeration",
  ),

  /**
   * 获取或设置指定模型近似最小像素尺寸的数值属性。该尺寸与缩放无关，可用于确保即使在观众放大查看时模型也能可见。当 <code>0.0</code> 时，则不强制规定最小尺寸。
   * 获取或设置指定最大比例的数值属性。该比例用于作为
   * {@link ModelGraphics#minimumPixelSize} 的上限。
   * 获取或设置布尔型属性，指定纹理在模型加载后是否仍可继续流媒体播放。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default 0.0
   */
  minimumPixelSize: createPropertyDescriptor("minimumPixelSize"),

  /**
   * 获取或设置布尔型属性，指定是否应运行 glTF 动画。
   * 获取或设置布尔型属性，指定 glTF 动画是否应在没有关键帧的时间段中保留最后姿态。
   * 获取或设置枚举属性，指定模型是向光源投射阴影还是接收阴影。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   */
  maximumScale: createPropertyDescriptor("maximumScale"),

  /**
   * 获取或设置布尔型属性，指定纹理在模型加载后是否仍可继续流媒体播放。
   * 获取或设置指定 {@link HeightReference} 的属性。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   */
  incrementallyLoadTextures: createPropertyDescriptor(
    "incrementallyLoadTextures",
  ),

  /**
   * 获取或设置指定 {@link Color} 的属性，用于定义轮廓的颜色。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  runAnimations: createPropertyDescriptor("runAnimations"),

  /**
   * Gets or sets the boolean Property specifying if glTF animations should hold the last pose for time durations with no keyframes.
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default true
   */
  clampAnimations: createPropertyDescriptor("clampAnimations"),

  /**
   * Get or sets the enum Property specifying whether the model
   * casts or receives shadows from light sources.
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default ShadowMode.ENABLED
   */
  shadows: createPropertyDescriptor("shadows"),

  /**
   * Gets or sets the Property specifying the {@link HeightReference}.
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default HeightReference.NONE
   */
  heightReference: createPropertyDescriptor("heightReference"),

  /**
   * Gets or sets the Property specifying the {@link Color} of the silhouette.
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default Color.RED
   */
  silhouetteColor: createPropertyDescriptor("silhouetteColor"),

  /**
   * 获取或设置指定轮廓大小的数值属性，单位为像素。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default 0.0
   */
  silhouetteSize: createPropertyDescriptor("silhouetteSize"),

  /**
   * 获取或设置与模型渲染颜色混合的 {@link Color} 属性。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default Color.WHITE
   */
  color: createPropertyDescriptor("color"),

  /**
   * 获取或设置指定颜色与模型混合方式的枚举属性。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default ColorBlendMode.HIGHLIGHT
   */
  colorBlendMode: createPropertyDescriptor("colorBlendMode"),

  /**
   * 当 <code>colorBlendMode</code> 为 MIX 时，指定颜色强度的数值属性。
   * 值为 0.0 时显示模型的渲染颜色，值为 1.0 时显示纯色，中间值则呈现两种颜色的混合效果。
   * 任何中间值都会呈现两种颜色的混合效果。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   * @default 0.5
   */
  colorBlendAmount: createPropertyDescriptor("colorBlendAmount"),

  /**
   * 指定用于缩放漫反射和镜面反射图像照明对最终颜色影响的 {@link Cartesian2} 属性。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   */
  imageBasedLightingFactor: createPropertyDescriptor(
    "imageBasedLightingFactor",
  ),

  /**
   * 获取或设置应用于该模型的 {@link DynamicEnvironmentMapManager.ConstructorOptions} 属性，以 {@link PropertyBag} 形式表示。
   * @memberof ModelGraphics.prototype
   * @type {PropertyBag}
   */
  environmentMapOptions: createPropertyDescriptor(
    "environmentMapOptions",
    undefined,
    createEnvironmentMapPropertyBag,
  ),

  /**
   * 指定在给模型进行着色时使用的 {@link Cartesian3} 光颜色属性。当为 <code>undefined</code> 时，则使用场景中的光颜色。
   * @memberOf ModelGraphics.prototype
   * @type {Property|undefined}
   */
  lightColor: createPropertyDescriptor("lightColor"),

  /**
   * 获取或设置指定该模型在距相机多远的距离下显示的 {@link DistanceDisplayCondition} 属性。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   */
  distanceDisplayCondition: createPropertyDescriptor(
    "distanceDisplayCondition",
  ),

  /**
   * 获取或设置应用于该模型的节点变换集合。以 {@link PropertyBag} 形式表示，键为节点名称，值为描述该节点应应用的 {@link TranslationRotationScale} 属性。
   * 根据 glTF 中的规定，该变换在节点现有变换之后应用，并不替换节点现有的变换。
   * 获取或设置应用于该模型的关节值集合。以 {@link PropertyBag} 形式表示，键为关节名称，中间有一个空格，后跟舞台名称。
   * @memberof ModelGraphics.prototype
   * @type {PropertyBag}
   */
  nodeTransformations: createPropertyDescriptor(
    "nodeTransformations",
    undefined,
    createNodeTransformationPropertyBag,
  ),

  /**
   * 指定用于选择性禁用模型渲染的 {@link ClippingPlaneCollection} 属性。
   * 获取或设置应用于该模型的 {@link CustomShader} 属性。当为 <code>undefined</code> 时，不使用自定义着色器代码。
   * @memberof ModelGraphics.prototype
   * @type {PropertyBag}
   */
  articulations: createPropertyDescriptor(
    "articulations",
    undefined,
    createArticulationStagePropertyBag,
  ),

  /**
   * 复制此实例。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   */
  clippingPlanes: createPropertyDescriptor("clippingPlanes"),

  /**
   * 指定存储结果的对象。
   * @memberof ModelGraphics.prototype
   * @type {Property|undefined}
   */
  customShader: createPropertyDescriptor("customShader"),
});

/**
 * 修改结果参数或如果未提供则创建新实例。
 *
 * @param {ModelGraphics} [result] 存储结果的对象。
 * @returns {ModelGraphics} The 修改结果参数或如果未提供则创建新实例。
 */
ModelGraphics.prototype.clone = function (result) {
  if (!defined(result)) {
    return new ModelGraphics(this);
  }
  result.show = this.show;
  result.uri = this.uri;
  result.scale = this.scale;
  result.enableVerticalExaggeration = this.enableVerticalExaggeration;
  result.minimumPixelSize = this.minimumPixelSize;
  result.maximumScale = this.maximumScale;
  result.incrementallyLoadTextures = this.incrementallyLoadTextures;
  result.runAnimations = this.runAnimations;
  result.clampAnimations = this.clampAnimations;
  result.heightReference = this._heightReference;
  result.silhouetteColor = this.silhouetteColor;
  result.silhouetteSize = this.silhouetteSize;
  result.color = this.color;
  result.colorBlendMode = this.colorBlendMode;
  result.colorBlendAmount = this.colorBlendAmount;
  result.imageBasedLightingFactor = this.imageBasedLightingFactor;
  result.environmentMapOptions = this.environmentMapOptions;
  result.lightColor = this.lightColor;
  result.distanceDisplayCondition = this.distanceDisplayCondition;
  result.nodeTransformations = this.nodeTransformations;
  result.articulations = this.articulations;
  result.clippingPlanes = this.clippingPlanes;
  result.customShader = this.customShader;
  return result;
};

/**
 * 将此对象上所有未分配的属性值设置为
 * 提供源对象上相同属性的值。
 *
 * @param {ModelGraphics} source 要合并到此对象中的对象。
 */
ModelGraphics.prototype.merge = function (source) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  this.show = this.show ?? source.show;
  this.uri = this.uri ?? source.uri;
  this.scale = this.scale ?? source.scale;
  this.enableVerticalExaggeration =
    this.enableVerticalExaggeration ?? source.enableVerticalExaggeration;
  this.minimumPixelSize = this.minimumPixelSize ?? source.minimumPixelSize;
  this.maximumScale = this.maximumScale ?? source.maximumScale;
  this.incrementallyLoadTextures =
    this.incrementallyLoadTextures ?? source.incrementallyLoadTextures;
  this.runAnimations = this.runAnimations ?? source.runAnimations;
  this.clampAnimations = this.clampAnimations ?? source.clampAnimations;
  this.shadows = this.shadows ?? source.shadows;
  this.heightReference = this.heightReference ?? source.heightReference;
  this.silhouetteColor = this.silhouetteColor ?? source.silhouetteColor;
  this.silhouetteSize = this.silhouetteSize ?? source.silhouetteSize;
  this.color = this.color ?? source.color;
  this.colorBlendMode = this.colorBlendMode ?? source.colorBlendMode;
  this.colorBlendAmount = this.colorBlendAmount ?? source.colorBlendAmount;
  this.imageBasedLightingFactor =
    this.imageBasedLightingFactor ?? source.imageBasedLightingFactor;
  this.environmentMapOptions =
    this.environmentMapOptions ?? source.environmentMapOptions;
  this.lightColor = this.lightColor ?? source.lightColor;
  this.distanceDisplayCondition =
    this.distanceDisplayCondition ?? source.distanceDisplayCondition;
  this.clippingPlanes = this.clippingPlanes ?? source.clippingPlanes;
  this.customShader = this.customShader ?? source.customShader;

  const sourceNodeTransformations = source.nodeTransformations;
  if (defined(sourceNodeTransformations)) {
    const targetNodeTransformations = this.nodeTransformations;
    if (defined(targetNodeTransformations)) {
      targetNodeTransformations.merge(sourceNodeTransformations);
    } else {
      this.nodeTransformations = new PropertyBag(
        sourceNodeTransformations,
        createNodeTransformationProperty,
      );
    }
  }

  const sourceArticulations = source.articulations;
  if (defined(sourceArticulations)) {
    const targetArticulations = this.articulations;
    if (defined(targetArticulations)) {
      targetArticulations.merge(sourceArticulations);
    } else {
      this.articulations = new PropertyBag(sourceArticulations);
    }
  }
};
export default ModelGraphics;
