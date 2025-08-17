import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  Trophy, 
  Zap, 
  Target,
  TrendingUp,
  Award,
  Sparkles
} from 'lucide-react';
import { TaskCompletionResult } from '../../lib/api/tasks';

interface TaskCompletionCelebrationProps {
  isVisible: boolean;
  result: TaskCompletionResult;
  pointsEarned: number;
  streakCount?: number;
  achievements?: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
  }>;
  onComplete: () => void;
}

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  delay: number;
}

const generateConfetti = (count: number): ConfettiPiece[] => {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10,
    rotation: Math.random() * 360,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 0.5
  }));
};

const AnimatedCounter: React.FC<{ 
  from: number; 
  to: number; 
  duration?: number; 
  prefix?: string;
  suffix?: string;
}> = ({ from, to, duration = 1, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    const increment = (to - from) / (duration * 60); // 60fps
    const timer = setInterval(() => {
      setCount(prev => {
        const next = prev + increment;
        if ((increment > 0 && next >= to) || (increment < 0 && next <= to)) {
          clearInterval(timer);
          return to;
        }
        return next;
      });
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [from, to, duration]);

  return (
    <span>
      {prefix}{Math.round(count)}{suffix}
    </span>
  );
};

const TaskCompletionCelebration: React.FC<TaskCompletionCelebrationProps> = ({
  isVisible,
  result,
  pointsEarned,
  streakCount = 0,
  achievements = [],
  onComplete
}) => {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setConfetti(generateConfetti(30));
      
      const sequence = [
        { delay: 0, action: () => setCurrentStep(1) }, // Points animation
        { delay: 1000, action: () => setCurrentStep(2) }, // Streak animation
        { delay: 2000, action: () => setShowAchievements(true) }, // Achievements
        { delay: 4000, action: onComplete } // Complete
      ];

      const timeouts = sequence.map(({ delay, action }) => 
        setTimeout(action, delay)
      );

      return () => timeouts.forEach(clearTimeout);
    }
  }, [isVisible, onComplete]);

  const getPointsColor = () => {
    if (pointsEarned > 0) return 'text-green-500';
    if (pointsEarned < 0) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getPointsIcon = () => {
    if (pointsEarned > 0) return <Target className="w-8 h-8" />;
    if (pointsEarned < 0) return <TrendingUp className="w-8 h-8 transform rotate-180" />;
    return <Star className="w-8 h-8" />;
  };

  const celebrationVariants = {
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

  const confettiVariants = {
    hidden: { y: -10, opacity: 0 },
    visible: { 
      y: "100vh", 
      opacity: [0, 1, 1, 0],
      rotate: 360,
      transition: {
        duration: 3,
        ease: "easeOut"
      }
    }
  };

  const pulseVariants = {
    pulse: {
      scale: [1, 1.2, 1],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        repeatType: "reverse" as const
      }
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Confetti */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confetti.map((piece) => (
              <motion.div
                key={piece.id}
                className="absolute w-2 h-2 rounded"
                style={{
                  backgroundColor: piece.color,
                  left: `${piece.x}%`,
                }}
                variants={confettiVariants}
                initial="hidden"
                animate="visible"
                transition={{
                  delay: piece.delay,
                  duration: 3,
                  ease: "easeOut"
                }}
              />
            ))}
          </div>

          {/* Main Celebration Card */}
          <motion.div
            className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl"
            variants={celebrationVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Success Message */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <motion.div
                  variants={pulseVariants}
                  animate="pulse"
                  className="text-green-500"
                >
                  <Sparkles className="w-8 h-8" />
                </motion.div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Task Completed!
              </h2>
              <p className="text-gray-600">
                {result.message}
              </p>
            </motion.div>

            {/* Points Animation */}
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
                  className={`flex items-center justify-center gap-3 mb-6 p-4 rounded-lg ${
                    pointsEarned > 0 ? 'bg-green-50' : 
                    pointsEarned < 0 ? 'bg-red-50' : 'bg-yellow-50'
                  }`}
                >
                  <div className={getPointsColor()}>
                    {getPointsIcon()}
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${getPointsColor()}`}>
                      <AnimatedCounter 
                        from={0} 
                        to={pointsEarned} 
                        prefix={pointsEarned > 0 ? '+' : ''}
                        suffix=" points"
                        duration={0.8}
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      {pointsEarned > 0 ? 'Points earned' : 
                       pointsEarned < 0 ? 'Points deducted' : 'No points change'}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Streak Animation */}
            <AnimatePresence>
              {currentStep >= 2 && result.maintainsStreak && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 25,
                    delay: 0.2
                  }}
                  className="flex items-center justify-center gap-3 mb-6 p-4 bg-orange-50 rounded-lg"
                >
                  <div className="text-orange-500">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-orange-600">
                      <AnimatedCounter 
                        from={Math.max(0, streakCount - 1)} 
                        to={streakCount} 
                        suffix=" day streak"
                        duration={0.6}
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      {streakCount === 1 ? 'Streak started!' : 'Keep it going!'}
                    </div>
                  </div>
                </motion.div>
              )}
              
              {currentStep >= 2 && !result.maintainsStreak && pointsEarned < 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 300, 
                    damping: 25,
                    delay: 0.2
                  }}
                  className="flex items-center justify-center gap-3 mb-6 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="text-gray-500">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-medium text-gray-600">
                      Streak reset
                    </div>
                    <div className="text-sm text-gray-500">
                      Start fresh tomorrow!
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Achievements */}
            <AnimatePresence>
              {showAchievements && achievements.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center justify-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    New Achievements!
                  </h3>
                  {achievements.map((achievement, index) => (
                    <motion.div
                      key={achievement.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 * index }}
                      className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Award className="w-4 h-4 text-yellow-600" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">
                          {achievement.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {achievement.description}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TaskCompletionCelebration;