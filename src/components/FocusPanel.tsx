import { FormEvent, useEffect, useMemo, useState } from 'react'

type Priority = 'Low' | 'Normal' | 'High'
type FocusTask = {
  id: string
  title: string
  dueDate: string
  priority: Priority
  completed: boolean
  createdAt: number
}

const STORAGE_KEY = 'jarvis_focus_tasks_v1'

function readTasks(): FocusTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FocusTask[]) : []
  } catch {
    return []
  }
}

function dayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function FocusPanel() {
  const [tasks, setTasks] = useState<FocusTask[]>(readTasks)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(dayKey())
  const [priority, setPriority] = useState<Priority>('Normal')
  const [filter, setFilter] = useState<'All' | 'Open' | 'Done'>('Open')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // Storage may be unavailable in private browsing; keep the current session usable.
    }
  }, [tasks])

  const completed = tasks.filter((task) => task.completed).length
  const openTasks = tasks.filter((task) => !task.completed).length
  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) =>
      filter === 'All' ? true : filter === 'Done' ? task.completed : !task.completed,
    )
    return filtered.sort((a, b) => {
      const priorityOrder: Record<Priority, number> = { High: 0, Normal: 1, Low: 2 }
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      return b.createdAt - a.createdAt
    })
  }, [tasks, filter])

  const addTask = (event: FormEvent) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    setTasks((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: cleanTitle,
        dueDate,
        priority,
        completed: false,
        createdAt: Date.now(),
      },
      ...current,
    ])
    setTitle('')
  }

  const overdue = (task: FocusTask) =>
    !task.completed && Boolean(task.dueDate) && task.dueDate < dayKey()

  return (
    <section className="panel focus-panel" aria-label="Focus board">
      <div className="focus-heading">
        <div>
          <div className="label">Mission control · focus board</div>
          <p className="focus-subtitle">Turn plans into the next clear action.</p>
        </div>
        <div className="focus-progress" aria-label={`${completed} of ${tasks.length} tasks completed`}>
          <strong>{tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%</strong>
          <span>complete</span>
        </div>
      </div>

      <div className="focus-stats">
        <div><strong>{openTasks}</strong><span>Open</span></div>
        <div><strong>{completed}</strong><span>Completed</span></div>
        <div><strong>{tasks.filter(overdue).length}</strong><span>Overdue</span></div>
      </div>

      <form className="focus-form" onSubmit={addTask}>
        <label className="focus-task-input">
          <span className="sr-only">New task</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task or next action…"
            maxLength={160}
            aria-label="New task"
            required
          />
        </label>
        <div className="focus-form-row">
          <label>
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <label>
            <span>Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
            </select>
          </label>
          <button className="btn primary focus-add" type="submit">+ Add</button>
        </div>
      </form>

      <div className="focus-toolbar" aria-label="Task filters">
        {(['Open', 'All', 'Done'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`focus-filter ${filter === option ? 'active' : ''}`}
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
          >
            {option}
          </button>
        ))}
        {completed > 0 && (
          <button type="button" className="focus-clear" onClick={() => setTasks((current) => current.filter((task) => !task.completed))}>
            Clear done
          </button>
        )}
      </div>

      {visibleTasks.length === 0 ? (
        <div className="focus-empty">
          <span aria-hidden="true">✦</span>
          <strong>{filter === 'Done' ? 'No completed tasks yet' : filter === 'All' ? 'Your board is clear' : 'You’re all caught up'}</strong>
          <p>Add a task above to give JARVIS your next mission.</p>
        </div>
      ) : (
        <ul className="focus-list">
          {visibleTasks.map((task) => (
            <li key={task.id} className={`focus-task ${task.completed ? 'is-done' : ''}`}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={(event) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: event.target.checked } : item))}
                aria-label={`Mark ${task.title} ${task.completed ? 'open' : 'complete'}`}
              />
              <div className="focus-task-body">
                <strong>{task.title}</strong>
                <div className="focus-task-meta">
                  <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                  {task.dueDate && <span className={overdue(task) ? 'due overdue' : 'due'}>{overdue(task) ? 'Overdue · ' : 'Due · '}{task.dueDate}</span>}
                </div>
              </div>
              <button type="button" className="focus-delete" onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))} aria-label={`Delete ${task.title}`} title="Delete task">×</button>
            </li>
          ))}
        </ul>
      )}
      <p className="small focus-footnote">Tasks are saved on this device in this browser. They are not synced across devices.</p>
    </section>
  )
}
