import {
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  Ellipsoid,
  NearFarScalar,
  Rectangle,
  defined,
  destroyObject,
} from "@cesium/core";
import TaskProcessor from "../Core/TaskProcessor.js";
import BillboardCollection from "./BillboardCollection.js";
import Cesium3DTilePointFeature from "./Cesium3DTilePointFeature.js";
import HorizontalOrigin from "./HorizontalOrigin.js";
import LabelCollection from "./LabelCollection.js";
import LabelStyle from "./LabelStyle.js";
import PolylineCollection from "./PolylineCollection.js";
import VerticalOrigin from "./VerticalOrigin.js";
import HeightReference from "./HeightReference.js";

/**
 * 创建一组点或广告牌及标签。
 *
 * @alias Vector3DTilePoints
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Uint16Array} options.positions 多边形的位置。
 * @param {number} options.minimumHeight 瓦片所覆盖的地形的最小高度。
 * @param {number} options.maximumHeight 瓦片所覆盖的地形的最大高度。
 * @param {Rectangle} options.rectangle 包含瓦片的矩形区域。
 * @param {HeightReference} options.heightReference 确定广告牌和标签特征相对于地形或 3D 瓦片的位置。
 * @param {Cesium3DTileBatchTable} options.batchTable 包含批量多边形的瓦片表。
 * @param {Uint16Array} options.batchIds 每个多边形的批量 ID。
 * @param {Scene} options.scene  Cesium Viewer {@link Scene}。这是用于使用 {@link HeightReference} 限制广告牌和标签所需的。
 *
 * @private
 */
function Vector3DTilePoints(options) {
  // released after the first update
  this._positions = options.positions;

  this._batchTable = options.batchTable;
  this._batchIds = options.batchIds;

  this._rectangle = options.rectangle;
  this._minHeight = options.minimumHeight;
  this._maxHeight = options.maximumHeight;
  this._heightReference = options.heightReference;

  this._billboardCollection = new BillboardCollection({
    batchTable: options.batchTable,
    scene: options.scene,
  });
  this._labelCollection = new LabelCollection({
    batchTable: options.batchTable,
    scene: options.scene,
  });
  this._polylineCollection = new PolylineCollection();
  this._polylineCollection._useHighlightColor = true;

  this._packedBuffer = undefined;

  this._ready = false;
  this._promise = undefined;
  this._error = undefined;
}

Object.defineProperties(Vector3DTilePoints.prototype, {
  /**
   * 如果点已准备好渲染，则返回 true。
   *
   * @memberof Vector3DTilePoints.prototype
   *
   * @type {boolean}
   * @readonly
   * @private
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },

  /**
   * 获取点的数量。
   *
   * @memberof Vector3DTilePoints.prototype
   *
   * @type {number}
   * @readonly
   * @private
   */
  pointsLength: {
    get: function () {
      return this._billboardCollection.length;
    },
  },

  /**
   * 获取纹理图集的字节数。
   *
   * @memberof Vector3DTilePoints.prototype
   *
   * @type {number}
   * @readonly
   * @private
   */
  texturesByteLength: {
    get: function () {
      const billboardSize = this._billboardCollection.sizeInBytes;
      const labelSize = this._labelCollection.sizeInBytes;
      return billboardSize + labelSize;
    },
  },
});

function packBuffer(points, ellipsoid) {
  const rectangle = points._rectangle;
  const minimumHeight = points._minHeight;
  const maximumHeight = points._maxHeight;

  const packedLength = 2 + Rectangle.packedLength + Ellipsoid.packedLength;
  const packedBuffer = new Float64Array(packedLength);

  let offset = 0;
  packedBuffer[offset++] = minimumHeight;
  packedBuffer[offset++] = maximumHeight;

  Rectangle.pack(rectangle, packedBuffer, offset);
  offset += Rectangle.packedLength;

  Ellipsoid.pack(ellipsoid, packedBuffer, offset);

  return packedBuffer;
}

const createVerticesTaskProcessor = new TaskProcessor(
  "createVectorTilePoints",
  5,
);
const scratchPosition = new Cartesian3();

function createPoints(points, ellipsoid) {
  let positions = points._positions;
  let packedBuffer = points._packedBuffer;

  if (!defined(packedBuffer)) {
    // Copy because they may be the views on the same buffer.
    positions = points._positions = positions.slice();
    points._batchIds = points._batchIds.slice();

    packedBuffer = points._packedBuffer = packBuffer(points, ellipsoid);
  }

  const transferrableObjects = [positions.buffer, packedBuffer.buffer];
  const parameters = {
    positions: positions.buffer,
    packedBuffer: packedBuffer.buffer,
  };

  const verticesPromise = createVerticesTaskProcessor.scheduleTask(
    parameters,
    transferrableObjects,
  );
  if (!defined(verticesPromise)) {
    // Postponed
    return;
  }

  return verticesPromise
    .then((result) => {
      if (points.isDestroyed()) {
        return;
      }

      points._positions = new Float64Array(result.positions);
      const billboardCollection = points._billboardCollection;
      const labelCollection = points._labelCollection;
      const polylineCollection = points._polylineCollection;
      positions = points._positions;
      const batchIds = points._batchIds;
      const numberOfPoints = positions.length / 3;

      const heightReference = points._heightReference ?? HeightReference.NONE;

      for (let i = 0; i < numberOfPoints; ++i) {
        const id = batchIds[i];

        const position = Cartesian3.unpack(positions, i * 3, scratchPosition);

        const b = billboardCollection.add();
        b.position = position;
        b._batchIndex = id;
        b.heightReference = heightReference;

        const l = labelCollection.add();
        l.text = " ";
        l.position = position;
        l._batchIndex = id;
        l.heightReference = heightReference;

        const p = polylineCollection.add();
        p.positions = [Cartesian3.clone(position), Cartesian3.clone(position)];
      }

      points._positions = undefined;
      points._packedBuffer = undefined;
      points._ready = true;
    })
    .catch((error) => {
      if (points.isDestroyed()) {
        return;
      }

      // Throw the error next frame
      points._error = error;
    });
}

/**
 * 为每个点创建特征，并将其放置在特征批量 ID 索引处。
 *
 * @param {Vector3DTileContent} content 向量瓦片内容。
 * @param {Cesium3DTileFeature[]} features 放置点特征的特征数组。
 */
Vector3DTilePoints.prototype.createFeatures = function (content, features) {
  const billboardCollection = this._billboardCollection;
  const labelCollection = this._labelCollection;
  const polylineCollection = this._polylineCollection;

  const batchIds = this._batchIds;
  const length = batchIds.length;
  for (let i = 0; i < length; ++i) {
    const batchId = batchIds[i];

    const billboard = billboardCollection.get(i);
    const label = labelCollection.get(i);
    const polyline = polylineCollection.get(i);

    features[batchId] = new Cesium3DTilePointFeature(
      content,
      batchId,
      billboard,
      label,
      polyline,
    );
  }
};

/**
 * 当启用时给整个瓦片着色。最终颜色为 (批量表颜色 * 颜色)。
 *
 * @param {boolean} enabled 是否启用调试着色。
 * @param {Color} color 调试颜色。
 */
Vector3DTilePoints.prototype.applyDebugSettings = function (enabled, color) {
  if (enabled) {
    Color.clone(color, this._billboardCollection._highlightColor);
    Color.clone(color, this._labelCollection._highlightColor);
    Color.clone(color, this._polylineCollection._highlightColor);
  } else {
    Color.clone(Color.WHITE, this._billboardCollection._highlightColor);
    Color.clone(Color.WHITE, this._labelCollection._highlightColor);
    Color.clone(Color.WHITE, this._polylineCollection._highlightColor);
  }
};

function clearStyle(polygons, features) {
  const batchIds = polygons._batchIds;
  const length = batchIds.length;
  for (let i = 0; i < length; ++i) {
    const batchId = batchIds[i];
    const feature = features[batchId];

    feature.show = true;
    feature.pointSize = Cesium3DTilePointFeature.defaultPointSize;
    feature.color = Cesium3DTilePointFeature.defaultColor;
    feature.pointOutlineColor =
      Cesium3DTilePointFeature.defaultPointOutlineColor;
    feature.pointOutlineWidth =
      Cesium3DTilePointFeature.defaultPointOutlineWidth;
    feature.labelColor = Color.WHITE;
    feature.labelOutlineColor = Color.WHITE;
    feature.labelOutlineWidth = 1.0;
    feature.font = "30px sans-serif";
    feature.labelStyle = LabelStyle.FILL;
    feature.labelText = undefined;
    feature.backgroundColor = new Color(0.165, 0.165, 0.165, 0.8);
    feature.backgroundPadding = new Cartesian2(7, 5);
    feature.backgroundEnabled = false;
    feature.scaleByDistance = undefined;
    feature.translucencyByDistance = undefined;
    feature.distanceDisplayCondition = undefined;
    feature.heightOffset = 0.0;
    feature.anchorLineEnabled = false;
    feature.anchorLineColor = Color.WHITE;
    feature.image = undefined;
    feature.disableDepthTestDistance = 0.0;
    feature.horizontalOrigin = HorizontalOrigin.CENTER;
    feature.verticalOrigin = VerticalOrigin.CENTER;
    feature.labelHorizontalOrigin = HorizontalOrigin.RIGHT;
    feature.labelVerticalOrigin = VerticalOrigin.BASELINE;
  }
}

const scratchColor = new Color();
const scratchColor2 = new Color();
const scratchColor3 = new Color();
const scratchColor4 = new Color();
const scratchColor5 = new Color();
const scratchColor6 = new Color();
const scratchScaleByDistance = new NearFarScalar();
const scratchTranslucencyByDistance = new NearFarScalar();
const scratchDistanceDisplayCondition = new DistanceDisplayCondition();

/**
 * 对内容应用样式。
 *
 * @param {Cesium3DTileStyle} style 样式。
 * @param {Cesium3DTileFeature[]} features 特征数组。
 */
Vector3DTilePoints.prototype.applyStyle = function (style, features) {
  if (!defined(style)) {
    clearStyle(this, features);
    return;
  }

  const batchIds = this._batchIds;
  const length = batchIds.length;
  for (let i = 0; i < length; ++i) {
    const batchId = batchIds[i];
    const feature = features[batchId];

    if (defined(style.show)) {
      feature.show = style.show.evaluate(feature);
    }

    if (defined(style.pointSize)) {
      feature.pointSize = style.pointSize.evaluate(feature);
    }

    if (defined(style.color)) {
      feature.color = style.color.evaluateColor(feature, scratchColor);
    }

    if (defined(style.pointOutlineColor)) {
      feature.pointOutlineColor = style.pointOutlineColor.evaluateColor(
        feature,
        scratchColor2,
      );
    }

    if (defined(style.pointOutlineWidth)) {
      feature.pointOutlineWidth = style.pointOutlineWidth.evaluate(feature);
    }

    if (defined(style.labelColor)) {
      feature.labelColor = style.labelColor.evaluateColor(
        feature,
        scratchColor3,
      );
    }

    if (defined(style.labelOutlineColor)) {
      feature.labelOutlineColor = style.labelOutlineColor.evaluateColor(
        feature,
        scratchColor4,
      );
    }

    if (defined(style.labelOutlineWidth)) {
      feature.labelOutlineWidth = style.labelOutlineWidth.evaluate(feature);
    }

    if (defined(style.font)) {
      feature.font = style.font.evaluate(feature);
    }

    if (defined(style.labelStyle)) {
      feature.labelStyle = style.labelStyle.evaluate(feature);
    }

    if (defined(style.labelText)) {
      feature.labelText = style.labelText.evaluate(feature);
    } else {
      feature.labelText = undefined;
    }

    if (defined(style.backgroundColor)) {
      feature.backgroundColor = style.backgroundColor.evaluateColor(
        feature,
        scratchColor5,
      );
    }

    if (defined(style.backgroundPadding)) {
      feature.backgroundPadding = style.backgroundPadding.evaluate(feature);
    }

    if (defined(style.backgroundEnabled)) {
      feature.backgroundEnabled = style.backgroundEnabled.evaluate(feature);
    }

    if (defined(style.scaleByDistance)) {
      const scaleByDistanceCart4 = style.scaleByDistance.evaluate(feature);
      if (defined(scaleByDistanceCart4)) {
        scratchScaleByDistance.near = scaleByDistanceCart4.x;
        scratchScaleByDistance.nearValue = scaleByDistanceCart4.y;
        scratchScaleByDistance.far = scaleByDistanceCart4.z;
        scratchScaleByDistance.farValue = scaleByDistanceCart4.w;
        feature.scaleByDistance = scratchScaleByDistance;
      } else {
        feature.scaleByDistance = undefined;
      }
    } else {
      feature.scaleByDistance = undefined;
    }

    if (defined(style.translucencyByDistance)) {
      const translucencyByDistanceCart4 =
        style.translucencyByDistance.evaluate(feature);
      if (defined(translucencyByDistanceCart4)) {
        scratchTranslucencyByDistance.near = translucencyByDistanceCart4.x;
        scratchTranslucencyByDistance.nearValue = translucencyByDistanceCart4.y;
        scratchTranslucencyByDistance.far = translucencyByDistanceCart4.z;
        scratchTranslucencyByDistance.farValue = translucencyByDistanceCart4.w;
        feature.translucencyByDistance = scratchTranslucencyByDistance;
      } else {
        feature.translucencyByDistance = undefined;
      }
    } else {
      feature.translucencyByDistance = undefined;
    }

    if (defined(style.distanceDisplayCondition)) {
      const distanceDisplayConditionCart2 =
        style.distanceDisplayCondition.evaluate(feature);
      if (defined(distanceDisplayConditionCart2)) {
        scratchDistanceDisplayCondition.near = distanceDisplayConditionCart2.x;
        scratchDistanceDisplayCondition.far = distanceDisplayConditionCart2.y;
        feature.distanceDisplayCondition = scratchDistanceDisplayCondition;
      } else {
        feature.distanceDisplayCondition = undefined;
      }
    } else {
      feature.distanceDisplayCondition = undefined;
    }

    if (defined(style.heightOffset)) {
      feature.heightOffset = style.heightOffset.evaluate(feature);
    }

    if (defined(style.anchorLineEnabled)) {
      feature.anchorLineEnabled = style.anchorLineEnabled.evaluate(feature);
    }

    if (defined(style.anchorLineColor)) {
      feature.anchorLineColor = style.anchorLineColor.evaluateColor(
        feature,
        scratchColor6,
      );
    }

    if (defined(style.image)) {
      feature.image = style.image.evaluate(feature);
    } else {
      feature.image = undefined;
    }

    if (defined(style.disableDepthTestDistance)) {
      feature.disableDepthTestDistance =
        style.disableDepthTestDistance.evaluate(feature);
    }

    if (defined(style.horizontalOrigin)) {
      feature.horizontalOrigin = style.horizontalOrigin.evaluate(feature);
    }

    if (defined(style.verticalOrigin)) {
      feature.verticalOrigin = style.verticalOrigin.evaluate(feature);
    }

    if (defined(style.labelHorizontalOrigin)) {
      feature.labelHorizontalOrigin =
        style.labelHorizontalOrigin.evaluate(feature);
    }

    if (defined(style.labelVerticalOrigin)) {
      feature.labelVerticalOrigin = style.labelVerticalOrigin.evaluate(feature);
    }
  }
};

/**
 * @private
 */
Vector3DTilePoints.prototype.update = function (frameState) {
  if (!this._ready) {
    if (!defined(this._promise)) {
      this._promise = createPoints(this, frameState.mapProjection.ellipsoid);
    }

    if (defined(this._error)) {
      const error = this._error;
      this._error = undefined;
      throw error;
    }
  }

  this._polylineCollection.update(frameState);
  this._billboardCollection.update(frameState);
  this._labelCollection.update(frameState);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <p>
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>true</code>。
 */
Vector3DTilePoints.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性的
 * WebGL 资源释放，而不是依赖垃圾收集器来销毁此对象。
 * <p>
 * 一旦对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * </p>
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 */
Vector3DTilePoints.prototype.destroy = function () {
  this._billboardCollection =
    this._billboardCollection && this._billboardCollection.destroy();
  this._labelCollection =
    this._labelCollection && this._labelCollection.destroy();
  this._polylineCollection =
    this._polylineCollection && this._polylineCollection.destroy();
  return destroyObject(this);
};
export default Vector3DTilePoints;
