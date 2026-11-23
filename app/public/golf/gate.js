/*
 * Mini golf is for signed-in Wichita Life members. This page is on the same site as the Wichita Life
 * website, so a member signed in there is signed in here too. Anyone else gets a card over the course that
 * sends them to sign in and then straight back to this hole. Load it after the page has built its stage.
 */
(() => {
  'use strict';
  const KEY = 'sb-rbxmzybuduluzpvtgfil-auth-token';
  let signedIn = false;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    signedIn = Boolean(s && s.refresh_token);
  } catch {
    signedIn = false;
  }
  if (signedIn) return;

  const path = location.pathname.replace(/\/$/, '') || '/golf';
  const href = `/sign-in?next=${encodeURIComponent(path)}&reason=${encodeURIComponent('Sign in to play mini golf')}`;
  const style = document.createElement('style');
  style.textContent = `
    #gate { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center;
      padding: 18px; background: rgba(21, 41, 74, .72); }
    #gate .card { text-align: center; }
    #gate .copy { margin: 6px 0 16px; font-size: 15px; line-height: 1.45; }
    #gate .btn { width: 100%; }
    #gate .soon a { color: inherit; font-weight: 700; }`;
  document.head.appendChild(style);

  const show = () => {
    const stage = document.getElementById('stage');
    if (!stage || document.getElementById('gate')) return;
    const gate = document.createElement('div');
    gate.id = 'gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-labelledby', 'gate-title');
    gate.innerHTML = `
      <div class="card">
        <h2 id="gate-title">⛳ Sign in to play</h2>
        <p class="copy">Wichita Mini Golf is free for Wichita Life members. Sign in to play all 9 holes and get on the leaderboard. It takes 10 seconds with Google or your email.</p>
        <div class="btns"><a class="btn primary" href="${href}">Sign in to play</a></div>
        <p class="soon"><a href="/">Back to Wichita Life</a></p>
      </div>`;
    stage.appendChild(gate);
    const tip = document.getElementById('tip');
    if (tip) tip.style.display = 'none';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
