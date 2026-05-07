/**
 * touch-controls.js — gamepad virtual táctil compatible con la API del hub.
 *
 * API principal:
 *   var tg = new TouchGamepad(canvas, { container: document.body });
 *   tg.getButton('X'); tg.getButton('ACTION');
 *   tg.getAxis('left_stick_x'); tg.getAxis('MOVE_X');
 *
 * No usa Pointer Events como requisito: soporta touch, mouse y fallbacks ES5.
 */
;(function(window, document, navigator) {
  'use strict';

  var STYLE_ID = 'touch-gamepad-style';

  function now() { return Date.now ? Date.now() : new Date().getTime(); }

  function hasTouch() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0) > 0;
  }

  function addEvent(el, type, fn, opts) {
    if (!el) return;
    if (el.addEventListener) el.addEventListener(type, fn, opts || false);
    else if (el.attachEvent) el.attachEvent('on' + type, fn);
  }

  function removeEvent(el, type, fn) {
    if (!el) return;
    if (el.removeEventListener) el.removeEventListener(type, fn, false);
    else if (el.detachEvent) el.detachEvent('on' + type, fn);
  }

  function addClass(el, cls) {
    if (!el) return;
    if ((' ' + el.className + ' ').indexOf(' ' + cls + ' ') === -1) {
      el.className += (el.className ? ' ' : '') + cls;
    }
  }

  function removeClass(el, cls) {
    if (!el) return;
    el.className = (' ' + el.className + ' ').replace(' ' + cls + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function prevent(e) {
    if (!e) return;
    if (e.preventDefault) e.preventDefault();
    e.returnValue = false;
  }

  function vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms || 12); } catch (e) {}
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css =
      '.touch-gamepad{position:fixed;left:0;top:0;right:0;bottom:0;z-index:9000;pointer-events:none;font-family:Arial,Helvetica,sans-serif;-webkit-user-select:none;user-select:none;touch-action:none;transition:opacity .2s;}' +
      '.touch-gamepad.is-hidden{display:none!important;}' +
      '.touch-gamepad.is-idle{opacity:.28;}' +
      '.touch-gamepad.is-active{opacity:1;}' +
      '.touch-zone{position:absolute;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;}' +
      '.touch-joystick{width:132px;height:132px;left:22px;bottom:22px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.22);}' +
      '.touch-stick{position:absolute;left:50%;top:50%;width:58px;height:58px;margin-left:-29px;margin-top:-29px;border-radius:50%;background:rgba(0,255,136,.32);border:2px solid rgba(0,255,136,.72);}' +
      '.touch-buttons{right:18px;bottom:18px;width:178px;height:178px;}' +
      '.touch-btn{position:absolute;width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,.30);background:rgba(255,255,255,.12);color:#fff;font-size:24px;line-height:58px;text-align:center;font-weight:bold;pointer-events:auto;touch-action:none;}' +
      '.touch-btn.is-pressed{background:rgba(0,255,136,.42);border-color:rgba(0,255,136,.9);transform:scale(.95);}' +
      '.touch-btn-x{right:54px;bottom:0;}.touch-btn-o{right:0;bottom:54px;}.touch-btn-s{right:108px;bottom:54px;}.touch-btn-t{right:54px;bottom:108px;}' +
      '.touch-layout-edit .touch-zone{outline:1px dashed rgba(255,255,255,.45);}' +
      '@media (orientation:portrait){.touch-joystick{width:120px;height:120px;left:16px;bottom:20px}.touch-stick{width:52px;height:52px;margin-left:-26px;margin-top:-26px}.touch-buttons{right:12px;bottom:16px;transform:scale(.92);transform-origin:100% 100%;}}' +
      '@media (max-width:480px){.touch-joystick{width:110px;height:110px}.touch-buttons{transform:scale(.84);}}';

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';

    if (style.styleSheet) style.styleSheet.cssText = css;
    else style.appendChild(document.createTextNode(css));

    var head = document.getElementsByTagName('head')[0] || document.documentElement;
    head.appendChild(style);
  }

  function ButtonState(name) {
    this.name = name;
    this.pressed = false;
    this.value = 0;
    this.lastChange = 0;
  }

  function TouchGamepad(target, options) {
    options = options || {};
    this.target = target || document.body;
    this.container = options.container || document.body;
    this.enabled = options.enabled !== false && hasTouch();
    this.autoHide = options.autoHide !== false;
    this.autoHideDelay = options.autoHideDelay || 2000;
    this.haptics = options.haptics !== false;
    this.gestures = options.gestures !== false;
    this.storageKey = options.storageKey || 'indiehub_touch_layout';
    this.deadZone = options.deadZone || 0.08;

    this.joystickLeft = {
      x: 0,
      y: 0,
      active: false,
      touchId: null,
      baseX: 0,
      baseY: 0,
      radius: options.joystickRadius || 58
    };

    this.joystickRight = null;

    this.buttons = {
      'X': new ButtonState('X'),
      'O': new ButtonState('O'),
      '□': new ButtonState('□'),
      '△': new ButtonState('△')
    };

    this.aliases = {
      'cross': 'X',
      'circle': 'O',
      'square': '□',
      'triangle': '△',
      'ACTION': 'X',
      'CANCEL': 'O',
      'SPECIAL': '□',
      'MENU': '△',
      'START': '△'
    };

    this._idleTimer = null;
    this._mouseJoystick = false;
    this._mouseButton = null;
    this._tapStart = null;
    this._tapTimer = null;
    this._lastTap = 0;
    this._holdTimer = null;
    this._layoutEdit = false;

    if (this.enabled || options.force) {
      injectStyles();
      this.createOverlay(options);
      this.bindEvents();
      this.show();
      this.markIdleSoon();
    }
  }

  TouchGamepad.prototype.createOverlay = function(options) {
    var overlay = document.createElement('div');
    overlay.className = 'touch-gamepad is-active';
    overlay.setAttribute('aria-hidden', 'true');

    var joystick = document.createElement('div');
    joystick.className = 'touch-zone touch-joystick';
    joystick.innerHTML = '<div class="touch-stick"></div>';

    var buttons = document.createElement('div');
    buttons.className = 'touch-zone touch-buttons';
    buttons.innerHTML =
      '<div class="touch-btn touch-btn-t" data-touch-button="△">△</div>' +
      '<div class="touch-btn touch-btn-s" data-touch-button="□">□</div>' +
      '<div class="touch-btn touch-btn-o" data-touch-button="O">O</div>' +
      '<div class="touch-btn touch-btn-x" data-touch-button="X">X</div>';

    overlay.appendChild(joystick);
    overlay.appendChild(buttons);

    this.overlay = overlay;
    this.joystickEl = joystick;
    this.stickEl = joystick.getElementsByTagName('div')[0];
    this.buttonsEl = buttons;

    this.container.appendChild(overlay);
    this.loadLayout();
  };

  TouchGamepad.prototype.bindEvents = function() {
    var self = this;

    this._onJoyStart = function(e) { self.onJoystickStart(e); };
    this._onJoyMove = function(e) { self.onJoystickMove(e); };
    this._onJoyEnd = function(e) { self.onJoystickEnd(e); };

    this._onButtonStart = function(e) { self.onButtonStart(e); };
    this._onButtonEnd = function(e) { self.onButtonEnd(e); };

    this._onGestureStart = function(e) { self.onGestureStart(e); };
    this._onGestureMove = function(e) { self.onGestureMove(e); };
    this._onGestureEnd = function(e) { self.onGestureEnd(e); };

    addEvent(this.joystickEl, 'touchstart', this._onJoyStart, { passive: false });
    addEvent(document, 'touchmove', this._onJoyMove, { passive: false });
    addEvent(document, 'touchend', this._onJoyEnd, { passive: false });
    addEvent(document, 'touchcancel', this._onJoyEnd, { passive: false });

    addEvent(this.joystickEl, 'mousedown', this._onJoyStart);
    addEvent(document, 'mousemove', this._onJoyMove);
    addEvent(document, 'mouseup', this._onJoyEnd);

    addEvent(this.buttonsEl, 'touchstart', this._onButtonStart, { passive: false });
    addEvent(this.buttonsEl, 'touchend', this._onButtonEnd, { passive: false });
    addEvent(this.buttonsEl, 'touchcancel', this._onButtonEnd, { passive: false });
    addEvent(this.buttonsEl, 'mousedown', this._onButtonStart);
    addEvent(document, 'mouseup', this._onButtonEnd);

    if (this.gestures && this.target) {
      addEvent(this.target, 'touchstart', this._onGestureStart, { passive: false });
      addEvent(this.target, 'touchmove', this._onGestureMove, { passive: false });
      addEvent(this.target, 'touchend', this._onGestureEnd, { passive: false });
      addEvent(this.target, 'touchcancel', this._onGestureEnd, { passive: false });
    }
  };

  TouchGamepad.prototype.getTouchById = function(touches, id) {
    if (!touches) return null;
    for (var i = 0; i < touches.length; i++) {
      if (touches[i].identifier === id) return touches[i];
    }
    return null;
  };

  TouchGamepad.prototype.getPoint = function(e) {
    if (e.touches && e.touches.length) return e.touches[0];
    if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0];
    return e;
  };

  TouchGamepad.prototype.findButtonEl = function(node) {
    while (node && node !== this.buttonsEl) {
      if (node.getAttribute && node.getAttribute('data-touch-button')) return node;
      node = node.parentNode;
    }
    return null;
  };

  TouchGamepad.prototype.activate = function() {
    if (!this.overlay) return;
    removeClass(this.overlay, 'is-idle');
    addClass(this.overlay, 'is-active');
    this.markIdleSoon();
  };

  TouchGamepad.prototype.markIdleSoon = function() {
    var self = this;
    if (!this.autoHide || !this.overlay) return;
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(function() {
      removeClass(self.overlay, 'is-active');
      addClass(self.overlay, 'is-idle');
    }, this.autoHideDelay);
  };

  TouchGamepad.prototype.show = function() {
    if (!this.overlay) return;
    removeClass(this.overlay, 'is-hidden');
  };

  TouchGamepad.prototype.hide = function() {
    if (!this.overlay) return;
    addClass(this.overlay, 'is-hidden');
  };

  TouchGamepad.prototype.setVisible = function(visible) {
    if (visible) this.show();
    else this.hide();
  };

  TouchGamepad.prototype.setButton = function(name, pressed, duration) {
    var canonical = this.aliases[name] || name;
    var btn = this.buttons[canonical];
    if (!btn) return;

    btn.pressed = !!pressed;
    btn.value = pressed ? 1 : 0;
    btn.lastChange = now();

    var els = this.buttonsEl ? this.buttonsEl.getElementsByTagName('div') : [];
    for (var i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-touch-button') === canonical) {
        if (pressed) addClass(els[i], 'is-pressed');
        else removeClass(els[i], 'is-pressed');
      }
    }

    if (pressed && this.haptics) vibrate(10);

    if (pressed && duration) {
      var self = this;
      setTimeout(function() { self.setButton(canonical, false); }, duration);
    }
  };

  TouchGamepad.prototype.onJoystickStart = function(e) {
    var p = this.getPoint(e);
    prevent(e);
    this.activate();
    this.joystickLeft.active = true;
    this.joystickLeft.touchId = p.identifier !== undefined ? p.identifier : 'mouse';
    this.joystickLeft.baseX = p.clientX;
    this.joystickLeft.baseY = p.clientY;
    this._mouseJoystick = p.identifier === undefined;
    this.updateJoystick(p.clientX, p.clientY);
  };

  TouchGamepad.prototype.onJoystickMove = function(e) {
    if (!this.joystickLeft.active) return;

    var p;
    if (this.joystickLeft.touchId === 'mouse') {
      p = e;
    } else {
      p = this.getTouchById(e.touches, this.joystickLeft.touchId);
      if (!p) return;
    }

    prevent(e);
    this.activate();
    this.updateJoystick(p.clientX, p.clientY);
  };

  TouchGamepad.prototype.onJoystickEnd = function(e) {
    var shouldEnd = false;

    if (this.joystickLeft.touchId === 'mouse') {
      shouldEnd = true;
    } else if (e.changedTouches) {
      shouldEnd = !!this.getTouchById(e.changedTouches, this.joystickLeft.touchId);
    }

    if (!shouldEnd) return;
    prevent(e);

    this.joystickLeft.active = false;
    this.joystickLeft.touchId = null;
    this.joystickLeft.x = 0;
    this.joystickLeft.y = 0;
    this._mouseJoystick = false;
    this.stickEl.style.left = '50%';
    this.stickEl.style.top = '50%';
    this.stickEl.style.webkitTransform = 'translate(0,0)';
    this.stickEl.style.transform = 'translate(0,0)';
  };

  TouchGamepad.prototype.updateJoystick = function(clientX, clientY) {
    var dx = clientX - this.joystickLeft.baseX;
    var dy = clientY - this.joystickLeft.baseY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var max = this.joystickLeft.radius;

    if (dist > max) {
      dx = dx / dist * max;
      dy = dy / dist * max;
    }

    var x = clamp(dx / max, -1, 1);
    var y = clamp(dy / max, -1, 1);

    if (Math.abs(x) < this.deadZone) x = 0;
    if (Math.abs(y) < this.deadZone) y = 0;

    this.joystickLeft.x = x;
    this.joystickLeft.y = y;

    this.stickEl.style.webkitTransform = 'translate(' + dx + 'px,' + dy + 'px)';
    this.stickEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  };

  TouchGamepad.prototype.onButtonStart = function(e) {
    var touchList = e.changedTouches || [e];
    var handled = false;

    for (var i = 0; i < touchList.length; i++) {
      var target = touchList[i].target || e.target;
      var el = this.findButtonEl(target);
      if (el) {
        this._mouseButton = el;
        this.setButton(el.getAttribute('data-touch-button'), true);
        handled = true;
      }
    }

    if (handled) {
      prevent(e);
      this.activate();
    }
  };

  TouchGamepad.prototype.onButtonEnd = function(e) {
    var touchList = e.changedTouches || [e];
    var handled = false;

    for (var i = 0; i < touchList.length; i++) {
      var target = touchList[i].target || e.target;
      var el = this.findButtonEl(target);
      if (!el && this._mouseButton) el = this._mouseButton;
      if (el) {
        this.setButton(el.getAttribute('data-touch-button'), false);
        this._mouseButton = null;
        handled = true;
      }
    }

    if (handled) prevent(e);
  };

  TouchGamepad.prototype.isControlTarget = function(node) {
    while (node) {
      if (node === this.overlay || node === this.joystickEl || node === this.buttonsEl) return true;
      if (node.className && ('' + node.className).indexOf('touch-') !== -1) return true;
      node = node.parentNode;
    }
    return false;
  };

  TouchGamepad.prototype.onGestureStart = function(e) {
    if (this.isControlTarget(e.target)) return;
    if (!e.touches || e.touches.length !== 1) return;

    var t = e.touches[0];
    var self = this;
    this._tapStart = { x: t.clientX, y: t.clientY, time: now(), moved: false };
    clearTimeout(this._holdTimer);
    this._holdTimer = setTimeout(function() {
      if (self._tapStart && !self._tapStart.moved) {
        self.setButton('□', true, 120);
        self._tapStart.holdFired = true;
      }
    }, 560);
  };

  TouchGamepad.prototype.onGestureMove = function(e) {
    if (!this._tapStart || !e.touches || !e.touches.length) return;
    var t = e.touches[0];
    var dx = t.clientX - this._tapStart.x;
    var dy = t.clientY - this._tapStart.y;
    if (Math.sqrt(dx * dx + dy * dy) > 24) {
      this._tapStart.moved = true;
      clearTimeout(this._holdTimer);
    }
  };

  TouchGamepad.prototype.onGestureEnd = function(e) {
    if (!this._tapStart) return;
    clearTimeout(this._holdTimer);

    var data = this._tapStart;
    this._tapStart = null;

    if (data.moved || data.holdFired) return;

    var elapsed = now() - data.time;
    if (elapsed > 320) return;

    var n = now();
    if (n - this._lastTap < 320) {
      this._lastTap = 0;
      this.setButton('O', true, 100);
    } else {
      this._lastTap = n;
      this.setButton('X', true, 100);
    }
  };

  TouchGamepad.prototype.getButton = function(buttonName) {
    var canonical = this.aliases[buttonName] || buttonName;
    var btn = this.buttons[canonical];
    return !!(btn && btn.pressed);
  };

  TouchGamepad.prototype.getButtonValue = function(buttonName) {
    var canonical = this.aliases[buttonName] || buttonName;
    var btn = this.buttons[canonical];
    return btn ? btn.value : 0;
  };

  TouchGamepad.prototype.getAxis = function(axisName) {
    if (axisName === 'left_stick_x' || axisName === 'MOVE_X' || axisName === 'x') {
      return this.joystickLeft ? this.joystickLeft.x : 0;
    }
    if (axisName === 'left_stick_y' || axisName === 'MOVE_Y' || axisName === 'y') {
      return this.joystickLeft ? this.joystickLeft.y : 0;
    }
    if (axisName === 'right_stick_x' || axisName === 'LOOK_X') {
      return this.joystickRight ? this.joystickRight.x : 0;
    }
    if (axisName === 'right_stick_y' || axisName === 'LOOK_Y') {
      return this.joystickRight ? this.joystickRight.y : 0;
    }
    return 0;
  };

  TouchGamepad.prototype.enableLayoutEdit = function(enabled) {
    this._layoutEdit = enabled !== false;
    if (this._layoutEdit) addClass(this.overlay, 'touch-layout-edit');
    else removeClass(this.overlay, 'touch-layout-edit');
  };

  TouchGamepad.prototype.setLayout = function(layout) {
    if (!layout) return;
    if (layout.joystick && this.joystickEl) {
      if (layout.joystick.left) this.joystickEl.style.left = layout.joystick.left;
      if (layout.joystick.right) this.joystickEl.style.right = layout.joystick.right;
      if (layout.joystick.bottom) this.joystickEl.style.bottom = layout.joystick.bottom;
    }
    if (layout.buttons && this.buttonsEl) {
      if (layout.buttons.left) this.buttonsEl.style.left = layout.buttons.left;
      if (layout.buttons.right) this.buttonsEl.style.right = layout.buttons.right;
      if (layout.buttons.bottom) this.buttonsEl.style.bottom = layout.buttons.bottom;
    }
  };

  TouchGamepad.prototype.saveLayout = function(layout) {
    layout = layout || {};
    try {
      if (window.localStorage) localStorage.setItem(this.storageKey, JSON.stringify(layout));
    } catch (e) {}
  };

  TouchGamepad.prototype.loadLayout = function() {
    try {
      if (window.localStorage) {
        var raw = localStorage.getItem(this.storageKey);
        if (raw) this.setLayout(JSON.parse(raw));
      }
    } catch (e) {}
  };

  TouchGamepad.prototype.destroy = function() {
    clearTimeout(this._idleTimer);
    clearTimeout(this._tapTimer);
    clearTimeout(this._holdTimer);

    removeEvent(this.joystickEl, 'touchstart', this._onJoyStart);
    removeEvent(document, 'touchmove', this._onJoyMove);
    removeEvent(document, 'touchend', this._onJoyEnd);
    removeEvent(document, 'touchcancel', this._onJoyEnd);
    removeEvent(this.joystickEl, 'mousedown', this._onJoyStart);
    removeEvent(document, 'mousemove', this._onJoyMove);
    removeEvent(document, 'mouseup', this._onJoyEnd);

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  };

  window.TouchGamepad = TouchGamepad;

})(window, document, navigator);
