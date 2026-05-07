/**
 * gamepad-launcher.js — carga juegos en iframe responsive.
 * Gestiona loading, fullscreen móvil, panel de info y retorno al hub.
 */
;(function(window, document) {
  'use strict';

  var gameContainer = document.getElementById('game-container');
  var gameIframe = document.getElementById('game-iframe');
  var gameCloseBtn = document.getElementById('game-close-btn');
  var gameFullscreenBtn = document.getElementById('game-fullscreen-btn');
  var gameTopTitle = document.getElementById('game-topbar-title');
  var loadingOverlay = document.getElementById('loading-overlay');
  var infoPanelEl = document.getElementById('game-info-panel');
  var infoTitle = document.getElementById('info-title');
  var infoGenre = document.getElementById('info-genre');
  var infoDesc = document.getElementById('info-desc');
  var infoPlayBtn = document.getElementById('info-play-btn');
  var infoCloseBtn = document.getElementById('info-close-btn');
  var hubMain = document.getElementById('hub-main');
  var hubHeader = document.querySelector ? document.querySelector('.hub-header') : null;
  var hubFooter = document.querySelector ? document.querySelector('.hub-footer') : null;
  var filterPanel = document.getElementById('filter-panel');
  var grid = document.getElementById('games-grid');

  var device = window.DeviceDetector ? window.DeviceDetector.info : {};
  var LaunchState = {
    currentGame: null,
    isPlaying: false,
    iframeLoaded: false,
    lastTouchTime: 0,
    touchStartX: 0,
    touchStartY: 0,
    touchMoved: false
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

  function toast(message, type, duration) {
    if (window.HubToast) window.HubToast(message, type, duration);
    else if (window.console && console.log) console.log('[GameLauncher]', message);
  }

  function showLoading() {
    if (loadingOverlay) removeClass(loadingOverlay, 'hidden');
  }

  function hideLoading() {
    if (loadingOverlay) addClass(loadingOverlay, 'hidden');
  }

  function hideHub() {
    if (hubMain) addClass(hubMain, 'hidden');
    if (hubHeader) addClass(hubHeader, 'hidden');
    if (hubFooter) addClass(hubFooter, 'hidden');
    if (filterPanel) addClass(filterPanel, 'hidden');
  }

  function showHub() {
    if (hubMain) removeClass(hubMain, 'hidden');
    if (hubHeader) removeClass(hubHeader, 'hidden');
    if (hubFooter) removeClass(hubFooter, 'hidden');
    if (filterPanel) removeClass(filterPanel, 'hidden');
  }

  function getCardFromTarget(target) {
    while (target && target !== grid && target !== document) {
      if (hasClass(target, 'game-card')) return target;
      target = target.parentNode;
    }
    return null;
  }

  function requestGameFullscreen() {
    if (!gameContainer) return false;

    var didRequest = false;
    if (window.DeviceDetector && window.DeviceDetector.requestFullscreen) {
      didRequest = window.DeviceDetector.requestFullscreen(gameContainer);
    } else {
      var fn = gameContainer.requestFullscreen ||
               gameContainer.webkitRequestFullscreen ||
               gameContainer.mozRequestFullScreen ||
               gameContainer.msRequestFullscreen;
      if (fn) {
        try { fn.call(gameContainer); didRequest = true; } catch (e) {}
      }
    }

    if (didRequest !== false) {
      addClass(gameContainer, 'fullscreen-active');
      toast('Pantalla completa activada.', null, 1600);
    } else {
      toast('Pantalla completa no disponible en este navegador.', 'warn', 2400);
    }
    return didRequest;
  }

  function launch(cardEl) {
    if (!cardEl) return;
    if (cardEl.__suppressNextClick) {
      cardEl.__suppressNextClick = false;
      return;
    }

    var gameId = cardEl.getAttribute('data-game-id');
    var gameUrl = cardEl.getAttribute('data-game-url');
    var gameTitle = cardEl.getAttribute('data-game-title') || 'JUEGO';
    var status = cardEl.getAttribute('data-game-status') || 'available';

    if (!gameId || gameId === 'add-game') {
      toast('Crea una carpeta en /games/tu-juego/ y registra el juego en hub-main.js.', 'warn', 3200);
      return;
    }

    if (status !== 'available') {
      toast(gameTitle + ' todavía está marcado como próximo.', 'warn', 2400);
      showInfo(cardEl);
      return;
    }

    if (!gameUrl) {
      toast('Ruta de juego no configurada.', 'error', 2400);
      return;
    }

    closeInfo();
    showLoading();

    LaunchState.currentGame = cardEl;
    LaunchState.isPlaying = true;
    LaunchState.iframeLoaded = false;

    if (gameTopTitle) gameTopTitle.textContent = gameTitle;
    hideHub();

    if (gameContainer) removeClass(gameContainer, 'hidden');

    if (window.GamepadNav) window.GamepadNav.setActive(false);

    if (gameIframe) {
      var didStartGameLoad = false;

      gameIframe.onload = function() {
        if (!didStartGameLoad) return;

        hideLoading();
        LaunchState.iframeLoaded = true;

        try {
          gameIframe.contentWindow.postMessage({
            type: 'hubDevice',
            device: window.DeviceDetector ? window.DeviceDetector.info : {},
            gameId: gameId
          }, '*');
        } catch (e) {}

        try { gameIframe.focus(); } catch (e2) {}
      };

      gameIframe.onerror = function() {
        hideLoading();
        toast('No se pudo cargar el juego: ' + gameUrl, 'error', 3200);
        returnToHub();
      };

      /*
       * Recargar primero about:blank evita que algunos WebKit móviles/PS3 no
       * disparen onload cuando se abre el mismo juego varias veces seguidas.
       * El flag impide que el onload de about:blank oculte el spinner antes
       * de que el juego real esté listo.
       */
      try { gameIframe.removeAttribute('srcdoc'); } catch (e3) {}
      try { gameIframe.src = 'about:blank'; } catch (e4) {}

      setTimeout(function() {
        didStartGameLoad = true;
        gameIframe.src = gameUrl;
      }, device && device.isPS3 ? 90 : 30);
    }

    if (window.HubStorage) {
      window.HubStorage.savePref('lastGame', gameId);
    }

    setTimeout(function() {
      if (!LaunchState.iframeLoaded) hideLoading();
    }, device && device.isPS3 ? 8000 : 5000);

    if (device && (device.isMobile || device.isTablet)) {
      toast('Usa el joystick virtual o pulsa ⛶ para pantalla completa.', null, 2600);
    }
  }

  function returnToHub() {
    LaunchState.isPlaying = false;
    LaunchState.currentGame = null;
    LaunchState.iframeLoaded = false;

    if (gameIframe) {
      gameIframe.onload = null;
      gameIframe.onerror = null;
      gameIframe.src = 'about:blank';
    }

    if (gameContainer) {
      addClass(gameContainer, 'hidden');
      removeClass(gameContainer, 'fullscreen-active');
    }

    showHub();
    hideLoading();

    if (window.GamepadNav) {
      window.GamepadNav.refreshCards();
      window.GamepadNav.setActive(true);
    }
  }

  function showInfo(cardEl) {
    if (!cardEl || !infoPanelEl) return;

    var gameId = cardEl.getAttribute('data-game-id');
    if (gameId === 'add-game') {
      toast('Añade un nuevo juego creando su carpeta y registrándolo en el hub.', 'warn');
      return;
    }

    var title = cardEl.getAttribute('data-game-title') || '';
    var genre = cardEl.getAttribute('data-game-genre') || '';
    var players = cardEl.getAttribute('data-game-players') || '1';
    var desc = cardEl.getAttribute('data-game-desc') || '';
    var status = cardEl.getAttribute('data-game-status') || 'available';
    var controls = cardEl.getAttribute('data-game-controls') || '';

    if (infoTitle) infoTitle.textContent = title;
    if (infoGenre) infoGenre.textContent = genre + ' · ' + players + ' Jugador(es) · ' + (status === 'available' ? 'Disponible' : 'Próximo');
    if (infoDesc) infoDesc.textContent = desc + (controls ? ' Controles: ' + controls.replace(/ /g, ', ') + '.' : '');

    if (infoPlayBtn) {
      infoPlayBtn.disabled = status !== 'available';
      infoPlayBtn.onclick = function() {
        closeInfo();
        launch(cardEl);
      };
      if (status !== 'available') {
        infoPlayBtn.textContent = 'PRÓXIMAMENTE';
      } else {
        infoPlayBtn.innerHTML = '<span class="btn-x">✕</span> JUGAR';
      }
    }

    removeClass(infoPanelEl, 'hidden');

    if (infoPlayBtn && status === 'available') {
      try { infoPlayBtn.focus(); } catch (e) {}
    } else if (infoCloseBtn) {
      try { infoCloseBtn.focus(); } catch (e2) {}
    }
  }

  function closeInfo() {
    if (infoPanelEl) addClass(infoPanelEl, 'hidden');
  }

  function onDocumentKeyDown(e) {
    e = e || window.event;
    if (e.keyCode === 27) {
      if (LaunchState.isPlaying) returnToHub();
      else closeInfo();
    }
  }

  function initCardActivation() {
    if (!grid) return;

    grid.addEventListener('touchstart', function(e) {
      if (!e.touches || !e.touches.length) return;
      LaunchState.touchStartX = e.touches[0].clientX;
      LaunchState.touchStartY = e.touches[0].clientY;
      LaunchState.touchMoved = false;
    }, false);

    grid.addEventListener('touchmove', function(e) {
      if (!e.touches || !e.touches.length) return;
      var dx = e.touches[0].clientX - LaunchState.touchStartX;
      var dy = e.touches[0].clientY - LaunchState.touchStartY;
      if (Math.sqrt(dx * dx + dy * dy) > 12) LaunchState.touchMoved = true;
    }, false);

    grid.addEventListener('touchend', function(e) {
      if (LaunchState.touchMoved) return;

      var card = getCardFromTarget(e.target);
      if (!card) return;

      if (card.__suppressNextClick) {
        card.__suppressNextClick = false;
        return;
      }

      LaunchState.lastTouchTime = Date.now ? Date.now() : new Date().getTime();
      launch(card);

      if (e.preventDefault) e.preventDefault();
    }, false);

    grid.addEventListener('click', function(e) {
      var t = Date.now ? Date.now() : new Date().getTime();
      if (t - LaunchState.lastTouchTime < 520) return;

      var card = getCardFromTarget(e.target);
      if (!card) return;

      launch(card);
    }, false);
  }

  function initButtons() {
    if (gameCloseBtn) {
      gameCloseBtn.addEventListener('click', function() { returnToHub(); }, false);
    }

    if (gameFullscreenBtn) {
      gameFullscreenBtn.addEventListener('click', function() { requestGameFullscreen(); }, false);
    }

    if (infoCloseBtn) {
      infoCloseBtn.addEventListener('click', closeInfo, false);
    }

    document.addEventListener('keydown', onDocumentKeyDown, false);

    if (document.addEventListener) {
      document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement && gameContainer) removeClass(gameContainer, 'fullscreen-active');
      }, false);
      document.addEventListener('webkitfullscreenchange', function() {
        if (!document.webkitFullscreenElement && gameContainer) removeClass(gameContainer, 'fullscreen-active');
      }, false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initButtons();
      initCardActivation();
    }, false);
  } else {
    initButtons();
    initCardActivation();
  }

  if (window.addEventListener) {
    window.addEventListener('message', function(e) {
      if (!e.data) return;
      var msg = e.data;

      if (msg.type === 'gameOver') {
        if (window.HubStorage && LaunchState.currentGame) {
          var id = LaunchState.currentGame.getAttribute('data-game-id');
          window.HubStorage.saveScore(id, msg.score || 0);
        }
        toast('Partida terminada. Puntuación: ' + (msg.score || 0), null, 2200);
      }

      if (msg.type === 'returnToHub') {
        returnToHub();
      }

      if (msg.type === 'toast') {
        toast(msg.message || '', msg.level || null, msg.duration || 2200);
      }
    }, false);
  }

  window.GameLauncher = {
    launch: launch,
    returnToHub: returnToHub,
    showInfo: showInfo,
    closeInfo: closeInfo,
    requestFullscreen: requestGameFullscreen,
    isPlaying: function() { return LaunchState.isPlaying; }
  };

})(window, document);
