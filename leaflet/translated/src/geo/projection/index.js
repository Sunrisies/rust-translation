/*
 * @class Projection

 * 一个包含将世界地理坐标投影到平面（及背面）方法的对象。参见[地图投影](https://en.wikipedia.org/wiki/Map_projection)。
 * a flat surface (and back). See [地图 投影](https://en.wikipedia.org/wiki/Map_projection).

 * @property bounds: Bounds
 * 该投影有效的范围（以 CRS 单位为单位指定）。

 * @method project(latlng: LatLng): Point
 * 将地理坐标转换为二维点。
 * 仅接受实际的 `L.LatLng` 实例，而非数组。

 * @method unproject(point: Point): LatLng
 * `project` 的逆操作。将二维点映射为地理位置。
 * 仅接受实际的 `L.Point` 实例，而非数组。

 * 请注意，这些投影对象不继承自 Leaflet 的 `Class` 对象，
 * 也无法被实例化。此外，新类也不能从它们继承，
 * 并且无法使用 `include` 函数向它们添加方法。

 */

export {LonLat} from './Projection.LonLat';
export {Mercator} from './Projection.Mercator';
export {SphericalMercator} from './Projection.SphericalMercator';
