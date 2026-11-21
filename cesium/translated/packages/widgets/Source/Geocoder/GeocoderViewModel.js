import {
  DeveloperError,
  Event,
  Math as CesiumMath,
  Matrix4,
  Rectangle,
  defined,
  destroyObject,
} from "@cesium/core";
import {
  computeFlyToLocationForRectangle,
  GeocoderService,
  GeocodeType,
  getElement,
  IonGeocoderService,
  sampleTerrainMostDetailed,
} from "@cesium/engine";
import knockout from "../ThirdParty/knockout.js";
import createCommand from "../createCommand.js";

// The height we use if geocoding to a specific point instead of an rectangle.
const DEFAULT_HEIGHT = 1000;

/**
 * {@link Geocoder} 控件의视图模型。
 * @alias GeocoderViewModel
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Scene} options.scene 要使用的场景实例。
 * @param {GeocoderService[]} [options.geocoderServices] 用于地理编码查询的地理编码服务。
 * 如果提供多个服务，将收集支持这些服务的地理编码器的建议；
 * 如果没有选择建议，则使用第一个地理编码服务的结果。
 * @param {number} [options.flightDuration] 相机飞往输入位置所需的持续时间，以秒为单位。
 * @param {Geocoder.DestinationFoundFunction} [options.destinationFound=GeocoderViewModel.flyToDestination] 在成功进行地理编码后调用的回调函数。如果未提供，默认行为是将相机飞往结果位置。
 */
function GeocoderViewModel(options) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(options) || !defined(options.scene)) {
    throw new DeveloperError("options.scene is required.");
  }
  //>>includeEnd('debug');

  if (defined(options.geocoderServices)) {
    this._geocoderServices = options.geocoderServices;
  } else {
    this._geocoderServices = [new IonGeocoderService({ scene: options.scene })];
  }

  this._viewContainer = options.container;
  this._scene = options.scene;
  this._flightDuration = options.flightDuration;
  this._searchText = "";
  this._isSearchInProgress = false;
  this._wasGeocodeCancelled = false;
  this._previousCredits = [];
  this._complete = new Event();
  this._suggestions = [];
  this._selectedSuggestion = undefined;
  this._showSuggestions = true;

  this._handleArrowDown = handleArrowDown;
  this._handleArrowUp = handleArrowUp;

  const that = this;

  this._suggestionsVisible = knockout.pureComputed(function () {
    const suggestions = knockout.getObservable(that, "_suggestions");
    const suggestionsNotEmpty = suggestions().length > 0;
    const showSuggestions = knockout.getObservable(that, "_showSuggestions")();
    return suggestionsNotEmpty && showSuggestions;
  });

  this._searchCommand = createCommand(function (geocodeType) {
    geocodeType = geocodeType ?? GeocodeType.SEARCH;
    that._focusTextbox = false;
    if (defined(that._selectedSuggestion)) {
      that.activateSuggestion(that._selectedSuggestion);
      return false;
    }
    that.hideSuggestions();
    if (that.isSearchInProgress) {
      cancelGeocode(that);
    } else {
      return geocode(that, that._geocoderServices, geocodeType);
    }
  });

  this.deselectSuggestion = function () {
    that._selectedSuggestion = undefined;
  };

  this.handleKeyDown = function (data, event) {
    const downKey =
      event.key === "ArrowDown" || event.key === "Down" || event.keyCode === 40;
    const upKey =
      event.key === "ArrowUp" || event.key === "Up" || event.keyCode === 38;
    if (downKey || upKey) {
      event.preventDefault();
    }

    return true;
  };

  this.handleKeyUp = function (data, event) {
    const downKey =
      event.key === "ArrowDown" || event.key === "Down" || event.keyCode === 40;
    const upKey =
      event.key === "ArrowUp" || event.key === "Up" || event.keyCode === 38;
    const enterKey = event.key === "Enter" || event.keyCode === 13;
    if (upKey) {
      handleArrowUp(that);
    } else if (downKey) {
      handleArrowDown(that);
    } else if (enterKey) {
      that._searchCommand();
    }
    return true;
  };

  this.activateSuggestion = function (data) {
    that.hideSuggestions();
    that._searchText = data.displayName;
    const destination = data.destination;
    clearSuggestions(that);
    that.destinationFound(that, destination);
  };

  this.hideSuggestions = function () {
    that._showSuggestions = false;
    that._selectedSuggestion = undefined;
  };

  this.showSuggestions = function () {
    that._showSuggestions = true;
  };

  this.handleMouseover = function (data, event) {
    if (data !== that._selectedSuggestion) {
      that._selectedSuggestion = data;
    }
  };

  /**
   * 获取或设置指示该实例是否应始终显示文本输入字段的值。
   *
   * @type {boolean}
   * @default false
   */
  this.keepExpanded = false;

  /**
   * 如果地理编码器应在用户输入时自动补全地进行查询，则为 true。
   * @type {boolean}
   * @default true
   */
  this.autoComplete = options.autocomplete ?? true;

  /**
   * 获取和设置找到地理编码目的地时调用的命令。
   * @type {Geocoder.DestinationFoundFunction}
   */
  this.destinationFound =
    options.destinationFound ?? GeocoderViewModel.flyToDestination;

  this._focusTextbox = false;

  knockout.track(this, [
    "_searchText",
    "_isSearchInProgress",
    "keepExpanded",
    "_suggestions",
    "_selectedSuggestion",
    "_showSuggestions",
    "_focusTextbox",
  ]);

  const searchTextObservable = knockout.getObservable(this, "_searchText");
  searchTextObservable.extend({ rateLimit: { timeout: 500 } });
  this._suggestionSubscription = searchTextObservable.subscribe(function () {
    GeocoderViewModel._updateSearchSuggestions(that);
  });
  /**
   * 获取表示搜索是否正在进行的布尔值。此属性是可观察的。
   *
   * @type {boolean}
   */
  this.isSearchInProgress = undefined;
  knockout.defineProperty(this, "isSearchInProgress", {
    get: function () {
      return this._isSearchInProgress;
    },
  });

  /**
   * 获取或设置要搜索的文本。该文本可以是地址、经度和纬度，
   * 以及可选的高度，其中经度和纬度以度为单位，高度以米为单位。
   *
   * @type {string}
   */
  this.searchText = undefined;
  knockout.defineProperty(this, "searchText", {
    get: function () {
      if (this.isSearchInProgress) {
        return "Searching...";
      }

      return this._searchText;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (typeof value !== "string") {
        throw new DeveloperError("value must be a valid string.");
      }
      //>>includeEnd('debug');
      this._searchText = value;
    },
  });

  /**
   * 获取或设置相机飞行持续时间，以秒为单位。
   * 值为零时，相机将立即切换到地理编码位置。
   * 当未定义时，持续时间将根据距离计算。
   *
   * @type {number|undefined}
   * @default undefined
   */
  this.flightDuration = undefined;
  knockout.defineProperty(this, "flightDuration", {
    get: function () {
      return this._flightDuration;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value < 0) {
        throw new DeveloperError("value must be positive.");
      }
      //>>includeEnd('debug');

      this._flightDuration = value;
    },
  });
}

Object.defineProperties(GeocoderViewModel.prototype, {
  /**
   * 获取飞行完成时触发的事件。
   * @memberof GeocoderViewModel.prototype
   *
   * @type {Event}
   */
  complete: {
    get: function () {
      return this._complete;
    },
  },

  /**
   * 获取要控制的场景。
   * @memberof GeocoderViewModel.prototype
   *
   * @type {Scene}
   */
  scene: {
    get: function () {
      return this._scene;
    },
  },

  /**
   * 获取点击按钮时执行的命令。
   * @memberof GeocoderViewModel.prototype
   *
   * @type {Command}
   */
  search: {
    get: function () {
      return this._searchCommand;
    },
  },

  /**
   * 获取当前选中的地理编码搜索建议。
   * @memberof GeocoderViewModel.prototype
   *
   * @type {object}
   */
  selectedSuggestion: {
    get: function () {
      return this._selectedSuggestion;
    },
  },

  /**
   * 获取地理编码搜索建议列表。
   * @memberof GeocoderViewModel.prototype
   *
   * @type {object[]}
   */
  suggestions: {
    get: function () {
      return this._suggestions;
    },
  },
});

function handleArrowUp(viewModel) {
  if (viewModel._suggestions.length === 0) {
    return;
  }
  const currentIndex = viewModel._suggestions.indexOf(
    viewModel._selectedSuggestion,
  );
  if (currentIndex === -1 || currentIndex === 0) {
    viewModel._selectedSuggestion = undefined;
    return;
  }
  const next = currentIndex - 1;
  viewModel._selectedSuggestion = viewModel._suggestions[next];
  GeocoderViewModel._adjustSuggestionsScroll(viewModel, next);
}

function handleArrowDown(viewModel) {
  if (viewModel._suggestions.length === 0) {
    return;
  }
  const numberOfSuggestions = viewModel._suggestions.length;
  const currentIndex = viewModel._suggestions.indexOf(
    viewModel._selectedSuggestion,
  );
  const next = (currentIndex + 1) % numberOfSuggestions;
  viewModel._selectedSuggestion = viewModel._suggestions[next];

  GeocoderViewModel._adjustSuggestionsScroll(viewModel, next);
}

function computeFlyToLocationForCartographic(cartographic, terrainProvider) {
  const availability = defined(terrainProvider)
    ? terrainProvider.availability
    : undefined;

  if (!defined(availability)) {
    cartographic.height += DEFAULT_HEIGHT;
    return Promise.resolve(cartographic);
  }

  return sampleTerrainMostDetailed(terrainProvider, [cartographic]).then(
    function (positionOnTerrain) {
      cartographic = positionOnTerrain[0];
      cartographic.height += DEFAULT_HEIGHT;
      return cartographic;
    },
  );
}

function flyToDestination(viewModel, destination) {
  const scene = viewModel._scene;
  const ellipsoid = scene.ellipsoid;

  const camera = scene.camera;
  const terrainProvider = scene.terrainProvider;
  let finalDestination = destination;

  let promise;
  if (destination instanceof Rectangle) {
    // Some geocoders return a Rectangle of zero width/height, treat it like a point instead.
    if (
      CesiumMath.equalsEpsilon(
        destination.south,
        destination.north,
        CesiumMath.EPSILON7,
      ) &&
      CesiumMath.equalsEpsilon(
        destination.east,
        destination.west,
        CesiumMath.EPSILON7,
      )
    ) {
      // destination is now a Cartographic
      destination = Rectangle.center(destination);
    } else {
      promise = computeFlyToLocationForRectangle(destination, scene);
    }
  } else {
    // destination is a Cartesian3
    destination = ellipsoid.cartesianToCartographic(destination);
  }

  if (!defined(promise)) {
    promise = computeFlyToLocationForCartographic(destination, terrainProvider);
  }

  return promise
    .then(function (result) {
      finalDestination = ellipsoid.cartographicToCartesian(result);
    })
    .finally(function () {
      // Whether terrain querying succeeded or not, fly to the destination.
      camera.flyTo({
        destination: finalDestination,
        complete: function () {
          viewModel._complete.raiseEvent();
        },
        duration: viewModel._flightDuration,
        endTransform: Matrix4.IDENTITY,
      });
    });
}

async function attemptGeocode(geocoderService, query, geocodeType) {
  try {
    const result = await geocoderService.geocode(query, geocodeType);
    return {
      state: "fulfilled",
      value: result,
      credits: geocoderService.credit,
    };
  } catch (error) {
    return { state: "rejected", reason: error };
  }
}

async function geocode(viewModel, geocoderServices, geocodeType) {
  const query = viewModel._searchText;

  if (hasOnlyWhitespace(query)) {
    viewModel.showSuggestions();
    return;
  }

  viewModel._isSearchInProgress = true;
  viewModel._wasGeocodeCancelled = false;

  let i;
  let result;
  for (i = 0; i < geocoderServices.length; i++) {
    if (viewModel._wasGeocodeCancelled) {
      return;
    }

    result = await attemptGeocode(geocoderServices[i], query, geocodeType);
    if (
      defined(result) &&
      result.state === "fulfilled" &&
      result.value.length > 0
    ) {
      break;
    }
  }

  if (viewModel._wasGeocodeCancelled) {
    return;
  }

  viewModel._isSearchInProgress = false;
  clearCredits(viewModel);

  const geocoderResults = result.value;
  if (
    result.state === "fulfilled" &&
    defined(geocoderResults) &&
    geocoderResults.length > 0
  ) {
    viewModel._searchText = geocoderResults[0].displayName;
    viewModel.destinationFound(viewModel, geocoderResults[0].destination);
    const credits = updateCredits(
      viewModel,
      GeocoderService.getCreditsFromResult(geocoderResults[0]),
    );
    // If the result does not contain any credits, default to the service credit.
    if (!defined(credits)) {
      updateCredit(viewModel, geocoderServices[i].credit);
    }
    return;
  }

  viewModel._searchText = `${query} (not found)`;
}

function updateCredit(viewModel, credit) {
  if (
    defined(credit) &&
    !viewModel._scene.isDestroyed() &&
    !viewModel._scene.frameState.creditDisplay.isDestroyed()
  ) {
    viewModel._scene.frameState.creditDisplay.addStaticCredit(credit);
    viewModel._previousCredits.push(credit);
  }
}

function updateCredits(viewModel, credits) {
  if (defined(credits)) {
    credits.forEach((credit) => updateCredit(viewModel, credit));
  }

  return credits;
}

function clearCredits(viewModel) {
  if (
    !viewModel._scene.isDestroyed() &&
    !viewModel._scene.frameState.creditDisplay.isDestroyed()
  ) {
    viewModel._previousCredits.forEach((credit) => {
      viewModel._scene.frameState.creditDisplay.removeStaticCredit(credit);
    });
  }

  viewModel._previousCredits.length = 0;
}

function adjustSuggestionsScroll(viewModel, focusedItemIndex) {
  const container = getElement(viewModel._viewContainer);
  const searchResults = container.getElementsByClassName("search-results")[0];
  const listItems = container.getElementsByTagName("li");
  const element = listItems[focusedItemIndex];

  if (focusedItemIndex === 0) {
    searchResults.scrollTop = 0;
    return;
  }

  const offsetTop = element.offsetTop;
  if (offsetTop + element.clientHeight > searchResults.clientHeight) {
    searchResults.scrollTop = offsetTop + element.clientHeight;
  } else if (offsetTop < searchResults.scrollTop) {
    searchResults.scrollTop = offsetTop;
  }
}

function cancelGeocode(viewModel) {
  if (viewModel._isSearchInProgress) {
    viewModel._isSearchInProgress = false;
    viewModel._wasGeocodeCancelled = true;
  }
}

function hasOnlyWhitespace(string) {
  return /^\s*$/.test(string);
}

function clearSuggestions(viewModel) {
  knockout.getObservable(viewModel, "_suggestions").removeAll();
}

async function updateSearchSuggestions(viewModel) {
  if (!viewModel.autoComplete) {
    return;
  }

  const query = viewModel._searchText;

  clearSuggestions(viewModel);
  clearCredits(viewModel);

  if (hasOnlyWhitespace(query)) {
    return;
  }

  for (const service of viewModel._geocoderServices) {
    const newResults = await service.geocode(query, GeocodeType.AUTOCOMPLETE);
    viewModel._suggestions = viewModel._suggestions.concat(newResults);
    if (newResults.length > 0) {
      let useDefaultCredit = true;
      newResults.forEach((result) => {
        const credits = GeocoderService.getCreditsFromResult(result);
        useDefaultCredit = useDefaultCredit && !defined(credits);
        updateCredits(viewModel, credits);
      });

      // Use the service credit if there were no attributions in the results
      if (useDefaultCredit) {
        updateCredit(viewModel, service.credit);
      }
    }

    if (viewModel._suggestions.length >= 5) {
      return;
    }
  }
}

/**
 * 用于飞往成功进行地理编码后找到的目的地的函数。
 * @type {Geocoder.DestinationFoundFunction}
 */
GeocoderViewModel.flyToDestination = flyToDestination;

//exposed for testing
GeocoderViewModel._updateSearchSuggestions = updateSearchSuggestions;
GeocoderViewModel._adjustSuggestionsScroll = adjustSuggestionsScroll;

/**
 * @returns {boolean} true 如果对象已被销毁，则为 false，否则为 true。
 */
GeocoderViewModel.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁控件。如果永久
 * 从布局中移除控件时，应调用此函数。
 */
GeocoderViewModel.prototype.destroy = function () {
  this._suggestionSubscription.dispose();
  clearCredits(this);
  return destroyObject(this);
};
export default GeocoderViewModel;
