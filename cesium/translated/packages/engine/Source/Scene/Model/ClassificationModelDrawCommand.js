import {
  BoundingSphere,
  Check,
  Frozen,
  Matrix4,
  addAllToArray,
} from "@cesium/core";
import DrawCommand from "../../Renderer/DrawCommand.js";
import Pass from "../../Renderer/Pass.js";
import RenderState from "../../Renderer/RenderState.js";
import BlendingState from "../BlendingState.js";
import ClassificationType from "../ClassificationType.js";
import DepthFunction from "../DepthFunction.js";
import StencilConstants from "../StencilConstants.js";
import StencilFunction from "../StencilFunction.js";
import StencilOperation from "../StencilOperation.js";

/**
 * 用于渲染分类模型的绘制命令包装器。
 * 即一个对另一资产进行分类的 {@link Model}。它管理
 * 派生命令，并根据给定的帧状态仅返回必要的命令。
 * 派生命令。
 *
 * @param {object} options 包含以下选项的对象：
 * @param {DrawCommand} options.command 用于派生其他命令的绘制命令。
 * @param {PrimitiveRenderResources} options.primitiveRenderResources 与该命令相关的渲染资源。
 *
 * @alias ClassificationModelDrawCommand
 * @constructor
 *
 * @private
 */
function ClassificationModelDrawCommand(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const command = options.command;
  const renderResources = options.primitiveRenderResources;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.command", command);
  Check.typeOf.object("options.primitiveRenderResources", renderResources);
  //>>includeEnd('debug');

  const model = renderResources.model;

  this._command = command;
  this._model = model;
  this._runtimePrimitive = renderResources.runtimePrimitive;

  // Classification models aren't supported in 2D mode, so there's no need to
  // duplicate the model matrix for each derived command.
  this._modelMatrix = command.modelMatrix;
  this._boundingVolume = command.boundingVolume;
  this._cullFace = command.renderState.cull.face;

  const type = model.classificationType;
  this._classificationType = type;

  // ClassificationType has three values: terrain only, 3D Tiles only, or both.
  this._classifiesTerrain = type !== ClassificationType.CESIUM_3D_TILE;
  this._classifies3DTiles = type !== ClassificationType.TERRAIN;

  this._useDebugWireframe = model._enableDebugWireframe && model.debugWireframe;
  this._pickId = renderResources.pickId;

  this._commandListTerrain = [];
  this._commandList3DTiles = [];
  this._commandListIgnoreShow = []; // Used for inverted classification.
  this._commandListDebugWireframe = [];

  this._commandListTerrainPicking = [];
  this._commandList3DTilesPicking = [];

  initialize(this);
}

function getStencilDepthRenderState(stencilFunction) {
  return {
    colorMask: {
      red: false,
      green: false,
      blue: false,
      alpha: false,
    },
    stencilTest: {
      enabled: true,
      frontFunction: stencilFunction,
      frontOperation: {
        fail: StencilOperation.KEEP,
        zFail: StencilOperation.DECREMENT_WRAP,
        zPass: StencilOperation.KEEP,
      },
      backFunction: stencilFunction,
      backOperation: {
        fail: StencilOperation.KEEP,
        zFail: StencilOperation.INCREMENT_WRAP,
        zPass: StencilOperation.KEEP,
      },
      reference: StencilConstants.CESIUM_3D_TILE_MASK,
      mask: StencilConstants.CESIUM_3D_TILE_MASK,
    },
    stencilMask: StencilConstants.CLASSIFICATION_MASK,
    depthTest: {
      enabled: true,
      func: DepthFunction.LESS_OR_EQUAL,
    },
    depthMask: false,
  };
}

const colorRenderState = {
  stencilTest: {
    enabled: true,
    frontFunction: StencilFunction.NOT_EQUAL,
    frontOperation: {
      fail: StencilOperation.ZERO,
      zFail: StencilOperation.ZERO,
      zPass: StencilOperation.ZERO,
    },
    backFunction: StencilFunction.NOT_EQUAL,
    backOperation: {
      fail: StencilOperation.ZERO,
      zFail: StencilOperation.ZERO,
      zPass: StencilOperation.ZERO,
    },
    reference: 0,
    mask: StencilConstants.CLASSIFICATION_MASK,
  },
  stencilMask: StencilConstants.CLASSIFICATION_MASK,
  depthTest: {
    enabled: false,
  },
  depthMask: false,
  blending: BlendingState.PRE_MULTIPLIED_ALPHA_BLEND,
};

const pickRenderState = {
  stencilTest: {
    enabled: true,
    frontFunction: StencilFunction.NOT_EQUAL,
    frontOperation: {
      fail: StencilOperation.ZERO,
      zFail: StencilOperation.ZERO,
      zPass: StencilOperation.ZERO,
    },
    backFunction: StencilFunction.NOT_EQUAL,
    backOperation: {
      fail: StencilOperation.ZERO,
      zFail: StencilOperation.ZERO,
      zPass: StencilOperation.ZERO,
    },
    reference: 0,
    mask: StencilConstants.CLASSIFICATION_MASK,
  },
  stencilMask: StencilConstants.CLASSIFICATION_MASK,
  depthTest: {
    enabled: false,
  },
  depthMask: false,
};

const scratchDerivedCommands = [];

function initialize(drawCommand) {
  const command = drawCommand._command;
  const derivedCommands = scratchDerivedCommands;

  // If debug wireframe is enabled, don't derive any new commands.
  // Render normally in the opaque pass.
  if (drawCommand._useDebugWireframe) {
    command.pass = Pass.OPAQUE;

    derivedCommands.length = 0;
    derivedCommands.push(command);

    drawCommand._commandListDebugWireframe = createBatchCommands(
      drawCommand,
      derivedCommands,
      drawCommand._commandListDebugWireframe,
    );

    const commandList = drawCommand._commandListDebugWireframe;
    const length = commandList.length;
    for (let i = 0; i < length; i++) {
      // The lengths / offsets of the batches have to be adjusted for wireframe.
      // Only PrimitiveType.TRIANGLES is allowed for classification, so this
      // just requires doubling the values for the batches.
      const command = commandList[i];
      command.count *= 2;
      command.offset *= 2;
    }

    return;
  }

  const model = drawCommand.model;
  const allowPicking = model.allowPicking;

  if (drawCommand._classifiesTerrain) {
    const pass = Pass.TERRAIN_CLASSIFICATION;
    const stencilDepthCommand = deriveStencilDepthCommand(command, pass);
    const colorCommand = deriveColorCommand(command, pass);

    derivedCommands.length = 0;
    derivedCommands.push(stencilDepthCommand, colorCommand);

    drawCommand._commandListTerrain = createBatchCommands(
      drawCommand,
      derivedCommands,
      drawCommand._commandListTerrain,
    );

    if (allowPicking) {
      drawCommand._commandListTerrainPicking = createPickCommands(
        drawCommand,
        derivedCommands,
        drawCommand._commandListTerrainPicking,
      );
    }
  }

  if (drawCommand._classifies3DTiles) {
    const pass = Pass.CESIUM_3D_TILE_CLASSIFICATION;
    const stencilDepthCommand = deriveStencilDepthCommand(command, pass);
    const colorCommand = deriveColorCommand(command, pass);

    derivedCommands.length = 0;
    derivedCommands.push(stencilDepthCommand, colorCommand);

    drawCommand._commandList3DTiles = createBatchCommands(
      drawCommand,
      derivedCommands,
      drawCommand._commandList3DTiles,
    );

    if (allowPicking) {
      drawCommand._commandList3DTilesPicking = createPickCommands(
        drawCommand,
        derivedCommands,
        drawCommand._commandList3DTilesPicking,
      );
    }
  }
}

function createBatchCommands(drawCommand, derivedCommands, result) {
  const runtimePrimitive = drawCommand._runtimePrimitive;
  const batchLengths = runtimePrimitive.batchLengths;
  const batchOffsets = runtimePrimitive.batchOffsets;

  const numBatches = batchLengths.length;
  const numDerivedCommands = derivedCommands.length;
  for (let i = 0; i < numBatches; i++) {
    const batchLength = batchLengths[i];
    const batchOffset = batchOffsets[i];
    // For multiple derived commands (e.g. stencil and color commands),
    // they must be added in a certain order even within the batches.
    for (let j = 0; j < numDerivedCommands; j++) {
      const derivedCommand = derivedCommands[j];
      const batchCommand = DrawCommand.shallowClone(derivedCommand);
      batchCommand.count = batchLength;
      batchCommand.offset = batchOffset;
      result.push(batchCommand);
    }
  }

  return result;
}

function deriveStencilDepthCommand(command, pass) {
  const stencilDepthCommand = DrawCommand.shallowClone(command);
  stencilDepthCommand.cull = false;
  stencilDepthCommand.pass = pass;

  const stencilFunction =
    pass === Pass.TERRAIN_CLASSIFICATION
      ? StencilFunction.ALWAYS
      : StencilFunction.EQUAL;
  const renderState = getStencilDepthRenderState(stencilFunction);
  stencilDepthCommand.renderState = RenderState.fromCache(renderState);

  return stencilDepthCommand;
}

function deriveColorCommand(command, pass) {
  const colorCommand = DrawCommand.shallowClone(command);
  colorCommand.cull = false;
  colorCommand.pass = pass;

  colorCommand.renderState = RenderState.fromCache(colorRenderState);

  return colorCommand;
}

const scratchPickCommands = [];

function createPickCommands(drawCommand, derivedCommands, commandList) {
  const renderState = RenderState.fromCache(pickRenderState);
  const stencilDepthCommand = derivedCommands[0];
  const colorCommand = derivedCommands[1];

  const pickStencilDepthCommand = DrawCommand.shallowClone(stencilDepthCommand);
  pickStencilDepthCommand.cull = true;
  pickStencilDepthCommand.pickOnly = true;

  const pickColorCommand = DrawCommand.shallowClone(colorCommand);
  pickColorCommand.cull = true;
  pickColorCommand.pickOnly = true;
  pickColorCommand.renderState = renderState;
  pickColorCommand.pickId = drawCommand._pickId;

  const pickCommands = scratchPickCommands;
  pickCommands.length = 0;
  pickCommands.push(pickStencilDepthCommand, pickColorCommand);

  return createBatchCommands(drawCommand, pickCommands, commandList);
}

Object.defineProperties(ClassificationModelDrawCommand.prototype, {
  /**
   * 其他命令所依赖的主要绘制命令。
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {DrawCommand}
   *
   * @readonly
   * @private
   */
  command: {
    get: function () {
      return this._command;
    },
  },

  /**
   * 绘制命令所属的运行时原语。
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {ModelRuntimePrimitive}
   *
   * @readonly
   * @private
   */
  runtimePrimitive: {
    get: function () {
      return this._runtimePrimitive;
    },
  },

  /**
   * 生成多个绘制命令所使用的批次长度。
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {number[]}
   *
   * @readonly
   * @private
   */
  batchLengths: {
    get: function () {
      return this._runtimePrimitive.batchLengths;
    },
  },

  /**
   * 生成多个绘制命令所使用的批次偏移量。
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {number[]}
   *
   * @readonly
   * @private
   */
  batchOffsets: {
    get: function () {
      return this._runtimePrimitive.batchOffsets;
    },
  },

  /**
   * 绘制命令所属的模型。
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {Model}
   *
   * @readonly
   * @private
   */
  model: {
    get: function () {
      return this._model;
    },
  },

  /**
   * 该绘制命令所属的模型的分类类型。
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {ClassificationType}
   *
   * @readonly
   * @private
   */
  classificationType: {
    get: function () {
      return this._classificationType;
    },
  },

  /**
   * 应用于绘制命令的当前模型矩阵。
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {Matrix4}
   *
   * @readonly
   * @private
   */
  modelMatrix: {
    get: function () {
      return this._modelMatrix;
    },
    set: function (value) {
      this._modelMatrix = Matrix4.clone(value, this._modelMatrix);
      const boundingSphere = this._runtimePrimitive.boundingSphere;
      this._boundingVolume = BoundingSphere.transform(
        boundingSphere,
        this._modelMatrix,
        this._boundingVolume,
      );
    },
  },

  /**
   * 主要绘制命令的边界体积。这相当于
   * 经过绘制命令的模型矩阵变换后的原语边界球体。
   * 边界球体。
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {BoundingSphere}
   *
   * @readonly
   * @private
   */
  boundingVolume: {
    get: function () {
      return this._boundingVolume;
    },
  },

  /**
   * 分类模型的剔除功能被禁用，因此这对模型的渲染效果没有影响。此选项仅用于匹配
   * {@link ModelDrawCommand} 的接口。
   * {@link ModelDrawCommand}.
   *
   * @memberof ClassificationModelDrawCommand.prototype
   * @type {CullFace}
   *
   * @private
   */
  cullFace: {
    get: function () {
      return this._cullFace;
    },
    set: function (value) {
      this._cullFace = value;
    },
  },
});

/**
 * 推送渲染原语所需的绘制命令。
 *
 * @param {FrameState} frameState 帧状态。
 * @param {DrawCommand[]} result 推送绘制命令的数组。
 *
 * @returns {DrawCommand[]} The 修改后的结果参数。
 *
 * @private
 */
ClassificationModelDrawCommand.prototype.pushCommands = function (
  frameState,
  result,
) {
  const passes = frameState.passes;
  if (passes.render) {
    if (this._useDebugWireframe) {
      addAllToArray(result, this._commandListDebugWireframe);
      return;
    }

    if (this._classifiesTerrain) {
      addAllToArray(result, this._commandListTerrain);
    }

    if (this._classifies3DTiles) {
      addAllToArray(result, this._commandList3DTiles);
    }

    const useIgnoreShowCommands =
      frameState.invertClassification && this._classifies3DTiles;

    if (useIgnoreShowCommands) {
      if (this._commandListIgnoreShow.length === 0) {
        const pass = Pass.CESIUM_3D_TILE_CLASSIFICATION_IGNORE_SHOW;
        const command = deriveStencilDepthCommand(this._command, pass);

        const derivedCommands = scratchDerivedCommands;
        derivedCommands.length = 0;
        derivedCommands.push(command);

        this._commandListIgnoreShow = createBatchCommands(
          this,
          derivedCommands,
          this._commandListIgnoreShow,
        );
      }

      addAllToArray(result, this._commandListIgnoreShow);
    }
  }

  if (passes.pick) {
    if (this._classifiesTerrain) {
      addAllToArray(result, this._commandListTerrainPicking);
    }

    if (this._classifies3DTiles) {
      addAllToArray(result, this._commandList3DTilesPicking);
    }
  }

  return result;
};

export default ClassificationModelDrawCommand;