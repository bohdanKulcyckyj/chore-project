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
- [Supabase CLI](https://supabase.com/docs/guides/local-development) and Docker (for the local backend)

### Install dependencies

```bash
git clone <repository-url>
cd houshold-duties-manager
npm install
```

### Running locally (frontend + backend)

You need **two things running**: the Supabase backend (Postgres + Auth + API, via Docker) and the Vite frontend.

**1. Start the backend** — from the project root:

```bash
supabase start
```

This spins up local Supabase in Docker and applies everything in `supabase/migrations/` (including the API role grants that let `anon`/`authenticated` reach the tables). Once it's up it prints your local URLs and keys. Local ports (from `supabase/config.toml`):

| Service        | URL                       |
|----------------|---------------------------|
| API            | http://127.0.0.1:54321    |
| Studio (DB UI) | http://127.0.0.1:54323    |
| Postgres       | postgresql://127.0.0.1:54322 |
| Inbucket (email) | http://127.0.0.1:54324  |

Copy the printed `API URL` and `anon key` into a `.env` file in the project root:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase start` output>
```

> Lost the values? Run `supabase status` to reprint them.

**2. Start the frontend** — in a second terminal:

```bash
npm run dev
```

The app is served at http://localhost:5173.

**Stopping the backend:** `supabase stop` (add `--no-backup` to also wipe the local DB volume).

### Running against hosted Supabase (alternative)

Instead of `supabase start`, point `.env` at a hosted project and apply the migrations there:

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your project anon key>
```

```bash
supabase link --project-ref <project-ref>
supabase db push   # applies supabase/migrations/ to the hosted DB
npm run dev
```

### Available Scripts

- `npm run dev` - Start the frontend dev server (Vite)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `supabase start` / `supabase stop` - Start/stop the local backend
- `supabase status` - Reprint local URLs and keys

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