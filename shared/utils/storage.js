/**
 * storage.js — Guardado local de puntuaciones y preferencias
 * Usa localStorage con fallback a cookies para PS3
 * (PS3 Browser soporta localStorage básico desde fw 3.10+)
 */

;(function(window) {
  'use strict';

  var STORAGE_PREFIX = 'indiehub_';

  /* ----------------------------------------------------------
     DETECCIÓN DE localStorage
  ---------------------------------------------------------- */
  var hasLocalStorage = (function() {
    try {
      var test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch(e) {
      return false;
    }
  })();

  /* ----------------------------------------------------------
     FALLBACK: cookies (PS3 antiguo sin localStorage)
  ---------------------------------------------------------- */
  var CookieStorage = {
    get: function(key) {
      var name   = encodeURIComponent(key) + '=';
      var cookies = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf(name) === 0) {
          return decodeURIComponent(c.substring(name.length));
        }
      }
      return null;
    },
    set: function(key, value, days) {
      days = days || 365;
      var expires = new Date();
      expires.setDate(expires.getDate() + days);
      document.cookie =
        encodeURIComponent(key) + '=' + encodeURIComponent(value) +
        '; expires=' + expires.toUTCString() + '; path=/';
    },
    remove: function(key) {
      this.set(key, '', -1);
    }
  };

  /* ----------------------------------------------------------
     CAPA UNIFICADA
  ---------------------------------------------------------- */
  var Storage = {
    _key: function(k) { return STORAGE_PREFIX + k; },

    set: function(key, value) {
      var k = this._key(key);
      var v = JSON.stringify(value);
      try {
        if (hasLocalStorage) {
          localStorage.setItem(k, v);
        } else {
          CookieStorage.set(k, v);
        }
        return true;
      } catch(e) {
        console.warn('[HubStorage] Error guardando:', e);
        return false;
      }
    },

    get: function(key, defaultVal) {
      var k = this._key(key);
      try {
        var raw;
        if (hasLocalStorage) {
          raw = localStorage.getItem(k);
        } else {
          raw = CookieStorage.get(k);
        }
        if (raw === null || raw === undefined) return defaultVal;
        return JSON.parse(raw);
      } catch(e) {
        return defaultVal;
      }
    },

    remove: function(key) {
      var k = this._key(key);
      try {
        if (hasLocalStorage) {
          localStorage.removeItem(k);
        } else {
          CookieStorage.remove(k);
        }
      } catch(e) {}
    },

    /* ---- Puntuaciones ---- */
    saveScore: function(gameId, score) {
      var scores = this.get('scores_' + gameId, []);
      scores.push({
        score: score,
        date:  Date.now()
      });
      // Guardar solo top 10
      scores.sort(function(a, b) { return b.score - a.score; });
      if (scores.length > 10) scores = scores.slice(0, 10);
      this.set('scores_' + gameId, scores);
      return scores;
    },

    getTopScore: function(gameId) {
      var scores = this.get('scores_' + gameId, []);
      if (!scores.length) return 0;
      return scores[0].score || 0;
    },

    getScores: function(gameId) {
      return this.get('scores_' + gameId, []);
    },

    clearScores: function(gameId) {
      this.remove('scores_' + gameId);
    },

    /* ---- Preferencias ---- */
    savePref: function(key, value) {
      return this.set('pref_' + key, value);
    },

    getPref: function(key, defaultVal) {
      return this.get('pref_' + key, defaultVal);
    }
  };

  window.HubStorage = Storage;

})(window);
