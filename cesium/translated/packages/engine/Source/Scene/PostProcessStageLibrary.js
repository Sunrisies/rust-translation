import { Color, Ellipsoid, createGuid, defined } from "@cesium/core";
import buildModuleUrl from "../Core/buildModuleUrl.js";
import AcesTonemapping from "../Shaders/PostProcessStages/AcesTonemappingStage.js";
import AmbientOcclusionGenerate from "../Shaders/PostProcessStages/AmbientOcclusionGenerate.js";
import AmbientOcclusionModulate from "../Shaders/PostProcessStages/AmbientOcclusionModulate.js";
import BlackAndWhite from "../Shaders/PostProcessStages/BlackAndWhite.js";
import BloomComposite from "../Shaders/PostProcessStages/BloomComposite.js";
import Brightness from "../Shaders/PostProcessStages/Brightness.js";
import ContrastBias from "../Shaders/PostProcessStages/ContrastBias.js";
import DepthOfField from "../Shaders/PostProcessStages/DepthOfField.js";
import DepthView from "../Shaders/PostProcessStages/DepthView.js";
import EdgeDetection from "../Shaders/PostProcessStages/EdgeDetection.js";
import FilmicTonemapping from "../Shaders/PostProcessStages/FilmicTonemapping.js";
import PbrNeutralTonemapping from "../Shaders/PostProcessStages/PbrNeutralTonemapping.js";
import FXAA from "../Shaders/PostProcessStages/FXAA.js";
import GaussianBlur1D from "../Shaders/PostProcessStages/GaussianBlur1D.js";
import LensFlare from "../Shaders/PostProcessStages/LensFlare.js";
import ModifiedReinhardTonemapping from "../Shaders/PostProcessStages/ModifiedReinhardTonemapping.js";
import NightVision from "../Shaders/PostProcessStages/NightVision.js";
import ReinhardTonemapping from "../Shaders/PostProcessStages/ReinhardTonemapping.js";
import Silhouette from "../Shaders/PostProcessStages/Silhouette.js";
import FXAA3_11 from "../Shaders/FXAA3_11.js";
import AutoExposure from "./AutoExposure.js";
import PostProcessStage from "./PostProcessStage.js";
import PostProcessStageComposite from "./PostProcessStageComposite.js";
import PostProcessStageSampleMode from "./PostProcessStageSampleMode.js";

/**
 * 包含用于创建常见后处理阶段的函数。
 *
 * @namespace PostProcessStageLibrary
 */
const PostProcessStageLibrary = {};

function createBlur(name) {
  const delta = 1.0;
  const sigma = 2.0;
  const stepSize = 1.0;

  const blurShader = `#define USE_STEP_SIZE\n${GaussianBlur1D}`;
  const blurX = new PostProcessStage({
    name: `${name}_x_direction`,
    fragmentShader: blurShader,
    uniforms: {
      delta: delta,
      sigma: sigma,
      stepSize: stepSize,
      direction: 0.0,
    },
    sampleMode: PostProcessStageSampleMode.LINEAR,
  });
  const blurY = new PostProcessStage({
    name: `${name}_y_direction`,
    fragmentShader: blurShader,
    uniforms: {
      delta: delta,
      sigma: sigma,
      stepSize: stepSize,
      direction: 1.0,
    },
    sampleMode: PostProcessStageSampleMode.LINEAR,
  });

  const uniforms = {};
  Object.defineProperties(uniforms, {
    delta: {
      get: function () {
        return blurX.uniforms.delta;
      },
      set: function (value) {
        const blurXUniforms = blurX.uniforms;
        const blurYUniforms = blurY.uniforms;
        blurXUniforms.delta = blurYUniforms.delta = value;
      },
    },
    sigma: {
      get: function () {
        return blurX.uniforms.sigma;
      },
      set: function (value) {
        const blurXUniforms = blurX.uniforms;
        const blurYUniforms = blurY.uniforms;
        blurXUniforms.sigma = blurYUniforms.sigma = value;
      },
    },
    stepSize: {
      get: function () {
        return blurX.uniforms.stepSize;
      },
      set: function (value) {
        const blurXUniforms = blurX.uniforms;
        const blurYUniforms = blurY.uniforms;
        blurXUniforms.stepSize = blurYUniforms.stepSize = value;
      },
    },
  });
  return new PostProcessStageComposite({
    name: name,
    stages: [blurX, blurY],
    uniforms: uniforms,
  });
}

/**
 * 创建一个后处理阶段，对输入纹理应用高斯模糊。此阶段通常与其他阶段结合使用。
 * <p>
 * 该阶段具有以下统一变量：<code>delta</code>、<code>sigma</code> 和 <code>stepSize</code>。
 * </p>
 * <p>
 * <code>delta</code> 和 <code>sigma</code> 用于计算高斯滤波的权重。公式为 <code>exp((-0.5 * delta * delta) / (sigma * sigma))</code>。
 * <code>delta</code> 的默认值为 <code>1.0</code>。<code>sigma</code> 的默认值为 <code>2.0</code>。
 * <code>stepSize</code> 是到下一个纹理像素的距离。默认值为 <code>1.0</code>。
 * </p>
 * @return {PostProcessStageComposite} A 对输入纹理应用高斯模糊的后处理阶段。
 */
PostProcessStageLibrary.createBlurStage = function () {
  return createBlur("czm_blur");
};

/**
 * 创建一个后处理阶段，应用景深效果。
 * <p>
 * 景深模拟相机焦点。场景中处于焦点的物体会清晰可见，而未处于焦点的物体则会模糊。
 * 此阶段具有以下统一变量：<code>focalDistance</code>、<code>delta</code>、<code>sigma</code> 和 <code>stepSize</code>。
 * </p>
 * <p>
 * <code>focalDistance</code> 是从相机到设置相机焦点的米数。
 * </p>
 * <p>
 * <code>focalDistance</code> 用于设置相机焦点距离。
 * </p>
 * <p>
 * <code>delta</code>、<code>sigma</code> 和 <code>stepSize</code> 与 {@link PostProcessStageLibrary#createBlurStage} 中的属性相同。
 * 模糊应用于未聚焦区域。
 * </p>
 * @return {PostProcessStageComposite} A 应用景深效果的后处理阶段。
 */
PostProcessStageLibrary.createDepthOfFieldStage = function () {
  const blur = createBlur("czm_depth_of_field_blur");
  const dof = new PostProcessStage({
    name: "czm_depth_of_field_composite",
    fragmentShader: DepthOfField,
    uniforms: {
      focalDistance: 5.0,
      blurTexture: blur.name,
    },
  });

  const uniforms = {};
  Object.defineProperties(uniforms, {
    focalDistance: {
      get: function () {
        return dof.uniforms.focalDistance;
      },
      set: function (value) {
        dof.uniforms.focalDistance = value;
      },
    },
    delta: {
      get: function () {
        return blur.uniforms.delta;
      },
      set: function (value) {
        blur.uniforms.delta = value;
      },
    },
    sigma: {
      get: function () {
        return blur.uniforms.sigma;
      },
      set: function (value) {
        blur.uniforms.sigma = value;
      },
    },
    stepSize: {
      get: function () {
        return blur.uniforms.stepSize;
      },
      set: function (value) {
        blur.uniforms.stepSize = value;
      },
    },
  });
  return new PostProcessStageComposite({
    name: "czm_depth_of_field",
    stages: [blur, dof],
    inputPreviousStageTexture: false,
    uniforms: uniforms,
  });
};

/**
 * 是否支持景深阶段。
 * <p>
 * 此阶段需要 WEBGL_depth_texture 扩展。
 * </p>
 *
 * @param {Scene} scene 场景。
 * @return {boolean} Whether 此后处理阶段受支持。
 *
 * @see {Context#depthTexture}
 * @see {@link http://www.khronos.org/registry/webgl/extensions/WEBGL_depth_texture/|WEBGL_depth_texture}
 */
PostProcessStageLibrary.isDepthOfFieldSupported = function (scene) {
  return scene.context.depthTexture;
};

/**
 * 创建一个检测边缘的后处理阶段。
 * <p>
 * 当位于边缘时，颜色将被写入输出纹理，透明度设置为 1.0。
 * </p>
 * <p>
 * 该阶段具有以下统一变量：<code>color</code> 和 <code>length</code>。
 * </p>
 * <ul>
 * <li><code>color</code> 是高亮边缘的颜色。默认值为 {@link Color#BLACK}。</li>
 * <li><code>length</code> 是边缘的像素长度。默认值为 <code>0.5</code>。</li>
 * </ul>
 * <p>
 * 此阶段在 2D 中不受支持。
 * </p>
 * @return {PostProcessStage} A 应用边缘检测效果的后处理阶段。
 *
 * @example
 * // 多种轮廓效果
 * const yellowEdge = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
 * yellowEdge.uniforms.color = Cesium.Color.YELLOW;
 * yellowEdge.selected = [feature0];
 *
 * const greenEdge = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
 * greenEdge.uniforms.color = Cesium.Color.LIME;
 * greenEdge.selected = [feature1];
 *
 * // 绘制 feature0 和 feature1 周围的边缘
 * postProcessStages.add(Cesium.PostProcessStageLibrary.createSilhouetteStage([yellowEdge, greenEdge]);
 */
PostProcessStageLibrary.createEdgeDetectionStage = function () {
  // unique name generated on call so more than one effect can be added
  const name = createGuid();
  return new PostProcessStage({
    name: `czm_edge_detection_${name}`,
    fragmentShader: EdgeDetection,
    uniforms: {
      length: 0.25,
      color: Color.clone(Color.BLACK),
    },
  });
};

/**
 * 是否支持边缘检测阶段。
 * <p>
 * 此阶段需要 WEBGL_depth_texture 扩展。
 * </p>
 *
 * @param {Scene} scene 场景。
 * @return {boolean} Whether 此后处理阶段受支持。
 *
 * @see {Context#depthTexture}
 * @see {@link http://www.khronos.org/registry/webgl/extensions/WEBGL_depth_texture/|WEBGL_depth_texture}
 */
PostProcessStageLibrary.isEdgeDetectionSupported = function (scene) {
  return scene.context.depthTexture;
};

function getSilhouetteEdgeDetection(edgeDetectionStages) {
  if (!defined(edgeDetectionStages)) {
    return PostProcessStageLibrary.createEdgeDetectionStage();
  }

  const edgeDetection = new PostProcessStageComposite({
    name: "czm_edge_detection_multiple",
    stages: edgeDetectionStages,
    inputPreviousStageTexture: false,
  });

  const compositeUniforms = {};
  let fsDecl = "";
  let fsLoop = "";
  for (let i = 0; i < edgeDetectionStages.length; ++i) {
    fsDecl += `uniform sampler2D edgeTexture${i}; \n`;
    fsLoop +=
      `        vec4 edge${i} = texture(edgeTexture${i}, v_textureCoordinates); \n` +
      `        if (edge${i}.a > 0.0) \n` +
      `        { \n` +
      `            color = edge${i}; \n` +
      `            break; \n` +
      `        } \n`;
    compositeUniforms[`edgeTexture${i}`] = edgeDetectionStages[i].name;
  }

  const fs =
    `${fsDecl}in vec2 v_textureCoordinates; \n` +
    `void main() { \n` +
    `    vec4 color = vec4(0.0); \n` +
    `    for (int i = 0; i < ${edgeDetectionStages.length}; i++) \n` +
    `    { \n${fsLoop}    } \n` +
    `    out_FragColor = color; \n` +
    `} \n`;

  const edgeComposite = new PostProcessStage({
    name: "czm_edge_detection_combine",
    fragmentShader: fs,
    uniforms: compositeUniforms,
  });
  return new PostProcessStageComposite({
    name: "czm_edge_detection_composite",
    stages: [edgeDetection, edgeComposite],
  });
}

/**
 * 创建一个应用轮廓效果的后处理阶段。
 * <p>
 * 轮廓效果将边缘检测阶段的颜色与输入颜色纹理混合在一起。
 * </p>
 * <p>
 * 当 <code>edgeDetectionStages</code> 为 <code>undefined</code> 时，此阶段具有以下uniform变量：<code>color</code> 和 <code>length</code>
 * </p>
 * <p>
 * <code>color</code> 是高亮边缘的颜色。默认值为 {@link Color#BLACK}。
 * <code>length</code> 是边缘的像素长度。默认值为 <code>0.5</code>。
 * </p>
 * @param {PostProcessStage[]} [edgeDetectionStages] 一组边缘检测后处理阶段。
 * @return {PostProcessStageComposite} A 应用轮廓效果的后处理阶段。
 */
PostProcessStageLibrary.createSilhouetteStage = function (edgeDetectionStages) {
  const edgeDetection = getSilhouetteEdgeDetection(edgeDetectionStages);
  const silhouetteProcess = new PostProcessStage({
    name: "czm_silhouette_color_edges",
    fragmentShader: Silhouette,
    uniforms: {
      silhouetteTexture: edgeDetection.name,
    },
  });

  return new PostProcessStageComposite({
    name: "czm_silhouette",
    stages: [edgeDetection, silhouetteProcess],
    inputPreviousStageTexture: false,
    uniforms: edgeDetection.uniforms,
  });
};

/**
 * 是否支持轮廓阶段。
 * <p>
 * 此阶段需要 WEBGL_depth_texture 扩展。
 * </p>
 *
 * @param {Scene} scene 场景。
 * @return {boolean} Whether 此后处理阶段受支持。
 *
 * @see {Context#depthTexture}
 * @see {@link http://www.khronos.org/registry/webgl/extensions/WEBGL_depth_texture/|WEBGL_depth_texture}
 */
PostProcessStageLibrary.isSilhouetteSupported = function (scene) {
  return scene.context.depthTexture;
};

/**
 * 创建一个对输入纹理应用光晕效果的后处理阶段。
 * <p>
 * 光晕效果会增强发光效果，使亮区域更亮，暗区域更暗。
 * </p>
 * <p>
 * 此后处理阶段具有以下uniform变量：<code>contrast</code>、<code>brightness</code>、<code>glowOnly</code>、
 * <code>delta</code>、<code>sigma</code> 和 <code>stepSize</code>。
 * </p>
 * <ul>
 * <li><code>contrast</code> 是一个范围在 [-255.0, 255.0] 内的标量值，影响效果的强度。默认值为 <code>128.0</code>。</li>
 * <li><code>brightness</code> 是一个标量值。输入纹理的 RGB值会被转换为色调、饱和度和亮度（HSB），然后该值被
 * 加入亮度中。默认值为 <code>-0.3</code>。</li>
 * <li><code>glowOnly</code> 是一个布尔值。当 <code>true</code> 时，仅显示发光效果。当 <code>false</code> 时，发光效果会添加到输入纹理中。
 * 默认值为 <code>false</code>。这是一个调试选项，用于在其他uniform值改变时查看效果。</li>
 * </ul>
 * <p>
 * <code>delta</code>、<code>sigma</code> 和 <code>stepSize</code> 与 {@link PostProcessStageLibrary#createBlurStage} 中的属性相同。
 * </p>
 * @return {PostProcessStageComposite} A 后处理阶段用于应用光晕效果。
 *
 * @private
 */
PostProcessStageLibrary.createBloomStage = function () {
  const contrastBias = new PostProcessStage({
    name: "czm_bloom_contrast_bias",
    fragmentShader: ContrastBias,
    uniforms: {
      contrast: 128.0,
      brightness: -0.3,
    },
  });
  const blur = createBlur("czm_bloom_blur");
  const generateComposite = new PostProcessStageComposite({
    name: "czm_bloom_contrast_bias_blur",
    stages: [contrastBias, blur],
  });

  const bloomComposite = new PostProcessStage({
    name: "czm_bloom_generate_composite",
    fragmentShader: BloomComposite,
    uniforms: {
      glowOnly: false,
      bloomTexture: generateComposite.name,
    },
  });

  const uniforms = {};
  Object.defineProperties(uniforms, {
    glowOnly: {
      get: function () {
        return bloomComposite.uniforms.glowOnly;
      },
      set: function (value) {
        bloomComposite.uniforms.glowOnly = value;
      },
    },
    contrast: {
      get: function () {
        return contrastBias.uniforms.contrast;
      },
      set: function (value) {
        contrastBias.uniforms.contrast = value;
      },
    },
    brightness: {
      get: function () {
        return contrastBias.uniforms.brightness;
      },
      set: function (value) {
        contrastBias.uniforms.brightness = value;
      },
    },
    delta: {
      get: function () {
        return blur.uniforms.delta;
      },
      set: function (value) {
        blur.uniforms.delta = value;
      },
    },
    sigma: {
      get: function () {
        return blur.uniforms.sigma;
      },
      set: function (value) {
        blur.uniforms.sigma = value;
      },
    },
    stepSize: {
      get: function () {
        return blur.uniforms.stepSize;
      },
      set: function (value) {
        blur.uniforms.stepSize = value;
      },
    },
  });

  return new PostProcessStageComposite({
    name: "czm_bloom",
    stages: [generateComposite, bloomComposite],
    inputPreviousStageTexture: false,
    uniforms: uniforms,
  });
};

/**
 * 创建一个后处理阶段，将 Horizon-based Ambient Occlusion (HBAO) 应用于输入纹理。
 * <p>
 * 环境光遮蔽模拟了环境光的阴影。当表面接收光线时，无论光的位置如何，这些阴影始终存在。
 * 统一变量具有以下属性：
 * </p>
 * <p>
 * The uniforms have the following properties:
 * <ul>
 * <li><code>intensity</code> 是一个标量值，用于指数级地变暗或变亮阴影。数值越大，阴影越暗。默认值为 <code>3.0</code>。</li>
 * <li><code>bias</code> 是一个标量值，表示弧度下的角度。如果样本法线与相机向量之间的点积小于该值，
 * 采样会在当前方向停止。这用于消除近平面边缘的阴影。默认值为 <code>0.1</code>。</li>
 * <li><code>lengthCap</code> 是一个标量值，表示米数长度。如果当前样本到第一个样本的距离大于该值，
 * 采样会在当前方向停止。默认值为 <code>0.26</code>。</li>
 * <li><code>directionCount</code> 是光线行进时搜索遮挡物的方向数量。默认值为 <code>8</code>。</li>
 * <li><code>stepCount</code> 是光线行进沿每个方向所需的步数。默认值为 <code>32</code>。</li>
 * <li><code>randomTexture</code> 是一个纹理，其红色通道为 [0.0, 1.0] 范围内的随机值。默认值为 <code>undefined</code>。此纹理需要被设置。</li>
 * <li><code>ambientOcclusionOnly</code> 是一个布尔值。当 <code>true</code> 时，仅将生成的阴影写入输出。当 <code>false</code> 时，输入纹理会被环境光遮蔽效果调制。
 * 这是一个有用的调试选项，可用于观察统一变量变化的效果。默认值为 <code>false</code>。</li>
 * </ul>
 * @return {PostProcessStageComposite} A 应用环境光遮蔽效果的后处理阶段。
 *
 * @private
 */
PostProcessStageLibrary.createAmbientOcclusionStage = function () {
  const generate = new PostProcessStage({
    name: "czm_ambient_occlusion_generate",
    fragmentShader: AmbientOcclusionGenerate,
    uniforms: {
      intensity: 3.0,
      bias: 0.1,
      lengthCap: 0.26,
      directionCount: 8,
      stepCount: 32,
      randomTexture: undefined,
    },
  });

  const ambientOcclusionModulate = new PostProcessStage({
    name: "czm_ambient_occlusion_composite",
    fragmentShader: AmbientOcclusionModulate,
    uniforms: {
      ambientOcclusionOnly: false,
      ambientOcclusionTexture: generate.name,
    },
  });

  const uniforms = {};
  Object.defineProperties(uniforms, {
    intensity: {
      get: function () {
        return generate.uniforms.intensity;
      },
      set: function (value) {
        generate.uniforms.intensity = value;
      },
    },
    bias: {
      get: function () {
        return generate.uniforms.bias;
      },
      set: function (value) {
        generate.uniforms.bias = value;
      },
    },
    lengthCap: {
      get: function () {
        return generate.uniforms.lengthCap;
      },
      set: function (value) {
        generate.uniforms.lengthCap = value;
      },
    },
    directionCount: {
      get: function () {
        return generate.uniforms.directionCount;
      },
      set: function (value) {
        generate.uniforms.directionCount = value;
      },
    },
    stepCount: {
      get: function () {
        return generate.uniforms.stepCount;
      },
      set: function (value) {
        generate.uniforms.stepCount = value;
      },
    },
    randomTexture: {
      get: function () {
        return generate.uniforms.randomTexture;
      },
      set: function (value) {
        generate.uniforms.randomTexture = value;
      },
    },
    ambientOcclusionOnly: {
      get: function () {
        return ambientOcclusionModulate.uniforms.ambientOcclusionOnly;
      },
      set: function (value) {
        ambientOcclusionModulate.uniforms.ambientOcclusionOnly = value;
      },
    },
  });

  return new PostProcessStageComposite({
    name: "czm_ambient_occlusion",
    stages: [generate, ambientOcclusionModulate],
    inputPreviousStageTexture: false,
    uniforms: uniforms,
  });
};

/**
 * 是否支持环境光遮蔽阶段。
 * <p>
 * 此阶段需要 WEBGL_depth_texture 扩展。
 * </p>
 *
 * @param {Scene} scene 场景。
 * @return {boolean} Whether 支持此后处理阶段。
 *
 * @see {Context#depthTexture}
 * @see {@link http://www.khronos.org/registry/webgl/extensions/WEBGL_depth_texture/|WEBGL_depth_texture}
 */
PostProcessStageLibrary.isAmbientOcclusionSupported = function (scene) {
  return scene.context.depthTexture;
};

const fxaaFS = `#define FXAA_QUALITY_PRESET 39 \n${FXAA3_11}\n${FXAA}`;

/**
 * 创建一个后处理阶段，对输入纹理应用快速近似反锯齿技术（FXAA）。
 * @return {PostProcessStage} A 应用快速近似反锯齿技术的后处理阶段，对输入纹理进行处理。
 *
 * @private
 */
PostProcessStageLibrary.createFXAAStage = function () {
  return new PostProcessStage({
    name: "czm_FXAA",
    fragmentShader: fxaaFS,
    sampleMode: PostProcessStageSampleMode.LINEAR,
  });
};

/**
 * 创建一个后处理阶段，应用 ACES 色调映射运算符。
 * @param {boolean} useAutoExposure 是否使用自动曝光。
 * @return {PostProcessStage} A 应用 ACES 色调映射运算符的后处理阶段。
 * @private
 */
PostProcessStageLibrary.createAcesTonemappingStage = function (
  useAutoExposure,
) {
  let fs = useAutoExposure ? "#define AUTO_EXPOSURE\n" : "";
  fs += AcesTonemapping;
  return new PostProcessStage({
    name: "czm_aces",
    fragmentShader: fs,
    uniforms: {
      autoExposure: undefined,
      exposure: 1.0,
    },
  });
};

/**
 * 创建一个后处理阶段，应用电影风格色调映射运算符。
 * @param {boolean} useAutoExposure 是否使用自动曝光。
 * @return {PostProcessStage} A 应用电影风格色调映射运算符的后处理阶段。
 * @private
 */
PostProcessStageLibrary.createFilmicTonemappingStage = function (
  useAutoExposure,
) {
  let fs = useAutoExposure ? "#define AUTO_EXPOSURE\n" : "";
  fs += FilmicTonemapping;
  return new PostProcessStage({
    name: "czm_filmic",
    fragmentShader: fs,
    uniforms: {
      autoExposure: undefined,
      exposure: 1.0,
    },
  });
};

/**
 * 创建一个后处理阶段，应用电影风格色调映射运算符。
 * @param {boolean} useAutoExposure 是否使用自动曝光。
 * @return {PostProcessStage} A 应用电影风格色调映射运算符的后处理阶段。
 * @private
 */
PostProcessStageLibrary.createPbrNeutralTonemappingStage = function (
  useAutoExposure,
) {
  let fs = useAutoExposure ? "#define AUTO_EXPOSURE\n" : "";
  fs += PbrNeutralTonemapping;
  return new PostProcessStage({
    name: "czm_pbr_neutral",
    fragmentShader: fs,
    uniforms: {
      autoExposure: undefined,
      exposure: 1.0,
    },
  });
};

/**
 * 创建一个后处理阶段，应用 Reinhard 色调映射运算符。
 * @param {boolean} useAutoExposure 是否使用自动曝光。
 * @return {PostProcessStage} A 应用 Reinhard 色调映射运算符的后处理阶段。
 * @private
 */
PostProcessStageLibrary.createReinhardTonemappingStage = function (
  useAutoExposure,
) {
  let fs = useAutoExposure ? "#define AUTO_EXPOSURE\n" : "";
  fs += ReinhardTonemapping;
  return new PostProcessStage({
    name: "czm_reinhard",
    fragmentShader: fs,
    uniforms: {
      autoExposure: undefined,
      exposure: 1.0,
    },
  });
};

/**
 * 创建一个后处理阶段，应用修改后的 Reinhard 色调映射运算符。
 * @param {boolean} useAutoExposure 是否使用自动曝光。
 * @return {PostProcessStage} A 应用修改后的 Reinhard 色调映射运算符的后处理阶段。
 * @private
 */
PostProcessStageLibrary.createModifiedReinhardTonemappingStage = function (
  useAutoExposure,
) {
  let fs = useAutoExposure ? "#define AUTO_EXPOSURE\n" : "";
  fs += ModifiedReinhardTonemapping;
  return new PostProcessStage({
    name: "czm_modified_reinhard",
    fragmentShader: fs,
    uniforms: {
      white: Color.WHITE,
      autoExposure: undefined,
      exposure: 1.0,
    },
  });
};

/**
 * 创建一个后处理阶段，计算输入纹理的平均亮度。
 * @return {PostProcessStage} A 计算输入纹理的平均亮度的后处理阶段。
 * @private
 */
PostProcessStageLibrary.createAutoExposureStage = function () {
  return new AutoExposure();
};

/**
 * 创建一个后处理阶段，以黑白渐变方式渲染输入纹理。
 * <p>
 * 此阶段有一个统一值 <code>gradations</code>，用于调整每个像素的亮度。
 * </p>
 * @return {PostProcessStage} A 以黑白渐变方式渲染输入纹理的后处理阶段。
 */
PostProcessStageLibrary.createBlackAndWhiteStage = function () {
  return new PostProcessStage({
    name: "czm_black_and_white",
    fragmentShader: BlackAndWhite,
    uniforms: {
      gradations: 5.0,
    },
  });
};

/**
 * 创建一个后处理阶段，对输入纹理进行饱和度调整。
 * <p>
 * 此阶段有一个统一值 <code>brightness</code>，用于调整每个像素的饱和度。
 * </p>
 * @return {PostProcessStage} A 对输入纹理进行饱和度调整的后处理阶段。
 */
PostProcessStageLibrary.createBrightnessStage = function () {
  return new PostProcessStage({
    name: "czm_brightness",
    fragmentShader: Brightness,
    uniforms: {
      brightness: 0.5,
    },
  });
};

/**
 * 创建一个后处理阶段，在输入纹理上添加夜视效果。
 * @return {PostProcessStage} A 在输入纹理上添加夜视效果的后处理阶段。
 */
PostProcessStageLibrary.createNightVisionStage = function () {
  return new PostProcessStage({
    name: "czm_night_vision",
    fragmentShader: NightVision,
  });
};

/**
 * 创建一个后处理阶段，用代表每个像素片段深度的黑白纹理替换输入颜色纹理。
 * @return {PostProcessStage} A 用代表每个像素片段深度的黑白纹理替换输入颜色纹理的后处理阶段。
 *
 * @private
 */
PostProcessStageLibrary.createDepthViewStage = function () {
  return new PostProcessStage({
    name: "czm_depth_view",
    fragmentShader: DepthView,
  });
};

/**
 * 创建一个后处理阶段，应用模拟相机镜头光晕效果的效果。
 * <p>
 * 此阶段包含以下统一变量：<code>dirtTexture</code>、<code>starTexture</code>、<code>intensity</code>、<code>distortion</code>、<code>ghostDispersal</code>、<code>haloWidth</code>、<code>dirtAmount</code> 和 <code>earthRadius</code>。
 * <li><code>dirtTexture</code> 是用于模拟镜头上灰尘效果的纹理。</li>
 * <ul>
 * <li><code>dirtTexture</code> is a texture sampled to simulate dirt on the lens.</li>
 * <li><code>starTexture</code> 是用于模拟光晕星状图案的纹理。</li>
 * <li><code>intensity</code> 是一个标量值，乘以光晕效果的结果。默认值为 <code>2.0</code>。</li>
 * <li><code>distortion</code> 是一个标量值，用于影响色散效果。默认值为 <code>10.0</code>。</li>
 * <li><code>ghostDispersal</code> 是一个标量值，表示光晕效果距离纹理中心的距离。默认值为 <code>0.4</code>。</li>
 * <li><code>haloWidth</code> 是一个标量值，表示光晕宽度。其数值由 <code>ghostDispersal</code> 决定，默认值为 <code>0.4</code>。</li>
 * <li><code>dirtAmount</code> 是一个标量值，表示镜头上的灰尘量。默认值为 <code>0.4</code>。</li>
 * <li><code>earthRadius</code> 是地球的最大半径。默认值为 <code>Ellipsoid.WGS84.maximumRadius</code>。</li>
 * </ul>
 * </p>
 * @return {PostProcessStage} A 后处理阶段，用于应用光晕效果。
 */
PostProcessStageLibrary.createLensFlareStage = function () {
  return new PostProcessStage({
    name: "czm_lens_flare",
    fragmentShader: LensFlare,
    uniforms: {
      dirtTexture: buildModuleUrl("Assets/Textures/LensFlare/DirtMask.jpg"),
      starTexture: buildModuleUrl("Assets/Textures/LensFlare/StarBurst.jpg"),
      intensity: 2.0,
      distortion: 10.0,
      ghostDispersal: 0.4,
      haloWidth: 0.4,
      dirtAmount: 0.4,
      earthRadius: Ellipsoid.WGS84.maximumRadius,
    },
  });
};
export default PostProcessStageLibrary;
