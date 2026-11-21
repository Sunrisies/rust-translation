import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Color,
  DeveloperError,
  Ellipsoid,
  Event,
  IntersectionTests,
  Math as CesiumMath,
  NearFarScalar,
  Ray,
  Rectangle,
  defined,
  destroyObject,
} from "@cesium/core";
import buildModuleUrl from "../Core/buildModuleUrl.js";
import EllipsoidTerrainProvider from "../Core/EllipsoidTerrainProvider.js";
import Resource from "../Core/Resource.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import Texture from "../Renderer/Texture.js";
import GlobeFS from "../Shaders/GlobeFS.js";
import GlobeVS from "../Shaders/GlobeVS.js";
import AtmosphereCommon from "../Shaders/AtmosphereCommon.js";
import GroundAtmosphere from "../Shaders/GroundAtmosphere.js";
import GlobeSurfaceShaderSet from "./GlobeSurfaceShaderSet.js";
import GlobeSurfaceTileProvider from "./GlobeSurfaceTileProvider.js";
import GlobeTranslucency from "./GlobeTranslucency.js";
import ImageryLayerCollection from "./ImageryLayerCollection.js";
import QuadtreePrimitive from "./QuadtreePrimitive.js";
import SceneMode from "./SceneMode.js";
import ShadowMode from "./ShadowMode.js";
import VectorProvider from "../Core/VectorProvider.js";

/**
 * 场景中的地球模型，包括其地形 ({@link Globe#terrainProvider})
 * 以及影像图层 ({@link Globe#imageryLayers})。使用 {@link Scene#globe} 访问地球模型。
 *
 * @alias Globe
 * @constructor
 *
 * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] 决定
 * 地球模型的大小和形状。
 */
function Globe(ellipsoid) {
  ellipsoid = ellipsoid ?? Ellipsoid.default;
  const terrainProvider = new EllipsoidTerrainProvider({
    ellipsoid: ellipsoid,
  });
  const imageryLayerCollection = new ImageryLayerCollection();
  const vectorProvider = new VectorProvider({
    tilingScheme: terrainProvider.tilingScheme,
  });

  this._ellipsoid = ellipsoid;
  this._imageryLayerCollection = imageryLayerCollection;

  this._surfaceShaderSet = new GlobeSurfaceShaderSet();
  this._material = undefined;

  this._surface = new QuadtreePrimitive({
    tileProvider: new GlobeSurfaceTileProvider({
      terrainProvider: terrainProvider,
      imageryLayers: imageryLayerCollection,
      surfaceShaderSet: this._surfaceShaderSet,
      vectorProvider,
    }),
  });

  this._terrainProvider = terrainProvider;
  this._terrainProviderChanged = new Event();

  this._vectorProvider = vectorProvider;

  this._undergroundColor = Color.clone(Color.BLACK);
  this._undergroundColorAlphaByDistance = new NearFarScalar(
    ellipsoid.maximumRadius / 1000.0,
    0.0,
    ellipsoid.maximumRadius / 5.0,
    1.0,
  );

  this._translucency = new GlobeTranslucency();

  makeShadersDirty(this);

  /**
   * 决定地球模型是否显示。
   *
   * @type {boolean}
   * @default true
   */
  this.show = true;

  this._oceanNormalMapResourceDirty = true;
  this._oceanNormalMapResource = new Resource({
    url: buildModuleUrl("Assets/Textures/waterNormalsSmall.jpg"),
  });

  /**
   * 用于驱动细节级别优化的屏幕空间误差最大值。更高的
   * 值会提供更好的性能，但视觉质量会降低。
   *
   * @type {number}
   * @default 2
   */
  this.maximumScreenSpaceError = 2;

  /**
   * 地形瓦片缓存的大小，以瓦片数量表示。超出此数量的任何额外
   * 瓦片将在不需要渲染当前帧时释放。更大的数量会消耗更多内存，但能更快显示细节
   * 例如，在缩小缩放后再次放大时。
   * 获取或设置被视为“过多”的加载子瓦片的数量。
   *
   * @type {number}
   * @default 100
   */
  this.tileCacheSize = 100;

  /**
   * 获取或设置认为“过多”的加载子瓦片的数量。
   * 如果某个瓦片有过多的加载子瓦片，该瓦片将在其所有子瓦片加载和渲染之前被加载和渲染。这意味着用户会收到更多反馈，但整体加载时间会延长。将此值设为0会导致每个
   * 瓦片级别依次加载，显著增加加载时间。将其设置为较大的数字（例如1000）会最小化加载的瓦片数量，但可能导致
   * 在长时间等待后一次性显示所有细节。
   * 获取或设置指示渲染瓦片的祖先是否应预加载的值。
   * 将此值设为true可优化缩小缩放体验，并在平移时在新暴露区域提供更多细节。缺点是需要加载更多瓦片。
   * 获取或设置指示渲染瓦片的兄弟瓦片是否应预加载的值。
   * @type {number}
   * @default 20
   */
  this.loadingDescendantLimit = 20;

  /**
   * 将此值设为true会导致与渲染瓦片具有相同父节点的瓦片被加载，即使它们被剔除。将此值设为true可能在
   * 加载更多瓦片的情况下提供更好的平移体验。
   * 使用什么颜色来高亮显示地形填充瓦片。如果未定义，填充瓦片不会被高亮。Alpha值用于与瓦片的
   * @type {boolean}
   * @default true
   */
  this.preloadAncestors = true;

  /**
   * 实际颜色进行透明度混合。由于地形填充瓦片并不代表实际地形表面，
   * 在某些应用中，通过视觉方式表明它们不可信可能很有用。
   * 使用场景的光源为地球模型提供照明。
   * cost of loading more tiles.
   * @type {boolean}
   * @default false
   */
  this.preloadSiblings = false;

  /**
   * The color to use to highlight terrain fill tiles. If undefined, fill tiles are not
   * highlighted at all. The alpha value is used to alpha blend with the tile's
   * actual color. Because terrain fill tiles do not represent the actual terrain surface,
   * it may be useful in some applications to indicate visually that they are not to be trusted.
   * @type {Color}
   * @default undefined
   */
  this.fillHighlightColor = undefined;

  /**
   * Enable lighting the globe with the scene's light source.
   *
   * @type {boolean}
   * @default false
   */
  this.enableLighting = false;

  /**
   * 用于调整地形朗伯光照的乘数。
   * 该数值乘以 GlobeFS.glsl 中 <code>czm_getLambertDiffuse</code> 的结果。
   * 此参数仅在 <code>enableLighting</code> 为 <code>true</code> 时生效。
   *
   * @type {number}
   * @default 0.9
   */
  this.lambertDiffuseMultiplier = 0.9;

  /**
   * 启用大气和雾的动态光照效果。此效果仅在
   * <code>enableLighting</code> 为 <code>true</code> 时生效。
   *
   * @type {boolean}
   * @default true
   */
  this.dynamicAtmosphereLighting = true;

  /**
   * 动态大气光照是否使用太阳方向而非场景的光方向。此参数仅在 <code>enableLighting</code> 和
   * <code>dynamicAtmosphereLighting</code> 为 <code>true</code> 时生效。
   * 启用从 <code>lightingFadeInDistance</code> 到 <code>lightingFadeOutDistance</code> 距离内观看时绘制在地球上的地面大气效果。
   *
   * @type {boolean}
   * @default false
   */
  this.dynamicAtmosphereLightingFromSun = false;

  /**
   * 当使用 WGS84 椭球体时生效，否则无效。
   *
   * @type {boolean}
   * @default true 用于计算地面大气颜色的光强度。
   */
  this.showGroundAtmosphere = Ellipsoid.WGS84.equals(ellipsoid);

  /**
   * 用于计算地面大气颜色的大气散射方程中使用的光强。
   *
   * @type {number}
   * @default 10.0
   */
  this.atmosphereLightIntensity = 10.0;

  /**
   * 用于地面大气大气散射方程的瑞利散射系数。
   *
   * @type {Cartesian3}
   * @default Cartesian3(5.5e-6, 13.0e-6, 28.4e-6)
   */
  this.atmosphereRayleighCoefficient = new Cartesian3(5.5e-6, 13.0e-6, 28.4e-6);

  /**
   * 用于地面大气大气散射方程的米氏散射系数。
   *
   * @type {Cartesian3}
   * @default Cartesian3(21e-6, 21e-6, 21e-6)
   */
  this.atmosphereMieCoefficient = new Cartesian3(21e-6, 21e-6, 21e-6);

  /**
   * 用于地面大气大气散射方程的瑞利尺度高度，单位：米。
   *
   * @type {number}
   * @default 10000.0
   */
  this.atmosphereRayleighScaleHeight = 10000.0;

  /**
   * 用于地面大气大气散射方程的米氏尺度高度，单位：米。
   *
   * @type {number}
   * @default 3200.0
   */
  this.atmosphereMieScaleHeight = 3200.0;

  /**
   * 考虑用于米氏散射的介质各向异性。
   * <p>
   * 有效值在 -1.0 到 1.0 之间。
   * </p>
   * @type {number}
   * @default 0.9
   */
  this.atmosphereMieAnisotropy = 0.9;

  /**
   * 所有物体被照亮的距离。此参数仅在
   * <code>enableLighting</code> 或 <code>showGroundAtmosphere</code> 为 <code>true</code> 时生效。
   *
   * @type {number}
   * @default 1/2 * pi * 椭球体最小半径。
   */
  this.lightingFadeOutDistance =
    CesiumMath.PI_OVER_TWO * ellipsoid.minimumRadius;

  /**
   * 照明恢复的距离。此参数仅在
   * <code>enableLighting</code> 或 <code>showGroundAtmosphere</code> 为 <code>true</code> 时生效。
   *
   * @type {number}
   * @default pi * 椭球体最小半径。
   */
  this.lightingFadeInDistance = CesiumMath.PI * ellipsoid.minimumRadius;

  /**
   * 从地面大气的夜色逐渐消失变为有光的地面大气的距离。
   * 此参数仅在 <code>showGroundAtmosphere</code>、<code>enableLighting</code> 和
   * <code>dynamicAtmosphereLighting</code> 为 <code>true</code> 时生效。
   *
   * @type {number}
   * @default 1/2 * pi * 椭球体最小半径。
   */
  this.nightFadeOutDistance = CesiumMath.PI_OVER_TWO * ellipsoid.minimumRadius;

  /**
   * 从地面大气的夜色逐渐变为无光的地面大气的距离。
   * 此参数仅在 <code>showGroundAtmosphere</code>、<code>enableLighting</code> 和
   * <code>dynamicAtmosphereLighting</code> 为 <code>true</code>。
   *
   * @type {number}
   * @default 5/2 * pi * 椭球体的最小半径
   */
  this.nightFadeInDistance =
    5.0 * CesiumMath.PI_OVER_TWO * ellipsoid.minimumRadius;

  /**
   * 如果应在地球表面区域显示动画波浪效果，则为真。
   * 被水覆盖；否则为假。如果
   * <code>terrainProvider</code> 未提供水掩模，则该属性被忽略。
   *
   * @type {boolean}
   * @default true
   */
  this.showWaterEffect = true;

  /**
   * 如果像广告牌、多线、标签等原语应针对地形表面进行深度测试，则为真；否则如果这些原语应始终在地形之上显示，则为假。
   * 深度测试原语与地形之间的缺点是，轻微的数值噪声或地形细节级别变化有时会导致本应位于表面的原语消失在其下方。
   * 确定地球是否从光源投射或接收阴影。设置地球投射阴影可能会影响性能，因为地形需要从光源视角重新渲染。
   * 目前只有可见的地形会投射阴影。默认情况下，地球不投射阴影。
   * switched can sometimes make a primitive that should be on the surface disappear underneath it.
   *
   * @type {boolean}
   * @default false
   *
   */
  this.depthTestAgainstTerrain = false;

  /**
   * Determines whether the globe casts or receives shadows from light sources. Setting the globe
   * to cast shadows may impact performance since the terrain is rendered again from the light's perspective.
   * Currently only terrain that is in view casts shadows. By default the globe does not cast shadows.
   *
   * @type {ShadowMode}
   * @default ShadowMode.RECEIVE_ONLY
   */
  this.shadows = ShadowMode.RECEIVE_ONLY;

  /**
   * 应用于大气的色调偏移。默认为 0.0（无偏移）。
   * 色调偏移为 1.0 表示所有色调完全旋转。
   * @type {number}
   * @default 0.0
   */
  this.atmosphereHueShift = 0.0;

  /**
   * 应用于大气的饱和度偏移。默认为 0.0（无偏移）。
   * 饱和度偏移为 -1.0 时为单色。
   * @type {number}
   * @default 0.0
   */
  this.atmosphereSaturationShift = 0.0;

  /**
   * 应用于大气的亮度偏移。默认为 0.0（无偏移）。
   * 亮度偏移为 -1.0 为完全黑暗，此时空间细节会显现出来。
   * @type {number}
   * @default 0.0
   */
  this.atmosphereBrightnessShift = 0.0;

  /**
   * 是否显示地形边缘。地形边缘是从瓦片边缘向下延伸的几何图形，用于隐藏相邻瓦片之间的接缝。
   * 当相机在地下或启用半透明效果时，边缘始终被隐藏。
   *
   * @type {boolean}
   * @default true
   */
  this.showSkirts = true;

  /**
   * 是否剔除背向视角的地形。当相机在地下或启用半透明效果时，背向视角不会被剔除。
   *
   * @type {boolean}
   * @default true
   */
  this.backFaceCulling = true;

  this._oceanNormalMap = undefined;
  this._zoomedOutOceanSpecularIntensity = undefined;

  /**
   * 确定顶点阴影的暗度。
   * 此设置仅在 <code>enableLighting</code> 为 <code>true</code> 时生效。
   *
   * @type {number}
   * @default 0.3
   */
  this.vertexShadowDarkness = 0.3;
}

Object.defineProperties(Globe.prototype, {
  /**
   * 获取描述该地球形状的椭球体。
   * @memberof Globe.prototype
   * @type {Ellipsoid}
   */
  ellipsoid: {
    get: function () {
      return this._ellipsoid;
    },
  },
  /**
   * 获取将在此地球上渲染的影像图层集合。
   * @memberof Globe.prototype
   * @type {ImageryLayerCollection}
   */
  imageryLayers: {
    get: function () {
      return this._imageryLayerCollection;
    },
  },
  /**
   * 获取在影像图层添加、显示、隐藏、移动或移除时触发的事件。
   *
   * @memberof Globe.prototype
   * @type {Event}
   * @readonly
   */
  imageryLayersUpdatedEvent: {
    get: function () {
      return this._surface.tileProvider.imageryLayersUpdatedEvent;
    },
  },
  /**
   * 当瓦片加载队列为空时返回 <code>true</code>，否则返回 <code>false</code>。当加载队列为空时，
   * 当前视图所需的全地形和影像数据已加载。
   * @memberof Globe.prototype
   * @type {boolean}
   * @readonly
   */
  tilesLoaded: {
    get: function () {
      if (!defined(this._surface)) {
        return true;
      }
      return (
        this._surface._tileLoadQueueHigh.length === 0 &&
        this._surface._tileLoadQueueMedium.length === 0 &&
        this._surface._tileLoadQueueLow.length === 0
      );
    },
  },
  /**
   * 在没有影像数据时，用于设置或修改地球颜色。
   * @memberof Globe.prototype
   * @type {Color}
   */
  baseColor: {
    get: function () {
      return this._surface.tileProvider.baseColor;
    },
    set: function (value) {
      this._surface.tileProvider.baseColor = value;
    },
  },
  /**
   * 一个属性，指定一个 {@link ClippingPlaneCollection}，用于选择性地禁用每个平面外侧的渲染。
   *
   * @memberof Globe.prototype
   * @type {ClippingPlaneCollection}
   */
  clippingPlanes: {
    get: function () {
      return this._surface.tileProvider.clippingPlanes;
    },
    set: function (value) {
      this._surface.tileProvider.clippingPlanes = value;
    },
  },
  /**
   * 一个属性，指定一个 {@link ClippingPolygonCollection}，用于选择性地禁用多边形列表内部或外部的渲染。
   *
   * @memberof Globe.prototype
   * @type {ClippingPolygonCollection}
   */
  clippingPolygons: {
    get: function () {
      return this._surface.tileProvider.clippingPolygons;
    },
    set: function (value) {
      this._surface.tileProvider.clippingPolygons = value;
    },
  },
  /**
   * 一个属性，指定一个 {@link Rectangle}，用于限制地球在特定的地图区域进行渲染。
   * 默认设置为地图坐标的最大范围。
   *
   * @memberof Globe.prototype
   * @type {Rectangle}
   * @default {@link Rectangle.MAX_VALUE}
   */
  cartographicLimitRectangle: {
    get: function () {
      return this._surface.tileProvider.cartographicLimitRectangle;
    },
    set: function (value) {
      if (!defined(value)) {
        value = Rectangle.clone(Rectangle.MAX_VALUE);
      }
      this._surface.tileProvider.cartographicLimitRectangle = value;
    },
  },
  /**
   * 用于渲染海洋波浪的正常映射。设置此属性将
   * 只有在配置的地形提供器包含水掩模时才会生效。
   * @memberof Globe.prototype
   * @type {string}
   * @default buildModuleUrl('Assets/Textures/waterNormalsSmall.jpg')
   */
  oceanNormalMapUrl: {
    get: function () {
      return this._oceanNormalMapResource.url;
    },
    set: function (value) {
      this._oceanNormalMapResource.url = value;
      this._oceanNormalMapResourceDirty = true;
    },
  },
  /**
   * 为这个地球提供表面几何数据的地形提供器。
   * @type {TerrainProvider}
   *
   * @memberof Globe.prototype
   * @type {TerrainProvider}
   *
   */
  terrainProvider: {
    get: function () {
      return this._terrainProvider;
    },
    set: function (value) {
      if (value !== this._terrainProvider) {
        this._terrainProvider = value;
        if (defined(value)) {
          this._vectorProvider.tilingScheme = value.tilingScheme;
        }
        this._terrainProviderChanged.raiseEvent(value);
        if (defined(this._material)) {
          makeShadersDirty(this);
        }
      }
    },
  },
  /**
   * 当地形提供器发生变化时，会触发一个事件。
   *
   * @memberof Globe.prototype
   * @type {Event}
   * @readonly
   */
  terrainProviderChanged: {
    get: function () {
      return this._terrainProviderChanged;
    },
  },
  /**
   * @memberof Globe.prototype
   * @type {VectorProvider}
   * @ignore
   */
  vectorProvider: {
    get: function () {
      return this._vectorProvider;
    },
  },
  /**
   * 当上次渲染帧之后，瓦片加载队列的长度发生变化时，会触发一个事件。当加载队列为空时，
   * 当前视图所需的全地形和影像数据已加载。该事件会传递新的瓦片加载队列长度。
   *
   * @memberof Globe.prototype
   * @type {Event}
   */
  tileLoadProgressEvent: {
    get: function () {
      return this._surface.tileLoadProgressEvent;
    },
  },

  /**
   * 用于设置或修改地球的材质外观。可以是几个内置的 {@link Material} 对象之一，也可以是一个由
   * {@link https://github.com/CesiumGS/cesium/wiki/Fabric|Fabric} 编写的自定义材质。
   * @memberof Globe.prototype
   * @type {Material | undefined}
   */
  material: {
    get: function () {
      return this._material;
    },
    set: function (material) {
      if (this._material !== material) {
        this._material = material;
        makeShadersDirty(this);
      }
    },
  },

  /**
   * 当相机在地下或地球半透明时，用于渲染地球背面的颜色。根据相机距离，该颜色会与地球颜色混合。
   * 要禁用地下着色，请将 <code>undergroundColor</code> 设置为 <code>undefined</code>。
   * <br /><br />
   * 用于设置或修改 {@link Globe#undergroundColor} 与地球颜色混合的近距和远距距离。
   *
   * @memberof Globe.prototype
   * @type {Color}
   * @default {@link Color.BLACK}
   *
   * @see Globe#undergroundColorAlphaByDistance
   */
  undergroundColor: {
    get: function () {
      return this._undergroundColor;
    },
    set: function (value) {
      this._undergroundColor = Color.clone(value, this._undergroundColor);
    },
  },

  /**
   * Alpha 值将在 {@link NearFarScalar#nearValue} 和
   * The alpha will interpolate between the {@link NearFarScalar#nearValue} and
   * {@link NearFarScalar#farValue} while the camera distance falls within the lower and upper bounds
   * of the specified {@link NearFarScalar#near} and {@link NearFarScalar#far}.
   * 当相机在椭球体上方时，距离计算基于椭球体上最近的
   * 点，而非相机位置。
   * <br /> <br />
   * 用于控制地球半透明度的属性。
   * point on the ellipsoid instead of the camera's position.
   *
   * @memberof Globe.prototype
   * @type {NearFarScalar}
   *
   * @see Globe#undergroundColor
   *
   */
  undergroundColorAlphaByDistance: {
    get: function () {
      return this._undergroundColorAlphaByDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value.far < value.near) {
        throw new DeveloperError(
          "far distance must be greater than near distance.",
        );
      }
      //>>includeEnd('debug');
      this._undergroundColorAlphaByDistance = NearFarScalar.clone(
        value,
        this._undergroundColorAlphaByDistance,
      );
    },
  },

  /**
   * Properties for controlling globe translucency.
   *
   * @memberof Globe.prototype
   * @type {GlobeTranslucency}
   */
  translucency: {
    get: function () {
      return this._translucency;
    },
  },
});

function makeShadersDirty(globe) {
  const defines = [];

  const requireNormals =
    defined(globe._material) &&
    (defined(globe._material.shaderSource.match(/slope/)) ||
      defined(globe._material.shaderSource.match("normalEC")));

  const fragmentSources = [AtmosphereCommon, GroundAtmosphere];
  if (
    defined(globe._material) &&
    (!requireNormals || globe._terrainProvider.hasVertexNormals)
  ) {
    fragmentSources.push(globe._material.shaderSource);
    defines.push("APPLY_MATERIAL");
    globe._surface._tileProvider.materialUniformMap = globe._material._uniforms;
  } else {
    globe._surface._tileProvider.materialUniformMap = undefined;
  }
  fragmentSources.push(GlobeFS);

  globe._surfaceShaderSet.baseVertexShaderSource = new ShaderSource({
    sources: [AtmosphereCommon, GroundAtmosphere, GlobeVS],
    defines: defines,
  });

  globe._surfaceShaderSet.baseFragmentShaderSource = new ShaderSource({
    sources: fragmentSources,
    defines: defines,
  });
  globe._surfaceShaderSet.material = globe._material;
}

function createComparePickTileFunction(rayOrigin) {
  return function (a, b) {
    const aDist = BoundingSphere.distanceSquaredTo(
      a.pickBoundingSphere,
      rayOrigin,
    );
    const bDist = BoundingSphere.distanceSquaredTo(
      b.pickBoundingSphere,
      rayOrigin,
    );

    return aDist - bDist;
  };
}

const scratchArray = [];
const scratchSphereIntersectionResult = {
  start: 0.0,
  stop: 0.0,
};

/**
 * 查找射线与渲染后的地球表面之间的交点。射线必须以世界坐标形式给出。
 *
 * @param {Ray} ray 用于检测相交的射线。
 * @param {Scene} scene 场景环境。
 * @param {boolean} [cullBackFaces=true] 设置为 true 可忽略背面。
 * @param {Cartesian3} [result] 用于存储结果的对象。
 * @returns {Cartesian3|undefined} The 如果未找到交点，则返回 <code>undefined</code>。返回的位置为 2D 和 Columbus View 下的投影坐标。
 *
 * @private
 */
Globe.prototype.pickWorldCoordinates = function (
  ray,
  scene,
  cullBackFaces,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(ray)) {
    throw new DeveloperError("ray is required");
  }
  if (!defined(scene)) {
    throw new DeveloperError("scene is required");
  }
  //>>includeEnd('debug');

  cullBackFaces = cullBackFaces ?? true;

  const mode = scene.mode;
  const projection = scene.mapProjection;

  const sphereIntersections = scratchArray;
  sphereIntersections.length = 0;

  for (const tile of this._surface._tilesRenderedThisFrame) {
    const surfaceTile = tile.data;

    if (!defined(surfaceTile)) {
      continue;
    }

    let boundingVolume = surfaceTile.pickBoundingSphere;
    if (mode !== SceneMode.SCENE3D) {
      surfaceTile.pickBoundingSphere = boundingVolume =
        BoundingSphere.fromRectangleWithHeights2D(
          tile.rectangle,
          projection,
          surfaceTile.tileBoundingRegion.minimumHeight,
          surfaceTile.tileBoundingRegion.maximumHeight,
          boundingVolume,
        );
      Cartesian3.fromElements(
        boundingVolume.center.z,
        boundingVolume.center.x,
        boundingVolume.center.y,
        boundingVolume.center,
      );
    } else if (defined(surfaceTile.renderedMesh)) {
      BoundingSphere.clone(
        surfaceTile.tileBoundingRegion.boundingSphere,
        boundingVolume,
      );
    } else {
      // So wait how did we render this thing then? It shouldn't be possible to get here.
      continue;
    }

    const boundingSphereIntersection = IntersectionTests.raySphere(
      ray,
      boundingVolume,
      scratchSphereIntersectionResult,
    );
    if (defined(boundingSphereIntersection)) {
      sphereIntersections.push(surfaceTile);
    }
  }

  sphereIntersections.sort(createComparePickTileFunction(ray.origin));

  let intersection;
  const length = sphereIntersections.length;
  for (let i = 0; i < length; ++i) {
    intersection = sphereIntersections[i].pick(
      ray,
      scene.mode,
      scene.mapProjection,
      cullBackFaces,
      result,
    );
    if (defined(intersection)) {
      break;
    }
  }

  return intersection;
};

const cartoScratch = new Cartographic();
/**
 * 查找射线与渲染后的地球表面之间的交点。射线必须以世界坐标形式给出。
 *
 * @param {Ray} ray 用于检测相交的射线。
 * @param {Scene} scene 场景环境。
 * @param {Cartesian3} [result] 用于存储结果的对象。
 * @returns {Cartesian3|undefined} The 如果未找到交点，则返回 <code>undefined</code>。
 *
 * @example
 * // 查找通过像素点的射线与地球的交点
 * const ray = viewer.camera.getPickRay(windowCoordinates);
 * const intersection = globe.pick(ray, scene);
 */
Globe.prototype.pick = function (ray, scene, result) {
  result = this.pickWorldCoordinates(ray, scene, true, result);
  if (defined(result) && scene.mode !== SceneMode.SCENE3D) {
    result = Cartesian3.fromElements(result.y, result.z, result.x, result);
    const carto = scene.mapProjection.unproject(result, cartoScratch);
    result = this._ellipsoid.cartographicToCartesian(carto, result);
  }

  return result;
};

const scratchGetHeightCartesian = new Cartesian3();
const scratchGetHeightIntersection = new Cartesian3();
const scratchGetHeightCartographic = new Cartographic();
const scratchGetHeightRay = new Ray();

function tileIfContainsCartographic(tile, cartographic) {
  return defined(tile) && Rectangle.contains(tile.rectangle, cartographic)
    ? tile
    : undefined;
}

/**
 * 获取特定地图坐标处的表面高度。
 *
 * @param {Cartographic} cartographic 用于查找高度的地图坐标。
 * @returns {number|undefined} The 该地图坐标的高度，或无法找到时返回 <code>undefined</code>。
 */
Globe.prototype.getHeight = function (cartographic) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(cartographic)) {
    throw new DeveloperError("cartographic is required");
  }
  //>>includeEnd('debug');

  const levelZeroTiles = this._surface._levelZeroTiles;
  if (!defined(levelZeroTiles)) {
    return;
  }

  let tile;
  let i;

  const length = levelZeroTiles.length;
  for (i = 0; i < length; ++i) {
    tile = levelZeroTiles[i];
    if (Rectangle.contains(tile.rectangle, cartographic)) {
      break;
    }
  }

  if (i >= length) {
    return undefined;
  }

  let tileWithMesh = tile;

  while (defined(tile)) {
    tile =
      tileIfContainsCartographic(tile._southwestChild, cartographic) ||
      tileIfContainsCartographic(tile._southeastChild, cartographic) ||
      tileIfContainsCartographic(tile._northwestChild, cartographic) ||
      tile._northeastChild;

    if (
      defined(tile) &&
      defined(tile.data) &&
      defined(tile.data.renderedMesh)
    ) {
      tileWithMesh = tile;
    }
  }

  tile = tileWithMesh;

  // This tile was either rendered or culled.
  // It is sometimes useful to get a height from a culled tile,
  // e.g. when we're getting a height in order to place a billboard
  // on terrain, and the camera is looking at that same billboard.
  // The culled tile must have a valid mesh, though.
  if (
    !defined(tile) ||
    !defined(tile.data) ||
    !defined(tile.data.renderedMesh)
  ) {
    // Tile was not rendered (culled).
    return undefined;
  }

  const projection = this._surface._tileProvider.tilingScheme.projection;
  const ellipsoid = this._surface._tileProvider.tilingScheme.ellipsoid;

  //cartesian has to be on the ellipsoid surface for `ellipsoid.geodeticSurfaceNormal`
  const cartesian = Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    0.0,
    ellipsoid,
    scratchGetHeightCartesian,
  );

  const ray = scratchGetHeightRay;
  const surfaceNormal = ellipsoid.geodeticSurfaceNormal(
    cartesian,
    ray.direction,
  );

  // Try to find the intersection point between the surface normal and z-axis.
  // minimum height (-11500.0) for the terrain set, need to get this information from the terrain provider
  const rayOrigin = ellipsoid.getSurfaceNormalIntersectionWithZAxis(
    cartesian,
    11500.0,
    ray.origin,
  );

  // Theoretically, not with Earth datums, the intersection point can be outside the ellipsoid
  if (!defined(rayOrigin)) {
    // intersection point is outside the ellipsoid, try other value
    // minimum height (-11500.0) for the terrain set, need to get this information from the terrain provider
    let minimumHeight;
    if (defined(tile.data.tileBoundingRegion)) {
      minimumHeight = tile.data.tileBoundingRegion.minimumHeight;
    }
    const magnitude = Math.min(minimumHeight ?? 0.0, -11500.0);

    // multiply by the *positive* value of the magnitude
    const vectorToMinimumPoint = Cartesian3.multiplyByScalar(
      surfaceNormal,
      Math.abs(magnitude) + 1,
      scratchGetHeightIntersection,
    );
    Cartesian3.subtract(cartesian, vectorToMinimumPoint, ray.origin);
  }

  const intersection = tile.data.pick(
    ray,
    // Globe height is the same at a given cartographic regardless of the scene mode,
    // but the ray is constructed via a surface normal (which assumes 3D), so pick in 3D mode.
    SceneMode.SCENE3D,
    projection,
    false,
    scratchGetHeightIntersection,
  );
  if (!defined(intersection)) {
    return undefined;
  }

  return ellipsoid.cartesianToCartographic(
    intersection,
    scratchGetHeightCartographic,
  ).height;
};

/**
 * @private
 */
Globe.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  if (frameState.passes.render) {
    this._surface.update(frameState);
  }
};

/**
 * @private
 */
Globe.prototype.beginFrame = function (frameState) {
  const surface = this._surface;
  const tileProvider = surface.tileProvider;
  const terrainProvider = this.terrainProvider;
  const hasWaterMask =
    defined(terrainProvider) &&
    terrainProvider.hasWaterMask &&
    terrainProvider.hasWaterMask;

  if (hasWaterMask && this._oceanNormalMapResourceDirty) {
    // url changed, load new normal map asynchronously
    this._oceanNormalMapResourceDirty = false;
    const oceanNormalMapResource = this._oceanNormalMapResource;
    const oceanNormalMapUrl = oceanNormalMapResource.url;
    if (defined(oceanNormalMapUrl)) {
      const that = this;
      oceanNormalMapResource.fetchImage().then(function (image) {
        if (oceanNormalMapUrl !== that._oceanNormalMapResource.url) {
          // url changed while we were loading
          return;
        }

        that._oceanNormalMap =
          that._oceanNormalMap && that._oceanNormalMap.destroy();
        that._oceanNormalMap = new Texture({
          context: frameState.context,
          source: image,
        });
      });
    } else {
      this._oceanNormalMap =
        this._oceanNormalMap && this._oceanNormalMap.destroy();
    }
  }

  const pass = frameState.passes;
  const mode = frameState.mode;

  if (pass.render) {
    if (this.showGroundAtmosphere) {
      this._zoomedOutOceanSpecularIntensity = 0.4;
    } else {
      this._zoomedOutOceanSpecularIntensity = 0.5;
    }

    surface.maximumScreenSpaceError = this.maximumScreenSpaceError;
    surface.tileCacheSize = this.tileCacheSize;
    surface.loadingDescendantLimit = this.loadingDescendantLimit;
    surface.preloadAncestors = this.preloadAncestors;
    surface.preloadSiblings = this.preloadSiblings;

    tileProvider.terrainProvider = this.terrainProvider;
    tileProvider.lightingFadeOutDistance = this.lightingFadeOutDistance;
    tileProvider.lightingFadeInDistance = this.lightingFadeInDistance;
    tileProvider.nightFadeOutDistance = this.nightFadeOutDistance;
    tileProvider.nightFadeInDistance = this.nightFadeInDistance;
    tileProvider.zoomedOutOceanSpecularIntensity =
      mode === SceneMode.SCENE3D ? this._zoomedOutOceanSpecularIntensity : 0.0;
    tileProvider.hasWaterMask = hasWaterMask;
    tileProvider.showWaterEffect = this.showWaterEffect;
    tileProvider.oceanNormalMap = this._oceanNormalMap;
    tileProvider.enableLighting = this.enableLighting;
    tileProvider.dynamicAtmosphereLighting = this.dynamicAtmosphereLighting;
    tileProvider.dynamicAtmosphereLightingFromSun =
      this.dynamicAtmosphereLightingFromSun;
    tileProvider.showGroundAtmosphere = this.showGroundAtmosphere;
    tileProvider.atmosphereLightIntensity = this.atmosphereLightIntensity;
    tileProvider.atmosphereRayleighCoefficient =
      this.atmosphereRayleighCoefficient;
    tileProvider.atmosphereMieCoefficient = this.atmosphereMieCoefficient;
    tileProvider.atmosphereRayleighScaleHeight =
      this.atmosphereRayleighScaleHeight;
    tileProvider.atmosphereMieScaleHeight = this.atmosphereMieScaleHeight;
    tileProvider.atmosphereMieAnisotropy = this.atmosphereMieAnisotropy;
    tileProvider.shadows = this.shadows;
    tileProvider.hueShift = this.atmosphereHueShift;
    tileProvider.saturationShift = this.atmosphereSaturationShift;
    tileProvider.brightnessShift = this.atmosphereBrightnessShift;
    tileProvider.fillHighlightColor = this.fillHighlightColor;
    tileProvider.showSkirts = this.showSkirts;
    tileProvider.backFaceCulling = this.backFaceCulling;
    tileProvider.vertexShadowDarkness = this.vertexShadowDarkness;
    tileProvider.undergroundColor = this._undergroundColor;
    tileProvider.undergroundColorAlphaByDistance =
      this._undergroundColorAlphaByDistance;
    tileProvider.lambertDiffuseMultiplier = this.lambertDiffuseMultiplier;

    surface.beginFrame(frameState);
  }
};

/**
 * @private
 */
Globe.prototype.render = function (frameState) {
  if (!this.show) {
    return;
  }

  if (defined(this._material)) {
    this._material.update(frameState.context);
  }

  this._surface.render(frameState);
};

/**
 * @private
 */
Globe.prototype.endFrame = function (frameState) {
  if (!this.show) {
    return;
  }

  if (frameState.passes.render) {
    this._surface.endFrame(frameState);
  }
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} True 如果此对象被销毁，则不应使用它；调用除
 *
 * @see Globe#destroy
 */
Globe.prototype.isDestroyed = function () {
  return false;
};

/**
 * 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 如果对象被销毁，即调用了 destroy() 方法，则不应使用它。
 * <br /><br />
 * 一旦对象被销毁，就不应再使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 应将返回值 (<code>undefined</code>) 赋给该对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * globe = globe && globe.destroy();
 *
 * @see Globe#isDestroyed
 */
Globe.prototype.destroy = function () {
  this._surfaceShaderSet =
    this._surfaceShaderSet && this._surfaceShaderSet.destroy();
  this._surface = this._surface && this._surface.destroy();
  this._oceanNormalMap = this._oceanNormalMap && this._oceanNormalMap.destroy();
  return destroyObject(this);
};
export default Globe;