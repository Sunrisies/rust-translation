import { Check } from "@cesium/core";

/**
 * 描述内置实例属性语义的枚举类型。
 *
 * @enum {string}
 *
 * @private
 */
const InstanceAttributeSemantic = {
  /**
   * 每个实例的转换。
   *
   * @type {string}
   * @constant
   */
  TRANSLATION: "TRANSLATION",

  /**
   * 每个实例的旋转角度。
   *
   * @type {string}
   * @constant
   */
  ROTATION: "ROTATION",

  /**
   * 每个实例的缩放比例。
   *
   * @type {string}
   * @constant
   */
  SCALE: "SCALE",

  /**
   * 每个实例的特征 ID。
   *
   * @type {string}
   * @constant
   */
  FEATURE_ID: "_FEATURE_ID",
};

/**
 * 获取与 glTF 属性语义相匹配的实例属性语义。
 *
 * @param {string} gltfSemantic glTF 属性语义。
 * @returns {InstanceAttributeSemantic} The 实例属性语义，若不匹配则视为未定义。
 *
 * @private
 */
InstanceAttributeSemantic.fromGltfSemantic = function (gltfSemantic) {
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
    case "TRANSLATION":
      return InstanceAttributeSemantic.TRANSLATION;
    case "ROTATION":
      return InstanceAttributeSemantic.ROTATION;
    case "SCALE":
      return InstanceAttributeSemantic.SCALE;
    case "_FEATURE_ID":
      return InstanceAttributeSemantic.FEATURE_ID;
  }

  return undefined;
};

Object.freeze(InstanceAttributeSemantic);

export default InstanceAttributeSemantic;
