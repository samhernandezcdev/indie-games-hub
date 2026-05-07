/***
 * device-detector.js - detección centralizada de dispositivo/capacidades.
 * Carga muy temprano para ajustar el viewport antes de pintar el hub.
 * ESS intecionalmente no soporta móviles, pero esto es para asegurar que el viewport se ajusta a la pantalla del dispositivo.
 */
;(function(window, document, navigator) {
  "use strict";

  var ua = (navigator.userAgent || "").toString();
  var maxTouchPoints = navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0;

  function hasTouch() {
    return ("ontouchstart" in window) || maxTouchPoints > 0;
  }

  function detectGPUTier(info) {
    var memory = navigator.deviceMemory || 0;
    var cores = navigator.hardwareConcurrency || 0;
    var lowUA = /Android 4|Android 5|iPhone OS 9|iPhone OS 10|iPad; CPU OS 9|PLAYSTATION 3/i.test(ua);
   
    if (info.isPS3 || lowUA) return "low";
    if ((memory && memory <= 2) || (cores && cores <= 2)) return "low";
    if ((memory && memory <= 4) || (cores && cores <= 4) || info.isMobile) return "medium";
    return "high";
  }

  var info = {
    ua: ua,
    isPS3: /PLAYSTATION 3/i.test(ua),
    isIOS: /iPhone|iPad|iPod/i.test(ua),
    isAndroid: /Android/i.test(ua),
    isMobile: /Android.*Mobile|iPhone|iPod|BlackBerry|Opera Mini|IEMobile|Windows Phone/i.test(ua),
    isTablet: /iPad|Tablet|Android(?!.*Mobile)/i.test(ua),
    isTouch: hasTouch(),
    maxTouchPoints: maxTouchPoints,
    supportsGamepad: !!(navigator.getGamepads || navigator.webkitGetGamepads),
    supportsPointer: !!window.PointerEvent,
    supportsFullscreen: !!(
      document.documentElement.requestFullscreen ||
      document.documentElement.webkitRequestFullscreen ||
      document.documentElement.mozRequestFullScreen ||
      document.documentElement.msRequestFullscreen
    )};

  info.isMobile = info.isMobile && !info.isPS3;
  info.isTablet = info.isTablet && !info.isPS3;
  info.isDesktop = !info.isPS3 && !info.isMobile && !info.isTablet;
  info.type = info.isPS3 ? "ps3" : (info.isMobile ? "mobile" : (info.isTablet ? "tablet" : "pc"));
  info.inputMode = info.isPS3 ? "gamepad" : ((info.isMobile || info.isTablet || info.isTouch) ? "touch" : "desktop");
  info.gpuTier = detectGPUTier(info);

  function addClass(el, name) {
    if (!el) return;
    if (el.className.indexOf(name) === -1) {
      el.className += (el.className ? " " : "") + name;
    }
  }

  function removeClass(el, name) {
    if (!el) return;
    el.className = (" " + el.className + " ").replace(" " + name + " ", " ").replace(/^\s+|\s+$/g, "");
  }

  function configureViewport() {
    var meta = document.getElementById("viewport-meta");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      meta.id = "viewport-meta";
      var head = document.getElementsByTagName("head")[0];
      if (head) head.appendChild(meta);
    }

    if (info.isPS3) {
      /* PS3 Browser reflow estable con ancho fijo 720p. */
      meta.setAttribute("content", "width=1280");
    } else {
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
      );
    }
  }

  function applyClasses() {
    var html = document.documentElement;
    removeClass(html, "device-ps3");
    removeClass(html, "device-mobile");
    removeClass(html, "device-tablet");
    removeClass(html, "device-pc");

    addClass(html, "device-" + info.type);
    addClass(html, info.isTouch ? "device-touch" : "device-no-touch");
    addClass(html, info.supportsGamepad ? "gamepad-capable" : "gamepad-unknown");
    addClass(html, "gpu-" + info.gpuTier);

    if (info.isIOS) addClass(html, "device-ios");
    if (info.isAndroid) addClass(html, "device-android");
  }

  function requestFullscreen(el) {
    el = el || document.documentElement;
    var fn = el.requestFullscreen ||
             el.webkitRequestFullscreen ||
             el.mozRequestFullScreen ||
             el.msRequestFullscreen;
    if (fn) {
      try { return fn.call(el); } catch (e) {}
    }
    return false;
  }

  function exitFullscreen() {
    var fn = document.exitFullscreen ||
             document.webkitExitFullscreen ||
             document.mozCancelFullScreen ||
             document.msExitFullscreen;
    if (fn) {
      try { return fn.call(document); } catch (e) {}
    }
    return false;
  }

  function getSafeArea() {
    /* Los valores reales se resuelven en CSS con env(); aquí damos fallback. */
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  configureViewport();
  applyClasses();

  var device = window.DeviceDetector = {
    info: info,
    deviceType: info,
    detectGPUTier: function() { return info.gpuTier; },
    getType: function() { return info.type; },
    isPS3: function() { return info.isPS3; },
    isMobile: function() { return info.isMobile; },
    isTablet: function() { return info.isTablet; },
    isTouch: function() { return info.isTouch; },
    shouldUseTouchControls: function() {
      return !info.isPS3 && (info.isMobile || info.isTablet || info.isTouch);
    },
    requestFullscreen: requestFullscreen,
    exitFullscreen: exitFullscreen,
    getSafeArea: getSafeArea
  };
})(window, document, navigator);