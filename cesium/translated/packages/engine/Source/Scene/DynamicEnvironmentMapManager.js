import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Cartographic,
  Color,
  DeveloperError,
  FixedFrameTransforms,
  Frozen,
  JulianDate,
  Matrix4,
  PixelDatatype,
  PixelFormat,
  defined,
  destroyObject,
} from "@cesium/core";
import SceneMode from "./SceneMode.js";
import ComputeCommand from "../Renderer/ComputeCommand.js";
import ContextLimits from "../Renderer/ContextLimits.js";
import CubeMap from "../Renderer/CubeMap.js";
import Framebuffer from "../Renderer/Framebuffer.js";
import Texture from "../Renderer/Texture.js";
import Sampler from "../Renderer/Sampler.js";
import ShaderProgram from "../Renderer/ShaderProgram.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import TextureMinificationFilter from "../Renderer/TextureMinificationFilter.js";
import Atmosphere from "./Atmosphere.js";
import DynamicAtmosphereLightingType from "./DynamicAtmosphereLightingType.js";
import AtmosphereCommon from "../Shaders/AtmosphereCommon.js";
import ComputeIrradianceFS from "../Shaders/ComputeIrradianceFS.js";
import ComputeRadianceMapFS from "../Shaders/ComputeRadianceMapFS.js";
import ConvolveSpecularMapFS from "../Shaders/ConvolveSpecularMapFS.js";
import ConvolveSpecularMapVS from "../Shaders/ConvolveSpecularMapVS.js";

/**
 * @typedef {object} DynamicEnvironmentMapManager.ConstructorOptions
 * DynamicEnvironmentMapManager 构造器的选项
 * @property {boolean} [enabled=true] 如果为 true，环境图及相关属性将持续更新。
 * @property {number} [mipmapLevels=7] 用于生成镜面反射图的最大 Mipmap 级别数。更多的 Mipmap 级别会产生更高分辨率的镜面反射效果。实际使用的 Mipmap 数量受客户端机器支持的 Cubemap 纹理大小限制。必须至少使用一个 Mipmap 才能生成环境图。
 * @property {number} [maximumSecondsDifference=3600] 创建新环境图前允许的最大时间间隔。
 * @property {number} [maximumPositionEpsilon=1000] 创建新环境图前位置的最大差异，以米为单位。微小的位置差异不会明显影响结果。
 * @property {number} [atmosphereScatteringIntensity=2.0] 从大气中发出的散射光的强度。此值应相对于 {@link Scene.light} 强度进行调整。
 * @property {number} [gamma=1.0] 应用于环境发出的光范围的伽马校正系数。1.0 表示未修改的发光颜色。
 * @property {number} [brightness=1.0] 环境发出的光的亮度。1.0 表示未修改的环境颜色。小于 1.0 会使光线变暗，大于 1.0 则使光线更亮。
 * @property {number} [saturation=1.0] 环境发出的光的饱和度。1.0 表示未修改的环境颜色。小于 1.0 会降低饱和度，大于 1.0 则增加饱和度。
 * @property {Color} [groundColor=DynamicEnvironmentMapManager.AVERAGE_EARTH_GROUND_COLOR] 用于表示地面的纯色。
 * @property {number} [groundAlbedo=0.31] 从地面反射的光的比例。地球的平均反照率为 0.31。
 */

/**
 * 根据场景当前的照明条件在指定位置生成环境图。由此产生多级别的镜面反射图和球谐系数，可用于 {@link ImageBasedLighting} 为模型或瓦片集提供光照效果。
 * @alias DynamicEnvironmentMapManager
 * @constructor
 * @param {DynamicEnvironmentMapManager.ConstructorOptions} [options] 描述初始化选项的对象。
 *
 * @example
 * // 在场景中启用时区环境映射
 * scene.atmosphere.dynamicLighting = Cesium.DynamicAtmosphereLightingType.SUNLIGHT;
 *
 * // 降低方向性照明的贡献
 * scene.light.intensity = 0.5
 *
 * // 增加环境图照明贡献的强度
 * const environmentMapManager = tileset.environmentMapManager;
 * environmentMapManager.atmosphereScatteringIntensity = 3.0;
 *
 * @example
 * // 将模型环境图使用的地面颜色改为森林绿
 * const environmentMapManager = model.environmentMapManager;
 * environmentMapManager.groundColor = Cesium.Color.fromCssColorString("#203b34");
 */
function DynamicEnvironmentMapManager(options) {
  this._position = undefined;

  this._radianceMapDirty = false;
  this._radianceCommandsDirty = false;
  this._convolutionsCommandsDirty = false;
  this._irradianceCommandDirty = false;
  this._irradianceTextureDirty = false;
  this._sphericalHarmonicCoefficientsDirty = false;

  this._shouldRegenerateShaders = false;
  this._shouldReset = false;

  options = options ?? Frozen.EMPTY_OBJECT;

  const mipmapLevels = Math.max(
    Math.floor(
      Math.min(
        options.mipmapLevels ?? 7,
        Math.log2(ContextLimits.maximumCubeMapSize),
      ),
    ),
    0,
  );

  this._mipmapLevels = mipmapLevels;

  const arrayLength = Math.max(mipmapLevels - 1, 0) * 6;
  this._radianceMapComputeCommands = new Array(6);
  this._convolutionComputeCommands = new Array(arrayLength);
  this._irradianceComputeCommand = undefined;

  this._radianceMapFS = undefined;
  this._irradianceMapFS = undefined;
  this._convolveSP = undefined;
  this._va = undefined;

  this._radianceMapTextures = new Array(6);
  this._specularMapTextures = new Array(arrayLength);
  this._radianceCubeMap = undefined;
  this._irradianceMapTexture = undefined;

  this._sphericalHarmonicCoefficients =
    DynamicEnvironmentMapManager.DEFAULT_SPHERICAL_HARMONIC_COEFFICIENTS.slice();

  this._lastTime = new JulianDate();
  const width = Math.max(Math.pow(2, mipmapLevels - 1), 1);
  this._textureDimensions = new Cartesian2(width, width);

  this._radiiAndDynamicAtmosphereColor = new Cartesian3();
  this._sceneEnvironmentMap = undefined;
  this._backgroundColor = undefined;

  // If this DynamicEnvironmentMapManager has an owner, only its owner should update or destroy it.
  // This is because in a Cesium3DTileset multiple models may reference one tileset's DynamicEnvironmentMapManager.
  this._owner = undefined;

  /**
   * 如果为 true，环境地图及相关属性将持续更新。
   * @type {boolean}
   * @default true
   */
  this.enabled = options.enabled ?? true;

  /**
   * 禁用更新。仅用于内部使用。
   * @private
   * @default true
   */
  this.shouldUpdate = true;

  /**
   * 创建新环境地图前允许的最长时间间隔。
   * @type {number}
   * @default 3600
   */
  this.maximumSecondsDifference = options.maximumSecondsDifference ?? 60 * 60;

  /**
   * 创建新环境地图前位置的最大差异，以米为单位。微小的位置差异不会明显影响结果。
   * @type {number}
   * @default 1000
   */
  this.maximumPositionEpsilon = options.maximumPositionEpsilon ?? 1000.0;

  /**
   * 从大气中发出的散射光的强度。此值应相对于 {@link Scene.light} 的强度进行调整。
   * @type {number}
   * @default 2.0
   * @see DirectionalLight.intensity
   * @see SunLight.intensity
   */
  this.atmosphereScatteringIntensity =
    options.atmosphereScatteringIntensity ?? 2.0;

  /**
   * 应用于环境发出的光范围的伽马校正系数。1.0 表示未修改的入射光颜色。
   * @type {number}
   * @default 1.0
   */
  this.gamma = options.gamma ?? 1.0;

  /**
   * 环境发出的光的亮度。1.0 表示未修改的发射环境颜色。小于 1.0 会使光线变暗，而大于 1.0 则使光线变亮。
   * 环境发出的光的饱和度。1.0 表示未修改的发射环境颜色。小于 1.0 会降低饱和度，而大于 1.0 则会提高饱和度。
   * @type {number}
   * @default 1.0
   */
  this.brightness = options.brightness ?? 1.0;

  /**
   * 环境发出的光的饱和度。1.0 表示未修改的发射环境颜色。小于 1.0 会降低饱和度，而大于 1.0 则提高饱和度。
   * 用于表示地面的纯色。
   * @type {number}
   * @default 1.0
   */
  this.saturation = options.saturation ?? 1.0;

  /**
   * 从地面反射的光的比例。地球的平均反照率为 0.31。
   * @type {Color}
   * @default DynamicEnvironmentMapManager.AVERAGE_EARTH_GROUND_COLOR
   */
  this.groundColor =
    options.groundColor ??
    DynamicEnvironmentMapManager.AVERAGE_EARTH_GROUND_COLOR;

  /**
   * 从地面反射的光的百分率。平均地球反照率为 0.31。
   * @type {number}
   * @default 0.31
   */
  this.groundAlbedo = options.groundAlbedo ?? 0.31;
}

Object.defineProperties(DynamicEnvironmentMapManager.prototype, {
  /**
   * 动态环境地图管理器的所有者引用，如果有的话。
   * @memberof DynamicEnvironmentMapManager.prototype
   * @type {object|undefined}
   * @readonly
   * @private
   */
  owner: {
    get: function () {
      return this._owner;
    },
  },

  /**
   * 如果模型着色器需要重新生成以适应更新，则为真。
   * @memberof DynamicEnvironmentMapManager.prototype
   * @type {boolean}
   * @readonly
   * @private
   */
  shouldRegenerateShaders: {
    get: function () {
      return this._shouldRegenerateShaders;
    },
  },

  /**
   * 环境地图生成的中心位置。
   * @memberof DynamicEnvironmentMapManager.prototype
   * @type {Cartesian3|undefined}
   */
  position: {
    get: function () {
      return this._position;
    },
    set: function (value) {
      if (
        Cartesian3.equalsEpsilon(
          value,
          this._position,
          0.0,
          this.maximumPositionEpsilon,
        )
      ) {
        return;
      }

      this._position = Cartesian3.clone(value, this._position);
      this._shouldReset = true;
    },
  },

  /**
   * 计算得到的辐射度图，如果尚未创建则为 <code>undefined</code>。
   * @memberof DynamicEnvironmentMapManager.prototype
   * @type {CubeMap|undefined}
   * @readonly
   * @private
   */
  radianceCubeMap: {
    get: function () {
      return this._radianceCubeMap;
    },
  },

  /**
   * 辐射度立方体映射中可用的最大子采样级别数。
   * @memberof DynamicEnvironmentMapManager.prototype
   * @type {number}
   * @readonly
   * @private
   */
  maximumMipmapLevel: {
    get: function () {
      return this._mipmapLevels;
    },
  },

  /**
   * 用于基于图像的照明漫色度的三阶球谐系数。
   * <p>
   * 共有九个 <code>Cartesian3</code> 系数。
   * 系数的顺序为：L<sub>0,0</sub>、L<sub>1,-1</sub>、L<sub>1,0</sub>、L<sub>1,1</sub>、L<sub>2,-2</sub>、L<sub>2,-1</sub>、L<sub>2,0</sub>、L<sub>2,1</sub>、L<sub>2,2</sub>。
   * </p>
   * @memberof DynamicEnvironmentMapManager.prototype
   * @readonly
   * @type {Cartesian3[]}
   * @see {@link https://graphics.stanford.edu/papers/envmap/envmap.pdf|An Efficient Representation for Irradiance Environment Maps}
   * @private
   */
  sphericalHarmonicCoefficients: {
    get: function () {
      return this._sphericalHarmonicCoefficients;
    },
  },
});

// Internally manage a queue of commands across all instances to prevent too many commands from being added in a single frame and using too much memory at once.
DynamicEnvironmentMapManager._maximumComputeCommandCount = 8; // This value is updated once a context is created.
DynamicEnvironmentMapManager._activeComputeCommandCount = 0;
DynamicEnvironmentMapManager._nextFrameCommandQueue = [];
/**
 * 将命令加入队列。如果可能，将在下一帧的命令列表中添加；否则将加入待处理队列，并在下一帧尝试执行。
 * 待处理的命令
 * @private
 * @param {ComputeCommand} command 创建的命令
 * @param {FrameState} frameState 当前帧状态
 */
DynamicEnvironmentMapManager._queueCommand = (command, frameState) => {
  if (
    DynamicEnvironmentMapManager._activeComputeCommandCount >=
    DynamicEnvironmentMapManager._maximumComputeCommandCount
  ) {
    // Command will instead be scheduled next frame
    DynamicEnvironmentMapManager._nextFrameCommandQueue.push(command);
    return;
  }

  frameState.commandList.push(command);
  DynamicEnvironmentMapManager._activeComputeCommandCount++;
};
/**
 * 如果有任何待处理命令，请为下一帧尽可能多地加入队列。
 * @private
 * @param {FrameState} frameState 当前帧状态
 */
DynamicEnvironmentMapManager._updateCommandQueue = (frameState) => {
  DynamicEnvironmentMapManager._maximumComputeCommandCount = Math.log2(
    ContextLimits.maximumCubeMapSize,
  ); // Scale relative to GPU resources available

  if (
    DynamicEnvironmentMapManager._nextFrameCommandQueue.length > 0 &&
    DynamicEnvironmentMapManager._activeComputeCommandCount <
      DynamicEnvironmentMapManager._maximumComputeCommandCount
  ) {
    let command = DynamicEnvironmentMapManager._nextFrameCommandQueue.shift();
    while (
      defined(command) &&
      DynamicEnvironmentMapManager._activeComputeCommandCount <
        DynamicEnvironmentMapManager._maximumComputeCommandCount
    ) {
      if (command.owner.isDestroyed() || command.canceled) {
        command = DynamicEnvironmentMapManager._nextFrameCommandQueue.shift();
        continue;
      }

      frameState.commandList.push(command);
      DynamicEnvironmentMapManager._activeComputeCommandCount++;
      command = DynamicEnvironmentMapManager._nextFrameCommandQueue.shift();
    }

    if (defined(command)) {
      DynamicEnvironmentMapManager._nextFrameCommandQueue.push(command);
    }
  }
};

/**
 * 如果没有其他所有者，则设置输入 DynamicEnvironmentMapManager 的所有者。
 * 如果设置成功，则销毁所有者的先前 DynamicEnvironmentMapManager。
 * @param {DynamicEnvironmentMapManager} [environmentMapManager] 附加到对象的 DynamicEnvironmentMapManager（或未定义）
 * @param {object} owner 应接收新 DynamicEnvironmentMapManager 的对象
 * @param {string} key 对象引用 DynamicEnvironmentMapManager 的键
 * @private
 */
DynamicEnvironmentMapManager.setOwner = function (
  environmentMapManager,
  owner,
  key,
) {
  // Don't destroy the DynamicEnvironmentMapManager if it's already owned by newOwner
  if (environmentMapManager === owner[key]) {
    return;
  }
  // Destroy the existing DynamicEnvironmentMapManager, if any
  owner[key] = owner[key] && owner[key].destroy();
  if (defined(environmentMapManager)) {
    //>>includeStart('debug', pragmas.debug);
    if (defined(environmentMapManager._owner)) {
      throw new DeveloperError(
        "DynamicEnvironmentMapManager should only be assigned to one object",
      );
    }
    //>>includeEnd('debug');
    environmentMapManager._owner = owner;
    owner[key] = environmentMapManager;
  }
};

/**
 * 取消正在进行的命令，并将环境图标记为脏状态。
 * @private
 */
DynamicEnvironmentMapManager.prototype.reset = function () {
  let length = this._radianceMapComputeCommands.length;
  for (let i = 0; i < length; ++i) {
    if (defined(this._radianceMapComputeCommands[i])) {
      this._radianceMapComputeCommands[i].canceled = true;
    }
    this._radianceMapComputeCommands[i] = undefined;
  }

  length = this._convolutionComputeCommands.length;
  for (let i = 0; i < length; ++i) {
    if (defined(this._convolutionComputeCommands[i])) {
      this._convolutionComputeCommands[i].canceled = true;
    }
    this._convolutionComputeCommands[i] = undefined;
  }

  if (defined(this._irradianceComputeCommand)) {
    this._irradianceComputeCommand.canceled = true;
    this._irradianceComputeCommand = undefined;
  }

  this._radianceMapDirty = true;
  this._radianceCommandsDirty = true;
  this._convolutionsCommandsDirty = false;
  this._irradianceCommandDirty = false;
};

const scratchPackedAtmosphere = new Cartesian3();
const scratchSurfacePosition = new Cartesian3();

/**
 * 更新大气属性，如果环境图需要重新生成则返回 true。
 * @param {DynamicEnvironmentMapManager} manager 此管理器
 * @param {FrameState} frameState 当前帧状态
 * @returns {boolean} true 如果环境图需要重新生成。
 * @private
 */
function atmosphereNeedsUpdate(manager, frameState) {
  const position = manager._position;
  const atmosphere = frameState.atmosphere;

  const ellipsoid = frameState.mapProjection.ellipsoid;
  const surfacePosition = ellipsoid.scaleToGeodeticSurface(
    position,
    scratchSurfacePosition,
  );
  const outerEllipsoidScale = 1.025;

  // Pack outer radius, inner radius, and dynamic atmosphere flag
  const radiiAndDynamicAtmosphereColor = scratchPackedAtmosphere;
  const radius = defined(surfacePosition)
    ? Cartesian3.magnitude(surfacePosition)
    : ellipsoid.maximumRadius;
  radiiAndDynamicAtmosphereColor.x = radius * outerEllipsoidScale;
  radiiAndDynamicAtmosphereColor.y = radius;
  radiiAndDynamicAtmosphereColor.z = atmosphere.dynamicLighting;

  if (
    !Cartesian3.equalsEpsilon(
      manager._radiiAndDynamicAtmosphereColor,
      radiiAndDynamicAtmosphereColor,
    ) ||
    frameState.environmentMap !== manager._sceneEnvironmentMap ||
    frameState.backgroundColor !== manager._backgroundColor
  ) {
    Cartesian3.clone(
      radiiAndDynamicAtmosphereColor,
      manager._radiiAndDynamicAtmosphereColor,
    );
    manager._sceneEnvironmentMap = frameState.environmentMap;
    manager._backgroundColor = frameState.backgroundColor;
    return true;
  }

  return false;
}

const scratchCartesian = new Cartesian3();
const scratchCartographic = new Cartographic();
const scratchMatrix = new Matrix4();
const scratchAdjustments = new Cartesian4();
const scratchColor = new Color();

/**
 * 通过为每个立方体面创建计算命令来渲染最高分辨率的镜面图。
 * @param {DynamicEnvironmentMapManager} manager 此管理器
 * @param {FrameState} frameState 当前帧状态
 * @private
 */
function updateRadianceMap(manager, frameState) {
  const context = frameState.context;
  const textureDimensions = manager._textureDimensions;

  if (!defined(manager._radianceCubeMap)) {
    manager._radianceCubeMap = new CubeMap({
      context: context,
      width: textureDimensions.x,
      height: textureDimensions.y,
      pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
      pixelFormat: PixelFormat.RGBA,
    });
  }

  if (manager._radianceCommandsDirty) {
    let fs = manager._radianceMapFS;
    if (!defined(fs)) {
      fs = new ShaderSource({
        sources: [AtmosphereCommon, ComputeRadianceMapFS],
      });
      manager._radianceMapFS = fs;
    }

    if (Atmosphere.requiresColorCorrect(frameState.atmosphere)) {
      fs.defines.push("ATMOSPHERE_COLOR_CORRECT");
    }

    const position = manager._position;
    const radiiAndDynamicAtmosphereColor =
      manager._radiiAndDynamicAtmosphereColor;

    const ellipsoid = frameState.mapProjection.ellipsoid;
    const enuToFixedFrame = FixedFrameTransforms.eastNorthUpToFixedFrame(
      position,
      ellipsoid,
      scratchMatrix,
    );
    const cartographic = ellipsoid.cartesianToCartographic(
      position,
      scratchCartographic,
    );
    const ellipsoidHeight = defined(cartographic) ? cartographic.height : 0.0;

    const adjustments = scratchAdjustments;

    adjustments.x = manager.brightness;
    adjustments.y = manager.saturation;
    adjustments.z = manager.gamma;
    adjustments.w = manager.atmosphereScatteringIntensity;

    if (
      manager.brightness !== 1.0 ||
      manager.saturation !== 1.0 ||
      manager.gamma !== 1.0
    ) {
      fs.defines.push("ENVIRONMENT_COLOR_CORRECT");
    }

    let i = 0;
    for (const face of CubeMap.faceNames()) {
      let texture = manager._radianceMapTextures[i];
      // Destroy any existing textures that have no yet been cleaned up
      if (defined(texture) && !texture.isDestroyed()) {
        texture.destroy();
      }

      texture = new Texture({
        context: context,
        width: textureDimensions.x,
        height: textureDimensions.y,
        pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
        pixelFormat: PixelFormat.RGBA,
      });
      manager._radianceMapTextures[i] = texture;

      const index = i;
      const command = new ComputeCommand({
        fragmentShaderSource: fs,
        outputTexture: texture,
        uniformMap: {
          u_radiiAndDynamicAtmosphereColor: () =>
            radiiAndDynamicAtmosphereColor,
          u_enuToFixedFrame: () => enuToFixedFrame,
          u_faceDirection: () => CubeMap.getDirection(face, scratchCartesian),
          u_positionWC: () => position,
          u_ellipsoidHeight: () => ellipsoidHeight,
          u_brightnessSaturationGammaIntensity: () => adjustments,
          u_groundColor: () => {
            return manager.groundColor.withAlpha(
              manager.groundAlbedo,
              scratchColor,
            );
          },
        },
        owner: manager,
      });
      command.postExecute = () => {
        if (manager.isDestroyed() || command.canceled) {
          DynamicEnvironmentMapManager._activeComputeCommandCount--;
          return;
        }

        const commands = manager._radianceMapComputeCommands;
        commands[index] = undefined;

        const framebuffer = new Framebuffer({
          context: context,
          colorTextures: [manager._radianceMapTextures[index]],
        });

        // Copy the output texture into the corresponding cubemap face
        framebuffer._bind();
        manager._radianceCubeMap[face].copyFromFramebuffer();
        framebuffer._unBind();
        framebuffer.destroy();

        DynamicEnvironmentMapManager._activeComputeCommandCount--;

        if (!commands.some(defined)) {
          manager._convolutionsCommandsDirty = true;
          manager._shouldRegenerateShaders = true;
        }
      };

      manager._radianceMapComputeCommands[i] = command;
      DynamicEnvironmentMapManager._queueCommand(command, frameState);
      i++;
    }
    manager._radianceCommandsDirty = false;
  }
}

/**
 * 通过对每个粗糙度级别对环境图进行卷积操作，为 cubemap 创建 mipmap 链。
 * @param {DynamicEnvironmentMapManager} manager 此管理器
 * @param {FrameState} frameState 当前帧状态
 * @private
 */
function updateSpecularMaps(manager, frameState) {
  const radianceCubeMap = manager._radianceCubeMap;
  radianceCubeMap.generateMipmap();

  const mipmapLevels = manager._mipmapLevels;
  const textureDimensions = manager._textureDimensions;
  let width = textureDimensions.x / 2;
  let height = textureDimensions.y / 2;
  const context = frameState.context;

  let facesCopied = 0;
  const checkComplete = () => {
    // All faces for each mipmap level have been copied
    const length = manager._specularMapTextures.length;
    if (facesCopied >= length) {
      manager._irradianceCommandDirty = true;

      if (mipmapLevels > 1) {
        radianceCubeMap.sampler = new Sampler({
          minificationFilter: TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
        });

        manager._shouldRegenerateShaders = true;

        // Cleanup shared resources
        manager._va.destroy();
        manager._va = undefined;
        manager._convolveSP.destroy();
        manager._convolveSP = undefined;
      }
    }
  };

  const getPostExecute = (command, index, texture, face, level) => () => {
    if (manager.isDestroyed() || command.canceled) {
      DynamicEnvironmentMapManager._activeComputeCommandCount--;
      return;
    }

    // Copy output texture to corresponding face and mipmap level
    const commands = manager._convolutionComputeCommands;
    commands[index] = undefined;

    radianceCubeMap.copyFace(frameState, texture, face, level);
    facesCopied++;
    DynamicEnvironmentMapManager._activeComputeCommandCount--;

    texture.destroy();
    manager._specularMapTextures[index] = undefined;

    checkComplete();
  };

  let index = 0;
  for (let level = 1; level < mipmapLevels; ++level) {
    for (const face of CubeMap.faceNames()) {
      if (defined(manager._specularMapTextures[index])) {
        manager._specularMapTextures[index].destroy();
      }

      const texture = (manager._specularMapTextures[index] = new Texture({
        context: context,
        width: width,
        height: height,
        pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
        pixelFormat: PixelFormat.RGBA,
      }));

      let vertexArray = manager._va;
      if (!defined(vertexArray)) {
        vertexArray = CubeMap.createVertexArray(context, face);
        manager._va = vertexArray;
      }

      let shaderProgram = manager._convolveSP;
      if (!defined(shaderProgram)) {
        shaderProgram = ShaderProgram.fromCache({
          context: context,
          vertexShaderSource: ConvolveSpecularMapVS,
          fragmentShaderSource: ConvolveSpecularMapFS,
          attributeLocations: {
            positions: 0,
          },
        });
        manager._convolveSP = shaderProgram;
      }

      const command = new ComputeCommand({
        shaderProgram: shaderProgram,
        vertexArray: vertexArray,
        outputTexture: texture,
        // Persist so we can use a shared shader progam and vertex array across all commands
        // Shared resources are instead destroyed in postExecute
        persists: true,
        owner: manager,
        uniformMap: {
          u_roughness: () => level / (mipmapLevels - 1),
          u_radianceTexture: () => radianceCubeMap ?? context.defaultTexture,
          u_faceDirection: () => {
            return CubeMap.getDirection(face, scratchCartesian);
          },
        },
      });
      command.postExecute = getPostExecute(
        command,
        index,
        texture,
        face,
        level,
      );
      manager._convolutionComputeCommands[index] = command;
      DynamicEnvironmentMapManager._queueCommand(command, frameState);
      ++index;
    }

    width /= 2;
    height /= 2;
  }
  checkComplete();
}

const irradianceTextureDimensions = new Cartesian2(3, 3); // 9 coefficients

/**
 * 通过卷积环境图计算球谐系数。
 * @param {DynamicEnvironmentMapManager} manager 此管理器
 * @param {FrameState} frameState 当前帧状态
 * @private
 */
function updateIrradianceResources(manager, frameState) {
  const context = frameState.context;
  const dimensions = irradianceTextureDimensions;

  let texture = manager._irradianceMapTexture;
  if (defined(texture) && !texture.isDestroyed()) {
    texture.destroy();
  }

  texture = new Texture({
    context: context,
    width: dimensions.x,
    height: dimensions.y,
    pixelDatatype: PixelDatatype.FLOAT,
    pixelFormat: PixelFormat.RGBA,
  });
  manager._irradianceMapTexture = texture;

  let fs = manager._irradianceMapFS;
  if (!defined(fs)) {
    fs = new ShaderSource({
      sources: [ComputeIrradianceFS],
    });
    manager._irradianceMapFS = fs;
  }

  const command = new ComputeCommand({
    fragmentShaderSource: fs,
    outputTexture: texture,
    owner: manager,
    uniformMap: {
      u_radianceMap: () => manager._radianceCubeMap ?? context.defaultTexture,
    },
  });

  command.postExecute = () => {
    if (manager.isDestroyed() || command.canceled) {
      DynamicEnvironmentMapManager._activeComputeCommandCount--;
      return;
    }
    manager._irradianceTextureDirty = false;
    manager._irradianceComputeCommand = undefined;
    manager._sphericalHarmonicCoefficientsDirty = true;
    manager._irradianceMapFS = undefined;

    DynamicEnvironmentMapManager._activeComputeCommandCount--;
  };

  manager._irradianceComputeCommand = command;
  DynamicEnvironmentMapManager._queueCommand(command, frameState);
  manager._irradianceTextureDirty = true;
}

/**
 * 使用 readPixels 从输出纹理中复制系数。
 * @param {DynamicEnvironmentMapManager} manager 此管理器
 * @param {FrameState} frameState 当前帧状态
 * @private
 */
function updateSphericalHarmonicCoefficients(manager, frameState) {
  const context = frameState.context;

  if (!defined(manager._irradianceMapTexture)) {
    // Operation was canceled
    return;
  }

  const framebuffer = new Framebuffer({
    context: context,
    colorTextures: [manager._irradianceMapTexture],
    destroyAttachments: false,
  });

  const dimensions = irradianceTextureDimensions;
  const data = context.readPixels({
    x: 0,
    y: 0,
    width: dimensions.x,
    height: dimensions.y,
    framebuffer: framebuffer,
  });

  for (let i = 0; i < 9; ++i) {
    manager._sphericalHarmonicCoefficients[i] = Cartesian3.unpack(data, i * 4);
    Cartesian3.multiplyByScalar(
      manager._sphericalHarmonicCoefficients[i],
      manager.atmosphereScatteringIntensity,
      manager._sphericalHarmonicCoefficients[i],
    );
  }

  framebuffer.destroy();
  manager._irradianceMapTexture.destroy();
  manager._irradianceMapTexture = undefined;
  manager._shouldRegenerateShaders = true;
}

/**
 * 当 {@link Viewer} 或 {@link CesiumWidget} 将场景渲染出来时调用
 * 以构建环境图的资源。
 * <p>
 * 不要直接调用此函数。
 * </p>
 * @private
 */
DynamicEnvironmentMapManager.prototype.update = function (frameState) {
  const mode = frameState.mode;
  const isSupported =
    // @ts-expect-error A FrameState type works here because the function only references the context parameter.
    DynamicEnvironmentMapManager.isDynamicUpdateSupported(frameState) &&
    this._mipmapLevels >= 1;

  if (
    !isSupported ||
    !this.enabled ||
    !this.shouldUpdate ||
    !defined(this._position) ||
    mode === SceneMode.MORPHING
  ) {
    this._shouldRegenerateShaders = false;
    return;
  }

  DynamicEnvironmentMapManager._updateCommandQueue(frameState);

  const dynamicLighting = frameState.atmosphere.dynamicLighting;
  const regenerateEnvironmentMap =
    atmosphereNeedsUpdate(this, frameState) ||
    (dynamicLighting === DynamicAtmosphereLightingType.SUNLIGHT &&
      !JulianDate.equalsEpsilon(
        frameState.time,
        this._lastTime,
        this.maximumSecondsDifference,
      ));

  if (this._shouldReset || regenerateEnvironmentMap) {
    this.reset();
    this._shouldReset = false;
    this._lastTime = JulianDate.clone(frameState.time, this._lastTime);
    return;
  }

  if (this._radianceMapDirty) {
    updateRadianceMap(this, frameState);
    this._radianceMapDirty = false;
  }

  if (this._convolutionsCommandsDirty) {
    updateSpecularMaps(this, frameState);
    this._convolutionsCommandsDirty = false;
  }

  if (this._irradianceCommandDirty) {
    updateIrradianceResources(this, frameState);
    this._irradianceCommandDirty = false;
  }

  if (this._irradianceTextureDirty) {
    this._shouldRegenerateShaders = false;
    return;
  }

  if (this._sphericalHarmonicCoefficientsDirty) {
    updateSphericalHarmonicCoefficients(this, frameState);
    this._sphericalHarmonicCoefficientsDirty = false;
    return;
  }

  this._shouldRegenerateShaders = false;
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>false</code>。
 * @see DynamicEnvironmentMapManager#destroy
 */
DynamicEnvironmentMapManager.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而不是依赖垃圾收集器来销毁此对象。
 * 一旦对象被销毁，就不应继续使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * 对象被销毁，即调用了 destroy()。
 * @throws {DeveloperError} This mapManager = mapManager && mapManager.destroy();
 * @example
 * 如果当前 WebGL 渲染上下文支持动态更新，则返回 <code>true</code>。
 * @see DynamicEnvironmentMapManager#isDestroyed
 */
DynamicEnvironmentMapManager.prototype.destroy = function () {
  // Cancel in-progress commands
  let length = this._radianceMapComputeCommands.length;
  for (let i = 0; i < length; ++i) {
    this._radianceMapComputeCommands[i] = undefined;
  }

  length = this._convolutionComputeCommands.length;
  for (let i = 0; i < length; ++i) {
    this._convolutionComputeCommands[i] = undefined;
  }

  this._irradianceMapComputeCommand = undefined;

  // Destroy all textures
  length = this._radianceMapTextures.length;
  for (let i = 0; i < length; ++i) {
    this._radianceMapTextures[i] =
      this._radianceMapTextures[i] &&
      !this._radianceMapTextures[i].isDestroyed() &&
      this._radianceMapTextures[i].destroy();
  }

  length = this._specularMapTextures.length;
  for (let i = 0; i < length; ++i) {
    this._specularMapTextures[i] =
      this._specularMapTextures[i] &&
      !this._specularMapTextures[i].isDestroyed() &&
      this._specularMapTextures[i].destroy();
  }

  this._radianceCubeMap =
    this._radianceCubeMap && this._radianceCubeMap.destroy();
  this._irradianceMapTexture =
    this._irradianceMapTexture &&
    !this._irradianceMapTexture.isDestroyed() &&
    this._irradianceMapTexture.destroy();

  if (defined(this._va)) {
    this._va.destroy();
  }

  if (defined(this._convolveSP)) {
    this._convolveSP.destroy();
  }

  return destroyObject(this);
};

/**
 * 如果当前 WebGL 渲染上下文支持动态更新，则返回 <code>true</code>。
 * 动态更新需要使用 EXT_color_buffer_float 或 EXT_color_buffer_half_float 扩展。
 *
 * @param {Scene} scene 包含渲染上下文的对象
 * @returns {boolean} true 若支持
 */
DynamicEnvironmentMapManager.isDynamicUpdateSupported = function (scene) {
  const context = scene.context;
  return context.halfFloatingPointTexture || context.colorBufferFloat;
};

/**
 * 地球地表颜色的平均色调为暖的灰绿色
 * @type {Color}
 * @readonly
 */
DynamicEnvironmentMapManager.AVERAGE_EARTH_GROUND_COLOR = Object.freeze(
  Color.fromCssColorString("#717145"),
);

/**
 * 用于基于图像的照明漫色效果的默认第三阶球谐系数，即低强度的白色环境光
 * <p>
 * 共有九个 <code>Cartesian3</code> 系数
 * 系数的顺序为：L<sub>0,0</sub>、L<sub>1,-1</sub>、L<sub>1,0</sub>、L<sub>1,1</sub>、L<sub>2,-2</sub>、L<sub>2,-1</sub>、L<sub>2,0</sub>、L<sub>2,1</sub>、L<sub>2,2</sub>
 * </p>
 * @readonly
 * @type {Cartesian3[]}
 * @see {@link https://graphics.stanford.edu/papers/envmap/envmap.pdf|An Efficient Representation for Irradiance Environment Maps}
 */
DynamicEnvironmentMapManager.DEFAULT_SPHERICAL_HARMONIC_COEFFICIENTS =
  Object.freeze([
    Object.freeze(new Cartesian3(0.35449, 0.35449, 0.35449)),
    Cartesian3.ZERO,
    Cartesian3.ZERO,
    Cartesian3.ZERO,
    Cartesian3.ZERO,
    Cartesian3.ZERO,
    Cartesian3.ZERO,
    Cartesian3.ZERO,
    Cartesian3.ZERO,
  ]);

export default DynamicEnvironmentMapManager;