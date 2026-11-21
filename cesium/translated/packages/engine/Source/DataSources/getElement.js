import { DeveloperError } from "@cesium/core";

/**
 * 如果元素是一个字符串，则通过 ID 在 DOM 中查找该元素。否则返回该元素。
 *
 * @internal
 *
 * @exception {DeveloperError} Element 且文档中不存在 id "id" 的节点。
 */
function getElement(element) {
  if (typeof element === "string") {
    const foundElement = document.getElementById(element);

    //>>includeStart('debug', pragmas.debug);
    if (foundElement === null) {
      throw new DeveloperError(
        `Element with id "${element}" does not exist in the document.`,
      );
    }
    //>>includeEnd('debug');

    element = foundElement;
  }
  return element;
}
export default getElement;
