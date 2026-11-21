import { Event, defined } from "@cesium/core";

/**
 * 描述了使用 KmlTourFlyTo 和 KmlTourWait 的 KmlTour 功能。
 * 在给定时间间隔内将相机引导至指定目的地。
 *
 * @alias KmlTour
 * @constructor
 *
 * @param {string} name 从 KML 中解析出的名称。
 * @param {string} id 从 KML 中解析出的 ID。
 * @param {Array} playlist 包含 KmlTourFlyTos 和 KmlTourWaits 的数组。
 *
 * @see KmlTourFlyTo
 * @see KmlTourWait
 *
 * @demo {@link https://sandcastle.cesium.com/?id=kml-tours|KML Tours}
 */
function KmlTour(name, id) {
  /**
   * kml gx:Tour 条目的 ID。
   * @type {string}
   */
  this.id = id;
  /**
   * 旅游路线名称。
   * @type {string}
   */
  this.name = name;
  /**
   * 播放列表中当前条目的索引。
   * @type {number}
   */
  this.playlistIndex = 0;
  /**
   * 播放列表条目的数组。
   * @type {Array}
   */
  this.playlist = [];
  /**
   * 当旅游路线开始播放时调用该事件，
   * 在播放列表中的任何条目开始播放之前调用。
   * @type Event
   */
  this.tourStart = new Event();
  /**
   * 当所有播放列表条目都
   * 播放完毕，或旅游路线播放被取消时调用该事件。
   *
   * 如果旅游路线播放被终止，事件回调将
   * 以 terminated=true 参数被调用。
   * @type Event
   */
  this.tourEnd = new Event();
  /**
   * 当播放列表中的条目开始播放时调用该事件。
   *
   * 事件回调将以当前条目作为第一个参数被调用。
   * @type Event
   */
  this.entryStart = new Event();
  /**
   * 当播放列表中的条目结束播放时调用该事件。
   *
   * 事件回调将接收以下参数：
   * 1. entry - 条目
   * 2. terminated - 如果通过调用 {@link KmlTour#stop} 终止播放，则值为 true
   * @type Event
   */
  this.entryEnd = new Event();

  this._activeEntries = [];
}

/**
 * 将条目添加到此旅游路线播放列表。
 *
 * @param {KmlTourFlyTo|KmlTourWait} entry 要添加到播放列表的条目。
 */
KmlTour.prototype.addPlaylistEntry = function (entry) {
  this.playlist.push(entry);
};

/**
 * 播放此旅游路线。
 *
 * @param {CesiumWidget} widget 控件。
 * @param {object} [cameraOptions] 这些选项将与 {@link Camera#flyTo} 的选项合并。
 * 用于 FlyTo 播放列表条目的选项。
 */
KmlTour.prototype.play = function (widget, cameraOptions) {
  this.tourStart.raiseEvent();

  const tour = this;
  playEntry.call(this, widget, cameraOptions, function (terminated) {
    tour.playlistIndex = 0;
    // Stop nonblocking entries
    if (!terminated) {
      cancelAllEntries(tour._activeEntries);
    }
    tour.tourEnd.raiseEvent(terminated);
  });
};

/**
 * 停止当前播放的旅游路线。
 */
KmlTour.prototype.stop = function () {
  cancelAllEntries(this._activeEntries);
};

// Stop all activeEntries.
function cancelAllEntries(activeEntries) {
  for (
    let entry = activeEntries.pop();
    entry !== undefined;
    entry = activeEntries.pop()
  ) {
    entry.stop();
  }
}

// Play playlist entry.
// This function is called recursevly with playNext and iterates over all entries from playlist.
function playEntry(widget, cameraOptions, allDone) {
  const entry = this.playlist[this.playlistIndex];
  if (entry) {
    const _playNext = playNext.bind(this, widget, cameraOptions, allDone);
    this._activeEntries.push(entry);
    this.entryStart.raiseEvent(entry);
    if (entry.blocking) {
      entry.play(_playNext, widget.scene.camera, cameraOptions);
    } else {
      const tour = this;
      entry.play(function () {
        tour.entryEnd.raiseEvent(entry);
        const indx = tour._activeEntries.indexOf(entry);
        if (indx >= 0) {
          tour._activeEntries.splice(indx, 1);
        }
      });
      _playNext(widget, cameraOptions, allDone);
    }
  } else if (defined(allDone)) {
    allDone(false);
  }
}

// Increment playlistIndex and call playEntry if terminated isn't true.
function playNext(widget, cameraOptions, allDone, terminated) {
  const entry = this.playlist[this.playlistIndex];
  this.entryEnd.raiseEvent(entry, terminated);

  if (terminated) {
    allDone(terminated);
  } else {
    const indx = this._activeEntries.indexOf(entry);
    if (indx >= 0) {
      this._activeEntries.splice(indx, 1);
    }
    this.playlistIndex++;
    playEntry.call(this, widget, cameraOptions, allDone);
  }
}
export default KmlTour;
