/**
 * App.tsx — корневой компонент с таблицей маршрутов (роутер «плоский», без layout-вложенности).
 * Маршруты по ТЗ:
 *   /          → Dashboard (главный экран: индекс, цели, транзакции)
 *   /goal/:id  → GoalDetails (детали конкретной цели; id читается через useParams)
 *   /history   → HistoryPage (вся история бонусов с фильтрами и экспортом CSV)
 *   *          → заглушка 404 для несуществующих путей
 * <main> задаёт семантическую landmark-область и фон приложения — важно для скринридеров.
 */
import { Route, Routes } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { GoalDetails } from './components/GoalDetails';
import { HistoryPage } from './components/HistoryPage';
import { LeaderboardPage } from './components/LeaderboardPage';

export function App() {
  return (
    <main className="min-h-screen bg-surface">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/goal/:id" element={<GoalDetails />} />
        <Route path="/history" element={<HistoryPage />} />
        {/* Новая страница: статистика доходностей всех участников + лидерборд */}
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        {/* Фallback: любой неизвестный путь показывает сообщение, а не пустой экран */}
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
