import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './routes/RequireAuth';
import LoginPage from './routes/LoginPage';
import RegisterPage from './routes/RegisterPage';
import BoardListPage from './routes/BoardListPage';
import BoardPage from './routes/BoardPage';
import ProfilePage from './routes/ProfilePage';

function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/boards" element={
        <RequireAuth><BoardListPage /></RequireAuth>
      } />
      <Route path="/boards/:boardId" element={
        <RequireAuth><BoardPage /></RequireAuth>
      } />
      <Route path="/profile" element={
        <RequireAuth><ProfilePage /></RequireAuth>
      } />
      <Route path="*" element={<Navigate to="/boards" replace />} />
    </Routes>
  );
}

export default App;
