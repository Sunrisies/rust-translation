import {
  BoundingRectangle,
  Cartesian2,
  Check,
  Frozen,
  Math as CesiumMath,
  PixelFormat,
  RuntimeError,
  createGuid,
  defined,
  destroyObject,
} from "@cesium/core";
import Resource from "../Core/Resource.js";
import TexturePacker from "../Core/TexturePacker.js";
import Framebuffer from "./Framebuffer.js";
import Texture from "./Texture.js";

const defaultInitialDimensions = 16;

/**
 * TextureAtlas 将多张图像存储在一个∂纹理中，并保留
 * 每张图像的纹理坐标信息。TextureAtlas 是动态的，
 * 意味着可以在任何时候添加新图像。
 * 如果 Texture Atlas 调整大小，纹理坐标可能会发生变化，因此
 * 在使用旧值之前检查 {@link TextureAtlas#guid} 非常重要。
 *
 * @alias TextureAtlas
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {PixelFormat} [options.pixelFormat=PixelFormat.RGBA] 纹理的像素格式。
 * @param {Sampler} [options.sampler=new Sampler()] 关于如何采样纹理的信息。
 * @param {number} [options.borderWidthInPixels=1] 相邻图像之间的像素间距。
 * @param {Cartesian2} [options.initialSize=new Cartesian2(16.0, 16.0)] 纹理的初始边长。
 *
 * @exception {DeveloperError} borderWidthInPixels 必须大于或等于零。
 * @exception {DeveloperError} initialSize 必须大于零。
 *
 * @private
 */
function TextureAtlas(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const borderWidthInPixels = options.borderWidthInPixels ?? 1.0;
  const initialSize =
    options.initialSize ??
    new Cartesian2(defaultInitialDimensions, defaultInitialDimensions);

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThanOrEquals(
    "options.borderWidthInPixels",
    borderWidthInPixels,
    0,
  );
  Check.typeOf.number.greaterThan("options.initialSize.x", initialSize.x, 0);
  Check.typeOf.number.greaterThan("options.initialSize.y", initialSize.y, 0);
  //>>includeEnd('debug');

  this._pixelFormat = options.pixelFormat ?? PixelFormat.RGBA;
  this._sampler = options.sampler;
  this._borderWidthInPixels = borderWidthInPixels;
  this._initialSize = initialSize;

  this._texturePacker = undefined;
  /** @type {BoundingRectangle[]} */
  this._rectangles = [];
  /** @type {Map<number, number>} */
  this._subRegions = new Map();
  this._guid = createGuid();

  this._imagesToAddQueue = [];
  /** @type {Map<string, number>} */
  this._indexById = new Map();
  /** @type {Map<string, Promise<number>>} */
  this._indexPromiseById = new Map();
  this._nextIndex = 0;
}

Object.defineProperties(TextureAtlas.prototype, {
  /**
   * 相邻图像之间的像素间距。
   * @memberof TextureAtlas.prototype
   * @type {number}
   * @readonly
   * @private
   */
  borderWidthInPixels: {
    get: function () {
      return this._borderWidthInPixels;
    },
  },

  /**
   * 包含 Texture Atlas 中所有图像的 {@link BoundingRectangle} 像素偏移和尺寸数组。
   * 矩形的 x 和 y 值对应纹理坐标的左下角。
   * 如果索引是现有图像的一个子区域，则 a 和 y 值以相对于父区域的偏移量形式指定。
   * 坐标按相应图像添加到 Atlas 的顺序排列。
   * @memberof TextureAtlas.prototype
   * @type {BoundingRectangle[]}
   * @readonly
   * @private
   */
  rectangles: {
    get: function () {
      return this._rectangles;
    },
  },

  /**
   * 所有图像所写入的纹理。在首次更新之前，该值将为 <code>undefined</code>。
   * @memberof TextureAtlas.prototype
   * @type {Texture|undefined}
   * @readonly
   * @private
   */
  texture: {
    get: function () {
      return this._texture;
    },
  },

  /**
   * 纹理的像素格式。
   * @memberof TextureAtlas.prototype
   * @type {PixelFormat}
   * @readonly
   * @private
   */
  pixelFormat: {
    get: function () {
      return this._pixelFormat;
    },
  },

  /**
   * 采样此纹理时使用的采样器。如果为 <code>undefined</code>，则使用默认采样器。
   * @memberof TextureAtlas.prototype
   * @type {Sampler|undefined}
   * @readonly
   * @private
   */
  sampler: {
    get: function () {
      return this._sampler;
    },
  },

  /**
   * Texture Atlas 中的图像数量。此值每次调用 addImage 或 addImageSubRegion 时都会增加。
   * 如果 Texture Atlas 调整大小，纹理坐标可能会发生变化，因此
   * Texture coordinates are subject to change if the texture atlas resizes, so it is
   * 在使用旧值之前检查 {@link TextureAtlas#guid} 非常重要。
   * @memberof TextureAtlas.prototype
   * @type {number}
   * @readonly
   * @private
   */
  numberOfImages: {
    get: function () {
      return this._nextIndex;
    },
  },

  /**
   * Atlas 的全局唯一标识符 (GUID)。
   * 每当 Texture Atlas 被修改时，GUID 就会改变。
   * 使用 Texture Atlas 的类应在处理 Atlas 数据前检查 GUID
   * 是否发生了变化。
   * @memberof TextureAtlas.prototype
   * @type {string}
   * @readonly
   * @private
   */
  guid: {
    get: function () {
      return this._guid;
    },
  },

  /**
   * 返回纹理的大小（以字节为单位）。
   * @memberof TextureAtlas.prototype
   * @type {number}
   * @readonly
   * @private
   */
  sizeInBytes: {
    get: function () {
      if (!defined(this._texture)) {
        return 0;
      }

      return this._texture.sizeInBytes;
    },
  },
});

/**
 * 获取在着色器中读取关联图像所需的纹理坐标。
 * @param {number} index 图像区域的索引。
 * @param {BoundingRectangle} [result] 存储结果的对象。
 * @return {BoundingRectangle} The 修改的结果参数或一个新的 BoundingRectangle 实例，如果未提供则使用新实例。
 * @private
 * @example
 * const index = await atlas.addImage("myImage", image);
 * const rectangle = atlas.computeTextureCoordinates(index);
 * BoundingRectangle.pack(rectangle, bufferView);
 */
TextureAtlas.prototype.computeTextureCoordinates = function (index, result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThanOrEquals("index", index, 0);
  //>>includeEnd('debug');

  const texture = this._texture;
  const rectangle = this._rectangles[index];

  if (!defined(result)) {
    result = new BoundingRectangle();
  }

  if (!defined(rectangle)) {
    result.x = 0;
    result.y = 0;
    result.width = 0;
    result.height = 0;

    return result;
  }

  const atlasWidth = texture.width;
  const atlasHeight = texture.height;

  const width = rectangle.width;
  const height = rectangle.height;
  let x = rectangle.x;
  let y = rectangle.y;

  const parentIndex = this._subRegions.get(index);
  if (defined(parentIndex)) {
    const parentRectangle = this._rectangles[parentIndex];

    x += parentRectangle.x;
    y += parentRectangle.y;
  }

  result.x = x / atlasWidth;
  result.y = y / atlasHeight;
  result.width = width / atlasWidth;
  result.height = height / atlasHeight;

  return result;
};

/**
 * 针对每个现有图像，将其从之前的打包位置复制到新纹理中的新打包位置，以执行 WebGL 纹理复制操作。
 * @param {Context} context 渲染上下文
 * @param {number} width 纹理的像素宽度
 * @param {number} height 纹理的像素高度
 * @param {BoundingRectangle[]} rectangles 重新打包后的纹理的打包边界矩形
 * @param {number} queueOffset 成功打包的最后一个队列项的索引
 * @private
 */
TextureAtlas.prototype._copyFromTexture = function (
  context,
  width,
  height,
  rectangles,
) {
  const pixelFormat = this._pixelFormat;
  const sampler = this._sampler;
  const newTexture = new Texture({
    context,
    height,
    width,
    pixelFormat,
    sampler,
  });

  const gl = context._gl;
  const target = newTexture._textureTarget;

  const oldTexture = this._texture;
  const framebuffer = new Framebuffer({
    context,
    colorTextures: [oldTexture],
    destroyAttachments: false,
  });

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(target, newTexture._texture);

  framebuffer._bind();

  // Copy any textures from the old atlas to its new position in the new atlas
  const oldRectangles = this.rectangles;
  const subRegions = this._subRegions;
  for (let index = 0; index < oldRectangles.length; ++index) {
    const rectangle = rectangles[index];
    const frameBufferOffset = oldRectangles[index];

    if (
      !defined(rectangle) ||
      !defined(frameBufferOffset) ||
      defined(subRegions.get(index)) // The rectangle corresponds to a subregion of a parent image
    ) {
      continue;
    }

    const { x, y, width, height } = rectangle;
    gl.copyTexSubImage2D(
      target,
      0,
      x,
      y,
      frameBufferOffset.x,
      frameBufferOffset.y,
      width,
      height,
    );
  }

  gl.bindTexture(target, null);
  newTexture._initialized = true;

  framebuffer._unBind();
  framebuffer.destroy();

  return newTexture;
};

/**
 * 以新尺寸重新创建纹理图集纹理，并根据需要重新打包图像。
 * @param {Context} context 渲染上下文
 * @param {number} [queueOffset = 0] 成功打包的最后一个队列项的索引
 * @private
 */
TextureAtlas.prototype._resize = function (context, queueOffset = 0) {
  const borderPadding = this._borderWidthInPixels;
  const oldRectangles = this._rectangles;
  const queue = this._imagesToAddQueue;

  const oldTexture = this._texture;
  let width = oldTexture.width;
  let height = oldTexture.height;

  // Get the rectangles (width and height) of the current set of images,
  // ignoring the subregions, which don't get packed
  const subRegions = this._subRegions;
  const toPack = oldRectangles
    .map((image, index) => {
      return new AddImageRequest({ index, image });
    })
    .filter(
      (request, index) =>
        defined(request.image) && !defined(subRegions.get(index)),
    );

  // Add the new set of images
  let maxWidth = 0;
  let maxHeight = 0;
  let areaQueued = 0;
  for (let i = queueOffset; i < queue.length; ++i) {
    const { width, height } = queue[i].image;
    maxWidth = Math.max(maxWidth, width);
    maxHeight = Math.max(maxHeight, height);
    areaQueued += width * height;
    toPack.push(queue[i]);
  }

  // At minimum, atlas must fit its largest input images. Texture coordinates are
  // compressed to 0–1 with 12-bit precision, so use power-of-two size to align pixels.
  width = CesiumMath.nextPowerOfTwo(Math.max(maxWidth, width));
  height = CesiumMath.nextPowerOfTwo(Math.max(maxHeight, height));

  // Iteratively double the smallest dimension until atlas area is (approximately) sufficient.
  while (areaQueued >= width * height) {
    if (width > height) {
      height *= 2;
    } else {
      width *= 2;
    }
  }

  toPack.sort(
    ({ image: imageA }, { image: imageB }) =>
      imageB.height * imageB.width - imageA.height * imageA.width,
  );

  const newRectangles = new Array(this._nextIndex);
  for (const index of this._subRegions.keys()) {
    // Subregions are specified relative to their parents,
    // so we can copy them directly
    if (defined(subRegions.get(index))) {
      newRectangles[index] = oldRectangles[index];
    }
  }

  let texturePacker,
    packed = false;
  while (!packed) {
    texturePacker = new TexturePacker({ height, width, borderPadding });

    let i;
    for (i = 0; i < toPack.length; ++i) {
      const { index, image } = toPack[i];
      if (!defined(image)) {
        continue;
      }

      const repackedNode = texturePacker.pack(index, image);
      if (!defined(repackedNode)) {
        // Could not fit everything into the new texture.
        // Scale texture size and try again
        if (width > height) {
          // Resize height
          height *= 2.0;
        } else {
          // Resize width
          width *= 2.0;
        }

        break;
      }

      newRectangles[index] = repackedNode.rectangle;
    }

    packed = i === toPack.length;
  }

  this._texturePacker = texturePacker;
  this._texture = this._copyFromTexture(context, width, height, newRectangles);

  oldTexture.destroy();

  this._rectangles = newRectangles;
  this._guid = createGuid();
};

/**
 * 返回指定 ID 的图像区域索引。如果图像已存在于图集中，则返回现有索引；否则，结果为未定义。
 * @param {string} id 用于检测图像是否已存在于图集中的标识符。
 * @returns {number|undefined} The 图像索引，如果图像不存在于图集中则为未定义。
 * @private
 */
TextureAtlas.prototype.getImageIndex = function (id) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("id", id);
  //>>includeEnd('debug');

  return this._indexById.get(id);
};

/**
 * 将图像数据复制到底层纹理图集中。
 * @param {AddImageRequest} imageRequest 在队列中调用 addImage 所需的数据
 * @private
 */
TextureAtlas.prototype._copyImageToTexture = function ({
  index,
  image,
  resolve,
  reject,
}) {
  const texture = this._texture;
  const rectangle = this._rectangles[index];

  try {
    texture.copyFrom({
      source: image,
      xOffset: rectangle.x,
      yOffset: rectangle.y,
    });

    if (defined(resolve)) {
      resolve(index);
    }
  } catch (e) {
    if (defined(reject)) {
      reject(e);
      return;
    }
  }
};

/**
 * 在更新操作执行时（通常在帧结束时）将待打包图像添加到纹理图集所需的信息。
 * @constructor
 * @private
 * @param {object} options 具有以下属性的对象：
 * @param {number} options.index 一个标识符
 * @param {TexturePacker.PackableObject} options.image 一个对象，例如具有像素级 <code>width</code> 和 <code>height</code> 属性的 <code>Image</code> 对象
 * @param {function} [options.resolve] 承诺解析器
 * @param {function} [options.reject] 承诺拒绝器
 */
function AddImageRequest({ index, image, resolve, reject }) {
  this.index = index;
  this.image = image;
  this.resolve = resolve;
  this.reject = reject;
  this.rectangle = undefined;
}

/**
 * 为当前帧将图像添加到队列中。
 * 图像将在帧结束时被复制到纹理中，并根据需要调整纹理大小。
 *
 * @private
 * @param {number} index 一个标识符
 * @param {TexturePacker.PackableObject} image 一个对象，例如具有像素级 <code>width</code> 和 <code>height</code> 属性的 <code>Image</code> 对象
 * @returns {Promise<number>} Promise 该对象在图像被添加到队列后解析为图像索引，如果出现错误则拒绝解析。如果纹理图集在中间被卸载，承诺将解析为 <code>-1</code>。
 */
TextureAtlas.prototype._addImage = function (index, image) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number.greaterThanOrEquals("index", index, 0);
  Check.defined("image", image);
  //>>includeEnd('debug');

  return new Promise((resolve, reject) => {
    this._imagesToAddQueue.push(
      new AddImageRequest({
        index,
        image,
        resolve,
        reject,
      }),
    );

    this._imagesToAddQueue.sort(
      ({ image: imageA }, { image: imageB }) =>
        imageB.height * imageB.width - imageA.height * imageA.width,
    );
  });
};

/**
 * 处理当前帧的图像队列，将其复制到纹理图集中，并根据需要调整纹理大小。
 * @private
 * @param {Context} context 渲染上下文
 * @return {boolean} true 如果纹理在此帧被更新
 */
TextureAtlas.prototype._processImageQueue = function (context) {
  const queue = this._imagesToAddQueue;
  if (queue.length === 0) {
    return false;
  }

  this._rectangles.length = this._nextIndex;

  let i, error;
  for (i = 0; i < queue.length; ++i) {
    const imageRequest = queue[i];
    const { image, index } = imageRequest;
    const node = this._texturePacker.pack(index, image);
    if (!defined(node)) {
      // Atlas cannot fit all images in the queue
      // Bail early and resize
      try {
        this._resize(context, i);
      } catch (e) {
        error = e;

        if (defined(imageRequest.reject)) {
          imageRequest.reject(error);
        }
      }
      break;
    }
    this._rectangles[index] = node.rectangle;
  }

  if (defined(error)) {
    for (i = i + 1; i < queue.length; ++i) {
      const { resolve } = queue[i];
      if (defined(resolve)) {
        resolve(-1);
      }
    }

    queue.length = 0;
    return false;
  }

  for (let i = 0; i < queue.length; ++i) {
    this._copyImageToTexture(queue[i]);
  }

  queue.length = 0;
  return true;
};

/**
 * 处理当前帧中任何已排队의更新，并相应地更新渲染资源。在帧渲染前后调用此操作，以避免任何依赖渲染命令的竞态条件。
 * @private
 * @param {Context} context 渲染上下文
 * @return {boolean} true 如果渲染资源被更新
 */
TextureAtlas.prototype.update = function (context) {
  if (!defined(this._texture)) {
    const width = this._initialSize.x;
    const height = this._initialSize.y;
    const pixelFormat = this._pixelFormat;
    const sampler = this._sampler;
    const borderPadding = this._borderWidthInPixels;

    this._texture = new Texture({
      context,
      width,
      height,
      pixelFormat,
      sampler,
    });

    this._texturePacker = new TexturePacker({
      height,
      width,
      borderPadding,
    });
  }

  return this._processImageQueue(context);
};

async function resolveImage(image, id) {
  if (typeof image === "function") {
    image = image(id);
  }

  if (typeof image === "string" || image instanceof Resource) {
    // Fetch the resource
    const resource = Resource.createIfNeeded(image);
    image = resource.fetchImage();
  }

  return image;
}

/**
 * 将图像添加到图集中。如果图像已存在于图集中，则图集保持不变，并且使用现有索引。
 * the existing index is used.
 * @private
 * @param {string} id 用于检测图像是否已存在于图集的标识符。
 * @param {HTMLImageElement|HTMLCanvasElement|string|Resource|Promise|TextureAtlas.CreateImageCallback} image 要添加到纹理图集中的图像或画布，
 * 或指向 Image 的 URL、图像 Promise，或创建图像的函数。
 * @param {number} width 指定纹理宽度的数字。如果未定义，则使用图像宽度。
 * @param {number} height 指定纹理高度的数字。如果未定义，则使用图像高度。
 * @returns {Promise<number> | number} The 图像区域索引或其解析后的 Promise。如果资源正在被销毁，则返回 -1。
 */
TextureAtlas.prototype.addImage = function (id, image, width, height) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("id", id);
  Check.defined("image", image);
  //>>includeEnd('debug');

  let promise = this._indexPromiseById.get(id);
  let index = this._indexById.get(id);
  if (defined(promise)) {
    // This image is already being added
    return promise;
  }
  if (defined(index)) {
    // This image has already been added and resolved
    return index;
  }

  index = this._nextIndex++;
  this._indexById.set(id, index);

  const resolveAndAddImage = async () => {
    const resolvedImage = await resolveImage(image, id);
    //>>includeStart('debug', pragmas.debug);
    Check.defined("image", resolvedImage);
    //>>includeEnd('debug');

    if (this.isDestroyed() || !defined(resolvedImage)) {
      this._indexPromiseById.delete(id);
      return -1;
    }

    if (defined(width)) {
      resolvedImage.width = width;
    }
    if (defined(height)) {
      resolvedImage.height = height;
    }

    const imageIndex = await this._addImage(index, resolvedImage);
    this._indexPromiseById.delete(id);
    return imageIndex;
  };

  promise = resolveAndAddImage();
  this._indexPromiseById.set(id, promise);
  return promise;
};

/**
 * 获取现有图集图像的子区域作为额外的图像索引。
 * @private
 * @param {string} id 现有图像的标识符。
 * @param {BoundingRectangle} subRegion 定义现有图像区域的 {@link BoundingRectangle}，以图像左下角像素为单位。
 * @param {number} imageIndex 图像的索引。
 * @returns {Promise<number> | number | undefined} The 现有的子区域索引，如果尚未添加则定义为未定义。
 */
TextureAtlas.prototype.getCachedImageSubRegion = function (
  id,
  subRegion,
  imageIndex,
) {
  const imagePromise = this._indexPromiseById.get(id);
  for (const [index, parentIndex] of this._subRegions.entries()) {
    if (imageIndex === parentIndex) {
      const boundingRegion = this._rectangles[index];
      if (boundingRegion.equals(subRegion)) {
        // The subregion is already being tracked
        if (imagePromise) {
          return imagePromise.then((resolvedImageIndex) =>
            resolvedImageIndex === -1 ? -1 : index,
          );
        }
        return index;
      }
    }
  }
};

/**
 * 将现有图集图像的子区域作为额外的图像索引。
 * @private
 * @param {string} id 现有图像的标识符。
 * @param {BoundingRectangle} subRegion 定义现有图像区域的 {@link BoundingRectangle}，以图像左下角像素为单位。
 * @returns {number | Promise<number>} The 解析后的图像区域索引或其解析后的 Promise。如果资源正在被销毁，则返回 -1。
 */
TextureAtlas.prototype.addImageSubRegion = function (id, subRegion) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("id", id);
  Check.defined("subRegion", subRegion);
  //>>includeEnd('debug');
  const imageIndex = this._indexById.get(id);
  if (!defined(imageIndex)) {
    throw new RuntimeError(`image with id "${id}" not found in the atlas.`);
  }

  let index = this.getCachedImageSubRegion(id, subRegion, imageIndex);
  if (defined(index)) {
    return index;
  }

  index = this._nextIndex++;
  this._subRegions.set(index, imageIndex);
  this._rectangles[index] = subRegion.clone();

  const indexPromise =
    this._indexPromiseById.get(id) ?? Promise.resolve(imageIndex);

  return indexPromise.then((imageIndex) => {
    if (imageIndex === -1) {
      // The atlas has been destroyed
      return -1;
    }

    const rectangle = this._rectangles[imageIndex];

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number.lessThanOrEquals(
      "subRegion.x",
      subRegion.x,
      rectangle.width,
    );
    Check.typeOf.number.lessThanOrEquals(
      "subRegion.x + subRegion.width",
      subRegion.x + subRegion.width,
      rectangle.width,
    );
    Check.typeOf.number.lessThanOrEquals(
      "subRegion.y",
      subRegion.y,
      rectangle.height,
    );
    Check.typeOf.number.lessThanOrEquals(
      "subRegion.y + subRegion.height",
      subRegion.y + subRegion.height,
      rectangle.height,
    );
    //>>includeEnd('debug');

    return index;
  });
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 * @private
 * @returns {boolean} True 如果此对象被销毁，则不应使用它；调用除
 * @see TextureAtlas#destroy
 */
TextureAtlas.prototype.isDestroyed = function () {
  return false;
};

/**
 * 此对象会销毁其持有的 WebGL 资源。销毁对象允许确定性的
 * WebGL 资源的释放，而不是依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，就不应再次使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 * @private
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 * @example
 * atlas = atlas && atlas.destroy();
 * @see TextureAtlas#isDestroyed
 */
TextureAtlas.prototype.destroy = function () {
  this._texture = this._texture && this._texture.destroy();
  this._imagesToAddQueue.forEach(({ resolve }) => {
    if (defined(resolve)) {
      resolve(-1);
    }
  });

  return destroyObject(this);
};

/**
 * 创建图像的函数。
 * @private
 * @callback TextureAtlas.CreateImageCallback
 * @param {string} id 要加载的图像的标识符。
 * @returns {HTMLImageElement|Promise<HTMLImageElement>} The 图像，或解析后得到的图像 Promise。
 */

export default TextureAtlas;
