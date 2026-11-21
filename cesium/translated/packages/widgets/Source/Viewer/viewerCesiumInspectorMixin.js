import { DeveloperError, defined } from "@cesium/core";
import CesiumInspector from "../CesiumInspector/CesiumInspector.js";

/**
 * 一个混入类，用于将 CesiumInspector 控件添加到 Viewer 控件中。
 * 通常不会直接调用此函数，而是将其作为参数传递给
 * {@link Viewer#extend}，如下例所示。
 * @function
 *
 * @param {Viewer} viewer 观众实例。
 *
 * @exception {DeveloperError} viewer 是必需的。
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=cesium-inspector|Cesium Sandcastle Cesium Inspector Demo}
 *
 * @example
 * const viewer = new Cesium.Viewer('cesiumContainer');
 * viewer.extend(Cesium.viewerCesiumInspectorMixin);
 */
function viewerCesiumInspectorMixin(viewer) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(viewer)) {
    throw new DeveloperError("viewer is required.");
  }
  //>>includeEnd('debug');

  const cesiumInspectorContainer = document.createElement("div");
  cesiumInspectorContainer.className = "cesium-viewer-cesiumInspectorContainer";
  viewer.container.appendChild(cesiumInspectorContainer);
  const cesiumInspector = new CesiumInspector(
    cesiumInspectorContainer,
    viewer.scene,
  );

  Object.defineProperties(viewer, {
    cesiumInspector: {
      get: function () {
        return cesiumInspector;
      },
    },
  });
}
export default viewerCesiumInspectorMixin;
