import { Rectangle, defined } from "@cesium/core";
import sampleTerrainMostDetailed from "../Core/sampleTerrainMostDetailed.js";
import SceneMode from "./SceneMode.js";

/**
 * 计算最终相机位置，以便查看根据当前地形调整后的矩形区域。
 * 如果地形不支持可见性，则使用椭球面上的高度作为参考。
 *
 * @param {Rectangle} rectangle 正在缩放的矩形区域。
 * @param {Scene} scene 正在使用的场景。
 *
 * @returns {Promise<Cartographic>} The 放置相机的理想位置，使整个矩形区域都能被看到。
 *
 * @private
 */
async function computeFlyToLocationForRectangle(rectangle, scene) {
  const terrainProvider = scene.terrainProvider;
  const mapProjection = scene.mapProjection;
  const ellipsoid = mapProjection.ellipsoid;

  let positionWithoutTerrain;
  const tmp = scene.camera.getRectangleCameraCoordinates(rectangle);
  if (scene.mode === SceneMode.SCENE3D) {
    positionWithoutTerrain = ellipsoid.cartesianToCartographic(tmp);
  } else {
    positionWithoutTerrain = mapProjection.unproject(tmp);
  }

  if (!defined(terrainProvider)) {
    return positionWithoutTerrain;
  }

  const availability = terrainProvider.availability;

  if (!defined(availability) || scene.mode === SceneMode.SCENE2D) {
    return positionWithoutTerrain;
  }

  const cartographics = [
    Rectangle.center(rectangle),
    Rectangle.southeast(rectangle),
    Rectangle.southwest(rectangle),
    Rectangle.northeast(rectangle),
    Rectangle.northwest(rectangle),
  ];

  const positionsOnTerrain =
    await computeFlyToLocationForRectangle._sampleTerrainMostDetailed(
      terrainProvider,
      cartographics,
    );

  let heightFound = false;
  const maxHeight = positionsOnTerrain.reduce(function (currentMax, item) {
    if (!defined(item.height)) {
      return currentMax;
    }
    heightFound = true;
    return Math.max(item.height, currentMax);
  }, -Number.MAX_VALUE);

  const finalPosition = positionWithoutTerrain;
  if (heightFound) {
    finalPosition.height += maxHeight;
  }

  return finalPosition;
}

//Exposed for testing.
computeFlyToLocationForRectangle._sampleTerrainMostDetailed =
  sampleTerrainMostDetailed;
export default computeFlyToLocationForRectangle;
