import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { debounce } from 'frappe-ui'
import { useNewDoc, useDoc } from 'frappe-ui/src/data-fetching'
import { useRouter } from 'vue-router'
import type { GPDraft } from '@/types/doctypes'
import type { DraftData, DraftDocument, DraftMethods } from './types'

export interface AutoSaveStatus {
  isSaving: boolean
  lastSaved: Date | null
  hasUnsavedChanges: boolean
  error: string | null
}

export function useAutoSave(
  draftData: Ref<DraftData>,
  draftDoc: Ref<DraftDocument>,
  isDraftChanged: ComputedRef<boolean>
) {
  const router = useRouter()
  
  const saveStatus = ref<AutoSaveStatus>({
    isSaving: false,
    lastSaved: null,
    hasUnsavedChanges: false,
    error: null
  })

  const canAutoSave = computed(() => {
    return draftData.value.title.trim().length > 0 && !saveStatus.value.isSaving
  })

  async function createDraft() {
    if (!canAutoSave.value) return

    const draft = useNewDoc<GPDraft>('GP Draft', {
      title: draftData.value.title,
      content: draftData.value.content,
      project: draftData.value.project || undefined,
      type: 'Discussion',
    })

    const doc = await draft.submit()
    
    // Update URL to include draft ID without navigation
    const newQuery = { ...router.currentRoute.value.query, draft: doc.name }
    router.replace({ query: newQuery })
    
    // Set up the draft document for future updates
    draftDoc.value = useDoc<GPDraft, DraftMethods>({
      doctype: 'GP Draft',
      name: doc.name,
      methods: {
        publish: 'publish',
      },
    })
    
    return doc
  }

  async function updateDraft() {
    if (!draftDoc.value?.doc || !canAutoSave.value) return

    await draftDoc.value.setValue.submit({
      title: draftData.value.title,
      content: draftData.value.content,
      project: draftData.value.project || undefined,
    })
  }

  async function performSave() {
    if (!canAutoSave.value) return

    saveStatus.value.isSaving = true
    saveStatus.value.error = null

    try {
      if (draftDoc.value?.doc) {
        await updateDraft()
      } else {
        await createDraft()
      }
      
      saveStatus.value.lastSaved = new Date()
      saveStatus.value.hasUnsavedChanges = false
    } catch (error) {
      console.error('Auto-save failed:', error)
      saveStatus.value.error = 'Failed to save draft'
    } finally {
      saveStatus.value.isSaving = false
    }
  }

  // Debounced auto-save for typing
  const debouncedSave = debounce(performSave, 300)

  // Immediate save for blur events
  const immediateSave = () => {
    if (canAutoSave.value) {
      performSave()
    }
  }

  // Watch for any changes and auto-save
  watch(
    () => [draftData.value.title, draftData.value.content, draftData.value.project],
    () => {
      const hasContent = draftData.value.title.trim() || draftData.value.content.trim() || draftData.value.project
      
      if (hasContent && canAutoSave.value) {
        saveStatus.value.hasUnsavedChanges = true
        debouncedSave()
      }
    },
    { flush: 'post' }
  )

  return {
    saveStatus: computed(() => saveStatus.value),
    canAutoSave,
    debouncedSave,
    immediateSave,
    performSave
  }
}