(() => {
  "use strict";

  // ====== Konstanta ukuran (resolusi tinggi) ======
  const SHOTS = 4;
  const CELL_W = 800, CELL_H = 600;   // tiap foto rasio 4:3
  const PAD = 60, GAP = 30, FOOTER = 140;

  // ====== Elemen ======
  const $ = (id) => document.getElementById(id);
  const video = $("video"), countdownEl = $("countdown"), shotInfo = $("shotInfo");
  const flash = $("flash"), camMsg = $("camMsg");
  const btnCamera = $("btnCamera"), btnStart = $("btnStart");
  const btnDownload = $("btnDownload"), btnRetake = $("btnRetake");
  const thumbs = $("thumbs"), result = $("result"), resultHint = $("resultHint");
  const timerSec = $("timerSec"), gapSec = $("gapSec"), layoutSel = $("layout");
  const caption = $("caption"), mirrorChk = $("mirror"), showDate = $("showDate");
  const solidColor = $("solidColor"), customFile = $("customFile");

  let stream = null;
  let photos = [];          // array canvas hasil jepretan
  let busy = false;
  let customImg = null;
  let shotDate = new Date();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const currentFrame = () => document.querySelector('input[name="frame"]:checked').value;

  // ====== Kamera ======
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      camMsg.classList.add("hidden");
      btnStart.disabled = false;
      btnCamera.textContent = "🎥 Kamera Aktif";
      btnCamera.disabled = true;
      applyMirror();
    } catch (err) {
      camMsg.classList.remove("hidden");
      camMsg.textContent =
        "Kamera tidak bisa diakses. Izinkan akses kamera di browser, dan pastikan situs dibuka lewat HTTPS (GitHub Pages sudah HTTPS). (" + err.name + ")";
    }
  }

  function applyMirror() {
    video.classList.toggle("mirror", mirrorChk.checked);
  }

  // ====== Ambil satu frame (crop tengah rasio 4:3) ======
  function grabFrame() {
    const vw = video.videoWidth, vh = video.videoHeight;
    const target = CELL_W / CELL_H;
    let sw = vw, sh = vw / target;
    if (sh > vh) { sh = vh; sw = vh * target; }
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;

    const c = document.createElement("canvas");
    c.width = CELL_W; c.height = CELL_H;
    const ctx = c.getContext("2d");
    if (mirrorChk.checked) { ctx.translate(CELL_W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CELL_W, CELL_H);
    return c;
  }

  // ====== Sesi foto ======
  async function runSession() {
    if (busy || !stream) return;
    busy = true;
    photos = [];
    thumbs.innerHTML = "";
    btnStart.disabled = true; btnDownload.disabled = true; btnRetake.disabled = true;
    result.classList.add("hidden");
    resultHint.classList.remove("hidden");
    resultHint.textContent = "Sedang mengambil foto...";

    const first = clamp(parseInt(timerSec.value, 10) || 3, 1, 10);
    const between = clamp(parseInt(gapSec.value, 10) || 3, 1, 10);

    for (let i = 0; i < SHOTS; i++) {
      shotInfo.textContent = `Foto ${i + 1} / ${SHOTS}`;
      const secs = i === 0 ? first : between;
      for (let s = secs; s >= 1; s--) {
        countdownEl.textContent = s;
        await sleep(1000);
      }
      countdownEl.textContent = "";
      flash.classList.remove("go"); void flash.offsetWidth; flash.classList.add("go");
      const shot = grabFrame();
      photos.push(shot);
      const img = document.createElement("img");
      img.src = shot.toDataURL("image/jpeg", 0.6);
      thumbs.appendChild(img);
      await sleep(400);
    }

    shotInfo.textContent = "";
    shotDate = new Date();
    busy = false;
    btnStart.disabled = false;
    btnRetake.disabled = false;
    render();
  }

  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  // ====== Render ke canvas ======
  function render() {
    if (photos.length < SHOTS) return;
    const isGrid = layoutSel.value === "grid";

    const W = isGrid ? CELL_W * 2 + GAP + PAD * 2 : CELL_W + PAD * 2;
    const H = isGrid
      ? PAD + CELL_H * 2 + GAP + FOOTER
      : PAD + CELL_H * SHOTS + GAP * (SHOTS - 1) + FOOTER;

    result.width = W; result.height = H;
    const ctx = result.getContext("2d");

    const frame = currentFrame();
    const textColor = drawBackground(ctx, W, H, frame);

    // posisi foto
    const pos = [];
    for (let i = 0; i < SHOTS; i++) {
      if (isGrid) {
        pos.push({ x: PAD + (i % 2) * (CELL_W + GAP), y: PAD + Math.floor(i / 2) * (CELL_H + GAP) });
      } else {
        pos.push({ x: PAD, y: PAD + i * (CELL_H + GAP) });
      }
    }

    pos.forEach((p, i) => {
      // border putih tipis + bayangan
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#fff";
      ctx.fillRect(p.x - 8, p.y - 8, CELL_W + 16, CELL_H + 16);
      ctx.restore();
      ctx.drawImage(photos[i], p.x, p.y, CELL_W, CELL_H);
    });

    // teks footer
    const textY = H - FOOTER / 2 - 10;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const cap = caption.value.trim();
    if (cap) {
      ctx.font = "700 54px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(cap, W / 2, textY - (showDate.checked ? 22 : 0));
    }
    if (showDate.checked) {
      ctx.font = "400 32px 'Segoe UI', Arial, sans-serif";
      const d = shotDate.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
      ctx.fillText(d, W / 2, textY + (cap ? 32 : 0));
    }

    // overlay bingkai custom (di atas foto)
    if (frame === "custom" && customImg) {
      ctx.drawImage(customImg, 0, 0, W, H);
    }

    result.classList.remove("hidden");
    resultHint.classList.add("hidden");
    btnDownload.disabled = false;
  }

  // mengembalikan warna teks yang kontras
  function drawBackground(ctx, W, H, frame) {
    if (frame === "solid") {
      const c = solidColor.value;
      ctx.fillStyle = c; ctx.fillRect(0, 0, W, H);
      return luminance(c) > 0.55 ? "#2b2233" : "#ffffff";
    }

    if (frame === "retro") {
      ctx.fillStyle = "#f2dfb8"; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      const colors = ["#d9822b", "#c0392b", "#2a7f8f", "#f2dfb8"];
      const stripe = 36;
      let k = 0;
      for (let d = -H; d < W + H; d += stripe) {
        ctx.fillStyle = colors[k++ % colors.length];
        ctx.beginPath();
        ctx.moveTo(d, 0); ctx.lineTo(d + stripe, 0);
        ctx.lineTo(d + stripe + H, H); ctx.lineTo(d + H, H);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // panel krem di footer agar teks terbaca
      ctx.fillStyle = "#f2dfb8";
      roundRect(ctx, PAD - 10, H - FOOTER - 6, W - (PAD - 10) * 2, FOOTER - 30, 24);
      ctx.fill();
      return "#5a3a1a";
    }

    if (frame === "colorful") {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#ff6ec4"); g.addColorStop(0.35, "#ffd86e");
      g.addColorStop(0.65, "#5de0e6"); g.addColorStop(1, "#9b6bff");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // confetti (deterministik agar tidak berubah tiap render)
      const rnd = mulberry32(42);
      const palette = ["#ffffff", "#ff3d81", "#ffe14d", "#3dd6d0", "#7c5cff"];
      const n = Math.round((W * H) / 9000);
      for (let i = 0; i < n; i++) {
        const x = rnd() * W, y = rnd() * H, s = 8 + rnd() * 18;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rnd() * Math.PI * 2);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = palette[Math.floor(rnd() * palette.length)];
        if (rnd() < 0.5) ctx.fillRect(-s / 2, -s / 4, s, s / 2);
        else { ctx.beginPath(); ctx.arc(0, 0, s / 2.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      ctx.fillStyle = "rgba(255,255,255,.75)";
      roundRect(ctx, PAD - 10, H - FOOTER - 6, W - (PAD - 10) * 2, FOOTER - 30, 24);
      ctx.fill();
      return "#3b2a5a";
    }

    // custom: dasar putih, PNG ditempel setelah foto
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    return "#2b2233";
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ====== Download ======
  function download() {
    result.toBlob((blob) => {
      const a = document.createElement("a");
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      a.download = `photobooth-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  function retake() {
    photos = [];
    thumbs.innerHTML = "";
    result.classList.add("hidden");
    resultHint.classList.remove("hidden");
    resultHint.textContent = "Belum ada foto. Ambil foto dulu ya!";
    btnDownload.disabled = true; btnRetake.disabled = true;
  }

  // ====== Event ======
  btnCamera.addEventListener("click", startCamera);
  btnStart.addEventListener("click", runSession);
  btnDownload.addEventListener("click", download);
  btnRetake.addEventListener("click", retake);
  mirrorChk.addEventListener("change", applyMirror);

  [layoutSel, caption, showDate, solidColor].forEach((el) =>
    el.addEventListener("input", render)
  );

  document.querySelectorAll('input[name="frame"]').forEach((r) =>
    r.addEventListener("change", () => {
      const f = currentFrame();
      $("opt-solid").classList.toggle("hidden", f !== "solid");
      $("opt-custom").classList.toggle("hidden", f !== "custom");
      render();
    })
  );

  customFile.addEventListener("change", () => {
    const file = customFile.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => { customImg = img; render(); };
    img.src = URL.createObjectURL(file);
  });

  window.addEventListener("beforeunload", () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
  });
})();
