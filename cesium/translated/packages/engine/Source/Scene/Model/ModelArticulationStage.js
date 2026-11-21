import {
  Cartesian3,
  Check,
  Frozen,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
} from "@cesium/core";
import ArticulationStageType from "../../Core/ArticulationStageType.js";

const articulationEpsilon = CesiumMath.EPSILON16;

/**
 * 属于某个关节阶段的内存表示形式。
 * {@link ModelArticulation}。
 *
 * @param {object} options 包含以下选项的对象：
 * @param {ModelComponents.ArticulationStage} options.stage 来自 3D 模型的关节阶段组件。
 * @param {ModelArticulation} options.runtimeArticulation 该阶段所属的运行时关节状态。
 *
 * @alias ModelArticulationStage
 * @constructor
 *
 * @private
 */
function ModelArticulationStage(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const stage = options.stage;
  const runtimeArticulation = options.runtimeArticulation;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.stage", stage);
  Check.typeOf.object("options.runtimeArticulation", runtimeArticulation);
  //>>includeEnd('debug');

  this._stage = stage;
  this._runtimeArticulation = runtimeArticulation;

  this._name = stage.name;
  this._type = stage.type;
  this._minimumValue = stage.minimumValue;
  this._maximumValue = stage.maximumValue;
  this._currentValue = stage.initialValue;
}

Object.defineProperties(ModelArticulationStage.prototype, {
  /**
   * 该运行时阶段所代表的内部关节阶段。
   *
   * @memberof ModelArticulationStage.prototype
   * @type {ModelComponents.ArticulationStage}
   * @readonly
   *
   * @private
   */
  stage: {
    get: function () {
      return this._stage;
    },
  },

  /**
   * 该阶段所属的运行时关节状态。
   *
   * @memberof ModelArticulationStage.prototype
   * @type {ModelArticulation}
   * @readonly
   *
   * @private
   */
  runtimeArticulation: {
    get: function () {
      return this._runtimeArticulation;
    },
  },

  /**
   * 此关节阶段的名称。
   *
   * @memberof ModelArticulationStage.prototype
   * @type {string}
   * @readonly
   *
   * @private
   */
  name: {
    get: function () {
      return this._name;
    },
  },

  /**
   * 此关节阶段的类型。它指定了哪个节点的属性会被阶段值修改。
   * 此关节阶段的最小值。
   *
   * @memberof ModelArticulationStage.prototype
   * @type {ArticulationStageType}
   * @readonly
   *
   * @private
   */
  type: {
    get: function () {
      return this._type;
    },
  },

  /**
   * 此关节阶段的最大值。
   *
   * @memberof ModelArticulationStage.prototype
   * @type {number}
   * @readonly
   *
   * @private
   */
  minimumValue: {
    get: function () {
      return this._minimumValue;
    },
  },

  /**
   * 此关节阶段的当前值。
   *
   * @memberof ModelArticulationStage.prototype
   * @type {number}
   * @readonly
   *
   * @private
   */
  maximumValue: {
    get: function () {
      return this._maximumValue;
    },
  },

  /**
   * 针对给定阶段值，通过应用变换来修改 Matrix4。
   *
   * @memberof ModelArticulationStage.prototype
   * @type {number}
   *
   * @private
   */
  currentValue: {
    get: function () {
      return this._currentValue;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');

      value = CesiumMath.clamp(value, this.minimumValue, this.maximumValue);
      if (
        !CesiumMath.equalsEpsilon(
          this._currentValue,
          value,
          articulationEpsilon,
        )
      ) {
        this._currentValue = value;
        this.runtimeArticulation._dirty = true;
      }
    },
  },
});

const scratchArticulationCartesian = new Cartesian3();
const scratchArticulationRotation = new Matrix3();

/**
 * 请注意，<code>result</code> 参数不仅仅是返回值的容器。<code>result</code> 的传入值也是计算过程的一部分。关节的各个阶段可以相乘，因此它们的变换都会被合并成一个复合的 Matrix4。
 * 该 Matrix4 需要被修改。
 * 根据关节阶段的要求进行变换后的矩阵。
 * computation itself. Various stages of an articulation can be multiplied
 * together, so their transformations are all merged into a composite Matrix4
 * representing them all.
 *
 * @param {Matrix4} result The matrix to be modified.
 * @returns {Matrix4} The transformed matrix as requested by the articulation stage.
 *
 * @private
 */
ModelArticulationStage.prototype.applyStageToMatrix = function (result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("result", result);
  //>>includeEnd('debug');

  const type = this.type;
  const value = this.currentValue;
  const cartesian = scratchArticulationCartesian;
  let rotation;
  switch (type) {
    case ArticulationStageType.XROTATE:
      rotation = Matrix3.fromRotationX(
        CesiumMath.toRadians(value),
        scratchArticulationRotation,
      );
      result = Matrix4.multiplyByMatrix3(result, rotation, result);
      break;
    case ArticulationStageType.YROTATE:
      rotation = Matrix3.fromRotationY(
        CesiumMath.toRadians(value),
        scratchArticulationRotation,
      );
      result = Matrix4.multiplyByMatrix3(result, rotation, result);
      break;
    case ArticulationStageType.ZROTATE:
      rotation = Matrix3.fromRotationZ(
        CesiumMath.toRadians(value),
        scratchArticulationRotation,
      );
      result = Matrix4.multiplyByMatrix3(result, rotation, result);
      break;
    case ArticulationStageType.XTRANSLATE:
      cartesian.x = value;
      cartesian.y = 0.0;
      cartesian.z = 0.0;
      result = Matrix4.multiplyByTranslation(result, cartesian, result);
      break;
    case ArticulationStageType.YTRANSLATE:
      cartesian.x = 0.0;
      cartesian.y = value;
      cartesian.z = 0.0;
      result = Matrix4.multiplyByTranslation(result, cartesian, result);
      break;
    case ArticulationStageType.ZTRANSLATE:
      cartesian.x = 0.0;
      cartesian.y = 0.0;
      cartesian.z = value;
      result = Matrix4.multiplyByTranslation(result, cartesian, result);
      break;
    case ArticulationStageType.XSCALE:
      cartesian.x = value;
      cartesian.y = 1.0;
      cartesian.z = 1.0;
      result = Matrix4.multiplyByScale(result, cartesian, result);
      break;
    case ArticulationStageType.YSCALE:
      cartesian.x = 1.0;
      cartesian.y = value;
      cartesian.z = 1.0;
      result = Matrix4.multiplyByScale(result, cartesian, result);
      break;
    case ArticulationStageType.ZSCALE:
      cartesian.x = 1.0;
      cartesian.y = 1.0;
      cartesian.z = value;
      result = Matrix4.multiplyByScale(result, cartesian, result);
      break;
    case ArticulationStageType.UNIFORMSCALE:
      result = Matrix4.multiplyByUniformScale(result, value, result);
      break;
    default:
      break;
  }

  return result;
};

export default ModelArticulationStage;
