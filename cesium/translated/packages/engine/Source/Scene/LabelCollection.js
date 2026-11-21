import {
  BoundingRectangle,
  Cartesian2,
  Check,
  Color,
  DeveloperError,
  Frozen,
  Matrix4,
  defined,
  destroyObject,
} from "@cesium/core";
import writeTextToCanvas from "../Core/writeTextToCanvas.js";
import bitmapSDF from "bitmap-sdf";
import BillboardCollection from "./BillboardCollection.js";
import BillboardTexture from "./BillboardTexture.js";
import BlendOption from "./BlendOption.js";
import { isHeightReferenceClamp } from "./HeightReference.js";
import HorizontalOrigin from "./HorizontalOrigin.js";
import Label from "./Label.js";
import LabelStyle from "./LabelStyle.js";
import SDFSettings from "./SDFSettings.js";
import TextureAtlas from "../Renderer/TextureAtlas.js";
import VerticalOrigin from "./VerticalOrigin.js";
import GraphemeSplitter from "grapheme-splitter";

/**
 * 符号代表标签中的单个字符。
 * @private
 */
function Glyph() {
  /**
   * 包含字符在画布上渲染尺寸的对象。
   * @see {writeTextToCanvas}
   * @type {object}
   * @private
   */
  this.dimensions = undefined;

  /**
   * 指向加载的单个字符图像数据，以特定样式绘制，并在所有标签中共享和引用。
   * @type {BillboardTexture}
   * @private
   */
  this.billboardTexture = undefined;

  /**
   * 用于渲染符号的单个广告牌。如果关联的字符为空白，则可能为 <code>undefined</code>。
   * @type {Billboard|undefined}
   * @private
   */
  this.billboard = undefined;
}

// Traditionally, leading is %20 of the font size.
const defaultLineSpacingPercent = 1.2;
const whitePixelCanvasId = "ID_WHITE_PIXEL";
const whitePixelSize = new Cartesian2(4, 4);
const whitePixelBoundingRegion = new BoundingRectangle(1, 1, 1, 1);

/**
 * 创建背景图像并开始将其加载为纹理。
 * @private
 * @param {BillboardCollection} billboardCollection
 * @param {LabelCollection} labelCollection
 * @returns {Billboard}
 */
function getWhitePixelBillboard(billboardCollection, labelCollection) {
  const billboardTexture = labelCollection._backgroundBillboardTexture;
  if (!billboardTexture.hasImage) {
    const canvas = document.createElement("canvas");
    canvas.width = whitePixelSize.x;
    canvas.height = whitePixelSize.y;

    const context2D = canvas.getContext("2d");
    context2D.fillStyle = "#fff";
    context2D.fillRect(0, 0, canvas.width, canvas.height);

    billboardTexture.loadImage(whitePixelCanvasId, canvas);
    billboardTexture.addImageSubRegion(
      whitePixelCanvasId,
      whitePixelBoundingRegion,
    );
  }

  const billboard = billboardCollection.add({
    collection: labelCollection,
  });

  billboard.setImageTexture(billboardTexture);
  billboard._positionFromParent = true;
  billboard._labelTranslate = new Cartesian2();

  return billboard;
}

// reusable object for calling writeTextToCanvas
const writeTextToCanvasParameters = {};
function createGlyphCanvas(
  character,
  font,
  fillColor,
  outlineColor,
  outlineWidth,
  style,
) {
  writeTextToCanvasParameters.font = font;
  writeTextToCanvasParameters.fillColor = fillColor;
  writeTextToCanvasParameters.strokeColor = outlineColor;
  writeTextToCanvasParameters.strokeWidth = outlineWidth;
  // Setting the padding to something bigger is necessary to get enough space for the outlining.
  writeTextToCanvasParameters.padding = SDFSettings.PADDING;

  writeTextToCanvasParameters.fill =
    style === LabelStyle.FILL || style === LabelStyle.FILL_AND_OUTLINE;
  writeTextToCanvasParameters.stroke =
    style === LabelStyle.OUTLINE || style === LabelStyle.FILL_AND_OUTLINE;
  writeTextToCanvasParameters.backgroundColor = Color.BLACK;

  return writeTextToCanvas(character, writeTextToCanvasParameters);
}

function unbindGlyphBillboard(labelCollection, glyph) {
  const billboard = glyph.billboard;
  if (defined(billboard)) {
    billboard.show = false;
    billboard._clampedPosition = undefined;
    if (defined(billboard._removeCallbackFunc)) {
      billboard._removeCallbackFunc();
      billboard._removeCallbackFunc = undefined;
    }
    labelCollection._spareBillboards.push(billboard);
    glyph.billboard = undefined;
  }
}

const splitter = new GraphemeSplitter();
const whitespaceRegex = /\s/;

function rebindAllGlyphs(labelCollection, label) {
  const text = label._renderedText;
  const graphemes = splitter.splitGraphemes(text);
  const textLength = graphemes.length;
  const glyphs = label._glyphs;
  const glyphsLength = glyphs.length;

  // Compute a font size scale relative to the sdf font generated size.
  label._relativeSize = label._fontSize / SDFSettings.FONT_SIZE;

  // if we have more glyphs than needed, unbind the extras.
  if (textLength < glyphsLength) {
    for (let glyphIndex = textLength; glyphIndex < glyphsLength; ++glyphIndex) {
      unbindGlyphBillboard(labelCollection, glyphs[glyphIndex]);
    }
  }

  // presize glyphs to match the new text length
  glyphs.length = textLength;

  let backgroundBillboard = label._backgroundBillboard;
  const backgroundBillboardCollection =
    labelCollection._backgroundBillboardCollection;

  // Create backgroundBillboard if needed
  if (label._showBackground && !defined(backgroundBillboard)) {
    backgroundBillboard = getWhitePixelBillboard(
      backgroundBillboardCollection,
      labelCollection,
    );
    label._backgroundBillboard = backgroundBillboard;
  }

  updateBackgroundBillboard(
    backgroundBillboardCollection,
    label,
    backgroundBillboard,
  );

  const glyphBillboardCollection = labelCollection._glyphBillboardCollection;
  const glyphTextureCache = glyphBillboardCollection.billboardTextureCache;
  const textDimensionsCache = labelCollection._textDimensionsCache;

  // walk the text looking for new characters (creating new glyphs for each)
  // or changed characters (rebinding existing glyphs)
  for (let textIndex = 0; textIndex < textLength; ++textIndex) {
    const character = graphemes[textIndex];
    const verticalOrigin = label._verticalOrigin;

    const id = JSON.stringify([
      character,
      label._fontFamily,
      label._fontStyle,
      label._fontWeight,
      +verticalOrigin,
    ]);

    let dimensions = textDimensionsCache[id];
    let glyphBillboardTexture = glyphTextureCache.get(id);
    if (!defined(glyphBillboardTexture) || !defined(dimensions)) {
      glyphBillboardTexture = new BillboardTexture(glyphBillboardCollection);
      glyphTextureCache.set(id, glyphBillboardTexture);

      const glyphFont = `${label._fontStyle} ${label._fontWeight} ${SDFSettings.FONT_SIZE}px ${label._fontFamily}`;

      const canvas = createGlyphCanvas(
        character,
        glyphFont,
        Color.WHITE,
        Color.WHITE,
        0.0,
        LabelStyle.FILL,
      );

      dimensions = canvas.dimensions;
      textDimensionsCache[id] = dimensions;

      if (
        canvas.width > 0 &&
        canvas.height > 0 &&
        !whitespaceRegex.test(character)
      ) {
        const sdfValues = bitmapSDF(canvas, {
          cutoff: SDFSettings.CUTOFF,
          radius: SDFSettings.RADIUS,
        });

        // Context is originally created in writeTextToCanvas()
        const ctx = canvas.getContext("2d");
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        for (let i = 0; i < canvasWidth; i++) {
          for (let j = 0; j < canvasHeight; j++) {
            const baseIndex = j * canvasWidth + i;
            const alpha = sdfValues[baseIndex] * 255;
            const imageIndex = baseIndex * 4;
            imgData.data[imageIndex + 0] = alpha;
            imgData.data[imageIndex + 1] = alpha;
            imgData.data[imageIndex + 2] = alpha;
            imgData.data[imageIndex + 3] = alpha;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        glyphBillboardTexture.loadImage(id, canvas);
      }
    }

    let glyph = glyphs[textIndex];
    if (!defined(glyph)) {
      glyph = new Glyph();
      glyph.dimensions = dimensions;
      glyph.billboardTexture = glyphBillboardTexture;
      glyphs[textIndex] = glyph;
    }

    if (glyph.billboardTexture.id !== id) {
      // This glyph has been mapped to a new texture. If we had one before, release
      // our reference to that texture and dimensions, but reuse the billboard.
      glyph.billboardTexture = glyphBillboardTexture;
      glyph.dimensions = dimensions;
    }

    if (!glyphBillboardTexture.hasImage) {
      // No texture, and therefore no billboard, for this glyph.
      // so, completely unbind glyph to free up the billboard for others
      unbindGlyphBillboard(labelCollection, glyph);
      continue;
    }

    // If we have a texture, configure the existing billboard, or obtain one
    let billboard = glyph.billboard;
    const spareBillboards = labelCollection._spareBillboards;
    if (!defined(billboard)) {
      if (spareBillboards.length > 0) {
        billboard = spareBillboards.pop();
      } else {
        billboard = glyphBillboardCollection.add({
          collection: labelCollection,
        });
        billboard._labelDimensions = new Cartesian2();
        billboard._labelTranslate = new Cartesian2();
        billboard._positionFromParent = true;
      }
      glyph.billboard = billboard;
    }

    billboard.setImageTexture(glyphBillboardTexture);

    billboard.show = label._show;
    billboard.position = label._position;
    billboard.eyeOffset = label._eyeOffset;
    billboard.pixelOffset = label._pixelOffset;
    billboard.horizontalOrigin = HorizontalOrigin.LEFT;
    billboard.verticalOrigin = label._verticalOrigin;
    billboard.heightReference = label._heightReference;
    if (defined(label._clampedPosition)) {
      billboard._clampedPosition = label._clampedPosition;
    }
    billboard.scale = label.totalScale;
    billboard.pickPrimitive = label;
    billboard.id = label._id;
    billboard.translucencyByDistance = label._translucencyByDistance;
    billboard.pixelOffsetScaleByDistance = label._pixelOffsetScaleByDistance;
    billboard.scaleByDistance = label._scaleByDistance;
    billboard.distanceDisplayCondition = label._distanceDisplayCondition;
    billboard.disableDepthTestDistance = label._disableDepthTestDistance;
    billboard._batchIndex = label._batchIndex;
    billboard.outlineColor = label.outlineColor;
    if (label.style === LabelStyle.FILL_AND_OUTLINE) {
      billboard.color = label._fillColor;
      billboard.outlineWidth = label.outlineWidth;
    } else if (label.style === LabelStyle.FILL) {
      billboard.color = label._fillColor;
      billboard.outlineWidth = 0.0;
    } else if (label.style === LabelStyle.OUTLINE) {
      billboard.color = Color.TRANSPARENT;
      billboard.outlineWidth = label.outlineWidth;
    }
  }

  // changing glyphs will cause the position of the
  // glyphs to change, since different characters have different widths
  label._repositionAllGlyphs = true;
}

function updateBackgroundBillboard(
  backgroundBillboardCollection,
  label,
  backgroundBillboard,
) {
  if (!defined(backgroundBillboard)) {
    return;
  }
  const showBackground =
    label.show &&
    label._showBackground &&
    label._renderedText.split("\n").join("").length > 0;
  // Label is shown and background is hidden - remove the background billboard
  if (label.show && !showBackground) {
    backgroundBillboardCollection.remove(backgroundBillboard);
    label._backgroundBillboard = undefined;
    return;
  }

  backgroundBillboard.color = label._backgroundColor;
  backgroundBillboard.show = label._show;
  backgroundBillboard.position = label._position;
  backgroundBillboard.eyeOffset = label._eyeOffset;
  backgroundBillboard.pixelOffset = label._pixelOffset;
  backgroundBillboard.horizontalOrigin = HorizontalOrigin.LEFT;
  backgroundBillboard.verticalOrigin = label._verticalOrigin;
  backgroundBillboard.heightReference = label._heightReference;
  if (defined(label._clampedPosition)) {
    backgroundBillboard._clampedPosition = label._clampedPosition;
  }
  backgroundBillboard.scale = label.totalScale;
  backgroundBillboard.pickPrimitive = label;
  backgroundBillboard.id = label._id;
  backgroundBillboard.translucencyByDistance = label._translucencyByDistance;
  backgroundBillboard.pixelOffsetScaleByDistance =
    label._pixelOffsetScaleByDistance;
  backgroundBillboard.scaleByDistance = label._scaleByDistance;
  backgroundBillboard.distanceDisplayCondition =
    label._distanceDisplayCondition;
  backgroundBillboard.disableDepthTestDistance =
    label._disableDepthTestDistance;
  backgroundBillboard.clusterShow = label.clusterShow;
}

function calculateWidthOffset(lineWidth, horizontalOrigin, backgroundPadding) {
  if (horizontalOrigin === HorizontalOrigin.CENTER) {
    return -lineWidth / 2;
  } else if (horizontalOrigin === HorizontalOrigin.RIGHT) {
    return -(lineWidth + backgroundPadding.x);
  }
  return backgroundPadding.x;
}

// reusable Cartesian2 instances
const glyphPixelOffset = new Cartesian2();
const scratchBackgroundPadding = new Cartesian2();

function repositionAllGlyphs(label) {
  const glyphs = label._glyphs;
  const text = label._renderedText;
  let lastLineWidth = 0;
  let maxLineWidth = 0;
  const lineWidths = [];
  let maxGlyphDescent = Number.NEGATIVE_INFINITY;
  let maxGlyphY = 0;
  let numberOfLines = 1;
  const glyphLength = glyphs.length;

  const backgroundBillboard = label._backgroundBillboard;
  const backgroundPadding = Cartesian2.clone(
    defined(backgroundBillboard) ? label._backgroundPadding : Cartesian2.ZERO,
    scratchBackgroundPadding,
  );

  // We need to scale the background padding, which is specified in pixels by the inverse of the relative size so it is scaled properly.
  backgroundPadding.x /= label._relativeSize;
  backgroundPadding.y /= label._relativeSize;

  for (let glyphIndex = 0; glyphIndex < glyphLength; ++glyphIndex) {
    if (text.charAt(glyphIndex) === "\n") {
      lineWidths.push(lastLineWidth);
      ++numberOfLines;
      lastLineWidth = 0;
      continue;
    }

    const glyph = glyphs[glyphIndex];
    const dimensions = glyph.dimensions;
    if (defined(dimensions)) {
      maxGlyphY = Math.max(maxGlyphY, dimensions.height - dimensions.descent);
      maxGlyphDescent = Math.max(maxGlyphDescent, dimensions.descent);

      // Computing the line width must also account for the kerning that occurs between letters.
      lastLineWidth += dimensions.width - dimensions.minx;
      if (glyphIndex < glyphLength - 1) {
        lastLineWidth += glyphs[glyphIndex + 1].dimensions.minx;
      }
      maxLineWidth = Math.max(maxLineWidth, lastLineWidth);
    }
  }
  lineWidths.push(lastLineWidth);
  const maxLineHeight = maxGlyphY + maxGlyphDescent;

  const scale = label.totalScale;
  const horizontalOrigin = label._horizontalOrigin;
  const verticalOrigin = label._verticalOrigin;
  let lineIndex = 0;
  let lineWidth = lineWidths[lineIndex];
  let widthOffset = calculateWidthOffset(
    lineWidth,
    horizontalOrigin,
    backgroundPadding,
  );
  const lineSpacing =
    (defined(label._lineHeight)
      ? label._lineHeight
      : defaultLineSpacingPercent * label._fontSize) / label._relativeSize;
  const otherLinesHeight = lineSpacing * (numberOfLines - 1);
  let totalLineWidth = maxLineWidth;
  let totalLineHeight = maxLineHeight + otherLinesHeight;

  if (defined(backgroundBillboard)) {
    totalLineWidth += backgroundPadding.x * 2;
    totalLineHeight += backgroundPadding.y * 2;
    backgroundBillboard._labelHorizontalOrigin = horizontalOrigin;
  }

  glyphPixelOffset.x = widthOffset * scale;
  glyphPixelOffset.y = 0;

  let firstCharOfLine = true;

  let lineOffsetY = 0;
  for (let glyphIndex = 0; glyphIndex < glyphLength; ++glyphIndex) {
    if (text.charAt(glyphIndex) === "\n") {
      ++lineIndex;
      lineOffsetY += lineSpacing;
      lineWidth = lineWidths[lineIndex];
      widthOffset = calculateWidthOffset(
        lineWidth,
        horizontalOrigin,
        backgroundPadding,
      );
      glyphPixelOffset.x = widthOffset * scale;
      firstCharOfLine = true;
      continue;
    }

    const glyph = glyphs[glyphIndex];
    const dimensions = glyph.dimensions;
    if (defined(dimensions)) {
      if (verticalOrigin === VerticalOrigin.TOP) {
        glyphPixelOffset.y =
          dimensions.height - maxGlyphY - backgroundPadding.y;
        glyphPixelOffset.y += SDFSettings.PADDING;
      } else if (verticalOrigin === VerticalOrigin.CENTER) {
        glyphPixelOffset.y =
          (otherLinesHeight + dimensions.height - maxGlyphY) / 2;
      } else if (verticalOrigin === VerticalOrigin.BASELINE) {
        glyphPixelOffset.y = otherLinesHeight;
        glyphPixelOffset.y -= SDFSettings.PADDING;
      } else {
        // VerticalOrigin.BOTTOM
        glyphPixelOffset.y =
          otherLinesHeight + maxGlyphDescent + backgroundPadding.y;
        glyphPixelOffset.y -= SDFSettings.PADDING;
      }
      glyphPixelOffset.y =
        (glyphPixelOffset.y - dimensions.descent - lineOffsetY) * scale;

      // Handle any offsets for the first character of the line since the bounds might not be right on the bottom left pixel.
      if (firstCharOfLine) {
        glyphPixelOffset.x -= SDFSettings.PADDING * scale;
        firstCharOfLine = false;
      }

      if (defined(glyph.billboard)) {
        glyph.billboard._setTranslate(glyphPixelOffset);
        glyph.billboard._labelDimensions.x = totalLineWidth;
        glyph.billboard._labelDimensions.y = totalLineHeight;
        glyph.billboard._labelHorizontalOrigin = horizontalOrigin;
        if (isHeightReferenceClamp(label.heightReference)) {
          glyph.billboard._labelTranslate = Cartesian2.clone(
            glyphPixelOffset,
            glyph.billboard._labelTranslate,
          );
        }
      }

      //Compute the next x offset taking into account the kerning performed
      //on both the current letter as well as the next letter to be drawn
      //as well as any applied scale.
      if (glyphIndex < glyphLength - 1) {
        const nextGlyph = glyphs[glyphIndex + 1];
        glyphPixelOffset.x +=
          (dimensions.width - dimensions.minx + nextGlyph.dimensions.minx) *
          scale;
      }
    }
  }

  if (defined(backgroundBillboard) && text.split("\n").join("").length > 0) {
    if (horizontalOrigin === HorizontalOrigin.CENTER) {
      widthOffset = -maxLineWidth / 2 - backgroundPadding.x;
    } else if (horizontalOrigin === HorizontalOrigin.RIGHT) {
      widthOffset = -(maxLineWidth + backgroundPadding.x * 2);
    } else {
      widthOffset = 0;
    }
    glyphPixelOffset.x = widthOffset * scale;

    if (verticalOrigin === VerticalOrigin.TOP) {
      glyphPixelOffset.y = maxLineHeight - maxGlyphY - maxGlyphDescent;
    } else if (verticalOrigin === VerticalOrigin.CENTER) {
      glyphPixelOffset.y = (maxLineHeight - maxGlyphY) / 2 - maxGlyphDescent;
    } else if (verticalOrigin === VerticalOrigin.BASELINE) {
      glyphPixelOffset.y = -backgroundPadding.y - maxGlyphDescent;
    } else {
      // VerticalOrigin.BOTTOM
      glyphPixelOffset.y = 0;
    }
    glyphPixelOffset.y = glyphPixelOffset.y * scale;
    backgroundBillboard.width = totalLineWidth;
    backgroundBillboard.height = totalLineHeight;
    backgroundBillboard._setTranslate(glyphPixelOffset);
    backgroundBillboard._labelTranslate = Cartesian2.clone(
      glyphPixelOffset,
      backgroundBillboard._labelTranslate,
    );
  }
}

function destroyLabel(labelCollection, label) {
  const glyphs = label._glyphs;
  for (let i = 0, len = glyphs.length; i < len; ++i) {
    unbindGlyphBillboard(labelCollection, glyphs[i]);
  }
  if (defined(label._backgroundBillboard)) {
    labelCollection._backgroundBillboardCollection.remove(
      label._backgroundBillboard,
    );
    label._backgroundBillboard = undefined;
  }
  label._labelCollection = undefined;

  if (defined(label._removeCallbackFunc)) {
    label._removeCallbackFunc();
  }

  destroyObject(label);
}

/**
 * 可渲染的标签集合。标签是位于3D场景中的视口对齐文本。
 * 每个标签可以有不同的字体、颜色、缩放等设置。
 * <br /><br />
 * <div align='center'>
 * <img src='Images/Label.png' width='400' height='300' /><br />
 * 示例标签
 * </div>
 * <br /><br />
 * 使用 {@link LabelCollection#add} 和 {@link LabelCollection#remove} 向集合中添加和移除标签。
 * 具有以下属性：
 *
 * @alias LabelCollection
 * @constructor
 *
 * @param {object} [options] Object with the following properties:
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 将每个标签从模型坐标转换为世界坐标的4x4变换矩阵。
 * @param {boolean} [options.debugShowBoundingVolume=false] 仅用于调试。决定此基本体的命令边界球是否显示。
 * @param {Scene} [options.scene] 对于使用高度参考属性的标签，必须传入此值，否则将针对地球球体进行深度测试。
 * @param {BlendOption} [options.blendOption=BlendOption.OPAQUE_AND_TRANSLUCENT] 标签混合选项。默认值为
 * 用于渲染不透明和半透明标签。然而，如果所有标签完全不透明或完全半透明，
 * 将技术设置为 BlendOption.OPAQUE 或 BlendOption.TRANSLUCENT 可以将性能提高至2倍。
 * @param {boolean} [options.show=true] 决定集合中的标签是否显示。
 * @param {number} [options.coarseDepthTestDistance] 相机距离，超过该距离后，标签将针对地球球体椭球体的近似模型进行深度测试，而非完整的地球深度缓冲区。如果未指定，则默认值相对于 {@link Ellipsoid.default} 的值确定。
 * @param {number} [options.threePointDepthTestDistance] 相机距离，在此范围内，具有 {@link Label#heightReference} 值为 {@link HeightReference.CLAMP_TO_GROUND} 或 {@link HeightReference.CLAMP_TO_TERRAIN} 的标签将针对三个关键点进行深度测试。这确保如果标签的任何关键点可见，则整个标签也可见。如果未指定，则默认值相对于 {@link Ellipsoid.default} 的值确定。
 * @performance For 为了最佳性能，建议使用包含许多标签的少量集合。
 * 许多集合只有少数标签。避免创建某些标签每帧都会变化而其他标签不变化的集合；相反，应创建一个或多个集合用于静态标签，以及一个或多个集合用于动态标签。
 * // 创建一个包含两个标签的标签集合
 * for static labels, and one or more collections for dynamic labels.
 *
 * @see LabelCollection#add
 * @see LabelCollection#remove
 * @see Label
 * @see BillboardCollection
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=labels|Cesium Sandcastle Labels Demo}
 *
 * @example
 * // Create a label collection with two labels
 * const labels = scene.primitives.add(new Cesium.LabelCollection());
 * labels.add({
 * position : new Cesium.Cartesian3(1.0, 2.0, 3.0),
 * text : 'A label'
 * });
 * labels.add({
 * position : new Cesium.Cartesian3(4.0, 5.0, 6.0),
 * text : 'Another label'
 * });
 */
function LabelCollection(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  this._scene = options.scene;
  this._batchTable = options.batchTable;

  const backgroundBillboardCollection = new BillboardCollection({
    scene: this._scene,
    textureAtlas: new TextureAtlas({
      initialSize: whitePixelSize,
    }),
    coarseDepthTestDistance: options.coarseDepthTestDistance,
    threePointDepthTestDistance: options.threePointDepthTestDistance,
  });
  this._backgroundBillboardCollection = backgroundBillboardCollection;
  this._backgroundBillboardTexture = new BillboardTexture(
    backgroundBillboardCollection,
  );

  this._glyphBillboardCollection = new BillboardCollection({
    scene: this._scene,
    batchTable: this._batchTable,
    coarseDepthTestDistance: options.coarseDepthTestDistance,
    threePointDepthTestDistance: options.threePointDepthTestDistance,
  });
  this._glyphBillboardCollection._sdf = true;

  this._spareBillboards = [];
  this._textDimensionsCache = {};
  this._labels = [];
  this._labelsToUpdate = [];
  this._totalGlyphCount = 0;

  this._highlightColor = Color.clone(Color.WHITE); // Only used by Vector3DTilePoints

  /**
   * 确定此集合中的标签是否会被显示。
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  /**
   * 将此集合中的每个标签从模型坐标转换为世界坐标的 4x4 变换矩阵。
   * 当该矩阵为单位矩阵时，标签以世界坐标绘制，即地球的 WGS84 坐标。
   * 可以通过提供不同的变换矩阵来使用本地参考框架，例如 {@link Transforms.eastNorthUpToFixedFrame} 返回的矩阵。
   * const center = Cesium.Cartesian3.fromDegrees(-75.59777, 40.03883);
   *
   * @type Matrix4
   * @default {@link Matrix4.IDENTITY}
   *
   * @example
   * labels.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(center);
   * labels.add({
   * position : new Cesium.Cartesian3(0.0, 0.0, 0.0),
   * text     : 'Center'
   * labels.add({
   * });
   * position : new Cesium.Cartesian3(1000000.0, 0.0, 0.0),
   * text     : 'East'
   * labels.add({
   * });
   * position : new Cesium.Cartesian3(0.0, 1000000.0, 0.0),
   * text     : 'North'
   * labels.add({
   * });
   * position : new Cesium.Cartesian3(0.0, 0.0, 1000000.0),
   * text     : 'Up'
   * 此属性仅用于调试；不用于生产环境，也未经过优化。
   * });
   */
  this.modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);

  /**
   * 绘制primitive中每个绘制命令的边界球体。
   * <p>
   * 标签混合选项。默认设置用于渲染不透明和半透明标签。
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;

  /**
   * 如果所有标签完全不透明或完全半透明，则使用默认设置。将技术设置为 BlendOption.OPAQUE 或 BlendOption.TRANSLUCENT 可以提升性能高达 2 倍。
   * 然而，如果所有标签完全不透明或完全半透明，
   * 将技术设置为 BlendOption.OPAQUE 或 BlendOption.TRANSLUCENT 可以提高性能多达 2 倍。
   * 返回此集合中的标签数量。通常用于与
   * @type {BlendOption}
   * @default BlendOption.OPAQUE_AND_TRANSLUCENT
   */
  this.blendOption = options.blendOption ?? BlendOption.OPAQUE_AND_TRANSLUCENT;
}

Object.defineProperties(LabelCollection.prototype, {
  /**
   * {@link LabelCollection#get} 结合使用，以遍历集合中的所有标签。
   * 返回WebGL纹理资源的大小（字节）。
   * 当集合中所有标签都准备好渲染时，返回 true。
   * @memberof LabelCollection.prototype
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._labels.length;
    },
  },

  /**
   * 返回WebGL纹理资源的大小（字节）。
   * @private
   * @memberof LabelCollection.prototype
   * @type {number}
   * @readonly
   */
  sizeInBytes: {
    get: function () {
      return (
        this._glyphBillboardCollection.sizeInBytes +
        this._backgroundBillboardCollection.sizeInBytes
      );
    },
  },

  /**
   * True when all labels currently in the collection are ready for rendering.
   * @private
   * @memberof LabelCollection.prototype
   * @type {boolean}
   * @readonly
   */
  ready: {
    get: function () {
      const backgroundBillboard = this._backgroundBillboardCollection.get(0);
      if (defined(backgroundBillboard) && !backgroundBillboard.ready) {
        return false;
      }

      return this._glyphBillboardCollection.ready;
    },
  },

  /**
   * The distance from the camera, beyond which, labels are depth-tested against an approximation of
   * 使用椭球体而非完整地球深度缓冲区。当设置为 <code>0</code> 时，
   * 近似深度测试始终被应用。当设置为 <code>Number.POSITIVE_INFINITY</code> 时，
   * 近似深度测试永远不会被应用。
   * <br/><br/>
   * 此设置仅在标签的 {@link Label#disableDepthTestDistance} 值
   * 否则允许深度测试时适用——即，从相机到标签的距离小于
   * 标签的 {@link Label#disableDepthTestDistance} 值。
   * @memberof LabelCollection.prototype
   * @type {number}
   */
  coarseDepthTestDistance: {
    get: function () {
      return this._backgroundBillboardCollection.coarseDepthTestDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("coarseDepthTestDistance", value);
      //>>includeEnd('debug');
      this._backgroundBillboardCollection.coarseDepthTestDistance = value;
      this._glyphBillboardCollection.coarseDepthTestDistance = value;
    },
  },

  /**
   * 从相机到该距离范围内的标签，如果其 {@link Label#heightReference} 值为
   * {@link HeightReference.CLAMP_TO_GROUND} 或 {@link HeightReference.CLAMP_TO_TERRAIN}，则根据三个关键点进行深度测试。这确保了如果标签的任何关键点可见，整个
   * against three key points. This ensures that if any key point of the label is visible, the whole
   * 标签都将可见。当设置为 <code>0</code> 时，此功能被禁用，位于地形后面的标签部分将被裁剪。
   * 此设置仅在标签的 {@link Label#disableDepthTestDistance} 值
   * <br/><br/>
   * 否则允许深度测试时适用——即，从相机到标签的距离小于
   * 标签的 {@link Label#disableDepthTestDistance} 值。
   * 创建并添加具有指定初始属性的标签到集合中。
   * @see {@link https://cesium.com/blog/2018/07/30/billboards-on-terrain-improvements/|Billboards and Labels on Terrain Improvements}
   * @memberof LabelCollection.prototype
   * @type {number}
   */
  threePointDepthTestDistance: {
    get: function () {
      return this._backgroundBillboardCollection.threePointDepthTestDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("threePointDepthTestDistance", value);
      //>>includeEnd('debug');
      this._backgroundBillboardCollection.threePointDepthTestDistance = value;
      this._glyphBillboardCollection.threePointDepthTestDistance = value;
    },
  },
});

/**
 * 将具有指定初始属性的标签添加到集合中。
 * 添加的标签会被返回，以便之后可以在集合中修改或移除。
 *
 * @param {Label.ConstructorOptions} [options] 描述标签属性的模板，如示例 1 所示。
 * @returns {Label} The 被添加到集合中的标签。
 *
 * @performance Calling <code>add</code> 操作预期为常数时间。然而，集合的顶点缓冲区
 * 会被重写；此操作为 <code>O(n)</code>，并且还会产生
 * CPU 到 GPU 开销。为了获得最佳性能，在调用 <code>update</code> 之前尽可能多地添加广告牌。
 * 对象被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This // 示例 1：添加标签，指定所有默认值。
 *
 * @example
 * // 示例 1：添加标签，指定所有默认值。 const l = labels.add({
 * const l = labels.add({
 * show : true,
 * position : Cesium.Cartesian3.ZERO,
 * text : '',
 * font : '30px sans-serif',
 * fillColor : Cesium.Color.WHITE,
 * outlineColor : Cesium.Color.BLACK,
 * outlineWidth : 1.0,
 * showBackground : false,
 * backgroundColor : new Cesium.Color(0.165, 0.165, 0.165, 0.8),
 * backgroundPadding : new Cesium.Cartesian2(7, 5),
 * style : Cesium.LabelStyle.FILL,
 * pixelOffset : Cesium.Cartesian2.ZERO,
 * eyeOffset : Cesium.Cartesian3.ZERO,
 * horizontalOrigin : Cesium.HorizontalOrigin.LEFT,
 * verticalOrigin : Cesium.VerticalOrigin.BASELINE,
 * scale : 1.0,
 * translucencyByDistance : undefined,
 * pixelOffsetScaleByDistance : undefined,
 * heightReference : HeightReference.NONE,
 * distanceDisplayCondition : undefined
 * });
 *
 * @example
 * // 示例 2：仅指定标签的地图位置、文本和字体。
 * const l = labels.add({
 * const l = labels.add({
 * position : Cesium.Cartesian3.fromRadians(longitude, latitude, height),
 * text : 'Hello World',
 * font : '24px Helvetica',
 * });
 *
 *
 * @see LabelCollection#remove
 * @see LabelCollection#removeAll
 */
LabelCollection.prototype.add = function (options) {
  const label = new Label(options, this);

  this._labels.push(label);
  this._labelsToUpdate.push(label);

  return label;
};

/**
 * 从集合中移除一个标签。一旦移除，该标签将无法再次使用。
 *
 * @param {Label} label 要移除的标签。
 * @returns {boolean} <code>true</code> 如果标签被移除；如果标签不在集合中，则返回 <code>false</code>。
 *
 * @performance Calling <code>remove</code> 操作预期为常数时间。然而，集合的顶点缓冲区
 * 会被重新写入——这是一个 <code>O(n)</code> 操作，还会产生 CPU 到 GPU 的开销。为了获得最佳性能，在调用 <code>update</code> 之前应移除尽可能多的标签。
 * 如果你打算暂时隐藏一个标签，通常更高效的做法是调用
 * {@link Label#show} 而不是移除并重新添加该标签。
 * 对象被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This const l = labels.add(...);
 *
 *
 * @example
 * labels.remove(l);  // 返回 true
 * 从集合中移除所有标签。
 *
 * @see LabelCollection#add
 * @see LabelCollection#removeAll
 * @see Label#show
 */
LabelCollection.prototype.remove = function (label) {
  if (defined(label) && label._labelCollection === this) {
    const index = this._labels.indexOf(label);
    if (index !== -1) {
      this._labels.splice(index, 1);
      destroyLabel(this, label);
      return true;
    }
  }
  return false;
};

/**
 * 从集合中移除所有标签更为高效。
 *
 * @performance <code>O(n)</code>.  与其完全创建新的集合，不如先移除所有标签然后添加新标签。
 * 对象被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This labels.add(...);
 *
 *
 * @example
 * labels.add(...);
 * labels.add(...);
 * labels.removeAll();
 *
 * @see LabelCollection#add
 * @see LabelCollection#remove
 */
LabelCollection.prototype.removeAll = function () {
  const labels = this._labels;

  for (let i = 0, len = labels.length; i < len; ++i) {
    destroyLabel(this, labels[i]);
  }

  labels.length = 0;
};

/**
 * 检查该集合是否包含指定的标签。
 *
 * @param {Label} label 要检查的标签。
 * @returns {boolean} true 如果集合中包含该标签，返回 false；否则返回 true。
 *
 * @see LabelCollection#get
 *
 */
LabelCollection.prototype.contains = function (label) {
  return defined(label) && label._labelCollection === this;
};

/**
 * 返回集合中指定索引的标签。索引从零开始
 * 并且随着标签的添加而增加。移除一个标签会将所有该标签之后的标签左移一位，从而改变它们的索引。此函数通常与
 * {@link LabelCollection#length} 一起使用，以遍历集合中的所有标签。
 * 广告牌的零基索引。
 * 指定索引处的标签。
 *
 * @param {number} index 常数时间操作。如果标签从集合中移除且
 *
 * @returns {Label} The 未调用 {@link Scene#render}，则执行一个隐式的 <code>O(n)</code> 操作。
 *
 * @performance Expected 对象被销毁，即调用了 destroy()。
 * // 切换集合中每个标签的 show 属性
 * const len = labels.length;
 *
 * @exception {DeveloperError} This for (let i = 0; i < len; ++i) {
 *
 *
 * @example
 * // Toggle the show property of every label in the collection
 * const len = labels.length;
 * for (let i = 0; i < len; ++i) {
 * const l = billboards.get(i);
 * l.show = !l.show;
 * }
 *
 * @see LabelCollection#length
 */
LabelCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index)) {
    throw new DeveloperError("index is required.");
  }
  //>>includeEnd('debug');

  return this._labels[index];
};

/**
 * @private
 */
LabelCollection.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  const glyphBillboardCollection = this._glyphBillboardCollection;
  const backgroundBillboardCollection = this._backgroundBillboardCollection;

  glyphBillboardCollection.modelMatrix = this.modelMatrix;
  glyphBillboardCollection.debugShowBoundingVolume =
    this.debugShowBoundingVolume;
  backgroundBillboardCollection.modelMatrix = this.modelMatrix;
  backgroundBillboardCollection.debugShowBoundingVolume =
    this.debugShowBoundingVolume;

  const len = this._labelsToUpdate.length;
  for (let i = 0; i < len; ++i) {
    const label = this._labelsToUpdate[i];
    if (label.isDestroyed()) {
      continue;
    }

    const preUpdateGlyphCount = label._glyphs.length;

    if (label._rebindAllGlyphs) {
      rebindAllGlyphs(this, label);
      label._rebindAllGlyphs = false;
    }

    if (label._repositionAllGlyphs) {
      repositionAllGlyphs(label);
      label._repositionAllGlyphs = false;
    }

    const glyphCountDifference = label._glyphs.length - preUpdateGlyphCount;
    this._totalGlyphCount += glyphCountDifference;
  }

  const blendOption =
    backgroundBillboardCollection.length > 0
      ? BlendOption.TRANSLUCENT
      : this.blendOption;
  glyphBillboardCollection.blendOption = blendOption;
  backgroundBillboardCollection.blendOption = blendOption;

  glyphBillboardCollection._highlightColor = this._highlightColor;
  backgroundBillboardCollection._highlightColor = this._highlightColor;

  this._labelsToUpdate.length = 0;
  backgroundBillboardCollection.update(frameState);
  glyphBillboardCollection.update(frameState);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} True 如果此对象被销毁，则不应使用它；否则返回 false。
 *
 * @see LabelCollection#destroy
 */
LabelCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 会释放此对象所持有的 WebGL 资源。释放对象可以使得 WebGL 资源被确定性地释放，而无需依赖垃圾收集器来销毁此对象。
 * 一旦对象被销毁，就不应再使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * 表明对象已被销毁，即调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This labels = labels && labels.destroy();
 *
 *
 * @example
 * labels = labels && labels.destroy();
 *
 * @see LabelCollection#isDestroyed
 */
LabelCollection.prototype.destroy = function () {
  this.removeAll();
  this._glyphBillboardCollection = this._glyphBillboardCollection.destroy();
  this._backgroundBillboardCollection =
    this._backgroundBillboardCollection.destroy();

  return destroyObject(this);
};
export default LabelCollection;
