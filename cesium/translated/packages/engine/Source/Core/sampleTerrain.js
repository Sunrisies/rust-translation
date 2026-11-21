import { Check, defined } from "@cesium/core";

/**
 * 通过向地形提供器请求瓦片并进行采样和插值，为一组 {@link Cartographic} 位置启动地形高度查询。
 * 通过向地形提供器请求瓦片、采样和插值来实现。该插值
 * 与用于在指定层级渲染地形的三角形相匹配。该查询
 * 是异步进行的，因此此函数返回一个承诺，当
 * 查询完成时该承诺才会解决。每个点的高度都会就地修改。如果由于该位置在指定层级没有地形数据，
 * 或者发生其他错误，高度将被设置为 undefined。与
 * or another error occurs, the height is set to undefined.  As is typical of the
 * {@link Cartographic} 类型一样，提供的高度是相对于参考椭球体的高度
 * （如 {@link Ellipsoid.WGS84}），而不是海平面以上的海拔。换句话说，如果在海洋中采样，它不一定为 0.0。此函数需要
 * words, it will not necessarily be 0.0 if sampled in the ocean. This function needs the
 * 地形细节层级作为输入，如果希望获得尽可能精确的地形海拔值（即最大细节层级），请使用 {@link sampleTerrainMostDetailed}。
 * as possible (i.e. with maximum level of detail) use {@link sampleTerrainMostDetailed}.
 *
 * @function sampleTerrain
 *
 * @param {TerrainProvider} terrainProvider 用于查询地形高度的地形细节层级。
 * @param {number} level 用于更新地形高度的位置。
 * @param {Cartographic[]} positions 如果为 true，任何失败的地形瓦片请求都将拒绝承诺。如果为 false，返回的高度将为 undefined。
 * @param {boolean} [rejectOnTileFail=false] 当地形查询完成时，该承诺将解决并返回提供的位置列表。
 * @returns {Promise<Cartographic[]>} A // 查询两个 Cartographic 位置的地形高度
 *
 * @see sampleTerrainMostDetailed
 *
 * @example
 * // 查询两个 Cartographic 位置的地形高度
 * const terrainProvider = await Cesium.createWorldTerrainAsync();
 * const positions = [
 * Cesium.Cartographic.fromDegrees(86.925145, 27.988257),
 * Cesium.Cartographic.fromDegrees(87.0, 28.0)
 * ];
 * const updatedPositions = await Cesium.sampleTerrain(terrainProvider, 11, positions);
 * // positions[0].height 和 positions[1].height 已更新。
 * // updatedPositions 只是 positions 的引用。
 *
 * // 要处理瓦片错误，请将 rejectOnTileFail 参数设置为 true。
 * try {
 * const updatedPositions = await Cesium.sampleTerrain(terrainProvider, 11, positions, true);
 * } catch (error) {
 * // 发生了瓦片请求错误。
 * }
 */
async function sampleTerrain(
  terrainProvider,
  level,
  positions,
  rejectOnTileFail,
) {
  if (!defined(rejectOnTileFail)) {
    rejectOnTileFail = false;
  }
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("terrainProvider", terrainProvider);
  Check.typeOf.number("level", level);
  Check.typeOf.bool("rejectOnTileFail", rejectOnTileFail);
  Check.defined("positions", positions);
  //>>includeEnd('debug');

  return doSampling(terrainProvider, level, positions, rejectOnTileFail);
}

/**
 * @param {object[]} tileRequests 经过修改的请求列表，第一个请求将尝试执行
 * @param {Array<Promise<void>>} results 用于存放结果承诺的列表
 * @param {boolean} rejectOnTileFail 如果为 true，承诺将被拒绝。如果为 false，返回的高度将为 undefined。
 * @returns {boolean} true 如果请求已发出，且我们愿意立即尝试下一个项目，
 * 否则如果受到限制并需要等待一段时间后再重试，则返回 false。
 *
 * @private
 */
function attemptConsumeNextQueueItem(tileRequests, results, rejectOnTileFail) {
  const tileRequest = tileRequests[0];
  const requestPromise = tileRequest.terrainProvider.requestTileGeometry(
    tileRequest.x,
    tileRequest.y,
    tileRequest.level,
  );

  if (!requestPromise) {
    // getting back undefined instead of a promise indicates we should retry a bit later
    return false;
  }

  let promise;

  if (rejectOnTileFail) {
    promise = requestPromise.then(createInterpolateFunction(tileRequest));
  } else {
    promise = requestPromise
      .then(createInterpolateFunction(tileRequest))
      .catch(createMarkFailedFunction(tileRequest));
  }

  // remove the request we've just done from the queue
  //  and add its promise result to the result list
  tileRequests.shift();
  results.push(promise);

  // indicate we should synchronously attempt the next request as well
  return true;
}

/**
 * 将 window.setTimeout 封装为 Promise
 * @param {number} ms
 * @private
 */
function delay(ms) {
  return new Promise(function (res) {
    setTimeout(res, ms);
  });
}

/**
 * 递归地消耗所有 tileRequests，直到列表为空
 * 并将每个结果的 Promise 放入结果列表中
 * @param {object[]} tileRequests 需要执行的请求列表
 * @param {Array<Promise<void>>} results 将所有结果 Promise 放入的列表
 * @param {boolean} rejectOnTileFail 如果为 true，则 Promise 将被拒绝。如果为 false，返回的高度将为 undefined。
 * @returns {Promise<void>} A 一旦所有请求开始，即会解析的 Promise
 *
 * @private
 */
function drainTileRequestQueue(tileRequests, results, rejectOnTileFail) {
  // nothing left to do
  if (!tileRequests.length) {
    return Promise.resolve();
  }

  // consume an item from the queue, which will
  //  mutate the request and result lists, and return true if we should
  //  immediately attempt to consume the next item as well
  const success = attemptConsumeNextQueueItem(
    tileRequests,
    results,
    rejectOnTileFail,
  );
  if (success) {
    return drainTileRequestQueue(tileRequests, results, rejectOnTileFail);
  }

  // wait a small fixed amount of time first, before retrying the same request again
  return delay(100).then(() => {
    return drainTileRequestQueue(tileRequests, results, rejectOnTileFail);
  });
}

function doSampling(terrainProvider, level, positions, rejectOnTileFail) {
  const tilingScheme = terrainProvider.tilingScheme;

  let i;

  // Sort points into a set of tiles
  const tileRequests = []; // Result will be an Array as it's easier to work with
  const tileRequestSet = {}; // A unique set
  for (i = 0; i < positions.length; ++i) {
    const xy = tilingScheme.positionToTileXY(positions[i], level);
    if (!defined(xy)) {
      continue;
    }

    const key = xy.toString();

    if (!tileRequestSet.hasOwnProperty(key)) {
      // When tile is requested for the first time
      const value = {
        x: xy.x,
        y: xy.y,
        level: level,
        tilingScheme: tilingScheme,
        terrainProvider: terrainProvider,
        positions: [],
      };
      tileRequestSet[key] = value;
      tileRequests.push(value);
    }

    // Now append to array of points for the tile
    tileRequestSet[key].positions.push(positions[i]);
  }

  // create our list of result promises to be filled
  const tilePromises = [];
  return drainTileRequestQueue(
    tileRequests,
    tilePromises,
    rejectOnTileFail,
  ).then(function () {
    // now all the required requests have been started
    //  we just wait for them all to finish
    return Promise.all(tilePromises).then(function () {
      return positions;
    });
  });
}

/**
 * 针对给定的 {@link TerrainData} 和 {@link Cartographic}，调用 {@link TerrainData#interpolateHeight} 方法
 * 如果返回值不为 undefined，则设置 height 属性
 *
 * 如果返回值为 false，表示应首先调用 {@link TerrainData#createMesh}。
 * @param {Cartographic} position 用于插值的位置以及要分配的高度值
 * @param {TerrainData} terrainData
 * @param {Rectangle} rectangle
 * @returns {boolean} If 实际已插值并分配好的高度
 * @private
 */
function interpolateAndAssignHeight(position, terrainData, rectangle) {
  const height = terrainData.interpolateHeight(
    rectangle,
    position.longitude,
    position.latitude,
  );
  if (height === undefined) {
    // if height comes back as undefined, it may implicitly mean the terrain data
    //  requires us to call TerrainData.createMesh() first (ArcGIS requires this in particular)
    //  so we'll return false and do that next!
    return false;
  }
  position.height = height;
  return true;
}

function createInterpolateFunction(tileRequest) {
  const tilePositions = tileRequest.positions;
  const rectangle = tileRequest.tilingScheme.tileXYToRectangle(
    tileRequest.x,
    tileRequest.y,
    tileRequest.level,
  );
  return function (terrainData) {
    let isMeshRequired = false;
    for (let i = 0; i < tilePositions.length; ++i) {
      const position = tilePositions[i];
      const isHeightAssigned = interpolateAndAssignHeight(
        position,
        terrainData,
        rectangle,
      );
      // we've found a position which returned undefined - hinting to us
      //  that we probably need to create a mesh for this terrain data.
      // so break out of this loop and create the mesh - then we'll interpolate all the heights again
      if (!isHeightAssigned) {
        isMeshRequired = true;
        break;
      }
    }

    if (!isMeshRequired) {
      // all position heights were interpolated - we don't need the mesh
      return Promise.resolve();
    }

    // create the mesh - and interpolate all the positions again
    // note: terrain exaggeration is not passed in - we are only interested in the raw data
    return terrainData
      .createMesh({
        tilingScheme: tileRequest.tilingScheme,
        x: tileRequest.x,
        y: tileRequest.y,
        level: tileRequest.level,
        // don't throttle this mesh creation because we've asked to sample these points;
        //  so sample them! We don't care how many tiles that is!
        throttle: false,
      })
      .then(function () {
        // mesh has been created - so go through every position (maybe again)
        //  and re-interpolate the heights - presumably using the mesh this time
        for (let i = 0; i < tilePositions.length; ++i) {
          const position = tilePositions[i];
          // if it doesn't work this time - that's fine, we tried.
          interpolateAndAssignHeight(position, terrainData, rectangle);
        }
      });
  };
}

function createMarkFailedFunction(tileRequest) {
  const tilePositions = tileRequest.positions;
  return function () {
    for (let i = 0; i < tilePositions.length; ++i) {
      const position = tilePositions[i];
      position.height = undefined;
    }
  };
}

export default sampleTerrain;