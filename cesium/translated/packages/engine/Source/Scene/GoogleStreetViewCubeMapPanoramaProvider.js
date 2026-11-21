import {
  Cartesian3,
  Cartographic,
  DeveloperError,
  Ellipsoid,
  FixedFrameTransforms,
  Frozen,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  defined,
} from "@cesium/core";
import Resource from "../Core/Resource.js";
import GoogleMaps from "../Core/GoogleMaps.js";
import CubeMapPanorama from "./CubeMapPanorama.js";

const DEFAULT_TILE_SIZE = 600;

/**
 * <div class="notice">
 * 通常不直接实例化此对象，请使用 {@link GoogleStreetViewCubeMapPanoramaProvider.fromUrl}。
 * </div>
 *
 *
 * 创建一个 {@link PanoramaProvider}，从 {@link https://developers.google.com/maps/documentation/streetview|Google Street View Static API} 提供影像，以在全景图中显示。
 *
 * @alias GoogleStreetViewCubeMapPanoramaProvider
 * @constructor
 *
 * @see CubeMapPanorama
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=google-streetview-panorama|Cesium Sandcastle Google Streetview Panorama}
 *
 */
function GoogleStreetViewCubeMapPanoramaProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  this._key = defined(options.key) ? options.key : GoogleMaps.defaultApiKey;

  this._baseResource = Resource.createIfNeeded(
    options.url ?? GoogleMaps.streetViewStaticApiEndpoint,
  );

  this._metadataResource = this._baseResource.getDerivedResource({
    url: "streetview/metadata",
  });

  this._tileSize = options.tileSize ?? DEFAULT_TILE_SIZE;
}

Object.defineProperties(GoogleStreetViewCubeMapPanoramaProvider.prototype, {});

/**
 * 获取指定位置和方向的全景图原语。
 * @param {object} options 该对象包含以下属性：
 * @param {Cartographic} options.cartographic 将全景图放置在场景中的位置。
 * @param {string} [options.panoId] 在 Google API 中用于识别图像的 panoId 标识符。如果未提供，则根据提供的地图坐标查找该标识符。
 * @param {number} [options.tileSize] - 可选的瓦片尺寸覆盖（方形）。
 * @param {string} [options.signature] - 可选签名用于签名 URL。有关更多信息，请参阅 {@link https://developers.google.com/maps/documentation/streetview/digital-signature}。
 * @param {Credit|string} [options.credit] 显示于画布上的数据源标识。
 *
 * @returns {CubeMapPanorama} The 使用影像纹理化的全景图原语。
 *
 * @example
 *
 * const provider = await Cesium.GoogleStreetViewCubeMapPanoramaProvider.fromUrl({
 * key: '你的 Google Street View Static API 密钥'
 * })
 *
 * const panoIdObject = provider.getNearestPanoId(position);
 * const position = Cartographic.fromDegrees(panoIdObject.location.lng, panoIdObject.location.lat, 0);
 *
 * const primitive = await provider.loadPanorama({
 * cartographic: position,
 * panoId: panoIdObject.panoId
 * });
 * viewer.scene.primitive.add(primitive);
 *
 */
GoogleStreetViewCubeMapPanoramaProvider.prototype.loadPanorama =
  async function (options) {
    const cartographic = options.cartographic;
    //>>includeStart('debug', pragmas.debug);
    if (!defined(options.cartographic)) {
      throw new DeveloperError("options.cartographic is required.");
    }
    //>>includeEnd('debug');

    const tileSize = options.tileSize ?? this._tileSize;
    const tileSizeString = `${tileSize}x${tileSize}`;

    const signature = options.signature;

    let { panoId } = options;

    if (!defined(panoId)) {
      const panoIdObject = await this.getNearestPanoId(cartographic);
      panoId = panoIdObject.panoId;
    }

    const credit = GoogleMaps.getDefaultCredit();

    const posObj = Cartesian3.fromDegrees(
      CesiumMath.toDegrees(cartographic.longitude),
      CesiumMath.toDegrees(cartographic.latitude),
      0,
    );

    const facePromises = [
      this._loadFaceImage({
        heading: 0,
        pitch: 0,
        tileSizeString,
        panoId,
        signature,
      }),
      this._loadFaceImage({
        heading: 180,
        pitch: 0,
        tileSizeString,
        panoId,
        signature,
      }),
      this._loadFaceImage({
        heading: -90,
        pitch: -90,
        tileSizeString,
        panoId,
        signature,
      }),
      this._loadFaceImage({
        heading: -90,
        pitch: 90,
        tileSizeString,
        panoId,
        signature,
      }),
      this._loadFaceImage({
        heading: 270,
        pitch: 0,
        tileSizeString,
        panoId,
        signature,
      }),
      this._loadFaceImage({
        heading: 90,
        pitch: 0,
        tileSizeString,
        panoId,
        signature,
      }),
    ];

    const [positiveX, negativeX, positiveY, negativeY, positiveZ, negativeZ] =
      await Promise.all(facePromises);

    const northDownEastToFixedFrameTransform =
      FixedFrameTransforms.localFrameToFixedFrameGenerator("north", "down");

    const transform = Matrix4.getMatrix3(
      northDownEastToFixedFrameTransform(posObj, Ellipsoid.default),
      new Matrix3(),
    );

    const panorama = new CubeMapPanorama({
      sources: {
        positiveX,
        negativeX,
        positiveY,
        negativeY,
        positiveZ,
        negativeZ,
      },
      transform: transform,
      credit,
    });

    return panorama;
  };

/**
 * 获取给定地图坐标的 panoId。请参阅 {@link https://developers.google.com/maps/documentation/tile/streetview#panoid-search}。

 * @param {Cartographic} position 用于查找最近 panoId 的位置。
 * @param {number} [radius=50] 用于查找最近 panoId 的米制半径。
 * 
 * @returns {object} an 包含最近全景图的 panoId、纬度和经度的对象。
 * 
 * @example
 * 
 * const provider = await Cesium.GoogleStreetViewCubeMapPanoramaProvider.fromUrl({
 * key: '你的 Google Street View Static API 密钥'
 * })
 * const panoIds = provider.getNearestPanoId(position);
 */
GoogleStreetViewCubeMapPanoramaProvider.prototype.getNearestPanoId =
  async function (position, radius) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(position)) {
      throw new DeveloperError("position is required.");
    }
    //>>includeEnd('debug');

    const pos = [
      CesiumMath.toDegrees(position.latitude),
      CesiumMath.toDegrees(position.longitude),
    ];
    const posString = pos.join(",");

    const resource = this._metadataResource.getDerivedResource({
      queryParameters: {
        key: this._key,
        location: posString,
        radius: radius ?? 50,
      },
    });

    const panoIdObject = await resource.fetchJson();

    if (panoIdObject.status !== "OK") {
      throw new DeveloperError(
        `GoogleStreetViewCubeMapPanoramaProvider metadata error: ${panoIdObject.status}`,
      );
    }
    return {
      panoId: panoIdObject.pano_id,
      latitude: panoIdObject.location.lat,
      longitude: panoIdObject.location.lng,
    };
  };

/**
 * 获取 panoId 的元数据。有关响应对象，请参阅 {@link https://developers.google.com/maps/documentation/tile/streetview#metadata_response}。
 * @param {string} panoId
 *
 * @returns {object} object 包含 panoId 的元数据。
 *
 * @example
 * const panoIdObject = provider.getNearestPanoId(position);
 * const panoIdMetadata = provider.getPanoIdMetadata(panoIdObject.panoId);
 *
 */
GoogleStreetViewCubeMapPanoramaProvider.prototype.getPanoIdMetadata =
  async function (panoId) {
    const resource = this._metadataResource.getDerivedResource({
      queryParameters: {
        key: this._key,
        pano: panoId,
      },
    });

    const panoIdObject = await resource.fetchJson();

    if (panoIdObject.status !== "OK") {
      throw new DeveloperError(
        `GoogleStreetViewCubeMapPanoramaProvider metadata error: ${panoIdObject.status}`,
      );
    }
    return panoIdObject;
  };

GoogleStreetViewCubeMapPanoramaProvider.prototype._loadFaceImage =
  async function (options) {
    const url = this._buildFaceUrl(options);

    try {
      return await Resource.fetchImage({
        url,
        preferImageBitmap: true,
        flipY: true,
      });
    } catch (error) {
      throw new DeveloperError(`Failed to load Street View face image: ${url}`);
    }
  };

GoogleStreetViewCubeMapPanoramaProvider.prototype._buildFaceUrl = function (
  options,
) {
  const { heading, pitch, tileSizeString, panoId, signature } = options;
  const resource = this._baseResource.getDerivedResource({
    queryParameters: {
      size: tileSizeString,
      pano: panoId,
      heading,
      pitch,
      key: this._key,
      ...(defined(signature) && { signature }),
    },
  });

  return resource.url;
};

/**
 * 创建 {@link PanoramaProvider}，从 {@link https://developers.google.com/maps/documentation/streetview|Google Street View Static API} 提供立方体面图像。
 * @param {object} options 具有以下属性的对象：
 * @param {string} [options.key=GoogleMaps.defaultStreetViewStaticApiKey] 用于访问 Google 街景静态 API 的 API 密钥。有关如何生成自己密钥的说明，请参见 {@link https://developers.google.com/maps/documentation/javascript/get-api-key}。如果未定义，则使用默认值 {@link GoogleMaps.defaultStreetViewStaticApiKey}。如果该值不可用，则回退到 {@link GoogleMaps.defaultApiKey}。
 * @param {string|Resource} [options.url=GoogleMaps.streetViewStaticApiEndpoint] 用于访问 Google 街景静态 API 的 URL。更多详情请参见 {@link https://developers.google.com/maps/documentation/streetview/overview}。
 * @param {number} [options.tileSize=600] 每个正方形瓦片默认的宽度和高度（以像素为单位）。
 * @param {Credit|string} [options.credit] 显示在画布上的数据源标识。
 *
 * @returns {Promise<GoogleStreetViewCubeMapPanoramaProvider>} A resolves为创建的 GoogleStreetViewCubeMapPanoramaProvider 的 promise。
 *
 * @example
 * const provider = await Cesium.GoogleStreetViewCubeMapPanoramaProvider.fromUrl({
 * key: '你的 Google 街景静态 API 密钥'
 * })
 */
GoogleStreetViewCubeMapPanoramaProvider.fromUrl = async function (options) {
  options = options ?? {};
  options.key =
    options.key ??
    GoogleMaps.defaultStreetViewStaticApiKey ??
    GoogleMaps.defaultApiKey;
  if (
    !defined(options.key) &&
    !defined(GoogleMaps.defaultStreetViewStaticApiKey) &&
    !defined(GoogleMaps.defaultApiKey)
  ) {
    throw new DeveloperError(
      "options.key, GoogleMaps.defaultStreetViewStaticApiKey or GoogleMaps.defaultApiKey is required.",
    );
  }

  return new GoogleStreetViewCubeMapPanoramaProvider({
    ...options,
  });
};

GoogleStreetViewCubeMapPanoramaProvider._parseMetadata = function (
  panoIdMetadata,
) {
  const cartographic = Cartographic.fromDegrees(
    panoIdMetadata.location.lng,
    panoIdMetadata.location.lat,
    0,
  );
  return {
    cartographic,
  };
};

export default GoogleStreetViewCubeMapPanoramaProvider;
