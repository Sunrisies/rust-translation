import { defined } from "@cesium/core";
import ConstantProperty from "./ConstantProperty.js";

function createProperty(
  name,
  privateName,
  subscriptionName,
  configurable,
  createPropertyCallback,
) {
  return {
    configurable: configurable,
    get: function () {
      return this[privateName];
    },
    set: function (value) {
      const oldValue = this[privateName];
      const subscription = this[subscriptionName];
      if (defined(subscription)) {
        subscription();
        this[subscriptionName] = undefined;
      }

      const hasValue = value !== undefined;
      if (
        hasValue &&
        (!defined(value) || !defined(value.getValue)) &&
        defined(createPropertyCallback)
      ) {
        value = createPropertyCallback(value);
      }

      if (oldValue !== value) {
        this[privateName] = value;
        this._definitionChanged.raiseEvent(this, name, value, oldValue);
      }

      if (defined(value) && defined(value.definitionChanged)) {
        this[subscriptionName] = value.definitionChanged.addEventListener(
          function () {
            this._definitionChanged.raiseEvent(this, name, value, value);
          },
          this,
        );
      }
    },
  };
}

function createConstantProperty(value) {
  return new ConstantProperty(value);
}

/**
 * 用于统一定义所有 DataSources 图形对象。
 * 此功能被拆分为两个函数，因为 Chrome 性能分析器在检测到该字符串在整个函数中保持不变时，能更高效地优化查找操作。
 * 该属性名称。
 *
 * @param {string|symbol} name 属性描述符的名称。
 * @param {boolean} [configurable=false] 该属性描述符是否可配置。
 * @param {function(*): *} [createPropertyCallback] 从非属性值中创建属性。默认情况下会创建 {@link ConstantProperty} 类型属性。
 * @returns {PropertyDescriptor} The 属性描述符。
 *
 * @private
 */
function createPropertyDescriptor(name, configurable, createPropertyCallback) {
  //Safari 8.0.3 has a JavaScript bug that causes it to confuse two variables and treat them as the same.
  //The two extra toString calls work around the issue.
  return createProperty(
    name,
    `_${name.toString()}`,
    `_${name.toString()}Subscription`,
    configurable ?? false,
    createPropertyCallback ?? createConstantProperty,
  );
}
export default createPropertyDescriptor;
