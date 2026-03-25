import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { adminAPI } from '@/api/apiClient';
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
  Settings as SettingsIcon
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

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
  const [storeLoading, setStoreLoading] = useState(false);

  // Orders State
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    maintenance_mode: false,
    maintenance_message: ''
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
      const data = await adminAPI.getStores({ search: storeSearch });
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

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'stores') fetchStores();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'withdrawals') fetchWithdrawals();
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update store status',
        variant: 'destructive',
      });
    }
  };

  const handleWithdrawalStatus = async (id, status) => {
    try {
      await adminAPI.updateWithdrawalStatus(id, status);
      toast({
        title: 'Success',
        description: `Withdrawal ${status}`,
      });
      fetchWithdrawals();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update withdrawal status',
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        <TabsList className="grid w-full grid-cols-6 lg:w-[900px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Store Management</CardTitle>
                  <CardDescription>Approve or manage vendor stores.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search store name..."
                      className="pl-8 w-[250px]"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchStores()}
                    />
                  </div>
                  <Button onClick={fetchStores} disabled={storeLoading} size="sm">
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.owner_email}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'active' ? 'success' : s.status === 'pending' ? 'warning' : 'destructive'}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.is_verified ? (
                          <Badge variant="success">Yes</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleUpdateStoreStatus(s._id, 'active')}>
                              Set Active
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStoreStatus(s._id, 'suspended')}>
                              Suspend
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              adminAPI.updateStoreVerification(s._id, !s.is_verified).then(() => {
                                toast({ title: 'Success', description: 'Verification updated' });
                                fetchStores();
                              });
                            }}>
                              {s.is_verified ? 'Remove Verification' : 'Verify Store'}
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
            <CardHeader>
              <CardTitle>Withdrawal Requests</CardTitle>
              <CardDescription>Process vendor withdrawal requests.</CardDescription>
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
                  {withdrawals.map((w) => (
                    <TableRow key={w._id}>
                      <TableCell>{w.vendor_email}</TableCell>
                      <TableCell className="font-medium">${w.amount}</TableCell>
                      <TableCell className="capitalize">{w.payment_method.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <Badge variant={
                          w.status === 'completed' ? 'success' : 
                          w.status === 'pending' ? 'warning' : 
                          w.status === 'rejected' ? 'destructive' : 'default'
                        }>
                          {w.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(w.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        {w.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="text-success h-8" onClick={() => handleWithdrawalStatus(w._id, 'completed')}>
                              <CheckCircle className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive h-8" onClick={() => handleWithdrawalStatus(w._id, 'rejected')}>
                              <AlertCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
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
            <CardContent className="space-y-6">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;