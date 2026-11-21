import {
  Cartesian3,
  Cartesian4,
  Cartographic,
  Check,
  Frozen,
  Math as CesiumMath,
  Matrix4,
  RuntimeError,
  defined,
} from "@cesium/core";
import Ion from "./Ion.js";
import IonResource from "./IonResource.js";
import IonSnapMode from "./IonSnapMode.js";
import Resource from "./Resource.js";

/**
 * 将 ion REST API 返回的 WGS84 度坐标点对象转换为
 * Cartesian3 格式，若不存在则设为 undefined。
 * @private
 */
function cartesianFromApiPoint(point) {
  if (
    !defined(point) ||
    !defined(point.longitude) ||
    !defined(point.latitude)
  ) {
    return undefined;
  }
  return Cartesian3.fromDegrees(
    point.longitude,
    point.latitude,
    point.height ?? 0.0,
  );
}

/**
 * 将 Cartesian3 (ECEF) 格式转换为 ion REST API 期望的 WGS84 度坐标对象形状。
 * API 期望的格式。
 * @private
 */
function apiPointFromCartesian(cartesian) {
  const carto = Cartographic.fromCartesian(cartesian);
  return {
    longitude: CesiumMath.toDegrees(carto.longitude),
    latitude: CesiumMath.toDegrees(carto.latitude),
    height: carto.height,
  };
}

/**
 * 将 Matrix4 格式转换为 ion REST API 期望的行优先数组格式。
 * 用于 <code>worldToView</code> 方法。
 * @private
 */
function rowsFromMatrix4(matrix) {
  const rows = [];
  const row = new Cartesian4();
  for (let i = 0; i < 4; i++) {
    Matrix4.getRow(matrix, i, row);
    rows.push([row.x, row.y, row.z, row.w]);
  }
  return rows;
}

/**
 * 构建裁剪空间到像素空间（投影式）视口矩阵：
 * <pre>
 * px = (ndcX * 0.5 + 0.5) * width
 * py = (1 - (ndcY * 0.5 + 0.5)) * height   (y-down, top-left origin)
 * pz = ndcZ * 0.5 + 0.5                    ([-1,1] -> [0,1] depth)
 * </pre>
 * @private
 */
function viewportMatrix(width, height, result) {
  return Matrix4.fromRowMajorArray(
    // prettier-ignore
    [
      width / 2, 0, 0, width / 2,
      0, -height / 2, 0, height / 2,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    ],
    result,
  );
}

const scratchViewport = new Matrix4();
const scratchWorldToView = new Matrix4();

/**
 * 成功执行 {@link IonSnapService#snap} 的结果。扩展
 * {@link SnapService.Result} 并添加 ion 特有的字段。
 *
 * @typedef {object} IonSnapService.Result
 * @property {Cartesian3} [snapPoint] 被捕捉的点。这是需要使用的点。
 * @property {Cartesian3} [hitPoint] 光标与几何体的接触点：在捕捉范围内为最近边缘点，否则为光标下的表面点。
 * @property {IonSnapHeat} [heat] 捕捉点与视图空间中的闭合点之间的接近程度。
 * @property {IonSnapGeometryType} [geometryType] 被捕捉的几何体类型。
 * @property {IonSnapParentGeometryType} [parentGeometryType] 被捕捉的父几何体类型。
 * @property {object} [normal] 捕捉点处的表面法线，以模型的局部笛卡尔坐标系表示。
 * @property {object} [curve] 靠近捕捉点的曲线几何体，点以 WGS84 度坐标形式呈现。
 */

/**
 * 提供基于 Cesium ion 3D Tiles 资产的互动式几何捕捉功能。
 * 由 BIM/CAD 数据库模型支持，使用 ion REST API 的元素捕捉功能。
 * 端点。
 *
 * 此类处理源 BIM/CAD 数据库参考框架与视依赖屏幕空间像素坐标之间的转换。
 * 每次捕捉时，均使用 ion 资产的源参考框架、相机变换和画布尺寸进行转换，以确保视依赖特性——如像素孔径、最近位置或表面跟踪——能够正确工作。
 * 此对象通常不直接实例化，请使用 {@link IonSnapService.fromAssetId}。
 * 该特性并非最终定稿，可能根据 Cesium 的标准弃用政策发生变化。
 * const snapper = await Cesium.IonSnapService.fromAssetId(123456);
 * const canvas = viewer.scene.canvas;
 *
 * This object is normally not instantiated directly, use {@link IonSnapService.fromAssetId}.
 *
 * @experimental This elementId: "0x30000000df2",
 *
 * @see Ion
 * @see SnapService
 *
 * @example
 * testPoint: pickedPosition,
 * camera: viewer.camera,
 * canvasWidth: canvas.clientWidth,
 * canvasHeight: canvas.clientHeight,
 * if (Cesium.defined(result)) {
 * console.log("snapped to", result.snapPoint);
 * 对象包含以下属性：
 * canvasHeight: canvas.clientHeight,
 * });
 * if (Cesium.defined(result)) {
 * console.log("snapped to", result.snapPoint);
 * }
 */
class IonSnapService {
  /**
   * @param {object} options Object with the following properties:
   * @param {number} options.assetId 离子资产 ID。
   * @param {Resource} options.resource 资产的 ion API 资源。
   * @param {Matrix4} options.ecefTransform 从源 BIM/CAD 数据库参考框架到世界固定参考框架的 4x4 变换矩阵。
   */
  constructor(options) {
    this._assetId = options.assetId;
    this._resource = options.resource;

    /**
     * 从源 BIM/CAD 数据库参考框架到世界固定参考框架的 4x4 变换矩阵。
     * @type {Matrix4}
     * @readonly
     */
    this.ecefTransform = options.ecefTransform;
  }

  /**
   * 此 snapper 操作的离子资产 ID。
   * @type {number}
   * @readonly
   */
  get assetId() {
    return this._assetId;
  }

  /**
   * 为给定离子资产创建 {@link IonSnapService}，从 ion REST API 获取
   * 资产的 ECEF 变换。
   *
   * @experimental This 该功能尚未最终确定，可能根据 Cesium 的标准弃用政策进行变更。
   *
   * @param {number} assetId 由 BIM/CAD 数据库模型支持的 3D Tiles 资产的离子 ID。
   * @param {object} [options] 具有以下属性的对象：
   * @param {string} [options.accessToken=Ion.defaultAccessToken] 使用的离子访问令牌。
   * @param {string|Resource} [options.server=Ion.defaultServer] 使用的 ion API 服务器。
   * @returns {Promise<IonSnapService>} A 绑定到该资产的 snapper。
   *
   * @exception {RuntimeError} The 资产没有地理定位，因此无法进行视图正确的捕捉。
   */
  static async fromAssetId(assetId, options) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number("assetId", assetId);
    //>>includeEnd('debug');

    options = options ?? Frozen.EMPTY_OBJECT;
    const accessToken = options.accessToken ?? Ion.defaultAccessToken;
    const server = Resource.createIfNeeded(options.server ?? Ion.defaultServer);
    server.appendForwardSlash();

    const resourceOptions = {
      // Trailing slash so derived resource urls resolve under the asset id.
      url: `assets/${assetId}/`,
      headers: IonResource._addClientHeaders(),
    };
    if (defined(accessToken)) {
      resourceOptions.queryParameters = { access_token: accessToken };
    }
    const resource = server.getDerivedResource(resourceOptions);

    const ecefResponse = await resource
      .getDerivedResource({ url: "ecef" })
      .fetchJson();

    if (!defined(ecefResponse?.ecefTransform)) {
      throw new RuntimeError(
        `Cesium ion asset ${assetId} is not geolocated; snapping requires geolocation`,
      );
    }

    const ecefTransform = Matrix4.fromRowMajorArray(
      ecefResponse.ecefTransform.flat(),
    );

    return new IonSnapService({
      assetId: assetId,
      resource: resource,
      ecefTransform: ecefTransform,
    });
  }

  /**
   * 计算原生 snapper 所需的世界到视图矩阵：从模型-世界坐标到视图（CSS 像素）坐标的投影变换。
   * 由 <code>V * P * Vm * E</code> 组成，其中
   * 
   * <ul>
   * <li><code>E</code>：模型 -> ECEF（此资产的 {@link IonSnapService#ecefTransform}）</li>
   * <li><code>Vm</code>：ECEF -> 眼睛（<code>camera.viewMatrix</code>）</li>
   * <li><code>P</code>：眼睛 -> 裁剪区域（<code>camera.frustum.projectionMatrix</code>）</li>
   * <li><code>V</code>：裁剪区域 -> 像素（y-down 视口矩阵）</li>
   * </ul>
   * 视口项使用 CSS 像素尺寸，因此像素值的捕捉开口
   * 以 CSS 像素为单位，与显示设备的设备像素比无关。
   *
   * @param {Camera} camera 定义视图的相机。
   * @param {number} canvasWidth 画布的 CSS 像素宽度。
   * @param {number} canvasHeight 画布的 CSS 像素高度。
   * @param {Matrix4} [result] 存储结果的对象。
   * @returns {Matrix4} The 模型-世界到视图（像素）矩阵。
   *
   * @private
   */
  _computeWorldToView(camera, canvasWidth, canvasHeight, result) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("camera", camera);
    Check.typeOf.number("canvasWidth", canvasWidth);
    Check.typeOf.number("canvasHeight", canvasHeight);
    //>>includeEnd('debug');

    result = result ?? new Matrix4();

    const V = viewportMatrix(canvasWidth, canvasHeight, scratchViewport);

    // result = V * P * Vm * E, built up right-to-left
    Matrix4.multiply(camera.viewMatrix, this.ecefTransform, result);
    Matrix4.multiply(camera.frustum.projectionMatrix, result, result);
    return Matrix4.multiply(V, result, result);
  }

  /**
   * 针对该资产的元素请求捕捉。
   *
   * 视图正确的世界到视图矩阵由以下参数组成：
   * <code>options.camera</code>、<code>options.canvasWidth</code> 和
   * <code>options.canvasHeight</code>，以便根据视图进行捕捉（最近
   * 排序、像素开口、表面跟踪）与当前视图匹配。
   *
   * 仅支持 3D 视图：相机必须处于
   * {@link SceneMode.SCENE3D}。
   *
   * @experimental This 该功能尚未最终确定，可能根据 Cesium 的标准弃用政策进行变更。
   *
   * @param {object} options 具有以下属性的对象：
   * @param {string} options.elementId 要捕捉的元素 ID，以十六进制字符串表示，例如 <code>"0x30000000df2"</code>。
   * @param {Cartesian3} options.testPoint 要捕捉的点，通常是选中的光标位置。
   * @param {Camera} options.camera 定义当前视图的相机。必须处于 {@link SceneMode.SCENE3D} 模式下。
   * @param {number} options.canvasWidth Canvas 宽度，以 CSS 像素为单位。
   * @param {number} options.canvasHeight Canvas 高度，以 CSS 像素为单位。
   * @param {Cartesian3} [options.closePoint=options.testPoint] 靠近目标几何体的参考点，用于启动捕捉搜索。
   * @param {number} [options.snapAperture=IonSnapService.DEFAULT_SNAP_APERTURE] 捕捉容差，以 CSS 像素为单位，表示世界到视图输出空间的尺寸。
   * @param {IonSnapMode} [options.snapMode=IonSnapMode.NEAREST] 要执行的捕捉类型。
   * @returns {Promise<IonSnapService.Result|undefined>} The 捕捉结果；如果元素未找到或无法进行捕捉，则返回 <code>undefined</code>。
   */
  async snap(options) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("options", options);
    Check.typeOf.string("options.elementId", options.elementId);
    Check.defined("options.testPoint", options.testPoint);
    Check.defined("options.camera", options.camera);
    Check.typeOf.number("options.canvasWidth", options.canvasWidth);
    Check.typeOf.number("options.canvasHeight", options.canvasHeight);
    //>>includeEnd('debug');

    const worldToView = this._computeWorldToView(
      options.camera,
      options.canvasWidth,
      options.canvasHeight,
      scratchWorldToView,
    );

    const body = {
      testPoint: apiPointFromCartesian(options.testPoint),
      closePoint: apiPointFromCartesian(
        options.closePoint ?? options.testPoint,
      ),
      snapAperture:
        options.snapAperture ?? IonSnapService.DEFAULT_SNAP_APERTURE,
      snapMode: options.snapMode ?? IonSnapMode.NEAREST,
      worldToView: rowsFromMatrix4(worldToView),
    };

    let response;
    try {
      response = await this._resource
        .getDerivedResource({
          url: `elements/${options.elementId}/snap`,
        })
        .post(JSON.stringify(body), {
          headers: {
            "Content-Type": "application/json",
          },
          responseType: "json",
        });
    } catch (error) {
      // The snap endpoint responds 404 when the element does not exist, and
      // 400 with a "No snap possible" message when the element has no
      // snappable geometry or the test point is too far from it. Treat both
      // as "no snap".
      if (error?.statusCode === 404) {
        return undefined;
      }
      if (
        error?.statusCode === 400 &&
        typeof error.response?.message === "string" &&
        error.response.message.includes("No snap possible")
      ) {
        return undefined;
      }
      throw error;
    }

    if (!defined(response)) {
      return undefined;
    }

    const result = {
      heat: response.heat,
      geometryType: response.geomType,
      parentGeometryType: response.parentGeomType,
      normal: response.normal,
      curve: response.curve,
    };
    result.snapPoint = cartesianFromApiPoint(response.snapPoint);
    result.hitPoint = cartesianFromApiPoint(response.hitPoint);
    return result;
  }
}

/**
 * The default snap tolerance used by {@link IonSnapService#snap} when
 * 未提供 <code>options.snapAperture</code> 时，由 {@link IonSnapService#snap} 使用的默认捕捉容差，以 CSS 像素为单位，表示世界到视图输出空间的尺寸。此值在此实现中对应 {@link SnapService} 的
 * world-to-view output space. This is {@link SnapService}'s
 * 该功能尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 *
 * @experimental This feature is not final and is subject to change without Cesium's standard deprecation policy.
 *
 * @type {number}
 * @constant
 */
IonSnapService.DEFAULT_SNAP_APERTURE = 12;

export default IonSnapService;