import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ==========================================================================
  // Couple Activities
  // ==========================================================================
  console.log('Creating couple activities...');

  const activities = [
    // Daily Activities
    { title: 'Good Morning Message', description: 'Send a sweet good morning message to your partner', instructions: 'Write a heartfelt message to start their day right. Include something you appreciate about them.', category: 'COMMUNICATION', difficulty: 'EASY', duration: 5, isVirtual: true, requiresBoth: false, xpReward: 10, isDaily: true, iconUrl: '☀️' },
    { title: 'Daily Check-in', description: 'Share how your day went with each other', instructions: 'Take 5 minutes to share the highs and lows of your day. Practice active listening.', category: 'COMMUNICATION', difficulty: 'EASY', duration: 10, isVirtual: true, requiresBoth: true, xpReward: 15, isDaily: true, iconUrl: '💬' },
    { title: 'Send a Compliment', description: 'Tell your partner something you love about them', instructions: 'Be specific! Instead of "you\'re great", try "I love how you always remember the little things"', category: 'ROMANCE', difficulty: 'EASY', duration: 5, isVirtual: true, requiresBoth: false, xpReward: 10, isDaily: true, iconUrl: '💕' },

    // Communication Activities
    { title: '36 Questions to Fall in Love', description: 'Answer deep questions designed to build intimacy', instructions: 'Take turns answering one question at a time. Really listen to your partner\'s answers.', category: 'COMMUNICATION', difficulty: 'MEDIUM', duration: 45, isVirtual: true, requiresBoth: true, xpReward: 40, iconUrl: '❓' },
    { title: 'Dream Sharing', description: 'Share your dreams and aspirations', instructions: 'Each share 3 dreams: one for this year, one for 5 years, and one wild dream.', category: 'COMMUNICATION', difficulty: 'EASY', duration: 20, isVirtual: true, requiresBoth: true, xpReward: 25, iconUrl: '✨' },
    { title: 'Gratitude Exchange', description: 'Share what you\'re grateful for about each other', instructions: 'Take turns sharing 5 things you appreciate about your partner. Be specific!', category: 'COMMUNICATION', difficulty: 'EASY', duration: 15, isVirtual: true, requiresBoth: true, xpReward: 20, iconUrl: '🙏' },
    { title: 'Memory Lane', description: 'Share favorite memories together', instructions: 'Each share your top 3 favorite memories from your relationship. What made them special?', category: 'REFLECTION', difficulty: 'EASY', duration: 20, isVirtual: true, requiresBoth: true, xpReward: 25, iconUrl: '📸' },

    // Games
    { title: 'Two Truths and a Lie', description: 'Test how well you know each other', instructions: 'Take turns sharing two truths and one lie. Can your partner guess which is the lie?', category: 'GAMES', difficulty: 'EASY', duration: 15, isVirtual: true, requiresBoth: true, xpReward: 20, iconUrl: '🎭' },
    { title: 'Would You Rather', description: 'Fun hypothetical questions', instructions: 'Take turns asking "would you rather" questions. Discuss why you chose your answers!', category: 'GAMES', difficulty: 'EASY', duration: 20, isVirtual: true, requiresBoth: true, xpReward: 20, iconUrl: '🤔' },
    { title: 'Online Trivia Night', description: 'Test your knowledge together', instructions: 'Play trivia on the same team! Work together to answer questions.', category: 'GAMES', difficulty: 'MEDIUM', duration: 30, isVirtual: true, requiresBoth: true, xpReward: 30, iconUrl: '🧠' },
    { title: 'Virtual Escape Room', description: 'Solve puzzles together', instructions: 'Work together to escape! Communication is key.', category: 'GAMES', difficulty: 'HARD', duration: 60, isVirtual: true, requiresBoth: true, xpReward: 50, isPremium: true, iconUrl: '🔐' },

    // Creative
    { title: 'Playlist for You', description: 'Create a playlist for your partner', instructions: 'Make a playlist of 10 songs that remind you of them or that you think they\'d love.', category: 'CREATIVE', difficulty: 'MEDIUM', duration: 30, isVirtual: true, requiresBoth: false, xpReward: 25, iconUrl: '🎵' },
    { title: 'Love Letter', description: 'Write a heartfelt love letter', instructions: 'Pour your heart out! Write about why you love them and your hopes for the future.', category: 'CREATIVE', difficulty: 'MEDIUM', duration: 30, isVirtual: true, requiresBoth: false, xpReward: 30, iconUrl: '💌' },
    { title: 'Draw Your Partner', description: 'Create a portrait of each other', instructions: 'Draw your partner from memory. It doesn\'t have to be perfect - it\'s about the thought!', category: 'CREATIVE', difficulty: 'MEDIUM', duration: 20, isVirtual: true, requiresBoth: true, xpReward: 25, iconUrl: '🎨' },

    // Wellness
    { title: 'Guided Meditation Together', description: 'Practice mindfulness as a couple', instructions: 'Find a couples meditation video and do it together over video call.', category: 'WELLNESS', difficulty: 'EASY', duration: 15, isVirtual: true, requiresBoth: true, xpReward: 20, iconUrl: '🧘' },
    { title: 'Virtual Workout', description: 'Exercise together remotely', instructions: 'Pick a workout video and do it together! Cheer each other on.', category: 'WELLNESS', difficulty: 'MEDIUM', duration: 30, isVirtual: true, requiresBoth: true, xpReward: 30, iconUrl: '💪' },

    // Learning
    { title: 'Learn a Phrase', description: 'Teach each other phrases in different languages', instructions: 'Each teach the other 3 phrases in a language you know or are learning.', category: 'LEARNING', difficulty: 'EASY', duration: 15, isVirtual: true, requiresBoth: true, xpReward: 20, iconUrl: '🗣️' },
    { title: 'Book Club for Two', description: 'Read and discuss a book together', instructions: 'Pick a book to read together. Discuss a chapter once a week.', category: 'LEARNING', difficulty: 'MEDIUM', duration: 60, isVirtual: true, requiresBoth: true, xpReward: 40, isWeekly: true, iconUrl: '📚' },

    // Adventure
    { title: 'Virtual Travel Planning', description: 'Plan a dream trip together', instructions: 'Pick a destination and plan every detail together - hotels, activities, restaurants!', category: 'ADVENTURE', difficulty: 'MEDIUM', duration: 45, isVirtual: true, requiresBoth: true, xpReward: 35, iconUrl: '✈️' },
    { title: 'Try Something New', description: 'Each try something new and share', instructions: 'Each person tries a new activity this week, then share your experiences.', category: 'ADVENTURE', difficulty: 'MEDIUM', duration: 30, isVirtual: true, requiresBoth: true, xpReward: 30, isWeekly: true, iconUrl: '🌟' },
  ];

  for (const activity of activities) {
    await prisma.coupleActivity.upsert({
      where: { id: activity.title.toLowerCase().replace(/\s+/g, '-') },
      update: activity,
      create: {
        id: activity.title.toLowerCase().replace(/\s+/g, '-'),
        ...activity,
      },
    });
  }

  // ==========================================================================
  // Quizzes
  // ==========================================================================
  console.log('Creating quizzes...');

  const quizzes = [
    {
      title: 'How Well Do You Know Your Partner?',
      description: 'Test your knowledge about your partner\'s preferences, dreams, and quirks!',
      category: 'KNOW_YOUR_PARTNER',
      difficulty: 'MEDIUM',
      questionCount: 10,
      xpReward: 30,
      iconUrl: '🤔',
      questions: [
        { question: 'What is your partner\'s favorite food?', questionType: 'PARTNER_GUESS', isAboutPartner: true },
        { question: 'What is your partner\'s biggest fear?', questionType: 'PARTNER_GUESS', isAboutPartner: true },
        { question: 'What is your partner\'s dream vacation destination?', questionType: 'PARTNER_GUESS', isAboutPartner: true },
        { question: 'What does your partner find most attractive about you?', questionType: 'PARTNER_GUESS', isAboutPartner: true },
        { question: 'What is your partner\'s love language?', questionType: 'MULTIPLE_CHOICE', options: ['Words of Affirmation', 'Acts of Service', 'Quality Time', 'Physical Touch', 'Gifts'], isAboutPartner: true },
      ],
    },
    {
      title: 'Love Languages',
      description: 'Discover how you and your partner prefer to give and receive love',
      category: 'LOVE_LANGUAGE',
      difficulty: 'EASY',
      questionCount: 15,
      xpReward: 25,
      iconUrl: '❤️',
      questions: [
        { question: 'I feel most loved when my partner...', questionType: 'MULTIPLE_CHOICE', options: ['Tells me they love me', 'Helps me with tasks', 'Spends quality time with me', 'Gives me a hug', 'Surprises me with gifts'] },
        { question: 'When I want to show love, I usually...', questionType: 'MULTIPLE_CHOICE', options: ['Write loving notes', 'Do chores for them', 'Plan date nights', 'Cuddle', 'Buy thoughtful gifts'] },
        { question: 'I feel neglected when my partner...', questionType: 'MULTIPLE_CHOICE', options: ['Doesn\'t say nice things', 'Doesn\'t help around', 'Is always busy', 'Isn\'t affectionate', 'Forgets special dates'] },
      ],
    },
    {
      title: 'Compatibility Check',
      description: 'See how compatible you and your partner are on key topics',
      category: 'COMPATIBILITY',
      difficulty: 'MEDIUM',
      questionCount: 12,
      xpReward: 35,
      iconUrl: '💕',
      questions: [
        { question: 'How important is career success to you?', questionType: 'SCALE' },
        { question: 'How do you prefer to handle conflicts?', questionType: 'MULTIPLE_CHOICE', options: ['Talk it out immediately', 'Take time to cool down', 'Write it out', 'Seek compromise', 'Avoid conflict'] },
        { question: 'What\'s your ideal weekend?', questionType: 'MULTIPLE_CHOICE', options: ['Adventure/outdoors', 'Relaxing at home', 'Socializing', 'Personal hobbies', 'Mix of everything'] },
        { question: 'How do you feel about finances?', questionType: 'MULTIPLE_CHOICE', options: ['Save everything', 'Budget carefully', 'Spend on experiences', 'Live for today', 'Balance saving and spending'] },
      ],
    },
    {
      title: 'Future Goals',
      description: 'Are your visions for the future aligned?',
      category: 'FUTURE_GOALS',
      difficulty: 'MEDIUM',
      questionCount: 10,
      xpReward: 30,
      iconUrl: '🎯',
      questions: [
        { question: 'Where do you see yourself living in 10 years?', questionType: 'TEXT' },
        { question: 'How important is having children to you?', questionType: 'SCALE' },
        { question: 'What\'s your ideal retirement lifestyle?', questionType: 'TEXT' },
        { question: 'Career or family: which takes priority?', questionType: 'SCALE' },
      ],
    },
    {
      title: 'Communication Styles',
      description: 'Understand how you both communicate',
      category: 'COMMUNICATION',
      difficulty: 'EASY',
      questionCount: 8,
      xpReward: 20,
      iconUrl: '💬',
      questions: [
        { question: 'When upset, I prefer to...', questionType: 'MULTIPLE_CHOICE', options: ['Talk about it right away', 'Have some alone time first', 'Write down my thoughts', 'Distract myself', 'Get physical activity'] },
        { question: 'I communicate best through...', questionType: 'MULTIPLE_CHOICE', options: ['Face-to-face conversation', 'Text messages', 'Voice/video calls', 'Written letters', 'Actions, not words'] },
      ],
    },
    {
      title: 'Fun Trivia About Us',
      description: 'Light-hearted questions about your relationship',
      category: 'FUN',
      difficulty: 'EASY',
      questionCount: 10,
      xpReward: 20,
      iconUrl: '🎉',
      questions: [
        { question: 'What was our first date?', questionType: 'TEXT' },
        { question: 'What song reminds you of us?', questionType: 'TEXT' },
        { question: 'What\'s our couple nickname?', questionType: 'TEXT' },
        { question: 'What\'s the funniest thing that happened to us?', questionType: 'TEXT' },
      ],
    },
  ];

  for (const quizData of quizzes) {
    const { questions, ...quiz } = quizData;

    const createdQuiz = await prisma.quiz.upsert({
      where: { id: quiz.title.toLowerCase().replace(/\s+/g, '-') },
      update: quiz,
      create: {
        id: quiz.title.toLowerCase().replace(/\s+/g, '-'),
        ...quiz,
      },
    });

    // Create questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await prisma.quizQuestion.upsert({
        where: { id: `${createdQuiz.id}-q${i + 1}` },
        update: { ...q, order: i },
        create: {
          id: `${createdQuiz.id}-q${i + 1}`,
          quizId: createdQuiz.id,
          ...q,
          order: i,
        },
      });
    }
  }

  // ==========================================================================
  // Achievements
  // ==========================================================================
  console.log('Creating achievements...');

  const achievements = [
    // Streak achievements
    { name: 'First Flame', description: 'Complete your first day together', category: 'STREAK', requirement: { type: 'streak', value: 1 }, xpReward: 10, rarity: 'COMMON', iconUrl: '🔥' },
    { name: 'Week Warriors', description: 'Maintain a 7-day streak', category: 'STREAK', requirement: { type: 'streak', value: 7 }, xpReward: 50, rarity: 'COMMON', iconUrl: '🔥' },
    { name: 'Fortnight Focus', description: 'Maintain a 14-day streak', category: 'STREAK', requirement: { type: 'streak', value: 14 }, xpReward: 100, rarity: 'UNCOMMON', iconUrl: '🔥' },
    { name: 'Monthly Momentum', description: 'Maintain a 30-day streak', category: 'STREAK', requirement: { type: 'streak', value: 30 }, xpReward: 200, rarity: 'RARE', iconUrl: '🔥' },
    { name: 'Quarterly Queens/Kings', description: 'Maintain a 90-day streak', category: 'STREAK', requirement: { type: 'streak', value: 90 }, xpReward: 500, rarity: 'EPIC', iconUrl: '🔥' },
    { name: 'Eternal Flame', description: 'Maintain a 365-day streak', category: 'STREAK', requirement: { type: 'streak', value: 365 }, xpReward: 1000, rarity: 'LEGENDARY', iconUrl: '🔥' },

    // Activity achievements
    { name: 'First Steps', description: 'Complete your first activity together', category: 'ACTIVITY', requirement: { type: 'activities', value: 1 }, xpReward: 20, rarity: 'COMMON', iconUrl: '⭐' },
    { name: 'Getting Started', description: 'Complete 5 activities together', category: 'ACTIVITY', requirement: { type: 'activities', value: 5 }, xpReward: 50, rarity: 'COMMON', iconUrl: '⭐' },
    { name: 'Activity Enthusiasts', description: 'Complete 25 activities together', category: 'ACTIVITY', requirement: { type: 'activities', value: 25 }, xpReward: 150, rarity: 'UNCOMMON', iconUrl: '⭐' },
    { name: 'Activity Aficionados', description: 'Complete 50 activities together', category: 'ACTIVITY', requirement: { type: 'activities', value: 50 }, xpReward: 300, rarity: 'RARE', iconUrl: '⭐' },
    { name: 'Activity Masters', description: 'Complete 100 activities together', category: 'ACTIVITY', requirement: { type: 'activities', value: 100 }, xpReward: 500, rarity: 'EPIC', iconUrl: '⭐' },

    // Quiz achievements
    { name: 'Quiz Curious', description: 'Complete your first quiz', category: 'QUIZ', requirement: { type: 'quizzes', value: 1 }, xpReward: 20, rarity: 'COMMON', iconUrl: '🧠' },
    { name: 'Quiz Lovers', description: 'Complete 10 quizzes together', category: 'QUIZ', requirement: { type: 'quizzes', value: 10 }, xpReward: 100, rarity: 'UNCOMMON', iconUrl: '🧠' },
    { name: 'Quiz Champions', description: 'Complete 25 quizzes together', category: 'QUIZ', requirement: { type: 'quizzes', value: 25 }, xpReward: 250, rarity: 'RARE', iconUrl: '🧠' },

    // Date achievements
    { name: 'First Date (Again!)', description: 'Complete your first planned date', category: 'ACTIVITY', requirement: { type: 'dates', value: 1 }, xpReward: 30, rarity: 'COMMON', iconUrl: '💑' },
    { name: 'Date Night Regulars', description: 'Complete 10 planned dates', category: 'ACTIVITY', requirement: { type: 'dates', value: 10 }, xpReward: 150, rarity: 'UNCOMMON', iconUrl: '💑' },
    { name: 'Date Night Devotees', description: 'Complete 25 planned dates', category: 'ACTIVITY', requirement: { type: 'dates', value: 25 }, xpReward: 300, rarity: 'RARE', iconUrl: '💑' },

    // Level achievements
    { name: 'Level Up!', description: 'Reach level 5', category: 'MILESTONE', requirement: { type: 'level', value: 5 }, xpReward: 50, rarity: 'COMMON', iconUrl: '🏆' },
    { name: 'Rising Stars', description: 'Reach level 10', category: 'MILESTONE', requirement: { type: 'level', value: 10 }, xpReward: 100, rarity: 'UNCOMMON', iconUrl: '🏆' },
    { name: 'Power Couple', description: 'Reach level 25', category: 'MILESTONE', requirement: { type: 'level', value: 25 }, xpReward: 250, rarity: 'RARE', iconUrl: '🏆' },
    { name: 'Relationship Goals', description: 'Reach level 50', category: 'MILESTONE', requirement: { type: 'level', value: 50 }, xpReward: 500, rarity: 'EPIC', iconUrl: '🏆' },
    { name: 'Legendary Lovers', description: 'Reach level 100', category: 'MILESTONE', requirement: { type: 'level', value: 100 }, xpReward: 1000, rarity: 'LEGENDARY', iconUrl: '🏆' },

    // Time-based achievements
    { name: 'One Week Wonder', description: 'Be together for 1 week', category: 'MILESTONE', requirement: { type: 'days_together', value: 7 }, xpReward: 20, rarity: 'COMMON', iconUrl: '📅' },
    { name: 'One Month Strong', description: 'Be together for 1 month', category: 'MILESTONE', requirement: { type: 'days_together', value: 30 }, xpReward: 50, rarity: 'COMMON', iconUrl: '📅' },
    { name: 'Quarter Year', description: 'Be together for 3 months', category: 'MILESTONE', requirement: { type: 'days_together', value: 90 }, xpReward: 100, rarity: 'UNCOMMON', iconUrl: '📅' },
    { name: 'Half Year', description: 'Be together for 6 months', category: 'MILESTONE', requirement: { type: 'days_together', value: 180 }, xpReward: 200, rarity: 'UNCOMMON', iconUrl: '📅' },
    { name: 'Anniversary', description: 'Be together for 1 year', category: 'MILESTONE', requirement: { type: 'days_together', value: 365 }, xpReward: 500, rarity: 'RARE', iconUrl: '🎂' },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { id: achievement.name.toLowerCase().replace(/\s+/g, '-') },
      update: achievement,
      create: {
        id: achievement.name.toLowerCase().replace(/\s+/g, '-'),
        ...achievement,
      },
    });
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
