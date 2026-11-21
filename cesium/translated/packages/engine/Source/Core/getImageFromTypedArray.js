/**
 * 根据像素值数组构建图像
 *
 * @param {Uint8Array} typedArray 像素值数组
 * @param {number} width 要创建的图像宽度
 * @param {number} height 要创建的图像高度
 * @returns {HTMLCanvasElement} A 包含构建后的图像的新的画布
 *
 * @private
 */
function getImageFromTypedArray(typedArray, width, height) {
  // Input typedArray is Uint8Array, ImageData needs Uint8ClampedArray
  // To avoid copying, make a new DataView of the same buffer
  const dataArray = new Uint8ClampedArray(typedArray.buffer);
  const imageData = new ImageData(dataArray, width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);

  return canvas;
}
export default getImageFromTypedArray;
