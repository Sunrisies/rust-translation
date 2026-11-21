// @ts-check

import { WebGLConstants } from "@cesium/core";
/**
 * 确定哪些三角形会被剔除（如果有的话）。
 *
 * @enum {number}
 */
const CullFace = {
  /**
   * 面向前方的三角形会被剔除。
   *
   * @type {number}
   * @constant
   */
  FRONT: WebGLConstants.FRONT,

  /**
   * 面向后方的三角形会被剔除。
   *
   * @type {number}
   * @constant
   */
  BACK: WebGLConstants.BACK,

  /**
   * 面向前方和面向后方的所有三角形都会被剔除。
   *
   * @type {number}
   * @constant
   */
  FRONT_AND_BACK: WebGLConstants.FRONT_AND_BACK,
};

Object.freeze(CullFace);

export default CullFace;
