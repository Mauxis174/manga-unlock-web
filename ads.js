/**
 * Adaptador de anuncios para la Mini App.
 * Soporta:
 *  - "adsgram": usa window.Adsgram.init({ blockId }).show()
 *  - "demo": muestra un modal con cuenta regresiva de minSeconds segundos
 */
window.AdManager = {
  playAd: function ({ provider, blockId, minSeconds }) {
    const waitSeconds = Math.max(1, Number(minSeconds || 5));

    if (provider === "adsgram") {
      return new Promise((resolve, reject) => {
        if (!window.Adsgram || typeof window.Adsgram.init !== "function") {
          reject(new Error("El SDK de Adsgram no pudo cargarse. Verifica tu conexión o bloqueador de anuncios."));
          return;
        }
        if (!blockId) {
          reject(new Error("Falta configurar ADSGRAM_BLOCK_ID en el servidor."));
          return;
        }

        try {
          const controller = window.Adsgram.init({ blockId: String(blockId) });
          controller
            .show()
            .then((result) => {
              if (result && result.done === false) {
                reject(new Error("Debes ver el anuncio completo hasta el final."));
                return;
              }
              resolve(result);
            })
            .catch((err) => {
              const desc = (err && err.description) ? err.description : "El anuncio se cerró antes de finalizar o no hay anuncios disponibles.";
              reject(new Error(desc));
            });
        } catch (err) {
          reject(new Error("Error al inicializar el anuncio de Adsgram."));
        }
      });
    }

    // Modo DEMO con temporizador
    return new Promise((resolve) => {
      const modal = document.getElementById("demo-ad-modal");
      const timerEl = document.getElementById("demo-ad-timer");
      const closeBtn = document.getElementById("demo-ad-close");

      modal.classList.remove("hidden");
      closeBtn.disabled = true;
      closeBtn.textContent = "Esperando...";

      let remaining = waitSeconds;
      timerEl.textContent = `Anuncio en curso: ${remaining}s restantes...`;

      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          timerEl.textContent = `Anuncio en curso: ${remaining}s restantes...`;
        } else {
          clearInterval(interval);
          timerEl.textContent = "✅ ¡Anuncio completado!";
          closeBtn.disabled = false;
          closeBtn.textContent = "Continuar y volver a la verificación";
        }
      }, 1000);

      const onClose = () => {
        closeBtn.removeEventListener("click", onClose);
        modal.classList.add("hidden");
        resolve({ done: true });
      };

      closeBtn.addEventListener("click", onClose);
    });
  }
};
