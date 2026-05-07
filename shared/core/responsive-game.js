/**
 * responsive-game.js — escalado proporcional para juegos originalmente fijos.
 * Mantiene aspect ratio, aplica letterbox/pillarbox y convierte coordenadas.
 * ES5 para conservar compatibilidad con PS3 Browser.
 */
;(function(window, document) {
  'use strict';

  function addEvent(target, type, fn) {
    if (!target) return;
    if (target.addEventListener) target.addEventListener(type, fn, false);
    else if (target.attachEvent) target.attachEvent('on' + type, fn);
  }

  function getViewportSize(container) {
    var w = 0;
    var h = 0;

    if (container) {
      w = container.clientWidth || 0;
      h = container.clientHeight || 0;
    }

    if (!w) w = window.innerWidth || document.documentElement.clientWidth || 1280;
    if (!h) h = window.innerHeight || document.documentElement.clientHeight || 720;

    return { width: w, height: h };
  }

  function ResponsiveGameManager(canvas, originalWidth, originalHeight, options) {
    this.canvas = canvas;
    this.originalWidth = originalWidth || (canvas ? canvas.width : 1280) || 1280;
    this.originalHeight = originalHeight || (canvas ? canvas.height : 720) || 720;
    this.options = options || {};
    this.container = this.options.container || (canvas ? canvas.parentNode : document.body);
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.renderWidth = this.originalWidth;
    this.renderHeight = this.originalHeight;
    this.isPS3 = !!(window.DeviceDetector && window.DeviceDetector.info && window.DeviceDetector.info.isPS3);

    this._boundResize = this.updateScale.bind ? this.updateScale.bind(this) : this._makeResizeHandler();

    this.prepareElements();
    addEvent(window, 'resize', this._boundResize);
    addEvent(window, 'orientationchange', this._orientationHandler());
    this.updateScale();
  }

  ResponsiveGameManager.prototype._makeResizeHandler = function() {
    var self = this;
    return function() { self.updateScale(); };
  };

  ResponsiveGameManager.prototype._orientationHandler = function() {
    var self = this;
    return function() {
      setTimeout(function() { self.updateScale(); }, 100);
      setTimeout(function() { self.updateScale(); }, 450);
    };
  };

  ResponsiveGameManager.prototype.prepareElements = function() {
    if (!this.canvas) return;

    if (this.container) {
      if (!this.container.style.position || this.container.style.position === 'static') {
        this.container.style.position = 'relative';
      }
      this.container.style.overflow = 'hidden';
      this.container.style.background = '#000';
      this.container.style.touchAction = 'none';
    }

    this.canvas.width = this.originalWidth;
    this.canvas.height = this.originalHeight;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '50%';
    this.canvas.style.top = '50%';
    this.canvas.style.width = this.originalWidth + 'px';
    this.canvas.style.height = this.originalHeight + 'px';
    this.canvas.style.webkitTransformOrigin = '50% 50%';
    this.canvas.style.transformOrigin = '50% 50%';
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
  };

  ResponsiveGameManager.prototype.updateScale = function() {
    if (!this.canvas) return;

    var size = getViewportSize(this.container);
    var containerWidth = size.width;
    var containerHeight = size.height;

    var scaleX = containerWidth / this.originalWidth;
    var scaleY = containerHeight / this.originalHeight;
    var nextScale = Math.min(scaleX, scaleY);

    if (!isFinite(nextScale) || nextScale <= 0) nextScale = 1;

    this.scale = nextScale;
    this.renderWidth = this.originalWidth * this.scale;
    this.renderHeight = this.originalHeight * this.scale;
    this.offsetX = (containerWidth - this.renderWidth) / 2;
    this.offsetY = (containerHeight - this.renderHeight) / 2;

    var transform = 'translate(-50%, -50%) scale(' + this.scale + ')';
    this.canvas.style.webkitTransform = transform;
    this.canvas.style.transform = transform;

    if (this.options.onResize) {
      this.options.onResize({
        scale: this.scale,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        width: containerWidth,
        height: containerHeight,
        renderWidth: this.renderWidth,
        renderHeight: this.renderHeight
      });
    }
  };

  ResponsiveGameManager.prototype.gameCoordinates = function(touchX, touchY) {
    var rect;
    if (this.container && this.container.getBoundingClientRect) {
      rect = this.container.getBoundingClientRect();
      touchX = touchX - rect.left;
      touchY = touchY - rect.top;
    }

    return {
      x: (touchX - this.offsetX) / this.scale,
      y: (touchY - this.offsetY) / this.scale
    };
  };

  ResponsiveGameManager.prototype.screenCoordinates = function(gameX, gameY) {
    return {
      x: (gameX * this.scale) + this.offsetX,
      y: (gameY * this.scale) + this.offsetY
    };
  };

  ResponsiveGameManager.prototype.isInsideGame = function(screenX, screenY) {
    var p = this.gameCoordinates(screenX, screenY);
    return p.x >= 0 && p.y >= 0 && p.x <= this.originalWidth && p.y <= this.originalHeight;
  };

  ResponsiveGameManager.prototype.destroy = function() {
    if (window.removeEventListener && this._boundResize) {
      window.removeEventListener('resize', this._boundResize, false);
    }
  };

  window.ResponsiveGameManager = ResponsiveGameManager;

})(window, document);
