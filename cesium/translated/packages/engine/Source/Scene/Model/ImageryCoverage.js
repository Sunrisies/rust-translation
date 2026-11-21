import { Rectangle, defined } from "@cesium/core";
import CartesianRectangle from "./CartesianRectangle.js";

const imageryBoundsScratch = new Rectangle();
const overlappedRectangleScratch = new Rectangle();
const clippedRectangleScratch = new Rectangle();
const nativeInputRectangleScratch = new Rectangle();
const nativeImageryBoundsScratch = new Rectangle();
const nativeClippedImageryBoundsScratch = new Rectangle();

/**
 * 包含有关影像信息的类。
 *
 * 这代表计算被给定 <code>Rectangle</code> 覆盖的影像瓦片的结果（即纹理坐标上被该矩形覆盖的部分）。
 * 此类表示一个纯结构，没有成员函数。
 * 实例通过 <code>createImageryCoverages</code> 函数创建。
 *
 * 实例由 <code>ModelPrimitiveImagery</code> 使用，以表示被原始位置的地图边界矩形覆盖的影像瓦片。
 * ImageryCoverage 的实现说明：
 * 此类中的一些静态函数从 <code>ImageryLayer.prototype._createTileImagerySkeletons</code> 中提取而来。
 *
 * 实例由 <code>ModelPrimitiveImagery</code> 使用，以表示被地图边界矩形覆盖的影像瓦片。
 * 该原始位置的地图边界矩形决定了被覆盖的影像瓦片。
 * 此类的实例大致对应于那里创建的 <code>TileImagery</code>。
 *
 * 创建新实例。
 *
 * 影像瓦片的 x 坐标
 * 影像瓦片的 y 坐标
 * 影像瓦片的层级
 * 纹理坐标
 * 被覆盖的影像瓦片中的矩形
 *
 * @private
 */
class ImageryCoverage {
  /**
   * 影像
   *
   * @param {number} x 影像瓦片的 x 坐标，通常与经度相关
   * @param {number} y 影像瓦片的 y 坐标，通常与纬度相关
   * @param {number} level 影像瓦片的层级
   * @param {CartesianRectangle} textureCoordinateRectangle 纹理坐标范围
   * 从影像瓦片中被覆盖的纹理坐标
   * @param {Imagery} imagery 影像图层
   */
  constructor(x, y, level, textureCoordinateRectangle, imagery) {
    this._x = x;
    this._y = y;
    this._level = level;
    this._textureCoordinateRectangle = textureCoordinateRectangle;
    this._imagery = imagery;
  }

  /**
   * 影像瓦片的 x 坐标，通常与经度相关
   *
   * @type {number}
   * @readonly
   */
  get x() {
    return this._x;
  }

  /**
   * 影像瓦片的 y 坐标，通常与纬度相关
   *
   * @type {number}
   * @readonly
   */
  get y() {
    return this._y;
  }

  /**
   * 影像瓦片的层级
   *
   * @type {number}
   * @readonly
   */
  get level() {
    return this._level;
  }

  /**
   * 从影像瓦片中被覆盖的纹理坐标范围
   * 这是一个包含 (minU, minV, maxU, maxV) 坐标范围的 <code>CartesianRectangle</code>。
   *
   * 客户端不得修改返回的实例。
   * 返回影像信息
   *
   * 计算描述影像瓦片及其被给定输入矩形覆盖的纹理坐标的 <code>ImageryCoverage</code> 对象。
   *
   * @type {CartesianRectangle}
   * @readonly
   */
  get textureCoordinateRectangle() {
    return this._textureCoordinateRectangle;
  }

  /**
   * 如果必要，给定的影像层级将被限制在给定影像图层的影像提供商的合法范围内。
   *
   * @type {Imagery}
   * @readonly
   */
  get imagery() {
    return this._imagery;
  }

  /**
   * 输入矩形（例如瓦片边界）
   * 影像图层
   * 应计算影像覆盖层级。
   *
   * 如果必要，给定的影像层级将被限制在给定影像提供商的合法范围内。
   * range for the imagery provider of the given imagery layer.
   *
   * @param {Rectangle} inputRectangle The input rectangle (e.g. tile bounds)
   * @param {ImageryLayer} imageryLayer The imagery layer
   * @param {number} inputImageryLevel The level for which the imagery coverage
   * should be computed.
   * @returns {ImageryCoverage[]} The objects describing the covered imagery
   * and the respective texture coordinates
   */
  static createImageryCoverages(
    inputRectangle,
    imageryLayer,
    inputImageryLevel,
  ) {
    if (!imageryLayer.show) {
      return [];
    }

    const imageryProvider = imageryLayer.imageryProvider;
    const imageryLevel = ImageryCoverage._clampImageryLevel(
      imageryProvider,
      inputImageryLevel,
    );

    // Compute the range, in integer coordinates, of imagery
    // tiles that are covered by the input rectangle
    const imageryBounds = Rectangle.intersection(
      imageryProvider.rectangle,
      imageryLayer.rectangle,
      imageryBoundsScratch,
    );
    const imageryTilingScheme = imageryProvider.tilingScheme;
    const imageryRange = ImageryCoverage._computeImageryRange(
      inputRectangle,
      imageryBounds,
      imageryTilingScheme,
      imageryLevel,
    );

    // Convert the input rectangle and the imagery bounds into
    // the native coordinate system of the tiling scheme
    const nativeInputRectangle = nativeInputRectangleScratch;
    imageryTilingScheme.rectangleToNativeRectangle(
      inputRectangle,
      nativeInputRectangle,
    );
    const nativeImageryBounds = nativeImageryBoundsScratch;
    imageryTilingScheme.rectangleToNativeRectangle(
      imageryBounds,
      nativeImageryBounds,
    );

    // A function that returns an imagery rectangle, based on (x, y, level),
    // clipped to the imagery bounds (or undefined if there is no intersection
    // between the imagery rectangle and the bounds)
    const computeClippedImageryRectangle = (x, y, level) => {
      const localImageryRectangle = imageryTilingScheme.tileXYToRectangle(
        x,
        y,
        level,
      );
      const localClippedImageryRectangle = Rectangle.intersection(
        localImageryRectangle,
        imageryBounds,
        clippedRectangleScratch,
      );
      if (!defined(localClippedImageryRectangle)) {
        return undefined;
      }
      const nativeClippedImageryBounds = nativeClippedImageryBoundsScratch;
      imageryTilingScheme.rectangleToNativeRectangle(
        localClippedImageryRectangle,
        nativeClippedImageryBounds,
      );
      return nativeClippedImageryBounds;
    };

    const imageryCoverages = ImageryCoverage._computeImageryCoverages(
      imageryLayer,
      imageryRange,
      imageryLevel,
      nativeInputRectangle,
      computeClippedImageryRectangle,
    );
    return imageryCoverages;
  }

  /**
   * Validate the given imagery level against the constraints of the
   * given imagery provider.
   *
   * This will clamp the given level to be in the range
   * <code>[minimumLevel, maximumLevel)</code> 指的是
   * 由指定的影像提供器定义（并裁剪掉
   * 输入中可能存在的任何小数部分）
   *
   * @param {ImageryProvider} imageryProvider 影像提供器
   * @param {number} imageryLevel 影像层级
   * @returns {number} The 有效层级
   */
  static _clampImageryLevel(imageryProvider, imageryLevel) {
    const minimumLevel = imageryProvider.minimumLevel ?? 0;
    const maximumLevel =
      imageryProvider.maximumLevel ?? Number.POSITIVE_INFINITY;
    const clampedImageryLevel = Math.min(
      maximumLevel - 1,
      Math.max(minimumLevel, imageryLevel),
    );
    const validImageryLevel = Math.floor(clampedImageryLevel);
    return validImageryLevel;
  }

  /**
   * 计算描述被覆盖影像范围的矩形
   * 与给定矩形相对应。
   *
   * 这将计算出一个具有整数坐标的矩形，用于描述
   * 被给定输入矩形覆盖的影像的 X/Y 坐标，基于给定的影像矩形。
   * 从 _createTileImagerySkeletons 中提取。
   *
   * 输入矩形
   *
   * @param {Rectangle} inputRectangle 输入矩形
   * @param {Rectangle} imageryBounds 影像边界
   * @param {TilingScheme} imageryTilingScheme 分块方案
   * @param {number} imageryLevel 影像层级
   * @returns {CartesianRectangle} The 矩形
   */
  static _computeImageryRange(
    inputRectangle,
    imageryBounds,
    imageryTilingScheme,
    imageryLevel,
  ) {
    const overlappedRectangle = ImageryCoverage._computeOverlappedRectangle(
      inputRectangle,
      imageryBounds,
    );
    const northwestTileCoordinates = imageryTilingScheme.positionToTileXY(
      Rectangle.northwest(overlappedRectangle),
      imageryLevel,
    );
    const southeastTileCoordinates = imageryTilingScheme.positionToTileXY(
      Rectangle.southeast(overlappedRectangle),
      imageryLevel,
    );

    const result = new CartesianRectangle();
    result.minX = northwestTileCoordinates.x;
    result.minY = northwestTileCoordinates.y;
    result.maxX = southeastTileCoordinates.x;
    result.maxY = southeastTileCoordinates.y;

    // As extracted from _createTileImagerySkeletons:
    // If the southeast corner of the rectangle lies very close to the north or west side
    // of the southeast tile, we don't actually need the southernmost or easternmost
    // tiles.
    // Similarly, if the northwest corner of the rectangle lies very close to the south or east side
    // of the northwest tile, we don't actually need the northernmost or westernmost tiles.
    // We define "very close" as being within 1/512 of the width of the tile.
    const veryCloseX = inputRectangle.width / 512.0;
    const veryCloseY = inputRectangle.height / 512.0;

    const northwestTileRectangle = imageryTilingScheme.tileXYToRectangle(
      result.minX,
      result.minY,
      imageryLevel,
    );
    const deltaNorth = Math.abs(
      northwestTileRectangle.south - inputRectangle.north,
    );
    if (deltaNorth < veryCloseY && result.minY < result.maxY) {
      ++result.minY;
    }
    const deltaWest = Math.abs(
      northwestTileRectangle.east - inputRectangle.west,
    );
    if (deltaWest < veryCloseX && result.minX < result.maxX) {
      ++result.minX;
    }

    const southeastTileRectangle = imageryTilingScheme.tileXYToRectangle(
      result.maxX,
      result.maxY,
      imageryLevel,
    );
    const deltaSouth = Math.abs(
      southeastTileRectangle.north - inputRectangle.south,
    );
    if (deltaSouth < veryCloseY && result.maxY > result.minY) {
      --result.maxY;
    }
    const deltaEast = Math.abs(
      southeastTileRectangle.west - inputRectangle.east,
    );
    if (deltaEast < veryCloseX && result.maxX > result.minX) {
      --result.maxX;
    }

    return result;
  }

  /**
   * 将给定输入矩形限制在给定限制矩形内。
   *
   * 如果输入矩形完全位于限制矩形的上方/下方或左侧/右侧，
   * 则将在结果中使用北/南或东/西方向。
   * 如果限制矩形将在结果中使用。
   *
   * @param {Rectangle} input 输入矩形
   * @param {Rectangle} clamp 限制矩形
   * @param {Rectangle} [result] 结果
   * @returns {Rectangle} The 结果
   */
  static _clampRectangle(input, clamp, result) {
    if (!defined(result)) {
      result = new Rectangle();
    }
    if (input.south >= clamp.north) {
      result.north = result.south = clamp.north;
    } else if (input.north <= clamp.south) {
      result.north = result.south = clamp.south;
    } else {
      result.south = Math.max(input.south, clamp.south);
      result.north = Math.min(input.north, clamp.north);
    }

    if (input.west >= clamp.east) {
      result.west = result.east = clamp.east;
    } else if (input.east <= clamp.west) {
      result.west = result.east = clamp.west;
    } else {
      result.west = Math.max(input.west, clamp.west);
      result.east = Math.min(input.east, clamp.east);
    }
    return result;
  }

  /**
   * 计算给定输入矩形与从影像提供器获得的边界之间的重叠。
   * 边界
   *
   * @param {Rectangle} inputRectangle 输入
   * @param {Rectangle} imageryBounds 影像边界
   * @returns {Rectangle} The 矩形
   */
  static _computeOverlappedRectangle(inputRectangle, imageryBounds) {
    const overlappedRectangle = Rectangle.intersection(
      inputRectangle,
      imageryBounds,
      overlappedRectangleScratch,
    );
    if (defined(overlappedRectangle)) {
      return overlappedRectangle;
    }
    return ImageryCoverage._clampRectangle(
      inputRectangle,
      imageryBounds,
      overlappedRectangleScratch,
    );
  }

  /**
   * 计算描述影像的 <code>ImageryCoverage</code> 对象以及
   * 包含在给定影像块坐标范围内的纹理坐标，参考给定的输入矩形。
   * 影像层
   *
   * @param {ImageryLayer} imageryLayer 影像块坐标范围
   * @param {CartesianRectangle} imageryRange 影像层级
   * @param {number} imageryLevel 影像层级
   * @param {Rectangle} nativeInputRectangle 输入矩形，以分块方案中的坐标表示
   * 一个返回
   * @param {Function} computeClippedImageryRectangle 基于 (x, y, level) 的影像矩形，并限制在影像边界内
   * （如果影像矩形与边界没有交集则返回 undefined）
   * 描述被覆盖影像的对象及其相应的纹理坐标的函数
   * 计算第一个矩形相对于第二个矩形的坐标。
   * @returns {ImageryCoverage[]} The 结果将描述第一个矩形的边界
   * 以相对于第二个矩形的 (south,west) 和
   */
  static _computeImageryCoverages(
    imageryLayer,
    imageryRange,
    imageryLevel,
    nativeInputRectangle,
    computeClippedImageryRectangle,
  ) {
    const imageryCoverages = [];

    for (let i = imageryRange.minX; i <= imageryRange.maxX; i++) {
      const clippedImageryRectangleU = computeClippedImageryRectangle(
        i,
        imageryRange.maxY,
        imageryLevel,
      );

      if (!defined(clippedImageryRectangleU)) {
        continue;
      }

      for (let j = imageryRange.minY; j <= imageryRange.maxY; j++) {
        const clippedImageryRectangleV = computeClippedImageryRectangle(
          i,
          j,
          imageryLevel,
        );

        if (!defined(clippedImageryRectangleV)) {
          continue;
        }

        const textureCoordinateRectangle =
          ImageryCoverage._localizeToCartesianRectangle(
            clippedImageryRectangleV,
            nativeInputRectangle,
            undefined,
          );

        // Note: The getImageryFromCache function will create the whole "chain"
        // of ancestor imageries, up to the root, and increases the reference
        // counter for each of them, even though it is not called
        // getImageryFromCacheAndCreateAllAncestorsAndAddReferences.
        // There is currently no way to have a single imagery, because
        // somewhere in TileImagery, the parent is assumed to be present.
        const imagery = imageryLayer.getImageryFromCache(i, j, imageryLevel);
        const imageryCoverage = new ImageryCoverage(
          i,
          j,
          imageryLevel,
          textureCoordinateRectangle,
          imagery,
        );
        imageryCoverages.push(imageryCoverage);
      }
    }
    return imageryCoverages;
  }

  /**
   * （width, height）坐标表示。这适用于描述第一个
   * 矩形在第二个矩形内的纹理坐标。
   *
   * 结果将存储在给定的结果参数中，或者
   * 如果结果未定义，则生成一个新的矩形。
   * 第一个矩形
   * 第二个矩形
   * 结果
   *
   * 结果将存储在给定的结果参数中，或者
   * 如果结果未定义，则生成一个新的矩形。
   *
   * @param {Rectangle} rectangleA 第一个矩形
   * @param {Rectangle} rectangleB 第二个矩形
   * @param {CartesianRectangle} [result] 结果
   * @returns {CartesianRectangle} The 结果
   */
  static _localizeToCartesianRectangle(rectangleA, rectangleB, result) {
    if (!defined(result)) {
      result = new CartesianRectangle();
    }
    const invX = 1.0 / rectangleB.width;
    const invY = 1.0 / rectangleB.height;
    result.minX = (rectangleA.west - rectangleB.west) * invX;
    result.minY = (rectangleA.south - rectangleB.south) * invY;
    result.maxX = (rectangleA.east - rectangleB.west) * invX;
    result.maxY = (rectangleA.north - rectangleB.south) * invY;
    return result;
  }
}

export default ImageryCoverage;
