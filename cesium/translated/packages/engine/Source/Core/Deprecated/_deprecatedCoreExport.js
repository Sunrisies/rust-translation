import { deprecationWarning } from "@cesium/core";

/**
 * 将移动至 @cesium/core 的符号封装在代理中，并记录一次性的日志。
 * 在首次构造、调用、读取或写入时发出弃用警告。
 * 随后转发到实际实现。
 * @param {string} name 导出符号的名称，例如“Cartesian3”。
 * @param {*} target 被封装的实际 @cesium/core 导出内容。
 * @returns {*}
 * @ignore
 */
function deprecatedCoreExport(name, target) {
  const message = `${name} has been moved from cesium/engine to cesium/core in CesiumJS 1.146, and will be removed from cesium/engine in 1.150. Import from cesium/core instead.`;
  const warn = () => deprecationWarning(name, message);

  return new Proxy(target, {
    get(t, prop, receiver) {
      warn();
      return Reflect.get(t, prop, receiver);
    },
    set(t, prop, value, receiver) {
      warn();
      return Reflect.set(t, prop, value, receiver);
    },
    apply(t, thisArg, args) {
      warn();
      return Reflect.apply(t, thisArg, args);
    },
    construct(t, args, newTarget) {
      warn();
      return Reflect.construct(t, args, newTarget);
    },
  });
}
export default deprecatedCoreExport;
