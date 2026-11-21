import { combine, defined } from "@cesium/core";
import ShaderBuilder from "../Renderer/ShaderBuilder.js";
import RenderState from "../Renderer/RenderState.js";
import DepthFunction from "../Scene/DepthFunction.js";
import ModelAlphaOptions from "./Model/ModelAlphaOptions.js";
import ShaderDestination from "../Renderer/ShaderDestination.js";
import Pass from "../Renderer/Pass.js";
import BlendingState from "./BlendingState.js";

const customFragmentShaderStructs = `
struct Attributes {
  vec3 positionWC;
  vec3 positionEC;
  vec3 normalEC;
  vec4 color_0;
  int featureId_0;
};

struct FragmentInput {
  Attributes attributes;
};`;

/**
 * 动态构建 `FragmentInput / Attributes` 结构体字符串，使其
 * 包含每个特征 ID 集中的一个 `int featureId_N` 字段。
 *
 * @param {number} featureIdCount 特征 ID 集的数量（0 表示使用静态默认值）。
 * @returns {string} GLSL 结构体定义。
 * @private
 */
function buildCustomFragmentShaderStructs(featureIdCount) {
  if (featureIdCount <= 1) {
    return customFragmentShaderStructs;
  }

  let featureIdFields = "";
  for (let i = 0; i < featureIdCount; i++) {
    featureIdFields += `  int featureId_${i};\n`;
  }

  return `
struct Attributes {
  vec3 positionWC;
  vec3 positionEC;
  vec3 normalEC;
  vec4 color_0;
${featureIdFields}};

struct FragmentInput {
  Attributes attributes;
};`;
}

function GaussianSplatRenderResources(primitive) {
  const shaderBuilder = new ShaderBuilder();
  /**
   * 用于逐步构建着色器的对象。每个管线阶段
   * 都可能向该对象添加着色器代码行。
   *
   * @type {ShaderBuilder}
   * @readonly
   *
   * @private
   */
  this.shaderBuilder = shaderBuilder;

  // Custom shader uniforms
  const customShader = primitive._customShader;
  /**
   * 将统一变量名映射到返回该变量值的函数的字典。
   * 存储创建 {@link RenderState} 选项的对象。
   *
   * @type {Object<string, Function>}
   * @readonly
   *
   * @private
   */
  this.uniformMap = defined(customShader)
    ? combine(primitive._uniformMap, customShader.uniformMap)
    : Object.assign({}, primitive._uniformMap);

  const customShaderUniforms = defined(customShader)
    ? customShader.uniforms
    : {};
  for (const uniformName in customShaderUniforms) {
    if (customShaderUniforms.hasOwnProperty(uniformName)) {
      const uniform = customShaderUniforms[uniformName];
      shaderBuilder.addUniform(
        uniform.type,
        uniformName,
        ShaderDestination.BOTH,
      );
    }
  }

  if (defined(customShader) && defined(customShader.fragmentShaderText)) {
    shaderBuilder.addDefine(
      "HAS_CUSTOM_FRAGMENT_SHADER",
      undefined,
      ShaderDestination.FRAGMENT,
    );

    const featureIdCount = primitive._featureIdCount ?? 0;
    const structs = buildCustomFragmentShaderStructs(featureIdCount);

    shaderBuilder.addFragmentLines([
      structs,
      "#line 0",
      customShader.fragmentShaderText,
    ]);
  }

  /**
   * 设置 {@link DrawCommand} 时创建渲染状态的选项。
   * 管线阶段仅设置选项，而渲染状态在
   * 构建 {@link DrawCommand} 时创建。
   *
   * @type {object}
   * @readonly
   *
   * @private
   */
  this.renderStateOptions = RenderState.getState(
    RenderState.fromCache({
      depthTest: {
        enabled: true,
        func: DepthFunction.LESS_OR_EQUAL,
      },
      cull: {
        enabled: false,
      },
      depthMask: false,
      blending: BlendingState.PRE_MULTIPLIED_ALPHA_BLEND,
    }),
  );

  /**
   * 配置 alpha 阶段的选项，如通道和 alpha 截断值。
   *
   * @type {ModelAlphaOptions}
   * @readonly
   *
   * @private
   */
  this.alphaOptions = new ModelAlphaOptions();
  this.alphaOptions.pass = Pass.GAUSSIAN_SPLATS;

  /**
   * 模型是否属于使用 `skipLevelOfDetail` 优化的 tileset。该值指示需要哪些绘制命令。
   * 并由 TilesetPipelineStage 设置。
   * is set by TilesetPipelineStage.
   *
   * @type {boolean}
   * @default false
   *
   * @private
   */
  this.hasSkipLevelOfDetail = false;

  if (primitive._useLogDepth) {
    shaderBuilder.addDefine(
      "LOG_DEPTH_READ_ONLY",
      undefined,
      ShaderDestination.FRAGMENT,
    );
  }
}

export default GaussianSplatRenderResources;
