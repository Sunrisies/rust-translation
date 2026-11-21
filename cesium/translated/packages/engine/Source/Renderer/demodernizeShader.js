/**
 * Transpiles a [GLSL 3.00]{@link https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf}
 * shader to a [GLSL 1.00]{@link https://registry.khronos.org/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf} shader.
 *
 * 此功能并非旨在提供从 [GLSL 3.00] 到 [GLSL 1.00] 的完整转换，仅支持 CesiumJS 着色器中使用的功能。
 * CesiumJS 着色器内使用的功能均被支持。
 *
 * @private
 *
 * @param {string} input [GLSL 3.00] 着色器。
 * @param {boolean} isFragmentShader 如果此着色器是片段着色器，则返回 true。
 *
 * @return {string}
 */
function demodernizeShader(input, isFragmentShader) {
  let output = input;

  // Remove version string got GLSL 3.00.
  output = output.replaceAll(`version 300 es`, ``);

  // Replace all texture calls with texture2D
  output = output.replaceAll(
    /(texture\()/g,
    `texture2D(`, // Trailing ')' is included in the match group.
  );

  if (isFragmentShader) {
    // Replace the in with varying.
    output = output.replaceAll(
      /\n\s*(in)\s+(vec\d|mat\d|float)/g,
      `\nvarying $2`,
    );

    if (/out_FragData_(\d+)/.test(output)) {
      output = `#extension GL_EXT_draw_buffers : enable\n${output}`;

      // Remove all layout declarations for out_FragData.
      output = output.replaceAll(
        /layout\s+\(location\s*=\s*\d+\)\s*out\s+vec4\s+out_FragData_\d+;/g,
        ``,
      );

      // Replace out_FragData with gl_FragData.
      output = output.replaceAll(/out_FragData_(\d+)/g, `gl_FragData[$1]`);
    }

    // Remove all layout declarations for out_FragColor.
    output = output.replaceAll(
      /layout\s+\(location\s*=\s*0\)\s*out\s+vec4\s+out_FragColor;/g,
      ``,
    );

    // Replace out_FragColor with gl_FragColor.
    output = output.replaceAll(/out_FragColor/g, `gl_FragColor`);
    output = output.replaceAll(/out_FragColor\[(\d+)\]/g, `gl_FragColor[$1]`);

    if (/gl_FragDepth/.test(output)) {
      output = `#extension GL_EXT_frag_depth : enable\n${output}`;
      // Replace gl_FragDepth with gl_FragDepthEXT.
      output = output.replaceAll(/gl_FragDepth/g, `gl_FragDepthEXT`);
    }

    // Enable the EXT_shader_texture_lod extension
    output = `#ifdef GL_EXT_shader_texture_lod\n#extension GL_EXT_shader_texture_lod : enable\n#endif\n${output}`;
    // Enable the OES_standard_derivatives extension
    output = `#ifdef GL_OES_standard_derivatives\n#extension GL_OES_standard_derivatives : enable\n#endif\n${output}`;
  } else {
    // Replace the in with attribute.
    output = output.replaceAll(/(in)\s+(vec\d|mat\d|float)/g, `attribute $2`);

    // Replace the out with varying.
    output = output.replaceAll(
      /(out)\s+(vec\d|mat\d|float)\s+([\w]+);/g,
      `varying $2 $3;`,
    );
  }

  // Add version string for GLSL 1.00.
  output = `#version 100\n${output}`;

  return output;
}

export default demodernizeShader;