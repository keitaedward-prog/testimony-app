// app/admin/dashboard/components/AdminSidebar.js
"use client";

import { FaBars, FaTimes } from 'react-icons/fa';

export default function AdminSidebar({ activeTab, setActiveTab, isOpen, setIsOpen }) {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'posts', label: 'Manage Posts', icon: '📝' },
    { id: 'landmapping', label: 'Land Mapping', icon: '🗺️' },
    { id: 'elearning', label: 'E‑Learning', icon: '📚' },
    { id: 'users', label: 'Manage Users', icon: '👥' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'audit', label: 'Audit Logs', icon: '📋' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const handleItemClick = (id) => {
    setActiveTab(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 h-screen z-40
          w-64 md:w-64
          admin-card border-r admin-border
          p-4 overflow-y-auto
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0 animate-slide-in' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <span className="font-bold admin-text">Menu</span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg admin-text-muted hover:bg-[var(--admin-hover)] transition"
            aria-label="Close menu"
          >
            <FaTimes />
          </button>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all duration-200 text-sm font-medium
                  ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                    : 'admin-text-muted hover:bg-[var(--admin-hover)] hover:translate-x-1'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}