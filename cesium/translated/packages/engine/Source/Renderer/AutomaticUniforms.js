import { Cartesian3, Matrix4, WebGLConstants } from "@cesium/core";

const viewerPositionWCScratch = new Cartesian3();

function AutomaticUniform(options) {
  this._size = options.size;
  this._datatype = options.datatype;
  this.getValue = options.getValue;
}

const datatypeToGlsl = {};
datatypeToGlsl[WebGLConstants.FLOAT] = "float";
datatypeToGlsl[WebGLConstants.FLOAT_VEC2] = "vec2";
datatypeToGlsl[WebGLConstants.FLOAT_VEC3] = "vec3";
datatypeToGlsl[WebGLConstants.FLOAT_VEC4] = "vec4";
datatypeToGlsl[WebGLConstants.INT] = "int";
datatypeToGlsl[WebGLConstants.INT_VEC2] = "ivec2";
datatypeToGlsl[WebGLConstants.INT_VEC3] = "ivec3";
datatypeToGlsl[WebGLConstants.INT_VEC4] = "ivec4";
datatypeToGlsl[WebGLConstants.BOOL] = "bool";
datatypeToGlsl[WebGLConstants.BOOL_VEC2] = "bvec2";
datatypeToGlsl[WebGLConstants.BOOL_VEC3] = "bvec3";
datatypeToGlsl[WebGLConstants.BOOL_VEC4] = "bvec4";
datatypeToGlsl[WebGLConstants.FLOAT_MAT2] = "mat2";
datatypeToGlsl[WebGLConstants.FLOAT_MAT3] = "mat3";
datatypeToGlsl[WebGLConstants.FLOAT_MAT4] = "mat4";
datatypeToGlsl[WebGLConstants.SAMPLER_2D] = "sampler2D";
datatypeToGlsl[WebGLConstants.SAMPLER_CUBE] = "samplerCube";

AutomaticUniform.prototype.getDeclaration = function (name) {
  let declaration = `uniform ${datatypeToGlsl[this._datatype]} ${name}`;

  const size = this._size;
  if (size === 1) {
    declaration += ";";
  } else {
    declaration += `[${size.toString()}];`;
  }

  return declaration;
};

/**
 * @private
 */
const AutomaticUniforms = {
  /**
   * 一个自动生成的 GLSL 统一变量，包含视口 <code>x</code>、<code>y</code>、<code>width</code> 以及 <code>height</code> 属性在 <code>vec4</code> 中的 <code>x</code>、<code>y</code>、<code>z</code> 和 <code>w</code> 分量。
   * // GLSL 声明
   * uniform vec4 czm_viewport;
   *
   * @example
   * // 通过除以视口宽度和高度，将窗口坐标分量缩放到 [0, 1] 范围。
   * vec2 v = gl_FragCoord.xy / czm_viewport.zw;
   *
   * // 将窗口坐标分量除以宽高，以将其缩放到 [0, 1] 范围。
   * // 将归一化设备坐标除以视口宽高，得到窗口坐标。
   * vec2 v = gl_FragCoord.xy / czm_viewport.zw;
   *
   * @see Context#getViewport
   */
  czm_viewport: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC4,
    getValue: function (uniformState) {
      return uniformState.viewportCartesian4;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示一个 4x4 正交投影矩阵，该矩阵将窗口坐标转换为裁剪坐标。裁剪坐标是顶点着色器 <code>gl_Position</code> 输出的坐标系统。
   * 当顶点着色器输入或处理窗口坐标时，此变换非常有用，如 {@link BillboardCollection} 所示。
   * 不要将 {@link czm_viewportTransformation} 与 <code>czm_viewportOrthographic</code> 混淆。
   * <br /><br />
   * 前者将归一化设备坐标转换为窗口坐标；后者将窗口坐标转换为裁剪坐标，常用于赋值给 <code>gl_Position</code>。
   * as done by {@link BillboardCollection}.
   * <br /><br />
   * Do not confuse {@link czm_viewportTransformation} with <code>czm_viewportOrthographic</code>.
   * // 示例
   * gl_Position = czm_viewportOrthographic * vec4(windowPosition, 0.0, 1.0);
   *
   * @example
   * 一个自动生成的 GLSL 统一变量，表示一个 4x4 变换矩阵，该矩阵将归一化设备坐标转换为窗口坐标。使用上下文的整个视口，且深度范围假设为 <code>near = 0</code> 和 <code>far = 1</code>。
   * // GLSL 声明
   *
   * uniform mat4 czm_viewportTransformation;
   * gl_Position = czm_viewportTransformation * vec4(windowPosition, 0.0, 1.0);
   *
   * @see UniformState#viewportOrthographic
   * @see czm_viewport
   * @see czm_viewportTransformation
   * @see BillboardCollection
   */
  czm_viewportOrthographic: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.viewportOrthographic;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示一个 4x4 变换矩阵，该矩阵将归一化设备坐标转换为窗口坐标。使用上下文的整个视口，且深度范围假设为 <code>near = 0</code> 和 <code>far = 1</code>。
   * // GLSL 声明
   * uniform mat4 czm_viewportTransformation;
   * // 将 czm_viewportTransformation 作为从模型到窗口坐标变换的一部分使用。
   * <br /><br />
   * This transform is useful when there is a need to manipulate window coordinates
   * in a vertex shader as done by {@link BillboardCollection}.  In many cases,
   * this matrix will not be used directly; instead, {@link czm_modelToWindowCoordinates}
   * will be used to transform directly from model to window coordinates.
   * <br /><br />
   * Do not confuse <code>czm_viewportTransformation</code> with {@link czm_viewportOrthographic}.
   * The former transforms from normalized device coordinates to window coordinates; the later transforms
   * from window coordinates to clip coordinates, and is often used to assign to <code>gl_Position</code>.
   *
   * @example
   * // GLSL declaration
   * uniform mat4 czm_viewportTransformation;
   *
   * // Use czm_viewportTransformation as part of the
   * // transform from model to window coordinates.
   * vec4 q = czm_modelViewProjection * positionMC;               // 模型到裁剪坐标
   * q.xyz /= q.w;                                                // 裁剪到归一化设备坐标 (ndc)
   * q.xyz = (czm_viewportTransformation * vec4(q.xyz, 1.0)).xyz; // ndc 到窗口坐标
   *
   * @see UniformState#viewportTransformation
   * @see czm_viewport
   * @see czm_viewportOrthographic
   * @see czm_modelToWindowCoordinates
   * @see BillboardCollection
   */
  czm_viewportTransformation: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.viewportTransformation;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示场景的深度
   * 在地球球体渲染之后，并在 3D Tiles 渲染之后更新。
   * 深度被打包到 RGBA 纹理中。
   *
   * @example
   * // GLSL 声明
   * uniform sampler2D czm_globeDepthTexture;
   *
   * // 获取当前片段处的深度
   * vec2 coords = gl_FragCoord.xy / czm_viewport.zw;
   * float depth = czm_unpackDepth(texture(czm_globeDepthTexture, coords));
   */
  czm_globeDepthTexture: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.SAMPLER_2D,
    getValue: function (uniformState) {
      return uniformState.globeDepthTexture;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示包含边缘 ID 的纹理
   * 来自 3D Tiles 边缘渲染阶段。用于边缘检测以及
   * 避免边缘和表面之间的 z 冲突。
   *
   * @example
   * // GLSL 声明
   * uniform sampler2D czm_edgeIdTexture;
   *
   * // 获取当前片段处的边缘 ID
   * vec2 coords = gl_FragCoord.xy / czm_viewport.zw;
   * vec4 edgeId = texture(czm_edgeIdTexture, coords);
   */
  czm_edgeIdTexture: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.SAMPLER_2D,
    getValue: function (uniformState) {
      return uniformState.edgeIdTexture;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含边缘颜色纹理。
   * 该纹理包含在 CESIUM_3D_TILE_EDGES 阶段渲染的边缘内容。
   *
   * @example
   * // GLSL 声明
   * uniform sampler2D czm_edgeColorTexture;
   *
   * // 采样当前片段处的边缘颜色
   * vec2 coords = gl_FragCoord.xy / czm_viewport.zw;
   * vec4 edgeColor = texture(czm_edgeColorTexture, coords);
   */
  czm_edgeColorTexture: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.SAMPLER_2D,
    getValue: function (uniformState) {
      return uniformState.edgeColorTexture;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含由
   * 边缘可见性阶段产生的打包深度纹理。通过 czm_packDepth 打包深度，应通过
   * czm_unpackDepth 解包。
   *
   * @example
   * // GLSL 声明
   * uniform sampler2D czm_edgeDepthTexture;
   *
   * vec2 coords = gl_FragCoord.xy / czm_viewport.zw;
   * float d = czm_unpackDepth(texture(czm_edgeDepthTexture, coords));
   */
  czm_edgeDepthTexture: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.SAMPLER_2D,
    getValue: function (uniformState) {
      return uniformState.edgeDepthTexture;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含由
   * 平面填充预阶段 (BENTLEY_materials_planar_fill) 产生的特征 ID 纹理。非背景
   * 平面填充几何图形在此写入其每个片段的特征 ID，以便
   * 背景填充可以检测现有像素是否属于同一
   * 逻辑对象。
   *
   * @example
   * // GLSL 声明
   * uniform sampler2D czm_planarFillIdTexture;
   *
   * // 采样
   * vec2 coords = gl_FragCoord.xy / czm_viewport.zw;
   * float existingFeatureId = texture(czm_planarFillIdTexture, coords).r;
   */
  czm_planarFillIdTexture: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.SAMPLER_2D,
    getValue: function (uniformState) {
      return uniformState.planarFillIdTexture;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示 4x4 模型变换矩阵，该矩阵
   * 将模型坐标转换为世界坐标。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_model;
   *
   * // 示例
   * vec4 worldPosition = czm_model * modelPosition;
   *
   * @see UniformState#model
   * @see czm_inverseModel
   * @see czm_modelView
   * @see czm_modelViewProjection
   */
  czm_model: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.model;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示 4x4 模型变换矩阵，该矩阵
   * 将世界坐标转换为模型坐标。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_inverseModel;
   *
   * // 示例
   * vec4 modelPosition = czm_inverseModel * worldPosition;
   *
   * @see UniformState#inverseModel
   * @see czm_model
   * @see czm_inverseModelView
   */
  czm_inverseModel: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.inverseModel;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示 4x4 视图变换矩阵，该矩阵
   * 将世界坐标转换为眼睛坐标。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_view;
   *
   * // 示例
   * vec4 eyePosition = czm_view * worldPosition;
   *
   * @see UniformState#view
   * @see czm_viewRotation
   * @see czm_modelView
   * @see czm_viewProjection
   * @see czm_modelViewProjection
   * @see czm_inverseView
   */
  czm_view: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.view;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示 4x4 视图变换矩阵，该矩阵
   * 将 3D 世界坐标转换为眼睛坐标。在 3D 模式下，这与
   * {@link czm_view} 相同，但在 2D 和 Columbus View 中，它表示视图矩阵
   * 仿佛相机在 3D 模式下处于等效位置。这对照明很有帮助
   * 2D 和 Columbus View 的照明方式与 3D 相同。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_view3D;
   *
   * // 示例
   * vec4 eyePosition3D = czm_view3D * worldPosition3D;
   *
   * @see UniformState#view3D
   * @see czm_view
   */
  czm_view3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.view3D;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示 3x3 视图旋转矩阵，该矩阵
   * 将世界坐标下的向量转换为眼睛坐标。
   *
   * @example
   * // GLSL 声明
   * uniform mat3 czm_viewRotation;
   *
   * // 示例
   * vec3 eyeVector = czm_viewRotation * worldVector;
   *
   * @see UniformState#viewRotation
   * @see czm_view
   * @see czm_inverseView
   * @see czm_inverseViewRotation
   */
  czm_viewRotation: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.viewRotation;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示 3x3 视图旋转矩阵，该矩阵
   * 将 3D 世界坐标下的向量转换为眼睛坐标。在 3D 模式下，这与
   * {@link czm_viewRotation} 相同，但在 2D 和 Columbus View 中，它表示视图矩阵
   * 仿佛相机在 3D 模式下处于等效位置。这对照明很有帮助
   * 2D 和 Columbus View 的照明方式与 3D 相同。
   *
   * @example
   * // GLSL 声明
   * uniform mat3 czm_viewRotation3D;
   *
   * // 示例
   * vec3 eyeVector = czm_viewRotation3D * worldVector;
   *
   * @see UniformState#viewRotation3D
   * @see czm_viewRotation
   */
  czm_viewRotation3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.viewRotation3D;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示 4x4 变换矩阵，该矩阵
   * 将眼睛坐标转换为世界坐标。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_inverseView;
   *
   * // 示例
   * vec4 worldPosition = czm_inverseView * eyePosition;
   *
   * @see UniformState#inverseView
   * @see czm_view
   * @see czm_inverseNormal
   */
  czm_inverseView: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.inverseView;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示 4x4 变换矩阵
   * 将3D眼睛坐标转换为世界坐标。在3D模式下，这与
   * {@link czm_inverseView}相同，但在2D和Columbus View模式下表示逆视图矩阵
   * 就像相机处于3D模式中的等效位置一样。这对光照很有用
   * 2D和Columbus View的照明方式与3D相同
   *
   * @example
   * // GLSL声明
   * uniform mat4 czm_inverseView3D;
   *
   * // 示例
   * vec4 worldPosition = czm_inverseView3D * eyePosition;
   *
   * @see UniformState#inverseView3D
   * @see czm_inverseView
   */
  czm_inverseView3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.inverseView3D;
    },
  }),

  /**
   * 一个自动生成的GLSL统一变量，表示3x3旋转矩阵，该矩阵
   * 将向量从眼睛坐标转换为世界坐标。
   *
   * @example
   * // GLSL声明
   * uniform mat3 czm_inverseViewRotation;
   *
   * // 示例
   * vec4 worldVector = czm_inverseViewRotation * eyeVector;
   *
   * @see UniformState#inverseView
   * @see czm_view
   * @see czm_viewRotation
   * @see czm_inverseViewRotation
   */
  czm_inverseViewRotation: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.inverseViewRotation;
    },
  }),

  /**
   * 一个自动生成的GLSL统一变量，表示3x3旋转矩阵，该矩阵
   * 将向量从3D眼睛坐标转换为世界坐标。在3D模式下，这与
   * {@link czm_inverseViewRotation}相同，但在2D和Columbus View模式下表示逆视图矩阵
   * 就像相机处于3D模式中的等效位置一样。这对光照很有用
   * 2D和Columbus View的照明方式与3D相同
   *
   * @example
   * // GLSL声明
   * uniform mat3 czm_inverseViewRotation3D;
   *
   * // 示例
   * vec4 worldVector = czm_inverseViewRotation3D * eyeVector;
   *
   * @see UniformState#inverseView3D
   * @see czm_inverseViewRotation
   */
  czm_inverseViewRotation3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.inverseViewRotation3D;
    },
  }),

  /**
   * 一个自动生成的GLSL统一变量，表示4x4投影变换矩阵，该矩阵
   * 将眼睛坐标转换为裁剪坐标。裁剪坐标是
   * 顶点着色器<code>gl_Position</code>输出的坐标系。
   *
   * @example
   * // GLSL声明
   * uniform mat4 czm_projection;
   *
   * // 示例
   * gl_Position = czm_projection * eyePosition;
   *
   * @see UniformState#projection
   * @see czm_viewProjection
   * @see czm_modelViewProjection
   * @see czm_infiniteProjection
   */
  czm_projection: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.projection;
    },
  }),

  /**
   * 一个自动生成的GLSL统一变量，表示4x4逆投影变换矩阵，该矩阵
   * 将裁剪坐标转换为眼睛坐标。裁剪坐标是
   * 顶点着色器<code>gl_Position</code>输出的坐标系。
   *
   * @example
   * // GLSL声明
   * uniform mat4 czm_inverseProjection;
   *
   * // 示例
   * vec4 eyePosition = czm_inverseProjection * clipPosition;
   *
   * @see UniformState#inverseProjection
   * @see czm_projection
   */
  czm_inverseProjection: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.inverseProjection;
    },
  }),

  /**
   * 一个自动生成的GLSL统一变量，表示4x4投影变换矩阵，其远平面位于无穷远处，
   * 将眼睛坐标转换为裁剪坐标。裁剪坐标是
   * 顶点着色器<code>gl_Position</code>输出的坐标系。使用无限远平面
   * 在阴影体积和带有代理几何的GPU射线投射等算法中，以确保三角形能够正确渲染
   * 不会被远平面裁剪。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_infiniteProjection;
   *
   * // 示例
   * gl_Position = czm_infiniteProjection * eyePosition;
   *
   * @see UniformState#infiniteProjection
   * @see czm_projection
   * @see czm_modelViewInfiniteProjection
   */
  czm_infiniteProjection: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.infiniteProjection;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示一个 4x4 模型-视图变换矩阵，该矩阵
   * 将模型坐标转换为眼睛坐标。
   * <br /><br />
   * 位置应使用 <code>czm_modelView</code> 转换为眼睛坐标，
   * 法线则使用 {@link czm_normal} 进行转换。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_modelView;
   *
   * // 示例
   * vec4 eyePosition = czm_modelView * modelPosition;
   *
   * // 上述方式等同于，但效率更高：
   * vec4 eyePosition = czm_view * czm_model * modelPosition;
   *
   * @see UniformState#modelView
   * @see czm_model
   * @see czm_view
   * @see czm_modelViewProjection
   * @see czm_normal
   */
  czm_modelView: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.modelView;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示一个 4x4 模型-视图变换矩阵，该矩阵
   * 将 3D 模型坐标转换为眼睛坐标。在 3D 模式下，这与
   * {@link czm_modelView} 相同，但在 2D 和 Columbus View 中，它表示模型-视图矩阵
   * 就像相机在 3D 模式下处于相同位置一样。这对于光照很有用
   * 2D 和 Columbus View 的照明方式与 3D 相同。
   * <br /><br />
   * 位置应使用 <code>czm_modelView3D</code> 转换为眼睛坐标，
   * 法线则使用 {@link czm_normal3D} 进行转换。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_modelView3D;
   *
   * // 示例
   * vec4 eyePosition = czm_modelView3D * modelPosition;
   *
   * // 上述方式等同于，但效率更高：
   * vec4 eyePosition = czm_view3D * czm_model * modelPosition;
   *
   * @see UniformState#modelView3D
   * @see czm_modelView
   */
  czm_modelView3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.modelView3D;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示一个 4x4 模型-视图变换矩阵，该矩阵
   * 将相对于眼睛的模型坐标转换为眼睛坐标。此功能
   * 与 {@link czm_translateRelativeToEye} 结合使用。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_modelViewRelativeToEye;
   *
   * // 示例
   * attribute vec3 positionHigh;
   * attribute vec3 positionLow;
   *
   * void main()
   * {
   * vec4 p = czm_translateRelativeToEye(positionHigh, positionLow);
   * gl_Position = czm_projection * (czm_modelViewRelativeToEye * p);
   * }
   *
   * @see czm_modelViewProjectionRelativeToEye
   * @see czm_translateRelativeToEye
   * @see EncodedCartesian3
   */
  czm_modelViewRelativeToEye: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.modelViewRelativeToEye;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示一个 4x4 变换矩阵，该矩阵
   * 将眼睛坐标转换为模型坐标。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_inverseModelView;
   *
   * // 示例
   * vec4 modelPosition = czm_inverseModelView * eyePosition;
   *
   * @see UniformState#inverseModelView
   * @see czm_modelView
   */
  czm_inverseModelView: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.inverseModelView;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示一个 4x4 变换矩阵，该矩阵
   * 将眼睛坐标转换为 3D 模型坐标。在 3D 模式下，这与
   * {@link czm_inverseModelView}，但在2D和Columbus视图中表示逆模型视图矩阵
   * 就像相机在3D模式下位于等效位置一样。这对照明非常有用
   * 2D和Columbus视图的照明方式与3D相同
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_inverseModelView3D;
   *
   * // 示例
   * vec4 modelPosition = czm_inverseModelView3D * eyePosition;
   *
   * @see UniformState#inverseModelView
   * @see czm_inverseModelView
   * @see czm_modelView3D
   */
  czm_inverseModelView3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.inverseModelView3D;
    },
  }),

  /**
   * 一个自动生成的GLSL uniform，表示一个4x4视图-投影变换矩阵，该矩阵
   * 将世界坐标转换为裁剪坐标。裁剪坐标是
   * 顶点着色器<code>gl_Position</code>输出的坐标系统。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_viewProjection;
   *
   * // 示例
   * vec4 gl_Position = czm_viewProjection * czm_model * modelPosition;
   *
   * // 上述方式等同于，但效率更高：
   * gl_Position = czm_projection * czm_view * czm_model * modelPosition;
   *
   * @see UniformState#viewProjection
   * @see czm_view
   * @see czm_projection
   * @see czm_modelViewProjection
   * @see czm_inverseViewProjection
   */
  czm_viewProjection: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.viewProjection;
    },
  }),

  /**
   * 一个自动生成的GLSL uniform，表示一个4x4视图-投影变换矩阵，该矩阵
   * 将裁剪坐标转换为世界坐标。裁剪坐标是
   * 顶点着色器<code>gl_Position</code>输出的坐标系统。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_inverseViewProjection;
   *
   * // 示例
   * vec4 worldPosition = czm_inverseViewProjection * clipPosition;
   *
   * @see UniformState#inverseViewProjection
   * @see czm_viewProjection
   */
  czm_inverseViewProjection: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.inverseViewProjection;
    },
  }),

  /**
   * 一个自动生成的GLSL uniform，表示一个4x4模型-视图-投影变换矩阵，该矩阵
   * 将模型坐标转换为裁剪坐标。裁剪坐标是
   * 顶点着色器<code>gl_Position</code>输出的坐标系统。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_modelViewProjection;
   *
   * // 示例
   * vec4 gl_Position = czm_modelViewProjection * modelPosition;
   *
   * // 上述方式等同于，但效率更高：
   * gl_Position = czm_projection * czm_view * czm_model * modelPosition;
   *
   * @see UniformState#modelViewProjection
   * @see czm_model
   * @see czm_view
   * @see czm_projection
   * @see czm_modelView
   * @see czm_viewProjection
   * @see czm_modelViewInfiniteProjection
   * @see czm_inverseModelViewProjection
   */
  czm_modelViewProjection: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.modelViewProjection;
    },
  }),

  /**
   * 一个自动生成的GLSL uniform，表示一个4x4逆模型-视图-投影变换矩阵，该矩阵
   * 将裁剪坐标转换为模型坐标。裁剪坐标是
   * 顶点着色器<code>gl_Position</code>输出的坐标系统。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_inverseModelViewProjection;
   *
   * // 示例
   * vec4 modelPosition = czm_inverseModelViewProjection * clipPosition;
   *
   * @see UniformState#modelViewProjection
   * @see czm_modelViewProjection
   */
  czm_inverseModelViewProjection: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.inverseModelViewProjection;
    },
  }),

  /**
   * 一个自动生成的GLSL uniform，表示一个4x4模型-视图-投影变换矩阵，该矩阵
   * 将相对于眼睛的模型坐标转换为裁剪坐标。裁剪坐标是
   * 顶点着色器 <code>gl_Position</code> 输出的坐标系统。此系统用于
   * 与 {@link czm_translateRelativeToEye} 结合使用。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_modelViewProjectionRelativeToEye;
   *
   * // 示例
   * attribute vec3 positionHigh;
   * attribute vec3 positionLow;
   *
   * void main()
   * {
   * vec4 p = czm_translateRelativeToEye(positionHigh, positionLow);
   * gl_Position = czm_modelViewProjectionRelativeToEye * p;
   * }
   *
   * @see czm_modelViewRelativeToEye
   * @see czm_translateRelativeToEye
   * @see EncodedCartesian3
   */
  czm_modelViewProjectionRelativeToEye: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.modelViewProjectionRelativeToEye;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示一个 4x4 模型-视图-投影变换矩阵，该矩阵将
   * 模型坐标转换为裁剪坐标。裁剪坐标是
   * 顶点着色器 <code>gl_Position</code> 输出的坐标系统。投影矩阵将
   * 远平面置于无穷远处。这在阴影体积和 GPU 射线投射等算法中非常有用，通过
   * 代理几何结构来确保三角形不会被远平面裁剪掉。
   *
   * @example
   * // GLSL 声明
   * uniform mat4 czm_modelViewInfiniteProjection;
   *
   * // 示例
   * vec4 gl_Position = czm_modelViewInfiniteProjection * modelPosition;
   *
   * // 上述代码相当于，但效率更高：
   * gl_Position = czm_infiniteProjection * czm_view * czm_model * modelPosition;
   *
   * @see UniformState#modelViewInfiniteProjection
   * @see czm_model
   * @see czm_view
   * @see czm_infiniteProjection
   * @see czm_modelViewProjection
   */
  czm_modelViewInfiniteProjection: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.modelViewInfiniteProjection;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，指示当前相机是否为正交坐标系。
   *
   * @see UniformState#orthographicIn3D
   */
  czm_orthographicIn3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.orthographicIn3D ? 1 : 0;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示一个 3x3 法线变换矩阵，该矩阵将
   * 模型坐标中的法线向量转换为眼睛坐标。
   * <br /><br />
   * 位置应使用 {@link czm_modelView} 转换为眼睛坐标，
   * 法线应使用 <code>czm_normal</code> 进行转换。
   *
   * @example
   * // GLSL 声明
   * uniform mat3 czm_normal;
   *
   * // 示例
   * vec3 eyeNormal = czm_normal * normal;
   *
   * @see UniformState#normal
   * @see czm_inverseNormal
   * @see czm_modelView
   */
  czm_normal: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.normal;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示一个 3x3 法线变换矩阵，该矩阵将
   * 3D 模型坐标中的法线向量转换为眼睛坐标。
   * 在 3D 模式下，这与
   * {@link czm_normal} 相同，但在 2D 和 Columbus View 中，它表示法线变换矩阵，
   * 如同相机在 3D 模式下处于相同位置。这对于照明非常有用，
   * 2D 和 Columbus View 的照明方式与 3D 相同。
   * <br /><br />
   * 位置应使用 {@link czm_modelView3D} 转换为眼睛坐标，
   * 法线应使用 <code>czm_normal3D</code> 进行转换。
   *
   * @example
   * // GLSL 声明
   * uniform mat3 czm_normal3D;
   *
   * // 示例
   * vec3 eyeNormal = czm_normal3D * normal;
   *
   * @see UniformState#normal3D
   * @see czm_normal
   */
  czm_normal3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.normal3D;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示一个 3x3 法线变换矩阵，该矩阵
   * 将眼睛坐标下的法线向量转换为模型坐标。这
   * 与 {@link czm_normal} 提供的变换相反。
   *
   * @example
   * // GLSL 声明
   * uniform mat3 czm_inverseNormal;
   *
   * // 示例
   * vec3 normalMC = czm_inverseNormal * normalEC;
   *
   * @see UniformState#inverseNormal
   * @see czm_normal
   * @see czm_modelView
   * @see czm_inverseView
   */
  czm_inverseNormal: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.inverseNormal;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示一个 3x3 法线变换矩阵，该矩阵
   * 将眼睛坐标下的法线向量转换为 3D 模型坐标。这
   * 与 {@link czm_normal} 提供的变换相反。
   * 在 3D 模式下，这与
   * {@link czm_inverseNormal} 相同，但在 2D 和 Columbus View 中，它表示逆法线变换
   * 矩阵，就好像相机在 3D 模式下的等效位置。这对照明很有用
   * 2D 和 Columbus View 的照明方式与 3D 相同。
   *
   * @example
   * // GLSL 声明
   * uniform mat3 czm_inverseNormal3D;
   *
   * // 示例
   * vec3 normalMC = czm_inverseNormal3D * normalEC;
   *
   * @see UniformState#inverseNormal3D
   * @see czm_inverseNormal
   */
  czm_inverseNormal3D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.inverseNormal3D;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含眼睛（相机）在椭球上方或下方的米级高度。
   * 。
   *
   * @see UniformState#eyeHeight
   */
  czm_eyeHeight: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.eyeHeight;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含大地经度（<code>x</code>）、
   * 纬度（<code>y</code>）以弧度为单位和高度（<code>z</code>）以米为单位，分别针对眼睛（相机）。<code>z</code> 分量与 {@link czm_eyeHeight} 对应。
   * 该统一变量仅在 {@link SceneMode} 为 <code>SCENE3D</code> 时有效。
   * This uniform is only valid when the {@link SceneMode} is <code>SCENE3D</code>.
   *
   * @example
   * uniform vec3 czm_eyeCartographic;
   * // 示例
   *
   * float cameraLatitude = czm_eyeCartographic.y;
   * 一个自动生成的 GLSL 统一变量，包含高度（<code>x</code>）和高度平方（<code>y</code>）
   */
  czm_eyeCartographic: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.eyeCartographic;
    },
  }),

  /**
   * 以米为单位，针对眼睛（相机）在 2D 世界平面上的高度。该统一变量仅在
   * {@link SceneMode} 为 <code>SCENE2D</code> 时有效。
   * when the {@link SceneMode} is <code>SCENE2D</code>.
   *
   * @see UniformState#eyeHeight2D
   */
  czm_eyeHeight2D: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC2,
    getValue: function (uniformState) {
      return uniformState.eyeHeight2D;
    },
  }),

  /**
   * 在眼睛（相机）下方的位置，以眼睛坐标表示。
   * 该统一变量仅在 {@link SceneMode} 为 <code>SCENE3D</code> 时有效。
   * This uniform is only valid when the {@link SceneMode} is <code>SCENE3D</code>.
   */
  czm_eyeEllipsoidNormalEC: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.eyeEllipsoidNormalEC;
    },
  }),

  /**
   * .x 分量是主垂直曲率半径（东西方向）
   * .y 是子午线曲率半径（南北方向）
   * 该统一变量仅在 {@link SceneMode} 为 <code>SCENE3D</code> 时有效。
   * This uniform is only valid when the {@link SceneMode} is <code>SCENE3D</code>.
   */
  czm_eyeEllipsoidCurvature: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC2,
    getValue: function (uniformState) {
      return uniformState.eyeEllipsoidCurvature;
    },
  }),

  /**
   * An automatic GLSL uniform containing a 3x3 rotation from eye coordinates to an
   * 以椭球面上的位置为中心的东-北-上坐标系统
   * 相机。
   * 此统一变量仅在 {@link SceneMode} 为 <code>SCENE3D</code> 时有效。
   *
   * @example
   * // GLSL 声明
   * uniform mat3 czm_eyeToEnu;
   *
   * // 示例
   * vec3 enu = czm_eyeToEnu * positionEC;
   */
  czm_eyeToEnu: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.eyeToEnu;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含从模型坐标到以
   * 相机最近的椭球面上的位置为中心的东-北-上坐标系统的变换。
   * 此统一变量仅在 {@link SceneMode} 为 <code>SCENE3D</code> 时有效。
   * This uniform is only valid when the {@link SceneMode} is <code>SCENE3D</code>.
   */
  czm_modelToEnu: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.modelToEnu;
    },
  }),

  /**
   * {@link AutomaticUniforms.czm_modelToEnu}的逆变换。
   * 此统一变量仅在 {@link SceneMode} 为 <code>SCENE3D</code> 时有效。
   * This uniform is only valid when the {@link SceneMode} is <code>SCENE3D</code>.
   */
  czm_enuToModel: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT4,
    getValue: function (uniformState) {
      return uniformState.enuToModel;
    },
  }),

  /**
   * 由相机定义的视锥体的距离。这是最大的可能视锥体，而非用于多视锥渲染的单个
   * 视锥体。
   * 此统一变量用于多视锥渲染。
   *
   * @example
   * // GLSL 声明
   * uniform vec2 czm_entireFrustum;
   *
   * // 示例
   * float frustumLength = czm_entireFrustum.y - czm_entireFrustum.x;
   *
   * @see UniformState#entireFrustum
   * @see czm_currentFrustum
   */
  czm_entireFrustum: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC2,
    getValue: function (uniformState) {
      return uniformState.entireFrustum;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含近距 (<code>x</code>)和远距(<code>y</code>)
   * 由相机定义的视锥体的距离。这是用于多视锥渲染的单个
   * 视锥体。
   *
   * @example
   * // GLSL 声明
   * uniform vec2 czm_currentFrustum;
   *
   * // 示例
   * float frustumLength = czm_currentFrustum.y - czm_currentFrustum.x;
   *
   * @see UniformState#currentFrustum
   * @see czm_entireFrustum
   */
  czm_currentFrustum: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC2,
    getValue: function (uniformState) {
      return uniformState.currentFrustum;
    },
  }),

  /**
   * 到视锥体平面的距离。顶部、底部、左侧和右侧的距离分别是
   * x、y、z 和 w 分量。
   */
  czm_frustumPlanes: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC4,
    getValue: function (uniformState) {
      return uniformState.frustumPlanes;
    },
  }),

  /**
   * 获取远平面与近平面的距离加上 1.0。
   */
  czm_farDepthFromNearPlusOne: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.farDepthFromNearPlusOne;
    },
  }),

  /**
   * 获取 {@link AutomaticUniforms#czm_farDepthFromNearPlusOne}的log2值。
   */
  czm_log2FarDepthFromNearPlusOne: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.log2FarDepthFromNearPlusOne;
    },
  }),

  /**
   * 获取 1.0 除以 {@link AutomaticUniforms#czm_log2FarDepthFromNearPlusOne}的结果。
   */
  czm_oneOverLog2FarDepthFromNearPlusOne: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.oneOverLog2FarDepthFromNearPlusOne;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示世界坐标下的太阳位置。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_sunPositionWC;
   *
   * @see UniformState#sunPositionWC
   * @see czm_sunPositionColumbusView
   * @see czm_sunDirectionWC
   */
  czm_sunPositionWC: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.sunPositionWC;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示哥伦布视图世界坐标下的太阳位置。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_sunPositionColumbusView;
   *
   * @see UniformState#sunPositionColumbusView
   * @see czm_sunPositionWC
   */
  czm_sunPositionColumbusView: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.sunPositionColumbusView;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示眼睛坐标下太阳的归一化方向。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_sunDirectionEC;
   *
   * // 示例
   * float diffuse = max(dot(czm_sunDirectionEC, normalEC), 0.0);
   *
   * @see UniformState#sunDirectionEC
   * @see czm_moonDirectionEC
   * @see czm_sunDirectionWC
   */
  czm_sunDirectionEC: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.sunDirectionEC;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示世界坐标下太阳的归一化方向。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_sunDirectionWC;
   *
   * // 示例
   * float diffuse = max(dot(czm_sunDirectionWC, normalWC), 0.0);
   *
   * @see UniformState#sunDirectionWC
   * @see czm_sunPositionWC
   * @see czm_sunDirectionEC
   */
  czm_sunDirectionWC: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.sunDirectionWC;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示眼睛坐标下月球的归一化方向。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_moonDirectionEC;
   *
   * // 示例
   * float diffuse = max(dot(czm_moonDirectionEC, normalEC), 0.0);
   *
   * @see UniformState#moonDirectionEC
   * @see czm_sunDirectionEC
   */
  czm_moonDirectionEC: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.moonDirectionEC;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示眼睛坐标下场景光源的归一化方向。
   * 该变量常用于方向性光照计算。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_lightDirectionEC;
   *
   * // 示例
   * float diffuse = max(dot(czm_lightDirectionEC, normalEC), 0.0);
   *
   * @see UniformState#lightDirectionEC
   * @see czm_lightDirectionWC
   */
  czm_lightDirectionEC: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.lightDirectionEC;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示世界坐标下场景光源的归一化方向。
   * 该变量常用于方向性光照计算。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_lightDirectionWC;
   *
   * // 示例
   * float diffuse = max(dot(czm_lightDirectionWC, normalWC), 0.0);
   *
   * @see UniformState#lightDirectionWC
   * @see czm_lightDirectionEC
   */
  czm_lightDirectionWC: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.lightDirectionWC;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示场景光源发出的光颜色。这
   * 相当于光颜色乘以光强度，且最大亮度限制为 1.0。
   * 适用于非 HDR 光照。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_lightColor;
   *
   * // 示例
   * vec3 diffuseColor = czm_lightColor * max(dot(czm_lightDirectionWC, normalWC), 0.0);
   *
   * @see UniformState#lightColor
   * @see czm_lightColorHdr
   */
  czm_lightColor: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.lightColor;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示场景光源发出的高动态范围光颜色。这
   * 相当于光颜色乘以适合 HDR 光照的光强度。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_lightColorHdr;
   *
   * // 示例
   * vec3 diffuseColor = czm_lightColorHdr * max(dot(czm_lightDirectionWC, normalWC), 0.0);
   *
   * @see UniformState#lightColorHdr
   * @see czm_lightColor
   */
  czm_lightColorHdr: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.lightColorHdr;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示模型坐标中相机位置的高位信息。这
   * 用于 GPU RTE，以在渲染时消除抖动伪影。
   * 如 {@link http://help.agi.com/AGIComponents/html/BlogPrecisionsPrecisions.htm|Precisions, Precisions} 所述。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_encodedCameraPositionMCHigh;
   *
   * @see czm_encodedCameraPositionMCLow
   * @see czm_modelViewRelativeToEye
   * @see czm_modelViewProjectionRelativeToEye
   */
  czm_encodedCameraPositionMCHigh: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.encodedCameraPositionMCHigh;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示模型坐标中相机位置的低位信息。这
   * 用于 GPU RTE，以在渲染时消除抖动伪影。
   * 如 {@linkhttp://help.agi.com/AGIComponents/html/BlogPrecisionsPrecisions.htm|Precisions, Precisions}所述。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_encodedCameraPositionMCLow;
   *
   * @see czm_encodedCameraPositionMCHigh
   * @see czm_modelViewRelativeToEye
   * @see czm_modelViewProjectionRelativeToEye
   */
  czm_encodedCameraPositionMCLow: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.encodedCameraPositionMCLow;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示观察者（相机）在世界坐标中的位置。
   *
   * @example
   * // GLSL 声明
   * uniform vec3 czm_viewerPositionWC;
   */
  czm_viewerPositionWC: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return Matrix4.getTranslation(
        uniformState.inverseView,
        viewerPositionWCScratch,
      );
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示帧号。该 uniform 会自动递增
   * 每帧一次。
   *
   * @example
   * // GLSL 声明
   * uniform float czm_frameNumber;
   */
  czm_frameNumber: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.frameState.frameNumber;
    },
  }),

  /**
   * 一个自动生成的 GLSL uniform，表示当前 2D/Columbus View 与 3D 之间的形态过渡时间，其中 0.0 表示 2D 或 Columbus View，1.0 表示 3D。
   * // GLSL 声明
   *
   * @example
   * uniform float czm_morphTime;
   * // 示例
   *
   * vec4 p = czm_columbusViewMorph(position2D, position3D, czm_morphTime);
   * 一个自动生成的 GLSL uniform，表示当前的 {@link SceneMode}，以
   */
  czm_morphTime: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.frameState.morphTime;
    },
  }),

  /**
   * An automatic GLSL uniform representing the current {@link SceneMode}, expressed
   * // GLSL 声明
   *
   * @example
   * uniform float czm_sceneMode;
   * // 示例
   *
   * if (czm_sceneMode == czm_sceneMode2D)
   * eyeHeightSq = czm_eyeHeight2D.y;
   * {
   * 一个自动生成的 GLSL uniform，表示当前渲染通道。
   * }
   *
   * @see czm_sceneMode2D
   * @see czm_sceneModeColumbusView
   * @see czm_sceneMode3D
   * @see czm_sceneModeMorphing
   */
  czm_sceneMode: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.frameState.mode;
    },
  }),

  /**
   * // GLSL 声明
   *
   * @example
   * uniform float czm_pass;
   * // 示例
   *
   * if ((czm_pass == czm_passTranslucent) && isOpaque())
   * gl_Position *= 0.0; // 在半透明通道中剔除不透明几何图形
   * {
   * 一个自动生成的 GLSL uniform，表示当前场景背景颜色。
   * }
   */
  czm_pass: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.pass;
    },
  }),

  /**
   * // GLSL 声明
   *
   * @example
   * uniform vec4 czm_backgroundColor;
   * // 示例：如果给定颜色的 RGB 与背景颜色匹配，则将其反转。
   *
   * vec4 adjustColorForContrast(vec4 color)
   * if (czm_backgroundColor.rgb == color.rgb)
   * {
   * color.rgb = vec3(1.0) - color.rgb;
   *     {
   * return color;
   *     }
   *
   * 一个自动生成的 GLSL uniform，包含用于基于图像的照明计算的 BRDF 查找纹理。
   * }
   */
  czm_backgroundColor: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC4,
    getValue: function (uniformState) {
      return uniformState.backgroundColor;
    },
  }),

  /**
   * // GLSL 声明
   *
   * @example
   * uniform sampler2D czm_brdfLut;
   * // 示例：对于给定的粗糙度和 NdotV 值，在红色和绿色通道中查找材料的 BRDF 信息
   *
   * float roughness = 0.5;
   * float NdotV = dot(normal, view);
   * vec2 brdfLut = texture(czm_brdfLut, vec2(NdotV, roughness)).rg;
   * 一个自动生成的 GLSL uniform，包含场景中的环境映射。
   */
  czm_brdfLut: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.SAMPLER_2D,
    getValue: function (uniformState) {
      return uniformState.brdfLut;
    },
  }),

  /**
   * // GLSL 声明
   *
   * @example
   * uniform samplerCube czm_environmentMap;
   * // 示例：在模型上创建环境映射的完美反射效果
   *
   * float reflected = reflect(view, normal);
   * vec4 reflectedColor = texture(czm_environmentMap, reflected);
   * vec4 reflectedColor = texture(czm_environmentMap, reflected);
   */
  czm_environmentMap: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.SAMPLER_CUBE,
    getValue: function (uniformState) {
      return uniformState.environmentMap;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含场景中使用的镜面环境立方体贴图。
   *
   * @example
   * // GLSL 声明
   * uniform samplerCube czm_specularEnvironmentMaps;
   */
  czm_specularEnvironmentMaps: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.SAMPLER_CUBE,
    getValue: function (uniformState) {
      return uniformState.specularEnvironmentMaps;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含场景中使用的镜面环境立方体贴图的最大有效细节级别。
   *
   * @example
   * // GLSL 声明
   * uniform float czm_specularEnvironmentMapsMaximumLOD;
   */
  czm_specularEnvironmentMapsMaximumLOD: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.specularEnvironmentMapsMaximumLOD;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，包含场景中使用的球谐系数。
   *
   * @example
   * // GLSL 声明
   * uniform vec3[9] czm_sphericalHarmonicCoefficients;
   */
  czm_sphericalHarmonicCoefficients: new AutomaticUniform({
    size: 9,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.sphericalHarmonicCoefficients;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示将
   * 从真赤道平均分点 (TEME) 轴转换为当前场景时间下的伪固定轴的三阶旋转矩阵。
   *
   * @example
   * // GLSL 声明
   * uniform mat3 czm_temeToPseudoFixed;
   *
   * // 示例
   * vec3 pseudoFixed = czm_temeToPseudoFixed * teme;
   *
   * @see UniformState#temeToPseudoFixedMatrix
   * @see Transforms.computeTemeToPseudoFixedMatrix
   */
  czm_temeToPseudoFixed: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_MAT3,
    getValue: function (uniformState) {
      return uniformState.temeToPseudoFixedMatrix;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一变量，表示画布坐标空间与画布像素空间的比率。
   *
   * @example
   * uniform float czm_pixelRatio;
   */
  czm_pixelRatio: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.pixelRatio;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一标量，用于根据与相机的距离混合颜色与雾色。
   *
   * @see czm_fog
   */
  czm_fogDensity: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.fogDensity;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一标量，用于根据与相机的距离混合颜色与雾色。
   *
   * @see czm_fog
   */
  czm_fogVisualDensityScalar: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.fogVisualDensityScalar;
    },
  }),

  /**
   * 一个自动生成的 GLSL 统一标量，用于在动态照明应用于雾时设置最小亮度。
   *
   * @see czm_fog
   */
  czm_fogMinimumBrightness: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.fogMinimumBrightness;
    },
  }),

  /**
   * 一个自动生成的统一变量，表示大气在 HSB 颜色空间中的颜色偏移。
   *
   * @example
   * uniform vec3 czm_atmosphereHsbShift;
   */
  czm_atmosphereHsbShift: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.atmosphereHsbShift;
    },
  }),
  /**
   * 一个自动生成的统一变量，表示用于计算大气颜色的光强度。
   *
   * @example
   * uniform float czm_atmosphereLightIntensity;
   */
  czm_atmosphereLightIntensity: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.atmosphereLightIntensity;
    },
  }),
  /**
   * 一个自动生成的统一变量，表示用于计算大气散射的瑞利散射系数。
   *
   * @example
   * uniform vec3 czm_atmosphereRayleighCoefficient;
   */
  czm_atmosphereRayleighCoefficient: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.atmosphereRayleighCoefficient;
    },
  }),
  /**
   * 一个自动生成的统一变量，表示用于计算大气散射的瑞利尺度高度（以米为单位）。
   *
   * @example
   * uniform vec3 czm_atmosphereRayleighScaleHeight;
   */
  czm_atmosphereRayleighScaleHeight: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.atmosphereRayleighScaleHeight;
    },
  }),
  /**
   * 一个自动生成的统一变量，表示用于计算大气散射的米氏散射系数。
   *
   * @example
   * uniform vec3 czm_atmosphereMieCoefficient;
   */
  czm_atmosphereMieCoefficient: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.atmosphereMieCoefficient;
    },
  }),
  /**
   * 一个自动生成的统一变量，存储用于计算大气散射的米氏尺度高度。
   *
   * @example
   * uniform float czm_atmosphereMieScaleHeight;
   */
  czm_atmosphereMieScaleHeight: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.atmosphereMieScaleHeight;
    },
  }),
  /**
   * 一个自动生成的统一变量，表示用于米氏散射的介质各向异性。
   *
   * @example
   * uniform float czm_atmosphereAnisotropy;
   */
  czm_atmosphereMieAnisotropy: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.atmosphereMieAnisotropy;
    },
  }),

  /**
   * 用于动态光照中使用的光源的自动统一参数。
   *
   * @example
   * uniform float czm_atmosphereDynamicLighting
   */
  czm_atmosphereDynamicLighting: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.atmosphereDynamicLighting;
    },
  }),

  /**
   * 用于在使用分割器渲染时使用的分割器位置的自动 GLSL 统一参数。
   * 该参数以画布相对像素坐标表示。
   *
   * @example
   * // GLSL 声明
   * uniform float czm_splitPosition;
   */
  czm_splitPosition: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.splitPosition;
    },
  }),

  /**
   * 用于表示每米几何容差值的自动 GLSL 统一标量。
   */
  czm_geometricToleranceOverMeter: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.geometricToleranceOverMeter;
    },
  }),

  /**
   * 用于表示在相机处何时禁用板状物体、标签和点的深度测试的自动 GLSL 统一参数。
   * 例如，用于防止与地形发生裁剪。设置为零时，应始终应用深度测试。小于零时，
   * 不应应用深度测试。
   */
  czm_minimumDisableDepthTestDistance: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.minimumDisableDepthTestDistance;
    },
  }),

  /**
   * 用于作为未分类 3D Tiles 高亮颜色的自动 GLSL 统一参数。
   */
  czm_invertClassificationColor: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC4,
    getValue: function (uniformState) {
      return uniformState.invertClassificationColor;
    },
  }),

  /**
   * 用于伽马校正处理的自动 GLSL 统一参数。
   */
  czm_gamma: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT,
    getValue: function (uniformState) {
      return uniformState.gamma;
    },
  }),

  /**
   * 存储椭球半径的自动 GLSL 统一参数。
   */
  czm_ellipsoidRadii: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.ellipsoid.radii;
    },
  }),

  /**
   * 存储椭球逆半径的自动 GLSL 统一参数。
   */
  czm_ellipsoidInverseRadii: new AutomaticUniform({
    size: 1,
    datatype: WebGLConstants.FLOAT_VEC3,
    getValue: function (uniformState) {
      return uniformState.ellipsoid.oneOverRadii;
    },
  }),
};
export default AutomaticUniforms;