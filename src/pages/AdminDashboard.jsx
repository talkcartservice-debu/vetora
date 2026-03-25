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
  Info,
  ChevronRight,
  Filter
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ResponsiveContainer,
  LineChart,
  Line
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
              <div className="mt-1 font-medium">{store.owner_email}</div>
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

  // Stores State
  const [stores, setStores] = useState([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [storeLoading, setStoreLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [withdrawalAction, setWithdrawalAction] = useState('completed'); // or 'rejected'

  // Reports State
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportNotes, setReportNotes] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportAction, setReportAction] = useState('resolved'); // or 'dismissed'

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);

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

  const fetchUsers = async () => {
    try {
      setUserLoading(true);
      const data = await adminAPI.getUsers({ search: userSearch });
      setUsers(data.users);
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

  const fetchStores = async () => {
    try {
      setStoreLoading(true);
      const data = await adminAPI.getStores({ 
        search: storeSearch,
        status: storeFilter === 'all' ? undefined : storeFilter
      });
      setStores(data.stores);
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

  const fetchOrders = async () => {
    try {
      setOrderLoading(true);
      const data = await adminAPI.getOrders({ search: orderSearch });
      setOrders(data.orders);
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

  const fetchWithdrawals = async () => {
    try {
      setWithdrawalLoading(true);
      const data = await adminAPI.getWithdrawals();
      setWithdrawals(data.withdrawals);
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

  const fetchReports = async () => {
    try {
      setReportsLoading(true);
      const data = await adminAPI.getReports();
      setReports(data.reports);
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

  useEffect(() => {
    if (activeTab === 'stores') fetchStores();
  }, [storeFilter]);

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
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'stores') fetchStores();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'withdrawals') fetchWithdrawals();
    if (activeTab === 'moderation') fetchReports();
    if (activeTab === 'logs') fetchActivityLogs();
    if (activeTab === 'subscriptions') fetchSubscriptions();
  }, [activeTab]);

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
        <TabsList className="grid w-full grid-cols-9 lg:w-[1150px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
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
                        <p className="text-sm text-muted-foreground">{u.email}</p>
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
                        <p className="text-sm text-muted-foreground">{s.owner_email}</p>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Users Management</CardTitle>
                  <CardDescription>View and manage platform users.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search email or name..."
                      className="pl-8 w-[250px]"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                    />
                  </div>
                  <Button onClick={fetchUsers} disabled={userLoading} size="sm">
                    Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u._id}>
                      <TableCell>
                        <div className="font-medium">{u.display_name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_blocked ? (
                          <Badge variant="destructive">Blocked</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              const newRole = u.role === 'vendor' ? 'user' : 'vendor';
                              adminAPI.updateUserRole(u._id, newRole).then(() => {
                                toast({ title: 'Success', description: 'Role updated' });
                                fetchUsers();
                              });
                            }}>
                              Make {u.role === 'vendor' ? 'User' : 'Vendor'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Store Management</CardTitle>
                  <CardDescription>Approve or manage vendor stores.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                      placeholder="Search name or owner email..."
                      className="pl-8 w-[200px] h-9"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchStores()}
                    />
                  </div>
                  <Button onClick={fetchStores} disabled={storeLoading} size="sm" className="h-9">
                    Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
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
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No stores found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stores.map((s) => (
                      <TableRow key={s._id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{s.name}</span>
                            <span className="text-xs text-muted-foreground font-normal">ID: {s._id.substring(0, 8)}...</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{s.owner_email}</TableCell>
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

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Orders</CardTitle>
                  <CardDescription>View all orders across the platform.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search email or store..."
                      className="pl-8 w-[250px]"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                    />
                  </div>
                  <Button onClick={fetchOrders} disabled={orderLoading} size="sm">
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
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o._id}>
                      <TableCell className="font-mono text-xs">{o._id.substring(0, 8)}...</TableCell>
                      <TableCell>{o.buyer_email}</TableCell>
                      <TableCell>{o.store_name}</TableCell>
                      <TableCell className="font-medium">${o.total}</TableCell>
                      <TableCell>
                        <Badge variant={
                          o.status === 'delivered' ? 'success' : 
                          o.status === 'cancelled' ? 'destructive' : 
                          o.status === 'pending' ? 'warning' : 'default'
                        }>
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <Button onClick={fetchWithdrawals} disabled={withdrawalLoading} variant="ghost" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${withdrawalLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
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
                            <span className="font-medium text-sm">{w.vendor_email}</span>
                            {w.admin_notes && (
                              <span className="text-xs text-muted-foreground italic truncate max-w-[200px]" title={w.admin_notes}>
                                Note: {w.admin_notes}
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
                  Reviewing withdrawal request for {selectedWithdrawal?.vendor_email} of ${selectedWithdrawal?.amount}.
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
                            <span className="font-medium">{sub.vendor_email}</span>
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
              <Button onClick={fetchReports} disabled={reportsLoading} variant="ghost" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${reportsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
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
                                  setIsReportModalOpen(true);
                                }}>
                                  <CheckCircle className="w-4 h-4 mr-2 text-success" /> Resolve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedReport(r);
                                  setReportAction('dismissed');
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
                  {activityLogs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell>
                        <div className="font-medium">{log.user_id?.display_name}</div>
                        <div className="text-[10px] text-muted-foreground">{log.user_id?.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{log.target_type || '-'}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.ip_address || 'Internal'}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
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