import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Heart, 
  Star,
  Sparkles,
  Eye,
  MessageCircle,
  CheckCircle2,
  Timer
} from 'lucide-react';

interface PendingApprovalAnimationProps {
  isVisible: boolean;
  taskName: string;
  onComplete: () => void;
}

const PendingApprovalAnimation: React.FC<PendingApprovalAnimationProps> = ({
  isVisible,
  taskName,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    if (isVisible) {
      // Generate floating sparkles
      const newSparkles = Array.from({ length: 8 }, (_, i) => ({
        id: i,
        x: Math.random() * 80 + 10, // 10-90% of container width
        y: Math.random() * 80 + 10  // 10-90% of container height
      }));
      setSparkles(newSparkles);

      const sequence = [
        { delay: 0, action: () => setCurrentStep(1) }, // Show submission message
        { delay: 1500, action: () => setCurrentStep(2) }, // Show waiting animation
        { delay: 3500, action: onComplete } // Complete
      ];

      const timeouts = sequence.map(({ delay, action }) => 
        setTimeout(action, delay)
      );

      return () => timeouts.forEach(clearTimeout);
    }
  }, [isVisible, onComplete]);

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      transition: { duration: 0.3 }
    }
  };

  const sparkleVariants = {
    float: {
      y: [-10, 10, -10],
      rotate: [0, 180, 360],
      scale: [0.8, 1.2, 0.8],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const eyesVariants = {
    blink: {
      scaleY: [1, 0.1, 1],
      transition: {
        duration: 0.3,
        repeat: Infinity,
        repeatDelay: 2
      }
    }
  };

  const clockVariants = {
    tick: {
      rotate: [0, 6, 0], // Small tick motion
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Floating Sparkles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {sparkles.map((sparkle) => (
              <motion.div
                key={sparkle.id}
                className="absolute text-purple-300"
                style={{
                  left: `${sparkle.x}%`,
                  top: `${sparkle.y}%`,
                }}
                variants={sparkleVariants}
                animate="float"
                transition={{
                  delay: sparkle.id * 0.2,
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
            ))}
          </div>

          {/* Main Animation Card */}
          <motion.div
            className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Cute Character - Eyes looking around */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                {/* Cute waiting face */}
                <div className="relative">
                  {/* Eyes */}
                  <div className="flex gap-3 mb-2">
                    <motion.div 
                      variants={eyesVariants}
                      animate="blink"
                      className="w-3 h-3 bg-gray-800 rounded-full"
                    />
                    <motion.div 
                      variants={eyesVariants}
                      animate="blink"
                      className="w-3 h-3 bg-gray-800 rounded-full"
                    />
                  </div>
                  {/* Cute smile */}
                  <div className="w-4 h-2 border-b-2 border-gray-600 rounded-full mx-auto" />
                </div>
                
                {/* Floating hearts around the character */}
                <motion.div
                  className="absolute -top-2 -right-2 text-pink-400"
                  animate={{
                    scale: [1, 1.3, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Heart className="w-4 h-4 fill-current" />
                </motion.div>
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Task Submitted! 
              </h2>
              <p className="text-gray-600 text-sm">
                "{taskName}" is waiting for approval
              </p>
            </motion.div>

            {/* Submission Success */}
            <AnimatePresence>
              {currentStep >= 1 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 25 
                  }}
                  className="flex items-center justify-center gap-3 mb-6 p-4 bg-purple-50 rounded-lg"
                >
                  <div className="text-purple-500">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-medium text-purple-700">
                      Successfully Submitted! 
                    </div>
                    <div className="text-sm text-purple-600">
                      Your work is ready for review
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Waiting Animation */}
            <AnimatePresence>
              {currentStep >= 2 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 25,
                    delay: 0.2
                  }}
                  className="space-y-4"
                >
                  {/* Waiting Clock */}
                  <div className="flex items-center justify-center gap-3 p-4 bg-amber-50 rounded-lg">
                    <motion.div 
                      className="text-amber-500"
                      variants={clockVariants}
                      animate="tick"
                    >
                      <Timer className="w-6 h-6" />
                    </motion.div>
                    <div>
                      <div className="text-lg font-medium text-amber-700">
                        Awaiting Review
                      </div>
                      <div className="text-sm text-amber-600">
                        An admin will review your work soon!
                      </div>
                    </div>
                  </div>

                  {/* Cute waiting message */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-center"
                  >
                    <div className="flex items-center justify-center gap-2 text-gray-600 mb-3">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm">Your task is in good hands</span>
                      <Eye className="w-4 h-4" />
                    </div>
                    
                    {/* Animated dots */}
                    <div className="flex justify-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-purple-400 rounded-full"
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [1, 0.5, 1],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PendingApprovalAnimation;