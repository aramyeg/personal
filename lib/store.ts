import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools, persist } from 'zustand/middleware'

export type TaskStatus = 'todo' | 'in-progress' | 'done'

export type Task = {
  id: string
  title: string
  status: TaskStatus
  createdAt: number
}

type TaskState = {
  tasks: Task[]
  filter: TaskStatus | 'all'
  lastAction: string | null
}

type TaskActions = {
  addTask: (title: string) => void
  removeTask: (id: string) => void
  moveTask: (id: string, status: TaskStatus) => void
  setFilter: (filter: TaskStatus | 'all') => void
  clearCompleted: () => void
  resetDemo: () => void
}

const initialTasks: Task[] = [
  { id: '1', title: 'Design system architecture', status: 'done', createdAt: Date.now() - 86400000 },
  { id: '2', title: 'Implement state management', status: 'in-progress', createdAt: Date.now() - 43200000 },
  { id: '3', title: 'Write unit tests', status: 'todo', createdAt: Date.now() - 21600000 },
  { id: '4', title: 'Setup CI/CD pipeline', status: 'todo', createdAt: Date.now() },
]

export const useTaskStore = create<TaskState & TaskActions>()(
  devtools(
    persist(
      immer((set) => ({
        tasks: initialTasks,
        filter: 'all',
        lastAction: null,

        addTask: (title) =>
          set((state) => {
            state.tasks.push({
              id: crypto.randomUUID(),
              title,
              status: 'todo',
              createdAt: Date.now(),
            })
            state.lastAction = `Added task: "${title}"`
          }),

        removeTask: (id) =>
          set((state) => {
            const task = state.tasks.find((t) => t.id === id)
            state.tasks = state.tasks.filter((t) => t.id !== id)
            state.lastAction = `Removed task: "${task?.title}"`
          }),

        moveTask: (id, status) =>
          set((state) => {
            const task = state.tasks.find((t) => t.id === id)
            if (task) {
              const oldStatus = task.status
              task.status = status
              state.lastAction = `Moved "${task.title}" from ${oldStatus} to ${status}`
            }
          }),

        setFilter: (filter) =>
          set((state) => {
            state.filter = filter
            state.lastAction = `Filter changed to: ${filter}`
          }),

        clearCompleted: () =>
          set((state) => {
            const count = state.tasks.filter((t) => t.status === 'done').length
            state.tasks = state.tasks.filter((t) => t.status !== 'done')
            state.lastAction = `Cleared ${count} completed tasks`
          }),

        resetDemo: () =>
          set((state) => {
            state.tasks = initialTasks
            state.filter = 'all'
            state.lastAction = 'Demo reset to initial state'
          }),
      })),
      {
        name: 'task-store',
        skipHydration: true,
      }
    ),
    { name: 'TaskStore' }
  )
)

// Helper to get filtered tasks (use inside component, not as selector)
export function getFilteredTasks(tasks: Task[], filter: TaskStatus | 'all'): Task[] {
  if (filter === 'all') return tasks
  return tasks.filter((task) => task.status === filter)
}

// Helper to get counts (use inside component, not as selector)
export function getTaskCounts(tasks: Task[]) {
  return {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }
}
