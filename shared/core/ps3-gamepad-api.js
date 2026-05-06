/**
 * ps3-gamepad-api.js — API de Gamepad específica para PS3
 * Abstrae las diferencias entre la Gamepad API estándar y
 * implementaciones antiguas de WebKit en PS3
 *
 * PS3 Browser usó WebKit ~533 (Safari 5 era), con soporte
 * limitado y no-estándar de la Gamepad API.
 */

;(function(window) {
  "use strict";

  /* ----------------------------------------------------------
     DETECCIÓN DE SOPORTE
  ---------------------------------------------------------- */
  var support = (function() {
    var hasStandard  = !!navigator.getGamepads;
    // Prefijado WebKit — usado en algunas versiones
    var hasWebKit    = !!navigator.webkitGetGamepads;
    // Evento experimental (Chrome antiguo / WebKit)
    var hasEvents    = (typeof window.GamepadEvent !== "undefined");

    return {
      standard:  hasStandard,
      webkit:    hasWebKit,
      events:    hasEvents,
      any:       hasStandard || hasWebKit
    };
  })();

  /* ----------------------------------------------------------
     CALLBACKS REGISTRADOS
  ---------------------------------------------------------- */
  var callbacks = {
    cross:    [],
    circle:   [],
    square:   [],
    triangle: [],
    start:    [],
    select:   [],
    up:       [],
    down:     [],
    left:     [],
    right:    []
  };

  /* ----------------------------------------------------------
     OBTENER GAMEPADS (con prefijo)
  ---------------------------------------------------------- */
  function getGamepads() {
    if (navigator.getGamepads) {
      return navigator.getGamepads();
    }
    if (navigator.webkitGetGamepads) {
      return navigator.webkitGetGamepads();
    }
    return [];
  }

  /* ----------------------------------------------------------
     NORMALIZAR BOTÓN
     PS3 DualShock 3 puede reportar botones como number (0/1)
     en lugar de GamepadButton object
  ---------------------------------------------------------- */
  function isPressed(btn) {
    if (!btn) return false;
    if (typeof btn === "number") return btn > 0.5;
    if (typeof btn === "object" && "pressed" in btn) return btn.pressed;
    if (typeof btn === "object" && "value"   in btn) return btn.value > 0.5;
    return false;
  }

  /* ----------------------------------------------------------
     MAPA DE BOTONES PS3
     DualShock 3 a través de Gamepad API estándar:
  ---------------------------------------------------------- */
  var PS3_BUTTONS = {
    CROSS:     0,
    CIRCLE:    1,
    SQUARE:    2,
    TRIANGLE:  3,
    L1:        4,
    R1:        5,
    L2:        6,
    R2:        7,
    SELECT:    8,
    START:     9,
    L3:       10,   // stick L pulsado
    R3:       11,   // stick R pulsado
    DPAD_UP:   12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT:15,
    PS_BUTTON: 16
  };

  /* ----------------------------------------------------------
     ESTADO PREVIO (para detectar transición off→on)
  ---------------------------------------------------------- */
  var prevState = {};

  /* ----------------------------------------------------------
     LEER Y DISPARAR CALLBACKS
  ---------------------------------------------------------- */
  function poll() {
    var pads = getGamepads();
    for (var gi = 0; gi < pads.length; gi++) {
      var pad = pads[gi];
      if (!pad || !pad.connected) continue;

      var id = pad.index;
      if (!prevState[id]) prevState[id] = {};

      function check(btnName, btnIndex) {
        var cur = isPressed(pad.buttons[btnIndex]);
        var was = prevState[id][btnIndex] || false;

        if (cur && !was) {
          // Disparar callbacks para este botón
          var cbs = callbacks[btnName];
          if (cbs) {
            for (var ci = 0; ci < cbs.length; ci++) {
              try { cbs[ci](pad); } catch(e) {}
            }
          }
        }
        prevState[id][btnIndex] = cur;
      }

      check("cross",    PS3_BUTTONS.CROSS);
      check("circle",   PS3_BUTTONS.CIRCLE);
      check("square",   PS3_BUTTONS.SQUARE);
      check("triangle", PS3_BUTTONS.TRIANGLE);
      check("start",    PS3_BUTTONS.START);
      check("select",   PS3_BUTTONS.SELECT);
      check("up",       PS3_BUTTONS.DPAD_UP);
      check("down",     PS3_BUTTONS.DPAD_DOWN);
      check("left",     PS3_BUTTONS.DPAD_LEFT);
      check("right",    PS3_BUTTONS.DPAD_RIGHT);
    }
  }

  /* ----------------------------------------------------------
     INICIAR POLLING
  ---------------------------------------------------------- */
  var pollTimer = null;

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(poll, 50);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* ----------------------------------------------------------
     EVENTOS DE CONEXIÓN
  ---------------------------------------------------------- */
  if (window.addEventListener) {
    window.addEventListener("gamepadconnected", function(e) {
      console.log("[PS3GamepadAPI] Gamepad conectado:", e.gamepad ? e.gamepad.id : "desconocido");
      startPolling();
    }, false);

    window.addEventListener("gamepaddisconnected", function(e) {
      console.log("[PS3GamepadAPI] Gamepad desconectado");
      if (e.gamepad) {
        delete prevState[e.gamepad.index];
      }
    }, false);
  }

  /* Iniciar polling de todas formas (PS3 no siempre dispara el evento) */
  startPolling();

  /* ----------------------------------------------------------
     API PÚBLICA
  ---------------------------------------------------------- */
  window.PS3GamepadAPI = {
    /**
     * Registrar callback para un botón específico
     * @param {string} buttonName — 'cross','circle','square','triangle','start','select','up','down','left','right'
     * @param {function} callback
     */
    onButtonPress: function(buttonName, callback) {
      if (callbacks[buttonName] && typeof callback === "function") {
        callbacks[buttonName].push(callback);
      }
    },

    /**
     * Quitar callback
     */
    offButtonPress: function(buttonName, callback) {
      if (!callbacks[buttonName]) return;
      var arr = callbacks[buttonName];
      for (var i = arr.length - 1; i >= 0; i--) {
        if (arr[i] === callback) arr.splice(i, 1);
      }
    },

    /**
     * Obtener el gamepad activo
     */
    getActiveGamepad: function() {
      var pads = getGamepads();
      for (var i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) return pads[i];
      }
      return null;
    },

    /**
     * ¿Hay algún gamepad conectado?
     */
    isConnected: function() {
      return !!this.getActiveGamepad();
    },

    /**
     * Leer eje analógico crudo
     * @param {number} axisIndex — 0=LX, 1=LY, 2=RX, 3=RY
     */
    getAxis: function(axisIndex) {
      var pad = this.getActiveGamepad();
      if (!pad || !pad.axes || axisIndex >= pad.axes.length) return 0;
      return pad.axes[axisIndex] || 0;
    },

    /* Estado de soporte */
    support: support,
    buttons: PS3_BUTTONS,

    startPolling: startPolling,
    stopPolling:  stopPolling
  };

})(window);
