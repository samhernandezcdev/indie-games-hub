/**
 * gamepad-nav.js — Navegación del hub con mando PS3
 * Usa la Gamepad API con fallback para PS3 WebKit
 * Compatible con ES3/ES5 (sin arrow functions, sin let/const)
 */

;(function(window, document) {
  'use strict';

  /* ---- Configuración ---- */
  var NAV_CONFIG = {
    POLL_INTERVAL:   50,   // ms entre lecturas del gamepad (PS3: no usar RAF para esto)
    STICK_DEAD_ZONE: 0.35, // zona muerta del stick analógico
    BTN_HOLD_DELAY:  400,  // ms antes de repetición por mantener presionado
    BTN_REPEAT_RATE: 150,  // ms entre repeticiones
    COLS:            3     // columnas del grid de juegos
  };

  /* ---- Estado ---- */
  var NavState = {
    active:       false,
    selectedIndex: 0,
    cards:        [],
    pollTimer:    null,
    lastButtons:  [],      // estado anterior de botones
    holdTimers:   {},      // timers de repetición por botón
    gamepadIndex: -1       // índice del gamepad conectado
  };

  /* ---- Indicador visual del mando ---- */
  var indicatorEl = document.getElementById('gamepad-indicator');

  function setIndicator(connected) {
    if (!indicatorEl) return;
    if (connected) {
      indicatorEl.classList.add('connected');
      indicatorEl.classList.remove('disconnected');
      indicatorEl.querySelector('.label').textContent = 'MANDO';
    } else {
      indicatorEl.classList.remove('connected');
      indicatorEl.classList.add('disconnected');
      indicatorEl.querySelector('.label').textContent = 'SIN MANDO';
    }
  }

  /* ----------------------------------------------------------
     OBTENER TARJETAS NAVEGABLES
  ---------------------------------------------------------- */
  function refreshCards() {
    // Solo tarjetas que no sean el botón "añadir"
    var all = document.querySelectorAll('.game-card');
    NavState.cards = [];
    for (var i = 0; i < all.length; i++) {
      if (!all[i].classList.contains('game-card--add')) {
        NavState.cards.push(all[i]);
      }
    }
  }

  /* ----------------------------------------------------------
     SELECCIÓN DE TARJETA
  ---------------------------------------------------------- */
  function selectCard(index) {
    var cards = NavState.cards;
    if (!cards.length) return;

    // Clamp
    if (index < 0)             index = 0;
    if (index >= cards.length) index = cards.length - 1;

    // Quitar focus anterior
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('focused');
    }

    NavState.selectedIndex = index;
    cards[index].classList.add('focused');
    cards[index].focus();

    // Asegurar que la card esté visible (scroll)
    if (cards[index].scrollIntoView) {
      cards[index].scrollIntoView({ block: 'nearest' });
    }
  }

  function moveLeft()  { selectCard(NavState.selectedIndex - 1); }
  function moveRight() { selectCard(NavState.selectedIndex + 1); }
  function moveUp()    { selectCard(NavState.selectedIndex - NAV_CONFIG.COLS); }
  function moveDown()  { selectCard(NavState.selectedIndex + NAV_CONFIG.COLS); }

  /* ----------------------------------------------------------
     ACCIONES DE BOTONES
  ---------------------------------------------------------- */
  function pressAction(card) {
    // Cross (✕) — lanzar juego
    var gameId = card.getAttribute('data-game-id');
    if (!gameId || gameId === 'add-game') return;
    if (window.GameLauncher) {
      window.GameLauncher.launch(card);
    }
  }

  function infoAction(card) {
    // Square (□) — mostrar info
    if (window.GameLauncher) {
      window.GameLauncher.showInfo(card);
    }
  }

  /* ----------------------------------------------------------
     MAPEADO DE BOTONES PS3
     Índices estándar Gamepad API para DualShock 3:
     0=Cross  1=Circle  2=Square  3=Triangle
     4=L1     5=R1      6=L2      7=R2
     8=Select 9=Start
     12=Up 13=Down 14=Left 15=Right (D-Pad)
  ---------------------------------------------------------- */
  var BUTTON_MAP = {
    CROSS:    0,
    CIRCLE:   1,
    SQUARE:   2,
    TRIANGLE: 3,
    L1: 4, R1: 5, L2: 6, R2: 7,
    SELECT: 8, START: 9,
    DPAD_UP:    12,
    DPAD_DOWN:  13,
    DPAD_LEFT:  14,
    DPAD_RIGHT: 15
  };

  /* ----------------------------------------------------------
     LEER ESTADO DEL GAMEPAD
  ---------------------------------------------------------- */
  function getGamepad() {
    if (!navigator.getGamepads) return null;
    var pads = navigator.getGamepads();
    // Buscar el primer gamepad conectado
    for (var i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) {
        NavState.gamepadIndex = i;
        return pads[i];
      }
    }
    return null;
  }

  function isButtonPressed(pad, index) {
    if (!pad || !pad.buttons || index >= pad.buttons.length) return false;
    var btn = pad.buttons[index];
    if (typeof btn === 'object') return btn.pressed || (btn.value > 0.5);
    return btn > 0.5;
  }

  /* ----------------------------------------------------------
     LEER STICK ANALÓGICO
  ---------------------------------------------------------- */
  function readAxes(pad) {
    if (!pad || !pad.axes || pad.axes.length < 2) return { x: 0, y: 0 };
    return {
      x: pad.axes[0] || 0,
      y: pad.axes[1] || 0
    };
  }

  /* ----------------------------------------------------------
     CICLO PRINCIPAL DE POLLING
  ---------------------------------------------------------- */
  var stickMoved = false;

  function poll() {
    if (!NavState.active) return;

    var pad = getGamepad();
    setIndicator(!!pad);

    if (!pad) {
      stickMoved = false;
      return;
    }

    var cards = NavState.cards;
    if (!cards.length) return;

    /* ---- D-Pad navegación ---- */
    function handleDir(btnIndex, action) {
      var pressed = isButtonPressed(pad, btnIndex);
      var wasPressed = NavState.lastButtons[btnIndex] || false;

      if (pressed && !wasPressed) {
        // Primer press
        action();
        // Iniciar timer de repetición
        NavState.holdTimers[btnIndex] = setTimeout(function() {
          NavState.holdTimers[btnIndex] = setInterval(action, NAV_CONFIG.BTN_REPEAT_RATE);
        }, NAV_CONFIG.BTN_HOLD_DELAY);
      } else if (!pressed && wasPressed) {
        // Soltado
        clearTimeout(NavState.holdTimers[btnIndex]);
        clearInterval(NavState.holdTimers[btnIndex]);
        delete NavState.holdTimers[btnIndex];
      }
      NavState.lastButtons[btnIndex] = pressed;
    }

    handleDir(BUTTON_MAP.DPAD_LEFT,  moveLeft);
    handleDir(BUTTON_MAP.DPAD_RIGHT, moveRight);
    handleDir(BUTTON_MAP.DPAD_UP,    moveUp);
    handleDir(BUTTON_MAP.DPAD_DOWN,  moveDown);

    /* ---- Stick izquierdo ---- */
    var axes = readAxes(pad);
    var dz   = NAV_CONFIG.STICK_DEAD_ZONE;

    if (Math.abs(axes.x) > dz || Math.abs(axes.y) > dz) {
      if (!stickMoved) {
        stickMoved = true;
        if      (axes.x < -dz) moveLeft();
        else if (axes.x >  dz) moveRight();
        else if (axes.y < -dz) moveUp();
        else if (axes.y >  dz) moveDown();
      }
    } else {
      stickMoved = false;
    }

    /* ---- Botones de acción (solo en primer press) ---- */
    var card = cards[NavState.selectedIndex];

    // Cross: jugar
    var crossNow  = isButtonPressed(pad, BUTTON_MAP.CROSS);
    var crossWas  = NavState.lastButtons[BUTTON_MAP.CROSS] || false;
    if (crossNow && !crossWas && card) {
      pressAction(card);
    }
    NavState.lastButtons[BUTTON_MAP.CROSS] = crossNow;

    // Square: info
    var squareNow = isButtonPressed(pad, BUTTON_MAP.SQUARE);
    var squareWas = NavState.lastButtons[BUTTON_MAP.SQUARE] || false;
    if (squareNow && !squareWas && card) {
      infoAction(card);
    }
    NavState.lastButtons[BUTTON_MAP.SQUARE] = squareNow;

    // Circle: cerrar panel de info si está abierto
    var circleNow = isButtonPressed(pad, BUTTON_MAP.CIRCLE);
    var circleWas = NavState.lastButtons[BUTTON_MAP.CIRCLE] || false;
    if (circleNow && !circleWas) {
      if (window.GameLauncher) {
        window.GameLauncher.closeInfo();
      }
    }
    NavState.lastButtons[BUTTON_MAP.CIRCLE] = circleNow;
  }

  /* ----------------------------------------------------------
     EVENTOS DE CONEXIÓN/DESCONEXIÓN
  ---------------------------------------------------------- */
  function onGamepadConnected(e) {
    console.log('[GamepadNav] Mando conectado:', e.gamepad ? e.gamepad.id : '?');
    setIndicator(true);
  }

  function onGamepadDisconnected(e) {
    console.log('[GamepadNav] Mando desconectado');
    setIndicator(false);
    NavState.gamepadIndex = -1;
  }

  /* ----------------------------------------------------------
     NAVEGACIÓN POR TECLADO (fallback para PC / testing)
  ---------------------------------------------------------- */
  function initKeyboardFallback() {
    document.addEventListener('keydown', function(e) {
      if (!NavState.active) return;
      var cards = NavState.cards;
      if (!cards.length) return;

      switch (e.keyCode) {
        case 37: moveLeft();  e.preventDefault(); break; // ←
        case 39: moveRight(); e.preventDefault(); break; // →
        case 38: moveUp();    e.preventDefault(); break; // ↑
        case 40: moveDown();  e.preventDefault(); break; // ↓
        case 13: // Enter = Cross
        case 32: // Espacio = Cross
          pressAction(cards[NavState.selectedIndex]);
          e.preventDefault();
          break;
        case 73: // I = Square (info)
          infoAction(cards[NavState.selectedIndex]);
          break;
        case 27: // Esc = Circle (cerrar)
          if (window.GameLauncher) window.GameLauncher.closeInfo();
          break;
      }
    });
  }

  /* ----------------------------------------------------------
     INIT
  ---------------------------------------------------------- */
  function init() {
    refreshCards();
    selectCard(0);
    initKeyboardFallback();

    // Eventos de gamepad
    if (window.addEventListener) {
      window.addEventListener('gamepadconnected',    onGamepadConnected,    false);
      window.addEventListener('gamepaddisconnected', onGamepadDisconnected, false);
    }

    // Iniciar polling (setInterval, NO requestAnimationFrame — más estable en PS3)
    NavState.pollTimer = setInterval(poll, NAV_CONFIG.POLL_INTERVAL);
  }

  /* ---- API pública ---- */
  window.GamepadNav = {
    setActive: function(val) {
      NavState.active = val;
      if (val) {
        refreshCards();
        selectCard(NavState.selectedIndex);
      }
    },
    refreshCards: refreshCards,
    selectCard:   selectCard,
    isActive:     function() { return NavState.active; }
  };

  /* ---- Arrancar ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
