import {
  AttributeType,
  Cartesian3,
  ComponentDatatype,
  IndexDatatype,
  PrimitiveType,
  defined,
} from "@cesium/core";
import Buffer from "../../Renderer/Buffer.js";
import BufferUsage from "../../Renderer/BufferUsage.js";
import VertexArray from "../../Renderer/VertexArray.js";
import Pass from "../../Renderer/Pass.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import EdgeVisibilityStageFS from "../../Shaders/Model/EdgeVisibilityStageFS.js";
import EdgeVisibilityStageVS from "../../Shaders/Model/EdgeVisibilityStageVS.js";
import ModelUtility from "./ModelUtility.js";
import ModelReader from "./ModelReader.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";

/**
 * 根据 EXT_mesh_primitive_edge_visibility 定义的 2 位边缘可见性值。
 * @private
 */
const EdgeVisibilityType = Object.freeze({
  HIDDEN: 0,
  SILHOUETTE: 1,
  HARD: 2,
  // REPEATED_HARD (3) is a secondary spec encoding for a hard edge; normalized to HARD at decode time.
  REPEATED_HARD: 3,
});

/**
 * 使用 EXT_mesh_primitive_edge_visibility 数据构建模型边缘的衍生线几何结构。
 * 它解析编码后的边缘可见性位，创建包含
 * 每边属性的独立边域顶点数组（边类型、可选特征 ID、相邻面法线）。
 * 设置所需的着色器定义/变量，并将生成的线列表几何结构存储在
 * 渲染资源中，以便后续边缘渲染阶段使用。
 *
 * @namespace EdgeVisibilityPipelineStage
 * @private
 */
const EdgeVisibilityPipelineStage = {
  name: "EdgeVisibilityPipelineStage",
};

/**
 * 处理原始几何体以生成边缘几何结构和着色器绑定。这通过以下方式修改渲染资源：
 * <ul>
 * <li>添加着色器定义 (<code>HAS_EDGE_VISIBILITY</code>, <code>HAS_EDGE_VISIBILITY_MRT</code>)</li>
 * <li>注入输出边缘颜色/特征信息的片段着色器逻辑</li>
 * <li>添加顶点属性：边类型、可选特征 ID、轮廓法线及相邻面法线</li>
 * <li>添加变量以将这些属性传递给片段阶段</li>
 * <li>在 <code>renderResources.edgeGeometry</code> 中创建并存储衍生线列表顶点数组</li>
 * </ul>
 * 如果原始几何体不包含边缘可见性数据，函数会提前返回。
 *
 * @param {PrimitiveRenderResources} renderResources 原始几何体的渲染资源
 * @param {ModelComponents.Primitive} primitive 待渲染的几何体
 * @param {FrameState} frameState 帧状态
 * @private
 */
EdgeVisibilityPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  if (!defined(primitive.edgeVisibility)) {
    return;
  }

  const shaderBuilder = renderResources.shaderBuilder;

  // Add shader defines and fragment code
  shaderBuilder.addDefine(
    "HAS_EDGE_VISIBILITY",
    undefined,
    ShaderDestination.BOTH,
  );
  shaderBuilder.addDefine(
    "HAS_EDGE_VISIBILITY_MRT",
    undefined,
    ShaderDestination.FRAGMENT,
  );
  shaderBuilder.addFragmentLines(EdgeVisibilityStageFS);
  shaderBuilder.addVertexLines(EdgeVisibilityStageVS);

  // Add a uniform to distinguish between original geometry pass and edge pass
  shaderBuilder.addUniform("bool", "u_isEdgePass", ShaderDestination.BOTH);

  // Add line width uniform for edge expansion if not already added by MaterialPipelineStage
  const material = primitive.material;
  const lineStyle = defined(material) ? material.lineStyle : undefined;
  if (!defined(lineStyle) || !defined(lineStyle.width)) {
    shaderBuilder.addUniform("float", "u_lineWidth", ShaderDestination.VERTEX);
  }

  // Add edge type attribute and varying
  const edgeTypeLocation = shaderBuilder.addAttribute("float", "a_edgeType");
  shaderBuilder.addVarying("float", "v_edgeType", "flat");

  // Add edge feature ID attribute and varying
  const edgeFeatureIdLocation = shaderBuilder.addAttribute(
    "float",
    "a_edgeFeatureId",
  );

  // Add face normal attributes for silhouette detection
  const faceNormalALocation = shaderBuilder.addAttribute(
    "vec3",
    "a_faceNormalA",
  );
  const faceNormalBLocation = shaderBuilder.addAttribute(
    "vec3",
    "a_faceNormalB",
  );
  shaderBuilder.addVarying("vec3", "v_faceNormalAView", "flat");
  shaderBuilder.addVarying("vec3", "v_faceNormalBView", "flat");

  // Add varying for silhouette discard decision in vertex shader
  shaderBuilder.addVarying("float", "v_shouldDiscard", "flat");

  // Add attributes and varyings for quad-based wide line rendering
  const edgeOtherPosLocation = shaderBuilder.addAttribute(
    "vec3",
    "a_edgeOtherPos",
  );
  const edgeOffsetLocation = shaderBuilder.addAttribute(
    "float",
    "a_edgeOffset",
  );
  shaderBuilder.addVarying("float", "v_edgeOffset");

  const edgeResult = extractVisibleEdges(primitive);

  if (
    !defined(edgeResult) ||
    !defined(edgeResult.edgeIndices) ||
    edgeResult.edgeIndices.length === 0
  ) {
    return;
  }

  const runtimePrimitive = renderResources.runtimePrimitive.primitive;
  const vertexColorInfo = collectVertexColors(runtimePrimitive);
  const hasEdgeColorOverride = edgeResult.edgeData.some(function (edge) {
    return defined(edge.color);
  });

  const needsEdgeColorAttribute =
    hasEdgeColorOverride || defined(vertexColorInfo);

  let edgeColorLocation;
  if (needsEdgeColorAttribute) {
    edgeColorLocation = shaderBuilder.addAttribute("vec4", "a_edgeColor");
    shaderBuilder.addVarying("vec4", "v_edgeColor", "flat");
    shaderBuilder.addDefine(
      "HAS_EDGE_COLOR_ATTRIBUTE",
      undefined,
      ShaderDestination.BOTH,
    );
  }

  let cumDistAttribute;
  let edgeCumDistLocation;
  const cumDistAttr = ModelUtility.getAttributeBySemantic(
    primitive,
    "BENTLEY_materials_line_style:CUMULATIVE_DISTANCE",
  );

  if (defined(cumDistAttr)) {
    cumDistAttribute = cumDistAttr;
    edgeCumDistLocation = shaderBuilder.addAttribute(
      "float",
      "a_edgeCumulativeDistance",
    );
    shaderBuilder.addDefine(
      "HAS_EDGE_CUMULATIVE_DISTANCE",
      undefined,
      ShaderDestination.VERTEX,
    );
  }

  // Generate paired face normals for each unique edge (used to classify silhouette edges in the shader).
  const edgeFaceNormals = generateEdgeFaceNormals(
    edgeResult.edgeIndices,
    edgeResult.edgeData,
    primitive.edgeVisibility,
  );

  // Create edge-domain quad geometry (4 vertices per edge) with all required attributes for wide line rendering.
  const edgeGeometry = createQuadEdgeGeometry(
    edgeResult.edgeIndices,
    edgeResult.edgeData,
    renderResources,
    frameState.context,
    edgeTypeLocation,
    faceNormalALocation,
    faceNormalBLocation,
    edgeFeatureIdLocation,
    edgeColorLocation,
    edgeOtherPosLocation,
    edgeOffsetLocation,
    vertexColorInfo,
    primitive.edgeVisibility,
    edgeFaceNormals,
    cumDistAttribute,
    edgeCumDistLocation,
  );

  if (!defined(edgeGeometry)) {
    return;
  }

  // Register the vertex array for destruction on rebuild or model destroy.
  renderResources.model._pipelineResources.push(edgeGeometry.vertexArray);

  if (edgeGeometry.hasEdgeFeatureIds) {
    shaderBuilder.addDefine(
      "HAS_EDGE_FEATURE_ID",
      undefined,
      ShaderDestination.BOTH,
    );
  }

  // Set default value for u_isEdgePass uniform (false for original geometry pass). A later pass overrides this.
  renderResources.uniformMap.u_isEdgePass = function () {
    return false;
  };

  // Provide a fallback line width when the material did not define one.
  if (!defined(renderResources.uniformMap.u_lineWidth)) {
    renderResources.uniformMap.u_lineWidth = function () {
      return 1.0;
    };
  }

  if (defined(cumDistAttribute)) {
    if (!defined(renderResources.uniformMap.u_pixelsPerWorld)) {
      renderResources.uniformMap.u_pixelsPerWorld = function () {
        return 1.0;
      };
    }
  }

  const lineWidth =
    defined(lineStyle) && defined(lineStyle.width)
      ? lineStyle.width * frameState.pixelRatio
      : undefined;

  // Store edge geometry metadata so the renderer can issue a separate edges pass.
  // Use TRIANGLES instead of LINES to support wide lines via quad tessellation
  renderResources.edgeGeometry = {
    vertexArray: edgeGeometry.vertexArray,
    indexCount: edgeGeometry.indexCount,
    primitiveType: PrimitiveType.TRIANGLES,
    pass: Pass.CESIUM_3D_TILE_EDGES,
    lineWidth: lineWidth,
  };
};

/**
 * 从 GLB 文件中的 silhouetteNormals 访问器生成每个轮廓边缘的法线对。
 * 根据规范，任何编码了
 * 至少一条轮廓边缘的几何体必须包含该访问器。
 *
 * @param {number[]} edgeIndices 每边包含 2 个顶点索引的打包数组
 * @param {object[]} edgeData 边缘元数据数组（edgeType, silhouetteEdgeIndex）
 * @param {object} edgeVisibility 边缘可见性扩展数据
 * @returns {Float32Array} Packed 数组：每边 6 个浮点数（normalA.xyz, normalB.xyz）
 * @private
 */
function generateEdgeFaceNormals(edgeIndices, edgeData, edgeVisibility) {
  const numEdges = edgeIndices.length / 2;
  const edgeFaceNormals = new Float32Array(numEdges * 6);

  const raw = edgeVisibility.silhouetteNormals;
  if (!defined(raw)) {
    // No silhouette edges in this primitive, the shader only checks normals for SILHOUETTE edges.
    return edgeFaceNormals;
  }
  // raw is a packed typed array (x0,y0,z0, x1,y1,z1, ...) of float, byte, or
  // short components. The vectors are normalized below, which cancels the
  // quantization scale, so raw components can be used directly for all three.
  const normalCount = raw.length / 3;
  const silhouetteNormalsFloat = new Float32Array(raw.length);
  const scratchNormal = new Cartesian3();

  for (let i = 0; i < normalCount; i++) {
    scratchNormal.x = raw[i * 3];
    scratchNormal.y = raw[i * 3 + 1];
    scratchNormal.z = raw[i * 3 + 2];

    if (Cartesian3.magnitudeSquared(scratchNormal) > 0) {
      Cartesian3.normalize(scratchNormal, scratchNormal);
    } else {
      scratchNormal.x = 0;
      scratchNormal.y = 0;
      scratchNormal.z = 1;
    }

    silhouetteNormalsFloat[i * 3] = scratchNormal.x;
    silhouetteNormalsFloat[i * 3 + 1] = scratchNormal.y;
    silhouetteNormalsFloat[i * 3 + 2] = scratchNormal.z;
  }

  for (let i = 0; i < numEdges; i++) {
    const { edgeType, silhouetteEdgeIndex } = edgeData[i];

    if (edgeType !== EdgeVisibilityType.SILHOUETTE || silhouetteEdgeIndex < 0) {
      continue;
    }

    const pairBase = silhouetteEdgeIndex * 2;
    if ((pairBase + 1) * 3 + 2 >= silhouetteNormalsFloat.length) {
      continue;
    }

    const baseA = pairBase * 3;
    const baseB = (pairBase + 1) * 3;
    const baseIdx = i * 6;

    edgeFaceNormals[baseIdx] = silhouetteNormalsFloat[baseA];
    edgeFaceNormals[baseIdx + 1] = silhouetteNormalsFloat[baseA + 1];
    edgeFaceNormals[baseIdx + 2] = silhouetteNormalsFloat[baseA + 2];
    edgeFaceNormals[baseIdx + 3] = silhouetteNormalsFloat[baseB];
    edgeFaceNormals[baseIdx + 4] = silhouetteNormalsFloat[baseB + 1];
    edgeFaceNormals[baseIdx + 5] = silhouetteNormalsFloat[baseB + 2];
  }

  return edgeFaceNormals;
}

/**
 * 解析 EXT_mesh_primitive_edge_visibility 的 2 位边缘编码，并提取
 * 一组应被考虑渲染的独特边缘。边类型包括：
 * <ul>
 * <li><code>EdgeVisibilityType.HIDDEN</code> - 跳过</li>
 * <li><code>EdgeVisibilityType.SILHOUETTE</code> - 基于朝向进行条件显示候选者</li>
 * <li><code>EdgeVisibilityType.HARD</code> - 始终显示</li>
 * <li><code>EdgeVisibilityType.REPEATED_HARD</code> - 硬边缘的二次编码（与 HARD 相同处理）</li>
 * </ul>
 * 去重相邻三角形共享的边缘，并记录每边元数据。
 *
 * @param {ModelComponents.Primitive} primitive 包含 EXT_mesh_primitive_edge_visibility 数据的几何体
 * @returns {{edgeIndices:number[], edgeData:object[], silhouetteEdgeCount:number}} 边缘提取结果
 * @private
 */
function extractVisibleEdges(primitive) {
  const edgeVisibility = primitive.edgeVisibility;
  if (!defined(edgeVisibility)) {
    return [];
  }

  const visibility = edgeVisibility.visibility;
  const indices = primitive.indices;
  const lineStrings = edgeVisibility.lineStrings;

  const attributes = primitive.attributes;
  const vertexCount =
    defined(attributes) && attributes.length > 0 ? attributes[0].count : 0;

  const hasVisibilityData =
    defined(visibility) &&
    defined(indices) &&
    defined(indices.typedArray) &&
    indices.typedArray.length > 0;
  const hasLineStrings = defined(lineStrings) && lineStrings.length > 0;

  if (!hasVisibilityData && !hasLineStrings) {
    return [];
  }

  const triangleIndexArray = hasVisibilityData ? indices.typedArray : undefined;
  const edgeIndices = [];
  const edgeData = [];
  const seenEdgeHashes = new Set();
  let silhouetteEdgeCount = 0;
  const globalColor = edgeVisibility.materialColor;

  if (hasVisibilityData) {
    let edgeIndex = 0;
    const totalIndices = triangleIndexArray.length;
    const visibilityArray = visibility;

    for (let i = 0; i + 2 < totalIndices; i += 3) {
      const v0 = triangleIndexArray[i];
      const v1 = triangleIndexArray[i + 1];
      const v2 = triangleIndexArray[i + 2];
      for (let e = 0; e < 3; e++) {
        let a;
        let b;
        if (e === 0) {
          a = v0;
          b = v1;
        } else if (e === 1) {
          a = v1;
          b = v2;
        } else {
          a = v2;
          b = v0;
        }

        const byteIndex = Math.floor(edgeIndex / 4);
        const bitPairOffset = (edgeIndex % 4) * 2;
        edgeIndex++;

        if (byteIndex >= visibilityArray.length) {
          break;
        }

        const byte = visibilityArray[byteIndex];
        const visibility2Bit = (byte >> bitPairOffset) & 0x3;

        if (visibility2Bit === EdgeVisibilityType.HIDDEN) {
          continue;
        }

        const small = Math.min(a, b);
        const big = Math.max(a, b);
        const edgeKey = `${small},${big}`;

        if (seenEdgeHashes.has(edgeKey)) {
          // Deduplicate edges shared by adjacent triangles. This also handles
          // REPEATED_HARD edges (type=3): their first occurrence is recorded as
          // HARD, and any subsequent REPEATED_HARD occurrence is skipped here.
          continue;
        }
        seenEdgeHashes.add(edgeKey);
        edgeIndices.push(a, b);

        // Assign a sequential index into the silhouetteNormals accessor for SILHOUETTE edges.
        let silhouetteEdgeIndex = -1;
        if (visibility2Bit === EdgeVisibilityType.SILHOUETTE) {
          silhouetteEdgeIndex = silhouetteEdgeCount;
          silhouetteEdgeCount++;
        }

        edgeData.push({
          // Normalize REPEATED_HARD to HARD — both render identically in the shader.
          edgeType:
            visibility2Bit === EdgeVisibilityType.REPEATED_HARD
              ? EdgeVisibilityType.HARD
              : visibility2Bit,
          silhouetteEdgeIndex: silhouetteEdgeIndex,
          color: globalColor,
        });
      }
    }
  }

  if (hasLineStrings) {
    for (let i = 0; i < lineStrings.length; i++) {
      const lineString = lineStrings[i];
      if (!defined(lineString) || !defined(lineString.indices)) {
        continue;
      }

      const indicesArray = lineString.indices;
      if (!defined(indicesArray) || indicesArray.length < 2) {
        continue;
      }

      const restartValue = lineString.restartIndex;
      const lineColor = defined(lineString.materialColor)
        ? lineString.materialColor
        : globalColor;

      let previous;
      for (let j = 0; j < indicesArray.length; j++) {
        const currentIndex = indicesArray[j];
        if (defined(restartValue) && currentIndex === restartValue) {
          previous = undefined;
          continue;
        }

        if (!defined(previous)) {
          previous = currentIndex;
          continue;
        }

        const a = previous;
        const b = currentIndex;
        previous = currentIndex;

        if (a === b) {
          continue;
        }

        if (
          vertexCount > 0 &&
          (a < 0 || a >= vertexCount || b < 0 || b >= vertexCount)
        ) {
          continue;
        }

        const small = Math.min(a, b);
        const big = Math.max(a, b);
        const edgeKey = `${small},${big}`;

        if (seenEdgeHashes.has(edgeKey)) {
          continue;
        }

        seenEdgeHashes.add(edgeKey);
        edgeIndices.push(a, b);
        edgeData.push({
          edgeType: EdgeVisibilityType.HARD,
          silhouetteEdgeIndex: -1,
          color: defined(lineColor) ? lineColor : undefined,
        });
      }
    }
  }

  return { edgeIndices, edgeData, silhouetteEdgeCount };
}

function collectVertexColors(runtimePrimitive) {
  if (!defined(runtimePrimitive)) {
    return undefined;
  }

  const colorAttribute = ModelUtility.getAttributeBySemantic(
    runtimePrimitive,
    VertexAttributeSemantic.COLOR,
  );
  if (!defined(colorAttribute)) {
    return undefined;
  }

  const components = AttributeType.getNumberOfComponents(colorAttribute.type);
  if (components !== 3 && components !== 4) {
    return undefined;
  }

  let colorData = colorAttribute.typedArray;
  if (!defined(colorData)) {
    colorData = ModelReader.readAttributeAsTypedArray(colorAttribute);
  }
  if (!defined(colorData)) {
    return undefined;
  }
  const count = colorAttribute.count;
  if (!defined(count) || count === 0) {
    return undefined;
  }

  if (colorData.length < count * components) {
    return undefined;
  }

  const isFloatArray =
    colorData instanceof Float32Array || colorData instanceof Float64Array;
  const isUint8Array = colorData instanceof Uint8Array;
  const isUint16Array = colorData instanceof Uint16Array;

  if (!isFloatArray && !isUint8Array && !isUint16Array) {
    return undefined;
  }

  const colors = new Float32Array(count * 4);

  const convertComponent = function (value) {
    let converted;
    if (isFloatArray) {
      converted = value;
    } else if (isUint8Array) {
      converted = value / 255.0;
    } else if (isUint16Array) {
      converted = value / 65535.0;
    }
    return Math.min(Math.max(converted, 0.0), 1.0);
  };

  for (let i = 0; i < count; i++) {
    const srcBase = i * components;
    const destBase = i * 4;
    colors[destBase] = convertComponent(colorData[srcBase]);
    colors[destBase + 1] = convertComponent(colorData[srcBase + 1]);
    colors[destBase + 2] = convertComponent(colorData[srcBase + 2]);
    if (components === 4) {
      colors[destBase + 3] = convertComponent(colorData[srcBase + 3]);
    } else {
      colors[destBase + 3] = 1.0;
    }
  }

  return {
    colors: colors,
    count: count,
  };
}

/**
 * @typedef {object} VertexColorInfo
 * @property {Float32Array} colors 每个顶点打包的颜色
 * @property {number} count 顶点数量
 */

/**
 * 创建基于四边形的边缘几何结构以进行宽线渲染。每条边缘都转化为一个四边形（4个顶点，2个三角形）
 * 通过沿线条方向垂直拉伸的方式，使顶点着色器能够正确渲染线宽
 *
 * @param {number[]} edgeIndices 将顶点索引的打包数组 [a0,b0, a1,b1, ...] 放入源网格中
 * @param {object[]} edgeData 包含边缘元数据在内的数组，包括边缘类型和轮廓法线查找索引
 * @param {PrimitiveRenderResources} renderResources 该primitive的渲染资源
 * @param {Context} context WebGL渲染上下文
 * @param {number} edgeTypeLocation 用于边缘类型属性的着色器属性位置
 * @param {number} faceNormalALocation 用于面法线 A 的着色器属性位置
 * @param {number} faceNormalBLocation 用于面法线 B 的着色器属性位置
 * @param {number} edgeFeatureIdLocation 用于可选边缘特征 ID 的着色器属性位置
 * @param {number} edgeColorLocation 用于可选边缘颜色数据的着色器属性位置
 * @param {number} edgeOtherPosLocation 用于另一端位置属性的着色器属性位置
 * @param {number} edgeOffsetLocation 用于边缘偏移量 (-1 或 +1) 的着色器属性位置
 * @param {VertexColorInfo} [vertexColorInfo] 每个顶点的打包颜色（可选）
 * @param {object} edgeVisibility 边缘可见性扩展对象（可能包含轮廓法线，即VEC3组件的打包类型数组）
 * @param {Float32Array} edgeFaceNormals 打包的面法线（每条边缘包含6个浮点数）
 * @param {object} [cumDistAttribute] 累积距离属性
 * @param {number} [edgeCumDistLocation] 累积距离位置
 * @returns {object|undefined} Object 包含 {vertexArray, indexCount, hasEdgeFeatureIds} 或在失败时为undefined
 * @private
 */
function createQuadEdgeGeometry(
  edgeIndices,
  edgeData,
  renderResources,
  context,
  edgeTypeLocation,
  faceNormalALocation,
  faceNormalBLocation,
  edgeFeatureIdLocation,
  edgeColorLocation,
  edgeOtherPosLocation,
  edgeOffsetLocation,
  vertexColorInfo,
  edgeVisibility,
  edgeFaceNormals,
  cumDistAttribute,
  edgeCumDistLocation,
) {
  if (!defined(edgeIndices) || edgeIndices.length === 0) {
    return undefined;
  }

  const numEdges = edgeData.length;
  const vertsPerEdge = 4; // Each edge becomes a quad (4 vertices)
  const totalVerts = numEdges * vertsPerEdge;

  // Always use location 0 for position
  const positionLocation = 0;

  // Get original vertex positions
  const positionAttribute = ModelUtility.getAttributeBySemantic(
    renderResources.runtimePrimitive.primitive,
    VertexAttributeSemantic.POSITION,
  );
  const srcPos = defined(positionAttribute.typedArray)
    ? positionAttribute.typedArray
    : ModelReader.readAttributeAsTypedArray(positionAttribute);

  // Create arrays for quad vertices
  const edgePosArray = new Float32Array(totalVerts * 3);
  const edgeTypeArray = new Float32Array(totalVerts);
  const faceNormalAArray = new Float32Array(totalVerts * 3);
  const faceNormalBArray = new Float32Array(totalVerts * 3);
  const edgeOtherPosArray = new Float32Array(totalVerts * 3);
  const edgeOffsetArray = new Float32Array(totalVerts);

  const needsCumulativeDistance = defined(cumDistAttribute);
  const edgeCumDistArray = needsCumulativeDistance
    ? new Float32Array(totalVerts)
    : undefined;
  let srcCumDist;
  if (needsCumulativeDistance) {
    srcCumDist = defined(cumDistAttribute.typedArray)
      ? cumDistAttribute.typedArray
      : ModelReader.readAttributeAsTypedArray(cumDistAttribute);
  }

  const needsEdgeColorAttribute = defined(edgeColorLocation);
  const edgeColorArray = needsEdgeColorAttribute
    ? new Float32Array(totalVerts * 4)
    : undefined;
  const vertexColors = defined(vertexColorInfo)
    ? vertexColorInfo.colors
    : undefined;
  const vertexColorCount = defined(vertexColorInfo) ? vertexColorInfo.count : 0;

  function setNoColor(destVertexIndex) {
    if (!needsEdgeColorAttribute) {
      return;
    }
    const destOffset = destVertexIndex * 4;
    edgeColorArray[destOffset] = 0.0;
    edgeColorArray[destOffset + 1] = 0.0;
    edgeColorArray[destOffset + 2] = 0.0;
    edgeColorArray[destOffset + 3] = -1.0;
  }

  function setColorFromOverride(destVertexIndex, color) {
    if (!needsEdgeColorAttribute) {
      return;
    }
    const destOffset = destVertexIndex * 4;
    const r = defined(color.x) ? color.x : color[0];
    const g = defined(color.y) ? color.y : color[1];
    const b = defined(color.z) ? color.z : color[2];
    const a = defined(color.w) ? color.w : defined(color[3]) ? color[3] : 1.0;
    edgeColorArray[destOffset] = r;
    edgeColorArray[destOffset + 1] = g;
    edgeColorArray[destOffset + 2] = b;
    edgeColorArray[destOffset + 3] = a;
  }

  function assignVertexColor(destVertexIndex, srcVertexIndex) {
    if (!needsEdgeColorAttribute) {
      return;
    }
    if (srcVertexIndex >= vertexColorCount) {
      setNoColor(destVertexIndex);
      return;
    }
    const srcOffset = srcVertexIndex * 4;
    const destOffset = destVertexIndex * 4;
    edgeColorArray[destOffset] = vertexColors[srcOffset];
    edgeColorArray[destOffset + 1] = vertexColors[srcOffset + 1];
    edgeColorArray[destOffset + 2] = vertexColors[srcOffset + 2];
    edgeColorArray[destOffset + 3] = vertexColors[srcOffset + 3];
  }

  // Generate quad vertices for each edge
  for (let i = 0; i < numEdges; i++) {
    const a = edgeIndices[i * 2];
    const b = edgeIndices[i * 2 + 1];
    const rawType = edgeData[i].edgeType;
    const normalizedType = rawType / 255.0;

    // Get positions
    const ax = srcPos[a * 3];
    const ay = srcPos[a * 3 + 1];
    const az = srcPos[a * 3 + 2];
    const bx = srcPos[b * 3];
    const by = srcPos[b * 3 + 1];
    const bz = srcPos[b * 3 + 2];

    // Create 4 vertices for this edge: (A-, A+, B+, B-)
    // where +/- indicates offset perpendicular to the line
    // Store the other endpoint position for each vertex
    const baseVertexIndex = i * 4;

    // Vertex 0: position at A, other endpoint is B, offset -1
    edgePosArray[baseVertexIndex * 3] = ax;
    edgePosArray[baseVertexIndex * 3 + 1] = ay;
    edgePosArray[baseVertexIndex * 3 + 2] = az;
    edgeOtherPosArray[baseVertexIndex * 3] = bx;
    edgeOtherPosArray[baseVertexIndex * 3 + 1] = by;
    edgeOtherPosArray[baseVertexIndex * 3 + 2] = bz;
    edgeOffsetArray[baseVertexIndex] = -1.0;
    edgeTypeArray[baseVertexIndex] = normalizedType;

    // Vertex 1: position at A, other endpoint is B, offset +1
    edgePosArray[(baseVertexIndex + 1) * 3] = ax;
    edgePosArray[(baseVertexIndex + 1) * 3 + 1] = ay;
    edgePosArray[(baseVertexIndex + 1) * 3 + 2] = az;
    edgeOtherPosArray[(baseVertexIndex + 1) * 3] = bx;
    edgeOtherPosArray[(baseVertexIndex + 1) * 3 + 1] = by;
    edgeOtherPosArray[(baseVertexIndex + 1) * 3 + 2] = bz;
    edgeOffsetArray[baseVertexIndex + 1] = 1.0;
    edgeTypeArray[baseVertexIndex + 1] = normalizedType;

    // Vertex 2: position at B, other endpoint is A, offset +1
    edgePosArray[(baseVertexIndex + 2) * 3] = bx;
    edgePosArray[(baseVertexIndex + 2) * 3 + 1] = by;
    edgePosArray[(baseVertexIndex + 2) * 3 + 2] = bz;
    edgeOtherPosArray[(baseVertexIndex + 2) * 3] = ax;
    edgeOtherPosArray[(baseVertexIndex + 2) * 3 + 1] = ay;
    edgeOtherPosArray[(baseVertexIndex + 2) * 3 + 2] = az;
    edgeOffsetArray[baseVertexIndex + 2] = 1.0;
    edgeTypeArray[baseVertexIndex + 2] = normalizedType;

    // Vertex 3: position at B, other endpoint is A, offset -1
    edgePosArray[(baseVertexIndex + 3) * 3] = bx;
    edgePosArray[(baseVertexIndex + 3) * 3 + 1] = by;
    edgePosArray[(baseVertexIndex + 3) * 3 + 2] = bz;
    edgeOtherPosArray[(baseVertexIndex + 3) * 3] = ax;
    edgeOtherPosArray[(baseVertexIndex + 3) * 3 + 1] = ay;
    edgeOtherPosArray[(baseVertexIndex + 3) * 3 + 2] = az;
    edgeOffsetArray[baseVertexIndex + 3] = -1.0;
    edgeTypeArray[baseVertexIndex + 3] = normalizedType;

    // Handle edge colors
    const edgeOverrideColor = edgeData[i].color;
    if (defined(edgeOverrideColor)) {
      for (let v = 0; v < 4; v++) {
        setColorFromOverride(baseVertexIndex + v, edgeOverrideColor);
      }
    } else if (defined(vertexColors)) {
      for (let v = 0; v < 4; v++) {
        assignVertexColor(baseVertexIndex + v, a);
      }
    } else {
      for (let v = 0; v < 4; v++) {
        setNoColor(baseVertexIndex + v);
      }
    }

    if (needsCumulativeDistance) {
      const cumDistA = srcCumDist[a];
      const cumDistB = srcCumDist[b];
      edgeCumDistArray[baseVertexIndex] = cumDistA;
      edgeCumDistArray[baseVertexIndex + 1] = cumDistA;
      edgeCumDistArray[baseVertexIndex + 2] = cumDistB;
      edgeCumDistArray[baseVertexIndex + 3] = cumDistB;
    }

    // Set face normals (same for all 4 vertices)
    const faceNormalIdx = i * 6;
    const normalAX = edgeFaceNormals[faceNormalIdx];
    const normalAY = edgeFaceNormals[faceNormalIdx + 1];
    const normalAZ = edgeFaceNormals[faceNormalIdx + 2];
    const normalBX = edgeFaceNormals[faceNormalIdx + 3];
    const normalBY = edgeFaceNormals[faceNormalIdx + 4];
    const normalBZ = edgeFaceNormals[faceNormalIdx + 5];

    for (let v = 0; v < 4; v++) {
      faceNormalAArray[(baseVertexIndex + v) * 3] = normalAX;
      faceNormalAArray[(baseVertexIndex + v) * 3 + 1] = normalAY;
      faceNormalAArray[(baseVertexIndex + v) * 3 + 2] = normalAZ;
      faceNormalBArray[(baseVertexIndex + v) * 3] = normalBX;
      faceNormalBArray[(baseVertexIndex + v) * 3 + 1] = normalBY;
      faceNormalBArray[(baseVertexIndex + v) * 3 + 2] = normalBZ;
    }
  }

  // Create vertex buffers
  const edgePosBuffer = Buffer.createVertexBuffer({
    context,
    typedArray: edgePosArray,
    usage: BufferUsage.STATIC_DRAW,
  });

  const edgeTypeBuffer = Buffer.createVertexBuffer({
    context,
    typedArray: edgeTypeArray,
    usage: BufferUsage.STATIC_DRAW,
  });

  const faceNormalABuffer = Buffer.createVertexBuffer({
    context,
    typedArray: faceNormalAArray,
    usage: BufferUsage.STATIC_DRAW,
  });

  const faceNormalBBuffer = Buffer.createVertexBuffer({
    context,
    typedArray: faceNormalBArray,
    usage: BufferUsage.STATIC_DRAW,
  });

  const edgeOtherPosBuffer = Buffer.createVertexBuffer({
    context,
    typedArray: edgeOtherPosArray,
    usage: BufferUsage.STATIC_DRAW,
  });

  const edgeOffsetBuffer = Buffer.createVertexBuffer({
    context,
    typedArray: edgeOffsetArray,
    usage: BufferUsage.STATIC_DRAW,
  });

  const edgeColorBuffer = needsEdgeColorAttribute
    ? Buffer.createVertexBuffer({
        context,
        typedArray: edgeColorArray,
        usage: BufferUsage.STATIC_DRAW,
      })
    : undefined;

  const edgeCumDistBuffer = needsCumulativeDistance
    ? Buffer.createVertexBuffer({
        context,
        typedArray: edgeCumDistArray,
        usage: BufferUsage.STATIC_DRAW,
      })
    : undefined;

  // Create triangle indices for quads: (0,1,2, 0,2,3) for each quad
  const numTriangles = numEdges * 2;
  const numIndices = numTriangles * 3;
  const useU32 = totalVerts > 65534;
  const indices = useU32
    ? new Uint32Array(numIndices)
    : new Uint16Array(numIndices);

  for (let i = 0; i < numEdges; i++) {
    const baseVertex = i * 4;
    const baseIndex = i * 6;

    // Triangle 1: (v0, v1, v2)
    indices[baseIndex] = baseVertex;
    indices[baseIndex + 1] = baseVertex + 1;
    indices[baseIndex + 2] = baseVertex + 2;

    // Triangle 2: (v0, v2, v3)
    indices[baseIndex + 3] = baseVertex;
    indices[baseIndex + 4] = baseVertex + 2;
    indices[baseIndex + 5] = baseVertex + 3;
  }

  const indexBuffer = Buffer.createIndexBuffer({
    context,
    typedArray: indices,
    usage: BufferUsage.STATIC_DRAW,
    indexDatatype: useU32
      ? IndexDatatype.UNSIGNED_INT
      : IndexDatatype.UNSIGNED_SHORT,
  });

  // Create vertex array with all attributes
  const attributes = [
    {
      index: positionLocation,
      vertexBuffer: edgePosBuffer,
      componentsPerAttribute: 3,
      componentDatatype: ComponentDatatype.FLOAT,
      normalize: false,
    },
    {
      index: edgeTypeLocation,
      vertexBuffer: edgeTypeBuffer,
      componentsPerAttribute: 1,
      componentDatatype: ComponentDatatype.FLOAT,
      normalize: false,
    },
    {
      index: faceNormalALocation,
      vertexBuffer: faceNormalABuffer,
      componentsPerAttribute: 3,
      componentDatatype: ComponentDatatype.FLOAT,
      normalize: false,
    },
    {
      index: faceNormalBLocation,
      vertexBuffer: faceNormalBBuffer,
      componentsPerAttribute: 3,
      componentDatatype: ComponentDatatype.FLOAT,
      normalize: false,
    },
    {
      index: edgeOtherPosLocation,
      vertexBuffer: edgeOtherPosBuffer,
      componentsPerAttribute: 3,
      componentDatatype: ComponentDatatype.FLOAT,
      normalize: false,
    },
    {
      index: edgeOffsetLocation,
      vertexBuffer: edgeOffsetBuffer,
      componentsPerAttribute: 1,
      componentDatatype: ComponentDatatype.FLOAT,
      normalize: false,
    },
  ];

  if (needsEdgeColorAttribute) {
    attributes.push({
      index: edgeColorLocation,
      vertexBuffer: edgeColorBuffer,
      componentsPerAttribute: 4,
      componentDatatype: ComponentDatatype.FLOAT,
      normalize: false,
    });
  }

  if (needsCumulativeDistance) {
    attributes.push({
      index: edgeCumDistLocation,
      vertexBuffer: edgeCumDistBuffer,
      componentsPerAttribute: 1,
      componentDatatype: ComponentDatatype.FLOAT,
      normalize: false,
    });
  }

  const primitive = renderResources.runtimePrimitive.primitive;
  if (defined(primitive.featureIds) && primitive.featureIds.length > 0) {
    const firstFeatureIdSet = primitive.featureIds[0];

    if (defined(firstFeatureIdSet.setIndex)) {
      const featureIdAttribute = primitive.attributes.find(
        (attr) =>
          attr.semantic === VertexAttributeSemantic.FEATURE_ID &&
          attr.setIndex === firstFeatureIdSet.setIndex,
      );

      if (defined(featureIdAttribute)) {
        const featureIds = defined(featureIdAttribute.typedArray)
          ? featureIdAttribute.typedArray
          : ModelReader.readAttributeAsTypedArray(featureIdAttribute);

        const edgeFeatureIds = new Float32Array(totalVerts);
        for (let i = 0; i < numEdges; i++) {
          const a = edgeIndices[i * 2];
          const featureId = a < featureIds.length ? featureIds[a] : 0;
          // Set same feature ID for all 4 vertices of the quad
          for (let v = 0; v < 4; v++) {
            edgeFeatureIds[i * 4 + v] = featureId;
          }
        }

        const edgeFeatureIdBuffer = Buffer.createVertexBuffer({
          context,
          typedArray: edgeFeatureIds,
          usage: BufferUsage.STATIC_DRAW,
        });

        attributes.push({
          index: edgeFeatureIdLocation,
          vertexBuffer: edgeFeatureIdBuffer,
          componentsPerAttribute: 1,
          componentDatatype: ComponentDatatype.FLOAT,
          normalize: false,
        });
      }
    }
  }

  const vertexArray = new VertexArray({
    context,
    attributes,
    indexBuffer,
  });

  return {
    vertexArray,
    indexCount: numIndices,
    hasEdgeFeatureIds:
      defined(primitive.featureIds) && primitive.featureIds.length > 0,
  };
}

export default EdgeVisibilityPipelineStage;
