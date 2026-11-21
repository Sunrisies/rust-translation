// @ts-check

import { Cartesian3, Check } from "@cesium/core";

/** @import Credit from "./Credit.js"; */
/** @import { GeocoderService } from "./GeocoderService.js"; */

/**
 * 包含经度和纬度坐标以及可选高度的地理编码查询。
 * 查询格式：`longitude latitude (height)`，其中经度和纬度以度为单位，高度以米为单位。
 */
class CartographicGeocoderService {
  /**
   * 在执行地理编码后获取显示权限。通常用于授予
   * 地理编码服务的使用权。
   * @type {Credit|undefined}
   * @readonly
   */
  get credit() {
    return undefined;
  }

  /**
   * @function
   *
   * @param {string} query 需发送给地理编码服务的查询。
   * @returns {Promise<GeocoderService.Result[]>}
   */
  geocode(query) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.string("query", query);
    //>>includeEnd('debug');

    const splitQuery = query.match(/[^\s,\n]+/g);
    if (splitQuery.length === 2 || splitQuery.length === 3) {
      let longitude = +splitQuery[0];
      let latitude = +splitQuery[1];
      const height = splitQuery.length === 3 ? +splitQuery[2] : 300.0;

      if (isNaN(longitude) && isNaN(latitude)) {
        const coordTest = /^(\d+.?\d*)([nsew])/i;
        for (let i = 0; i < splitQuery.length; ++i) {
          const splitCoord = splitQuery[i].match(coordTest);
          if (coordTest.test(splitQuery[i]) && splitCoord.length === 3) {
            if (/^[ns]/i.test(splitCoord[2])) {
              latitude = /^[n]/i.test(splitCoord[2])
                ? +splitCoord[1]
                : -splitCoord[1];
            } else if (/^[ew]/i.test(splitCoord[2])) {
              longitude = /^[e]/i.test(splitCoord[2])
                ? +splitCoord[1]
                : -splitCoord[1];
            }
          }
        }
      }

      if (!isNaN(longitude) && !isNaN(latitude) && !isNaN(height)) {
        const result = {
          displayName: query,
          destination: Cartesian3.fromDegrees(longitude, latitude, height),
        };
        return Promise.resolve([result]);
      }
    }
    return Promise.resolve([]);
  }
}

export default CartographicGeocoderService;
