import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Plus, Users, Code, ArrowLeft } from 'lucide-react';
import { useHousehold } from '../../hooks/useHousehold';
import toast from 'react-hot-toast';

const HouseholdManager: React.FC = () => {
  const { 
    currentHousehold, 
    households, 
    createHousehold, 
    joinHousehold,
    switchHousehold
  } = useHousehold();
  
  const [view, setView] = useState<'main' | 'create' | 'join'>('main');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    inviteCode: '',
  });

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      const { error } = await createHousehold(formData.name, formData.description);
      if (error) throw error;
      
      toast.success('Household created successfully!');
      setView('main');
      setFormData({ name: '', description: '', inviteCode: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create household');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.inviteCode.trim()) return;

    setLoading(true);
    try {
      const { error } = await joinHousehold(formData.inviteCode);
      if (error) throw error;
      
      toast.success('Joined household successfully!');
      setView('main');
      setFormData({ name: '', description: '', inviteCode: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to join household');
    } finally {
      setLoading(false);
    }
  };

  // If user has households but none selected, show main view
  if (households.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl mb-6"
            >
              <Home className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to ChoreQuest
            </h1>
            <p className="text-xl text-gray-600 max-w-md mx-auto">
              Create or join a household to start managing tasks together
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              onClick={() => setView('create')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all text-left group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Create Household</h2>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Start a new household and invite family members or roommates to join your quest for organized living.
              </p>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              onClick={() => setView('join')}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all text-left group"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Code className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Join Household</h2>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Have an invite code? Join an existing household and start contributing to the shared goals.
              </p>
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-4">
      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Your Households
                </h1>
                <p className="text-gray-600">
                  Manage your household memberships
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {households.map((household) => (
                  <motion.div
                    key={household.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white p-6 rounded-2xl shadow-sm border-2 transition-all cursor-pointer ${
                      currentHousehold?.id === household.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-transparent hover:border-gray-200'
                    }`}
                    onClick={() => switchHousehold(household.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {household.name}
                        </h3>
                        {household.description && (
                          <p className="text-gray-600 mt-1">
                            {household.description}
                          </p>
                        )}
                      </div>
                      {currentHousehold?.id === household.id && (
                        <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Active
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('create')}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Create New
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('join')}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-600 transition-all flex items-center justify-center gap-2"
                >
                  <Code size={20} />
                  Join Existing
                </motion.button>
              </div>
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setView('main')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900">Create Household</h2>
                </div>

                <form onSubmit={handleCreateHousehold} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Household Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="e.g., The Smith Family"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="A brief description of your household..."
                      rows={3}
                    />
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Home size={20} />
                        Create Household
                      </>
                    )}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setView('main')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900">Join Household</h2>
                </div>

                <form onSubmit={handleJoinHousehold} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invite Code *
                    </label>
                    <input
                      type="text"
                      value={formData.inviteCode}
                      onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono text-center text-lg"
                      placeholder="ABC123"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Enter the invite code shared by a household admin
                    </p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-500 text-white py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Users size={20} />
                        Join Household
                      </>
                    )}
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HouseholdManager;