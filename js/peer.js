// Conexión en vivo con PeerJS (WebRTC) usando el servidor público gratuito de PeerJS.
// - La evaluadora es el "host": su Peer ID es 'ecoe-uan-' + código de 6 caracteres.
// - El estudiante es el "cliente": se conecta al código.
// - Heartbeat cada 5 s, estado verde/amarillo/rojo, reconexión automática.
const PREFIX = 'ecoe-uan-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I
const HEARTBEAT_MS = 5000;
// STUN + TURN (relay) para redes con NAT estricto (tablets en otra red, datos móviles, Wi-Fi institucional)
const PEER_OPTS = {
  debug: 1,
  config: {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
      { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
};
export const DIAG = { log: [] };
function diag(m) { DIAG.log.push(new Date().toLocaleTimeString() + ' ' + m); if (DIAG.log.length > 30) DIAG.log.shift(); }
export function webrtcSupport() {
  return { rtc: typeof RTCPeerConnection !== 'undefined', peerjs: typeof Peer !== 'undefined', online: navigator.onLine, ua: navigator.userAgent };
}

export function newCode() {
  let s = '';
  const rnd = (n) => (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(1))[0] % n : Math.floor(Math.random() * n);
  for (let i = 0; i < 6; i++) s += ALPHABET[rnd(ALPHABET.length)];
  return s;
}
export function normalizeCode(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export class Link {
  /**
   * @param {'host'|'client'} role
   * @param {{code:string, onMessage:(msg)=>void, onStatus:(s)=>void, onConnect?:()=>void, pingExtra?:()=>object}} o
   */
  constructor(role, o) {
    this.role = role; this.code = o.code; this.o = o;
    this.peer = null; this.conn = null; this.lastSeen = 0; this.queue = [];
    this.status = 'red'; this.detail = 'Iniciando…';
    this.closed = false; this.retries = 0;
    this._hb = setInterval(() => this._heartbeat(), HEARTBEAT_MS);
    this._st = setInterval(() => this._updateStatus(), 1000);
    this._online = () => { if (this.role === 'client') this._reconnectSoon(500); else this._ensurePeer(); };
    window.addEventListener('online', this._online);
    this._start();
  }

  get peerId() { return PREFIX + this.code; }

  _start() {
    if (typeof Peer === 'undefined') { this._setDetail('PeerJS no cargó (sin internet o bloqueado). Se sigue trabajando sin conexión.'); return; }
    if (typeof RTCPeerConnection === 'undefined') { this._setDetail('Este navegador no soporta WebRTC. Use Chrome o Safari actualizados (no el navegador de una app).'); return; }
    if (this.role === 'host') this._startHost(); else this._startClient();
  }

  _setDetail(d) { this.detail = d; diag(d); this._updateStatus(true); }

  _startHost() {
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* */ }
    const peer = new Peer(this.peerId, PEER_OPTS);
    this.peer = peer;
    peer.on('open', () => { this.retries = 0; this._setDetail('Esperando al estudiante…'); });
    peer.on('connection', (c) => this._attach(c));
    peer.on('disconnected', () => { this._setDetail('Reconectando con el servidor…'); setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* */ } }, 1500); });
    peer.on('error', (err) => {
      const t = err && err.type;
      if (t === 'unavailable-id') { this._setDetail('Recuperando el código…'); setTimeout(() => this._startHost(), 3000); }
      else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(t)) { this._setDetail('Sin conexión con el servidor; reintentando…'); setTimeout(() => this._ensurePeer(), 4000); }
      else { console.warn('peer error', t, err); this._setDetail('Error: ' + t); }
    });
  }

  _ensurePeer() {
    if (this.closed) return;
    if (!this.peer || this.peer.destroyed) return this._start();
    if (this.peer.disconnected) { try { this.peer.reconnect(); } catch (e) { this._start(); } }
  }

  _startClient() {
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* */ }
    const peer = new Peer(PEER_OPTS);
    this.peer = peer;
    peer.on('open', () => this._connect());
    peer.on('disconnected', () => { setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { /* */ } }, 1500); });
    peer.on('error', (err) => {
      const t = err && err.type;
      if (t === 'peer-unavailable') { this._setDetail('No se encuentra la estación. Verifique el código; reintentando…'); this._reconnectSoon(4000); }
      else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(t)) { this._setDetail('Sin conexión; reintentando…'); setTimeout(() => this._startClient(), 4000); }
      else { console.warn('peer error', t, err); this._setDetail('Error de conexión: ' + (t || err) + '; reintentando…'); this._reconnectSoon(4000); }
    });
  }

  _connect() {
    if (this.closed || !this.peer || this.peer.destroyed) return;
    if (this.peer.disconnected) { try { this.peer.reconnect(); } catch (e) { /* */ } return this._reconnectSoon(2000); }
    this._setDetail('Servidor OK. Abriendo canal con la evaluadora…');
    const c = this.peer.connect(this.peerId, { reliable: true, serialization: 'json' });
    this._attach(c);
    clearTimeout(this._ct);
    this._ct = setTimeout(() => {
      if (c.open) return;
      this._setDetail('El servidor encuentra la estación pero la red no deja abrir el canal directo. Reintentando… (si persiste: conecte la tablet y el PC a la MISMA red Wi-Fi o use datos móviles)');
      try { c.close(); } catch (e) { /* */ }
      this._reconnectSoon(1000);
    }, 15000);
  }

  _reconnectSoon(ms) {
    if (this.closed) return;
    clearTimeout(this._rt);
    this._rt = setTimeout(() => {
      if (this.conn && this.conn.open) return;
      if (!this.peer || this.peer.destroyed) this._startClient(); else this._connect();
    }, ms);
  }

  _attach(c) {
    // Un solo canal activo: el nuevo reemplaza al anterior
    if (this.conn && this.conn !== c) { try { this.conn.close(); } catch (e) { /* */ } }
    this.conn = c;
    c.on('open', () => {
      this.lastSeen = Date.now(); this.retries = 0;
      this._setDetail('Conectado');
      const q = this.queue; this.queue = [];
      q.forEach(m => this.send(m));
      this.o.onConnect && this.o.onConnect();
    });
    c.on('data', (msg) => {
      this.lastSeen = Date.now();
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ping') { this._send({ type: 'pong', ts: msg.ts }); if (msg.extra) this.o.onMessage({ type: 'heartbeat', ...msg.extra }); return; }
      if (msg.type === 'pong') return;
      this.o.onMessage(msg);
    });
    c.on('close', () => {
      if (this.conn === c) { this._setDetail(this.role === 'host' ? 'El estudiante se desconectó; esperando…' : 'Conexión perdida; reconectando…'); }
      if (this.role === 'client') this._reconnectSoon(2500);
    });
    c.on('error', () => { if (this.role === 'client') this._reconnectSoon(3000); });
  }

  _send(msg) {
    try { if (this.conn && this.conn.open) { this.conn.send(msg); return true; } } catch (e) { /* */ }
    return false;
  }

  /** Envía; si no hay conexión y queue=true, lo guarda para cuando se reconecte. */
  send(msg, queue = false) {
    const ok = this._send(msg);
    if (!ok && queue) { this.queue.push(msg); if (this.queue.length > 50) this.queue.shift(); }
    return ok;
  }

  _heartbeat() {
    if (this.closed) return;
    const extra = this.o.pingExtra ? this.o.pingExtra() : null;
    this._send({ type: 'ping', ts: Date.now(), extra });
    // Cliente: si el canal parece muerto, reconecta
    if (this.role === 'client' && this.conn && this.conn.open && Date.now() - this.lastSeen > 20000) {
      try { this.conn.close(); } catch (e) { /* */ }
      this._reconnectSoon(500);
    }
    if (this.role === 'client' && (!this.conn || !this.conn.open)) this._reconnectSoon(1000);
    if (this.role === 'host') this._ensurePeer();
  }

  _updateStatus(force) {
    let s = 'red';
    const open = this.conn && this.conn.open;
    const age = Date.now() - this.lastSeen;
    if (open && age < 8000) s = 'green';
    else if (open && age < 16000) s = 'yellow';
    else if (!open && this.peer && this.peer.open && this.role === 'host') s = 'yellow';
    if (s !== this.status || force) {
      this.status = s;
      this.o.onStatus && this.o.onStatus({ status: s, detail: s === 'green' ? 'Conectado' : this.detail, connected: !!open });
    }
  }

  get connected() { return !!(this.conn && this.conn.open); }

  close() {
    this.closed = true;
    clearInterval(this._hb); clearInterval(this._st); clearTimeout(this._rt);
    window.removeEventListener('online', this._online);
    try { this.conn && this.conn.close(); } catch (e) { /* */ }
    try { this.peer && this.peer.destroy(); } catch (e) { /* */ }
  }
}
