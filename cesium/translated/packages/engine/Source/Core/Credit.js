// @ts-check

import { Check, defined } from "@cesium/core";
import DOMPurify from "dompurify";

let nextCreditId = 0;
/**
 * @private
 * @type {Record<string, number>}
 */
const creditToId = {};

/**
 * 版权信息包含有关如何在屏幕上显示特定内容的归属/版权说明的数据。
 *
 * @example
 * // 创建一个带有工具提示、图像和链接的版权信息
 * const credit = new Cesium.Credit('<a href="https://cesium.com/" target="_blank"><img src="/images/cesium_logo.png"  style="vertical-align: -7px" title="Cesium"/></a>');
 */
class Credit {
  /**
   * @param {string} html 代表 HTML 代码片段的字符串
   * @param {boolean} [showOnScreen=false] 如果为 true，版权信息将显示在主版权容器中。否则，它将以弹出框形式显示。所有版权信息都采用 `inline` 方式显示，如果有图像，建议根据文本大小调整图像尺寸或使用 CSS 进行 `vertical-align` 对齐。
   *
   * @exception {DeveloperError} html 是必需的。
   */
  constructor(html, showOnScreen) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.string("html", html);
    //>>includeEnd('debug');
    let id;
    const key = html;

    if (defined(creditToId[key])) {
      id = creditToId[key];
    } else {
      id = nextCreditId++;
      creditToId[key] = id;
    }

    showOnScreen = showOnScreen ?? false;

    // Credits are immutable so generate an id to use to optimize equal()
    this._id = id;
    this._html = html;
    this._showOnScreen = showOnScreen;
    this._element = undefined;
  }

  /**
   * 版权内容
   * @type {string}
   * @readonly
   */
  get html() {
    return this._html;
  }

  /**
   * @type {number}
   * @readonly
   *
   * @private
   */
  get id() {
    return this._id;
  }

  /**
   * 版权信息是在屏幕上显示还是在灯箱中显示
   * @type {boolean}
   */
  get showOnScreen() {
    return this._showOnScreen;
  }

  set showOnScreen(value) {
    this._showOnScreen = value;
  }

  /**
   * 获取版权元素
   * @type {HTMLElement}
   * @readonly
   */
  get element() {
    if (!defined(this._element)) {
      const html = DOMPurify.sanitize(this._html);

      const div = document.createElement("div");
      div.className = "cesium-credit-wrapper";
      // @ts-expect-error Consider using a data-id attribute, instead.
      div._creditId = this._id;
      div.style.display = "inline";
      div.innerHTML = html;

      const links = div.querySelectorAll("a");
      for (let i = 0; i < links.length; i++) {
        links[i].setAttribute("target", "_blank");
      }

      this._element = div;
    }
    return this._element;
  }

  /**
   * 如果版权信息相同，则返回 true
   *
   * @param {Credit} [left] 第一个版权信息
   * @param {Credit} [right] 第二个版权信息
   * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回该值。
   */
  static equals(left, right) {
    return (
      left === right ||
      (defined(left) &&
        defined(right) &&
        left._id === right._id &&
        left._showOnScreen === right._showOnScreen)
    );
  }

  /**
   * 如果版权信息相同，则返回 true
   *
   * @param {Credit} [credit] 要比较的版权信息。
   * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回该值。
   */
  equals(credit) {
    return Credit.equals(this, credit);
  }

  /**
   * @private
   */
  isIon() {
    return this.html.indexOf("ion-credit.png") !== -1;
  }

  /**
   * @private
   * @param attribution
   * @return {Credit}
   */
  // @ts-expect-error Define type for GeocoderService.attributions
  static getIonCredit(attribution) {
    const showOnScreen =
      defined(attribution.collapsible) && !attribution.collapsible;
    const credit = new Credit(attribution.html, showOnScreen);

    return credit;
  }

  /**
   * 复制一个版权信息实例。
   *
   * @param {Credit} [credit] 要复制的版权信息。
   * @returns {Credit} A 一个新的版权信息实例，是所提供实例的副本。（如果版权信息未定义，则返回 undefined）
   */
  static clone(credit) {
    if (defined(credit)) {
      return new Credit(credit.html, credit.showOnScreen);
    }
  }
}

export default Credit;
