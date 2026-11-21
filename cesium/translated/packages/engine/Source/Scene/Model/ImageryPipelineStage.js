import {
  AttributeType,
  Cartesian4,
  Check,
  Rectangle,
  defined,
  oneTimeWarning,
} from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import ImageryLayer from "../ImageryLayer.js";
import ImageryFlags from "./ImageryFlags.js";
import ModelPrimitiveImagery from "./ModelPrimitiveImagery.js";
import ImageryInput from "./ImageryInput.js";
import ImageryState from "../ImageryState.js";

/**
 * 一个编译时调试标志，用于绘制影像图块边界
 * （类似于 GlobeFS.glsl 中的 "SHOW_TILE_BOUNDARIES")
 * @private
 */
const debugDrawImageryBoundaries = false;

// Scratch variable for _computeTextureTranslationAndScale
const nativeBoundingRectangleScratch = new Rectangle();

// Scratch variable for _computeTextureTranslationAndScale
const nativeImageryRectangleScratch = new Rectangle();

/**
 * 一个管道阶段，用于修改模型着色器以考虑
 * 覆盖在模型基元上的影像纹理，当它
 * 是 <code>Cesium3DTileset</code> 的 <code>Model3DTileContent</code> 的一部分时
 * 该 <code>Cesium3DTileset</code> 具有 <code>imageryLayers</code>。
 *
 * 这里所做的大部分内容试图模仿
 * https://github.com/CesiumGS/cesium/blob/6cc004aaff586bb59f07f199216ae511014cf5a9/packages/engine/Source/Shaders/GlobeFS.glsl#L166 中的相关部分，使用更现代的 ShaderBuilder 结构。
 * 处理一个基元。
 *
 * @namespace ImageryPipelineStage
 *
 * @private
 */
class ImageryPipelineStage {
  /**
   * 这将更新给定基元的渲染资源，
   *
   * 根据被该基元覆盖的影像情况进行更新。
   * 这将从给定基元获取 <code>ModelPrimitiveImagery</code>，并使用它来计算实际的
   *
   * <code>ImageryInput</code> 对象，这些对象描述了需要传递给着色器以在基元上
   * 覆盖影像的信息。
   * 
   * 
   * 在基元上。
   *
   * 在计算 <code>ImageryInput</code> 之后，它将
   * 在渲染资源中添加用于影像的纹理坐标属性，并增强
   * <code>primitiveRenderResources.shaderBuilder</code> 中的信息。
   * 基元的渲染资源
   * 要被渲染的基元
   *
   * @param {PrimitiveRenderResources} primitiveRenderResources 帧状态。
   * @param {ModelComponents.Primitive} primitive 为每个影像纹理在渲染资源中添加一个属性
   * @param {FrameState} frameState 在给定模型基元影像中计算出的坐标
   */
  static process(primitiveRenderResources, primitive, frameState) {
    const model = primitiveRenderResources.model;
    const modelPrimitiveImagery = primitive.modelPrimitiveImagery;

    // When the creation of the model primitive imagery is happening
    // asynchronously, then the primitive may not yet contain it.
    // Return early in this case
    if (!defined(modelPrimitiveImagery)) {
      return;
    }

    // Similarly, when the model primitive imagery is not yet ready,
    // then nothing can be done here
    if (!modelPrimitiveImagery.ready) {
      return;
    }

    // Compute the arrays containing ALL projections and the array
    // containing the UNIQUE projections from the imagery layers,
    // to establish the mapping between the imagery index and the
    // imagery texture coordinate attribute set index.
    // (This should be implemented and/or documented better...)
    const imageryLayers = model.imageryLayers;
    const allProjections =
      ModelPrimitiveImagery._extractProjections(imageryLayers);
    const uniqueProjections = [...new Set(allProjections)];
    const imageryTexCoordAttributeSetIndices =
      ImageryPipelineStage._computeIndexMapping(
        allProjections,
        uniqueProjections,
      );

    // Create the `ImageryInput` objects that describe
    // - the texture
    // - texture coordinate rectangle
    // - translation and scale
    // - index of the imagery texture coordinate attribute
    // to be passed to the actual imagery pipeline stage execution
    const imageryInputs = ImageryPipelineStage._createImageryInputs(
      imageryLayers,
      modelPrimitiveImagery,
      imageryTexCoordAttributeSetIndices,
    );

    // This can happen when none of the imagery textures could
    // be obtained, because they had all been INVALID/FAILED,
    // or when none of the imagery layers is actually visible
    // according to `show==true`
    // Bail out in this case
    if (imageryInputs.length === 0) {
      return;
    }

    // TODO_DRAPING This will have to be handled with upsampling.
    // For now, just truncate the textures to not exceed the
    // number of texture units
    if (imageryInputs.length > 10) {
      oneTimeWarning(
        "imagery-texture-units",
        `Warning: Draped imagery requires ${imageryInputs.length} texture units, truncating`,
      );
      imageryInputs.length = 10;
    }

    // Add the imagery texture coordinate attributes to the render
    // resources
    ImageryPipelineStage._addImageryTexCoordAttributesToRenderResources(
      modelPrimitiveImagery,
      primitiveRenderResources,
    );

    const imageryLayersArray = [];
    for (let i = 0; i < imageryLayers.length; i++) {
      imageryLayersArray.push(imageryLayers.get(i));
    }

    ImageryPipelineStage._processImageryInputs(
      imageryLayersArray,
      primitiveRenderResources,
      imageryInputs,
      uniqueProjections.length,
    );
  }

  /**
   * （每个投影一个）
   * 模型基元影像
   * 渲染资源
   *
   * @param {ModelPrimitiveImagery} modelPrimitiveImagery 将给定属性添加到渲染资源中
   * @param {PrimitiveRenderResources} primitiveRenderResources 该属性
   */
  static _addImageryTexCoordAttributesToRenderResources(
    modelPrimitiveImagery,
    primitiveRenderResources,
  ) {
    const imageryTexCoordAttributes =
      modelPrimitiveImagery.imageryTexCoordAttributesPerProjection();
    for (const imageryTexCoordAttribute of imageryTexCoordAttributes) {
      ImageryPipelineStage._addImageryTexCoordAttributeToRenderResources(
        imageryTexCoordAttribute,
        primitiveRenderResources,
      );
    }
  }

  /**
   * 将给定属性添加到渲染资源中
   *
   * @param {ModelComponents.Attribute} imageryTexCoordAttribute 该属性
   * @param {PrimitiveRenderResources} primitiveRenderResources 渲染资源
   */
  static _addImageryTexCoordAttributeToRenderResources(
    imageryTexCoordAttribute,
    primitiveRenderResources,
  ) {
    const componentsPerAttribute = AttributeType.getNumberOfComponents(
      imageryTexCoordAttribute.type,
    );
    // Convert the given object into another object that essentially
    // contains the same information, but not exactly, and with most
    // properties having slightly different names. Shrug.
    const renderResourcesAttribute = {
      index: primitiveRenderResources.attributeIndex++,
      value: defined(imageryTexCoordAttribute.buffer)
        ? undefined
        : imageryTexCoordAttribute.constant,
      vertexBuffer: imageryTexCoordAttribute.buffer,
      count: imageryTexCoordAttribute.count,
      componentsPerAttribute: componentsPerAttribute,
      componentDatatype: imageryTexCoordAttribute.componentDatatype,
      offsetInBytes: imageryTexCoordAttribute.byteOffset,
      strideInBytes: imageryTexCoordAttribute.byteStride,
      normalize: imageryTexCoordAttribute.normalized,
    };
    primitiveRenderResources.attributes.push(renderResourcesAttribute);
  }

  /**
   * 处理在 <code>process</code> 中创建的 <code>ImageryInput</code> 对象。
   * 这将构建包含属性、统一变量和
   *
   * 根据给定影像输入所需的“采样和混合”函数
   * 的着色器。
   * 影像图层
   *
   * @param {ImageryLayer[]} imageryLayersArray 基元渲染资源
   * @param {PrimitiveRenderResources} primitiveRenderResources 影像输入
   * @param {ImageryInput[]} imageryInputs 纹理坐标属性数量
   * @param {number} numImageryTexCoordAttributes 为影像创建的属性数量（影像图层中发现的每个不同投影一个）
   * 影像纹理的属性和变量定义
   * projection that was found in the imagery layers)
   */
  static _processImageryInputs(
    imageryLayersArray,
    renderResources,
    imageryInputs,
    numImageryTexCoordAttributes,
  ) {
    const shaderBuilder = renderResources.shaderBuilder;

    const imageryFlags =
      ImageryPipelineStage._computeImageryFlags(imageryLayersArray);
    const numTextures = imageryInputs.length;

    // Set the global defines indicating the presence and number of
    // imagery textures.
    shaderBuilder.addDefine(`HAS_IMAGERY`);
    shaderBuilder.addDefine(`IMAGERY_TEXTURE_UNITS ${numTextures}`);

    ImageryPipelineStage._addAttributes(
      shaderBuilder,
      numImageryTexCoordAttributes,
    );

    ImageryPipelineStage._defineUniforms(shaderBuilder, imageryFlags);
    ImageryPipelineStage._buildSampleAndBlendFunction(
      shaderBuilder,
      imageryFlags,
    );

    ImageryPipelineStage._createMainImageryShader(
      shaderBuilder,
      imageryInputs,
      imageryFlags,
    );

    const uniformMap = renderResources.uniformMap;
    const uniforms = ImageryPipelineStage._createImageryUniforms(imageryInputs);
    ImageryPipelineStage._setImageryUniforms(uniformMap, uniforms);
  }

  /**
   * Add the attribute- and varying definitions for the imagery texture
   * 指向给定着色器的坐标。
   *
   * 包括 <code>initializeImageryAttributes</code> 的定义。
   * 将属性值分配给顶点着色器中的变量的函数。
   *
   * @param {ShaderBuilder} shaderBuilder 着色器构建器
   * @param {number} numTexCoords 影像纹理坐标集的数量
   */
  static _addAttributes(shaderBuilder, numTexCoords) {
    for (let i = 0; i < numTexCoords; i++) {
      shaderBuilder.addAttribute("vec2", `a_imagery_texCoord_${i}`);
      shaderBuilder.addVarying("vec2", `v_imagery_texCoord_${i}`);
    }

    const functionId = "initializeImageryAttributes";
    const signature = `void ${functionId}()`;
    shaderBuilder.addFunction(functionId, signature, ShaderDestination.VERTEX);

    for (let i = 0; i < numTexCoords; i++) {
      shaderBuilder.addFunctionLines(functionId, [
        `v_imagery_texCoord_${i} = a_imagery_texCoord_${i};`,
      ]);
    }
  }

  /**
   * 返回 `ImageryFlags`，表示对于给定影像图层所需的特性。
   * 给定影像图层必需的特性。
   *
   * 生成的标志将指示是否有任何给定的
   * 影像图层对象没有具有 `ImageryLayer.DEFAULT_...` 定义的相应属性的默认值。
   * 影像图层
   *
   * @param {ImageryLayer[]} imageryLayers 影像标志
   * @returns {ImageryFlags} The 向着色器添加影像所需的统一变量。
   */
  static _computeImageryFlags(imageryLayers) {
    const imageryFlags = new ImageryFlags();
    for (let i = 0; i < imageryLayers.length; i++) {
      const imageryLayer = imageryLayers[i];

      // These are short-circuiting to `number` instead
      // of `boolean` here. With "ecmaVersion: 2021", we
      // could use "||=" here. Otherwise, there is no
      // nice shortcut for this.
      imageryFlags.alpha |= imageryLayer.alpha !== 1.0;
      imageryFlags.brightness |=
        imageryLayer.brightness !== ImageryLayer.DEFAULT_BRIGHTNESS;
      imageryFlags.contrast |=
        imageryLayer.contrast !== ImageryLayer.DEFAULT_CONTRAST;
      imageryFlags.hue |= imageryLayer.hue !== ImageryLayer.DEFAULT_HUE;
      imageryFlags.saturation |=
        imageryLayer.saturation !== ImageryLayer.DEFAULT_SATURATION;
      imageryFlags.gamma |= imageryLayer.gamma !== ImageryLayer.DEFAULT_GAMMA;
      const hasColorToAlpha =
        defined(imageryLayer.colorToAlpha) &&
        imageryLayer.colorToAlphaThreshold > 0.0;
      imageryFlags.colorToAlpha |= hasColorToAlpha;
    }
    return imageryFlags;
  }

  /**
   * 将所需的统一变量添加到着色器中，以使用给定的着色器构建器。
   *
   * 这将使用给定的着色器构建器将始终必需的影像统一变量添加到
   * 着色器中（例如 `sampler2D u_imageryTextures[...]`）。
   * 所有数组的数组大小将为 `IMAGERY_TEXTURE_UNITS`，因此必须作为带有正值的 `define` 添加。
   *
   * 如果给定的影像标志为 `true`，它将添加
   * 可选的统一变量，如 `u_imageryTextureAlpha`。
   *
   * 命名模式将为 `u_imageryTexture<name>`，除了
   * `gamma`：为了安全起见，这个除法将被改为
   *
   * `oneOverGamma`。
   * 着色器构建器
   * 影像标志
   *
   * @param {ShaderBuilder} shaderBuilder 为 `sampleAndBlend` 函数创建函数签名，
   * @param {ImageryFlags} imageryFlags 基于影像所需的特性。
   */
  static _defineUniforms(shaderBuilder, imageryFlags) {
    shaderBuilder.addUniform(
      "sampler2D",
      "u_imageryTextures[IMAGERY_TEXTURE_UNITS]",
      ShaderDestination.FRAGMENT,
    );
    shaderBuilder.addUniform(
      "vec4",
      "u_imageryTextureCoordinateRectangle[IMAGERY_TEXTURE_UNITS]",
      ShaderDestination.FRAGMENT,
    );
    shaderBuilder.addUniform(
      "vec4",
      "u_imageryTextureTranslationAndScale[IMAGERY_TEXTURE_UNITS]",
      ShaderDestination.FRAGMENT,
    );

    if (imageryFlags.alpha) {
      shaderBuilder.addUniform(
        "float",
        "u_imageryTextureAlpha[IMAGERY_TEXTURE_UNITS]",
        ShaderDestination.FRAGMENT,
      );
    }
    if (imageryFlags.brightness) {
      shaderBuilder.addUniform(
        "float",
        "u_imageryTextureBrightness[IMAGERY_TEXTURE_UNITS]",
        ShaderDestination.FRAGMENT,
      );
    }
    if (imageryFlags.contrast) {
      shaderBuilder.addUniform(
        "float",
        "u_imageryTextureContrast[IMAGERY_TEXTURE_UNITS]",
        ShaderDestination.FRAGMENT,
      );
    }
    if (imageryFlags.hue) {
      shaderBuilder.addUniform(
        "float",
        "u_imageryTextureHue[IMAGERY_TEXTURE_UNITS]",
        ShaderDestination.FRAGMENT,
      );
    }
    if (imageryFlags.saturation) {
      shaderBuilder.addUniform(
        "float",
        "u_imageryTextureSaturation[IMAGERY_TEXTURE_UNITS]",
        ShaderDestination.FRAGMENT,
      );
    }
    if (imageryFlags.gamma) {
      shaderBuilder.addUniform(
        "float",
        "u_imageryTextureOneOverGamma[IMAGERY_TEXTURE_UNITS]",
        ShaderDestination.FRAGMENT,
      );
    }
    if (imageryFlags.colorToAlpha) {
      shaderBuilder.addUniform(
        "vec4",
        "u_imageryTextureColorToAlpha[IMAGERY_TEXTURE_UNITS]",
        ShaderDestination.FRAGMENT,
      );
    }
  }

  /**
   * 有关详细信息，请参阅 `buildSampleAndBlendFunction`。
   * 影像标志
   *
   * 字符串
   *
   * @param {ImageryFlags} imageryFlags 构建将在每个影像时调用的 `sampleAndBlend` 函数，
   * @returns {string} The 将前一个像素颜色与相应的影像输入结合。
   */
  static _createSampleAndBlendFunctionSignature(imageryFlags) {
    const functionId = "sampleAndBlend";
    const parameters = [];
    parameters.push(`vec4 previousColor`);
    parameters.push(`sampler2D textureToSample`);
    parameters.push(`vec2 textureCoordinates`);
    parameters.push(`vec4 textureCoordinateRectangle`);
    parameters.push(`vec4 textureCoordinateTranslationAndScale`);
    if (imageryFlags.alpha) {
      parameters.push(`float textureAlpha`);
    }
    if (imageryFlags.brightness) {
      parameters.push(`float textureBrightness`);
    }
    if (imageryFlags.contrast) {
      parameters.push(`float textureContrast`);
    }
    if (imageryFlags.hue) {
      parameters.push(`float textureHue`);
    }
    if (imageryFlags.saturation) {
      parameters.push(`float textureSaturation`);
    }
    if (imageryFlags.gamma) {
      parameters.push(`float textureOneOverGamma`);
    }
    if (imageryFlags.colorToAlpha) {
      parameters.push(`vec4 colorToAlpha`);
    }
    const parametersString = parameters.join(", ");

    const signature = `vec4 ${functionId}(${parametersString})`;
    return signature;
  }

  /**
   * 此处构建的函数类似于在
   * https://github.com/CesiumGS/cesium/blob/6cc004aaff586bb59f07f199216ae511014cf5a9/packages/engine/Source/Shaders/GlobeFS.glsl#L166 中最初定义的函数。
   *
   * 然而，此处构建的函数签名将
   * 反映影像所需的实际特性。
   *
   * 例如，`float textureAlpha` 参数仅在 `imageryFlags.alpha` 为 `true` 时存在。
   * 影像标志
   * 为指定的影像调用 `sampleAndBlend` 函数的参数。
   * 有关详细信息，请参阅 `buildSampleAndBlendFunction`。
   *
   * @param {ShaderBuilder} shaderBuilder 影像标志
   * @param {ImageryFlags} imageryFlags 纹理坐标属性的索引
   */
  static _buildSampleAndBlendFunction(shaderBuilder, imageryFlags) {
    const functionId = "sampleAndBlend";
    const signature =
      ImageryPipelineStage._createSampleAndBlendFunctionSignature(imageryFlags);
    shaderBuilder.addFunction(
      functionId,
      signature,
      ShaderDestination.FRAGMENT,
    );

    shaderBuilder.addFunctionLines(functionId, [`float effectiveAlpha = 1.0;`]);
    if (imageryFlags.alpha) {
      shaderBuilder.addFunctionLines(functionId, [
        `effectiveAlpha = textureAlpha;`,
      ]);
    }
    shaderBuilder.addFunctionLines(functionId, [
      // This is the part that is documented as "This crazy step stuff"
      // in GlobeFS.glsl. Using the if-approach here...
      `if (textureCoordinates.x < textureCoordinateRectangle.x) effectiveAlpha = 0.0;`,
      `if (textureCoordinates.x > textureCoordinateRectangle.z) effectiveAlpha = 0.0;`,
      `if (textureCoordinates.y < textureCoordinateRectangle.y) effectiveAlpha = 0.0;`,
      `if (textureCoordinates.y > textureCoordinateRectangle.w) effectiveAlpha = 0.0;`,

      `vec2 translation = textureCoordinateTranslationAndScale.xy;`,
      `vec2 scale = textureCoordinateTranslationAndScale.zw;`,
      `vec2 effectiveTextureCoordinates = textureCoordinates * scale + translation;`,
      `vec4 value = texture(textureToSample, effectiveTextureCoordinates);`,
      `value = czm_srgbToLinear(value);`,

      `vec3 color = value.rgb;`,
      `float alpha = value.a;`,
    ]);

    if (imageryFlags.colorToAlpha) {
      shaderBuilder.addFunctionLines(functionId, [
        `vec3 colorDiff = abs(color.rgb - colorToAlpha.rgb);`,
        `colorDiff.r = czm_maximumComponent(colorDiff);`,
        `alpha = czm_branchFreeTernary(colorDiff.r < colorToAlpha.a, 0.0, alpha);`,
      ]);
    }

    if (imageryFlags.gamma) {
      shaderBuilder.addFunctionLines(functionId, [
        `color = pow(color, vec3(textureOneOverGamma));`,
      ]);
    } else {
      shaderBuilder.addFunctionLines(functionId, [
        `vec4 tempColor = czm_gammaCorrect(vec4(color, alpha));`,
        `color = tempColor.rgb;`,
        `alpha = tempColor.a;`,
      ]);
    }

    if (imageryFlags.brightness) {
      shaderBuilder.addFunctionLines(functionId, [
        `color = mix(vec3(0.0), color, textureBrightness);`,
      ]);
    }

    if (imageryFlags.contrast) {
      shaderBuilder.addFunctionLines(functionId, [
        `color = mix(vec3(0.5), color, textureContrast);`,
      ]);
    }
    if (imageryFlags.hue) {
      shaderBuilder.addFunctionLines(functionId, [
        `color = czm_hue(color, textureHue);`,
      ]);
    }

    if (imageryFlags.saturation) {
      shaderBuilder.addFunctionLines(functionId, [
        `color = czm_saturation(color, textureSaturation);`,
      ]);
    }

    shaderBuilder.addFunctionLines(functionId, [
      `float sourceAlpha = alpha * effectiveAlpha;`,
      `float outAlpha = mix(previousColor.a, 1.0, sourceAlpha);`,
      `outAlpha += sign(outAlpha) - 1.0;`,
      `vec3 outColor = mix(previousColor.rgb * previousColor.a, color, sourceAlpha) / outAlpha;`,
      // See comments in https://github.com/CesiumGS/cesium/blob/6cc004aaff586bb59f07f199216ae511014cf5a9/packages/engine/Source/Shaders/GlobeFS.glsl#L166
      `vec4 result = vec4(outColor, max(outAlpha, 0.0));`,
    ]);

    // Debug mode: Draw boundaries of imagery in red
    if (debugDrawImageryBoundaries) {
      shaderBuilder.addFunctionLines(functionId, [
        `if (abs(textureCoordinates.x - textureCoordinateRectangle.x) < (1.0/256.0) || `,
        `    abs(textureCoordinates.x - textureCoordinateRectangle.z) < (1.0/256.0) || `,
        `    abs(textureCoordinates.y - textureCoordinateRectangle.y) < (1.0/256.0) || `,
        `    abs(textureCoordinates.y - textureCoordinateRectangle.w) < (1.0/256.0))`,
        `{`,
        `    result = vec4(1.0, 0.0, 0.0, effectiveAlpha);`,
        `}`,
      ]);
    }

    shaderBuilder.addFunctionLines(functionId, [`return result;`]);
  }

  /**
   * 影像索引
   * specified imagery.
   *
   * For details, see `buildSampleAndBlendFunction`
   *
   * @param {ImageryFlags} imageryFlags The imagery flags
   * @param {number} imageryTexCoordAttributeSetIndex The index for the texture coordinate attribute
   * @param {number} i The imagery index
   * @returns {string} The 字符串
   */
  static _createSampleAndBlendCallArguments(
    imageryFlags,
    imageryTexCoordAttributeSetIndex,
    i,
  ) {
    const textureCoordinates = `v_imagery_texCoord_${imageryTexCoordAttributeSetIndex}`;

    const args = [];
    args.push(`blendedBaseColor`);
    args.push(`u_imageryTextures[${i}]`);
    args.push(`${textureCoordinates}`);
    args.push(`u_imageryTextureCoordinateRectangle[${i}]`);
    args.push(`u_imageryTextureTranslationAndScale[${i}]`);
    if (imageryFlags.alpha) {
      args.push(`u_imageryTextureAlpha[${i}]`);
    }
    if (imageryFlags.brightness) {
      args.push(`u_imageryTextureBrightness[${i}]`);
    }
    if (imageryFlags.contrast) {
      args.push(`u_imageryTextureContrast[${i}]`);
    }
    if (imageryFlags.hue) {
      args.push(`u_imageryTextureHue[${i}]`);
    }
    if (imageryFlags.saturation) {
      args.push(`u_imageryTextureSaturation[${i}]`);
    }
    if (imageryFlags.gamma) {
      args.push(`u_imageryTextureOneOverGamma[${i}]`);
    }
    if (imageryFlags.colorToAlpha) {
      args.push(`u_imageryTextureColorToAlpha[${i}]`);
    }

    const argsString = args.join(", ");
    return argsString;
  }

  /**
   * 创建影像着色器的主体部分。
   *
   * 它添加了 `blendBaseColorWithImagery` 函数，该函数在 `HAS_IMAGERY` 标志被设置后，
   * 在 `MaterialStageFS.glsl` 中被调用。
   * 此标志在着色器中被设置。
   *
   * `blendBaseColorWithImagery` 函数将遍历输入中的所有影像图层，并调用 `sampleAndBlend` 函数，
   * 以将影像输入融入最终像素中。
   * 着色器构建器
   *
   * @param {ShaderBuilder} shaderBuilder 影像输入
   * @param {ImageryInput[]} imageryInputs 影像标志
   * @param {ImageryFlags} imageryFlags 影像统一变量
   */
  static _createMainImageryShader(shaderBuilder, imageryInputs, imageryFlags) {
    const functionId = "blendBaseColorWithImagery";
    shaderBuilder.addFunction(
      functionId,
      `vec4 blendBaseColorWithImagery(vec4 baseColorWithAlpha)`,
      ShaderDestination.FRAGMENT,
    );
    shaderBuilder.addFunctionLines(functionId, [
      `vec4 blendedBaseColor = baseColorWithAlpha;`,
    ]);

    // Roughly what was done in https://github.com/CesiumGS/cesium/blob/6cc004aaff586bb59f07f199216ae511014cf5a9/packages/engine/Source/Scene/GlobeSurfaceShaderSet.js#L394
    for (let i = 0; i < imageryInputs.length; i++) {
      const imageryInput = imageryInputs[i];
      const imageryTexCoordAttributeSetIndex =
        imageryInput.imageryTexCoordAttributeSetIndex;
      const argsString =
        ImageryPipelineStage._createSampleAndBlendCallArguments(
          imageryFlags,
          imageryTexCoordAttributeSetIndex,
          i,
        );
      shaderBuilder.addFunctionLines(functionId, [
        `blendedBaseColor = sampleAndBlend(${argsString});`,
      ]);
    }

    shaderBuilder.addFunctionLines(functionId, [`return blendedBaseColor;`]);
  }

  /**
   * 创建一个包含给定影像输入的统一变量值的对象。
   *
   * 结果将是一个结构，其中包含由 `defineUniforms` 创建的定义的均匀变量值。
   * （它还将包含仍具有默认值且可能最终不需要的变量）
   * 影像输入
   * 统一变量
   *
   * @param {ImageryInput[]} imageryInputs 用函数填充给定的统一映射，这些函数对应给定统一对象中的所有属性。
   * @returns {object} The 统一变量名称将以 `u_<propertyName>` 的形式创建，
   */
  static _createImageryUniforms(imageryInputs) {
    const length = imageryInputs.length;
    const uniforms = {};
    uniforms.imageryTextures = Array(length);
    uniforms.imageryTextureCoordinateRectangle = Array(length);
    uniforms.imageryTextureTranslationAndScale = Array(length);
    uniforms.imageryTextureAlpha = Array(length);
    uniforms.imageryTextureBrightness = Array(length);
    uniforms.imageryTextureContrast = Array(length);
    uniforms.imageryTextureHue = Array(length);
    uniforms.imageryTextureSaturation = Array(length);
    uniforms.imageryTextureOneOverGamma = Array(length);
    uniforms.imageryTextureColorToAlpha = Array(length);

    for (let i = 0; i < length; i++) {
      const imageryInput = imageryInputs[i];

      const imageryLayer = imageryInput.imageryLayer;
      const texture = imageryInput.texture;
      const textureCoordinateRectangle =
        imageryInput.textureCoordinateRectangle;
      const textureTranslationAndScale =
        imageryInput.textureTranslationAndScale;

      uniforms.imageryTextures[i] = texture;
      uniforms.imageryTextureTranslationAndScale[i] =
        textureTranslationAndScale;
      uniforms.imageryTextureCoordinateRectangle[i] =
        textureCoordinateRectangle;

      uniforms.imageryTextureAlpha[i] = imageryLayer.alpha;
      uniforms.imageryTextureBrightness[i] = imageryLayer.brightness;
      uniforms.imageryTextureContrast[i] = imageryLayer.contrast;
      uniforms.imageryTextureHue[i] = imageryLayer.hue;
      uniforms.imageryTextureSaturation[i] = imageryLayer.saturation;
      uniforms.imageryTextureOneOverGamma[i] = 1.0 / imageryLayer.gamma;

      let colorToAlpha = uniforms.imageryTextureColorToAlpha[i];
      if (!defined(colorToAlpha)) {
        colorToAlpha = new Cartesian4();
        uniforms.imageryTextureColorToAlpha[i] = colorToAlpha;
      }
      const hasColorToAlpha =
        defined(imageryLayer.colorToAlpha) &&
        imageryLayer.colorToAlphaThreshold > 0.0;
      if (hasColorToAlpha) {
        const color = imageryLayer.colorToAlpha;
        colorToAlpha.x = color.red;
        colorToAlpha.y = color.green;
        colorToAlpha.z = color.blue;
        colorToAlpha.w = imageryLayer.colorToAlphaThreshold;
      } else {
        colorToAlpha.w = -1.0;
      }
    }
    return uniforms;
  }

  /**
   * 它们的值只是一个返回相应属性值的函数。
   * 统一映射
   *
   * 统一变量
   * 创建必须被传递给影像管道阶段的 `<code>ImageryInput</code>` 对象，
   * 用于将给定影像图层覆盖在由给定模型primitive影像描述的基元上。
   *
   * @param {Object<string, Function>} uniformMap 对于当前可见的每一层影像（当 `show==true` 时），这将获取由
   * @param {object} uniforms 给定模型primitive影像提供的 `<code>ImageryCoverage</code>` 对象（
   */
  static _setImageryUniforms(uniformMap, uniforms) {
    for (const key in uniforms) {
      if (uniforms.hasOwnProperty(key)) {
        const name = `u_${key}`;
        uniformMap[name] = function () {
          return uniforms[key];
        };
      }
    }
  }

  /**
   * 这些对象描述了被基元覆盖的影像瓦片），并为每一层创建一个 `<code>ImageryInput</code>`。
   * 影像图层
   * 模型primitive影像
   *
   * 对于当前可见的每一层影像（当 `show==true` 时），这将获取由
   * 给定模型primitive影像提供的 `<code>ImageryCoverage</code>` 对象（
   * 这些对象描述了被基元覆盖的影像瓦片），并为每一层创建一个 `<code>ImageryInput</code>`。
   * 影像图层
   * 模型primitive影像
   *
   * @param {ImageryLayerCollection} imageryLayers 包含数组，
   * @param {ModelPrimitiveImagery} modelPrimitiveImagery 对于每一层影像索引，包含用于该影像的纹理坐标属性集索引。这是用于
   * @param {number[]} imageryTexCoordAttributeSetIndices 访问纹理坐标属性的值。
   * 在着色器中的 `<code>a_imagery_texCoord_${imageryTexCoordAttributeSetIndex}</code>`
   * 影像输入
   * 创建必须被传递给影像管道阶段的 `ImageryInput` 对象，
   * 用于给定的 `ImageryCoverage`。
   * `ImageryCoverage` 描述了被基元位置的地图边界矩形所覆盖的影像瓦片。此函数
   * @returns {ImageryInput[]} The 获取实际的 `<code>Imagery</code>` 对象及其纹理，并计算
   */
  static _createImageryInputs(
    imageryLayers,
    modelPrimitiveImagery,
    imageryTexCoordAttributeSetIndices,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("imageryLayers", imageryLayers);
    Check.defined("modelPrimitiveImagery", modelPrimitiveImagery);
    Check.defined(
      "imageryTexCoordAttributeSetIndices",
      imageryTexCoordAttributeSetIndices,
    );
    //>>includeEnd('debug');

    const imageryInputs = [];

    for (let i = 0; i < imageryLayers.length; i++) {
      const imageryLayer = imageryLayers.get(i);
      if (!imageryLayer.show) {
        continue;
      }
      const imageryTexCoordAttributeSetIndex =
        imageryTexCoordAttributeSetIndices[i];
      const mappedPositions =
        modelPrimitiveImagery.mappedPositionsForImageryLayer(imageryLayer);
      const cartographicBoundingRectangle =
        mappedPositions.cartographicBoundingRectangle;
      const coverages =
        modelPrimitiveImagery.coveragesForImageryLayer(imageryLayer);

      for (let j = 0; j < coverages.length; j++) {
        const coverage = coverages[j];
        const imageryInput = ImageryPipelineStage._createImageryInput(
          imageryLayer,
          coverage,
          cartographicBoundingRectangle,
          imageryTexCoordAttributeSetIndex,
        );
        if (defined(imageryInput)) {
          imageryInputs.push(imageryInput);
        }
      }
    }
    return imageryInputs;
  }

  /**
   * Create the `ImageryInput` that has to be passed to the imagery pipeline
   * stage, for the given `ImageryCoverage`.
   *
   * The `ImageryCoverage` describes on imagery tile that is covered by the
   * cartographic bounding rectangle of the primitive positions. This function
   * obtains the actual `Imagery` object and its texture, computes the
   * 需要纹理坐标和缩放值，并将这些信息组装成
   * 一个 `ImageryInput`。
   *
   * @param {ImageryLayer} imageryLayer 影像图层
   * @param {ImageryCoverage} coverage 影像覆盖范围
   * @param {Rectangle} cartographicBoundingRectangle 地图原语位置的边界矩形
   * 以及该影像使用的纹理坐标属性集索引
   * @param {number} imageryTexCoordAttributeSetIndex 该纹理坐标属性集索引
   * 用于此影像的纹理坐标属性。
   * 这就是在着色器中访问纹理坐标属性 <code>a_imagery_texCoord_${imageryTexCoordAttributeSetIndex}</code>
   * 的值。
   * 时使用的数值。
   * @returns {ImageryInput|undefined} The 影像输入，如果
   * 给定覆盖范围的影像处于
   * <code>ImageryState.INVALID/FAILED<code>状态，或者没有
   * 有效的纹理。
   * @private
   */
  static _createImageryInput(
    imageryLayer,
    coverage,
    cartographicBoundingRectangle,
    imageryTexCoordAttributeSetIndex,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("imageryLayer", imageryLayer);
    Check.defined("coverage", coverage);
    Check.defined(
      "cartographicBoundingRectangle",
      cartographicBoundingRectangle,
    );
    Check.typeOf.number.greaterThanOrEquals(
      "imageryTexCoordAttributeSetIndex",
      imageryTexCoordAttributeSetIndex,
      0,
    );
    //>>includeEnd('debug');

    // Bail out early if something went wrong in the imagery
    // loading state machine
    const imagery = coverage.imagery;
    if (
      imagery.state === ImageryState.FAILED ||
      imagery.state === ImageryState.INVALID
    ) {
      return undefined;
    }

    // The texture coordinates are computed for the respective
    // imagery, so pick either the textureWebMercator or the
    // texture here
    let texture = imagery.textureWebMercator;
    if (!defined(texture)) {
      texture = imagery.texture;
      if (!defined(texture)) {
        // Print an error message only when the imagery
        // SHOULD actually have a texture
        if (imagery.state === ImageryState.READY) {
          console.log(
            `Imagery at ${coverage.x}, ${coverage.y} (level ${coverage.level}) does not have any texture - state ${imagery.state}`,
          );
        }
        return undefined;
      }
    }

    const textureTranslationAndScale =
      ImageryPipelineStage._computeTextureTranslationAndScale(
        imageryLayer,
        cartographicBoundingRectangle,
        imagery.rectangle,
      );

    // Convert the texture coordinate rectangle into a Cartesian4
    // for the consumption as a uniform in the shader
    const textureCoordinateCartesianRectangle =
      coverage.textureCoordinateRectangle;
    const textureCoordinateRectangle = new Cartesian4(
      textureCoordinateCartesianRectangle.minX,
      textureCoordinateCartesianRectangle.minY,
      textureCoordinateCartesianRectangle.maxX,
      textureCoordinateCartesianRectangle.maxY,
    );

    const imageryInput = new ImageryInput(
      imageryLayer,
      texture,
      textureTranslationAndScale,
      textureCoordinateRectangle,
      imageryTexCoordAttributeSetIndex,
    );
    return imageryInput;
  }

  /**
   * 计算应用于纹理坐标的平移和缩放值，以便将给定影像映射到
   * 几何图形上。
   * 给定的矩形将依据影像图层的平铺方案转换为其“原生”表示形式，并传递给
   *
   * `_computeTextureTranslationAndScaleFromNative` 函数（详情请参阅该函数）。
   * 影像图层
   * 几何图形的边界矩形
   *
   * @param {ImageryLayer} imageryLayer 计算应用于纹理坐标的平移和缩放值，以便将给定影像矩形映射到
   * @param {Rectangle} nonNativeBoundingRectangle 几何图形矩形上。
   * 此操作将计算一个包含
   * @param {Rectangle} nonNativeImageryRectangle （偏移X、偏移Y、缩放X、缩放Y）的 Cartesian4 矩阵，这些矩阵必须应用于
   * 通过 `ModelImageryMapping.createTextureCoordinatesAttributeForMappedPositions` 计算出的纹理坐标。
   * @returns {Cartesian4} The 在着色器中，此偏移和缩放值将把给定影像矩形映射到
   * @private
   */
  static _computeTextureTranslationAndScale(
    imageryLayer,
    nonNativeBoundingRectangle,
    nonNativeImageryRectangle,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("imageryLayer", imageryLayer);
    Check.defined("nonNativeBoundingRectangle", nonNativeBoundingRectangle);
    Check.defined("nonNativeImageryRectangle", nonNativeImageryRectangle);
    //>>includeEnd('debug');

    const tilingScheme = imageryLayer.imageryProvider.tilingScheme;

    const nativeBoundingRectangle = tilingScheme.rectangleToNativeRectangle(
      nonNativeBoundingRectangle,
      nativeBoundingRectangleScratch,
    );
    const nativeImageryRectangle = tilingScheme.rectangleToNativeRectangle(
      nonNativeImageryRectangle,
      nativeImageryRectangleScratch,
    );

    const translationAndScale =
      ImageryPipelineStage._computeTextureTranslationAndScaleFromNative(
        nativeBoundingRectangle,
        nativeImageryRectangle,
      );
    return translationAndScale;
  }

  /**
   * 几何图形矩形上。
   * 影像的边界矩形
   * 以及几何图形的边界矩形
   *
   * 计算从给定源数组到目标数组的索引映射。
   * 结果将是一个与源数组长度相同的数组，其中包含源数组中元素在目标数组中的索引。
   * 源数组
   * 和目标数组
   * 结果
   * to the geometry * rectangle.
   *
   * @param {Imagery} imagery The imagery
   * @param {Rectangle} nonNativeBoundingRectangle The bounding
   * rectangle of the geometry
   * @param {Rectangle} nonNativeImageryRectangle The bounding
   * rectangle of the imagery
   * @returns {Cartesian4} The translation and scale
   * @private
   */
  static _computeTextureTranslationAndScaleFromNative(
    nativeBoundingRectangle,
    nativeImageryRectangle,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("nativeBoundingRectangle", nativeBoundingRectangle);
    Check.defined("nativeImageryRectangle", nativeImageryRectangle);
    //>>includeEnd('debug');

    const invImageryWidth = 1.0 / nativeImageryRectangle.width;
    const invImageryHeight = 1.0 / nativeImageryRectangle.height;
    const deltaWest =
      nativeBoundingRectangle.west - nativeImageryRectangle.west;
    const deltaSouth =
      nativeBoundingRectangle.south - nativeImageryRectangle.south;
    const offsetX = deltaWest * invImageryWidth;
    const offsetY = deltaSouth * invImageryHeight;
    const scaleX = nativeBoundingRectangle.width * invImageryWidth;
    const scaleY = nativeBoundingRectangle.height * invImageryHeight;
    return new Cartesian4(offsetX, offsetY, scaleX, scaleY);
  }

  /**
   * Computes the index mapping from the given source to the given target.
   *
   * The result will be an array that has the same length as the source,
   * and contains the indices that the source elements have in the
   * target array.
   *
   * @param {object[]} source The source array
   * @param {object[]} target The target array
   * @returns {number[]} The result
   */
  static _computeIndexMapping(source, target) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("source", source);
    Check.defined("target", target);
    //>>includeEnd('debug');

    const result = [];
    const length = source.length;
    for (let i = 0; i < length; i++) {
      const element = source[i];
      const index = target.indexOf(element);
      result.push(index);
    }
    return result;
  }
}

// Static properties (direct initialization disallowed by eslint)
//ImageryPipelineStage.name = "ImageryPipelineStage"; // Helps with debugging, if you know where to look

export default ImageryPipelineStage;
