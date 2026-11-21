import { Check } from "@cesium/core";
import VoxelInspector from "../VoxelInspector/VoxelInspector.js";

/**
 * 一个混合类，用于将 {@link VoxelInspector} 控件添加到 {@link Viewer} 控件中。
 * 通常不会直接调用此函数，而是将其作为参数传递给
 * {@link Viewer#extend} 方法，如下例所示。
 * @function
 *
 * @param {Viewer} viewer 查看器实例。
 *
 * @example
 * var viewer = new Cesium.Viewer('cesiumContainer');
 * viewer.extend(Cesium.viewerVoxelInspectorMixin);
 */
function viewerVoxelInspectorMixin(viewer) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("viewer", viewer);
  //>>includeEnd('debug');

  const container = document.createElement("div");
  container.className = "cesium-viewer-voxelInspectorContainer";
  viewer.container.appendChild(container);
  const voxelInspector = new VoxelInspector(container, viewer.scene);

  Object.defineProperties(viewer, {
    voxelInspector: {
      get: function () {
        return voxelInspector;
      },
    },
  });
}
export default viewerVoxelInspectorMixin;
