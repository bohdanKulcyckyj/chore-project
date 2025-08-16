# Household Duties Manager

A gamified household task management web application that helps families and roommates manage daily chores through points, achievements, and friendly competition.

## Features

### Core Functionality
- **User Authentication**: Secure registration and login system with Supabase Auth
- **Household Management**: Create or join households with invite codes
- **Task System**: Create, assign, and track household tasks with various properties
- **Gamification**: Earn points, track streaks, unlock achievements
- **Real-time Updates**: Live synchronization across all household members
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

### Task Management
- **Task Properties**:
  - Categories (Cleaning, Cooking, Laundry, Shopping, Maintenance, Garden, Pets)
  - Difficulty levels (Easy, Medium, Hard)
  - Point values and estimated duration
  - Recurrence patterns (None, Daily, Weekly, Monthly, Custom)
  - Assignment types (Fixed, Rotating, Flexible)
  
- **Task Assignment**:
  - Manual assignment by admins
  - Auto-distribution algorithms
  - Task claiming for flexible assignments
  - Due date tracking and status management

### Gamification System
- **Points & Rewards**:
  - Base points per task based on difficulty
  - Bonus points for maintaining streaks
  - Level progression system
  - Household leaderboards

- **Achievements**:
  - First Steps - Complete your first task
  - Getting Started - Earn your first 100 points
  - Streak Master - Maintain a 7-day streak
  - Early Bird - Complete 10 morning tasks
  - Night Owl - Complete 10 evening tasks
  - Jack of All Trades - Complete tasks in 5 different categories
  - Perfectionist - Complete 50 tasks without rejection
  - Team Player - Help complete 25 flexible tasks

### Dashboard Views
- **Personal Stats**: Track your points, streaks, and daily progress
- **Today's Tasks**: View and manage tasks due today
- **Quick Actions**: Fast access to common operations
- **Household Overview**: See household statistics and member rankings
- **Notifications**: Stay updated on task assignments and household events

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React Router** for navigation
- **Lucide React** for icons
- **React Hot Toast** for notifications

### Backend & Database
- **Supabase** for backend services:
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Row Level Security (RLS)
  - File storage for attachments

### Database Schema
- **households**: Household information and settings
- **household_members**: User-household relationships with roles
- **tasks**: Task definitions with recurrence patterns
- **task_assignments**: Track task assignments to users
- **task_completions**: Record task completion details
- **user_points**: Gamification stats and levels
- **achievements**: Achievement definitions
- **user_achievements**: Track earned achievements
- **notifications**: System notifications

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd houshold-duties-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run database migrations:
Apply the migrations in `supabase/migrations/` to your Supabase project.

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
houshold-duties-manager/
├── src/
│   ├── components/
│   │   ├── auth/           # Authentication components
│   │   ├── dashboard/      # Dashboard components
│   │   ├── household/      # Household management
│   │   └── layout/         # Layout components
│   ├── hooks/
│   │   ├── useAuth.tsx     # Authentication hook
│   │   └── useHousehold.tsx # Household management hook
│   ├── lib/
│   │   └── supabase.ts     # Supabase client configuration
│   ├── types/
│   │   └── database.ts     # TypeScript database types
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point
├── supabase/
│   └── migrations/         # Database migrations
└── public/                 # Static assets
```

## User Roles

- **Admin**: Full permissions including household management, task creation, and member management
- **Member**: Can view and complete tasks, earn points, and participate in household activities

## Security

- Row Level Security (RLS) enabled on all database tables
- Secure authentication with Supabase Auth
- User data isolation per household
- Proper permission checks for all operations

## Roadmap

### Current Implementation
- ✅ User authentication and profiles
- ✅ Household creation and member management
- ✅ Basic dashboard with stats
- ✅ Database schema and security policies
- ✅ Points and achievement system foundation

### Upcoming Features
- [ ] Full task management (create, edit, delete)
- [ ] Task completion workflow with approvals
- [ ] Calendar view with filtering
- [ ] Leaderboard rankings
- [ ] Notification system
- [ ] Task recurrence and auto-assignment
- [ ] Photo proof uploads
- [ ] Household settings management
- [ ] Dark mode theme
- [ ] Mobile app (PWA)
- [ ] Export functionality
- [ ] Integration with external calendars

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on the GitHub repository.