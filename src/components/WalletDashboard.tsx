import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wallet as WalletIcon, 
  Send, 
  History, 
  Lock,
  Copy,
  PieChart,
  Shield,
  Gift,
  Globe,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  Wifi,
  Download,
  Menu
} from 'lucide-react';
import { Balance } from './Balance';
import { MultiSend } from './MultiSend';
import { SendTransaction } from './SendTransaction';
import { PrivateTransfer } from './PrivateTransfer';
import { ClaimTransfers } from './ClaimTransfers';
import { FileMultiSend } from './FileMultiSend';
import { TxHistory } from './TxHistory';
import { ThemeToggle } from './ThemeToggle';
import { ImportWallet } from './ImportWallet';
import { GenerateWallet } from './GenerateWallet';
import { RPCProviderManager } from './RPCProviderManager';
import { ConnectedDAppsManager } from './ConnectedDAppsManager';
import { Wallet } from '../types/wallet';
import { fetchBalance, getTransactionHistory } from '../utils/api';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  type: 'sent' | 'received';
}

interface WalletDashboardProps {
  wallet: Wallet;
  wallets: Wallet[];
  onDisconnect: () => void;
  onSwitchWallet: (wallet: Wallet) => void;
  onAddWallet: (wallet: Wallet) => void;
  onRemoveWallet: (wallet: Wallet) => void;
}

export function WalletDashboard({ 
  wallet, 
  wallets, 
  onDisconnect, 
  onSwitchWallet, 
  onAddWallet, 
  onRemoveWallet 
}: WalletDashboardProps) {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [nonce, setNonce] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddWalletDialog, setShowAddWalletDialog] = useState(false);
  const [showRPCManager, setShowRPCManager] = useState(false);
  const [showDAppsManager, setShowDAppsManager] = useState(false);
  const [addWalletTab, setAddWalletTab] = useState('import');
  const [walletToDelete, setWalletToDelete] = useState<Wallet | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [encryptedBalance, setEncryptedBalance] = useState<any>(null);
  const { toast } = useToast();

  // Debug logging for balance states
  useEffect(() => {
    console.log('WalletDashboard balance state:', {
      wallet: wallet?.address,
      balance,
      encryptedBalance,
      isLoadingBalance,
      isRefreshingData
    });
  }, [wallet, balance, encryptedBalance, isLoadingBalance, isRefreshingData]);

  // Initial data fetch when wallet is connected
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!wallet) return;

      try {
        // Fetch balance and nonce
        setIsLoadingBalance(true);
        const balanceData = await fetchBalance(wallet.address);
        
        // Check if RPC failed (negative balance indicates failure)
        if (balanceData.balance < 0) {
          setBalance(0);
          setEncryptedBalance({
            public: 0,
            public_raw: 0,
            encrypted: 0,
            encrypted_raw: 0,
            total: 0
          });
          setNonce(0);
          toast({
            title: "RPC Connection Failed",
            description: "Failed to connect to RPC provider",
            variant: "destructive",
          });
        } else {
          setBalance(balanceData.balance);
          setNonce(balanceData.nonce);
          console.log('Balance set successfully:', balanceData.balance);
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        setBalance(0);
        setNonce(0);
        toast({
          title: "Error",
          description: "Balance fetch failed",
          variant: "destructive",
        });
      } finally {
        setIsLoadingBalance(false);
      }

      try {
        // Fetch transaction history
        setIsLoadingTransactions(true);
        const historyData = await getTransactionHistory(wallet.address);
        
        if (Array.isArray(historyData)) {
          const transformedTxs = historyData.map((tx) => ({
            ...tx,
            type: tx.from?.toLowerCase() === wallet.address.toLowerCase() ? 'sent' : 'received'
          } as Transaction));
          setTransactions(transformedTxs);
        } else {
          setTransactions([]);
        }
      } catch (error) {
        console.error('Failed to fetch transaction history:', error);
        setTransactions([]);
        toast({
          title: "Error",
          description: "History fetch failed",
          variant: "destructive",
        });
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    fetchInitialData();
  }, [wallet, toast]);

  // Function to refresh all wallet data
  const refreshWalletData = async () => {
    if (!wallet) return;
    
    setIsRefreshingData(true);
    
    try {
      // Fetch balance and nonce
      const balanceData = await fetchBalance(wallet.address);
      
      // Check if RPC failed (negative balance indicates failure)
      if (balanceData.balance < 0) {
        throw new Error('RPC connection failed');
      }
      
      setBalance(balanceData.balance);
      setNonce(balanceData.nonce);
      
      // Fetch transaction history
      try {
        const historyData = await getTransactionHistory(wallet.address);
        
        if (Array.isArray(historyData)) {
          const transformedTxs = historyData.map((tx) => ({
            ...tx,
            type: tx.from?.toLowerCase() === wallet.address.toLowerCase() ? 'sent' : 'received'
          } as Transaction));
          setTransactions(transformedTxs);
        } else {
          setTransactions([]);
        }
      } catch (historyError) {
        console.error('Failed to fetch transaction history:', historyError);
        setTransactions([]);
      }
      
      toast({
        title: "Data Refreshed",
        description: "Wallet data has been updated with new RPC provider",
      });
    } catch (error) {
      console.error('Failed to refresh wallet data:', error);
      
      // Reset all data when refresh fails
      setBalance(0);
      setNonce(0);
      setTransactions([]);
      setEncryptedBalance({
        public: 0,
        public_raw: 0,
        encrypted: 0,
        encrypted_raw: 0,
        total: 0
      });
      
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh data with new RPC provider",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingData(false);
    }
  };

  const handleRPCChange = () => {
    // Close the RPC manager dialog
    setShowRPCManager(false);
    
    // Refresh wallet data with new RPC
    refreshWalletData();
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Copy failed",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    // Lock wallet by setting lock state
    localStorage.setItem('isWalletLocked', 'true');
    
    // Trigger storage events for cross-tab synchronization
    setTimeout(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'isWalletLocked',
        oldValue: 'false',
        newValue: 'true',
        storageArea: localStorage
      }));
    }, 50);
    
    // Call the parent's disconnect handler to update UI state
    onDisconnect();
    setShowLockConfirm(false);
  };

  const handleRemoveWallet = () => {
    if (!walletToDelete) return;
    
    if (wallets.length === 1) {
      toast({
        title: "Cannot Remove",
        description: "You cannot remove the last wallet. Use disconnect instead.",
        variant: "destructive",
      });
      setWalletToDelete(null);
      return;
    }
    
    // Remove from regular wallets storage
    onRemoveWallet(walletToDelete);
    
    // Also remove from encrypted wallets storage
    const encryptedWallets = JSON.parse(localStorage.getItem('encryptedWallets') || '[]');
    const updatedEncryptedWallets = encryptedWallets.filter(
      (w: any) => w.address !== walletToDelete.address
    );
    localStorage.setItem('encryptedWallets', JSON.stringify(updatedEncryptedWallets));
    
    toast({
      title: "Wallet Removed",
      description: "Wallet has been removed successfully",
    });
    
    setWalletToDelete(null);
  };

  const handleImportSuccess = (newWallet: Wallet) => {
    // Ensure the wallet is properly saved before adding
    onAddWallet(newWallet);
    setShowAddWalletDialog(false);
    
    // Force save to localStorage immediately
    const currentWallets = JSON.parse(localStorage.getItem('wallets') || '[]');
    const walletExists = currentWallets.some((w: Wallet) => w.address === newWallet.address);
    if (!walletExists) {
      const updatedWallets = [...currentWallets, newWallet];
      localStorage.setItem('wallets', JSON.stringify(updatedWallets));
      localStorage.setItem('activeWalletId', newWallet.address);
    }
    
    toast({
      title: "Wallet Added",
      description: "New wallet has been added successfully",
    });
  };

  const handleGenerateSuccess = (newWallet: Wallet) => {
    // Ensure the wallet is properly saved before adding
    onAddWallet(newWallet);
    setShowAddWalletDialog(false);
    
    // Force save to localStorage immediately
    const currentWallets = JSON.parse(localStorage.getItem('wallets') || '[]');
    const walletExists = currentWallets.some((w: Wallet) => w.address === newWallet.address);
    if (!walletExists) {
      const updatedWallets = [...currentWallets, newWallet];
      localStorage.setItem('wallets', JSON.stringify(updatedWallets));
      localStorage.setItem('activeWalletId', newWallet.address);
    }
    
    toast({
      title: "Wallet Generated",
      description: "New wallet has been generated and added successfully",
    });
  };

  const handleBalanceUpdate = async (newBalance: number) => {
    setBalance(newBalance);
    console.log('Balance updated in dashboard:', newBalance);
    // Also refresh nonce when balance is updated
    try {
      const balanceData = await fetchBalance(wallet.address);
      setNonce(balanceData.nonce);
    } catch (error) {
      console.error('Failed to refresh nonce:', error);
    }
  };

  const handleNonceUpdate = (newNonce: number) => {
    setNonce(newNonce);
  };

  const handleTransactionsUpdate = (newTransactions: Transaction[]) => {
    setTransactions(newTransactions);
  };

  const handleTransactionSuccess = async () => {
    // Refresh transaction history and balance after successful transaction
    const refreshData = async () => {
      try {
        // Refresh balance and nonce
        const balanceData = await fetchBalance(wallet.address);
        setBalance(balanceData.balance);
        setNonce(balanceData.nonce);

        // Refresh transaction history
        const historyData = await getTransactionHistory(wallet.address);
        
        if (Array.isArray(historyData)) {
          const transformedTxs = historyData.map((tx) => ({
            ...tx,
            type: tx.from?.toLowerCase() === wallet.address.toLowerCase() ? 'sent' : 'received'
          } as Transaction));
          setTransactions(transformedTxs);
        }
      } catch (error) {
        console.error('Failed to refresh data after transaction:', error);
      }
    };

    // Small delay to allow transaction to propagate
    setTimeout(refreshData, 2000);
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <WalletIcon className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-bold">Octra Wallet</h1>
                  <div className="flex items-center space-x-2">
                    {/* Wallet Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm text-muted-foreground">
                              {truncateAddress(wallet.address)}
                            </p>
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-80 max-h-[70vh] p-0">
                        <div className="px-2 pt-1.5 pb-1 text-sm font-medium text-center w-full">
                          Select Wallet ( {wallets.length} )
                        </div>
                        <DropdownMenuSeparator />
                        <div className="max-h-[50vh] overflow-y-auto p-1">
                          {wallets.map((w, i) => (
                            <div
                              key={w.address}
                              className="flex items-center justify-between p-3 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer group"
                              onClick={() => onSwitchWallet(w)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-sm truncate">
                                  #{i + 1} {truncateAddress(w.address)}
                                  </span>
                                  {w.address === wallet.address && (
                                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  )}
                                </div>
                                {w.mnemonic && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Generated wallet
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(w.address, 'Address');
                                  }}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  title="Copy address"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                {wallets.length > 1 && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setWalletToDelete(w);
                                        }}
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                        title="Remove wallet"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Wallet</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove wallet <span className="font-mono">{truncateAddress(w.address)}</span>? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setWalletToDelete(null)}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleRemoveWallet} className="bg-red-600 hover:bg-red-700">
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <DropdownMenuSeparator />
                        <div
                          onClick={() => setShowAddWalletDialog(true)}
                          className="flex items-center justify-center space-x-2 p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm mx-1 mb-1"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Wallet</span>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(wallet.address, 'Address')}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  Connected
                </Badge>
                <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                  Nonce: {nonce}
                </Badge>
                <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                  {wallets.length} Wallet{wallets.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <ThemeToggle />
              
              {/* Desktop Menu Items */}
              <div className="hidden md:flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRPCManager(true)}
                  className="flex items-center gap-2"
                >
                  <Wifi className="h-4 w-4" />
                  RPC
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDAppsManager(true)}
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  dApps
                </Button>
                <Dialog open={showAddWalletDialog} onOpenChange={setShowAddWalletDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Wallet
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Add New Wallet</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col max-h-[calc(90vh-120px)]">
                      <Tabs value={addWalletTab} onValueChange={setAddWalletTab} className="w-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                          <TabsTrigger value="import" className="flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Import
                          </TabsTrigger>
                          <TabsTrigger value="generate" className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Generate
                          </TabsTrigger>
                        </TabsList>
                        
                        <div className="flex-1 overflow-hidden">
                          <ScrollArea className="h-full max-h-[calc(90vh-180px)]">
                            <div className="pr-4">
                              <TabsContent value="import" className="mt-4 data-[state=inactive]:hidden">
                                <ImportWallet onWalletImported={handleImportSuccess} />
                              </TabsContent>
                              
                              <TabsContent value="generate" className="mt-4 data-[state=inactive]:hidden">
                                <GenerateWallet onWalletGenerated={handleGenerateSuccess} />
                              </TabsContent>
                            </div>
                          </ScrollArea>
                        </div>
                      </Tabs>
                    </div>
                  </DialogContent>
                </Dialog>
                <AlertDialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 flex items-center gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      Lock Wallet
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Lock Wallet</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to lock your wallet? You will need to enter your password to unlock it again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisconnect} className="bg-orange-600 hover:bg-orange-700">
                        Lock Wallet
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Mobile Hamburger Menu */}
              <div className="md:hidden">
                <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80">
                    <SheetHeader>
                      <SheetTitle>Additional Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      {/* RPC Provider */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRPCManager(true);
                          setShowMobileMenu(false);
                        }}
                        className="w-full justify-start gap-2"
                      >
                        <Wifi className="h-4 w-4" />
                        RPC Provider
                      </Button>

                      {/* Connected dApps */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDAppsManager(true);
                          setShowMobileMenu(false);
                        }}
                        className="w-full justify-start gap-2"
                      >
                        <Globe className="h-4 w-4" />
                        Connected dApps
                      </Button>

                      {/* Add Wallet */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddWalletDialog(true);
                          setShowMobileMenu(false);
                        }}
                        className="w-full justify-start gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Wallet
                      </Button>

                      {/* Lock Wallet */}
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowLockConfirm(true);
                          setShowMobileMenu(false);
                        }}
                        className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                      >
                        <Lock className="h-4 w-4" />
                        Lock Wallet
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Dialogs - Keep outside of mobile menu for proper functionality */}
              <Dialog open={showAddWalletDialog} onOpenChange={setShowAddWalletDialog}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>Add New Wallet</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col max-h-[calc(90vh-120px)]">
                    <Tabs value={addWalletTab} onValueChange={setAddWalletTab} className="w-full flex flex-col">
                      <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                        <TabsTrigger value="import" className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Import
                        </TabsTrigger>
                        <TabsTrigger value="generate" className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Generate
                        </TabsTrigger>
                      </TabsList>
                      
                      <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full max-h-[calc(90vh-180px)]">
                          <div className="pr-4">
                            <TabsContent value="import" className="mt-4 data-[state=inactive]:hidden">
                              <ImportWallet onWalletImported={handleImportSuccess} />
                            </TabsContent>
                            
                            <TabsContent value="generate" className="mt-4 data-[state=inactive]:hidden">
                              <GenerateWallet onWalletGenerated={handleGenerateSuccess} />
                            </TabsContent>
                          </div>
                        </ScrollArea>
                      </div>
                    </Tabs>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showRPCManager} onOpenChange={setShowRPCManager}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>RPC Provider Management</DialogTitle>
                  </DialogHeader>
                  <RPCProviderManager 
                    onClose={() => setShowRPCManager(false)} 
                    onRPCChange={handleRPCChange}
                  />
                </DialogContent>
              </Dialog>
              
              <Dialog open={showDAppsManager} onOpenChange={setShowDAppsManager}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Connected dApps Management</DialogTitle>
                  </DialogHeader>
                  <ConnectedDAppsManager 
                    wallets={wallets} 
                    onClose={() => setShowDAppsManager(false)} 
                  />
                </DialogContent>
              </Dialog>
              
              <AlertDialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lock Wallet</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to lock your wallet? You will need to enter your password to unlock it again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect} className="bg-orange-600 hover:bg-orange-700">
                      Lock Wallet
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
              {isRefreshingData && (
                <div className="animate-spin h-3 w-3 border border-primary border-t-transparent rounded-full ml-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </TabsTrigger>
            <TabsTrigger value="private" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Private</span>
            </TabsTrigger>
            <TabsTrigger value="claim" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Claim</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Balance 
              wallet={wallet} 
              balance={balance}
              encryptedBalance={encryptedBalance}
              onEncryptedBalanceUpdate={setEncryptedBalance}
              onBalanceUpdate={handleBalanceUpdate}
              isLoading={isLoadingBalance || isRefreshingData}
            />
          </TabsContent>

          <TabsContent value="send">
            <Tabs defaultValue="single" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="single">Single Send</TabsTrigger>
                <TabsTrigger value="multi">Multi Send</TabsTrigger>
                <TabsTrigger value="file">File Multi Send</TabsTrigger>
              </TabsList>
              
              <TabsContent value="single" className="mt-6">
                <SendTransaction
                  wallet={wallet} 
                  balance={balance}
                  nonce={nonce}
                  onBalanceUpdate={handleBalanceUpdate}
                  onNonceUpdate={handleNonceUpdate}
                  onTransactionSuccess={handleTransactionSuccess}
                />
              </TabsContent>
              
              <TabsContent value="multi" className="mt-6">
                <MultiSend 
                  wallet={wallet} 
                  balance={balance}
                  nonce={nonce}
                  onBalanceUpdate={handleBalanceUpdate}
                  onNonceUpdate={handleNonceUpdate}
                  onTransactionSuccess={handleTransactionSuccess}
                />
              </TabsContent>
              
              <TabsContent value="file" className="mt-6">
                <FileMultiSend 
                  wallet={wallet} 
                  balance={balance}
                  nonce={nonce}
                  onBalanceUpdate={handleBalanceUpdate}
                  onNonceUpdate={handleNonceUpdate}
                  onTransactionSuccess={handleTransactionSuccess}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="private">
            <PrivateTransfer
              wallet={wallet}
              onTransactionSuccess={handleTransactionSuccess}
            />
          </TabsContent>

          <TabsContent value="claim">
            <ClaimTransfers
              wallet={wallet}
              onTransactionSuccess={handleTransactionSuccess}
            />
          </TabsContent>


          <TabsContent value="history">
            <TxHistory 
              wallet={wallet} 
              transactions={transactions}
              onTransactionsUpdate={handleTransactionsUpdate}
              isLoading={isLoadingTransactions}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}