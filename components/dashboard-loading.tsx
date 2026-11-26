'use client'

import { useLingui } from '@lingui/react/macro'

export function DashboardLoading() {
  const { t } = useLingui()
  return (
    <div
      className="shell dashboard-skeleton"
      role="status"
      aria-label={t`Loading your vehicle dashboard`}
      aria-busy="true"
    >
      <aside className="sidebar" aria-hidden="true">
        <div className="loading-brand">
          <span className="loading-block loading-brand-mark" />
          <span className="loading-brand-copy">
            <span className="loading-block loading-brand-name" />
            <span className="loading-block loading-brand-caption" />
          </span>
        </div>
        <span className="loading-block loading-nav-label" />
        <span className="loading-block loading-nav-item" />
        <span className="loading-block loading-nav-item" />
        <span className="loading-block loading-nav-item" />
        <div className="sidebar-spacer" />
        <span className="loading-block loading-account" />
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="loading-block loading-crumb" />
          <span className="loading-block loading-action" />
        </header>
        <section className="welcome">
          <div className="loading-welcome-copy">
            <span className="loading-block loading-eyebrow" />
            <span className="loading-block loading-title" />
            <span className="loading-block loading-description" />
          </div>
          <span className="loading-block loading-action" />
        </section>
        <section className="stat-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="stat-card loading-stat" key={index}>
              <span className="loading-block loading-stat-icon" />
              <span className="loading-block loading-stat-label" />
              <span className="loading-block loading-stat-value" />
              <span className="loading-block loading-stat-note" />
            </div>
          ))}
        </section>
        <section className="content-grid" aria-hidden="true">
          <div className="primary-column">
            <div className="loading-section-heading">
              <span className="loading-block loading-heading" />
              <span className="loading-block loading-action" />
            </div>
            <div className="vehicle-list">
              {Array.from({ length: 2 }, (_, index) => (
                <span className="loading-block loading-vehicle" key={index} />
              ))}
            </div>
            <div className="loading-section-heading loading-history-heading">
              <span className="loading-block loading-heading" />
              <span className="loading-block loading-search" />
            </div>
            <span className="loading-block loading-record" />
            <span className="loading-block loading-record" />
          </div>
          <aside className="insight-column">
            <span className="loading-block loading-insight" />
            <span className="loading-block loading-tip" />
          </aside>
        </section>
      </main>
    </div>
  )
}
