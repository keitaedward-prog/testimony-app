// app/admin/dashboard/components/AdminSidebar.js - UPDATED (NEW MENU ITEMS)
export default function AdminSidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'posts', label: '📝 Manage Posts (Testimonies)', icon: '📝' },
    { id: 'landmapping', label: '🗺️ Land Mapping', icon: '🗺️' },
    { id: 'elearning', label: '📚 E‑Learning', icon: '📚' },
    { id: 'users', label: '👥 Manage Users', icon: '👥' },
    { id: 'reports', label: '📈 Reports', icon: '📈' },
    { id: 'audit', label: '📋 Audit Logs', icon: '📋' },
    { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 min-h-screen p-4">
      <nav className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeTab === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      
      {/* Quick Actions section has been removed */}
      
      {/* Optional: You can add other information here if needed */}
      <div className="mt-8 p-4 bg-gray-900/50 rounded-lg">
        <h3 className="font-bold mb-2">ℹ️ Information</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>Total Posts: Loading...</p>
          <p>Pending Reviews: Loading...</p>
          <p>Total Users: Loading...</p>
        </div>
      </div>
    </aside>
  );
}