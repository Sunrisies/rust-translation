// @ts-check

import { WebGLConstants } from "@cesium/core";
/**
 * 根据模板测试的结果决定执行的操作。
 *
 * @enum {number}
 */
const StencilOperation = {
  /**
   * 将模板缓冲区值置零。
   *
   * @type {number}
   * @constant
   */
  ZERO: WebGLConstants.ZERO,

  /**
   * 不更改模板缓冲区。
   *
   * @type {number}
   * @constant
   */
  KEEP: WebGLConstants.KEEP,

  /**
   * 用参考值替换模板缓冲区值。
   *
   * @type {number}
   * @constant
   */
  REPLACE: WebGLConstants.REPLACE,

  /**
   * 增加模板缓冲区值，并限制为无符号字节范围。
   *
   * @type {number}
   * @constant
   */
  INCREMENT: WebGLConstants.INCR,

  /**
   * 减少模板缓冲区值，并限制为零。
   *
   * @type {number}
   * @constant
   */
  DECREMENT: WebGLConstants.DECR,

  /**
   * 对现有模板缓冲区值进行位反转操作。
   *
   * @type {number}
   * @constant
   */
  INVERT: WebGLConstants.INVERT,

  /**
   * 增加模板缓冲区值，超出无符号字节范围时循环至零。
   *
   * @type {number}
   * @constant
   */
  INCREMENT_WRAP: WebGLConstants.INCR_WRAP,

  /**
   * 减少模板缓冲区值，循环至最大无符号字节，不会低于零。
   *
   * @type {number}
   * @constant
   */
  DECREMENT_WRAP: WebGLConstants.DECR_WRAP,
};

Object.freeze(StencilOperation);

export default StencilOperation;
