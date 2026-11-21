---
layout: tutorial_v2
title: 扩展 Leaflet 类理论
---

## 扩展 Leaflet

Leaflet 拥有数百种插件，这些插件扩展了 Leaflet 的功能：有些是通用的方式，有些则针对特定使用场景。

之所以有如此多的插件，部分原因是 Leaflet 易于扩展。本教程将介绍最常用的扩展方法。

请注意，本教程假设您已掌握以下知识：

* [JavaScript](https://developer.mozilla.org/en-US/Learn/JavaScript)
* [DOM 处理](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction)
* [面向对象编程](https://en.wikipedia.org/wiki/Object-oriented_programming)（需理解类、实例、继承、方法和属性等概念）


## Leaflet 架构

让我们看一下 Leaflet 1.0.0 的简化 UML 类图。有超过 60 个 JavaScript 类，因此图表有些大。幸运的是，可以使用 `L.ImageOverlay` 生成可缩放图像：

{% include frame.html url="class-diagram.html" %}


从技术角度来看，Leaflet 可以通过多种方式进行扩展：

* 最常见的方式是使用 `L.Class.extend()` 创建 `L.Layer`、`L.Handler` 或 `L.Control` 的新子类。
	* Layers move when the map is moved/zoomed
	* Handlers are invisible and interpret browser events
	* Controls are fixed interface elements
* 使用 `L.Class.include()` 在现有类中添加更多功能。
	* Adding new methods and options
	* Changing some methods
	* Using `addInitHook` to run extra constructor code.
* 使用 `L.Class.include()` 修改现有类的部分内容（改变类方法的工作方式）。

本教程涵盖了一些仅在 Leaflet 1.0.0 中可用的类和方法。如果您正在为旧版本开发插件，请谨慎操作。

## `L.Class`

JavaScript 是一种相当特殊的语言。它并非真正的面向对象语言，而是[原型导向语言](https://en.wikipedia.org/wiki/Prototype-based_programming)。这使得在经典 OOP 意义上使用类继承变得困难。

Leaflet 通过引入 `L.Class` 来应对这一问题，从而简化类继承。

尽管现代 JavaScript 可以使用 ES6 类，但 Leaflet 并非基于它们设计的。

### `L.Class.extend()`

要在 Leaflet 中创建任何对象的子类，请使用 `.extend()` 方法。该方法接受一个参数：一个包含键值对的标准对象，每个键是属性或方法的名称，每个值则是属性的初始值或方法的实现代码：

    var MyDemoClass = L.Class.extend({
    
        // A property with initial value = 42
        myDemoProperty: 42,   
    
        // A method 
        myDemoMethod: function() { return this.myDemoProperty; }
        
    });

    var myDemoInstance = new MyDemoClass();
    
    // This will output "42" to the development console
    console.log( myDemoInstance.myDemoMethod() );   

在命名类、方法和属性时，应遵循以下规范：
    
* 函数、方法、属性和工厂方法的名称应使用 [`lowerCamelCase`](https://en.wikipedia.org/wiki/CamelCase)。
* 类名称应使用 [`UpperCamelCase`](https://en.wikipedia.org/wiki/CamelCase)。
* 私有属性和方法以下划线 (`_`) 开头。这并不使它们成为私有，只是建议开发者不要直接使用它们。

### `L.Class.include()`
    
如果某个类已经定义，现有的属性/方法可以被重新定义，或者可以通过 `.include()` 添加新属性：

    MyDemoClass.include({
    
        // Adding a new property to the class
        _myPrivateProperty: 78,
        
        // Redefining a method
        myDemoMethod: function() { return this._myPrivateProperty; }
    
    });

    var mySecondDemoInstance = new MyDemoClass();
    
    // This will output "78"
    console.log( mySecondDemoInstance.myDemoMethod() );
    
    // However, properties and methods from before still exist
    // This will output "42"
    console.log( mySecondDemoInstance.myDemoProperty );

### `L.Class.initialize()`
    
在面向对象编程中，类具有构造函数方法。在 Leaflet 的 `L.Class` 中，构造函数方法的名称始终为 `initialize`。

如果您的类有一些特定的 `options`，建议在构造函数中使用 `L.setOptions()` 对其进行初始化。此工具函数会将提供的选项与类的默认选项合并。


    var MyBoxClass = L.Class.extend({
    
        options: {
            width: 1,
            height: 1
        },
    
        initialize: function(name, options) {
            this.name = name;
            L.setOptions(this, options);
        }
        
    });
    
    var instance = new MyBoxClass('Red', {width: 10});

    console.log(instance.name); // Outputs "Red"
    console.log(instance.options.width); // Outputs "10"
    console.log(instance.options.height); // Outputs "1", the default
    
Leaflet 以特殊方式处理 `options` 属性：父类可用的选项将被子类继承。

    var MyCubeClass = MyBoxClass.extend({
        options: {
            depth: 1
        }
    });
    
    var instance = new MyCubeClass('Blue');
    
    console.log(instance.options.width); // Outputs "1", parent class default
    console.log(instance.options.height); // Outputs "1", parent class default
    console.log(instance.options.depth); // Outputs "1"


通常，子类会先调用父类的构造函数，然后再调用自己的构造函数。在 Leaflet 中，可以通过 `L.Class.addInitHook()` 实现这一点。该方法可用于“挂钩”在类 `initialize()` 之后运行的初始化函数，例如：

    MyBoxClass.addInitHook(function(){
        this._area = this.options.width * this.options.length;
    });

这将在 `initialize()` 被调用（进而调用 `setOptions()`）之后执行。这意味着当初始化钩子运行时，`this.options` 存在且有效。

`addInitHook` 有另一种语法，它使用方法名称并可以在方法中填充参数：

    MyCubeClass.include({
        _calculateVolume: function(arg1, arg2) {
            this._volume = this.options.width * this.options.length * this.options.depth;
        }
    });
    
    MyCubeClass.addInitHook('_calculateVolume', argValue1, argValue2);
    

### 父类的方法

调用父类的方法是通过访问父类的原型，并使用 [`Function.call(…)`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call)来实现的。例如，`L.FeatureGroup` 的代码中就可以看到这种用法。

    L.FeatureGroup = L.LayerGroup.extend({
    
        addLayer: function (layer) {
            …
            L.LayerGroup.prototype.addLayer.call(this, layer);
        },
        
        removeLayer: function (layer) {
            …
            L.LayerGroup.prototype.removeLayer.call(this, layer);
        },
    
        …
    });

调用父类的构造函数也是以类似的方式实现，只是使用 `ParentClass.prototype.initialize.call(this, …)` 代替。
    
    
### Factories    

大多数 Leaflet 类都有一个对应的 [工厂函数](https://en.wikipedia.org/wiki/Factory_%28object-oriented_programming%29)。工厂函数的名称与类名相同，但采用 `lowerCamelCase` 格式而非 `UpperCamelCase` 格式。
    
    function myBoxClass(name, options) {
        return new MyBoxClass(name, options);
    }
    
    
### 命名规范

在为 Leaflet 插件命名类时，请遵循以下命名规范：

* 切勿在插件中暴露全局变量。
* 如果您有一个新类，请直接将其放在 `L` 命名空间中 (`L.MyPlugin`)。
* 如果继承现有类，应将其作为子属性命名 (`L.TileLayer.Banana`)。


