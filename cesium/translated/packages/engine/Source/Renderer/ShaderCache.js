import { defined, destroyObject } from "@cesium/core";
import ShaderProgram from "./ShaderProgram.js";
import ShaderSource from "./ShaderSource.js";

/**
 * @private
 */
function ShaderCache(context) {
  this._context = context;
  this._shaders = {};
  this._numberOfShaders = 0;
  this._shadersToRelease = {};
}

Object.defineProperties(ShaderCache.prototype, {
  numberOfShaders: {
    get: function () {
      return this._numberOfShaders;
    },
  },
});

/**
     * 从缓存中返回一个着色器程序，或创建并缓存一个新的着色器程序。
     * 给定 GLSL 顶点和片段着色器源代码以及属性位置。
     * <p>
     * 与 {@link ShaderCache#getShaderProgram} 的区别在于，此处用于
     * 替换对着色器程序的现有引用，该引用作为第一个参数传递。
     * </p>
     *
     * @param {object} options 具有以下属性的对象：
     * @param {ShaderProgram} [options.shaderProgram] 被重新分配的着色器程序。
     * @param {string|ShaderSource} options.vertexShaderSource 顶点着色器的 GLSL 源代码。
     * @param {string|ShaderSource} options.fragmentShaderSource 片段着色器的 GLSL 源代码。
     * @param {object} options.attributeLocations 顶点着色器中属性输入的索引。

     * @returns {ShaderProgram} The 已缓存或新创建的着色器程序。
     *
     *
     * @example
     * this._shaderProgram = context.shaderCache.replaceShaderProgram({
     * shaderProgram : this._shaderProgram,
     * vertexShaderSource : vs,
     * fragmentShaderSource : fs,
     * attributeLocations : attributeLocations
     * });
     *
     * @see ShaderCache#getShaderProgram
     */
ShaderCache.prototype.replaceShaderProgram = function (options) {
  if (defined(options.shaderProgram)) {
    options.shaderProgram.destroy();
  }

  return this.getShaderProgram(options);
};

function toSortedJson(dictionary) {
  const sortedKeys = Object.keys(dictionary).sort();
  return JSON.stringify(dictionary, sortedKeys);
}

/**
 * 从缓存中返回一个着色器程序，或创建并缓存一个新的着色器程序，
 * 给定 GLSL 顶点和片段着色器源代码以及属性位置。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {string|ShaderSource} options.vertexShaderSource 顶点着色器的 GLSL 源代码。
 * @param {string|ShaderSource} options.fragmentShaderSource 片段着色器的 GLSL 源代码。
 * @param {object} options.attributeLocations 顶点着色器中属性输入的索引。
 *
 * @returns {ShaderProgram} The 已缓存或新创建的着色器程序。
 */
ShaderCache.prototype.getShaderProgram = function (options) {
  // convert shaders which are provided as strings into ShaderSource objects
  // because ShaderSource handles all the automatic including of built-in functions, etc.

  let vertexShaderSource = options.vertexShaderSource;
  let fragmentShaderSource = options.fragmentShaderSource;
  const attributeLocations = options.attributeLocations;

  if (typeof vertexShaderSource === "string") {
    vertexShaderSource = new ShaderSource({
      sources: [vertexShaderSource],
    });
  }

  if (typeof fragmentShaderSource === "string") {
    fragmentShaderSource = new ShaderSource({
      sources: [fragmentShaderSource],
    });
  }

  // Since ShaderSource.createCombinedXxxShader() can be expensive, use a
  // simpler key for caching. This way, the function does not have to be called
  // for each cache lookup.
  const vertexShaderKey = vertexShaderSource.getCacheKey();
  const fragmentShaderKey = fragmentShaderSource.getCacheKey();
  // Sort the keys in the JSON to ensure a consistent order
  const attributeLocationKey = defined(attributeLocations)
    ? toSortedJson(attributeLocations)
    : "";
  const keyword = `${vertexShaderKey}:${fragmentShaderKey}:${attributeLocationKey}`;

  let cachedShader;
  if (defined(this._shaders[keyword])) {
    cachedShader = this._shaders[keyword];

    // No longer want to release this if it was previously released.
    delete this._shadersToRelease[keyword];
  } else {
    const context = this._context;

    const vertexShaderText =
      vertexShaderSource.createCombinedVertexShader(context);
    const fragmentShaderText =
      fragmentShaderSource.createCombinedFragmentShader(context);

    const shaderProgram = new ShaderProgram({
      gl: context._gl,
      logShaderCompilation: context.logShaderCompilation,
      debugShaders: context.debugShaders,
      vertexShaderSource: vertexShaderSource,
      vertexShaderText: vertexShaderText,
      fragmentShaderSource: fragmentShaderSource,
      fragmentShaderText: fragmentShaderText,
      attributeLocations: attributeLocations,
    });

    cachedShader = {
      cache: this,
      shaderProgram: shaderProgram,
      keyword: keyword,
      derivedKeywords: [],
      count: 0,
    };

    // A shader can't be in more than one cache.
    shaderProgram._cachedShader = cachedShader;
    this._shaders[keyword] = cachedShader;
    ++this._numberOfShaders;
  }

  ++cachedShader.count;
  return cachedShader.shaderProgram;
};

ShaderCache.prototype.replaceDerivedShaderProgram = function (
  shaderProgram,
  keyword,
  options,
) {
  const cachedShader = shaderProgram._cachedShader;
  const derivedKeyword = keyword + cachedShader.keyword;
  const cachedDerivedShader = this._shaders[derivedKeyword];
  if (defined(cachedDerivedShader)) {
    destroyShader(this, cachedDerivedShader);
    const index = cachedShader.derivedKeywords.indexOf(keyword);
    if (index > -1) {
      cachedShader.derivedKeywords.splice(index, 1);
    }
  }

  return this.createDerivedShaderProgram(shaderProgram, keyword, options);
};

ShaderCache.prototype.getDerivedShaderProgram = function (
  shaderProgram,
  keyword,
) {
  const cachedShader = shaderProgram._cachedShader;
  const derivedKeyword = keyword + cachedShader.keyword;
  const cachedDerivedShader = this._shaders[derivedKeyword];
  if (!defined(cachedDerivedShader)) {
    return undefined;
  }

  return cachedDerivedShader.shaderProgram;
};

ShaderCache.prototype.createDerivedShaderProgram = function (
  shaderProgram,
  keyword,
  options,
) {
  const cachedShader = shaderProgram._cachedShader;
  const derivedKeyword = keyword + cachedShader.keyword;

  let vertexShaderSource = options.vertexShaderSource;
  let fragmentShaderSource = options.fragmentShaderSource;
  const attributeLocations = options.attributeLocations;

  if (typeof vertexShaderSource === "string") {
    vertexShaderSource = new ShaderSource({
      sources: [vertexShaderSource],
    });
  }

  if (typeof fragmentShaderSource === "string") {
    fragmentShaderSource = new ShaderSource({
      sources: [fragmentShaderSource],
    });
  }

  const context = this._context;

  const vertexShaderText =
    vertexShaderSource.createCombinedVertexShader(context);
  const fragmentShaderText =
    fragmentShaderSource.createCombinedFragmentShader(context);

  const derivedShaderProgram = new ShaderProgram({
    gl: context._gl,
    logShaderCompilation: context.logShaderCompilation,
    debugShaders: context.debugShaders,
    vertexShaderSource: vertexShaderSource,
    vertexShaderText: vertexShaderText,
    fragmentShaderSource: fragmentShaderSource,
    fragmentShaderText: fragmentShaderText,
    attributeLocations: attributeLocations,
  });

  const derivedCachedShader = {
    cache: this,
    shaderProgram: derivedShaderProgram,
    keyword: derivedKeyword,
    derivedKeywords: [],
    count: 0,
  };

  cachedShader.derivedKeywords.push(keyword);
  derivedShaderProgram._cachedShader = derivedCachedShader;
  this._shaders[derivedKeyword] = derivedCachedShader;
  return derivedShaderProgram;
};

function destroyShader(cache, cachedShader) {
  const derivedKeywords = cachedShader.derivedKeywords;
  const length = derivedKeywords.length;
  for (let i = 0; i < length; ++i) {
    const keyword = derivedKeywords[i] + cachedShader.keyword;
    const derivedCachedShader = cache._shaders[keyword];
    destroyShader(cache, derivedCachedShader);
  }

  delete cache._shaders[cachedShader.keyword];
  cachedShader.shaderProgram.finalDestroy();
}

ShaderCache.prototype.destroyReleasedShaderPrograms = function () {
  const shadersToRelease = this._shadersToRelease;

  for (const keyword in shadersToRelease) {
    if (shadersToRelease.hasOwnProperty(keyword)) {
      const cachedShader = shadersToRelease[keyword];
      destroyShader(this, cachedShader);
      --this._numberOfShaders;
    }
  }

  this._shadersToRelease = {};
};

ShaderCache.prototype.releaseShaderProgram = function (shaderProgram) {
  if (defined(shaderProgram)) {
    const cachedShader = shaderProgram._cachedShader;
    if (cachedShader && --cachedShader.count === 0) {
      this._shadersToRelease[cachedShader.keyword] = cachedShader;
    }
  }
};

ShaderCache.prototype.isDestroyed = function () {
  return false;
};

ShaderCache.prototype.destroy = function () {
  const shaders = this._shaders;
  for (const keyword in shaders) {
    if (shaders.hasOwnProperty(keyword)) {
      shaders[keyword].shaderProgram.finalDestroy();
    }
  }
  return destroyObject(this);
};
export default ShaderCache;
