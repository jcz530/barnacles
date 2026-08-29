<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { EditorState, Compartment, Transaction, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { useDark } from '@vueuse/core';
import { resolveCodeMirrorLanguage } from '@/utils/file-language';

interface Props {
  modelValue: string;
  filePath?: string | null;
  /** Soft-wrap long lines instead of scrolling horizontally. */
  wrap?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  filePath: null,
  wrap: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  save: [];
}>();

const container = ref<HTMLDivElement | null>(null);
// shallowRef: the EditorView is a large non-reactive object and must not be proxied.
const view = shallowRef<EditorView | null>(null);

// Compartments let us swap theme and language without rebuilding editor state,
// which would discard the undo history and cursor position.
const themeCompartment = new Compartment();
const languageCompartment = new Compartment();
const wrapCompartment = new Compartment();

const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: 'light',
});

/** Editor chrome sized to match the surrounding Shiki view. */
const baseTheme = EditorView.theme({
  // maxWidth + the scroller's overflow keep long lines inside this pane rather
  // than widening the flex row and pushing the header buttons off-screen.
  '&': { height: '100%', maxWidth: '100%', fontSize: '0.875rem' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    lineHeight: '1.5',
    padding: '0.5rem 0',
  },
  '.cm-content': { padding: '0 0.5rem' },
  '&.cm-focused': { outline: 'none' },
});

function themeExtension(): Extension {
  return isDark.value ? oneDark : syntaxHighlighting(defaultHighlightStyle, { fallback: true });
}

function createExtensions(language: Extension | null): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    foldGutter(),
    indentOnInput(),
    bracketMatching(),
    highlightSelectionMatches(),
    EditorState.allowMultipleSelections.of(true),
    // Cmd/Ctrl+S saves. Placed before the defaults so it wins the binding.
    keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          emit('save');
          return true;
        },
      },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...foldKeymap,
      indentWithTab,
    ]),
    baseTheme,
    wrapCompartment.of(props.wrap ? EditorView.lineWrapping : []),
    themeCompartment.of(themeExtension()),
    languageCompartment.of(language ?? []),
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        emit('update:modelValue', update.state.doc.toString());
      }
    }),
  ];
}

// The dynamic language import below is a real await, so the component can
// unmount before it resolves. Without this flag the resolved import would build
// an EditorView into a detached node that nothing ever destroys.
let disposed = false;

onMounted(async () => {
  if (!container.value) return;

  const language = await resolveCodeMirrorLanguage(props.filePath);
  if (disposed || !container.value) return;

  view.value = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: createExtensions(language),
    }),
    parent: container.value,
  });

  view.value.focus();
});

onBeforeUnmount(() => {
  disposed = true;
  view.value?.destroy();
  view.value = null;
});

// Reflect external content changes (a reload after a conflict, say) without
// clobbering the document the user is actively typing into.
watch(
  () => props.modelValue,
  next => {
    const editor = view.value;
    if (!editor) return;
    if (next === editor.state.doc.toString()) return;

    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: next },
      // Keep external replacements (a conflict reload, a cancel) out of the undo
      // history: otherwise Cmd+Z restores content the user chose to discard, and
      // the next save writes it back to disk.
      annotations: Transaction.addToHistory.of(false),
    });
  }
);

watch(
  () => props.wrap,
  wrap => {
    view.value?.dispatch({
      effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  }
);

watch(isDark, () => {
  view.value?.dispatch({
    effects: themeCompartment.reconfigure(themeExtension()),
  });
});

watch(
  () => props.filePath,
  async filePath => {
    const language = await resolveCodeMirrorLanguage(filePath);
    view.value?.dispatch({
      effects: languageCompartment.reconfigure(language ?? []),
    });
  }
);

defineExpose({
  focus: () => view.value?.focus(),
});
</script>

<template>
  <div ref="container" class="h-full overflow-hidden" />
</template>
