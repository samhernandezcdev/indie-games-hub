# INDIE HUB - PORTAL DE JUEGOS INDIE POR MR. SAM

Portal central optimizado para el navegador del PlayStation 3 con soporte para gamepad DualShock 3, compatible igual para teléfonos móviles y PC.

## 🎮 Cómo Añadir un Juego Nuevo

### Paso 1: Crear la carpeta del juego

```
games/
└── mi-juego/
    └── index.html
```

### Paso 2: Registrar el juego en `js/hub-main.js`

Añade una entrada al array `GAMES_REGISTRY`:

```javascript
{
  id:      'mi-juego',
  title:   'MI JUEGO',
  desc:    'Descripción corta del juego (máx 80 caracteres).',
  url:     'games/mi-juego/index.html',
  genre:   'Plataformas',
  players: 1,
  status:  'available'  // 'available' o 'coming'
}
```

### Paso 3: Añadir la tarjeta en `index.html`

Copia y adapta el bloque `.game-card` existente:

```html
<div class="game-card" tabindex="0"
     data-game-id="mi-juego"
     data-game-title="MI JUEGO"
     data-game-desc="Descripción del juego."
     data-game-url="games/mi-juego/index.html"
     data-game-genre="Plataformas"
     data-game-players="1"
     aria-label="Mi Juego"
     role="gridcell">
  <div class="card-icon">
    <!-- Tu SVG icono aquí (64x64) -->
  </div>
  <div class="card-body">
    <h3 class="card-title">MI JUEGO</h3>
    <p class="card-genre">Plataformas • 1 Jugador</p>
    <p class="card-desc">Descripción corta.</p>
    <div class="card-controls">
      <span class="ctrl-tag"><span class="btn-x">✕</span> Saltar</span>
    </div>
  </div>
  <div class="card-status status-available">DISPONIBLE</div>
  <div class="card-focus-ring"></div>
</div>
```

### Paso 4: Comunicar fin de partida (opcional)

Desde tu juego, envía un mensaje al hub cuando termine:

```javascript
// Notificar Game Over al hub
window.parent.postMessage({ type: 'gameOver', score: 1500 }, '*');

// Volver al hub manualmente
window.parent.postMessage({ type: 'returnToHub' }, '*');
```

---

### Limitaciones conocidas del PS3 Browser:

- No soporta `CSS Grid` → se usa `flexbox` con prefijos `-webkit-`
- No soporta `CSS Variables` → valores directos como fallback
- `requestAnimationFrame` no disponible en fw <3.50 → polyfill incluido
- Gamepad API puede requerir fw reciente
- Rendimiento limitado → hub a 30 FPS máximo
- RAM limitada (~50MB) → evitar assets grandes

---

## 🔧 Optimizaciones PS3 Incluidas

1. **Detección automática** del User Agent de PS3
2. **CSS sin box-shadow ni blur** (muy costosos en PS3)
3. **GPU layers** con `transform: translateZ(0)` en elementos clave
4. **Polyfill de rAF** para firmware antiguo
5. **30 FPS cap** para conservar recursos
6. **Lazy loading** de tarjetas con animación escalonada
7. **Limpieza de memoria** periódica
8. **Eventos optimizados** (throttle en scroll/resize)

---

## 🐛 Troubleshooting

**El mando no funciona:**
- Verifica que el firmware PS3 sea reciente (4.x+)
- La Gamepad API puede no estar disponible en todos los firmwares
- Usa el D-Pad como alternativa al stick analógico

**Los juegos no cargan:**
- Verifica las rutas en `data-game-url`
- Comprueba que el archivo existe en `games/tu-juego/index.html`
- El hub usa `iframe` con `sandbox="allow-scripts allow-same-origin"`

**Rendimiento lento:**
- Activa el modo PS3 (se detecta automáticamente por UA)
- Cierra otras aplicaciones del PS3 antes de abrir el navegador
- Usa el modo "Memoria expandida" si está disponible en tu firmware

---

## 📄 Licencia

MIT License — Libre para uso personal y comercial.