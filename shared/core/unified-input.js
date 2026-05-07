/**
 * unified-input.js — abstracción de Gamepad + teclado + touch + mouse.
 *
 * Uso:
 *   var input = new UnifiedInputSystem({ target: canvas, touchEnabled: true });
 *   input.update();
 *   if (input.wasPressed('ACTION')) jump();
 *   var x = input.getAxis('MOVE_X');
 *
 * Acciones estándar: ACTION, CANCEL, SPECIAL, MENU, START.
 * Ejes estándar: MOVE_X, MOVE_Y, LOOK_X, LOOK_Y.
 */
;(function(window, document, navigator) {
  'use strict';

  function now() { return Date.now ? Date.now() : new Date().getTime(); }

  function addEvent(el, type, fn) {
    if (!el) return;
    if (el.addEventListener) el.addEventListener(type, fn, false);
    else if (el.attachEvent) el.attachEvent('on' + type, fn);
  }

  function removeEvent(el, type, fn) {
    if (!el) return;
    if (el.removeEventListener) el.removeEventListener(type, fn, false);
    else if (el.detachEvent) el.detachEvent('on' + type, fn);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function applyDeadZone(v, dz) {
    dz = dz || 0.16;
    if (Math.abs(v) < dz) return 0;
    return clamp(v, -1, 1);
  }

  function readButton(btn) {
    if (btn === undefined || btn === null) return false;
    if (typeof btn === 'object') return !!btn.pressed || btn.value > 0.5;
    return btn > 0.5;
  }

  function copyState(src) {
    var out = {};
    for (var k in src) {
      if (src.hasOwnProperty(k)) out[k] = src[k];
    }
    return out;
  }

  function UnifiedInputSystem(options) {
    options = options || {};

    var device = window.DeviceDetector ? window.DeviceDetector.info : {};
    var shouldTouch = window.DeviceDetector ? window.DeviceDetector.shouldUseTouchControls() : false;

    this.options = options;
    this.target = options.target || document;
    this.touchContainer = options.touchContainer || document.body;
    this.deadZone = options.deadZone || 0.16;

    this.gamepadEnabled = options.gamepadEnabled !== false;
    this.keyboardEnabled = options.keyboardEnabled !== false;
    this.touchEnabled = options.touchEnabled !== undefined ? !!options.touchEnabled : !!shouldTouch;
    this.mouseEnabled = options.mouseEnabled !== false;
    this.preventScrollKeys = options.preventScrollKeys !== false;

    this.current = {};
    this.previous = {};
    this.axes = { MOVE_X: 0, MOVE_Y: 0, LOOK_X: 0, LOOK_Y: 0 };
    this.keyboard = {};
    this.mouse = { down: false, x: 0, y: 0, wasClick: false, lastClick: 0 };

    this.keyMap = {
      ACTION: [13, 32, 38, 87, 90],       // Enter, Space, Up, W, Z
      CANCEL: [27, 8, 79],                // Esc, Backspace, O
      SPECIAL: [16, 17, 69, 81, 88],      // Shift, Ctrl, E, Q, X
      MENU: [9, 77, 80],                  // Tab, M, P
      START: [13],
      UP: [38, 87],
      DOWN: [40, 83],
      LEFT: [37, 65],
      RIGHT: [39, 68]
    };

    this.gamepadButtonMap = {
      ACTION: [0],
      CANCEL: [1],
      SPECIAL: [2],
      MENU: [3, 9],
      START: [9],
      UP: [12],
      DOWN: [13],
      LEFT: [14],
      RIGHT: [15]
    };

    this.touchButtonMap = {
      ACTION: 'ACTION',
      CANCEL: 'CANCEL',
      SPECIAL: 'SPECIAL',
      MENU: 'MENU',
      START: 'MENU'
    };

    this._bindHandlers();

    if (this.keyboardEnabled) this._bindKeyboard();
    if (this.mouseEnabled) this._bindMouse();

    this.touchGamepad = null;
    if (this.touchEnabled && options.createTouchControls !== false && window.TouchGamepad) {
      this.touchGamepad = new window.TouchGamepad(this.target, options.touchOptions || {
        container: this.touchContainer,
        autoHide: true,
        gestures: true
      });
    }

    this.update();
    this.previous = copyState(this.current);
  }

  UnifiedInputSystem.prototype._bindHandlers = function() {
    var self = this;
    this._onKeyDown = function(e) {
      e = e || window.event;
      var code = e.keyCode || e.which;
      self.keyboard[code] = true;

      if (self.preventScrollKeys && (code === 32 || code === 37 || code === 38 || code === 39 || code === 40)) {
        if (e.preventDefault) e.preventDefault();
        e.returnValue = false;
      }
    };
    this._onKeyUp = function(e) {
      e = e || window.event;
      var code = e.keyCode || e.which;
      self.keyboard[code] = false;
    };
    this._onMouseDown = function(e) {
      self.mouse.down = true;
      self.mouse.wasClick = true;
      self.mouse.lastClick = now();
      self._setMousePoint(e);
    };
    this._onMouseMove = function(e) { self._setMousePoint(e); };
    this._onMouseUp = function(e) {
      self.mouse.down = false;
      self._setMousePoint(e);
    };
  };

  UnifiedInputSystem.prototype._bindKeyboard = function() {
    addEvent(document, 'keydown', this._onKeyDown);
    addEvent(document, 'keyup', this._onKeyUp);
    addEvent(window, 'blur', this._onKeyUp);
  };

  UnifiedInputSystem.prototype._bindMouse = function() {
    addEvent(this.target, 'mousedown', this._onMouseDown);
    addEvent(this.target, 'mousemove', this._onMouseMove);
    addEvent(document, 'mouseup', this._onMouseUp);
  };

  UnifiedInputSystem.prototype._setMousePoint = function(e) {
    e = e || window.event;
    this.mouse.x = e.clientX || 0;
    this.mouse.y = e.clientY || 0;
  };

  UnifiedInputSystem.prototype._isAnyKeyPressed = function(list) {
    if (!list) return false;
    for (var i = 0; i < list.length; i++) {
      if (this.keyboard[list[i]]) return true;
    }
    return false;
  };

  UnifiedInputSystem.prototype._getPads = function() {
    var getter = navigator.getGamepads || navigator.webkitGetGamepads;
    if (!getter) return [];
    try { return getter.call(navigator) || []; } catch (e) { return []; }
  };

  UnifiedInputSystem.prototype._readGamepadButton = function(action) {
    if (!this.gamepadEnabled) return false;

    var pads = this._getPads();
    var indices = this.gamepadButtonMap[action] || [];

    for (var p = 0; p < pads.length; p++) {
      var pad = pads[p];
      if (!pad || pad.connected === false) continue;

      for (var i = 0; i < indices.length; i++) {
        if (pad.buttons && readButton(pad.buttons[indices[i]])) return true;
      }
    }
    return false;
  };

  UnifiedInputSystem.prototype._readGamepadAxis = function(axisName) {
    if (!this.gamepadEnabled) return 0;

    var pads = this._getPads();
    var axisIndex = axisName === 'MOVE_X' ? 0 :
                    axisName === 'MOVE_Y' ? 1 :
                    axisName === 'LOOK_X' ? 2 :
                    axisName === 'LOOK_Y' ? 3 : -1;

    if (axisIndex < 0) return 0;

    for (var p = 0; p < pads.length; p++) {
      var pad = pads[p];
      if (!pad || pad.connected === false || !pad.axes || pad.axes.length <= axisIndex) continue;

      var v = applyDeadZone(pad.axes[axisIndex] || 0, this.deadZone);
      if (v !== 0) return v;
    }
    return 0;
  };

  UnifiedInputSystem.prototype._readKeyboardAxis = function(axisName) {
    var v = 0;

    if (axisName === 'MOVE_X') {
      if (this._isAnyKeyPressed(this.keyMap.LEFT)) v -= 1;
      if (this._isAnyKeyPressed(this.keyMap.RIGHT)) v += 1;
    } else if (axisName === 'MOVE_Y') {
      if (this._isAnyKeyPressed(this.keyMap.UP)) v -= 1;
      if (this._isAnyKeyPressed(this.keyMap.DOWN)) v += 1;
    }

    return clamp(v, -1, 1);
  };

  UnifiedInputSystem.prototype._readTouchButton = function(action) {
    if (!this.touchGamepad) return false;
    var mapped = this.touchButtonMap[action] || action;
    return this.touchGamepad.getButton(mapped);
  };

  UnifiedInputSystem.prototype._readTouchAxis = function(axisName) {
    if (!this.touchGamepad) return 0;
    return this.touchGamepad.getAxis(axisName);
  };

  UnifiedInputSystem.prototype._readAction = function(action) {
    if (this.keyboardEnabled && this._isAnyKeyPressed(this.keyMap[action])) return true;
    if (this._readGamepadButton(action)) return true;
    if (this._readTouchButton(action)) return true;

    if (action === 'ACTION' && this.mouseEnabled && this.mouse.down) return true;

    return false;
  };

  UnifiedInputSystem.prototype.update = function() {
    this.previous = copyState(this.current);

    var actions = ['ACTION', 'CANCEL', 'SPECIAL', 'MENU', 'START', 'UP', 'DOWN', 'LEFT', 'RIGHT'];
    var next = {};

    for (var i = 0; i < actions.length; i++) {
      next[actions[i]] = this._readAction(actions[i]);
    }

    this.current = next;

    var mx = 0;
    var my = 0;
    var lookX = 0;
    var lookY = 0;

    mx += this._readKeyboardAxis('MOVE_X');
    my += this._readKeyboardAxis('MOVE_Y');

    mx += this._readGamepadAxis('MOVE_X');
    my += this._readGamepadAxis('MOVE_Y');
    lookX += this._readGamepadAxis('LOOK_X');
    lookY += this._readGamepadAxis('LOOK_Y');

    mx += this._readTouchAxis('MOVE_X');
    my += this._readTouchAxis('MOVE_Y');

    if (next.LEFT) mx -= 1;
    if (next.RIGHT) mx += 1;
    if (next.UP) my -= 1;
    if (next.DOWN) my += 1;

    this.axes.MOVE_X = clamp(mx, -1, 1);
    this.axes.MOVE_Y = clamp(my, -1, 1);
    this.axes.LOOK_X = clamp(lookX, -1, 1);
    this.axes.LOOK_Y = clamp(lookY, -1, 1);

    if (this.mouse.wasClick && now() - this.mouse.lastClick > 80) {
      this.mouse.wasClick = false;
    }
  };

  UnifiedInputSystem.prototype.isPressed = function(action) {
    return !!this.current[action];
  };

  UnifiedInputSystem.prototype.wasPressed = function(action) {
    return !!this.current[action] && !this.previous[action];
  };

  UnifiedInputSystem.prototype.wasReleased = function(action) {
    return !this.current[action] && !!this.previous[action];
  };

  UnifiedInputSystem.prototype.getAxis = function(axisName) {
    return this.axes[axisName] || 0;
  };

  UnifiedInputSystem.prototype.getVector = function() {
    return { x: this.axes.MOVE_X || 0, y: this.axes.MOVE_Y || 0 };
  };

  UnifiedInputSystem.prototype.getSourceStatus = function() {
    return {
      keyboard: this.keyboardEnabled,
      gamepad: this.gamepadEnabled,
      touch: !!this.touchGamepad,
      mouse: this.mouseEnabled
    };
  };

  UnifiedInputSystem.prototype.destroy = function() {
    removeEvent(document, 'keydown', this._onKeyDown);
    removeEvent(document, 'keyup', this._onKeyUp);
    removeEvent(window, 'blur', this._onKeyUp);
    removeEvent(this.target, 'mousedown', this._onMouseDown);
    removeEvent(this.target, 'mousemove', this._onMouseMove);
    removeEvent(document, 'mouseup', this._onMouseUp);

    if (this.touchGamepad && this.touchGamepad.destroy) {
      this.touchGamepad.destroy();
    }
  };

  window.UnifiedInputSystem = UnifiedInputSystem;

})(window, document, navigator);
