// @ts-check

import { Frozen, PrimitiveType, defined } from "@cesium/core";
/** @import Context from "./Context.js"; */
/** @import Framebuffer from "./Framebuffer.js"; */
/** @import { Matrix4 } from "@cesium/core"; */
/** @import { OrientedBoundingBox } from "@cesium/core"; */
/** @import Pass from "./Pass.js"; */
/** @import PassState from "./PassState.js"; */
/** @import PickedMetadataInfo from "../Scene/PickedMetadataInfo.js"; */
/** @import RenderState from "./RenderState.js"; */
/** @import ShaderProgram from "./ShaderProgram.js"; */
/** @import VertexArray from "./VertexArray.js"; */

/**
 * @enum {number}
 * @ignore
 */
const Flags = {
  CULL: 1,
  OCCLUDE: 2,
  EXECUTE_IN_CLOSEST_FRUSTUM: 4,
  DEBUG_SHOW_BOUNDING_VOLUME: 8,
  CAST_SHADOWS: 16,
  RECEIVE_SHADOWS: 32,
  PICK_ONLY: 64,
  DEPTH_FOR_TRANSLUCENT_CLASSIFICATION: 128,
};

/**
 * @typedef {object} DrawCommandOptions
 * @property {object} [boundingVolume]
 * @property {OrientedBoundingBox} [orientedBoundingBox]
 * @property {Matrix4} [modelMatrix]
 * @property {PrimitiveType} [primitiveType=PrimitiveType.TRIANGLES]
 * @property {VertexArray} [vertexArray]
 * @property {number} [count]
 * @property {number} [offset]
 * @property {number} [instanceCount]
 * @property {ShaderProgram} [shaderProgram]
 * @property {object} [uniformMap]
 * @property {RenderState} [renderState]
 * @property {Framebuffer} [framebuffer]
 * @property {Pass} [pass]
 * @property {object} [owner]
 * @property {string} [pickId]
 * @property {string} [snapId]
 * @property {boolean} [pickMetadataAllowed=false]
 * @property {boolean} [cull=true]
 * @property {boolean} [occlude=true]
 * @property {boolean} [executeInClosestFrustum=false]
 * @property {boolean} [debugShowBoundingVolume=false]
 * @property {boolean} [castShadows=false]
 * @property {boolean} [receiveShadows=false]
 * @property {boolean} [pickOnly=false]
 * @property {boolean} [depthForTranslucentClassification=false]
 *
 * @ignore
 */

/**
 * 表示对渲染器绘制的指令。
 *
 * @private
 */
class DrawCommand {
  /**
   * @param {DrawCommandOptions} [options]
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    /** @private */
    this._boundingVolume = options.boundingVolume;
    /** @private */
    this._orientedBoundingBox = options.orientedBoundingBox;
    /** @private */
    this._modelMatrix = options.modelMatrix;
    /** @private */
    this._primitiveType = options.primitiveType ?? PrimitiveType.TRIANGLES;
    /** @private */
    this._vertexArray = options.vertexArray;
    /** @private */
    this._count = options.count;
    /** @private */
    this._offset = options.offset ?? 0;
    /** @private */
    this._instanceCount = options.instanceCount ?? 0;
    /** @private */
    this._shaderProgram = options.shaderProgram;
    /** @private */
    this._uniformMap = options.uniformMap;
    /** @private */
    this._renderState = options.renderState;
    /** @private */
    this._framebuffer = options.framebuffer;
    /** @private */
    this._pass = options.pass;
    /** @private */
    this._owner = options.owner;
    /** @private */
    this._debugOverlappingFrustums = 0;
    /** @private */
    this._pickId = options.pickId;
    this._snapId = options.snapId;
    /** @private */
    this._pickMetadataAllowed = options.pickMetadataAllowed === true;
    /**
     * @type {PickedMetadataInfo|undefined}
     * @private
     */
    this._pickedMetadataInfo = undefined;

    // Set initial flags.
    this._flags = 0;
    this.cull = options.cull ?? true;
    this.occlude = options.occlude ?? true;
    this.executeInClosestFrustum = options.executeInClosestFrustum ?? false;
    this.debugShowBoundingVolume = options.debugShowBoundingVolume ?? false;
    this.castShadows = options.castShadows ?? false;
    this.receiveShadows = options.receiveShadows ?? false;
    this.pickOnly = options.pickOnly ?? false;
    this.depthForTranslucentClassification =
      options.depthForTranslucentClassification ?? false;

    this.dirty = true;
    this.lastDirtyTime = 0;

    /**
     * @private
     */
    this.derivedCommands = {};
  }

  /**
   * 几何图形在世界空间中的边界框。用于剔除和视锥选择。
   * <p>
   * 为了获得最佳的渲染性能，应使用尽可能小的边界框。尽管
   * 允许使用 <code>undefined</code>，但始终应提供边界框以
   * 计算场景中最紧密的近平面和远平面，并
   * 减少所需的视锥数量。
   * </p>
   *
   * @type {object}
   * @default undefined
   *
   * @see DrawCommand#debugShowBoundingVolume
   */
  get boundingVolume() {
    return this._boundingVolume;
  }

  set boundingVolume(value) {
    if (this._boundingVolume !== value) {
      this._boundingVolume = value;
      this.dirty = true;
    }
  }

  /**
   * 几何图形在世界空间中的定向边界框。如果定义了此值，则用于替代
   * {@link DrawCommand#boundingVolume} 进行平面相交测试。
   *
   * @type {OrientedBoundingBox}
   * @default undefined
   *
   * @see DrawCommand#debugShowBoundingVolume
   */
  get orientedBoundingBox() {
    return this._orientedBoundingBox;
  }

  set orientedBoundingBox(value) {
    if (this._orientedBoundingBox !== value) {
      this._orientedBoundingBox = value;
      this.dirty = true;
    }
  }

  /**
   * 当 <code>true</code> 时，渲染器的视锥和地平线剔除会根据其 {@link DrawCommand#boundingVolume} 执行指令。
   * 如果指令已被剔除，将此值设为 <code>false</code> 可提升性能。
   *
   * @type {boolean}
   * @default true
   */
  get cull() {
    return hasFlag(this, Flags.CULL);
  }

  set cull(value) {
    if (hasFlag(this, Flags.CULL) !== value) {
      setFlag(this, Flags.CULL, value);
      this.dirty = true;
    }
  }

  /**
   * 当 <code>true</code> 时，地平线剔除会根据其 {@link DrawCommand#boundingVolume} 执行指令。
   * {@link DrawCommand#cull} 也必须是 <code>true</code>，以便指令被剔除。
   *
   * @type {boolean}
   * @default true
   */
  get occlude() {
    return hasFlag(this, Flags.OCCLUDE);
  }

  set occlude(value) {
    if (hasFlag(this, Flags.OCCLUDE) !== value) {
      setFlag(this, Flags.OCCLUDE, value);
      this.dirty = true;
    }
  }

  /**
   * 几何图形从模型空间到世界空间的变换。
   * <p>
   * 当 <code>undefined</code> 时，假设几何图形定义在世界空间中。
   * </p>
   *
   * @type {Matrix4}
   * @default undefined
   */
  get modelMatrix() {
    return this._modelMatrix;
  }

  set modelMatrix(value) {
    if (this._modelMatrix !== value) {
      this._modelMatrix = value;
      this.dirty = true;
    }
  }

  /**
   * 顶点数组中几何图形的类型。
   *
   * @type {PrimitiveType}
   * @default PrimitiveType.TRIANGLES
   */
  get primitiveType() {
    return this._primitiveType;
  }

  set primitiveType(value) {
    if (this._primitiveType !== value) {
      this._primitiveType = value;
      this.dirty = true;
    }
  }

  /**
   * 顶点数组。
   *
   * @type {VertexArray}
   * @default undefined
   */
  get vertexArray() {
    return this._vertexArray;
  }

  set vertexArray(value) {
    if (this._vertexArray !== value) {
      this._vertexArray = value;
      this.dirty = true;
    }
  }

  /**
   * 顶点数组中要绘制的顶点数量。
   *
   * @type {number}
   * @default undefined
   */
  get count() {
    return this._count;
  }

  set count(value) {
    if (this._count !== value) {
      this._count = value;
      this.dirty = true;
    }
  }

  /**
   * 顶点数组中开始绘制的偏移量。
   *
   * @type {number}
   * @default 0
   */
  get offset() {
    return this._offset;
  }

  set offset(value) {
    if (this._offset !== value) {
      this._offset = value;
      this.dirty = true;
    }
  }

  /**
   * 要绘制的实例数量。
   *
   * @type {number}
   * @default 0
   */
  get instanceCount() {
    return this._instanceCount;
  }

  set instanceCount(value) {
    if (this._instanceCount !== value) {
      this._instanceCount = value;
      this.dirty = true;
    }
  }

  /**
   * 要应用的着色器程序。
   *
   * @type {ShaderProgram}
   * @default undefined
   */
  get shaderProgram() {
    return this._shaderProgram;
  }

  set shaderProgram(value) {
    if (this._shaderProgram !== value) {
      this._shaderProgram = value;
      this.dirty = true;
    }
  }

  /**
   * 当启用阴影时，此指令是否应投射阴影。
   *
   * @type {boolean}
   * @default false
   */
  get castShadows() {
    return hasFlag(this, Flags.CAST_SHADOWS);
  }

  set castShadows(value) {
    if (hasFlag(this, Flags.CAST_SHADOWS) !== value) {
      setFlag(this, Flags.CAST_SHADOWS, value);
      this.dirty = true;
    }
  }

  /**
   * 当启用阴影时，此指令是否应接收阴影。
   *
   * @type {boolean}
   * @default false
   */
  get receiveShadows() {
    return hasFlag(this, Flags.RECEIVE_SHADOWS);
  }

  set receiveShadows(value) {
    if (hasFlag(this, Flags.RECEIVE_SHADOWS) !== value) {
      setFlag(this, Flags.RECEIVE_SHADOWS, value);
      this.dirty = true;
    }
  }

  /**
   * 具有与着色器程序中的统一变量名称匹配的函数及其返回值来设置这些统一变量。
   * 渲染状态。
   *
   * @type {object}
   * @default undefined
   */
  get uniformMap() {
    return this._uniformMap;
  }

  set uniformMap(value) {
    if (this._uniformMap !== value) {
      this._uniformMap = value;
      this.dirty = true;
    }
  }

  /**
   * 要绘制的帧缓冲区。
   *
   * @type {RenderState}
   * @default undefined
   */
  get renderState() {
    return this._renderState;
  }

  set renderState(value) {
    if (this._renderState !== value) {
      this._renderState = value;
      this.dirty = true;
    }
  }

  /**
   * 渲染的通道。
   *
   * @type {Framebuffer}
   * @default undefined
   */
  get framebuffer() {
    return this._framebuffer;
  }

  set framebuffer(value) {
    if (this._framebuffer !== value) {
      this._framebuffer = value;
      this.dirty = true;
    }
  }

  /**
   * 指定此指令仅在最靠近包含边界框的视锥中执行。默认值为 <code>false</code>。
   *
   * @type {Pass}
   * @default undefined
   */
  get pass() {
    return this._pass;
  }

  set pass(value) {
    if (this._pass !== value) {
      this._pass = value;
      this.dirty = true;
    }
  }

  /**
   * 仅当此指令在最接近眼睛的视锥中执行时适用。默认值为 <code>false</code>。
   * 创建此指令的对象。这对于调试指令执行很有用；它允许我们查看是谁创建了指令，即使只有对指令的引用，并且可用于选择性地通过 {@link Scene#debugCommandFilter} 执行指令。
   *
   * @type {boolean}
   * @default false
   */
  get executeInClosestFrustum() {
    return hasFlag(this, Flags.EXECUTE_IN_CLOSEST_FRUSTUM);
  }

  set executeInClosestFrustum(value) {
    if (hasFlag(this, Flags.EXECUTE_IN_CLOSEST_FRUSTUM) !== value) {
      setFlag(this, Flags.EXECUTE_IN_CLOSEST_FRUSTUM, value);
      this.dirty = true;
    }
  }

  /**
   * 创建此指令的对象。对于调试命令执行非常有用；它允许我们查看是谁创建了指令，即使只有对指令的引用，并且可用于通过 {@link Scene#debugCommandFilter} 选择性地执行指令。
   * 此属性仅用于调试；不用于生产环境，也没有经过优化。
   * 在指令执行时，假设为球体，则绘制此指令的 {@link DrawCommand#boundingVolume}。
   * with {@link Scene#debugCommandFilter}.
   *
   * @type {object}
   * @default undefined
   *
   * @see Scene#debugCommandFilter
   */
  get owner() {
    return this._owner;
  }

  set owner(value) {
    if (this._owner !== value) {
      this._owner = value;
      this.dirty = true;
    }
  }

  /**
   * This property is for debugging only; it is not for production use nor is it optimized.
   * <p>
   * Draws the {@link DrawCommand#boundingVolume} for this command, assuming it is a sphere, when the command executes.
   * </p>
   *
   * @type {boolean}
   * @default false
   *
   * @see DrawCommand#boundingVolume
   */
  get debugShowBoundingVolume() {
    return hasFlag(this, Flags.DEBUG_SHOW_BOUNDING_VOLUME);
  }

  set debugShowBoundingVolume(value) {
    if (hasFlag(this, Flags.DEBUG_SHOW_BOUNDING_VOLUME) !== value) {
      setFlag(this, Flags.DEBUG_SHOW_BOUNDING_VOLUME, value);
      this.dirty = true;
    }
  }

  /**
   * 用于实现 Scene.debugShowFrustums。
   * @ignore
   */
  get debugOverlappingFrustums() {
    return this._debugOverlappingFrustums;
  }

  set debugOverlappingFrustums(value) {
    if (this._debugOverlappingFrustums !== value) {
      this._debugOverlappingFrustums = value;
      this.dirty = true;
    }
  }

  /**
   * 一个会评估为 pick id 的 GLSL 字符串。当 <code>undefined</code> 时，该命令仅绘制深度信息。
   * 在 pick 过程中。
   *
   * @type {string|undefined}
   * @default undefined
   */
  get pickId() {
    return this._pickId;
  }

  set pickId(value) {
    if (this._pickId !== value) {
      this._pickId = value;
      this.dirty = true;
    }
  }

  /**
   * 一个会评估为在 snapping 过程中写入的 float snap payload 的 GLSL 字符串。
   * 在 snapping 过程中（参见 {@link Scene#snap}）。当 <code>undefined</code> 时，
   * 该命令在 snapping 过程中不会被渲染。
   *
   * @type {string|undefined}
   * @default undefined
   */
  get snapId() {
    return this._snapId;
  }

  set snapId(value) {
    if (this._snapId !== value) {
      this._snapId = value;
      this.dirty = true;
    }
  }

  /**
   * 是否允许使用元数据 picking。
   *
   * 实际上，仅对于属于 `ModelDrawCommand` 的绘制命令设置为 `true`，以检查是否需要创建用于元数据 picking 的派生命令。
   * 关于被选取的元数据的信息。
   * 该命令是否应仅在 pick 过程中执行。
   *
   * @type {boolean}
   * @default undefined
   * @private
   */
  get pickMetadataAllowed() {
    return this._pickMetadataAllowed;
  }

  /**
   * 该命令是否应派生为用于分类半透明图元的深度绘制命令。
   *
   * @type {PickedMetadataInfo|undefined}
   * @default undefined
   */
  get pickedMetadataInfo() {
    return this._pickedMetadataInfo;
  }

  set pickedMetadataInfo(value) {
    if (this._pickedMetadataInfo !== value) {
      this._pickedMetadataInfo = value;
      this.dirty = true;
    }
  }

  /**
   * 执行绘制命令。
   *
   * @type {boolean}
   * @default false
   */
  get pickOnly() {
    return hasFlag(this, Flags.PICK_ONLY);
  }

  set pickOnly(value) {
    if (hasFlag(this, Flags.PICK_ONLY) !== value) {
      setFlag(this, Flags.PICK_ONLY, value);
      this.dirty = true;
    }
  }

  /**
   * 进行绘制的渲染器上下文。
   *
   * @type {boolean}
   * @default false
   */
  get depthForTranslucentClassification() {
    return hasFlag(this, Flags.DEPTH_FOR_TRANSLUCENT_CLASSIFICATION);
  }

  set depthForTranslucentClassification(value) {
    if (hasFlag(this, Flags.DEPTH_FOR_TRANSLUCENT_CLASSIFICATION) !== value) {
      setFlag(this, Flags.DEPTH_FOR_TRANSLUCENT_CLASSIFICATION, value);
      this.dirty = true;
    }
  }

  /**
   * @param {DrawCommand} command
   * @param {DrawCommand} result
   * @returns {DrawCommand}
   * @private
   */
  static shallowClone(command, result) {
    if (!defined(command)) {
      return undefined;
    }
    if (!defined(result)) {
      result = new DrawCommand();
    }

    result._boundingVolume = command._boundingVolume;
    result._orientedBoundingBox = command._orientedBoundingBox;
    result._modelMatrix = command._modelMatrix;
    result._primitiveType = command._primitiveType;
    result._vertexArray = command._vertexArray;
    result._count = command._count;
    result._offset = command._offset;
    result._instanceCount = command._instanceCount;
    result._shaderProgram = command._shaderProgram;
    result._uniformMap = command._uniformMap;
    result._renderState = command._renderState;
    result._framebuffer = command._framebuffer;
    result._pass = command._pass;
    result._owner = command._owner;
    result._debugOverlappingFrustums = command._debugOverlappingFrustums;
    result._pickId = command._pickId;
    result._snapId = command._snapId;
    result._pickMetadataAllowed = command._pickMetadataAllowed;
    result._pickedMetadataInfo = command._pickedMetadataInfo;
    result._flags = command._flags;

    result.dirty = true;
    result.lastDirtyTime = 0;

    return result;
  }

  /**
   * 当前渲染过程的状态。
   *
   * @param {Context} context The renderer context in which to draw.
   * @param {PassState} [passState] The state for the current render pass.
   */
  execute(context, passState) {
    context.draw(this, passState);
  }
}

/**
 * @param {DrawCommand} command
 * @param {Flags} flag
 * @returns {boolean}
 * @ignore
 */
function hasFlag(command, flag) {
  return (command._flags & flag) === flag;
}

/**
 * @param {DrawCommand} command
 * @param {Flags} flag
 * @param {boolean} value
 * @ignore
 */
function setFlag(command, flag, value) {
  if (value) {
    command._flags |= flag;
  } else {
    command._flags &= ~flag;
  }
}

export default DrawCommand;
