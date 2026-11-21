import { Check } from "@cesium/core";

/**
 * @typedef {object} AnchorPointIndirect.ConstructorOptions
 *
 * AnchorPointIndirect 构造函数的初始化选项
 *
 * @property {Cartesian3} position  锚点地理坐标
 * @property {Cartesian3} adjustmentParams 以米为单位的调整值
 * @property {Matrix3} covarianceMatrix 3×3 协方差矩阵
 */

/**
 * 存储的单个锚点的元数据
 *
 * 这反映了 `anchronPointIndirect` 的定义
 * {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local} glTF 扩展
 *
 * @constructor
 * @param {AnchorPointIndirect.ConstructorOptions} options 描述初始化选项的对象
 * @experimental This 该特性尚未定稿，可能根据 Cesium 的标准弃用政策进行变更
 */
function AnchorPointIndirect(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.position", options.position);
  Check.typeOf.object("options.adjustmentParams", options.adjustmentParams);
  Check.typeOf.object("options.covarianceMatrix", options.covarianceMatrix);
  //>>includeEnd('debug');

  this._position = options.position;
  this._adjustmentParams = options.adjustmentParams;
  this._covarianceMatrix = options.covarianceMatrix;
}

Object.defineProperties(AnchorPointIndirect.prototype, {
  /**
   * 以米为单位的锚点地理坐标，格式为 X/Easting, Y/Northing, Z/HAE
   *
   * @memberof AnchorPointIndirect.prototype
   * @type {Cartesian3}
   * @readonly
   */
  position: {
    get: function () {
      return this._position;
    },
  },

  /**
   * 每个锚点的 delta-x、delta-y、delta-z 调整值，单位为单位米
   * 点
   *
   * @memberof AnchorPointIndirect.prototype
   * @type {Cartesian3}
   * @readonly
   */
  adjustmentParams: {
    get: function () {
      return this._adjustmentParams;
    },
  },

  /**
   * 3×3 协方差矩阵
   *
   * @memberof AnchorPointIndirect.prototype
   * @type {Matrix3}
   * @readonly
   */
  covarianceMatrix: {
    get: function () {
      return this._covarianceMatrix;
    },
  },
});

export default AnchorPointIndirect;
