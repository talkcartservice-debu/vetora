import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { adminAPI, vendorSubscriptionsAPI } from '@/api/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  Store, 
  CreditCard, 
  BarChart3, 
  UserX, 
  UserCheck, 
  CheckCircle, 
  AlertCircle,
  Search,
  RefreshCw,
  MoreVertical,
  ShieldAlert,
  ShieldCheck as ShieldCheckIcon,
  Flag,
  History,
  Settings as SettingsIcon,
  Percent,
  Wallet,
  Eye,
  Filter,
  Package,
  Trash2,
  Archive,
  Ban,
  Plus
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

const StoreDetailsModal = ({ store, isOpen, onOpenChange, onUpdateStatus, onUpdateVerification }) => {
  if (!store) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {store.name}
            {store.is_verified && <ShieldCheckIcon className="w-5 h-5 text-blue-500" />}
          </DialogTitle>
          <DialogDescription>
            Store ID: {store._id}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Owner Information</Label>
              <div className="mt-1 font-medium">@{store.owner_username}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={store.status === 'active' ? 'success' : store.status === 'pending' ? 'warning' : 'destructive'}>
                  {store.status}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Joined At</Label>
              <div className="mt-1">{new Date(store.created_at).toLocaleDateString()}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Description</Label>
              <div className="mt-1 text-sm">{store.description || 'No description provided.'}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Store Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Orders</div>
                  <div className="text-xl font-bold">{store.orders_count || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Products</div>
                  <div className="text-xl font-bold">{store.products_count || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Revenue</div>
                  <div className="text-xl font-bold text-success">${store.total_revenue || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Rating</div>
                  <div className="text-xl font-bold">{store.rating || 'N/A'}</div>
                </div>
              </div>
            </div>

            {store.logo && (
              <div>
                <Label className="text-muted-foreground">Store Logo</Label>
                <img 
                  src={store.logo} 
                  alt={store.name} 
                  className="mt-2 w-24 h-24 object-cover rounded-md border"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t pt-4 mt-4">
          <div className="flex-1 flex gap-2">
            {store.status !== 'active' && (
              <Button 
                onClick={() => onUpdateStatus(store._id, 'active')}
                className="bg-success hover:bg-success/90"
              >
                Approve Store
              </Button>
            )}
            {store.status !== 'suspended' && (
              <Button 
                variant="destructive"
                onClick={() => onUpdateStatus(store._id, 'suspended')}
              >
                Suspend Store
              </Button>
            )}
          </div>
          <Button 
            variant="outline"
            onClick={() => onUpdateVerification(store._id, !store.is_verified)}
          >
            {store.is_verified ? 'Remove Verification' : 'Verify Store'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Users State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState(null);

  // Stores State
  const [stores, setStores] = useState([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [storeLoading, setStoreLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [storePage, setStorePage] = useState(1);
  const [storePagination, setStorePagination] = useState(null);

  // Products State
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [productLoading, setProductLoading] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productPagination, setProductPagination] = useState(null);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPagination, setOrderPagination] = useState(null);

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [withdrawalAction, setWithdrawalAction] = useState('completed');

  // Reports State
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportNotes, setReportNotes] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportAction, setReportAction] = useState('resolved');

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);

  // Announcements State
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    type: 'info',
    target: 'all',
    is_active: true,
    expires_at: ''
  });

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionSearch, setSubscriptionSearch] = useState('');

  // Settings State
  const [settings, setSettings] = useState({
    maintenance_mode: false,
    maintenance_message: '',
    allow_registration: true,
    min_withdrawal_amount: 10,
    platform_fee_percent: 5
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getStats();
      setStats(data);
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch admin statistics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (page = userPage) => {
    try {
      setUserLoading(true);
      const data = await adminAPI.getUsers({ search: userSearch, page, limit: 10 });
      setUsers(data.users);
      setUserPagination(data.pagination);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setUserLoading(false);
    }
  };

  const fetchStores = async (page = storePage) => {
    try {
      setStoreLoading(true);
      const data = await adminAPI.getStores({ 
        search: storeSearch,
        status: storeFilter === 'all' ? undefined : storeFilter,
        page,
        limit: 10,
      });
      setStores(data.stores);
      setStorePagination(data.pagination);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch stores',
        variant: 'destructive',
      });
    } finally {
      setStoreLoading(false);
    }
  };

  const fetchProducts = async (page = productPage) => {
    try {
      setProductLoading(true);
      const data = await adminAPI.getProducts({ 
        search: productSearch,
        status: productFilter === 'all' ? undefined : productFilter,
        page,
        limit: 10,
      });
      setProducts(data.products || []);
      setProductPagination(data.pagination);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      });
    } finally {
      setProductLoading(false);
    }
  };

  const fetchOrders = async (page = orderPage) => {
    try {
      setOrderLoading(true);
      const data = await adminAPI.getOrders({ 
        search: orderSearch,
        status: orderFilter === 'all' ? undefined : orderFilter,
        page,
        limit: 10,
      });
      setOrders(data.orders || []);
      setOrderPagination(data.pagination);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch orders',
        variant: 'destructive',
      });
    } finally {
      setOrderLoading(false);
    }
  };

  const fetchWithdrawals = async (filter = withdrawalFilter) => {
    try {
      setWithdrawalLoading(true);
      const data = await adminAPI.getWithdrawals({
        status: filter === 'all' ? undefined : filter,
      });
      setWithdrawals(data.withdrawals || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch withdrawals',
        variant: 'destructive',
      });
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const fetchReports = async (filter = reportFilter) => {
    try {
      setReportsLoading(true);
      const data = await adminAPI.getReports({
        status: filter === 'all' ? undefined : filter,
      });
      setReports(data.reports || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch reports',
        variant: 'destructive',
      });
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setActivityLogsLoading(true);
      const data = await adminAPI.getActivityLogs();
      setActivityLogs(data.logs);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive',
      });
    } finally {
      setActivityLogsLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      const data = await adminAPI.getAnnouncements();
      setAnnouncements(data.announcements || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch announcements',
        variant: 'destructive',
      });
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    if (activeTab === 'stores') { setStorePage(1); fetchStores(1); }
  }, [storeFilter]);

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    if (activeTab === 'products') { setProductPage(1); fetchProducts(1); }
  }, [productFilter]);

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    if (activeTab === 'orders') { setOrderPage(1); fetchOrders(1); }
  }, [orderFilter]);

  const fetchSubscriptions = async () => {
    try {
      setSubscriptionsLoading(true);
      const data = await vendorSubscriptionsAPI.list({ search: subscriptionSearch });
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch subscriptions',
        variant: 'destructive',
      });
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'stores') fetchStores();
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'withdrawals') fetchWithdrawals();
    if (activeTab === 'moderation') fetchReports();
    if (activeTab === 'logs') fetchActivityLogs();
    if (activeTab === 'subscriptions') fetchSubscriptions();
    if (activeTab === 'announcements') fetchAnnouncements();
  }, [activeTab, user]);

  const handleBlockUser = async (userId, isBlocked) => {
    try {
      await adminAPI.updateUserBlockStatus(userId, !isBlocked);
      toast({
        title: 'Success',
        description: `User ${isBlocked ? 'unblocked' : 'blocked'} successfully`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  const handleBulkBlockUsers = async (isBlocked) => {
    if (selectedUserIds.length === 0) return;
    try {
      await adminAPI.bulkUpdateUserBlockStatus(selectedUserIds, isBlocked);
      toast({
        title: 'Success',
        description: `${selectedUserIds.length} users ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      });
      setSelectedUserIds([]);
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update users status',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStoreStatus = async (storeId, status) => {
    try {
      await adminAPI.updateStoreStatus(storeId, status);
      toast({
        title: 'Success',
        description: `Store status updated to ${status}`,
      });
      fetchStores();
      if (selectedStore?._id === storeId) {
        setIsStoreModalOpen(false);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update store status',
        variant: 'destructive',
      });
    }
  };

  const handleBulkUpdateStoreStatus = async (status) => {
    if (selectedStoreIds.length === 0) return;
    try {
      await adminAPI.bulkUpdateStoreStatus(selectedStoreIds, status);
      toast({
        title: 'Success',
        description: `${selectedStoreIds.length} stores status updated to ${status}`,
      });
      setSelectedStoreIds([]);
      fetchStores();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update stores status',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStoreVerification = async (storeId, isVerified) => {
    try {
      await adminAPI.updateStoreVerification(storeId, isVerified);
      toast({
        title: 'Success',
        description: `Store verification ${isVerified ? 'enabled' : 'disabled'}`,
      });
      fetchStores();
      if (selectedStore?._id === storeId) {
        setIsStoreModalOpen(false);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update store verification',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateProductStatus = async (productId, status) => {
    try {
      await adminAPI.updateProductStatus(productId, status);
      toast({
        title: 'Success',
        description: `Product status updated to ${status}`,
      });
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update product status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await adminAPI.deleteProduct(productId);
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      fetchProducts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    }
  };

  const handleWithdrawalStatus = async (id, status, notes = '') => {
    try {
      await adminAPI.updateWithdrawalStatus(id, status, notes);
      toast({
        title: 'Success',
        description: `Withdrawal ${status}`,
      });
      fetchWithdrawals();
      setIsWithdrawalModalOpen(false);
      setWithdrawalNotes('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update withdrawal status',
        variant: 'destructive',
      });
    }
  };

  const handleResolveReport = async (id, status, notes = '') => {
    try {
      await adminAPI.resolveReport(id, status, notes);
      toast({
        title: 'Success',
        description: `Report ${status}`,
      });
      fetchReports();
      setIsReportModalOpen(false);
      setReportNotes('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve report',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    try {
      if (selectedAnnouncement) {
        await adminAPI.updateAnnouncement(selectedAnnouncement._id, announcementForm);
        toast({ title: 'Success', description: 'Announcement updated' });
      } else {
        await adminAPI.createAnnouncement(announcementForm);
        toast({ title: 'Success', description: 'Announcement created' });
      }
      setIsAnnouncementModalOpen(false);
      fetchAnnouncements();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save announcement',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await adminAPI.deleteAnnouncement(id);
      toast({ title: 'Success', description: 'Announcement deleted' });
      fetchAnnouncements();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete announcement',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateSettings = async (data) => {
    try {
      setSettingsLoading(true);
      const updated = await adminAPI.updateSettings(data);
      setSettings(updated);
      toast({
        title: 'Success',
        description: 'System settings updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleVerifyUser = async (userId, isVerified) => {
    try {
      await adminAPI.updateUserVerification(userId, !isVerified);
      toast({
        title: 'Success',
        description: `User ${!isVerified ? 'verified' : 'unverified'} successfully`,
      });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update user verification', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) return;
    try {
      await adminAPI.deleteUser(userId);
      toast({ title: 'Success', description: 'User deleted successfully' });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' });
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await adminAPI.updateOrderStatus(orderId, status);
      toast({ title: 'Success', description: `Order status updated to ${status}` });
      fetchOrders();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update order status', variant: 'destructive' });
    }
  };

  const PaginationControls = ({ pagination, page, setPage, onFetch }) => {
    if (!pagination || pagination.pages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          Showing {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); onFetch(p); }}
          >
            Previous
          </Button>
          <span className="text-sm font-medium">{page} / {pagination.pages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.pages}
            onClick={() => { const p = page + 1; setPage(p); onFetch(p); }}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button className="mt-6" onClick={() => window.location.href = '/'}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, stores, and system-wide settings.</p>
        </div>
        <Button onClick={fetchStats} disabled={loading} variant="outline" className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.users || 0}</div>
            <p className="text-xs text-muted-foreground">Platform-wide users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.stores?.active || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.counts?.stores?.pending || 0} pending approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.products || 0}</div>
            <p className="text-xs text-muted-foreground">Live products</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.withdrawals?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
            <Flag className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.counts?.reports?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">Reports to review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.counts?.total_sales?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">Total platform volume</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-11 lg:w-[1350px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Sales Overview (Last 7 Days)</CardTitle>
                <CardDescription>Revenue trends across the platform.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.charts?.sales || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="_id" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <RechartsTooltip 
                      labelFormatter={(val) => new Date(val).toLocaleDateString()}
                      formatter={(val) => [`$${val}`, 'Sales']}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Recent Admin Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.recent?.activity?.map((log) => (
                    <div key={log._id} className="flex flex-col border-b pb-2 last:border-0">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">{log.user_id?.display_name || 'Admin'}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {log.action.replace(/_/g, ' ')} 
                        {log.target_type && ` on ${log.target_type}`}
                      </span>
                    </div>
                  ))}
                  {(!stats?.recent?.activity || stats?.recent?.activity.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Recent Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {stats?.recent?.users?.map((u) => (
                    <div key={u._id} className="flex items-center">
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{u.display_name || 'Anonymous'}</p>
                        <p className="text-sm text-muted-foreground">@{u.username}</p>
                      </div>
                      <div className="ml-auto font-medium">
                        <Badge variant={u.role === 'super_admin' ? 'default' : u.role === 'vendor' ? 'secondary' : 'outline'}>
                          {u.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Stores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {stats?.recent?.stores?.map((s) => (
                    <div key={s._id} className="flex items-center">
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{s.name}</p>
                        <p className="text-sm text-muted-foreground">@{s.owner_username}</p>
                      </div>
                      <div className="ml-auto">
                        <Badge variant={s.status === 'active' ? 'success' : s.status === 'pending' ? 'warning' : 'destructive'}>
                          {s.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Users Management</CardTitle>
                  <CardDescription>View and manage platform users.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedUserIds.length > 0 && (
                    <div className="flex items-center gap-2 mr-4 bg-muted p-1 px-2 rounded-md">
                      <span className="text-xs font-medium">{selectedUserIds.length} selected</span>
                      <Button size="xs" variant="destructive" className="h-7 px-2" onClick={() => handleBulkBlockUsers(true)}>
                        <Ban className="w-3 h-3 mr-1" /> Block
                      </Button>
                      <Button size="xs" variant="outline" className="h-7 px-2" onClick={() => handleBulkBlockUsers(false)}>
                        <UserCheck className="w-3 h-3 mr-1" /> Unblock
                      </Button>
                      <Button size="xs" variant="ghost" className="h-7 px-2" onClick={() => setSelectedUserIds([])}>
                        Clear
                      </Button>
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search username or name..."
                      className="pl-8 w-[250px] h-9"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (setUserPage(1), fetchUsers(1))}
                    />
                  </div>
                  <Button onClick={() => { setUserPage(1); fetchUsers(1); }} disabled={userLoading} size="sm" className="h-9">
                    Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={users.length > 0 && selectedUserIds.length === users.length}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedUserIds(users.map(u => u._id));
                          else setSelectedUserIds([]);
                        }}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {userLoading ? 'Loading users...' : 'No users found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u._id} className={selectedUserIds.includes(u._id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedUserIds.includes(u._id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedUserIds(prev => [...prev, u._id]);
                              else setSelectedUserIds(prev => prev.filter(id => id !== u._id));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{u.display_name || u.username}</div>
                          <div className="text-xs text-muted-foreground">@{u.username}</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'super_admin' ? 'default' : u.role === 'vendor' ? 'secondary' : 'outline'}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.is_blocked ? (
                            <Badge variant="destructive">Blocked</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.is_verified ? (
                            <Badge variant="success" className="bg-blue-500 hover:bg-blue-600">Verified</Badge>
                          ) : (
                            <Badge variant="outline">Unverified</Badge>
                          )}
                        </TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleBlockUser(u._id, u.is_blocked)}>
                                {u.is_blocked ? (
                                  <><UserCheck className="mr-2 h-4 w-4" /> Unblock</>
                                ) : (
                                  <><UserX className="mr-2 h-4 w-4" /> Block</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleVerifyUser(u._id, u.is_verified)}>
                                <ShieldCheckIcon className="mr-2 h-4 w-4 text-blue-500" />
                                {u.is_verified ? 'Unverify' : 'Verify'} Account
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                const roles = ['user', 'vendor', 'super_admin'];
                                const next = roles[(roles.indexOf(u.role) + 1) % roles.length];
                                adminAPI.updateUserRole(u._id, next).then(() => {
                                  toast({ title: 'Success', description: `Role changed to ${next}` });
                                  fetchUsers();
                                }).catch(() => toast({ title: 'Error', description: 'Failed to update role', variant: 'destructive' }));
                              }}>
                                <ShieldAlert className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteUser(u._id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationControls
                pagination={userPagination}
                page={userPage}
                setPage={setUserPage}
                onFetch={fetchUsers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Stores Management</CardTitle>
                  <CardDescription>View and manage vendor stores.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedStoreIds.length > 0 && (
                    <div className="flex items-center gap-2 mr-4 bg-muted p-1 px-2 rounded-md">
                      <span className="text-xs font-medium">{selectedStoreIds.length} selected</span>
                      <Button size="xs" variant="success" className="h-7 px-2" onClick={() => handleBulkUpdateStoreStatus('active')}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Activate
                      </Button>
                      <Button size="xs" variant="destructive" className="h-7 px-2" onClick={() => handleBulkUpdateStoreStatus('suspended')}>
                        <Ban className="w-3 h-3 mr-1" /> Suspend
                      </Button>
                      <Button size="xs" variant="ghost" className="h-7 px-2" onClick={() => setSelectedStoreIds([])}>
                        Clear
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mr-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={storeFilter} onValueChange={setStoreFilter}>
                      <SelectTrigger className="w-[130px] h-9">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search name or owner username..."
                      className="pl-8 w-[200px] h-9"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (setStorePage(1), fetchStores(1))}
                    />
                  </div>
                  <Button onClick={() => { setStorePage(1); fetchStores(1); }} disabled={storeLoading} size="sm" className="h-9">
                    Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={stores.length > 0 && selectedStoreIds.length === stores.length}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedStoreIds(stores.map(s => s._id));
                          else setSelectedStoreIds([]);
                        }}
                      />
                    </TableHead>
                    <TableHead>Store Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No stores found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stores.map((s) => (
                      <TableRow key={s._id} className={selectedStoreIds.includes(s._id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedStoreIds.includes(s._id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedStoreIds(prev => [...prev, s._id]);
                              else setSelectedStoreIds(prev => prev.filter(id => id !== s._id));
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{s.name}</span>
                            <span className="text-xs text-muted-foreground font-normal">ID: {s._id.substring(0, 8)}...</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">@{s.owner_username}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'active' ? 'success' : s.status === 'pending' ? 'warning' : 'destructive'}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.is_verified ? (
                            <Badge variant="success" className="bg-blue-500 hover:bg-blue-600">Verified</Badge>
                          ) : (
                            <Badge variant="outline">Unverified</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span>Products: {s.products_count || 0}</span>
                            <span>Orders: {s.orders_count || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedStore(s);
                                setIsStoreModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Manage Store</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateStoreStatus(s._id, 'active')}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-success" /> Set Active
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStoreStatus(s._id, 'suspended')}>
                                  <AlertCircle className="w-4 h-4 mr-2 text-destructive" /> Suspend
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateStoreVerification(s._id, !s.is_verified)}>
                                  <ShieldCheckIcon className="w-4 h-4 mr-2 text-blue-500" /> 
                                  {s.is_verified ? 'Remove Verification' : 'Verify Store'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationControls
                pagination={storePagination}
                page={storePage}
                setPage={setStorePage}
                onFetch={fetchStores}
              />
            </CardContent>
          </Card>

          <StoreDetailsModal 
            store={selectedStore}
            isOpen={isStoreModalOpen}
            onOpenChange={setIsStoreModalOpen}
            onUpdateStatus={handleUpdateStoreStatus}
            onUpdateVerification={handleUpdateStoreVerification}
          />
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Product Catalog</CardTitle>
                  <CardDescription>Monitor and moderate products across all stores.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-4">
                    <Label htmlFor="product-status" className="text-xs">Status:</Label>
                    <Select value={productFilter} onValueChange={setProductFilter}>
                      <SelectTrigger id="product-status" className="w-[120px] h-9">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sold_out">Sold Out</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search title or vendor..."
                      className="pl-8 w-[200px] h-9"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (setProductPage(1), fetchProducts(1))}
                    />
                  </div>
                  <Button onClick={() => { setProductPage(1); fetchProducts(1); }} disabled={productLoading} size="sm" className="h-9">
                    Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Store / Vendor</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No products found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((p) => (
                      <TableRow key={p._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {p.images && p.images[0] ? (
                              <img src={p.images[0]} alt="" className="w-10 h-10 object-cover rounded bg-muted" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="max-w-[200px] truncate">{p.title}</span>
                              <span className="text-xs text-muted-foreground font-normal">ID: {p._id.substring(0, 8)}...</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{p.store_name}</span>
                            <span className="text-xs text-muted-foreground">@{p.vendor_username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">${p.price}</span>
                            {p.compare_at_price > p.price && (
                              <span className="text-xs text-muted-foreground line-through">${p.compare_at_price}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            p.status === 'active' ? 'success' : 
                            p.status === 'draft' ? 'warning' : 
                            p.status === 'sold_out' ? 'destructive' : 'outline'
                          }>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span>Sales: {p.sales_count || 0}</span>
                            <span>Views: {p.views_count || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Product Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateProductStatus(p._id, 'active')}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-success" /> Activate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateProductStatus(p._id, 'archived')}>
                                  <Archive className="w-4 h-4 mr-2 text-muted-foreground" /> Archive
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteProduct(p._id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete Product
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationControls
                pagination={productPagination}
                page={productPage}
                setPage={setProductPage}
                onFetch={fetchProducts}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Orders</CardTitle>
                  <CardDescription>View all orders across the platform.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={orderFilter} onValueChange={(v) => { setOrderFilter(v); setOrderPage(1); }}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search buyer, vendor or store..."
                      className="pl-8 w-[230px] h-9"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchOrders(1)}
                    />
                  </div>
                  <Button onClick={() => fetchOrders(1)} disabled={orderLoading} size="sm" className="h-9">
                    Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {orderLoading ? 'Loading orders...' : 'No orders found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((o) => (
                      <TableRow key={o._id}>
                        <TableCell className="font-mono text-xs">{o._id.substring(0, 8)}...</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">@{o.buyer_username}</span>
                            <span className="text-xs text-muted-foreground">{o.buyer_email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{o.store_name}</span>
                            <span className="text-xs text-muted-foreground">@{o.vendor_username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">${o.total?.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            o.status === 'delivered' ? 'success' :
                            o.status === 'cancelled' || o.status === 'refunded' ? 'destructive' :
                            o.status === 'pending' ? 'warning' : 'default'
                          }>
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.payment_status === 'paid' ? 'success' : o.payment_status === 'failed' ? 'destructive' : 'warning'} className="capitalize">
                            {o.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  disabled={o.status === s}
                                  onClick={() => handleUpdateOrderStatus(o._id, s)}
                                  className="capitalize"
                                >
                                  {s}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationControls
                pagination={orderPagination}
                page={orderPage}
                setPage={setOrderPage}
                onFetch={fetchOrders}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Withdrawal Requests</CardTitle>
                <CardDescription>Process vendor withdrawal requests.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={withdrawalFilter} onValueChange={(v) => { setWithdrawalFilter(v); fetchWithdrawals(v); }}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => fetchWithdrawals(withdrawalFilter)} disabled={withdrawalLoading} variant="ghost" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${withdrawalLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No withdrawal requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    withdrawals.map((w) => (
                      <TableRow key={w._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">@{w.vendor_username}</span>
                            {w.notes && (
                              <span className="text-xs text-muted-foreground italic truncate max-w-[200px]" title={w.notes}>
                                Note: {w.notes}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-success">${w.amount}</TableCell>
                        <TableCell className="capitalize">
                          <Badge variant="outline" className="font-normal">
                            {w.payment_method?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            w.status === 'completed' ? 'success' : 
                            w.status === 'pending' ? 'warning' : 
                            w.status === 'rejected' ? 'destructive' : 'default'
                          }>
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(w.created_at).toLocaleDateString()}<br/>
                          {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="text-right">
                          {w.status === 'pending' && (
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-success border-success/20 hover:bg-success/10 h-8" 
                                onClick={() => {
                                  setSelectedWithdrawal(w);
                                  setWithdrawalAction('completed');
                                  setWithdrawalNotes('');
                                  setIsWithdrawalModalOpen(true);
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" /> Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-destructive border-destructive/20 hover:bg-destructive/10 h-8" 
                                onClick={() => {
                                  setSelectedWithdrawal(w);
                                  setWithdrawalAction('rejected');
                                  setWithdrawalNotes('');
                                  setIsWithdrawalModalOpen(true);
                                }}
                              >
                                <AlertCircle className="w-4 h-4 mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={isWithdrawalModalOpen} onOpenChange={setIsWithdrawalModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{withdrawalAction === 'completed' ? 'Approve' : 'Reject'} Withdrawal</DialogTitle>
                <DialogDescription>
                  Reviewing withdrawal request for @{selectedWithdrawal?.vendor_username} of ${selectedWithdrawal?.amount}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="notes">Admin Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder={withdrawalAction === 'completed' ? 'e.g. Transaction processed via Bank Transfer' : 'e.g. Invalid payment information provided'}
                    value={withdrawalNotes}
                    onChange={(e) => setWithdrawalNotes(e.target.value)}
                    className="h-24"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsWithdrawalModalOpen(false)}>Cancel</Button>
                <Button 
                  variant={withdrawalAction === 'completed' ? 'success' : 'destructive'}
                  onClick={() => handleWithdrawalStatus(selectedWithdrawal?._id, withdrawalAction, withdrawalNotes)}
                >
                  Confirm {withdrawalAction === 'completed' ? 'Approval' : 'Rejection'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Vendor Subscriptions</CardTitle>
                  <CardDescription>Manage vendor subscription plans and status.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search vendor or store..."
                      className="pl-8 w-[250px] h-9"
                      value={subscriptionSearch}
                      onChange={(e) => setSubscriptionSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchSubscriptions()}
                    />
                  </div>
                  <Button onClick={fetchSubscriptions} disabled={subscriptionsLoading} size="sm" className="h-9">
                    Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor / Store</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {subscriptionsLoading ? 'Loading subscriptions...' : 'No subscriptions found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    subscriptions.map((sub) => (
                      <TableRow key={sub._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">@{sub.vendor_username}</span>
                            <span className="text-xs text-muted-foreground">Store ID: {sub.store_id}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {sub.plan_id?.name || sub.plan_name || 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            sub.status === 'active' ? 'success' : 
                            sub.status === 'expired' ? 'destructive' : 
                            sub.status === 'cancelled' ? 'secondary' : 'warning'
                          }>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          ${sub.amount || 0}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => {
                                if (confirm('Are you sure you want to cancel this subscription?')) {
                                  vendorSubscriptionsAPI.cancel(sub._id).then(() => {
                                    toast({ title: 'Success', description: 'Subscription cancelled' });
                                    fetchSubscriptions();
                                  });
                                }
                              }}>
                                <UserX className="w-4 h-4 mr-2" /> Cancel Subscription
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Moderation Queue</CardTitle>
                <CardDescription>Review and resolve user-reported content.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={reportFilter} onValueChange={(v) => { setReportFilter(v); fetchReports(v); }}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reports</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => fetchReports(reportFilter)} disabled={reportsLoading} variant="ghost" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${reportsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No reports found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((r) => (
                      <TableRow key={r._id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{r.target_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[200px]" title={r.description}>
                              {r.reason}
                            </span>
                            {r.admin_notes && (
                              <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                                Admin: {r.admin_notes}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.reporter_id?.display_name || 'System'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            r.status === 'resolved' ? 'success' : 
                            r.status === 'dismissed' ? 'secondary' : 'warning'
                          }>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === 'pending' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Resolve Report</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedReport(r);
                                  setReportAction('resolved');
                                  setReportNotes('');
                                  setIsReportModalOpen(true);
                                }}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-success" /> Resolve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedReport(r);
                                  setReportAction('dismissed');
                                  setReportNotes('');
                                  setIsReportModalOpen(true);
                                }}>
                                  <AlertCircle className="w-4 h-4 mr-2 text-muted-foreground" /> Dismiss
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{reportAction === 'resolved' ? 'Resolve' : 'Dismiss'} Report</DialogTitle>
                <DialogDescription>
                  Provide {reportAction === 'resolved' ? 'resolution' : 'dismissal'} notes for this {selectedReport?.target_type} report.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="p-3 bg-muted rounded-md text-sm">
                  <div className="font-semibold">{selectedReport?.reason}</div>
                  <div className="mt-1 text-muted-foreground">{selectedReport?.description}</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-notes">Admin Notes (Optional)</Label>
                  <Textarea
                    id="report-notes"
                    placeholder="Provide details about the action taken..."
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    className="h-24"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsReportModalOpen(false)}>Cancel</Button>
                <Button 
                  variant={reportAction === 'resolved' ? 'success' : 'secondary'}
                  onClick={() => handleResolveReport(selectedReport?._id, reportAction, reportNotes)}
                >
                  Confirm {reportAction === 'resolved' ? 'Resolution' : 'Dismissal'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Platform Announcements</CardTitle>
                  <CardDescription>Create and manage system-wide notifications for users and vendors.</CardDescription>
                </div>
                <Button onClick={() => {
                  setSelectedAnnouncement(null);
                  setAnnouncementForm({
                    title: '',
                    content: '',
                    type: 'info',
                    target: 'all',
                    is_active: true,
                    expires_at: ''
                  });
                  setIsAnnouncementModalOpen(true);
                }} size="sm" className="flex items-center gap-2">
                  <Plus className="w-4 h-4" /> New Announcement
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Announcement</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No announcements found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    announcements.map((a) => (
                      <TableRow key={a._id}>
                        <TableCell>
                          <div className="font-medium">{a.title}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">{a.content}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{a.target}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            a.type === 'info' ? 'default' : 
                            a.type === 'warning' ? 'warning' : 
                            a.type === 'error' ? 'destructive' : 'success'
                          } className="capitalize">
                            {a.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.is_active ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.expires_at ? new Date(a.expires_at).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedAnnouncement(a);
                                setAnnouncementForm({
                                  title: a.title,
                                  content: a.content,
                                  type: a.type,
                                  target: a.target,
                                  is_active: a.is_active,
                                  expires_at: a.expires_at ? new Date(a.expires_at).toISOString().split('T')[0] : ''
                                });
                                setIsAnnouncementModalOpen(true);
                              }}
                            >
                              <SettingsIcon className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive"
                              onClick={() => handleDeleteAnnouncement(a._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={isAnnouncementModalOpen} onOpenChange={setIsAnnouncementModalOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{selectedAnnouncement ? 'Edit' : 'Create'} Announcement</DialogTitle>
                <DialogDescription>
                  This announcement will be shown to the targeted users on the platform.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveAnnouncement} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input 
                    id="title" 
                    placeholder="E.g., Scheduled Maintenance" 
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea 
                    id="content" 
                    placeholder="Announcement details..." 
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                    required
                    className="h-24"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select 
                      value={announcementForm.type} 
                      onValueChange={(v) => setAnnouncementForm({...announcementForm, type: v})}
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Information</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="error">Critical/Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target">Target Audience</Label>
                    <Select 
                      value={announcementForm.target} 
                      onValueChange={(v) => setAnnouncementForm({...announcementForm, target: v})}
                    >
                      <SelectTrigger id="target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Everyone</SelectItem>
                        <SelectItem value="vendors">Vendors Only</SelectItem>
                        <SelectItem value="users">Regular Users Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expires">Expiry Date (Optional)</Label>
                    <Input 
                      id="expires" 
                      type="date" 
                      value={announcementForm.expires_at}
                      onChange={(e) => setAnnouncementForm({...announcementForm, expires_at: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-8">
                    <Switch 
                      id="is-active" 
                      checked={announcementForm.is_active}
                      onCheckedChange={(v) => setAnnouncementForm({...announcementForm, is_active: v})}
                    />
                    <Label htmlFor="is-active">Active</Label>
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsAnnouncementModalOpen(false)}>Cancel</Button>
                  <Button type="submit">
                    {selectedAnnouncement ? 'Update' : 'Publish'} Announcement
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Activity Logs</CardTitle>
              <CardDescription>Full audit trail of administrative actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {activityLogsLoading ? 'Loading logs...' : 'No activity logs found.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    activityLogs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell>
                          <div className="font-medium">{log.user_id?.display_name || 'System'}</div>
                          <div className="text-[10px] text-muted-foreground">{log.user_id?.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs capitalize">{log.target_type || '-'}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.ip_address || 'Internal'}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                System Settings
              </CardTitle>
              <CardDescription>Manage global platform configurations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Security & Access</h3>
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-slate-50/50">
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="maintenance-mode" className="text-base flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-orange-500" />
                      Maintenance Mode
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, the platform will be inaccessible to all users except Super Admins.
                    </p>
                  </div>
                  <Switch
                    id="maintenance-mode"
                    checked={settings.maintenance_mode}
                    onCheckedChange={(checked) => handleUpdateSettings({ maintenance_mode: checked })}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maintenance-message">Maintenance Message</Label>
                  <Textarea
                    id="maintenance-message"
                    placeholder="Enter the message users will see during maintenance..."
                    value={settings.maintenance_message}
                    onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })}
                    className="min-h-[100px]"
                  />
                  <Button 
                    onClick={() => handleUpdateSettings({ maintenance_message: settings.maintenance_message })}
                    disabled={settingsLoading}
                    size="sm"
                  >
                    Save Message
                  </Button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">Platform Policies</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-slate-50/50">
                    <div className="flex flex-col space-y-1">
                      <Label htmlFor="allow-reg" className="text-base">User Registration</Label>
                      <p className="text-xs text-muted-foreground">Allow new users to sign up</p>
                    </div>
                    <Switch
                      id="allow-reg"
                      checked={settings.allow_registration}
                      onCheckedChange={(checked) => handleUpdateSettings({ allow_registration: checked })}
                      disabled={settingsLoading}
                    />
                  </div>

                  <div className="space-y-2 border p-4 rounded-lg bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-4 h-4 text-indigo-500" />
                      <Label htmlFor="min-withdrawal">Min Withdrawal ($)</Label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="min-withdrawal"
                        type="number"
                        value={settings.min_withdrawal_amount}
                        onChange={(e) => setSettings({ ...settings, min_withdrawal_amount: parseFloat(e.target.value) })}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateSettings({ min_withdrawal_amount: settings.min_withdrawal_amount })}
                        disabled={settingsLoading}
                      >
                        Update
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 border p-4 rounded-lg bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Percent className="w-4 h-4 text-emerald-500" />
                      <Label htmlFor="fee-percent">Platform Fee (%)</Label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="fee-percent"
                        type="number"
                        value={settings.platform_fee_percent}
                        onChange={(e) => setSettings({ ...settings, platform_fee_percent: parseFloat(e.target.value) })}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateSettings({ platform_fee_percent: settings.platform_fee_percent })}
                        disabled={settingsLoading}
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;