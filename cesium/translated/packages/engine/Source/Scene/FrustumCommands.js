import Pass from "../Renderer/Pass.js";

/**
 * 定义了一组命令列表，其几何形状受相机远近距离限制。
 * @alias FrustumCommands
 * @constructor
 *
 * @param {number} [near=0.0] 与相机最近的边界或最小距离。
 * @param {number} [far=0.0] 与相机最远的边界或最大距离。
 *
 * @private
 */
function FrustumCommands(near, far) {
  this.near = near ?? 0.0;
  this.far = far ?? 0.0;

  const numPasses = Pass.NUMBER_OF_PASSES;
  const commands = new Array(numPasses);
  const indices = new Array(numPasses);

  for (let i = 0; i < numPasses; ++i) {
    commands[i] = [];
    indices[i] = 0;
  }

  this.commands = commands;
  this.indices = indices;
}
export default FrustumCommands;
