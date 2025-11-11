import { computed, nextTick, ref, type Ref, watch } from 'vue';
import { onKeyStroke, useFocusWithin } from '@vueuse/core';

import type { FileNode } from '@/types/window';

interface UseFileTreeNavigationOptions {
  nodes: Ref<FileNode[]>;
  expandedPaths: Ref<Set<string>>;
  selectedPath: Ref<string | null>;
  onToggle: (node: FileNode) => void; // eslint-disable-line no-unused-vars
  onSelect: (node: FileNode) => void; // eslint-disable-line no-unused-vars
  enabled?: Ref<boolean>;
}

interface FlattenedNode {
  node: FileNode;
  depth: number;
  index: number;
  path: string;
}

export function useFileTreeNavigation({
  nodes,
  expandedPaths,
  selectedPath,
  onToggle,
  onSelect,
  enabled = ref(true),
}: UseFileTreeNavigationOptions) {
  const containerRef = ref<HTMLElement>();
  const focusedIndex = ref<number>(0);

  // Flatten the visible tree structure for navigation
  const flattenedNodes = computed<FlattenedNode[]>(() => {
    const result: FlattenedNode[] = [];
    let index = 0;

    const flatten = (nodeList: FileNode[], depth: number) => {
      for (const node of nodeList) {
        result.push({
          node,
          depth,
          index: index++,
          path: node.path,
        });

        // Include children if directory is expanded
        if (node.type === 'directory' && expandedPaths.value.has(node.path) && node.children) {
          flatten(node.children, depth + 1);
        }
      }
    };

    flatten(nodes.value, 0);
    return result;
  });

  // Find the parent of a given node
  const findParent = (targetPath: string): FlattenedNode | null => {
    const targetIndex = flattenedNodes.value.findIndex(item => item.path === targetPath);
    if (targetIndex <= 0) return null;

    const targetDepth = flattenedNodes.value[targetIndex].depth;

    // Look backwards for a node with depth one less
    for (let i = targetIndex - 1; i >= 0; i--) {
      if (flattenedNodes.value[i].depth === targetDepth - 1) {
        return flattenedNodes.value[i];
      }
    }

    return null;
  };

  // Find first child of a directory node
  const findFirstChild = (targetPath: string): FlattenedNode | null => {
    const targetIndex = flattenedNodes.value.findIndex(item => item.path === targetPath);
    if (targetIndex === -1 || targetIndex === flattenedNodes.value.length - 1) return null;

    const nextNode = flattenedNodes.value[targetIndex + 1];
    const currentDepth = flattenedNodes.value[targetIndex].depth;

    // Next node is a child if its depth is greater
    if (nextNode.depth > currentDepth) {
      return nextNode;
    }

    return null;
  };

  // Get currently focused node
  const focusedNode = computed(() => {
    return flattenedNodes.value[focusedIndex.value] || null;
  });

  // Update focused index when selected path changes externally
  watch(selectedPath, newPath => {
    if (newPath) {
      const index = flattenedNodes.value.findIndex(item => item.path === newPath);
      if (index !== -1) {
        focusedIndex.value = index;
      }
    }
  });

  // Sync focused index when tree structure changes
  watch(flattenedNodes, newFlattened => {
    // Try to keep focus on the same node if possible
    if (focusedNode.value) {
      const newIndex = newFlattened.findIndex(item => item.path === focusedNode.value?.path);
      if (newIndex !== -1) {
        focusedIndex.value = newIndex;
      } else if (focusedIndex.value >= newFlattened.length) {
        // If current index is out of bounds, move to last item
        focusedIndex.value = Math.max(0, newFlattened.length - 1);
      }
    }
  });

  // Focus an item by scrolling it into view
  const focusItem = async (index: number) => {
    if (!containerRef.value) return;

    // Wait for DOM updates
    await nextTick();

    const items = containerRef.value.querySelectorAll('[data-tree-item]');
    const item = items[index] as HTMLElement;

    if (item) {
      item.focus();
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  // Navigation handlers
  const moveDown = () => {
    if (focusedIndex.value < flattenedNodes.value.length - 1) {
      focusedIndex.value++;
      focusItem(focusedIndex.value);
    }
  };

  const moveUp = () => {
    if (focusedIndex.value > 0) {
      focusedIndex.value--;
      focusItem(focusedIndex.value);
    }
  };

  const moveRight = () => {
    const current = focusedNode.value;
    if (!current) return;

    if (current.node.type === 'directory') {
      if (!expandedPaths.value.has(current.path)) {
        // Expand the folder
        onToggle(current.node);
      } else {
        // Already expanded, move to first child
        const firstChild = findFirstChild(current.path);
        if (firstChild) {
          focusedIndex.value = firstChild.index;
          focusItem(focusedIndex.value);
        }
      }
    }
  };

  const moveLeft = () => {
    const current = focusedNode.value;
    if (!current) return;

    if (current.node.type === 'directory' && expandedPaths.value.has(current.path)) {
      // Collapse the folder
      onToggle(current.node);
    } else {
      // Move to parent
      const parent = findParent(current.path);
      if (parent) {
        focusedIndex.value = parent.index;
        focusItem(focusedIndex.value);
      }
    }
  };

  const selectCurrent = () => {
    const current = focusedNode.value;
    if (current) {
      onSelect(current.node);

      // Toggle directories on Enter
      if (current.node.type === 'directory') {
        onToggle(current.node);
      }
    }
  };

  const moveToFirst = () => {
    if (flattenedNodes.value.length > 0) {
      focusedIndex.value = 0;
      focusItem(focusedIndex.value);
    }
  };

  const moveToLast = () => {
    if (flattenedNodes.value.length > 0) {
      focusedIndex.value = flattenedNodes.value.length - 1;
      focusItem(focusedIndex.value);
    }
  };

  // Track if focus is within the tree
  const { focused: isFocusWithin } = useFocusWithin(containerRef);

  // Update focused index based on actual DOM focus
  const updateFocusFromDOM = () => {
    if (!containerRef.value) return;

    const activeElement = document.activeElement as HTMLElement;
    const treeItemPath = activeElement?.getAttribute('data-tree-item');

    if (treeItemPath) {
      const index = flattenedNodes.value.findIndex(item => item.path === treeItemPath);
      if (index !== -1) {
        focusedIndex.value = index;
      }
    }
  };

  // Setup keyboard event listeners
  const setupKeyboardListeners = () => {
    // Tab navigation (native browser behavior with arrow key enhancement)
    onKeyStroke('Tab', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        if (e.shiftKey) {
          moveUp();
        } else {
          moveDown();
        }
      }
    });

    // Arrow keys work the same as Tab/Shift+Tab for convenience
    onKeyStroke('ArrowDown', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        moveDown();
      }
    });

    onKeyStroke('ArrowUp', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        moveUp();
      }
    });

    onKeyStroke('ArrowRight', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        moveRight();
      }
    });

    onKeyStroke('ArrowLeft', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        moveLeft();
      }
    });

    onKeyStroke('Enter', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        selectCurrent();
      }
    });

    onKeyStroke(' ', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        selectCurrent();
      }
    });

    onKeyStroke('Home', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        moveToFirst();
      }
    });

    onKeyStroke('End', e => {
      if (enabled.value && isFocusWithin.value) {
        e.preventDefault();
        moveToLast();
      }
    });
  };

  // Initialize keyboard listeners
  setupKeyboardListeners();

  return {
    containerRef,
    focusedIndex,
    focusedNode,
    flattenedNodes,
    focusItem,
    updateFocusFromDOM,
  };
}
