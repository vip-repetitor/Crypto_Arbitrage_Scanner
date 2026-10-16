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
// Публичная SEO-страница: калькулятор сложного процента (главный «трафиковый» роут)
import { CalcPage } from './components/CalcPage';
// Глобальный JSON-LD граф сайта (Organization + WebSite): монтируется один раз
// на уровне приложения, поэтому бренд-панель доступна на всех индексируемых страницах.
import { JsonLd } from './components/JsonLd';
import { organizationSchema, websiteSchema } from './utils/structuredData';

/** Стабильные ссылки на массивы схем — чтобы JsonLd не пересоздавал узлы head
 * при каждом рендере App (зависимость эффекта — сериализация этих объектов). */
const GLOBAL_SCHEMAS = [organizationSchema(), websiteSchema()];

export function App() {
  return (
    <main className="min-h-screen bg-surface">
      <JsonLd schemas={GLOBAL_SCHEMAS} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/goal/:id" element={<GoalDetails />} />
        <Route path="/history" element={<HistoryPage />} />
        {/* Новая страница: статистика доходностей всех участников + лидерборд */}
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        {/* SEO tool page: индексируется отдельно, воронка → / (регистрация) */}
        <Route path="/calc" element={<CalcPage />} />
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
