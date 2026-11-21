// @ts-check

/**
 * 一个表示每点误差来源的枚举类型。
 *
 * 这反映了 `ppeMetadata.source` 的定义。
 * {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local} glTF 扩展。
 *
 * @enum {string}
 * @private
 */
const PpeSource = {
  /**
   * MCS 在 x 维度上的误差标准偏差（sigma x）。该值将被平方。
   * 并用于填充 PPE 协方差矩阵中的 (1,1) 元素。
   *
   * @type {string}
   * @constant
   */
  SIGX: "SIGX",

  /**
   * MCS 在 y 维度上的误差标准偏差（sigma y）。该值将被平方。
   * 并用于填充 PPE 协方差矩阵中的 (2,2) 元素。
   *
   * @type {string}
   * @constant
   */
  SIGY: "SIGY",

  /**
   * MCS 在 z 维度上的误差标准偏差（sigma z）。该值将被平方。
   * 并用于填充 PPE 协方差矩阵中的 (3,3) 元素。
   *
   * @type {string}
   * @constant
   */
  SIGZ: "SIGZ",

  /**
   * MCS 在 x 维度上的误差方差（sigma x2）。该值将用于填充 PPE 协方差矩阵中的 (1,1) 元素。
   * MCS 在 y 维度上的误差方差（sigma y2）。该值将用于填充 PPE 协方差矩阵中的 (2,2) 元素。
   *
   * @type {string}
   * @constant
   */
  VARX: "VARX",

  /**
   * MCS 在 z 维度上的误差方差（sigma z2）。该值将用于填充 PPE 协方差矩阵中的 (3,3) 元素。
   * MCS 在水平维度（x-y）上的径向误差（sigma radial）。该值将被平方。
   *
   * @type {string}
   * @constant
   */
  VARY: "VARY",

  /**
   * 并用于填充 PPE 协方差矩阵中的 (1,1) 和 (2,2) 元素。
   * the (3,3) element in the PPE covariance matrix.
   *
   * @type {string}
   * @constant
   */
  VARZ: "VARZ",

  /**
   * The PPE radial error in the horizontal dimension (x-y) of the MCS (sigma radial) . Value will be squared
   * and used to populate the (1,1) and (2,2) element in the PPE covariance matrix.
   *
   * @type {string}
   * @constant
   */
  SIGR: "VARZ",
};

Object.freeze(PpeSource);

export default PpeSource;
