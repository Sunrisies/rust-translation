import { Check, defined } from "@cesium/core";

/**
 * 一个静态类，包含被 CesiumInspector、Cesium3DTilesInspector 和 VoxelInspector 使用的辅助函数
 * @private
 */
const InspectorShared = {};

/**
 * 创建复选框组件
 * @param {string} labelText 复选框标签中显示的文本
 * @param {string} checkedBinding 用于选中绑定的变量名称
 * @param {string} [enableBinding] 用于启用绑定的变量名称
 * @return {Element}
 */
InspectorShared.createCheckbox = function (
  labelText,
  checkedBinding,
  enableBinding,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("labelText", labelText);
  Check.typeOf.string("checkedBinding", checkedBinding);
  //>>includeEnd('debug');
  const checkboxContainer = document.createElement("div");
  const checkboxLabel = document.createElement("label");
  const checkboxInput = document.createElement("input");
  checkboxInput.type = "checkbox";

  let binding = `checked: ${checkedBinding}`;
  if (defined(enableBinding)) {
    binding += `, enable: ${enableBinding}`;
  }
  checkboxInput.setAttribute("data-bind", binding);
  checkboxLabel.appendChild(checkboxInput);
  checkboxLabel.appendChild(document.createTextNode(labelText));
  checkboxContainer.appendChild(checkboxLabel);
  return checkboxContainer;
};

/**
 * 创建部分元素
 * @param {Element} panel 父元素
 * @param {string} headerText 部分顶部的显示文本
 * @param {string} sectionVisibleBinding 用于可见性绑定的变量名称
 * @param {string} toggleSectionVisibilityBinding 用于切换可见性的函数名称
 * @return {Element}
 */
InspectorShared.createSection = function (
  panel,
  headerText,
  sectionVisibleBinding,
  toggleSectionVisibilityBinding,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("panel", panel);
  Check.typeOf.string("headerText", headerText);
  Check.typeOf.string("sectionVisibleBinding", sectionVisibleBinding);
  Check.typeOf.string(
    "toggleSectionVisibilityBinding",
    toggleSectionVisibilityBinding,
  );
  //>>includeEnd('debug');
  const section = document.createElement("div");
  section.className = "cesium-cesiumInspector-section";
  section.setAttribute(
    "data-bind",
    `css: { "cesium-cesiumInspector-section-collapsed": !${sectionVisibleBinding} }`,
  );
  panel.appendChild(section);

  const sectionHeader = document.createElement("h3");
  sectionHeader.className = "cesium-cesiumInspector-sectionHeader";
  sectionHeader.appendChild(document.createTextNode(headerText));
  sectionHeader.setAttribute(
    "data-bind",
    `click: ${toggleSectionVisibilityBinding}`,
  );
  section.appendChild(sectionHeader);

  const sectionContent = document.createElement("div");
  sectionContent.className = "cesium-cesiumInspector-sectionContent";
  section.appendChild(sectionContent);
  return sectionContent;
};

/**
 * 创建范围输入控件
 * @param {string} rangeText 显示文本
 * @param {string} sliderValueBinding 用于滑块值绑定的变量名称
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @param {number} [step] 步长。默认为“任意”。
 * @param {string} [inputValueBinding] 用于输入值绑定的变量名称
 * @return {Element}
 */
InspectorShared.createRangeInput = function (
  rangeText,
  sliderValueBinding,
  min,
  max,
  step,
  inputValueBinding,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("rangeText", rangeText);
  Check.typeOf.string("sliderValueBinding", sliderValueBinding);
  Check.typeOf.number("min", min);
  Check.typeOf.number("max", max);
  //>>includeEnd('debug');

  inputValueBinding = inputValueBinding ?? sliderValueBinding;
  const input = document.createElement("input");
  input.setAttribute("data-bind", `value: ${inputValueBinding}`);
  input.type = "number";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = min;
  slider.max = max;
  slider.step = step ?? "any";
  slider.setAttribute(
    "data-bind",
    `valueUpdate: "input", value: ${sliderValueBinding}`,
  );

  const wrapper = document.createElement("div");
  wrapper.appendChild(slider);

  const container = document.createElement("div");
  container.className = "cesium-cesiumInspector-slider";
  container.appendChild(document.createTextNode(rangeText));
  container.appendChild(input);
  container.appendChild(wrapper);

  return container;
};

/**
 * 创建范围输入控件
 * @param {string} rangeText 显示文本
 * @param {string} sliderValueBinding 用于滑块值绑定的变量名称
 * @param {number} [step] 步长。默认为“任意”。
 * @param {string} [inputValueBinding] 用于输入值绑定的变量名称
 * @return {Element}
 */
InspectorShared.createRangeInputWithDynamicMinMax = function (
  rangeText,
  sliderValueBinding,
  step,
  inputValueBinding,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("rangeText", rangeText);
  Check.typeOf.string("sliderValueBinding", sliderValueBinding);
  //>>includeEnd('debug');

  inputValueBinding = inputValueBinding ?? sliderValueBinding;
  const input = document.createElement("input");
  input.setAttribute("data-bind", `value: ${inputValueBinding}`);
  input.type = "number";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.step = step ?? "any";
  slider.setAttribute(
    "data-bind",
    `valueUpdate: "input", value: ${sliderValueBinding}, attr: { min: ${sliderValueBinding}Min, max: ${sliderValueBinding}Max }`,
  );

  const wrapper = document.createElement("div");
  wrapper.appendChild(slider);

  const container = document.createElement("div");
  container.className = "cesium-cesiumInspector-slider";
  container.appendChild(document.createTextNode(rangeText));
  container.appendChild(input);
  container.appendChild(wrapper);

  return container;
};

/**
 * 创建按钮组件
 * @param {string} buttonText 按钮文本
 * @param {string} clickedBinding 用于点击绑定的变量名称
 * @param {string} [activeBinding] 用于激活绑定的变量名称
 * @return {Element}
 */
InspectorShared.createButton = function (
  buttonText,
  clickedBinding,
  activeBinding,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("buttonText", buttonText);
  Check.typeOf.string("clickedBinding", clickedBinding);
  //>>includeEnd('debug');

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = buttonText;
  button.className = "cesium-cesiumInspector-pickButton";
  let binding = `click: ${clickedBinding}`;
  if (defined(activeBinding)) {
    binding += `, css: {"cesium-cesiumInspector-pickButtonHighlight" : ${activeBinding}}`;
  }
  button.setAttribute("data-bind", binding);

  return button;
};

export default InspectorShared;
