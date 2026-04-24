(function (global) {
  'use strict';

  const GH_REPO = 'navskh/ppt';
  const GH_TOKEN_KEY = 'ppt_gh_token';

  const state = {
    opts: null,
    open: false,
    overlay: null,
    textarea: null,
    titleEl: null,
    toastEl: null,
    timerDisplay: null,
    timerToggleBtn: null,
    timerInterval: null,
    timerStartedAt: null,
    timerElapsed: 0,
  };

  function injectDom(enableTimer) {
    const timerHtml = enableTimer ? '\n    <div class="script-editor-timer">\n      <div class="timer-display" id="ppt-timer-display">00:00</div>\n      <div class="timer-controls">\n        <button class="timer-btn primary" id="ppt-timer-toggle" type="button">▶ 시작</button>\n        <button class="timer-btn" type="button" data-act="timer-reset">리셋</button>\n      </div>\n    </div>' : '';
    const html =
      '<div class="script-editor-overlay" id="ppt-editor-overlay">' +
        '<div class="script-editor">' +
          '<div class="script-editor-header">' +
            '<div class="script-editor-title" id="ppt-editor-title">Slide 1 — 스크립트 편집</div>' +
            '<div class="script-editor-nav">' +
              '<button type="button" data-act="nav-prev" title="이전 슬라이드">&#8592;</button>' +
              '<button type="button" data-act="nav-next" title="다음 슬라이드">&#8594;</button>' +
              '<button type="button" data-act="close" title="닫기 (E)" style="margin-left:8px;color:var(--text-muted);">&#10005;</button>' +
            '</div>' +
          '</div>' +
          timerHtml +
          '<div class="script-editor-body">' +
            '<textarea id="ppt-editor-textarea" spellcheck="false"></textarea>' +
          '</div>' +
          '<div class="script-editor-footer">' +
            '<div class="hint">E: 열기/닫기 &nbsp;|&nbsp; Ctrl+S: 저장 &nbsp;|&nbsp; ←→: 슬라이드 이동</div>' +
            '<div class="actions">' +
              '<button class="btn-reset" type="button" data-act="reset">되돌리기</button>' +
              '<button class="btn-save" type="button" data-act="save">저장</button>' +
              '<button class="btn-save" type="button" data-act="push" style="background: var(--green);" title="Shift+클릭: 토큰 재설정">Git Push</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="save-toast" id="ppt-save-toast"></div>';
    const container = document.createElement('div');
    container.innerHTML = html;
    while (container.firstChild) document.body.appendChild(container.firstChild);
  }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(state.opts.storageKey)) || {}; }
    catch (_) { return {}; }
  }
  function saveLocalEntry(index, text) {
    const local = loadLocal();
    local[index] = text;
    localStorage.setItem(state.opts.storageKey, JSON.stringify(local));
  }
  function clearLocalEntry(index) {
    const local = loadLocal();
    delete local[index];
    localStorage.setItem(state.opts.storageKey, JSON.stringify(local));
  }
  function getScript(index) {
    const local = loadLocal();
    return local[index] !== undefined ? local[index] : (state.opts.scripts[index] || '');
  }

  function currentIndex() { return state.opts.getCurrentSlide(); }

  function logScript(index) {
    const script = getScript(index);
    if (!script) return;
    console.clear();
    console.log(
      '%c 📋 Slide ' + (index + 1) + ' / ' + state.opts.totalSlides + ' ',
      'background: ' + state.opts.logColor + '; color: #fff; font-size: 14px; font-weight: bold; padding: 4px 12px; border-radius: 4px;'
    );
    console.log(
      '%c' + script,
      'color: #1a1a2e; font-size: 13px; line-height: 1.8; white-space: pre-wrap;'
    );
  }

  function loadEditor(index) {
    state.textarea.value = getScript(index);
    state.titleEl.textContent = 'Slide ' + (index + 1) + ' / ' + state.opts.totalSlides + ' — 스크립트 편집';
  }

  function toggle() {
    state.open = !state.open;
    state.overlay.classList.toggle('open', state.open);
    const wrap = document.querySelector('.slides-wrapper');
    const navBar = document.querySelector('.nav-bar');
    if (wrap) wrap.classList.toggle('editor-open', state.open);
    if (navBar) navBar.classList.toggle('editor-open', state.open);
    if (state.open) loadEditor(currentIndex());
  }

  function saveScript() {
    saveLocalEntry(currentIndex(), state.textarea.value);
    logScript(currentIndex());
    showToast('저장 완료');
  }

  function resetScript() {
    const defaultScript = state.opts.scripts[currentIndex()] || '';
    state.textarea.value = defaultScript;
    clearLocalEntry(currentIndex());
    logScript(currentIndex());
    showToast('기본값 복원');
  }

  function buildScriptsJs() {
    const local = loadLocal();
    const merged = Object.assign({}, state.opts.scripts);
    for (const k in local) merged[k] = local[k];
    let js = 'var SCRIPTS = {\n';
    const keys = Object.keys(merged).sort(function (a, b) { return Number(a) - Number(b); });
    keys.forEach(function (k, i) {
      const val = merged[k].replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      js += '  ' + k + ': `' + val + '`';
      js += i < keys.length - 1 ? ',\n\n' : '\n';
    });
    js += '};\n';
    return js;
  }

  function promptForToken() {
    const msg = 'GitHub Personal Access Token을 입력하세요.\n\n발급 방법:\n1. https://github.com/settings/personal-access-tokens/new\n2. Repository access → Only select repositories → "ppt"\n3. Repository permissions → Contents: Read and write\n4. Generate token → 복사해서 붙여넣기';
    const t = prompt(msg);
    return t ? t.trim() : '';
  }

  async function exportScripts(event) {
    const content = buildScriptsJs();

    if (event && event.shiftKey) {
      localStorage.removeItem(GH_TOKEN_KEY);
      showToast('토큰 초기화됨');
    }

    let token = localStorage.getItem(GH_TOKEN_KEY);
    if (!token) {
      token = promptForToken();
      if (!token) { showToast('취소됨'); return; }
      localStorage.setItem(GH_TOKEN_KEY, token);
    }

    showToast('푸시 중…');
    try {
      const apiBase = 'https://api.github.com/repos/' + GH_REPO + '/contents/' + state.opts.githubPath;
      const headers = {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
      };

      const getRes = await fetch(apiBase, { headers });
      if (getRes.status === 401 || getRes.status === 403) {
        localStorage.removeItem(GH_TOKEN_KEY);
        throw new Error('토큰 거부됨 (다시 클릭하면 재입력)');
      }
      if (!getRes.ok) throw new Error('SHA 조회 실패 (' + getRes.status + ')');
      const info = await getRes.json();

      const b64 = btoa(unescape(encodeURIComponent(content)));
      const putRes = await fetch(apiBase, {
        method: 'PUT',
        headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message: 'chore: 스크립트 업데이트 (' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ')',
          content: b64,
          sha: info.sha,
        }),
      });
      if (!putRes.ok) {
        const err = await putRes.json().catch(function () { return {}; });
        throw new Error('푸시 실패 (' + putRes.status + ') ' + (err.message || ''));
      }
      const result = await putRes.json();
      showToast('✓ GitHub 푸시 완료');
      console.log('[commit]', result.commit && result.commit.html_url);
    } catch (e) {
      console.error(e);
      showToast('오류: ' + e.message);
    }
  }

  function nav(dir) {
    const target = currentIndex() + dir;
    if (target < 0 || target >= state.opts.totalSlides) return;
    state.opts.goToSlide(target);
  }

  function onSlideChange(index) {
    if (state.open) loadEditor(index);
    logScript(index);
  }

  function showToast(msg) {
    state.toastEl.textContent = msg;
    state.toastEl.classList.add('show');
    setTimeout(function () { state.toastEl.classList.remove('show'); }, 1500);
  }

  function fmt(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return h > 0 ? h + ':' + m + ':' + s : m + ':' + s;
  }
  function currentElapsed() {
    return state.timerStartedAt
      ? state.timerElapsed + (Date.now() - state.timerStartedAt) / 1000
      : state.timerElapsed;
  }
  function renderTimer() {
    if (!state.timerDisplay) return;
    state.timerDisplay.textContent = fmt(currentElapsed());
  }
  function toggleTimer() {
    if (!state.timerDisplay) return;
    if (state.timerStartedAt) {
      state.timerElapsed += (Date.now() - state.timerStartedAt) / 1000;
      state.timerStartedAt = null;
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      state.timerToggleBtn.textContent = '▶ 재개';
      state.timerDisplay.classList.remove('running');
    } else {
      state.timerStartedAt = Date.now();
      state.timerInterval = setInterval(renderTimer, 1000);
      state.timerToggleBtn.textContent = '❚❚ 정지';
      state.timerDisplay.classList.add('running');
      renderTimer();
    }
  }
  function resetTimer() {
    if (!state.timerDisplay) return;
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.timerStartedAt = null;
    state.timerElapsed = 0;
    state.timerToggleBtn.textContent = '▶ 시작';
    state.timerDisplay.classList.remove('running');
    renderTimer();
  }

  function handleKey(e) {
    if (e.key === 'e' || e.key === 'E' || e.key === 'ㄷ') {
      if (e.target === state.textarea) return false;
      e.preventDefault();
      toggle();
      return true;
    }
    if (e.key === 'Escape' && state.open) {
      toggle();
      return true;
    }
    if (state.open) {
      if (e.target === state.textarea) return true;
      if (e.key === 'ArrowRight') { e.preventDefault(); nav(1); return true; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); nav(-1); return true; }
      return true;
    }
    return false;
  }

  const api = {
    init: function (opts) {
      state.opts = Object.assign({
        enableTimer: true,
        logColor: '#6366f1',
      }, opts);

      injectDom(state.opts.enableTimer);

      state.overlay = document.getElementById('ppt-editor-overlay');
      state.textarea = document.getElementById('ppt-editor-textarea');
      state.titleEl = document.getElementById('ppt-editor-title');
      state.toastEl = document.getElementById('ppt-save-toast');
      if (state.opts.enableTimer) {
        state.timerDisplay = document.getElementById('ppt-timer-display');
        state.timerToggleBtn = document.getElementById('ppt-timer-toggle');
        state.timerToggleBtn.addEventListener('click', toggleTimer);
      }

      state.overlay.addEventListener('click', function (e) {
        const act = e.target && e.target.dataset && e.target.dataset.act;
        if (!act) return;
        if (act === 'nav-prev') nav(-1);
        else if (act === 'nav-next') nav(1);
        else if (act === 'close') toggle();
        else if (act === 'reset') resetScript();
        else if (act === 'save') saveScript();
        else if (act === 'push') exportScripts(e);
        else if (act === 'timer-reset') resetTimer();
      });

      state.textarea.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault();
          saveScript();
        }
        e.stopPropagation();
      });
    },
    handleKey: handleKey,
    onSlideChange: onSlideChange,
    toggle: toggle,
    nav: nav,
    isOpen: function () { return state.open; },
    logScript: logScript,
  };

  global.PPTEditor = api;
})(window);
