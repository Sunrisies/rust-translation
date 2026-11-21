import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Cartographic,
  Color,
  ComponentDatatype,
  DeveloperError,
  EncodedCartesian3,
  Frozen,
  IndexDatatype,
  Intersect,
  Math as CesiumMath,
  Matrix4,
  Plane,
  RuntimeError,
  combine,
  defined,
  destroyObject,
} from "@cesium/core";
import Buffer from "../Renderer/Buffer.js";
import BufferUsage from "../Renderer/BufferUsage.js";
import ContextLimits from "../Renderer/ContextLimits.js";
import DrawCommand from "../Renderer/DrawCommand.js";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import ShaderProgram from "../Renderer/ShaderProgram.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import Texture from "../Renderer/Texture.js";
import VertexArray from "../Renderer/VertexArray.js";
import PolylineCommon from "../Shaders/PolylineCommon.js";
import PolylineFS from "../Shaders/PolylineFS.js";
import PolylineVS from "../Shaders/PolylineVS.js";
import BatchTable from "./BatchTable.js";
import BlendingState from "./BlendingState.js";
import Material from "./Material.js";
import Polyline from "./Polyline.js";
import SceneMode from "./SceneMode.js";

const SHOW_INDEX = Polyline.SHOW_INDEX;
const WIDTH_INDEX = Polyline.WIDTH_INDEX;
const POSITION_INDEX = Polyline.POSITION_INDEX;
const MATERIAL_INDEX = Polyline.MATERIAL_INDEX;
//POSITION_SIZE_INDEX is needed for when the polyline's position array changes size.
//When it does, we need to recreate the indicesBuffer.
const POSITION_SIZE_INDEX = Polyline.POSITION_SIZE_INDEX;
const DISTANCE_DISPLAY_CONDITION = Polyline.DISTANCE_DISPLAY_CONDITION;
const NUMBER_OF_PROPERTIES = Polyline.NUMBER_OF_PROPERTIES;

const attributeLocations = {
  texCoordExpandAndBatchIndex: 0,
  position3DHigh: 1,
  position3DLow: 2,
  position2DHigh: 3,
  position2DLow: 4,
  prevPosition3DHigh: 5,
  prevPosition3DLow: 6,
  prevPosition2DHigh: 7,
  prevPosition2DLow: 8,
  nextPosition3DHigh: 9,
  nextPosition3DLow: 10,
  nextPosition2DHigh: 11,
  nextPosition2DLow: 12,
};

/**
 * 一个可渲染的多线集合。
 * <br /><br />
 * <div align="center">
 * <img src="Images/Polyline.png" width="400" height="300" /><br />
 * 示例多线
 * </div>
 * <br /><br />
 * 使用 {@link PolylineCollection#add} 添加和移除集合中的多线。
 * 以及 {@link PolylineCollection#remove}。
 *
 * @alias PolylineCollection
 * @constructor
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 将每条多线从模型坐标转换为世界坐标的 4x4 变换矩阵。
 * @param {boolean} [options.debugShowBoundingVolume=false] 仅用于调试。决定该原语的命令边界球是否显示。
 * @param {boolean} [options.show=true] 决定集合中的多线是否显示。
 *
 * @performance For 最佳性能情况下，建议使用少量集合，每个集合包含许多多线。
 * 而多个集合每个只包含少量多线。组织集合时，将具有相同更新频率的多线放在同一集合中，即不
 * 应变化的多线应放在一个集合中；每帧都变化的多线应放在另一个集合中。
 * 等等。
 * // 创建一个包含两条多线的集合
 *
 * @see PolylineCollection#add
 * @see PolylineCollection#remove
 * @see Polyline
 * @see LabelCollection
 *
 * @example
 * const polylines = new Cesium.PolylineCollection();
 * polylines.add({
 * positions : Cesium.Cartesian3.fromDegreesArray([
 * width : 2
 *     -75.10, 39.57,
 *     -77.02, 38.53,
 *     -80.50, 35.14,
 *     -80.12, 25.46]),
 * polylines.add({
 * });
 *
 * positions : Cesium.Cartesian3.fromDegreesArray([
 * width : 4
 *     -73.10, 37.57,
 *     -75.02, 36.53,
 *     -78.50, 33.14,
 *     -78.12, 23.46]),
 * 决定集合中的多线是否显示。
 * });
 */
function PolylineCollection(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 将集合中的每条多线从模型坐标转换为世界坐标的 4x4 变换矩阵。
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  /**
   * 当此矩阵为单位矩阵时，多线以世界坐标绘制，即地球 WGS84 坐标。
   * 通过提供不同的变换矩阵，如 {@link Transforms.eastNorthUpToFixedFrame} 返回的矩阵，可以使用本地参考框架。
   * 此属性仅用于调试；不用于生产环境，也未经过优化。
   * by {@link Transforms.eastNorthUpToFixedFrame}.
   *
   * @type {Matrix4}
   * @default {@link Matrix4.IDENTITY}
   */
  this.modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);
  this._modelMatrix = Matrix4.clone(Matrix4.IDENTITY);

  /**
   * 返回集合中的多线数量。通常与
   * <p>
   * {@link PolylineCollection#get} 一起使用，以遍历集合中的所有多线。
   * </p>
   *
   * @type {boolean}
   *
   * @default false
   */
  this.debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;

  this._opaqueRS = undefined;
  this._translucentRS = undefined;

  this._colorCommands = [];

  this._polylinesUpdated = false;
  this._polylinesRemoved = false;
  this._createVertexArray = false;
  this._propertiesChanged = new Uint32Array(NUMBER_OF_PROPERTIES);
  this._polylines = [];
  this._polylineBuckets = {};

  // The buffer usage is determined based on the usage of the attribute over time.
  this._positionBufferUsage = {
    bufferUsage: BufferUsage.STATIC_DRAW,
    frameCount: 0,
  };

  this._mode = undefined;

  this._polylinesToUpdate = [];
  this._vertexArrays = [];
  this._positionBuffer = undefined;
  this._texCoordExpandAndBatchIndexBuffer = undefined;

  this._batchTable = undefined;
  this._createBatchTable = false;

  // Only used by Vector3DTilePoints
  this._useHighlightColor = false;
  this._highlightColor = Color.clone(Color.WHITE);

  const that = this;
  this._uniformMap = {
    u_highlightColor: function () {
      return that._highlightColor;
    },
  };
}

Object.defineProperties(PolylineCollection.prototype, {
  /**
   * 创建并添加具有指定初始属性的多线到集合中。
   * {@link PolylineCollection#get} to iterate over all the polylines
   * 调用 <code>add</code>，则 {@link PolylineCollection#update} 会被调用。
   * @memberof PolylineCollection.prototype
   * @type {number}
   */
  length: {
    get: function () {
      removePolylines(this);
      return this._polylines.length;
    },
  },
});

/**
     * Creates and adds a polyline with the specified initial properties to the collection.
     * The added polyline is returned so it can be modified or removed from the collection later.
     *
     * @param {object}[options] A template describing the polyline's properties as shown in Example 1.
     * @returns {Polyline} The polyline that was added to the collection.
     *
     * @performance After calling <code>add</code>, {@link PolylineCollection#update} is called and
     * 集合的顶点缓冲区被重写——这是一个 <code>O(n)</code> 操作，还会产生 CPU 到 GPU 的开销。
     * 为了获得最佳性能，在调用 <code>update</code> 之前尽可能添加更多的多线。
     *
     * @exception {DeveloperError} This 对象被销毁，即调用了 destroy()。
     *
     *
     * @example
     * // 示例 1：添加一条多线，指定所有默认值。
     * const p = polylines.add({
     * show : true,
     * positions : ellipsoid.cartographicArrayToCartesianArray([
           Cesium.Cartographic.fromDegrees(-75.10, 39.57),
           Cesium.Cartographic.fromDegrees(-77.02, 38.53)]),
     * width : 1
     * });
     *
     * @see PolylineCollection#remove
     * @see PolylineCollection#removeAll
     * @see PolylineCollection#update
     */
PolylineCollection.prototype.add = function (options) {
  const p = new Polyline(options, this);
  p._index = this._polylines.length;
  this._polylines.push(p);
  this._createVertexArray = true;
  this._createBatchTable = true;
  return p;
};

/**
 * 从集合中移除一条多线。
 *
 * @param {Polyline} polyline 要移除的多线。
 * @returns {boolean} <code>true</code> 如果多线被移除；如果多线不在集合中则返回 <code>false</code>。
 *
 * @performance After 调用 <code>remove</code>，会调用 {@link PolylineCollection#update}，并且
 * 集合的顶点缓冲区被重写——这是一个 <code>O(n)</code> 操作，还会产生 CPU 到 GPU 的开销。
 * 为了获得最佳性能，在调用 <code>update</code> 之前尽可能移除更多的多线。
 * 如果您打算暂时隐藏一条多线，通常更高效的做法是调用
 * {@link Polyline#show} 而不是移除并重新添加该多线。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy()。
 *
 *
 * @example
 * const p = polylines.add(...);
 * polylines.remove(p);  // 返回 true
 *
 * @see PolylineCollection#add
 * @see PolylineCollection#removeAll
 * @see PolylineCollection#update
 * @see Polyline#show
 */
PolylineCollection.prototype.remove = function (polyline) {
  if (this.contains(polyline)) {
    this._polylinesRemoved = true;
    this._createVertexArray = true;
    this._createBatchTable = true;
    if (defined(polyline._bucket)) {
      const bucket = polyline._bucket;
      bucket.shaderProgram =
        bucket.shaderProgram && bucket.shaderProgram.destroy();
    }
    polyline._destroy();
    return true;
  }

  return false;
};

/**
 * 从集合中移除所有多线。
 *
 * @performance <code>O(n)</code>.  移除集合中的所有多线后再添加新多线比完全创建新集合更高效。
 * 对象被销毁，即调用了 destroy()。
 *
 * @exception {DeveloperError} This polylines.add(...);
 *
 *
 * @example
 * polylines.add(...);
 * polylines.add(...);
 * polylines.removeAll();
 *
 * @see PolylineCollection#add
 * @see PolylineCollection#remove
 * @see PolylineCollection#update
 */
PolylineCollection.prototype.removeAll = function () {
  releaseShaders(this);
  destroyPolylines(this);
  this._polylineBuckets = {};
  this._polylinesRemoved = false;
  this._polylines.length = 0;
  this._polylinesToUpdate.length = 0;
  this._createVertexArray = true;
};

/**
 * 判断此集合是否包含指定的多线。
 *
 * @param {Polyline} polyline 要检查的多线。
 * @returns {boolean} true 如果此集合包含该多线，返回 false，否则返回 true。
 *
 * @see PolylineCollection#get
 */
PolylineCollection.prototype.contains = function (polyline) {
  return defined(polyline) && polyline._polylineCollection === this;
};

/**
 * 返回集合中指定索引处的多线。索引从零开始
 * 并且随着多线的添加而增加。移除一条多线会将所有多线在
 * 其左侧移动，改变它们的索引。此函数通常与
 * {@link PolylineCollection#length} 一起使用，以遍历集合中的所有多线。
 * 该多线的零基索引。
 *
 * @param {number} index 指定索引处的多线。
 * @returns {Polyline} The 指定索引处的多线。
 *
 * @performance If 多线从集合中被移除并且
 * 未调用 {@link PolylineCollection#update}，则执行一个隐式的 <code>O(n)</code>
 * 操作。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy()。
 *
 * @example
 * // 切换集合中每条多线的 show 属性
 * const len = polylines.length;
 * for (let i = 0; i < len; ++i) {
 * const p = polylines.get(i);
 * p.show = !p.show;
 * }
 *
 * @see PolylineCollection#length
 */
PolylineCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index)) {
    throw new DeveloperError("index is required.");
  }
  //>>includeEnd('debug');

  removePolylines(this);
  return this._polylines[index];
};

function createBatchTable(collection, context) {
  if (defined(collection._batchTable)) {
    collection._batchTable.destroy();
  }

  const attributes = [
    {
      functionName: "batchTable_getWidthAndShow",
      componentDatatype: ComponentDatatype.UNSIGNED_BYTE,
      componentsPerAttribute: 2,
    },
    {
      functionName: "batchTable_getPickColor",
      componentDatatype: ComponentDatatype.UNSIGNED_BYTE,
      componentsPerAttribute: 4,
      normalize: true,
    },
    {
      functionName: "batchTable_getCenterHigh",
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: 3,
    },
    {
      functionName: "batchTable_getCenterLowAndRadius",
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: 4,
    },
    {
      functionName: "batchTable_getDistanceDisplayCondition",
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: 2,
    },
  ];

  collection._batchTable = new BatchTable(
    context,
    attributes,
    collection._polylines.length,
  );
}

const scratchUpdatePolylineEncodedCartesian = new EncodedCartesian3();
const scratchUpdatePolylineCartesian4 = new Cartesian4();
const scratchNearFarCartesian2 = new Cartesian2();

/**
 * 在 {@link Viewer} 或 {@link CesiumWidget} 将场景渲染时调用
 * 以获取渲染此基本体所需的绘制命令。
 * <p>
 * 请勿直接调用此函数。此处记录此信息只是为了
 * 列出在场景渲染时可能传播的异常：
 * </p>
 *
 * @exception {RuntimeError} Vertex 需要纹理获取支持来渲染具有实例属性的基本体。顶点纹理图像单元的最大数量必须大于零。
 */
PolylineCollection.prototype.update = function (frameState) {
  removePolylines(this);

  if (this._polylines.length === 0 || !this.show) {
    return;
  }

  updateMode(this, frameState);

  const context = frameState.context;
  const projection = frameState.mapProjection;
  let polyline;
  let properties = this._propertiesChanged;

  if (this._createBatchTable) {
    if (ContextLimits.maximumVertexTextureImageUnits === 0) {
      throw new RuntimeError(
        "Vertex texture fetch support is required to render polylines. The maximum number of vertex texture image units must be greater than zero.",
      );
    }
    createBatchTable(this, context);
    this._createBatchTable = false;
  }

  if (this._createVertexArray || computeNewBuffersUsage(this)) {
    createVertexArrays(this, context, projection);
  } else if (this._polylinesUpdated) {
    // Polylines were modified, but no polylines were added or removed.
    const polylinesToUpdate = this._polylinesToUpdate;
    if (this._mode !== SceneMode.SCENE3D) {
      const updateLength = polylinesToUpdate.length;
      for (let i = 0; i < updateLength; ++i) {
        polyline = polylinesToUpdate[i];
        polyline.update();
      }
    }

    // if a polyline's positions size changes, we need to recreate the vertex arrays and vertex buffers because the indices will be different.
    // if a polyline's material changes, we need to recreate the VAOs and VBOs because they will be batched differently.
    if (properties[POSITION_SIZE_INDEX] || properties[MATERIAL_INDEX]) {
      createVertexArrays(this, context, projection);
    } else {
      const length = polylinesToUpdate.length;
      const polylineBuckets = this._polylineBuckets;
      for (let ii = 0; ii < length; ++ii) {
        polyline = polylinesToUpdate[ii];
        properties = polyline._propertiesChanged;
        const bucket = polyline._bucket;
        let index = 0;
        for (const x in polylineBuckets) {
          if (polylineBuckets.hasOwnProperty(x)) {
            if (polylineBuckets[x] === bucket) {
              if (properties[POSITION_INDEX]) {
                bucket.writeUpdate(
                  index,
                  polyline,
                  this._positionBuffer,
                  projection,
                );
              }
              break;
            }
            index += polylineBuckets[x].lengthOfPositions;
          }
        }

        if (properties[SHOW_INDEX] || properties[WIDTH_INDEX]) {
          this._batchTable.setBatchedAttribute(
            polyline._index,
            0,
            new Cartesian2(polyline._width, polyline._show),
          );
        }

        if (this._batchTable.attributes.length > 2) {
          if (properties[POSITION_INDEX] || properties[POSITION_SIZE_INDEX]) {
            const boundingSphere =
              frameState.mode === SceneMode.SCENE2D
                ? polyline._boundingVolume2D
                : polyline._boundingVolumeWC;
            const encodedCenter = EncodedCartesian3.fromCartesian(
              boundingSphere.center,
              scratchUpdatePolylineEncodedCartesian,
            );
            const low = Cartesian4.fromElements(
              encodedCenter.low.x,
              encodedCenter.low.y,
              encodedCenter.low.z,
              boundingSphere.radius,
              scratchUpdatePolylineCartesian4,
            );
            this._batchTable.setBatchedAttribute(
              polyline._index,
              2,
              encodedCenter.high,
            );
            this._batchTable.setBatchedAttribute(polyline._index, 3, low);
          }

          if (properties[DISTANCE_DISPLAY_CONDITION]) {
            const nearFarCartesian = scratchNearFarCartesian2;
            nearFarCartesian.x = 0.0;
            nearFarCartesian.y = Number.MAX_VALUE;

            const distanceDisplayCondition = polyline.distanceDisplayCondition;
            if (defined(distanceDisplayCondition)) {
              nearFarCartesian.x = distanceDisplayCondition.near;
              nearFarCartesian.y = distanceDisplayCondition.far;
            }

            this._batchTable.setBatchedAttribute(
              polyline._index,
              4,
              nearFarCartesian,
            );
          }
        }

        polyline._clean();
      }
    }
    polylinesToUpdate.length = 0;
    this._polylinesUpdated = false;
  }

  properties = this._propertiesChanged;
  for (let k = 0; k < NUMBER_OF_PROPERTIES; ++k) {
    properties[k] = 0;
  }

  let modelMatrix = Matrix4.IDENTITY;
  if (frameState.mode === SceneMode.SCENE3D) {
    modelMatrix = this.modelMatrix;
  }

  const pass = frameState.passes;
  const useDepthTest = frameState.morphTime !== 0.0;

  if (
    !defined(this._opaqueRS) ||
    this._opaqueRS.depthTest.enabled !== useDepthTest
  ) {
    this._opaqueRS = RenderState.fromCache({
      depthMask: useDepthTest,
      depthTest: {
        enabled: useDepthTest,
      },
    });
  }

  if (
    !defined(this._translucentRS) ||
    this._translucentRS.depthTest.enabled !== useDepthTest
  ) {
    this._translucentRS = RenderState.fromCache({
      blending: BlendingState.ALPHA_BLEND,
      depthMask: !useDepthTest,
      depthTest: {
        enabled: useDepthTest,
      },
    });
  }

  this._batchTable.update(frameState);

  if (pass.render || pass.pick) {
    const colorList = this._colorCommands;
    createCommandLists(this, frameState, colorList, modelMatrix);
  }
};

const boundingSphereScratch = new BoundingSphere();
const boundingSphereScratch2 = new BoundingSphere();

function createCommandLists(
  polylineCollection,
  frameState,
  commands,
  modelMatrix,
) {
  const context = frameState.context;
  const commandList = frameState.commandList;

  const commandsLength = commands.length;
  let commandIndex = 0;
  let cloneBoundingSphere = true;

  const vertexArrays = polylineCollection._vertexArrays;
  const debugShowBoundingVolume = polylineCollection.debugShowBoundingVolume;

  const batchTable = polylineCollection._batchTable;
  const uniformCallback = batchTable.getUniformMapCallback();

  const length = vertexArrays.length;
  for (let m = 0; m < length; ++m) {
    const va = vertexArrays[m];
    const buckets = va.buckets;
    const bucketLength = buckets.length;

    for (let n = 0; n < bucketLength; ++n) {
      const bucketLocator = buckets[n];

      let offset = bucketLocator.offset;
      const sp = bucketLocator.bucket.shaderProgram;

      const polylines = bucketLocator.bucket.polylines;
      const polylineLength = polylines.length;
      let currentId;
      let currentMaterial;
      let count = 0;
      let command;
      let uniformMap;

      for (let s = 0; s < polylineLength; ++s) {
        const polyline = polylines[s];
        const mId = createMaterialId(polyline._material);
        if (mId !== currentId) {
          if (defined(currentId) && count > 0) {
            const translucent = currentMaterial.isTranslucent();

            if (commandIndex >= commandsLength) {
              command = new DrawCommand({
                owner: polylineCollection,
              });
              commands.push(command);
            } else {
              command = commands[commandIndex];
            }

            ++commandIndex;

            uniformMap = combine(
              uniformCallback(currentMaterial._uniforms),
              polylineCollection._uniformMap,
            );

            command.boundingVolume = BoundingSphere.clone(
              boundingSphereScratch,
              command.boundingVolume,
            );
            command.modelMatrix = modelMatrix;
            command.shaderProgram = sp;
            command.vertexArray = va.va;
            command.renderState = translucent
              ? polylineCollection._translucentRS
              : polylineCollection._opaqueRS;
            command.pass = translucent ? Pass.TRANSLUCENT : Pass.OPAQUE;
            command.debugShowBoundingVolume = debugShowBoundingVolume;
            command.pickId = "v_pickColor";

            command.uniformMap = uniformMap;
            command.count = count;
            command.offset = offset;

            offset += count;
            count = 0;
            cloneBoundingSphere = true;

            commandList.push(command);
          }

          currentMaterial = polyline._material;
          currentMaterial.update(context);
          currentId = mId;
        }

        const locators = polyline._locatorBuckets;
        const locatorLength = locators.length;
        for (let t = 0; t < locatorLength; ++t) {
          const locator = locators[t];
          if (locator.locator === bucketLocator) {
            count += locator.count;
          }
        }

        let boundingVolume;
        if (frameState.mode === SceneMode.SCENE3D) {
          boundingVolume = polyline._boundingVolumeWC;
        } else if (frameState.mode === SceneMode.COLUMBUS_VIEW) {
          boundingVolume = polyline._boundingVolume2D;
        } else if (frameState.mode === SceneMode.SCENE2D) {
          if (defined(polyline._boundingVolume2D)) {
            boundingVolume = BoundingSphere.clone(
              polyline._boundingVolume2D,
              boundingSphereScratch2,
            );
            boundingVolume.center.x = 0.0;
          }
        } else if (
          defined(polyline._boundingVolumeWC) &&
          defined(polyline._boundingVolume2D)
        ) {
          boundingVolume = BoundingSphere.union(
            polyline._boundingVolumeWC,
            polyline._boundingVolume2D,
            boundingSphereScratch2,
          );
        }

        if (cloneBoundingSphere) {
          cloneBoundingSphere = false;
          BoundingSphere.clone(boundingVolume, boundingSphereScratch);
        } else {
          BoundingSphere.union(
            boundingVolume,
            boundingSphereScratch,
            boundingSphereScratch,
          );
        }
      }

      if (defined(currentId) && count > 0) {
        if (commandIndex >= commandsLength) {
          command = new DrawCommand({
            owner: polylineCollection,
          });
          commands.push(command);
        } else {
          command = commands[commandIndex];
        }

        ++commandIndex;

        uniformMap = combine(
          uniformCallback(currentMaterial._uniforms),
          polylineCollection._uniformMap,
        );

        command.boundingVolume = BoundingSphere.clone(
          boundingSphereScratch,
          command.boundingVolume,
        );
        command.modelMatrix = modelMatrix;
        command.shaderProgram = sp;
        command.vertexArray = va.va;
        command.renderState = currentMaterial.isTranslucent()
          ? polylineCollection._translucentRS
          : polylineCollection._opaqueRS;
        command.pass = currentMaterial.isTranslucent()
          ? Pass.TRANSLUCENT
          : Pass.OPAQUE;
        command.debugShowBoundingVolume = debugShowBoundingVolume;
        command.pickId = "v_pickColor";

        command.uniformMap = uniformMap;
        command.count = count;
        command.offset = offset;

        cloneBoundingSphere = true;

        commandList.push(command);
      }

      currentId = undefined;
    }
  }

  commands.length = commandIndex;
}

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>false</code>。
 *
 * @see PolylineCollection#destroy
 */
PolylineCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的 WebGL 资源。销毁对象可以确保
 * WebGL 资源的释放是确定的，而不是依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 *
 * @example
 * polylines = polylines && polylines.destroy();
 *
 * @see PolylineCollection#isDestroyed
 */
PolylineCollection.prototype.destroy = function () {
  destroyVertexArrays(this);
  releaseShaders(this);
  destroyPolylines(this);
  this._batchTable = this._batchTable && this._batchTable.destroy();
  return destroyObject(this);
};

function computeNewBuffersUsage(collection) {
  let usageChanged = false;
  const properties = collection._propertiesChanged;
  const bufferUsage = collection._positionBufferUsage;
  if (properties[POSITION_INDEX]) {
    if (bufferUsage.bufferUsage !== BufferUsage.STREAM_DRAW) {
      usageChanged = true;
      bufferUsage.bufferUsage = BufferUsage.STREAM_DRAW;
      bufferUsage.frameCount = 100;
    } else {
      bufferUsage.frameCount = 100;
    }
  } else if (bufferUsage.bufferUsage !== BufferUsage.STATIC_DRAW) {
    if (bufferUsage.frameCount === 0) {
      usageChanged = true;
      bufferUsage.bufferUsage = BufferUsage.STATIC_DRAW;
    } else {
      bufferUsage.frameCount--;
    }
  }

  return usageChanged;
}

const emptyVertexBuffer = [0.0, 0.0, 0.0];

function createVertexArrays(collection, context, projection) {
  collection._createVertexArray = false;
  releaseShaders(collection);
  destroyVertexArrays(collection);
  sortPolylinesIntoBuckets(collection);

  //stores all of the individual indices arrays.
  const totalIndices = [[]];
  let indices;

  const batchTable = collection._batchTable;
  const useHighlightColor = collection._useHighlightColor;

  //used to determine the vertexBuffer offset if the indicesArray goes over 64k.
  //if it's the same polyline while it goes over 64k, the offset needs to backtrack componentsPerAttribute * componentDatatype bytes
  //so that the polyline looks contiguous.
  //if the polyline ends at the 64k mark, then the offset is just 64k * componentsPerAttribute * componentDatatype
  const vertexBufferOffset = [0];
  let offset = 0;
  const vertexArrayBuckets = [[]];
  let totalLength = 0;
  const polylineBuckets = collection._polylineBuckets;
  let x;
  let bucket;
  for (x in polylineBuckets) {
    if (polylineBuckets.hasOwnProperty(x)) {
      bucket = polylineBuckets[x];
      bucket.updateShader(context, batchTable, useHighlightColor);
      totalLength += bucket.lengthOfPositions;
    }
  }

  if (totalLength > 0) {
    const mode = collection._mode;

    const positionArray = new Float32Array(6 * totalLength * 3);
    const texCoordExpandAndBatchIndexArray = new Float32Array(totalLength * 4);
    let position3DArray;

    let positionIndex = 0;
    let colorIndex = 0;
    let texCoordExpandAndBatchIndexIndex = 0;
    for (x in polylineBuckets) {
      if (polylineBuckets.hasOwnProperty(x)) {
        bucket = polylineBuckets[x];
        bucket.write(
          positionArray,
          texCoordExpandAndBatchIndexArray,
          positionIndex,
          colorIndex,
          texCoordExpandAndBatchIndexIndex,
          batchTable,
          context,
          projection,
        );

        if (mode === SceneMode.MORPHING) {
          if (!defined(position3DArray)) {
            position3DArray = new Float32Array(6 * totalLength * 3);
          }
          bucket.writeForMorph(position3DArray, positionIndex);
        }

        const bucketLength = bucket.lengthOfPositions;
        positionIndex += 6 * bucketLength * 3;
        colorIndex += bucketLength * 4;
        texCoordExpandAndBatchIndexIndex += bucketLength * 4;
        offset = bucket.updateIndices(
          totalIndices,
          vertexBufferOffset,
          vertexArrayBuckets,
          offset,
        );
      }
    }

    const positionBufferUsage = collection._positionBufferUsage.bufferUsage;
    const texCoordExpandAndBatchIndexBufferUsage = BufferUsage.STATIC_DRAW;

    collection._positionBuffer = Buffer.createVertexBuffer({
      context: context,
      typedArray: positionArray,
      usage: positionBufferUsage,
    });
    let position3DBuffer;
    if (defined(position3DArray)) {
      position3DBuffer = Buffer.createVertexBuffer({
        context: context,
        typedArray: position3DArray,
        usage: positionBufferUsage,
      });
    }
    collection._texCoordExpandAndBatchIndexBuffer = Buffer.createVertexBuffer({
      context: context,
      typedArray: texCoordExpandAndBatchIndexArray,
      usage: texCoordExpandAndBatchIndexBufferUsage,
    });

    const positionSizeInBytes = 3 * Float32Array.BYTES_PER_ELEMENT;
    const texCoordExpandAndBatchIndexSizeInBytes =
      4 * Float32Array.BYTES_PER_ELEMENT;

    let vbo = 0;
    const numberOfIndicesArrays = totalIndices.length;
    for (let k = 0; k < numberOfIndicesArrays; ++k) {
      indices = totalIndices[k];

      if (indices.length > 0) {
        const indicesArray = new Uint16Array(indices);
        const indexBuffer = Buffer.createIndexBuffer({
          context: context,
          typedArray: indicesArray,
          usage: BufferUsage.STATIC_DRAW,
          indexDatatype: IndexDatatype.UNSIGNED_SHORT,
        });

        vbo += vertexBufferOffset[k];

        const positionHighOffset =
          6 *
          (k * (positionSizeInBytes * CesiumMath.SIXTY_FOUR_KILOBYTES) -
            vbo * positionSizeInBytes); //componentsPerAttribute(3) * componentDatatype(4)
        const positionLowOffset = positionSizeInBytes + positionHighOffset;
        const prevPositionHighOffset = positionSizeInBytes + positionLowOffset;
        const prevPositionLowOffset =
          positionSizeInBytes + prevPositionHighOffset;
        const nextPositionHighOffset =
          positionSizeInBytes + prevPositionLowOffset;
        const nextPositionLowOffset =
          positionSizeInBytes + nextPositionHighOffset;
        const vertexTexCoordExpandAndBatchIndexBufferOffset =
          k *
            (texCoordExpandAndBatchIndexSizeInBytes *
              CesiumMath.SIXTY_FOUR_KILOBYTES) -
          vbo * texCoordExpandAndBatchIndexSizeInBytes;

        const attributes = [
          {
            index: attributeLocations.position3DHigh,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: positionHighOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.position3DLow,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: positionLowOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.position2DHigh,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: positionHighOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.position2DLow,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: positionLowOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.prevPosition3DHigh,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: prevPositionHighOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.prevPosition3DLow,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: prevPositionLowOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.prevPosition2DHigh,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: prevPositionHighOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.prevPosition2DLow,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: prevPositionLowOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.nextPosition3DHigh,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: nextPositionHighOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.nextPosition3DLow,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: nextPositionLowOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.nextPosition2DHigh,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: nextPositionHighOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.nextPosition2DLow,
            componentsPerAttribute: 3,
            componentDatatype: ComponentDatatype.FLOAT,
            offsetInBytes: nextPositionLowOffset,
            strideInBytes: 6 * positionSizeInBytes,
          },
          {
            index: attributeLocations.texCoordExpandAndBatchIndex,
            componentsPerAttribute: 4,
            componentDatatype: ComponentDatatype.FLOAT,
            vertexBuffer: collection._texCoordExpandAndBatchIndexBuffer,
            offsetInBytes: vertexTexCoordExpandAndBatchIndexBufferOffset,
          },
        ];

        let bufferProperty3D;
        let buffer3D;
        let buffer2D;
        let bufferProperty2D;

        if (mode === SceneMode.SCENE3D) {
          buffer3D = collection._positionBuffer;
          bufferProperty3D = "vertexBuffer";
          buffer2D = emptyVertexBuffer;
          bufferProperty2D = "value";
        } else if (
          mode === SceneMode.SCENE2D ||
          mode === SceneMode.COLUMBUS_VIEW
        ) {
          buffer3D = emptyVertexBuffer;
          bufferProperty3D = "value";
          buffer2D = collection._positionBuffer;
          bufferProperty2D = "vertexBuffer";
        } else {
          buffer3D = position3DBuffer;
          bufferProperty3D = "vertexBuffer";
          buffer2D = collection._positionBuffer;
          bufferProperty2D = "vertexBuffer";
        }

        attributes[0][bufferProperty3D] = buffer3D;
        attributes[1][bufferProperty3D] = buffer3D;
        attributes[2][bufferProperty2D] = buffer2D;
        attributes[3][bufferProperty2D] = buffer2D;
        attributes[4][bufferProperty3D] = buffer3D;
        attributes[5][bufferProperty3D] = buffer3D;
        attributes[6][bufferProperty2D] = buffer2D;
        attributes[7][bufferProperty2D] = buffer2D;
        attributes[8][bufferProperty3D] = buffer3D;
        attributes[9][bufferProperty3D] = buffer3D;
        attributes[10][bufferProperty2D] = buffer2D;
        attributes[11][bufferProperty2D] = buffer2D;

        const va = new VertexArray({
          context: context,
          attributes: attributes,
          indexBuffer: indexBuffer,
        });
        collection._vertexArrays.push({
          va: va,
          buckets: vertexArrayBuckets[k],
        });
      }
    }
  }
}

function replacer(key, value) {
  if (value instanceof Texture) {
    return value.id;
  }

  return value;
}

const scratchUniformArray = [];
function createMaterialId(material) {
  const uniforms = Material._uniformList[material.type];
  const length = uniforms.length;
  scratchUniformArray.length = 2.0 * length;

  let index = 0;
  for (let i = 0; i < length; ++i) {
    const uniform = uniforms[i];
    scratchUniformArray[index] = uniform;
    scratchUniformArray[index + 1] = material._uniforms[uniform]();
    index += 2;
  }

  return `${material.type}:${JSON.stringify(scratchUniformArray, replacer)}`;
}

function sortPolylinesIntoBuckets(collection) {
  const mode = collection._mode;
  const modelMatrix = collection._modelMatrix;

  const polylineBuckets = (collection._polylineBuckets = {});
  const polylines = collection._polylines;
  const length = polylines.length;
  for (let i = 0; i < length; ++i) {
    const p = polylines[i];
    if (p._actualPositions.length > 1) {
      p.update();
      const material = p.material;
      let value = polylineBuckets[material.type];
      if (!defined(value)) {
        value = polylineBuckets[material.type] = new PolylineBucket(
          material,
          mode,
          modelMatrix,
        );
      }
      value.addPolyline(p);
    }
  }
}

function updateMode(collection, frameState) {
  const mode = frameState.mode;

  if (
    collection._mode !== mode ||
    !Matrix4.equals(collection._modelMatrix, collection.modelMatrix)
  ) {
    collection._mode = mode;
    collection._modelMatrix = Matrix4.clone(collection.modelMatrix);
    collection._createVertexArray = true;
  }
}

function removePolylines(collection) {
  if (collection._polylinesRemoved) {
    collection._polylinesRemoved = false;
    const definedPolylines = [];
    const definedPolylinesToUpdate = [];
    let polyIndex = 0;
    let polyline;

    const length = collection._polylines.length;
    for (let i = 0; i < length; ++i) {
      polyline = collection._polylines[i];
      if (!polyline.isDestroyed) {
        polyline._index = polyIndex++;
        definedPolylinesToUpdate.push(polyline);
        definedPolylines.push(polyline);
      }
    }

    collection._polylines = definedPolylines;
    collection._polylinesToUpdate = definedPolylinesToUpdate;
  }
}

function releaseShaders(collection) {
  const polylines = collection._polylines;
  const length = polylines.length;
  for (let i = 0; i < length; ++i) {
    if (!polylines[i].isDestroyed) {
      const bucket = polylines[i]._bucket;
      if (defined(bucket)) {
        bucket.shaderProgram =
          bucket.shaderProgram && bucket.shaderProgram.destroy();
      }
    }
  }
}

function destroyVertexArrays(collection) {
  const length = collection._vertexArrays.length;
  for (let t = 0; t < length; ++t) {
    collection._vertexArrays[t].va.destroy();
  }
  collection._vertexArrays.length = 0;
}

PolylineCollection.prototype._updatePolyline = function (
  polyline,
  propertyChanged,
) {
  this._polylinesUpdated = true;
  if (!polyline._dirty) {
    this._polylinesToUpdate.push(polyline);
  }
  ++this._propertiesChanged[propertyChanged];
};

function destroyPolylines(collection) {
  const polylines = collection._polylines;
  const length = polylines.length;
  for (let i = 0; i < length; ++i) {
    if (!polylines[i].isDestroyed) {
      polylines[i]._destroy();
    }
  }
}

function VertexArrayBucketLocator(count, offset, bucket) {
  this.count = count;
  this.offset = offset;
  this.bucket = bucket;
}

function PolylineBucket(material, mode, modelMatrix) {
  this.polylines = [];
  this.lengthOfPositions = 0;
  this.material = material;
  this.shaderProgram = undefined;
  this.mode = mode;
  this.modelMatrix = modelMatrix;
}

PolylineBucket.prototype.addPolyline = function (p) {
  const polylines = this.polylines;
  polylines.push(p);
  p._actualLength = this.getPolylinePositionsLength(p);
  this.lengthOfPositions += p._actualLength;
  p._bucket = this;
};

PolylineBucket.prototype.updateShader = function (
  context,
  batchTable,
  useHighlightColor,
) {
  if (defined(this.shaderProgram)) {
    return;
  }

  const defines = ["DISTANCE_DISPLAY_CONDITION"];
  if (useHighlightColor) {
    defines.push("VECTOR_TILE");
  }

  // Check for use of v_polylineAngle in material shader
  if (
    this.material.shaderSource.search(/in\s+float\s+v_polylineAngle;/g) !== -1
  ) {
    defines.push("POLYLINE_DASH");
  }

  defines.push("CLIP_POLYLINE");

  const fs = new ShaderSource({
    defines: defines,
    sources: ["in vec4 v_pickColor;\n", this.material.shaderSource, PolylineFS],
  });

  const vsSource = batchTable.getVertexShaderCallback()(PolylineVS);
  const vs = new ShaderSource({
    defines: defines,
    sources: [PolylineCommon, vsSource],
  });

  this.shaderProgram = ShaderProgram.fromCache({
    context: context,
    vertexShaderSource: vs,
    fragmentShaderSource: fs,
    attributeLocations: attributeLocations,
  });
};

function intersectsIDL(polyline) {
  return (
    Cartesian3.dot(Cartesian3.UNIT_X, polyline._boundingVolume.center) < 0 ||
    polyline._boundingVolume.intersectPlane(Plane.ORIGIN_ZX_PLANE) ===
      Intersect.INTERSECTING
  );
}

PolylineBucket.prototype.getPolylinePositionsLength = function (polyline) {
  let length;
  if (this.mode === SceneMode.SCENE3D || !intersectsIDL(polyline)) {
    length = polyline._actualPositions.length;
    return length * 4.0 - 4.0;
  }

  let count = 0;
  const segmentLengths = polyline._segments.lengths;
  length = segmentLengths.length;
  for (let i = 0; i < length; ++i) {
    count += segmentLengths[i] * 4.0 - 4.0;
  }

  return count;
};

const scratchWritePosition = new Cartesian3();
const scratchWritePrevPosition = new Cartesian3();
const scratchWriteNextPosition = new Cartesian3();
const scratchWriteVector = new Cartesian3();
const scratchPickColorCartesian = new Cartesian4();
const scratchWidthShowCartesian = new Cartesian2();

PolylineBucket.prototype.write = function (
  positionArray,
  texCoordExpandAndBatchIndexArray,
  positionIndex,
  colorIndex,
  texCoordExpandAndBatchIndexIndex,
  batchTable,
  context,
  projection,
) {
  const mode = this.mode;
  const maxLon = projection.ellipsoid.maximumRadius * CesiumMath.PI;

  const polylines = this.polylines;
  const length = polylines.length;
  for (let i = 0; i < length; ++i) {
    const polyline = polylines[i];
    const width = polyline.width;
    const show = polyline.show && width > 0.0;
    const polylineBatchIndex = polyline._index;
    const segments = this.getSegments(polyline, projection);
    const positions = segments.positions;
    const lengths = segments.lengths;
    const positionsLength = positions.length;

    const pickColor = polyline.getPickId(context).color;

    let segmentIndex = 0;
    let count = 0;
    let position;

    for (let j = 0; j < positionsLength; ++j) {
      if (j === 0) {
        if (polyline._loop) {
          position = positions[positionsLength - 2];
        } else {
          position = scratchWriteVector;
          Cartesian3.subtract(positions[0], positions[1], position);
          Cartesian3.add(positions[0], position, position);
        }
      } else {
        position = positions[j - 1];
      }

      Cartesian3.clone(position, scratchWritePrevPosition);
      Cartesian3.clone(positions[j], scratchWritePosition);

      if (j === positionsLength - 1) {
        if (polyline._loop) {
          position = positions[1];
        } else {
          position = scratchWriteVector;
          Cartesian3.subtract(
            positions[positionsLength - 1],
            positions[positionsLength - 2],
            position,
          );
          Cartesian3.add(positions[positionsLength - 1], position, position);
        }
      } else {
        position = positions[j + 1];
      }

      Cartesian3.clone(position, scratchWriteNextPosition);

      const segmentLength = lengths[segmentIndex];
      if (j === count + segmentLength) {
        count += segmentLength;
        ++segmentIndex;
      }

      const segmentStart = j - count === 0;
      const segmentEnd = j === count + lengths[segmentIndex] - 1;

      if (mode === SceneMode.SCENE2D) {
        scratchWritePrevPosition.z = 0.0;
        scratchWritePosition.z = 0.0;
        scratchWriteNextPosition.z = 0.0;
      }

      if (mode === SceneMode.SCENE2D || mode === SceneMode.MORPHING) {
        if (
          (segmentStart || segmentEnd) &&
          maxLon - Math.abs(scratchWritePosition.x) < 1.0
        ) {
          if (
            (scratchWritePosition.x < 0.0 &&
              scratchWritePrevPosition.x > 0.0) ||
            (scratchWritePosition.x > 0.0 && scratchWritePrevPosition.x < 0.0)
          ) {
            Cartesian3.clone(scratchWritePosition, scratchWritePrevPosition);
          }

          if (
            (scratchWritePosition.x < 0.0 &&
              scratchWriteNextPosition.x > 0.0) ||
            (scratchWritePosition.x > 0.0 && scratchWriteNextPosition.x < 0.0)
          ) {
            Cartesian3.clone(scratchWritePosition, scratchWriteNextPosition);
          }
        }
      }

      const startK = segmentStart ? 2 : 0;
      const endK = segmentEnd ? 2 : 4;

      for (let k = startK; k < endK; ++k) {
        EncodedCartesian3.writeElements(
          scratchWritePosition,
          positionArray,
          positionIndex,
        );
        EncodedCartesian3.writeElements(
          scratchWritePrevPosition,
          positionArray,
          positionIndex + 6,
        );
        EncodedCartesian3.writeElements(
          scratchWriteNextPosition,
          positionArray,
          positionIndex + 12,
        );

        const direction = k - 2 < 0 ? -1.0 : 1.0;
        texCoordExpandAndBatchIndexArray[texCoordExpandAndBatchIndexIndex] =
          j / (positionsLength - 1); // s tex coord
        texCoordExpandAndBatchIndexArray[texCoordExpandAndBatchIndexIndex + 1] =
          2 * (k % 2) - 1; // expand direction
        texCoordExpandAndBatchIndexArray[texCoordExpandAndBatchIndexIndex + 2] =
          direction;
        texCoordExpandAndBatchIndexArray[texCoordExpandAndBatchIndexIndex + 3] =
          polylineBatchIndex;

        positionIndex += 6 * 3;
        texCoordExpandAndBatchIndexIndex += 4;
      }
    }

    const colorCartesian = scratchPickColorCartesian;
    colorCartesian.x = Color.floatToByte(pickColor.red);
    colorCartesian.y = Color.floatToByte(pickColor.green);
    colorCartesian.z = Color.floatToByte(pickColor.blue);
    colorCartesian.w = Color.floatToByte(pickColor.alpha);

    const widthShowCartesian = scratchWidthShowCartesian;
    widthShowCartesian.x = width;
    widthShowCartesian.y = show ? 1.0 : 0.0;

    const boundingSphere =
      mode === SceneMode.SCENE2D
        ? polyline._boundingVolume2D
        : polyline._boundingVolumeWC;
    const encodedCenter = EncodedCartesian3.fromCartesian(
      boundingSphere.center,
      scratchUpdatePolylineEncodedCartesian,
    );
    const high = encodedCenter.high;
    const low = Cartesian4.fromElements(
      encodedCenter.low.x,
      encodedCenter.low.y,
      encodedCenter.low.z,
      boundingSphere.radius,
      scratchUpdatePolylineCartesian4,
    );

    const nearFarCartesian = scratchNearFarCartesian2;
    nearFarCartesian.x = 0.0;
    nearFarCartesian.y = Number.MAX_VALUE;

    const distanceDisplayCondition = polyline.distanceDisplayCondition;
    if (defined(distanceDisplayCondition)) {
      nearFarCartesian.x = distanceDisplayCondition.near;
      nearFarCartesian.y = distanceDisplayCondition.far;
    }

    batchTable.setBatchedAttribute(polylineBatchIndex, 0, widthShowCartesian);
    batchTable.setBatchedAttribute(polylineBatchIndex, 1, colorCartesian);

    if (batchTable.attributes.length > 2) {
      batchTable.setBatchedAttribute(polylineBatchIndex, 2, high);
      batchTable.setBatchedAttribute(polylineBatchIndex, 3, low);
      batchTable.setBatchedAttribute(polylineBatchIndex, 4, nearFarCartesian);
    }
  }
};

const morphPositionScratch = new Cartesian3();
const morphPrevPositionScratch = new Cartesian3();
const morphNextPositionScratch = new Cartesian3();
const morphVectorScratch = new Cartesian3();

PolylineBucket.prototype.writeForMorph = function (
  positionArray,
  positionIndex,
) {
  const modelMatrix = this.modelMatrix;
  const polylines = this.polylines;
  const length = polylines.length;
  for (let i = 0; i < length; ++i) {
    const polyline = polylines[i];
    const positions = polyline._segments.positions;
    const lengths = polyline._segments.lengths;
    const positionsLength = positions.length;

    let segmentIndex = 0;
    let count = 0;

    for (let j = 0; j < positionsLength; ++j) {
      let prevPosition;
      if (j === 0) {
        if (polyline._loop) {
          prevPosition = positions[positionsLength - 2];
        } else {
          prevPosition = morphVectorScratch;
          Cartesian3.subtract(positions[0], positions[1], prevPosition);
          Cartesian3.add(positions[0], prevPosition, prevPosition);
        }
      } else {
        prevPosition = positions[j - 1];
      }

      prevPosition = Matrix4.multiplyByPoint(
        modelMatrix,
        prevPosition,
        morphPrevPositionScratch,
      );

      const position = Matrix4.multiplyByPoint(
        modelMatrix,
        positions[j],
        morphPositionScratch,
      );

      let nextPosition;
      if (j === positionsLength - 1) {
        if (polyline._loop) {
          nextPosition = positions[1];
        } else {
          nextPosition = morphVectorScratch;
          Cartesian3.subtract(
            positions[positionsLength - 1],
            positions[positionsLength - 2],
            nextPosition,
          );
          Cartesian3.add(
            positions[positionsLength - 1],
            nextPosition,
            nextPosition,
          );
        }
      } else {
        nextPosition = positions[j + 1];
      }

      nextPosition = Matrix4.multiplyByPoint(
        modelMatrix,
        nextPosition,
        morphNextPositionScratch,
      );

      const segmentLength = lengths[segmentIndex];
      if (j === count + segmentLength) {
        count += segmentLength;
        ++segmentIndex;
      }

      const segmentStart = j - count === 0;
      const segmentEnd = j === count + lengths[segmentIndex] - 1;

      const startK = segmentStart ? 2 : 0;
      const endK = segmentEnd ? 2 : 4;

      for (let k = startK; k < endK; ++k) {
        EncodedCartesian3.writeElements(position, positionArray, positionIndex);
        EncodedCartesian3.writeElements(
          prevPosition,
          positionArray,
          positionIndex + 6,
        );
        EncodedCartesian3.writeElements(
          nextPosition,
          positionArray,
          positionIndex + 12,
        );

        positionIndex += 6 * 3;
      }
    }
  }
};

const scratchSegmentLengths = new Array(1);

PolylineBucket.prototype.updateIndices = function (
  totalIndices,
  vertexBufferOffset,
  vertexArrayBuckets,
  offset,
) {
  let vaCount = vertexArrayBuckets.length - 1;
  let bucketLocator = new VertexArrayBucketLocator(0, offset, this);
  vertexArrayBuckets[vaCount].push(bucketLocator);
  let count = 0;
  let indices = totalIndices[totalIndices.length - 1];
  let indicesCount = 0;
  if (indices.length > 0) {
    indicesCount = indices[indices.length - 1] + 1;
  }
  const polylines = this.polylines;
  const length = polylines.length;
  for (let i = 0; i < length; ++i) {
    const polyline = polylines[i];
    polyline._locatorBuckets = [];

    let segments;
    if (this.mode === SceneMode.SCENE3D) {
      segments = scratchSegmentLengths;
      const positionsLength = polyline._actualPositions.length;
      if (positionsLength > 0) {
        segments[0] = positionsLength;
      } else {
        continue;
      }
    } else {
      segments = polyline._segments.lengths;
    }

    const numberOfSegments = segments.length;
    if (numberOfSegments > 0) {
      let segmentIndexCount = 0;
      for (let j = 0; j < numberOfSegments; ++j) {
        const segmentLength = segments[j] - 1.0;
        for (let k = 0; k < segmentLength; ++k) {
          if (indicesCount + 4 > CesiumMath.SIXTY_FOUR_KILOBYTES) {
            polyline._locatorBuckets.push({
              locator: bucketLocator,
              count: segmentIndexCount,
            });
            segmentIndexCount = 0;
            vertexBufferOffset.push(4);
            indices = [];
            totalIndices.push(indices);
            indicesCount = 0;
            bucketLocator.count = count;
            count = 0;
            offset = 0;
            bucketLocator = new VertexArrayBucketLocator(0, 0, this);
            vertexArrayBuckets[++vaCount] = [bucketLocator];
          }

          indices.push(indicesCount, indicesCount + 2, indicesCount + 1);
          indices.push(indicesCount + 1, indicesCount + 2, indicesCount + 3);

          segmentIndexCount += 6;
          count += 6;
          offset += 6;
          indicesCount += 4;
        }
      }

      polyline._locatorBuckets.push({
        locator: bucketLocator,
        count: segmentIndexCount,
      });

      if (indicesCount + 4 > CesiumMath.SIXTY_FOUR_KILOBYTES) {
        vertexBufferOffset.push(0);
        indices = [];
        totalIndices.push(indices);
        indicesCount = 0;
        bucketLocator.count = count;
        offset = 0;
        count = 0;
        bucketLocator = new VertexArrayBucketLocator(0, 0, this);
        vertexArrayBuckets[++vaCount] = [bucketLocator];
      }
    }
    polyline._clean();
  }
  bucketLocator.count = count;
  return offset;
};

PolylineBucket.prototype.getPolylineStartIndex = function (polyline) {
  const polylines = this.polylines;
  let positionIndex = 0;
  const length = polylines.length;
  for (let i = 0; i < length; ++i) {
    const p = polylines[i];
    if (p === polyline) {
      break;
    }
    positionIndex += p._actualLength;
  }
  return positionIndex;
};

const scratchSegments = {
  positions: undefined,
  lengths: undefined,
};
const scratchLengths = new Array(1);
const pscratch = new Cartesian3();
const scratchCartographic = new Cartographic();

PolylineBucket.prototype.getSegments = function (polyline, projection) {
  let positions = polyline._actualPositions;

  if (this.mode === SceneMode.SCENE3D) {
    scratchLengths[0] = positions.length;
    scratchSegments.positions = positions;
    scratchSegments.lengths = scratchLengths;
    return scratchSegments;
  }

  if (intersectsIDL(polyline)) {
    positions = polyline._segments.positions;
  }

  const ellipsoid = projection.ellipsoid;
  const newPositions = [];
  const modelMatrix = this.modelMatrix;
  const length = positions.length;
  let position;
  let p = pscratch;

  for (let n = 0; n < length; ++n) {
    position = positions[n];
    p = Matrix4.multiplyByPoint(modelMatrix, position, p);
    newPositions.push(
      projection.project(
        ellipsoid.cartesianToCartographic(p, scratchCartographic),
      ),
    );
  }

  if (newPositions.length > 0) {
    polyline._boundingVolume2D = BoundingSphere.fromPoints(
      newPositions,
      polyline._boundingVolume2D,
    );
    const center2D = polyline._boundingVolume2D.center;
    polyline._boundingVolume2D.center = new Cartesian3(
      center2D.z,
      center2D.x,
      center2D.y,
    );
  }

  scratchSegments.positions = newPositions;
  scratchSegments.lengths = polyline._segments.lengths;
  return scratchSegments;
};

let scratchPositionsArray;

PolylineBucket.prototype.writeUpdate = function (
  index,
  polyline,
  positionBuffer,
  projection,
) {
  const mode = this.mode;
  const maxLon = projection.ellipsoid.maximumRadius * CesiumMath.PI;

  let positionsLength = polyline._actualLength;
  if (positionsLength) {
    index += this.getPolylineStartIndex(polyline);

    let positionArray = scratchPositionsArray;
    const positionsArrayLength = 6 * positionsLength * 3;

    if (
      !defined(positionArray) ||
      positionArray.length < positionsArrayLength
    ) {
      positionArray = scratchPositionsArray = new Float32Array(
        positionsArrayLength,
      );
    } else if (positionArray.length > positionsArrayLength) {
      positionArray = new Float32Array(
        positionArray.buffer,
        0,
        positionsArrayLength,
      );
    }

    const segments = this.getSegments(polyline, projection);
    const positions = segments.positions;
    const lengths = segments.lengths;

    let positionIndex = 0;
    let segmentIndex = 0;
    let count = 0;
    let position;

    positionsLength = positions.length;
    for (let i = 0; i < positionsLength; ++i) {
      if (i === 0) {
        if (polyline._loop) {
          position = positions[positionsLength - 2];
        } else {
          position = scratchWriteVector;
          Cartesian3.subtract(positions[0], positions[1], position);
          Cartesian3.add(positions[0], position, position);
        }
      } else {
        position = positions[i - 1];
      }

      Cartesian3.clone(position, scratchWritePrevPosition);
      Cartesian3.clone(positions[i], scratchWritePosition);

      if (i === positionsLength - 1) {
        if (polyline._loop) {
          position = positions[1];
        } else {
          position = scratchWriteVector;
          Cartesian3.subtract(
            positions[positionsLength - 1],
            positions[positionsLength - 2],
            position,
          );
          Cartesian3.add(positions[positionsLength - 1], position, position);
        }
      } else {
        position = positions[i + 1];
      }

      Cartesian3.clone(position, scratchWriteNextPosition);

      const segmentLength = lengths[segmentIndex];
      if (i === count + segmentLength) {
        count += segmentLength;
        ++segmentIndex;
      }

      const segmentStart = i - count === 0;
      const segmentEnd = i === count + lengths[segmentIndex] - 1;

      if (mode === SceneMode.SCENE2D) {
        scratchWritePrevPosition.z = 0.0;
        scratchWritePosition.z = 0.0;
        scratchWriteNextPosition.z = 0.0;
      }

      if (mode === SceneMode.SCENE2D || mode === SceneMode.MORPHING) {
        if (
          (segmentStart || segmentEnd) &&
          maxLon - Math.abs(scratchWritePosition.x) < 1.0
        ) {
          if (
            (scratchWritePosition.x < 0.0 &&
              scratchWritePrevPosition.x > 0.0) ||
            (scratchWritePosition.x > 0.0 && scratchWritePrevPosition.x < 0.0)
          ) {
            Cartesian3.clone(scratchWritePosition, scratchWritePrevPosition);
          }

          if (
            (scratchWritePosition.x < 0.0 &&
              scratchWriteNextPosition.x > 0.0) ||
            (scratchWritePosition.x > 0.0 && scratchWriteNextPosition.x < 0.0)
          ) {
            Cartesian3.clone(scratchWritePosition, scratchWriteNextPosition);
          }
        }
      }

      const startJ = segmentStart ? 2 : 0;
      const endJ = segmentEnd ? 2 : 4;

      for (let j = startJ; j < endJ; ++j) {
        EncodedCartesian3.writeElements(
          scratchWritePosition,
          positionArray,
          positionIndex,
        );
        EncodedCartesian3.writeElements(
          scratchWritePrevPosition,
          positionArray,
          positionIndex + 6,
        );
        EncodedCartesian3.writeElements(
          scratchWriteNextPosition,
          positionArray,
          positionIndex + 12,
        );
        positionIndex += 6 * 3;
      }
    }

    positionBuffer.copyFromArrayView(
      positionArray,
      6 * 3 * Float32Array.BYTES_PER_ELEMENT * index,
    );
  }
};
export default PolylineCollection;