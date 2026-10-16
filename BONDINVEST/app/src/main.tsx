/**
 * main.tsx — точка входа приложения (bootstrap).
 * Логика сборки дерева провайдеров снизу вверх:
 * 1. React.StrictMode — включает удвоенные вызовы в dev-режиме для поиска сайд-эффектов;
 * 2. QueryClientProvider — даёт всему дереву доступ к кэшу React Query;
 *    staleTime 60s: данные считаются свежими минуту, повторные заходы на
 *    страницы не дёргают «сеть» (мок); refetchOnWindowFocus отключён, чтобы
 *    демо не перерисовывалось при каждом фокусе окна;
 * 3. BrowserRouter — history-API роутинг (URL → компонент страницы);
 * 4. App — таблица маршрутов.
 * index.css подключается здесь, чтобы Vite собрал Tailwind-стили в единый CSS-бандл.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './index.css';

/** Единый экземпляр клиента кэша на всё приложение (создаётся один раз при старте). */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// «!» после getElementById — гарантируем TypeScript наличие контейнера #root в index.html
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
