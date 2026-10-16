/* 서랍 · 로그인 / 가입 승인 / 관리자 화면 (Supabase) */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = () => document.getElementById('app');
  const cfg = window.GJ_CONFIG || {};
  let sb = null, me = null, prof = null;

  function screen(html) { app().innerHTML = `<div class="gate"><div class="gate-card">${html}</div></div>`; }
  const LOGO = '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" width="28" height="28"><rect x="2.5" y="3" width="21" height="6" rx="1.5"/><rect x="2.5" y="10" width="21" height="6" rx="1.5"/><rect x="2.5" y="17" width="21" height="6" rx="1.5"/><path d="M10.5 6h5M10.5 13h5M10.5 20h5" stroke-linecap="round"/></svg>';
  const head = (t, p) => `<div class="gate-logo">${LOGO}<b>서랍</b></div><h1>${t}</h1><p class="muted">${p || ''}</p>`;

  function showSetup() {
    screen(head('설정이 필요해요', '<code>config.js</code>에 Supabase 주소(URL)와 anon 키를 넣어 주세요.'));
  }

  function showLogin(check, msg, mode) {
    mode = mode || 'login';
    const su = mode === 'signup';
    screen(head(su ? '가입하기' : '로그인', su ? '이메일과 비밀번호(8자 이상)를 정해 주세요. 다음 화면에서 실명을 입력하면 돼요.' : '스터디원만 들어올 수 있어요.') +
      (msg ? `<p class="gate-err">${esc(msg)}</p>` : '') +
      `<form id="g-login"><label class="fld"><span>이메일</span><input id="g-email" type="email" required autocomplete="email" inputmode="email"></label>
      <label class="fld"><span>비밀번호</span><input id="g-pw" type="password" required minlength="8" autocomplete="${su ? 'new-password' : 'current-password'}"></label>
      <button class="btn primary gate-btn" type="submit">${su ? '가입하기' : '로그인'}</button></form>` +
      `<button class="btn gate-link" id="g-mode">${su ? '이미 계정이 있어요 · 로그인' : '처음이에요 · 가입하기'}</button>` +
      (cfg.GOOGLE ? '<button class="btn gate-btn" id="g-google">구글로 계속하기</button>' : ''));
    document.getElementById('g-mode').onclick = () => showLogin(check, '', su ? 'login' : 'signup');
    const gg = document.getElementById('g-google');
    if (gg) gg.onclick = async () => { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); if (error) showLogin(check, error.message, mode); };
    document.getElementById('g-login').onsubmit = async e => {
      e.preventDefault();
      const email = document.getElementById('g-email').value.trim(), password = document.getElementById('g-pw').value;
      e.target.querySelector('button').disabled = true;
      if (su) {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) { showLogin(check, /registered|already/i.test(error.message) ? '이미 가입된 이메일이에요. 로그인해 주세요.' : error.message, 'signup'); return; }
        if (data && data.user && data.user.identities && data.user.identities.length === 0) { showLogin(check, '이미 가입된 이메일이에요. 로그인해 주세요.', 'login'); return; }
        if (!data.session) { showLogin(check, '확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.', 'login'); return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { showLogin(check, '이메일 또는 비밀번호가 맞지 않아요.', 'login'); return; }
      }
      check();
    };
  }

  function showName(check, err) {
    screen(head('가입 신청', `${esc(me.email)} 로 로그인했어요. 스터디 명단에 있는 <b>실명</b>을 입력해 주세요. 명단에 있으면 바로 입장하고, 없으면 관리자 승인을 기다리게 돼요.`) +
      (err ? `<p class="gate-err">${esc(err)}</p>` : '') +
      '<form id="g-form"><label class="fld"><span>이름</span><input id="g-name" required maxlength="20" autocomplete="name" placeholder="예: 홍길동"></label>' +
      '<button class="btn primary gate-btn" type="submit">신청하기</button></form>' +
      '<button class="btn gate-link" id="g-out">다른 계정으로 로그인</button>');
    document.getElementById('g-out').onclick = signOut;
    document.getElementById('g-form').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true;
      const { error } = await sb.rpc('request_access', { p_name: document.getElementById('g-name').value });
      if (error) { showName(check, error.message); return; }
      check();
    };
  }

  function showPending(check, rejected) {
    screen(head(rejected ? '가입이 승인되지 않았어요' : '승인 대기 중', rejected
      ? '관리자에게 문의해 주세요.'
      : `${esc(prof.real_name || '')}님의 가입 신청이 접수됐어요. 관리자가 승인하면 입장할 수 있어요.`) +
      (rejected ? '' : '<button class="btn primary gate-btn" id="g-re">승인 여부 다시 확인</button>') +
      '<button class="btn gate-link" id="g-out">로그아웃</button>');
    document.getElementById('g-out').onclick = signOut;
    const re = document.getElementById('g-re'); if (re) re.onclick = check;
  }

  async function signOut() { try { await sb.auth.signOut(); } catch (e) {} location.reload(); }

  async function start() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || /YOUR_/.test(cfg.SUPABASE_URL) || !window.supabase) { showSetup(); return new Promise(() => {}); }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return new Promise(resolve => {
      const check = async () => {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { showLogin(check); return; }
        me = session.user;
        const { data, error } = await sb.from('profiles').select('*').eq('id', me.id).maybeSingle();
        if (error) { screen(head('불러오지 못했어요', esc(error.message)) + '<button class="btn gate-btn" onclick="location.reload()">다시 시도</button>'); return; }
        if (!data) { showName(check); return; }
        prof = data;
        if (data.status === 'approved') { resolve({ sb, user: me, profile: data }); return; }
        showPending(check, data.status === 'rejected');
      };
      check();
    });
  }

  /* ---------- 관리자 화면 ---------- */
  let tab = 'pending';
  async function openAdmin() {
    let box = document.getElementById('gate-admin');
    if (!box) { box = document.createElement('div'); box.id = 'gate-admin'; document.body.appendChild(box); }
    box.innerHTML = '<div class="scrim"></div><div class="sheet adm"><p class="muted">불러오는 중…</p></div>';
    box.querySelector('.scrim').onclick = () => box.remove();
    const [p, r] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
      sb.from('roster').select('*').order('name')
    ]);
    if (p.error || r.error) { box.querySelector('.sheet').innerHTML = `<p class="gate-err">${esc((p.error || r.error).message)}</p><button class="btn" id="a-x">닫기</button>`; box.querySelector('#a-x').onclick = () => box.remove(); return; }
    const profs = p.data, ros = r.data;
    const byId = Object.fromEntries(profs.map(x => [x.id, x]));
    const pend = profs.filter(x => x.status === 'pending');
    const tabs = [['pending', `승인 대기 ${pend.length}`], ['members', `가입자 ${profs.length}`], ['roster', `자동 승인 명단 ${ros.length}`]];
    let body = '';
    if (tab === 'pending') {
      body = pend.length ? pend.map(x => `<div class="arow"><div><b>${esc(x.real_name)}</b><div class="muted s">${esc(x.email)}${x.google_name ? ' · 구글 이름 ' + esc(x.google_name) : ''}</div></div><div class="sp"></div><button class="btn primary" data-st="approved" data-id="${x.id}">승인</button><button class="btn" data-st="rejected" data-id="${x.id}">거절</button></div>`).join('') : '<p class="muted">대기 중인 신청이 없어요.</p>';
    } else if (tab === 'members') {
      body = profs.map(x => `<div class="arow"><div><b>${esc(x.real_name || '(이름 없음)')}</b>${x.is_admin ? ' <span class="chipd">관리자</span>' : ''}<div class="muted s">${esc(x.email)} · ${x.status === 'approved' ? '승인됨' : x.status === 'pending' ? '대기' : '거절됨'}</div></div><div class="sp"></div>` +
        (x.is_admin ? '' : x.status === 'approved' ? `<button class="btn" data-st="rejected" data-id="${x.id}">접근 차단</button>` : `<button class="btn primary" data-st="approved" data-id="${x.id}">승인</button>`) + '</div>').join('');
    } else {
      body = '<form id="a-add" class="arow"><input id="a-name" placeholder="추가할 이름" maxlength="20" required><button class="btn primary" type="submit">추가</button></form>' +
        ros.map(x => { const c = x.claimed_by ? byId[x.claimed_by] : null; return `<div class="arow"><div><b>${esc(x.name)}</b><div class="muted s">${x.claimed_by ? '가입 완료' + (c ? ' · ' + esc(c.email) : '') : '아직 가입 안 함'}</div></div><div class="sp"></div>` +
          (x.claimed_by ? `<button class="btn" data-reset="${esc(x.name)}">연결 해제</button>` : '') + `<button class="btn" data-del="${esc(x.name)}">삭제</button></div>`; }).join('');
    }
    box.querySelector('.sheet').innerHTML = `<div class="arow"><h2>관리</h2><div class="sp"></div><button class="btn" id="a-x">닫기</button></div>
      <div class="atabs">${tabs.map(([k, l]) => `<button class="btn ${k === tab ? 'primary' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div class="abody">${body}</div>`;
    const redo = () => openAdmin();
    box.querySelector('#a-x').onclick = () => box.remove();
    box.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; redo(); });
    box.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => { b.disabled = true; const { error } = await sb.rpc('admin_set_status', { p_id: b.dataset.id, p_status: b.dataset.st }); if (error) alert(error.message); redo(); });
    box.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => { await sb.from('roster').update({ claimed_by: null, claimed_at: null }).eq('name', b.dataset.reset); redo(); });
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await sb.from('roster').delete().eq('name', b.dataset.del); redo(); });
    const f = box.querySelector('#a-add');
    if (f) f.onsubmit = async e => { e.preventDefault(); const nm = box.querySelector('#a-name').value.replace(/\s+/g, ''); if (nm) { const { error } = await sb.from('roster').insert({ name: nm }); if (error) alert(error.message); } redo(); };
  }

  window.Gate = { start, openAdmin, signOut, get isAdmin() { return !!(prof && prof.is_admin); }, get email() { return me && me.email; }, get name() { return prof && prof.real_name; } };
})();
