/**
 * game-launcher.js — Sistema de lanzamiento de juegos
 * Carga juegos en iframe, gestiona estado del hub, detecta fin de juego
 */

;(function(window, document) {
  'use strict';

  /* ---- Elementos DOM ---- */
  var gameContainer = document.getElementById('game-container');
  var gameIframe    = document.getElementById('game-iframe');
  var gameCloseBtn  = document.getElementById('game-close-btn');
  var gameTopTitle  = document.getElementById('game-topbar-title');
  var loadingOverlay= document.getElementById('loading-overlay');
  var infoPanelEl   = document.getElementById('game-info-panel');
  var infoTitle     = document.getElementById('info-title');
  var infoGenre     = document.getElementById('info-genre');
  var infoDesc      = document.getElementById('info-desc');
  var infoPlayBtn   = document.getElementById('info-play-btn');
  var infoCloseBtn  = document.getElementById('info-close-btn');
  var hubMain       = document.getElementById('hub-main');
  var hubHeader     = document.querySelector('.hub-header');
  var hubFooter     = document.querySelector('.hub-footer');

  /* ---- Estado ---- */
  var LaunchState = {
    currentGame:  null,  // card activa
    isPlaying:    false,
    iframeLoaded: false
  };

  /* ----------------------------------------------------------
     MOSTRAR LOADING
  ---------------------------------------------------------- */
  function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }

  /* ----------------------------------------------------------
     LANZAR JUEGO
  ---------------------------------------------------------- */
  function launch(cardEl) {
    if (!cardEl) return;

    var gameId  = cardEl.getAttribute('data-game-id');
    var gameUrl = cardEl.getAttribute('data-game-url');
    var gameTitle = cardEl.getAttribute('data-game-title') || 'JUEGO';

    if (!gameUrl) return;

    // Cerrar panel de info si está abierto
    closeInfo();

    // Mostrar loading
    showLoading();

    // Recordar tarjeta actual
    LaunchState.currentGame = cardEl;
    LaunchState.isPlaying   = true;
    LaunchState.iframeLoaded = false;

    // Configurar topbar
    if (gameTopTitle) gameTopTitle.textContent = gameTitle;

    // Esconder hub
    if (hubMain)   hubMain.classList.add('hidden');
    if (hubHeader) hubHeader.classList.add('hidden');
    if (hubFooter) hubFooter.classList.add('hidden');

    // Mostrar contenedor de juego
    if (gameContainer) gameContainer.classList.remove('hidden');

    // Cargar el juego en iframe
    if (gameIframe) {
      gameIframe.onload = function() {
        hideLoading();
        LaunchState.iframeLoaded = true;
        // Desactivar nav del hub mientras se juega
        if (window.GamepadNav) window.GamepadNav.setActive(false);
        // Dar focus al iframe (para que el juego reciba inputs de teclado)
        gameIframe.focus();
      };

      gameIframe.onerror = function() {
        hideLoading();
        alert('No se pudo cargar el juego: ' + gameUrl);
        returnToHub();
      };

      gameIframe.src = gameUrl;
    }

    // Timeout de seguridad (PS3 puede tardar en cargar)
    setTimeout(function() {
      if (!LaunchState.iframeLoaded) {
        hideLoading();
      }
    }, 8000);
  }

  /* ----------------------------------------------------------
     VOLVER AL HUB
  ---------------------------------------------------------- */
  function returnToHub() {
    LaunchState.isPlaying    = false;
    LaunchState.currentGame  = null;
    LaunchState.iframeLoaded = false;

    // Limpiar iframe (liberar memoria)
    if (gameIframe) {
      gameIframe.src = 'about:blank';
    }

    // Ocultar contenedor de juego
    if (gameContainer) gameContainer.classList.add('hidden');

    // Mostrar hub
    if (hubMain)   hubMain.classList.remove('hidden');
    if (hubHeader) hubHeader.classList.remove('hidden');
    if (hubFooter) hubFooter.classList.remove('hidden');

    hideLoading();

    // Reactivar navegación del hub
    if (window.GamepadNav) {
      window.GamepadNav.refreshCards();
      window.GamepadNav.setActive(true);
    }

    console.log('[GameLauncher] Vuelto al hub');
  }

  /* ----------------------------------------------------------
     PANEL DE INFORMACIÓN DEL JUEGO (□)
  ---------------------------------------------------------- */
  function showInfo(cardEl) {
    if (!cardEl || !infoPanelEl) return;

    var gameId    = cardEl.getAttribute('data-game-id');
    if (gameId === 'add-game') return;

    var title  = cardEl.getAttribute('data-game-title') || '';
    var genre  = cardEl.getAttribute('data-game-genre')  || '';
    var players= cardEl.getAttribute('data-game-players') || '1';
    var desc   = cardEl.getAttribute('data-game-desc')   || '';

    if (infoTitle)  infoTitle.textContent  = title;
    if (infoGenre)  infoGenre.textContent  = genre + ' · ' + players + ' Jugador(es)';
    if (infoDesc)   infoDesc.textContent   = desc;

    // Bind del botón jugar en el panel
    if (infoPlayBtn) {
      infoPlayBtn.onclick = function() {
        closeInfo();
        launch(cardEl);
      };
    }

    infoPanelEl.classList.remove('hidden');

    // Focus en el primer botón del panel
    if (infoPlayBtn) infoPlayBtn.focus();
  }

  function closeInfo() {
    if (!infoPanelEl) return;
    infoPanelEl.classList.add('hidden');
    // Devolver focus a la card seleccionada
    if (window.GamepadNav) {
      // El GamepadNav tiene la card enfocada
    }
  }

  /* ----------------------------------------------------------
     EVENTOS DE BOTONES
  ---------------------------------------------------------- */
  // Botón "Volver al hub" en la barra del juego
  if (gameCloseBtn) {
    gameCloseBtn.addEventListener('click', function() {
      returnToHub();
    }, false);
  }

  // Teclado: Esc = volver al hub si está jugando
  document.addEventListener('keydown', function(e) {
    if (e.keyCode === 27) { // Escape
      if (LaunchState.isPlaying) {
        returnToHub();
      } else {
        closeInfo();
      }
    }
  }, false);

  // Botón cerrar del panel de info
  if (infoCloseBtn) {
    infoCloseBtn.addEventListener('click', closeInfo, false);
  }

  /* ----------------------------------------------------------
     CLICK EN TARJETA (mouse/touch fallback)
  ---------------------------------------------------------- */
  var grid = document.getElementById('games-grid');
  if (grid) {
    grid.addEventListener('click', function(e) {
      var card = e.target;
      // Subir en el DOM hasta encontrar .game-card
      while (card && card !== grid) {
        if (card.classList && card.classList.contains('game-card')) {
          var gameId = card.getAttribute('data-game-id');
          if (gameId && gameId !== 'add-game') {
            launch(card);
          }
          return;
        }
        card = card.parentNode;
      }
    }, false);
  }

  /* ----------------------------------------------------------
     MENSAJE DESDE EL IFRAME (juego puede notificar al hub)
     Ejemplo: el juego envía postMessage({type:'gameOver', score:100})
  ---------------------------------------------------------- */
  if (window.addEventListener) {
    window.addEventListener('message', function(e) {
      if (!e.data) return;
      var msg = e.data;

      if (msg.type === 'gameOver') {
        console.log('[GameLauncher] Game Over recibido. Score:', msg.score);
        // Guardar puntuación
        if (window.HubStorage && LaunchState.currentGame) {
          var id = LaunchState.currentGame.getAttribute('data-game-id');
          window.HubStorage.saveScore(id, msg.score || 0);
        }
        // Pequeño delay antes de volver
        setTimeout(returnToHub, 1500);
      }

      if (msg.type === 'returnToHub') {
        returnToHub();
      }
    }, false);
  }

  /* ---- API pública ---- */
  window.GameLauncher = {
    launch:       launch,
    returnToHub:  returnToHub,
    showInfo:     showInfo,
    closeInfo:    closeInfo,
    isPlaying:    function() { return LaunchState.isPlaying; }
  };

})(window, document);
