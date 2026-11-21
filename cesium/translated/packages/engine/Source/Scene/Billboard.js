import {
  BoundingRectangle,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Cartographic,
  Check,
  Color,
  DeveloperError,
  DistanceDisplayCondition,
  Ellipsoid,
  Frozen,
  Matrix4,
  NearFarScalar,
  createGuid,
  defined,
  getExtensionFromUri,
} from "@cesium/core";
import Resource from "../Core/Resource.js";
import BillboardTexture from "./BillboardTexture.js";
import HeightReference, {
  isHeightReferenceRelative,
} from "./HeightReference.js";
import HorizontalOrigin from "./HorizontalOrigin.js";
import SceneMode from "./SceneMode.js";
import SceneTransforms from "./SceneTransforms.js";
import VerticalOrigin from "./VerticalOrigin.js";
import SplitDirection from "./SplitDirection.js";
import isDataUri from "../Core/isDataUri.js";

/**
 * @typedef {object} Billboard.ConstructorOptions
 *
 * Billboard构造函数第一个参数的初始化选项
 *
 * @property {Cartesian3} position Billboard的笛卡尔坐标位置。
 * @property {*} [id] 当通过 {@link Scene#pick}选中Billboard时返回的自定义对象。
 * @property {boolean} [show=true] 决定此Billboard是否会被显示。
 * @property {string | HTMLImageElement | HTMLCanvasElement} [image] 用于Billboard的加载HTMLImageElement、ImageData或图片URL。
 * @property {number} [scale=1.0] 指定与Billboard像素图像大小相乘的统一缩放比例的数字。
 * @property {Cartesian2} [pixelOffset=Cartesian2.ZERO] 指定从Billboard原点开始在屏幕空间中的像素偏移量的 {@link Cartesian2}。
 * @property {Cartesian3} [eyeOffset=Cartesian3.ZERO] 指定在眼睛坐标中应用于此Billboard的3D笛卡尔偏移量的 {@link Cartesian3}。
 * @property {HorizontalOrigin} [horizontalOrigin=HorizontalOrigin.CENTER] 指定此Billboard的水平原点值的 {@link HorizontalOrigin}。
 * @property {VerticalOrigin} [verticalOrigin=VerticalOrigin.CENTER] 指定此Billboard的垂直原点值的 {@link VerticalOrigin}。
 * @property {HeightReference} [heightReference=HeightReference.NONE] 指定此Billboard的高度参考值的 {@link HeightReference}。
 * @property {Color} [color=Color.WHITE] 指定与Billboard纹理相乘的颜色的 {@link Color}。
 * @property {number} [rotation=0] 指定以弧度表示的旋转角度的数字。
 * @property {Cartesian3} [alignedAxis=Cartesian3.ZERO] 指定世界空间中对齐轴的 {@link Cartesian3}。
 * @property {boolean} [sizeInMeters] 指定Billboard大小是以米还是像素为单位的布尔值。
 * @property {number} [width] 指定Billboard的宽度数字。如果未定义，则使用图像宽度。
 * @property {number} [height] 指定Billboard的高度数字。如果未定义，则使用图像高度。
 * @property {NearFarScalar} [scaleByDistance] 指定基于Billboard与相机距离的Billboard近远缩放属性的 {@link NearFarScalar}。
 * @property {NearFarScalar} [translucencyByDistance] 指定基于Billboard与相机距离的Billboard近远半透明属性的 {@link NearFarScalar}。
 * @property {NearFarScalar} [pixelOffsetScaleByDistance] 指定基于Billboard与相机距离的Billboard近远像素偏移缩放属性的 {@link NearFarScalar}。
 * @property {BoundingRectangle} [imageSubRegion] 指定用于Billboard的图像子区域而非整个图像的 {@link BoundingRectangle}。
 * @property {DistanceDisplayCondition} [distanceDisplayCondition] 指定此Billboard在距相机多少距离时显示的距离的 {@link DistanceDisplayCondition}。
 * @property {number} [disableDepthTestDistance] 距相机的距离，超过该距离则深度测试将被禁用——例如，以防止与地形发生裁剪。
 * @property {SplitDirection} [splitDirection] 指定Billboard的分割属性的 {@link SplitDirection}。
 */

/**
 * <div class="notice">
 * 通过调用 {@link BillboardCollection#add}创建Billboard并设置其初始属性。不要直接调用构造函数。
 * properties are set by calling {@link BillboardCollection#add}. Do not call the constructor directly.
 * </div>
 * 一个位于 3D 场景中的视口对齐图像，该图像通过
 * 以及使用 {@link BillboardCollection} 进行渲染而创建。
 * <br /><br />
 * <div align='center'>
 * <img src='Images/Billboard.png' width='400' height='300' /><br />
 * 示例广告牌
 * </div>
 *
 * @alias Billboard
 *
 * @performance Reading 某个属性，例如 {@link Billboard#show}，是常量时间操作。
 * 将值赋给属性是常量时间操作，但会导致
 * 在调用 {@link BillboardCollection#update} 时产生 CPU 到 GPU 的数据传输。每个广告牌的传输量
 * 与更新的属性数量无关。如果集合中的大多数广告牌需要被
 * 更新，使用 {@link BillboardCollection#removeAll} 清除集合可能更有效率。
 * 然后添加新的广告牌，而不是修改每一个广告牌。
 *
 * @exception {DeveloperError} scaleByDistance.far 必须大于 scaleByDistance.near。
 * @exception {DeveloperError} translucencyByDistance.far 必须大于 translucencyByDistance.near。
 * @exception {DeveloperError} pixelOffsetScaleByDistance.far 必须大于 pixelOffsetScaleByDistance.near。
 * @exception {DeveloperError} distanceDisplayCondition.far 必须大于 distanceDisplayCondition.near。
 *
 * @see BillboardCollection
 * @see BillboardCollection#add
 * @see Label
 *
 * @internalConstructor
 * @class
 *
 * @param {Billboard.ConstructorOptions} options 描述初始化选项的对象
 * @param {BillboardCollection} billboardCollection BillboardCollection 的实例
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=billboards|Cesium Sandcastle Billboard Demo}
 */
function Billboard(options, billboardCollection) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (
    defined(options.disableDepthTestDistance) &&
    options.disableDepthTestDistance < 0.0
  ) {
    throw new DeveloperError(
      "disableDepthTestDistance must be greater than or equal to 0.0.",
    );
  }
  //>>includeEnd('debug');

  let translucencyByDistance = options.translucencyByDistance;
  let pixelOffsetScaleByDistance = options.pixelOffsetScaleByDistance;
  let scaleByDistance = options.scaleByDistance;
  let distanceDisplayCondition = options.distanceDisplayCondition;
  if (defined(translucencyByDistance)) {
    //>>includeStart('debug', pragmas.debug);
    if (translucencyByDistance.far <= translucencyByDistance.near) {
      throw new DeveloperError(
        "translucencyByDistance.far must be greater than translucencyByDistance.near.",
      );
    }
    //>>includeEnd('debug');
    translucencyByDistance = NearFarScalar.clone(translucencyByDistance);
  }
  if (defined(pixelOffsetScaleByDistance)) {
    //>>includeStart('debug', pragmas.debug);
    if (pixelOffsetScaleByDistance.far <= pixelOffsetScaleByDistance.near) {
      throw new DeveloperError(
        "pixelOffsetScaleByDistance.far must be greater than pixelOffsetScaleByDistance.near.",
      );
    }
    //>>includeEnd('debug');
    pixelOffsetScaleByDistance = NearFarScalar.clone(
      pixelOffsetScaleByDistance,
    );
  }
  if (defined(scaleByDistance)) {
    //>>includeStart('debug', pragmas.debug);
    if (scaleByDistance.far <= scaleByDistance.near) {
      throw new DeveloperError(
        "scaleByDistance.far must be greater than scaleByDistance.near.",
      );
    }
    //>>includeEnd('debug');
    scaleByDistance = NearFarScalar.clone(scaleByDistance);
  }
  if (defined(distanceDisplayCondition)) {
    //>>includeStart('debug', pragmas.debug);
    if (distanceDisplayCondition.far <= distanceDisplayCondition.near) {
      throw new DeveloperError(
        "distanceDisplayCondition.far must be greater than distanceDisplayCondition.near.",
      );
    }
    //>>includeEnd('debug');
    distanceDisplayCondition = DistanceDisplayCondition.clone(
      distanceDisplayCondition,
    );
  }

  this._show = options.show ?? true;
  this._position = Cartesian3.clone(options.position ?? Cartesian3.ZERO);
  this._actualPosition = Cartesian3.clone(this._position); // For columbus view and 2D
  this._pixelOffset = Cartesian2.clone(options.pixelOffset ?? Cartesian2.ZERO);
  this._translate = new Cartesian2(0.0, 0.0); // used by labels for glyph vertex translation
  this._eyeOffset = Cartesian3.clone(options.eyeOffset ?? Cartesian3.ZERO);
  this._heightReference = options.heightReference ?? HeightReference.NONE;
  this._verticalOrigin = options.verticalOrigin ?? VerticalOrigin.CENTER;
  this._horizontalOrigin = options.horizontalOrigin ?? HorizontalOrigin.CENTER;
  this._scale = options.scale ?? 1.0;
  this._color = Color.clone(options.color ?? Color.WHITE);
  this._rotation = options.rotation ?? 0.0;
  this._alignedAxis = Cartesian3.clone(options.alignedAxis ?? Cartesian3.ZERO);
  this._width = options.width;
  this._height = options.height;
  this._scaleByDistance = scaleByDistance;
  this._translucencyByDistance = translucencyByDistance;
  this._pixelOffsetScaleByDistance = pixelOffsetScaleByDistance;
  this._sizeInMeters = options.sizeInMeters ?? false;
  this._distanceDisplayCondition = distanceDisplayCondition;
  this._disableDepthTestDistance = options.disableDepthTestDistance;
  this._id = options.id;
  this._collection = options.collection ?? billboardCollection; // Used only for pick ids

  this._pickId = undefined;
  this._pickPrimitive = options._pickPrimitive ?? this;

  this._billboardCollection = billboardCollection;
  this._dirty = false;
  this._index = -1; // Used only by BillboardCollection
  this._batchIndex = undefined; // Used only by Vector3DTilePoints and BillboardCollection

  this._imageTexture = new BillboardTexture(billboardCollection);

  this._imageId = options.imageId;
  this._imageWidth = undefined;
  this._imageHeight = undefined;
  this._labelDimensions = undefined;
  this._labelHorizontalOrigin = undefined;
  this._labelTranslate = undefined;

  const image = options.image;
  if (defined(image)) {
    this._computeImageTextureProperties(options.imageId, image);
    this._imageTexture.loadImage(
      this._imageId,
      image,
      this._imageWidth,
      this._imageHeight,
    );
  }

  if (defined(options.imageSubRegion)) {
    this._imageTexture.addImageSubRegion(this._imageId, options.imageSubRegion);
  }

  this._actualClampedPosition = undefined;
  this._removeCallbackFunc = undefined;
  this._mode = SceneMode.SCENE3D;

  this._clusterShow = true;
  this._outlineColor = Color.clone(options.outlineColor ?? Color.BLACK);
  this._outlineWidth = options.outlineWidth ?? 0.0;

  this._updateClamping();

  this._splitDirection = options.splitDirection ?? SplitDirection.NONE;
  // Primarily used by labels to indicate that the position is derived from the parent.
  // and expensive operations like clamping can be skipped.
  this._positionFromParent = false;
}

const SHOW_INDEX = (Billboard.SHOW_INDEX = 0);
const POSITION_INDEX = (Billboard.POSITION_INDEX = 1);
const PIXEL_OFFSET_INDEX = (Billboard.PIXEL_OFFSET_INDEX = 2);
const EYE_OFFSET_INDEX = (Billboard.EYE_OFFSET_INDEX = 3);
const HORIZONTAL_ORIGIN_INDEX = (Billboard.HORIZONTAL_ORIGIN_INDEX = 4);
const VERTICAL_ORIGIN_INDEX = (Billboard.VERTICAL_ORIGIN_INDEX = 5);
const SCALE_INDEX = (Billboard.SCALE_INDEX = 6);
const IMAGE_INDEX_INDEX = (Billboard.IMAGE_INDEX_INDEX = 7);
const COLOR_INDEX = (Billboard.COLOR_INDEX = 8);
const ROTATION_INDEX = (Billboard.ROTATION_INDEX = 9);
const ALIGNED_AXIS_INDEX = (Billboard.ALIGNED_AXIS_INDEX = 10);
const SCALE_BY_DISTANCE_INDEX = (Billboard.SCALE_BY_DISTANCE_INDEX = 11);
const TRANSLUCENCY_BY_DISTANCE_INDEX =
  (Billboard.TRANSLUCENCY_BY_DISTANCE_INDEX = 12);
const PIXEL_OFFSET_SCALE_BY_DISTANCE_INDEX =
  (Billboard.PIXEL_OFFSET_SCALE_BY_DISTANCE_INDEX = 13);
const DISTANCE_DISPLAY_CONDITION = (Billboard.DISTANCE_DISPLAY_CONDITION = 14);
const DISABLE_DEPTH_DISTANCE = (Billboard.DISABLE_DEPTH_DISTANCE = 15);
Billboard.TEXTURE_COORDINATE_BOUNDS = 16;
const SDF_INDEX = (Billboard.SDF_INDEX = 17);
const SPLIT_DIRECTION_INDEX = (Billboard.SPLIT_DIRECTION_INDEX = 18);
Billboard.NUMBER_OF_PROPERTIES = 19;

function makeDirty(billboard, propertyChanged) {
  const billboardCollection = billboard._billboardCollection;
  if (defined(billboardCollection)) {
    billboardCollection._updateBillboard(billboard, propertyChanged);
    billboard._dirty = true;
  }
}

Object.defineProperties(Billboard.prototype, {
  /**
   * 决定此广告牌是否显示。使用此方法来隐藏或显示广告牌，而不是
   * 将其移除并重新添加到集合中。
   * @memberof Billboard.prototype
   * @type {boolean}
   * @default true
   */
  show: {
    get: function () {
      return this._show;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("value", value);
      //>>includeEnd('debug');

      if (this._show !== value) {
        this._show = value;
        makeDirty(this, SHOW_INDEX);
      }
    },
  },

  /**
   * 获取或设置此广告牌的笛卡尔位置。
   * @memberof Billboard.prototype
   * @type {Cartesian3}
   */
  position: {
    get: function () {
      return this._position;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const position = this._position;
      if (!Cartesian3.equals(position, value)) {
        Cartesian3.clone(value, position);
        Cartesian3.clone(value, this._actualPosition);
        this._updateClamping();
        makeDirty(this, POSITION_INDEX);
      }
    },
  },

  /**
   * 获取或设置此广告牌的高度参考值。
   * @memberof Billboard.prototype
   * @type {HeightReference}
   * @default HeightReference.NONE
   */
  heightReference: {
    get: function () {
      return this._heightReference;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');

      const heightReference = this._heightReference;
      if (value !== heightReference) {
        this._heightReference = value;
        this._updateClamping();
        makeDirty(this, POSITION_INDEX);
      }
    },
  },

  /**
   * 获取或设置此广告牌在屏幕空间中的像素偏移量。这通常用于
   * 使多个广告牌和标签处于同一位置，例如图像和文本。屏幕空间原点是画布的左上角；<code>x</code> 从
   * 左到右增加，<code>y</code> 从上到下增加。
   * </div>
   * <br /><br />
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><code>default</code><br/><img src='Images/Billboard.setPixelOffset.default.png' width='250' height='188' /></td>
   * <td align='center'><code>b.pixeloffset = new Cartesian2(50, 25);</code><br/><img src='Images/Billboard.setPixelOffset.x50y-25.png' width='250' height='188' /></td>
   * </tr></table>
   * 广告牌的原点由黄色点表示。
   * </div>
   * @memberof Billboard.prototype
   * @type {Cartesian2}
   */
  pixelOffset: {
    get: function () {
      return this._pixelOffset;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const pixelOffset = this._pixelOffset;
      if (!Cartesian2.equals(pixelOffset, value)) {
        Cartesian2.clone(value, pixelOffset);
        makeDirty(this, PIXEL_OFFSET_INDEX);
      }
    },
  },

  /**
   * 根据广告牌与相机的距离，获取或设置 Billboard 的近远缩放属性。
   * 广告牌的缩放会在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值，而相机距离则处于上下边界内。
   * 指定 {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 范围内的值。
   * 超出这些范围时，广告牌的缩放比例会被限制在最近的边界值。如果未定义，则不会启用。
   * scaleByDistance 将被禁用。
   * @memberof Billboard.prototype
   * @type {NearFarScalar}
   *
   * @example
   * // 示例 1。
   * // 将广告牌的 scaleByDistance 设置为当
   * // 相机距离广告牌 1500 米时，广告牌会缩小到
   * // 当相机距离接近 8.0e6 米时。
   * b.scaleByDistance = new Cesium.NearFarScalar(1.5e2, 1.5, 8.0e6, 0.0);
   *
   * @example
   * // 示例 2。
   * // 禁用基于距离的缩放
   * b.scaleByDistance = undefined;
   */
  scaleByDistance: {
    get: function () {
      return this._scaleByDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value)) {
        Check.typeOf.object("value", value);
        if (value.far <= value.near) {
          throw new DeveloperError(
            "far distance must be greater than near distance.",
          );
        }
      }
      //>>includeEnd('debug');

      const scaleByDistance = this._scaleByDistance;
      if (!NearFarScalar.equals(scaleByDistance, value)) {
        this._scaleByDistance = NearFarScalar.clone(value, scaleByDistance);
        makeDirty(this, SCALE_BY_DISTANCE_INDEX);
      }
    },
  },

  /**
   * 根据广告牌与相机的距离，获取或设置广告牌的近远半透明属性。
   * 广告牌的半透明效果将在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值，当相机距离处于指定 {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 的下限和上限范围内时。
   * 超出这些范围时，广告牌的半透明效果会被限制在最近的边界值。如果未定义，则不会启用。
   * // 半透明效果将被禁用。
   * translucencyByDistance 将被禁用。
   * @memberof Billboard.prototype
   * @type {NearFarScalar}
   *
   * @example
   * // 示例 1。
   * // 当
   * // 相机距离广告牌 1500 米时，广告牌的半透明效果会变为
   * // 当相机距离接近 8.0e6 米时。
   * b.translucencyByDistance = new Cesium.NearFarScalar(1.5e2, 1.0, 8.0e6, 0.0);
   *
   * @example
   * // 示例 2。
   * // 禁用基于距离的半透明效果。
   * b.translucencyByDistance = undefined;
   */
  translucencyByDistance: {
    get: function () {
      return this._translucencyByDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value)) {
        Check.typeOf.object("value", value);
        if (value.far <= value.near) {
          throw new DeveloperError(
            "far distance must be greater than near distance.",
          );
        }
      }
      //>>includeEnd('debug');

      const translucencyByDistance = this._translucencyByDistance;
      if (!NearFarScalar.equals(translucencyByDistance, value)) {
        this._translucencyByDistance = NearFarScalar.clone(
          value,
          translucencyByDistance,
        );
        makeDirty(this, TRANSLUCENCY_BY_DISTANCE_INDEX);
      }
    },
  },

  /**
   * 根据广告牌与相机的距离，获取或设置广告牌的近远像素偏移缩放属性。
   * 广告牌的像素偏移将在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间缩放，当相机距离处于指定 {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 的下限和上限范围内时。
   * 超出这些范围时，广告牌的像素偏移缩放会被限制在最近的边界值。如果未定义，则不会启用。
   * // 像素偏移缩放效果将被禁用。
   * pixelOffsetScaleByDistance 将被禁用。
   * @memberof Billboard.prototype
   * @type {NearFarScalar}
   *
   * @example
   * // 示例 1。
   * // 当
   * // 相机距离广告牌 1500 米时，广告牌的像素偏移缩放为 10.0 像素
   * // 在 y 方向上，相机距离接近 8.0e6 米时。
   * b.pixelOffset = new Cesium.Cartesian2(0.0, 1.0);
   * b.pixelOffsetScaleByDistance = new Cesium.NearFarScalar(1.5e2, 0.0, 8.0e6, 10.0);
   *
   * @example
   * // 示例 2。
   * // 禁用基于距离的像素偏移
   * b.pixelOffsetScaleByDistance = undefined;
   */
  pixelOffsetScaleByDistance: {
    get: function () {
      return this._pixelOffsetScaleByDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value)) {
        Check.typeOf.object("value", value);
        if (value.far <= value.near) {
          throw new DeveloperError(
            "far distance must be greater than near distance.",
          );
        }
      }
      //>>includeEnd('debug');

      const pixelOffsetScaleByDistance = this._pixelOffsetScaleByDistance;
      if (!NearFarScalar.equals(pixelOffsetScaleByDistance, value)) {
        this._pixelOffsetScaleByDistance = NearFarScalar.clone(
          value,
          pixelOffsetScaleByDistance,
        );
        makeDirty(this, PIXEL_OFFSET_SCALE_BY_DISTANCE_INDEX);
      }
    },
  },

  /**
   * 获取或设置应用于此广告牌的 3D 笛卡尔偏移量，以眼睛坐标表示。眼睛坐标是一个左手坐标系，
   * 其中 <code>x</code> 指向观看者的右侧，<code>y</code> 指向上方，
   * <code>z</code> 指向屏幕内部。眼睛坐标使用与世界坐标和模型坐标相同的比例，
   * 通常以米为单位。
   * <br /><br />
   * 眼睛偏移通常用于将多个广告牌或实体排列在相同位置，例如，
   * 将广告牌置于其对应的 3D 模型上方。
   * <br /><br />
   * 下面，广告牌位于地球中心，但通过眼睛偏移使其始终
   * 出现在地球表面，无论观看者或地球的方向如何。
   * <br /><br />
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><img src='Images/Billboard.setEyeOffset.one.png' width='250' height='188' /></td>
   * <td align='center'><img src='Images/Billboard.setEyeOffset.two.png' width='250' height='188' /></td>
   * </tr></table>
   * <code>b.eyeOffset = new Cartesian3(0.0, 8000000.0, 0.0);</code><br /><br />
   * </div>
   * @memberof Billboard.prototype
   * @type {Cartesian3}
   */
  eyeOffset: {
    get: function () {
      return this._eyeOffset;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const eyeOffset = this._eyeOffset;
      if (!Cartesian3.equals(eyeOffset, value)) {
        Cartesian3.clone(value, eyeOffset);
        makeDirty(this, EYE_OFFSET_INDEX);
      }
    },
  },

  /**
   * 获取或设置此广告牌的水平原点，决定广告牌是
   * 位于锚点位置的左侧、中心还是右侧。
   * <br /><br />
   * <div align='center'>
   * <img src='Images/Billboard.setHorizontalOrigin.png' width='648' height='196' /><br />
   * </div>
   * @memberof Billboard.prototype
   * @type {HorizontalOrigin}
   * @example
   * // 使用底部、左侧原点
   * b.horizontalOrigin = Cesium.HorizontalOrigin.LEFT;
   * b.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
   */
  horizontalOrigin: {
    get: function () {
      return this._horizontalOrigin;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');

      if (this._horizontalOrigin !== value) {
        this._horizontalOrigin = value;
        makeDirty(this, HORIZONTAL_ORIGIN_INDEX);
      }
    },
  },

  /**
   * 获取或设置此广告牌的垂直原点，决定广告牌是
   * 位于锚点位置的上方、下方还是中心。
   * <br /><br />
   * <div align='center'>
   * <img src='Images/Billboard.setVerticalOrigin.png' width='695' height='175' /><br />
   * </div>
   * @memberof Billboard.prototype
   * @type {VerticalOrigin}
   * @example
   * // 使用底部、左侧原点
   * b.horizontalOrigin = Cesium.HorizontalOrigin.LEFT;
   * b.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
   */
  verticalOrigin: {
    get: function () {
      return this._verticalOrigin;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');

      if (this._verticalOrigin !== value) {
        this._verticalOrigin = value;
        makeDirty(this, VERTICAL_ORIGIN_INDEX);
      }
    },
  },

  /**
   * 获取或设置与广告牌像素尺寸相乘的统一比例。
   * 比例 <code>1.0</code> 不会改变广告牌的大小；大于
   * <code>1.0</code> 的比例会放大广告牌；小于 <code>1.0</code> 的正比例会缩小
   * 广告牌的大小。
   * <br /><br />
   * <div align='center'>
   * <img src='Images/Billboard.setScale.png' width='400' height='300' /><br/>
   * 在上面的图像中，从左到右的刻度分别为 <code>0.5</code>、<code>1.0</code> 和 <code>2.0</code>。
   * </div>
   * </div>
   * @memberof Billboard.prototype
   * @type {number}
   */
  scale: {
    get: function () {
      return this._scale;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');

      if (this._scale !== value) {
        this._scale = value;
        makeDirty(this, SCALE_INDEX);
      }
    },
  },

  /**
   * 用于获取或设置与广告牌纹理相乘的颜色。这有两种常见的使用场景。首先，
   * 相同的白色纹理可以被多个不同的广告牌使用，每个广告牌都有不同的颜色，从而创建出
   * 彩色广告牌。其次，颜色的 alpha 分量可以用来使广告牌半透明，如下所示。
   * alpha 值为 <code>0.0</code> 时，广告牌为透明；<code>1.0</code> 时，广告牌不透明。
   * <br /><br />
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><code>default</code><br/><img src='Images/Billboard.setColor.Alpha255.png' width='250' height='188' /></td>
   * <td align='center'><code>alpha : 0.5</code><br/><img src='Images/Billboard.setColor.Alpha127.png' width='250' height='188' /></td>
   * </tr></table>
   * </div>
   * <br />
   * 红色、绿色、蓝色和 alpha 值由 <code>value</code> 的 <code>red</code>、<code>green</code>、
   * <code>blue</code> 和 <code>alpha</code> 属性表示，如示例 1 所示。这些分量范围从 <code>0.0</code>
   * （无强度）到 <code>1.0</code>（全强度）。
   * @memberof Billboard.prototype
   * @type {Color}
   *
   * @example
   * // 示例 1。分配黄色。
   * b.color = Cesium.Color.YELLOW;
   *
   * @example
   * // 示例 2。使广告牌半透明 50%。
   * b.color = new Cesium.Color(1.0, 1.0, 1.0, 0.5);
   */
  color: {
    get: function () {
      return this._color;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const color = this._color;
      if (!Color.equals(color, value)) {
        Color.clone(value, color);
        makeDirty(this, COLOR_INDEX);
      }
    },
  },

  /**
   * 用于获取或设置旋转角度（以弧度为单位）。
   * @memberof Billboard.prototype
   * @type {number}
   */
  rotation: {
    get: function () {
      return this._rotation;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');

      if (this._rotation !== value) {
        this._rotation = value;
        makeDirty(this, ROTATION_INDEX);
      }
    },
  },

  /**
   * 对齐轴是广告牌向上向量指向的方向向量。
   * 默认值为零向量，意味着广告牌与屏幕向上向量对齐。
   * 注意，只有零向量（0,0,0）才会将对齐重置为屏幕向上方向。
   * @memberof Billboard.prototype
   * @type {Cartesian3}
   * @example
   * // 示例 1。
   * // 使广告牌向上向量指向北方
   * billboard.alignedAxis = Cesium.Cartesian3.UNIT_Z;
   *
   * @example
   * // 示例 2。
   * // 使广告牌指向东方。
   * billboard.alignedAxis = Cesium.Cartesian3.UNIT_Z;
   * billboard.rotation = -Cesium.Math.PI_OVER_TWO;
   *
   * @example
   * // 示例 3。
   * // 重置对齐轴
   * billboard.alignedAxis = Cesium.Cartesian3.ZERO;
   */
  alignedAxis: {
    get: function () {
      return this._alignedAxis;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const alignedAxis = this._alignedAxis;
      if (!Cartesian3.equals(alignedAxis, value)) {
        Cartesian3.clone(value, alignedAxis);
        makeDirty(this, ALIGNED_AXIS_INDEX);
      }
    },
  },

  /**
   * 用于获取或设置广告牌的宽度。如果未定义，则使用图像宽度。
   * @memberof Billboard.prototype
   * @type {number|undefined}
   */
  width: {
    get: function () {
      return this._width ?? this._imageTexture.width;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value)) {
        Check.typeOf.number("width", value);
      }
      //>>includeEnd('debug');

      if (this._width !== value) {
        this._width = value;
        makeDirty(this, IMAGE_INDEX_INDEX);
      }
    },
  },

  /**
   * 用于获取或设置广告牌的高度。如果未定义，则使用图像高度。
   * @memberof Billboard.prototype
   * @type {number|undefined}
   */
  height: {
    get: function () {
      return this._height ?? this._imageTexture.height;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value)) {
        Check.typeOf.number("height", value);
      }
      //>>includeEnd('debug');

      if (this._height !== value) {
        this._height = value;
        makeDirty(this, IMAGE_INDEX_INDEX);
      }
    },
  },

  /**
   * 用于获取或设置广告牌尺寸是米还是像素。<code>true</code>表示以米为单位调整广告牌尺寸；
   * 否则，尺寸以像素为单位。
   * @memberof Billboard.prototype
   * @type {boolean}
   * @default false
   */
  sizeInMeters: {
    get: function () {
      return this._sizeInMeters;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("value", value);
      //>>includeEnd('debug');
      if (this._sizeInMeters !== value) {
        this._sizeInMeters = value;
        makeDirty(this, COLOR_INDEX);
      }
    },
  },

  /**
   * 获取或设置指定广告牌在距离相机多远的位置显示的条件。
   * @memberof Billboard.prototype
   * @type {DistanceDisplayCondition}
   * @default undefined
   */
  distanceDisplayCondition: {
    get: function () {
      return this._distanceDisplayCondition;
    },
    set: function (value) {
      if (
        !DistanceDisplayCondition.equals(value, this._distanceDisplayCondition)
      ) {
        //>>includeStart('debug', pragmas.debug);
        if (defined(value)) {
          Check.typeOf.object("value", value);
          if (value.far <= value.near) {
            throw new DeveloperError(
              "far distance must be greater than near distance.",
            );
          }
        }
        //>>includeEnd('debug');
        this._distanceDisplayCondition = DistanceDisplayCondition.clone(
          value,
          this._distanceDisplayCondition,
        );
        makeDirty(this, DISTANCE_DISPLAY_CONDITION);
      }
    },
  },

  /**
   * 获取或设置距离相机的距离阈值，超过该距离则禁用深度测试——即，
   * 例如，防止与地形发生裁剪。设置为 <code>undefined</code> 或
   * <code>0</code> 时，始终应用深度测试。设置为
   * <code>Number.POSITIVE_INFINITY</code> 时，永远不应用深度测试。
   * @memberof Billboard.prototype
   * @type {number|undefined}
   * @default undefined
   */
  disableDepthTestDistance: {
    get: function () {
      return this._disableDepthTestDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value)) {
        Check.typeOf.number("value", value);
        if (value < 0.0) {
          throw new DeveloperError(
            "disableDepthTestDistance must be greater than or equal to 0.0.",
          );
        }
      }
      //>>includeEnd('debug');
      if (this._disableDepthTestDistance !== value) {
        this._disableDepthTestDistance = value;
        makeDirty(this, DISABLE_DEPTH_DISTANCE);
      }
    },
  },

  /**
   * 获取或设置选择广告牌时返回的自定义对象。
   * @memberof Billboard.prototype
   * @type {*}
   */
  id: {
    get: function () {
      return this._id;
    },
    set: function (value) {
      this._id = value;
      if (defined(this._pickId)) {
        this._pickId.object.id = value;
      }
    },
  },

  /**
   * 选择此广告牌时返回的基本类型。
   * @memberof Billboard.prototype
   * @private
   */
  pickPrimitive: {
    get: function () {
      return this._pickPrimitive;
    },
    set: function (value) {
      this._pickPrimitive = value;
      if (defined(this._pickId)) {
        this._pickId.object.primitive = value;
      }
    },
  },

  /**
   * @private
   */
  pickId: {
    get: function () {
      return this._pickId;
    },
  },

  /**
   * <p>
   * 获取或设置用于此广告牌的图像。如果为给定图像已创建纹理，
   * 则使用现有纹理。
   * </p>
   * <p>
   * 此属性可以设置为加载后的 Image、将自动加载为 Image 的 URL、
   * canvas，或同一广告牌集合中的其他广告牌图像属性。
   * </p>
   *
   * @memberof Billboard.prototype
   * @type {string}
   * @example
   * // 从 URL 加载图像
   * b.image = 'some/image/url.png';
   *
   * // 假设 b1 和 b2 属于同一广告牌集合，
   * // 为两个广告牌使用相同的图像。
   * b2.image = b1.image;
   */
  image: {
    get: function () {
      return this._imageTexture.id;
    },
    set: function (value) {
      if (!defined(value)) {
        this._imageTexture.unload();
        return;
      }

      this._computeImageTextureProperties(undefined, value);
      this._imageTexture.loadImage(
        this._imageId,
        value,
        this._imageWidth,
        this._imageHeight,
      );
    },
  },

  /**
   * 当 <code>true</code> 时，此广告牌已准备好渲染，即图像
   * 已下载且 WebGL 资源已创建。
   * @memberof Billboard.prototype
   * @type {boolean}
   * @readonly
   * @default false
   */
  ready: {
    get: function () {
      return this._imageTexture.ready;
    },
  },

  /**
   * 如果定义，则在此加载过程中遇到错误。
   * @memberof Billboard.prototype
   * @type {Error|undefined}
   * @readonly
   * @private
   */
  loadError: {
    get: function () {
      return this._imageTexture.loadError;
    },
  },

  /**
   * 由 <code>billboardCollection</code> 使用，以根据图像加载状态跟踪需要更新的广告牌。
   * @memberof Billboard.prototype
   * @type {boolean}
   * @private
   * @default false
   */
  textureDirty: {
    get: function () {
      return this._imageTexture.dirty;
    },
    set: function (value) {
      this._imageTexture.dirty = value;
    },
  },

  /**
   * 根据高度参考值记录广告牌的位置。
   * @memberof Billboard.prototype
   * @type {Cartesian3}
   * @private
   */
  _clampedPosition: {
    get: function () {
      return this._actualClampedPosition;
    },
    set: function (value) {
      this._actualClampedPosition = Cartesian3.clone(
        value,
        this._actualClampedPosition,
      );
      if (this._mode === SceneMode.SCENE3D) {
        // In 3D mode the actual (rendered) position is the same as clamped position (ECEF).
        Cartesian3.clone(value, this._actualPosition);
      }
      makeDirty(this, POSITION_INDEX);
    },
  },

  /**
   * 决定此广告牌是否因被聚集而显示或隐藏。
   * @memberof Billboard.prototype
   * @type {boolean}
   * @private
   */
  clusterShow: {
    get: function () {
      return this._clusterShow;
    },
    set: function (value) {
      if (this._clusterShow !== value) {
        this._clusterShow = value;
        makeDirty(this, SHOW_INDEX);
      }
    },
  },

  /**
   * 此广告牌的轮廓颜色。仅对 SDF 广告牌（如 Label glyphs）有效。
   * @memberof Billboard.prototype
   * @type {Color}
   * @private
   */
  outlineColor: {
    get: function () {
      return this._outlineColor;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value)) {
        throw new DeveloperError("value is required.");
      }
      //>>includeEnd('debug');

      const outlineColor = this._outlineColor;
      if (!Color.equals(outlineColor, value)) {
        Color.clone(value, outlineColor);
        makeDirty(this, SDF_INDEX);
      }
    },
  },

  /**
   * 此广告牌的轮廓宽度，以像素为单位。仅对 SDF 广告牌（如 Label glyphs）有效。
   * @memberof Billboard.prototype
   * @type {number}
   * @private
   */
  outlineWidth: {
    get: function () {
      return this._outlineWidth;
    },
    set: function (value) {
      if (this._outlineWidth !== value) {
        this._outlineWidth = value;
        makeDirty(this, SDF_INDEX);
      }
    },
  },

  /**
   * 获取或设置此广告牌的 {@link SplitDirection}。
   * @memberof Billboard.prototype
   * @type {SplitDirection}
   * @default {@link SplitDirection.NONE}
   */
  splitDirection: {
    get: function () {
      return this._splitDirection;
    },
    set: function (value) {
      if (this._splitDirection !== value) {
        this._splitDirection = value;
        makeDirty(this, SPLIT_DIRECTION_INDEX);
      }
    },
  },
});

Billboard.prototype.getPickId = function (context) {
  if (!defined(this._pickId)) {
    this._pickId = context.createPickId({
      primitive: this._pickPrimitive,
      collection: this._collection,
      id: this._id,
    });
  }

  return this._pickId;
};

Billboard.prototype._updateClamping = function () {
  Billboard._updateClamping(this._billboardCollection, this);
};

const scratchCartographic = new Cartographic();
Billboard._updateClamping = function (collection, owner) {
  if (!defined(collection) || !defined(collection._scene)) {
    //>>includeStart('debug', pragmas.debug);
    if (owner._heightReference !== HeightReference.NONE) {
      throw new DeveloperError(
        "Height reference is not supported without a scene.",
      );
    }
    //>>includeEnd('debug');
    return;
  }
  const scene = collection._scene;
  const ellipsoid = scene.ellipsoid ?? Ellipsoid.default;

  const mode = scene.frameState.mode;
  const modeChanged = mode !== owner._mode;
  owner._mode = mode;

  if (
    (owner._heightReference === HeightReference.NONE || modeChanged) &&
    defined(owner._removeCallbackFunc)
  ) {
    owner._removeCallbackFunc();
    owner._removeCallbackFunc = undefined;
    owner._clampedPosition = undefined;
  }

  if (
    owner._heightReference === HeightReference.NONE ||
    owner._positionFromParent ||
    !defined(owner._position)
  ) {
    return;
  }

  if (defined(owner._removeCallbackFunc)) {
    owner._removeCallbackFunc();
  }

  const position = ellipsoid.cartesianToCartographic(owner._position);
  if (!defined(position)) {
    owner._actualClampedPosition = undefined;
    return;
  }

  function handleSceneUpdateHeight(clampedPositionCartographic) {
    // Apply the height offset in cartographic space
    if (isHeightReferenceRelative(owner._heightReference)) {
      clampedPositionCartographic.height += position.height;
    }

    // Assign via the setter, as the setter marks the position as dirty.
    owner._clampedPosition = ellipsoid.cartographicToCartesian(
      clampedPositionCartographic,
      owner._clampedPosition,
    );
  }

  owner._removeCallbackFunc = scene.updateHeight(
    position,
    handleSceneUpdateHeight,
    owner._heightReference,
  );

  Cartographic.clone(position, scratchCartographic);
  const height = scene.getHeight(position, owner._heightReference);
  if (defined(height)) {
    scratchCartographic.height = height;
  }

  handleSceneUpdateHeight(scratchCartographic);
};

/**
 * 获取在着色器中读取已加载纹理的纹理坐标。
 * @param {BoundingRectangle} [result] 修改后的结果参数或新的 BoundingRectangle 实例（如果未提供）。
 * @return {BoundingRectangle} The 修改后的结果参数或新的 BoundingRectangle 实例（如果未提供）。
 * @private
 */
Billboard.prototype.computeTextureCoordinates = function (result) {
  return this._imageTexture.computeTextureCoordinates(result);
};

/**
 * <p>
 * 设置用于此广告牌的图像。如果为给定 id 已创建纹理，
 * 则使用现有纹理。
 * </p>
 * <p>
 * 此函数适用于动态创建跨多个广告牌共享的纹理。
 * 只有第一个广告牌会实际调用函数并生成纹理，后续广告牌则
 * 使用相同 ID 创建的广告牌将直接复用现有纹理。
 * </p>
 * <p>
 * 从 URL 加载图像时，设置 {@link Billboard#image} 属性更为方便。
 * </p>
 *
 * @param {string} id 图像的 ID。这可以是任何唯一标识该图像的字符串。
 * @param {HTMLImageElement|HTMLCanvasElement|string|Resource|Billboard.CreateImageCallback} image 要加载的图像。此参数
 * 可以是已加载的 Image 或 Canvas、将自动作为 Image 加载的 URL，
 * 或者是一个函数，如果图像尚未加载，则通过该函数生成图像。
 * @example
 * // 动态创建广告牌图像
 * function drawImage(id) {
 * // 使用 Canvas 创建并绘制图像
 * const canvas = document.createElement('canvas');
 * const context2D = canvas.getContext('2d');
 * // ... 绘制图像
 * return canvas;
 * }
 * // drawImage 将被调用以生成纹理
 * b.setImage('myImage', drawImage);
 *
 * // 使用相同 ID 在同一个集合中创建的后续广告牌将使用现有
 * // 纹理，无需创建 Canvas 或绘制图像
 * b2.setImage('myImage', drawImage);
 */
Billboard.prototype.setImage = function (id, image) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("id", id);
  Check.defined("image", image);
  //>>includeEnd('debug');

  this._computeImageTextureProperties(id, image);
  this._imageTexture.loadImage(
    this._imageId,
    image,
    this._imageWidth,
    this._imageHeight,
  );
};

/**
 * 将现有广告牌纹理的值复制到当前纹理中。适用于防止已加载图像出现停机问题。
 * @private
 * @param {BillboardTexture} billboardTexture
 */
Billboard.prototype.setImageTexture = function (billboardTexture) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("billboardTexture", billboardTexture);
  //>>includeEnd('debug');

  BillboardTexture.clone(billboardTexture, this._imageTexture);
};

// Arbitrary limit on allocated SVG size, in pixels. Raster images use image resolution.
const SVG_MAX_SIZE_PX = 512;

/**
 * 计算广告牌纹理 ID、宽度和高度。对于栅格图像，宽度和高度保持
 * 未定义，默认为图像分辨率。对于 SVG，使用广告牌像素宽度和高度。
 * @param {string | undefined} id 图像的 ID。
 * @param {string | HTMLImageElement | HTMLCanvasElement | undefined} image 已加载的 HTMLImageElement、ImageData 或用于广告牌的图像 URL。
 * @private
 */
Billboard.prototype._computeImageTextureProperties = function (id, image) {
  this._imageWidth = undefined;
  this._imageHeight = undefined;

  if (!defined(image)) {
    this._imageId = createGuid();
    return;
  }

  let imageUri;
  if (typeof image === "string") {
    imageUri = image;
  } else if (image instanceof Resource) {
    imageUri = image._url;
  } else if (defined(image.src)) {
    imageUri = image.src;
  }

  this._imageId = id ?? imageUri ?? createGuid();

  const hasSizeInPixels =
    defined(this._width) && defined(this._height) && !this._sizeInMeters;

  if (hasSizeInPixels && isSvgUri(imageUri)) {
    this._imageWidth = Math.min(this._width, SVG_MAX_SIZE_PX);
    this._imageHeight = Math.min(this._height, SVG_MAX_SIZE_PX);
  }
};

function isSvgUri(uri) {
  if (!defined(uri)) {
    return false;
  }
  return isDataUri(uri)
    ? uri.startsWith("data:image/svg+xml")
    : getExtensionFromUri(uri) === "svg";
}

/**
 * 使用具有给定 ID 的图像的子区域作为该广告牌的图像，
 * 以从左下角开始的像素为单位测量。
 *
 * @param {string} id 要使用的图像 ID。
 * @param {BoundingRectangle} subRegion 图像的子区域。
 *
 * @exception {RuntimeError} image 其 ID 必须存在于 atlas 中。
 */
Billboard.prototype.setImageSubRegion = function (id, subRegion) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("id", id);
  Check.defined("subRegion", subRegion);
  //>>includeEnd('debug');

  this._imageTexture.addImageSubRegion(id, subRegion);
};

Billboard.prototype._setTranslate = function (value) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(value)) {
    throw new DeveloperError("value is required.");
  }
  //>>includeEnd('debug');

  const translate = this._translate;
  if (!Cartesian2.equals(translate, value)) {
    Cartesian2.clone(value, translate);
    makeDirty(this, PIXEL_OFFSET_INDEX);
  }
};

// `_actualPosition` is the billboard's position in the current render frame:
// ECEF in 3D, and the projected map coordinate in 2D/Columbus View.
// It is kept current by `recomputeActualPositions` in 2D/Columbus View, and —
// for clamped billboards in 3D — by the `_clampedPosition` setter (3D has no
// per-frame actual-position recompute).
Billboard.prototype._getActualPosition = function () {
  return this._actualPosition;
};

Billboard.prototype._setActualPosition = function (value) {
  Cartesian3.clone(value, this._actualPosition);
  makeDirty(this, POSITION_INDEX);
};

const tempCartesian3 = new Cartesian4();
const scratchActualPosition = new Cartesian3();
Billboard._computeActualPosition = function (
  billboard,
  position,
  frameState,
  modelMatrix,
) {
  if (defined(billboard._clampedPosition)) {
    if (frameState.mode !== billboard._mode) {
      billboard._updateClamping();
    }

    // Clamped position is already our rendering position when in 3D
    if (frameState.mode === SceneMode.SCENE3D) {
      return billboard._clampedPosition;
    }

    // in 2D and Columbus View we instead project the ECEF coordinate into the current map frame.
    return SceneTransforms.computeActualEllipsoidPosition(
      frameState,
      billboard._clampedPosition,
      scratchActualPosition,
    );
  } else if (frameState.mode === SceneMode.SCENE3D) {
    return position;
  }

  Matrix4.multiplyByPoint(modelMatrix, position, tempCartesian3);
  return SceneTransforms.computeActualEllipsoidPosition(
    frameState,
    tempCartesian3,
    scratchActualPosition,
  );
};

const scratchCartesian3 = new Cartesian3();

// This function is basically a stripped-down JavaScript version of BillboardCollectionVS.glsl
Billboard._computeScreenSpacePosition = function (
  modelMatrix,
  position,
  eyeOffset,
  pixelOffset,
  scene,
  result,
) {
  // Model to world coordinates
  const positionWorld = Matrix4.multiplyByPoint(
    modelMatrix,
    position,
    scratchCartesian3,
  );

  // World to window coordinates
  const positionWC = SceneTransforms.worldWithEyeOffsetToWindowCoordinates(
    scene,
    positionWorld,
    eyeOffset,
    result,
  );
  if (!defined(positionWC)) {
    return undefined;
  }

  // Apply pixel offset
  Cartesian2.add(positionWC, pixelOffset, positionWC);

  return positionWC;
};

const scratchPixelOffset = new Cartesian2(0.0, 0.0);

/**
 * 计算广告牌原点的屏幕空间位置，考虑眼睛和像素偏移。
 * 屏幕空间原点是 Canvas 的右上角；<code>x</code> 从左向右增加，
 * 而 <code>y</code> 从上到下增加。
 *
 * @param {Scene} scene 场景。
 * @param {Cartesian2} [result] 存储结果的对象。
 * @returns {Cartesian2} The 广告牌的屏幕空间位置。
 *
 * @exception {DeveloperError} Billboard 必须存在于集合中。
 *
 * @example
 * console.log(b.computeScreenSpacePosition(scene).toString());
 *
 * @see Billboard#eyeOffset
 * @see Billboard#pixelOffset
 */
Billboard.prototype.computeScreenSpacePosition = function (scene, result) {
  const billboardCollection = this._billboardCollection;
  if (!defined(result)) {
    result = new Cartesian2();
  }

  //>>includeStart('debug', pragmas.debug);
  if (!defined(billboardCollection)) {
    throw new DeveloperError(
      "Billboard must be in a collection.  Was it removed?",
    );
  }
  if (!defined(scene)) {
    throw new DeveloperError("scene is required.");
  }
  //>>includeEnd('debug');

  // pixel offset for screen space computation is the pixelOffset + screen space translate
  Cartesian2.clone(this._pixelOffset, scratchPixelOffset);
  Cartesian2.add(scratchPixelOffset, this._translate, scratchPixelOffset);

  const position = this._clampedPosition ?? this._position;

  let modelMatrix = billboardCollection.modelMatrix;

  if (this._clampedPosition && scene.mode !== SceneMode.SCENE3D) {
    // The model matrix isn't applied when rendering clamped in 2D/CV (see BillboardCollection#update)
    modelMatrix = Matrix4.IDENTITY;
  }

  // _computeScreenSpacePosition always expects ECEF position, so no unprojection required.
  const windowCoordinates = Billboard._computeScreenSpacePosition(
    modelMatrix,
    position,
    this._eyeOffset,
    scratchPixelOffset,
    scene,
    result,
  );
  return windowCoordinates;
};

/**
 * 获取以 screenSpacePosition 为中心的广告牌屏幕空间边界框。
 * @param {Billboard} billboard 用于获取屏幕空间边界框的广告牌。
 * @param {Cartesian2} screenSpacePosition 标签的屏幕空间中心。
 * @param {BoundingRectangle} [result] 用于存储结果的对象。
 * @returns {BoundingRectangle} The 屏幕空间边界框。
 *
 * @private
 */
Billboard.getScreenSpaceBoundingBox = function (
  billboard,
  screenSpacePosition,
  result,
) {
  let width = billboard.width;
  let height = billboard.height;

  const scale = billboard.scale;
  width *= scale;
  height *= scale;

  let x = screenSpacePosition.x;
  if (billboard.horizontalOrigin === HorizontalOrigin.RIGHT) {
    x -= width;
  } else if (billboard.horizontalOrigin === HorizontalOrigin.CENTER) {
    x -= width * 0.5;
  }

  let y = screenSpacePosition.y;
  if (
    billboard.verticalOrigin === VerticalOrigin.BOTTOM ||
    billboard.verticalOrigin === VerticalOrigin.BASELINE
  ) {
    y -= height;
  } else if (billboard.verticalOrigin === VerticalOrigin.CENTER) {
    y -= height * 0.5;
  }

  if (!defined(result)) {
    result = new BoundingRectangle();
  }

  result.x = x;
  result.y = y;
  result.width = width;
  result.height = height;

  return result;
};

/**
 * 判断此广告牌是否等于另一广告牌。如果所有属性均相等，则广告牌视为相等；位于不同集合中的广告牌也可以相等。
 * 广告牌相等的条件。
 *
 * @param {Billboard} [other] 用于比较相等的广告牌。
 * @returns {boolean} <code>true</code> 如果广告牌相等，则返回 true；否则返回 <code>false</code>。
 */
Billboard.prototype.equals = function (other) {
  return (
    this === other ||
    (defined(other) &&
      this._id === other._id &&
      Cartesian3.equals(this._position, other._position) &&
      this.image === other.image &&
      this._show === other._show &&
      this._scale === other._scale &&
      this._verticalOrigin === other._verticalOrigin &&
      this._horizontalOrigin === other._horizontalOrigin &&
      this._heightReference === other._heightReference &&
      Color.equals(this._color, other._color) &&
      Cartesian2.equals(this._pixelOffset, other._pixelOffset) &&
      Cartesian2.equals(this._translate, other._translate) &&
      Cartesian3.equals(this._eyeOffset, other._eyeOffset) &&
      NearFarScalar.equals(this._scaleByDistance, other._scaleByDistance) &&
      NearFarScalar.equals(
        this._translucencyByDistance,
        other._translucencyByDistance,
      ) &&
      NearFarScalar.equals(
        this._pixelOffsetScaleByDistance,
        other._pixelOffsetScaleByDistance,
      ) &&
      DistanceDisplayCondition.equals(
        this._distanceDisplayCondition,
        other._distanceDisplayCondition,
      ) &&
      this._disableDepthTestDistance === other._disableDepthTestDistance &&
      this._splitDirection === other._splitDirection)
  );
};

Billboard.prototype._destroy = function () {
  if (defined(this._customData)) {
    this._billboardCollection._scene.globe._surface.removeTileCustomData(
      this._customData,
    );
    this._customData = undefined;
  }

  if (defined(this._removeCallbackFunc)) {
    this._removeCallbackFunc();
    this._removeCallbackFunc = undefined;
  }

  this.image = undefined;
  this._pickId = this._pickId && this._pickId.destroy();
  this._billboardCollection = undefined;
};

/**
 * 创建图像的函数。
 * @callback Billboard.CreateImageCallback
 * @param {string} id 要加载的图像标识符。
 * @returns {HTMLImageElement|HTMLCanvasElement|Promise<HTMLImageElement|HTMLCanvasElement>} The 图像或将解析为图像的承诺。
 */
export default Billboard;
