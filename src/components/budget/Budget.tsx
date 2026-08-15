import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Wallet, FileText, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import { usePurchases } from './hooks/usePurchases';
import PurchaseEditorModal from './PurchaseEditorModal';
import {
  PurchaseWithItems,
  deletePurchase,
  getReceiptSignedUrl,
  formatCzk,
} from '../../lib/api/purchases';

const Budget: React.FC = () => {
  const { user } = useAuth();
  const { members } = useHousehold();
  const { purchases, loading, refetch } = usePurchases();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseWithItems | null>(null);

  const memberName = (id: string | null): string => {
    if (id === null) return 'Shared';
    if (id === user?.id) return 'Me';
    const member = members.find(m => m.user_id === id);
    return member?.user_profile?.display_name || 'Unknown';
  };

  // per-owner totals for the breakdown line
  const ownerBreakdown = (purchase: PurchaseWithItems): string => {
    const totals = new Map<string | null, number>();
    for (const item of purchase.purchase_items) {
      totals.set(item.owner_id, (totals.get(item.owner_id) || 0) + item.total_price);
    }
    return [...totals.entries()]
      .map(([owner, sum]) => `${memberName(owner)} ${formatCzk(sum)}`)
      .join(' · ');
  };

  const handleDelete = async (purchase: PurchaseWithItems) => {
    if (!window.confirm(`Delete this purchase from ${purchase.shop_name || 'unknown shop'}?`)) {
      return;
    }
    try {
      await deletePurchase(purchase);
      toast.success('Purchase deleted');
      refetch();
    } catch (error: unknown) {
      console.error('Error deleting purchase:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete purchase');
    }
  };

  const openReceipt = async (path: string) => {
    try {
      const url = await getReceiptSignedUrl(path);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error opening receipt:', error);
      toast.error('Failed to open receipt');
    }
  };

  // group by day, purchases are already sorted newest first
  const grouped = purchases.reduce<{ day: string; items: PurchaseWithItems[] }[]>(
    (groups, purchase) => {
      const day = format(new Date(purchase.purchased_at), 'EEEE d. M. yyyy');
      const last = groups[groups.length - 1];
      if (last && last.day === day) {
        last.items.push(purchase);
      } else {
        groups.push({ day, items: [purchase] });
      }
      return groups;
    },
    []
  );

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-40 bg-gray-200 rounded-xl animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-600 mt-1">Track household spending</p>
        </div>
        <button
          onClick={() => {
            setEditingPurchase(null);
            setEditorOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl hover:from-teal-600 hover:to-emerald-600 transition-all font-medium shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Add Purchase
        </button>
      </div>

      {/* Empty state */}
      {purchases.length === 0 && (
        <div className="text-center py-16">
          <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-600">No purchases yet</p>
          <p className="text-gray-500 mt-1">Add your first shopping trip to start tracking</p>
        </div>
      )}

      {/* Grouped list */}
      <div className="space-y-6">
        {grouped.map((group, groupIndex) => (
          <div key={group.day}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {group.day}
            </h2>
            <div className="space-y-3">
              {group.items.map((purchase, index) => (
                <motion.div
                  key={purchase.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (groupIndex * 3 + index) * 0.05 }}
                  className="bg-white rounded-2xl shadow-lg p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">
                          {purchase.shop_name || 'Shopping'}
                        </span>
                        <span className="text-lg font-bold text-teal-600">
                          {formatCzk(purchase.total_amount)}
                        </span>
                        {purchase.settled_at && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Settled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Paid by {memberName(purchase.paid_by)}
                        {' · '}
                        {purchase.purchase_items.length} item
                        {purchase.purchase_items.length === 1 ? '' : 's'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {ownerBreakdown(purchase)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {purchase.receipt_url && (
                        <button
                          onClick={() => openReceipt(purchase.receipt_url!)}
                          title="View receipt"
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingPurchase(purchase);
                          setEditorOpen(true);
                        }}
                        title="Edit purchase"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(purchase)}
                        title="Delete purchase"
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <PurchaseEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={refetch}
        purchase={editingPurchase}
      />
    </div>
  );
};

export default Budget;
