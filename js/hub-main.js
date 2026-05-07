/**
 * hub-main.js — lógica principal del portal INDIE HUB.
 * Mobile-first con progressive enhancement y ruta PS3 intacta.
 */
;(function(window, document, navigator) {
  'use strict';

  var GAMES_REGISTRY = [
    {
      id: 'demo-runner',
      title: 'DEMO RUNNER',
      desc: 'Runner 2D infinito. Esquiva obstáculos y supera tu récord.',
      url: 'games/demo-runner/index.html',
      genre: 'Runner',
      players: 1,
      status: 'available',
      controls: 'touch gamepad keyboard mouse'
    },
    {
      id: 'zombie-smasher',
      title: 'ZOMBIE SMASHER',
      desc: 'Oleadas de zombies. Defiende tu base hasta el último segundo.',
      url: 'games/zombie-smasher/index.html',
      genre: 'Acción',
      players: 1,
      status: 'available',
      controls: 'touch gamepad keyboard mouse'
    },
    {
      id: 'space-shooter',
      title: 'SPACE SHOOTER',
      desc: 'Naves alienígenas, power-ups y explosiones épicas en el espacio.',
      url: 'games/space-shooter/index.html',
      genre: 'Shoot em up',
      players: 1,
      status: 'coming',
      controls: 'gamepad keyboard'
    }
  ];

  var device = window.DeviceDetector ? window.DeviceDetector.info : {
    isPS3: /PLAYSTATION 3/i.test(navigator.userAgent || ''),
    isMobile: /Android|iPhone|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent || ''),
    isTablet: /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent || ''),
    isTouch: ('ontouchstart' in window),
    type: 'pc',
    gpuTier: 'medium'
  };

  var clockEl = document.getElementById('hub-clock');
  var ps3Welcome = document.getElementById('ps3-welcome');
  var fpsCounter = document.getElementById('fps-counter');
  var mainEl = document.getElementById('hub-main');
  var gridEl = document.getElementById('games-grid');
  var searchEl = document.getElementById('game-search');
  var emptyEl = document.getElementById('empty-state');
  var filterPanel = document.getElementById('filter-panel');
  var menuBtn = document.getElementById('mobile-menu-btn');
  var connectBtn = document.getElementById('connect-gamepad-btn');
  var themeToggle = document.getElementById('theme-toggle');
  var deviceModeLabel = document.getElementById('device-mode-label');
  var bottomSearchBtn = document.getElementById('bottom-search-btn');
  var bottomFilterBtn = document.getElementById('bottom-filter-btn');
  var bottomGamepadBtn = document.getElementById('bottom-gamepad-btn');
  var toastContainer = document.getElementById('toast-container');

  var HubState = {
    isPS3: !!device.isPS3,
    welcomeShown: false,
    clockTimer: null,
    fpsFrames: 0,
    fpsLast: 0,
    filters: {
      query: '',
      genre: 'all',
      status: 'all',
      controls: 'all'
    },
    searchTimer: null,
    longPressTimer: null,
    longPressCard: null,
    suppressNextClick: false,
    swipeStartX: 0,
    swipeStartY: 0,
    swipeStartTime: 0,
    statusCycle: ['all', 'available', 'coming']
  };

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

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function getCards(includeAdd) {
    var all = gridEl ? gridEl.querySelectorAll('.game-card') : [];
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (includeAdd || !hasClass(all[i], 'game-card--add')) out.push(all[i]);
    }
    return out;
  }

  function findCardFromTarget(target) {
    while (target && target !== document && target !== gridEl) {
      if (hasClass(target, 'game-card')) return target;
      target = target.parentNode;
    }
    return null;
  }

  function findRegistry(id) {
    for (var i = 0; i < GAMES_REGISTRY.length; i++) {
      if (GAMES_REGISTRY[i].id === id) return GAMES_REGISTRY[i];
    }
    return null;
  }

  function toast(message, type, duration) {
    if (!toastContainer) {
      if (window.console && console.log) console.log('[INDIE HUB]', message);
      return;
    }

    var item = document.createElement('div');
    item.className = 'toast' + (type ? ' ' + type : '');
    item.textContent = message;
    toastContainer.appendChild(item);

    setTimeout(function() { addClass(item, 'show'); }, 20);
    setTimeout(function() {
      removeClass(item, 'show');
      setTimeout(function() {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 220);
    }, duration || 2600);
  }

  function updateClock() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    setText(clockEl, (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m));
  }

  function startClock() {
    updateClock();
    HubState.clockTimer = setInterval(updateClock, 10000);
  }

  function startFPSCounter() {
    if (!fpsCounter) return;
    HubState.fpsLast = Date.now ? Date.now() : new Date().getTime();

    function tick() {
      HubState.fpsFrames++;
      var now = Date.now ? Date.now() : new Date().getTime();
      var delta = now - HubState.fpsLast;

      if (delta >= 1000) {
        var fps = Math.round(HubState.fpsFrames * 1000 / delta);
        fpsCounter.textContent = fps + ' FPS';
        HubState.fpsFrames = 0;
        HubState.fpsLast = now;
      }

      if (window.requestAnimationFrame) requestAnimationFrame(tick);
      else setTimeout(tick, HubState.isPS3 ? 33 : 16);
    }

    if (window.requestAnimationFrame) requestAnimationFrame(tick);
    else setTimeout(tick, 33);
  }

  function showPS3Welcome() {
    if (!HubState.isPS3 || !ps3Welcome) return;
    removeClass(ps3Welcome, 'hidden');
    document.addEventListener('keydown', onWelcomeDismiss, false);
  }

  function onWelcomeDismiss(e) {
    e = e || window.event;
    if (e.keyCode === 13 || e.keyCode === 32) dismissWelcome();
  }

  function dismissWelcome() {
    if (ps3Welcome) addClass(ps3Welcome, 'hidden');
    document.removeEventListener('keydown', onWelcomeDismiss, false);
    HubState.welcomeShown = true;

    if (window.GamepadNav && window.GamepadNav.setActive) {
      window.GamepadNav.setActive(true);
    }
  }

  function updateDeviceLabel() {
    var label = 'PC: mouse, teclado y mando opcional';
    if (device.isPS3) label = 'PS3: D-Pad, sticks y botones físicos';
    else if (device.isMobile) label = 'Móvil: toca para jugar, mantén pulsado para info';
    else if (device.isTablet) label = 'Tablet: touch + mando Bluetooth opcional';
    else if (device.isTouch) label = 'Pantalla táctil detectada: touch + teclado/mando';

    setText(deviceModeLabel, label + ' · GPU ' + (device.gpuTier || 'media'));
  }

  function lazyLoadCards() {
    var cards = getCards(true);
    for (var i = 0; i < cards.length; i++) addClass(cards[i], 'card-enter');

    for (i = 0; i < cards.length; i++) {
      (function(card, delay) {
        setTimeout(function() {
          removeClass(card, 'card-enter');
          addClass(card, 'card-visible');
        }, delay);
      })(cards[i], HubState.isPS3 ? i * 80 : i * 45);
    }
  }

  function applyDeviceOptimizations() {
    if (window.PS3Optimizer) {
      window.PS3Optimizer.apply(HubState.isPS3);
    }

    if (device.isMobile || device.isTablet) {
      addClass(document.body, 'touch-mode');
    }

    if (device.gpuTier === 'low') {
      addClass(document.body, 'low-power-mode');
    }

    if (navigator.getBattery) {
      try {
        navigator.getBattery().then(function(battery) {
          if (!battery.charging) {
            addClass(document.body, 'battery-saving');
            toast('Modo ahorro: se priorizará 30 FPS en móvil.', 'warn', 2200);
          }
        });
      } catch (e) {}
    }
  }

  function applyTheme(theme) {
    theme = theme || 'dark';
    if (theme === 'light') addClass(document.body, 'theme-light');
    else removeClass(document.body, 'theme-light');

    if (window.HubStorage) window.HubStorage.savePref('theme', theme);
    else {
      try { localStorage.setItem('indiehub_theme', theme); } catch (e) {}
    }
  }

  function loadTheme() {
    var saved = null;
    if (window.HubStorage) saved = window.HubStorage.getPref('theme', null);
    else {
      try { saved = localStorage.getItem('indiehub_theme'); } catch (e) {}
    }

    if (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      saved = 'light';
    }
    applyTheme(saved || 'dark');
  }

  function toggleTheme() {
    applyTheme(hasClass(document.body, 'theme-light') ? 'dark' : 'light');
  }

  function setFilter(group, value) {
    HubState.filters[group] = value;

    var chips = document.querySelectorAll('[data-filter-group="' + group + '"]');
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].getAttribute('data-filter-value') === value) addClass(chips[i], 'active');
      else removeClass(chips[i], 'active');
    }

    applyFilters();
  }

  function applyFilters() {
    var cards = getCards(false);
    var visible = 0;
    var f = HubState.filters;
    var query = (f.query || '').toLowerCase();

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var title = (card.getAttribute('data-game-title') || '').toLowerCase();
      var desc = (card.getAttribute('data-game-desc') || '').toLowerCase();
      var genre = card.getAttribute('data-game-genre') || '';
      var status = card.getAttribute('data-game-status') || 'available';
      var controls = card.getAttribute('data-game-controls') || '';

      var matchQuery = !query || title.indexOf(query) !== -1 || desc.indexOf(query) !== -1 || genre.toLowerCase().indexOf(query) !== -1;
      var matchGenre = f.genre === 'all' || genre === f.genre;
      var matchStatus = f.status === 'all' || status === f.status;
      var matchControls = f.controls === 'all' || controls.indexOf(f.controls) !== -1;

      if (matchQuery && matchGenre && matchStatus && matchControls) {
        removeClass(card, 'filtered-out');
        visible++;
      } else {
        addClass(card, 'filtered-out');
      }
    }

    if (emptyEl) {
      if (visible === 0) removeClass(emptyEl, 'hidden');
      else addClass(emptyEl, 'hidden');
    }

    if (window.GamepadNav && window.GamepadNav.refreshCards) {
      window.GamepadNav.refreshCards();
    }
  }

  function initFilters() {
    var chips = document.querySelectorAll('.filter-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].onclick = function() {
        setFilter(this.getAttribute('data-filter-group'), this.getAttribute('data-filter-value'));
      };
    }

    if (searchEl) {
      searchEl.oninput = function() {
        clearTimeout(HubState.searchTimer);
        var val = searchEl.value || '';
        HubState.searchTimer = setTimeout(function() {
          HubState.filters.query = val;
          applyFilters();
        }, 180);
      };
    }
  }

  function toggleFilterPanel(forceOpen) {
    if (!filterPanel) return;

    var open = forceOpen;
    if (open === undefined) open = !hasClass(filterPanel, 'open');

    if (open) addClass(filterPanel, 'open');
    else removeClass(filterPanel, 'open');

    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function initMobileMenu() {
    if (menuBtn) {
      menuBtn.onclick = function() { toggleFilterPanel(); };
    }
    if (bottomFilterBtn) bottomFilterBtn.onclick = function() { toggleFilterPanel(true); };
    if (bottomSearchBtn) {
      bottomSearchBtn.onclick = function() {
        toggleFilterPanel(true);
        if (searchEl && searchEl.focus) setTimeout(function() { searchEl.focus(); }, 60);
      };
    }
    if (bottomGamepadBtn && connectBtn) {
      bottomGamepadBtn.onclick = function() { connectBtn.click(); };
    }
  }

  function initLongPressInfo() {
    if (!gridEl || !(device.isTouch || device.isMobile || device.isTablet)) return;

    gridEl.addEventListener('touchstart', function(e) {
      var card = findCardFromTarget(e.target);
      if (!card || hasClass(card, 'game-card--add')) return;

      HubState.longPressCard = card;
      clearTimeout(HubState.longPressTimer);
      HubState.longPressTimer = setTimeout(function() {
        HubState.suppressNextClick = true;
        card.__suppressNextClick = true;
        if (window.GameLauncher) window.GameLauncher.showInfo(card);
        toast('Info del juego abierta.', null, 1200);
      }, 610);
    }, false);

    gridEl.addEventListener('touchmove', function() {
      clearTimeout(HubState.longPressTimer);
      HubState.longPressCard = null;
    }, false);

    gridEl.addEventListener('touchend', function() {
      clearTimeout(HubState.longPressTimer);
      setTimeout(function() {
        HubState.suppressNextClick = false;
        if (HubState.longPressCard) HubState.longPressCard.__suppressNextClick = false;
        HubState.longPressCard = null;
      }, 360);
    }, false);
  }

  function initSwipeNavigation() {
    if (!mainEl || !(device.isTouch || device.isMobile || device.isTablet)) return;

    mainEl.addEventListener('touchstart', function(e) {
      if (!e.touches || !e.touches.length) return;
      HubState.swipeStartX = e.touches[0].clientX;
      HubState.swipeStartY = e.touches[0].clientY;
      HubState.swipeStartTime = Date.now ? Date.now() : new Date().getTime();
    }, false);

    mainEl.addEventListener('touchend', function(e) {
      if (!e.changedTouches || !e.changedTouches.length) return;

      var dx = e.changedTouches[0].clientX - HubState.swipeStartX;
      var dy = e.changedTouches[0].clientY - HubState.swipeStartY;
      var dt = (Date.now ? Date.now() : new Date().getTime()) - HubState.swipeStartTime;

      if (dt > 600 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.35) return;

      var current = HubState.filters.status || 'all';
      var idx = 0;
      for (var i = 0; i < HubState.statusCycle.length; i++) {
        if (HubState.statusCycle[i] === current) idx = i;
      }

      if (dx < 0) idx++;
      else idx--;

      if (idx < 0) idx = HubState.statusCycle.length - 1;
      if (idx >= HubState.statusCycle.length) idx = 0;

      setFilter('status', HubState.statusCycle[idx]);
      toast('Filtro: ' + (HubState.statusCycle[idx] === 'all' ? 'todos' : HubState.statusCycle[idx]), null, 1200);
    }, false);
  }

  function initConnectGamepad() {
    function checkPads() {
      var getter = navigator.getGamepads || navigator.webkitGetGamepads;
      if (!getter) {
        toast('Este navegador no expone Gamepad API. Usa touch o teclado.', 'warn');
        return;
      }

      var pads = [];
      try { pads = getter.call(navigator) || []; } catch (e) {}
      for (var i = 0; i < pads.length; i++) {
        if (pads[i]) {
          toast('Mando conectado: ' + (pads[i].id || 'Gamepad'), null, 2200);
          return;
        }
      }
      toast('Pulsa un botón del mando Bluetooth para enlazarlo.', 'warn', 3000);
    }

    if (connectBtn) connectBtn.onclick = checkPads;

    if (window.addEventListener) {
      window.addEventListener('gamepadconnected', function(e) {
        toast('Mando conectado vía Bluetooth: ' + (e.gamepad ? e.gamepad.id : 'Gamepad'), null, 2600);
      }, false);

      window.addEventListener('gamepaddisconnected', function() {
        toast('Mando desconectado.', 'warn', 2200);
      }, false);
    }
  }

  function syncCardsWithRegistry() {
    var cards = getCards(false);
    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].getAttribute('data-game-id');
      var reg = findRegistry(id);
      if (!reg) continue;
      cards[i].setAttribute('data-game-status', reg.status);
      cards[i].setAttribute('data-game-controls', reg.controls || '');
    }
  }

  function initThemeToggle() {
    loadTheme();
    if (themeToggle) themeToggle.onclick = toggleTheme;
  }

  function initPS3GamepadWelcome() {
    if (window.PS3GamepadAPI) {
      window.PS3GamepadAPI.onButtonPress('cross', function() {
        if (!HubState.welcomeShown && HubState.isPS3) dismissWelcome();
      });
    }
  }

  function init() {
    HubState.isPS3 = !!device.isPS3;
    syncCardsWithRegistry();
    applyDeviceOptimizations();
    updateDeviceLabel();
    initThemeToggle();
    initFilters();
    initMobileMenu();
    initLongPressInfo();
    initSwipeNavigation();
    initConnectGamepad();

    startClock();
    startFPSCounter();
    setTimeout(lazyLoadCards, 80);

    if (HubState.isPS3) {
      setTimeout(showPS3Welcome, 200);
    } else if (window.GamepadNav && window.GamepadNav.setActive) {
      window.GamepadNav.setActive(true);
    }

    initPS3GamepadWelcome();
    applyFilters();

    window.HubGamesRegistry = GAMES_REGISTRY;
    window.HubToast = toast;

    if (window.console && console.log) {
      console.log('[INDIE HUB] Inicializado:', device.type, 'touch:', device.isTouch, 'gpu:', device.gpuTier);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, false);
  else init();

  window.HubMain = {
    getGames: function() { return GAMES_REGISTRY; },
    getDevice: function() { return device; },
    isPS3: function() { return HubState.isPS3; },
    dismissWelcome: dismissWelcome,
    applyFilters: applyFilters,
    setFilter: setFilter,
    toast: toast
  };

})(window, document, navigator);
