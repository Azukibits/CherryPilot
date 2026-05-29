<script setup lang="ts">
import { ref } from 'vue';

// 原生文件输入框引用，供父组件通过 expose 主动打开。
const inputRef = ref<HTMLInputElement | null>(null);

// 文件选择完成后把 FileList 交给父组件处理。
const emit = defineEmits<{
  filesSelected: [files: FileList];
}>();

// 暴露给父组件的打开方法。
function open() {
  inputRef.value?.click();
}

// 读取选择结果并清空 input，确保下次选择同一文件也能触发 change。
function handleChange(event: Event) {
  const input = event.target as HTMLInputElement;

  if (input.files && input.files.length > 0) {
    emit('filesSelected', input.files);
  }

  input.value = '';
}

// 允许父组件通过 ref 调用 open。
defineExpose({ open });
</script>

<template>
  <input
    ref="inputRef"
    id="hiddenFileInput"
    type="file"
    multiple
    hidden
    accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv,.log,.xml,.html,.css,.js,.ts,.tsx,.jsx,.vue,.py,.java,.cpp,.c,.h"
    @change="handleChange"
  />
</template>
