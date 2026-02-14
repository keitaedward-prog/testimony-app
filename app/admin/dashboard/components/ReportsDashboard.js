// app/admin/dashboard/components/ReportsDashboard.js - UPDATED WITH REAL DATA AND EXPORTS
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { FaFileCsv, FaFilePdf, FaDownload, FaChartLine } from 'react-icons/fa';

export default function ReportsDashboard() {
  const [reportData, setReportData] = useState({
    totalPosts: 0,
    approvedPosts: 0,
    pendingPosts: 0,
    rejectedPosts: 0,
    coordinatePosts: 0,
    totalUsers: 0,
    dailyPosts: [],
    postTypes: {},
    userGrowth: []
  });
  const [timeRange, setTimeRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    fetchReportData();
  }, [timeRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch all posts
      const postsQuery = query(collection(db, 'testimonies'), orderBy('createdAt', 'desc'));
      const postsSnapshot = await getDocs(postsQuery);
      
      // Fetch all users
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);

      const posts = [];
      const users = [];
      
      postsSnapshot.forEach(doc => {
        const data = doc.data();
        posts.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        users.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });

      // Calculate statistics
      const totalPosts = posts.length;
      const approvedPosts = posts.filter(p => p.status === 'approved').length;
      const pendingPosts = posts.filter(p => p.status === 'pending').length;
      const rejectedPosts = posts.filter(p => p.status === 'rejected').length;
      const coordinatePosts = posts.filter(p => p.type === 'coordinates').length;
      const totalUsers = users.length;

      // Calculate post types distribution
      const postTypes = {};
      posts.forEach(post => {
        const type = post.type || 'unknown';
        postTypes[type] = (postTypes[type] || 0) + 1;
      });

      // Calculate daily posts for the last 7 days
      const dailyPosts = calculateDailyPosts(posts, timeRange);
      
      // Calculate user growth (last 6 months)
      const userGrowth = calculateUserGrowth(users);

      setReportData({
        totalPosts,
        approvedPosts,
        pendingPosts,
        rejectedPosts,
        coordinatePosts,
        totalUsers,
        dailyPosts,
        postTypes,
        userGrowth
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyPosts = (posts, range) => {
    const now = new Date();
    const days = range === 'week' ? 7 : range === 'month' ? 30 : range === 'quarter' ? 90 : 365;
    
    const result = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const postsOnDay = posts.filter(post => {
        const postDate = post.createdAt;
        return postDate >= date && postDate < nextDay;
      }).length;
      
      result.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        posts: postsOnDay
      });
    }
    
    return result;
  };

  const calculateUserGrowth = (users) => {
    const now = new Date();
    const result = [];
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date();
      month.setMonth(now.getMonth() - i);
      
      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      
      const usersInMonth = users.filter(user => {
        const userDate = user.createdAt;
        return userDate >= startOfMonth && userDate <= endOfMonth;
      }).length;
      
      const cumulativeUsers = users.filter(user => {
        const userDate = user.createdAt;
        return userDate <= endOfMonth;
      }).length;
      
      result.push({
        month: startOfMonth.toLocaleDateString('en-US', { month: 'short' }),
        newUsers: usersInMonth,
        totalUsers: cumulativeUsers
      });
    }
    
    return result;
  };

  const exportToCSV = async () => {
    setExporting('csv');
    try {
      // Create CSV content
      let csvContent = 'data:text/csv;charset=utf-8,';
      
      // Header
      csvContent += 'Report Type,Value\n';
      
      // Basic stats
      csvContent += `Total Posts,${reportData.totalPosts}\n`;
      csvContent += `Approved Posts,${reportData.approvedPosts}\n`;
      csvContent += `Pending Posts,${reportData.pendingPosts}\n`;
      csvContent += `Rejected Posts,${reportData.rejectedPosts}\n`;
      csvContent += `Coordinate Posts,${reportData.coordinatePosts}\n`;
      csvContent += `Total Users,${reportData.totalUsers}\n`;
      
      // Post types
      csvContent += '\nPost Type Distribution\n';
      Object.entries(reportData.postTypes).forEach(([type, count]) => {
        csvContent += `${type},${count}\n`;
      });
      
      // Daily posts
      csvContent += '\nDaily Posts\n';
      reportData.dailyPosts.forEach(day => {
        csvContent += `${day.date} (${day.day}),${day.posts}\n`;
      });
      
      // User growth
      csvContent += '\nUser Growth\n';
      reportData.userGrowth.forEach(month => {
        csvContent += `${month.month},New: ${month.newUsers}, Total: ${month.totalUsers}\n`;
      });
      
      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `testimony-app-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    } finally {
      setExporting('');
    }
  };

  const exportToPDF = () => {
    setExporting('pdf');
    try {
      // Create a printable version of the report
      const printContent = document.createElement('div');
      printContent.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h1>Testimony App Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          
          <h2>Summary Statistics</h2>
          <table border="1" cellpadding="5" style="border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <th>Metric</th>
              <th>Count</th>
            </tr>
            <tr>
              <td>Total Posts</td>
              <td>${reportData.totalPosts}</td>
            </tr>
            <tr>
              <td>Approved Posts</td>
              <td>${reportData.approvedPosts}</td>
            </tr>
            <tr>
              <td>Pending Posts</td>
              <td>${reportData.pendingPosts}</td>
            </tr>
            <tr>
              <td>Rejected Posts</td>
              <td>${reportData.rejectedPosts}</td>
            </tr>
            <tr>
              <td>Coordinate Posts</td>
              <td>${reportData.coordinatePosts}</td>
            </tr>
            <tr>
              <td>Total Users</td>
              <td>${reportData.totalUsers}</td>
            </tr>
          </table>
          
          <h2>Post Type Distribution</h2>
          <table border="1" cellpadding="5" style="border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <th>Type</th>
              <th>Count</th>
            </tr>
            ${Object.entries(reportData.postTypes).map(([type, count]) => `
              <tr>
                <td>${type}</td>
                <td>${count}</td>
              </tr>
            `).join('')}
          </table>
          
          <h2>Daily Activity (Last ${timeRange === 'week' ? '7' : timeRange === 'month' ? '30' : '365'} Days)</h2>
          <table border="1" cellpadding="5" style="border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Posts</th>
            </tr>
            ${reportData.dailyPosts.map(day => `
              <tr>
                <td>${day.date}</td>
                <td>${day.day}</td>
                <td>${day.posts}</td>
              </tr>
            `).join('')}
          </table>
          
          <h2>User Growth</h2>
          <table border="1" cellpadding="5" style="border-collapse: collapse;">
            <tr>
              <th>Month</th>
              <th>New Users</th>
              <th>Total Users</th>
            </tr>
            ${reportData.userGrowth.map(month => `
              <tr>
                <td>${month.month}</td>
                <td>${month.newUsers}</td>
                <td>${month.totalUsers}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
      
      // Open print dialog
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Testimony App Report - ${new Date().toLocaleDateString()}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1 { color: #333; }
              h2 { color: #555; margin-top: 30px; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 1000);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to generate PDF. Please try printing the page instead.');
    } finally {
      setExporting('');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Analytics & Reports</h2>
        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
        >
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="quarter">Last 3 Months</option>
          <option value="year">Last Year</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div>Loading reports...</div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/30 p-6 rounded-xl">
              <div className="text-3xl font-bold">{reportData.totalPosts}</div>
              <div className="text-gray-400">Total Posts</div>
              <div className="text-sm text-gray-500 mt-2">
                {reportData.approvedPosts} approved • {reportData.pendingPosts} pending • {reportData.rejectedPosts} rejected
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-700/30 p-6 rounded-xl">
              <div className="text-3xl font-bold">{reportData.approvedPosts}</div>
              <div className="text-gray-400">Approved Posts</div>
              <div className="text-sm text-green-300 mt-2">
                {reportData.totalPosts > 0 ? Math.round((reportData.approvedPosts / reportData.totalPosts) * 100) : 0}% of total
              </div>
            </div>
            <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border border-yellow-700/30 p-6 rounded-xl">
              <div className="text-3xl font-bold">{reportData.pendingPosts}</div>
              <div className="text-gray-400">Pending Review</div>
              <div className="text-sm text-yellow-300 mt-2">
                {reportData.totalPosts > 0 ? Math.round((reportData.pendingPosts / reportData.totalPosts) * 100) : 0}% of total
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/30 p-6 rounded-xl">
              <div className="text-3xl font-bold">{reportData.coordinatePosts}</div>
              <div className="text-gray-400">Coordinate Posts</div>
              <div className="text-sm text-purple-300 mt-2">
                {reportData.totalPosts > 0 ? Math.round((reportData.coordinatePosts / reportData.totalPosts) * 100) : 0}% of total
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-700/30 p-6 rounded-xl">
              <div className="text-3xl font-bold">{reportData.rejectedPosts}</div>
              <div className="text-gray-400">Rejected Posts</div>
              <div className="text-sm text-red-300 mt-2">
                {reportData.totalPosts > 0 ? Math.round((reportData.rejectedPosts / reportData.totalPosts) * 100) : 0}% of total
              </div>
            </div>
            <div className="bg-gradient-to-br from-teal-900/50 to-teal-800/30 border border-teal-700/30 p-6 rounded-xl">
              <div className="text-3xl font-bold">{reportData.totalUsers}</div>
              <div className="text-gray-400">Total Users</div>
              <div className="text-sm text-teal-300 mt-2">
                Avg: {reportData.totalUsers > 0 ? (reportData.totalPosts / reportData.totalUsers).toFixed(1) : 0} posts per user
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Daily Posts Chart */}
            <div className="bg-gray-850 border border-gray-700 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold">Daily Posts Activity</h3>
                <span className="text-sm text-gray-400">
                  Last {timeRange === 'week' ? '7' : timeRange === 'month' ? '30' : '365'} days
                </span>
              </div>
              <div className="h-64 flex items-end space-x-1">
                {reportData.dailyPosts.map((day, index) => {
                  const maxPosts = Math.max(...reportData.dailyPosts.map(d => d.posts), 1);
                  const heightPercent = (day.posts / maxPosts) * 100;
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-3/4 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-300 hover:opacity-90"
                        style={{ height: `${Math.max(heightPercent, 5)}%` }}
                        title={`${day.date}: ${day.posts} posts`}
                      ></div>
                      <div className="text-xs text-gray-400 mt-2">{day.day}</div>
                      <div className="text-sm font-medium mt-1">{day.posts}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-sm text-gray-400">
                Total: {reportData.dailyPosts.reduce((sum, day) => sum + day.posts, 0)} posts
              </div>
            </div>

            {/* Post Types Distribution */}
            <div className="bg-gray-850 border border-gray-700 rounded-xl p-6">
              <h3 className="font-bold mb-6">Content Types Distribution</h3>
              <div className="space-y-4">
                {Object.entries(reportData.postTypes).map(([type, count]) => {
                  const percentage = reportData.totalPosts > 0 ? (count / reportData.totalPosts) * 100 : 0;
                  
                  return (
                    <div key={type} className="flex items-center">
                      <div className="w-32 text-gray-400 capitalize">
                        {type === 'coordinates' ? '📍 Coordinates' : 
                         type === 'text' ? '📝 Text' : 
                         type === 'image' ? '🖼️ Image' : 
                         type === 'audio' ? '🎤 Audio' : 
                         type === 'video' ? '🎥 Video' : type}
                      </div>
                      <div className="flex-1 bg-gray-700 rounded-full h-6 overflow-hidden">
                        <div 
                          className={`h-full ${
                            type === 'text' ? 'bg-blue-600' :
                            type === 'image' ? 'bg-green-600' :
                            type === 'audio' ? 'bg-yellow-600' :
                            type === 'video' ? 'bg-red-600' :
                            'bg-purple-600' // coordinates
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="w-16 text-right">
                        <span className="font-medium">{count}</span>
                        <span className="text-xs text-gray-400 ml-1">({percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* User Growth */}
            <div className="bg-gray-850 border border-gray-700 rounded-xl p-6">
              <h3 className="font-bold mb-6">User Growth (Last 6 Months)</h3>
              <div className="h-64">
                <div className="flex h-full items-end space-x-2">
                  {reportData.userGrowth.map((month, index) => {
                    const maxUsers = Math.max(...reportData.userGrowth.map(m => m.totalUsers), 1);
                    const heightPercent = (month.totalUsers / maxUsers) * 100;
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-3/4 bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg"
                          style={{ height: `${Math.max(heightPercent, 5)}%` }}
                          title={`${month.month}: ${month.totalUsers} total users (${month.newUsers} new)`}
                        ></div>
                        <div className="text-xs text-gray-400 mt-2">{month.month}</div>
                        <div className="text-sm font-medium mt-1">{month.totalUsers}</div>
                        <div className="text-xs text-green-400">+{month.newUsers}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-400">
                Total Growth: +{reportData.userGrowth.reduce((sum, month) => sum + month.newUsers, 0)} new users
              </div>
            </div>

            {/* Popular Posting Hours */}
            <div className="bg-gray-850 border border-gray-700 rounded-xl p-6">
              <h3 className="font-bold mb-6">Posts by Status</h3>
              <div className="space-y-4">
                {[
                  { status: 'approved', label: '✅ Approved', color: 'bg-green-600', count: reportData.approvedPosts },
                  { status: 'pending', label: '⏳ Pending', color: 'bg-yellow-600', count: reportData.pendingPosts },
                  { status: 'rejected', label: '❌ Rejected', color: 'bg-red-600', count: reportData.rejectedPosts }
                ].map((item) => {
                  const percentage = reportData.totalPosts > 0 ? (item.count / reportData.totalPosts) * 100 : 0;
                  
                  return (
                    <div key={item.status} className="flex items-center">
                      <div className="w-40 text-gray-300">
                        {item.label}
                      </div>
                      <div className="flex-1 bg-gray-700 rounded-full h-6 overflow-hidden">
                        <div 
                          className={`h-full ${item.color}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="w-16 text-right">
                        <span className="font-medium">{item.count}</span>
                        <span className="text-xs text-gray-400 ml-1">({percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Export Section */}
          <div className="bg-gray-850 border border-gray-700 rounded-xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <FaChartLine /> Export Reports
            </h3>
            <p className="text-gray-400 mb-6">
              Download comprehensive reports of your app's analytics and statistics.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={exportToCSV}
                disabled={exporting === 'csv'}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {exporting === 'csv' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <FaFileCsv /> Export as CSV
                  </>
                )}
              </button>
              <button
                onClick={exportToPDF}
                disabled={exporting === 'pdf'}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {exporting === 'pdf' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <FaFilePdf /> Generate PDF Report
                  </>
                )}
              </button>
              <button
                onClick={fetchReportData}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                <FaDownload /> Refresh Data
              </button>
            </div>
            
            <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <h4 className="font-medium mb-2">📊 Report Summary</h4>
              <div className="text-sm text-gray-400">
                <p>• Generated on: {new Date().toLocaleDateString()}</p>
                <p>• Time Range: {timeRange === 'week' ? 'Last 7 Days' : 
                                  timeRange === 'month' ? 'Last 30 Days' : 
                                  timeRange === 'quarter' ? 'Last 3 Months' : 'Last Year'}</p>
                <p>• Data includes: {reportData.totalPosts} posts and {reportData.totalUsers} users</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}