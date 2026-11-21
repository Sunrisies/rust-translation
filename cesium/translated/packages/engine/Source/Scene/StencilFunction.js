// @ts-check

import { WebGLConstants } from "@cesium/core";
/**
 * 指定用于比较模板值的模板测试函数。
 *
 * @enum {number}
 */
const StencilFunction = {
  /**
   * 模板测试永远不通过。
   *
   * @type {number}
   * @constant
   */
  NEVER: WebGLConstants.NEVER,

  /**
   * 当遮罩参考值小于遮罩模板值时，模板测试通过。
   *
   * @type {number}
   * @constant
   */
  LESS: WebGLConstants.LESS,

  /**
   * 当遮罩参考值等于遮罩模板值时，模板测试通过。
   *
   * @type {number}
   * @constant
   */
  EQUAL: WebGLConstants.EQUAL,

  /**
   * 当遮罩参考值小于或等于遮罩模板值时，模板测试通过。
   *
   * @type {number}
   * @constant
   */
  LESS_OR_EQUAL: WebGLConstants.LEQUAL,

  /**
   * 当遮罩参考值大于遮罩模板值时，模板测试通过。
   *
   * @type {number}
   * @constant
   */
  GREATER: WebGLConstants.GREATER,

  /**
   * 当遮罩参考值不等于遮罩模板值时，模板测试通过。
   *
   * @type {number}
   * @constant
   */
  NOT_EQUAL: WebGLConstants.NOTEQUAL,

  /**
   * 当遮罩参考值大于或等于遮罩模板值时，模板测试通过。
   *
   * @type {number}
   * @constant
   */
  GREATER_OR_EQUAL: WebGLConstants.GEQUAL,

  /**
   * 模板测试总是通过。
   *
   * @type {number}
   * @constant
   */
  ALWAYS: WebGLConstants.ALWAYS,
};

Object.freeze(StencilFunction);

export default StencilFunction;
