import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, RefreshCw, Wallet, Eye, EyeOff, Lock, Unlock, ArrowUpDown } from 'lucide-react';
import { Wallet as WalletType } from '../types/wallet';
import { fetchBalance, fetchEncryptedBalance, encryptBalance, decryptBalance, getPendingPrivateTransfers } from '../utils/api';
import { useToast } from '@/hooks/use-toast';
import { EncryptBalanceDialog } from './EncryptBalanceDialog';
import { DecryptBalanceDialog } from './DecryptBalanceDialog';
import { ExportPrivateKeys } from './ExportPrivateKeys';

interface BalanceProps {
  wallet: WalletType | null;
  balance: number | null;
  encryptedBalance?: any;
  onEncryptedBalanceUpdate?: (encryptedBalance: any) => void;
  onBalanceUpdate: (balance: number) => void;
  isLoading?: boolean;
}

export function Balance({ wallet, balance, encryptedBalance: propEncryptedBalance, onEncryptedBalanceUpdate, onBalanceUpdate, isLoading = false }: BalanceProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [localEncryptedBalance, setLocalEncryptedBalance] = useState<any>(null);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [showEncryptDialog, setShowEncryptDialog] = useState(false);
  const [showDecryptDialog, setShowDecryptDialog] = useState(false);
  const { toast } = useToast();

  // Always use prop encrypted balance if provided, otherwise use local state
  const encryptedBalance = propEncryptedBalance !== undefined ? propEncryptedBalance : localEncryptedBalance;
  const setEncryptedBalance = onEncryptedBalanceUpdate || setLocalEncryptedBalance;

  // Debug logging
  useEffect(() => {
    console.log('Balance component state:', {
      wallet: wallet?.address,
      balance,
      encryptedBalance,
      isLoading,
      propEncryptedBalance,
      localEncryptedBalance
    });
  }, [wallet, balance, encryptedBalance, isLoading, propEncryptedBalance, localEncryptedBalance]);

  const fetchWalletBalance = async () => {
    if (!wallet) return;
    
    setRefreshing(true);
    try {
      const balanceData = await fetchBalance(wallet.address);
      
      // Check if RPC failed (negative balance indicates failure)
      if (balanceData.balance < 0) {
        // RPC failed, reset all balances to 0
        onBalanceUpdate(0);
        setEncryptedBalance({
          public: 0,
          public_raw: 0,
          encrypted: 0,
          encrypted_raw: 0,
          total: 0
        });
        setPendingTransfers([]);
        
        toast({
          title: "Error 500",
          description: "Failed to refresh balance. Check RPC connection.",
          variant: "destructive",
        });
        return;
      }
      
      onBalanceUpdate(balanceData.balance);
      
      console.log('Fetching encrypted balance for:', wallet.address);
      // Fetch encrypted balance
      try {
        const encData = await fetchEncryptedBalance(wallet.address, wallet.privateKey);
        if (encData) {
          setEncryptedBalance(encData);
          console.log('Encrypted balance set:', encData);
        } else {
          // Reset encrypted balance to default values when fetch fails
          const defaultEncBalance = {
            public: balanceData.balance,
            public_raw: Math.floor(balanceData.balance * 1_000_000),
            encrypted: 0,
            encrypted_raw: 0,
            total: balanceData.balance
          };
          setEncryptedBalance(defaultEncBalance);
          console.log('Set default encrypted balance:', defaultEncBalance);
        }
      } catch (encError) {
        console.error('Failed to fetch encrypted balance:', encError);
        const defaultEncBalance = {
          public: balanceData.balance,
          public_raw: Math.floor(balanceData.balance * 1_000_000),
          encrypted: 0,
          encrypted_raw: 0,
          total: balanceData.balance
        };
        setEncryptedBalance(defaultEncBalance);
        console.log('Set fallback encrypted balance:', defaultEncBalance);
      }
      
      // Fetch pending private transfers
      try {
        const pending = await getPendingPrivateTransfers(wallet.address, wallet.privateKey);
        setPendingTransfers(pending);
      } catch (error) {
        console.error('Failed to fetch pending transfers:', error);
        setPendingTransfers([]);
      }
      
      toast({
        title: "Balance Updated",
        description: "Balance has been refreshed successfully",
      });
    } catch (error) {
      // Reset all balances to 0 when RPC fails
      onBalanceUpdate(0);
      setEncryptedBalance({
        public: 0,
        public_raw: 0,
        encrypted: 0,
        encrypted_raw: 0,
        total: 0
      });
      setPendingTransfers([]);
      
      toast({
        title: "Error 500",
        description: "Failed to refresh balance. Check RPC connection.",
        variant: "destructive",
      });
      console.error('Balance fetch error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial fetch of encrypted balance
  useEffect(() => {
    if (wallet) {
      // Fetch balance first to check RPC connectivity
      fetchBalance(wallet.address)
        .then(balanceData => {
          // Check if RPC failed (negative balance indicates failure)
          if (balanceData.balance < 0) {
            // RPC failed, reset everything to 0
            setEncryptedBalance({
              public: 0,
              public_raw: 0,
              encrypted: 0,
              encrypted_raw: 0,
              total: 0
            });
            setPendingTransfers([]);
          } else {
            // RPC works, fetch encrypted balance
            return fetchEncryptedBalance(wallet.address, wallet.privateKey)
              .then(encData => {
                if (encData) {
                  setEncryptedBalance(encData);
                } else {
                  setEncryptedBalance({
                    public: balanceData.balance,
                    public_raw: Math.floor(balanceData.balance * 1_000_000),
                    encrypted: 0,
                    encrypted_raw: 0,
                    total: balanceData.balance
                  });
                }
              })
              .then(() => {
                // Fetch pending transfers
                return getPendingPrivateTransfers(wallet.address, wallet.privateKey)
                  .then(setPendingTransfers)
                  .catch(error => {
                    console.error('Failed to fetch pending transfers on mount:', error);
                    setPendingTransfers([]);
                  });
              });
          }
        })
        .catch(error => {
          console.error('Failed to fetch balance on mount:', error);
          // Reset everything to 0 when RPC fails
          setEncryptedBalance({
            public: 0,
            public_raw: 0,
            encrypted: 0,
            encrypted_raw: 0,
            total: 0
          });
          setPendingTransfers([]);
        });
    }
  }, [wallet, setEncryptedBalance]);

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

  const handleEncryptSuccess = () => {
    setShowEncryptDialog(false);
    fetchWalletBalance();
  };

  const handleDecryptSuccess = () => {
    setShowDecryptDialog(false);
    fetchWalletBalance();
  };

  if (!wallet) {
    return (
      <Alert>
        <div className="flex items-start space-x-3">
          <Wallet className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <AlertDescription>
            No wallet available. Please generate or import a wallet first.
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-2xl font-bold">Wallet Overview</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchWalletBalance}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Public Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-muted-foreground">Public Balance</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="flex items-center gap-x-2" key={`balance-${balance}`}>
                  <div className="text-2xl font-bold text-blue-600" title={`Balance: ${balance}`}>
                    {balance !== null && balance !== undefined ? `${balance.toFixed(8)}` : '0.00000000'}
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold mt-0.5">
                    OCT
                  </Badge>
                </div>
              )}
            </div>

            {/* Encrypted Balance */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-muted-foreground">Private Balance</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="flex items-center gap-x-2" key={`encrypted-${encryptedBalance?.encrypted}`}>
                  <div className="text-2xl font-bold text-yellow-600" title={`Encrypted Balance: ${encryptedBalance?.encrypted}`}>
                    {encryptedBalance && encryptedBalance.encrypted !== undefined ? `${encryptedBalance.encrypted.toFixed(8)}` : '0.00000000'}
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold mt-0.5">
                    OCT
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Total Balance */}
          {encryptedBalance && (
            <div className="pt-5 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Balance</span>
                <div className="text-lg font-bold text-green-600">
                  {encryptedBalance.total.toFixed(8)} OCT
                </div>
              </div>
            </div>
          )}

          {/* Pending Transfers */}
          {pendingTransfers.length > 0 && (
            <div className="pt-5 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Claimable Transfers</span>
                <Badge variant="outline" className="text-green-600 pb-1">
                  {pendingTransfers.length} pending
                </Badge>
              </div>
            </div>
          )}

          {/* Balance Actions */}
          <div className="flex flex-wrap justify-center gap-2 pt-5 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEncryptDialog(true)}
              disabled={!balance || balance <= 1}
              className="flex items-center gap-2"
            >
              <Lock className="h-4 w-4" />
              Encrypt Balance
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDecryptDialog(true)}
              disabled={!encryptedBalance || encryptedBalance.encrypted <= 0}
              className="flex items-center gap-2"
            >
              <Unlock className="h-4 w-4" />
              Decrypt Balance
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Private Keys */}
      <ExportPrivateKeys wallet={wallet} />

      {/* Dialogs */}
      <EncryptBalanceDialog
        open={showEncryptDialog}
        onOpenChange={setShowEncryptDialog}
        wallet={wallet}
        publicBalance={balance || 0}
        onSuccess={handleEncryptSuccess}
      />

      <DecryptBalanceDialog
        open={showDecryptDialog}
        onOpenChange={setShowDecryptDialog}
        wallet={wallet}
        encryptedBalance={encryptedBalance?.encrypted || 0}
        onSuccess={handleDecryptSuccess}
      />
    </div>
  );
}