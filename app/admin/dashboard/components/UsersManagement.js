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
  setDoc 
} from 'firebase/firestore';
import { logAdminAction } from '@/lib/auditLogger';

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: 'default123',
    isAdmin: false,
    isActive: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users
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
      console.log('🔍 Fetching users...');
      
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const usersSnapshot = await getDocs(usersQuery);
      const usersArray = [];
      
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersArray.push({ 
          id: doc.id, 
          ...data 
        });
      });
      
      // Get admins
      const adminsQuery = query(collection(db, 'admins'));
      const adminsSnapshot = await getDocs(adminsQuery);
      const adminUids = new Set();
      
      adminsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid) {
          adminUids.add(data.uid);
        }
      });
      
      const usersWithAdminStatus = usersArray.map(user => ({
        ...user,
        isAdmin: adminUids.has(user.uid) || adminUids.has(user.id)
      }));
      
      console.log(`✅ Found ${usersWithAdminStatus.length} users`);
      setUsers(usersWithAdminStatus);
      
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      alert('Failed to fetch users. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Handle adding user via server API
  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate input
      if (!newUser.firstName || !newUser.phone) {
        alert('First name and phone number are required');
        setLoading(false);
        return;
      }
      
      if (!newUser.password || newUser.password.length < 6) {
        alert('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      // Get the current admin's ID token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('You are not authenticated as admin');
        setLoading(false);
        return;
      }
      const idToken = await currentUser.getIdToken();

      // Call our server API
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      alert(`User "${newUser.firstName}" created successfully!`);

      // Log the action
      await logAdminAction(
        'create_user',
        'user',
        data.uid,
        {
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          phone: newUser.phone,
          email: newUser.email || null,
          isAdmin: newUser.isAdmin,
        }
      );
      
      // Reset form and refresh
      setShowAddUser(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: 'default123',
        isAdmin: false,
        isActive: true
      });
      
      fetchUsers();
      
    } catch (error) {
      console.error('❌ Error adding user:', error);
      alert(`Failed to create user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Password reset
  const handleResetPassword = async (userId, userPhone, userName) => {
    const newPassword = prompt(`Enter new password for ${userName || userPhone}:`, '');
    
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
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
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }
      
      alert(`✅ Password for ${userName || userPhone} has been reset successfully.`);

      // Log the action
      await logAdminAction(
        'reset_password',
        'user',
        userId,
        { 
          userPhone: userPhone, 
          userName: userName 
        }
      );
      
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(`❌ Failed to reset password: ${error.message}`);
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUser = async (userId, userUid, userData) => {
    if (!confirm(`Are you sure you want to delete user ${userData.firstName} ${userData.lastName || ''}?\n\nNote: This will only delete from the database. Firebase Auth account deletion requires server-side implementation.`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Delete from users collection
      await deleteDoc(doc(db, 'users', userId));
      
      // If user is admin, delete from admins collection
      try {
        await deleteDoc(doc(db, 'admins', userUid));
      } catch (adminError) {
        console.log('User was not an admin or already removed:', adminError);
      }
      
      alert('User deleted from database successfully!');

      // Log the action
      await logAdminAction(
        'delete_user',
        'user',
        userUid,
        { 
          userName: `${userData.firstName} ${userData.lastName || ''}`.trim(),
          phone: userData.phone,
          email: userData.email || null
        }
      );
      
      fetchUsers();
      
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId, userUid, currentStatus, userData) => {
    const action = currentStatus ? 'demote_admin' : 'promote_admin';
    const confirmMsg = currentStatus 
      ? `Remove admin privileges from ${userData.firstName} ${userData.lastName || ''}?`
      : `Make ${userData.firstName} ${userData.lastName || ''} an admin?`;
    
    if (!confirm(confirmMsg)) return;
    
    setLoading(true);
    
    try {
      if (currentStatus) {
        // Remove from admins
        await deleteDoc(doc(db, 'admins', userUid));
        alert(`${userData.firstName} removed from admin role`);
      } else {
        // Add to admins
        const adminData = {
          uid: userUid,
          email: userData.email || '',
          phone: userData.phone,
          firstName: userData.firstName,
          lastName: userData.lastName || '',
          addedAt: new Date(),
          addedBy: auth.currentUser?.uid
        };
        await setDoc(doc(db, 'admins', userUid), adminData);
        alert(`${userData.firstName} promoted to admin`);
      }

      // Log the action
      await logAdminAction(
        action,
        'user',
        userUid,
        { 
          userName: `${userData.firstName} ${userData.lastName || ''}`.trim(),
          phone: userData.phone,
          newStatus: currentStatus ? 'user' : 'admin'
        }
      );
      
      fetchUsers();
      
    } catch (error) {
      console.error('Error updating admin status:', error);
      alert('Failed to update admin status. Check console for details.');
    } finally {
      setLoading(false);
    }
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
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Users Management</h2>
        <button
          onClick={() => setShowAddUser(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          ➕ Add New User
        </button>
      </div>

      {/* 🔍 SEARCH INPUT */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search users by name, email, phone, or ID..."
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
            <h3 className="text-xl font-bold mb-4">Add New User/Admin</h3>
            <form onSubmit={handleAddUser}>
              <div className="space-y-4">
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
                  placeholder="Email (Optional - for email login)"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                />
                
                <div>
                  <input
                    type="tel"
                    placeholder="Phone Number * (e.g., +232123456789)"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Include country code. Will be normalized to + format.
                  </p>
                </div>
                
                <div>
                  <input
                    type="text"
                    placeholder="Password *"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Minimum 6 characters. Default: "default123"
                  </p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isAdmin"
                      checked={newUser.isAdmin}
                      onChange={(e) => setNewUser({...newUser, isAdmin: e.target.checked})}
                      className="mr-2"
                    />
                    <label htmlFor="isAdmin" className="text-sm">
                      Make this user an admin
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={newUser.isActive}
                      onChange={(e) => setNewUser({...newUser, isActive: e.target.checked})}
                      className="mr-2"
                    />
                    <label htmlFor="isActive" className="text-sm">
                      Active Account
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-4 mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && !showAddUser ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div>Loading users...</div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-medium mb-2">
            {users.length === 0 ? 'No users found' : 'No matching users'}
          </h3>
          <p className="mb-6">
            {users.length === 0 
              ? 'Add your first user using the "Add New User" button'
              : 'Try adjusting your search term'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3">User Info</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Status</th>
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
                        <div className="font-medium">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-gray-400 text-xs">
                          ID: {user.uid?.substring(0, 8) || user.id.substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      {user.email && <div className="text-gray-300">📧 {user.email}</div>}
                      <div className="text-gray-300">📱 {user.phone || 'No phone'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {user.isAdmin ? (
                        <span className="inline-block px-3 py-1 bg-purple-600 rounded-full text-xs">
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-gray-600 rounded-full text-xs">
                          USER
                        </span>
                      )}
                      {user.isActive === false && (
                        <span className="inline-block px-2 py-1 bg-red-600 rounded text-xs">
                          INACTIVE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleResetPassword(user.uid || user.id, user.phone, `${user.firstName} ${user.lastName}`.trim())}
                        disabled={resettingPassword}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs disabled:opacity-50"
                      >
                        {resettingPassword ? '...' : 'Reset Pass'}
                      </button>
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.uid, user.isAdmin, user)}
                        className={`px-3 py-1 ${user.isAdmin ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'} rounded text-xs`}
                      >
                        {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.uid, user)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                      >
                        Delete
                      </button>
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