import { apiFetch, setToken, setRefreshToken } from './auth';

// ── shape normalizers ────────────────────────────────────────────────────────

function normalizeCard(c) {
  return {
    id: c.id,
    columnId: c.column_id,
    title: c.title,
    description: c.description ?? '',
    categoryLabelId: c.category_label_id ?? null,
    dueDate: c.due_date ? String(c.due_date).slice(0, 10) : null,
    position: c.position,
    completedAt: c.completed_at ? String(c.completed_at).slice(0, 10) : null,
  };
}

function normalizeSubtask(s) {
  return {
    id: s.id,
    cardId: s.card_id,
    title: s.title,
    checked: s.checked,
    position: s.position,
  };
}

function normalizeBoard(raw) {
  // raw.columns is nested: [{...col, cards: [{...card, label_ids: [...], subtasks: [...]}]}]
  const columns = (raw.columns ?? []).map(col => ({
    id: col.id,
    boardId: raw.id,
    name: col.name,
    position: col.position,
    color: col.color ?? null,
  }));

  const cards = [];
  const cardLabels = [];
  const cardAssignees = [];
  const subtasks = [];
  for (const col of raw.columns ?? []) {
    for (const c of col.cards ?? []) {
      cards.push(normalizeCard(c));
      for (const labelId of c.label_ids ?? []) {
        cardLabels.push({ cardId: c.id, labelId });
      }
      for (const userId of c.assignees ?? []) {
        cardAssignees.push({ cardId: c.id, userId });
      }
      for (const s of c.subtasks ?? []) {
        subtasks.push(normalizeSubtask(s));
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

  return { board, columns, cards, labels, members, cardLabels, cardAssignees, subtasks };
}

// ── auth ─────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const data = await apiFetch('POST', '/auth/login', { email, password });
  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return data;
}

export async function register(email, password, displayName) {
  const data = await apiFetch('POST', '/auth/register', { email, password, displayName });
  setToken(data.token);
  if (data.refreshToken) setRefreshToken(data.refreshToken);
  return data;
}

export const getMe = () => apiFetch('GET', '/auth/me');
export const patchMe = (patch) => apiFetch('PATCH', '/auth/me', patch);
export const patchMePassword = (body) => apiFetch('PATCH', '/auth/me/password', body);

// ── boards ───────────────────────────────────────────────────────────────────

export const getBoards  = ()              =>
  apiFetch('GET', '/boards').then(rows =>
    rows.map(b => ({ id: b.id, name: b.name, ownerId: b.owner_id, createdAt: b.created_at }))
  );
export const createBoard  = (_uid, data)  => apiFetch('POST',   '/boards', data);
export const patchBoard   = (id, _uid, p) => apiFetch('PATCH',  `/boards/${id}`, p)
  .then(b => ({ id: b.id, name: b.name, ownerId: b.owner_id, createdAt: b.created_at }));
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

function cardPatchToApi(patch) {
  const out = {};
  if (patch.title       !== undefined) out.title        = patch.title;
  if (patch.description !== undefined) out.description  = patch.description;
  if (patch.categoryLabelId !== undefined) out.category_label_id = patch.categoryLabelId;
  if (patch.dueDate     !== undefined) out.due_date      = patch.dueDate;
  if (patch.completedAt !== undefined) out.completed_at  = patch.completedAt;
  if (patch.columnId    !== undefined) out.column_id     = patch.columnId;
  if (patch.position    !== undefined) out.position      = patch.position;
  return out;
}

export const createCard = (columnId, _uid, data)    =>
  apiFetch('POST', `/columns/${columnId}/cards`, data).then(normalizeCard);

export const deleteCard = (id)                      => apiFetch('DELETE', `/cards/${id}`);

export async function patchCard(cardId, _uid, patch) {
  const raw = await apiFetch('PATCH', `/cards/${cardId}`, cardPatchToApi(patch));
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
export const attachLabel  = (cardId, labelId, _uid)        => apiFetch('PUT',    `/cards/${cardId}/labels/${labelId}`);
export const detachLabel  = (cardId, labelId, _uid)        => apiFetch('DELETE', `/cards/${cardId}/labels/${labelId}`);

// ── assignees ──────────────────────────────────────────────────────────────────

export const attachAssignee = (cardId, userId) => apiFetch('PUT',    `/cards/${cardId}/assignees/${userId}`);
export const detachAssignee = (cardId, userId) => apiFetch('DELETE', `/cards/${cardId}/assignees/${userId}`);

// ── subtasks ─────────────────────────────────────────────────────────────────

export const createSubtask = (cardId, data)    => apiFetch('POST',   `/cards/${cardId}/subtasks`, data).then(normalizeSubtask);
export const patchSubtask  = (id, patch)       => apiFetch('PATCH',  `/subtasks/${id}`, patch).then(normalizeSubtask);
export const deleteSubtask = (id)              => apiFetch('DELETE', `/subtasks/${id}`);
