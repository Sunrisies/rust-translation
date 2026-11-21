import { Math as CesiumMath } from "@cesium/core";

/**
 * 调整图像大小，确保宽度和高度均为2的幂次。
 * 注意：输入图像会被重新采样为更大尺寸，而非填充。
 * 图像的宽高比可能会发生变化。
 *
 * @param {HTMLImageElement|HTMLCanvasElement} image 需要调整大小的图像
 * @returns {HTMLCanvasElement} A 绘制了调整后的图像的新画布
 *
 * @private
 */
function resizeImageToNextPowerOfTwo(image) {
  const canvas = document.createElement("canvas");
  canvas.width = CesiumMath.nextPowerOfTwo(image.width);
  canvas.height = CesiumMath.nextPowerOfTwo(image.height);
  const canvasContext = canvas.getContext("2d");
  canvasContext.drawImage(
    image,
    0,
    0,
    image.width,
    image.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}
export default resizeImageToNextPowerOfTwo;
