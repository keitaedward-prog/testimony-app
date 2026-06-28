// app/admin/dashboard/components/UsersManagement.js
"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  doc,
  deleteDoc,
  setDoc,
  updateDoc 
} from 'firebase/firestore';
import { logAdminAction } from '@/lib/auditLogger';
import { useAuth } from '@/lib/useAuth';

export default function UsersManagement() {
  const { adminRole } = useAuth(); // only admin can change roles
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(null); // { user, currentRole }
  const [selectedRole, setSelectedRole] = useState('user');
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: 'default123',
    role: 'user', // default
    isActive: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = users.filter(user => 
        user.firstName?.toLowerCase().includes(term) ||
        user.lastName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.phone?.toLowerCase().includes(term) ||
        user.uid?.toLowerCase().includes(term)
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const usersSnapshot = await getDocs(usersQuery);
      const usersArray = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersArray.push({ id: doc.id, ...data });
      });
      
      // Get admins with role
      const adminsQuery = query(collection(db, 'admins'));
      const adminsSnapshot = await getDocs(adminsQuery);
      const adminMap = {};
      adminsSnapshot.forEach((doc) => {
        const data = doc.data();
        adminMap[doc.id] = data.role || 'admin';
      });
      
      const usersWithRole = usersArray.map(user => ({
        ...user,
        role: adminMap[user.uid] || adminMap[user.id] || 'user'
      }));
      
      setUsers(usersWithRole);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!newUser.firstName || !newUser.phone || !newUser.password) {
        alert('First name, phone, and password are required');
        setLoading(false);
        return;
      }
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('You are not authenticated as admin');
        setLoading(false);
        return;
      }
      const idToken = await currentUser.getIdToken();

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');
      alert(`User "${newUser.firstName}" created successfully!`);
      await logAdminAction('create_user', 'user', data.uid, { ...newUser });
      setShowAddUser(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: 'default123',
        role: 'user',
        isActive: true
      });
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert(`Failed to create user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId, userPhone, userName) => {
    const newPassword = prompt(`Enter new password for ${userName || userPhone}:`, '');
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    setResettingPassword(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('You must be logged in as admin');
        return;
      }
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: userId, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password');
      alert(`✅ Password for ${userName || userPhone} has been reset.`);
      await logAdminAction('reset_password', 'user', userId, { userPhone, userName });
    } catch (error) {
      console.error(error);
      alert(`❌ Failed to reset password: ${error.message}`);
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUser = async (userId, userUid, userData) => {
    if (!confirm(`Delete user ${userData.firstName} ${userData.lastName || ''}?`)) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', userId));
      try {
        await deleteDoc(doc(db, 'admins', userUid));
      } catch (e) {}
      alert('User deleted from database.');
      await logAdminAction('delete_user', 'user', userUid, { ...userData });
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert('Failed to delete user.');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Open role change modal
  const openRoleModal = (user) => {
    setShowRoleModal(user);
    setSelectedRole(user.role || 'user');
  };

  // NEW: Save role change
  const saveRoleChange = async () => {
    if (!showRoleModal) return;
    const user = showRoleModal;
    try {
      if (selectedRole === 'user') {
        // Remove from admins
        await deleteDoc(doc(db, 'admins', user.id));
      } else {
        // Add or update admin doc with role
        const adminData = {
          uid: user.id,
          email: user.email || '',
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName || '',
          role: selectedRole,
          addedAt: new Date(),
          addedBy: auth.currentUser?.uid
        };
        await setDoc(doc(db, 'admins', user.id), adminData, { merge: true });
      }
      await logAdminAction(
        selectedRole === 'user' ? 'demote_admin' : 'promote_admin',
        'user',
        user.id,
        { name: `${user.firstName} ${user.lastName}`.trim(), newRole: selectedRole }
      );
      alert(`User role updated to ${selectedRole}`);
      setShowRoleModal(null);
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert('Failed to update role: ' + error.message);
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: 'bg-purple-600',
      field_admin: 'bg-blue-600',
      land_admin: 'bg-green-600',
    };
    return colors[role] || 'bg-gray-600';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch { return 'Invalid date'; }
  };

  if (loading && !showAddUser) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <div>Loading users...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Users Management</h2>
        {/* Only super admin can add users */}
        {adminRole === 'admin' && (
          <button
            onClick={() => setShowAddUser(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            ➕ Add New User
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {filteredUsers.length} of {users.length} users shown
        </p>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add New User</h3>
            <form onSubmit={handleAddUser}>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                  className="col-span-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                  required
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                  className="col-span-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                />
              </div>
              <input
                type="email"
                placeholder="Email (Optional)"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mt-4"
              />
              <input
                type="tel"
                placeholder="Phone Number * (e.g., +232123456789)"
                value={newUser.phone}
                onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mt-4"
                required
              />
              <input
                type="text"
                placeholder="Password *"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mt-4"
                required
              />
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="field_admin">Field Admin</option>
                  <option value="land_admin">Land Admin</option>
                </select>
              </div>
              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newUser.isActive}
                  onChange={(e) => setNewUser({...newUser, isActive: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="isActive" className="text-sm">Active Account</label>
              </div>
              <div className="flex space-x-4 mt-6">
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create User'}
                </button>
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Change Role</h3>
            <p className="mb-2">User: {showRoleModal.firstName} {showRoleModal.lastName}</p>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-4"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="field_admin">Field Admin</option>
              <option value="land_admin">Land Admin</option>
            </select>
            <div className="flex space-x-4">
              <button onClick={saveRoleChange} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg">Save</button>
              <button onClick={() => setShowRoleModal(null)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* User Table */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-medium mb-2">
            {users.length === 0 ? 'No users found' : 'No matching users'}
          </h3>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3">User Info</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{user.firstName} {user.lastName}</div>
                        <div className="text-gray-400 text-xs">ID: {user.uid?.substring(0,8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.email && <div className="text-gray-300">📧 {user.email}</div>}
                    <div className="text-gray-300">📱 {user.phone || 'No phone'}</div>
                  </td>
                  <td className="px-6 py-4">
                    {user.role && user.role !== 'user' ? (
                      <span className={`inline-block px-3 py-1 rounded-full text-xs ${getRoleBadge(user.role)} text-white`}>
                        {user.role.toUpperCase().replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="text-gray-400">User</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {/* Only super admin can reset password, change role, delete */}
                      {adminRole === 'admin' && (
                        <>
                          <button
                            onClick={() => handleResetPassword(user.uid || user.id, user.phone, `${user.firstName} ${user.lastName}`.trim())}
                            disabled={resettingPassword}
                            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs disabled:opacity-50"
                          >
                            Reset Pass
                          </button>
                          <button
                            onClick={() => openRoleModal(user)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          >
                            Change Role
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.uid, user)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {adminRole !== 'admin' && (
                        <span className="text-xs text-gray-400">Read-only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}