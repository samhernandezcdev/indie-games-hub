/**
 * gamepad-nav.js — navegación del hub con mando PS3/PC y teclado.
 * Compatible ES5. Las columnas se calculan según el layout responsive real.
 */
;(function(window, document, navigator) {
  'use strict';

  var NAV_CONFIG = {
    POLL_INTERVAL: 50,
    STICK_DEAD_ZONE: 0.35,
    BTN_HOLD_DELAY: 400,
    BTN_REPEAT_RATE: 150
  };

  var NavState = {
    active: false,
    selectedIndex: 0,
    cards: [],
    pollTimer: null,
    lastButtons: [],
    holdTimers: {},
    gamepadIndex: -1,
    stickMoved: false
  };

  var indicatorEl = document.getElementById('gamepad-indicator');

  function addClass(el, cls) {
    if (!el) return;
    if (el.classList) el.classList.add(cls);
    else if ((' ' + el.className + ' ').indexOf(' ' + cls + ' ') === -1) el.className += ' ' + cls;
  }

  function removeClass(el, cls) {
    if (!el) return;
    if (el.classList) el.classList.remove(cls);
    else el.className = (' ' + el.className + ' ').replace(' ' + cls + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  function hasClass(el, cls) {
    if (!el) return false;
    if (el.classList) return el.classList.contains(cls);
    return (' ' + el.className + ' ').indexOf(' ' + cls + ' ') !== -1;
  }

  function setIndicator(connected) {
    if (!indicatorEl) return;
    var label = indicatorEl.querySelector ? indicatorEl.querySelector('.label') : null;

    if (connected) {
      addClass(indicatorEl, 'connected');
      removeClass(indicatorEl, 'disconnected');
      if (label) label.textContent = 'MANDO';
    } else {
      removeClass(indicatorEl, 'connected');
      addClass(indicatorEl, 'disconnected');
      if (label) label.textContent = 'SIN MANDO';
    }
  }

  function refreshCards() {
    var all = document.querySelectorAll ? document.querySelectorAll('.game-card') : [];
    NavState.cards = [];
    for (var i = 0; i < all.length; i++) {
      if (!hasClass(all[i], 'game-card--add') && !hasClass(all[i], 'filtered-out')) {
        NavState.cards.push(all[i]);
      }
    }

    if (NavState.selectedIndex >= NavState.cards.length) {
      NavState.selectedIndex = Math.max(0, NavState.cards.length - 1);
    }
  }

  function computeColumns() {
    var cards = NavState.cards;
    if (!cards.length) return 1;

    var firstTop = cards[0].offsetTop;
    var cols = 0;
    for (var i = 0; i < cards.length; i++) {
      if (Math.abs(cards[i].offsetTop - firstTop) < 12) cols++;
      else break;
    }
    return Math.max(1, cols || 1);
  }

  function safeScrollIntoView(el) {
    if (!el || !el.scrollIntoView) return;
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (e) {
      try { el.scrollIntoView(false); } catch (e2) {}
    }
  }

  function selectCard(index) {
    refreshCards();
    var cards = NavState.cards;
    if (!cards.length) return;

    if (index < 0) index = 0;
    if (index >= cards.length) index = cards.length - 1;

    for (var i = 0; i < cards.length; i++) removeClass(cards[i], 'focused');

    NavState.selectedIndex = index;
    addClass(cards[index], 'focused');

    try { cards[index].focus(); } catch (e) {}
    safeScrollIntoView(cards[index]);
  }

  function moveLeft() { selectCard(NavState.selectedIndex - 1); }
  function moveRight() { selectCard(NavState.selectedIndex + 1); }
  function moveUp() { selectCard(NavState.selectedIndex - computeColumns()); }
  function moveDown() { selectCard(NavState.selectedIndex + computeColumns()); }

  function getSelectedCard() {
    refreshCards();
    return NavState.cards[NavState.selectedIndex] || null;
  }

  function pressAction(card) {
    if (!card) return;
    var gameId = card.getAttribute('data-game-id');
    if (!gameId || gameId === 'add-game') return;
    if (window.GameLauncher) window.GameLauncher.launch(card);
  }

  function infoAction(card) {
    if (!card) return;
    if (window.GameLauncher) window.GameLauncher.showInfo(card);
  }

  var BUTTON_MAP = {
    CROSS: 0,
    CIRCLE: 1,
    SQUARE: 2,
    TRIANGLE: 3,
    L1: 4,
    R1: 5,
    L2: 6,
    R2: 7,
    SELECT: 8,
    START: 9,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15
  };

  function getGamepad() {
    var getter = navigator.getGamepads || navigator.webkitGetGamepads;
    if (!getter) return null;

    var pads;
    try { pads = getter.call(navigator); } catch (e) { return null; }
    if (!pads) return null;

    for (var i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected !== false) {
        NavState.gamepadIndex = i;
        return pads[i];
      }
    }
    return null;
  }

  function isButtonPressed(pad, index) {
    if (!pad || !pad.buttons || index >= pad.buttons.length) return false;
    var btn = pad.buttons[index];
    if (typeof btn === 'object') return !!btn.pressed || btn.value > 0.5;
    return btn > 0.5;
  }

  function readAxes(pad) {
    if (!pad || !pad.axes || pad.axes.length < 2) return { x: 0, y: 0 };
    return { x: pad.axes[0] || 0, y: pad.axes[1] || 0 };
  }

  function clearHold(btnIndex) {
    clearTimeout(NavState.holdTimers[btnIndex]);
    clearInterval(NavState.holdTimers[btnIndex]);
    delete NavState.holdTimers[btnIndex];
  }

  function handleDir(pad, btnIndex, action) {
    var pressed = isButtonPressed(pad, btnIndex);
    var wasPressed = NavState.lastButtons[btnIndex] || false;

    if (pressed && !wasPressed) {
      action();
      NavState.holdTimers[btnIndex] = setTimeout(function() {
        clearHold(btnIndex);
        NavState.holdTimers[btnIndex] = setInterval(action, NAV_CONFIG.BTN_REPEAT_RATE);
      }, NAV_CONFIG.BTN_HOLD_DELAY);
    } else if (!pressed && wasPressed) {
      clearHold(btnIndex);
    }

    NavState.lastButtons[btnIndex] = pressed;
  }

  function poll() {
    var pad = getGamepad();
    setIndicator(!!pad);

    if (!NavState.active) return;

    if (!pad) {
      NavState.stickMoved = false;
      return;
    }

    refreshCards();
    if (!NavState.cards.length) return;

    handleDir(pad, BUTTON_MAP.DPAD_LEFT, moveLeft);
    handleDir(pad, BUTTON_MAP.DPAD_RIGHT, moveRight);
    handleDir(pad, BUTTON_MAP.DPAD_UP, moveUp);
    handleDir(pad, BUTTON_MAP.DPAD_DOWN, moveDown);

    var axes = readAxes(pad);
    var dz = NAV_CONFIG.STICK_DEAD_ZONE;

    if (Math.abs(axes.x) > dz || Math.abs(axes.y) > dz) {
      if (!NavState.stickMoved) {
        NavState.stickMoved = true;
        if (axes.x < -dz) moveLeft();
        else if (axes.x > dz) moveRight();
        else if (axes.y < -dz) moveUp();
        else if (axes.y > dz) moveDown();
      }
    } else {
      NavState.stickMoved = false;
    }

    var card = getSelectedCard();

    var crossNow = isButtonPressed(pad, BUTTON_MAP.CROSS);
    var crossWas = NavState.lastButtons[BUTTON_MAP.CROSS] || false;
    if (crossNow && !crossWas) pressAction(card);
    NavState.lastButtons[BUTTON_MAP.CROSS] = crossNow;

    var squareNow = isButtonPressed(pad, BUTTON_MAP.SQUARE);
    var squareWas = NavState.lastButtons[BUTTON_MAP.SQUARE] || false;
    if (squareNow && !squareWas) infoAction(card);
    NavState.lastButtons[BUTTON_MAP.SQUARE] = squareNow;

    var circleNow = isButtonPressed(pad, BUTTON_MAP.CIRCLE);
    var circleWas = NavState.lastButtons[BUTTON_MAP.CIRCLE] || false;
    if (circleNow && !circleWas) {
      if (window.GameLauncher && window.GameLauncher.isPlaying && window.GameLauncher.isPlaying()) {
        window.GameLauncher.returnToHub();
      } else if (window.GameLauncher) {
        window.GameLauncher.closeInfo();
      }
    }
    NavState.lastButtons[BUTTON_MAP.CIRCLE] = circleNow;
  }

  function onGamepadConnected(e) {
    setIndicator(true);
    if (window.HubToast) window.HubToast('Mando conectado: ' + (e.gamepad ? e.gamepad.id : 'Gamepad'));
  }

  function onGamepadDisconnected() {
    setIndicator(false);
    NavState.gamepadIndex = -1;
    if (window.HubToast) window.HubToast('Mando desconectado.', 'warn');
  }

  function initKeyboardFallback() {
    document.addEventListener('keydown', function(e) {
      e = e || window.event;
      if (!NavState.active) return;

      var card = getSelectedCard();
      if (!card) return;

      switch (e.keyCode) {
        case 37: moveLeft(); if (e.preventDefault) e.preventDefault(); break;
        case 39: moveRight(); if (e.preventDefault) e.preventDefault(); break;
        case 38: moveUp(); if (e.preventDefault) e.preventDefault(); break;
        case 40: moveDown(); if (e.preventDefault) e.preventDefault(); break;
        case 13:
        case 32:
          pressAction(card);
          if (e.preventDefault) e.preventDefault();
          break;
        case 73:
          infoAction(card);
          break;
        case 27:
          if (window.GameLauncher) window.GameLauncher.closeInfo();
          break;
      }
    }, false);
  }

  function init() {
    refreshCards();
    selectCard(0);
    initKeyboardFallback();

    if (window.addEventListener) {
      window.addEventListener('gamepadconnected', onGamepadConnected, false);
      window.addEventListener('gamepaddisconnected', onGamepadDisconnected, false);
      window.addEventListener('resize', function() { refreshCards(); }, false);
    }

    NavState.pollTimer = setInterval(poll, NAV_CONFIG.POLL_INTERVAL);
  }

  window.GamepadNav = {
    setActive: function(val) {
      NavState.active = !!val;
      if (val) {
        refreshCards();
        selectCard(NavState.selectedIndex);
      }
    },
    refreshCards: refreshCards,
    selectCard: selectCard,
    getSelectedCard: getSelectedCard,
    isActive: function() { return NavState.active; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, false);
  else init();

})(window, document, navigator);
