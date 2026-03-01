import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Helper to get user's couple
async function getUserCouple(userId: string) {
  return prisma.couple.findFirst({
    where: {
      OR: [{ partner1Id: userId }, { partner2Id: userId }],
      status: 'ACTIVE',
    },
  });
}

// =============================================================================
// Browse Quizzes
// =============================================================================

// Get available quizzes
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { category } = req.query;

    const where: any = { isActive: true };
    if (category) where.category = category;

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Get user's completed quizzes
    const couple = await getUserCouple(req.user!.id);
    let attemptedQuizIds: string[] = [];

    if (couple) {
      const attempts = await prisma.quizAttempt.findMany({
        where: {
          coupleId: couple.id,
          completedAt: { not: null },
        },
        select: { quizId: true },
      });
      attemptedQuizIds = attempts.map(a => a.quizId);
    }

    res.json({
      quizzes: quizzes.map(q => ({
        id: q.id,
        title: q.title,
        description: q.description,
        category: q.category,
        difficulty: q.difficulty,
        question_count: q.questionCount,
        time_limit: q.timeLimit,
        xp_reward: q.xpReward,
        icon_url: q.iconUrl,
        image_url: q.imageUrl,
        is_premium: q.isPremium,
        is_attempted: attemptedQuizIds.includes(q.id),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get quiz categories
router.get('/categories', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const categories = [
      { id: 'KNOW_YOUR_PARTNER', name: 'Know Your Partner', description: 'How well do you really know them?', icon: '💭' },
      { id: 'COMPATIBILITY', name: 'Compatibility', description: 'See how compatible you are', icon: '💕' },
      { id: 'COMMUNICATION', name: 'Communication', description: 'Understand your communication styles', icon: '💬' },
      { id: 'LOVE_LANGUAGE', name: 'Love Languages', description: 'Discover how you give and receive love', icon: '❤️' },
      { id: 'FUTURE_GOALS', name: 'Future Goals', description: 'Are your visions aligned?', icon: '🎯' },
      { id: 'FUN', name: 'Fun & Trivia', description: 'Lighthearted quizzes for fun', icon: '🎉' },
      { id: 'RELATIONSHIP_HEALTH', name: 'Relationship Health', description: 'Check in on your relationship', icon: '🌟' },
    ];

    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// Get quiz details
router.get('/:quizId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { quizId } = req.params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!quiz) {
      throw new AppError(404, 'Quiz not found');
    }

    res.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        difficulty: quiz.difficulty,
        question_count: quiz.questionCount,
        time_limit: quiz.timeLimit,
        xp_reward: quiz.xpReward,
        questions: quiz.questions.map(q => ({
          id: q.id,
          question_type: q.questionType,
          question: q.question,
          options: q.options,
          is_about_partner: q.isAboutPartner,
          points: q.points,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Quiz Attempts
// =============================================================================

// Start a quiz
router.post('/:quizId/start', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { quizId } = req.params;

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!quiz) {
      throw new AppError(404, 'Quiz not found');
    }

    // Check for existing in-progress attempt
    const existing = await prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId: req.user!.id,
        completedAt: null,
      },
    });

    if (existing) {
      res.json({
        attempt_id: existing.id,
        already_started: true,
        questions: quiz.questions.map(q => ({
          id: q.id,
          question_type: q.questionType,
          question: q.question,
          options: q.options,
          is_about_partner: q.isAboutPartner,
        })),
      });
      return;
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        coupleId: couple.id,
        userId: req.user!.id,
        answers: [],
        maxScore: quiz.questions.reduce((sum, q) => sum + q.points, 0),
      },
    });

    res.status(201).json({
      attempt_id: attempt.id,
      questions: quiz.questions.map(q => ({
        id: q.id,
        question_type: q.questionType,
        question: q.question,
        options: q.options,
        is_about_partner: q.isAboutPartner,
      })),
      time_limit: quiz.timeLimit,
    });
  } catch (error) {
    next(error);
  }
});

// Submit quiz answers
router.post('/:quizId/submit', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { quizId } = req.params;
    const { attempt_id, answers } = req.body;

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attempt_id },
      include: {
        quiz: {
          include: {
            questions: true,
          },
        },
      },
    });

    if (!attempt || attempt.userId !== req.user!.id) {
      throw new AppError(404, 'Attempt not found');
    }

    if (attempt.completedAt) {
      throw new AppError(400, 'Quiz already submitted');
    }

    // Calculate score
    let score = 0;
    const processedAnswers: any[] = [];

    for (const answer of answers) {
      const question = attempt.quiz.questions.find(q => q.id === answer.question_id);
      if (!question) continue;

      let isCorrect = false;

      // For knowledge-based quizzes
      if (question.correctAnswer) {
        isCorrect = answer.answer === question.correctAnswer;
        if (isCorrect) score += question.points;
      }

      processedAnswers.push({
        questionId: answer.question_id,
        answer: answer.answer,
        isCorrect,
      });
    }

    const timeSpent = Math.floor(
      (Date.now() - attempt.startedAt.getTime()) / 1000
    );

    // Check for partner's attempt to calculate match percentage
    const partnerAttempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId,
        coupleId: couple.id,
        userId: { not: req.user!.id },
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
    });

    let matchPercent: number | null = null;

    if (partnerAttempt) {
      // Compare answers for partner-guess questions
      const partnerAnswers = partnerAttempt.answers as any[];
      let matchCount = 0;
      let comparableCount = 0;

      for (const answer of processedAnswers) {
        const question = attempt.quiz.questions.find(q => q.id === answer.questionId);
        if (question?.isAboutPartner) {
          const partnerAnswer = partnerAnswers.find(
            (pa: any) => pa.questionId === answer.questionId
          );
          if (partnerAnswer) {
            comparableCount++;
            if (partnerAnswer.answer === answer.answer) {
              matchCount++;
            }
          }
        }
      }

      if (comparableCount > 0) {
        matchPercent = Math.round((matchCount / comparableCount) * 100);
      }
    }

    // Calculate XP
    const xpEarned = Math.round(
      attempt.quiz.xpReward * (score / attempt.maxScore)
    );

    // Update attempt
    await prisma.quizAttempt.update({
      where: { id: attempt_id },
      data: {
        answers: processedAnswers,
        score,
        matchPercent,
        xpEarned,
        completedAt: new Date(),
        timeSpent,
      },
    });

    // Add XP to couple
    if (xpEarned > 0) {
      await prisma.couple.update({
        where: { id: couple.id },
        data: {
          xp: { increment: xpEarned },
          relationshipScore: { increment: Math.floor(xpEarned / 2) },
        },
      });
    }

    res.json({
      success: true,
      score,
      max_score: attempt.maxScore,
      percentage: Math.round((score / attempt.maxScore) * 100),
      match_percent: matchPercent,
      xp_earned: xpEarned,
      time_spent: timeSpent,
      answers: processedAnswers.map(a => ({
        question_id: a.questionId,
        your_answer: a.answer,
        is_correct: a.isCorrect,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get quiz results
router.get('/:quizId/results', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { quizId } = req.params;

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    // Get both partners' attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        coupleId: couple.id,
        completedAt: { not: null },
      },
      include: {
        user: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
        quiz: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    const myAttempt = attempts.find(a => a.userId === req.user!.id);
    const partnerAttempt = attempts.find(a => a.userId !== req.user!.id);

    res.json({
      quiz: myAttempt?.quiz ? {
        id: myAttempt.quiz.id,
        title: myAttempt.quiz.title,
        category: myAttempt.quiz.category,
      } : null,
      my_result: myAttempt ? {
        score: myAttempt.score,
        max_score: myAttempt.maxScore,
        percentage: Math.round((myAttempt.score / myAttempt.maxScore) * 100),
        match_percent: myAttempt.matchPercent,
        xp_earned: myAttempt.xpEarned,
        completed_at: myAttempt.completedAt,
      } : null,
      partner_result: partnerAttempt ? {
        user: partnerAttempt.user,
        score: partnerAttempt.score,
        max_score: partnerAttempt.maxScore,
        percentage: Math.round((partnerAttempt.score / partnerAttempt.maxScore) * 100),
        completed_at: partnerAttempt.completedAt,
      } : null,
      both_completed: !!myAttempt && !!partnerAttempt,
    });
  } catch (error) {
    next(error);
  }
});

// Get quiz history
router.get('/history/all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const couple = await getUserCouple(req.user!.id);
    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        coupleId: couple.id,
        completedAt: { not: null },
      },
      include: {
        quiz: true,
        user: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({
      history: attempts.map(a => ({
        id: a.id,
        quiz: {
          id: a.quiz.id,
          title: a.quiz.title,
          category: a.quiz.category,
          icon_url: a.quiz.iconUrl,
        },
        user: a.user,
        score: a.score,
        max_score: a.maxScore,
        percentage: Math.round((a.score / a.maxScore) * 100),
        match_percent: a.matchPercent,
        xp_earned: a.xpEarned,
        completed_at: a.completedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
