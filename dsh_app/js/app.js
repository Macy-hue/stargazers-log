/* MOMENTO — interface, local photo handling and export. */
(function () {
  'use strict';

  const { STYLES, LAYOUTS } = window.MOMENTO_PRESETS;
  const Art = window.MomentoArt;
  const WALL_W = Art.W;
  const WALL_H = Art.H;

  const STORAGE_KEY = 'momento.settings.v1';
  const CONSENT_KEY = 'momento.photo-consent.v1';
  const MAX_PHOTOS = 5;
  const MIN_PHOTOS = 4;
  const MAX_LONG_EDGE = 1800;
  const MAX_FILE_BYTES = 60 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);
  const els = {};
  const state = {
    photos: [],
    styleId: 'japanese',
    layoutId: 'scatter',
    seed: 23,
    note: STYLES.japanese.defaultNote,
    noteCustom: false,
    safeArea: true,
    demo: false,
    busy: false,
    exportBlob: null,
    exportFile: null,
    exportUrl: null,
    exportReady: false,
    renderSerial: 0,
    replaceIndex: -1,
    pendingConsentAction: null,
    promptStyleId: 'japanese',
    previewMode: 'view'
    ,exportSize: 'phone'
  };

  let renderFrame = 0;
  let exportTimer = 0;
  let noteTimer = 0;
  let toastTimer = 0;
  let dockFrame = 0;
  let exportSerial = 0;

  function cacheElements() {
    [
      'privacyBtn', 'stageMode', 'wallpaperCanvas', 'lockscreen', 'lockDate',
      'canvasEmpty', 'emptyCta', 'renderingVeil', 'stageCaption', 'fullscreenBtn',
      'reshuffleBtn', 'demoBtn', 'photoSection', 'photoCount', 'photoStrip',
      'importBtn', 'importBtnLabel', 'shufflePhotosBtn', 'clearBtn', 'demoNote',
      'needNote', 'styleGrid', 'styleChips', 'styleDesc', 'promptBtn', 'layoutRow',
      'safeToggle', 'desktopSize', 'noteInput', 'noteCount', 'saveBtn', 'exportMeta', 'saveHint',
      'mobileDock', 'dockTitle', 'dockMeta', 'dockSaveBtn', 'howToBtn',
      'consentDialog', 'consentAccept', 'consentDemo', 'promptDialog', 'promptTabs',
      'promptStyleName', 'promptStyleEn', 'promptText', 'copyPromptBtn', 'previewDialog',
      'previewKicker', 'previewTitle', 'previewImage', 'previewTip', 'downloadLink',
      'helpDialog', 'photoInput', 'replaceInput', 'toast'
    ].forEach((id) => {
      els[id] = $(id);
    });
    els.canvas = els.wallpaperCanvas;
    els.ctx = els.canvas.getContext('2d');
  }

  /* ------------------------------------------------------------------ */
  /* preferences, dialogs and small UI helpers                           */
  /* ------------------------------------------------------------------ */

  function loadSettings() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (err) {
      data = null;
    }
    if (!data || typeof data !== 'object') return;
    if (STYLES[data.styleId]) state.styleId = data.styleId;
    if (LAYOUTS.some((l) => l.id === data.layoutId)) state.layoutId = data.layoutId;
    if (typeof data.note === 'string') {
      state.note = data.note;
      state.noteCustom = data.note.trim() !== '' && data.note.trim() !== STYLES[state.styleId].defaultNote;
    }
    if (typeof data.safeArea === 'boolean') state.safeArea = data.safeArea;
    if (typeof data.seed === 'number') state.seed = data.seed;
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        styleId: state.styleId,
        layoutId: state.layoutId,
        note: state.note,
        noteCustom: state.noteCustom,
        safeArea: state.safeArea,
        seed: state.seed
      }));
    } catch (err) {
      /* private mode — preferences simply won't persist */
    }
  }

  function hasConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'yes';
    } catch (err) {
      return false;
    }
  }

  function rememberConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, 'yes');
    } catch (err) {
      /* ignore */
    }
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function toast(message, ms) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, ms || 2800);
  }

  function setLoading(loading, message) {
    if (!els.renderingVeil) return;
    els.renderingVeil.hidden = !loading;
    if (loading) {
      const strong = els.renderingVeil.querySelector('strong');
      if (strong) strong.textContent = message || '正在冲洗照片…';
    }
    if (els.photoSection) els.photoSection.setAttribute('aria-busy', loading ? 'true' : 'false');
  }

  function formatDate() {
    const now = new Date();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + weekdays[now.getDay()];
  }

  function isIOS() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isMobileLike() {
    return isIOS() || /Android/i.test(navigator.userAgent || '') || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  /* ------------------------------------------------------------------ */
  /* UI construction                                                     */
  /* ------------------------------------------------------------------ */

  function buildStyleCards() {
    const markup = Object.values(STYLES).map((style) => (
      '<button class="style-card" type="button" data-style="' + style.id + '" aria-pressed="false">' +
        '<span class="style-art" aria-hidden="true"><span class="mini-tape"></span><span class="mini-photo"></span><span class="mini-doodle"></span></span>' +
        '<span class="style-copy"><strong>' + style.name + '</strong><small>' + style.en + '</small></span>' +
      '</button>'
    )).join('');
    els.styleGrid.innerHTML = markup;
  }

  function layoutIcon(id) {
    if (id === 'salon') {
      return '<svg viewBox="0 0 44 32" aria-hidden="true"><rect x="4.5" y="4.5" width="14" height="9.5" rx="1"/><rect x="25.5" y="4.5" width="14" height="9.5" rx="1"/><rect x="4.5" y="18" width="14" height="9.5" rx="1"/><rect x="25.5" y="18" width="14" height="9.5" rx="1"/></svg>';
    }
    if (id === 'column') {
      return '<svg viewBox="0 0 44 32" aria-hidden="true"><rect x="11" y="3.5" width="22" height="5.8" rx="1" transform="rotate(-2 22 6.4)"/><rect x="10" y="12" width="23" height="6" rx="1" transform="rotate(1.6 21.5 15)"/><rect x="12" y="20.5" width="21" height="5.8" rx="1" transform="rotate(-1.4 22.5 23.4)"/><path d="M17 27.8h9" stroke-linecap="round" opacity=".35"/></svg>';
    }
    return '<svg viewBox="0 0 44 32" aria-hidden="true"><rect x="3" y="5" width="13" height="18" rx="1" transform="rotate(-8 9.5 14)"/><rect x="16.5" y="4.5" width="12.5" height="17" rx="1" transform="rotate(4 22.7 13)"/><rect x="29" y="8" width="12" height="16.5" rx="1" transform="rotate(-4 35 16.2)"/><path d="M11 25.5h22" stroke-linecap="round" opacity=".25"/></svg>';
  }

  function buildLayoutCards() {
    els.layoutRow.innerHTML = LAYOUTS.map((layout) => (
      '<button class="layout-option" type="button" data-layout="' + layout.id + '" aria-pressed="false">' +
        '<span class="layout-icon" aria-hidden="true">' + layoutIcon(layout.id) + '</span>' +
        '<strong>' + layout.name + '</strong><small>' + layout.desc + '</small>' +
      '</button>'
    )).join('');
  }

  function updateStyleUI() {
    const style = STYLES[state.styleId];
    els.styleGrid.querySelectorAll('.style-card').forEach((card) => {
      const active = card.dataset.style === state.styleId;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    els.styleChips.innerHTML = style.chips.map((chip) => '<span>' + chip + '</span>').join('');
    els.styleDesc.textContent = style.desc;
    els.noteInput.placeholder = '比如：' + style.defaultNote;
    updateNoteCount();
  }

  function updateLayoutUI() {
    els.layoutRow.querySelectorAll('.layout-option').forEach((button) => {
      const active = button.dataset.layout === state.layoutId;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function updateNoteCount() {
    els.noteCount.textContent = (els.noteInput.value || '').length + ' / 24';
    if (els.noteInput.value.length >= 22) {
      els.noteCount.style.color = 'var(--accent)';
    } else {
      els.noteCount.style.color = '';
    }
  }

  function updateSafeUI() {
    els.safeToggle.setAttribute('aria-checked', state.safeArea ? 'true' : 'false');
    els.lockscreen.classList.toggle('is-hidden', !state.safeArea);
  }

  /* ------------------------------------------------------------------ */
  /* photo import                                                       */
  /* ------------------------------------------------------------------ */

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.indexOf('image/') === 0) return true;
    return /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name || '');
  }

  function makeThumb(source) {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 240;
    const g = c.getContext('2d');
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    const scale = Math.max(240 / sw, 240 / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    g.fillStyle = '#ded1bd';
    g.fillRect(0, 0, 240, 240);
    g.drawImage(source, (240 - dw) / 2, (240 - dh) / 2, dw, dh);
    return c.toDataURL('image/jpeg', 0.78);
  }

  function loadHtmlImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      img.src = url;
    });
  }

  async function decodeFile(file) {
    // HTMLImageElement honours EXIF orientation in iOS Safari, which is the
    // important case for photos coming from an iPhone camera roll. Prefer it
    // over createImageBitmap, whose orientation option is less consistent.
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
      const source = await loadHtmlImage(objectUrl);
      return { source, objectUrl };
    } catch (err) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = '';
      if (window.createImageBitmap) {
        try {
          const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
          return { source, objectUrl: '' };
        } catch (err2) {
          /* fall through to a readable error */
        }
      }
      throw err;
    }
  }

  function normalizeSource(source) {
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    if (!sw || !sh) throw new Error('EMPTY_IMAGE');
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#dfd2be';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return { source: canvas, width: w, height: h };
  }

  async function createPhoto(file) {
    if (!file || !file.size) throw new Error('EMPTY_FILE');
    if (file.size > MAX_FILE_BYTES) throw new Error('FILE_TOO_LARGE');
    if (!isImageFile(file)) throw new Error('NOT_IMAGE');
    const decoded = await decodeFile(file);
    try {
      const normalized = normalizeSource(decoded.source);
      if (decoded.source && typeof decoded.source.close === 'function') decoded.source.close();
      return {
        source: normalized.source,
        width: normalized.width,
        height: normalized.height,
        thumb: makeThumb(normalized.source),
        name: file.name || '照片',
        demo: false,
        focusX: 0.5,
        focusY: normalized.height > normalized.width ? 0.42 : 0.5
      };
    } finally {
      if (decoded.objectUrl) URL.revokeObjectURL(decoded.objectUrl);
    }
  }

  function photoError(file, err) {
    if (err && err.message === 'FILE_TOO_LARGE') return '「' + file.name + '」超过 60MB，换一张小一点的照片吧。';
    if (/\.(heic|heif)$/i.test(file.name || '') || /heic|heif/i.test(file.type || '')) {
      return 'HEIC 照片需要在 iPhone Safari 中打开，或先转换为 JPG。';
    }
    return '「' + (file.name || '这张照片') + '」无法读取，换一张试试。';
  }

  function refreshDemoFlag() {
    state.demo = state.photos.length > 0 && state.photos.every((p) => p.demo);
  }

  function requestImport() {
    if (state.busy) return;
    ensureConsent(() => {
      els.photoInput.value = '';
      els.photoInput.click();
    });
  }

  function ensureConsent(action) {
    if (hasConsent()) {
      action();
      return;
    }
    state.pendingConsentAction = action;
    els.consentAccept.textContent = '同意并选择照片';
    openDialog(els.consentDialog);
  }

  async function addFiles(fileList) {
    if (state.busy) return;
    const all = Array.from(fileList || []);
    if (!all.length) return;
    const imageFiles = all.filter(isImageFile);
    if (!imageFiles.length) {
      toast('请选择图片文件（JPG / PNG / HEIC）。');
      return;
    }

    const base = state.demo ? [] : state.photos.slice();
    const remaining = MAX_PHOTOS - base.length;
    if (remaining <= 0) {
      toast('最多 5 张照片。先移除一张再添加吧。');
      return;
    }
    const accepted = imageFiles.slice(0, remaining);
    const skipped = all.length - accepted.length;

    state.busy = true;
    setLoading(true, '正在冲洗照片…');
    const loaded = [];
    let failed = 0;
    for (let i = 0; i < accepted.length; i++) {
      setLoading(true, '正在冲洗第 ' + (i + 1) + ' / ' + accepted.length + ' 张…');
      try {
        loaded.push(await createPhoto(accepted[i]));
      } catch (err) {
        failed++;
        console.warn('[Momento] image failed', accepted[i].name, err);
        toast(photoError(accepted[i], err), 4200);
      }
    }
    state.photos = base.concat(loaded);
    refreshDemoFlag();
    state.busy = false;
    setLoading(false);
    updateAllUI();
    requestRender();
    if (loaded.length) {
      if (state.photos.length < MIN_PHOTOS) {
        toast('已添加 ' + loaded.length + ' 张，还需 ' + (MIN_PHOTOS - state.photos.length) + ' 张。');
      } else {
        toast('已添加 ' + loaded.length + ' 张照片。');
      }
    } else if (failed) {
      toast('没有照片被添加，请检查格式后重试。', 4000);
    }
    if (skipped > 0) {
      toast('一次最多 5 张，多出的照片没有加入。', 3600);
    }
  }

  function removePhoto(index) {
    if (index < 0 || index >= state.photos.length) return;
    state.photos.splice(index, 1);
    refreshDemoFlag();
    updateAllUI();
    requestRender();
    toast('已移除这张照片。');
  }

  function clearPhotos() {
    if (!state.photos.length) return;
    state.photos = [];
    state.demo = false;
    updateAllUI();
    requestRender();
    toast('照片已清空，可以重新开始。');
  }

  function shufflePhotos() {
    if (state.photos.length < 2) return;
    state.photos.push(state.photos.shift());
    updateAllUI();
    requestRender();
    toast('照片顺序已调整。');
  }

  function requestReplace(index) {
    if (state.busy) return;
    ensureConsent(() => {
      state.replaceIndex = index;
      els.replaceInput.value = '';
      els.replaceInput.click();
    });
  }

  async function replaceFile(file) {
    const index = state.replaceIndex;
    state.replaceIndex = -1;
    if (!file || index < 0 || index >= state.photos.length) return;
    state.busy = true;
    setLoading(true, '正在替换照片…');
    try {
      const photo = await createPhoto(file);
      state.photos[index] = photo;
      refreshDemoFlag();
      toast('照片已替换。');
    } catch (err) {
      toast(photoError(file, err), 4000);
    } finally {
      state.busy = false;
      setLoading(false);
      updateAllUI();
      requestRender();
    }
  }

  function loadDemo(quiet) {
    if (state.busy) return;
    state.busy = true;
    setLoading(true, '正在铺开示例照片…');
    requestAnimationFrame(() => {
      try {
        state.photos = Art.makeDemoPhotos();
        state.demo = true;
        if (!state.noteCustom || !state.note.trim()) {
          state.note = STYLES[state.styleId].defaultNote;
          els.noteInput.value = state.note;
        }
        updateAllUI();
        requestRender();
        if (!quiet) toast('已载入 5 张示例照片，选择你的照片即可替换。');
      } catch (err) {
        console.error('[Momento] demo failed', err);
        toast('示例载入失败，请刷新页面重试。');
      } finally {
        state.busy = false;
        setLoading(false);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* render and export                                                  */
  /* ------------------------------------------------------------------ */

  function renderNow() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
      const serial = ++state.renderSerial;
      state.exportReady = false;
      window.__momentoExportReady = false;
      try {
        Art.renderWallpaper(els.ctx, {
          styleId: state.styleId,
          layoutId: state.layoutId,
          photos: state.photos,
          note: state.note,
          safeArea: state.safeArea,
          seed: state.seed
        });
        updateStageCopy();
        updateExportUI('rendering');
        scheduleExport(serial);
      } catch (err) {
        console.error('[Momento] render failed', err);
        toast('拼贴渲染遇到问题，请刷新页面重试。', 4000);
      }
    });
  }

  function requestRender() {
    renderNow();
  }

  function scheduleExport(serial) {
    clearTimeout(exportTimer);
    if (state.photos.length < MIN_PHOTOS) {
      releaseExport();
      updateExportUI('idle');
      return;
    }
    const token = ++exportSerial;
    updateExportUI('rendering');
    exportTimer = setTimeout(() => {
      const sizes = { phone:[WALL_W,WALL_H], '1080p':[1920,1080], '1440p':[2560,1440], '4k':[3840,2160] };
      const target = sizes[state.exportSize] || sizes.phone;
      const exportCanvas = target[0] === WALL_W && target[1] === WALL_H ? els.canvas : document.createElement('canvas');
      if (exportCanvas !== els.canvas) { exportCanvas.width = target[0]; exportCanvas.height = target[1]; const eg = exportCanvas.getContext('2d'); eg.imageSmoothingEnabled = true; eg.imageSmoothingQuality = 'high'; eg.drawImage(els.canvas, 0, 0, target[0], target[1]); }
      exportCanvas.toBlob((blob) => {
        if (token !== exportSerial || serial !== state.renderSerial) return;
        if (!blob) {
          toast('壁纸生成失败，请刷新后重试。', 4000);
          updateExportUI('idle');
          return;
        }
        if (state.exportUrl) URL.revokeObjectURL(state.exportUrl);
        const style = STYLES[state.styleId];
        const filename = 'momento-' + style.id + '-' + target[0] + 'x' + target[1] + '.jpg';
        state.exportBlob = blob;
        state.exportFile = new File([blob], filename, { type: 'image/jpeg' });
        state.exportUrl = URL.createObjectURL(blob);
        state.exportReady = true;
        els.downloadLink.href = state.exportUrl;
        els.downloadLink.download = filename;
        updateExportUI('ready');
        window.__momentoExportReady = true;
        document.dispatchEvent(new CustomEvent('momento:export-ready'));
      }, 'image/jpeg', 0.93);
    }, 260);
  }

  function releaseExport() {
    exportSerial++;
    if (state.exportUrl) {
      URL.revokeObjectURL(state.exportUrl);
      state.exportUrl = null;
    }
    state.exportBlob = null;
    state.exportFile = null;
    state.exportReady = false;
    window.__momentoExportReady = false;
  }

  function exportLabel() {
    if (state.photos.length < MIN_PHOTOS) {
      return '还需 ' + (MIN_PHOTOS - state.photos.length) + ' 张照片';
    }
    if (state.busy) return '正在读取照片…';
    if (!state.exportReady) return '正在生成…';
    return '保存壁纸';
  }

  function updateExportUI(mode) {
    const count = state.photos.length;
    const disabled = count < MIN_PHOTOS || !state.exportReady;
    const label = exportLabel();
    const span = els.saveBtn.querySelector('span');
    if (span) span.textContent = label;
    els.saveBtn.disabled = disabled;
    els.saveBtn.classList.toggle('is-generating', count >= MIN_PHOTOS && !state.exportReady);
    els.dockSaveBtn.disabled = disabled;
    els.dockSaveBtn.textContent = label;

    if (count < MIN_PHOTOS) {
      els.exportMeta.textContent = '高清 JPG · 适配 iPhone 17 Pro Max 锁屏与主屏';
      els.saveHint.textContent = '选满 4 张后即可保存。iPhone 可直接存进相册。';
    } else if (!state.exportReady) {
      els.exportMeta.textContent = '1320 × 2868 px · 正在压平纸张与胶带…';
      els.saveHint.textContent = '正在把纸张、胶带和手写句压成一张高清 JPG…';
    } else {
      const mb = state.exportBlob ? (state.exportBlob.size / 1024 / 1024).toFixed(1) : '—';
      els.exportMeta.textContent = '1320 × 2868 px · JPG · 约 ' + mb + ' MB';
      els.saveHint.textContent = isMobileLike()
        ? '在 iPhone 上会优先打开分享面板，选择「存储图像」即可。'
        : '点击后下载高清 JPG，可直接设为桌面壁纸。';
    }
  }

  function updateStageCopy() {
    const style = STYLES[state.styleId];
    const layout = LAYOUTS.find((l) => l.id === state.layoutId);
    const count = state.photos.length;
    if (!count) {
      els.stageMode.textContent = '空版式';
      els.stageCaption.textContent = '选好照片后，这里会实时生成拼贴。';
    } else if (state.demo) {
      els.stageMode.textContent = '示例照片';
      els.stageCaption.textContent = '示例 · ' + style.name + ' · ' + layout.name;
    } else {
      els.stageMode.textContent = count + ' 张照片';
      els.stageCaption.textContent = style.name + ' · ' + layout.name + ' · 实时预览';
    }
  }

  function updatePhotoUI() {
    const count = state.photos.length;
    els.photoCount.textContent = count + ' / ' + MAX_PHOTOS;
    els.canvasEmpty.hidden = count > 0;
    els.clearBtn.hidden = count === 0;
    els.shufflePhotosBtn.hidden = count < 2;
    els.demoNote.hidden = !state.demo;
    els.photoStrip.innerHTML = state.photos.map((photo, i) => (
      '<div class="photo-thumb' + (photo.demo ? ' is-demo' : '') + '" data-index="' + i + '">' +
        '<button class="photo-thumb-main" type="button" data-replace="' + i + '" aria-label="替换第 ' + (i + 1) + ' 张照片">' +
          '<img src="' + photo.thumb + '" alt="' + (photo.name || '照片') + '">' +
        '</button>' +
        '<span class="thumb-index">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<button class="thumb-remove" type="button" data-remove="' + i + '" aria-label="移除第 ' + (i + 1) + ' 张照片">×</button>' +
      '</div>'
    )).join('');

    if (state.demo) {
      els.importBtnLabel.textContent = '换成我的照片';
      els.importBtn.disabled = false;
    } else if (count === 0) {
      els.importBtnLabel.textContent = '从相册选择';
      els.importBtn.disabled = false;
    } else if (count < MAX_PHOTOS) {
      els.importBtnLabel.textContent = '再加 ' + (MAX_PHOTOS - count) + ' 张';
      els.importBtn.disabled = false;
    } else {
      els.importBtnLabel.textContent = '已选满 5 张';
      els.importBtn.disabled = true;
    }

    if (count < MIN_PHOTOS) {
      els.needNote.hidden = false;
      els.needNote.classList.remove('is-ready');
      els.needNote.textContent = count === 0
        ? '还需 4 张照片，就能生成第一张壁纸。'
        : '还需 ' + (MIN_PHOTOS - count) + ' 张照片，就能生成壁纸。';
    } else {
      els.needNote.hidden = false;
      els.needNote.classList.add('is-ready');
      els.needNote.textContent = count === 5
        ? '5 张刚刚好。现在可以保存这张壁纸了。'
        : '已选 4 张，可以生成；再加 1 张会更丰富。';
    }

    const showDock = count > 0;
    els.dockTitle.textContent = state.demo ? '示例拼贴' : (STYLES[state.styleId].name + ' · ' + count + ' 张');
    els.dockMeta.textContent = state.exportReady ? '1320 × 2868 · 可以保存' : '1320 × 2868 · 本地生成';
    els.demoBtn.textContent = state.demo ? '重新载入示例' : '载入示例';
    if (!showDock) {
      els.mobileDock.hidden = true;
      document.body.classList.remove('has-dock');
    } else {
      queueDockSync();
    }
  }

  function syncDock() {
    if (!els.mobileDock) return;
    if (state.photos.length === 0 || window.innerWidth > 920) {
      els.mobileDock.hidden = true;
      document.body.classList.remove('has-dock');
      return;
    }
    const stage = document.querySelector('.stage');
    const stageBottom = stage ? stage.getBoundingClientRect().bottom : 0;
    const shouldShow = stageBottom < window.innerHeight - 86;
    els.mobileDock.hidden = !shouldShow;
    document.body.classList.toggle('has-dock', shouldShow);
  }

  function queueDockSync() {
    if (dockFrame) return;
    dockFrame = requestAnimationFrame(() => {
      dockFrame = 0;
      syncDock();
    });
  }

  function updateAllUI() {
    updateStyleUI();
    updateLayoutUI();
    updateSafeUI();
    updatePhotoUI();
    updateStageCopy();
    updateExportUI('idle');
  }

  /* ------------------------------------------------------------------ */
  /* save and share                                                     */
  /* ------------------------------------------------------------------ */

  function downloadFile() {
    if (!state.exportUrl) return;
    const a = document.createElement('a');
    a.href = state.exportUrl;
    a.download = state.exportFile ? state.exportFile.name : 'momento-wallpaper.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('已开始下载高清 JPG。');
  }

  function openPreview(mode) {
    if (!state.exportReady || !state.exportUrl) {
      toast(state.photos.length < MIN_PHOTOS ? '再选 ' + (MIN_PHOTOS - state.photos.length) + ' 张照片就可以保存了。' : '正在生成壁纸，稍等一下。');
      return;
    }
    state.previewMode = mode || 'view';
    els.previewImage.src = state.exportUrl;
    els.previewKicker.textContent = state.previewMode === 'save' ? 'SAVE TO PHOTOS' : 'FINAL PRINT';
    els.previewTitle.textContent = state.previewMode === 'save' ? '保存这张壁纸' : '你的拼贴壁纸';
    els.previewTip.textContent = isIOS()
      ? '长按上方图片，选择「存储到照片」；或点「下载 JPG」保存。'
      : (isMobileLike()
        ? '长按图片可以保存；也可以点「下载 JPG」。'
        : '点击「下载 JPG」保存到电脑。');
    openDialog(els.previewDialog);
  }

  async function saveWallpaper() {
    if (!state.exportReady || !state.exportFile) {
      toast('正在生成，稍等一下。');
      return;
    }

    if (isMobileLike()) {
      let canShareFiles = false;
      try {
        canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [state.exportFile] }));
      } catch (err) {
        canShareFiles = false;
      }
      if (canShareFiles && navigator.share) {
        try {
          // Called directly from the tap, before any await, so iOS keeps the
          // user activation needed for the native share sheet.
          await navigator.share({
            files: [state.exportFile],
            title: '我的拼贴壁纸',
            text: '用拾光拼贴做的 iPhone 17 Pro Max 壁纸'
          });
          toast('已打开系统分享面板，选择「存储图像」即可。');
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          console.warn('[Momento] share unavailable', err);
        }
      }
      openPreview('save');
      return;
    }

    downloadFile();
  }

  /* ------------------------------------------------------------------ */
  /* prompt dialog                                                      */
  /* ------------------------------------------------------------------ */

  function setPromptStyle(id) {
    if (!STYLES[id]) return;
    state.promptStyleId = id;
    const style = STYLES[id];
    els.promptStyleName.textContent = style.name;
    els.promptStyleEn.textContent = style.en;
    els.promptText.textContent = style.prompt;
    els.promptTabs.querySelectorAll('.prompt-tab').forEach((tab) => {
      const active = tab.dataset.promptStyle === id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function openPrompt() {
    setPromptStyle(state.styleId);
    openDialog(els.promptDialog);
  }

  function copyText(text, successMessage) {
    const done = () => toast(successMessage || '已复制。');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      done();
    } catch (err) {
      toast('复制失败，请手动选择提示词。');
    }
  }

  /* ------------------------------------------------------------------ */
  /* events                                                             */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    els.importBtn.addEventListener('click', requestImport);
    els.emptyCta.addEventListener('click', requestImport);

    els.photoInput.addEventListener('change', (event) => {
      const files = event.target.files;
      addFiles(files);
      event.target.value = '';
    });

    els.replaceInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      replaceFile(file);
      event.target.value = '';
    });

    els.photoStrip.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        removePhoto(Number(remove.dataset.remove));
        return;
      }
      const replace = event.target.closest('[data-replace]');
      if (replace) {
        requestReplace(Number(replace.dataset.replace));
      }
    });

    els.clearBtn.addEventListener('click', clearPhotos);
    els.shufflePhotosBtn.addEventListener('click', shufflePhotos);

    els.styleGrid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-style]');
      if (!card) return;
      selectStyle(card.dataset.style);
    });

    els.layoutRow.addEventListener('click', (event) => {
      const button = event.target.closest('[data-layout]');
      if (!button) return;
      state.layoutId = button.dataset.layout;
      updateLayoutUI();
      updateStageCopy();
      updatePhotoUI();
      saveSettings();
      requestRender();
    });

    els.safeToggle.addEventListener('click', () => {
      state.safeArea = !state.safeArea;
      updateSafeUI();
      saveSettings();
      requestRender();
    });
    els.desktopSize.addEventListener('change', () => { state.exportSize = els.desktopSize.value; updateExportUI('idle'); requestRender(); });

    els.noteInput.addEventListener('input', () => {
      state.note = els.noteInput.value;
      state.noteCustom = state.note.trim() !== '' && state.note.trim() !== STYLES[state.styleId].defaultNote;
      updateNoteCount();
      saveSettings();
      clearTimeout(noteTimer);
      noteTimer = setTimeout(requestRender, 260);
    });

    els.demoBtn.addEventListener('click', () => loadDemo(false));
    els.reshuffleBtn.addEventListener('click', () => {
      state.seed = (state.seed + 17 + Math.floor(Math.random() * 20)) % 100000;
      saveSettings();
      requestRender();
      toast('换了一种排布。');
    });

    els.fullscreenBtn.addEventListener('click', () => openPreview('view'));
    els.saveBtn.addEventListener('click', saveWallpaper);
    els.dockSaveBtn.addEventListener('click', saveWallpaper);
    els.previewImage.addEventListener('click', () => {
      if (state.previewMode === 'save') return;
    });

    els.promptBtn.addEventListener('click', openPrompt);
    els.promptTabs.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-prompt-style]');
      if (tab) setPromptStyle(tab.dataset.promptStyle);
    });
    els.copyPromptBtn.addEventListener('click', () => {
      const style = STYLES[state.promptStyleId];
      copyText(style.prompt, '「' + style.name + '」提示词已复制。');
    });

    els.privacyBtn.addEventListener('click', () => {
      state.pendingConsentAction = () => {
        els.photoInput.value = '';
        els.photoInput.click();
      };
      els.consentAccept.textContent = hasConsent() ? '选择照片' : '同意并选择照片';
      openDialog(els.consentDialog);
    });

    els.consentAccept.addEventListener('click', () => {
      rememberConsent();
      const action = state.pendingConsentAction;
      state.pendingConsentAction = null;
      closeDialog(els.consentDialog);
      if (action) {
        action();
      } else {
        els.photoInput.value = '';
        els.photoInput.click();
      }
    });

    els.consentDemo.addEventListener('click', () => {
      state.pendingConsentAction = null;
      closeDialog(els.consentDialog);
      loadDemo(false);
    });

    els.howToBtn.addEventListener('click', () => openDialog(els.helpDialog));

    document.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => {
        closeDialog($(button.dataset.close));
      });
    });

    [els.consentDialog, els.promptDialog, els.previewDialog, els.helpDialog].forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) closeDialog(dialog);
      });
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      // Native dialog handles Escape; this is a fallback for older browsers.
      [els.consentDialog, els.promptDialog, els.previewDialog, els.helpDialog].forEach((dialog) => {
        if (dialog && dialog.hasAttribute('open') && typeof dialog.close !== 'function') {
          dialog.removeAttribute('open');
        }
      });
    });

    window.addEventListener('scroll', queueDockSync, { passive: true });
    window.addEventListener('resize', queueDockSync);
  }

  function selectStyle(id) {
    if (!STYLES[id] || id === state.styleId) return;
    const previousDefault = STYLES[state.styleId].defaultNote;
    const keepCustom = state.noteCustom && state.note.trim() && state.note.trim() !== previousDefault;
    state.styleId = id;
    if (!keepCustom) {
      state.note = STYLES[id].defaultNote;
      state.noteCustom = false;
      els.noteInput.value = state.note;
    } else {
      state.noteCustom = state.note.trim() !== STYLES[id].defaultNote;
    }
    updateStyleUI();
    updateStageCopy();
    updatePhotoUI();
    saveSettings();
    requestRender();
  }

  /* ------------------------------------------------------------------ */
  /* init                                                               */
  /* ------------------------------------------------------------------ */

  function buildPromptTabs() {
    els.promptTabs.innerHTML = Object.values(STYLES).map((style) => (
      '<button class="prompt-tab" type="button" role="tab" data-prompt-style="' + style.id + '" aria-selected="false">' + style.name + '</button>'
    )).join('');
  }

  function applyQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const style = params.get('style');
    const layout = params.get('layout');
    if (style && STYLES[style]) {
      state.styleId = style;
      if (!params.has('note') && !state.noteCustom) {
        state.note = STYLES[style].defaultNote;
      }
    }
    if (layout && LAYOUTS.some((l) => l.id === layout)) state.layoutId = layout;
    if (params.get('safe') === '0') state.safeArea = false;
    if (params.has('note')) {
      state.note = params.get('note').slice(0, 24);
      state.noteCustom = state.note.trim() !== '' && state.note.trim() !== STYLES[state.styleId].defaultNote;
    }
    return params;
  }

  async function waitForFonts() {
    if (!document.fonts || !document.fonts.ready) return;
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 1000))
    ]);
  }

  async function init() {
    cacheElements();
    loadSettings();
    const params = applyQueryParams();

    els.canvas.width = WALL_W;
    els.canvas.height = WALL_H;
    els.lockDate.textContent = formatDate();

    buildStyleCards();
    buildLayoutCards();
    buildPromptTabs();
    bindEvents();

    els.noteInput.value = state.note;
    els.noteInput.maxLength = 24;
    updateStyleUI();
    updateLayoutUI();
    updateSafeUI();
    updatePhotoUI();
    updateStageCopy();
    updateExportUI('idle');
    updateNoteCount();

    await waitForFonts();

    if (params.get('demo') === '1') {
      loadDemo(true);
      // Give the demo generator a frame, then finish the initial render.
      await new Promise((resolve) => setTimeout(resolve, 60));
    } else {
      requestRender();
    }

    window.__momento = {
      state,
      loadDemo,
      renderNow,
      selectStyle,
      setLayout: (id) => {
        if (LAYOUTS.some((l) => l.id === id)) {
          state.layoutId = id;
          updateLayoutUI();
          updateStageCopy();
          requestRender();
        }
      },
      get exportReady() { return state.exportReady; },
      get exportBlob() { return state.exportBlob; }
    };
    window.__momentoReady = true;

    if ('serviceWorker' in navigator && !params.has('nosw') && /^https?:$/.test(window.location.protocol)) {
      const register = () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
