import type { BaseEntityHook } from '../core'

export interface TodoItem {
  uid: string
  summary: string
  status: 'needs_action' | 'completed'
  due?: string
  description?: string
}

export interface TodoAttributes {
  friendly_name?: string
  items?: TodoItem[]
  supported_features?: number
}

export interface TodoState extends BaseEntityHook<TodoAttributes> {
  itemCount: number
  items: TodoItem[]
  isLoadingItems?: boolean
  supportsAddItem: boolean
  supportsRemoveItem: boolean
  supportsUpdateItem: boolean
  supportsClearCompleted: boolean
  addItem: (summary: string) => Promise<void>
  removeItem: (uid: string) => Promise<void>
  updateItem: (uid: string, status: 'needs_action' | 'completed') => Promise<void>
  toggleItem: (uid: string) => Promise<void>
  clearCompleted: () => Promise<void>
}

export const TodoFeatures = {
  SUPPORT_ADD_ITEM: 1,
  SUPPORT_REMOVE_ITEM: 2,
  SUPPORT_UPDATE_ITEM: 4,
  // HA remove_completed_items requires DELETE_TODO_ITEM.
  SUPPORT_CLEAR_COMPLETED: 2,
} as const
