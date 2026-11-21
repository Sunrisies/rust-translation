import { Check, DeveloperError, defined, destroyObject } from "@cesium/core";
import ImageryConfiguration from "./ImageryConfiguration.js";
import ModelPrimitiveImagery from "./ModelPrimitiveImagery.js";

/**
 * 一个用于管理 <code>Model</code> 上影像覆盖的类。
 *
 * 此类的实例在 Model 构造函数中创建。它将
 * 创建承载所需信息的数据结构
 * 以便将影像纹理映射到模型基元上。
 *
 * 它提供两个函数来管理此覆盖过程的生命周期：
 *
 * <code>update</code> 函数由 <code>Model.update</code>
 * 函数在每一帧中被调用。它将为模型中出现的每个基元创建一个 <code>ModelPrimitiveImagery</code>
 * 实例，并分别调用这些实例的
 * <code>update</code> 函数。
 *
 * <code>ready</code> 获取器用于确定
 * 覆盖计算是否完成，且 <code>Model</code> 的更新过程可以继续，最终导致 <code>model.ready</code> 标志变为
 * <code>true</code>。当模型的所有
 * 影像图层均为 <code>ready</code>，且所有
 * <code>ModelPrimitiveImagery</code> 实例均为 <code>ready</code> 时，模型影像视为“ ready”。
 * <code>ModelPrimitiveImagery</code> instances are <code>ready</code>.
 *
 * @private
 */
class ModelImagery {
  /**
   * 创建新实例
   *
   * @param {Model} model 模型
   * @throws {DeveloperError} If 模型未定义
   */
  constructor(model) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("model", model);
    //>>includeEnd('debug');

    /**
     * 此实例所创建的模型。
     *
     * @type {Model}
     * @readonly
     * @private
     */
    this._model = model;

    /**
     * 每个出现在模型中的基元对应一个 <code<ModelPrimitiveImagery</code>
     * 。
     *
     * 最初，此值为 <code>undefined</code>。当调用 <code>update</code>
     * 函数且与模型相关的所有影像图层均为 <code>ready</code> 时，此值会初始化为每个运行时基元一个 <code>ModelPrimitiveImagery</code> 实例（即每个
     * model are <code>ready</code>, this is initialized with one instance
     * of a <code>ModelPrimitiveImagery</code> per runtime primitive (i.e. one for
     * <code>model.sceneGraph._runtimeNodes[n]._runtimePrimitives[p]</code>）
     *
     * @type {ModelPrimitiveImagery[]|undefined}
     * @private
     */
    this._modelPrimitiveImageries = undefined;

    /**
     * 每个与模型关联的 <code>ImageryLayer</code>
     * 对应一个 <code>ImageryConfiguration</code> 对象。
     *
     * 此函数用于确定自上一次
     * <code>update</code> 调用以来，影像图层的配置（相关属性值）是否发生变化，这应导致模型的绘制命令被重置。
     * 在每一帧中由 <code>Model.update</code> 调用的更新函数。
     * 此函数检查与模型相关的影像图层对象是否全部为 <code>ready</code>。如果尚未
     *
     * @type {ImageryConfiguration[]}
     * @private
     */
    this._imageryConfigurations = [];
  }

  /**
   * 变为 <code>ready</code>，则不做任何操作。
   * 否则，就调用 <code>update</code> 函数。
   *
   * This checks whether the imagery layer objects that are associated
   * with the model are all <code>ready</code>. If they are not yet
   * ready, then nothing is done.
   *
   * Otherwise, this just calls the <code>update</code> function of
   * <code>_modelPrimitiveImageries</code> 数组（如果尚未创建，则创建它们）。
   * 尚未被创建。
   *
   * @param {FrameState} frameState 帧状态
   */
  update(frameState) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("frameState", frameState);
    //>>includeEnd('debug');

    if (!this._hasImagery) {
      // When there is no imagery, make sure to delete any model primitive
      // imageries that may previously have been created
      this._deleteModelPrimitiveImageries();
      return;
    }

    if (!this._allImageryLayersReady) {
      return;
    }

    if (!defined(this._modelPrimitiveImageries)) {
      this._modelPrimitiveImageries = this._createModelPrimitiveImageries();
    }
    this._updateModelPrimitiveImageries(frameState);

    this._checkForModifiedImageryConfigurations();
  }

  /**
   * 创建包含
   * 模型中的每个原始实体对应一个 <code>ModelPrimitiveImagery</code> 的数组。
   * 该模型中的原始实体。
   *
   * @returns {ModelPrimitiveImagery[]} The 模型原始实体影像图层
   * @private
   */
  _createModelPrimitiveImageries() {
    const model = this._model;
    const runtimeNodesAndPrimitives = this._collectRuntimeNodesAndPrimitives();
    const modelPrimitiveImageries = [];
    const length = runtimeNodesAndPrimitives.length;
    for (let i = 0; i < length; i++) {
      const runtimeNodeAndPrimitive = runtimeNodesAndPrimitives[i];
      const runtimeNode = runtimeNodeAndPrimitive.runtimeNode;
      const runtimePrimitive = runtimeNodeAndPrimitive.runtimePrimitive;
      const modelPrimitiveImagery = new ModelPrimitiveImagery(
        model,
        runtimeNode,
        runtimePrimitive,
      );
      runtimePrimitive.primitive.modelPrimitiveImagery = modelPrimitiveImagery;
      modelPrimitiveImageries.push(modelPrimitiveImagery);
    }
    return modelPrimitiveImageries;
  }

  /**
   * 计算模型的所有运行时节点和原始实体。
   *
   * 这只是一个包含
   * <code>{ runtimeNode, runtimePrimitive }</code>
   * 每个
   * <code>model.sceneGraph._runtimeNodes[n]._runtimePrimitives[p]</code> 的数组。
   *
   * @returns {object[]} The 运行时节点和原始实体
   * @private
   */
  _collectRuntimeNodesAndPrimitives() {
    const model = this._model;
    const sceneGraph = model.sceneGraph;
    const runtimeNodes = sceneGraph._runtimeNodes;
    const runtimeNodesAndPrimitives = [];
    for (let i = 0; i < runtimeNodes.length; i++) {
      const runtimeNode = runtimeNodes[i];
      if (!defined(runtimeNode)) {
        continue;
      }
      for (let j = 0; j < runtimeNode.runtimePrimitives.length; j++) {
        const runtimePrimitive = runtimeNode.runtimePrimitives[j];
        runtimeNodesAndPrimitives.push({
          runtimeNode: runtimeNode,
          runtimePrimitive: runtimePrimitive,
        });
      }
    }
    return runtimeNodesAndPrimitives;
  }

  /**
   * 只需对每个 <code>ModelPrimitiveImagery</code> 调用 <code>update</code> 方法。
   * 作为该类的 <code>update</code> 的一部分。
   *
   * @private
   */
  _updateModelPrimitiveImageries(frameState) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("frameState", frameState);
    //>>includeEnd('debug');

    if (!defined(this._modelPrimitiveImageries)) {
      throw new DeveloperError(
        "The modelPrimitiveImageries have not been created",
      );
    }

    const modelPrimitiveImageries = this._modelPrimitiveImageries;
    const length = modelPrimitiveImageries.length;
    for (let i = 0; i < length; i++) {
      const modelPrimitiveImagery = modelPrimitiveImageries[i];
      modelPrimitiveImagery.update(frameState);
    }
  }

  /**
   * 如果已经创建，则销毁并删除所有 <code>ModelPrimitiveImagery</code> 实例。
   * 返回该实例是否“准备就绪”。
   */
  _deleteModelPrimitiveImageries() {
    const modelPrimitiveImageries = this._modelPrimitiveImageries;
    if (!defined(modelPrimitiveImageries)) {
      return;
    }
    const length = modelPrimitiveImageries.length;
    for (let i = 0; i < length; i++) {
      const modelPrimitiveImagery = modelPrimitiveImageries[i];
      modelPrimitiveImagery.destroy();
    }
    delete this._modelPrimitiveImageries;
    this._model.resetDrawCommands();
  }

  /**
   * 这意味着与模型相关的所有影像图层都
   *
   * 是 <code>ready</code>，且所有 <code>ModelPrimitiveImagery</code> 实例都是 <code>ready</code>。
   * 当此值为 <code>true</code> 时，映射计算已完成，包含映射信息的结构已初始化。否则，后续调用 <code>update</code>
   * 将执行必要的计算，直到该 getter 最终返回 <code>true</code>。
   *
   * 该实例是“准备就绪”的
   * 返回模型是否关联有影像图层。
   * 返回与模型相关的所有影像图层是否都是 <code>ready</code>。
   * 如果模型没有影像，则始终返回 <code>true</code>。否则，返回每个影像图层是否 <code>ready</code>。
   * 返回所有 <code>ModelPrimitiveImagery</code> 实例是否都是 <code>ready</code>。
   *
   * @returns {boolean} Whether 检查自上次调用 <code>update</code> 函数以来，任何影像图层的设置（如 alpha 或 hue）是否发生变化。
   */
  get ready() {
    if (!this._hasImagery) {
      return true;
    }
    if (!this._allImageryLayersReady) {
      return false;
    }
    if (!this._allModelPrimitiveImageriesReady) {
      return false;
    }
    return true;
  }

  /**
   * 如果发生变化，模型的绘制命令将被重置。
   *
   * @private
   */
  get _hasImagery() {
    const model = this._model;
    const imageryLayers = model.imageryLayers;
    return defined(imageryLayers) && imageryLayers.length > 0;
  }

  /**
   * 返回自上次更新 <code>ImageryConfiguration</code> 对象以来，任何影像图层的设置（如 alpha 或 hue）是否发生变化。
   * 如果有修改，
   *
   * 则为每个出现在模型中的影像图层创建一个 <code>ImageryConfiguration</code> 对象，并将它们存储为 <code>_imageryConfigurations</code>。
   * <code>true</code>. Otherwise, it returns whether each imagery
   * layer is <code>ready</code>.
   *
   * @private
   */
  get _allImageryLayersReady() {
    if (!this._hasImagery) {
      return true;
    }
    const imageryLayers = this._model.imageryLayers;
    const length = imageryLayers.length;
    for (let i = 0; i < length; i++) {
      const imageryLayer = imageryLayers.get(i);
      if (!imageryLayer.ready) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns whether all <code>ModelPrimitiveImagery</code> instances
   * are are <code>ready</code>.
   *
   * @private
   */
  get _allModelPrimitiveImageriesReady() {
    const modelPrimitiveImageries = this._modelPrimitiveImageries;
    if (!defined(modelPrimitiveImageries)) {
      return false;
    }
    const length = modelPrimitiveImageries.length;
    for (let i = 0; i < length; i++) {
      const modelPrimitiveImagery = modelPrimitiveImageries[i];
      if (!modelPrimitiveImagery.ready) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check whether any of the settings of any imagery layer (like alpha
   * or hue) has been changed since the last call to the <code>update</code>
   * function.
   *
   * If this is the case, the draw commands of the model will be reset.
   */
  _checkForModifiedImageryConfigurations() {
    if (this._imageryConfigurationsModified()) {
      this._updateImageryConfigurations();
      const model = this._model;
      model.resetDrawCommands();
    }
  }

  /**
   * Returns whether any setting of an imagery layer (like alpha or hue) has
   * been changed since the last time the <code>ImageryConfiguration</code>
   * objects have been updated.
   *
   * @returns {boolean} Whether there was a modification
   */
  _imageryConfigurationsModified() {
    const model = this._model;
    const imageryLayers = model.imageryLayers;
    const imageryConfigurations = this._imageryConfigurations;
    if (imageryLayers.length !== imageryConfigurations.length) {
      return true;
    }
    for (let i = 0; i < imageryLayers.length; i++) {
      const imageryLayer = imageryLayers.get(i);
      const imageryConfiguration = imageryConfigurations[i];

      if (imageryLayer.show !== imageryConfiguration.show) {
        return true;
      }
      if (imageryLayer.alpha !== imageryConfiguration.alpha) {
        return true;
      }
      if (imageryLayer.brightness !== imageryConfiguration.brightness) {
        return true;
      }
      if (imageryLayer.contrast !== imageryConfiguration.contrast) {
        return true;
      }
      if (imageryLayer.hue !== imageryConfiguration.hue) {
        return true;
      }
      if (imageryLayer.saturation !== imageryConfiguration.saturation) {
        return true;
      }
      if (imageryLayer.gamma !== imageryConfiguration.gamma) {
        return true;
      }
      if (imageryLayer.colorToAlpha !== imageryConfiguration.colorToAlpha) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create one <code>ImageryConfiguration</code> object for each imagery
   * layer that appears in the model, and store them as the
   * <code>_imageryConfigurations</code>.
   */
  _updateImageryConfigurations() {
    const model = this._model;
    const imageryLayers = model.imageryLayers;
    const imageryConfigurations = this._imageryConfigurations;
    imageryConfigurations.length = imageryLayers.length;
    for (let i = 0; i < imageryLayers.length; i++) {
      const imageryLayer = imageryLayers.get(i);
      imageryConfigurations[i] = new ImageryConfiguration(imageryLayer);
    }
  }

  /**
   * 返回该对象是否被销毁。
   *
   * 如果该对象被销毁，调用除
   * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError}。
   *
   * @returns {boolean} Whether 该对象已被销毁。
   */
  isDestroyed() {
    return false;
  }

  /**
   * 会销毁该对象及其所有资源。
   */
  destroy() {
    if (this.isDestroyed()) {
      return;
    }
    this._deleteModelPrimitiveImageries();
    return destroyObject(this);
  }
}

export default ModelImagery;
