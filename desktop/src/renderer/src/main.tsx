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
import './styles/globals.css'

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
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Routes>
    </HashRouter>
    </LcuProvider>
  </React.StrictMode>
)
