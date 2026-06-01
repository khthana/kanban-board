// API client — real fetch backend (PRD §3.7)
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// ── token storage ────────────────────────────────────────────────────────────

const TOKEN_KEY = 'kanban_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

// ── core fetch helper ────────────────────────────────────────────────────────

async function apiFetch(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw Object.assign(new Error('Session expired'), { status: 401 });
  }

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  }
  return data;
}

// ── shape normalizers ────────────────────────────────────────────────────────

function normalizeCard(c) {
  return {
    id: c.id,
    columnId: c.column_id,
    title: c.title,
    description: c.description ?? '',
    assigneeId: c.assignee_id ?? null,
    dueDate: c.due_date ?? null,
    position: c.position,
  };
}

function normalizeBoard(raw) {
  // raw.columns is nested: [{...col, cards: [{...card, label_ids: [...]}]}]
  const columns = (raw.columns ?? []).map(col => ({
    id: col.id,
    boardId: raw.id,
    name: col.name,
    position: col.position,
  }));

  const cards = [];
  const cardLabels = [];
  for (const col of raw.columns ?? []) {
    for (const c of col.cards ?? []) {
      cards.push(normalizeCard(c));
      for (const labelId of c.label_ids ?? []) {
        cardLabels.push({ cardId: c.id, labelId });
      }
    }
  }

  const labels = (raw.labels ?? []).map(l => ({
    id: l.id,
    boardId: raw.id,
    name: l.name,
    color: l.color,
  }));

  const board = {
    id: raw.id,
    name: raw.name,
    ownerId: raw.owner_id,
  };

  const members = raw.members ?? [];

  return { board, columns, cards, labels, members, cardLabels };
}

// ── auth ─────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const data = await apiFetch('POST', '/auth/login', { email, password });
  setToken(data.token);
  return data;
}

export async function register(email, password, displayName) {
  const data = await apiFetch('POST', '/auth/register', { email, password, displayName });
  setToken(data.token);
  return data;
}

// ── boards ───────────────────────────────────────────────────────────────────

export const getBoards  = ()              => apiFetch('GET',    '/boards');
export const createBoard  = (_uid, data)  => apiFetch('POST',   '/boards', data);
export const patchBoard   = (id, _uid, p) => apiFetch('PATCH',  `/boards/${id}`, p);
export const deleteBoard  = (id)          => apiFetch('DELETE', `/boards/${id}`);

export async function getBoard(boardId) {
  const raw = await apiFetch('GET', `/boards/${boardId}`);
  return normalizeBoard(raw);
}

// ── members ──────────────────────────────────────────────────────────────────

export const addMember    = (boardId, _uid, data)           => apiFetch('POST',   `/boards/${boardId}/members`, data);
export const removeMember = (boardId, _uid, { memberId })   => apiFetch('DELETE', `/boards/${boardId}/members/${memberId}`);

// ── columns ──────────────────────────────────────────────────────────────────

export const createColumn = (boardId, _uid, data)   => apiFetch('POST',   `/boards/${boardId}/columns`, data);
export const patchColumn  = (id, _uid, patch)       => apiFetch('PATCH',  `/columns/${id}`, patch);
export const deleteColumn = (id)                    => apiFetch('DELETE', `/columns/${id}`);

// ── cards ────────────────────────────────────────────────────────────────────

export const createCard = (columnId, _uid, data)    => apiFetch('POST',   `/columns/${columnId}/cards`, data);
export const deleteCard = (id)                      => apiFetch('DELETE', `/cards/${id}`);

export async function patchCard(cardId, _uid, patch) {
  const raw = await apiFetch('PATCH', `/cards/${cardId}`, patch);
  return raw ? normalizeCard(raw) : null;
}

export async function moveCard(cardId, _uid, { columnId, position }) {
  const raw = await apiFetch('PATCH', `/cards/${cardId}`, { column_id: columnId, position });
  return raw ? normalizeCard(raw) : null;
}

// ── labels ───────────────────────────────────────────────────────────────────

export const createLabel  = (boardId, _uid, data)          => apiFetch('POST',   `/boards/${boardId}/labels`, data);
export const patchLabel   = (id, _uid, patch)              => apiFetch('PATCH',  `/labels/${id}`, patch);
export const deleteLabel  = (id)                           => apiFetch('DELETE', `/labels/${id}`);
export const attachLabel  = (cardId, labelId)              => apiFetch('PUT',    `/cards/${cardId}/labels/${labelId}`);
export const detachLabel  = (cardId, labelId)              => apiFetch('DELETE', `/cards/${cardId}/labels/${labelId}`);

// ── getUsers (removed — real API has no public user list) ────────────────────
export const getUsers = () => Promise.resolve([]);
