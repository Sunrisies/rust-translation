import {
  AttributeType,
  Cartesian3,
  Matrix3,
  Matrix4,
  PrimitiveType,
  Quaternion,
  RuntimeError,
  defined,
} from "@cesium/core";
import Axis from "../Axis.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";
import CullFace from "../CullFace.js";

/** @import {Attribute} from "../ModelComponents.js"; */

/**
 * 用于 {@link Model} 的实用函数。
 *
 * @private
 */
function ModelUtility() {}

/**
 * 创建一个用于报告模型加载失败的函数。
 *
 * @param {string} type 要报告的对象类型。
 * @param {string} path 模型文件的 URI。
 * @param {Error} [error] 导致失败的错误。
 * @returns {RuntimeError} An 模型加载失败的错误信息。
 *
 * @private
 */
ModelUtility.getError = function (type, path, error) {
  let message = `Failed to load ${type}: ${path}`;
  if (defined(error) && defined(error.message)) {
    message += `\n${error.message}`;
  }

  const runtimeError = new RuntimeError(message);
  if (defined(error)) {
    // the original call stack is often more useful than the new error's stack,
    // so add the information here
    runtimeError.stack = `Original stack:\n${error.stack}\nHandler stack:\n${runtimeError.stack}`;
  }

  return runtimeError;
};

/**
 * 从模型中的节点获取变换矩阵。
 *
 * @param {ModelComponents.Node} node 节点组件。
 * @returns {Matrix4} The 计算得到的变换矩阵。如果未指定变换矩阵或参数，则默认为单位矩阵。
 *
 * @private
 */
ModelUtility.getNodeTransform = function (node) {
  if (defined(node.matrix)) {
    return node.matrix;
  }

  return Matrix4.fromTranslationQuaternionRotationScale(
    defined(node.translation) ? node.translation : Cartesian3.ZERO,
    defined(node.rotation) ? node.rotation : Quaternion.IDENTITY,
    defined(node.scale) ? node.scale : Cartesian3.ONE,
  );
};

/**
 * 通过语义查找属性，如 POSITION 或 TANGENT。
 *
 * @param {ModelComponents.Primitive|ModelComponents.Instances} object 原始组件或实例对象。
 * @param {VertexAttributeSemantic|InstanceAttributeSemantic} semantic 要搜索的语义。
 * @param {number} [setIndex] 该语义的集合索引。对于某些语义（如 POSITION、NORMAL、TRANSLATION、ROTATION），该索引可能未定义。
 * @return {Attribute} The 选中的属性，若未找到则显示为 undefined。
 *
 * @private
 */
ModelUtility.getAttributeBySemantic = function (object, semantic, setIndex) {
  const attributes = object.attributes;
  const attributesLength = attributes.length;
  for (let i = 0; i < attributesLength; ++i) {
    const attribute = attributes[i];
    const matchesSetIndex = defined(setIndex)
      ? attribute.setIndex === setIndex
      : true;
    if (attribute.semantic === semantic && matchesSetIndex) {
      return attribute;
    }
  }

  return undefined;
};

/**
 * 与 getAttributeBySemantic 类似，但仅使用名称字段进行搜索，
 * 因为自定义属性没有语义。
 *
 * @param {ModelComponents.Primitive|ModelComponents.Instances} object 原始组件或实例对象。
 * @param {string} name 模型中出现的属性名称。
 * @return {ModelComponents.Attribute} The 选中的属性，若未找到则显示为 undefined。
 *
 * @private
 */
ModelUtility.getAttributeByName = function (object, name) {
  const attributes = object.attributes;
  const attributesLength = attributes.length;
  for (let i = 0; i < attributesLength; ++i) {
    const attribute = attributes[i];
    if (attribute.name === name) {
      return attribute;
    }
  }

  return undefined;
};

/**
 * 从包含标签或 positionalLabel 的数组中查找特征 ID，该标签与给定标签匹配。
 * 要搜索的标签。
 * @param {ModelComponents.FeatureIdAttribute[]|ModelComponents.FeatureIdImplicitRange[]|ModelComponents.FeatureIdTexture[]} featureIds
 * @param {string} label 用于搜索的标签。
 * @returns {ModelComponents.FeatureIdAttribute|ModelComponents.FeatureIdImplicitRange|ModelComponents.FeatureIdTexture} The 若找到，则返回特征 ID 集合；否则为 <code>undefined</code>。
 *
 * @private
 */
ModelUtility.getFeatureIdsByLabel = function (featureIds, label) {
  for (let i = 0; i < featureIds.length; i++) {
    const featureIdSet = featureIds[i];
    if (
      featureIdSet.positionalLabel === label ||
      featureIdSet.label === label
    ) {
      return featureIdSet;
    }
  }

  return undefined;
};

ModelUtility.hasQuantizedAttributes = function (attributes) {
  if (!defined(attributes)) {
    return false;
  }

  for (let i = 0; i < attributes.length; i++) {
    const attribute = attributes[i];
    if (defined(attribute.quantization)) {
      return true;
    }
  }
  return false;
};

/**
 * @param {ModelComponents.Attribute} attribute
 *
 * @private
 */
ModelUtility.getAttributeInfo = function (attribute) {
  const semantic = attribute.semantic;
  const setIndex = attribute.setIndex;

  let variableName;
  let hasSemantic = false;
  if (defined(semantic)) {
    variableName = VertexAttributeSemantic.getVariableName(semantic, setIndex);
    hasSemantic = true;
  } else {
    variableName = attribute.name;
    // According to the glTF 2.0 spec, custom attributes must be prepended with
    // an underscore.
    variableName = variableName.replace(/^_/, "");
    variableName = variableName.toLowerCase();
  }

  const isVertexColor = /^color_\d+$/.test(variableName);
  const attributeType = attribute.type;
  let glslType = AttributeType.getGlslType(attributeType);

  // color_n can be either a vec3 or a vec4. But in GLSL we can always use
  // attribute vec4 since GLSL promotes vec3 attribute data to vec4 with
  // the .a channel set to 1.0.
  if (isVertexColor) {
    glslType = "vec4";
  }

  const isQuantized = defined(attribute.quantization);
  let quantizedGlslType;
  if (isQuantized) {
    // The quantized color_n attribute also is promoted to a vec4 in the shader
    quantizedGlslType = isVertexColor
      ? "vec4"
      : AttributeType.getGlslType(attribute.quantization.type);
  }

  return {
    attribute: attribute,
    isQuantized: isQuantized,
    variableName: variableName,
    hasSemantic: hasSemantic,
    glslType: glslType,
    quantizedGlslType: quantizedGlslType,
  };
};

const cartesianMaxScratch = new Cartesian3();
const cartesianMinScratch = new Cartesian3();

/**
 * 获取原始组件的 POSITION 属性的最小和最大值。
 * 此值用于计算原始组件的边界球，以及整个模型的边界球。
 * 原始组件。
 *
 * @param {ModelComponents.Primitive} primitive 实例平移属性的分量间最小值。
 * @param {Cartesian3} [instancingTranslationMin] 实例平移属性的分量间最大值。
 * @param {Cartesian3} [instancingTranslationMax] 包含最小和最大位置值的对象。
 *
 * @returns {object} An 模型文件中的模型矩阵（如 glTF）通常位于不同的坐标系统中，例如 3D Tiles 中 y-up 而非 z-up。
 *
 * @private
 */
ModelUtility.getPositionMinMax = function (
  primitive,
  instancingTranslationMin,
  instancingTranslationMax,
) {
  const positionGltfAttribute = ModelUtility.getAttributeBySemantic(
    primitive,
    "POSITION",
  );

  let positionMax = positionGltfAttribute.max;
  let positionMin = positionGltfAttribute.min;

  if (defined(instancingTranslationMax) && defined(instancingTranslationMin)) {
    positionMin = Cartesian3.add(
      positionMin,
      instancingTranslationMin,
      cartesianMinScratch,
    );
    positionMax = Cartesian3.add(
      positionMax,
      instancingTranslationMax,
      cartesianMaxScratch,
    );
  }

  return {
    min: positionMin,
    max: positionMax,
  };
};

/**
 * 此函数返回一个矩阵，以修正这种差异，使 z 轴朝上，
 * 而 x 轴向前。
 * 原始朝上方向。
 * 原始向前方向。
 *
 * @param {Axis} upAxis 原始的朝上方向。
 * @param {Axis} forwardAxis 原始的向前方向。
 * @param {Matrix4} result 存储结果的矩阵。
 * @returns {Matrix4} The 轴校正矩阵。
 *
 * @private
 */
ModelUtility.getAxisCorrectionMatrix = function (upAxis, forwardAxis, result) {
  result = Matrix4.clone(Matrix4.IDENTITY, result);

  if (upAxis === Axis.Y) {
    result = Matrix4.clone(Axis.Y_UP_TO_Z_UP, result);
  } else if (upAxis === Axis.X) {
    result = Matrix4.clone(Axis.X_UP_TO_Z_UP, result);
  }

  if (forwardAxis === Axis.Z) {
    // glTF 2.0 has a Z-forward convention that must be adapted here to X-forward.
    result = Matrix4.multiplyTransformation(result, Axis.Z_UP_TO_X_UP, result);
  }

  return result;
};

const scratchMatrix3 = new Matrix3();

/**
 * 获取命令渲染状态中使用的剔除面。
 * <p>
 * 来自 glTF 规范 3.7.4 节：
 * 当网格原始组件使用基于三角形的拓扑结构（即三角形、三角形条或三角形扇）时，节点的全局
 * 变换行列式定义了该原始组件的缠绕顺序。如果行列式
 * 值为正，则缠绕顺序的三角形面为逆时针方向；
 * is a positive value, the winding order triangle faces is counterclockwise;
 * 相反情况下，缠绕顺序为顺时针方向。
 * </p>
 *
 * @param {Matrix4} modelMatrix 模型矩阵
 * @param {PrimitiveType} primitiveType 原始类型
 * @returns {CullFace} The 剔除面
 *
 * @private
 */
ModelUtility.getCullFace = function (modelMatrix, primitiveType) {
  if (!PrimitiveType.isTriangles(primitiveType)) {
    return CullFace.BACK;
  }

  const matrix3 = Matrix4.getMatrix3(modelMatrix, scratchMatrix3);
  return Matrix3.determinant(matrix3) < 0.0 ? CullFace.FRONT : CullFace.BACK;
};

/**
 * 对将在 GLSL 着色器中使用的标识符进行清理。该标识符
 * 清理方式如下：
 * - 将所有非字母数字字符序列替换为单个 `_`。
 * - 如果存在 `gl_` 前缀，则移除它。该前缀在 GLSL 中属于保留字。
 * - 如果标识符以数字开头，则在前面加上下划线。
 *
 * @example
 * // 返回 "customProperty"
 * ModelUtility.sanitizeGlslIdentifier("gl_customProperty");
 *
 * @example
 * // 返回 "_1234"
 * ModelUtility.sanitizeGlslIdentifier("1234");
 *
 * @param {string} identifier 原始标识符。
 *
 * @returns {string} The 清理后的标识符版本。
 */
ModelUtility.sanitizeGlslIdentifier = function (identifier) {
  // Remove non-alphanumeric characters and replace with a single underscore.
  // This regex is designed so that the result won't have multiple underscores
  // in a row.
  let sanitizedIdentifier = identifier.replaceAll(/[^A-Za-z0-9]+/g, "_");
  // Remove the gl_ prefix if present.
  sanitizedIdentifier = sanitizedIdentifier.replace(/^gl_/, "");
  // Add an underscore if first character is a digit.
  if (/^\d/.test(sanitizedIdentifier)) {
    sanitizedIdentifier = `_${sanitizedIdentifier}`;
  }

  return sanitizedIdentifier;
};

// Keep the list of supported extensions in the Model.js class docstring in sync with this object.
ModelUtility.supportedExtensions = {
  AGI_articulations: true,
  CESIUM_mesh_vector: true,
  CESIUM_primitive_outline: true,
  CESIUM_RTC: true,
  EXT_feature_metadata: true,
  EXT_implicit_cylinder_region: true,
  EXT_implicit_ellipsoid_region: true,
  EXT_instance_features: true,
  EXT_mesh_features: true,
  EXT_mesh_gpu_instancing: true,
  EXT_mesh_polygon: true,
  EXT_mesh_primitive_edge_visibility: true,
  EXT_meshopt_compression: true,
  EXT_primitive_voxels: true,
  EXT_structural_metadata: true,
  EXT_texture_webp: true,
  EXT_voxels: true,
  KHR_blend: true,
  KHR_draco_mesh_compression: true,
  KHR_implicit_shapes: true,
  KHR_materials_common: true,
  KHR_materials_pbrSpecularGlossiness: true,
  KHR_materials_specular: true,
  KHR_materials_anisotropy: true,
  KHR_materials_clearcoat: true,
  KHR_materials_emissive_strength: true,
  KHR_materials_unlit: true,
  KHR_mesh_quantization: true,
  KHR_mesh_primitive_restart: true,
  KHR_meshopt_compression: true,
  KHR_techniques_webgl: true,
  KHR_texture_basisu: true,
  KHR_texture_transform: true,
  KHR_gaussian_splatting: true,
  KHR_gaussian_splatting_compression_spz_2: true,
  WEB3D_quantized_attributes: true,
};

/**
 * 检查 glTF 所需的扩展是否
 * 被支持。如果找到不受支持的扩展，将抛出
 * 带有该扩展名称的 {@link RuntimeError} 异常。
 *
 * @param {string[]} extensionsRequired glTF 中的 extensionsRequired 数组。
 *
 * @exception {RuntimeError} Unsupported glTF 扩展
 */
ModelUtility.checkSupportedExtensions = function (extensionsRequired) {
  const length = extensionsRequired.length;
  for (let i = 0; i < length; i++) {
    const extension = extensionsRequired[i];
    if (!ModelUtility.supportedExtensions[extension]) {
      throw new RuntimeError(`Unsupported glTF Extension: ${extension}`);
    }
  }
};

export default ModelUtility;
