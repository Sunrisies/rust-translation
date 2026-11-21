import {
  Cartesian3,
  Cartesian4,
  Math as CesiumMath,
  Matrix4,
  OrthographicFrustum,
  RuntimeError,
  clone,
  defined,
} from "@cesium/core";
import Cesium3DTileRefine from "../Cesium3DTileRefine.js";
import ModelType from "./ModelType.js";
import ModelUtility from "./ModelUtility.js";
import Pass from "../../Renderer/Pass.js";
import PointCloudStylingStageVS from "../../Shaders/Model/PointCloudStylingStageVS.js";
import SceneMode from "../SceneMode.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";

const scratchUniform = new Cartesian4();

/**
 * 点云样式阶段负责在运行时为点云应用颜色、大小和显示样式。它还处理
 * 由模型或 tileset 提供的点云阴影效果。
 * 由拥有该阴影效果的模型提供。只有当未提供点大小样式时，才会应用点云阴影。
 * 点云阴影仅在特定条件下应用。
 * 不提供点大小样式时。
 *
 * @namespace PointCloudStylingPipelineStage
 *
 * @private
 */
const PointCloudStylingPipelineStage = {
  name: "PointCloudStylingPipelineStage", // Helps with debugging
};

/**
 * 处理一个基本体。如果拥有该基本体的模型有样式，则
 * 此阶段会修改渲染资源中的以下部分：
 * <ul>
 * <li>将样式函数添加到顶点着色器</li>
 * <li>添加定义变量以计算世界坐标中的位置</li>
 * <li>添加变化变量以计算点云颜色</li>
 * </ul>
 *
 * 如果模型具有点云阴影，则此阶段会修改渲染资源的以下部分：
 * <li>添加顶点着色器代码以计算衰减并更新 gl_PointSize</li>
 * <ul>
 * <li>更新统一映射以传递点云参数</li>
 * 此基本体的渲染资源。
 * </ul>
 *
 * @param {PrimitiveRenderResources} renderResources 该基本体。
 * @param {ModelComponents.Primitive} primitive 该基本体。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
PointCloudStylingPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const shaderBuilder = renderResources.shaderBuilder;
  const model = renderResources.model;
  const style = model.style;

  // Point cloud styling will only be applied on the GPU if there is
  // no batch table. If a batch table exists, then:
  //  - the property attribute will not be defined
  //  - the model will be using a feature table

  const structuralMetadata = model.structuralMetadata;
  const propertyAttributes = defined(structuralMetadata)
    ? structuralMetadata.propertyAttributes
    : undefined;

  const hasFeatureTable =
    defined(model.featureTableId) &&
    model.featureTables[model.featureTableId].featuresLength > 0;

  const hasBatchTable = !defined(propertyAttributes) && hasFeatureTable;

  let hasShowStyle = false;
  if (defined(style) && !hasBatchTable) {
    const variableSubstitutionMap =
      getVariableSubstitutionMap(propertyAttributes);
    const shaderFunctionInfo = getStyleShaderFunctionInfo(
      style,
      variableSubstitutionMap,
    );
    addShaderFunctionsAndDefines(shaderBuilder, shaderFunctionInfo);
    hasShowStyle = defined(shaderFunctionInfo.showStyleFunction);

    const propertyNames = getPropertyNames(shaderFunctionInfo);

    const usesNormalSemantic = propertyNames.indexOf("normalMC") >= 0;
    const hasNormals = ModelUtility.getAttributeBySemantic(
      primitive,
      VertexAttributeSemantic.NORMAL,
    );

    if (usesNormalSemantic && !hasNormals) {
      throw new RuntimeError(
        "Style references the NORMAL semantic but the point cloud does not have normals",
      );
    }

    shaderBuilder.addDefine(
      "COMPUTE_POSITION_WC_STYLE",
      undefined,
      ShaderDestination.VERTEX,
    );

    // If the style is translucent, the alpha options must be adjusted.
    const styleTranslucent = shaderFunctionInfo.styleTranslucent;
    if (styleTranslucent) {
      renderResources.alphaOptions.pass = Pass.TRANSLUCENT;
    }
  }

  const pointCloudShading = model.pointCloudShading;
  if (pointCloudShading.attenuation) {
    shaderBuilder.addDefine(
      "HAS_POINT_CLOUD_ATTENUATION",
      undefined,
      ShaderDestination.VERTEX,
    );
  }

  if (pointCloudShading.backFaceCulling) {
    shaderBuilder.addDefine(
      "HAS_POINT_CLOUD_BACK_FACE_CULLING",
      undefined,
      ShaderDestination.BOTH,
    );
  }

  // Hidden points are discarded in the fragment shader. See ModelVS.glsl
  if (hasShowStyle || pointCloudShading.backFaceCulling) {
    shaderBuilder.addVarying("float", "v_pointCloudShow");
  }

  let content;
  let is3DTiles;
  let usesAddRefinement;

  if (ModelType.is3DTiles(model.type)) {
    is3DTiles = true;
    content = model.content;
    usesAddRefinement = content.tile.refine === Cesium3DTileRefine.ADD;
  }

  shaderBuilder.addUniform(
    "vec4",
    "model_pointCloudParameters",
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addVertexLines(PointCloudStylingStageVS);

  const uniformMap = renderResources.uniformMap;
  uniformMap.model_pointCloudParameters = function () {
    const vec4 = scratchUniform;

    // Point size
    let defaultPointSize = 1.0;
    if (is3DTiles) {
      defaultPointSize = usesAddRefinement
        ? 5.0
        : content.tileset.memoryAdjustedScreenSpaceError;
    }
    vec4.x = pointCloudShading.maximumAttenuation ?? defaultPointSize;
    vec4.x *= frameState.pixelRatio;

    // Geometric error
    const geometricError = getGeometricError(
      renderResources,
      primitive,
      pointCloudShading,
      content,
    );
    vec4.y = geometricError * pointCloudShading.geometricErrorScale;

    const context = frameState.context;
    const frustum = frameState.camera.frustum;
    let depthMultiplier;

    // Attenuation is maximumAttenuation in 2D/ortho
    if (
      frameState.mode === SceneMode.SCENE2D ||
      frustum instanceof OrthographicFrustum
    ) {
      depthMultiplier = Number.POSITIVE_INFINITY;
    } else {
      depthMultiplier =
        context.drawingBufferHeight / frameState.camera.frustum.sseDenominator;
    }

    // Depth multiplier
    vec4.z = depthMultiplier;

    // Time
    if (is3DTiles) {
      vec4.w = content.tileset.timeSinceLoad;
    }

    return vec4;
  };
};

const scratchDimensions = new Cartesian3();
function getGeometricError(
  renderResources,
  primitive,
  pointCloudShading,
  content,
) {
  if (defined(content)) {
    const geometricError = content.tile.geometricError;

    if (geometricError > 0) {
      return geometricError;
    }
  }

  if (defined(pointCloudShading.baseResolution)) {
    return pointCloudShading.baseResolution;
  }

  const positionAttribute = ModelUtility.getAttributeBySemantic(
    primitive,
    VertexAttributeSemantic.POSITION,
  );
  const pointsLength = positionAttribute.count;

  // Estimate the geometric error
  const nodeTransform = renderResources.runtimeNode.transform;
  let dimensions = Cartesian3.subtract(
    positionAttribute.max,
    positionAttribute.min,
    scratchDimensions,
  );
  // dimensions is a vector, as it is a subtraction between two points
  dimensions = Matrix4.multiplyByPointAsVector(
    nodeTransform,
    dimensions,
    scratchDimensions,
  );
  const volume = dimensions.x * dimensions.y * dimensions.z;
  const geometricErrorEstimate = CesiumMath.cbrt(volume / pointsLength);
  return geometricErrorEstimate;
}

const scratchShaderFunctionInfo = {
  colorStyleFunction: undefined,
  showStyleFunction: undefined,
  pointSizeStyleFunction: undefined,
  styleTranslucent: false,
};

const builtinVariableSubstitutionMap = {
  POSITION: "attributes.positionMC",
  POSITION_ABSOLUTE: "v_positionWC",
  COLOR: "attributes.color_0",
  NORMAL: "attributes.normalMC",
};

function getVariableSubstitutionMap(propertyAttributes) {
  const variableSubstitutionMap = clone(builtinVariableSubstitutionMap);

  if (!defined(propertyAttributes)) {
    return variableSubstitutionMap;
  }

  for (let i = 0; i < propertyAttributes.length; i++) {
    const propertyAttribute = propertyAttributes[i];
    const properties = propertyAttribute.properties;
    for (const propertyId in properties) {
      // The property ID was already sanitized for GLSL by PntsLoader.
      if (properties.hasOwnProperty(propertyId)) {
        variableSubstitutionMap[propertyId] = `metadata.${propertyId}`;
      }
    }
  }

  return variableSubstitutionMap;
}
const parameterList =
  "ProcessedAttributes attributes, " +
  "Metadata metadata, " +
  "float tiles3d_tileset_time";

function getStyleShaderFunctionInfo(style, variableSubstitutionMap) {
  const info = scratchShaderFunctionInfo;
  const shaderState = {
    translucent: false,
  };

  info.colorStyleFunction = style.getColorShaderFunction(
    `getColorFromStyle(${parameterList})`,
    variableSubstitutionMap,
    shaderState,
  );
  info.showStyleFunction = style.getShowShaderFunction(
    `getShowFromStyle(${parameterList})`,
    variableSubstitutionMap,
    shaderState,
  );
  info.pointSizeStyleFunction = style.getPointSizeShaderFunction(
    `getPointSizeFromStyle(${parameterList})`,
    variableSubstitutionMap,
    shaderState,
  );
  info.styleTranslucent =
    defined(info.colorStyleFunction) && shaderState.translucent;

  return info;
}

function addShaderFunctionsAndDefines(shaderBuilder, shaderFunctionInfo) {
  const colorStyleFunction = shaderFunctionInfo.colorStyleFunction;
  if (defined(colorStyleFunction)) {
    shaderBuilder.addDefine(
      "HAS_POINT_CLOUD_COLOR_STYLE",
      undefined,
      ShaderDestination.BOTH,
    );
    shaderBuilder.addVertexLines(colorStyleFunction);

    // The point cloud may not necessarily have a color attribute.
    // Use a custom varying to account for this.
    shaderBuilder.addVarying("vec4", "v_pointCloudColor");
  }

  const showStyleFunction = shaderFunctionInfo.showStyleFunction;
  if (defined(showStyleFunction)) {
    shaderBuilder.addDefine(
      "HAS_POINT_CLOUD_SHOW_STYLE",
      undefined,
      ShaderDestination.BOTH,
    );
    shaderBuilder.addVertexLines(showStyleFunction);
  }

  const pointSizeStyleFunction = shaderFunctionInfo.pointSizeStyleFunction;
  if (defined(pointSizeStyleFunction)) {
    shaderBuilder.addDefine(
      "HAS_POINT_CLOUD_POINT_SIZE_STYLE",
      undefined,
      ShaderDestination.VERTEX,
    );
    shaderBuilder.addVertexLines(pointSizeStyleFunction);
  }
}

/**
 * 获取给定样式所使用的所有内置属性名称。
 * 函数。
 *
 * @param {Function} source 样式函数。
 * @param {string[]} propertyNames 要添加的属性名称数组。
 *
 * @private
 */
function getBuiltinPropertyNames(source, propertyNames) {
  const regex = /attributes\.(\w+)/g;
  let matches = regex.exec(source);
  while (matches !== null) {
    const name = matches[1];
    // Add the property name if it isn't already in the array.
    if (propertyNames.indexOf(name) === -1) {
      propertyNames.push(name);
    }
    matches = regex.exec(source);
  }
}

function getPropertyNames(shaderFunctionInfo) {
  const colorStyleFunction = shaderFunctionInfo.colorStyleFunction;
  const showStyleFunction = shaderFunctionInfo.showStyleFunction;
  const pointSizeStyleFunction = shaderFunctionInfo.pointSizeStyleFunction;

  // Get the properties in use by the style.
  const builtinPropertyNames = [];

  if (defined(colorStyleFunction)) {
    getBuiltinPropertyNames(colorStyleFunction, builtinPropertyNames);
  }
  if (defined(showStyleFunction)) {
    getBuiltinPropertyNames(showStyleFunction, builtinPropertyNames);
  }
  if (defined(pointSizeStyleFunction)) {
    getBuiltinPropertyNames(pointSizeStyleFunction, builtinPropertyNames);
  }

  return builtinPropertyNames;
}

export default PointCloudStylingPipelineStage;
