import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Camera, 
  Upload, 
  Trash2, 
  Clock, 
  Star,
  CheckCircle,
  Loader2,
  ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Tables } from '../../lib/supabase';

type TaskWithAssignment = {
  id: string;
  task: Tables<'tasks'> & {
    category?: Tables<'task_categories'>;
  };
  assigned_to?: string;
  assigned_user?: Tables<'user_profiles'>;
  due_date?: string;
  status: string;
  assigned_at?: string;
  assigned_by?: string;
};

interface TaskCompletionData {
  timeSpent?: number;
  notes?: string;
  proofPhotos?: File[];
}

interface CompleteTaskModalProps {
  isOpen: boolean;
  task: TaskWithAssignment | null;
  onClose: () => void;
  onComplete: (completion: TaskCompletionData) => Promise<void>;
}

interface PhotoPreview {
  file: File;
  url: string;
  id: string;
}

const CompleteTaskModal: React.FC<CompleteTaskModalProps> = ({
  isOpen,
  task,
  onClose,
  onComplete
}) => {
  const [completionData, setCompletionData] = useState<TaskCompletionData>({});
  const [photosPreviews, setPhotosPreviews] = useState<PhotoPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (files: FileList | null) => {
    if (!files) return;

    const newPhotos: PhotoPreview[] = [];
    const maxPhotos = 5;
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    Array.from(files).forEach((file, index) => {
      if (photosPreviews.length + newPhotos.length >= maxPhotos) {
        toast.error(`Maximum ${maxPhotos} photos allowed`);
        return;
      }

      if (file.size > maxFileSize) {
        toast.error(`Photo "${file.name}" is too large. Maximum 5MB per photo.`);
        return;
      }

      if (!allowedTypes.includes(file.type)) {
        toast.error(`Photo "${file.name}" is not a supported format. Use JPG, PNG, or WebP.`);
        return;
      }

      const url = URL.createObjectURL(file);
      newPhotos.push({
        file,
        url,
        id: `photo-${Date.now()}-${index}`
      });
    });

    setPhotosPreviews(prev => [...prev, ...newPhotos]);
    setCompletionData(prev => ({
      ...prev,
      proofPhotos: [...(prev.proofPhotos || []), ...newPhotos.map(p => p.file)]
    }));
  };

  const removePhoto = (photoId: string) => {
    setPhotosPreviews(prev => {
      const photoToRemove = prev.find(p => p.id === photoId);
      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.url);
      }
      const updated = prev.filter(p => p.id !== photoId);
      setCompletionData(prevData => ({
        ...prevData,
        proofPhotos: updated.map(p => p.file)
      }));
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!task) return;

    setIsSubmitting(true);
    try {
      await onComplete(completionData);
      
      // Clean up photo URLs
      photosPreviews.forEach(photo => {
        URL.revokeObjectURL(photo.url);
      });
      
      // Reset form
      setCompletionData({});
      setPhotosPreviews([]);
      onClose();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8, 
      y: 50 
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    }
  };

  const staggerChildren = {
    visible: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (!task) return null;

  const daysOverdue = task.due_date ? (() => {
    const due = new Date(task.due_date);
    const now = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = nowDay.getTime() - dueDay.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  })() : 0;
  
  const isOverdue = daysOverdue > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Complete Task
            </DialogTitle>
            <DialogDescription>
              Mark "{task.task.name}" as completed and provide details about your work.
            </DialogDescription>
          </DialogHeader>

          <motion.div 
            variants={staggerChildren}
            initial="hidden"
            animate="visible"
            className="space-y-6 mt-6"
          >
            {/* Task Summary */}
            <motion.div variants={itemVariants} className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">{task.task.name}</h3>
              <p className="text-gray-600 mb-3">{task.task.description}</p>
              
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {task.task.points} points
                </Badge>
                <Badge variant={task.task.difficulty === 'easy' ? 'default' : 
                             task.task.difficulty === 'medium' ? 'secondary' : 'destructive'}>
                  {task.task.difficulty}
                </Badge>
                {task.task.category && (
                  <Badge variant="outline">
                    {task.task.category.name}
                  </Badge>
                )}
                {task.due_date && (
                  <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                    Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
                    {isOverdue && ` (${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue)`}
                  </Badge>
                )}
              </div>
            </motion.div>

            {/* Time Spent */}
            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="timeSpent" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Time Spent (minutes)
              </Label>
              <Input
                id="timeSpent"
                type="number"
                placeholder={`Estimated: ${task.task.estimated_duration} min`}
                value={completionData.timeSpent || ''}
                onChange={(e) => setCompletionData(prev => ({
                  ...prev,
                  timeSpent: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                min="1"
                max="1440"
              />
            </motion.div>


            {/* Notes */}
            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="notes">Completion Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about how you completed this task..."
                value={completionData.notes || ''}
                onChange={(e) => setCompletionData(prev => ({
                  ...prev,
                  notes: e.target.value
                }))}
                rows={3}
              />
            </motion.div>

            {/* Photo Upload */}
            <motion.div variants={itemVariants} className="space-y-4">
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Proof Photos (Optional)
              </Label>
              
              {/* Upload Area */}
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  handlePhotoUpload(e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      JPG, PNG, or WebP up to 5MB each (max 5 photos)
                    </p>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => handlePhotoUpload(e.target.files)}
                className="hidden"
              />

              {/* Photo Previews */}
              {photosPreviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {photosPreviews.map((photo) => (
                      <motion.div
                        key={photo.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100"
                      >
                        <img
                          src={photo.url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removePhoto(photo.id)}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {/* Points Preview */}
            {isOverdue && (
              <motion.div variants={itemVariants} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">⏰ Late Completion Notice</h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  {daysOverdue === 1 ? (
                    <>
                      <p>• You will receive <strong>0 points</strong> (grace period)</p>
                      <p>• Your streak will continue</p>
                    </>
                  ) : (
                    <>
                      <p>• You will receive <strong>-{task.task.points} points</strong> (penalty)</p>
                      <p>• Your current streak will be broken</p>
                    </>
                  )}
                  <p>• Task completion will still count toward your total</p>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Task
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default CompleteTaskModal;