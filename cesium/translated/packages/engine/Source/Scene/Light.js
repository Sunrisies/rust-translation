import { DeveloperError } from "@cesium/core";

/**
 * 光源。此类型描述了一个接口，不用于直接实例化。<code>color</code>和<code>intensity</code>共同决定了高动态范围的光色。<code>intensity</code>也可以单独使用，以调节光线的亮度或暗度，而不会改变色调。
 *
 * @alias Light
 * @constructor
 *
 * @see DirectionalLight
 * @see SunLight
 */
function Light() {}

Object.defineProperties(Light.prototype, {
  /**
   * 光的颜色。
   * @memberof Light.prototype
   * @type {Color}
   */
  color: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * <code>intensity</code>控制光的强度。<code>intensity</code>的最小值为0.0，没有最大值。
   * @memberof Light.prototype
   * @type {number}
   */
  intensity: {
    get: DeveloperError.throwInstantiationError,
  },
});

export default Light;
