/*
 * urs
 * https://github.com/jo/urs
 *
 * Copyright (c) 2013 Johannes J. Schmidt
 * Licensed under the MIT license.
 */

// TODO:
// * Dragging capabilities
// * Ability to change options after initialisation
// * Ability to dynamically set panelSize
// * Load images via ajax source / pagination / very much images
// * Switch panels when sliding has stopped and end of panel was reached
(function(exports) {

  'use strict';

  // If a slider has no id property, it will be assigned on of the form
  // urs-slider-<sliderIdSuffix>.
  var sliderIdSuffix = 1;

  // A blank image is used to stretch the panel height
  // and enforce baseline alignment.
  var px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQI12NgYAAAAAMAASDVlMcAAAAASUVORK5CYII=';


  // Create or update a style element for the slider
  // which sets animation duration and panel size:
  //   #urs-slider-1 .urs-panel { width: 400%; }
  //   #urs-slider-1 img { max-width: 50%; }
  //   #urs-slider-1 .animate {
  //     -webkit-transition: -webkit-transform 200ms ease-out;
  //     transition: transform 200ms ease-out;
  //   }
  function createStyle(options) {
    var style = document.getElementById('urs-style-' + options.element.id);

    if (!style) {
      style = document.createElement('style');
      style.id = 'urs-style-' + options.element.id;
      document.head.appendChild(style);
    }

    // TODO: consider using  Lea Verous prefixfree
    // https://github.com/LeaVerou/prefixfree
    style.innerHTML = '#' + options.element.id + ' .urs-panel { width: ' + 200 * options.panelSize + '%; }\n' +
      '#' + options.element.id + ' img { max-width: ' + 100 / options.panelSize + '%; }\n' +
      '#' + options.element.id + ' .animate {\n' +
      '  -webkit-transition: -webkit-transform ' + options.animationDuration + 'ms ease-out;\n' +
      '  -moz-transition: -moz-transform ' + options.animationDuration + 'ms ease-out;\n' +
      '  -o-transition: -o-transform ' + options.animationDuration + 'ms ease-out;\n' +
      '  transition: transform ' + options.animationDuration + 'ms ease-out;\n' +
      '}';
  }

  // Create a pane DOM with 'options.panelSize' images:
  // <div class=left>
  //   <img class=urs-filling src="data:...">
  //   <img>
  //   <img>
  // </div>
  function createPane(options, side) {
    var pane = document.createElement('div');
    pane.className = 'urs-' + side;

    // create filling pixel image
    var img = new Image();
    img.src = px;
    img.className = 'urs-filling';
    pane.appendChild(img);

    // create `options.panelSize` images
    for (var i = 0; i < options.panelSize; i++) {
      img = new Image();
      pane.appendChild(img);
    }

    return pane;
  }
  // Create a panel DOM with left and right panes:
  // <div class=panel>
  //   <div class=left>
  //     ...
  //   </div>
  //   <div class=right>
  //     ...
  //   </div>
  // </div>
  function createPanel(options) {
    var panel = {};
    panel.panel = document.createElement('div');
    panel.panel.className = 'urs-panel';

    panel.left = createPane(options, 'left');
    panel.panel.appendChild(panel.left);

    panel.right = createPane(options, 'right');
    panel.panel.appendChild(panel.right);

    return panel;
  }

  // Render images in the left pane.
  function renderLeftImages(options, pane) {
    var leftImages = options.images.slice(Math.max(0, options.index - options.panelSize), options.index);
    leftImages = options.images.slice(options.images.length - options.panelSize + leftImages.length, options.images.length).concat(leftImages);

    for (var i = 0; i < leftImages.length; i++) {
      // the first image is the filling px image
      pane.children[i + 1].src = leftImages[i];
    }
  }

  // Render images in the right pane.
  function renderRightImages(options, pane) {
    var rightImages = options.images.slice(options.index, options.index + options.panelSize);
    rightImages = rightImages.concat(options.images.slice(0, options.panelSize - rightImages.length));
    for (var i = 0; i < rightImages.length; i++) {
      // the first image is the filling px image
      pane.children[i + 1].src = rightImages[i];
    }
  }

  // Render images: set image sources.
  function renderImages(options, panel) {
    renderLeftImages(options, panel.left);
    renderRightImages(options, panel.right);

    // Panel index is the index of the current image in the panel
    options.panelIndex = 0;
  }

  // Calculate offset of the panel:
  // that is 50% of panel with to the left.
  function getPaneWidth(options) {
    return options.panel.panel.clientWidth * 0.5;
  }

  // Calculate image offsets for the left pane.
  // TODO: rethink - this could be simpler.
  function calculateLeftOffsets(options, x) {
    var offsets = [];

    // first image is filling px
    var widths = [];
    for (var i = 1; i < options.panel.left.children.length; i++) {
      widths.push(options.panel.left.children[i].clientWidth);
    }
    widths.reverse();

    for (var j = 0; j < widths.length; j++) {
       x += widths[j];
       offsets.push(x);
    }

    return offsets.reverse();
  }

  // Calculate image offsets for the right pane.
  function calculateRightOffsets(options, x) {
    var offsets = [];

    for (var i = 1; i < options.panel.right.children.length; i++) {
      offsets.push(x);
      x -= options.panel.right.children[i].clientWidth;
    }

    return offsets;
  }

  // Calculate image offsets:
  // set options.offsets as an array of start positions of image borders.
  function calculateOffsets(options) {
    var center = -getPaneWidth(options);

    options.offsets = calculateLeftOffsets(options, center)
      .concat(calculateRightOffsets(options, center));
  }

  // Find the previous offset
  function previousImageOffset(options) {
    var x = 0;
    for (var i = options.offsets.length - 1; i >= 0; i--) {
      x = options.offsets[i];
      if (options.offset < x) {
        break;
      }
    }
    return x;
  }

  // Find the next offset
  function nextImageOffset(options) {
    var x = 0;
    for (var i = 0; i < options.offsets.length; i++) {
      x = options.offsets[i];
      if (options.offset > x) {
        break;
      }
    }
    return x;
  }

  // Apply the next offset depending on direction
  function findNearOffset(options) {
    options.offset = options.direction ? nextImageOffset(options) : previousImageOffset(options);
    options.panelIndex = options.offsets.indexOf(options.offset) - Math.floor(options.offsets.length / 2);
    if (options.panelIndex > options.panelSize - 1) {
      options.panelIndex = options.panelSize - 1;
    }
    // FIXME!
    options.index = options.index + options.panelIndex;
    if (options.index > options.images.length - 1) {
      options.index = 0;
    }
    if (options.index < 0) {
      options.index = options.images.length - 1;
    }
  }

  // Index increment / decrement
  // * Change index only if we currently have enough images in the current panel
  // * Cycle index, continue at the start when it reaches the end and vice versa
  function incrementIndex(options) {
    if (options.direction) {
      if (options.panelIndex < options.panelSize - 1) {
        options.panelIndex++;
        options.index++;
        if (options.index > options.images.length - 1) {
          options.index = 0;
        }
      }
    } else {
      if (options.panelIndex > - options.panelSize) {
        options.panelIndex--;
        options.index--;
        if (options.index < 0) {
          options.index = options.images.length - 1;
        }
      }
    }

    // translate offset according to panelIndex
    var offsetIndex = options.offsets.length / 2 + options.panelIndex;
    options.offset = options.offsets[offsetIndex];
  }

  // Move the panel according to `options.offset`.
  function move(options) {
    var style = '-webkit-transform: translate3d(' + options.offset + 'px,0,0)\n;' +
      '-moz-transform: translate3d(' + options.offset + 'px,0,0)\n;' +
      '-ms-transform: translate3d(' + options.offset + 'px,0,0)\n;' +
      '-o-transform: translate3d(' + options.offset + 'px,0,0)\n;' +
      'transform: translate3d(' + options.offset + 'px,0,0)';

    options.panel.panel.setAttribute('style', style);
  }

  // Switch panels:
  // * Render images in shadow panel
  // * Exchange panel with shadow panel
  function switchPanel(options) {
    renderImages(options, options.shadowPanel);

    // make shadow panel visible and apply initial translation
    options.shadowPanel.panel.removeAttribute('style');
    // exchange panels, move shadowPanel to the top
    options.element.appendChild(options.shadowPanel.panel);

    // swap panels
    var panel = options.panel;
    options.panel = options.shadowPanel;
    options.shadowPanel = panel;

    options.offset = -getPaneWidth(options);
  }

  // Do the slide:
  // * Cancel previous switch timeout
  // * Set animate class
  // * Switch panels when ready
  function slide(options) {
    if (options.switchTimeout) {
      clearTimeout(options.switchTimeout);
    }

    options.panel.panel.className = 'urs-panel animate';

    move(options);

    options.switchTimeout = setTimeout(function() {
      switchPanel(options);
    }, options.animationDuration);
  }

  function onSlideStart(options, e) {
    options.firstPositionX = 0;
    options.lastX = 0;
    options.lastMove = 0;

    if (e.pageX) {
      options.firstPositionX = e.pageX;
    } else {
      options.firstPositionX = e.touches && e.touches.length && e.touches[0].pageX;
    }
    if (options.firstPositionX) {
      e.preventDefault();
      options.clicking = true;
      options.lastX = options.firstPositionX;
    }
  }

  function onSlideMove(options, e) {
    if (!options.clicking) {
      return;
    }

    var x;
    if (e.pageX) {
      x = e.pageX;
    } else {
      x = e.touches && e.touches.length && e.touches[0].pageX;
    }

    if (!x) {
      return;
    }

    options.lastMove = x - options.lastX;
    options.offset = options.offset + options.lastMove;
    options.direction = options.lastX > x;
    options.lastX = x;

    move(options);
  }

  function onSlideEnd(options, e) {
    options.clicking = false;

    calculateOffsets(options);

    if (!options.lastMove) {
      options.direction = options.firstPositionX - options.element.offsetLeft > options.element.offsetLeft + options.element.clientWidth / 2;
      incrementIndex(options);
    } else {
      findNearOffset(options);
    }

    slide(options);
  }

  // Cross browser add event listeners
  function addEvents(element, events, fun) {
    var i;

    if (element.attachEvent) {
      for (i = 0; i < events.length; i++) {
        element.attachEvent('on' + events[i], fun);
      }
    } else {
      for (i = 0; i < events.length; i++) {
        element.addEventListener(events[i], fun, false);
      }
    }
  }


  // Initialize Urs slider.
  // `options.element`: slider container as DOM element or id string
  // `options.images`: list of image sources
  // `options.animationDuration`: duration of the translation animation in ms
  // `options.panelSize`: number of images per pane
  exports.urs = function(options) {
    options = options || {};

    // apply defaults
    options.animationDuration = options.animationDuration || 200;
    options.panelSize = options.panelSize || 2;
    options.images = options.images || [];

    // options.element can be an id or a DOM element
    if (typeof options.element === 'string') {
      options.element = document.getElementById(options.element);
    }
    if (!(options.element instanceof HTMLElement)) {
      throw('options.element is not a DOM node');
    }
    // assign an id if needed
    options.element.id = options.element.id || 'urs-slider-' + sliderIdSuffix++;
    // insert urs-slider class unless already present
    if (options.element.className.split(' ').indexOf('urs-slider') === -1) {
      options.element.className = options.element.className ? options.element.className + ' urs-slider' : 'urs-slider';
    }

    // create the style
    options.style = createStyle(options);

    // create shadow panel
    options.shadowPanel = createPanel(options);
    options.element.appendChild(options.shadowPanel.panel);

    // create panel
    options.panel = createPanel(options);
    options.element.appendChild(options.panel.panel);

    // Offset of the panel. Initially the width of one pane (half panel with).
    // Negative value, means a translation to the left.
    options.offset = -getPaneWidth(options);
    // Index of the current image in options.images array
    options.index = 0;

    // render images once we have set index and offset
    renderImages(options, options.panel);

    // on start dragging
    addEvents(options.element, ['mousedown', 'touchstart'], function(e) {
      onSlideStart(options, e);
    });

    // on move
    addEvents(options.element, ['mousemove', 'touchmove'], function(e) {
      onSlideMove(options, e);
    });

    // when done dragging
    addEvents(options.element, ['mouseup', 'touchend', 'touchcancel'], function(e) {
      onSlideEnd(options, e);
    });
  };

}(typeof exports === 'object' && exports || this));
