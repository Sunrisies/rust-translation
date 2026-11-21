import { Matrix3, PrimitiveType, defined, oneTimeWarning } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import MetadataStageFS from "../../Shaders/Model/MetadataStageFS.js";
import MetadataStageVS from "../../Shaders/Model/MetadataStageVS.js";
import MetadataType from "../MetadataType.js";
import ModelUtility from "./ModelUtility.js";

/**
 * 元数据管道阶段处理来自
 * EXT_structural_metadata 的元数据属性，并将其插入到着色器中的结构中。
 * 该结构将被 {@link CustomShaderPipelineStage} 使用，以允许
 * 用户通过 {@link CustomShader} 访问元数据
 *
 * @namespace MetadataPipelineStage
 *
 * @private
 */
const MetadataPipelineStage = {
  name: "MetadataPipelineStage",

  STRUCT_ID_METADATA_VS: "MetadataVS",
  STRUCT_ID_METADATA_FS: "MetadataFS",
  STRUCT_NAME_METADATA: "Metadata",

  STRUCT_ID_METADATA_CLASS_VS: "MetadataClassVS",
  STRUCT_ID_METADATA_CLASS_FS: "MetadataClassFS",
  STRUCT_NAME_METADATA_CLASS: "MetadataClass",

  STRUCT_ID_METADATA_STATISTICS_VS: "MetadataStatisticsVS",
  STRUCT_ID_METADATA_STATISTICS_FS: "MetadataStatisticsFS",
  STRUCT_NAME_METADATA_STATISTICS: "MetadataStatistics",

  FUNCTION_ID_INITIALIZE_METADATA_VS: "initializeMetadataVS",
  FUNCTION_ID_INITIALIZE_METADATA_FS: "initializeMetadataFS",
  FUNCTION_SIGNATURE_INITIALIZE_METADATA:
    "void initializeMetadata(FeatureIds featureIds, out Metadata metadata, out MetadataClass metadataClass, out MetadataStatistics metadataStatistics, ProcessedAttributes attributes)",
  FUNCTION_ID_SET_METADATA_VARYINGS: "setMetadataVaryings",
  FUNCTION_SIGNATURE_SET_METADATA_VARYINGS: "void setMetadataVaryings()",

  // Metadata class and statistics fields:
  // - some must be renamed to avoid reserved words
  // - some always have float/vec values, even for integer/ivec property types
  METADATA_CLASS_FIELDS: [
    { specName: "noData", shaderName: "noData" },
    { specName: "default", shaderName: "defaultValue" },
    { specName: "min", shaderName: "minValue" },
    { specName: "max", shaderName: "maxValue" },
  ],
  METADATA_STATISTICS_FIELDS: [
    { specName: "min", shaderName: "minValue" },
    { specName: "max", shaderName: "maxValue" },
    { specName: "mean", shaderName: "mean", type: "float" },
    { specName: "median", shaderName: "median" },
    {
      specName: "standardDeviation",
      shaderName: "standardDeviation",
      type: "float",
    },
    { specName: "variance", shaderName: "variance", type: "float" },
    { specName: "sum", shaderName: "sum" },
  ],
};

/**
 * 处理一个基本体。这修改了渲染资源中的以下部分：
 * 资源：
 * <ul>
 * <li>在着色器中添加一个 Metadata 结构</li>
 * <li>如果基本体具有结构元数据，则属性会被添加到 Metadata 结构中</li>
 * <li>在着色器中添加动态函数以初始化元数据属性</li>
 * <li>根据需要向统一映射中添加用于属性纹理的统一变量</li>
 * <li>根据需要向统一映射中添加用于偏移/缩放的统一变量</li>
 * </ul>
 * @param {PrimitiveRenderResources} renderResources 基本体的渲染资源
 * @param {ModelComponents.Primitive} primitive 要渲染的基本体
 * @param {FrameState} frameState 帧状态
 * @private
 */
MetadataPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const { shaderBuilder, model } = renderResources;
  const { structuralMetadata = {}, content } = model;
  const statistics = content?.tileset.metadataExtension?.statistics;
  const webgl2 = frameState.context.webgl2;
  const usedMetadataProperties = collectMetadataUsedByOtherStages(
    model,
    primitive,
  );

  const propertyAttributesInfo = getPropertyAttributesInfo(
    structuralMetadata.propertyAttributes,
    primitive,
    statistics,
  );
  const propertyTexturesInfo = getPropertyTexturesInfo(
    structuralMetadata.propertyTextures,
    statistics,
  );
  const propertyTablesInfo = getPropertyTablesInfo(
    structuralMetadata.propertyTables,
    primitive,
    renderResources,
    statistics,
    usedMetadataProperties,
  );

  // Declare <type>MetadataClass and <type>MetadataStatistics structs as needed
  const allPropertyInfos = propertyAttributesInfo
    .concat(propertyTexturesInfo)
    .concat(propertyTablesInfo);
  declareMetadataTypeStructs(shaderBuilder, allPropertyInfos);

  // Always declare the Metadata, MetadataClass, and MetadataStatistics structs
  // and the initializeMetadata() function, even if not used
  declareStructsAndFunctions(shaderBuilder);
  shaderBuilder.addVertexLines(MetadataStageVS);
  shaderBuilder.addFragmentLines(MetadataStageFS);

  for (let i = 0; i < propertyAttributesInfo.length; i++) {
    const info = propertyAttributesInfo[i];
    processPropertyAttributeProperty(
      renderResources,
      info,
      usedMetadataProperties,
    );
  }
  for (let i = 0; i < propertyTexturesInfo.length; i++) {
    const info = propertyTexturesInfo[i];
    processPropertyTextureProperty(
      renderResources,
      info,
      webgl2,
      usedMetadataProperties,
    );
  }
  for (let i = 0; i < propertyTablesInfo.length; i++) {
    const info = propertyTablesInfo[i];
    processPropertyTableProperty(
      renderResources,
      info,
      webgl2,
      usedMetadataProperties,
    );
  }
};

/**
 * 收集所有 propertyAttributes 的所有属性信息，并
 * 以扁平化数组形式返回
 * @param {PropertyAttribute[]} propertyAttributes 需要描述的 propertyAttributes 及其属性
 * @param {ModelComponents.Primitive} primitive 要渲染的基本体
 * @param {object} [statistics] 关于属性的统计信息（如果模型来自 3DTiles tileset）
 * @param {object} usedMetadataProperties 其他阶段在基本体着色器中使用的元数据属性
 * @returns {object[]} An 包含每个 PropertyAttributeProperty 信息的对象数组
 * @private
 */
function getPropertyAttributesInfo(propertyAttributes, primitive, statistics) {
  if (!defined(propertyAttributes)) {
    return [];
  }
  return propertyAttributes.flatMap((propertyAttribute) =>
    getPropertyAttributeInfo(propertyAttribute, primitive, statistics),
  );
}

/**
 * 收集单个 PropertyAttribute 的属性信息
 * @param {PropertyAttribute} propertyAttribute 需要描述的 PropertyAttribute
 * @param {ModelComponents.Primitive} primitive 要渲染的基本体
 * @param {object} [statistics] 关于属性的统计信息（如果模型来自 3DTiles tileset）
 * @returns {object[]} An 包含每个 PropertyAttributeProperty 信息的对象数组
 * @private
 */
function getPropertyAttributeInfo(propertyAttribute, primitive, statistics) {
  const { getAttributeByName, getAttributeInfo, sanitizeGlslIdentifier } =
    ModelUtility;

  const classId = propertyAttribute.class.id;
  const classStatistics = statistics?.classes[classId];

  const propertiesArray = Object.entries(propertyAttribute.properties);
  const infoArray = new Array(propertiesArray.length);

  for (let i = 0; i < propertiesArray.length; i++) {
    const [propertyId, property] = propertiesArray[i];
    const modelAttribute = getAttributeByName(primitive, property.attribute);
    const { glslType, variableName } = getAttributeInfo(modelAttribute);

    infoArray[i] = {
      metadataVariable: sanitizeGlslIdentifier(propertyId),
      property,
      classProperty: property.classProperty,
      type: property.classProperty.type,
      glslType,
      variableName,
      propertyStatistics: classStatistics?.properties[propertyId],
      shaderDestination: ShaderDestination.BOTH,
    };
  }

  return infoArray;
}

/**
 * 收集所有 propertyTextures 的所有属性信息，并
 * 以扁平化数组形式返回
 * @param {PropertyTexture[]} propertyTextures 需要描述的 PropertyTextures
 * @param {object} [statistics] 关于属性的统计信息（如果模型来自 3DTiles tileset）
 * @returns {object[]} An 包含每个 PropertyTextureProperty 信息的对象数组
 * @private
 */
function getPropertyTexturesInfo(propertyTextures, statistics) {
  if (!defined(propertyTextures)) {
    return [];
  }
  return propertyTextures.flatMap((propertyTexture) =>
    getPropertyTextureInfo(propertyTexture, statistics),
  );
}

/**
 * 收集单个 PropertyTexture 的属性信息
 * @param {PropertyTexture} propertyTexture 需要描述的 PropertyTexture
 * @param {object} [statistics] 关于属性的统计信息（如果模型来自 3DTiles tileset）
 * @returns {object[]} An 包含每个 PropertyTextureProperty 信息的对象数组
 * @private
 */
function getPropertyTextureInfo(propertyTexture, statistics) {
  const { sanitizeGlslIdentifier } = ModelUtility;

  const classId = propertyTexture.class.id;
  const classStatistics = statistics?.classes[classId];

  const propertiesArray = Object.entries(propertyTexture.properties).filter(
    ([id, property]) => {
      const numChannels = property.textureReader.channels.length;
      return property.classProperty.isGpuCompatible(numChannels);
    },
  );
  const infoArray = new Array(propertiesArray.length);

  for (let i = 0; i < propertiesArray.length; i++) {
    const [propertyId, property] = propertiesArray[i];

    infoArray[i] = {
      metadataVariable: sanitizeGlslIdentifier(propertyId),
      property,
      classProperty: property.classProperty,
      type: property.classProperty.type,
      glslType: property.classProperty.getGlslType(),
      propertyStatistics: classStatistics?.properties[propertyId],
      shaderDestination: ShaderDestination.FRAGMENT,
    };
  }

  return infoArray;
}

const NUM_CHANNELS = 4; // use all channels for property table textures

function getPropertyTablesInfo(
  propertyTables,
  primitive,
  renderResources,
  statistics,
  usedMetadataProperties,
) {
  if (!defined(propertyTables)) {
    return [];
  }

  // Each feature ID set can reference a property table.
  // For a given primitive, as we have here, the mapping is 1:1.
  // (This isn't strictly enforced in the EXT_mesh_features schema, but would be considered ill-formed and ambiguous.
  // There _is_ a way to specify which featureID set to use for picking and styling in the Cesium3DTileset API, which we may want to respect here in the future).
  const tableToFeatureSetInfo = mapPropertyTablesToFeatureIdSets(
    renderResources,
    primitive,
  );

  return propertyTables
    .filter(
      (propertyTable) =>
        defined(propertyTable.class) &&
        tableToFeatureSetInfo.has(String(propertyTable.id)),
    )
    .flatMap((propertyTable) =>
      getPropertyTableInfo(
        propertyTable,
        tableToFeatureSetInfo,
        statistics,
        usedMetadataProperties,
      ),
    );
}

function getPropertyTableInfo(
  propertyTable,
  tableToFeatureSetInfo,
  statistics,
  usedMetadataProperties,
) {
  const { sanitizeGlslIdentifier } = ModelUtility;

  const classDefinition = propertyTable.class;
  const classStatistics = statistics?.classes[classDefinition.id];
  const featureSetInfo =
    tableToFeatureSetInfo.get(String(propertyTable.id)) ?? {};

  // Depending on whether the featureIDs are a feature texture or feature attribute,
  // the shader usage may be restricted to a given shader stage.
  const shaderDestination =
    featureSetInfo.shaderDestination ?? ShaderDestination.BOTH;

  const properties = propertyTable.properties;
  const classProperties = classDefinition.properties;
  const infoArray = [];

  // This is the per-table index of the property info, which is used to index into the property table texture
  // during a texelFetch.
  let propertyInfoIndex = 0;

  // See note in {@link parseStructuralMetadata.collectGpuCompatiblePropertyInfo} about
  // why we iterate over the class definition properties rather than the property table properties.
  for (const [propertyId, classProperty] of Object.entries(classProperties)) {
    if (!classProperty.isGpuCompatible(NUM_CHANNELS)) {
      continue;
    }

    // For performance reasons, since property tables can be quite large, only include properties that are used by other pipeline stages in the shader.
    // Note: we could do this for property textures and attributes as well - but since users can call the `pickMetadata`
    // API with an arbitrary metadata property, we'd need to rebuild every model's shaders each time such a call is made. Since property textures
    // and attributes tend to be less numerous than property tables anyway, it's more important to optimize table usage in this way.
    const property = properties[propertyId];
    const propertyShaderDestination = ShaderDestination.intersection(
      propertyDestination(propertyId, usedMetadataProperties),
      shaderDestination,
    );

    if (propertyShaderDestination === ShaderDestination.NONE) {
      // Still need to increment the index to stay aligned with the rows of the metadata texture.
      // The texture includes metadata whether or not it's used in the shader.
      propertyInfoIndex++;
      continue;
    }

    infoArray.push({
      metadataVariable: sanitizeGlslIdentifier(propertyId),
      property: property,
      classProperty: classProperty,
      type: classProperty.type,
      glslType: classProperty.getGlslType(),
      propertyStatistics: classStatistics?.properties[propertyId],
      shaderDestination: propertyShaderDestination,
      propertyTable: propertyTable,
      featureIdVariableName: featureSetInfo.variableName,
      propertyInfoIndex: propertyInfoIndex,
    });

    propertyInfoIndex++;
  }

  return infoArray;
}

/**
 * 将属性表映射到给定基本体的特征 ID 集。通常，映射不是 1:1 的，但在给定基本体中可以视为 1:1。
 * 在给定基本体中，可以安全地将其视为 1:1 的映射。
 *
 * @param {PrimitiveRenderResources} renderResources
 * @param {ModelComponents.Primitive} primitive
 * @returns A 从属性表 ID 映射到包含相应特征 ID 集信息的对象
 * 针对给定的原始体。 (包含着色器变量名称和着色器目标。)
 *
 * @private
 */
function mapPropertyTablesToFeatureIdSets(renderResources, primitive) {
  const propertyTableToFeatureSet = new Map();

  function addMapEntry(featureIds, shaderDestination) {
    const propertyTableId = featureIds?.propertyTableId;
    if (!defined(propertyTableId)) {
      return;
    }

    const key = String(propertyTableId);
    const entry = {
      // This is consistent with the variable name given in the feature ID pipeline stage.
      // Aliases can also be used, but this will always be valid.
      variableName: featureIds.positionalLabel,
      shaderDestination: shaderDestination,
    };

    const existingEntry = propertyTableToFeatureSet.get(key);
    if (defined(existingEntry)) {
      console.warn(
        `Multiple feature ID sets reference the same property table ${propertyTableId} in primitive. Only one will be used.`,
      );
    }
    propertyTableToFeatureSet.set(key, entry);
  }

  // Collect feature IDs from two sources: the primitive, and instances
  const primitiveFeatureIds = primitive?.featureIds ?? [];
  for (let i = 0; i < primitiveFeatureIds.length; i++) {
    const featureIds = primitiveFeatureIds[i];
    // Textures feature sets are fragment-only
    const isTexture = defined(featureIds?.textureReader);
    addMapEntry(
      featureIds,
      isTexture ? ShaderDestination.FRAGMENT : ShaderDestination.BOTH,
    );
  }

  // Instance feature IDs (if present)
  const instances = renderResources.runtimeNode?.node?.instances;
  const instanceFeatureIds = instances?.featureIds ?? [];
  for (let i = 0; i < instanceFeatureIds.length; i++) {
    const featureIds = instanceFeatureIds[i];
    addMapEntry(featureIds, ShaderDestination.BOTH);
  }

  return propertyTableToFeatureSet;
}

/**
 * 在着色器中为 PropertyAttributeProperty、PropertyTextureProperty 和 MetadataTableProperty 分别声明 <type>MetadataClass 结构体
 * @param {ShaderBuilder} shaderBuilder 原始体的着色器构建器
 * @param {object[]} propertyInfos 关于 PropertyAttributeProperties、PropertyTextureProperties 和 PropertyTableProperties 的信息
 * @private
 */
function declareMetadataTypeStructs(shaderBuilder, propertyInfos) {
  const classTypes = new Set();
  const statisticsTypes = new Set();

  for (let i = 0; i < propertyInfos.length; i++) {
    const { type, glslType, propertyStatistics } = propertyInfos[i];
    classTypes.add(glslType);
    if (!defined(propertyStatistics)) {
      continue;
    }
    if (type !== MetadataType.ENUM) {
      statisticsTypes.add(glslType);
    }
  }

  const classFields = MetadataPipelineStage.METADATA_CLASS_FIELDS;
  for (const metadataType of classTypes) {
    const classStructName = `${metadataType}MetadataClass`;
    declareTypeStruct(classStructName, metadataType, classFields);
  }

  const statisticsFields = MetadataPipelineStage.METADATA_STATISTICS_FIELDS;
  for (const metadataType of statisticsTypes) {
    const statisticsStructName = `${metadataType}MetadataStatistics`;
    declareTypeStruct(statisticsStructName, metadataType, statisticsFields);
  }

  function declareTypeStruct(structName, type, fields) {
    shaderBuilder.addStruct(structName, structName, ShaderDestination.BOTH);

    for (let i = 0; i < fields.length; i++) {
      const { shaderName } = fields[i];
      const shaderType =
        fields[i].type === "float" ? convertToFloatComponents(type) : type;
      shaderBuilder.addStructField(structName, shaderType, shaderName);
    }
  }
}

const floatConversions = {
  int: "float",
  ivec2: "vec2",
  ivec3: "vec3",
  ivec4: "vec4",
};

/**
 * 对于具有整数组件的类型，找到对应的浮点组件类型
 * @param {string} type 具有整数组件的 GLSL 类型名称
 * @returns {string} The 如果可用，则为具有相同维度且包含浮点组件的 GLSL 类型名称；否则为输入类型
 * @private
 */
function convertToFloatComponents(type) {
  const converted = floatConversions[type];
  return defined(converted) ? converted : type;
}

/**
 * 声明 main Metadata、MetadataClass 和 MetadataStatistics 结构体
 * 以及 initializeMetadata() 函数
 * @param {ShaderBuilder} shaderBuilder 原始体的着色器构建器
 * @private
 */
function declareStructsAndFunctions(shaderBuilder) {
  // Declare the Metadata struct.
  shaderBuilder.addStruct(
    MetadataPipelineStage.STRUCT_ID_METADATA_VS,
    MetadataPipelineStage.STRUCT_NAME_METADATA,
    ShaderDestination.VERTEX,
  );
  shaderBuilder.addStruct(
    MetadataPipelineStage.STRUCT_ID_METADATA_FS,
    MetadataPipelineStage.STRUCT_NAME_METADATA,
    ShaderDestination.FRAGMENT,
  );

  // Declare the MetadataClass struct
  shaderBuilder.addStruct(
    MetadataPipelineStage.STRUCT_ID_METADATA_CLASS_VS,
    MetadataPipelineStage.STRUCT_NAME_METADATA_CLASS,
    ShaderDestination.VERTEX,
  );
  shaderBuilder.addStruct(
    MetadataPipelineStage.STRUCT_ID_METADATA_CLASS_FS,
    MetadataPipelineStage.STRUCT_NAME_METADATA_CLASS,
    ShaderDestination.FRAGMENT,
  );

  // Declare the MetadataStatistics struct
  shaderBuilder.addStruct(
    MetadataPipelineStage.STRUCT_ID_METADATA_STATISTICS_VS,
    MetadataPipelineStage.STRUCT_NAME_METADATA_STATISTICS,
    ShaderDestination.VERTEX,
  );
  shaderBuilder.addStruct(
    MetadataPipelineStage.STRUCT_ID_METADATA_STATISTICS_FS,
    MetadataPipelineStage.STRUCT_NAME_METADATA_STATISTICS,
    ShaderDestination.FRAGMENT,
  );

  // declare the initializeMetadata() function. The details may differ
  // between vertex and fragment shader
  shaderBuilder.addFunction(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_VS,
    MetadataPipelineStage.FUNCTION_SIGNATURE_INITIALIZE_METADATA,
    ShaderDestination.VERTEX,
  );
  shaderBuilder.addFunction(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_FS,
    MetadataPipelineStage.FUNCTION_SIGNATURE_INITIALIZE_METADATA,
    ShaderDestination.FRAGMENT,
  );

  // declare the setMetadataVaryings() function in the vertex shader only.
  shaderBuilder.addFunction(
    MetadataPipelineStage.FUNCTION_ID_SET_METADATA_VARYINGS,
    MetadataPipelineStage.FUNCTION_SIGNATURE_SET_METADATA_VARYINGS,
    ShaderDestination.VERTEX,
  );
}

/**
 * 更新单个 PropertyAttributeProperty 的着色器
 * @param {PrimitiveRenderResources} renderResources 原始体的渲染资源
 * @param {object} propertyInfo 关于 PropertyAttributeProperty 的信息
 * @private
 */
function processPropertyAttributeProperty(
  renderResources,
  propertyInfo,
  usedMetadataProperties,
) {
  addPropertyAttributePropertyMetadata(renderResources, propertyInfo);
  addPropertyMetadataClassAndStatistics(
    renderResources.shaderBuilder,
    propertyInfo,
    usedMetadataProperties,
  );
}

/**
 * 向 Metadata 结构体添加字段，并将元数据值赋值给
 * initializeMetadata 函数，针对 PropertyAttributeProperty
 * @param {PrimitiveRenderResources} renderResources 原始体的渲染资源
 * @param {object} propertyInfo 关于 PropertyAttributeProperty 的信息
 * @private
 */
function addPropertyAttributePropertyMetadata(renderResources, propertyInfo) {
  const { shaderBuilder } = renderResources;
  const { metadataVariable, property, glslType } = propertyInfo;

  const valueExpression = addValueTransformUniforms({
    valueExpression: `attributes.${propertyInfo.variableName}`,
    renderResources: renderResources,
    glslType: glslType,
    metadataVariable: metadataVariable,
    shaderDestination: ShaderDestination.BOTH,
    property: property,
  });

  // declare the struct field
  shaderBuilder.addStructField(
    MetadataPipelineStage.STRUCT_ID_METADATA_VS,
    glslType,
    metadataVariable,
  );
  shaderBuilder.addStructField(
    MetadataPipelineStage.STRUCT_ID_METADATA_FS,
    glslType,
    metadataVariable,
  );

  // assign the result to the metadata struct property.
  const initializationLine = `metadata.${metadataVariable} = ${valueExpression};`;
  shaderBuilder.addFunctionLines(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_VS,
    [initializationLine],
  );
  shaderBuilder.addFunctionLines(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_FS,
    [initializationLine],
  );
}

/**
 * 更新单个 PropertyTextureProperty 的着色器
 * @param {PrimitiveRenderResources} renderResources 原始体的渲染资源
 * @param {object[]} propertyInfo 关于 PropertyTextureProperty 的信息
 * @param {boolean} webgl2 如果上下文为 WebGL2，则为 true
 * @private
 */
function processPropertyTextureProperty(
  renderResources,
  propertyInfo,
  webgl2,
  usedMetadataProperties,
) {
  addPropertyTexturePropertyMetadata(renderResources, propertyInfo, webgl2);
  addPropertyMetadataClassAndStatistics(
    renderResources.shaderBuilder,
    propertyInfo,
    usedMetadataProperties,
  );
}

/**
 * 向 Metadata 结构体添加字段，并将元数据值表达式赋值给
 * initializeMetadata 函数，针对 PropertyTextureProperty
 * @param {PrimitiveRenderResources} renderResources 原始体的渲染资源
 * @param {object} propertyInfo 关于 PropertyTextureProperty 的信息
 * @param {boolean} webgl2 如果上下文为 WebGL2，则为 true
 * @private
 */
function addPropertyTexturePropertyMetadata(
  renderResources,
  propertyInfo,
  webgl2,
) {
  const { shaderBuilder, uniformMap } = renderResources;
  const { metadataVariable, glslType, property } = propertyInfo;

  const { texCoord, channels, index, texture, transform } =
    property.textureReader;
  const textureUniformName = `u_propertyTexture_${index}`;
  const initializationLines = [];

  // Property texture properties may share the same physical texture, so only
  // add the texture uniform the first time we encounter it.
  if (!uniformMap.hasOwnProperty(textureUniformName)) {
    shaderBuilder.addUniform(
      "sampler2D",
      textureUniformName,
      ShaderDestination.FRAGMENT,
    );
    uniformMap[textureUniformName] = () => texture;
  }

  shaderBuilder.addStructField(
    MetadataPipelineStage.STRUCT_ID_METADATA_FS,
    glslType,
    metadataVariable,
  );

  // Get a GLSL expression for the texture coordinates of the property.
  // By default, this will be taken directly from the attributes.
  const texCoordVariable = `attributes.texCoord_${texCoord}`;
  let texCoordVariableExpression = texCoordVariable;

  // Check if the texture defines a `transform` from a `KHR_texture_transform`
  if (defined(transform) && !Matrix3.equals(transform, Matrix3.IDENTITY)) {
    // Add a uniform for the transformation matrix
    const transformUniformName = `${textureUniformName}Transform`;
    shaderBuilder.addUniform(
      "mat3",
      transformUniformName,
      ShaderDestination.FRAGMENT,
    );
    uniformMap[transformUniformName] = function () {
      return transform;
    };

    // Update the expression for the texture coordinates
    // with one that transforms the texture coordinates
    // with the transform matrix first
    texCoordVariableExpression = `vec2(${transformUniformName} * vec3(${texCoordVariable}, 1.0))`;
  }
  const valueExpression = `texture(${textureUniformName}, ${texCoordVariableExpression}).${channels}`;
  const classProperty = property.classProperty;
  let unpackedValue;
  if (webgl2) {
    unpackedValue = classProperty.unpackTextureInShader(
      valueExpression,
      channels,
      metadataVariable,
      initializationLines,
    );
  } else {
    unpackedValue = classProperty.unpackTextureInShaderWebGL1(valueExpression);
  }

  const transformedValue = addValueTransformUniforms({
    valueExpression: unpackedValue,
    renderResources: renderResources,
    glslType: glslType,
    metadataVariable: metadataVariable,
    shaderDestination: ShaderDestination.FRAGMENT,
    property: property,
  });

  const finalAssignment = `metadata.${metadataVariable} = ${transformedValue};`;
  initializationLines.push(finalAssignment);
  shaderBuilder.addFunctionLines(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_FS,
    initializationLines,
  );
}

/**
 * 向 MetadataClass 结构体添加字段，并将 metadataClass 值表达式赋值给
 * initializeMetadata 函数，针对 PropertyAttributeProperty、
 * PropertyTextureProperty 或 MetadataTableProperty
 * @param {ShaderBuilder} shaderBuilder 原始体的着色器构建器
 * @param {object} propertyInfo 关于 PropertyAttributeProperty、PropertyTextureProperty 或 MetadataTableProperty 的信息
 * @private
 */
function addPropertyMetadataClass(shaderBuilder, propertyInfo) {
  const classProperty = propertyInfo.classProperty;
  const { metadataVariable, glslType, shaderDestination } = propertyInfo;

  // Construct assignment statements to set values in the metadataClass struct
  const assignments = getStructAssignments(
    MetadataPipelineStage.METADATA_CLASS_FIELDS,
    classProperty,
    `metadataClass.${metadataVariable}`,
    glslType,
  );

  // Struct field: Prefix to get the appropriate <type>MetadataClass struct
  const metadataType = `${glslType}MetadataClass`;
  shaderBuilder.addStructField(
    MetadataPipelineStage.STRUCT_ID_METADATA_CLASS_FS,
    metadataType,
    metadataVariable,
  );
  shaderBuilder.addFunctionLines(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_FS,
    assignments,
  );
  if (!ShaderDestination.includesVertexShader(shaderDestination)) {
    return;
  }
  shaderBuilder.addStructField(
    MetadataPipelineStage.STRUCT_ID_METADATA_CLASS_VS,
    metadataType,
    metadataVariable,
  );
  shaderBuilder.addFunctionLines(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_VS,
    assignments,
  );
}

/**
 * 向 MetadataStatistics 结构体添加字段，并将 metadataStatistics 值表达式赋值给
 * initializeMetadata 函数，针对
 * PropertyAttributeProperty 或 PropertyTextureProperty
 * @param {ShaderBuilder} shaderBuilder 原始体的着色器构建器
 * @param {object} propertyInfo 关于 PropertyAttributeProperty 或 PropertyTextureProperty 的信息
 * @private
 */
function addPropertyMetadataStatistics(shaderBuilder, propertyInfo) {
  const { propertyStatistics } = propertyInfo;
  if (!defined(propertyStatistics)) {
    return;
  }
  const { metadataVariable, type, glslType } = propertyInfo;
  if (type === MetadataType.ENUM) {
    // enums have an "occurrences" statistic which is not implemented yet
    return;
  }

  // Construct assignment statements to set values in the metadataStatistics struct
  const fields = MetadataPipelineStage.METADATA_STATISTICS_FIELDS;
  const struct = `metadataStatistics.${metadataVariable}`;
  const assignments = getStructAssignments(
    fields,
    propertyStatistics,
    struct,
    glslType,
  );

  // Struct field: Prefix to get the appropriate <type>MetadataStatistics struct
  const statisticsType = `${glslType}MetadataStatistics`;
  shaderBuilder.addStructField(
    MetadataPipelineStage.STRUCT_ID_METADATA_STATISTICS_FS,
    statisticsType,
    metadataVariable,
  );
  shaderBuilder.addFunctionLines(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_FS,
    assignments,
  );
  if (!ShaderDestination.includesVertexShader(propertyInfo.shaderDestination)) {
    return;
  }
  shaderBuilder.addStructField(
    MetadataPipelineStage.STRUCT_ID_METADATA_STATISTICS_VS,
    statisticsType,
    metadataVariable,
  );
  shaderBuilder.addFunctionLines(
    MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_VS,
    assignments,
  );
}

function processPropertyTableProperty(
  renderResources,
  propertyInfo,
  webgl2,
  usedMetadataProperties,
) {
  addPropertyTablePropertyMetadata(renderResources, propertyInfo, webgl2);
  addPropertyMetadataClassAndStatistics(
    renderResources.shaderBuilder,
    propertyInfo,
    usedMetadataProperties,
  );
}

/**
 * 添加属性的 metadataClass 和 metadataStatistics 条目，但仅当
 * 自定义着色器读取它们时：其值会被编译到 GLSL 中
 * 针对每个属性发出这些信号，即可定义每个不同的类定义。
 * 或一组统计数据拥有自己的着色器程序，即使没有内容读取它们也是如此。
 * @param {ShaderBuilder} shaderBuilder 基元的着色器构建器
 * @param {object} propertyInfo 关于属性的信息
 * @param {object} usedMetadataProperties 其他阶段在基元着色器中使用的元数据属性
 * @private
 */
function addPropertyMetadataClassAndStatistics(
  shaderBuilder,
  propertyInfo,
  usedMetadataProperties,
) {
  const propertyId = propertyInfo.metadataVariable;
  if (usedMetadataProperties.usedClass.has(propertyId)) {
    addPropertyMetadataClass(shaderBuilder, propertyInfo);
  }
  if (usedMetadataProperties.usedStatistics.has(propertyId)) {
    addPropertyMetadataStatistics(shaderBuilder, propertyInfo);
  }
}

function addPropertyTablePropertyMetadata(
  renderResources,
  propertyInfo,
  webgl2,
) {
  const { shaderBuilder, uniformMap } = renderResources;
  const {
    metadataVariable,
    glslType,
    property,
    featureIdVariableName,
    propertyTable,
    propertyInfoIndex,
  } = propertyInfo;

  if (!webgl2) {
    oneTimeWarning(
      "PropertyTableCustomShader",
      "Property table support for custom shaders requires WebGL2.",
    );
    return;
  }

  if (!defined(featureIdVariableName) || !defined(propertyTable.texture)) {
    return;
  }

  // For property tables, all properties are packed into a single texture.
  // Thus, the texture identifier is based on the table id.
  const textureUniformName = `u_propertyTableTexture_${propertyTable.id}`;
  const initializationLines = [];

  if (!uniformMap.hasOwnProperty(textureUniformName)) {
    // Note that, unlike property textures, property table textures are available in both
    // the vertex and fragment shaders. While property textures rely on interpolated UV coords,
    // property table textures generally apply to non-interpolated texel fetches based on (featureId, propertyId).
    shaderBuilder.addUniform(
      "sampler2D",
      textureUniformName,
      ShaderDestination.BOTH,
    );
    uniformMap[textureUniformName] = () => propertyTable.texture;
  }

  const shaderDestination = propertyInfo.shaderDestination;
  if (ShaderDestination.includesVertexShader(shaderDestination)) {
    shaderBuilder.addStructField(
      MetadataPipelineStage.STRUCT_ID_METADATA_VS,
      glslType,
      metadataVariable,
    );
  }

  if (ShaderDestination.includesFragmentShader(shaderDestination)) {
    shaderBuilder.addStructField(
      MetadataPipelineStage.STRUCT_ID_METADATA_FS,
      glslType,
      metadataVariable,
    );
  }

  const textureWidthName = `${metadataVariable}_textureWidth`;
  const linearIndexName = `${metadataVariable}_linearIndex`;
  initializationLines.push(
    `int ${textureWidthName} = textureSize(${textureUniformName}, 0).x;`,
    `int ${linearIndexName} = ${propertyInfoIndex * propertyTable.count} + int(featureIds.${featureIdVariableName});`,
  );
  const texCoordExpression = `ivec2(${linearIndexName} % ${textureWidthName}, ${linearIndexName} / ${textureWidthName})`;
  const textureSampleExpression = `texelFetch(${textureUniformName}, ${texCoordExpression}, 0)`;
  const classProperty = propertyInfo.classProperty;

  const unpackedVariable = classProperty.unpackTextureInShader(
    textureSampleExpression,
    `rgba`,
    metadataVariable,
    initializationLines,
  );

  const transformedValue = addValueTransformUniforms({
    valueExpression: unpackedVariable,
    renderResources: renderResources,
    glslType: glslType,
    metadataVariable: metadataVariable,
    shaderDestination: shaderDestination,
    // If the property is on the schema but not used by this primitive, value transforms come from class schema property
    property: property ?? classProperty,
  });

  const finalAssignment = `metadata.${metadataVariable} = ${transformedValue};`;
  initializationLines.push(finalAssignment);

  if (ShaderDestination.includesVertexShader(shaderDestination)) {
    shaderBuilder.addFunctionLines(
      MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_VS,
      initializationLines,
    );
  }

  if (ShaderDestination.includesFragmentShader(shaderDestination)) {
    shaderBuilder.addFunctionLines(
      MetadataPipelineStage.FUNCTION_ID_INITIALIZE_METADATA_FS,
      initializationLines,
    );
  }
}

/**
 * 构造 GLSL 赋值语句以在结构中设置元数据规范值
 * @param {object[]} fieldNames 具有以下属性的对象：
 * @param {string} fieldNames[].specName 规范中的属性名称
 * @param {string} fieldNames[].shaderName 着色器中的属性名称
 * @param {object} values 属性值的来源，基于 fieldNames[].specName
 * @param {string} struct 将要分配值的结构名称
 * @param {string} type 要分配的值的类型
 * @returns {Array<{name: string, value: any}>} 包含属性名称（在着色器中）和该属性值的 GLSL 赋值语句的对象
 * @private
 */
function getStructAssignments(fieldNames, values, struct, type) {
  function constructAssignment(field) {
    const value = values[field.specName];
    if (defined(value)) {
      // Note: template literals will coerce arrays to strings, if needed (e.g. if the metadata type is a vecN or an array, or even an array of vecN)
      // In any case, the resulting string ends up as a flattened, comma-separated list. For example: [[1,2], [3,4]] will end up as vec4(1,2,3,4), which is valid GLSL.
      return `${struct}.${field.shaderName} = ${type}(${value});`;
    }
  }
  return defined(values)
    ? fieldNames.map(constructAssignment).filter(defined)
    : [];
}

/**
 * 处理属性值的偏移/缩放变换
 * 通过 czm_valueTransform() 调用包裹 GLSL 值表达式
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.valueExpression 没有变换的 GLSL 值表达式
 * @param {string} options.metadataVariable 将包含属性值的 GLSL 变量名称
 * @param {string} options.glslType 变量的 GLSL 类型
 * @param {ShaderDestination} options.shaderDestination 哪些着色器使用此变量
 * @param {PrimitiveRenderResources} options.renderResources 该基元的渲染资源
 * @param {(PropertyAttributeProperty|PropertyTextureProperty|MetadataTableProperty|MetadataClassProperty)} options.property 值所源自的属性
 * @returns {string} A 包裹的 GLSL 值表达式
 * @private
 */
function addValueTransformUniforms(options) {
  const { valueExpression, property } = options;

  if (!property.hasValueTransform) {
    return valueExpression;
  }

  const metadataVariable = options.metadataVariable;
  const offsetUniformName = `u_${metadataVariable}_offset`;
  const scaleUniformName = `u_${metadataVariable}_scale`;

  const { shaderBuilder, uniformMap } = options.renderResources;
  const { glslType, shaderDestination } = options;
  shaderBuilder.addUniform(glslType, offsetUniformName, shaderDestination);
  shaderBuilder.addUniform(glslType, scaleUniformName, shaderDestination);

  // Note: if property is an instance of MetadataClassProperty, offset and scale will be the default values set on the class definition.
  // Otherwise, the spec allows them to be overridden per-property instance.
  const { offset, scale } = property;
  uniformMap[offsetUniformName] = () => offset;
  uniformMap[scaleUniformName] = () => scale;

  return `czm_valueTransform(${offsetUniformName}, ${scaleUniformName}, ${valueExpression})`;
}

function collectMetadataUsedByOtherStages(model, primitive) {
  const usedInVertex = new Set();
  const usedInFragment = new Set();
  const usedClass = new Set();
  const usedStatistics = new Set();

  collectMetadataUsedInCustomShader(
    model,
    usedInVertex,
    usedInFragment,
    usedClass,
    usedStatistics,
  );
  collectMetadataUsedInPointCloudStyling(
    model,
    primitive,
    usedInVertex,
    usedInFragment,
  );

  return {
    usedInVertex,
    usedInFragment,
    usedClass,
    usedStatistics,
  };
}

function addKeys(set, dictionary) {
  for (const propertyId in dictionary) {
    if (dictionary.hasOwnProperty(propertyId)) {
      set.add(propertyId);
    }
  }
}

function collectMetadataUsedInCustomShader(
  model,
  usedInVertex,
  usedInFragment,
  usedClass,
  usedStatistics,
) {
  const customShader = model.customShader;
  if (!defined(customShader)) {
    return;
  }

  const fragmentSets = customShader.usedVariablesFragment ?? {};
  addKeys(usedInFragment, fragmentSets.metadataSet ?? {});
  addKeys(usedClass, fragmentSets.metadataClassSet ?? {});
  addKeys(usedStatistics, fragmentSets.metadataStatisticsSet ?? {});

  const vertexSets = customShader.usedVariablesVertex ?? {};
  addKeys(usedInVertex, vertexSets.metadataSet ?? {});
  addKeys(usedClass, vertexSets.metadataClassSet ?? {});
  addKeys(usedStatistics, vertexSets.metadataStatisticsSet ?? {});
}

function collectMetadataUsedInPointCloudStyling(
  model,
  primitive,
  usedInVertex,
  usedInFragment,
) {
  const style = model.style;
  const hasPointCloudStyle =
    defined(style) && primitive.primitiveType === PrimitiveType.POINTS;
  if (!hasPointCloudStyle) {
    return;
  }

  const colorVariables = style.color?.getVariables?.() ?? [];
  for (const propertyId of colorVariables) {
    usedInVertex.add(propertyId);
    usedInFragment.add(propertyId);
  }

  const showVariables = style.show?.getVariables?.() ?? [];
  for (const propertyId of showVariables) {
    usedInVertex.add(propertyId);
    usedInFragment.add(propertyId);
  }

  // Only used in vertex shader
  const pointSizeVariables = style.pointSize?.getVariables?.() ?? [];
  for (const propertyId of pointSizeVariables) {
    usedInVertex.add(propertyId);
  }
}

/**
 * 根据其在其他管道阶段中的使用，确定给定属性的着色器目标。
 *
 * @param {object} propertyId 需要检查的属性 ID
 * @param {object} usedMetadataProperties 其他阶段在基元着色器中使用的元数据属性
 * @returns {ShaderDestination} The 该属性的着色器目标
 * @private
 */
function propertyDestination(propertyId, usedMetadataProperties) {
  const fragmentDestination = usedMetadataProperties.usedInFragment.has(
    propertyId,
  )
    ? ShaderDestination.FRAGMENT
    : ShaderDestination.NONE;
  const vertexDestination = usedMetadataProperties.usedInVertex.has(propertyId)
    ? ShaderDestination.VERTEX
    : ShaderDestination.NONE;

  return ShaderDestination.union(fragmentDestination, vertexDestination);
}

export default MetadataPipelineStage;
