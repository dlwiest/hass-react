---
sidebar_position: 7
---

# Todo

Work with Home Assistant todo lists: add items, check them off, update them, remove them.

## Quick Example

```tsx
// Component approach
<Todo entityId="todo.shopping_list">
  {({ items, itemCount, addItem, toggleItem }) => (
    <div>
      <h3>Shopping List ({itemCount} items)</h3>
      <button onClick={() => addItem('Milk')}>
        Add Milk
      </button>
      {items.map(item => (
        <div key={item.uid}>
          <span>{item.summary}</span>
          <span> - {item.status === 'completed' ? 'DONE' : 'PENDING'}</span>
          <button onClick={() => toggleItem(item.uid)}>
            Toggle
          </button>
        </div>
      ))}
    </div>
  )}
</Todo>

// Hook approach
const shoppingList = useTodo('todo.shopping_list')
<div>
  <h3>Shopping List ({shoppingList.itemCount} items)</h3>
  <button onClick={() => shoppingList.addItem('Milk')}>
    Add Milk
  </button>
  {shoppingList.items.map(item => (
    <div key={item.uid}>
      <span>{item.summary}</span>
      <span> - {item.status === 'completed' ? 'DONE' : 'PENDING'}</span>
      <button onClick={() => shoppingList.toggleItem(item.uid)}>
        Toggle
      </button>
    </div>
  ))}
</div>
```

## Component API

### Basic Usage

```tsx
import { Todo } from 'hass-react'

<Todo entityId="todo.shopping_list">
  {(todoProps) => (
    // Your UI here
  )}
</Todo>
```

### Render Props

The Todo component provides these props to your render function:

#### State Properties
- **`itemCount`** (`number`) - Total number of items in the list
- **`items`** (`TodoItem[]`) - Array of todo items
- **`isLoadingItems`** (`boolean | undefined`) - Whether items are being loaded

#### Support Properties
- **`supportsAddItem`** (`boolean`) - List supports adding new items
- **`supportsRemoveItem`** (`boolean`) - List supports removing items
- **`supportsUpdateItem`** (`boolean`) - List supports updating item status
- **`supportsClearCompleted`** (`boolean`) - List supports bulk clearing completed items. Home Assistant's `remove_completed_items` service requires the delete feature, so this is true exactly when `supportsRemoveItem` is

#### Control Methods
- **`addItem(summary: string)`** - Add a new item to the list
- **`removeItem(uid: string)`** - Remove an item from the list
- **`updateItem(uid: string, status: 'needs_action' | 'completed')`** - Update item status
- **`toggleItem(uid: string)`** - Toggle item between completed and needs action
- **`clearCompleted()`** - Remove all completed items

#### Todo Item Structure
```tsx
interface TodoItem {
  uid: string                              // Unique identifier
  summary: string                          // Item description
  status: 'needs_action' | 'completed'     // Current status
  due?: string                             // Due date (optional)
  description?: string                     // Extended description (optional)
}
```

#### Entity Properties
- **`entityId`** (`string`) - The entity ID
- **`state`** (`string`) - Raw state value from Home Assistant
- **`attributes`** (`object`) - All entity attributes
- **`lastChanged`** (`Date`) - When the entity last changed
- **`lastUpdated`** (`Date`) - When the entity was last updated

## Hook API

### Basic Usage

```tsx
import { useTodo } from 'hass-react'

function MyComponent() {
  const todoList = useTodo('todo.shopping_list')
  
  // All the same properties as component render props
  return <div>{todoList.itemCount} items</div>
}
```

The `useTodo` hook returns the same properties and methods the component passes to its render function.

## List All Todo Lists

Use the `useTodos` hook to retrieve all available todo list entities:

```tsx
import { useTodos } from 'hass-react'

function TodoListList() {
  const todos = useTodos()

  return (
    <div>
      <h2>Available Todo Lists ({todos.length})</h2>
      {todos.map(todo => (
        <div key={todo.entity_id}>
          {todo.attributes.friendly_name || todo.entity_id}
        </div>
      ))}
    </div>
  )
}
```

It returns plain entity objects, one per todo list in your Home Assistant instance.

## Examples

### Simple Todo List

```tsx
<Todo entityId="todo.tasks">
  {({ items, itemCount, addItem, toggleItem, removeItem, attributes }) => (
    <div>
      <h3>{attributes.friendly_name} ({itemCount} items)</h3>
      
      <div>
        <button onClick={() => addItem('New task')}>
          Add Task
        </button>
      </div>
      
      {items.map(item => (
        <div key={item.uid}>
          <span style={{ 
            textDecoration: item.status === 'completed' ? 'line-through' : 'none'
          }}>
            {item.summary}
          </span>
          
          <button onClick={() => toggleItem(item.uid)}>
            {item.status === 'completed' ? 'Undo' : 'Complete'}
          </button>
          
          <button onClick={() => removeItem(item.uid)}>
            Remove
          </button>
        </div>
      ))}
      
      {items.length === 0 && <p>No items in list</p>}
    </div>
  )}
</Todo>
```

### Shopping List with Add Form

```tsx
<Todo entityId="todo.shopping_list">
  {({ items, addItem, toggleItem, removeItem, attributes }) => {
    const [newItem, setNewItem] = useState('')
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (newItem.trim()) {
        addItem(newItem.trim())
        setNewItem('')
      }
    }
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add item to shopping list"
          />
          <button type="submit">Add</button>
        </form>
        
        <div>
          {items
            .filter(item => item.status === 'needs_action')
            .map(item => (
              <div key={item.uid}>
                <span>{item.summary}</span>
                <button onClick={() => toggleItem(item.uid)}>
                  Mark as Bought
                </button>
                <button onClick={() => removeItem(item.uid)}>
                  Remove
                </button>
              </div>
            ))}
        </div>
        
        <h4>Completed</h4>
        <div>
          {items
            .filter(item => item.status === 'completed')
            .map(item => (
              <div key={item.uid}>
                <span style={{ textDecoration: 'line-through' }}>
                  {item.summary}
                </span>
                <button onClick={() => toggleItem(item.uid)}>
                  Uncheck
                </button>
                <button onClick={() => removeItem(item.uid)}>
                  Remove
                </button>
              </div>
            ))}
        </div>
      </div>
    )
  }}
</Todo>
```

### Todo List with Categories

```tsx
<Todo entityId="todo.daily_tasks">
  {({ items, addItem, toggleItem, clearCompleted, supportsClearCompleted, attributes }) => {
    const pendingItems = items.filter(item => item.status === 'needs_action')
    const completedItems = items.filter(item => item.status === 'completed')
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        
        <div>
          <strong>Pending Tasks ({pendingItems.length})</strong>
          {pendingItems.map(item => (
            <div key={item.uid}>
              <span>{item.summary}</span>
              {item.due && <span> - Due: {new Date(item.due).toLocaleDateString()}</span>}
              <button onClick={() => toggleItem(item.uid)}>
                Complete
              </button>
            </div>
          ))}
          {pendingItems.length === 0 && <p>All tasks completed!</p>}
        </div>
        
        <div>
          <strong>Completed Tasks ({completedItems.length})</strong>
          {supportsClearCompleted && completedItems.length > 0 && (
            <button onClick={clearCompleted}>
              Clear All Completed
            </button>
          )}
          {completedItems.map(item => (
            <div key={item.uid}>
              <span style={{ color: 'gray' }}>{item.summary}</span>
              <button onClick={() => toggleItem(item.uid)}>
                Undo
              </button>
            </div>
          ))}
        </div>
        
        <button onClick={() => addItem('New task')}>
          Add Task
        </button>
      </div>
    )
  }}
</Todo>
```

### Multiple Todo Lists

```tsx
function TodoDashboard() {
  const todoLists = [
    'todo.shopping_list',
    'todo.work_tasks',
    'todo.household_chores'
  ]
  
  return (
    <div>
      <h2>Todo Dashboard</h2>
      {todoLists.map(entityId => (
        <Todo key={entityId} entityId={entityId}>
          {({ items, itemCount, addItem, attributes }) => {
            const pendingCount = items.filter(item => item.status === 'needs_action').length
            const completedCount = items.filter(item => item.status === 'completed').length
            
            return (
              <div>
                <h3>{attributes.friendly_name}</h3>
                <p>Pending: {pendingCount}, Completed: {completedCount}</p>
                <button onClick={() => addItem('New item')}>
                  Quick Add
                </button>
              </div>
            )
          }}
        </Todo>
      ))}
    </div>
  )
}
```

### Todo List with Progress

```tsx
<Todo entityId="todo.project_tasks">
  {({ items, itemCount, toggleItem, attributes }) => {
    const completedCount = items.filter(item => item.status === 'completed').length
    const progressPercent = itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0
    
    return (
      <div>
        <h3>{attributes.friendly_name}</h3>
        
        <div>
          Progress: {completedCount} / {itemCount} ({progressPercent}%)
        </div>
        
        <div>
          {items.map(item => (
            <div key={item.uid}>
              <label>
                <input
                  type="checkbox"
                  checked={item.status === 'completed'}
                  onChange={() => toggleItem(item.uid)}
                />
                {item.summary}
              </label>
              {item.description && <p>{item.description}</p>}
            </div>
          ))}
        </div>
      </div>
    )
  }}
</Todo>
```

### Using Hooks

```tsx
import { useTodo } from 'hass-react'

function TodoCard({ entityId }) {
  const todo = useTodo(entityId)
  const [newItemText, setNewItemText] = useState('')
  
  const handleAddItem = () => {
    if (newItemText.trim()) {
      todo.addItem(newItemText.trim())
      setNewItemText('')
    }
  }
  
  const getStatusSummary = () => {
    const pending = todo.items.filter(item => item.status === 'needs_action').length
    const completed = todo.items.filter(item => item.status === 'completed').length
    return { pending, completed }
  }
  
  const { pending, completed } = getStatusSummary()
  
  return (
    <div>
      <h3>{todo.attributes.friendly_name}</h3>
      
      <div>
        Total: {todo.itemCount} | Pending: {pending} | Completed: {completed}
      </div>
      
      {todo.supportsAddItem && (
        <div>
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="New item"
          />
          <button onClick={handleAddItem}>
            Add
          </button>
        </div>
      )}
      
      <div>
        {todo.items.map(item => (
          <div key={item.uid}>
            <span style={{
              textDecoration: item.status === 'completed' ? 'line-through' : 'none',
              color: item.status === 'completed' ? 'gray' : 'black'
            }}>
              {item.summary}
            </span>
            
            {todo.supportsUpdateItem && (
              <button onClick={() => todo.toggleItem(item.uid)}>
                {item.status === 'completed' ? 'Undo' : 'Done'}
              </button>
            )}
            
            {todo.supportsRemoveItem && (
              <button onClick={() => todo.removeItem(item.uid)}>
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
      
      {todo.supportsClearCompleted && completed > 0 && (
        <button onClick={todo.clearCompleted}>
          Clear {completed} Completed Items
        </button>
      )}
      
      <p>Last updated: {todo.lastUpdated.toLocaleTimeString()}</p>
    </div>
  )
}