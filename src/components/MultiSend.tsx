import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Trash2, AlertTriangle, Wallet as WalletIcon, CheckCircle, ExternalLink, Copy, MessageSquare, XCircle } from 'lucide-react';
import { Wallet } from '../types/wallet';
import { fetchBalance, sendTransaction, createTransaction } from '../utils/api';
import { useToast } from '@/hooks/use-toast';

interface Recipient {
  address: string;
  amount: string;
  message: string;
  isValidAddress?: boolean;
  addressError?: string;
}

interface MultiSendProps {
  wallet: Wallet | null;
  balance: number | null;
  nonce: number;
  onBalanceUpdate: (balance: number) => void;
  onNonceUpdate: (nonce: number) => void;
  onTransactionSuccess: () => void;
}

export function MultiSend({ wallet, balance, nonce, onBalanceUpdate, onNonceUpdate, onTransactionSuccess }: MultiSendProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([
    { address: '', amount: '', message: '' }
  ]);
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<Array<{ success: boolean; hash?: string; error?: string; recipient: string; amount: string }>>([]);
  const { toast } = useToast();

  const addRecipient = () => {
    setRecipients([...recipients, { address: '', amount: '', message: '' }]);
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

  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    const updated = recipients.map((recipient, i) => 
      i === index ? { 
        ...recipient, 
        [field]: value,
        // Validate address when it changes
        ...(field === 'address' ? {
          isValidAddress: value ? validateAddress(value) : undefined,
          addressError: value && !validateAddress(value) ? 'Invalid address format' : undefined
        } : {})
      } : recipient
    );
    setRecipients(updated);
  };

  const validateAddress = (address: string) => {
    const octAddressRegex = /^oct[1-9A-HJ-NP-Za-km-z]{44}$/;
    return octAddressRegex.test(address);
  };

  const validateRecipients = () => {
    for (const recipient of recipients) {
      const finalAddress = recipient.address;
      if (!finalAddress || !recipient.amount) {
        return false;
      }
      if (isNaN(Number(recipient.amount)) || Number(recipient.amount) <= 0) {
        return false;
      }
    }
    return true;
  };

  const getTotalAmount = () => {
    return recipients.reduce((total, recipient) => {
      return total + (Number(recipient.amount) || 0);
    }, 0);
  };

  const calculateFee = (amount: number) => {
    // Fee calculation based on CLI logic: 0.001 for < 1000, 0.003 for >= 1000
    return amount < 1000 ? 0.001 : 0.003;
  };

  const getTotalFees = () => {
    return recipients.reduce((total, recipient) => {
      const amount = Number(recipient.amount) || 0;
      return total + calculateFee(amount);
    }, 0);
  };

  const handleSendMultiple = async () => {
    if (!wallet) {
      toast({
        title: "Error",
        description: "No wallet",
        variant: "destructive",
      });
      return;
    }

    if (!validateRecipients()) {
      toast({
        title: "Error",
        description: "Fill all fields",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = getTotalAmount();
    const totalFees = getTotalFees();
    const totalCost = totalAmount + totalFees;
    
    if (balance !== null && totalCost > balance) {
      toast({
        title: "Error",
        description: `Insufficient balance. Need ${totalCost.toFixed(8)} OCT (${totalAmount.toFixed(8)} + ${totalFees.toFixed(8)} fees)`,
        variant: "destructive",
      });
      return;
    }

    // Validate all messages length (max 1024 characters like CLI)
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      if (recipient.message && recipient.message.length > 1024) {
        toast({
          title: "Error",
          description: `Message for recipient ${i + 1} is too long (max 1024 characters)`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsSending(true);
    setResults([]);

    try {
      // Refresh nonce before sending like CLI does
      const freshBalanceData = await fetchBalance(wallet.address);
      let currentNonce = freshBalanceData.nonce;

      const validRecipients = recipients.filter(r => r.address && Number(r.amount) > 0);
      const transactionResults: Array<{ success: boolean; hash?: string; error?: string; recipient: string; amount: string }> = [];

      // Send transactions in batches like CLI does (batch_size = 5)
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < validRecipients.length; i += batchSize) {
        batches.push(validRecipients.slice(i, i + batchSize));
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const batchPromises = [];

        // Prepare all transactions in the batch
        for (let i = 0; i < batch.length; i++) {
          const recipient = batch[i];
          const finalRecipientAddress = recipient.address;
          const txIndex = batchIdx * batchSize + i;
          const transactionNonce = currentNonce + 1 + txIndex;

          const transaction = createTransaction(
            wallet.address,
            finalRecipientAddress,
            Number(recipient.amount),
            transactionNonce,
            wallet.privateKey,
            wallet.publicKey || '',
            recipient.message || undefined // Pass individual message if provided
          );

          batchPromises.push(
            sendTransaction(transaction).then(result => ({
              ...result,
              recipient: recipient.address,
              amount: recipient.amount
            }))
          );
        }

        // Send batch concurrently like CLI
        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const recipient = batch[i];
          
          if (result.status === 'fulfilled') {
            transactionResults.push(result.value);
          } else {
            transactionResults.push({
              success: false,
              error: result.reason?.message || 'Unknown error',
              recipient: recipient.address,
              amount: recipient.amount
            });
          }
        }

        // Small delay between batches like CLI (0.05s)
        if (batchIdx < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      setResults(transactionResults);

      const successCount = transactionResults.filter(r => r.success).length;
      if (successCount > 0) {
        toast({
          title: "Transactions Sent!",
          description: `${successCount} out of ${transactionResults.length} transactions sent successfully`,
        });

        // Reset form if all successful
        if (successCount === transactionResults.length) {
          setRecipients([{ address: '', amount: '', message: '' }]);
        }

        // Update nonce based on successful transactions
        const newNonce = currentNonce + successCount;
        onNonceUpdate(newNonce);

        // Update balance after successful transactions
        // Wait a bit for the balance to potentially update on the server
        setTimeout(async () => {
          try {
            const updatedBalance = await fetchBalance(wallet.address);
            onBalanceUpdate(updatedBalance.balance);
            // Update nonce from server response as well
            onNonceUpdate(updatedBalance.nonce);
          } catch (error) {
            console.error('Failed to refresh balance after transaction:', error);
          }
        }, 2000);
        
        // Notify parent component about successful transaction
        onTransactionSuccess();
      }
    } catch (error) {
      console.error('Multi-send error:', error);
      toast({
        title: "Error",
        description: "Send failed",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!wallet) {
    return (
      <Alert>
        <div className="flex items-start space-x-3">
          <WalletIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <AlertDescription>
            No wallet available. Please generate or import a wallet first.
          </AlertDescription>
        </div>
      </Alert>
    );
  }

  const validRecipients = recipients.filter(r => r.address && Number(r.amount || 0) > 0);
  const totalAmount = getTotalAmount();
  const totalFees = getTotalFees();
  const totalCost = totalAmount + totalFees;
  const currentBalance = balance || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Multi Send
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <AlertDescription>
              Multi-send will create separate transactions for each recipient. 
              Each transaction has its own fee based on the amount sent.
            </AlertDescription>
          </div>
        </Alert>

        {/* Wallet Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Address</Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
              {wallet.address}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Current Balance</Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm">
              {currentBalance.toFixed(8)} OCT
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Recipients</Label>
            <Badge variant="secondary">
              {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          {recipients.map((recipient, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Recipient {index + 1}</span>
                  <div className="flex items-center gap-2">
                    {recipient.amount && (
                      <Badge variant="outline" className="text-xs">
                        Fee: {calculateFee(Number(recipient.amount) || 0).toFixed(3)} OCT
                      </Badge>
                    )}
                    {recipients.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRecipient(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`address-${index}`}>Address</Label>
                    <Input
                      id={`address-${index}`}
                      placeholder="oct..."
                      value={recipient.address}
                      onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                      className="font-mono"
                    />
                    {/* Address Validation */}
                    {recipient.address && (
                      <div className="text-sm">
                        {recipient.isValidAddress ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            Valid address
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-600">
                            <XCircle className="h-3 w-3" />
                            {recipient.addressError || 'Invalid address'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`amount-${index}`}>Amount (OCT)</Label>
                    <Input
                      id={`amount-${index}`}
                      type="number"
                      placeholder="0.00000000"
                      value={recipient.amount}
                      onChange={(e) => updateRecipient(index, 'amount', e.target.value)}
                      step="0.00000001"
                      min="0"
                    />
                  </div>
                </div>

                {/* Individual Message Field */}
                <div className="space-y-2 mt-3">
                  <Label htmlFor={`message-${index}`} className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Message ( Optional )
                  </Label>
                  <Textarea
                    id={`message-${index}`}
                    placeholder="Enter an optional message for this recipient (max 1024 characters)"
                    value={recipient.message}
                    onChange={(e) => updateRecipient(index, 'message', e.target.value)}
                    maxLength={1024}
                    rows={2}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>This message will be included in the transaction to this recipient</span>
                    <span>{recipient.message.length}/1024</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={addRecipient}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Recipient
          </Button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <Label className="text-base font-medium">Transaction Results</Label>
            {results.map((result, index) => (
              <div
                key={index}
                className={`rounded-lg p-3 sm:p-4 ${result.success ? 'bg-green-50 border border-green-200 dark:bg-green-950/50 dark:border-green-800' : 'bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-800'}`}
              >
                <div className="flex items-start space-x-2">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium break-words ${result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                      {result.success ? 'Success' : 'Failed'}
                    </p>
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium">To:</span> <span className="font-mono break-all">{result.recipient}</span>
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Amount:</span> {result.amount} OCT
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Fee:</span> {calculateFee(Number(result.amount) || 0).toFixed(3)} OCT
                      </p>
                      {recipients.find(r => r.address === result.recipient)?.message && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Message:</span> {recipients.find(r => r.address === result.recipient)?.message}
                        </p>
                      )}
                    </div>
                    {result.success && result.hash && (
                      <div className="mt-2">
                        <p className="text-green-700 dark:text-green-300 text-sm">Transaction Hash:</p>
                        <div className="flex flex-col sm:flex-row sm:items-center mt-1 space-y-1 sm:space-y-0 sm:space-x-2">
                          <code className="text-xs bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded font-mono break-all text-green-800 dark:text-green-200 flex-1">
                            {result.hash}
                          </code>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(result.hash!, 'Transaction Hash')}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <a
                              href={`https://octrascan.io/tx/${result.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-6 w-6 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="View on OctraScan"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                    {result.error && (
                      <p className="text-red-700 dark:text-red-300 text-xs mt-1 break-words">{result.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Fee Breakdown */}
        <div className="p-3 sm:p-4 bg-muted rounded-md space-y-3">
          <div className="text-sm font-medium mb-2">Fee Calculation</div>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="text-muted-foreground">
              Fee structure: 0.001 OCT for amounts &lt; 1000, 0.003 OCT for amounts ≥ 1000
            </div>
            {recipients.filter(r => r.address && Number(r.amount) > 0).map((recipient, index) => {
              const amount = Number(recipient.amount) || 0;
              const fee = calculateFee(amount);
              return (
                <div key={index} className="flex justify-between items-center text-xs">
                  <span>Recipient {index + 1} ({amount.toFixed(6)} OCT):</span>
                  <span className="font-mono">{fee.toFixed(3)} OCT</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="p-3 sm:p-4 bg-muted rounded-md space-y-2">
          <div className="text-sm font-medium mb-2">Transaction Summary</div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span>Total Recipients:</span>
              <span>{recipients.filter(r => r.address && Number(r.amount) > 0).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Total Amount:</span>
              <span className="font-mono">{totalAmount.toFixed(8)} OCT</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Total Fees:</span>
              <span className="font-mono">{totalFees.toFixed(8)} OCT</span>
            </div>
            <div className="flex justify-between items-center font-medium">
              <span>Total Cost:</span>
              <span className="font-mono">{totalCost.toFixed(8)} OCT</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Current Balance:</span>
              <span className="font-mono">{currentBalance.toFixed(8)} OCT</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Remaining Balance:</span>
              <span className={`font-mono ${currentBalance - totalCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(currentBalance - totalCost).toFixed(8)} OCT
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Current Nonce:</span>
              <span className="font-mono">{nonce}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Next Nonce:</span>
              <span className="font-mono">{nonce + recipients.filter(r => r.address && Number(r.amount) > 0).length}</span>
            </div>
            {totalCost > currentBalance && (
              <div className="text-red-600 text-xs mt-2 break-words">
                ⚠️ Insufficient balance for this transaction
              </div>
            )}
          </div>
        </div>

        <Button 
          onClick={handleSendMultiple}
          disabled={
            isSending || 
            !validateRecipients() || 
            totalCost > currentBalance || 
            recipients.some(r => r.message && r.message.length > 1024) ||
            recipients.some(r => r.address && !r.isValidAddress)
          }
          className="w-full text-sm sm:text-base"
          size="lg"
        >
          {isSending ? "Sending..." : `Send to ${recipients.filter(r => r.address && Number(r.amount) > 0).length} Recipients`}
        </Button>
      </CardContent>
    </Card>
  );
}