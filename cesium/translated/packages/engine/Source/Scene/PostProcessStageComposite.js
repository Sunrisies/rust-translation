import {
  Check,
  Frozen,
  createGuid,
  defined,
  destroyObject,
} from "@cesium/core";

/**
 * 一组按逻辑一起执行的 {@link PostProcessStage} 或其他后处理复合阶段。
 * <p>
 * 所有阶段按数组顺序执行。输入纹理根据 <code>inputPreviousStageTexture</code> 的值变化。
 * 如果 <code>inputPreviousStageTexture</code> 为 <code>true</code>，则每个阶段的输入是场景或之前执行的阶段渲染出的输出纹理。
 * 如果 <code>inputPreviousStageTexture</code> 为 <code>false</code>，则复合中的每个阶段使用相同的输入纹理。输入纹理是场景渲染出的纹理，或之前阶段的输出纹理。
 * 或之前阶段的输出纹理。
 * </p>
 *
 * @alias PostProcessStageComposite
 * @constructor
 *
 * @param {object} options 一个具有以下属性的对象：
 * @param {Array} options.stages 按顺序执行的 {@link PostProcessStage} 或复合阶段的数组。
 * @param {boolean} [options.inputPreviousStageTexture=true] 是否执行每个后处理阶段，其中一个阶段的输入是前一个阶段的输出。否则，每个包含的阶段的输入是复合之前执行的阶段的输出。
 * @param {string} [options.name=createGuid()] 此后处理阶段的唯一名称，供其他复合体引用使用。如果未提供名称，将生成 GUID。
 * @param {object} [options.uniforms] 后处理阶段的统一变量的别名。
 *
 * @exception {DeveloperError} options.stages.length 必须大于 0.0。
 *
 * @see PostProcessStage
 *
 * @example
 * // 示例 1：可分离模糊滤镜
 * // blurXDirection 的输入是场景渲染出的纹理或之前阶段的输出。
 * // blurYDirection 的输入是 blurXDirection 渲染出的纹理。
 * scene.postProcessStages.add(new Cesium.PostProcessStageComposite({
 * stages : [blurXDirection, blurYDirection]
 * }));
 *
 * @example
 * // 示例 2：引用另一个后处理阶段的输出
 * scene.postProcessStages.add(new Cesium.PostProcessStageComposite({
 * inputPreviousStageTexture : false,
 * stages : [
 * // 与示例 1 相同。
 * new Cesium.PostProcessStageComposite({
 * inputPreviousStageTexture : true
 * stages : [blurXDirection, blurYDirection],
 * name : 'blur'
 *         }),
 * // 此阶段的输入纹理与 blurXDirection 的输入纹理相同，因为 inputPreviousStageTexture 为 false
 * new Cesium.PostProcessStage({
 * fragmentShader : compositeShader,
 * uniforms : {
 * blurTexture : 'blur' // 名为 'blur' 的复合体的输出（blurYDirection 渲染出的纹理）。
 *             }
 *         })
 *     ]
 * });
 *
 * @example
 * // 示例 3：创建统一变量别名
 * const uniforms = {};
 * Cesium.defineProperties(uniforms, {
 * filterSize : {
 * get : function() {
 * return blurXDirection.uniforms.filterSize;
 *         },
 * set : function(value) {
 * blurXDirection.uniforms.filterSize = blurYDirection.uniforms.filterSize = value;
 *         }
 *     }
 * });
 * scene.postProcessStages.add(new Cesium.PostProcessStageComposite({
 * stages : [blurXDirection, blurYDirection],
 * uniforms : uniforms
 * }));
 */
function PostProcessStageComposite(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.stages", options.stages);
  Check.typeOf.number.greaterThan(
    "options.stages.length",
    options.stages.length,
    0,
  );
  //>>includeEnd('debug');

  this._stages = options.stages;
  this._inputPreviousStageTexture = options.inputPreviousStageTexture ?? true;

  let name = options.name;
  if (!defined(name)) {
    name = createGuid();
  }
  this._name = name;

  this._uniforms = options.uniforms;

  // used by PostProcessStageCollection
  this._textureCache = undefined;
  this._index = undefined;

  this._selected = undefined;
  this._selectedShadow = undefined;
  this._parentSelected = undefined;
  this._parentSelectedShadow = undefined;
  this._combinedSelected = undefined;
  this._combinedSelectedShadow = undefined;
  this._selectedLength = 0;
  this._parentSelectedLength = 0;
  this._selectedDirty = true;
}

Object.defineProperties(PostProcessStageComposite.prototype, {
  /**
   * 决定此后处理阶段是否准备好执行。
   *
   * @memberof PostProcessStageComposite.prototype
   * @type {boolean}
   * @readonly
   */
  ready: {
    get: function () {
      const stages = this._stages;
      const length = stages.length;
      for (let i = 0; i < length; ++i) {
        if (!stages[i].ready) {
          return false;
        }
      }
      return true;
    },
  },
  /**
   * 此后处理阶段的唯一名称，供 PostProcessStageComposite 中的其他阶段引用。
   *
   * @memberof PostProcessStageComposite.prototype
   * @type {string}
   * @readonly
   */
  name: {
    get: function () {
      return this._name;
    },
  },
  /**
   * 在准备好时是否执行此后处理阶段。
   *
   * @memberof PostProcessStageComposite.prototype
   * @type {boolean}
   */
  enabled: {
    get: function () {
      return this._stages[0].enabled;
    },
    set: function (value) {
      const stages = this._stages;
      const length = stages.length;
      for (let i = 0; i < length; ++i) {
        stages[i].enabled = value;
      }
    },
  },
  /**
   * 后处理阶段的统一值的别名。可能为 <code>undefined</code>；在这种情况下，需分别调用每个阶段设置统一值。
   * @memberof PostProcessStageComposite.prototype
   * @type {object}
   */
  uniforms: {
    get: function () {
      return this._uniforms;
    },
  },
  /**
   * 所有后处理阶段按数组顺序执行。输入纹理根据 <code>inputPreviousStageTexture</code> 的值变化。
   * 如果 <code>inputPreviousStageTexture</code> 为 <code>true</code>，则每个阶段的输入为场景或之前执行阶段的输出纹理。
   * 如果 <code>inputPreviousStageTexture</code> 为 <code>false</code>，则每个阶段的输入纹理相同。输入纹理为场景渲染出的纹理或之前阶段的输出纹理。
   * 或前阶段的输出纹理。
   *
   * @memberof PostProcessStageComposite.prototype
   * @type {boolean}
   * @readonly
   */
  inputPreviousStageTexture: {
    get: function () {
      return this._inputPreviousStageTexture;
    },
  },
  /**
   * 此复合体中后处理阶段的数量。
   *
   * @memberof PostProcessStageComposite.prototype
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._stages.length;
    },
  },
  /**
   * 选择要应用后处理的特征。
   *
   * @memberof PostProcessStageComposite.prototype
   * @type {Array}
   */
  selected: {
    get: function () {
      return this._selected;
    },
    set: function (value) {
      this._selected = value;
    },
  },
  /**
   * @private
   */
  parentSelected: {
    get: function () {
      return this._parentSelected;
    },
    set: function (value) {
      this._parentSelected = value;
    },
  },
});

/**
 * @private
 */
PostProcessStageComposite.prototype._isSupported = function (context) {
  const stages = this._stages;
  const length = stages.length;
  for (let i = 0; i < length; ++i) {
    if (!stages[i]._isSupported(context)) {
      return false;
    }
  }
  return true;
};

/**
 * 获取 <code>index</code> 处的后处理阶段
 *
 * @param {number} index 后处理阶段或复合体的索引。
 * @return {PostProcessStage|PostProcessStageComposite} The 索引为 <code>index</code> 的后处理阶段或复合体。
 *
 * @exception {DeveloperError} index 必须大于等于 0。
 * @exception {DeveloperError} index 必须小于 {@link PostProcessStageComposite#length}。
 */
PostProcessStageComposite.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThanOrEquals("index", index, 0);
  Check.typeOf.number.lessThan("index", index, this.length);
  //>>includeEnd('debug');
  return this._stages[index];
};

function isSelectedTextureDirty(stage) {
  let length = defined(stage._selected) ? stage._selected.length : 0;
  const parentLength = defined(stage._parentSelected)
    ? stage._parentSelected
    : 0;
  let dirty =
    stage._selected !== stage._selectedShadow ||
    length !== stage._selectedLength;
  dirty =
    dirty ||
    stage._parentSelected !== stage._parentSelectedShadow ||
    parentLength !== stage._parentSelectedLength;

  if (defined(stage._selected) && defined(stage._parentSelected)) {
    stage._combinedSelected = stage._selected.concat(stage._parentSelected);
  } else if (defined(stage._parentSelected)) {
    stage._combinedSelected = stage._parentSelected;
  } else {
    stage._combinedSelected = stage._selected;
  }

  if (!dirty && defined(stage._combinedSelected)) {
    if (!defined(stage._combinedSelectedShadow)) {
      return true;
    }

    length = stage._combinedSelected.length;
    for (let i = 0; i < length; ++i) {
      if (stage._combinedSelected[i] !== stage._combinedSelectedShadow[i]) {
        return true;
      }
    }
  }
  return dirty;
}

/**
 * 在执行前被调用的函数。更新复合体中的每个后处理阶段。
 * @param {Context} context 上下文。
 * @param {boolean} useLogDepth 场景是否使用对数深度缓冲区。
 * @private
 */
PostProcessStageComposite.prototype.update = function (context, useLogDepth) {
  this._selectedDirty = isSelectedTextureDirty(this);

  this._selectedShadow = this._selected;
  this._parentSelectedShadow = this._parentSelected;
  this._combinedSelectedShadow = this._combinedSelected;
  this._selectedLength = defined(this._selected) ? this._selected.length : 0;
  this._parentSelectedLength = defined(this._parentSelected)
    ? this._parentSelected.length
    : 0;

  const stages = this._stages;
  const length = stages.length;
  for (let i = 0; i < length; ++i) {
    const stage = stages[i];
    if (this._selectedDirty) {
      stage.parentSelected = this._combinedSelected;
    }
    stage.update(context, useLogDepth);
  }
};

/**
 * 如果此对象被销毁，返回 true；否则返回 false。
 * <p>
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 之外的任何函数都将导致 <code>false</code>。
 *
 * @see PostProcessStageComposite#destroy
 */
PostProcessStageComposite.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性的
 * WebGL 资源释放，而不是依赖垃圾收集器来销毁此对象。
 * <p>
 * 一旦对象被销毁，不应使用它；调用除
 * 若设置 <code>isDestroyed</code>，将引发 {@link DeveloperError} 异常。因此，
 * 应像示例中那样将返回值 (<code>undefined</code>) 赋给该对象。
 * </p>
 *
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 *
 * @see PostProcessStageComposite#isDestroyed
 */
PostProcessStageComposite.prototype.destroy = function () {
  const stages = this._stages;
  const length = stages.length;
  for (let i = 0; i < length; ++i) {
    stages[i].destroy();
  }
  return destroyObject(this);
};
export default PostProcessStageComposite;
