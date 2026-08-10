// Mock data for testing and examples

export interface MockTodoItem {
  uid: string
  summary: string
  status: 'needs_action' | 'completed'
  due?: string
}

export interface MockCalendarEvent {
  uid: string
  start: string
  end: string
  summary: string
  description?: string
  location?: string
  rrule?: string
}

// Generate dynamic calendar events relative to current date
function generateMockCalendarEvents(): MockCalendarEvent[] {
  const now = new Date()

  // Event happening now
  const currentStart = new Date(now)
  currentStart.setHours(now.getHours() - 1, 0, 0, 0)
  const currentEnd = new Date(now)
  currentEnd.setHours(now.getHours() + 1, 0, 0, 0)

  // Upcoming event today
  const todayStart = new Date(now)
  todayStart.setHours(now.getHours() + 3, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(now.getHours() + 4, 0, 0, 0)

  // Tomorrow event
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)
  const tomorrowEnd = new Date(tomorrow)
  tomorrowEnd.setHours(11, 0, 0, 0)

  // Next week event
  const nextWeek = new Date(now)
  nextWeek.setDate(now.getDate() + 7)
  nextWeek.setHours(14, 0, 0, 0)
  const nextWeekEnd = new Date(nextWeek)
  nextWeekEnd.setHours(15, 30, 0, 0)

  return [
    {
      uid: 'event-1',
      start: currentStart.toISOString().slice(0, 19),
      end: currentEnd.toISOString().slice(0, 19),
      summary: 'Team Standup',
      description: 'Daily team sync',
      location: 'Conference Room A'
    },
    {
      uid: 'event-2',
      start: todayStart.toISOString().slice(0, 19),
      end: todayEnd.toISOString().slice(0, 19),
      summary: 'Design Review',
      description: 'Review new UI mockups',
      location: 'Design Studio'
    },
    {
      uid: 'event-3',
      start: tomorrow.toISOString().slice(0, 19),
      end: tomorrowEnd.toISOString().slice(0, 19),
      summary: 'Client Meeting',
      description: 'Q1 planning session',
      location: 'Zoom'
    },
    {
      uid: 'event-4',
      start: nextWeek.toISOString().slice(0, 19),
      end: nextWeekEnd.toISOString().slice(0, 19),
      summary: 'Sprint Planning',
      description: 'Plan next sprint goals'
    }
  ]
}

// Create fresh stores for each mock connection so mutations cannot leak across mounts or tests
export function createMockTodoItems(): Record<string, MockTodoItem[]> {
  return {
    'todo.shopping_list': [
      { uid: 'shop-1', summary: 'Buy milk', status: 'needs_action' },
      { uid: 'shop-2', summary: 'Get bread', status: 'completed' }
    ],
    'todo.weekend_projects': [
      { uid: 'proj-1', summary: 'Paint fence', status: 'needs_action' },
      { uid: 'proj-2', summary: 'Fix garage door', status: 'completed' }
    ]
  }
}

export function createMockCalendarEvents(): Record<string, MockCalendarEvent[]> {
  return {
    'calendar.personal': generateMockCalendarEvents()
  }
}
