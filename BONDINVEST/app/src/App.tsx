import { Route, Routes } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { GoalDetails } from './components/GoalDetails';
import { HistoryPage } from './components/HistoryPage';

export function App() {
  return (
    <main className="min-h-screen bg-surface">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/goal/:id" element={<GoalDetails />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route
          path="*"
          element={
            <div className="mx-auto max-w-3xl px-4 py-16 text-center">
              <h1 className="text-2xl font-bold text-ink">Страница не найдена</h1>
            </div>
          }
        />
      </Routes>
    </main>
  );
}
