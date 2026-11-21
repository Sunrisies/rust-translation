import {
  BoundingRectangle,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Cartographic,
  Color,
  Ellipsoid,
  EncodedCartesian3,
  FixedFrameTransforms,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  OrthographicFrustum,
  defined,
} from "@cesium/core";
import Simon1994PlanetaryPositions from "../Core/Simon1994PlanetaryPositions.js";
import CelestialFrameTransforms from "../Core/CelestialFrameTransforms.js";
import SceneMode from "../Scene/SceneMode.js";
import SunLight from "../Scene/SunLight.js";

/**
 * @private
 * @constructor
 */
function UniformState() {
  /**
   * @type {Texture}
   */
  this.globeDepthTexture = undefined;
  /**
   * @type {Texture}
   */
  this.edgeIdTexture = undefined;
  /**
   * @type {Texture}
   */
  this.edgeColorTexture = undefined;
  /**
   * @type {Texture}
   */
  this.edgeDepthTexture = undefined; // packed depth color attachment from edge pass
  /**
   * 由平面填充功能在预处理阶段写入的纹理。
   * 包含非后方平面填充几何体的每像素特征ID。
   * 由后方填充采样，用于测试同一对象的共面性。
   * @type {Texture}
   */
  this.planarFillIdTexture = undefined;
  /**
   * @type {number}
   */
  this.gamma = undefined;

  this._viewport = new BoundingRectangle();
  this._viewportCartesian4 = new Cartesian4();
  this._viewportDirty = false;
  this._viewportOrthographicMatrix = Matrix4.clone(Matrix4.IDENTITY);
  this._viewportTransformation = Matrix4.clone(Matrix4.IDENTITY);

  this._model = Matrix4.clone(Matrix4.IDENTITY);
  this._view = Matrix4.clone(Matrix4.IDENTITY);
  this._inverseView = Matrix4.clone(Matrix4.IDENTITY);
  this._projection = Matrix4.clone(Matrix4.IDENTITY);
  this._infiniteProjection = Matrix4.clone(Matrix4.IDENTITY);
  this._entireFrustum = new Cartesian2();
  this._currentFrustum = new Cartesian2();
  this._frustumPlanes = new Cartesian4();
  this._farDepthFromNearPlusOne = undefined;
  this._log2FarDepthFromNearPlusOne = undefined;
  this._oneOverLog2FarDepthFromNearPlusOne = undefined;

  this._frameState = undefined;
  this._temeToPseudoFixed = Matrix3.clone(Matrix4.IDENTITY);

  // Derived members
  this._view3DDirty = true;
  this._view3D = new Matrix4();

  this._inverseView3DDirty = true;
  this._inverseView3D = new Matrix4();

  this._inverseModelDirty = true;
  this._inverseModel = new Matrix4();

  this._inverseTransposeModelDirty = true;
  this._inverseTransposeModel = new Matrix3();

  this._viewRotation = new Matrix3();
  this._inverseViewRotation = new Matrix3();

  this._viewRotation3D = new Matrix3();
  this._inverseViewRotation3D = new Matrix3();

  this._inverseProjectionDirty = true;
  this._inverseProjection = new Matrix4();

  this._modelViewDirty = true;
  this._modelView = new Matrix4();

  this._modelView3DDirty = true;
  this._modelView3D = new Matrix4();

  this._modelViewRelativeToEyeDirty = true;
  this._modelViewRelativeToEye = new Matrix4();

  this._inverseModelViewDirty = true;
  this._inverseModelView = new Matrix4();

  this._inverseModelView3DDirty = true;
  this._inverseModelView3D = new Matrix4();

  this._viewProjectionDirty = true;
  this._viewProjection = new Matrix4();

  this._inverseViewProjectionDirty = true;
  this._inverseViewProjection = new Matrix4();

  this._modelViewProjectionDirty = true;
  this._modelViewProjection = new Matrix4();

  this._inverseModelViewProjectionDirty = true;
  this._inverseModelViewProjection = new Matrix4();

  this._modelViewProjectionRelativeToEyeDirty = true;
  this._modelViewProjectionRelativeToEye = new Matrix4();

  this._modelViewInfiniteProjectionDirty = true;
  this._modelViewInfiniteProjection = new Matrix4();

  this._normalDirty = true;
  this._normal = new Matrix3();

  this._normal3DDirty = true;
  this._normal3D = new Matrix3();

  this._inverseNormalDirty = true;
  this._inverseNormal = new Matrix3();

  this._inverseNormal3DDirty = true;
  this._inverseNormal3D = new Matrix3();

  this._encodedCameraPositionMCDirty = true;
  this._encodedCameraPositionMC = new EncodedCartesian3();
  this._cameraPosition = new Cartesian3();

  this._sunPositionWC = new Cartesian3();
  this._sunPositionColumbusView = new Cartesian3();
  this._sunDirectionWC = new Cartesian3();
  this._sunDirectionEC = new Cartesian3();
  this._moonDirectionEC = new Cartesian3();

  this._lightDirectionWC = new Cartesian3();
  this._lightDirectionEC = new Cartesian3();
  this._lightColor = new Cartesian3();
  this._lightColorHdr = new Cartesian3();

  this._pass = undefined;
  this._mode = undefined;
  this._mapProjection = undefined;
  this._ellipsoid = undefined;
  this._cameraDirection = new Cartesian3();
  this._cameraRight = new Cartesian3();
  this._cameraUp = new Cartesian3();
  this._frustum2DWidth = 0.0;
  this._eyeHeight = 0.0;
  this._eyeHeight2D = new Cartesian2();
  this._eyeCartographic = new Cartesian3();
  this._eyeEllipsoidNormalEC = new Cartesian3();
  this._eyeEllipsoidCurvature = new Cartesian2();
  this._eyeToEnu = new Matrix3();
  this._modelToEnu = new Matrix4();
  this._enuToModel = new Matrix4();
  this._pixelRatio = 1.0;
  this._orthographicIn3D = false;
  this._backgroundColor = new Color();

  this._brdfLut = undefined;
  this._environmentMap = undefined;

  this._sphericalHarmonicCoefficients = undefined;
  this._specularEnvironmentMaps = undefined;
  this._specularEnvironmentMapsMaximumLOD = undefined;

  this._fogDensity = undefined;
  this._fogVisualDensityScalar = undefined;
  this._fogMinimumBrightness = undefined;

  this._atmosphereHsbShift = undefined;
  this._atmosphereLightIntensity = undefined;
  this._atmosphereRayleighCoefficient = new Cartesian3();
  this._atmosphereRayleighScaleHeight = new Cartesian3();
  this._atmosphereMieCoefficient = new Cartesian3();
  this._atmosphereMieScaleHeight = undefined;
  this._atmosphereMieAnisotropy = undefined;
  this._atmosphereDynamicLighting = undefined;

  this._invertClassificationColor = undefined;

  this._splitPosition = 0.0;
  this._pixelSizePerMeter = undefined;
  this._geometricToleranceOverMeter = undefined;

  this._minimumDisableDepthTestDistance = undefined;
}

Object.defineProperties(UniformState.prototype, {
  /**
   * @memberof UniformState.prototype
   * @type {FrameState}
   * @readonly
   */
  frameState: {
    get: function () {
      return this._frameState;
    },
  },
  /**
   * @memberof UniformState.prototype
   * @type {BoundingRectangle}
   */
  viewport: {
    get: function () {
      return this._viewport;
    },
    set: function (viewport) {
      if (!BoundingRectangle.equals(viewport, this._viewport)) {
        BoundingRectangle.clone(viewport, this._viewport);

        const v = this._viewport;
        const vc = this._viewportCartesian4;
        vc.x = v.x;
        vc.y = v.y;
        vc.z = v.width;
        vc.w = v.height;

        this._viewportDirty = true;
      }
    },
  },

  /**
   * @memberof UniformState.prototype
   * @private
   */
  viewportCartesian4: {
    get: function () {
      return this._viewportCartesian4;
    },
  },

  viewportOrthographic: {
    get: function () {
      cleanViewport(this);
      return this._viewportOrthographicMatrix;
    },
  },

  viewportTransformation: {
    get: function () {
      cleanViewport(this);
      return this._viewportTransformation;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  model: {
    get: function () {
      return this._model;
    },
    set: function (matrix) {
      Matrix4.clone(matrix, this._model);

      this._modelView3DDirty = true;
      this._inverseModelView3DDirty = true;
      this._inverseModelDirty = true;
      this._inverseTransposeModelDirty = true;
      this._modelViewDirty = true;
      this._inverseModelViewDirty = true;
      this._modelViewRelativeToEyeDirty = true;
      this._inverseModelViewDirty = true;
      this._modelViewProjectionDirty = true;
      this._inverseModelViewProjectionDirty = true;
      this._modelViewProjectionRelativeToEyeDirty = true;
      this._modelViewInfiniteProjectionDirty = true;
      this._normalDirty = true;
      this._inverseNormalDirty = true;
      this._normal3DDirty = true;
      this._inverseNormal3DDirty = true;
      this._encodedCameraPositionMCDirty = true;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  inverseModel: {
    get: function () {
      if (this._inverseModelDirty) {
        this._inverseModelDirty = false;

        Matrix4.inverse(this._model, this._inverseModel);
      }

      return this._inverseModel;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @private
   */
  inverseTransposeModel: {
    get: function () {
      const m = this._inverseTransposeModel;
      if (this._inverseTransposeModelDirty) {
        this._inverseTransposeModelDirty = false;

        Matrix4.getMatrix3(this.inverseModel, m);
        Matrix3.transpose(m, m);
      }

      return m;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  view: {
    get: function () {
      return this._view;
    },
  },

  /**
   * 3D视图矩阵。在3D模式下，此矩阵与 {@link UniformState#view} 相同。
   * 但在2D和Columbus视图中，这是一个基于3D世界中相机等效位置的合成矩阵。
   * 3D世界中的相机位置。
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  view3D: {
    get: function () {
      updateView3D(this);
      return this._view3D;
    },
  },

  /**
   * 当前视图矩阵의 3x3旋转矩阵 ({@link UniformState#view})。
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  viewRotation: {
    get: function () {
      updateView3D(this);
      return this._viewRotation;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  viewRotation3D: {
    get: function () {
      updateView3D(this);
      return this._viewRotation3D;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  inverseView: {
    get: function () {
      return this._inverseView;
    },
  },

  /**
   * 从眼睛坐标转换为3D世界坐标的4x4逆视图矩阵。在3D模式下，此矩阵与
   * {@link UniformState#inverseView} 相同，但在2D和Columbus视图中，这是一个基于3D世界中相机等效位置的合成矩阵。
   * 3D逆视图矩阵의 4x4旋转矩阵。3D模式下，此矩阵与
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  inverseView3D: {
    get: function () {
      updateInverseView3D(this);
      return this._inverseView3D;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  inverseViewRotation: {
    get: function () {
      return this._inverseViewRotation;
    },
  },

  /**
   * 当前3D逆视图矩阵的3x3旋转矩阵 ({@link UniformState#inverseView3D})。
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  inverseViewRotation3D: {
    get: function () {
      updateInverseView3D(this);
      return this._inverseViewRotation3D;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  projection: {
    get: function () {
      return this._projection;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  inverseProjection: {
    get: function () {
      cleanInverseProjection(this);
      return this._inverseProjection;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  infiniteProjection: {
    get: function () {
      return this._infiniteProjection;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  modelView: {
    get: function () {
      cleanModelView(this);
      return this._modelView;
    },
  },

  /**
   * 3D模型视图矩阵。在3D模式下，此矩阵与 {@link UniformState#modelView} 相同。在2D和
   * Columbus视图中，然而，这是一个基于3D世界中相机等效位置的合成矩阵。
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  modelView3D: {
    get: function () {
      cleanModelView3D(this);
      return this._modelView3D;
    },
  },

  /**
   * 相对于眼睛矩阵的模型视图矩阵。
   *
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  modelViewRelativeToEye: {
    get: function () {
      cleanModelViewRelativeToEye(this);
      return this._modelViewRelativeToEye;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  inverseModelView: {
    get: function () {
      cleanInverseModelView(this);
      return this._inverseModelView;
    },
  },

  /**
   * 3D模型视图矩阵的逆矩阵。在3D模式下，此矩阵与 {@link UniformState#inverseModelView} 相同。
   * 但在2D和Columbus视图中，这是一个基于3D世界中相机等效位置的合成矩阵。
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  inverseModelView3D: {
    get: function () {
      cleanInverseModelView3D(this);
      return this._inverseModelView3D;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  viewProjection: {
    get: function () {
      cleanViewProjection(this);
      return this._viewProjection;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  inverseViewProjection: {
    get: function () {
      cleanInverseViewProjection(this);
      return this._inverseViewProjection;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  modelViewProjection: {
    get: function () {
      cleanModelViewProjection(this);
      return this._modelViewProjection;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  inverseModelViewProjection: {
    get: function () {
      cleanInverseModelViewProjection(this);
      return this._inverseModelViewProjection;
    },
  },

  /**
   * 相对于眼睛矩阵的模型视图-投影矩阵。
   *
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  modelViewProjectionRelativeToEye: {
    get: function () {
      cleanModelViewProjectionRelativeToEye(this);
      return this._modelViewProjectionRelativeToEye;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  modelViewInfiniteProjection: {
    get: function () {
      cleanModelViewInfiniteProjection(this);
      return this._modelViewInfiniteProjection;
    },
  },

  /**
   * 一个3x3法线变换矩阵，将模型坐标中的法线向量转换为
   * 眼睛坐标。
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  normal: {
    get: function () {
      cleanNormal(this);
      return this._normal;
    },
  },

  /**
   * 一个3x3法线变换矩阵，将3D模型中的法线向量转换为
   * 眼睛坐标。在3D模式下，此矩阵与
   * {@link UniformState#normal} 相同，但在2D和Columbus视图中，它表示如3D模式下相机处于等效位置时的法线变换矩阵。
   * 矩阵。
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  normal3D: {
    get: function () {
      cleanNormal3D(this);
      return this._normal3D;
    },
  },

  /**
   * 一个3x3逆法线变换矩阵，将模型坐标中的法线向量转换为
   * 眼睛坐标。
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  inverseNormal: {
    get: function () {
      cleanInverseNormal(this);
      return this._inverseNormal;
    },
  },

  /**
   * 一个3x3逆法线变换矩阵，将眼睛坐标中的法线向量转换为
   * 3D模型坐标。在3D模式下，此矩阵与
   * {@link UniformState#inverseNormal} 相同，但在2D和Columbus视图中，它表示如3D模式下相机处于等效位置时的法线变换矩阵。
   * 矩阵。
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  inverseNormal3D: {
    get: function () {
      cleanInverseNormal3D(this);
      return this._inverseNormal3D;
    },
  },

  /**
   * 由相机定义的透视图的近距 (<code>x</code>)和远距 (<code>y</code>)。
   * 这是最大的可能片段，并非用于多片段渲染的单个片段。
   * @memberof UniformState.prototype
   * @type {Cartesian2}
   */
  entireFrustum: {
    get: function () {
      return this._entireFrustum;
    },
  },

  /**
   * 由相机定义的片段的近距距离（<code>x</code>）和远距距离（<code>y</code>）。
   * 这是用于多片段渲染的单个片段。
   * @memberof UniformState.prototype
   * @type {Cartesian2}
   */
  currentFrustum: {
    get: function () {
      return this._currentFrustum;
    },
  },

  /**
   * 到片段平面的距离。顶部、底部、左侧和右侧的距离分别为
   * x、y、z 和 w 分量。
   * @memberof UniformState.prototype
   * @type {Cartesian4}
   */
  frustumPlanes: {
    get: function () {
      return this._frustumPlanes;
    },
  },

  /**
   * 远平面与近平面的距离加上 1.0。
   *
   * @memberof UniformState.prototype
   * @type {number}
   */
  farDepthFromNearPlusOne: {
    get: function () {
      return this._farDepthFromNearPlusOne;
    },
  },

  /**
   * {@link UniformState#farDepthFromNearPlusOne} 的 log2 值。
   *
   * @memberof UniformState.prototype
   * @type {number}
   */
  log2FarDepthFromNearPlusOne: {
    get: function () {
      return this._log2FarDepthFromNearPlusOne;
    },
  },

  /**
   * 1.0 除以 {@link UniformState#log2FarDepthFromNearPlusOne}。
   *
   * @memberof UniformState.prototype
   * @type {number}
   */
  oneOverLog2FarDepthFromNearPlusOne: {
    get: function () {
      return this._oneOverLog2FarDepthFromNearPlusOne;
    },
  },

  /**
   * 眼睛（相机）在椭球体上方或下方的米数。
   * @memberof UniformState.prototype
   * @type {number}
   */
  eyeHeight: {
    get: function () {
      return this._eyeHeight;
    },
  },

  /**
   * 地理经度（<code>x</code>）、纬度（<code>y</code>）以弧度为单位以及
   * 高度（<code>z</code>）以米为单位。
   * 此值仅在 {@link SceneMode} 为 <code>SCENE3D</code> 时有效。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  eyeCartographic: {
    get: function () {
      return this._eyeCartographic;
    },
  },

  /**
   * 高度（<code>x</code>）和高度平方（<code>y</code>）
   * 以米为单位，表示眼睛（相机）在 2D 世界平面上的高度。此统一变量仅在
   * {@link SceneMode} 为 <code>SCENE2D</code> 时有效。
   * @memberof UniformState.prototype
   * @type {Cartesian2}
   */
  eyeHeight2D: {
    get: function () {
      return this._eyeHeight2D;
    },
  },

  /**
   * 在相机位置处的椭球体表面法线，以模型坐标表示。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  eyeEllipsoidNormalEC: {
    get: function () {
      return this._eyeEllipsoidNormalEC;
    },
  },

  /**
   * 在相机位置处的椭球体曲率半径。
   * .x 分量是主垂直半径，.y 是子午面半径。
   * @memberof UniformState.prototype
   * @type {Cartesian2}
   */
  eyeEllipsoidCurvature: {
    get: function () {
      return this._eyeEllipsoidCurvature;
    },
  },

  /**
   * 从眼睛坐标到东-北-上坐标系的 3x3 旋转。
   * 以相机下方椭球面上的位置为中心。
   * 此统一变量仅在 {@link SceneMode} 为 <code>SCENE3D</code> 时有效。
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  eyeToEnu: {
    get: function () {
      return this._eyeToEnu;
    },
  },

  /**
   * 从模型坐标到东-北-上坐标系的变换。
   * 以最靠近相机的椭球面上的位置为中心。
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  modelToEnu: {
    get: function () {
      return this._modelToEnu;
    },
  },

  /**
   * {@link UniformState.prototype.modelToEnu} 的逆变换。
   * @memberof UniformState.prototype
   * @type {Matrix4}
   */
  enuToModel: {
    get: function () {
      return this._enuToModel;
    },
  },

  /**
   * 当前场景时间下的太阳在 3D 世界坐标中的位置。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  sunPositionWC: {
    get: function () {
      return this._sunPositionWC;
    },
  },

  /**
   * 当前场景时间下太阳在 2D 世界坐标中的位置。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  sunPositionColumbusView: {
    get: function () {
      return this._sunPositionColumbusView;
    },
  },

  /**
   * 当前场景时间下太阳在 3D 世界坐标中的归一化向量。即使在 2D 或
   * 哥伦布视图模式，此值返回 3D 场景中太阳的方向。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  sunDirectionWC: {
    get: function () {
      return this._sunDirectionWC;
    },
  },

  /**
   * 当前场景时间下太阳在眼睛坐标中的归一化向量。在 3D 模式下，此值
   * 返回从相机位置到太阳位置的实际向量。在 2D 和哥伦布视图中，它返回
   * 从等效的 3D 相机位置到 3D 场景中太阳位置的向量。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  sunDirectionEC: {
    get: function () {
      return this._sunDirectionEC;
    },
  },

  /**
   * 当前场景时间下，以眼睛坐标表示的指向月球的归一化向量。在 3D 模式下，此值
   * 返回从相机位置到月球位置的实际向量。在 2D 和 Columbus View 模式下，它返回
   * 从等效 3D 相机位置到 3D 场景中月球位置的向量。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  moonDirectionEC: {
    get: function () {
      return this._moonDirectionEC;
    },
  },

  /**
   * 以 3D 世界坐标表示的指向场景光源的归一化向量。即使在 2D 或
   * Columbus View 模式下，此值返回 3D 场景中指向光源的方向。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  lightDirectionWC: {
    get: function () {
      return this._lightDirectionWC;
    },
  },

  /**
   * 以眼睛坐标表示的指向场景光源的归一化向量。在 3D 模式下，此值
   * 返回从相机位置到光源的实际向量。在 2D 和 Columbus View 模式下，它返回
   * 从 3D 场景中等效 3D 相机位置到该位置的向量。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  lightDirectionEC: {
    get: function () {
      return this._lightDirectionEC;
    },
  },

  /**
   * 场景光源发出的光颜色。这相当于光颜色乘以光强度，且最大亮度限制为 1.0，
   * 适合非 HDR 照明场景。
   * 场景光源发出的高动态范围光颜色。这相当于
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  lightColor: {
    get: function () {
      return this._lightColor;
    },
  },

  /**
   * 光颜色乘以适合 HDR 照明的光强度。
   * 相机位置的高位。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  lightColorHdr: {
    get: function () {
      return this._lightColorHdr;
    },
  },

  /**
   * 相机位置的低位。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  encodedCameraPositionMCHigh: {
    get: function () {
      cleanEncodedCameraPositionMC(this);
      return this._encodedCameraPositionMC.high;
    },
  },

  /**
   * 从真赤道平均分点轴到
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  encodedCameraPositionMCLow: {
    get: function () {
      cleanEncodedCameraPositionMC(this);
      return this._encodedCameraPositionMC.low;
    },
  },

  /**
   * 在 Scene 当前时间下，将 True Equator Mean Equinox (TEME) 轴转换为
   * 伪固定轴的 3x3 矩阵。
   * @memberof UniformState.prototype
   * @type {Matrix3}
   */
  temeToPseudoFixedMatrix: {
    get: function () {
      return this._temeToPseudoFixed;
    },
  },

  /**
   * 获取从画布像素空间到画布坐标空间的缩放因子。
   * 根据与相机的距离混合颜色与雾色的标量。
   * @memberof UniformState.prototype
   * @type {number}
   */
  pixelRatio: {
    get: function () {
      return this._pixelRatio;
    },
  },

  /**
   * 根据与相机的距离混合颜色与雾色的标量。
   * @memberof UniformState.prototype
   * @type {number}
   */
  fogDensity: {
    get: function () {
      return this._fogDensity;
    },
  },

  /**
   * 增强雾效时作为最小值的标量。
   * @memberof UniformState.prototype
   * @type {number}
   */
  fogVisualDensityScalar: {
    get: function () {
      return this._fogVisualDensityScalar;
    },
  },

  /**
   * 在 HSB 空间中应用于大气颜色的颜色偏移量。
   * @memberof UniformState.prototype
   * @type {number}
   */
  fogMinimumBrightness: {
    get: function () {
      return this._fogMinimumBrightness;
    },
  },

  /**
   * 用于计算大气颜色的大气色偏移量。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  atmosphereHsbShift: {
    get: function () {
      return this._atmosphereHsbShift;
    },
  },
  /**
   * 用于计算天空大气颜色的大气散射强度。
   * @memberof UniformState.prototype
   * @type {number}
   */
  atmosphereLightIntensity: {
    get: function () {
      return this._atmosphereLightIntensity;
    },
  },
  /**
   * 用于天空大气大气散射方程的瑞利散射系数。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  atmosphereRayleighCoefficient: {
    get: function () {
      return this._atmosphereRayleighCoefficient;
    },
  },
  /**
   * 用于天空大气大气散射方程的瑞利尺度高度，单位：米。
   * @memberof UniformState.prototype
   * @type {number}
   */
  atmosphereRayleighScaleHeight: {
    get: function () {
      return this._atmosphereRayleighScaleHeight;
    },
  },
  /**
   * 用于天空大气大气散射方程的 Mie 散射系数。
   * @memberof UniformState.prototype
   * @type {Cartesian3}
   */
  atmosphereMieCoefficient: {
    get: function () {
      return this._atmosphereMieCoefficient;
    },
  },
  /**
   * 用于天空大气大气散射方程的 Mie 尺度高度，单位：米。
   * @memberof UniformState.prototype
   * @type {number}
   */
  atmosphereMieScaleHeight: {
    get: function () {
      return this._atmosphereMieScaleHeight;
    },
  },
  /**
   * 考虑用于 Mie 散射的介质各向异性。
   * @memberof UniformState.prototype
   * @type {number}
   */
  atmosphereMieAnisotropy: {
    get: function () {
      return this._atmosphereMieAnisotropy;
    },
  },
  /**
   * 用于动态照明大气的光源选择。
   *
   * @memberof UniformState.prototype
   * @type {DynamicAtmosphereLightingType}
   */
  atmosphereDynamicLighting: {
    get: function () {
      return this._atmosphereDynamicLighting;
    },
  },

  /**
   * 表示每米几何容差的量纲因子。
   * @memberof UniformState.prototype
   * @type {number}
   */
  geometricToleranceOverMeter: {
    get: function () {
      return this._geometricToleranceOverMeter;
    },
  },

  /**
   * @memberof UniformState.prototype
   * @type {Pass}
   */
  pass: {
    get: function () {
      return this._pass;
    },
  },

  /**
   * 当前背景颜色。
   * @memberof UniformState.prototype
   * @type {Color}
   */
  backgroundColor: {
    get: function () {
      return this._backgroundColor;
    },
  },

  /**
   * 用于查找材料BRDF的纹理。
   * @memberof UniformState.prototype
   * @type {Texture}
   */
  brdfLut: {
    get: function () {
      return this._brdfLut;
    },
  },

  /**
   * 场景的环境映射。
   * @memberof UniformState.prototype
   * @type {CubeMap}
   */
  environmentMap: {
    get: function () {
      return this._environmentMap;
    },
  },

  /**
   * 场景的球谐系数。
   * @memberof UniformState.prototype
   * @type {Cartesian3[]}
   */
  sphericalHarmonicCoefficients: {
    get: function () {
      return this._sphericalHarmonicCoefficients;
    },
  },

  /**
   * 场景的镜面环境立方体映射。
   * @memberof UniformState.prototype
   * @type {Texture}
   */
  specularEnvironmentMaps: {
    get: function () {
      return this._specularEnvironmentMaps;
    },
  },

  /**
   * 场景的镜面环境立方体映射的最大细节级别。
   * @memberof UniformState.prototype
   * @type {number}
   */
  specularEnvironmentMapsMaximumLOD: {
    get: function () {
      return this._specularEnvironmentMapsMaximumLOD;
    },
  },

  /**
   * 使用分割器渲染时使用的分割器位置。该位置以相对于画布的像素坐标表示。
   * @memberof UniformState.prototype
   * @type {number}
   */
  splitPosition: {
    get: function () {
      return this._splitPosition;
    },
  },

  /**
   * 在相机处，用于禁用板状物体、标签和点的深度测试的距离。
   * 例如，用于防止与地形发生裁剪。设置为零时，深度测试应始终被应用。设置小于零时，深度测试不应被应用。
   * 未分类 3D 瓦片的高光颜色。
   *
   * @memberof UniformState.prototype
   * @type {number}
   */
  minimumDisableDepthTestDistance: {
    get: function () {
      return this._minimumDisableDepthTestDistance;
    },
  },

  /**
   * 当前投影是否为三维正交投影。
   *
   * @memberof UniformState.prototype
   * @type {Color}
   */
  invertClassificationColor: {
    get: function () {
      return this._invertClassificationColor;
    },
  },

  /**
   * 当前投影是否为三维正交投影。
   *
   * @memberOf UniformState.prototype
   * @type {boolean}
   */
  orthographicIn3D: {
    get: function () {
      return this._orthographicIn3D;
    },
  },

  /**
   * 当前的椭球体。
   *
   * @memberOf UniformState.prototype
   * @type {Ellipsoid}
   */
  ellipsoid: {
    get: function () {
      return this._ellipsoid ?? Ellipsoid.default;
    },
  },
});

function setView(uniformState, matrix) {
  Matrix4.clone(matrix, uniformState._view);
  Matrix4.getMatrix3(matrix, uniformState._viewRotation);

  uniformState._view3DDirty = true;
  uniformState._inverseView3DDirty = true;
  uniformState._modelViewDirty = true;
  uniformState._modelView3DDirty = true;
  uniformState._modelViewRelativeToEyeDirty = true;
  uniformState._inverseModelViewDirty = true;
  uniformState._inverseModelView3DDirty = true;
  uniformState._viewProjectionDirty = true;
  uniformState._inverseViewProjectionDirty = true;
  uniformState._modelViewProjectionDirty = true;
  uniformState._modelViewProjectionRelativeToEyeDirty = true;
  uniformState._modelViewInfiniteProjectionDirty = true;
  uniformState._normalDirty = true;
  uniformState._inverseNormalDirty = true;
  uniformState._normal3DDirty = true;
  uniformState._inverseNormal3DDirty = true;
}

function setInverseView(uniformState, matrix) {
  Matrix4.clone(matrix, uniformState._inverseView);
  Matrix4.getMatrix3(matrix, uniformState._inverseViewRotation);
}

function setProjection(uniformState, matrix) {
  Matrix4.clone(matrix, uniformState._projection);

  uniformState._inverseProjectionDirty = true;
  uniformState._viewProjectionDirty = true;
  uniformState._inverseViewProjectionDirty = true;
  uniformState._modelViewProjectionDirty = true;
  uniformState._modelViewProjectionRelativeToEyeDirty = true;
}

function setInfiniteProjection(uniformState, matrix) {
  Matrix4.clone(matrix, uniformState._infiniteProjection);

  uniformState._modelViewInfiniteProjectionDirty = true;
}

const surfacePositionScratch = new Cartesian3();
const enuTransformScratch = new Matrix4();
const enuRotationScratch = new Matrix3();

function setCamera(uniformState, camera) {
  Cartesian3.clone(camera.positionWC, uniformState._cameraPosition);
  Cartesian3.clone(camera.directionWC, uniformState._cameraDirection);
  Cartesian3.clone(camera.rightWC, uniformState._cameraRight);
  Cartesian3.clone(camera.upWC, uniformState._cameraUp);

  const ellipsoid = uniformState._ellipsoid;
  let surfacePosition;

  const positionCartographic = camera.positionCartographic;
  if (!defined(positionCartographic)) {
    uniformState._eyeHeight = -ellipsoid.maximumRadius;
    if (Cartesian3.magnitude(camera.positionWC) > 0.0) {
      uniformState._eyeEllipsoidNormalEC = Cartesian3.normalize(
        camera.positionWC,
        uniformState._eyeEllipsoidNormalEC,
      );
    }
    surfacePosition = ellipsoid.scaleToGeodeticSurface(
      camera.positionWC,
      surfacePositionScratch,
    );
  } else {
    uniformState._eyeHeight = positionCartographic.height;
    uniformState._eyeCartographic = Cartesian3.fromElements(
      positionCartographic.longitude,
      positionCartographic.latitude,
      positionCartographic.height,
      uniformState._eyeCartographic,
    );
    uniformState._eyeEllipsoidNormalEC =
      ellipsoid.geodeticSurfaceNormalCartographic(
        positionCartographic,
        uniformState._eyeEllipsoidNormalEC,
      );
    surfacePosition = Cartesian3.fromRadians(
      positionCartographic.longitude,
      positionCartographic.latitude,
      0.0,
      ellipsoid,
      surfacePositionScratch,
    );
  }

  uniformState._encodedCameraPositionMCDirty = true;

  if (!defined(surfacePosition)) {
    return;
  }

  uniformState._eyeEllipsoidNormalEC = Matrix3.multiplyByVector(
    uniformState._viewRotation,
    uniformState._eyeEllipsoidNormalEC,
    uniformState._eyeEllipsoidNormalEC,
  );

  const enuToWorld = FixedFrameTransforms.eastNorthUpToFixedFrame(
    surfacePosition,
    ellipsoid,
    enuTransformScratch,
  );
  uniformState._enuToModel = Matrix4.multiplyTransformation(
    uniformState.inverseModel,
    enuToWorld,
    uniformState._enuToModel,
  );
  uniformState._modelToEnu = Matrix4.inverseTransformation(
    uniformState._enuToModel,
    uniformState._modelToEnu,
  );

  const enuToWorldRotation = Matrix4.getRotation(
    enuToWorld,
    enuRotationScratch,
  );
  const enuToView = Matrix3.multiply(
    uniformState._viewRotation,
    enuToWorldRotation,
    enuRotationScratch,
  );
  uniformState._eyeToEnu = Matrix3.transpose(enuToView, uniformState._eyeToEnu);

  if (
    !CesiumMath.equalsEpsilon(
      ellipsoid._radii.x,
      ellipsoid._radii.y,
      CesiumMath.EPSILON15,
    )
  ) {
    // Ellipsoid curvature calculations assume radii.x === radii.y as is true for WGS84
    return;
  }

  uniformState._eyeEllipsoidCurvature = ellipsoid.getLocalCurvature(
    surfacePosition,
    uniformState._eyeEllipsoidCurvature,
  );
}

const transformMatrix = new Matrix3();
const sunCartographicScratch = new Cartographic();
function setSunAndMoonDirections(uniformState, frameState) {
  CelestialFrameTransforms.computeIcrfToCentralBodyFixedMatrix(
    frameState.time,
    transformMatrix,
  );

  let position =
    Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
      frameState.time,
      uniformState._sunPositionWC,
    );
  Matrix3.multiplyByVector(transformMatrix, position, position);

  Cartesian3.normalize(position, uniformState._sunDirectionWC);

  position = Matrix3.multiplyByVector(
    uniformState.viewRotation3D,
    position,
    uniformState._sunDirectionEC,
  );
  Cartesian3.normalize(position, position);

  position =
    Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(
      frameState.time,
      uniformState._moonDirectionEC,
    );
  Matrix3.multiplyByVector(transformMatrix, position, position);
  Matrix3.multiplyByVector(uniformState.viewRotation3D, position, position);
  Cartesian3.normalize(position, position);

  const projection = frameState.mapProjection;
  const ellipsoid = projection.ellipsoid;
  const sunCartographic = ellipsoid.cartesianToCartographic(
    uniformState._sunPositionWC,
    sunCartographicScratch,
  );
  projection.project(sunCartographic, uniformState._sunPositionColumbusView);
}

/**
 * 将视锥体的状态与相机状态同步。在渲染时，{@link Scene}会执行此操作，以确保自动的 GLSL 统一变量被设置为正确值。
 * 与要同步的相机。
 * 将视锥体的状态与统一状态同步。在渲染时，{@link Scene}会执行此操作，以确保自动的 GLSL 统一变量被设置为正确值。
 *
 * @param {object} camera 要同步的相机。
 */
UniformState.prototype.updateCamera = function (camera) {
  setView(this, camera.viewMatrix);
  setInverseView(this, camera.inverseViewMatrix);
  setCamera(this, camera);

  this._entireFrustum.x = camera.frustum.near;
  this._entireFrustum.y = camera.frustum.far;
  this.updateFrustum(camera.frustum);

  this._orthographicIn3D =
    this._mode !== SceneMode.SCENE2D &&
    camera.frustum instanceof OrthographicFrustum;
};

/**
 * 将视锥体的状态与统一状态同步。在渲染时，{@link Scene}会执行此操作，以确保自动的 GLSL 统一变量被设置为正确值。
 * 与要同步的相机。
 * 要同步的帧状态。
 *
 * @param {object} frustum 要同步的帧状态。
 */
UniformState.prototype.updateFrustum = function (frustum) {
  // If any frustum parameters have changed, calling the frustum.projectionMatrix
  // getter will recompute the projection before it is copied.
  setProjection(this, frustum.projectionMatrix);

  if (defined(frustum.infiniteProjectionMatrix)) {
    setInfiniteProjection(this, frustum.infiniteProjectionMatrix);
  }
  this._currentFrustum.x = frustum.near;
  this._currentFrustum.y = frustum.far;

  this._farDepthFromNearPlusOne = frustum.far - frustum.near + 1.0;
  this._log2FarDepthFromNearPlusOne = CesiumMath.log2(
    this._farDepthFromNearPlusOne,
  );
  this._oneOverLog2FarDepthFromNearPlusOne =
    1.0 / this._log2FarDepthFromNearPlusOne;

  const offCenterFrustum = frustum.offCenterFrustum;
  if (defined(offCenterFrustum)) {
    frustum = offCenterFrustum;
  }

  this._frustumPlanes.x = frustum.top;
  this._frustumPlanes.y = frustum.bottom;
  this._frustumPlanes.z = frustum.left;
  this._frustumPlanes.w = frustum.right;
};

UniformState.prototype.updatePass = function (pass) {
  this._pass = pass;
};

const EMPTY_ARRAY = [];
const defaultLight = new SunLight();

/**
 * 将帧状态与统一状态同步。在渲染时，{@link Scene}会执行此操作，以确保自动的 GLSL 统一变量被设置为正确值。
 * 与要同步的帧状态。
 * are set to the right value.
 *
 * @param {FrameState} frameState The frameState to synchronize with.
 */
UniformState.prototype.update = function (frameState) {
  this._mode = frameState.mode;
  this._mapProjection = frameState.mapProjection;
  this._ellipsoid = frameState.mapProjection.ellipsoid;
  this._pixelRatio = frameState.pixelRatio;

  const camera = frameState.camera;
  this.updateCamera(camera);

  if (frameState.mode === SceneMode.SCENE2D) {
    this._frustum2DWidth = camera.frustum.right - camera.frustum.left;
    this._eyeHeight2D.x = this._frustum2DWidth * 0.5;
    this._eyeHeight2D.y = this._eyeHeight2D.x * this._eyeHeight2D.x;
  } else {
    this._frustum2DWidth = 0.0;
    this._eyeHeight2D.x = 0.0;
    this._eyeHeight2D.y = 0.0;
  }

  setSunAndMoonDirections(this, frameState);

  const light = frameState.light ?? defaultLight;
  if (light instanceof SunLight) {
    this._lightDirectionWC = Cartesian3.clone(
      this._sunDirectionWC,
      this._lightDirectionWC,
    );
    this._lightDirectionEC = Cartesian3.clone(
      this._sunDirectionEC,
      this._lightDirectionEC,
    );
  } else {
    this._lightDirectionWC = Cartesian3.normalize(
      Cartesian3.negate(light.direction, this._lightDirectionWC),
      this._lightDirectionWC,
    );
    this._lightDirectionEC = Matrix3.multiplyByVector(
      this.viewRotation3D,
      this._lightDirectionWC,
      this._lightDirectionEC,
    );
  }

  const lightColor = light.color;
  let lightColorHdr = Cartesian3.fromElements(
    lightColor.red,
    lightColor.green,
    lightColor.blue,
    this._lightColorHdr,
  );
  lightColorHdr = Cartesian3.multiplyByScalar(
    lightColorHdr,
    light.intensity,
    lightColorHdr,
  );
  const maximumComponent = Cartesian3.maximumComponent(lightColorHdr);
  if (maximumComponent > 1.0) {
    Cartesian3.divideByScalar(
      lightColorHdr,
      maximumComponent,
      this._lightColor,
    );
  } else {
    Cartesian3.clone(lightColorHdr, this._lightColor);
  }

  const brdfLutGenerator = frameState.brdfLutGenerator;
  const brdfLut = defined(brdfLutGenerator)
    ? brdfLutGenerator.colorTexture
    : undefined;
  this._brdfLut = brdfLut;

  this._environmentMap =
    frameState.environmentMap ?? frameState.context.defaultCubeMap;

  // IE 11 doesn't optimize out uniforms that are #ifdef'd out. So undefined values for the spherical harmonic
  // coefficients cause a crash.
  this._sphericalHarmonicCoefficients =
    frameState.sphericalHarmonicCoefficients ?? EMPTY_ARRAY;
  this._specularEnvironmentMaps = frameState.specularEnvironmentMaps;
  this._specularEnvironmentMapsMaximumLOD =
    frameState.specularEnvironmentMapsMaximumLOD;

  this._fogDensity = frameState.fog.density;
  this._fogVisualDensityScalar = frameState.fog.visualDensityScalar;
  this._fogMinimumBrightness = frameState.fog.minimumBrightness;

  const atmosphere = frameState.atmosphere;
  if (defined(atmosphere)) {
    this._atmosphereHsbShift = Cartesian3.fromElements(
      atmosphere.hueShift,
      atmosphere.saturationShift,
      atmosphere.brightnessShift,
      this._atmosphereHsbShift,
    );
    this._atmosphereLightIntensity = atmosphere.lightIntensity;
    this._atmosphereRayleighCoefficient = Cartesian3.clone(
      atmosphere.rayleighCoefficient,
      this._atmosphereRayleighCoefficient,
    );
    this._atmosphereRayleighScaleHeight = atmosphere.rayleighScaleHeight;
    this._atmosphereMieCoefficient = Cartesian3.clone(
      atmosphere.mieCoefficient,
      this._atmosphereMieCoefficient,
    );
    this._atmosphereMieScaleHeight = atmosphere.mieScaleHeight;
    this._atmosphereMieAnisotropy = atmosphere.mieAnisotropy;
    this._atmosphereDynamicLighting = atmosphere.dynamicLighting;
  }

  this._invertClassificationColor = frameState.invertClassificationColor;

  this._frameState = frameState;
  this._temeToPseudoFixed =
    CelestialFrameTransforms.computeTemeToPseudoFixedMatrix(
      frameState.time,
      this._temeToPseudoFixed,
    );

  // Convert the relative splitPosition to absolute pixel coordinates
  this._splitPosition =
    frameState.splitPosition * frameState.context.drawingBufferWidth;
  const fov = camera.frustum.fov;
  const viewport = this._viewport;
  let pixelSizePerMeter;
  if (defined(fov)) {
    if (viewport.height > viewport.width) {
      pixelSizePerMeter = (Math.tan(0.5 * fov) * 2.0) / viewport.height;
    } else {
      pixelSizePerMeter = (Math.tan(0.5 * fov) * 2.0) / viewport.width;
    }
  } else {
    pixelSizePerMeter = 1.0 / Math.max(viewport.width, viewport.height);
  }

  this._geometricToleranceOverMeter =
    pixelSizePerMeter * frameState.maximumScreenSpaceError;
  Color.clone(frameState.backgroundColor, this._backgroundColor);

  this._minimumDisableDepthTestDistance =
    frameState.minimumDisableDepthTestDistance;
  this._minimumDisableDepthTestDistance *=
    this._minimumDisableDepthTestDistance;
  if (this._minimumDisableDepthTestDistance === Number.POSITIVE_INFINITY) {
    this._minimumDisableDepthTestDistance = -1.0;
  }
};

function cleanViewport(uniformState) {
  if (uniformState._viewportDirty) {
    const v = uniformState._viewport;
    Matrix4.computeOrthographicOffCenter(
      v.x,
      v.x + v.width,
      v.y,
      v.y + v.height,
      0.0,
      1.0,
      uniformState._viewportOrthographicMatrix,
    );
    Matrix4.computeViewportTransformation(
      v,
      0.0,
      1.0,
      uniformState._viewportTransformation,
    );
    uniformState._viewportDirty = false;
  }
}

function cleanInverseProjection(uniformState) {
  if (uniformState._inverseProjectionDirty) {
    uniformState._inverseProjectionDirty = false;

    if (
      uniformState._mode !== SceneMode.SCENE2D &&
      uniformState._mode !== SceneMode.MORPHING &&
      !uniformState._orthographicIn3D
    ) {
      Matrix4.inverse(
        uniformState._projection,
        uniformState._inverseProjection,
      );
    } else {
      Matrix4.clone(Matrix4.ZERO, uniformState._inverseProjection);
    }
  }
}

// Derived
function cleanModelView(uniformState) {
  if (uniformState._modelViewDirty) {
    uniformState._modelViewDirty = false;

    Matrix4.multiplyTransformation(
      uniformState._view,
      uniformState._model,
      uniformState._modelView,
    );
  }
}

function cleanModelView3D(uniformState) {
  if (uniformState._modelView3DDirty) {
    uniformState._modelView3DDirty = false;

    Matrix4.multiplyTransformation(
      uniformState.view3D,
      uniformState._model,
      uniformState._modelView3D,
    );
  }
}

function cleanInverseModelView(uniformState) {
  if (uniformState._inverseModelViewDirty) {
    uniformState._inverseModelViewDirty = false;

    Matrix4.inverse(uniformState.modelView, uniformState._inverseModelView);
  }
}

function cleanInverseModelView3D(uniformState) {
  if (uniformState._inverseModelView3DDirty) {
    uniformState._inverseModelView3DDirty = false;

    Matrix4.inverse(uniformState.modelView3D, uniformState._inverseModelView3D);
  }
}

function cleanViewProjection(uniformState) {
  if (uniformState._viewProjectionDirty) {
    uniformState._viewProjectionDirty = false;

    Matrix4.multiply(
      uniformState._projection,
      uniformState._view,
      uniformState._viewProjection,
    );
  }
}

function cleanInverseViewProjection(uniformState) {
  if (uniformState._inverseViewProjectionDirty) {
    uniformState._inverseViewProjectionDirty = false;

    Matrix4.inverse(
      uniformState.viewProjection,
      uniformState._inverseViewProjection,
    );
  }
}

function cleanModelViewProjection(uniformState) {
  if (uniformState._modelViewProjectionDirty) {
    uniformState._modelViewProjectionDirty = false;

    Matrix4.multiply(
      uniformState._projection,
      uniformState.modelView,
      uniformState._modelViewProjection,
    );
  }
}

function cleanModelViewRelativeToEye(uniformState) {
  if (uniformState._modelViewRelativeToEyeDirty) {
    uniformState._modelViewRelativeToEyeDirty = false;

    const mv = uniformState.modelView;
    const mvRte = uniformState._modelViewRelativeToEye;
    mvRte[0] = mv[0];
    mvRte[1] = mv[1];
    mvRte[2] = mv[2];
    mvRte[3] = mv[3];
    mvRte[4] = mv[4];
    mvRte[5] = mv[5];
    mvRte[6] = mv[6];
    mvRte[7] = mv[7];
    mvRte[8] = mv[8];
    mvRte[9] = mv[9];
    mvRte[10] = mv[10];
    mvRte[11] = mv[11];
    mvRte[12] = 0.0;
    mvRte[13] = 0.0;
    mvRte[14] = 0.0;
    mvRte[15] = mv[15];
  }
}

function cleanInverseModelViewProjection(uniformState) {
  if (uniformState._inverseModelViewProjectionDirty) {
    uniformState._inverseModelViewProjectionDirty = false;

    Matrix4.inverse(
      uniformState.modelViewProjection,
      uniformState._inverseModelViewProjection,
    );
  }
}

function cleanModelViewProjectionRelativeToEye(uniformState) {
  if (uniformState._modelViewProjectionRelativeToEyeDirty) {
    uniformState._modelViewProjectionRelativeToEyeDirty = false;

    Matrix4.multiply(
      uniformState._projection,
      uniformState.modelViewRelativeToEye,
      uniformState._modelViewProjectionRelativeToEye,
    );
  }
}

function cleanModelViewInfiniteProjection(uniformState) {
  if (uniformState._modelViewInfiniteProjectionDirty) {
    uniformState._modelViewInfiniteProjectionDirty = false;

    Matrix4.multiply(
      uniformState._infiniteProjection,
      uniformState.modelView,
      uniformState._modelViewInfiniteProjection,
    );
  }
}

function cleanNormal(uniformState) {
  if (uniformState._normalDirty) {
    uniformState._normalDirty = false;

    const m = uniformState._normal;
    Matrix4.getMatrix3(uniformState.inverseModelView, m);
    Matrix3.transpose(m, m);
  }
}

function cleanNormal3D(uniformState) {
  if (uniformState._normal3DDirty) {
    uniformState._normal3DDirty = false;

    const m = uniformState._normal3D;
    Matrix4.getMatrix3(uniformState.inverseModelView3D, m);
    Matrix3.transpose(m, m);
  }
}

function cleanInverseNormal(uniformState) {
  if (uniformState._inverseNormalDirty) {
    uniformState._inverseNormalDirty = false;

    const m = uniformState._inverseNormal;
    Matrix4.getMatrix3(uniformState.modelView, m);
    Matrix3.transpose(m, m);
  }
}

function cleanInverseNormal3D(uniformState) {
  if (uniformState._inverseNormal3DDirty) {
    uniformState._inverseNormal3DDirty = false;

    const m = uniformState._inverseNormal3D;
    Matrix4.getMatrix3(uniformState.modelView3D, m);
    Matrix3.transpose(m, m);
  }
}

const cameraPositionMC = new Cartesian3();

function cleanEncodedCameraPositionMC(uniformState) {
  if (uniformState._encodedCameraPositionMCDirty) {
    uniformState._encodedCameraPositionMCDirty = false;

    Matrix4.multiplyByPoint(
      uniformState.inverseModel,
      uniformState._cameraPosition,
      cameraPositionMC,
    );
    EncodedCartesian3.fromCartesian(
      cameraPositionMC,
      uniformState._encodedCameraPositionMC,
    );
  }
}

const view2Dto3DPScratch = new Cartesian3();
const view2Dto3DRScratch = new Cartesian3();
const view2Dto3DUScratch = new Cartesian3();
const view2Dto3DDScratch = new Cartesian3();
const view2Dto3DCartographicScratch = new Cartographic();
const view2Dto3DCartesian3Scratch = new Cartesian3();
const view2Dto3DMatrix4Scratch = new Matrix4();

function view2Dto3D(
  position2D,
  direction2D,
  right2D,
  up2D,
  frustum2DWidth,
  mode,
  projection,
  result,
) {
  // The camera position and directions are expressed in the 2D coordinate system where the Y axis is to the East,
  // the Z axis is to the North, and the X axis is out of the map.  Express them instead in the ENU axes where
  // X is to the East, Y is to the North, and Z is out of the local horizontal plane.
  const p = view2Dto3DPScratch;
  p.x = position2D.y;
  p.y = position2D.z;
  p.z = position2D.x;

  const r = view2Dto3DRScratch;
  r.x = right2D.y;
  r.y = right2D.z;
  r.z = right2D.x;

  const u = view2Dto3DUScratch;
  u.x = up2D.y;
  u.y = up2D.z;
  u.z = up2D.x;

  const d = view2Dto3DDScratch;
  d.x = direction2D.y;
  d.y = direction2D.z;
  d.z = direction2D.x;

  // In 2D, the camera height is always 12.7 million meters.
  // The apparent height is equal to half the frustum width.
  if (mode === SceneMode.SCENE2D) {
    p.z = frustum2DWidth * 0.5;
  }

  // Compute the equivalent camera position in the real (3D) world.
  // In 2D and Columbus View, the camera can travel outside the projection, and when it does so
  // there's not really any corresponding location in the real world.  So clamp the unprojected
  // longitude and latitude to their valid ranges.
  const cartographic = projection.unproject(p, view2Dto3DCartographicScratch);
  cartographic.longitude = CesiumMath.clamp(
    cartographic.longitude,
    -Math.PI,
    Math.PI,
  );
  cartographic.latitude = CesiumMath.clamp(
    cartographic.latitude,
    -CesiumMath.PI_OVER_TWO,
    CesiumMath.PI_OVER_TWO,
  );
  const ellipsoid = projection.ellipsoid;
  const position3D = ellipsoid.cartographicToCartesian(
    cartographic,
    view2Dto3DCartesian3Scratch,
  );

  // Compute the rotation from the local ENU at the real world camera position to the fixed axes.
  const enuToFixed = FixedFrameTransforms.eastNorthUpToFixedFrame(
    position3D,
    ellipsoid,
    view2Dto3DMatrix4Scratch,
  );

  // Transform each camera direction to the fixed axes.
  Matrix4.multiplyByPointAsVector(enuToFixed, r, r);
  Matrix4.multiplyByPointAsVector(enuToFixed, u, u);
  Matrix4.multiplyByPointAsVector(enuToFixed, d, d);

  // Compute the view matrix based on the new fixed-frame camera position and directions.
  if (!defined(result)) {
    result = new Matrix4();
  }

  result[0] = r.x;
  result[1] = u.x;
  result[2] = -d.x;
  result[3] = 0.0;
  result[4] = r.y;
  result[5] = u.y;
  result[6] = -d.y;
  result[7] = 0.0;
  result[8] = r.z;
  result[9] = u.z;
  result[10] = -d.z;
  result[11] = 0.0;
  result[12] = -Cartesian3.dot(r, position3D);
  result[13] = -Cartesian3.dot(u, position3D);
  result[14] = Cartesian3.dot(d, position3D);
  result[15] = 1.0;

  return result;
}

function updateView3D(that) {
  if (that._view3DDirty) {
    if (that._mode === SceneMode.SCENE3D) {
      Matrix4.clone(that._view, that._view3D);
    } else {
      view2Dto3D(
        that._cameraPosition,
        that._cameraDirection,
        that._cameraRight,
        that._cameraUp,
        that._frustum2DWidth,
        that._mode,
        that._mapProjection,
        that._view3D,
      );
    }
    Matrix4.getMatrix3(that._view3D, that._viewRotation3D);
    that._view3DDirty = false;
  }
}

function updateInverseView3D(that) {
  if (that._inverseView3DDirty) {
    Matrix4.inverseTransformation(that.view3D, that._inverseView3D);
    Matrix4.getMatrix3(that._inverseView3D, that._inverseViewRotation3D);
    that._inverseView3DDirty = false;
  }
}
export default UniformState;
