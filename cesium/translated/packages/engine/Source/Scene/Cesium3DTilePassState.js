import { Check } from "@cesium/core";

/**
 * 3D 瓦片更新周期的状态。
 *
 * @private
 * @constructor
 */
function Cesium3DTilePassState(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options", options);
  Check.typeOf.number("options.pass", options.pass);
  //>>includeEnd('debug');

  /**
   * 该周期。
   *
   * @type {Cesium3DTilePass}
   */
  this.pass = options.pass;

  /**
   * 用于当前周期的渲染指令数组，可替代 {@link FrameState.commandList}。
   *
   * @type {DrawCommand[]}
   */
  this.commandList = options.commandList;

  /**
   * 用于当前周期的相机参数，可替代 {@link FrameState.camera}。
   *
   * @type {Camera}
   */
  this.camera = options.camera;

  /**
   * 用于当前周期的剔除区域参数，可替代 {@link FrameState.cullingVolume}。
   *
   * @type {CullingVolume}
   */
  this.cullingVolume = options.cullingVolume;

  /**
   * 一个只读属性，用于指示该周期是否准备就绪，即该周期所需的所有瓦片均已加载。
   *
   * @type {boolean}
   * @readonly
   * @default false
   */
  this.ready = false;
}
export default Cesium3DTilePassState;
