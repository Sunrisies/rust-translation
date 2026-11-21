/**
 * 更新 3D 瓦片集的轮次。
 *
 * @enum {number}
 * @internal
 */
const Cesium3DTilePass = {
  RENDER: 0,
  PICK: 1,
  SHADOW: 2,
  PRELOAD: 3,
  PRELOAD_FLIGHT: 4,
  REQUEST_RENDER_MODE_DEFER_CHECK: 5,
  MOST_DETAILED_PRELOAD: 6,
  MOST_DETAILED_PICK: 7,
  NUMBER_OF_PASSES: 8,
};

const passOptions = new Array(Cesium3DTilePass.NUMBER_OF_PASSES);

passOptions[Cesium3DTilePass.RENDER] = Object.freeze({
  pass: Cesium3DTilePass.RENDER,
  isRender: true,
  requestTiles: true,
  ignoreCommands: false,
});

passOptions[Cesium3DTilePass.PICK] = Object.freeze({
  pass: Cesium3DTilePass.PICK,
  isRender: false,
  requestTiles: false,
  ignoreCommands: false,
});

passOptions[Cesium3DTilePass.SHADOW] = Object.freeze({
  pass: Cesium3DTilePass.SHADOW,
  isRender: false,
  requestTiles: true,
  ignoreCommands: false,
});

passOptions[Cesium3DTilePass.PRELOAD] = Object.freeze({
  pass: Cesium3DTilePass.PRELOAD,
  isRender: false,
  requestTiles: true,
  ignoreCommands: true,
});

passOptions[Cesium3DTilePass.PRELOAD_FLIGHT] = Object.freeze({
  pass: Cesium3DTilePass.PRELOAD_FLIGHT,
  isRender: false,
  requestTiles: true,
  ignoreCommands: true,
});

passOptions[Cesium3DTilePass.REQUEST_RENDER_MODE_DEFER_CHECK] = Object.freeze({
  pass: Cesium3DTilePass.REQUEST_RENDER_MODE_DEFER_CHECK,
  isRender: false,
  requestTiles: true,
  ignoreCommands: true,
});

passOptions[Cesium3DTilePass.MOST_DETAILED_PRELOAD] = Object.freeze({
  pass: Cesium3DTilePass.MOST_DETAILED_PRELOAD,
  isRender: false,
  requestTiles: true,
  ignoreCommands: true,
});

passOptions[Cesium3DTilePass.MOST_DETAILED_PICK] = Object.freeze({
  pass: Cesium3DTilePass.MOST_DETAILED_PICK,
  isRender: false,
  requestTiles: false,
  ignoreCommands: false,
});

/**
 * 获取描述在某一轮次中瓦片集如何更新的选项。
 *
 * @param {Cesium3DTilePass} pass 该轮次。
 * @returns {{pass: Cesium3DTilePass, isRender: boolean, requestTiles: boolean, ignoreCommands: boolean}} 该轮次的选项。
 *
 * @private
 */
Cesium3DTilePass.getPassOptions = function (pass) {
  return passOptions[pass];
};

Object.freeze(Cesium3DTilePass);

export default Cesium3DTilePass;
