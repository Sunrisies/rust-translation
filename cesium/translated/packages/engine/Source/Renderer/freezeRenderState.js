/**
 * 返回冻结后的 renderState 以及所有对象字面量属性。此函数为深度对象冻结。
 * 忽略名为 “_applyFunctions” 的属性。
 *
 * @private
 *
 * @param {object} renderState
 * @returns {object} Returns 冻结后的 renderState。
 *
 */
function freezeRenderState(renderState) {
  if (typeof renderState !== "object" || renderState === null) {
    return renderState;
  }

  let propName;
  const propNames = Object.keys(renderState);

  for (let i = 0; i < propNames.length; i++) {
    propName = propNames[i];
    if (
      renderState.hasOwnProperty(propName) &&
      propName !== "_applyFunctions"
    ) {
      renderState[propName] = freezeRenderState(renderState[propName]);
    }
  }
  return Object.freeze(renderState);
}
export default freezeRenderState;
