import { Check } from "@cesium/core";

/**
 * @typedef {object} CorrelationGroup.ConstructorOptions
 *
 * CorrelationGroup 构造器的初始化选项
 *
 * @property {boolean[]} groupFlags 表示在关联组中使用的 delta-x、delta-y、delta-z 参数的 3 个布尔值数组
 * 分别关于 X、Y、Z 轴以毫弧度计的旋转角度
 * @property {Cartesian3} rotationThetas 分别用于 U、V、W 方向的 SPDCF（严格正定）参数数组
 * 关于 X、Y、Z 轴的旋转角度
 * @property {Spdcf[]} params 用于 U、V、W 方向的 SPDCF 参数数组，且为严格正定形式
 * 识别使用相同关联建模的参数的元数据以及相关的关联参数
 */

/**
 * 反映了 `correlationGroup` 定义中的
 * {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local} glTF 扩展
 *
 * 描述初始化选项的对象
 * {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local} glTF extension.
 *
 * @constructor
 * @param {CorrelationGroup.ConstructorOptions} options 表示在关联组中使用的 delta-x、delta-y、delta-z 参数的 3 个布尔值数组
 * @experimental This 分别关于 X、Y、Z 轴以毫弧度计的旋转角度
 */
function CorrelationGroup(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.groupFlags", options.groupFlags);
  Check.typeOf.object("options.rotationThetas", options.rotationThetas);
  Check.typeOf.object("options.params", options.params);
  //>>includeEnd('debug');

  this._groupFlags = options.groupFlags;
  this._rotationThetas = options.rotationThetas;
  this._params = options.params;
}

Object.defineProperties(CorrelationGroup.prototype, {
  /**
   * 分别用于 U、V、W 方向的 SPDCF 参数数组
   * 表示在关联组中使用的 delta-x、delta-y、delta-z 参数的 3 个布尔值数组
   *
   * @memberof CorrelationGroup.prototype
   * @type {boolean[]}
   * @readonly
   */
  groupFlags: {
    get: function () {
      return this._groupFlags;
    },
  },

  /**
   * 分别关于 X、Y、Z 轴以毫弧度计的旋转角度
   *
   * @memberof CorrelationGroup.prototype
   * @type {Cartesian3}
   * @readonly
   */
  rotationThetas: {
    get: function () {
      return this._rotationThetas;
    },
  },

  /**
   * 分别用于 U、V、W 方向的 3 组 SPDCF 参数数组
   *
   * @memberof CorrelationGroup.prototype
   * @type {Spdcf[]}
   * @readonly
   */
  params: {
    get: function () {
      return this._params;
    },
  },
});

export default CorrelationGroup;