// @ts-check

import { Color, defined } from "@cesium/core";
import createColorRamp from "../Core/createColorRamp.js";
import CustomShader from "./Model/CustomShader.js";
import MetadataComponentType from "./MetadataComponentType.js";
import MetadataType from "./MetadataType.js";
import TextureUniform from "./Model/TextureUniform.js";
import UniformType from "./Model/UniformType.js";

/** @import VoxelProvider from "./VoxelProvider.js"; */

/**
 * 根据 VoxelProvider 提供的元数据属性信息，为体素primitive 构建自定义着色器。
 * 支持标量 float 属性，或包含 float 分量的 vec4 属性。
 *
 * 用于构建具有意义的着色器，需满足特定数值范围条件。
 *
 * @function
 *
 * @param {VoxelProvider} provider 用于该 primitive 的 VoxelProvider。
 * @returns {CustomShader|undefined} A 该 primitive 的自定义着色器，若无法构建则设为 undefined。
 *
 * @private
 */
function buildVoxelCustomShader(provider) {
  const { names, types, componentTypes, minimumValues, maximumValues } =
    provider;

  // Loop over metadata properties and build a shader for the first property
  // that has a supported type and component type.
  for (let i = 0; i < names.length; i++) {
    if (!rangeIsValid(minimumValues?.[i], maximumValues?.[i])) {
      continue;
    }
    const shader = constructMetadataShader(
      names[i],
      types[i],
      componentTypes[i],
      minimumValues[i],
      maximumValues[i],
    );
    if (defined(shader)) {
      return shader;
    }
  }
}

/**
 * 检查特定数值范围是否适用于构建有意义的着色器。
 *
 * @param {number[]} minimumValue 该范围的最小值。
 * @param {number[]} maximumValue 该范围的最大值。
 * @returns {boolean} True 若该范围有效，则返回 false，否则返回 true。
 *
 * @private
 */
function rangeIsValid(minimumValue, maximumValue) {
  if (!Array.isArray(minimumValue) || !Array.isArray(maximumValue)) {
    return false;
  }
  const minimumComponent = Math.min(...minimumValue);
  const maximumComponent = Math.max(...maximumValue);
  return minimumComponent < maximumComponent;
}

/**
 * 为单个元数据属性构建元数据着色器。
 *
 * @param {string} name 元数据属性的名称。
 * @param {MetadataType} type 元数据属性的类型。
 * @param {MetadataComponentType} componentType 元数据属性的分量类型。
 * @param {number[]} minimumValue 元数据属性的最小值。
 * @param {number[]} maximumValue 元数据属性的最大值。
 * @returns {CustomShader|undefined} A 该元数据属性的自定义着色器，若无法构建则设为 undefined。
 *
 * @private
 */
function constructMetadataShader(
  name,
  type,
  componentType,
  minimumValue,
  maximumValue,
) {
  if (
    type === MetadataType.VEC4 &&
    componentType === MetadataComponentType.FLOAT32
  ) {
    return buildColorShader(name, minimumValue, maximumValue);
  } else if (
    type === MetadataType.SCALAR &&
    componentType === MetadataComponentType.FLOAT32
  ) {
    return buildColorMapShader(name, minimumValue, maximumValue);
  }
}

/**
 * 为类型为 VEC4 且分量类型为 FLOAT32 的元数据属性构建颜色着色器。
 *
 * @param {string} name 元数据属性的名称。
 * @param {number[]} minimumValue 元数据属性的最小值。
 * @param {number[]} maximumValue 元数据属性的最大值。
 * @returns {CustomShader|undefined} A 该元数据属性的自定义着色器，若无法构建则设为 undefined。
 *
 * @private
 */
function buildColorShader(name, minimumValue, maximumValue) {
  // Check if the values are in a range that would be meaningful to interpret as colors.
  const minComponent = Math.min(...minimumValue);
  const maxComponent = Math.max(...maximumValue);
  if (minComponent < 0 || maxComponent > 1) {
    // The data is out of the range expected for colors, so a color shader will be meaningless.
    return;
  }

  return new CustomShader({
    fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    material.diffuse = fsInput.metadata.${name}.rgb;
    material.alpha = fsInput.metadata.${name}.a;
}`,
  });
}

/**
 * 为类型为 SCALAR 且分量类型为 FLOAT32 的元数据属性构建颜色映射着色器。
 *
 * @param {string} name 元数据属性的名称。
 * @param {number[]} minimumValue 元数据属性的最小值。
 * @param {number[]} maximumValue 元数据属性的最大值。
 * @returns {CustomShader} A 该元数据属性的自定义着色器。
 *
 * @private
 */
function buildColorMapShader(name, minimumValue, maximumValue) {
  // Perceptually uniform color map similar to the "viridis" color map used in scientific visualization.
  const colorMapWidth = 128;
  const colorMap = createColorRamp(
    [
      new Color(0.267, 0.004, 0.329),
      new Color(0.282, 0.14, 0.457),
      new Color(0.254, 0.265, 0.53),
      new Color(0.207, 0.372, 0.553),
      new Color(0.164, 0.471, 0.558),
      new Color(0.128, 0.567, 0.551),
      new Color(0.135, 0.659, 0.518),
      new Color(0.194, 0.741, 0.443),
      new Color(0.282, 0.819, 0.369),
      new Color(0.396, 0.898, 0.301),
      new Color(0.538, 0.965, 0.236),
      new Color(0.741, 0.998, 0.149),
      new Color(0.993, 1.0, 0.144),
    ],
    colorMapWidth,
  );

  const textureUniform = new TextureUniform({
    typedArray: colorMap,
    width: colorMapWidth,
    height: 1,
  });

  return new CustomShader({
    uniforms: {
      u_colorMap: {
        type: UniformType.SAMPLER_2D,
        value: textureUniform,
      },
      // The starting values are also available in the shader from the metadata statistics.
      // But by using uniforms, we enable later dynamic changes to the range.
      u_minimumValue: {
        type: UniformType.FLOAT,
        value: minimumValue[0],
      },
      u_maximumValue: {
        type: UniformType.FLOAT,
        value: maximumValue[0],
      },
    },
    fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
  {
      float value = fsInput.metadata.${name};
      vec3 voxelNormal = fsInput.attributes.normalEC;
      float diffuse = max(0.0, dot(voxelNormal, czm_lightDirectionEC));
      float lighting = 0.5 + 0.5 * diffuse;

      if (value >= u_minimumValue && value <= u_maximumValue) {
        float lerp = (value - u_minimumValue) / (u_maximumValue - u_minimumValue);
        material.diffuse = texture(u_colorMap, vec2(lerp, 0.5)).rgb * lighting;
        material.alpha = 1.0;
      }
  }`,
  });
}

export default buildVoxelCustomShader;
