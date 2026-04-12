/**
 * レンダラープロセス メインエントリポイント（メインウィンドウ）
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { DesktopHomePage } from './pages/DesktopHomePage'
import './styles/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root 要素が見つかりません')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <DesktopHomePage />
  </React.StrictMode>
)
