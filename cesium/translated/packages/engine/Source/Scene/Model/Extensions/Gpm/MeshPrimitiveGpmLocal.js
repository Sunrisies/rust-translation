/**
 * 关于 glTF 基本体的本地通用点云模型信息。
 *
 * @param {PpeTexture[]} ppeTextures 每点误差纹理
 *
 * @constructor
 * @private
 */
function MeshPrimitiveGpmLocal(ppeTextures) {
  this._ppeTextures = ppeTextures;
}

Object.defineProperties(MeshPrimitiveGpmLocal.prototype, {
  /**
   * 一个 ppe 纹理数组。
   *
   * @memberof MeshPrimitiveGpmLocal.prototype
   * @type {PpeTexture[]|undefined}
   * @readonly
   */
  ppeTextures: {
    get: function () {
      return this._ppeTextures;
    },
  },
});

export default MeshPrimitiveGpmLocal;
