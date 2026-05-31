import { v4 as uuidv4 } from 'uuid';
import { buildInitialState } from '../seed';

const STORAGE_KEY = 'kanban_db';
const LATENCY_MS  = 150;

// ─── persistence ──────────────────────────────────────────────────────────────

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function save(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  // broadcast to other tabs so they can reconcile
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
}

function getDb() {
  return load() ?? buildInitialState();
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function delay() {
  return new Promise(resolve => setTimeout(resolve, LATENCY_MS));
}

function isMember(db, boardId, userId) {
  return db.boardMembers.some(m => m.boardId === boardId && m.userId === userId);
}

function isOwner(db, boardId, userId) {
  return db.boardMembers.some(m => m.boardId === boardId && m.userId === userId && m.role === 'owner');
}

function assertMember(db, boardId, userId) {
  if (!isMember(db, boardId, userId)) throw Object.assign(new Error('Forbidden'), { status: 403 });
}

function assertOwner(db, boardId, userId) {
  if (!isOwner(db, boardId, userId)) throw Object.assign(new Error('Forbidden'), { status: 403 });
}

// forced-failure toggle (dev/demo)
let forceFailNext = false;
export function setForceFailNext(val) { forceFailNext = val; }

function maybeForceError() {
  if (!forceFailNext) return;
  forceFailNext = false;
  throw Object.assign(new Error('Simulated failure'), { status: 500 });
}

// ─── users ────────────────────────────────────────────────────────────────────

export async function getUsers() {
  await delay();
  const db = getDb();
  return db.users.map(({ id, email, displayName }) => ({ id, email, displayName }));
}

// ─── boards ───────────────────────────────────────────────────────────────────

export async function getBoards(userId) {
  await delay();
  const db = getDb();
  const memberBoardIds = new Set(
    db.boardMembers.filter(m => m.userId === userId).map(m => m.boardId)
  );
  return db.boards.filter(b => memberBoardIds.has(b.id));
}

export async function getBoard(boardId, userId) {
  await delay();
  const db = getDb();
  assertMember(db, boardId, userId);
  const board   = db.boards.find(b => b.id === boardId);
  if (!board) throw Object.assign(new Error('Not found'), { status: 404 });
  const columns = db.columns.filter(c => c.boardId === boardId).sort((a, b) => a.position - b.position);
  const cards   = db.cards.filter(c => columns.some(col => col.id === c.columnId)).sort((a, b) => a.position - b.position);
  const labels  = db.labels.filter(l => l.boardId === boardId);
  const members = db.boardMembers.filter(m => m.boardId === boardId).map(m => ({
    ...m,
    user: db.users.find(u => u.id === m.userId),
  }));
  const cardLabels = db.cardLabels.filter(cl => cards.some(c => c.id === cl.cardId));
  return { board, columns, cards, labels, members, cardLabels };
}

export async function createBoard(userId, { name }) {
  await delay();
  maybeForceError();
  const db = getDb();
  const board = { id: uuidv4(), name, ownerId: userId };
  db.boards.push(board);
  db.boardMembers.push({ boardId: board.id, userId, role: 'owner' });
  save(db);
  return board;
}

export async function patchBoard(boardId, userId, patch) {
  await delay();
  maybeForceError();
  const db = getDb();
  assertMember(db, boardId, userId);
  const board = db.boards.find(b => b.id === boardId);
  if (!board) throw Object.assign(new Error('Not found'), { status: 404 });
  if (patch.name !== undefined) board.name = patch.name;
  save(db);
  return board;
}

export async function deleteBoard(boardId, userId) {
  await delay();
  maybeForceError();
  const db = getDb();
  assertOwner(db, boardId, userId);
  const columnIds = db.columns.filter(c => c.boardId === boardId).map(c => c.id);
  db.cards       = db.cards.filter(c => !columnIds.includes(c.columnId));
  db.cardLabels  = db.cardLabels.filter(cl => !db.cards.some(c => c.id === cl.cardId));
  db.columns     = db.columns.filter(c => c.boardId !== boardId);
  db.labels      = db.labels.filter(l => l.boardId !== boardId);
  db.boardMembers = db.boardMembers.filter(m => m.boardId !== boardId);
  db.boards      = db.boards.filter(b => b.id !== boardId);
  save(db);
}

// ─── members ──────────────────────────────────────────────────────────────────

export async function addMember(boardId, userId, { email }) {
  await delay();
  maybeForceError();
  const db = getDb();
  assertOwner(db, boardId, userId);
  const invitee = db.users.find(u => u.email === email);
  if (!invitee) throw Object.assign(new Error('User not found'), { status: 404 });
  if (isMember(db, boardId, invitee.id)) return;
  db.boardMembers.push({ boardId, userId: invitee.id, role: 'member' });
  save(db);
}

export async function removeMember(boardId, userId, { memberId }) {
  await delay();
  maybeForceError();
  const db = getDb();
  assertOwner(db, boardId, userId);
  db.boardMembers = db.boardMembers.filter(
    m => !(m.boardId === boardId && m.userId === memberId && m.role !== 'owner')
  );
  save(db);
}

// ─── columns ──────────────────────────────────────────────────────────────────

export async function createColumn(boardId, userId, { name, position }) {
  await delay();
  maybeForceError();
  const db = getDb();
  assertMember(db, boardId, userId);
  const col = { id: uuidv4(), boardId, name, position };
  db.columns.push(col);
  save(db);
  return col;
}

export async function patchColumn(columnId, userId, patch) {
  await delay();
  maybeForceError();
  const db  = getDb();
  const col = db.columns.find(c => c.id === columnId);
  if (!col) throw Object.assign(new Error('Not found'), { status: 404 });
  assertMember(db, col.boardId, userId);
  if (patch.name     !== undefined) col.name     = patch.name;
  if (patch.position !== undefined) col.position = patch.position;
  save(db);
  return col;
}

export async function deleteColumn(columnId, userId) {
  await delay();
  maybeForceError();
  const db  = getDb();
  const col = db.columns.find(c => c.id === columnId);
  if (!col) throw Object.assign(new Error('Not found'), { status: 404 });
  assertMember(db, col.boardId, userId);
  const cardIds = db.cards.filter(c => c.columnId === columnId).map(c => c.id);
  db.cardLabels = db.cardLabels.filter(cl => !cardIds.includes(cl.cardId));
  db.cards      = db.cards.filter(c => c.columnId !== columnId);
  db.columns    = db.columns.filter(c => c.id !== columnId);
  save(db);
}

// ─── cards ────────────────────────────────────────────────────────────────────

export async function createCard(columnId, userId, { title, position }) {
  await delay();
  maybeForceError();
  const db  = getDb();
  const col = db.columns.find(c => c.id === columnId);
  if (!col) throw Object.assign(new Error('Not found'), { status: 404 });
  assertMember(db, col.boardId, userId);
  const card = { id: uuidv4(), columnId, title, description: '', assigneeId: null, dueDate: null, position };
  db.cards.push(card);
  save(db);
  return card;
}

export async function patchCard(cardId, userId, patch) {
  await delay();
  maybeForceError();
  const db   = getDb();
  const card = db.cards.find(c => c.id === cardId);
  if (!card) throw Object.assign(new Error('Not found'), { status: 404 });
  const col  = db.columns.find(c => c.id === card.columnId);
  assertMember(db, col.boardId, userId);
  const allowed = ['title', 'description', 'assigneeId', 'dueDate'];
  for (const key of allowed) {
    if (patch[key] !== undefined) card[key] = patch[key];
  }
  save(db);
  return card;
}

export async function moveCard(cardId, userId, { columnId, position }) {
  await delay();
  maybeForceError();
  const db   = getDb();
  const card = db.cards.find(c => c.id === cardId);
  if (!card) throw Object.assign(new Error('Not found'), { status: 404 });
  const col  = db.columns.find(c => c.id === columnId);
  if (!col) throw Object.assign(new Error('Not found'), { status: 404 });
  assertMember(db, col.boardId, userId);
  card.columnId = columnId;
  card.position = position;
  save(db);
  return card;
}

export async function deleteCard(cardId, userId) {
  await delay();
  maybeForceError();
  const db   = getDb();
  const card = db.cards.find(c => c.id === cardId);
  if (!card) throw Object.assign(new Error('Not found'), { status: 404 });
  const col  = db.columns.find(c => c.id === card.columnId);
  assertMember(db, col.boardId, userId);
  db.cardLabels = db.cardLabels.filter(cl => cl.cardId !== cardId);
  db.cards      = db.cards.filter(c => c.id !== cardId);
  save(db);
}

// ─── labels ───────────────────────────────────────────────────────────────────

export async function createLabel(boardId, userId, { name, color }) {
  await delay();
  maybeForceError();
  const db = getDb();
  assertMember(db, boardId, userId);
  const label = { id: uuidv4(), boardId, name, color };
  db.labels.push(label);
  save(db);
  return label;
}

export async function patchLabel(labelId, userId, patch) {
  await delay();
  maybeForceError();
  const db    = getDb();
  const label = db.labels.find(l => l.id === labelId);
  if (!label) throw Object.assign(new Error('Not found'), { status: 404 });
  assertMember(db, label.boardId, userId);
  if (patch.name  !== undefined) label.name  = patch.name;
  if (patch.color !== undefined) label.color = patch.color;
  save(db);
  return label;
}

export async function deleteLabel(labelId, userId) {
  await delay();
  maybeForceError();
  const db    = getDb();
  const label = db.labels.find(l => l.id === labelId);
  if (!label) throw Object.assign(new Error('Not found'), { status: 404 });
  assertMember(db, label.boardId, userId);
  db.cardLabels = db.cardLabels.filter(cl => cl.labelId !== labelId);
  db.labels     = db.labels.filter(l => l.id !== labelId);
  save(db);
}

export async function attachLabel(cardId, labelId, userId) {
  await delay();
  maybeForceError();
  const db   = getDb();
  const card = db.cards.find(c => c.id === cardId);
  if (!card) throw Object.assign(new Error('Not found'), { status: 404 });
  const col  = db.columns.find(c => c.id === card.columnId);
  assertMember(db, col.boardId, userId);
  if (!db.cardLabels.some(cl => cl.cardId === cardId && cl.labelId === labelId)) {
    db.cardLabels.push({ cardId, labelId });
    save(db);
  }
}

export async function detachLabel(cardId, labelId, userId) {
  await delay();
  maybeForceError();
  const db   = getDb();
  const card = db.cards.find(c => c.id === cardId);
  if (!card) throw Object.assign(new Error('Not found'), { status: 404 });
  const col  = db.columns.find(c => c.id === card.columnId);
  assertMember(db, col.boardId, userId);
  db.cardLabels = db.cardLabels.filter(cl => !(cl.cardId === cardId && cl.labelId === labelId));
  save(db);
}
