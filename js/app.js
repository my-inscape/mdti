/* ============================================================
   MUDAパーソナル診断 : 画面遷移・スコアリング・シェア
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const state = {
    answers: new Array(QUESTIONS.length).fill(null),
    current: 0,
    result: null    // { code, axes: [{ raw, letter, ... }] }
  };

  const screens = {
    intro: $('#screen-intro'),
    question: $('#screen-question'),
    result: $('#screen-result')
  };

  /* ---------------------------------------------------------
     C. スコアリング
     決定打問 × -2 ＋ 標準問 × +1。
     マイナス→minus側の文字 / プラス→plus側の文字。
     合計が 0 になる組み合わせ（例: 決定打-1 かつ 標準-2）だけは
     決定打問の向きを優先して振り分ける。
     --------------------------------------------------------- */
  function questionIndex(axis, kind) {
    return QUESTIONS.findIndex(q => q.axis === axis && q.kind === kind);
  }

  function scoreAxis(axis, answers) {
    const di = questionIndex(axis, 'decisive');
    const si = questionIndex(axis, 'standard');
    const decisive = answers[di] * -2;
    const standard = answers[si] * 1;
    const raw = decisive + standard;
    const sign = raw !== 0 ? raw : decisive;
    const pole = sign < 0 ? 'minus' : 'plus';
    return {
      axis,
      raw,
      decisive,
      standard,
      tiebreak: raw === 0,
      pole,
      letter: AXES[axis][pole].letter
    };
  }

  function diagnose(answers) {
    const axes = AXES.map((_, i) => scoreAxis(i, answers));
    return { code: axes.map(a => a.letter).join(''), axes };
  }

  /* ---------------------------------------------------------
     回答の一時保存（リロードしても途中から / 結果を復元できる）
     --------------------------------------------------------- */
  const STORE_KEY = 'mdti.session';

  function persist() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ answers: state.answers }));
    } catch (err) { /* プライベートモードなどでは保存しない */ }
  }

  function restore() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (!saved || !Array.isArray(saved.answers) || saved.answers.length !== QUESTIONS.length) return;
      const valid = saved.answers.every(a => a === null || CHOICES.some(c => c.score === a));
      if (!valid) return;
      state.answers = saved.answers;
      if (state.answers.every(a => a !== null)) state.result = diagnose(state.answers);
    } catch (err) { /* 壊れていたら無視して最初から */ }
  }

  /* ---------------------------------------------------------
     ルーティング（SPA風のシームレス遷移）
     --------------------------------------------------------- */
  function go(route) {
    if (location.hash === route) render();
    else location.hash = route;
  }

  function showScreen(name) {
    Object.keys(screens).forEach(key => {
      const el = screens[key];
      if (key === name) {
        el.hidden = false;
        el.classList.remove('screen-enter');
        void el.offsetWidth;
        el.classList.add('screen-enter');
      } else {
        el.hidden = true;
      }
    });
  }

  function render() {
    const hash = location.hash || '#/';

    const qMatch = hash.match(/^#\/q\/(\d+)$/);
    const rMatch = hash.match(/^#\/result\/([OI][RC][SA][DK])$/);
    const tMatch = hash.match(/^#\/type\/([OI][RC][SA][DK])$/);

    if (qMatch) {
      const idx = Math.min(Math.max(parseInt(qMatch[1], 10) - 1, 0), QUESTIONS.length - 1);
      // 未回答の問題を飛び越えた指定は、最初の未回答へ引き戻す
      const firstUnanswered = state.answers.findIndex(a => a === null);
      const limit = firstUnanswered === -1 ? QUESTIONS.length - 1 : firstUnanswered;
      state.current = Math.min(idx, limit);
      if (state.current !== idx) {
        // file:// では replaceState が使えないので、失敗しても表示は続行する
        try { history.replaceState(null, '', '#/q/' + (state.current + 1)); } catch (err) { /* noop */ }
      }
      showScreen('question');
      renderQuestion();
      scrollTop();
      return;
    }

    if (rMatch || tMatch) {
      const code = (rMatch || tMatch)[1];
      if (!TYPES[code]) { go('#/'); return; }
      const mine = rMatch && state.result && state.result.code === code;
      showScreen('result');
      renderResult(code, mine ? state.result.axes : null);
      scrollTop();
      return;
    }

    showScreen('intro');
    scrollTop();
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ---------------------------------------------------------
     A. イントロ
     --------------------------------------------------------- */
  function renderAxisIntro() {
    $('#axis-intro-list').innerHTML = AXES.map(axis => `
      <li>
        <span class="pole">
          <em>${axis.minus.letter}</em>
          <span><b>${axis.minus.name}</b><small>${axis.minus.note}</small></span>
        </span>
        <span class="vs">VS</span>
        <span class="pole right">
          <span><b>${axis.plus.name}</b><small>${axis.plus.note}</small></span>
          <em>${axis.plus.letter}</em>
        </span>
      </li>
    `).join('');
  }

  function startDiagnosis() {
    state.answers = new Array(QUESTIONS.length).fill(null);
    state.current = 0;
    state.result = null;
    persist();
    go('#/q/1');
  }

  /* ---------------------------------------------------------
     B. 質問画面
     --------------------------------------------------------- */
  const HUE_BY_AXIS = ['violet', 'sage', 'azure', 'amber'];

  function renderQuestion() {
    const idx = state.current;
    const q = QUESTIONS[idx];
    const axis = AXES[q.axis];

    screens.question.dataset.hue = HUE_BY_AXIS[q.axis];

    $('#q-index').textContent = String(idx + 1);
    $('#q-bar-fill').style.width = ((idx + 1) / QUESTIONS.length * 100) + '%';
    $('#q-axis').textContent =
      `第${q.axis + 1}軸　${axis.minus.letter}（${axis.minus.name}） / ${axis.plus.letter}（${axis.plus.name}）`;
    $('#q-id').textContent = q.id;
    $('#q-text').textContent = q.text;

    const card = $('#q-card');
    card.classList.remove('swap');
    void card.offsetWidth;
    card.classList.add('swap');

    const picked = state.answers[idx];
    $('#q-choices').innerHTML = CHOICES.map((c, i) => `
      <button class="choice${picked === c.score ? ' picked' : ''}" type="button"
              data-choice="${i}" data-level="${i + 1}">
        <span class="num">${i + 1}</span>
        <span class="label">${c.label}</span>
      </button>
    `).join('');

    // 1問目では戻り先がトップページになる
    $('#back-label').textContent = idx === 0 ? 'トップに戻る' : '1つ前の質問に戻る';
  }

  function answer(choiceIndex) {
    const idx = state.current;
    const choice = CHOICES[choiceIndex];
    if (!choice) return;

    state.answers[idx] = choice.score;
    persist();

    const btn = $(`.choice[data-choice="${choiceIndex}"]`);
    $$('.choice').forEach(b => b.classList.remove('picked'));
    if (btn) btn.classList.add('picked');
    $$('.choice').forEach(b => { b.disabled = true; });

    setTimeout(() => {
      if (idx + 1 < QUESTIONS.length) {
        go('#/q/' + (idx + 2));
      } else {
        state.result = diagnose(state.answers);
        go('#/result/' + state.result.code);
      }
    }, 260);
  }

  function backQuestion() {
    if (state.current === 0) go('#/');
    else go('#/q/' + state.current);
  }

  /* ---------------------------------------------------------
     D. 結果画面
     --------------------------------------------------------- */
  function axisRow(axisResult) {
    const axis = AXES[axisResult.axis];
    const minusWon = axisResult.pole === 'minus';
    // スコア -6〜+6 を 6%〜94% に変換
    const pos = 50 + (axisResult.raw / 6) * 44;
    return `
      <div class="axis-row">
        <div class="axis-row-head">
          <span class="${minusWon ? 'won' : ''}"><em>${axis.minus.letter}</em>${axis.minus.name}</span>
          <span class="${minusWon ? '' : 'won'}">${axis.plus.name}<em>${axis.plus.letter}</em></span>
        </div>
        <div class="axis-track">
          <span class="axis-knob" style="left:${pos}%"></span>
        </div>
        <p class="axis-score">
          第${axisResult.axis + 1}軸スコア <b>${axisResult.raw > 0 ? '+' : ''}${axisResult.raw}</b>
          （決定打 ${axisResult.decisive > 0 ? '+' : ''}${axisResult.decisive} ／ 標準 ${axisResult.standard > 0 ? '+' : ''}${axisResult.standard}）
          → <b>${axisResult.letter}</b>
          ${axisResult.tiebreak ? '<span class="tie">※同点のため決定打問を優先</span>' : ''}
        </p>
      </div>`;
  }

  function matchCard(kind, relation) {
    const other = TYPES[relation.code];
    const label = kind === 'best'
      ? '🤝 ベスト相性（無駄の共犯者）'
      : '⚡ ワースト相性（日常の追突事故）';
    return `
      <div class="match-card ${kind}">
        <p class="match-label">${label}</p>
        <div class="match-body">
          <img class="match-thumb" src="${typeImage(relation.code)}"
               alt="${relation.code} ${other.name}"
               data-goto-type="${relation.code}" loading="lazy">
          <div class="match-meta">
            <p class="match-code">${relation.code}</p>
            <p class="match-name">${other.name}</p>
            <p class="match-relation">関係性：${relation.relation}</p>
            <p class="match-text">${relation.text}</p>
          </div>
        </div>
      </div>`;
  }

  function renderResult(code, axes) {
    const type = TYPES[code];
    const isMine = !!axes;

    $('#result-body').innerHTML = `
      <div data-hue="${type.hue}">
        <p class="result-note">${isMine ? 'YOUR MUDA TYPE' : 'MUDA TYPE ARCHIVE'}</p>

        <div class="type-card">
          <p class="type-code">${code}</p>
          <p class="type-no">TYPE ${String(type.sheetNo).padStart(2, '0')} / 16</p>
          <h2 class="type-name">${type.name}</h2>
          <p class="type-tagline">${type.tagline}</p>
          <div class="type-figure">
            <img src="${typeImage(code)}" alt="${code} ${type.name}のイラスト">
          </div>
          ${isMine ? `<p class="common-message">${RESULT_COMMON_MESSAGE}</p>` : ''}
        </div>

        ${isMine ? `<div class="axis-result">${axes.map(axisRow).join('')}</div>` : ''}

        <div class="detail-block">
          <h3><span class="tag">無駄</span>くだらない日常の生態</h3>
          <p>${type.ecology}</p>
        </div>

        <div class="detail-block">
          <h3><span class="tag">人間味</span>現代社会での意外な実用性</h3>
          <p class="detail-lead">【${type.utilityTitle}】</p>
          <p>${type.utility}</p>
        </div>

        <div class="match-grid">
          ${matchCard('best', type.best)}
          ${matchCard('worst', type.worst)}
        </div>

        ${isMine ? OFFICIAL_NOTE : ''}

        ${isMine ? shareBlock(code) : ''}

        <div class="result-actions">
          <button class="primary-btn" type="button" data-action="${isMine ? 'restart' : 'start'}">
            ${isMine ? 'もう一度、無駄を測定する' : '自分の無駄タイプを測定する（全8問）'}
          </button>
          <button class="ghost-btn" type="button" data-action="open-gallery">16タイプ一覧を見る</button>
        </div>
      </div>`;
  }

  /* ---------------------------------------------------------
     E. SNSシェア
     --------------------------------------------------------- */
  /* 全シェア共通の本文（URLは各サービスの流儀に合わせて別途付ける） */
  function captionBody(code) {
    const type = TYPES[code];
    return `私のMDTIは【${type.name}（${code}）】でした！\n〜${type.tagline}〜\n\n` +
      `履歴書には書けない無駄を測定する「MDTI診断」\n#MDTI #無駄タイプインジケーター`;
  }

  function shareUrl(code) {
    return location.origin && location.origin !== 'null'
      ? location.origin + location.pathname + '#/result/' + code
      : location.href;
  }

  function shareBlock(code) {
    return `
      <div class="share-block">
        <h3>この無駄を、世に放流する</h3>
        <p class="share-lead">診断結果をシェアすると、同じ無駄を持つ共犯者が見つかります。</p>
        <div class="share-buttons">
          <button class="share-btn x" type="button" data-share="x">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L22.8 22h-6.4l-4.6-6-5.3 6H1.4l7.3-8.3L1.6 2H8l4.3 5.6L18.9 2Zm-1.1 18h1.7L6.4 3.8H4.6L17.8 20Z"/></svg>
            Xでシェア
          </button>
          <button class="share-btn line" type="button" data-share="line">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 3.6 3.3 6.6 7.7 7.2.3.1.7.2.8.5.1.3 0 .7 0 1l-.2 1c0 .3-.2 1 .9.6 1.1-.5 5.9-3.5 7.9-6 1.4-1.5 2-3 2-4.3C21.9 6.3 17.7 3 12 3Zm-3.6 9.7H6.6c-.2 0-.4-.2-.4-.4V8.8c0-.2.2-.4.4-.4s.4.2.4.4V12h1.4c.2 0 .4.2.4.4s-.2.3-.4.3Zm1.7-.4c0 .2-.2.4-.4.4s-.4-.2-.4-.4V8.8c0-.2.2-.4.4-.4s.4.2.4.4v3.5Zm4.3 0c0 .2-.1.3-.3.4h-.1c-.1 0-.3-.1-.3-.2l-1.8-2.4v2.2c0 .2-.2.4-.4.4s-.4-.2-.4-.4V8.8c0-.2.1-.3.3-.4.2 0 .3 0 .4.2l1.8 2.4V8.8c0-.2.2-.4.4-.4s.4.2.4.4v3.5Zm2.9-2.1c.2 0 .4.2.4.4s-.2.4-.4.4h-1.4v.9h1.4c.2 0 .4.2.4.4s-.2.4-.4.4h-1.8c-.2 0-.4-.2-.4-.4V8.8c0-.2.2-.4.4-.4h1.8c.2 0 .4.2.4.4s-.2.4-.4.4h-1.4v.9h1.4Z"/></svg>
            LINEで送る
          </button>
          <button class="share-btn fb" type="button" data-share="facebook">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg>
            Facebook
          </button>
          <button class="share-btn ig" type="button" data-share="instagram">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 5a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm6.1-.4a1.1 1.1 0 1 0-2.2 0 1.1 1.1 0 0 0 2.2 0ZM12 9.1a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8Z"/></svg>
            Instagram
          </button>
          <button class="share-btn" type="button" data-share="image">🖼 結果画像を保存</button>
          <button class="share-btn" type="button" data-share="copy">🔗 リンクをコピー</button>
          <button class="share-btn wide" type="button" data-share="native">📤 その他のアプリでシェア</button>
        </div>
      </div>`;
  }

  function openShare(url) {
    window.open(url, '_blank', 'noopener,width=600,height=640');
  }

  /* LINE / Instagram はアプリを直接起動するため、端末種別で分岐する */
  function isMobileDevice() {
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod|Android/i.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);   // iPadOS
  }

  /* 本文とURLをひとつなぎにした共有文（アプリやクリップボード向け） */
  function appCaption(code) {
    return captionBody(code) + '\n' + shareUrl(code);
  }

  /* URLスキームでアプリを開き、開けなかった場合だけWebへ逃がす */
  function openApp(scheme, webFallback) {
    const timer = setTimeout(() => { location.href = webFallback; }, 1500);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(timer);   // アプリが起動した
    }, { once: true });
    location.href = scheme;
  }

  /* ① LINE: ユニバーサルリンクでLINEアプリの送信先選択を直接開く
        （PCでは公式の共有画面にフォールバックされる） */
  function shareToLine(code) {
    const url = 'https://line.me/R/msg/text/?' + encodeURIComponent(appCaption(code));
    if (isMobileDevice()) location.href = url;
    else openShare(url);
  }

  async function handleShare(kind, code) {
    const text = captionBody(code);
    const url = shareUrl(code);

    if (kind === 'x') {
      openShare('https://x.com/intent/tweet?text=' + encodeURIComponent(text + '\n') + '&url=' + encodeURIComponent(url));
      return;
    }
    if (kind === 'line') {
      shareToLine(code);
      return;
    }
    if (kind === 'facebook') {
      openShare('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url));
      return;
    }
    if (kind === 'copy') {
      await copyToClipboard(appCaption(code));
      return;
    }
    if (kind === 'instagram') {
      await shareToInstagram(code);
      return;
    }
    if (kind === 'image') {
      await saveResultImage(code);
      return;
    }
    if (kind === 'native') {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'MDTI 無駄タイプ診断', text, url });
        } catch (err) {
          if (err && err.name !== 'AbortError') toast('シェアできませんでした');
        }
      } else {
        await copyToClipboard(appCaption(code), null);
        toast('この端末は共有メニュー非対応のため、内容をコピーしました');
      }
    }
  }

  async function copyToClipboard(value, message = 'コピーしました') {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (message) toast(message);
    } catch (err) {
      toast('コピーできませんでした');
    }
  }

  /* 結果カード画像（1200×630）をCanvasで生成 */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // 行頭に置きたくない文字（句読点・閉じ括弧・小書き文字）
  const NO_LINE_START = '、。，．・：；！？」』）］｝〉》”’ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ…';

  function wrapText(ctx, text, maxWidth, maxLines) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        if (NO_LINE_START.includes(ch)) {
          line += ch;   // 1文字だけはみ出させて行頭禁則を守る
          continue;
        }
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = kept[maxLines - 1].slice(0, -1) + '…';
      return kept;
    }
    return lines;
  }

  const HUE_HEX = { violet: '#c97a63', sage: '#7f9a83', azure: '#6b8ba4', amber: '#d4a359' };
  const HUE_TINT = { violet: '#f6ebe6', sage: '#ebf0ec', azure: '#e8eef2', amber: '#f6efe3' };

  const JP_FONT = '"Zen Maru Gothic","Hiragino Maru Gothic ProN","Yu Gothic UI",sans-serif';
  const CODE_FONT = '"Outfit","Avenir Next",sans-serif';
  const CARD_FOOTER = 'あなたの「愛おしい無駄」を測定する16タイプ診断';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  /* 元絵を拡大しすぎないよう、枠内に収めつつ倍率に上限をかける */
  function artRect(art, boxX, boxY, boxW, boxH, maxScale) {
    const scale = Math.min(boxW / art.width, boxH / art.height, maxScale);
    const w = art.width * scale, h = art.height * scale;
    return { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, w, h };
  }

  /* イラストは白地なので、少し大きい白いプレートに乗せて境目を消す */
  function drawArtPlate(ctx, art, box) {
    const pad = 24;
    ctx.save();
    ctx.shadowColor = 'rgba(58, 53, 48, .12)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2, 30);
    ctx.restore();
    ctx.drawImage(art, box.x, box.y, box.w, box.h);
  }

  /* 1200×630（OG・X・Facebook向けの横長） */
  function drawWideCard(ctx, code, type, art) {
    const W = 1200, H = 630;
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = HUE_TINT[type.hue];
    ctx.fillRect(620, 0, W - 620, H);

    drawArtPlate(ctx, art, artRect(art, 655, 70, 470, 480, 1.1));

    ctx.fillStyle = '#9a9186';
    ctx.font = '500 22px ' + JP_FONT;
    ctx.fillText('MDTI ／ 無駄タイプインジケーター', 70, 96);

    ctx.fillStyle = HUE_HEX[type.hue];
    ctx.font = '700 118px ' + CODE_FONT;
    ctx.fillText(code, 66, 226);

    ctx.fillStyle = '#3a3530';
    ctx.font = '700 46px ' + JP_FONT;
    const nameLines = wrapText(ctx, type.name, 500);
    nameLines.forEach((l, i) => ctx.fillText(l, 70, 300 + i * 58));

    ctx.fillStyle = '#6e665c';
    ctx.font = '500 23px ' + JP_FONT;
    const tagLines = wrapText(ctx, '「' + type.tagline + '」', 500, 3);
    const tagTop = 300 + nameLines.length * 58 + 22;
    tagLines.forEach((l, i) => ctx.fillText(l, 70, tagTop + i * 38));

    ctx.fillStyle = '#9a9186';
    ctx.font = '500 21px ' + JP_FONT;
    ctx.fillText(CARD_FOOTER, 70, H - 62);
  }

  /* 1080×1350（Instagramのフィード・ストーリー向けの縦長） */
  function drawPortraitCard(ctx, code, type, art) {
    const W = 1080, H = 1350, cx = W / 2;
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    ctx.fillStyle = '#9a9186';
    ctx.font = '500 26px ' + JP_FONT;
    ctx.fillText('MDTI ／ 無駄タイプインジケーター', cx, 112);

    ctx.fillStyle = HUE_TINT[type.hue];
    roundRect(ctx, 70, 160, 940, 610, 48);
    drawArtPlate(ctx, art, artRect(art, 130, 220, 820, 490, 1.35));

    ctx.fillStyle = HUE_HEX[type.hue];
    ctx.font = '700 150px ' + CODE_FONT;
    ctx.fillText(code, cx, 920);

    ctx.fillStyle = '#3a3530';
    ctx.font = '700 58px ' + JP_FONT;
    const nameLines = wrapText(ctx, type.name, 880);
    nameLines.forEach((l, i) => ctx.fillText(l, cx, 1005 + i * 72));

    ctx.fillStyle = '#6e665c';
    ctx.font = '500 30px ' + JP_FONT;
    const tagLines = wrapText(ctx, '「' + type.tagline + '」', 860, 3);
    const tagTop = 1005 + nameLines.length * 72 + 30;
    tagLines.forEach((l, i) => ctx.fillText(l, cx, tagTop + i * 48));

    ctx.fillStyle = '#9a9186';
    ctx.font = '500 24px ' + JP_FONT;
    ctx.fillText(CARD_FOOTER, cx, H - 64);
  }

  const CARD_SIZES = { og: [1200, 630], portrait: [1080, 1350] };

  async function buildResultCanvas(code, variant = 'og') {
    const type = TYPES[code];
    const [W, H] = CARD_SIZES[variant] || CARD_SIZES.og;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const art = await loadImage(typeImage(code));

    if (variant === 'portrait') drawPortraitCard(ctx, code, type, art);
    else drawWideCard(ctx, code, type, art);

    return canvas;
  }

  /* 待たされ続けても処理が止まらないように上限を付ける */
  function withTimeout(promise, ms) {
    return Promise.race([
      Promise.resolve(promise).catch(() => undefined),
      new Promise(resolve => setTimeout(resolve, ms))
    ]);
  }

  async function buildCardFile(code, variant) {
    // Webフォントの読み込みが保留のままになる環境があるため待ちすぎない
    if (document.fonts && document.fonts.ready) await withTimeout(document.fonts.ready, 1500);
    const canvas = await buildResultCanvas(code, variant);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
    const suffix = variant === 'portrait' ? '_instagram' : '';
    return new File([blob], `MDTI_${code}${suffix}.png`, { type: 'image/png' });
  }

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveResultImage(code) {
    let file;
    try {
      file = await buildCardFile(code, 'og');
    } catch (err) {
      toast('画像を生成できませんでした（ローカルサーバー経由で開いてください）');
      return;
    }

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: appCaption(code) });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;   // ユーザーが共有をキャンセル
        // 共有できなかった場合は保存にフォールバックする
      }
    }

    downloadFile(file);
    toast('結果画像を保存しました');
  }

  /* ② Instagram: ブラウザからアプリへテキストを渡すURLスキームは存在しないため、
        キャプションをコピー＋投稿用画像を保存したうえで、アプリを直接起動する */
  async function shareToInstagram(code) {
    // クリップボードはユーザー操作の直後でないと拒否されるため最初に実行する
    await withTimeout(copyToClipboard(appCaption(code), null), 1200);

    let saved = true;
    try {
      downloadFile(await buildCardFile(code, 'portrait'));
    } catch (err) {
      saved = false;   // 画像が作れなくても、コピーとアプリ起動は続行する
    }

    toast(saved
      ? '投稿用画像を保存し、キャプションをコピーしました。Instagramに貼り付けて投稿してください'
      : 'キャプションをコピーしました。Instagramに貼り付けて投稿してください');

    // 保存処理が中断されないよう、少し待ってからアプリへ
    setTimeout(() => {
      if (isMobileDevice()) openApp('instagram://app', 'https://www.instagram.com/');
      else window.open('https://www.instagram.com/', '_blank', 'noopener');
    }, 700);
  }

  /* ---------------------------------------------------------
     16タイプ一覧
     --------------------------------------------------------- */
  function renderGallery() {
    $('#gallery-grid').innerHTML = SHEET_ORDER.map(code => {
      const t = TYPES[code];
      return `
        <button class="gallery-item" type="button" data-hue="${t.hue}" data-goto-type="${code}">
          <img src="${typeImage(code)}" alt="${code} ${t.name}" loading="lazy">
          <p class="g-code">${code}</p>
          <p class="g-name">${t.name}</p>
        </button>`;
    }).join('');
  }

  function toggleGallery(open) {
    $('#gallery').hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }

  /* ---------------------------------------------------------
     トースト
     --------------------------------------------------------- */
  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ---------------------------------------------------------
     イベント
     --------------------------------------------------------- */
  document.addEventListener('click', event => {
    const choice = event.target.closest('.choice');
    if (choice) {
      answer(Number(choice.dataset.choice));
      return;
    }

    const typeLink = event.target.closest('[data-goto-type]');
    if (typeLink) {
      toggleGallery(false);
      go('#/type/' + typeLink.dataset.gotoType);
      return;
    }

    const shareBtn = event.target.closest('[data-share]');
    if (shareBtn) {
      const code = state.result ? state.result.code : null;
      if (code) handleShare(shareBtn.dataset.share, code);
      return;
    }

    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      const action = actionEl.dataset.action;
      if (action === 'start' || action === 'restart') startDiagnosis();
      else if (action === 'back-question') backQuestion();
      else if (action === 'open-gallery') toggleGallery(true);
      else if (action === 'close-gallery') toggleGallery(false);
      return;
    }

    if (event.target.closest('[data-nav]')) return;
    if (event.target === $('#gallery')) toggleGallery(false);
  });

  document.addEventListener('keydown', event => {
    if (!$('#gallery').hidden) {
      if (event.key === 'Escape') toggleGallery(false);
      return;
    }
    if (screens.question.hidden) return;
    if (event.key >= '1' && event.key <= '4') {
      const btn = $(`.choice[data-choice="${Number(event.key) - 1}"]`);
      if (btn && !btn.disabled) answer(Number(event.key) - 1);
    }
  });

  window.addEventListener('hashchange', render);

  restore();
  renderAxisIntro();
  renderGallery();
  render();
})();
