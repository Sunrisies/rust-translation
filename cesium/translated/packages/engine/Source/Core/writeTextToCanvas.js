import { Color, DeveloperError, Frozen, defined } from "@cesium/core";

/**
 * 根据当前画布状态计算文本的尺寸。
 *
 * 将宽度除外的一切度量值四舍五入到整像素。这纯粹是为了减少
 * 向浏览器内 measureText() 迁移时的渲染差异，未来可能会进行
 * 修改。参见：github.com/CesiumGS/cesium/pull/13081
 * @ignore
 */
function measureText(context2D, textString) {
  const metrics = context2D.measureText(textString);
  const isSpace = !/\S/.test(textString);

  if (isSpace) {
    return {
      width: metrics.width,
      height: 0,
      ascent: 0,
      descent: 0,
      minx: 0,
    };
  }

  // Baseline alignment requires `height = ascent + descent`. Rounding (if any)
  // must be done before summing, or glyph pairs like "ij" may be misaligned.
  const ascent = Math.round(metrics.actualBoundingBoxAscent);
  const descent = Math.round(metrics.actualBoundingBoxDescent);

  // Characters like "_" may have height <0.5 at some sizes, don't round to zero.
  const height = Math.max(ascent + descent, 1);

  return {
    width: metrics.width,
    height,
    ascent,
    descent,
    minx: -Math.round(metrics.actualBoundingBoxLeft),
  };
}

let imageSmoothingEnabledName;

/**
 * 将给定文本写入新画布中。该画布的大小将适应文本。
 * 如果文本为空，则返回 undefined。
 *
 * @param {string} text 要写入的文本。
 * @param {object} [options] 具有以下属性的对象：
 * @param {string} [options.font='10px sans-serif'] 使用的 CSS 字体。
 * @param {boolean} [options.fill=true] 是否填充文本。
 * @param {boolean} [options.stroke=false] 是否描边文本。
 * @param {Color} [options.fillColor=Color.WHITE] 填充颜色。
 * @param {Color} [options.strokeColor=Color.BLACK] 描边颜色。
 * @param {number} [options.strokeWidth=1] 描边宽度。
 * @param {Color} [options.backgroundColor=Color.TRANSPARENT] 画布的背景颜色。
 * @param {number} [options.padding=0] 围绕文本添加的填充像素大小。
 * @returns {HTMLCanvasElement|undefined} A 包含给定文本的新的画布。来自 measureText 的尺寸对象也将被添加到返回的画布中。如果文本为
 * 空白，则返回 undefined。
 * blank, returns undefined.
 * @function writeTextToCanvas
 */
function writeTextToCanvas(text, options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(text)) {
    throw new DeveloperError("text is required.");
  }
  //>>includeEnd('debug');
  if (text === "") {
    return undefined;
  }

  options = options ?? Frozen.EMPTY_OBJECT;
  const font = options.font ?? "10px sans-serif";
  const stroke = options.stroke ?? false;
  const fill = options.fill ?? true;
  const strokeWidth = options.strokeWidth ?? 1;
  const backgroundColor = options.backgroundColor ?? Color.TRANSPARENT;
  const padding = options.padding ?? 0;
  const doublePadding = padding * 2.0;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.style.font = font;
  // Since multiple read-back operations are expected for labels, use the willReadFrequently option – See https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
  const context2D = canvas.getContext("2d", { willReadFrequently: true });

  if (!defined(imageSmoothingEnabledName)) {
    if (defined(context2D.imageSmoothingEnabled)) {
      imageSmoothingEnabledName = "imageSmoothingEnabled";
    } else if (defined(context2D.mozImageSmoothingEnabled)) {
      imageSmoothingEnabledName = "mozImageSmoothingEnabled";
    } else if (defined(context2D.webkitImageSmoothingEnabled)) {
      imageSmoothingEnabledName = "webkitImageSmoothingEnabled";
    } else if (defined(context2D.msImageSmoothingEnabled)) {
      imageSmoothingEnabledName = "msImageSmoothingEnabled";
    }
  }

  context2D.font = font;
  context2D.lineJoin = "round";
  context2D.lineWidth = strokeWidth;
  context2D[imageSmoothingEnabledName] = false;

  // in order for measureText to calculate style, the canvas has to be
  // (temporarily) added to the DOM.
  canvas.style.visibility = "hidden";
  document.body.appendChild(canvas);

  const dimensions = measureText(context2D, text);

  // Set canvas.dimensions to be accessed in LabelCollection. LabelCollection
  // hard-codes strokeWidth=0, so dimensions should not include stroke padding.
  canvas.dimensions = dimensions;

  document.body.removeChild(canvas);
  canvas.style.visibility = "";

  // measureText does not account for stroke width, added here. LabelCollection
  // calls writeTextToCanvas with hard-coded strokeWidth=0, so stroke padding
  // matters only when calling `writeTextToCanvas` directly.
  const isSpace = !/\S/.test(text);
  const strokePadding = stroke && !isSpace ? Math.ceil(strokeWidth / 2) : 0;
  const doubleStrokePadding = strokePadding * 2;

  // Some characters, such as the letter j, have a non-zero starting position.
  // This value is used for kerning later, but we need to take it into account
  // now in order to draw the text completely on the canvas
  const x = -dimensions.minx + strokePadding;

  // Expand the width to include the starting position.
  const width = Math.ceil(dimensions.width) + x + doublePadding + strokePadding;

  // While the height of the letter is correct, we need to adjust
  // where we start drawing it so that letters like j and y properly dip
  // below the line.

  const height = dimensions.height + doublePadding + doubleStrokePadding;
  const y = dimensions.ascent + padding + strokePadding;

  canvas.width = width;
  canvas.height = height;

  // Properties must be explicitly set again after changing width and height
  context2D.font = font;
  context2D.lineJoin = "round";
  context2D.lineWidth = strokeWidth;
  context2D[imageSmoothingEnabledName] = false;

  // Draw background
  if (backgroundColor !== Color.TRANSPARENT) {
    context2D.fillStyle = backgroundColor.toCssColorString();
    context2D.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (stroke) {
    const strokeColor = options.strokeColor ?? Color.BLACK;
    context2D.strokeStyle = strokeColor.toCssColorString();
    context2D.strokeText(text, x + padding, y);
  }

  if (fill) {
    const fillColor = options.fillColor ?? Color.WHITE;
    context2D.fillStyle = fillColor.toCssColorString();
    context2D.fillText(text, x + padding, y);
  }

  return canvas;
}
export default writeTextToCanvas;
