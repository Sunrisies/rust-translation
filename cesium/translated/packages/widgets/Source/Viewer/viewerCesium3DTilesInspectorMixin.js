import { Check } from "@cesium/core";
import Cesium3DTilesInspector from "../Cesium3DTilesInspector/Cesium3DTilesInspector.js";

/**
 * 一个混入类，用于将 {@link Cesium3DTilesInspector} 控件添加到 {@link Viewer} 控件中。
 * 通常不会直接调用此函数，而是将其作为参数传递给
 * {@link Viewer#extend}，如下例所示。
 * @function
 *
 * @param {Viewer} viewer 查看器实例。
 *
 * @example
 * const viewer = new Cesium.Viewer('cesiumContainer');
 * viewer.extend(Cesium.viewerCesium3DTilesInspectorMixin);
 */
function viewerCesium3DTilesInspectorMixin(viewer) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("viewer", viewer);
  //>>includeEnd('debug');

  const container = document.createElement("div");
  container.className = "cesium-viewer-cesium3DTilesInspectorContainer";
  viewer.container.appendChild(container);
  const cesium3DTilesInspector = new Cesium3DTilesInspector(
    container,
    viewer.scene,
  );

  Object.defineProperties(viewer, {
    cesium3DTilesInspector: {
      get: function () {
        return cesium3DTilesInspector;
      },
    },
  });
}
export default viewerCesium3DTilesInspectorMixin;
