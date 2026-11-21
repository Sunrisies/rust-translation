import {
  Check,
  DeveloperError,
  Frozen,
  defined,
  destroyObject,
} from "@cesium/core";
import CustomShaderMode from "./CustomShaderMode.js";
import UniformType from "./UniformType.js";
import TextureManager from "./TextureManager.js";
import CustomShaderTranslucencyMode from "./CustomShaderTranslucencyMode.js";

/**
 * 描述统一属性、其类型及初始值的对象
 *
 * @typedef {object} UniformSpecifier
 * @property {UniformType} type 统一属性的 Glsl 类型
 * @property {boolean|number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4|TextureUniform} value 统一属性的初始值
 *
 * @experimental This 该特性采用了 3D Tiles 规范中的部分内容，但此规范尚未最终定稿，且可能根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * 从用户定义着色器代码中解析出的变量集合。这些变量可用于在生成整体着色器时进行优化。虽然它们以 JS 对象形式呈现，但其用途类似于集合，因此只需关注键的存在性。如果定义明确，其值始终为 <code>true</code>。使用这种数据结构的原因如下：
 * used for optimizations when generating the overall shader. Though they are
 * represented as JS objects, the intended use is like a set, so only the
 * existence of keys matter. The values will always be <code>true</code> if
 * defined. This data structure is used because:
 * <ul>
 * <li>目前还无法使用 ES6 Set 对象</li>
 * <li>使用字典可以自动去重变量名</li>
 * <li>如 <code>variableSet.hasOwnProperty("position")</code> 这样的查询非常直接</li>
 * </ul>
 * @typedef {Object<string, boolean>} VariableSet
 * @private
 */

/**
 * 从用户定义的顶点着色器文本中解析出的变量集合。
 * @typedef {object} VertexVariableSets
 * @property {VariableSet} attributeSet 通过 <code>vsInput.attributes</code> 结构体在顶点着色器中使用的所有唯一属性的集合。
 * @property {VariableSet} featureIdSet 通过 <code>vsInput.featureIds</code> 结构体在顶点着色器中使用的所有唯一特征 ID 集合。
 * @property {VariableSet} metadataSet 通过 <code>vsInput.metadata</code>、<code>vsInput.metadataClass</code> 或 <code>vsInput.metadataStatistics</code> 结构体在顶点着色器中使用的所有唯一元数据属性集合。
 * @property {VariableSet} metadataClassSet 通过 <code>vsInput.metadataClass</code> 读取的 <code>metadataSet</code> 子集。
 * @property {VariableSet} metadataStatisticsSet 通过 <code>vsInput.metadataStatistics</code> 读取的 <code>metadataSet</code> 子集。
 * @private
 */

/**
 * 从用户定义的片段着色器文本中解析出的变量集合。
 * @typedef {object} FragmentVariableSets
 * @property {VariableSet} attributeSet 通过 <code>fsInput.attributes</code> 结构体在片段着色器中使用的所有唯一属性的集合。
 * @property {VariableSet} featureIdSet 通过 <code>fsInput.featureIds</code> 结构体在片段着色器中使用的所有唯一特征 ID 集合。
 * @property {VariableSet} metadataSet 通过 <code>fsInput.metadata</code>、<code>fsInput.metadataClass</code> 或 <code>fsInput.metadataStatistics</code> 结构体在片段着色器中使用的所有唯一元数据属性集合。
 * @property {VariableSet} metadataClassSet 通过 <code>fsInput.metadataClass</code> 读取的 <code>metadataSet</code> 子集。
 * @property {VariableSet} metadataStatisticsSet 通过 <code>fsInput.metadataStatistics</code> 读取的 <code>metadataSet</code> 子集。
 * @property {VariableSet} materialSet 通过 <code>material</code> 结构体在片段着色器中使用的所有材质变量（如漫反射、镜面反射或透明度）的集合。
 * @private
 */

/**
 * A user defined GLSL shader used with {@link Model} as well
 * as {@link Cesium3DTileset}.
 * <p>
 * 如果使用了纹理统一变量，则必须进行额外的资源管理：
 * </p>
 * <ul>
 *   <li>
 * 必须每帧调用 <code>update</code> 函数。当
 * 将自定义着色器传递给 {@link Model} 或
 * {@link Cesium3DTileset} 时，此步骤由系统自动处理。
 *   </li>
 *   <li>
 * 当自定义着色器不再需要时，必须调用 {@link CustomShader#destroy} 以正确清理 GPU 资源。应用程序
 * 负责调用此方法。
 * 请参阅 {@link https://github.com/CesiumGS/cesium/tree/main/Documentation/CustomShaderGuide|Custom Shader Guide} 以获取更详细的文档。
 *   </li>
 * </ul>
 * <p>
 * See the {@link https://github.com/CesiumGS/cesium/tree/main/Documentation/CustomShaderGuide|Custom Shader Guide} for more detailed documentation.
 * </p>
 *
 * @param {object} options 自定义着色器模式，用于确定自定义着色器代码如何插入到片段着色器中。
 * @param {CustomShaderMode} [options.mode=CustomShaderMode.MODIFY_MATERIAL] 照明模型（例如 PBR 或无照明）。如果存在，这将覆盖模型的默认照明设置。
 * @param {LightingModel} [options.lightingModel] 半透明模式，用于确定自定义着色器如何应用。如果值为 CustomShaderTransulcencyMode.OPAQUE 或 CustomShaderTransulcencyMode.TRANSLUCENT，则自定义着色器将覆盖模型材质中的设置。如果值为 CustomShaderTransulcencyMode.INHERIT，则自定义着色器将根据基元的材质设置渲染为不透明或半透明。
 * @param {CustomShaderTranslucencyMode} [options.translucencyMode=CustomShaderTranslucencyMode.INHERIT] 自定义统一变量字典。键是将在 GLSL 代码中出现的统一变量名。值是一个描述统一变量类型和初始值的对象。对于每个变量，声明会自动添加到着色器的顶部。调用者负责在顶点着色器中分配值并在片段着色器中使用该值。
 * @param {Object<string, UniformSpecifier>} [options.uniforms] 用于用户定义统一变量的字典。键是将在 GLSL 代码中出现的 varying 名称。值则是 varying 的数据类型。对于每个 varying，声明会自动添加到着色器的顶部。调用者负责在顶点着色器中分配值并在片段着色器中使用该值。
 * @param {Object<string, VaryingType>} [options.varyings] 用于声明着色器中使用的额外 GLSL varyings 的字典。键是将在 GLSL 代码中出现的 varying 名称。值则是 varying 的数据类型。对于每个 varying，声明会自动添加到着色器的顶部。调用者负责在顶点着色器中分配值并在片段着色器中使用该值。
 * @param {string} [options.vertexShaderText] 自定义顶点着色器作为 GLSL 代码字符串。必须包含名为 vertexMain 的 GLSL 函数。请参阅示例以了解预期签名。如果未指定，则计算顶点着色器中将跳过自定义顶点着色器步骤。
 * @param {string} [options.fragmentShaderText] 自定义片段着色器作为 GLSL 代码字符串。必须包含名为 fragmentMain 的 GLSL 函数。请参阅示例以了解预期签名。如果未指定，则计算片段着色器中将跳过自定义片段着色器步骤。
 *
 * @alias CustomShader
 * @constructor
 *
 * @experimental This 该功能使用了 3D Tiles 规范中的部分内容，但此规范尚未最终定稿，可能根据 Cesium 的标准弃用政策进行更改。
 *
 * @example
 * const customShader = new CustomShader({
 * uniforms: {
 * u_colorIndex: {
 * type: Cesium.UniformType.FLOAT,
 * value: 1.0
 *     },
 * u_normalMap: {
 * type: Cesium.UniformType.SAMPLER_2D,
 * value: new Cesium.TextureUniform({
 * url: "http://example.com/normal.png"
 *       })
 *     }
 *   },
 * varyings: {
 * v_selectedColor: Cesium.VaryingType.VEC3
 *   },
 * vertexShaderText: `
 * void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
 * v_selectedColor = mix(vsInput.attributes.color_0, vsInput.attributes.color_1, u_colorIndex);
 * vsOutput.positionMC += 0.1 * vsInput.attributes.normal;
 *   }
 *   `,
 * fragmentShaderText: `
 * void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
 * material.normal = texture(u_normalMap, fsInput.attributes.texCoord_0);
 * material.diffuse = v_selectedColor;
 *   }
 *   `
 * });
 */
function CustomShader(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 一个决定自定义着色器与整体
   * 片段着色器交互方式的值。此值由 {@link CustomShaderPipelineStage} 使用。
   *
   * @type {CustomShaderMode}
   * @readonly
   */
  this.mode = options.mode ?? CustomShaderMode.MODIFY_MATERIAL;
  /**
   * 使用自定义着色器时采用的照明模型。
   * 此值由 {@link CustomShaderPipelineStage} 使用。
   *
   * @type {LightingModel}
   * @readonly
   */
  this.lightingModel = options.lightingModel;
  /**
   * 用户声明的额外统一变量。
   *
   * @type {Object<string, UniformSpecifier>}
   * @readonly
   */
  this.uniforms = options.uniforms ?? Frozen.EMPTY_OBJECT;
  /**
   * 用户声明的额外变化变量。
   * 此值由 {@link CustomShaderPipelineStage} 使用。
   *
   * @type {Object<string, VaryingType>}
   * @readonly
   */
  this.varyings = options.varyings ?? Frozen.EMPTY_OBJECT;
  /**
   * 顶点着色器的用户自定义 GLSL 代码。
   *
   * @type {string}
   * @readonly
   */
  this.vertexShaderText = options.vertexShaderText;
  /**
   * 片段着色器的用户自定义 GLSL 代码。
   *
   * @type {string}
   * @readonly
   */
  this.fragmentShaderText = options.fragmentShaderText;

  /**
   * 半透明模式，决定自定义着色器如何应用。如果值为
   * CustomShaderTransulcencyMode.OPAQUE 或 CustomShaderTransulcencyMode.TRANSLUCENT，则自定义着色器
   * 将覆盖模型材质的设置。如果值为 CustomShaderTransulcencyMode.INHERIT，
   * 自定义着色器将根据基元的材质设置显示为不透明或半透明。
   *
   * @type {CustomShaderTranslucencyMode}
   * @default CustomShaderTranslucencyMode.INHERIT
   * @readonly
   */
  this.translucencyMode =
    options.translucencyMode ?? CustomShaderTranslucencyMode.INHERIT;

  /**
   * 纹理统一变量需要一些异步处理。此处理被委托
   * 给纹理管理器。
   *
   * @type {TextureManager}
   * @readonly
   * @private
   */
  this._textureManager = new TextureManager();
  /**
   * 在纹理加载期间使用的默认纹理（来自 {@link Context}）。
   * 统一变量名称与返回值的函数的映射。此映射
   *
   * @type {Texture}
   * @readonly
   * @private
   */
  this._defaultTexture = undefined;
  /**
   * 与 {@link DrawCommand} 使用的整体统一映射结合使用。
   * is combined with the overall uniform map used by the {@link DrawCommand}
   *
   * @type {Object<string, Function>}
   * @readonly
   * @private
   */
  this.uniformMap = buildUniformMap(this);

  /**
   * 仅用于 {@link CustomShaderPipelineStage} 的优化。
   * is used only for optimizations in {@link CustomShaderPipelineStage}.
   * @type {VertexVariableSets}
   * @private
   */
  this.usedVariablesVertex = {
    attributeSet: {},
    featureIdSet: {},
    metadataSet: {},
    metadataClassSet: {},
    metadataStatisticsSet: {},
  };
  /**
   * A collection of variables used in <code>fragmentShaderText</code>. This
   * 仅用于 {@link CustomShaderPipelineStage} 中的优化。
   * @type {FragmentVariableSets}
   * @private
   */
  this.usedVariablesFragment = {
    attributeSet: {},
    featureIdSet: {},
    metadataSet: {},
    metadataClassSet: {},
    metadataStatisticsSet: {},
    materialSet: {},
  };

  findUsedVariables(this);
  validateBuiltinVariables(this);
}

function buildUniformMap(customShader) {
  const uniforms = customShader.uniforms;
  const uniformMap = {};
  for (const uniformName in uniforms) {
    if (uniforms.hasOwnProperty(uniformName)) {
      const uniform = uniforms[uniformName];
      const type = uniform.type;
      //>>includeStart('debug', pragmas.debug);
      if (type === UniformType.SAMPLER_CUBE) {
        throw new DeveloperError(
          "CustomShader does not support samplerCube uniforms",
        );
      }
      //>>includeEnd('debug');

      if (type === UniformType.SAMPLER_2D) {
        customShader._textureManager.loadTexture2D(uniformName, uniform.value);
        uniformMap[uniformName] = createUniformTexture2DFunction(
          customShader,
          uniformName,
        );
      } else {
        uniformMap[uniformName] = createUniformFunction(
          customShader,
          uniformName,
        );
      }
    }
  }
  return uniformMap;
}

function createUniformTexture2DFunction(customShader, uniformName) {
  return function () {
    return (
      customShader._textureManager.getTexture(uniformName) ??
      customShader._defaultTexture
    );
  };
}

function createUniformFunction(customShader, uniformName) {
  return function () {
    return customShader.uniforms[uniformName].value;
  };
}

function getVariables(shaderText, regex, outputSet) {
  let match;
  while ((match = regex.exec(shaderText)) !== null) {
    const variableName = match[1];

    // Using a dictionary like a set. The value doesn't
    // matter, as this will only be used for queries such as
    // if (set.hasOwnProperty(variableName)) { ... }
    outputSet[variableName] = true;
  }
}

function findUsedVariables(customShader) {
  const attributeRegex = /[vf]sInput\.attributes\.(\w+)/g;
  const featureIdRegex = /[vf]sInput\.featureIds\.(\w+)/g;
  // Metadata is a little more complex. Match the first identifier after:
  //  - vsInput.metadata.<property>
  //  - vsInput.metadataClass.<property>
  //  - vsInput.metadataStatistics.<property>
  // metadataSet collects all three (any of them requires the property's
  // value); the class and statistics structs are also tracked separately so
  // their constants are only emitted when a shader reads them.
  const metadataRegex =
    /[vf]sInput\.(?:metadata|metadataClass|metadataStatistics)\.(\w+)/g;
  const metadataClassRegex = /[vf]sInput\.metadataClass\.(\w+)/g;
  const metadataStatisticsRegex = /[vf]sInput\.metadataStatistics\.(\w+)/g;
  let attributeSet;

  const vertexShaderText = customShader.vertexShaderText;
  if (defined(vertexShaderText)) {
    attributeSet = customShader.usedVariablesVertex.attributeSet;
    getVariables(vertexShaderText, attributeRegex, attributeSet);

    attributeSet = customShader.usedVariablesVertex.featureIdSet;
    getVariables(vertexShaderText, featureIdRegex, attributeSet);

    attributeSet = customShader.usedVariablesVertex.metadataSet;
    getVariables(vertexShaderText, metadataRegex, attributeSet);

    attributeSet = customShader.usedVariablesVertex.metadataClassSet;
    getVariables(vertexShaderText, metadataClassRegex, attributeSet);

    attributeSet = customShader.usedVariablesVertex.metadataStatisticsSet;
    getVariables(vertexShaderText, metadataStatisticsRegex, attributeSet);
  }

  const fragmentShaderText = customShader.fragmentShaderText;
  if (defined(fragmentShaderText)) {
    attributeSet = customShader.usedVariablesFragment.attributeSet;
    getVariables(fragmentShaderText, attributeRegex, attributeSet);

    attributeSet = customShader.usedVariablesFragment.featureIdSet;
    getVariables(fragmentShaderText, featureIdRegex, attributeSet);

    attributeSet = customShader.usedVariablesFragment.metadataSet;
    getVariables(fragmentShaderText, metadataRegex, attributeSet);

    attributeSet = customShader.usedVariablesFragment.metadataClassSet;
    getVariables(fragmentShaderText, metadataClassRegex, attributeSet);

    attributeSet = customShader.usedVariablesFragment.metadataStatisticsSet;
    getVariables(fragmentShaderText, metadataStatisticsRegex, attributeSet);

    const materialRegex = /material\.(\w+)/g;
    const materialSet = customShader.usedVariablesFragment.materialSet;
    getVariables(fragmentShaderText, materialRegex, materialSet);
  }
}

function expandCoordinateAbbreviations(variableName) {
  const modelCoordinatesRegex = /^.*MC$/;
  const worldCoordinatesRegex = /^.*WC$/;
  const eyeCoordinatesRegex = /^.*EC$/;

  if (modelCoordinatesRegex.test(variableName)) {
    return `${variableName} (model coordinates)`;
  }

  if (worldCoordinatesRegex.test(variableName)) {
    return `${variableName} (Cartesian world coordinates)`;
  }

  if (eyeCoordinatesRegex.test(variableName)) {
    return `${variableName} (eye coordinates)`;
  }

  return variableName;
}

function validateVariableUsage(
  variableSet,
  incorrectVariable,
  correctVariable,
  vertexOrFragment,
) {
  if (variableSet.hasOwnProperty(incorrectVariable)) {
    const message = `${expandCoordinateAbbreviations(
      incorrectVariable,
    )} is not available in the ${vertexOrFragment} shader. Did you mean ${expandCoordinateAbbreviations(
      correctVariable,
    )} instead?`;
    throw new DeveloperError(message);
  }
}

function validateBuiltinVariables(customShader) {
  const attributesVS = customShader.usedVariablesVertex.attributeSet;

  // names without MC/WC/EC are ambiguous
  validateVariableUsage(attributesVS, "position", "positionMC", "vertex");
  validateVariableUsage(attributesVS, "normal", "normalMC", "vertex");
  validateVariableUsage(attributesVS, "tangent", "tangentMC", "vertex");
  validateVariableUsage(attributesVS, "bitangent", "bitangentMC", "vertex");

  // world and eye coordinate positions are only available in the fragment shader.
  validateVariableUsage(attributesVS, "positionWC", "positionMC", "vertex");
  validateVariableUsage(attributesVS, "positionEC", "positionMC", "vertex");

  // normal, tangent and bitangent are in model coordinates in the vertex shader
  validateVariableUsage(attributesVS, "normalEC", "normalMC", "vertex");
  validateVariableUsage(attributesVS, "tangentEC", "tangentMC", "vertex");
  validateVariableUsage(attributesVS, "bitangentEC", "bitangentMC", "vertex");

  const attributesFS = customShader.usedVariablesFragment.attributeSet;

  // names without MC/WC/EC are ambiguous
  validateVariableUsage(attributesFS, "position", "positionEC", "fragment");
  validateVariableUsage(attributesFS, "normal", "normalEC", "fragment");
  validateVariableUsage(attributesFS, "tangent", "tangentEC", "fragment");
  validateVariableUsage(attributesFS, "bitangent", "bitangentEC", "fragment");

  // normal, tangent, and bitangent are in eye coordinates in the fragment
  // shader.
  validateVariableUsage(attributesFS, "normalMC", "normalEC", "fragment");
  validateVariableUsage(attributesFS, "tangentMC", "tangentEC", "fragment");
  validateVariableUsage(attributesFS, "bitangentMC", "bitangentEC", "fragment");
}

/**
 * 更新着色器中声明的统一变量值。
 * @param {string} uniformName 统一的 GLSL 名称。必须与构造函数中声明的统一变量之一匹配。
 * @param {boolean|number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4|string|Resource|TextureUniform} value 统一变量的新值。
 */
CustomShader.prototype.setUniform = function (uniformName, value) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("uniformName", uniformName);
  Check.defined("value", value);
  if (!defined(this.uniforms[uniformName])) {
    throw new DeveloperError(
      `Uniform ${uniformName} must be declared in the CustomShader constructor.`,
    );
  }
  //>>includeEnd('debug');
  const uniform = this.uniforms[uniformName];
  if (uniform.type === UniformType.SAMPLER_2D) {
    // Textures are loaded asynchronously
    this._textureManager.loadTexture2D(uniformName, value);
  } else if (defined(value.clone)) {
    // clone Cartesian and Matrix types.
    uniform.value = value.clone(uniform.value);
  } else {
    uniform.value = value;
  }
};

CustomShader.prototype.update = function (frameState) {
  this._defaultTexture = frameState.context.defaultTexture;
  this._textureManager.update(frameState);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} True 如果此对象被销毁，则不应使用它；否则返回 false。
 *
 * @see CustomShader#destroy
 */
CustomShader.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的 WebGL 资源。销毁对象可以确保
 * WebGL 资源的确定性释放，而无需依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，就不应再次使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @example
 * customShader = customShader && customShader.destroy();
 *
 * @see CustomShader#isDestroyed
 */
CustomShader.prototype.destroy = function () {
  this._textureManager = this._textureManager && this._textureManager.destroy();
  destroyObject(this);
};

export default CustomShader;