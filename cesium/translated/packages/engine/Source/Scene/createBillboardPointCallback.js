/**
 * 创建一个 {@link createBillboardPointCallback.CanvasFunction} 函数，用于生成包含点的画布。
 *
 * @param {number} centerAlpha 点中心的透明度。值必须在 [0.0, 1.0] 范围内。
 * @param {string} cssColor CSS 颜色字符串。
 * @param {string} cssOutlineColor 点轮廓的 CSS 颜色。
 * @param {number} cssOutlineWidth 轮廓的宽度，单位为像素。
 * @param {number} pixelSize 点的大小，单位为像素。
 * @return {createBillboardPointCallback.CanvasFunction} The 返回一个包含绘有点的画布的函数。
 *
 * @private
 */
function createBillboardPointCallback(
  centerAlpha,
  cssColor,
  cssOutlineColor,
  cssOutlineWidth,
  pixelSize,
) {
  return function () {
    const canvas = document.createElement("canvas");

    const length = pixelSize + 2 * cssOutlineWidth;
    canvas.height = canvas.width = length;

    const context2D = canvas.getContext("2d");
    context2D.clearRect(0, 0, length, length);

    if (cssOutlineWidth !== 0) {
      context2D.beginPath();
      context2D.arc(length / 2, length / 2, length / 2, 0, 2 * Math.PI, true);
      context2D.closePath();
      context2D.fillStyle = cssOutlineColor;
      context2D.fill();
      // Punch a hole in the center if needed.
      if (centerAlpha < 1.0) {
        context2D.save();
        context2D.globalCompositeOperation = "destination-out";
        context2D.beginPath();
        context2D.arc(
          length / 2,
          length / 2,
          pixelSize / 2,
          0,
          2 * Math.PI,
          true,
        );
        context2D.closePath();
        context2D.fillStyle = "black";
        context2D.fill();
        context2D.restore();
      }
    }

    context2D.beginPath();
    context2D.arc(length / 2, length / 2, pixelSize / 2, 0, 2 * Math.PI, true);
    context2D.closePath();
    context2D.fillStyle = cssColor;
    context2D.fill();

    return canvas;
  };
}

/**
 * 返回一个包含点图像的画布的函数。
 * @callback createBillboardPointCallback.CanvasFunction
 * @returns {HTMLCanvasElement} The 计算结果的数值。
 */
export default createBillboardPointCallback;
