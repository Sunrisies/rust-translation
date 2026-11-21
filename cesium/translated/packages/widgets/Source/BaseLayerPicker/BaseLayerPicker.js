import { DeveloperError, defined, destroyObject } from "@cesium/core";
import { FeatureDetection, getElement } from "@cesium/engine";
import knockout from "../ThirdParty/knockout.js";
import BaseLayerPickerViewModel from "./BaseLayerPickerViewModel.js";

/**
 * <span style="display: block; text-align: center;">
 * <img src="Images/BaseLayerPicker.png" width="264" alt="BaseLayerPicker" />
 * <br />BaseLayerPicker 的drop-panel 处于开启状态。
 * </span>
 * <br /><br />
 * BaseLayerPicker 是一个单一按钮控件，显示可用影像和
 * 地形提供商的面板。当选择影像时，相应的影像图层会被创建并插入为影像集合的基础层；移除现有基础层。当选择地形时，
 * 它会替换当前的地形提供商。可用提供商列表中的每一项包含名称、
 * 一个代表图标，以及当悬停时显示更多信息的工具提示。该列表最初是
 * 空的，必须在使用前进行配置，如下例所示。
 * 默认情况下，BaseLayerPicker 使用默认的示例提供商列表用于演示目的。
 * <br /><br />
 * 值得注意的是，其中一些提供商，如 <a href="https://developers.arcgis.com" target="_blank">Esri ArcGIS</a> 和 <a href="https://docs.stadiamaps.com/ target="_blank">Stadia Maps</a>，有独立的服务条款，并且需要认证才能用于生产环境。
 * 该控件的父 HTML 容器节点或 ID。
 *
 * @alias BaseLayerPicker
 * @constructor
 *
 * @param {Element|string} container The parent HTML container node or ID for this widget.
 * @param {object} options 具有以下属性的对象：
 * @param {Globe} options.globe 要使用的地球模型。
 * @param {ProviderViewModel[]} [options.imageryProviderViewModels=[]] 用于影像的 ProviderViewModel 实例数组。
 * @param {ProviderViewModel} [options.selectedImageryProviderViewModel] 当前基础影像图层的视图模型，如果未提供则使用第一个可用的影像图层。
 * @param {ProviderViewModel[]} [options.terrainProviderViewModels=[]] 用于地形图的 ProviderViewModel 实例数组。
 * @param {ProviderViewModel} [options.selectedTerrainProviderViewModel] 当前基础地形图层的视图模型，如果未提供则使用第一个可用的地形图层。
 *
 * @exception {DeveloperError} Element 其中 id "container" 在文档中不存在。
 *
 *
 * @example
 * // 在 HTML head 中，包含指向 BaseLayerPicker.css 样式表的链接，
 * // 并在 body 中，包含：<div id="baseLayerPickerContainer</div>
 * //   style="position:absolute;top:24px;right:24px;width:38px;height:38px;"></div>
 *
 * //创建用户可以选择的可用提供商列表。
 * //此示例使用 3 个提供商：OpenStreetMap、The Black Marble 和单个非流世界图像。
 * const imageryViewModels = [];
 * imageryViewModels.push(new Cesium.ProviderViewModel({
 * name: "Open\u00adStreet\u00adMap",
 * iconUrl: Cesium.buildModuleUrl("Widgets/Images/ImageryProviders/openStreetMap.png"),
 * 工具提示："OpenStreetMap (OSM) 是一个协作项目，旨在创建免费且可编辑的
 * 世界地图。\nhttp://www.openstreetmap.org",
 * creationFunction: function() {
 * return new Cesium.OpenStreetMapImageryProvider({
 * url: "https://tile.openstreetmap.org/"
 *          });
 *      }
 *  }));
 *
 * imageryViewModels.push(new Cesium.ProviderViewModel({
 * name: "夜间地球",
 * iconUrl: Cesium.buildModuleUrl("Widgets/Images/ImageryProviders/blackMarble.png"),
 * tooltip: "城市和村庄的灯光勾勒出文明轮廓\n
 * 这是 NASA/NOAA 的 Suomi NPP 卫星在夜间看到的地球视图。",
 * creationFunction: function() {
 * return Cesium.IonImageryProvider.fromAssetId(3812);
 *      }
 *  }));
 *
 * imageryViewModels.push(new Cesium.ProviderViewModel({
 * name: "Natural Earth II",
 * iconUrl: Cesium.buildModuleUrl("Widgets/Images/ImageryProviders/naturalEarthII.png"),
 * tooltip: "Natural Earth II，为了对比效果进行了调暗处理。\nhttp://www.naturalearthdata.com/",
 * creationFunction: function() {
 * return Cesium.TileMapServiceImageryProvider.fromUrl(
 * Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
 *          );
 *      }
 *  }));
 *
 * //如果尚未执行，请创建一个没有影像的 CesiumWidget。
 * const cesiumWidget = new Cesium.CesiumWidget("cesiumContainer", { baseLayer: false });
 *
 * //最后，使用我们的视图模型创建基础层选择器控件。
 * const layers = cesiumWidget.imageryLayers;
 * const baseLayerPicker = new Cesium.BaseLayerPicker("baseLayerPickerContainer", {
 * globe: cesiumWidget.scene.globe,
 * imageryProviderViewModels: imageryViewModels
 * });
 *
 * @see TerrainProvider
 * @see ImageryProvider
 * @see ImageryLayerCollection
 */
function BaseLayerPicker(container, options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(container)) {
    throw new DeveloperError("container is required.");
  }
  //>>includeEnd('debug');

  container = getElement(container);

  const viewModel = new BaseLayerPickerViewModel(options);

  const element = document.createElement("button");
  element.type = "button";
  element.className = "cesium-button cesium-toolbar-button";
  element.setAttribute(
    "data-bind",
    "\
attr: { title: buttonTooltip },\
click: toggleDropDown",
  );
  container.appendChild(element);

  const imgElement = document.createElement("img");
  imgElement.setAttribute("draggable", "false");
  imgElement.className = "cesium-baseLayerPicker-selected";
  imgElement.setAttribute(
    "data-bind",
    "\
attr: { src: buttonImageUrl }, visible: !!buttonImageUrl",
  );
  element.appendChild(imgElement);

  const dropPanel = document.createElement("div");
  dropPanel.className = "cesium-baseLayerPicker-dropDown";
  dropPanel.setAttribute(
    "data-bind",
    '\
css: { "cesium-baseLayerPicker-dropDown-visible" : dropDownVisible }',
  );
  container.appendChild(dropPanel);

  const imageryTitle = document.createElement("div");
  imageryTitle.className = "cesium-baseLayerPicker-sectionTitle";
  imageryTitle.setAttribute(
    "data-bind",
    "visible: imageryProviderViewModels.length > 0",
  );
  imageryTitle.innerHTML = "Imagery";
  dropPanel.appendChild(imageryTitle);

  const imagerySection = document.createElement("div");
  imagerySection.className = "cesium-baseLayerPicker-section";
  imagerySection.setAttribute("data-bind", "foreach: _imageryProviders");
  dropPanel.appendChild(imagerySection);

  const imageryCategories = document.createElement("div");
  imageryCategories.className = "cesium-baseLayerPicker-category";
  imagerySection.appendChild(imageryCategories);

  const categoryTitle = document.createElement("div");
  categoryTitle.className = "cesium-baseLayerPicker-categoryTitle";
  categoryTitle.setAttribute("data-bind", "text: name");
  imageryCategories.appendChild(categoryTitle);

  const imageryChoices = document.createElement("div");
  imageryChoices.className = "cesium-baseLayerPicker-choices";
  imageryChoices.setAttribute("data-bind", "foreach: providers");
  imageryCategories.appendChild(imageryChoices);

  const imageryProvider = document.createElement("div");
  imageryProvider.className = "cesium-baseLayerPicker-item";
  imageryProvider.setAttribute(
    "data-bind",
    '\
css: { "cesium-baseLayerPicker-selectedItem" : $data === $parents[1].selectedImagery },\
attr: { title: tooltip },\
visible: creationCommand.canExecute,\
click: function($data) { $parents[1].selectedImagery = $data; }',
  );
  imageryChoices.appendChild(imageryProvider);

  const providerIcon = document.createElement("img");
  providerIcon.className = "cesium-baseLayerPicker-itemIcon";
  providerIcon.setAttribute("data-bind", "attr: { src: iconUrl }");
  providerIcon.setAttribute("draggable", "false");
  imageryProvider.appendChild(providerIcon);

  const providerLabel = document.createElement("div");
  providerLabel.className = "cesium-baseLayerPicker-itemLabel";
  providerLabel.setAttribute("data-bind", "text: name");
  imageryProvider.appendChild(providerLabel);

  const terrainTitle = document.createElement("div");
  terrainTitle.className = "cesium-baseLayerPicker-sectionTitle";
  terrainTitle.setAttribute(
    "data-bind",
    "visible: terrainProviderViewModels.length > 0",
  );
  terrainTitle.innerHTML = "Terrain";
  dropPanel.appendChild(terrainTitle);

  const terrainSection = document.createElement("div");
  terrainSection.className = "cesium-baseLayerPicker-section";
  terrainSection.setAttribute("data-bind", "foreach: _terrainProviders");
  dropPanel.appendChild(terrainSection);

  const terrainCategories = document.createElement("div");
  terrainCategories.className = "cesium-baseLayerPicker-category";
  terrainSection.appendChild(terrainCategories);

  const terrainCategoryTitle = document.createElement("div");
  terrainCategoryTitle.className = "cesium-baseLayerPicker-categoryTitle";
  terrainCategoryTitle.setAttribute("data-bind", "text: name");
  terrainCategories.appendChild(terrainCategoryTitle);

  const terrainChoices = document.createElement("div");
  terrainChoices.className = "cesium-baseLayerPicker-choices";
  terrainChoices.setAttribute("data-bind", "foreach: providers");
  terrainCategories.appendChild(terrainChoices);

  const terrainProvider = document.createElement("div");
  terrainProvider.className = "cesium-baseLayerPicker-item";
  terrainProvider.setAttribute(
    "data-bind",
    '\
css: { "cesium-baseLayerPicker-selectedItem" : $data === $parents[1].selectedTerrain },\
attr: { title: tooltip },\
visible: creationCommand.canExecute,\
click: function($data) { $parents[1].selectedTerrain = $data; }',
  );
  terrainChoices.appendChild(terrainProvider);

  const terrainProviderIcon = document.createElement("img");
  terrainProviderIcon.className = "cesium-baseLayerPicker-itemIcon";
  terrainProviderIcon.setAttribute("data-bind", "attr: { src: iconUrl }");
  terrainProviderIcon.setAttribute("draggable", "false");
  terrainProvider.appendChild(terrainProviderIcon);

  const terrainProviderLabel = document.createElement("div");
  terrainProviderLabel.className = "cesium-baseLayerPicker-itemLabel";
  terrainProviderLabel.setAttribute("data-bind", "text: name");
  terrainProvider.appendChild(terrainProviderLabel);

  knockout.applyBindings(viewModel, element);
  knockout.applyBindings(viewModel, dropPanel);

  this._viewModel = viewModel;
  this._container = container;
  this._element = element;
  this._dropPanel = dropPanel;

  this._closeDropDown = function (e) {
    if (!(element.contains(e.target) || dropPanel.contains(e.target))) {
      viewModel.dropDownVisible = false;
    }
  };

  if (FeatureDetection.supportsPointerEvents()) {
    document.addEventListener("pointerdown", this._closeDropDown, true);
  } else {
    document.addEventListener("mousedown", this._closeDropDown, true);
    document.addEventListener("touchstart", this._closeDropDown, true);
  }
}

Object.defineProperties(BaseLayerPicker.prototype, {
  /**
   * 获取父容器。
   * @memberof BaseLayerPicker.prototype
   *
   * @type {Element}
   */
  container: {
    get: function () {
      return this._container;
    },
  },

  /**
   * 获取视图模型。
   * @memberof BaseLayerPicker.prototype
   *
   * @type {BaseLayerPickerViewModel}
   */
  viewModel: {
    get: function () {
      return this._viewModel;
    },
  },
});

/**
 * @returns {boolean} true 如果对象已被销毁，返回 false，否则返回 true。
 */
BaseLayerPicker.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁控件。应在永久
 * 从布局中移除控件时调用。
 */
BaseLayerPicker.prototype.destroy = function () {
  if (FeatureDetection.supportsPointerEvents()) {
    document.removeEventListener("pointerdown", this._closeDropDown, true);
  } else {
    document.removeEventListener("mousedown", this._closeDropDown, true);
    document.removeEventListener("touchstart", this._closeDropDown, true);
  }

  knockout.cleanNode(this._element);
  knockout.cleanNode(this._dropPanel);
  this._container.removeChild(this._element);
  this._container.removeChild(this._dropPanel);
  return destroyObject(this);
};
export default BaseLayerPicker;
