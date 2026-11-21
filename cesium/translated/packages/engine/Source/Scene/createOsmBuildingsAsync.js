import { Color, Frozen, defined } from "@cesium/core";
import Cesium3DTileset from "./Cesium3DTileset.js";
import Cesium3DTileStyle from "./Cesium3DTileStyle.js";

/**
 * Creates a {@link Cesium3DTileset} instance for the
 * {@link https://cesium.com/content/cesium-osm-buildings/|Cesium OSM Buildings}
 * tileset 创建一个 {@link Cesium3DTileset} 实例。
 *
 * @function
 *
 * @param {object} [options] 构建选项。任何由 {@link Cesium3DTileset} 构造函数支持的选项均可在此指定。此外，还支持以下属性：
 * 用于未设置颜色的建筑的默认颜色。如果指定了 <code>options.style</code>，此参数将被忽略。
 * @param {Color} [options.defaultColor=Color.WHITE] 用于 tileset 的样式。如果没有指定，
 * 则使用默认样式，该样式为每个建筑或建筑部分分配一种
 * @param {Cesium3DTileStyle} [options.style] 从其 OpenStreetMap <code>tags</code> 中推断出的颜色。如果无法推断颜色，
 * 则使用 <code>options.defaultColor</code>。
 * 如果为 true，将启用轮廓渲染。可以设置为 false 以避免在加载时对几何图形进行额外处理。
 * 是否显示建筑周围的轮廓。当为 true 时，
 * @param {boolean} [options.enableShowOutline=true] 会显示轮廓。当为 false 时，不显示轮廓。
 * @param {boolean} [options.showOutline=true] // 使用默认样式创建 Cesium OSM Buildings
 * const viewer = new Cesium.Viewer("cesiumContainer");
 * @returns {Promise<Cesium3DTileset>}
 *
 * @see Ion
 *
 * @example
 * try {
 * const tileset = await Cesium.createOsmBuildingsAsync();
 * viewer.scene.primitives.add(tileset));
 * } catch (error) {
 * console.log(`Error creating tileset: ${error}`);
 * } catch (error) {
 * console.log(`Error creating tileset: ${error}`);
 * }
 *
 * @example
 * // Create Cesium OSM Buildings with a custom style highlighting
 * // schools and hospitals.
 * const viewer = new Cesium.Viewer("cesiumContainer");
 * try {
 * const tileset = await Cesium.createOsmBuildingsAsync({
 * style: new Cesium.Cesium3DTileStyle({
 * color: {
 * conditions: [
 * ["${feature['building']} === 'hospital'", "color('#0000FF')"],
 * ["${feature['building']} === 'school'", "color('#00FF00')"],
 * [true, "color('#ffffff')"]
 *         ]
 *       }
 *     })
 *   });
 * viewer.scene.primitives.add(tileset));
 * } catch (error) {
 * console.log(`Error creating tileset: ${error}`);
 * }
 */
async function createOsmBuildingsAsync(options) {
  const tileset = await Cesium3DTileset.fromIonAssetId(96188, options);

  options = options ?? Frozen.EMPTY_OBJECT;

  let style = options.style;

  if (!defined(style)) {
    const color = (options.defaultColor ?? Color.WHITE).toCssColorString();
    style = new Cesium3DTileStyle({
      color: `Boolean(\${feature['cesium#color']}) ? color(\${feature['cesium#color']}) : ${color}`,
    });
  }

  tileset.style = style;

  return tileset;
}

export default createOsmBuildingsAsync;