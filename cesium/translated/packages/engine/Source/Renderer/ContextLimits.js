/**
 * 这些在构造函数中为 {@link Context} 设置。
 *
 * @private
 */
const ContextLimits = {
  _maximumCombinedTextureImageUnits: 0,
  _maximumCubeMapSize: 0,
  _maximumFragmentUniformVectors: 0,
  _maximumTextureImageUnits: 0,
  _maximumRenderbufferSize: 0,
  _maximumTextureSize: 0,
  _maximum3DTextureSize: 0,
  _maximumVaryingVectors: 0,
  _maximumVertexAttributes: 0,
  _maximumVertexTextureImageUnits: 0,
  _maximumVertexUniformVectors: 0,
  _minimumAliasedLineWidth: 0,
  _maximumAliasedLineWidth: 0,
  _minimumAliasedPointSize: 0,
  _maximumAliasedPointSize: 0,
  _maximumViewportWidth: 0,
  _maximumViewportHeight: 0,
  _maximumTextureFilterAnisotropy: 0,
  _maximumDrawBuffers: 0,
  _maximumColorAttachments: 0,
  _maximumSamples: 0,
  _highpFloatSupported: false,
  _highpIntSupported: false,
};

Object.defineProperties(ContextLimits, {
  /**
   * 从顶点和片段着色器中可以使用的纹理单元的最大数量。
   * 此 WebGL 实现使用的着色器。
   * 如果两个着色器访问相同的纹理单元，则视为两个纹理单元。
   * WebGL2 上下文中的最小值为 32，WebGL1 上下文中的最小值为 8。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_COMBINED_TEXTURE_IMAGE_UNITS</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumCombinedTextureImageUnits: {
    get: function () {
      return ContextLimits._maximumCombinedTextureImageUnits;
    },
  },

  /**
   * 此 WebGL 实现支持的立方体贴图的最大宽度和高度近似值。
   * WebGL2 上下文中的最小值为 2048，但大多数桌面和笔记本电脑实现支持更大的尺寸，如 8192。
   * WebGL1 上下文中的最小值为 16。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_CUBE_MAP_TEXTURE_SIZE</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumCubeMapSize: {
    get: function () {
      return ContextLimits._maximumCubeMapSize;
    },
  },

  /**
   * 此 WebGL 实现可以使用的 <code>vec4</code>、<code>ivec4</code> 和 <code>bvec4</code> 的uniform的最大数量。
   * 此 WebGL 实现中片段着色器可以使用的uniform的最大数量。
   * WebGL2 上下文中的最小值为 224，WebGL1 上下文中的最小值为 16。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_FRAGMENT_UNIFORM_VECTORS</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumFragmentUniformVectors: {
    get: function () {
      return ContextLimits._maximumFragmentUniformVectors;
    },
  },

  /**
   * 此 WebGL 实现中片段着色器可以使用的纹理单元的最大数量。
   * WebGL2 上下文中的最小值为 16，WebGL1 上下文中的最小值为 8。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_TEXTURE_IMAGE_UNITS</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumTextureImageUnits: {
    get: function () {
      return ContextLimits._maximumTextureImageUnits;
    },
  },

  /**
   * 此 WebGL 实现支持的渲染缓冲区宽度和高度的最大数量。
   * WebGL2 上下文中的最小值为 2048，但大多数桌面和笔记本电脑实现支持更大的尺寸，如 8192。
   * WebGL1 上下文中的最小值为 1。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_RENDERBUFFER_SIZE</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumRenderbufferSize: {
    get: function () {
      return ContextLimits._maximumRenderbufferSize;
    },
  },

  /**
   * 此 WebGL 实现支持的纹理宽度和高度的最大近似值。
   * WebGL2 上下文中的最小值为 2048，但大多数桌面和笔记本电脑实现支持更大的尺寸，如 8192。
   * WebGL1 上下文中的最小值为 64。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_TEXTURE_SIZE</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumTextureSize: {
    get: function () {
      return ContextLimits._maximumTextureSize;
    },
  },

  /**
   * 此 WebGL2 实现支持的纹理宽度、高度和深度的最大近似值。
   * 最小值为 256，但大多数桌面和笔记本电脑实现支持更大的尺寸，如 2048。
   * WebGL1 上下文不支持 3D 纹理。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_3D_TEXTURE_SIZE</code>。
   */
  maximum3DTextureSize: {
    get: function () {
      return ContextLimits._maximum3DTextureSize;
    },
  },

  /**
   * 此 WebGL 实现支持的 <code>vec4</code> 变量的最大数量。
   * WebGL2 上下文中的最小值为 15，WebGL1 上下文中的最小值为 8。矩阵和数组视为多个 <code>vec4</code>。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_VARYING_VECTORS</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumVaryingVectors: {
    get: function () {
      return ContextLimits._maximumVaryingVectors;
    },
  },

  /**
   * 此 WebGL 实现所支持的 <code>vec4</code> 顶点属性的最大数量。
   * WebGL2 上下文的最小值为 16，WebGL1 上下文的最小值为 8。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_VERTEX_ATTRIBS</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumVertexAttributes: {
    get: function () {
      return ContextLimits._maximumVertexAttributes;
    },
  },

  /**
   * 此 WebGL 实现允许从顶点着色器使用的纹理单元的最大数量。
   * WebGL2 上下文的最小值为 16，WebGL1 上下文的最小值为 0。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_VERTEX_TEXTURE_IMAGE_UNITS</code>。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumVertexTextureImageUnits: {
    get: function () {
      return ContextLimits._maximumVertexTextureImageUnits;
    },
  },

  /**
   * 此 WebGL 实现允许使用的 <code>vec4</code>、<code>ivec4</code> 和 <code>bvec4</code> 以及 uniform 的最大数量。
   * 此 WebGL 实现允许顶点着色器使用的 uniform 的最小数量为 256，WebGL1 上下文中的最小值为 128。
   * <code>MAX_VERTEX_UNIFORM_VECTORS</code>。
   * @memberof ContextLimits
   * @type {number}
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_VERTEX_UNIFORM_VECTORS</code>.
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es2.0/xhtml/glGet.xml|glGet in OpenGL ES 2.0} for WebGL1 上下文。
   */
  maximumVertexUniformVectors: {
    get: function () {
      return ContextLimits._maximumVertexUniformVectors;
    },
  },

  /**
   * 此 WebGL 实现所支持的最小伪影线宽度（以像素为单位）。其最大值为一个。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>ALIASED_LINE_WIDTH_RANGE</code>。
   * @memberof ContextLimits
   * @type {number}
   */
  minimumAliasedLineWidth: {
    get: function () {
      return ContextLimits._minimumAliasedLineWidth;
    },
  },

  /**
   * 此 WebGL 实现所支持的最大伪影线宽度（以像素为单位）。其最小值为一个。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>ALIASED_LINE_WIDTH_RANGE</code>。
   * @memberof ContextLimits
   * @type {number}
   */
  maximumAliasedLineWidth: {
    get: function () {
      return ContextLimits._maximumAliasedLineWidth;
    },
  },

  /**
   * 此 WebGL 实现所支持的最小伪影点大小（以像素为单位）。其最大值为一个。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>ALIASED_POINT_SIZE_RANGE</code>。
   * @memberof ContextLimits
   * @type {number}
   */
  minimumAliasedPointSize: {
    get: function () {
      return ContextLimits._minimumAliasedPointSize;
    },
  },

  /**
   * 此 WebGL 实现所支持的最大伪影点大小（以像素为单位）。其最小值为一个。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>ALIASED_POINT_SIZE_RANGE</code>。
   * @memberof ContextLimits
   * @type {number}
   */
  maximumAliasedPointSize: {
    get: function () {
      return ContextLimits._maximumAliasedPointSize;
    },
  },

  /**
   * 视口的最大支持宽度。其最小值应等于相关画布的可见宽度。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_VIEWPORT_DIMS</code>。
   * @memberof ContextLimits
   * @type {number}
   */
  maximumViewportWidth: {
    get: function () {
      return ContextLimits._maximumViewportWidth;
    },
  },

  /**
   * 视口的最大支持高度。其最小值应等于相关画布的可见高度。
   * @see {@link https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml|glGet in OpenGL ES 3.0} with <code>MAX_VIEWPORT_DIMS</code>。
   * @memberof ContextLimits
   * @type {number}
   */
  maximumViewportHeight: {
    get: function () {
      return ContextLimits._maximumViewportHeight;
    },
  },

  /**
   * 纹理过滤的最大各向异性程度。
   * @memberof ContextLimits
   * @type {number}
   */
  maximumTextureFilterAnisotropy: {
    get: function () {
      return ContextLimits._maximumTextureFilterAnisotropy;
    },
  },

  /**
   * 片段着色器中可以写入的同时输出的最大数量。
   * @memberof ContextLimits
   * @type {number}
   */
  maximumDrawBuffers: {
    get: function () {
      return ContextLimits._maximumDrawBuffers;
    },
  },

  /**
   * 支持的最大颜色附件数量。
   * @memberof ContextLimits
   * @type {number}
   */
  maximumColorAttachments: {
    get: function () {
      return ContextLimits._maximumColorAttachments;
    },
  },

  /**
   * 多采样支持的最大样本数。
   * @memberof ContextLimits
   * @type {number}
   */
  maximumSamples: {
    get: function () {
      return ContextLimits._maximumSamples;
    },
  },

  /**
   * 片段着色器中支持的高精度浮点数（<code>highp</code>）。
   * @memberof ContextLimits
   * @type {boolean}
   */
  highpFloatSupported: {
    get: function () {
      return ContextLimits._highpFloatSupported;
    },
  },

  /**
   * 片段着色器中支持的高精度整数（<code>highp</code>）。
   * @memberof ContextLimits
   * @type {boolean}
   */
  highpIntSupported: {
    get: function () {
      return ContextLimits._highpIntSupported;
    },
  },
});
export default ContextLimits;
