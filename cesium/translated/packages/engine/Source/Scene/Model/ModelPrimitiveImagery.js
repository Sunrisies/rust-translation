import {
  Check,
  DeveloperError,
  Matrix4,
  defined,
  destroyObject,
} from "@cesium/core";
import ImageryState from "../ImageryState.js";
import ImageryCoverage from "./ImageryCoverage.js";
import ModelImageryMapping from "./ModelImageryMapping.js";
import ModelUtility from "./ModelUtility.js";
import MappedPositions from "./MappedPositions.js";
import Buffer from "../../Renderer/Buffer.js";
import BufferUsage from "../../Renderer/BufferUsage.js";

/**
 * 一个用于管理单个模型基元上影像覆盖的类。
 *
 * <code>ModelImagery</code> 类会为模型中出现的每个基元创建一个该类的实例。
 * 该类负责计算
 *
 * - 基元的映射（地图学）位置
 * - 被这些映射位置覆盖的影像瓦片
 * - 与这些映射位置对应的纹理坐标（属性）
 * 创建新的实例
 *
 * @private
 */
class ModelPrimitiveImagery {
  /**
   * 模型
   *
   * @param {Model} model 节点
   * @param {ModelRuntimeNode} runtimeNode 基元所连接的节点
   * @param {ModelRuntimePrimitive} runtimePrimitive 基元本身
   * @throws {DeveloperError} If 没有任何参数被定义
   */
  constructor(model, runtimeNode, runtimePrimitive) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("model", model);
    Check.defined("runtimeNode", runtimeNode);
    Check.defined("runtimePrimitive", runtimePrimitive);
    //>>includeEnd('debug');

    /**
     * 该实例所针对的模型
     *
     * @type {Model}
     * @readonly
     * @private
     */
    this._model = model;

    /**
     * 基元所连接的节点
     *
     * @type {ModelRuntimeNode}
     * @readonly
     * @private
     */
    this._runtimeNode = runtimeNode;

    /**
     * 该实例所针对的基元
     *
     * @type {ModelRuntimePrimitive}
     * @readonly
     * @private
     */
    this._runtimePrimitive = runtimePrimitive;

    /**
     * 每个椭球体的 <code>MappedPositions</code> 对象
     * 属于其中一个影像图层
     *
     * 这些对象只是简单的结构，用于总结特定
     * 椭球体的基元地图学位置
     * 最后一个计算了映射位置的
     *
     * @type {MappedPositions[]|undefined}
     * @private
     */
    this._mappedPositionsPerEllipsoid = undefined;

    /**
     * <code>model.modelMatrix</code>
     * 模型矩阵。
     *
     * 用于检测模型矩阵的变化，
     * 导致需要重新计算映射位置。
     *
     * @type {Matrix4}
     * @readonly
     * @private
     */
    this._mappedPositionsModelMatrix = new Matrix4();

    /**
     * 上次更新调用时 <code>Cesium3DTileset.imageryLayersModificationCounter</code> 的值。当
     * 瓦片中的影像图层集合发生变化时，此值用于触发更新。
     * 每个投影对应的纹理坐标属性。
     */
    this._lastImageryLayersModificationCounter = 0;

    /**
     * 每个投影使用的独特投影对应的一个纹理坐标属性。
     *
     * 包含每个影像图层中使用的
     * 每个独特投影的一个 <code>ModelComponents.Attribute</code>。这些
     * 纹理坐标属性基于该投影的椭球体的映射位置计算得出。
     * 当前的影像图层。
     */
    this._imageryTexCoordAttributesPerProjection = undefined;

    /**
     * 在计算 _coveragesPerLayer 时初始化，
     *
     * 并跟踪影像的参考计数器，当删除每层覆盖量时
     * 可以减少这些计数器。
     * 关于被基元的位置覆盖的影像瓦片的信息。
     *
     * @type {ImageryLayer[]|undefined}
     * @private
     */
    this._currentImageryLayers = undefined;

    /**
     * 此信息在 <code>update</code> 函数中根据基元的映射位置计算得出。在此计算之后，
     * <code>_coveragesPerLayer[layerIndex]</code> 是一个数组，包含描述被覆盖的影像瓦片的
     *
     * <code>ImageryCoverage</code> 对象，包括它们的纹理坐标矩形区域。
     * mapped positions of the primitive. After this computation,
     * <code>_coveragesPerLayer[layerIndex]</code> is an array that contains
     * the <code>ImageryCoverage</code> objects that describe the imagery
     * tiles that are covered, including their texture coordinate rectangle.
     *
     * @type {ImageryCoverage[][]|undefined}
     * @private
     */
    this._coveragesPerLayer = undefined;

    /**
     * 一个标志，指示所有被覆盖的影像对象是否都“准备就绪”。
     * 最初为 <code>false</code>。在调用
     *
     * <code>update</code> 函数期间（由
     * <code>Model.update</code> 函数触发，每帧一次），将调用
     * <code>_updateImageries</code> 函数，并处理影像瓦片，直到所有影像都处于
     * <code>ImageryState.READY</code> 状态，此时该标志被设置为 <code>true</code>。
     * 返回为给定影像图层计算得到的 <code>ImageryCoverage</code> 数组。
     * 假设给定影像图层是模型的影像图层集合的一部分，并且该模型的基本影像已经“准备就绪”，即覆盖信息已计算完成。
     * 客户端<b>不得</b>修改返回的数组或其任何对象！
     *
     * @type {boolean}
     * @private
     */
    this._allImageriesReady = false;
  }

  /**
   * 更新此实例的状态。
   * 作为 <code>ModelImagery.update</code> 的一部分调用，而 <code>Model.update</code> 是在每帧中调用的。
   *
   * 这将执行必要的计算，以建立影像与基本影像之间的映射关系。它将...
   * 计算基本影像的 <code>MappedPositions</code>，每个椭球体一个实例。
   * 计算“每层覆盖信息”，包含关于哪些部分被映射位置覆盖的信息。
   * 计算影像的纹理坐标属性，每个投影一个，并存储为
   *
   * <code>_imageryTexCoordAttributesPerProjection</code>。
   * 更新影像（即通过调用 <code>Imagery.processStateMachine</code> 处理其状态机），直到它们处于
   *
   * @param {ImageryLayer} imageryLayer <code>ImageryState.READY</code> 状态。
   * @returns {ImageryCoverage[]} The 帧状态
   */
  coveragesForImageryLayer(imageryLayer) {
    const model = this._model;
    const imageryLayers = model.imageryLayers;
    const index = imageryLayers.indexOf(imageryLayer);
    if (index === -1) {
      throw new DeveloperError("Imagery layer is not part of the model");
    }
    const coveragesPerLayer = this._coveragesPerLayer;
    if (!defined(coveragesPerLayer)) {
      throw new DeveloperError(
        `The coveragesPerLayer have not been computed yet`,
      );
    }
    return coveragesPerLayer[index];
  }

  /**
   * 删除定义的 <code>_coveragesPerLayer</code>。
   *
   * 这将对每组覆盖信息调用 <code>deleteCoverages</code>，最终删除 <code>_coveragesPerLayer</code>。
   * 这将导致影像的引用计数器减少。
   * 删除给定影像层下的给定影像覆盖对象，意味着它将导致影像的引用计数器减少。
   *
   * 如果影像图层已经被销毁，则不会发生任何变化。
   * the mapping between the imagery and the primitive. It will...
   * <ul>
   *   <li>
   * Compute the <code>MappedPositions</code> of the primitive,
   * one instance for each ellipsoid
   *   </li>
   *   <li>
   * Compute the "coverages per layer", containing the information
   * about which parts of the respective imagery layer are covered
   * by the mapped positions
   *   </li>
   *   <li>
   * Compute the texture coordinate attributes for the imagery, one
   * for each projection, and store them as the
   * <code>_imageryTexCoordAttributesPerProjection</code>
   *   </li>
   *   <li>
   * Update the imageries (i.e. processing their state machine by
   * calling <code>Imagery.processStateMachine</code>) until they
   * are in the <code>ImageryState.READY</code> state
   *   </li>
   * </ul>
   *
   * @param {FrameState} frameState The frame state
   */
  update(frameState) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("frameState", frameState);
    //>>includeEnd('debug');

    // If the imagery layers have been modified since the last call
    // to this function, then re-build everything
    const model = this._model;
    const content = model.content;
    const tileset = content.tileset;
    const modificationCounter = tileset.imageryLayersModificationCounter;
    if (this._lastImageryLayersModificationCounter !== modificationCounter) {
      delete this._mappedPositionsPerEllipsoid;
      this._lastImageryLayersModificationCounter = modificationCounter;
    }

    if (this._mappedPositionsNeedUpdate) {
      model.resetDrawCommands();
      this._mappedPositionsPerEllipsoid =
        this._computeMappedPositionsPerEllipsoid();
      this._deleteCoveragesPerLayer();
      this._destroyImageryTexCoordAttributes();
    }

    if (!defined(this._imageryTexCoordAttributesPerProjection)) {
      this._imageryTexCoordAttributesPerProjection =
        this._computeImageryTexCoordsAttributesPerProjection();
      this._uploadImageryTexCoordAttributes(frameState.context);
    }

    if (!defined(this._coveragesPerLayer)) {
      this._computeCoveragesPerLayer();
      this._allImageriesReady = false;
    }
    if (!this._allImageriesReady) {
      this._updateImageries(frameState);
    }
  }

  /**
   * Delete the <code>_coveragesPerLayer</code> if they are defined.
   *
   * This will call <code>deleteCoverages</code> for each set of coverages,
   * and eventually delete the <code>_coveragesPerLayer</code>.
   *
   * This will cause the reference counters of the imageries to be
   * decreased.
   */
  _deleteCoveragesPerLayer() {
    const coveragesPerLayer = this._coveragesPerLayer;
    if (!defined(coveragesPerLayer)) {
      return;
    }
    const imageryLayers = this._currentImageryLayers;
    const length = coveragesPerLayer.length;
    for (let i = 0; i < length; i++) {
      const imageryLayer = imageryLayers[i];
      const coverages = coveragesPerLayer[i];
      this._deleteCoverages(imageryLayer, coverages);
    }
    delete this._currentImageryLayers;
    delete this._coveragesPerLayer;
  }

  /**
   * Delete the given imagery coverage objects for the given imagery
   * layer, meaning that it will cause the reference counters of the
   * imageries to be decreased.
   *
   * If the imagery layer already has been destroyed, then nothing
   * 将完成。
   *
   * @param {ImageryLayer} imageryLayer 影像图层
   * @param {ImageryCoverage[]} coverages 覆盖区域
   */
  _deleteCoverages(imageryLayer, coverages) {
    if (imageryLayer.isDestroyed()) {
      return;
    }
    const length = coverages.length;
    for (let i = 0; i < length; i++) {
      const coverage = coverages[i];
      const imagery = coverage.imagery;
      imagery.releaseReference();
    }
  }

  /**
   * 为包含在其中的类型数组创建 GPU 缓冲区
   * 在 <code>_imageryTexCoordAttributesPerProjection</code> 中
   *
   * @param {Context} context GL 上下文
   */
  _uploadImageryTexCoordAttributes(context) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("context", context);
    //>>includeEnd('debug');

    const attributes = this._imageryTexCoordAttributesPerProjection;
    if (!defined(attributes)) {
      return;
    }
    const n = attributes.length;
    for (let i = 0; i < n; i++) {
      const attribute = attributes[i];

      // Allocate the GL resources for the new attribute
      const imageryTexCoordBuffer = Buffer.createVertexBuffer({
        context: context,
        typedArray: attribute.typedArray,
        usage: BufferUsage.STATIC_DRAW,
      });

      // TODO_DRAPING Review this. Probably, some cleanup
      // has to happen somewhere else after setting this.
      // Check that the call to "destroy" in
      // _destroyImageryTexCoordAttributes is the right
      // thing to do here.
      imageryTexCoordBuffer.vertexArrayDestroyable = false;

      attribute.buffer = imageryTexCoordBuffer;
    }
  }

  /**
   * 销毁 <code>_imageryTexCoordAttributesPerProjection</code>
   * 数组。
   *
   * 这是用于清理分配的 GPU 资源，在
   * 它们应该通过
   * <code>_computeImageryTexCoordsAttributesPerProjection</code>
   */
  _destroyImageryTexCoordAttributes() {
    const attributes = this._imageryTexCoordAttributesPerProjection;
    if (!defined(attributes)) {
      return;
    }
    const n = attributes.length;
    for (let i = 0; i < n; i++) {
      const attribute = attributes[i];
      if (defined(attribute)) {
        if (defined(attribute.buffer)) {
          if (!attribute.buffer.isDestroyed()) {
            attribute.buffer.destroy();
          }
        }
        attributes[i] = undefined;
      }
    }
    delete this._imageryTexCoordAttributesPerProjection;
  }

  /**
   * 重新计算之前，<code>MappedPositions</code> 是否需要
   * 通过 <code>_computeMappedPositionsPerEllipsoid</code> 重新计算。
   *
   * 当位置尚未计算，或者模型的
   * <code>modelMatrix</code> 自上次调用后发生变化时，此值为 <code>true</code>。
   * 映射位置需要更新
   *
   * @returns {boolean} Whether 计算每个椭球体的原始几何体的映射位置。
   * @private
   */
  get _mappedPositionsNeedUpdate() {
    if (!defined(this._mappedPositionsPerEllipsoid)) {
      return true;
    }
    const model = this._model;
    const lastModelMatrix = this._mappedPositionsModelMatrix;
    if (!Matrix4.equals(model.modelMatrix, lastModelMatrix)) {
      return true;
    }
    return false;
  }

  /**
   * 计算每个椭球体的映射位置。
   *
   * 计算模型中出现在影像图层中的
   * <i>唯一</i>的椭球体，并为每个椭球体创建一个 <code>MappedPositions</code>
   * 对象。
   *
   * 相应的 <code>MappedPositions</code> 对象将包含
   * 从原始几何体的位置计算出的地图位置。这些将作为计算
   * 被原始几何体覆盖的影像部分的基础。
   * 这些映射位置依赖于模型的当前 <code>modelMatrix</code>。因此，当模型矩阵发生变化时，它们必须重新计算。
   *
   * 映射位置
   * 计算一个数组，包含在给定集合的影像图层中出现的
   * <i>唯一</i>的椭球体。
   *
   * @returns {MappedPositions[]} The 椭球体
   * @private
   */
  _computeMappedPositionsPerEllipsoid() {
    const model = this._model;
    const runtimeNode = this._runtimeNode;
    const runtimePrimitive = this._runtimePrimitive;

    const primitivePositionAttribute =
      ModelPrimitiveImagery._obtainPrimitivePositionAttribute(
        runtimePrimitive.primitive,
      );
    const numPositions = primitivePositionAttribute.count;

    const primitivePositionTransform =
      ModelPrimitiveImagery._computePrimitivePositionTransform(
        model,
        runtimeNode,
        undefined,
      );

    const mappedPositionsPerEllipsoid = [];
    const ellipsoids = ModelPrimitiveImagery._computeUniqueEllipsoids(
      model.imageryLayers,
    );

    const length = ellipsoids.length;
    for (let i = 0; i < length; i++) {
      const ellipsoid = ellipsoids[i];
      const cartographicPositions =
        ModelImageryMapping.createCartographicPositions(
          primitivePositionAttribute,
          primitivePositionTransform,
          ellipsoid,
        );
      const cartographicBoundingRectangle =
        ModelImageryMapping.computeCartographicBoundingRectangle(
          cartographicPositions,
        );

      const mappedPositions = new MappedPositions(
        cartographicPositions,
        numPositions,
        cartographicBoundingRectangle,
        ellipsoid,
      );
      mappedPositionsPerEllipsoid.push(mappedPositions);
    }
    Matrix4.clone(model.modelMatrix, this._mappedPositionsModelMatrix);
    return mappedPositionsPerEllipsoid;
  }

  /**
   * 计算一个数组，包含在影像图层中出现的
   * <i>唯一</i>的椭球体。
   *
   * @param {ImageryLayerCollection} imageryLayers
   * @returns {Ellipsoid[]} The 椭球体
   * @private
   */
  static _computeUniqueEllipsoids(imageryLayers) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("imageryLayers", imageryLayers);
    //>>includeEnd('debug');

    const ellipsoidsSet = new Set();
    const length = imageryLayers.length;
    for (let i = 0; i < length; i++) {
      const imageryLayer = imageryLayers.get(i);
      const ellipsoid = ModelPrimitiveImagery._getEllipsoid(imageryLayer);
      ellipsoidsSet.add(ellipsoid);
    }
    return [...ellipsoidsSet];
  }

  /**
   * 为影像图层中使用的每个独特投影计算一个坐标属性。
   * 这是获取映射位置，使用相应的投影进行投影，并创建描述这些位置的纹理坐标的纹理坐标属性，相对于映射位置的地图边界矩形。
   *
   * 属性
   * 计算一个数组，包含在给定影像图层中使用的投影。
   * （注意，该数组可能包含重复项）
   * 影像图层
   * 投影
   *
   * @returns {ModelComponents.Attribute[]} The 创建纹理坐标，每个投影一个。
   */
  _computeImageryTexCoordsAttributesPerProjection() {
    const model = this._model;
    const imageryLayers = model.imageryLayers;

    // Compute the arrays containing ALL projections and the array
    // containing the UNIQUE projections from the imagery layers.
    // Texture coordinate attributes only have to be created once
    // for each projection.
    const allProjections =
      ModelPrimitiveImagery._extractProjections(imageryLayers);
    const uniqueProjections = [...new Set(allProjections)];

    // Create one texture coordinate attribute for each distinct
    // projection that is used in the imagery layers
    const attributes = this._createImageryTexCoordAttributes(uniqueProjections);
    return attributes;
  }

  /**
   * 这将为给定的每个投影创建一个纹理坐标属性。
   * the given imagery layers.
   *
   * (Note that this array may contain duplicates)
   *
   * @param {ImageryLayerCollection} imageryLayers The imagery layers
   * @returns {MapProjection[]} The projections
   * @private
   */
  static _extractProjections(imageryLayers) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("imageryLayers", imageryLayers);
    //>>includeEnd('debug');

    const projections = [];
    const length = imageryLayers.length;
    for (let i = 0; i < length; i++) {
      const imageryLayer = imageryLayers.get(i);
      const projection = ModelPrimitiveImagery._getProjection(imageryLayer);
      projections.push(projection);
    }
    return projections;
  }

  /**
   * Returns the projection of the given imagery layer.
   *
   * This only exists to hide a train wreck
   *
   * @param {ImageryLayer} imageryLayer The imagery layer
   * @returns {MapProjection} The projection
   * @private
   */
  static _getProjection(imageryLayer) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("imageryLayer", imageryLayer);
    //>>includeEnd('debug');
    const projection = imageryLayer.imageryProvider.tilingScheme.projection;
    return projection;
  }

  /**
   * Create texture coordinates, one for each projection.
   *
   * This will create a texture coordinate attribute for each of the given projections,
   * 使用 <code>ModelImageryMapping.createTextureCoordinatesAttributeForMappedPositions</code>，
   *
   * （这意味着给定的投影确实应该是唯一的，
   * 即不包含重复项）
   *
   * @param {MapProjection[]} uniqueProjections 投影
   * @returns {ModelComponents.Attribute[]} The 属性
   */
  _createImageryTexCoordAttributes(uniqueProjections) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("uniqueProjections", uniqueProjections);
    //>>includeEnd('debug');

    const imageryTexCoordAttributePerUniqueProjection = [];
    const length = uniqueProjections.length;
    for (let i = 0; i < length; i++) {
      // Obtain the mapped positions for the ellipsoid that is used
      // in the projection (i.e. the cartographic positions of the
      // primitive, for the respective ellipsoid)
      const projection = uniqueProjections[i];
      const ellipsoid = projection.ellipsoid;
      const mappedPositions = this.mappedPositionsForEllipsoid(ellipsoid);

      // Create the actual attribute
      const imageryTexCoordAttribute =
        ModelImageryMapping.createTextureCoordinatesAttributeForMappedPositions(
          mappedPositions,
          projection,
        );
      imageryTexCoordAttributePerUniqueProjection.push(
        imageryTexCoordAttribute,
      );
    }
    return imageryTexCoordAttributePerUniqueProjection;
  }

  /**
   * 根据与模型相关的
   * 影像图层，计算基体的覆盖信息。
   *
   * 这会更新 <code>_coveragesPerLayer[layerIndex]</code>，该数组包含描述被基体覆盖的影像瓦片及其纹理坐标矩形范围的
   * <code>ImageryCoverage</code> 对象。
   * 通过 <code>_computeMappedPositionsPerEllipsoid</code> 计算完基体的映射位置后，
   * 必须调用此操作。
   *
   * 根据给定的影像图层，计算基体的覆盖信息。
   * 这会返回一个包含描述被基体覆盖的影像瓦片及其纹理坐标矩形范围的
   *
   * @private
   */
  _computeCoveragesPerLayer() {
    const coveragesPerLayer = [];
    const currentImageryLayers = [];

    const model = this._model;
    const imageryLayers = model.imageryLayers;
    const length = imageryLayers.length;
    for (let i = 0; i < length; i++) {
      const imageryLayer = imageryLayers.get(i);
      const coverages = this._computeCoverage(imageryLayer);
      coveragesPerLayer.push(coverages);
      currentImageryLayers.push(imageryLayer);
    }

    this._coveragesPerLayer = coveragesPerLayer;
    this._currentImageryLayers = currentImageryLayers;
  }

  /**
   * <code>ImageryCoverage</code> 对象的数组。
   * 通过 <code>_computeMappedPositionsPerEllipsoid</code> 计算完基体的映射位置后，
   *
   * 必须调用此操作。
   * 影像图层
   * 覆盖信息
   *
   * 为从给定适合具有指定边界矩形的基体的影像图层中访问影像，计算一个 <code>level</code>。
   * 影像图层
   *
   * @param {ImageryLayer} imageryLayer 地图学
   * @returns {ImageryCoverage[]} The 边界矩形，根据 MappedPositions 获取
   * @private
   */
  _computeCoverage(imageryLayer) {
    const mappedPositions = this.mappedPositionsForImageryLayer(imageryLayer);
    const cartographicBoundingRectangle =
      mappedPositions.cartographicBoundingRectangle;

    const imageryLevel = this._computeImageryLevel(
      imageryLayer,
      cartographicBoundingRectangle,
    );

    const coverages = ImageryCoverage.createImageryCoverages(
      cartographicBoundingRectangle,
      imageryLayer,
      imageryLevel,
    );
    return coverages;
  }

  /**
   * 影像层
   * 影像级别
   * 更新所有 <code>Imagery</code> 对象。
   *
   * @param {ImageryLayer} imageryLayer 影像图层
   * @param {Rectangle} cartographicBoundingRectangle 从给定的影像图层中
   * 获取由 MappedPositions 得到的边界矩形，作为基体的边界矩形。
   * 影像级别
   * @returns {number} The 影像层
   */
  _computeImageryLevel(imageryLayer, cartographicBoundingRectangle) {
    const imageryProvider = imageryLayer.imageryProvider;
    const tilingScheme = imageryProvider.tilingScheme;
    const rectangle = tilingScheme.rectangle;

    // The number of tiles covered by the boundingRectangle (b)
    // for a certain level, based on the tiling scheme rectangle (r) is
    // numberOfTilesCovered = b / (r / 2^level)
    // Solving for "level" yields
    // level = log2( numberOfTilesCovered * r / b)

    // The goal here is to drape approximately (!) one imagery
    // tile on each primitive. In practice, it may be more
    // (up to 9 in theory)
    const desiredNumberOfTilesCovered = 1;

    // Perform the computation of the desired level, based on the
    // number of tiles that should be covered (by whatever is
    // larger, the width or the height)
    let boundingRectangleSize = cartographicBoundingRectangle.width;
    let rectangleSize = rectangle.width;
    if (
      cartographicBoundingRectangle.height > cartographicBoundingRectangle.width
    ) {
      boundingRectangleSize = cartographicBoundingRectangle.height;
      rectangleSize = rectangle.height;
    }
    const desiredLevel = Math.log2(
      (desiredNumberOfTilesCovered * rectangleSize) / boundingRectangleSize,
    );

    // Clamp the level to a valid range, and an integer value
    const imageryLevel = ImageryCoverage._clampImageryLevel(
      imageryProvider,
      desiredLevel,
    );
    return imageryLevel;
  }

  /**
   * 更新所有 <code>Imagery</code> 对象。
   *
   * 作为 <code>update</code> 的一部分调用，直到所有所需的
   * 影像瓦片处于 <code>state</code> 为 <code>ImageryState.READY</code> 的状态，才进行更新。
   * 在确定哪些影像瓦片被基体覆盖后（即调用 <code>_computeCoverages</code> 计算完 <code>_coveragesPerLayer</code> 之后），调用此操作。
   *
   * 对于每个被覆盖的影像瓦片，会调用
   * <code>Imagery.processStateMachine</code> 直到它们处于 READY、FAILED 或 INVALID 状态。
   * 当所有瓦片都进入这些最终状态之一时，将设置 <code>_allImageriesReady</code> 标志为 <code>true</code>。
   *
   * 帧状态，传递给
   * <code>imagery.processStateMachine</code>
   * 返回包含 <code>MappedPositions</code> 对象的数组
   *
   * Once they all are in one of these final states, it will set the
   * <code>_allImageriesReady</code> flag to <code>true</code>.
   *
   * @param {FrameState} frameState The frame state, to be passed to
   * <code>imagery.processStateMachine</code>
   * @private
   */
  _updateImageries(frameState) {
    const model = this._model;
    const coveragesPerLayer = this._coveragesPerLayer;
    const length = coveragesPerLayer.length;
    let allImageriesReady = true;
    for (let i = 0; i < length; i++) {
      const coverages = coveragesPerLayer[i];
      const n = coverages.length;
      for (let j = 0; j < n; j++) {
        const coverage = coverages[j];
        const imagery = coverage.imagery;

        // In the context of loading the imagery for draping
        // it over the primitive, the imagery counts as "ready"
        // when it is really ready, but also when it failed
        // or was invalid (otherwise, the primitive would
        // never turn "ready"
        const countsAsReady =
          imagery.state === ImageryState.READY ||
          imagery.state === ImageryState.FAILED ||
          imagery.state === ImageryState.INVALID;
        if (!countsAsReady) {
          allImageriesReady = false;
          imagery.processStateMachine(frameState, false, false);
        }
      }
    }

    // When the imageries turned ready, reset the draw commands
    // to trigger a rendering with the updated draw commands
    // that include the imagery now.
    if (allImageriesReady) {
      model.resetDrawCommands();
    }
    this._allImageriesReady = allImageriesReady;
  }

  /**
   * Returns the <code>MappedPositions</code> object that contains
   * 已计算出的原始点位置信息
   * 针对给定的影像图层
   *
   * 假设 <code>_computeMappedPositionsPerEllipsoid</code> 函数
   * 已经被调用
   *
   * @param {ImageryLayer} imageryLayer 影像图层
   * @returns {MappedPositions} The 映射位置
   * @throws {DeveloperError} If 对于该
   * 椭球，找不到映射位置
   */
  mappedPositionsForImageryLayer(imageryLayer) {
    const ellipsoid = ModelPrimitiveImagery._getEllipsoid(imageryLayer);
    return this.mappedPositionsForEllipsoid(ellipsoid);
  }

  /**
   * 返回包含已计算出的原始点位置信息的 <code>MappedPositions</code> 对象
   * 来自给定椭球
   * 此假设 <code>_computeMappedPositions</code> 函数
   *
   * 已经被调用
   * 该椭球
   *
   * @param {Ellipsoid} ellipsoid 映射位置
   * @returns {MappedPositions} The 对于该
   * @throws {DeveloperError} If 椭球，找不到映射位置
   * 返回用于覆盖影像的原始实体的纹理坐标属性
   */
  mappedPositionsForEllipsoid(ellipsoid) {
    const mappedPositionsPerEllipsoid = this._mappedPositionsPerEllipsoid;
    if (!defined(mappedPositionsPerEllipsoid)) {
      throw new DeveloperError(
        `The mappedPositions have not been computed yet`,
      );
    }

    const length = mappedPositionsPerEllipsoid.length;
    for (let i = 0; i < length; i++) {
      const mappedPositions = mappedPositionsPerEllipsoid[i];
      if (mappedPositions.ellipsoid === ellipsoid) {
        return mappedPositions;
      }
    }
    throw new DeveloperError(
      `Could not find mapped positions for ellipsoid ${ellipsoid}`,
    );
  }

  /**
   * 当此对象为 <code>ready</code> 时，这些属性将可用，并且
   * 将包含每个独特的投影对应的一个属性
   *
   * 这些属性存在于影像图层中
   * 属性
   * 返回覆盖计算是否“准备就绪”
   *
   * @returns {ModelComponents.Attribute[]} The 这意味着 <code>coveragesPerLayer</code> 信息
   */
  imageryTexCoordAttributesPerProjection() {
    const imageryTexCoordAttributesPerProjection =
      this._imageryTexCoordAttributesPerProjection;
    if (!defined(imageryTexCoordAttributesPerProjection)) {
      throw new DeveloperError(
        `The imagery texture coordinate attributes have not been computed yet`,
      );
    }
    return this._imageryTexCoordAttributesPerProjection;
  }

  /**
   * 已计算，它描述了被原始实体覆盖的影像瓦片集合
   *
   * 以及所有被覆盖的影像瓦片都处于“准备就绪”状态
   * （即 <code>ImageryState.READY</code>、<code>FAILED</code> 或 <code>INVALID</code>）
   * 覆盖计算已准备就绪
   * 返回此对象是否被销毁
   * 如果此对象被销毁，调用除 <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError}
   * 此对象被销毁
   *
   * @returns {boolean} Whether 销毁此对象及其所有资源
   */
  get ready() {
    const coveragesPerLayer = this._coveragesPerLayer;
    if (!defined(coveragesPerLayer)) {
      return false;
    }
    return this._allImageriesReady;
  }

  /**
   * 计算必须应用于原始实体位置属性的变换，以计算
   *
   * ECEF 坐标中的实际最终位置
   * 这是基于在 buildDrawCommands 结束时进行的边界球计算
   *
   * @returns {boolean} Whether 模型
   */
  isDestroyed() {
    return false;
  }

  /**
   * 运行时节点
   */
  destroy() {
    if (this.isDestroyed()) {
      return;
    }
    this._deleteCoveragesPerLayer();
    this._destroyImageryTexCoordAttributes();
    return destroyObject(this);
  }

  /**
   * 原始实体所连接的运行时节点
   * 结果
   * 结果
   *
   * 返回给定原始实体的 <code>"POSITION"</code> 属性
   * 必须提供 <code>"POSITION"</code> 属性。如果未为给定原始实体定义该属性，则抛出 <code>DeveloperError</code>
   *
   * @param {Model} model 原始实体
   * @param {ModelComponents.Node} runtimeNode 运行时节点
   * 原始实体所连接的运行时节点
   * @param {Matrix4} [result] 结果
   * @returns {Matrix4} The 结果
   * @private
   */
  static _computePrimitivePositionTransform(model, runtimeNode, result) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("model", model);
    Check.defined("runtimeNode", runtimeNode);
    //>>includeEnd('debug');

    if (!defined(result)) {
      result = new Matrix4();
    }

    const modelSceneGraph = model.sceneGraph;

    Matrix4.clone(Matrix4.IDENTITY, result);
    Matrix4.multiply(result, model.modelMatrix, result);
    Matrix4.multiply(result, modelSceneGraph.components.transform, result);
    Matrix4.multiply(result, modelSceneGraph.axisCorrectionMatrix, result);
    Matrix4.multiply(result, runtimeNode.computedTransform, result);
    return result;
  }

  /**
   * 返回给定原始实体的 <code>"POSITION"</code> 属性
   *
   * 需要 <code>"POSITION"</code> 属性。如果未定义，则抛出 <code>DeveloperError</code>
   * 原始实体没有位置属性
   * 返回给定影像图层的椭球
   *
   * @param {ModelComponents.Primitive} primitive 仅用于隐藏火车事故
   * @returns {ModelComponents.Attribute} The 影像图层
   * @throws {DeveloperError} If there is no position attribute
   * @private
   */
  static _obtainPrimitivePositionAttribute(primitive) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("primitive", primitive);
    //>>includeEnd('debug');

    const primitivePositionAttribute = ModelUtility.getAttributeBySemantic(
      primitive,
      "POSITION",
    );
    if (!defined(primitivePositionAttribute)) {
      throw new DeveloperError(
        "The primitive does not have a POSITION attribute",
      );
    }
    return primitivePositionAttribute;
  }

  /**
   * Returns the ellipsoid of the given imagery layer.
   *
   * This only exists to hide a train wreck
   *
   * @param {ImageryLayer} imageryLayer The imagery layer
   * @returns {Ellipsoid} The ellipsoid
   * @private
   */
  static _getEllipsoid(imageryLayer) {
    const ellipsoid =
      imageryLayer.imageryProvider.tilingScheme.projection.ellipsoid;
    return ellipsoid;
  }
}

export default ModelPrimitiveImagery;
