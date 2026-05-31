import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useSession from '../store/useSession';
import useBoardStore from '../store/useBoardStore';
import UserSwitcher from '../components/UserSwitcher';
import { validateBoardName } from '../domain/validation';
import styles from './BoardListPage.module.css';

function CreateBoardForm({ onSubmit }) {
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateBoardName(name);
    if (err) { setValidationError(err); return; }
    setValidationError(null);
    onSubmit(name);
    setName('');
  }

  return (
    <form className={styles.createForm} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        placeholder="New board name…"
        value={name}
        onChange={e => { setName(e.target.value); setValidationError(null); }}
        maxLength={101}
      />
      {validationError && <span className={styles.fieldError}>{validationError}</span>}
      <button className={styles.btn} type="submit">Create Board</button>
    </form>
  );
}

function RenameForm({ board, onSave, onCancel }) {
  const [name, setName] = useState(board.name);
  const [validationError, setValidationError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateBoardName(name);
    if (err) { setValidationError(err); return; }
    onSave(name);
  }

  return (
    <form className={styles.renameForm} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        value={name}
        onChange={e => { setName(e.target.value); setValidationError(null); }}
        autoFocus
        maxLength={101}
      />
      {validationError && <span className={styles.fieldError}>{validationError}</span>}
      <button className={styles.btnSmall} type="submit">Save</button>
      <button className={styles.btnSmall} type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

export default function BoardListPage() {
  const { currentUserId } = useSession();
  const { boards, loading, error, fetchBoards, createBoard, renameBoard, deleteBoard } = useBoardStore();
  const [renamingId, setRenamingId] = useState(null);

  useEffect(() => {
    fetchBoards(currentUserId);
  }, [currentUserId, fetchBoards]);

  async function handleCreate(name) {
    await createBoard(currentUserId, { name });
  }

  async function handleRename(boardId, name) {
    await renameBoard(boardId, currentUserId, { name });
    setRenamingId(null);
  }

  async function handleDelete(boardId) {
    if (!window.confirm('Delete this board? This cannot be undone.')) return;
    await deleteBoard(boardId, currentUserId);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Kanban Board</h1>
        <UserSwitcher />
      </header>

      <main className={styles.main}>
        {error && <p className={styles.error}>{error}</p>}

        <CreateBoardForm onSubmit={handleCreate} />

        {loading && <p className={styles.status}>Loading…</p>}

        {!loading && boards.length === 0 && (
          <p className={styles.empty}>No boards yet. Create one above.</p>
        )}

        {boards.length > 0 && (
          <ul className={styles.list}>
            {boards.map(board => {
              const isOwner = board.ownerId === currentUserId;
              return (
                <li key={board.id} className={styles.item}>
                  {renamingId === board.id ? (
                    <RenameForm
                      board={board}
                      onSave={name => handleRename(board.id, name)}
                      onCancel={() => setRenamingId(null)}
                    />
                  ) : (
                    <div className={styles.row}>
                      <Link to={`/boards/${board.id}`} className={styles.link}>
                        {board.name}
                      </Link>
                      {isOwner && (
                        <div className={styles.actions}>
                          <button
                            className={styles.btnIcon}
                            title="Rename"
                            onClick={() => setRenamingId(board.id)}
                          >
                            ✏️
                          </button>
                          <button
                            className={`${styles.btnIcon} ${styles.btnDanger}`}
                            title="Delete"
                            onClick={() => handleDelete(board.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
