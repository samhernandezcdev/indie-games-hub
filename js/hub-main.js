/**
 * hub-main.js — Lógica principal del portal INDIE HUB
 * Compatible con PS3 WebKit (sin ES6+, sin arrow functions avanzadas)
 */

;(function(window, document) {
  "use strict";

  /* ---- Registro de juegos disponibles ---- */
  var GAMES_REGISTRY = [
    {
      id:      'demo-runner',
      title:   'DEMO RUNNER',
      desc:    'Runner 2D infinito. Esquiva obstáculos y supera tu récord.',
      url:     'games/demo-runner/index.html',
      genre:   'Runner',
      players: 1,
      status:  'available'
    },
    {
      id:      'zombie-smasher',
      title:   'ZOMBIE SMASHER',
      desc:    'Oleadas de zombies. Defiende tu base hasta el último segundo.',
      url:     'games/zombie-smasher/index.html',
      genre:   'Acción',
      players: 1,
      status:  'available'
    },
  ];

  /* Referencias DOM */
  var clockEl       = document.getElementById("hub-clock");
  var ps3Welcome    = document.getElementById("ps3-welcome");
  var mainEl        = document.getElementById("hub-main");
  var fpsCounter    = document.getElementById("fps-counter");

  /* ---- Estado del hub ---- */
  var HubState = {
    isPS3:        false,
    welcomeShown: false,
    clockTimer:   null,
    fpsTimer:     null,
    fpsFrames:    0,
    fpsLast:      0
  };

  /* ----------------------------------------------------------
     DETECCIÓN DE PS3
  ---------------------------------------------------------- */
  function detectPS3() {
    var ua = navigator.userAgent || '';
    // El PS3 Browser reporta "PLAYSTATION 3" en el UA
    HubState.isPS3 = (ua.indexOf("PLAYSTATION 3") !== -1);
    return HubState.isPS3;
  }

  /* ----------------------------------------------------------
     BIENVENIDA PS3
  ---------------------------------------------------------- */
  function showPS3Welcome() {
    if (!HubState.isPS3) return;
    if (ps3Welcome) {
      ps3Welcome.classList.remove("hidden");
    }
    // En PS3, esperar boton X (gamepad) - en teclado: Enter/Espacio
    document.addEventListener("keydown", onWelcomeDismiss);
  }

  function onWelcomeDismiss(e) {
    if (e.keyCode === 13 || e.keyCode === 32) { // Enter o Espacio
      dismissWelcome();
    }
  }

  function dismissWelcome() {
    if (ps3Welcome) {
      ps3Welcome.classList.add("hidden");
    }
    document.removeEventListener("keydown", onWelcomeDismiss);
    HubState.welcomeShown = true;
    // Notificar al sistema de gamepad que el welcome fue cerrado
    if (window.GamepadNav && window.GamepadNav.setActive) {
      window.GamepadNav.setActive(true);
    }
  }

  /* ----------------------------------------------------------
     RELOJ
  ---------------------------------------------------------- */
  function updateClock() {
    if (!clockEl) return;
    var now = new Date();
    var h   = now.getHours();
    var m   = now.getMinutes();
    clockEl.textContent =
      (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  }

  function startClock() {
    updateClock();
    HubState.clockTimer = setInterval(updateClock, 10000); // cada 10s — PS3-friendly
  }

  /* ----------------------------------------------------------
     FPS COUNTER (límite 30 FPS en PS3)
  ---------------------------------------------------------- */
  function startFPSCounter() {
    if (!fpsCounter) return;
    HubState.fpsLast = Date.now();

    function tick() {
      HubState.fpsFrames++;
      var now  = Date.now();
      var delta = now - HubState.fpsLast;

      if (delta >= 1000) {
        var fps = Math.round(HubState.fpsFrames * 1000 / delta);
        fpsCounter.textContent = fps + " FPS";
        HubState.fpsFrames = 0;
        HubState.fpsLast   = now;
      }

      // requestAnimationFrame (con fallback para PS3)
      if (window.requestAnimationFrame) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(tick, 33); // ~30fps fallback
      }
    }

    if (window.requestAnimationFrame) {
      requestAnimationFrame(tick);
    } else {
      setTimeout(tick, 33);
    }
  }

  /* ----------------------------------------------------------
     LAZY LOADING DE TARJETAS
     (PS3 tiene poca RAM, cargar cards de a poco)
  ---------------------------------------------------------- */
  function lazyLoadCards() {
    var cards = document.querySelectorAll(".game-card");
    var i, card;

    // Inicialmente ocultas con clase
    for (i = 0; i < cards.length; i++) {
      cards[i].classList.add("card-enter");
    }

    // Revelar con delay escalonado
    for (i = 0; i < cards.length; i++) {
      (function(card, delay) {
        setTimeout(function() {
          card.classList.remove("card-enter");
          card.classList.add("card-visible");
        }, delay);
      })(cards[i], i * 80); // 80ms entre cada card
    }
  }

  /* ----------------------------------------------------------
     INICIALIZAR HUB
  ---------------------------------------------------------- */
  function init() {
    detectPS3();

    // Aplicar optimizaciones de PS3 si corresponde
    if (window.PS3Optimizer) {
      window.PS3Optimizer.apply(HubState.isPS3);
    }

    // Reloj
    startClock();

    // FPS
    startFPSCounter();

    // Lazy load de tarjetas (pequeño delay para que el DOM esté listo)
    setTimeout(lazyLoadCards, 100);

    // Mostrar bienvenida PS3
    if (HubState.isPS3) {
      setTimeout(showPS3Welcome, 200);
    } else {
      // En PC/otros: activar navegación directamente
      if (window.GamepadNav && window.GamepadNav.setActive) {
        window.GamepadNav.setActive(true);
      }
    }

    // Listener para que el gamepad pueda cerrar el welcome
    if (window.PS3GamepadAPI) {
      window.PS3GamepadAPI.onButtonPress("cross", function() {
        if (!HubState.welcomeShown && HubState.isPS3) {
          dismissWelcome();
        }
      });
    }

    // Exponer registro de juegos globalmente
    window.HubGamesRegistry = GAMES_REGISTRY;

    console.log("[INDIE HUB] Inicializado. PS3:", HubState.isPS3);
  }

  /* ---- Arrancar cuando el DOM esté listo ---- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---- API pública ---- */
  window.HubMain = {
    getGames:   function() { return GAMES_REGISTRY; },
    isPS3:      function() { return HubState.isPS3; },
    dismissWelcome: dismissWelcome
  };

})(window, document);
