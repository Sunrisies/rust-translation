// @ts-check

/**
 * 请求状态。
 *
 * @enum {number}
 */
const RequestState = {
  /**
   * 初始未处理状态。
   *
   * @type {number}
   * @constant
   */
  UNISSUED: 0,

  /**
   * 已处理但尚未激活。当可用空闲资源时将变为激活状态。
   *
   * @type {number}
   * @constant
   */
  ISSUED: 1,

  /**
   * 实际的 HTTP 请求已发送。
   *
   * @type {number}
   * @constant
   */
  ACTIVE: 2,

  /**
   * 请求成功完成。
   *
   * @type {number}
   * @constant
   */
  RECEIVED: 3,

  /**
   * 请求被取消，可能是手动取消或由于优先级低而自动取消。
   *
   * @type {number}
   * @constant
   */
  CANCELLED: 4,

  /**
   * 请求失败。
   *
   * @type {number}
   * @constant
   */
  FAILED: 5,
};

Object.freeze(RequestState);

export default RequestState;
