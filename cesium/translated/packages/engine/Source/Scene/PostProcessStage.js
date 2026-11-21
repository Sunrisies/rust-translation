import {
  BoundingRectangle,
  Check,
  Color,
  DeveloperError,
  Frozen,
  PixelDatatype,
  PixelFormat,
  combine,
  createGuid,
  defined,
  destroyObject,
  oneTimeWarning,
} from "@cesium/core";
import Resource from "../Core/Resource.js";
import ContextLimits from "../Renderer/ContextLimits.js";
import PassState from "../Renderer/PassState.js";
import RenderState from "../Renderer/RenderState.js";
import Sampler from "../Renderer/Sampler.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import Texture from "../Renderer/Texture.js";
import TextureMagnificationFilter from "../Renderer/TextureMagnificationFilter.js";
import TextureMinificationFilter from "../Renderer/TextureMinificationFilter.js";
import TextureWrap from "../Renderer/TextureWrap.js";
import PostProcessStageSampleMode from "./PostProcessStageSampleMode.js";

/**
 * 对场景渲染的纹理或之前处理阶段的输出执行后处理阶段。
 *
 * @alias PostProcessStage
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string} options.fragmentShader 要使用的片段着色器。默认 <code>sampler2D</code> 统一变量为 <code>colorTexture</code> 和 <code>depthTexture</code>。颜色纹理是场景渲染或之前阶段的结果。深度纹理是场景渲染的结果。着色器应包含一个或两个统一变量。还有一个名为 <code>v_textureCoordinates</code> 的 <code>vec2</code> 变量，可用于采样纹理。
 * @param {object} [options.uniforms] 用于设置着色器统一变量的对象。这些属性可以是常量值或函数。常量值也可以是一个 URI、数据 URI 或 HTML 元素，用作纹理。
 * @param {number} [options.textureScale=1.0] 用于缩放纹理尺寸的数值，范围在 (0.0, 1.0] 之间。当缩放值为 1.0 时，此后处理阶段会将结果渲染为与视口大小相同的纹理。
 * @param {boolean} [options.forcePowerOfTwo=false] 是否强制纹理尺寸为相同的2的幂次。2的幂次为最小尺寸的下一个2的幂次。
 * @param {PostProcessStageSampleMode} [options.sampleMode=PostProcessStageSampleMode.NEAREST] 输入颜色纹理的采样方式。
 * @param {PixelFormat} [options.pixelFormat=PixelFormat.RGBA] 输出纹理的颜色像素格式。
 * @param {PixelDatatype} [options.pixelDatatype=PixelDatatype.UNSIGNED_BYTE] 输出纹理的像素数据类型。
 * @param {Color} [options.clearColor=Color.BLACK] 清除输出纹理的颜色。
 * @param {BoundingRectangle} [options.scissorRectangle] 用于剪切测试的矩形区域。
 * @param {string} [options.name=createGuid()] 此后处理阶段的唯一名称，供复合场景中的其他阶段引用。如果未提供名称，将生成 GUID。
 *
 * @exception {DeveloperError} options.textureScale 必须大于 0.0 且小于或等于 1.0。
 * @exception {DeveloperError} options.pixelFormat 必须是颜色格式。
 * @exception {DeveloperError} When 如果 <code>options.pixelDatatype</code> 为 FLOAT，此 WebGL 实现必须支持浮点纹理。请检查 <code>context.floatingPointTexture</code>。
 *
 * @see PostProcessStageComposite
 *
 * @example
 * // 简单阶段用于改变颜色
 * const fs =`
 * uniform sampler2D colorTexture;
 * in vec2 v_textureCoordinates;
 * uniform float scale;
 * uniform vec3 offset;
 * void main() {
 * vec4 color = texture(colorTexture, v_textureCoordinates);
 * out_FragColor = vec4(color.rgb * scale + offset, 1.0);
 *     }`;
 * scene.postProcessStages.add(new Cesium.PostProcessStage({
 * fragmentShader : fs,
 * uniforms : {
 * scale : 1.1,
 * offset : function() {
 * return new Cesium.Cartesian3(0.1, 0.2, 0.3);
 *         }
 *     }
 * }));
 *
 * @example
 * // 简单阶段用于改变选中对象的颜色。
 * // 如果 czm_selected 返回 true，当前片段属于选中数组中的几何对象。
 * const fs =`
 * uniform sampler2D colorTexture;
 * in vec2 v_textureCoordinates;
 * uniform vec4 highlight;
 * void main() {
 * vec4 color = texture(colorTexture, v_textureCoordinates);
 * if (czm_selected()) {
 * vec3 highlighted = highlight.a * highlight.rgb + (1.0 - highlight.a) * color.rgb;
 * out_FragColor = vec4(highlighted, 1.0);
 * } else {
 * out_FragColor = color;
 *         }
 *     }`;
 * const stage = scene.postProcessStages.add(new Cesium.PostProcessStage({
 * fragmentShader : fs,
 * uniforms : {
 * highlight : function() {
 * return new Cesium.Color(1.0, 0.0, 0.0, 0.5);
 *         }
 *     }
 * }));
 * stage.selected = [cesium3DTileFeature];
 */
function PostProcessStage(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    name = createGuid(),
    fragmentShader,
    uniforms,
    textureScale = 1.0,
    forcePowerOfTwo = false,
    sampleMode = PostProcessStageSampleMode.NEAREST,
    pixelFormat = PixelFormat.RGBA,
    pixelDatatype = PixelDatatype.UNSIGNED_BYTE,
    clearColor = Color.BLACK,
    scissorRectangle,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.fragmentShader", fragmentShader);
  Check.typeOf.number.greaterThan("options.textureScale", textureScale, 0.0);
  Check.typeOf.number.lessThanOrEquals(
    "options.textureScale",
    textureScale,
    1.0,
  );
  if (!PixelFormat.isColorFormat(pixelFormat)) {
    throw new DeveloperError("options.pixelFormat must be a color format.");
  }
  //>>includeEnd('debug');

  this._fragmentShader = fragmentShader;
  this._uniforms = uniforms;
  this._textureScale = textureScale;
  this._forcePowerOfTwo = forcePowerOfTwo;
  this._sampleMode = sampleMode;
  this._pixelFormat = pixelFormat;
  this._pixelDatatype = pixelDatatype;
  this._clearColor = clearColor;

  this._uniformMap = undefined;
  this._command = undefined;

  this._colorTexture = undefined;
  this._depthTexture = undefined;
  this._idTexture = undefined;

  this._actualUniforms = {};
  this._dirtyUniforms = [];
  this._texturesToRelease = [];
  this._texturesToCreate = [];
  this._texturePromise = undefined;

  const passState = new PassState();
  passState.scissorTest = {
    enabled: true,
    rectangle: defined(scissorRectangle)
      ? BoundingRectangle.clone(scissorRectangle)
      : new BoundingRectangle(),
  };
  this._passState = passState;

  this._ready = false;

  this._name = name;

  this._logDepthChanged = undefined;
  this._useLogDepth = undefined;

  this._selectedIdTexture = undefined;
  this._selected = undefined;
  this._selectedShadow = undefined;
  this._parentSelected = undefined;
  this._parentSelectedShadow = undefined;
  this._combinedSelected = undefined;
  this._combinedSelectedShadow = undefined;
  this._selectedLength = 0;
  this._parentSelectedLength = 0;
  this._selectedDirty = true;

  // set by PostProcessStageCollection
  this._textureCache = undefined;
  this._index = undefined;

  /**
   * 是否在准备时执行此后处理阶段。
   *
   * @type {boolean}
   */
  this.enabled = true;
  this._enabled = true;
}

Object.defineProperties(PostProcessStage.prototype, {
  /**
   * 决定此后处理阶段是否可执行。只有当 <code>ready</code> 和 {@link PostProcessStage#enabled} 均为 <code>true</code> 时，才执行该阶段。当等待纹理加载时，阶段不会处于准备状态。
   * 此后处理阶段的唯一名称，供 {@link PostProcessStageComposite} 中的其他阶段参考。
   * 执行此后处理阶段时使用的片段着色器。
   *
   * @memberof PostProcessStage.prototype
   * @type {boolean}
   * @readonly
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },
  /**
   * The unique name of this post-process stage for reference by other stages in a {@link PostProcessStageComposite}.
   *
   * @memberof PostProcessStage.prototype
   * @type {string}
   * @readonly
   */
  name: {
    get: function () {
      return this._name;
    },
  },
  /**
   * 或两者都有。
   * <p>
   * 着色器必须包含用于 <code>v_textureCoordinates</code> 的 <code>vec2</code> varying 声明，以便采样纹理uniform。
   * 用于设置片段着色器 uniform 值的对象。
   * </p>
   * <p>
   * 对象属性值可以是常量或函数。该函数将在后处理阶段执行前每帧被调用。
   * 常量值也可以是指向图像、数据URI或可作为纹理使用的HTML元素（如HTMLImageElement或HTMLCanvasElement）的URI。
   * </p>
   *
   * @memberof PostProcessStage.prototype
   * @type {string}
   * @readonly
   */
  fragmentShader: {
    get: function () {
      return this._fragmentShader;
    },
  },
  /**
   * 如果此后处理阶段是未串联执行的 {@link PostProcessStageComposite} 的一部分，常量值也可以是指向复合中其他阶段的名称。这将把uniform设置为该阶段输出的纹理。
   * <p>
   * 用于缩放输出纹理尺寸的数值，范围在 (0.0, 1.0] 之间。缩放比例为1.0时，此后处理阶段将渲染为与视口大小相同的纹理。
   * 是否强制输出纹理尺寸为相同的2的幂次。2的幂次为最小尺寸的下一个2的幂次。
   * </p>
   * <p>
   * A constant value can also be a URI to an image, a data URI, or an HTML element that can be used as a texture, such as HTMLImageElement or HTMLCanvasElement.
   * </p>
   * <p>
   * If this post-process stage is part of a {@link PostProcessStageComposite} that does not execute in series, the constant value can also be
   * the name of another stage in a composite. This will set the uniform to the output texture the stage with that name.
   * </p>
   *
   * @memberof PostProcessStage.prototype
   * @type {object}
   * @readonly
   */
  uniforms: {
    get: function () {
      return this._uniforms;
    },
  },
  /**
   * A number in the range (0.0, 1.0] used to scale the output texture dimensions. A scale of 1.0 will render this post-process stage to a texture the size of the viewport.
   *
   * @memberof PostProcessStage.prototype
   * @type {number}
   * @readonly
   */
  textureScale: {
    get: function () {
      return this._textureScale;
    },
  },
  /**
   * Whether or not to force the output texture dimensions to be both equal powers of two. The power of two will be the next power of two of the minimum of the dimensions.
   *
   * @memberof PostProcessStage.prototype
   * @type {number}
   * @readonly
   */
  forcePowerOfTwo: {
    get: function () {
      return this._forcePowerOfTwo;
    },
  },
  /**
   * 如何采样输入颜色纹理。
   *
   * @memberof PostProcessStage.prototype
   * @type {PostProcessStageSampleMode}
   * @readonly
   */
  sampleMode: {
    get: function () {
      return this._sampleMode;
    },
  },
  /**
   * 输出纹理的颜色像素格式。
   *
   * @memberof PostProcessStage.prototype
   * @type {PixelFormat}
   * @readonly
   */
  pixelFormat: {
    get: function () {
      return this._pixelFormat;
    },
  },
  /**
   * 输出纹理的像素数据类型。
   *
   * @memberof PostProcessStage.prototype
   * @type {PixelDatatype}
   * @readonly
   */
  pixelDatatype: {
    get: function () {
      return this._pixelDatatype;
    },
  },
  /**
   * 用于清除输出纹理的颜色。
   *
   * @memberof PostProcessStage.prototype
   * @type {Color}
   * @readonly
   */
  clearColor: {
    get: function () {
      return this._clearColor;
    },
  },
  /**
   * 用于剪切测试的 {@link BoundingRectangle}。默认边界矩形将禁用剪切测试。
   *
   * @memberof PostProcessStage.prototype
   * @type {BoundingRectangle}
   * @readonly
   */
  scissorRectangle: {
    get: function () {
      return this._passState.scissorTest.rectangle;
    },
  },
  /**
   * 执行此后处理阶段时写入的纹理引用。
   *
   * @memberof PostProcessStage.prototype
   * @type {Texture}
   * @readonly
   * @private
   */
  outputTexture: {
    get: function () {
      if (defined(this._textureCache)) {
        const framebuffer = this._textureCache.getFramebuffer(this._name);
        if (defined(framebuffer)) {
          return framebuffer.getColorTexture(0);
        }
      }
      return undefined;
    },
  },
  /**
   * 要应用后处理的选中特性。
   * <p>
   * 在片段着色器中，使用 <code>czm_selected</code> 来决定是否应用后处理阶段。例如：
   * stage to that fragment. For example:
   * <code>
   * if (czm_selected(v_textureCoordinates)) {
   * // 应用后处理阶段
   * } else {
   * out_FragColor = texture(colorTexture, v_textureCoordinates);
   * }
   * </code>
   * </p>
   *
   * @memberof PostProcessStage.prototype
   * @type {Array}
   */
  selected: {
    get: function () {
      return this._selected;
    },
    set: function (value) {
      this._selected = value;
    },
  },
  /**
   * @private
   */
  parentSelected: {
    get: function () {
      return this._parentSelected;
    },
    set: function (value) {
      this._parentSelected = value;
    },
  },
});

const depthTextureRegex = /uniform\s+sampler2D\s+depthTexture/g;

/**
 * @private
 */
PostProcessStage.prototype._isSupported = function (context) {
  return !depthTextureRegex.test(this._fragmentShader) || context.depthTexture;
};

function getUniformValueGetterAndSetter(stage, uniforms, name) {
  const currentValue = uniforms[name];
  if (
    typeof currentValue === "string" ||
    currentValue instanceof HTMLCanvasElement ||
    currentValue instanceof HTMLImageElement ||
    currentValue instanceof HTMLVideoElement ||
    currentValue instanceof ImageData
  ) {
    stage._dirtyUniforms.push(name);
  }

  return {
    get: function () {
      return uniforms[name];
    },
    set: function (value) {
      const currentValue = uniforms[name];
      uniforms[name] = value;

      const actualUniforms = stage._actualUniforms;
      const actualValue = actualUniforms[name];
      if (
        defined(actualValue) &&
        actualValue !== currentValue &&
        actualValue instanceof Texture &&
        !defined(stage._textureCache.getStageByName(name))
      ) {
        stage._texturesToRelease.push(actualValue);
        delete actualUniforms[name];
        delete actualUniforms[`${name}Dimensions`];
      }

      if (currentValue instanceof Texture) {
        stage._texturesToRelease.push(currentValue);
      }

      if (
        typeof value === "string" ||
        value instanceof HTMLCanvasElement ||
        value instanceof HTMLImageElement ||
        value instanceof HTMLVideoElement ||
        value instanceof ImageData
      ) {
        stage._dirtyUniforms.push(name);
      } else {
        actualUniforms[name] = value;
      }
    },
  };
}

function getUniformMapFunction(stage, name) {
  return function () {
    const value = stage._actualUniforms[name];
    if (typeof value === "function") {
      return value();
    }
    return value;
  };
}

function getUniformMapDimensionsFunction(uniformMap, name) {
  return function () {
    const texture = uniformMap[name]();
    if (defined(texture)) {
      return texture.dimensions;
    }
    return undefined;
  };
}

function createUniformMap(stage) {
  if (defined(stage._uniformMap)) {
    return;
  }

  const uniformMap = {};
  const newUniforms = {};
  const uniforms = stage._uniforms;
  const actualUniforms = stage._actualUniforms;
  for (const name in uniforms) {
    if (!uniforms.hasOwnProperty(name)) {
      continue;
    }
    if (typeof uniforms[name] !== "function") {
      uniformMap[name] = getUniformMapFunction(stage, name);
      newUniforms[name] = getUniformValueGetterAndSetter(stage, uniforms, name);
    } else {
      uniformMap[name] = uniforms[name];
      newUniforms[name] = uniforms[name];
    }

    actualUniforms[name] = uniforms[name];

    const value = uniformMap[name]();
    if (
      typeof value === "string" ||
      value instanceof Texture ||
      value instanceof HTMLImageElement ||
      value instanceof HTMLCanvasElement ||
      value instanceof HTMLVideoElement
    ) {
      uniformMap[`${name}Dimensions`] = getUniformMapDimensionsFunction(
        uniformMap,
        name,
      );
    }
  }

  stage._uniforms = {};
  Object.defineProperties(stage._uniforms, newUniforms);

  stage._uniformMap = combine(uniformMap, {
    colorTexture: function () {
      return stage._colorTexture;
    },
    colorTextureDimensions: function () {
      return stage._colorTexture.dimensions;
    },
    depthTexture: function () {
      return stage._depthTexture;
    },
    depthTextureDimensions: function () {
      return stage._depthTexture.dimensions;
    },
    czm_idTexture: function () {
      return stage._idTexture;
    },
    czm_selectedIdTexture: function () {
      return stage._selectedIdTexture;
    },
    czm_selectedIdTextureStep: function () {
      return 1.0 / stage._selectedIdTexture.width;
    },
  });
}

function addSelectedIdToShader(shaderSource, idTextureWidth) {
  shaderSource = shaderSource.replace(/in\s+vec2\s+v_textureCoordinates;/g, "");
  return `#define CZM_SELECTED_FEATURE
uniform sampler2D czm_idTexture;
uniform sampler2D czm_selectedIdTexture;
uniform float czm_selectedIdTextureStep;
in vec2 v_textureCoordinates;
bool czm_selected(vec2 offset)
{
    bool selected = false;
    vec4 id = texture(czm_idTexture, v_textureCoordinates + offset);
    for (int i = 0; i < ${idTextureWidth}; ++i)
    {
        vec4 selectedId = texture(czm_selectedIdTexture, vec2((float(i) + 0.5) * czm_selectedIdTextureStep, 0.5));
        if (all(equal(id, selectedId)))
        {
            return true;
        }
    }
    return false;
}
bool czm_selected()
{
    return czm_selected(vec2(0.0));
}

${shaderSource}`;
}

function createDrawCommand(stage, context) {
  if (
    defined(stage._command) &&
    !stage._logDepthChanged &&
    !stage._selectedDirty
  ) {
    return;
  }

  let fragmentShaderSource = stage._fragmentShader;
  if (defined(stage._selectedIdTexture)) {
    const width = stage._selectedIdTexture.width;
    fragmentShaderSource = addSelectedIdToShader(fragmentShaderSource, width);
  }

  const fragmentShader = new ShaderSource({
    defines: [stage._useLogDepth ? "LOG_DEPTH" : ""],
    sources: [fragmentShaderSource],
  });
  stage._command = context.createViewportQuadCommand(fragmentShader, {
    uniformMap: stage._uniformMap,
    owner: stage,
  });
}

function createSampler(stage) {
  const mode = stage._sampleMode;

  let minFilter;
  let magFilter;

  if (mode === PostProcessStageSampleMode.LINEAR) {
    minFilter = TextureMinificationFilter.LINEAR;
    magFilter = TextureMagnificationFilter.LINEAR;
  } else {
    minFilter = TextureMinificationFilter.NEAREST;
    magFilter = TextureMagnificationFilter.NEAREST;
  }

  const sampler = stage._sampler;
  if (
    !defined(sampler) ||
    sampler.minificationFilter !== minFilter ||
    sampler.magnificationFilter !== magFilter
  ) {
    stage._sampler = new Sampler({
      wrapS: TextureWrap.CLAMP_TO_EDGE,
      wrapT: TextureWrap.CLAMP_TO_EDGE,
      minificationFilter: minFilter,
      magnificationFilter: magFilter,
    });
  }
}

function createLoadImageFunction(stage, name) {
  return function (image) {
    stage._texturesToCreate.push({
      name: name,
      source: image,
    });
  };
}

function createStageOutputTextureFunction(stage, name) {
  return function () {
    return stage._textureCache.getOutputTexture(name);
  };
}

function updateUniformTextures(stage, context) {
  const texturesToRelease = stage._texturesToRelease;
  for (let i = 0; i < texturesToRelease.length; ++i) {
    const texture = texturesToRelease[i];
    if (defined(texture)) {
      texture.destroy();
    }
  }
  texturesToRelease.length = 0;

  const texturesToCreate = stage._texturesToCreate;
  for (let i = 0; i < texturesToCreate.length; ++i) {
    const { name, source } = texturesToCreate[i];
    stage._actualUniforms[name] = new Texture({
      context: context,
      source: source,
    });
  }
  texturesToCreate.length = 0;

  const dirtyUniforms = stage._dirtyUniforms;
  if (dirtyUniforms.length === 0 && !defined(stage._texturePromise)) {
    stage._ready = true;
    return;
  }

  if (dirtyUniforms.length === 0 || defined(stage._texturePromise)) {
    return;
  }

  const uniforms = stage._uniforms;
  const promises = [];
  for (let i = 0; i < dirtyUniforms.length; ++i) {
    const name = dirtyUniforms[i];
    const stageNameUrlOrImage = uniforms[name];
    const stageWithName =
      stage._textureCache.getStageByName(stageNameUrlOrImage);
    if (defined(stageWithName)) {
      stage._actualUniforms[name] = createStageOutputTextureFunction(
        stage,
        stageNameUrlOrImage,
      );
    } else if (typeof stageNameUrlOrImage === "string") {
      const resource = new Resource({
        url: stageNameUrlOrImage,
      });

      promises.push(
        resource.fetchImage().then(createLoadImageFunction(stage, name)),
      );
    } else {
      stage._texturesToCreate.push({
        name: name,
        source: stageNameUrlOrImage,
      });
    }
  }

  dirtyUniforms.length = 0;

  if (promises.length > 0) {
    stage._ready = false;
    stage._texturePromise = Promise.all(promises).then(function () {
      stage._ready = true;
      stage._texturePromise = undefined;
    });
  } else {
    stage._ready = true;
  }
}

function releaseResources(stage) {
  if (defined(stage._command)) {
    stage._command.shaderProgram =
      stage._command.shaderProgram && stage._command.shaderProgram.destroy();
    stage._command = undefined;
  }

  stage._selectedIdTexture =
    stage._selectedIdTexture && stage._selectedIdTexture.destroy();

  const textureCache = stage._textureCache;
  if (!defined(textureCache)) {
    return;
  }

  const uniforms = stage._uniforms;
  const actualUniforms = stage._actualUniforms;
  for (const name in actualUniforms) {
    if (!actualUniforms.hasOwnProperty(name)) {
      continue;
    }
    const actualUniform = actualUniforms[name];
    if (actualUniform instanceof Texture) {
      if (!defined(textureCache.getStageByName(uniforms[name]))) {
        actualUniform.destroy();
      }
      stage._dirtyUniforms.push(name);
    }
  }
}

function isSelectedTextureDirty(stage) {
  const length = defined(stage._selected) ? stage._selected.length : 0;
  const parentLength = defined(stage._parentSelected)
    ? stage._parentSelected
    : 0;
  const dirty =
    stage._selected !== stage._selectedShadow ||
    length !== stage._selectedLength ||
    stage._parentSelected !== stage._parentSelectedShadow ||
    parentLength !== stage._parentSelectedLength;

  if (defined(stage._selected) && defined(stage._parentSelected)) {
    stage._combinedSelected = stage._selected.concat(stage._parentSelected);
  } else if (defined(stage._parentSelected)) {
    stage._combinedSelected = stage._parentSelected;
  } else {
    stage._combinedSelected = stage._selected;
  }

  if (!dirty && defined(stage._combinedSelected)) {
    if (!defined(stage._combinedSelectedShadow)) {
      return true;
    }

    for (let i = 0; i < stage._combinedSelected.length; ++i) {
      if (stage._combinedSelected[i] !== stage._combinedSelectedShadow[i]) {
        return true;
      }
    }
  }
  return dirty;
}

function createSelectedTexture(stage, context) {
  if (!stage._selectedDirty) {
    return;
  }

  stage._selectedIdTexture =
    stage._selectedIdTexture && stage._selectedIdTexture.destroy();
  stage._selectedIdTexture = undefined;

  const features = stage._combinedSelected;
  if (!defined(features)) {
    return;
  }

  let textureLength = 0;
  for (let i = 0; i < features.length; ++i) {
    const feature = features[i];
    if (defined(feature.pickIds)) {
      textureLength += feature.pickIds.length;
    } else if (defined(feature.pickId)) {
      ++textureLength;
    }
  }

  // The selected ids are stored in a texture that is one texel per id, so the
  // number of ids cannot exceed the maximum texture width supported by the
  // hardware. Clamp instead of throwing so that a very large selection
  // degrades gracefully (ids beyond the limit are not highlighted).
  const maximumTextureSize = ContextLimits.maximumTextureSize;
  if (textureLength > maximumTextureSize) {
    PostProcessStage._oneTimeWarning(
      "postProcessStageSelectedTextureSize",
      `The number of selected feature ids (${textureLength}) exceeds the maximum texture size (${maximumTextureSize}). Features beyond the limit will not have the post-process effect applied.`,
    );
    textureLength = maximumTextureSize;
  }

  if (features.length === 0 || textureLength === 0) {
    // max pick id is reserved
    const empty = new Uint8Array([255, 255, 255, 255]);
    stage._selectedIdTexture = new Texture({
      context: context,
      pixelFormat: PixelFormat.RGBA,
      pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
      source: {
        arrayBufferView: empty,
        width: 1,
        height: 1,
      },
      sampler: Sampler.NEAREST,
    });
    return;
  }

  let offset = 0;
  const idByteLength = textureLength * 4;
  const ids = new Uint8Array(idByteLength);
  for (let i = 0; i < features.length && offset < idByteLength; ++i) {
    const feature = features[i];
    if (defined(feature.pickIds)) {
      const pickIds = feature.pickIds;
      const pickIdsLength = pickIds.length;
      for (let j = 0; j < pickIdsLength && offset < idByteLength; ++j) {
        const pickColor = pickIds[j].color;
        ids[offset] = Color.floatToByte(pickColor.red);
        ids[offset + 1] = Color.floatToByte(pickColor.green);
        ids[offset + 2] = Color.floatToByte(pickColor.blue);
        ids[offset + 3] = Color.floatToByte(pickColor.alpha);
        offset += 4;
      }
    } else if (defined(feature.pickId)) {
      const pickColor = feature.pickId.color;
      ids[offset] = Color.floatToByte(pickColor.red);
      ids[offset + 1] = Color.floatToByte(pickColor.green);
      ids[offset + 2] = Color.floatToByte(pickColor.blue);
      ids[offset + 3] = Color.floatToByte(pickColor.alpha);
      offset += 4;
    }
  }

  stage._selectedIdTexture = new Texture({
    context: context,
    pixelFormat: PixelFormat.RGBA,
    pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
    source: {
      arrayBufferView: ids,
      width: textureLength,
      height: 1,
    },
    sampler: Sampler.NEAREST,
  });
}

/**
 * 在执行前被调用的函数。用于创建 WebGL 资源并加载任何纹理。
 * @param {Context} context 上下文环境。
 * @param {boolean} useLogDepth 场景是否使用对数深度缓冲区。
 * @private
 */
PostProcessStage.prototype.update = function (context, useLogDepth) {
  if (this.enabled !== this._enabled && !this.enabled) {
    releaseResources(this);
  }

  this._enabled = this.enabled;
  if (!this._enabled) {
    return;
  }

  this._logDepthChanged = useLogDepth !== this._useLogDepth;
  this._useLogDepth = useLogDepth;

  this._selectedDirty = isSelectedTextureDirty(this);

  this._selectedShadow = this._selected;
  this._parentSelectedShadow = this._parentSelected;
  this._combinedSelectedShadow = this._combinedSelected;
  this._selectedLength = defined(this._selected) ? this._selected.length : 0;
  this._parentSelectedLength = defined(this._parentSelected)
    ? this._parentSelected.length
    : 0;

  createSelectedTexture(this, context);
  createUniformMap(this);
  updateUniformTextures(this, context);
  createDrawCommand(this, context);
  createSampler(this);

  this._selectedDirty = false;

  if (!this._ready) {
    return;
  }

  const framebuffer = this._textureCache.getFramebuffer(this._name);
  this._command.framebuffer = framebuffer;

  if (!defined(framebuffer)) {
    return;
  }

  const colorTexture = framebuffer.getColorTexture(0);
  let renderState;
  if (
    colorTexture.width !== context.drawingBufferWidth ||
    colorTexture.height !== context.drawingBufferHeight
  ) {
    renderState = this._renderState;
    if (
      !defined(renderState) ||
      colorTexture.width !== renderState.viewport.width ||
      colorTexture.height !== renderState.viewport.height
    ) {
      this._renderState = RenderState.fromCache({
        viewport: new BoundingRectangle(
          0,
          0,
          colorTexture.width,
          colorTexture.height,
        ),
      });
    }
  }

  this._command.renderState = renderState;
};

/**
 * 执行后处理阶段。颜色纹理是场景渲染出的纹理或来自前一阶段的纹理。
 * @param {Context} context 上下文环境。
 * @param {Texture} colorTexture 输入颜色纹理。
 * @param {Texture} depthTexture 输入深度纹理。
 * @param {Texture} idTexture ID 纹理。
 * @private
 */
PostProcessStage.prototype.execute = function (
  context,
  colorTexture,
  depthTexture,
  idTexture,
) {
  if (
    !defined(this._command) ||
    !defined(this._command.framebuffer) ||
    !this._ready ||
    !this._enabled
  ) {
    return;
  }

  this._colorTexture = colorTexture;
  this._depthTexture = depthTexture;
  this._idTexture = idTexture;

  if (!Sampler.equals(this._colorTexture.sampler, this._sampler)) {
    this._colorTexture.sampler = this._sampler;
  }

  const passState =
    this.scissorRectangle.width > 0 && this.scissorRectangle.height > 0
      ? this._passState
      : undefined;
  if (defined(passState)) {
    passState.context = context;
  }

  this._command.execute(context, passState);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <p>
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数都将引发 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>true</code>。
 *
 * @see PostProcessStage#destroy
 */
PostProcessStage.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象允许确定性的
 * WebGL 资源释放，而不是依赖垃圾收集器来销毁此对象。
 * <p>
 * 一旦对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数都将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * </p>
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @see PostProcessStage#isDestroyed
 */
PostProcessStage.prototype.destroy = function () {
  releaseResources(this);
  return destroyObject(this);
};

// Exposed for testing
PostProcessStage._oneTimeWarning = oneTimeWarning;
export default PostProcessStage;