import { defined, formatError } from "@cesium/core";

/**
 * 提供在 {@link ImageryProvider} 或 {@link TerrainProvider} 中发生的错误的详细信息。
 *
 * @alias TileProviderError
 * @constructor
 *
 * @param {ImageryProvider|TerrainProvider} provider 发生错误的影像或地形提供器。
 * @param {string} message 描述错误的消息。
 * @param {number} [x] 发生错误的瓦片的 X 坐标，如果错误不特定于某个瓦片则为 undefined。
 * 发生错误的瓦片的 Y 坐标，如果错误不特定于某个瓦片则为 undefined。
 * @param {number} [y] 发生错误的瓦片的细节级别，如果错误不特定于某个瓦片则为 undefined。
 * 发生错误的瓦片的具体细节级别，如果错误不特定于某个瓦片则为 undefined。
 * @param {number} [level] 发生错误的瓦片的细节级别，如果错误不特定于某个瓦片则为 undefined。
 * 发生错误的瓦片的具体细节级别，如果错误不特定于某个瓦片则为 undefined。
 * @param {number} [timesRetried=0] 此操作被重试的次数。
 * @param {Error} [error] 发生的错误或异常（如有）。
 */
function TileProviderError(
  provider,
  message,
  x,
  y,
  level,
  timesRetried,
  error,
) {
  /**
   * 发生错误的 {@link ImageryProvider} 或 {@link TerrainProvider}。
   * @type {ImageryProvider|TerrainProvider}
   */
  this.provider = provider;

  /**
   * 描述错误的消息。
   * @type {string}
   */
  this.message = message;

  /**
   * 发生错误的瓦片的 X 坐标。如果错误不特定于某个瓦片，此属性将为 undefined。
   * 发生错误的瓦片的 Y 坐标。如果错误不特定于某个瓦片，此属性将为 undefined。
   * @type {number}
   */
  this.x = x;

  /**
   * 发生错误的瓦片的 Y 坐标。如果错误不特定于某个瓦片，此属性将为 undefined。
   * 发生错误的瓦片的 Y 坐标。如果错误不特定于某个瓦片，此属性将为 undefined。
   * @type {number}
   */
  this.y = y;

  /**
   * 发生错误的瓦片的细节级别。如果错误不特定于某个瓦片，此属性将为 undefined。
   * 发生错误的瓦片的细节级别。如果错误不特定于某个瓦片，此属性将为 undefined。
   * @type {number}
   */
  this.level = level;

  /**
   * 此操作被重试的次数。
   * @type {number}
   * @default 0
   */
  this.timesRetried = timesRetried ?? 0;

  /**
   * 如果失败的操作需要重试，则为 true；否则为 false。影像或地形提供器会在触发事件前设置此属性的初始值，但任何监听器都可以更改它。在最后一个监听器调用后的值将被应用。
   * 发生的错误或异常（如有）。
   * 如果 {@link ImageryProvider} 或 {@link TerrainProvider} 有监听器，则通过触发事件报告错误；如果没有监听器，则通过将错误日志到控制台来报告错误。此方法还跟踪此操作被重试的次数。
   * @type {boolean}
   * @default false
   */
  this.retry = false;

  /**
   * 发生错误的实例，即上次调用此函数时返回的错误实例，如果这是第一次发生此错误则为 undefined。
   * @type {Error}
   */
  this.error = error;
}

/**
 * Reports an error in an {@link ImageryProvider} or {@link TerrainProvider} by raising an event if it has any listeners, or by
 * 用于通知监听器错误的事件。
 * 描述错误的消息。
 *
 * @param {TileProviderError} previousError 发生错误的瓦片的 X 坐标，如果错误不特定于某个瓦片则为 undefined。
 * 发生错误的瓦片的 X 坐标。如果错误不特定于某个瓦片，此属性将为 undefined。
 * occurred.
 * @param {ImageryProvider|TerrainProvider} [provider] The imagery or terrain provider that encountered the error.
 * @param {Event} [event] The event to raise to inform listeners of the error.
 * @param {string} [message] The message describing the error.
 * @param {number} [x] The X coordinate of the tile that experienced the error, or undefined if the
 * error is not specific to a particular tile.
 * @param {number} [y] 发生错误的瓦片的 Y 坐标，如果错误并非特定于某个瓦片，则输出 undefined。
 * 发生错误时的瓦片细节级别，如果错误并非特定于某个瓦片，则输出 undefined。
 * @param {number} [level] 发生错误时的瓦片细节级别，如果错误并非特定于某个瓦片，则输出 undefined。
 * 发生的错误或异常，如果有。
 * @param {Error} [errorDetails] 传递给事件监听器的错误实例，以便
 * @returns {TileProviderError} The 在下次调用此函数时继续传递该实例，
 * 以追踪重试次数。
 * 报告操作成功情况，通过重置之前发生的错误重试计数来实现。这样，
 */
TileProviderError.reportError = function (
  previousError,
  provider,
  event,
  message,
  x,
  y,
  level,
  errorDetails,
) {
  let error = previousError;
  if (!defined(previousError)) {
    error = new TileProviderError(
      provider,
      message,
      x,
      y,
      level,
      0,
      errorDetails,
    );
  } else {
    error.provider = provider;
    error.message = message;
    error.x = x;
    error.y = y;
    error.level = level;
    error.retry = false;
    error.error = errorDetails;
    ++error.timesRetried;
  }

  if (defined(event) && event.numberOfListeners > 0) {
    event.raiseEvent(error);
  } else if (defined(provider)) {
    console.log(
      `An error occurred in "${provider.constructor.name}": ${formatError(
        message,
      )}`,
    );
  }

  return error;
};

/**
 * Reports success of an operation by resetting the retry count of a previous error, if any.  This way,
 * 如果将来再次发生错误，监听器将知道该错误尚未被重试。
 *
 * @param {TileProviderError} previousError 之前的错误，如果此操作之前没有引发错误，则输出 undefined。
 * 一个用于重试操作的函数。
 */
TileProviderError.reportSuccess = function (previousError) {
  if (defined(previousError)) {
    previousError.timesRetried = -1;
  }
};

/**
 * A function that will be called to retry the operation.
 * @callback TileProviderError.RetryFunction
 */
export default TileProviderError;