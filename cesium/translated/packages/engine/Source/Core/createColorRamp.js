// @ts-check

/** @import { Color } from "@cesium/core"; */

/**
 * 创建一个在给定颜色之间线性插值的颜色渐变。
 *
 * @param {Color[]} colors 用于颜色渐变的颜色数组。
 * @param {number} rampLength 要创建的颜色渐变长度（以样本数表示）。
 * @returns {Uint8Array} A 表示颜色渐变的类型数组。
 *
 * @private
 */
function createColorRamp(colors, rampLength) {
  const ramp = document.createElement("canvas");
  ramp.width = rampLength;
  ramp.height = 1;
  const ctx = ramp.getContext("2d");
  const grd = ctx.createLinearGradient(0, 0, ramp.width, 0);

  const stepSize = 1 / (colors.length - 1);
  for (let i = 0; i < colors.length; i++) {
    const color = colors[i];
    const stop = i * stepSize;
    const cssColor = color.toCssColorString();
    grd.addColorStop(stop, cssColor);
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, ramp.width, ramp.height);

  const imageData = ctx.getImageData(0, 0, ramp.width, ramp.height);
  const array = new Uint8Array(imageData.data.buffer);
  return array;
}

export default createColorRamp;
