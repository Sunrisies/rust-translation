import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Cartographic,
  Check,
  Color,
  Ellipsoid,
  Event,
  Frozen,
  JulianDate,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  VerticalExaggeration,
  clone,
  defined,
  destroyObject,
  oneTimeWarning,
} from "@cesium/core";
import buildVoxelCustomShader from "./buildVoxelCustomShader.js";
import buildVoxelDrawCommands from "./buildVoxelDrawCommands.js";
import Cesium3DTilesetStatistics from "./Cesium3DTilesetStatistics.js";
import ClippingPlaneCollection from "./ClippingPlaneCollection.js";
import CustomShader from "./Model/CustomShader.js";
import Material from "./Material.js";
import MetadataComponentType from "./MetadataComponentType.js";
import MetadataType from "./MetadataType.js";
import PolylineCollection from "./PolylineCollection.js";
import VoxelContent from "./VoxelContent.js";
import VoxelShapeType from "./VoxelShapeType.js";
import VoxelTraversal from "./VoxelTraversal.js";
import VoxelMetadataOrder from "./VoxelMetadataOrder.js";

/**
 * 一个从 {@link VoxelProvider} 提供体素数据进行渲染的原始对象。
 *
 * @alias VoxelPrimitive
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {VoxelProvider} [options.provider] 提供带有瓦片数据的体素提供器。
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 用于转换原始对象的模型矩阵。
 * @param {CustomShader} [options.customShader] 用于为原始对象添加样式的自定义着色器。
 * @param {Clock} [options.clock] 用于控制时间动态行为的时钟。
 * @param {boolean} [options.calculateStatistics] 生成性能统计信息。
 *
 * @see VoxelProvider
 * @see Cesium3DTilesVoxelProvider
 * @see VoxelShapeType
 * @see {@link https://github.com/CesiumGS/cesium/tree/main/Documentation/CustomShaderGuide|Custom Shader Guide}
 *
 * @experimental This 此功能尚未最终确定，可能会根据 Cesium 的标准弃用政策进行更改。
 */
function VoxelPrimitive(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    provider = VoxelPrimitive.DefaultProvider,
    modelMatrix = Matrix4.IDENTITY,
    customShader = buildVoxelCustomShader(provider),
    clock,
    calculateStatistics = false,
  } = options;

  /**
   * @type {boolean}
   * @private
   */
  this._ready = false;

  /**
   * @type {VoxelProvider}
   * @private
   */
  this._provider = provider;

  /**
   * 此成员在第一次更新循环之前不会创建。
   *
   * @type {VoxelTraversal}
   * @private
   */
  this._traversal = undefined;

  /**
   * @type {Cesium3DTilesetStatistics}
   * @private
   */
  this._statistics = new Cesium3DTilesetStatistics();

  /**
   * @type {boolean}
   * @private
   */
  this._calculateStatistics = calculateStatistics;

  const {
    shape: shapeType,
    minBounds = VoxelShapeType.getMinBounds(shapeType),
    maxBounds = VoxelShapeType.getMaxBounds(shapeType),
    dimensions,
    paddingBefore = Cartesian3.ZERO,
    paddingAfter = Cartesian3.ZERO,
    metadataOrder,
    availableLevels = 1,
  } = provider;

  /**
   * @type {Cartesian3}
   * @readonly
   * @constant
   * @private
   */
  this._dimensions = Cartesian3.clone(dimensions);

  /**
   * @type {Cartesian3}
   * @private
   */
  this._paddingBefore = Cartesian3.clone(paddingBefore);

  /**
   * @type {Cartesian3}
   * @private
   */
  this._paddingAfter = Cartesian3.clone(paddingAfter);

  /**
   * @type {Cartesian3}
   * @private
   */
  this._inputDimensions = computeInputDimensions(
    dimensions,
    paddingBefore,
    paddingAfter,
    metadataOrder,
  );

  /**
   * @type {number}
   * @private
   */
  this._availableLevels = availableLevels;

  /**
   * @type {Cartesian3}
   * @private
   */
  this._minBounds = minBounds.clone();

  /**
   * 用于检测形状是否脏。
   *
   * @type {Cartesian3}
   * @private
   */
  this._minBoundsOld = new Cartesian3();

  /**
   * @type {Cartesian3}
   * @private
   */
  this._maxBounds = maxBounds.clone();

  /**
   * 用于检测形状是否脏。
   *
   * @type {Cartesian3}
   * @private
   */
  this._maxBoundsOld = new Cartesian3();

  /**
   * @type {Cartesian3}
   * @private
   */
  this._minClippingBounds = minBounds.clone();

  /**
   * 用于检测裁剪是否脏。
   *
   * @type {Cartesian3}
   * @private
   */
  this._minClippingBoundsOld = new Cartesian3();

  /**
   * @type {Cartesian3}
   * @private
   */
  this._maxClippingBounds = maxBounds.clone();

  /**
   * 用于检测裁剪是否脏。
   *
   * @type {Cartesian3}
   * @private
   */
  this._maxClippingBoundsOld = new Cartesian3();

  /**
   * 应用于体素形状的垂直放大比例。
   *
   * @type {number}
   * @private
   */
  this._verticalExaggeration = 1.0;

  /**
   * 形状被放大的相对高度。
   *
   * @type {number}
   * @private
   */
  this._verticalExaggerationRelativeHeight = 0.0;

  /**
   * 原始对象上的裁剪平面。
   *
   * @type {ClippingPlaneCollection}
   * @private
   */
  this._clippingPlanes = undefined;

  /**
   * 记录裁剪平面发生变化的时机。
   *
   * @type {number}
   * @private
   */
  this._clippingPlanesState = 0;

  /**
   * 记录裁剪平面启用/禁用时的时机。
   *
   * @type {boolean}
   * @private
   */
  this._clippingPlanesEnabled = false;

  /**
   * 原始对象的模型矩阵。
   *
   * @type {Matrix4}
   * @private
   */
  this._modelMatrix = Matrix4.clone(modelMatrix);

  /**
   * 用于检测模型矩阵是否脏。
   *
   * @type {Matrix4}
   * @private
   */
  this._modelMatrixOld = Matrix4.clone(this._modelMatrix);

  /**
   * @type {CustomShader}
   * @private
   */
  this._customShader = customShader ?? VoxelPrimitive.DefaultCustomShader;

  /**
   * @type {Event}
   * @private
   */
  this._customShaderCompilationEvent = new Event();

  /**
   * @type {boolean}
   * @private
   */
  this._shaderDirty = true;

  /**
   * @type {DrawCommand}
   * @private
   */
  this._drawCommand = undefined;

  /**
   * @type {DrawCommand}
   * @private
   */
  this._drawCommandPick = undefined;

  /**
   * @type {object}
   * @private
   */
  this._pickId = undefined;

  /**
   * @type {Clock}
   * @private
   */
  this._clock = clock;

  // Transforms and other values that are computed when the shape changes
  /**
   * @type {Matrix4}
   * @private
   */
  this._transformPositionLocalToWorld = new Matrix4();

  /**
   * @type {Matrix4}
   * @private
   */
  this._transformPositionWorldToLocal = new Matrix4();

  /**
   * 将 Hessian 法向量形式的平面从局部空间转换为视图空间。
   * @type {Matrix4}
   * @private
   */
  this._transformPlaneLocalToView = new Matrix4();

  /**
   * @type {Matrix3}
   * @private
   */
  this._transformDirectionWorldToLocal = new Matrix3();

  // Rendering
  /**
   * @type {boolean}
   * @private
   */
  this._nearestSampling = false;

  /**
   * @type {number}
   * @private
   */
  this._levelBlendFactor = 0.0;

  /**
   * @type {number}
   * @private
   */
  this._stepSizeMultiplier = 1.0;

  /**
   * @type {boolean}
   * @private
   */
  this._depthTest = true;

  /**
   * @type {boolean}
   * @private
   */
  this._useLogDepth = undefined;

  /**
   * @type {number}
   * @private
   */
  this._screenSpaceError = 4.0; // in pixels

  // Debug / statistics
  /**
   * @type {PolylineCollection}
   * @private
   */
  this._debugPolylines = new PolylineCollection();

  /**
   * @type {boolean}
   * @private
   */
  this._debugDraw = false;

  /**
   * @type {boolean}
   * @private
   */
  this._disableRender = false;

  /**
   * @type {boolean}
   * @private
   */
  this._disableUpdate = false;

  const ShapeConstructor = VoxelShapeType.getShapeConstructor(shapeType);

  /**
   * @type {VoxelShape}
   * @private
   */
  this._shape = new ShapeConstructor();

  checkTransformAndBounds(this);

  /**
   * @type {boolean}
   * @private
   */
  this._shapeVisible = updateShapeAndTransforms(this);

  /**
   * @type {Object<string, any>}
   * @private
   */
  this._uniforms = {
    octreeInternalNodeTexture: undefined,
    octreeInternalNodeTilesPerRow: 0,
    octreeInternalNodeTexelSizeUv: new Cartesian2(),
    octreeLeafNodeTexture: undefined,
    octreeLeafNodeTilesPerRow: 0,
    octreeLeafNodeTexelSizeUv: new Cartesian2(),
    megatextureTextures: [],
    megatextureTileCounts: new Cartesian3(),
    dimensions: this._dimensions,
    inputDimensions: this._inputDimensions,
    paddingBefore: this._paddingBefore,
    paddingAfter: this._paddingAfter,
    transformPositionViewToLocal: new Matrix4(),
    transformDirectionViewToLocal: new Matrix3(),
    cameraPositionLocal: new Cartesian3(),
    cameraDirectionLocal: new Cartesian3(),
    cameraTileCoordinates: new Cartesian4(),
    cameraTileUv: new Cartesian3(),
    ndcSpaceAxisAlignedBoundingBox: new Cartesian4(),
    clippingPlanesTexture: undefined,
    clippingPlanesMatrix: new Matrix4(),
    renderBoundPlanesTexture: undefined,
    stepSize: this._stepSizeMultiplier,
    pickColor: new Color(),
  };

  /**
   * 由之前的形状更新定义的特定于形状的着色器。用于检测是否需要重建该着色器。
   * @type {Object<string, any>}
   * @private
   */
  this._shapeDefinesOld = {};

  /**
   * 将统一变量名称映射到返回统一值的函数。
   * @type {Object<string, function():any>}
   * @private
   */
  this._uniformMap = {};

  const uniforms = this._uniforms;
  const uniformMap = this._uniformMap;
  for (const key in uniforms) {
    if (uniforms.hasOwnProperty(key)) {
      const name = `u_${key}`;
      uniformMap[name] = function () {
        return uniforms[key];
      };
    }
  }

  setupShapeUniformsAndDefines(this, this._shape);

  /**
   * 指示瓦片内容已加载的事件。
   * <p>
   * 在帧渲染期间进行瓦片遍历时触发此事件。
   * 以便瓦片的更新能在同一帧中生效。请勿在事件监听器中创建或修改 Cesium 实体或原始对象。
   * voxelPrimitive.tileLoad.addEventListener(function() {
   * </p>
   *
   * @type {Event}
   *
   * @example
   * console.log('一个瓦片已加载。');
   * 该事件在每一帧中针对每个可见瓦片触发一次。
   * });
   */
  this.tileLoad = new Event();

  /**
   * 在帧渲染期间进行遍历时触发此事件。
   * <p>
   * 在帧渲染期间进行遍历时触发此事件。
   *
   * @type {Event}
   *
   * @example
   * voxelPrimitive.tileVisible.addEventListener(function() {
   * console.log('一个瓦片可见。');
   * });
   *
   */
  this.tileVisible = new Event();

  /**
   * 指示瓦片内容加载失败的事件。
   *
   * @type {Event}
   *
   * @example
   * voxelPrimitive.tileFailed.addEventListener(function() {
   * console.log('加载瓦片时出错。');
   * });
   */
  this.tileFailed = new Event();

  /**
   * 指示瓦片内容已卸载的事件。
   *
   * @type {Event}
   *
   * @example
   * voxelPrimitive.tileUnload.addEventListener(function() {
   * console.log('一个瓦片从缓存中卸载。');
   * });
   *
   */
  this.tileUnload = new Event();

  /**
   * 指示新瓦片加载进度的事件。当新瓦片出现时触发此事件。
   * 在请求的瓦片完成下载时，以及已下载的瓦片被
   * 处理并准备渲染时触发。
   * <p>
   * 待处理的瓦片请求数 <code>numberOfPendingRequests</code> 和正在处理的瓦片数
   * 通过 <code>numberOfTilesProcessing</code> 传递给事件监听器。
   * </p>
   * <p>
   * 该事件在场景渲染完成后帧结束时触发。
   * </p>
   *
   * @type {Event}
   *
   * @example
   * voxelPrimitive.loadProgress.addEventListener(function(numberOfPendingRequests, numberOfTilesProcessing) {
   * if ((numberOfPendingRequests === 0) && (numberOfTilesProcessing === 0)) {
   * console.log('Finished loading');
   * return;
   *     }
   *
   * console.log(`Loading: requests: ${numberOfPendingRequests}, processing: ${numberOfTilesProcessing}`);
   * });
   */
  this.loadProgress = new Event();

  /**
   * 该事件表明此帧中所有满足屏幕空间错误的瓦片都已加载。voxel
   * primitive 对于此视图已完全加载。
   * <p>
   * 该事件在场景渲染完成后帧结束时触发。
   * </p>
   *
   * @type {Event}
   *
   * @example
   * voxelPrimitive.allTilesLoaded.addEventListener(function() {
   * console.log('All tiles are loaded');
   * });
   */
  this.allTilesLoaded = new Event();

  /**
   * 该事件表明此帧中所有满足屏幕空间错误的瓦片都已加载。该事件
   * 在初始视图中的所有瓦片加载后触发一次。
   * <p>
   * 该事件在场景渲染完成后帧结束时触发。
   * </p>
   *
   * @type {Event}
   *
   * @example
   * voxelPrimitive.initialTilesLoaded.addEventListener(function() {
   * console.log('Initial tiles are loaded');
   * });
   *
   * @see Cesium3DTileset#allTilesLoaded
   */
  this.initialTilesLoaded = new Event();
}

/**
 * 计算输入体素数据的尺寸，包括填充部分及输入方向。
 *
 * @param {Cartesian3} dimensions 不含填充部分的体素数据尺寸，采用 z 向上方向。
 * @param {Cartesian3} paddingBefore 体素数据前的填充部分。
 * @param {Cartesian3} paddingAfter 体素数据后的填充部分。
 * @param {VoxelMetadataOrder} metadataOrder 输入元数据尺寸的排序方式。
 *
 * @private
 */
function computeInputDimensions(
  dimensions,
  paddingBefore,
  paddingAfter,
  metadataOrder,
) {
  const inputDimensions = Cartesian3.add(
    dimensions,
    paddingBefore,
    new Cartesian3(),
  );
  Cartesian3.add(inputDimensions, paddingAfter, inputDimensions);
  if (metadataOrder === VoxelMetadataOrder.Y_UP) {
    const inputDimensionsY = inputDimensions.y;
    inputDimensions.y = inputDimensions.z;
    inputDimensions.z = inputDimensionsY;
  }
  return inputDimensions;
}

/**
 * 将形状中的统一变量与 primitive 统一映射结合，并
 * 设置形状定义的更改跟踪，以知道何时重建着色器。
 *
 * @param {VoxelPrimitive} primitive 与形状统一变量关联的 primitive。
 * @param {VoxelShape} shape 从中提取着色器统一变量和定义的形状。
 *
 * @private
 */
function setupShapeUniformsAndDefines(primitive, shape) {
  const uniformMap = primitive._uniformMap;
  const { shaderUniforms, shaderDefines } = shape;
  for (const uniformName in shaderUniforms) {
    if (shaderUniforms.hasOwnProperty(uniformName)) {
      const name = `u_${uniformName}`;

      //>>includeStart('debug', pragmas.debug);
      if (defined(uniformMap[name])) {
        oneTimeWarning(
          `VoxelPrimitive: Uniform name "${name}" is already defined`,
        );
      }
      //>>includeEnd('debug');

      uniformMap[name] = function () {
        return shaderUniforms[uniformName];
      };
    }
  }
  primitive._shapeDefinesOld = clone(shaderDefines, true);
}

Object.defineProperties(VoxelPrimitive.prototype, {
  /**
   * 获取指示 primitive 是否准备好使用的状态值。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {boolean}
   * @readonly
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },

  /**
   * 获取与此 primitive 关联的 {@link VoxelProvider}。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {VoxelProvider}
   * @readonly
   */
  provider: {
    get: function () {
      return this._provider;
    },
  },

  /**
   * 获取边界球。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {BoundingSphere}
   * @readonly
   */
  boundingSphere: {
    get: function () {
      return this._shape.boundingSphere;
    },
  },

  /**
   * 获取定向边界框。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {OrientedBoundingBox}
   * @readonly
   */
  orientedBoundingBox: {
    get: function () {
      return this._shape.orientedBoundingBox;
    },
  },

  /**
   * 获取模型矩阵。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Matrix4}
   * @readonly
   */
  modelMatrix: {
    get: function () {
      return this._modelMatrix;
    },
    set: function (modelMatrix) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("modelMatrix", modelMatrix);
      //>>includeEnd('debug');

      this._modelMatrix = Matrix4.clone(modelMatrix, this._modelMatrix);
    },
  },

  /**
   * 获取形状类型。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {VoxelShapeType}
   * @readonly
   */
  shape: {
    get: function () {
      return this._provider.shape;
    },
  },

  /**
   * 获取每个体素瓦片的尺寸，采用 z 向上方向。
   * 不包含填充部分。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Cartesian3}
   * @readonly
   * @constant
   */
  dimensions: {
    get: function () {
      return this._dimensions;
    },
  },

  /**
   * 获取输入体素数据一块的尺寸，以输入方向为准。
   * 包含填充区域。
   * @memberof VoxelPrimitive.prototype
   * @type {Cartesian3}
   * @readonly
   * @constant
   */
  inputDimensions: {
    get: function () {
      return this._inputDimensions;
    },
  },

  /**
   * 获取体素数据前的填充区域。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Cartesian3}
   * @readonly
   * @constant
   */
  paddingBefore: {
    get: function () {
      return this._paddingBefore;
    },
  },

  /**
   * 获取体素数据后的填充区域。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Cartesian3}
   * @readonly
   * @constant
   */
  paddingAfter: {
    get: function () {
      return this._paddingAfter;
    },
  },

  /**
   * 获取体素数据每个通道的最小值。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {number[][]}
   * @readonly
   * @constant
   */
  minimumValues: {
    get: function () {
      return this._provider.minimumValues;
    },
  },

  /**
   * 获取体素数据每个通道的最大值。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {number[][]}
   * @readonly
   * @constant
   */
  maximumValues: {
    get: function () {
      return this._provider.maximumValues;
    },
  },

  /**
   * 获取或设置该primitive是否应被显示。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {boolean}
   */
  show: {
    get: function () {
      return !this._disableRender;
    },
    set: function (show) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("show", show);
      //>>includeEnd('debug');

      this._disableRender = !show;
    },
  },

  /**
   * 获取或设置视图变化时primitive是否应更新。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {boolean}
   */
  disableUpdate: {
    get: function () {
      return this._disableUpdate;
    },
    set: function (disableUpdate) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("disableUpdate", disableUpdate);
      //>>includeEnd('debug');

      this._disableUpdate = disableUpdate;
    },
  },

  /**
   * 获取或设置是否渲染调试可视化效果。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {boolean}
   */
  debugDraw: {
    get: function () {
      return this._debugDraw;
    },
    set: function (debugDraw) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("debugDraw", debugDraw);
      //>>includeEnd('debug');

      this._debugDraw = debugDraw;
    },
  },

  /**
   * 获取或设置渲染时是否针对深度进行测试。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {boolean}
   */
  depthTest: {
    get: function () {
      return this._depthTest;
    },
    set: function (depthTest) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("depthTest", depthTest);
      //>>includeEnd('debug');

      if (this._depthTest !== depthTest) {
        this._depthTest = depthTest;
        this._shaderDirty = true;
      }
    },
  },

  /**
   * 获取或设置最近采样点。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {boolean}
   */
  nearestSampling: {
    get: function () {
      return this._nearestSampling;
    },
    set: function (nearestSampling) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("nearestSampling", nearestSampling);
      //>>includeEnd('debug');

      this._nearestSampling = nearestSampling;
    },
  },

  /**
   * 控制树不同层级之间混合的速度。
   * 0.0 表示即时弹出效果。
   * 1.0 表示完全线性混合。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {number}
   * @private
   */
  levelBlendFactor: {
    get: function () {
      return this._levelBlendFactor;
    },
    set: function (levelBlendFactor) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("levelBlendFactor", levelBlendFactor);
      //>>includeEnd('debug');

      this._levelBlendFactor = CesiumMath.clamp(levelBlendFactor, 0.0, 1.0);
    },
  },

  /**
   * 获取或设置屏幕空间误差像素值。如果体素的屏幕空间大小
   * 大于屏幕空间误差，则将该块进一步细分。
   * 较低的屏幕空间误差对应更高的渲染细节，但可能导致
   * 性能下降和内存消耗增加。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {number}
   */
  screenSpaceError: {
    get: function () {
      return this._screenSpaceError;
    },
    set: function (screenSpaceError) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("screenSpaceError", screenSpaceError);
      //>>includeEnd('debug');

      this._screenSpaceError = screenSpaceError;
    },
  },

  /**
   * 获取或设置进行光线追踪时使用的步长乘数。
   * 数值越低，渲染质量越高，但
   * 性能也越差。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {number}
   */
  stepSize: {
    get: function () {
      return this._stepSizeMultiplier;
    },
    set: function (stepSize) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("stepSize", stepSize);
      //>>includeEnd('debug');

      this._stepSizeMultiplier = stepSize;
    },
  },

  /**
   * 获取或设置形状局部坐标系中的最小边界。
   * 体素数据会被拉伸或压缩以适应边界。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Cartesian3}
   */
  minBounds: {
    get: function () {
      return this._minBounds;
    },
    set: function (minBounds) {
      //>>includeStart('debug', pragmas.debug);
      Check.defined("minBounds", minBounds);
      //>>includeEnd('debug');

      this._minBounds = Cartesian3.clone(minBounds, this._minBounds);
    },
  },

  /**
   * 获取或设置形状局部坐标系中的最大边界。
   * 体素数据会被拉伸或压缩以适应边界。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Cartesian3}
   */
  maxBounds: {
    get: function () {
      return this._maxBounds;
    },
    set: function (maxBounds) {
      //>>includeStart('debug', pragmas.debug);
      Check.defined("maxBounds", maxBounds);
      //>>includeEnd('debug');

      this._maxBounds = Cartesian3.clone(maxBounds, this._maxBounds);
    },
  },

  /**
   * 获取或设置形状局部坐标系中的最小裁剪位置。
   * 超出范围的任何体素内容都会被裁剪。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Cartesian3}
   */
  minClippingBounds: {
    get: function () {
      return this._minClippingBounds;
    },
    set: function (minClippingBounds) {
      //>>includeStart('debug', pragmas.debug);
      Check.defined("minClippingBounds", minClippingBounds);
      //>>includeEnd('debug');

      this._minClippingBounds = Cartesian3.clone(
        minClippingBounds,
        this._minClippingBounds,
      );
    },
  },

  /**
   * 获取或设置形状局部坐标系中的最大裁剪位置。
   * 超出范围的任何体素内容都会被裁剪。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Cartesian3}
   */
  maxClippingBounds: {
    get: function () {
      return this._maxClippingBounds;
    },
    set: function (maxClippingBounds) {
      //>>includeStart('debug', pragmas.debug);
      Check.defined("maxClippingBounds", maxClippingBounds);
      //>>includeEnd('debug');

      this._maxClippingBounds = Cartesian3.clone(
        maxClippingBounds,
        this._maxClippingBounds,
      );
    },
  },

  /**
   * {@link ClippingPlaneCollection} 用于选择性地禁用该primitive的渲染。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {ClippingPlaneCollection}
   */
  clippingPlanes: {
    get: function () {
      return this._clippingPlanes;
    },
    set: function (clippingPlanes) {
      // Don't need to check if undefined, it's handled in the setOwner function
      ClippingPlaneCollection.setOwner(clippingPlanes, this, "_clippingPlanes");
    },
  },

  /**
   * 获取或设置自定义着色器。如果未定义，则尝试构建与元数据类型相适应的默认自定义着色器。如果失败，则使用 {@link VoxelPrimitive.DefaultCustomShader}。
   * appropriate to the metadata type. If that fails, use {@link VoxelPrimitive.DefaultCustomShader}.
   *
   * @memberof VoxelPrimitive.prototype
   * @type {CustomShader}
   * @see {@link https://github.com/CesiumGS/cesium/tree/main/Documentation/CustomShaderGuide|Custom Shader Guide}
   */
  customShader: {
    get: function () {
      return this._customShader;
    },
    set: function (customShader) {
      if (customShader === this._customShader) {
        return;
      }
      // Delete old custom shader entries from the uniform map
      // (they were added in VoxelRenderResources when the shader was built)
      const uniformMap = this._uniformMap;
      const oldCustomShader = this._customShader;
      const oldCustomShaderUniformMap = oldCustomShader.uniformMap;
      for (const uniformName in oldCustomShaderUniformMap) {
        if (oldCustomShaderUniformMap.hasOwnProperty(uniformName)) {
          delete uniformMap[uniformName];
        }
      }

      if (!defined(customShader)) {
        const defaultShader = buildVoxelCustomShader(this._provider);
        this._customShader =
          defaultShader ?? VoxelPrimitive.DefaultCustomShader;
      } else {
        this._customShader = customShader;
      }
      this._shaderDirty = true;
    },
  },

  /**
   * 加载和渲染请求内容的信息。
   *
   * @memberof VoxelPrimitive.prototype
   * @type {Event}
   * @readonly
   */
  customShaderCompilationEvent: {
    get: function () {
      return this._customShaderCompilationEvent;
    },
  },

  /**
   * 用于加载和渲染请求内容的统计信息。
   * 要使用 `visited` 和 `numberOfTilesWithContentReady` 统计信息，在构造函数中将 `options.calculateStatistics` 设置为 `true`。
   * @type {Cesium3DTilesetStatistics}
   * @readonly
   * @private
   */
  statistics: {
    get: function () {
      return this._statistics;
    },
  },
});

const scratchIntersect = new Cartesian4();
const scratchNdcAabb = new Cartesian4();
const scratchTransformPositionLocalToWorld = new Matrix4();
const scratchTransformPositionLocalToProjection = new Matrix4();
const scratchCameraPositionShapeUv = new Cartesian3();
const scratchCameraTileCoordinates = new Cartesian4();

/**
 * 更新体素primitive。
 *
 * @param {FrameState} frameState
 * @private
 */
VoxelPrimitive.prototype.update = function (frameState) {
  const provider = this._provider;
  const uniforms = this._uniforms;

  // Update the custom shader in case it has texture uniforms.
  this._customShader.update(frameState);

  // Initialize from the provider. This only happens once.
  const context = frameState.context;
  if (!this._ready) {
    initializeFromContext(this, provider, context);
    // Set the primitive as ready after the first frame render since
    // the user might set up events subscribed to the post render event,
    // and the primitive may not be ready for those past the first frame.
    frameState.afterRender.push(() => {
      this._ready = true;
      return true;
    });

    // Don't render until the next frame after ready is set to true
    return;
  }

  // Check if the shape is dirty before updating it. This needs to happen every
  // frame because the member variables can be modified externally via the
  // getters.
  const shapeDirty = checkTransformAndBounds(this);
  const exaggerationChanged = updateVerticalExaggeration(this, frameState);
  if (shapeDirty || exaggerationChanged) {
    this._shapeVisible = updateShapeAndTransforms(this);
    if (checkShapeDefines(this)) {
      this._shaderDirty = true;
    }
  }
  if (!this._shapeVisible) {
    return;
  }

  this._shape.updateViewTransforms(frameState);

  // Update the traversal and prepare for rendering.
  const keyframeLocation = getKeyframeLocation(
    provider.timeIntervalCollection,
    this._clock,
  );

  const traversal = this._traversal;
  const sampleCountOld = traversal._sampleCount;

  traversal.update(
    frameState,
    keyframeLocation,
    shapeDirty, // recomputeBoundingVolumes
    this._disableUpdate, // pauseUpdate
  );

  if (sampleCountOld !== traversal._sampleCount) {
    this._shaderDirty = true;
  }

  if (!traversal.isRenderable(traversal.rootNode)) {
    return;
  }

  if (this._debugDraw) {
    // Debug draw bounding boxes and other things. Must go after traversal update
    // because that's what updates the tile bounding boxes.
    debugDraw(this, frameState);
  }

  if (this._disableRender) {
    return;
  }

  // Check if log depth changed
  if (this._useLogDepth !== frameState.useLogDepth) {
    this._useLogDepth = frameState.useLogDepth;
    this._shaderDirty = true;
  }

  // Check if clipping planes changed
  const clippingPlanesChanged = updateClippingPlanes(this, frameState);
  if (clippingPlanesChanged) {
    this._shaderDirty = true;
  }

  const leafNodeTexture = traversal.leafNodeTexture;
  if (defined(leafNodeTexture)) {
    uniforms.octreeLeafNodeTexture = traversal.leafNodeTexture;
    uniforms.octreeLeafNodeTexelSizeUv = Cartesian2.clone(
      traversal.leafNodeTexelSizeUv,
      uniforms.octreeLeafNodeTexelSizeUv,
    );
    uniforms.octreeLeafNodeTilesPerRow = traversal.leafNodeTilesPerRow;
  }

  // Rebuild shaders
  if (this._shaderDirty) {
    buildVoxelDrawCommands(this, context);
    this._shaderDirty = false;
  }

  // Calculate the NDC-space AABB to "scissor" the fullscreen quad
  const transformPositionWorldToProjection =
    context.uniformState.viewProjection;
  const { orientedBoundingBox } = this._shape;
  const ndcAabb = orientedBoundingBoxToNdcAabb(
    orientedBoundingBox,
    transformPositionWorldToProjection,
    scratchNdcAabb,
  );

  // If the object is offscreen, don't render it.
  const offscreen =
    ndcAabb.x === +1.0 ||
    ndcAabb.y === +1.0 ||
    ndcAabb.z === -1.0 ||
    ndcAabb.w === -1.0;
  if (offscreen) {
    return;
  }

  // Prepare to render: update uniforms that can change every frame
  // Using a uniform instead of going through RenderState's scissor because the viewport is not accessible here, and the scissor command needs pixel coordinates.
  uniforms.ndcSpaceAxisAlignedBoundingBox = Cartesian4.clone(
    ndcAabb,
    uniforms.ndcSpaceAxisAlignedBoundingBox,
  );
  const transformPositionViewToWorld = context.uniformState.inverseView;
  const transformPositionViewToLocal = Matrix4.multiplyTransformation(
    this._transformPositionWorldToLocal,
    transformPositionViewToWorld,
    uniforms.transformPositionViewToLocal,
  );

  this._transformPlaneLocalToView = Matrix4.transpose(
    transformPositionViewToLocal,
    this._transformPlaneLocalToView,
  );

  const transformDirectionViewToWorld =
    context.uniformState.inverseViewRotation;
  uniforms.transformDirectionViewToLocal = Matrix3.multiply(
    this._transformDirectionWorldToLocal,
    transformDirectionViewToWorld,
    uniforms.transformDirectionViewToLocal,
  );
  uniforms.cameraPositionLocal = Matrix4.multiplyByPoint(
    this._transformPositionWorldToLocal,
    frameState.camera.positionWC,
    uniforms.cameraPositionLocal,
  );
  uniforms.cameraDirectionLocal = Matrix3.multiplyByVector(
    this._transformDirectionWorldToLocal,
    frameState.camera.directionWC,
    uniforms.cameraDirectionLocal,
  );
  const cameraTileCoordinates = getTileCoordinates(
    this,
    uniforms.cameraPositionLocal,
    scratchCameraTileCoordinates,
  );
  uniforms.cameraTileCoordinates = Cartesian4.fromElements(
    Math.floor(cameraTileCoordinates.x),
    Math.floor(cameraTileCoordinates.y),
    Math.floor(cameraTileCoordinates.z),
    cameraTileCoordinates.w,
    uniforms.cameraTileCoordinates,
  );
  uniforms.cameraTileUv = Cartesian3.fromElements(
    cameraTileCoordinates.x - Math.floor(cameraTileCoordinates.x),
    cameraTileCoordinates.y - Math.floor(cameraTileCoordinates.y),
    cameraTileCoordinates.z - Math.floor(cameraTileCoordinates.z),
    uniforms.cameraTileUv,
  );
  uniforms.stepSize = this._stepSizeMultiplier;

  updateNearestSampling(this);
  updateRenderBoundPlanes(this, frameState);

  // Render the primitive
  const command = frameState.passes.pick
    ? this._drawCommandPick
    : frameState.passes.pickVoxel
      ? this._drawCommandPickVoxel
      : this._drawCommand;
  command.boundingVolume = this._shape.boundingSphere;
  frameState.commandList.push(command);
};

function updateNearestSampling(primitive) {
  const { megatextures } = primitive._traversal;
  for (let i = 0; i < megatextures.length; ++i) {
    megatextures[i].nearestSampling = primitive._nearestSampling;
  }
}

function updateRenderBoundPlanes(primitive, frameState) {
  const uniforms = primitive._uniforms;
  const { renderBoundPlanes } = primitive._shape;
  if (!defined(renderBoundPlanes)) {
    return;
  }
  renderBoundPlanes.update(frameState, primitive._transformPlaneLocalToView);
  uniforms.renderBoundPlanesTexture = renderBoundPlanes.texture;
}

/**
 * 将局部空间中的位置转换为块坐标。
 *
 * @param {VoxelPrimitive} primitive 用于获取瓦片坐标的基元。
 * @param {Cartesian3} positionLocal 转换为瓦片坐标的局部空间位置。
 * @param {Cartesian4} result 存储瓦片坐标的结果对象。
 * @returns {Cartesian4} The 所提供位置的瓦片坐标。
 * @private
 */
function getTileCoordinates(primitive, positionLocal, result) {
  const shapeUv = primitive._shape.convertLocalToShapeUvSpace(
    positionLocal,
    scratchCameraPositionShapeUv,
  );

  const availableLevels = primitive._availableLevels;
  const numTiles = 2 ** (availableLevels - 1);

  return Cartesian4.fromElements(
    shapeUv.x * numTiles,
    shapeUv.y * numTiles,
    shapeUv.z * numTiles,
    availableLevels - 1,
    result,
  );
}

const scratchExaggerationScale = new Cartesian3();
const scratchExaggerationCenter = new Cartesian3();
const scratchCartographicCenter = new Cartographic();

/**
 * 检查基元垂直夸张度的变化。
 * @param {VoxelPrimitive} primitive 需要更新的基元。
 * @param {FrameState} frameState 当前帧状态。
 * @returns {boolean} <code>true</code> 如果夸张度发生变化。
 * @private
 */
function updateVerticalExaggeration(primitive, frameState) {
  const { verticalExaggeration, verticalExaggerationRelativeHeight } =
    frameState;

  if (
    primitive._verticalExaggeration === verticalExaggeration &&
    primitive._verticalExaggerationRelativeHeight ===
      verticalExaggerationRelativeHeight
  ) {
    return false;
  }

  primitive._verticalExaggeration = verticalExaggeration;
  primitive._verticalExaggerationRelativeHeight =
    verticalExaggerationRelativeHeight;
  return true;
}

/**
 * 初始化从体素提供器派生的基元属性。
 * @param {VoxelPrimitive} primitive
 * @param {VoxelProvider} provider
 * @param {Context} context
 * @private
 */
function initializeFromContext(primitive, provider, context) {
  const uniforms = primitive._uniforms;

  primitive._pickId = context.createPickId({ primitive });
  uniforms.pickColor = Color.clone(primitive._pickId.color, uniforms.pickColor);

  // Create the VoxelTraversal, and set related uniforms
  const keyframeCount = provider.keyframeCount ?? 1;
  primitive._traversal = new VoxelTraversal(primitive, context, keyframeCount);
  primitive.statistics.texturesByteLength =
    primitive._traversal.textureMemoryByteLength;
  setTraversalUniforms(primitive._traversal, uniforms);
}

/**
 * 跟踪提供器变换和基元边界的变化。
 * @param {VoxelPrimitive} primitive
 * @returns {boolean} Whether 无论是变换还是边界发生了变化。
 * @private
 */
function checkTransformAndBounds(primitive) {
  const numChanges =
    updateBound(primitive, "_modelMatrix", "_modelMatrixOld") +
    updateBound(primitive, "_minBounds", "_minBoundsOld") +
    updateBound(primitive, "_maxBounds", "_maxBoundsOld") +
    updateBound(primitive, "_minClippingBounds", "_minClippingBoundsOld") +
    updateBound(primitive, "_maxClippingBounds", "_maxClippingBoundsOld");
  return numChanges > 0;
}

/**
 * 比较边界的旧值和新值，如果不同则更新旧值。
 * @param {VoxelPrimitive} primitive 具有边界属性的基元。
 * @param {string} newBoundKey 指向 Cartesian3 或 Matrix4 类型边界属性的键。
 * @param {string} oldBoundKey 指向与 newBoundKey 属性类型相同的边界属性的键。
 * @returns {number} 1 如果边界值发生变化，返回 0；否则返回 0。
 *
 * @private
 */
function updateBound(primitive, newBoundKey, oldBoundKey) {
  const newBound = primitive[newBoundKey];
  const oldBound = primitive[oldBoundKey];

  const changed = !newBound.equals(oldBound);
  if (changed) {
    newBound.clone(oldBound);
  }
  return changed ? 1 : 0;
}

const scratchExaggeratedMinBounds = new Cartesian3();
const scratchExaggeratedMaxBounds = new Cartesian3();
const scratchExaggeratedMinClippingBounds = new Cartesian3();
const scratchExaggeratedMaxClippingBounds = new Cartesian3();
const scratchExaggeratedModelMatrix = new Matrix4();
const scratchCompoundModelMatrix = new Matrix4();

/**
 * 更新形状及相关变换。
 * @param {VoxelPrimitive} primitive
 * @returns {boolean} True 如果形状可见。
 * @private
 */
function updateShapeAndTransforms(primitive) {
  const verticalExaggeration = primitive._verticalExaggeration;
  const verticalExaggerationRelativeHeight =
    primitive._verticalExaggerationRelativeHeight;
  const exaggeratedMinBounds = Cartesian3.clone(
    primitive._minBounds,
    scratchExaggeratedMinBounds,
  );
  const exaggeratedMaxBounds = Cartesian3.clone(
    primitive._maxBounds,
    scratchExaggeratedMaxBounds,
  );
  const exaggeratedMinClippingBounds = Cartesian3.clone(
    primitive._minClippingBounds,
    scratchExaggeratedMinClippingBounds,
  );
  const exaggeratedMaxClippingBounds = Cartesian3.clone(
    primitive._maxClippingBounds,
    scratchExaggeratedMaxClippingBounds,
  );
  const exaggeratedModelMatrix = Matrix4.clone(
    primitive._modelMatrix,
    scratchExaggeratedModelMatrix,
  );

  if (primitive.shape === VoxelShapeType.ELLIPSOID) {
    // Apply the exaggeration by stretching the height bounds
    exaggeratedMinBounds.z = VerticalExaggeration.getHeight(
      primitive._minBounds.z,
      verticalExaggeration,
      verticalExaggerationRelativeHeight,
    );
    exaggeratedMaxBounds.z = VerticalExaggeration.getHeight(
      primitive._maxBounds.z,
      verticalExaggeration,
      verticalExaggerationRelativeHeight,
    );
    exaggeratedMinClippingBounds.z = VerticalExaggeration.getHeight(
      primitive._minClippingBounds.z,
      verticalExaggeration,
      verticalExaggerationRelativeHeight,
    );
    exaggeratedMaxClippingBounds.z = VerticalExaggeration.getHeight(
      primitive._maxClippingBounds.z,
      verticalExaggeration,
      verticalExaggerationRelativeHeight,
    );
  } else {
    // Apply the exaggeration via the model matrix
    const exaggerationScale = Cartesian3.fromElements(
      1.0,
      1.0,
      verticalExaggeration,
      scratchExaggerationScale,
    );
    Matrix4.multiplyByScale(
      exaggeratedModelMatrix,
      exaggerationScale,
      exaggeratedModelMatrix,
    );
    Matrix4.multiplyByTranslation(
      exaggeratedModelMatrix,
      computeBoxExaggerationTranslation(primitive),
      exaggeratedModelMatrix,
    );
  }

  const provider = primitive._provider;
  const shapeTransform = provider.shapeTransform ?? Matrix4.IDENTITY;
  const globalTransform = provider.globalTransform ?? Matrix4.IDENTITY;

  // Compound model matrix = global transform * model matrix * shape transform
  const compoundModelMatrix = Matrix4.multiplyTransformation(
    globalTransform,
    exaggeratedModelMatrix,
    scratchCompoundModelMatrix,
  );
  Matrix4.multiplyTransformation(
    compoundModelMatrix,
    shapeTransform,
    compoundModelMatrix,
  );

  const shape = primitive._shape;
  const visible = shape.update(
    compoundModelMatrix,
    exaggeratedMinBounds,
    exaggeratedMaxBounds,
    exaggeratedMinClippingBounds,
    exaggeratedMaxClippingBounds,
  );
  if (!visible) {
    return false;
  }

  primitive._transformPositionLocalToWorld = Matrix4.clone(
    shape.shapeTransform,
    primitive._transformPositionLocalToWorld,
  );
  primitive._transformPositionWorldToLocal = Matrix4.inverse(
    primitive._transformPositionLocalToWorld,
    primitive._transformPositionWorldToLocal,
  );
  primitive._transformDirectionWorldToLocal = Matrix4.getMatrix3(
    primitive._transformPositionWorldToLocal,
    primitive._transformDirectionWorldToLocal,
  );

  return true;
}

const scratchExaggerationTranslation = new Cartesian3();

/**
 * 计算应用于盒子形状的平移以补偿垂直夸张度。
 *
 * @param {VoxelPrimitive} primitive
 * @returns {Cartesian3} The 用于补偿垂直夸张度的盒子平移。
 * @private
 */
function computeBoxExaggerationTranslation(primitive) {
  const verticalExaggeration = primitive._verticalExaggeration;
  const verticalExaggerationRelativeHeight =
    primitive._verticalExaggerationRelativeHeight;

  // Compute translation based on box center, relative height, and exaggeration
  const {
    shapeTransform = Matrix4.IDENTITY,
    globalTransform = Matrix4.IDENTITY,
  } = primitive._provider;

  // Find the Cartesian position of the center of the OBB
  const initialCenter = Matrix4.getTranslation(
    shapeTransform,
    scratchExaggerationCenter,
  );
  const intermediateCenter = Matrix4.multiplyByPoint(
    primitive._modelMatrix,
    initialCenter,
    scratchExaggerationCenter,
  );
  const transformedCenter = Matrix4.multiplyByPoint(
    globalTransform,
    intermediateCenter,
    scratchExaggerationCenter,
  );

  // Find the cartographic height
  const ellipsoid = Ellipsoid.WGS84;
  const centerCartographic = ellipsoid.cartesianToCartographic(
    transformedCenter,
    scratchCartographicCenter,
  );

  let centerHeight = 0.0;
  if (defined(centerCartographic)) {
    centerHeight = centerCartographic.height;
  }

  // Find the shift that will put the center in the right position relative
  // to relativeHeight, after it is scaled by verticalExaggeration
  const exaggeratedHeight = VerticalExaggeration.getHeight(
    centerHeight,
    verticalExaggeration,
    verticalExaggerationRelativeHeight,
  );

  return Cartesian3.fromElements(
    0.0,
    0.0,
    (exaggeratedHeight - centerHeight) / verticalExaggeration,
    scratchExaggerationTranslation,
  );
}

/**
 * 设置来自遍历的统一变量。
 * @param {VoxelTraversal} traversal
 * @param {object} uniforms
 * @private
 */
function setTraversalUniforms(traversal, uniforms) {
  uniforms.octreeInternalNodeTexture = traversal.internalNodeTexture;
  uniforms.octreeInternalNodeTexelSizeUv = Cartesian2.clone(
    traversal.internalNodeTexelSizeUv,
    uniforms.octreeInternalNodeTexelSizeUv,
  );
  uniforms.octreeInternalNodeTilesPerRow = traversal.internalNodeTilesPerRow;

  const { megatextures } = traversal;
  const megatexture = megatextures[0];
  uniforms.megatextureTextures = new Array(megatextures.length);
  for (let i = 0; i < megatextures.length; i++) {
    uniforms.megatextureTextures[i] = megatextures[i].texture;
  }
  uniforms.megatextureTileCounts = Cartesian3.clone(
    megatexture.tileCounts,
    uniforms.megatextureTileCounts,
  );
}

/**
 * 跟踪与形状相关的着色器定义的变化。
 * @param {VoxelPrimitive} primitive
 * @returns {boolean} True 如果任何形状定义发生变化，需要重新构建着色器。
 * @private
 */
function checkShapeDefines(primitive) {
  const { shaderDefines } = primitive._shape;
  const shapeDefinesChanged = Object.keys(shaderDefines).some(
    (key) => shaderDefines[key] !== primitive._shapeDefinesOld[key],
  );
  if (shapeDefinesChanged) {
    primitive._shapeDefinesOld = clone(shaderDefines, true);
  }
  return shapeDefinesChanged;
}

/**
 * 找到渲染时的关键帧位置。不需要是整数。
 * @param {TimeIntervalCollection} timeIntervalCollection
 * @param {Clock} clock
 * @returns {number}
 *
 * @private
 */
function getKeyframeLocation(timeIntervalCollection, clock) {
  if (!defined(timeIntervalCollection) || !defined(clock)) {
    return 0.0;
  }
  let date = clock.currentTime;
  let timeInterval;
  let timeIntervalIndex = timeIntervalCollection.indexOf(date);
  if (timeIntervalIndex >= 0) {
    timeInterval = timeIntervalCollection.get(timeIntervalIndex);
  } else {
    // Date fell outside the range
    timeIntervalIndex = ~timeIntervalIndex;
    if (timeIntervalIndex === timeIntervalCollection.length) {
      // Date past range
      timeIntervalIndex = timeIntervalCollection.length - 1;
      timeInterval = timeIntervalCollection.get(timeIntervalIndex);
      date = timeInterval.stop;
    } else {
      // Date before range
      timeInterval = timeIntervalCollection.get(timeIntervalIndex);
      date = timeInterval.start;
    }
  }
  // De-lerp between the start and end of the interval
  const totalSeconds = JulianDate.secondsDifference(
    timeInterval.stop,
    timeInterval.start,
  );
  const secondsDifferenceStart = JulianDate.secondsDifference(
    date,
    timeInterval.start,
  );
  const t = secondsDifferenceStart / totalSeconds;

  return timeIntervalIndex + t;
}

/**
 * 更新裁剪平面状态及相关统一变量。
 *
 * @param {VoxelPrimitive} primitive
 * @param {FrameState} frameState
 * @returns {boolean} Whether 裁剪平面发生变化，需要重新构建着色器。
 * @private
 */
function updateClippingPlanes(primitive, frameState) {
  const clippingPlanes = primitive.clippingPlanes;
  if (!defined(clippingPlanes)) {
    return false;
  }

  clippingPlanes.update(frameState);

  const { clippingPlanesState, enabled } = clippingPlanes;

  if (enabled) {
    const uniforms = primitive._uniforms;
    uniforms.clippingPlanesTexture = clippingPlanes.texture;

    // Compute the clipping plane's transformation to local space and then take the inverse
    // transpose to properly transform the hessian normal form of the plane.

    // transpose(inverse(worldToLocal * clippingPlaneLocalToWorld))
    // transpose(inverse(clippingPlaneLocalToWorld) * inverse(worldToLocal))
    // transpose(inverse(clippingPlaneLocalToWorld) * localToWorld)

    uniforms.clippingPlanesMatrix = Matrix4.transpose(
      Matrix4.multiplyTransformation(
        Matrix4.inverse(
          clippingPlanes.modelMatrix,
          uniforms.clippingPlanesMatrix,
        ),
        primitive._transformPositionLocalToWorld,
        uniforms.clippingPlanesMatrix,
      ),
      uniforms.clippingPlanesMatrix,
    );
  }

  if (
    primitive._clippingPlanesState === clippingPlanesState &&
    primitive._clippingPlanesEnabled === enabled
  ) {
    return false;
  }
  primitive._clippingPlanesState = clippingPlanesState;
  primitive._clippingPlanesEnabled = enabled;

  return true;
}

/**
 * 如果此对象被销毁，返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，返回 <code>false</code>；否则返回 <code>false</code>。
 *
 * @see VoxelPrimitive#destroy
 */
VoxelPrimitive.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而不是依赖垃圾收集器来销毁此对象。
 * 一旦对象被销毁，不应使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * 对象被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 * @see VoxelPrimitive#isDestroyed
 *
 * @example
 * voxelPrimitive = voxelPrimitive && voxelPrimitive.destroy();
 */
VoxelPrimitive.prototype.destroy = function () {
  const drawCommand = this._drawCommand;
  if (defined(drawCommand)) {
    drawCommand.shaderProgram =
      drawCommand.shaderProgram && drawCommand.shaderProgram.destroy();
  }
  const drawCommandPick = this._drawCommandPick;
  if (defined(drawCommandPick)) {
    drawCommandPick.shaderProgram =
      drawCommandPick.shaderProgram && drawCommandPick.shaderProgram.destroy();
  }

  this._pickId = this._pickId && this._pickId.destroy();
  this._traversal = this._traversal && this._traversal.destroy();
  this.statistics.texturesByteLength = 0;
  this._clippingPlanes = this._clippingPlanes && this._clippingPlanes.destroy();

  return destroyObject(this);
};

const corners = new Array(
  new Cartesian4(-1.0, -1.0, -1.0, 1.0),
  new Cartesian4(+1.0, -1.0, -1.0, 1.0),
  new Cartesian4(-1.0, +1.0, -1.0, 1.0),
  new Cartesian4(+1.0, +1.0, -1.0, 1.0),
  new Cartesian4(-1.0, -1.0, +1.0, 1.0),
  new Cartesian4(+1.0, -1.0, +1.0, 1.0),
  new Cartesian4(-1.0, +1.0, +1.0, 1.0),
  new Cartesian4(+1.0, +1.0, +1.0, 1.0),
);
const vertexNeighborIndices = new Array(
  1,
  2,
  4,
  0,
  3,
  5,
  0,
  3,
  6,
  1,
  2,
  7,
  0,
  5,
  6,
  1,
  4,
  7,
  2,
  4,
  7,
  3,
  5,
  6,
);

const scratchCornersClipSpace = new Array(
  new Cartesian4(),
  new Cartesian4(),
  new Cartesian4(),
  new Cartesian4(),
  new Cartesian4(),
  new Cartesian4(),
  new Cartesian4(),
  new Cartesian4(),
);

/**
 * 将定向边界框的所有 8 个角投影到 NDC 空间并找到结果
 * 生成一个轴对齐的 NDC 边界框。为了避免将位于近平面后的顶点投影出来，它使用每个顶点的
 * 边与近平面的交点作为 AABB 计算的一部分。这一操作在透视分割之前在裁剪空间中进行。
 * 绘制瓦片边界框和坐标轴。
 * 该primitive 使用的默认自定义着色器。
 *
 * @function
 *
 * @param {OrientedBoundingBox} orientedBoundingBox
 * @param {Matrix4} worldToProjection
 * @param {Cartesian4} result
 * @returns {Cartesian4}
 *
 * @private
 */
function orientedBoundingBoxToNdcAabb(
  orientedBoundingBox,
  worldToProjection,
  result,
) {
  const transformPositionLocalToWorld = Matrix4.fromRotationTranslation(
    orientedBoundingBox.halfAxes,
    orientedBoundingBox.center,
    scratchTransformPositionLocalToWorld,
  );
  const transformPositionLocalToProjection = Matrix4.multiply(
    worldToProjection,
    transformPositionLocalToWorld,
    scratchTransformPositionLocalToProjection,
  );

  let ndcMinX = +Number.MAX_VALUE;
  let ndcMaxX = -Number.MAX_VALUE;
  let ndcMinY = +Number.MAX_VALUE;
  let ndcMaxY = -Number.MAX_VALUE;
  let cornerIndex;

  // Convert all points to clip space
  const cornersClipSpace = scratchCornersClipSpace;
  const cornersLength = corners.length;
  for (cornerIndex = 0; cornerIndex < cornersLength; cornerIndex++) {
    Matrix4.multiplyByVector(
      transformPositionLocalToProjection,
      corners[cornerIndex],
      cornersClipSpace[cornerIndex],
    );
  }

  for (cornerIndex = 0; cornerIndex < cornersLength; cornerIndex++) {
    const position = cornersClipSpace[cornerIndex];
    if (position.z >= -position.w) {
      // Position is past near plane, so there's no need to clip.
      const ndcX = position.x / position.w;
      const ndcY = position.y / position.w;
      ndcMinX = Math.min(ndcMinX, ndcX);
      ndcMaxX = Math.max(ndcMaxX, ndcX);
      ndcMinY = Math.min(ndcMinY, ndcY);
      ndcMaxY = Math.max(ndcMaxY, ndcY);
    } else {
      for (let neighborIndex = 0; neighborIndex < 3; neighborIndex++) {
        const neighborVertexIndex =
          vertexNeighborIndices[cornerIndex * 3 + neighborIndex];
        const neighborPosition = cornersClipSpace[neighborVertexIndex];
        if (neighborPosition.z >= -neighborPosition.w) {
          // Position is behind the near plane and neighbor is after, so get intersection point on the near plane.
          const distanceToPlaneFromPosition = position.z + position.w;
          const distanceToPlaneFromNeighbor =
            neighborPosition.z + neighborPosition.w;
          const t =
            distanceToPlaneFromPosition /
            (distanceToPlaneFromPosition - distanceToPlaneFromNeighbor);

          const intersect = Cartesian4.lerp(
            position,
            neighborPosition,
            t,
            scratchIntersect,
          );
          const intersectNdcX = intersect.x / intersect.w;
          const intersectNdcY = intersect.y / intersect.w;
          ndcMinX = Math.min(ndcMinX, intersectNdcX);
          ndcMaxX = Math.max(ndcMaxX, intersectNdcX);
          ndcMinY = Math.min(ndcMinY, intersectNdcY);
          ndcMaxY = Math.max(ndcMaxY, intersectNdcY);
        }
      }
    }
  }

  // Clamp the NDC values to -1 to +1 range even if they extend much further.
  ndcMinX = CesiumMath.clamp(ndcMinX, -1.0, +1.0);
  ndcMinY = CesiumMath.clamp(ndcMinY, -1.0, +1.0);
  ndcMaxX = CesiumMath.clamp(ndcMaxX, -1.0, +1.0);
  ndcMaxY = CesiumMath.clamp(ndcMaxY, -1.0, +1.0);
  result = Cartesian4.fromElements(ndcMinX, ndcMinY, ndcMaxX, ndcMaxY, result);

  return result;
}

const polylineAxisDistance = 30000000.0;
const polylineXAxis = new Cartesian3(polylineAxisDistance, 0.0, 0.0);
const polylineYAxis = new Cartesian3(0.0, polylineAxisDistance, 0.0);
const polylineZAxis = new Cartesian3(0.0, 0.0, polylineAxisDistance);

/**
 * Draws the tile bounding boxes and axes.
 *
 * @function
 *
 * @param {VoxelPrimitive} that
 * @param {FrameState} frameState
 *
 * @private
 */
function debugDraw(that, frameState) {
  const traversal = that._traversal;
  const polylines = that._debugPolylines;
  polylines.removeAll();

  function makePolylineLineSegment(startPos, endPos, color, thickness) {
    polylines.add({
      positions: [startPos, endPos],
      width: thickness,
      material: Material.fromType("Color", {
        color: color,
      }),
    });
  }

  function makePolylineBox(orientedBoundingBox, color, thickness) {
    // Normally would want to use a scratch variable to store the corners, but
    // polylines don't clone the positions.
    const corners = orientedBoundingBox.computeCorners();
    makePolylineLineSegment(corners[0], corners[1], color, thickness);
    makePolylineLineSegment(corners[2], corners[3], color, thickness);
    makePolylineLineSegment(corners[4], corners[5], color, thickness);
    makePolylineLineSegment(corners[6], corners[7], color, thickness);
    makePolylineLineSegment(corners[0], corners[2], color, thickness);
    makePolylineLineSegment(corners[4], corners[6], color, thickness);
    makePolylineLineSegment(corners[1], corners[3], color, thickness);
    makePolylineLineSegment(corners[5], corners[7], color, thickness);
    makePolylineLineSegment(corners[0], corners[4], color, thickness);
    makePolylineLineSegment(corners[2], corners[6], color, thickness);
    makePolylineLineSegment(corners[1], corners[5], color, thickness);
    makePolylineLineSegment(corners[3], corners[7], color, thickness);
  }

  function drawTile(tile) {
    if (!traversal.isRenderable(tile)) {
      return;
    }

    const level = tile.level;
    const startThickness = 5.0;
    const thickness = Math.max(1.0, startThickness / Math.pow(2.0, level));
    const colors = [Color.RED, Color.LIME, Color.BLUE];
    const color = colors[level % 3];

    makePolylineBox(tile.orientedBoundingBox, color, thickness);

    if (defined(tile.children)) {
      for (let i = 0; i < 8; i++) {
        drawTile(tile.children[i]);
      }
    }
  }

  makePolylineBox(that._shape.orientedBoundingBox, Color.WHITE, 5.0);

  drawTile(traversal.rootNode);

  const axisThickness = 10.0;
  makePolylineLineSegment(
    Cartesian3.ZERO,
    polylineXAxis,
    Color.RED,
    axisThickness,
  );
  makePolylineLineSegment(
    Cartesian3.ZERO,
    polylineYAxis,
    Color.LIME,
    axisThickness,
  );
  makePolylineLineSegment(
    Cartesian3.ZERO,
    polylineZAxis,
    Color.BLUE,
    axisThickness,
  );

  polylines.update(frameState);
}

/**
 * The default custom shader used by the primitive.
 *
 * @type {CustomShader}
 * @constant
 * @readonly
 *
 * @private
 */
VoxelPrimitive.DefaultCustomShader = new CustomShader({
  fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    vec3 voxelNormal = fsInput.attributes.normalEC;
    float diffuse = max(0.0, dot(voxelNormal, czm_lightDirectionEC));
    float lighting = 0.5 + 0.5 * diffuse;
    material.diffuse = vec3(lighting);
    material.alpha = 1.0;
}`,
});

function DefaultVoxelProvider() {
  this.shape = VoxelShapeType.BOX;
  this.dimensions = new Cartesian3(1, 1, 1);
  this.names = ["data"];
  this.types = [MetadataType.SCALAR];
  this.componentTypes = [MetadataComponentType.FLOAT32];
  this.maximumTileCount = 1;
}

DefaultVoxelProvider.prototype.requestData = function (options) {
  const tileLevel = defined(options) ? (options.tileLevel ?? 0) : 0;
  if (tileLevel >= 1) {
    return undefined;
  }

  const content = new VoxelContent({ metadata: [new Float32Array(1)] });
  return Promise.resolve(content);
};

VoxelPrimitive.DefaultProvider = new DefaultVoxelProvider();

export default VoxelPrimitive;