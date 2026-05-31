import { Routes, Route, Navigate } from 'react-router-dom';
import BoardListPage from './routes/BoardListPage';
import BoardPage from './routes/BoardPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/boards" element={<BoardListPage />} />
      <Route path="/boards/:boardId" element={<BoardPage />} />
      <Route path="*" element={<Navigate to="/boards" replace />} />
    </Routes>
  );
}

export default App;
