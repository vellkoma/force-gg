/**
 * レンダラープロセス エントリポイント（オーバーレイウィンドウ）
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { OverlayPage } from './pages/OverlayPage'
import './styles/globals.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root 要素が見つかりません')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OverlayPage />
  </React.StrictMode>
)
