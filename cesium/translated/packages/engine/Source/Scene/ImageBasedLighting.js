import {
  Cartesian2,
  Check,
  DeveloperError,
  Frozen,
  defined,
  destroyObject,
} from "@cesium/core";
import SpecularEnvironmentCubeMap from "./SpecularEnvironmentCubeMap.js";

/**
 * 用于管理瓦片集和模型中的基于影像的照明属性。
 * 还管理必要的资源和纹理。
 * <p>
 * 如果使用镜面环境映射，必须在不再需要基于影像的照明时调用 {@link ImageBasedLighting#destroy} 以正确清理 GPU 资源。
 * 如果模型或瓦片集创建了 ImageBasedLighting 实例，它将自动处理此操作。
 * 否则，应用程序需负责调用 destroy()。
 * 对象包含以下属性：
 *</p>
 *
 * @alias ImageBasedLighting
 * @constructor
 *
 * @param {object} [options] Object with the following properties:
 * @param {Cartesian2} [options.imageBasedLightingFactor=Cartesian2(1.0, 1.0)] 从地球、天空、大气和星天盒中缩放漫反射和镜面基于影像的照明。
 * @param {Cartesian3[]} [options.sphericalHarmonicCoefficients] 用于基于影像照明漫反射颜色的第三阶球谐系数。
 * @param {string} [options.specularEnvironmentMaps] 包含镜面照明立方图和卷积镜面 mipmap 的 KTX2 文件地址。
 */
function ImageBasedLighting(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const imageBasedLightingFactor = defined(options.imageBasedLightingFactor)
    ? Cartesian2.clone(options.imageBasedLightingFactor)
    : new Cartesian2(1.0, 1.0);

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object(
    "options.imageBasedLightingFactor",
    imageBasedLightingFactor,
  );
  Check.typeOf.number.greaterThanOrEquals(
    "options.imageBasedLightingFactor.x",
    imageBasedLightingFactor.x,
    0.0,
  );
  Check.typeOf.number.lessThanOrEquals(
    "options.imageBasedLightingFactor.x",
    imageBasedLightingFactor.x,
    1.0,
  );
  Check.typeOf.number.greaterThanOrEquals(
    "options.imageBasedLightingFactor.y",
    imageBasedLightingFactor.y,
    0.0,
  );
  Check.typeOf.number.lessThanOrEquals(
    "options.imageBasedLightingFactor.y",
    imageBasedLightingFactor.y,
    1.0,
  );
  //>>includeEnd('debug');

  this._imageBasedLightingFactor = imageBasedLightingFactor;

  const sphericalHarmonicCoefficients = options.sphericalHarmonicCoefficients;

  //>>includeStart('debug', pragmas.debug);
  if (
    defined(sphericalHarmonicCoefficients) &&
    (!Array.isArray(sphericalHarmonicCoefficients) ||
      sphericalHarmonicCoefficients.length !== 9)
  ) {
    throw new DeveloperError(
      "options.sphericalHarmonicCoefficients must be an array of 9 Cartesian3 values.",
    );
  }
  //>>includeEnd('debug');
  this._sphericalHarmonicCoefficients = sphericalHarmonicCoefficients;

  // The specular environment map texture is created in update();
  this._specularEnvironmentMaps = options.specularEnvironmentMaps;
  this._specularEnvironmentCubeMap = undefined;
  this._specularEnvironmentCubeMapDirty = true;
  this._specularEnvironmentMapLoaded = false;
  this._previousSpecularEnvironmentMapLoaded = false;

  this._useDefaultSpecularMaps = false;
  this._useDefaultSphericalHarmonics = false;
  this._shouldRegenerateShaders = false;

  // Store the previous frame number to prevent redundant update calls
  this._previousFrameNumber = undefined;
  this._previousFrameContext = undefined;

  // Keeps track of the last values for use during update logic
  this._previousImageBasedLightingFactor = Cartesian2.clone(
    imageBasedLightingFactor,
  );
  this._previousSphericalHarmonicCoefficients = sphericalHarmonicCoefficients;
  this._removeErrorListener = undefined;
}

Object.defineProperties(ImageBasedLighting.prototype, {
  /**
   * Cesium 会添加来自地球、天空、大气和星天盒的照明。
   * 此笛卡尔坐标用于缩放最终的漫反射和镜面照明贡献，值为 0.0 将禁用这些光源。
   * contribution from those sources to the final color. A value of 0.0 will
   * 禁用这些光源。
   *
   * @memberof ImageBasedLighting.prototype
   *
   * @type {Cartesian2}
   * @default Cartesian2(1.0, 1.0)
   */
  imageBasedLightingFactor: {
    get: function () {
      return this._imageBasedLightingFactor;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("imageBasedLightingFactor", value);
      Check.typeOf.number.greaterThanOrEquals(
        "imageBasedLightingFactor.x",
        value.x,
        0.0,
      );
      Check.typeOf.number.lessThanOrEquals(
        "imageBasedLightingFactor.x",
        value.x,
        1.0,
      );
      Check.typeOf.number.greaterThanOrEquals(
        "imageBasedLightingFactor.y",
        value.y,
        0.0,
      );
      Check.typeOf.number.lessThanOrEquals(
        "imageBasedLightingFactor.y",
        value.y,
        1.0,
      );
      //>>includeEnd('debug');
      this._previousImageBasedLightingFactor = Cartesian2.clone(
        this._imageBasedLightingFactor,
        this._previousImageBasedLightingFactor,
      );
      this._imageBasedLightingFactor = Cartesian2.clone(
        value,
        this._imageBasedLightingFactor,
      );
    },
  },

  /**
   * 用于基于影像照明漫反射颜色的第三阶球谐系数。当为 <code>undefined</code> 时，使用从大气颜色计算出的漫反射辐照度。
   * 使用从大气颜色计算出的漫反射辐照度。
   * <p>
   * 共有九个 <code>Cartesian3</code> 系数。
   * 系数的顺序为：L<sub>0,0</sub>、L<sub>1,-1</sub>、L<sub>1,0</sub>、L<sub>1,1</sub>、L<sub>2,-2</sub>、L<sub>2,-1</sub>、L<sub>2,0</sub>、L<sub>2,1</sub>、L<sub>2,2</sub>。
   * </p>
   *
   * 这些值可以通过使用 <code>cmgen</code> 工具预处理环境映射获得。
   * {@link https://github.com/google/filament/releases|Google 的 Filament 项目}。
   * 确保在 <code>cmgen</code> 中使用 <code>--no-mirror</code> 选项。
   *
   * @memberof ImageBasedLighting.prototype
   *
   * @type {Cartesian3[]}
   * @demo {@link https://sandcastle.cesium.com/index.html?id=image-based-lighting|Sandcastle Image Based Lighting Demo}
   * @see {@link https://graphics.stanford.edu/papers/envmap/envmap.pdf|An Efficient Representation for Irradiance Environment Maps}
   */
  sphericalHarmonicCoefficients: {
    get: function () {
      return this._sphericalHarmonicCoefficients;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && (!Array.isArray(value) || value.length !== 9)) {
        throw new DeveloperError(
          "sphericalHarmonicCoefficients must be an array of 9 Cartesian3 values.",
        );
      }
      //>>includeEnd('debug');
      this._previousSphericalHarmonicCoefficients =
        this._sphericalHarmonicCoefficients;
      this._sphericalHarmonicCoefficients = value;
    },
  },

  /**
   * 包含镜面照明立方图和卷积镜面 mipmap 的 KTX2 文件地址。
   *
   * @memberof ImageBasedLighting.prototype
   * @demo {@link https://sandcastle.cesium.com/index.html?id=image-based-lighting|Sandcastle Image Based Lighting Demo}
   * @type {string}
   * @see ImageBasedLighting#sphericalHarmonicCoefficients
   */
  specularEnvironmentMaps: {
    get: function () {
      return this._specularEnvironmentMaps;
    },
    set: function (value) {
      if (value !== this._specularEnvironmentMaps) {
        this._specularEnvironmentCubeMapDirty =
          this._specularEnvironmentCubeMapDirty ||
          value !== this._specularEnvironmentMaps;
        this._specularEnvironmentMapLoaded = false;
      }
      this._specularEnvironmentMaps = value;
    },
  },

  /**
   * 是否启用基于影像的照明。
   *
   * @memberof ImageBasedLighting.prototype
   * @type {boolean}
   *
   * @private
   */
  enabled: {
    get: function () {
      return (
        this._imageBasedLightingFactor.x > 0.0 ||
        this._imageBasedLightingFactor.y > 0.0
      );
    },
  },

  /**
   * 使用此照明的模型是否应根据属性和资源的变化重新生成着色器。
   * 
   *
   * @memberof ImageBasedLighting.prototype
   * @type {boolean}
   *
   * @private
   */
  shouldRegenerateShaders: {
    get: function () {
      return this._shouldRegenerateShaders;
    },
  },

  /**
   * 镜面环境映射的纹理图集。
   *
   * @memberof ImageBasedLighting.prototype
   * @type {SpecularEnvironmentCubeMap}
   *
   * @private
   */
  specularEnvironmentCubeMap: {
    get: function () {
      return this._specularEnvironmentCubeMap;
    },
  },

  /**
   * 是否使用默认的球谐系数。
   *
   * @memberof ImageBasedLighting.prototype
   * @type {boolean}
   *
   * @private
   */
  useDefaultSphericalHarmonics: {
    get: function () {
      return this._useDefaultSphericalHarmonics;
    },
  },

  /**
   * 是否使用默认的镜面环境映射。
   *
   * @memberof ImageBasedLighting.prototype
   * @type {boolean}
   *
   * @private
   */
  useDefaultSpecularMaps: {
    get: function () {
      return this._useDefaultSpecularMaps;
    },
  },

  /**
   * 基于影像的照明设置是否使用镜面环境映射。
   *
   * @memberof ImageBasedLighting.prototype
   * @type {boolean}
   *
   * @private
   */
  useSpecularEnvironmentMaps: {
    get: function () {
      return (
        (defined(this._specularEnvironmentCubeMap) &&
          this._specularEnvironmentCubeMap.ready) ||
        this._useDefaultSpecularMaps
      );
    },
  },
});

function createSpecularEnvironmentCubeMap(imageBasedLighting, context) {
  if (!SpecularEnvironmentCubeMap.isSupported(context)) {
    return;
  }

  imageBasedLighting._specularEnvironmentCubeMap =
    imageBasedLighting._specularEnvironmentCubeMap &&
    imageBasedLighting._specularEnvironmentCubeMap.destroy();

  if (defined(imageBasedLighting._specularEnvironmentMaps)) {
    const cubeMap = new SpecularEnvironmentCubeMap(
      imageBasedLighting._specularEnvironmentMaps,
    );
    imageBasedLighting._specularEnvironmentCubeMap = cubeMap;

    imageBasedLighting._removeErrorListener =
      cubeMap.errorEvent.addEventListener((error) => {
        console.error(`Error loading specularEnvironmentMaps: ${error}`);
      });
  }

  // Regenerate shaders so they do not use an environment map.
  // Will be set to true again if there was a new environment map and it is ready.
  imageBasedLighting._shouldRegenerateShaders = true;
}

ImageBasedLighting.prototype.update = function (frameState) {
  if (
    frameState.frameNumber === this._previousFrameNumber &&
    frameState.context === this._previousFrameContext
  ) {
    return;
  }

  this._previousFrameNumber = frameState.frameNumber;
  const context = (this._previousFrameContext = frameState.context);

  frameState.brdfLutGenerator.update(frameState);
  this._shouldRegenerateShaders = false;

  const iblFactor = this._imageBasedLightingFactor;
  const previousIBLFactor = this._previousImageBasedLightingFactor;
  if (!Cartesian2.equals(iblFactor, previousIBLFactor)) {
    this._shouldRegenerateShaders =
      (iblFactor.x > 0.0 && previousIBLFactor.x === 0.0) ||
      (iblFactor.x === 0.0 && previousIBLFactor.x > 0.0);
    this._shouldRegenerateShaders =
      this._shouldRegenerateShaders ||
      (iblFactor.y > 0.0 && previousIBLFactor.y === 0.0) ||
      (iblFactor.y === 0.0 && previousIBLFactor.y > 0.0);

    this._previousImageBasedLightingFactor = Cartesian2.clone(
      this._imageBasedLightingFactor,
      this._previousImageBasedLightingFactor,
    );
  }

  if (
    this._previousSphericalHarmonicCoefficients !==
    this._sphericalHarmonicCoefficients
  ) {
    this._shouldRegenerateShaders =
      this._shouldRegenerateShaders ||
      defined(this._previousSphericalHarmonicCoefficients) !==
        defined(this._sphericalHarmonicCoefficients);

    this._previousSphericalHarmonicCoefficients =
      this._sphericalHarmonicCoefficients;
  }

  this._shouldRegenerateShaders =
    this._shouldRegenerateShaders ||
    this._previousSpecularEnvironmentMapLoaded !==
      this._specularEnvironmentMapLoaded;

  this._previousSpecularEnvironmentMapLoaded =
    this._specularEnvironmentMapLoaded;

  if (this._specularEnvironmentCubeMapDirty) {
    createSpecularEnvironmentCubeMap(this, context);
    this._specularEnvironmentCubeMapDirty = false;
  }

  if (defined(this._specularEnvironmentCubeMap)) {
    this._specularEnvironmentCubeMap.update(frameState);
    if (this._specularEnvironmentCubeMap.ready) {
      this._specularEnvironmentMapLoaded = true;
    }
  }

  const recompileWithDefaultCubeMap =
    !defined(this._specularEnvironmentCubeMap) &&
    defined(frameState.specularEnvironmentMaps) &&
    !this._useDefaultSpecularMaps;
  const recompileWithoutDefaultCubeMap =
    !defined(frameState.specularEnvironmentMaps) &&
    this._useDefaultSpecularMaps;

  const recompileWithDefaultSHCoeffs =
    !defined(this._sphericalHarmonicCoefficients) &&
    defined(frameState.sphericalHarmonicCoefficients) &&
    !this._useDefaultSphericalHarmonics;
  const recompileWithoutDefaultSHCoeffs =
    !defined(frameState.sphericalHarmonicCoefficients) &&
    this._useDefaultSphericalHarmonics;

  this._shouldRegenerateShaders =
    this._shouldRegenerateShaders ||
    recompileWithDefaultCubeMap ||
    recompileWithoutDefaultCubeMap ||
    recompileWithDefaultSHCoeffs ||
    recompileWithoutDefaultSHCoeffs;

  this._useDefaultSpecularMaps =
    !defined(this._specularEnvironmentCubeMap) &&
    defined(frameState.specularEnvironmentMaps);
  this._useDefaultSphericalHarmonics =
    !defined(this._sphericalHarmonicCoefficients) &&
    defined(frameState.sphericalHarmonicCoefficients);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} True 如果此对象被销毁，则返回 true；否则返回 false。
 *
 * @see ImageBasedLighting#destroy
 * @private
 */
ImageBasedLighting.prototype.isDestroyed = function () {
  return false;
};

/**
 * 会释放此对象所持有的 WebGL 资源。销毁对象可以使得 WebGL 资源被确定性地释放，而无需依赖垃圾收集器来销毁该对象。
 * 一旦对象被销毁，不应使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 应将返回值 (<code>undefined</code>) 赋给该对象，如示例中所示。
 * 表明对象已被销毁，即调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 * @example
 * imageBasedLighting = imageBasedLighting && imageBasedLighting.destroy();
 *
 * @see ImageBasedLighting#isDestroyed
 * @private
 */
ImageBasedLighting.prototype.destroy = function () {
  this._specularEnvironmentCubeMap =
    this._specularEnvironmentCubeMap &&
    this._specularEnvironmentCubeMap.destroy();
  this._removeErrorListener =
    this._removeErrorListener && this._removeErrorListener();
  return destroyObject(this);
};

export default ImageBasedLighting;
