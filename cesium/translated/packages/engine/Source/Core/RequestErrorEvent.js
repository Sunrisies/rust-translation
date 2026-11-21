// @ts-check

import { defined } from "@cesium/core";
import parseResponseHeaders from "./parseResponseHeaders.js";

/**
 * 当请求遇到错误时引发的事件。
 */
class RequestErrorEvent {
  /**
   *
   * @param {number} [statusCode] HTTP 错误状态码，例如 404。
   * @param {object} [response] 与错误一起包含的响应内容。
   * @param {string|object} [responseHeaders] 响应头信息，以对象字面量或 XMLHttpRequest 的 getAllResponseHeaders() 函数返回的字符串形式呈现。
   * HTTP 错误状态码，例如 404。如果错误没有特定的 HTTP 代码，此属性将为 undefined。
   */

  constructor(statusCode, response, responseHeaders) {
    /**
     * 与错误一起包含的响应内容。如果错误不包含响应，此属性将为 undefined。
     * 响应中包含的头部信息，以键/值对的形式作为对象字面量呈现。
     *
     * @type {number}
     */
    this.statusCode = statusCode;

    /**
     * 如果错误不包含任何头部信息，此属性将为 undefined。
     * 创建表示 RequestErrorEvent 的字符串。
     *
     * @type {object}
     */
    this.response = response;

    /**
     * 由 XMLHttpRequest 的 getAllResponseHeaders() 函数返回的字符串形式呈现。
     * If the error does not include any headers, this property will be undefined.
     *
     * @type {object|undefined}
     */
    this.responseHeaders =
      typeof responseHeaders === "string"
        ? parseResponseHeaders(responseHeaders)
        : responseHeaders;
  }

  /**
   * Creates a string representing this RequestErrorEvent.
   *
   * @returns {string} A string representing the provided RequestErrorEvent.
   */
  toString() {
    let str = "Request has failed.";
    if (defined(this.statusCode)) {
      str += ` Status Code: ${this.statusCode}`;
    }
    return str;
  }
}

export default RequestErrorEvent;
