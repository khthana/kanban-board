// Seed data: seeded identities + "Project Phoenix" board (Approve PRD §4.7)
// IDs are fixed so localStorage state stays stable across hot reloads.

export const SEED_USERS = [
  { id: 'user-alice', email: 'alice@example.com', displayName: 'Alice' },
  { id: 'user-bob',   email: 'bob@example.com',   displayName: 'Bob'   },
  { id: 'user-carol', email: 'carol@example.com', displayName: 'Carol' },
  { id: 'user-dave',  email: 'dave@example.com',  displayName: 'Dave'  },
];

const BOARD_PHOENIX = 'board-phoenix';
const COL_BACKLOG   = 'col-backlog';
const COL_INPROGRESS = 'col-inprogress';
const COL_DONE      = 'col-done';

export const SEED_BOARDS = [
  { id: BOARD_PHOENIX, name: 'Project Phoenix', ownerId: 'user-alice' },
];

export const SEED_BOARD_MEMBERS = [
  { boardId: BOARD_PHOENIX, userId: 'user-alice', role: 'owner'  },
  { boardId: BOARD_PHOENIX, userId: 'user-bob',   role: 'member' },
];

export const SEED_COLUMNS = [
  { id: COL_BACKLOG,    boardId: BOARD_PHOENIX, name: 'Backlog',     position: 1.0 },
  { id: COL_INPROGRESS, boardId: BOARD_PHOENIX, name: 'In Progress', position: 2.0 },
  { id: COL_DONE,       boardId: BOARD_PHOENIX, name: 'Done',        position: 3.0 },
];

export const SEED_CARDS = [
  { id: 'card-1', columnId: COL_BACKLOG,    title: 'Design landing page',      description: '', assigneeId: null, dueDate: null, position: 1.0 },
  { id: 'card-2', columnId: COL_BACKLOG,    title: 'Set up CI/CD pipeline',    description: '', assigneeId: null, dueDate: null, position: 2.0 },
  { id: 'card-3', columnId: COL_INPROGRESS, title: 'Implement auth flow',       description: '', assigneeId: 'user-bob', dueDate: null, position: 1.0 },
  { id: 'card-4', columnId: COL_DONE,       title: 'Project kickoff meeting',  description: '', assigneeId: null, dueDate: null, position: 1.0 },
];

export const SEED_LABELS = [
  { id: 'label-bug',     boardId: BOARD_PHOENIX, name: 'Bug',     color: '#ef4444' },
  { id: 'label-feature', boardId: BOARD_PHOENIX, name: 'Feature', color: '#3b82f6' },
  { id: 'label-urgent',  boardId: BOARD_PHOENIX, name: 'Urgent',  color: '#f97316' },
];

export const SEED_CARD_LABELS = [];

export function buildInitialState() {
  return {
    users:        SEED_USERS,
    boards:       SEED_BOARDS,
    boardMembers: SEED_BOARD_MEMBERS,
    columns:      SEED_COLUMNS,
    cards:        SEED_CARDS,
    labels:       SEED_LABELS,
    cardLabels:   SEED_CARD_LABELS,
  };
}
