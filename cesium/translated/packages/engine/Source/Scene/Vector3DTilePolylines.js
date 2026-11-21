import {
  Cartesian3,
  Color,
  ComponentDatatype,
  Ellipsoid,
  IndexDatatype,
  Matrix4,
  Rectangle,
  defined,
  destroyObject,
} from "@cesium/core";
import TaskProcessor from "../Core/TaskProcessor.js";
import Buffer from "../Renderer/Buffer.js";
import BufferUsage from "../Renderer/BufferUsage.js";
import DrawCommand from "../Renderer/DrawCommand.js";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import ShaderProgram from "../Renderer/ShaderProgram.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import VertexArray from "../Renderer/VertexArray.js";
import PolylineCommon from "../Shaders/PolylineCommon.js";
import Vector3DTilePolylinesVS from "../Shaders/Vector3DTilePolylinesVS.js";
import BlendingState from "./BlendingState.js";
import Cesium3DTileFeature from "./Cesium3DTileFeature.js";

/**
 * 创建一批被细分后用于覆盖地形的多线。
 *
 * @alias Vector3DTilePolylines
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Uint16Array} options.positions 多线的位置。
 * @param {Uint32Array} options.counts 每条多线的点数或位置数。
 * @param {Uint16Array} options.widths 每条多线的宽度。
 * @param {number} options.minimumHeight 瓦片所覆盖的地形的最小高度。
 * @param {number} options.maximumHeight 瓦片所覆盖的地形的最大高度。
 * @param {Rectangle} options.rectangle 包含瓦片的矩形区域。
 * @param {Cartesian3} [options.center=Cartesian3.ZERO] RTC 中心坐标。
 * @param {Cesium3DTileBatchTable} options.batchTable 包含批量多线的瓦片批次表。
 * @param {Uint16Array} options.batchIds 每条多线的批次 ID。
 * @param {BoundingSphere} options.boundingVolume 所有多线批次的边界体积。
 * @param {boolean} options.keepDecodedPositions 是否将解码后的位置保留在内存中。
 *
 * @private
 */
function Vector3DTilePolylines(options) {
  // these arrays are all released after the first update.
  this._positions = options.positions;
  this._widths = options.widths;
  this._counts = options.counts;
  this._batchIds = options.batchIds;

  this._ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
  this._minimumHeight = options.minimumHeight;
  this._maximumHeight = options.maximumHeight;
  this._center = options.center;
  this._rectangle = options.rectangle;

  this._boundingVolume = options.boundingVolume;
  this._batchTable = options.batchTable;

  this._va = undefined;
  this._sp = undefined;
  this._rs = undefined;
  this._uniformMap = undefined;
  this._command = undefined;

  this._transferrableBatchIds = undefined;
  this._packedBuffer = undefined;

  this._keepDecodedPositions = options.keepDecodedPositions;
  this._decodedPositions = undefined;
  this._decodedPositionOffsets = undefined;

  this._currentPositions = undefined;
  this._previousPositions = undefined;
  this._nextPositions = undefined;
  this._expandAndWidth = undefined;
  this._vertexBatchIds = undefined;
  this._indices = undefined;

  this._constantColor = Color.clone(Color.WHITE);
  this._highlightColor = this._constantColor;

  this._trianglesLength = 0;
  this._geometryByteLength = 0;

  this._ready = false;
  this._promise = undefined;
  this._error = undefined;
}

Object.defineProperties(Vector3DTilePolylines.prototype, {
  /**
   * 获取三角形的数量。
   *
   * @memberof Vector3DTilePolylines.prototype
   *
   * @type {number}
   * @readonly
   * @private
   */
  trianglesLength: {
    get: function () {
      return this._trianglesLength;
    },
  },

  /**
   * 获取几何数据的内存大小（以字节为单位）。
   *
   * @memberof Vector3DTilePolylines.prototype
   *
   * @type {number}
   * @readonly
   * @private
   */
  geometryByteLength: {
    get: function () {
      return this._geometryByteLength;
    },
  },

  /**
   * 当原始对象准备好渲染时返回 true。
   * @memberof Vector3DTilePolylines.prototype
   * @type {boolean}
   * @readonly
   * @private
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },
});

function packBuffer(polylines) {
  const rectangle = polylines._rectangle;
  const minimumHeight = polylines._minimumHeight;
  const maximumHeight = polylines._maximumHeight;
  const ellipsoid = polylines._ellipsoid;
  const center = polylines._center;

  const packedLength =
    2 +
    Rectangle.packedLength +
    Ellipsoid.packedLength +
    Cartesian3.packedLength;
  const packedBuffer = new Float64Array(packedLength);

  let offset = 0;
  packedBuffer[offset++] = minimumHeight;
  packedBuffer[offset++] = maximumHeight;

  Rectangle.pack(rectangle, packedBuffer, offset);
  offset += Rectangle.packedLength;

  Ellipsoid.pack(ellipsoid, packedBuffer, offset);
  offset += Ellipsoid.packedLength;

  Cartesian3.pack(center, packedBuffer, offset);

  return packedBuffer;
}

const createVerticesTaskProcessor = new TaskProcessor(
  "createVectorTilePolylines",
  5,
);
const attributeLocations = {
  previousPosition: 0,
  currentPosition: 1,
  nextPosition: 2,
  expandAndWidth: 3,
  a_batchId: 4,
};

function createVertexArray(polylines, context) {
  if (defined(polylines._va)) {
    return;
  }

  let positions = polylines._positions;
  let widths = polylines._widths;
  let counts = polylines._counts;
  let batchIds = polylines._transferrableBatchIds;

  let packedBuffer = polylines._packedBuffer;

  if (!defined(packedBuffer)) {
    // Copy because they may be the views on the same buffer.
    positions = polylines._positions = positions.slice();
    widths = polylines._widths = widths.slice();
    counts = polylines._counts = counts.slice();

    batchIds = polylines._transferrableBatchIds = polylines._batchIds.slice();

    packedBuffer = polylines._packedBuffer = packBuffer(polylines);
  }

  const transferrableObjects = [
    positions.buffer,
    widths.buffer,
    counts.buffer,
    batchIds.buffer,
    packedBuffer.buffer,
  ];
  const parameters = {
    positions: positions.buffer,
    widths: widths.buffer,
    counts: counts.buffer,
    batchIds: batchIds.buffer,
    packedBuffer: packedBuffer.buffer,
    keepDecodedPositions: polylines._keepDecodedPositions,
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
    .then(function (result) {
      if (polylines.isDestroyed()) {
        return;
      }

      if (polylines._keepDecodedPositions) {
        polylines._decodedPositions = new Float64Array(result.decodedPositions);
        polylines._decodedPositionOffsets = new Uint32Array(
          result.decodedPositionOffsets,
        );
      }

      polylines._currentPositions = new Float32Array(result.currentPositions);
      polylines._previousPositions = new Float32Array(result.previousPositions);
      polylines._nextPositions = new Float32Array(result.nextPositions);
      polylines._expandAndWidth = new Float32Array(result.expandAndWidth);
      polylines._vertexBatchIds = new Uint16Array(result.batchIds);

      const indexDatatype = result.indexDatatype;
      polylines._indices =
        indexDatatype === IndexDatatype.UNSIGNED_SHORT
          ? new Uint16Array(result.indices)
          : new Uint32Array(result.indices);

      finishVertexArray(polylines, context);

      polylines._ready = true;
    })
    .catch((error) => {
      if (polylines.isDestroyed()) {
        return;
      }

      // Throw the error next frame
      polylines._error = error;
    });
}

function finishVertexArray(polylines, context) {
  if (!defined(polylines._va)) {
    const curPositions = polylines._currentPositions;
    const prevPositions = polylines._previousPositions;
    const nextPositions = polylines._nextPositions;
    const expandAndWidth = polylines._expandAndWidth;
    const vertexBatchIds = polylines._vertexBatchIds;
    const indices = polylines._indices;

    let byteLength =
      prevPositions.byteLength +
      curPositions.byteLength +
      nextPositions.byteLength;
    byteLength +=
      expandAndWidth.byteLength +
      vertexBatchIds.byteLength +
      indices.byteLength;
    polylines._trianglesLength = indices.length / 3;
    polylines._geometryByteLength = byteLength;

    const prevPositionBuffer = Buffer.createVertexBuffer({
      context: context,
      typedArray: prevPositions,
      usage: BufferUsage.STATIC_DRAW,
    });
    const curPositionBuffer = Buffer.createVertexBuffer({
      context: context,
      typedArray: curPositions,
      usage: BufferUsage.STATIC_DRAW,
    });
    const nextPositionBuffer = Buffer.createVertexBuffer({
      context: context,
      typedArray: nextPositions,
      usage: BufferUsage.STATIC_DRAW,
    });
    const expandAndWidthBuffer = Buffer.createVertexBuffer({
      context: context,
      typedArray: expandAndWidth,
      usage: BufferUsage.STATIC_DRAW,
    });
    const idBuffer = Buffer.createVertexBuffer({
      context: context,
      typedArray: vertexBatchIds,
      usage: BufferUsage.STATIC_DRAW,
    });

    const indexBuffer = Buffer.createIndexBuffer({
      context: context,
      typedArray: indices,
      usage: BufferUsage.STATIC_DRAW,
      indexDatatype:
        indices.BYTES_PER_ELEMENT === 2
          ? IndexDatatype.UNSIGNED_SHORT
          : IndexDatatype.UNSIGNED_INT,
    });

    const vertexAttributes = [
      {
        index: attributeLocations.previousPosition,
        vertexBuffer: prevPositionBuffer,
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
      },
      {
        index: attributeLocations.currentPosition,
        vertexBuffer: curPositionBuffer,
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
      },
      {
        index: attributeLocations.nextPosition,
        vertexBuffer: nextPositionBuffer,
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
      },
      {
        index: attributeLocations.expandAndWidth,
        vertexBuffer: expandAndWidthBuffer,
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
      },
      {
        index: attributeLocations.a_batchId,
        vertexBuffer: idBuffer,
        componentDatatype: ComponentDatatype.UNSIGNED_SHORT,
        componentsPerAttribute: 1,
      },
    ];

    polylines._va = new VertexArray({
      context: context,
      attributes: vertexAttributes,
      indexBuffer: indexBuffer,
    });

    polylines._positions = undefined;
    polylines._widths = undefined;
    polylines._counts = undefined;

    polylines._ellipsoid = undefined;
    polylines._minimumHeight = undefined;
    polylines._maximumHeight = undefined;
    polylines._rectangle = undefined;

    polylines._transferrableBatchIds = undefined;
    polylines._packedBuffer = undefined;

    polylines._currentPositions = undefined;
    polylines._previousPositions = undefined;
    polylines._nextPositions = undefined;
    polylines._expandAndWidth = undefined;
    polylines._vertexBatchIds = undefined;
    polylines._indices = undefined;
  }
}

const modifiedModelViewScratch = new Matrix4();
const rtcScratch = new Cartesian3();

function createUniformMap(primitive, context) {
  if (defined(primitive._uniformMap)) {
    return;
  }

  primitive._uniformMap = {
    u_modifiedModelView: function () {
      const viewMatrix = context.uniformState.view;
      Matrix4.clone(viewMatrix, modifiedModelViewScratch);
      Matrix4.multiplyByPoint(
        modifiedModelViewScratch,
        primitive._center,
        rtcScratch,
      );
      Matrix4.setTranslation(
        modifiedModelViewScratch,
        rtcScratch,
        modifiedModelViewScratch,
      );
      return modifiedModelViewScratch;
    },
    u_highlightColor: function () {
      return primitive._highlightColor;
    },
  };
}

function createRenderStates(primitive) {
  if (defined(primitive._rs)) {
    return;
  }

  const polygonOffset = {
    enabled: true,
    factor: -5.0,
    units: -5.0,
  };

  primitive._rs = RenderState.fromCache({
    blending: BlendingState.ALPHA_BLEND,
    depthMask: false,
    depthTest: {
      enabled: true,
    },
    polygonOffset: polygonOffset,
  });
}

const PolylineFS =
  "uniform vec4 u_highlightColor; \n" +
  "void main()\n" +
  "{\n" +
  "    out_FragColor = u_highlightColor;\n" +
  "}\n";

function createShaders(primitive, context) {
  if (defined(primitive._sp)) {
    return;
  }

  const batchTable = primitive._batchTable;

  const vsSource = batchTable.getVertexShaderCallback(
    false,
    "a_batchId",
    undefined,
  )(Vector3DTilePolylinesVS);
  const fsSource = batchTable.getFragmentShaderCallback(
    false,
    undefined,
    false,
  )(PolylineFS);

  const vs = new ShaderSource({
    defines: ["VECTOR_TILE", "CLIP_POLYLINE"],
    sources: [PolylineCommon, vsSource],
  });
  const fs = new ShaderSource({
    defines: ["VECTOR_TILE"],
    sources: [fsSource],
  });

  primitive._sp = ShaderProgram.fromCache({
    context: context,
    vertexShaderSource: vs,
    fragmentShaderSource: fs,
    attributeLocations: attributeLocations,
  });
}

function queueCommands(primitive, frameState) {
  if (!defined(primitive._command)) {
    const uniformMap = primitive._batchTable.getUniformMapCallback()(
      primitive._uniformMap,
    );
    primitive._command = new DrawCommand({
      owner: primitive,
      vertexArray: primitive._va,
      renderState: primitive._rs,
      shaderProgram: primitive._sp,
      uniformMap: uniformMap,
      boundingVolume: primitive._boundingVolume,
      pass: Pass.TRANSLUCENT,
      pickId: primitive._batchTable.getPickId(),
    });
  }

  frameState.commandList.push(primitive._command);
}

Vector3DTilePolylines.getPolylinePositions = function (polylines, batchId) {
  const batchIds = polylines._batchIds;
  const positions = polylines._decodedPositions;
  const offsets = polylines._decodedPositionOffsets;

  if (!defined(batchIds) || !defined(positions)) {
    return undefined;
  }

  let i;
  let j;
  const polylinesLength = batchIds.length;
  let positionsLength = 0;
  let resultCounter = 0;

  for (i = 0; i < polylinesLength; ++i) {
    if (batchIds[i] === batchId) {
      positionsLength += offsets[i + 1] - offsets[i];
    }
  }

  if (positionsLength === 0) {
    return undefined;
  }

  const results = new Float64Array(positionsLength * 3);

  for (i = 0; i < polylinesLength; ++i) {
    if (batchIds[i] === batchId) {
      const offset = offsets[i];
      const count = offsets[i + 1] - offset;
      for (j = 0; j < count; ++j) {
        const decodedOffset = (offset + j) * 3;
        results[resultCounter++] = positions[decodedOffset];
        results[resultCounter++] = positions[decodedOffset + 1];
        results[resultCounter++] = positions[decodedOffset + 2];
      }
    }
  }

  return results;
};

/**
 * 获取给定要素的多线位置。
 *
 * @param {number} batchId 要素的批次 ID。
 */
Vector3DTilePolylines.prototype.getPositions = function (batchId) {
  return Vector3DTilePolylines.getPolylinePositions(this, batchId);
};

/**
 * 为每条多线创建要素，并将其放置在对应批次 ID 的位置。
 *
 * @param {Vector3DTileContent} content 矢量瓦片内容。
 * @param {Cesium3DTileFeature[]} features 用于放置多边形要素的要素数组。
 */
Vector3DTilePolylines.prototype.createFeatures = function (content, features) {
  const batchIds = this._batchIds;
  const length = batchIds.length;
  for (let i = 0; i < length; ++i) {
    const batchId = batchIds[i];
    features[batchId] = new Cesium3DTileFeature(content, batchId);
  }
};

/**
 * 当启用时，为整个瓦片着色。最终颜色为（多线批次表颜色 * 颜色）。
 *
 * @param {boolean} enabled 是否启用调试着色。
 * @param {Color} color 调试颜色。
 */
Vector3DTilePolylines.prototype.applyDebugSettings = function (enabled, color) {
  this._highlightColor = enabled ? color : this._constantColor;
};

function clearStyle(polygons, features) {
  const batchIds = polygons._batchIds;
  const length = batchIds.length;
  for (let i = 0; i < length; ++i) {
    const batchId = batchIds[i];
    const feature = features[batchId];

    feature.show = true;
    feature.color = Color.WHITE;
  }
}

const scratchColor = new Color();

const DEFAULT_COLOR_VALUE = Color.WHITE;
const DEFAULT_SHOW_VALUE = true;

/**
 * 对内容应用样式。
 *
 * @param {Cesium3DTileStyle} style 样式设置。
 * @param {Cesium3DTileFeature[]} features 要素数组。
 */
Vector3DTilePolylines.prototype.applyStyle = function (style, features) {
  if (!defined(style)) {
    clearStyle(this, features);
    return;
  }

  const batchIds = this._batchIds;
  const length = batchIds.length;
  for (let i = 0; i < length; ++i) {
    const batchId = batchIds[i];
    const feature = features[batchId];

    feature.color = defined(style.color)
      ? style.color.evaluateColor(feature, scratchColor)
      : DEFAULT_COLOR_VALUE;
    feature.show = defined(style.show)
      ? style.show.evaluate(feature)
      : DEFAULT_SHOW_VALUE;
  }
};

/**
 * 更新批次并排队渲染命令。
 *
 * @param {FrameState} frameState 当前帧状态。
 */
Vector3DTilePolylines.prototype.update = function (frameState) {
  const context = frameState.context;
  if (!this._ready) {
    if (!defined(this._promise)) {
      this._promise = createVertexArray(this, context);
    }

    if (defined(this._error)) {
      const error = this._error;
      this._error = undefined;
      throw error;
    }

    return;
  }

  createUniformMap(this, context);
  createShaders(this, context);
  createRenderStates(this);

  const passes = frameState.passes;
  if (passes.render || passes.pick) {
    queueCommands(this, frameState);
  }
};

/**
 * 如果此对象被销毁，返回 true；否则返回 false。
 * <p>
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，返回 <code>false</code>；否则返回 <code>true</code>。
 */
Vector3DTilePolylines.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而无需依赖垃圾收集器来销毁该对象。
 * 一旦对象被销毁，不应使用它；调用除
 * <p>
 * Once an object is destroyed, it should not be used; calling any function other than
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * </p>
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 */
Vector3DTilePolylines.prototype.destroy = function () {
  this._va = this._va && this._va.destroy();
  this._sp = this._sp && this._sp.destroy();
  return destroyObject(this);
};
export default Vector3DTilePolylines;
