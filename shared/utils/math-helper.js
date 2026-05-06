/**
 * math-helper.js — Utilidades matemáticas comunes
 * Compatible con ES3 (sin Math.sign, sin ** operator)
 */

;(function(window) {
  'use strict';

  var MathHelper = {

    /* ---- Números ---- */
    clamp: function(val, min, max) {
      return Math.max(min, Math.min(max, val));
    },

    lerp: function(a, b, t) {
      return a + (b - a) * t;
    },

    /* Mappear un valor de un rango a otro */
    map: function(val, inMin, inMax, outMin, outMax) {
      return outMin + (outMax - outMin) * ((val - inMin) / (inMax - inMin));
    },

    sign: function(x) {
      if (x > 0) return  1;
      if (x < 0) return -1;
      return 0;
    },

    /* Distancia 2D */
    dist: function(x1, y1, x2, y2) {
      var dx = x2 - x1;
      var dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    },

    /* Distancia al cuadrado (más rápido, evita sqrt) */
    distSq: function(x1, y1, x2, y2) {
      var dx = x2 - x1;
      var dy = y2 - y1;
      return dx * dx + dy * dy;
    },

    /* Normalizar vector 2D */
    normalize: function(x, y) {
      var len = Math.sqrt(x * x + y * y);
      if (len === 0) return { x: 0, y: 0 };
      return { x: x / len, y: y / len };
    },

    /* Ángulo entre dos puntos (radianes) */
    angle: function(x1, y1, x2, y2) {
      return Math.atan2(y2 - y1, x2 - x1);
    },

    /* Grados a radianes */
    toRad: function(deg) {
      return deg * Math.PI / 180;
    },

    /* Radianes a grados */
    toDeg: function(rad) {
      return rad * 180 / Math.PI;
    },

    /* Número aleatorio entero en [min, max] */
    randInt: function(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /* Float aleatorio en [min, max) */
    randFloat: function(min, max) {
      return Math.random() * (max - min) + min;
    },

    /* AABB collision (rectángulos alineados) */
    aabbCollide: function(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw &&
             ax + aw > bx &&
             ay < by + bh &&
             ay + ah > by;
    },

    /* Círculo vs Círculo */
    circleCollide: function(x1, y1, r1, x2, y2, r2) {
      var sum = r1 + r2;
      return this.distSq(x1, y1, x2, y2) < sum * sum;
    },

    /* Módulo positivo (útil para wrapping de pantalla) */
    mod: function(a, b) {
      return ((a % b) + b) % b;
    }
  };

  window.MathHelper = MathHelper;

})(window);
