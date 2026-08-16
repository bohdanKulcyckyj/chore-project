import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Copy, Trash2, CheckCircle, AlertTriangle, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';
import {
  PurchaseWithItems,
  PurchaseItemInput,
  createPurchase,
  updatePurchase,
  uploadReceipt,
  formatCzk,
} from '../../lib/api/purchases';

interface PurchaseEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  purchase?: PurchaseWithItems | null; // null/undefined = create
  taskCompletionId?: string | null; // link new purchase to a Shopping task completion
}

interface ItemRow {
  key: number;
  name: string;
  quantity: string;
  total_price: string;
  owner_id: string | null; // null = shared
}

// Czech habit: comma decimals
const parseNum = (value: string): number => parseFloat(value.replace(',', '.'));

const PurchaseEditorModal: React.FC<PurchaseEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  purchase,
  taskCompletionId,
}) => {
  const { user } = useAuth();
  const { currentHousehold, members } = useHousehold();
  const [loading, setLoading] = useState(false);
  const [shopName, setShopName] = useState('');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [total, setTotal] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const nextKey = useRef(0);

  const newRow = (partial: Partial<ItemRow> = {}): ItemRow => ({
    key: nextKey.current++,
    name: '',
    quantity: '1',
    total_price: '',
    owner_id: null,
    ...partial,
  });

  useEffect(() => {
    if (!isOpen) return;
    setReceiptFile(null);
    if (purchase) {
      setShopName(purchase.shop_name);
      setDate(format(new Date(purchase.purchased_at), 'yyyy-MM-dd'));
      setPaidBy(purchase.paid_by);
      setTotal(String(purchase.total_amount));
      setRows(
        purchase.purchase_items.map(item =>
          newRow({
            name: item.name,
            quantity: String(item.quantity),
            total_price: String(item.total_price),
            owner_id: item.owner_id,
          })
        )
      );
    } else {
      setShopName('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setPaidBy(user?.id || '');
      setTotal('');
      setRows([newRow()]);
    }
  }, [isOpen, purchase, user?.id]);

  const updateRow = (key: number, patch: Partial<ItemRow>) => {
    setRows(prev => prev.map(row => (row.key === key ? { ...row, ...patch } : row)));
  };

  const splitRow = (key: number) => {
    setRows(prev => {
      const index = prev.findIndex(row => row.key === key);
      const row = prev[index];
      const qty = parseNum(row.quantity);
      const price = parseNum(row.total_price);
      const halfQty = isNaN(qty) ? '' : String(qty / 2);
      // keep the sum exact: first half rounded, second gets the remainder
      const half1 = isNaN(price) ? '' : (Math.round((price / 2) * 100) / 100).toFixed(2);
      const half2 = isNaN(price) ? '' : (price - parseNum(half1)).toFixed(2);
      const updated = { ...row, quantity: halfQty, total_price: half1 };
      const copy = newRow({
        name: row.name,
        quantity: halfQty,
        total_price: half2,
        owner_id: row.owner_id,
      });
      return [...prev.slice(0, index), updated, copy, ...prev.slice(index + 1)];
    });
  };

  const removeRow = (key: number) => {
    setRows(prev => prev.filter(row => row.key !== key));
  };

  const assignAll = (ownerId: string | null) => {
    setRows(prev => prev.map(row => ({ ...row, owner_id: ownerId })));
  };

  const itemsSum = rows.reduce((sum, row) => {
    const price = parseNum(row.total_price);
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  const totalNum = total.trim() === '' ? NaN : parseNum(total);
  const sumMismatch = !isNaN(totalNum) && Math.abs(itemsSum - totalNum) >= 0.01;

  const ownerOptions: { id: string | null; label: string }[] = [
    ...members.map(member => ({
      id: member.user_id,
      label:
        member.user_id === user?.id
          ? 'Me'
          : member.user_profile?.display_name || 'Unknown',
    })),
    { id: null, label: 'Shared' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentHousehold || !user) return;

    if (rows.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    for (const row of rows) {
      if (!row.name.trim()) {
        toast.error('Every item needs a name');
        return;
      }
      if (isNaN(parseNum(row.total_price))) {
        toast.error(`Item "${row.name}" needs a valid price`);
        return;
      }
    }

    const items: PurchaseItemInput[] = rows.map(row => ({
      name: row.name.trim(),
      quantity: isNaN(parseNum(row.quantity)) ? 1 : parseNum(row.quantity),
      total_price: parseNum(row.total_price),
      owner_id: row.owner_id,
    }));

    const input = {
      household_id: currentHousehold.id,
      shop_name: shopName.trim(),
      purchased_at: new Date(`${date}T12:00:00`).toISOString(),
      paid_by: paidBy,
      total_amount: isNaN(totalNum) ? Math.round(itemsSum * 100) / 100 : totalNum,
      // only on create; updates leave the existing link untouched (field absent)
      ...(!purchase && taskCompletionId ? { task_completion_id: taskCompletionId } : {}),
    };

    setLoading(true);
    try {
      let purchaseId: string;
      if (purchase) {
        await updatePurchase(purchase.id, input, items);
        purchaseId = purchase.id;
      } else {
        purchaseId = await createPurchase(input, items);
      }

      if (receiptFile) {
        try {
          await uploadReceipt(currentHousehold.id, purchaseId, receiptFile);
        } catch (uploadError) {
          console.error('Receipt upload failed:', uploadError);
          toast.error('Purchase saved, but receipt upload failed');
        }
      }

      toast.success(purchase ? 'Purchase updated!' : 'Purchase added!');
      onSaved();
      onClose();
    } catch (error: unknown) {
      console.error('Error saving purchase:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save purchase');
    } finally {
      setLoading(false);
    }
  };

  const ownerButtons = (
    selected: string | null | undefined,
    onSelect: (id: string | null) => void
  ) => (
    <div className="flex flex-wrap gap-1">
      {ownerOptions.map(option => (
        <button
          key={option.id ?? 'shared'}
          type="button"
          onClick={() => onSelect(option.id)}
          className={`px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
            selected === option.id
              ? 'bg-teal-500 text-white border-teal-500'
              : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-lg lg:max-w-3xl max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-emerald-50">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {purchase ? 'Edit Purchase' : 'Add Purchase'}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 mt-1">
                    Track who bought what
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Shop</label>
                      <input
                        type="text"
                        value={shopName}
                        onChange={e => setShopName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-base"
                        placeholder="e.g., Albert"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                      <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-base"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Paid by *</label>
                      <select
                        value={paidBy}
                        onChange={e => setPaidBy(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-base"
                        required
                      >
                        {members.map(member => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.user_id === user?.id
                              ? 'Me'
                              : member.user_profile?.display_name || 'Unknown'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Items *</label>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Assign all to:</span>
                        {ownerButtons(undefined, assignAll)}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {rows.map(row => (
                        <div key={row.key} className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-xl">
                          <input
                            type="text"
                            value={row.name}
                            onChange={e => updateRow(row.key, { name: e.target.value })}
                            placeholder="Item name"
                            className="flex-1 min-w-[10rem] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.quantity}
                            onChange={e => updateRow(row.key, { quantity: e.target.value })}
                            placeholder="Qty"
                            title="Quantity"
                            className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-center"
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.total_price}
                            onChange={e => updateRow(row.key, { total_price: e.target.value })}
                            placeholder="Kč"
                            title="Price (Kč)"
                            className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-right"
                          />
                          {ownerButtons(row.owner_id, ownerId => updateRow(row.key, { owner_id: ownerId }))}
                          <button
                            type="button"
                            onClick={() => splitRow(row.key)}
                            title="Split row (half qty & price each)"
                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(row.key)}
                            title="Remove row"
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRows(prev => [...prev, newRow()])}
                      className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add item
                    </button>
                  </div>

                  {/* Total + receipt */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Receipt total (Kč)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={total}
                        onChange={e => setTotal(e.target.value)}
                        placeholder={`Items sum: ${formatCzk(itemsSum)}`}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-base"
                      />
                      {sumMismatch && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-amber-600">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          Items sum {formatCzk(itemsSum)} ≠ total {formatCzk(totalNum)}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Receipt PDF (optional)
                      </label>
                      <label className="flex items-center gap-2 px-4 py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-teal-400 cursor-pointer transition-colors">
                        <Paperclip className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          {receiptFile
                            ? receiptFile.name
                            : purchase?.receipt_url
                              ? 'Replace attached receipt…'
                              : 'Attach file…'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl hover:from-teal-600 hover:to-emerald-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {purchase ? 'Save Changes' : 'Add Purchase'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PurchaseEditorModal;
