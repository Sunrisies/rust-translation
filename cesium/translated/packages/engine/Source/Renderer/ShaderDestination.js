import { Check, DeveloperError } from "@cesium/core";

/**
 * 一个标志位，用于说明变量是否应被添加到
 * 顶点着色器、片段着色器或两者（或都不加）。
 *
 * @enum {number}
 * @private
 */
const ShaderDestination = {
  NONE: 0,
  VERTEX: 1,
  FRAGMENT: 2,
  BOTH: 3,
};

/**
 * 检查变量是否应包含在顶点着色器中。
 *
 * @param {ShaderDestination} destination 要检查的 ShaderDestination
 * @return {boolean} <code>true</code> 如果变量出现在顶点着色器中，则为 true；否则为 <code>false</code>。
 * @private
 */
ShaderDestination.includesVertexShader = function (destination) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("destination", destination);
  //>>includeEnd('debug');

  return (destination & ShaderDestination.VERTEX) !== 0;
};

/**
 * 检查变量是否应包含在顶点着色器中。
 *
 * @param {ShaderDestination} destination 要检查的 ShaderDestination
 * @return {boolean} <code>true</code> 如果变量出现在顶点着色器中，则为 true；否则为 <code>false</code>。
 * @private
 */
ShaderDestination.includesFragmentShader = function (destination) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("destination", destination);
  //>>includeEnd('debug');
  //

  return (destination & ShaderDestination.FRAGMENT) !== 0;
};

/**
 * 计算多个 ShaderDestination 的并集（例如，VERTEX | FRAGMENT 表示两者都包含）。
 * @param  {...ShaderDestination} destinations
 * @returns {ShaderDestination} The 提供的 ShaderDestination 的并集。
 * @private
 */
ShaderDestination.union = function (...destinations) {
  //>>includeStart('debug', pragmas.debug);
  if (destinations.length === 0) {
    throw new DeveloperError(
      "ShaderDestination.union requires at least one destination.",
    );
  }
  //>>includeEnd('debug');

  let result = 0;
  for (let i = 0; i < destinations.length; i++) {
    result |= destinations[i];
  }
  return result;
};

/**
 * 计算多个 ShaderDestination 的交集（例如，VERTEX & FRAGMENT 表示无交集）。
 * @param  {...ShaderDestination} destinations
 * @returns {ShaderDestination} The 提供的 ShaderDestination 的交集。
 * @private
 */
ShaderDestination.intersection = function (...destinations) {
  //>>includeStart('debug', pragmas.debug);
  if (destinations.length === 0) {
    throw new DeveloperError(
      "ShaderDestination.intersection requires at least one destination.",
    );
  }
  //>>includeEnd('debug');

  let result = destinations[0];
  for (let i = 1; i < destinations.length; i++) {
    result &= destinations[i];
  }
  return result;
};

Object.freeze(ShaderDestination);

export default ShaderDestination;
