import { Color, JulianDate, Math as CesiumMath, defined } from "@cesium/core";

/**
 * 一个位于 {@link Cesium3DTileset} 中的热图着色器。一个瓦片集可以以其可见的瓦片以热图风格进行着色。
 *
 * @alias Cesium3DTilesetHeatmap
 * @constructor
 * @private
 */
function Cesium3DTilesetHeatmap(tilePropertyName) {
  /**
   * 用于热图着色化的瓦片变量。
   * 该瓦片的着色效果将依据该变量与其他可见瓦片的值来决定。
   *
   * @type {string}
   */
  this.tilePropertyName = tilePropertyName;

  // Members that are updated every time a tile is colorized
  this._minimum = Number.MAX_VALUE;
  this._maximum = -Number.MAX_VALUE;

  // Members that are updated once every frame
  this._previousMinimum = Number.MAX_VALUE;
  this._previousMaximum = -Number.MAX_VALUE;

  // If defined uses a reference minimum maximum to colorize by instead of using last frames minimum maximum of rendered tiles.
  // For example, the _loadTimestamp can get a better colorization using setReferenceMinimumMaximum in order to take accurate colored timing diffs of various scenes.
  this._referenceMinimum = {};
  this._referenceMaximum = {};
}

/**
 * 转换为可用的热图数值（即数字）。确保那些未以数字形式存储的瓦片数值也能被用于着色。
 * @private
 */
function getHeatmapValue(tileValue, tilePropertyName) {
  let value;
  if (tilePropertyName === "_loadTimestamp") {
    value = JulianDate.toDate(tileValue).getTime();
  } else {
    value = tileValue;
  }
  return value;
}

/**
 * 设置该变量名称的参考最小值和最大值。在存储之前会被转换为数字。
 *
 * @param {object} minimum 最小的参考值。
 * @param {object} maximum 最大的参考值。
 * @param {string} tilePropertyName 在热图着色过程中将使用这些参考值的瓦片变量。
 */
Cesium3DTilesetHeatmap.prototype.setReferenceMinimumMaximum = function (
  minimum,
  maximum,
  tilePropertyName,
) {
  this._referenceMinimum[tilePropertyName] = getHeatmapValue(
    minimum,
    tilePropertyName,
  );
  this._referenceMaximum[tilePropertyName] = getHeatmapValue(
    maximum,
    tilePropertyName,
  );
};

function getHeatmapValueAndUpdateMinimumMaximum(heatmap, tile) {
  const tilePropertyName = heatmap.tilePropertyName;
  if (defined(tilePropertyName)) {
    const heatmapValue = getHeatmapValue(
      tile[tilePropertyName],
      tilePropertyName,
    );
    if (!defined(heatmapValue)) {
      heatmap.tilePropertyName = undefined;
      return heatmapValue;
    }
    heatmap._maximum = Math.max(heatmapValue, heatmap._maximum);
    heatmap._minimum = Math.min(heatmapValue, heatmap._minimum);
    return heatmapValue;
  }
}

const heatmapColors = [
  new Color(0.1, 0.1, 0.1, 1), // Dark Gray
  new Color(0.153, 0.278, 0.878, 1), // Blue
  new Color(0.827, 0.231, 0.49, 1), // Pink
  new Color(0.827, 0.188, 0.22, 1), // Red
  new Color(1.0, 0.592, 0.259, 1), // Orange
  new Color(1.0, 0.843, 0.0, 1),
]; // Yellow
/**
 * 根据瓦片在最小最大值窗口内的位置，以热图风格进行着色。
 * 热图颜色包括黑色、蓝色、粉色、红色、橙色和黄色。较小的“冷”数值为黑色和蓝色，较大的“热”数值为橙色和黄色。
 * @param {Cesium3DTile} tile 用于着色的瓦片取决于上一帧所有可见瓦片的最小和最大值。
 * @param {FrameState} frameState 帧状态。
 */
Cesium3DTilesetHeatmap.prototype.colorize = function (tile, frameState) {
  const tilePropertyName = this.tilePropertyName;
  if (
    !defined(tilePropertyName) ||
    !tile.contentAvailable ||
    tile._selectedFrame !== frameState.frameNumber
  ) {
    return;
  }

  const heatmapValue = getHeatmapValueAndUpdateMinimumMaximum(this, tile);
  const minimum = this._previousMinimum;
  const maximum = this._previousMaximum;

  if (minimum === Number.MAX_VALUE || maximum === -Number.MAX_VALUE) {
    return;
  }

  // Shift the minimum maximum window down to 0
  const shiftedMax = maximum - minimum + CesiumMath.EPSILON7; // Prevent divide by 0
  const shiftedValue = CesiumMath.clamp(
    heatmapValue - minimum,
    0.0,
    shiftedMax,
  );

  // Get position between minimum and maximum and convert that to a position in the color array
  const zeroToOne = shiftedValue / shiftedMax;
  const lastIndex = heatmapColors.length - 1.0;
  const colorPosition = zeroToOne * lastIndex;

  // Take floor and ceil of the value to get the two colors to lerp between, lerp using the fractional portion
  const colorPositionFloor = Math.floor(colorPosition);
  const colorPositionCeil = Math.ceil(colorPosition);
  const t = colorPosition - colorPositionFloor;
  const colorZero = heatmapColors[colorPositionFloor];
  const colorOne = heatmapColors[colorPositionCeil];

  // Perform the lerp
  const finalColor = Color.clone(Color.WHITE);
  finalColor.red = CesiumMath.lerp(colorZero.red, colorOne.red, t);
  finalColor.green = CesiumMath.lerp(colorZero.green, colorOne.green, t);
  finalColor.blue = CesiumMath.lerp(colorZero.blue, colorOne.blue, t);
  tile._debugColor = finalColor;
};

/**
 * 重置用于热图着色化的跟踪最小值和最大值。在瓦片集遍历之前发生。
 */
Cesium3DTilesetHeatmap.prototype.resetMinimumMaximum = function () {
  // For heat map colorization
  const tilePropertyName = this.tilePropertyName;
  if (defined(tilePropertyName)) {
    const referenceMinimum = this._referenceMinimum[tilePropertyName];
    const referenceMaximum = this._referenceMaximum[tilePropertyName];
    const useReference = defined(referenceMinimum) && defined(referenceMaximum);
    this._previousMinimum = useReference ? referenceMinimum : this._minimum;
    this._previousMaximum = useReference ? referenceMaximum : this._maximum;
    this._minimum = Number.MAX_VALUE;
    this._maximum = -Number.MAX_VALUE;
  }
};
export default Cesium3DTilesetHeatmap;
