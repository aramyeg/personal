'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  ChevronRight,
  RotateCcw,
  Code2,
  Eye,
  Sparkles,
  CheckCircle2,
  Clock,
  ListTodo,
} from 'lucide-react'
import { FadeIn } from '@/components/animation'
import {
  useTaskStore,
  getFilteredTasks,
  getTaskCounts,
  type Task,
  type TaskStatus,
} from '@/lib/store'
import { cn } from '@/lib/utils'

const statusConfig: Record<TaskStatus, { label: string; icon: typeof ListTodo; color: string }> = {
  todo: { label: 'To Do', icon: ListTodo, color: 'text-amber-500' },
  'in-progress': { label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-emerald-500' },
}

const statusOrder: TaskStatus[] = ['todo', 'in-progress', 'done']

export function StateDemo() {
  const [newTask, setNewTask] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Get raw state values
  const allTasks = useTaskStore((state) => state.tasks)
  const filter = useTaskStore((state) => state.filter)
  const lastAction = useTaskStore((state) => state.lastAction)
  const { addTask, removeTask, moveTask, setFilter, clearCompleted, resetDemo } = useTaskStore()

  // Compute derived values with useMemo to avoid recalculation
  const tasks = useMemo(() => getFilteredTasks(allTasks, filter), [allTasks, filter])
  const counts = useMemo(() => getTaskCounts(allTasks), [allTasks])

  // Handle hydration
  useEffect(() => {
    useTaskStore.persist.rehydrate()
    setHydrated(true)
  }, [])

  const handleAddTask = () => {
    if (newTask.trim()) {
      addTask(newTask.trim())
      setNewTask('')
    }
  }

  const handleMoveTask = (task: Task) => {
    const currentIndex = statusOrder.indexOf(task.status)
    const nextIndex = (currentIndex + 1) % statusOrder.length
    moveTask(task.id, statusOrder[nextIndex])
  }

  if (!hydrated) {
    return (
      <section id="state-demo" className="py-24 sm:py-32">
        <div className="section-container">
          <div className="h-96 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading demo...</div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="state-demo" className="py-24 sm:py-32 bg-muted/30">
      <div className="section-container">
        <FadeIn>
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <h2 className="text-3xl sm:text-4xl font-bold">State Management</h2>
          </div>
          <div className="h-1 w-12 bg-primary rounded-full mb-4" />
          <p className="text-muted-foreground max-w-2xl mb-8">
            Interactive demo showcasing Zustand with immer for immutable state updates. Try adding,
            moving, and removing tasks to see the state changes in real-time.
          </p>
        </FadeIn>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Task Board */}
          <FadeIn delay={0.1} className="lg:col-span-2">
            <div className="bg-card rounded-2xl border border-border p-6">
              {/* Header with add task */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="Add a new task..."
                    className="flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddTask}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add</span>
                  </motion.button>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={clearCompleted}
                    className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    Clear Done
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={resetDemo}
                    className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {(['all', ...statusOrder] as const).map((status) => {
                  const count = status === 'all' ? counts.all : counts[status]
                  return (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                        filter === status
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {status === 'all' ? 'All' : statusConfig[status].label}
                      <span className="ml-1.5 opacity-70">({count})</span>
                    </button>
                  )
                })}
              </div>

              {/* Task list */}
              <div className="space-y-2 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {tasks.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No tasks found. Add one above!
                    </motion.div>
                  ) : (
                    tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onMove={() => handleMoveTask(task)}
                        onRemove={() => removeTask(task.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </FadeIn>

          {/* State Inspector */}
          <FadeIn delay={0.2}>
            <div className="bg-card rounded-2xl border border-border overflow-hidden h-fit">
              {/* Toggle between state view and code */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setShowCode(false)}
                  className={cn(
                    'flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                    !showCode
                      ? 'bg-primary/10 text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Eye className="h-4 w-4" />
                  State
                </button>
                <button
                  onClick={() => setShowCode(true)}
                  className={cn(
                    'flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                    showCode
                      ? 'bg-primary/10 text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Code2 className="h-4 w-4" />
                  Code
                </button>
              </div>

              <AnimatePresence mode="wait">
                {showCode ? (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-4"
                  >
                    <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                      <code>{storeCode}</code>
                    </pre>
                  </motion.div>
                ) : (
                  <motion.div
                    key="state"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-4 space-y-4"
                  >
                    {/* Last action */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Last Action</p>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={lastAction}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="text-sm text-primary font-mono"
                        >
                          {lastAction || 'No actions yet'}
                        </motion.p>
                      </AnimatePresence>
                    </div>

                    {/* State tree */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">State Tree</p>
                      <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-[300px] overflow-y-auto">
                        <code className="text-foreground/80">
                          {JSON.stringify(
                            {
                              filter,
                              taskCount: tasks.length,
                              tasks: tasks.slice(0, 3).map((t) => ({
                                id: t.id.slice(0, 8) + '...',
                                title: t.title.slice(0, 20) + (t.title.length > 20 ? '...' : ''),
                                status: t.status,
                              })),
                              '...': tasks.length > 3 ? `+${tasks.length - 3} more` : undefined,
                            },
                            null,
                            2
                          )}
                        </code>
                      </pre>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {statusOrder.map((status) => {
                        const config = statusConfig[status]
                        const Icon = config.icon
                        return (
                          <div
                            key={status}
                            className="bg-muted/50 rounded-lg p-2 text-center"
                          >
                            <Icon className={cn('h-4 w-4 mx-auto mb-1', config.color)} />
                            <p className="text-lg font-bold">{counts[status]}</p>
                            <p className="text-xs text-muted-foreground">{config.label}</p>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FadeIn>
        </div>

        {/* Feature highlights */}
        <FadeIn delay={0.3} className="mt-8">
          <div className="grid sm:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-xl bg-card border border-border"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <feature.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

function TaskCard({
  task,
  onMove,
  onRemove,
}: {
  task: Task
  onMove: () => void
  onRemove: () => void
}) {
  const config = statusConfig[task.status]
  const Icon = config.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, x: -100 }}
      className="group flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
    >
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onMove}
        className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
          task.status === 'done'
            ? 'bg-emerald-500/20'
            : task.status === 'in-progress'
              ? 'bg-blue-500/20'
              : 'bg-amber-500/20'
        )}
      >
        <Icon className={cn('h-4 w-4', config.color)} />
      </motion.button>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-medium truncate transition-all',
            task.status === 'done' && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </p>
        <p className="text-xs text-muted-foreground">{config.label}</p>
      </div>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onMove}
        className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRight className="h-4 w-4" />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onRemove}
        className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-4 w-4" />
      </motion.button>
    </motion.div>
  )
}

const features = [
  {
    icon: Sparkles,
    title: 'Zustand + Immer',
    description: 'Type-safe immutable state updates with familiar mutable syntax.',
  },
  {
    icon: Eye,
    title: 'DevTools Ready',
    description: 'Built-in Redux DevTools integration for debugging state changes.',
  },
  {
    icon: Code2,
    title: 'Minimal Boilerplate',
    description: 'Clean API without actions, reducers, or context providers.',
  },
]

const storeCode = `const useTaskStore = create(
  devtools(
    persist(
      immer((set) => ({
        tasks: [],
        filter: 'all',

        addTask: (title) =>
          set((state) => {
            state.tasks.push({
              id: crypto.randomUUID(),
              title,
              status: 'todo',
            })
          }),

        moveTask: (id, status) =>
          set((state) => {
            const task = state.tasks
              .find((t) => t.id === id)
            if (task) {
              task.status = status
            }
          }),
      })),
      { name: 'task-store' }
    )
  )
)`
