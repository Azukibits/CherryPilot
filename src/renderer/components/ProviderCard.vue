<script setup lang="ts">
import type { ProviderState } from '@/renderer/composables/companionState';

// 父组件传入的接口配置和显示文案，本组件只负责渲染单张接口卡片。
const props = defineProps<{
  provider: ProviderState;
  index: number;
  modelList: string[];
  active: boolean;
  labels: Record<string, string>;
}>();

// 所有交互都向父组件发事件，避免在子组件里直接修改 prop。
const emit = defineEmits<{
  refresh: [index: number];
  toggleMenu: [index: number];
  openMenu: [index: number];
  selectModel: [index: number, model: string];
  updateField: [index: number, field: 'apiKey' | 'baseUrl' | 'model', value: string];
}>();

// 将输入框变更透传给父组件，由 SettingsPanel 统一写入共享状态。
function updateField(field: 'apiKey' | 'baseUrl' | 'model', event: Event) {
  emit('updateField', props.index, field, (event.target as HTMLInputElement).value);
}
</script>

<template>
  <section
    class="provider-card"
    :class="{ 'local-provider-card': provider.local }"
    :data-provider="index"
  >
    <div class="provider-head">
      <strong>{{ provider.local ? labels.localModel : `${String(index + 1).padStart(2, '0')} ${labels.provider}` }}</strong>
      <span>{{ provider.local ? 'Ollama / LM Studio' : labels.providerMeta }}</span>
    </div>

    <label class="field">
      <span>{{ labels.apiKey }}</span>
      <input
        :id="provider.domIds.apiKey"
        :value="provider.apiKey"
        type="password"
        spellcheck="false"
        autocomplete="off"
        :placeholder="provider.local ? labels.localKeyPlaceholder : 'sk-...'"
        @input="updateField('apiKey', $event)"
      />
    </label>

    <div class="field-grid">
      <label class="field">
        <span>{{ labels.baseUrl }}</span>
        <input
          :id="provider.domIds.baseUrl"
          :value="provider.baseUrl"
          type="url"
          spellcheck="false"
          autocomplete="off"
          :placeholder="provider.defaultBaseUrl"
          @input="updateField('baseUrl', $event)"
        />
      </label>

      <label class="field">
        <span>{{ labels.model }}</span>
        <div
          class="model-picker"
          @click.stop
        >
          <div
            :id="provider.domIds.combo"
            class="model-combo"
            :class="{ 'is-open': provider.menuOpen }"
          >
            <input
              :id="provider.domIds.model"
              :value="provider.model"
              type="text"
              spellcheck="false"
              autocomplete="off"
              :placeholder="provider.local ? 'qwen2.5:7b' : (index === 0 ? 'gpt-4o-mini' : 'model id')"
              @input="updateField('model', $event)"
              @focus="emit('openMenu', index)"
            />
            <button
              :id="provider.domIds.menuButton"
              class="field-icon-button"
              type="button"
              :title="labels.chooseModel"
              :aria-label="labels.chooseModel"
              :aria-expanded="provider.menuOpen ? 'true' : 'false'"
              @click.stop="emit('toggleMenu', index)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <div
              :id="provider.domIds.menu"
              class="model-menu"
            >
              <button
                v-for="model in modelList"
                :key="model"
                class="model-option"
                type="button"
                :title="model"
                @click.stop="emit('selectModel', index, model)"
              >
                {{ model }}
              </button>
              <div v-if="modelList.length === 0" class="model-empty">
                {{ labels.modelEmpty }}
              </div>
            </div>
          </div>

          <button
            :id="provider.domIds.refresh"
            class="field-icon-button"
            :class="{ 'is-loading': provider.isRefreshing }"
            type="button"
            :disabled="provider.isRefreshing"
            :title="labels.refreshModel"
            :aria-label="labels.refreshModel"
            @click.stop="emit('refresh', index)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 0 0-14-5l-2 3M4 4v5h5M4 13a8 8 0 0 0 14 5l2-3M20 20v-5h-5" />
            </svg>
          </button>
        </div>
      </label>
    </div>
  </section>
</template>
