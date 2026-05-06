/**
 * performance-optimizer.js — Optimizaciones para el navegador PS3
 *
 * El navegador del PS3 usa WebKit ~533 con limitaciones:
 * - Motor JS lento (no JIT eficiente)
 * - GPU limitada: evitar box-shadow, blur, rgba masivo
 * - RAM: ~50MB para el browser
 * - No soporta requestAnimationFrame en versiones antiguas
 * - CSS3 transitions limitadas
 */

;(function(window, document) {
  "use strict";

  /* ----------------------------------------------------------
     DETECCIÓN DE PLATAFORMA
  ---------------------------------------------------------- */
  var Platform = (function() {
    var ua = navigator.userAgent || "";
    return {
      isPS3:    ua.indexOf("PLAYSTATION 3") !== -1,
      isWebKit: ua.indexOf("WebKit")        !== -1,
      isMobile: /Mobile|Android|iPhone/i.test(ua),
      ua:       ua
    };
  })();

  /* ----------------------------------------------------------
     POLYFILL: requestAnimationFrame (PS3 no lo tiene)
  ---------------------------------------------------------- */
  (function() {
    var lastTime = 0;
    var vendors  = ["webkit", "moz", "ms", "o"];

    if (!window.requestAnimationFrame) {
      for (var x = 0; x < vendors.length; x++) {
        if (window[vendors[x] + "RequestAnimationFrame"]) {
          window.requestAnimationFrame =
            window[vendors[x] + "RequestAnimationFrame"];
          window.cancelAnimationFrame =
            window[vendors[x] + "CancelAnimationFrame"] ||
            window[vendors[x] + "CancelRequestAnimationFrame"];
          break;
        }
      }
    }

    // Fallback final: setTimeout a ~30fps
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = function(callback) {
        var now   = Date.now();
        var delay = Math.max(0, 33 - (now - lastTime)); // ~30fps
        lastTime  = now + delay;
        return setTimeout(function() { callback(now + delay); }, delay);
      };
      window.cancelAnimationFrame = clearTimeout;
    }
  })();

  /* ----------------------------------------------------------
     POLYFILL: Date.now
  ---------------------------------------------------------- */
  if (!Date.now) {
    Date.now = function() { return new Date().getTime(); };
  }

  /* ----------------------------------------------------------
     POLYFILL: Array.isArray
  ---------------------------------------------------------- */
  if (!Array.isArray) {
    Array.isArray = function(v) {
      return Object.prototype.toString.call(v) === "[object Array]";
    };
  }

  /* ----------------------------------------------------------
     POLYFILL: String.trim
  ---------------------------------------------------------- */
  if (!String.prototype.trim) {
    String.prototype.trim = function() {
      return this.replace(/^\s+|\s+$/g, "");
    };
  }

  /* ----------------------------------------------------------
     LIMITAR FPS (hub hub a 30 en PS3)
     Wrap de requestAnimationFrame para limitar tasa
  ---------------------------------------------------------- */
  var FPSLimiter = (function() {
    var targetFPS  = 30;
    var interval   = 1000 / targetFPS;
    var lastRender = 0;

    function limitedRAF(callback) {
      return window.requestAnimationFrame(function(ts) {
        var now   = ts || Date.now();
        var delta = now - lastRender;
        if (delta >= interval) {
          lastRender = now - (delta % interval);
          callback(now);
        }
      });
    }

    return {
      wrap: function(cb) { return limitedRAF(cb); },
      setFPS: function(fps) {
        targetFPS = fps;
        interval  = 1000 / fps;
      }
    };
  })();

  /* ----------------------------------------------------------
     OPTIMIZACIONES CSS PARA PS3
     Aplica estilos que mejoran rendimiento en PS3
  ---------------------------------------------------------- */
  function applyPS3CSSOptimizations() {
    // Inyectar CSS que fuerza GPU layers en elementos clave
    // y elimina efectos costosos
    var style = document.createElement("style");
    style.type = 'text/css';
    var css = [
      /* Forzar aceleración hardware en todos los elementos animados */
      '.game-card, .game-container, .hub-header, .loading-overlay {',
      '  -webkit-transform: translateZ(0);',
      '  transform: translateZ(0);',
      '  -webkit-backface-visibility: hidden;',
      '  backface-visibility: hidden;',
      '}',
      /* Eliminar box-shadow (muy costoso en PS3) */
      '* { -webkit-box-shadow: none !important; box-shadow: none !important; }',
      /* Eliminar text-shadow */
      '* { text-shadow: none !important; }',
      /* Desactivar filter/blur */
      '* { -webkit-filter: none !important; filter: none !important; }',
      /* Reducir complejidad de gradientes */
      /* (no se puede eliminar todos pero sí simplificar) */
      /* Cursor más simple */
      'body { cursor: default; }'
    ].join('\n');

    if (style.styleSheet) {
      style.styleSheet.cssText = css; // IE/viejos
    } else {
      style.appendChild(document.createTextNode(css));
    }

    var head = document.getElementsByTagName('head')[0];
    if (head) head.appendChild(style);

    console.log('[PS3Optimizer] CSS de optimización aplicado');
  }

  /* ----------------------------------------------------------
     LAZY LOADING DE IMÁGENES
     PS3 tiene poca RAM — cargar solo lo visible
  ---------------------------------------------------------- */
  function setupLazyImages() {
    var imgs = document.querySelectorAll('img[data-src]');
    if (!imgs.length) return;

    // Carga diferida simple (sin IntersectionObserver — no disponible en PS3)
    function loadVisible() {
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (img.loaded) continue;

        var rect = img.getBoundingClientRect
          ? img.getBoundingClientRect()
          : { top: 0, bottom: 720 };

        // Si está en viewport (aproximado)
        if (rect.top < 720 && rect.bottom > 0) {
          img.src    = img.getAttribute('data-src');
          img.loaded = true;
        }
      }
    }

    loadVisible();
    // Revisar en scroll
    if (window.addEventListener) {
      window.addEventListener('scroll', loadVisible, false);
    }
  }

  /* ----------------------------------------------------------
     LIMPIEZA DE MEMORIA
     Llamar periódicamente para ayudar al GC en PS3
  ---------------------------------------------------------- */
  function scheduleGC() {
    // PS3 tiene GC limitado — forzamos limpieza cada 30s
    setInterval(function() {
      // No hay forma directa de forzar GC en JS
      // Pero limpiar referencias ayuda
      if (window.gc) {
        try { window.gc(); } catch(e) {}
      }
    }, 30000);
  }

  /* ----------------------------------------------------------
     DESHABILITAR EVENTOS INNECESARIOS EN PS3
  ---------------------------------------------------------- */
  function disableUnnecessaryEvents() {
    // Deshabilitar selección de texto
    document.onselectstart = function() { return false; };
    document.ondragstart   = function() { return false; };

    // Deshabilitar menú contextual (en PS3 el click derecho no existe
    // pero evitamos procesamiento extra)
    document.oncontextmenu = function() { return false; };
  }

  /* ----------------------------------------------------------
     THROTTLE de eventos de scroll/resize
  ---------------------------------------------------------- */
  function throttle(fn, wait) {
    var last = 0;
    return function() {
      var now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  }

  /* ----------------------------------------------------------
     APLICAR TODAS LAS OPTIMIZACIONES
  ---------------------------------------------------------- */
  function apply(isPS3) {
    // Polyfills siempre
    // (ya aplicados arriba en el IIFE)

    if (isPS3) {
      applyPS3CSSOptimizations();
      disableUnnecessaryEvents();
      scheduleGC();
      FPSLimiter.setFPS(30);
      console.log('[PS3Optimizer] Modo PS3 activado');
    } else {
      FPSLimiter.setFPS(60);
      console.log('[PS3Optimizer] Modo estándar (no-PS3)');
    }

    // Lazy loading siempre (útil en cualquier plataforma)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupLazyImages);
    } else {
      setupLazyImages();
    }
  }

  /* ---- API pública ---- */
  window.PS3Optimizer = {
    apply:      apply,
    platform:   Platform,
    FPSLimiter: FPSLimiter,
    throttle:   throttle
  };

})(window, document);
