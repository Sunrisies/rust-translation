/**
 * @typedef {{destroy: Function}} 可销毁
 */

/**
 * 以 [经度, 纬度] 或 [经度, 纬度, 高度] 形式表示的 GeoJSON 位置。
 * @typedef {Array.<number>} GeoJsonPosition
 */

/**
 * GeoJSON 几何对象。
 * @typedef {{type: string, coordinates: (unknown|undefined), geometries: (Array.<GeoJsonGeometry>|undefined)}} GeoJsonGeometry
 */

/**
 * GeoJSON 要素对象。
 * @typedef {{type: string, geometry: (GeoJsonGeometry|null), properties: (Object.<string, *>|null), id: (string|number|undefined)}} GeoJsonFeature
 */

/**
 * GeoJSON 要素集合对象。
 * @typedef {{type: string, features: Array.<GeoJsonFeature>}} GeoJsonFeatureCollection
 */

/**
 * 顶级 GeoJSON 对象（Geometry、Feature 或 FeatureCollection）。
 * @typedef {GeoJsonGeometry|GeoJsonFeature|GeoJsonFeatureCollection} GeoJson
 */

/**
 * 此文件在 'scripts/build.js' 中的 'sourceGlobs' 中未包含，且
 * 必须仅提供类型导出，不得包含运行时值。
 * @ignore
 */
export default null;
