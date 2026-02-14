// app/admin/dashboard/components/AuditLogs.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import Pagination from '@/app/components/Pagination';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const PAGE_SIZE = 20;

  const fetchLogs = async (loadMore = false) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE)
      );

      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));

      if (loadMore) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleLoadMore = () => {
    fetchLogs(true);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(term) ||
      log.targetType?.toLowerCase().includes(term) ||
      log.targetId?.toLowerCase().includes(term) ||
      log.admin?.email?.toLowerCase().includes(term) ||
      log.admin?.phone?.toLowerCase().includes(term) ||
      JSON.stringify(log.details).toLowerCase().includes(term)
    );
  });

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const getActionBadge = (action) => {
    const colors = {
      create_user: 'bg-green-600',
      reset_password: 'bg-yellow-600',
      promote_admin: 'bg-purple-600',
      demote_admin: 'bg-orange-600',
      delete_user: 'bg-red-600',
      approve_post: 'bg-green-600',
      reject_post: 'bg-red-600',
      delete_post: 'bg-red-600',
    };
    const defaultColor = 'bg-blue-600';
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[action] || defaultColor} text-white`}>
        {action.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Audit Trail</h2>
        <button
          onClick={() => fetchLogs()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Search logs by action, target, admin, details..."
          value={searchTerm}
          onChange={handleSearch}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-sm text-gray-400 mt-2">
          Showing {filteredLogs.length} of {logs.length} logs
        </p>
      </div>

      {loading && logs.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <div className="mt-4">Loading audit logs...</div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-medium mb-2">No logs found</h3>
          <p>{searchTerm ? 'Try a different search term' : 'No admin actions have been logged yet.'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Admin</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Target</th>
                  <th className="px-6 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-300">
                        {log.admin?.email || log.admin?.phone || log.admin?.uid?.substring(0, 8)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {log.admin?.uid?.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-gray-400">{log.targetType}:</span>
                        <span className="ml-1 font-mono text-xs text-gray-300">
                          {log.targetId?.substring(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap max-w-xs">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load More */}
          {hasMore && !searchTerm && (
            <div className="text-center mt-8">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}