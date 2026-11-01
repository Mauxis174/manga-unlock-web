(function () {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    try {
      tg.expand();
    } catch (_) {}
  }

  const progressBadge = document.getElementById("progress-badge");
  const filePill = document.getElementById("file-pill");
  const fileSizeLabel = document.getElementById("file-size-label");

  const step1Box = document.getElementById("step-1");
  const step1Circle = document.getElementById("step-1-circle");
  const step1Sub = document.getElementById("step-1-sub");
  const step1Btn = document.getElementById("step-1-btn");
  const step1Check = document.getElementById("step-1-check");

  const step2Box = document.getElementById("step-2");
  const step2Circle = document.getElementById("step-2-circle");
  const step2Sub = document.getElementById("step-2-sub");
  const step2Btn = document.getElementById("step-2-btn");
  const step2Check = document.getElementById("step-2-check");

  const claimBtn = document.getElementById("claim-btn");
  const statusBox = document.getElementById("status-box");
  const openBotLink = document.getElementById("open-bot-link");

  let sessionState = {
    sessionId: null,
    code: null,
    stepsDone: 0,
    totalSteps: 2,
    minSeconds: 5,
    adProvider: "demo",
    adsgramBlockId: "",
    busy: false
  };

  function getInitData() {
    return (tg && tg.initData) ? tg.initData : "";
  }

  function resolveMangaCode() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("code") || params.get("tgWebAppStartParam");
    if (fromQuery) {
      return fromQuery.trim();
    }
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
      return String(tg.initDataUnsafe.start_param).trim();
    }
    return "";
  }

  function showStatus(text, type) {
    if (!text) {
      statusBox.classList.add("hidden");
      statusBox.textContent = "";
      return;
    }
    statusBox.textContent = text;
    statusBox.className = `status-box ${type || "error"}`;
  }

  async function apiPost(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": getInitData()
      },
      body: JSON.stringify(payload || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error || "Error en la solicitud.");
      err.code = data.code;
      err.botUsername = data.bot_username;
      throw err;
    }
    return data;
  }

  function renderUI() {
    const done = sessionState.stepsDone;
    const total = sessionState.totalSteps;
    progressBadge.textContent = `${done}/${total}`;

    // Paso 1
    if (done >= 1) {
      step1Box.className = "step-box step-done";
      step1Circle.textContent = "✓";
      step1Sub.textContent = "Completado";
      step1Btn.classList.add("hidden");
      step1Check.classList.remove("hidden");
    } else {
      step1Box.className = "step-box step-active";
      step1Circle.textContent = "1";
      step1Sub.textContent = "Toca para iniciar";
      step1Btn.classList.remove("hidden");
      step1Btn.disabled = sessionState.busy || !sessionState.sessionId;
      step1Check.classList.add("hidden");
    }

    // Paso 2
    if (done >= 2) {
      step2Box.className = "step-box step-done";
      step2Circle.textContent = "✓";
      step2Sub.textContent = "Completado";
      step2Btn.classList.add("hidden");
      step2Check.classList.remove("hidden");
    } else if (done === 1) {
      step2Box.className = "step-box step-active";
      step2Circle.textContent = "2";
      step2Sub.textContent = "Toca para iniciar";
      step2Btn.classList.remove("hidden");
      step2Btn.disabled = sessionState.busy;
      step2Check.classList.add("hidden");
    } else {
      step2Box.className = "step-box step-locked";
      step2Circle.textContent = "2";
      step2Sub.textContent = "Se desbloquea tras el paso 1";
      step2Btn.classList.remove("hidden");
      step2Btn.disabled = true;
      step2Check.classList.add("hidden");
    }

    // Botón de descarga
    if (done >= total) {
      claimBtn.disabled = sessionState.busy;
      claimBtn.className = "claim-btn unlocked";
      claimBtn.textContent = "🚀 Descargar Archivo";
    } else {
      claimBtn.disabled = true;
      claimBtn.className = "claim-btn locked";
      claimBtn.textContent = "🔒 Completa los pasos para desbloquear";
    }
  }

  async function runStep(stepNumber) {
    if (sessionState.busy || !sessionState.sessionId) return;
    sessionState.busy = true;
    showStatus("", "");
    renderUI();

    const activeBtn = stepNumber === 1 ? step1Btn : step2Btn;
    const originalText = activeBtn.textContent;
    activeBtn.textContent = "...";

    try {
      const startRes = await apiPost("/api/unlock/step/start", {
        session_id: sessionState.sessionId,
        step: stepNumber
      });

      await window.AdManager.playAd({
        provider: sessionState.adProvider,
        blockId: sessionState.adsgramBlockId,
        minSeconds: startRes.min_seconds || sessionState.minSeconds
      });

      const finishRes = await apiPost("/api/unlock/step/finish", {
        session_id: sessionState.sessionId,
        step: stepNumber
      });

      sessionState.stepsDone = finishRes.steps_done;
    } catch (err) {
      showStatus(err.message || "No se pudo completar el anuncio.", "error");
    } finally {
      activeBtn.textContent = originalText;
      sessionState.busy = false;
      renderUI();
    }
  }

  function requestBotWritePermission() {
    return new Promise((resolve) => {
      if (!tg || typeof tg.requestWriteAccess !== "function") {
        resolve(true);
        return;
      }
      try {
        tg.requestWriteAccess((allowed) => resolve(Boolean(allowed)));
      } catch (_) {
        resolve(true);
      }
    });
  }

  async function claimDownload() {
    if (sessionState.busy || sessionState.stepsDone < sessionState.totalSteps) return;
    sessionState.busy = true;
    showStatus("", "");
    openBotLink.classList.add("hidden");
    claimBtn.textContent = "⏳ Enviando archivo a tu chat...";
    claimBtn.disabled = true;

    try {
      await requestBotWritePermission();
      const res = await apiPost("/api/unlock/claim", {
        session_id: sessionState.sessionId
      });

      showStatus(res.message || "✅ ¡Archivo enviado a tu chat con el bot!", "success");
      claimBtn.textContent = "✅ ¡Enviado con éxito!";

      setTimeout(() => {
        if (tg && typeof tg.close === "function") {
          tg.close();
        }
      }, 1300);
    } catch (err) {
      showStatus(err.message || "Error al enviar el archivo.", "error");
      if (err.code === "need_start" && err.botUsername) {
        openBotLink.href = `https://t.me/${err.botUsername}?start=${encodeURIComponent(sessionState.code || "")}`;
        openBotLink.classList.remove("hidden");
      }
      sessionState.busy = false;
      renderUI();
    }
  }

  async function initSession() {
    const code = resolveMangaCode();
    sessionState.code = code;

    if (!getInitData()) {
      showStatus("⚠️ Abre esta ventana desde el botón del canal dentro de Telegram.", "error");
      return;
    }

    sessionState.busy = true;
    renderUI();

    try {
      const data = await apiPost("/api/unlock/start", { code });
      sessionState.sessionId = data.session_id;
      sessionState.code = data.code;
      sessionState.stepsDone = data.steps_done || 0;
      sessionState.totalSteps = data.total_steps || 2;
      sessionState.minSeconds = data.min_seconds || 5;
      sessionState.adProvider = data.ad_provider || "demo";
      sessionState.adsgramBlockId = data.adsgram_block_id || "";

      if (data.file_size) {
        fileSizeLabel.textContent = data.file_size;
        filePill.classList.remove("hidden");
      }
    } catch (err) {
      showStatus(err.message || "No se pudo iniciar la verificación.", "error");
    } finally {
      sessionState.busy = false;
      renderUI();
    }
  }

  step1Btn.addEventListener("click", () => runStep(1));
  step2Btn.addEventListener("click", () => runStep(2));
  claimBtn.addEventListener("click", claimDownload);

  initSession();
})();
