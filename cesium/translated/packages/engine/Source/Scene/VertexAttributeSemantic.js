import { Check, DeveloperError, defined } from "@cesium/core";

/**
 * 描述内置顶点属性语义的枚举。
 *
 * @enum {string}
 *
 * @private
 */
const VertexAttributeSemantic = {
  /**
   * 每个顶点的位置。
   *
   * @type {string}
   * @constant
   */
  POSITION: "POSITION",

  /**
   * 每个顶点的法线。
   *
   * @type {string}
   * @constant
   */
  NORMAL: "NORMAL",

  /**
   * 每个顶点的切线。
   *
   * @type {string}
   * @constant
   */
  TANGENT: "TANGENT",

  /**
   * 每个顶点的纹理坐标。
   *
   * @type {string}
   * @constant
   */
  TEXCOORD: "TEXCOORD",

  /**
   * 每个顶点的颜色。
   *
   * @type {string}
   * @constant
   */
  COLOR: "COLOR",

  /**
   * 用于蒙皮的每个关节ID。
   *
   * @type {string}
   * @constant
   */
  JOINTS: "JOINTS",

  /**
   * 用于蒙皮的每个关节权重。
   *
   * @type {string}
   * @constant
   */
  WEIGHTS: "WEIGHTS",

  /**
   * 每个顶点的特征ID。
   *
   * @type {string}
   * @constant
   */
  FEATURE_ID: "_FEATURE_ID",
  /**
   * 高斯涂抹比例。
   *
   * @type {string}
   * @constant
   */
  SCALE: "KHR_gaussian_splatting:SCALE",
  /**
   * 高斯涂抹旋转。
   *
   * @type {string}
   * @constant
   */
  ROTATION: "KHR_gaussian_splatting:ROTATION",
  /**
   * 用于线条图案化的每个顶点累积距离。
   *
   * @type {string}
   * @constant
   */
  CUMULATIVE_DISTANCE: "BENTLEY_materials_line_style:CUMULATIVE_DISTANCE",
};

function semanticToVariableName(semantic) {
  switch (semantic) {
    case VertexAttributeSemantic.POSITION:
      return "positionMC";
    case VertexAttributeSemantic.NORMAL:
      return "normalMC";
    case VertexAttributeSemantic.TANGENT:
      return "tangentMC";
    case VertexAttributeSemantic.TEXCOORD:
      return "texCoord";
    case VertexAttributeSemantic.COLOR:
      return "color";
    case VertexAttributeSemantic.JOINTS:
      return "joints";
    case VertexAttributeSemantic.WEIGHTS:
      return "weights";
    case VertexAttributeSemantic.FEATURE_ID:
      return "featureId";
    case VertexAttributeSemantic.SCALE:
      return "scale";
    case VertexAttributeSemantic.ROTATION:
      return "rotation";
    case VertexAttributeSemantic.CUMULATIVE_DISTANCE:
      return "cumulativeDistance";
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError("semantic is not a valid value.");
    //>>includeEnd('debug');
  }
}

/**
 * 返回顶点属性语义是否可以有集合索引。
 *
 * @param {VertexAttributeSemantic} semantic 该语义。
 *
 * @returns {boolean} Whether 该语义是否可以有集合索引。
 *
 * @private
 */
VertexAttributeSemantic.hasSetIndex = function (semantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  switch (semantic) {
    case VertexAttributeSemantic.POSITION:
    case VertexAttributeSemantic.NORMAL:
    case VertexAttributeSemantic.TANGENT:
    case VertexAttributeSemantic.CUMULATIVE_DISTANCE:
      return false;
    case VertexAttributeSemantic.TEXCOORD:
    case VertexAttributeSemantic.COLOR:
    case VertexAttributeSemantic.JOINTS:
    case VertexAttributeSemantic.WEIGHTS:
    case VertexAttributeSemantic.FEATURE_ID:
    case VertexAttributeSemantic.SCALE:
    case VertexAttributeSemantic.ROTATION:
      return true;
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError("semantic is not a valid value.");
    //>>includeEnd('debug');
  }
};

/**
 * 获取与glTF语义匹配的顶点属性语义。
 *
 * @param {string} gltfSemantic glTF语义。
 *
 * @returns {VertexAttributeSemantic|undefined} The 顶点属性语义，如果没有匹配则定义为未定义。
 *
 * @private
 */
VertexAttributeSemantic.fromGltfSemantic = function (gltfSemantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("gltfSemantic", gltfSemantic);
  //>>includeEnd('debug');

  let semantic = gltfSemantic;

  // Strip the set index from the semantic
  const setIndexRegex = /^(\w+)_\d+$/;
  const setIndexMatch = setIndexRegex.exec(gltfSemantic);
  if (setIndexMatch !== null) {
    semantic = setIndexMatch[1];
  }

  switch (semantic) {
    case "POSITION":
      return VertexAttributeSemantic.POSITION;
    case "NORMAL":
      return VertexAttributeSemantic.NORMAL;
    case "TANGENT":
      return VertexAttributeSemantic.TANGENT;
    case "TEXCOORD":
      return VertexAttributeSemantic.TEXCOORD;
    case "COLOR":
      return VertexAttributeSemantic.COLOR;
    case "JOINTS":
      return VertexAttributeSemantic.JOINTS;
    case "WEIGHTS":
      return VertexAttributeSemantic.WEIGHTS;
    case "_FEATURE_ID":
      return VertexAttributeSemantic.FEATURE_ID;
    case "KHR_gaussian_splatting:SCALE":
    case "_SCALE":
      return VertexAttributeSemantic.SCALE;
    case "KHR_gaussian_splatting:ROTATION":
    case "_ROTATION":
      return VertexAttributeSemantic.ROTATION;
    case "BENTLEY_materials_line_style:CUMULATIVE_DISTANCE":
      return VertexAttributeSemantic.CUMULATIVE_DISTANCE;
  }

  return undefined;
};

/**
 * 获取与pnts语义匹配的顶点属性语义。
 *
 * @param {string} pntsSemantic pnts语义。
 *
 * @returns {VertexAttributeSemantic|undefined} The 顶点属性语义，如果没有匹配则定义为未定义。
 *
 * @private
 */
VertexAttributeSemantic.fromPntsSemantic = function (pntsSemantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("pntsSemantic", pntsSemantic);
  //>>includeEnd('debug');

  switch (pntsSemantic) {
    case "POSITION":
    case "POSITION_QUANTIZED":
      return VertexAttributeSemantic.POSITION;
    case "RGBA":
    case "RGB":
    case "RGB565":
      return VertexAttributeSemantic.COLOR;
    case "NORMAL":
    case "NORMAL_OCT16P":
      return VertexAttributeSemantic.NORMAL;
    case "BATCH_ID":
      return VertexAttributeSemantic.FEATURE_ID;
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError("pntsSemantic is not a valid value.");
    //>>includeEnd('debug');
  }
};

/**
 * 获取给定顶点属性的GLSL类型（如vec3或int）。
 * 该语义。
 *
 * @param {VertexAttributeSemantic} semantic 着色器类型。
 *
 * @returns {string} The shader type.
 *
 * @private
 */
VertexAttributeSemantic.getGlslType = function (semantic) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  switch (semantic) {
    case VertexAttributeSemantic.POSITION:
    case VertexAttributeSemantic.NORMAL:
    case VertexAttributeSemantic.TANGENT:
      return "vec3";
    case VertexAttributeSemantic.TEXCOORD:
      return "vec2";
    case VertexAttributeSemantic.COLOR:
      return "vec4";
    case VertexAttributeSemantic.JOINTS:
      return "ivec4";
    case VertexAttributeSemantic.WEIGHTS:
      return "vec4";
    case VertexAttributeSemantic.FEATURE_ID:
      return "int";
    case VertexAttributeSemantic.SCALE:
      return "vec3";
    case VertexAttributeSemantic.ROTATION:
      return "vec4";
    case VertexAttributeSemantic.CUMULATIVE_DISTANCE:
      return "float";
    case VertexAttributeSemantic.OPACITY:
      return "float";
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError("semantic is not a valid value.");
    //>>includeEnd('debug');
  }
};

/**
 * 获取给定语义和集合索引的变量名。
 *
 * @param {VertexAttributeSemantic} semantic 该语义。
 * @param {number} [setIndex] 集合索引。
 *
 * @returns {string} The 变量名。
 *
 * @private
 */
VertexAttributeSemantic.getVariableName = function (semantic, setIndex) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  //>>includeEnd('debug');

  let variableName = semanticToVariableName(semantic);
  if (defined(setIndex)) {
    variableName += `_${setIndex}`;
  }
  return variableName;
};

Object.freeze(VertexAttributeSemantic);

export default VertexAttributeSemantic;
