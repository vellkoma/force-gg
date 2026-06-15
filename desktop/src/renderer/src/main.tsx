import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { LcuProvider } from './context/LcuContext'
import { RootLayout } from './layouts/RootLayout'
import { DesktopHomePage } from './pages/DesktopHomePage'
import { MatchHistoryPage } from './pages/MatchHistoryPage'
import { MatchDetailPage } from './pages/MatchDetailPage'
import { ChatPage } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'
import { AccountPage } from './pages/AccountPage'
import { MasteryPage } from './pages/MasteryPage'
import { ChampSelectPage } from './pages/ChampSelectPage'
import { initDdragonVersion, initItemNames } from './utils/ddragon'
import './styles/globals.css'

// DDragon の最新バージョンを非同期で取得し、完了後にアイテム名をプリロード
initDdragonVersion().then(() => initItemNames())

const root = document.getElementById('root')
if (!root) throw new Error('#root 要素が見つかりません')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <LcuProvider>
    <HashRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<DesktopHomePage />} />
          <Route path="matches" element={<MatchHistoryPage />} />
          <Route path="matches/:matchId" element={<MatchDetailPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="mastery" element={<MasteryPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="champ-select" element={<ChampSelectPage />} />
        </Route>
      </Routes>
    </HashRouter>
    </LcuProvider>
  </React.StrictMode>
)
