<script setup lang="ts">
import { nextTick } from 'vue';
import type { ProviderState } from '@/renderer/stores/companion';

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

async function handleApiKeyKeydown(event: KeyboardEvent) {
  if (event.altKey || event.key.toLowerCase() !== 'x' || (!event.ctrlKey && !event.metaKey)) {
    return;
  }

  const input = event.currentTarget as HTMLInputElement;
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;

  if (start === end) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const selectedText = input.value.slice(start, end);
  const nextValue = `${input.value.slice(0, start)}${input.value.slice(end)}`;

  try {
    await window.companion.writeClipboardText?.(selectedText);
  } catch {
    try {
      await navigator.clipboard?.writeText(selectedText);
    } catch {
      // Clipboard write can be blocked by OS policy; still perform the cut locally.
    }
  }

  input.value = nextValue;
  emit('updateField', props.index, 'apiKey', nextValue);
  await nextTick();
  input.setSelectionRange(start, start);
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
        class="secret-input"
        :value="provider.apiKey"
        type="text"
        spellcheck="false"
        autocomplete="off"
        :placeholder="provider.local ? labels.localKeyPlaceholder : 'sk-...'"
        @input="updateField('apiKey', $event)"
        @keydown="handleApiKeyKeydown"
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

<style scoped lang="less">
.provider-card {
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(157, 178, 194, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.032);
}

.local-provider-card {
  border-color: rgba(67, 240, 206, 0.24);
  background: linear-gradient(180deg, rgba(67, 240, 206, 0.06), rgba(255, 255, 255, 0.028));
  box-shadow: inset 3px 0 0 rgba(67, 240, 206, 0.34);
}

.provider-head {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.provider-head strong {
  color: var(--ink);
  font-size: 12px;
  font-weight: 850;
  line-height: 16px;
}

.provider-head span {
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.provider-card .field:first-of-type {
  margin-top: 7px;
  margin-bottom: 7px;
}

.field {
  min-width: 0;
  display: grid;
  gap: 5px;
  color: #a7b4c0;
  font-size: 11px;
  font-weight: 700;
}

.field:first-of-type {
  margin-top: 8px;
  margin-bottom: 8px;
}

.field-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(144px, 0.7fr);
  gap: 8px;
}

.field input,
textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(157, 178, 194, 0.2);
  border-radius: 7px;
  outline: 0;
  color: var(--ink);
  background: rgba(3, 7, 12, 0.62);
  transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

.field input {
  height: 32px;
  padding: 0 9px;
  font-size: 12px;
}

.field input::placeholder,
textarea::placeholder {
  color: #526170;
}

.field input:focus,
textarea:focus {
  border-color: rgba(67, 240, 206, 0.58);
  box-shadow: 0 0 0 3px rgba(67, 240, 206, 0.1);
  background: rgba(5, 9, 15, 0.78);
}

.model-picker {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 6px;
}

.model-combo {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 6px;
}

.field-icon-button,
.mini-button,
.toolbar-command {
  border: 1px solid rgba(157, 178, 194, 0.2);
  background: rgba(255, 255, 255, 0.045);
}

.field-icon-button {
  width: 32px;
  height: 32px;
  border-radius: 7px;
}

.field-icon-button svg,
.mini-button svg {
  width: 15px;
  height: 15px;
}

.field-icon-button:hover:not(:disabled),
.model-combo.is-open .field-icon-button,
.mini-button:hover:not(:disabled),
.toolbar-command:hover:not(:disabled) {
  color: var(--accent);
  border-color: rgba(67, 240, 206, 0.38);
  background: rgba(67, 240, 206, 0.1);
}

.field-icon-button:disabled,
.mini-button:disabled,
.toolbar-command:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.field-icon-button.is-loading svg {
  animation: spin 900ms linear infinite;
}

.model-menu {
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  right: -38px;
  z-index: 50;
  max-height: 166px;
  display: none;
  overflow: auto;
  padding: 6px;
  border: 1px solid rgba(157, 178, 194, 0.26);
  border-radius: 8px;
  background: rgba(8, 12, 18, 0.98);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.055);
}

.model-combo.is-open .model-menu {
  display: grid;
  gap: 4px;
}

.model-option {
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  overflow: hidden;
  border-radius: 6px;
  color: #dfe8ed;
  background: transparent;
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.model-option:hover {
  color: #fff;
  background: rgba(67, 240, 206, 0.12);
}

.model-empty {
  padding: 8px;
  color: var(--muted);
  font-size: 12px;
}

.provider-card.is-light{
  border-color: rgba(63, 59, 50, 0.13);
  background: linear-gradient(180deg, rgba(255, 248, 236, 0.86), rgba(238, 244, 239, 0.82));
  box-shadow: inset 3px 0 0 rgba(214, 63, 99, 0.3), 0 8px 18px rgba(52, 45, 35, 0.06);
}

.provider-card.is-light:nth-child(2 ){
  box-shadow: inset 3px 0 0 rgba(20, 121, 111, 0.28), 0 8px 18px rgba(52, 45, 35, 0.06);
}

.provider-card.is-light:nth-child(3 ){
  box-shadow: inset 3px 0 0 rgba(185, 120, 22, 0.3), 0 8px 18px rgba(52, 45, 35, 0.06);
}

.provider-card.is-light.local-provider-card{
  border-color: rgba(20, 121, 111, 0.2);
  background: linear-gradient(180deg, rgba(225, 241, 236, 0.9), rgba(255, 248, 236, 0.82));
  box-shadow: inset 3px 0 0 rgba(20, 121, 111, 0.34), 0 8px 18px rgba(52, 45, 35, 0.06);
}

.provider-card.is-light .provider-head strong{
  color: #18221f;
}

.provider-card.is-light .provider-head span{
  color: #6b746f;
}

.provider-card.is-light .field input::placeholder,
.provider-card.is-light textarea::placeholder{
  color: #8b938b;
}

.provider-card.is-light .field input,
.provider-card.is-light textarea {
  border-color: rgba(54, 59, 52, 0.16);
  color: #1d2926;
  background: linear-gradient(180deg, rgba(255, 253, 247, 0.92), rgba(244, 247, 243, 0.86));
}

.provider-card.is-light .field input:focus,
.provider-card.is-light textarea:focus {
  border-color: rgba(214, 63, 99, 0.34);
  background: rgba(255, 252, 246, 0.96);
  box-shadow: 0 0 0 3px rgba(214, 63, 99, 0.09);
}

.provider-card.is-light .field-icon-button,
.provider-card.is-light .mini-button,
.provider-card.is-light .toolbar-command {
  color: #596662;
  border-color: rgba(54, 59, 52, 0.15);
  background: rgba(250, 248, 240, 0.74);
}

.provider-card.is-light .field-icon-button:hover:not(:disabled),
.provider-card.is-light .model-combo.is-open .field-icon-button,
.provider-card.is-light .mini-button:hover:not(:disabled),
.provider-card.is-light .toolbar-command:hover:not(:disabled) {
  color: var(--accent);
  border-color: rgba(214, 63, 99, 0.28);
  background: rgba(255, 232, 224, 0.72);
}

.provider-card.is-light .model-menu {
  border-color: rgba(54, 59, 52, 0.18);
  color: var(--ink);
  background: rgba(255, 251, 242, 0.97);
  box-shadow: 0 18px 40px rgba(52, 45, 35, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.provider-card.is-light .model-option {
  color: #22302d;
}

.provider-card.is-light .model-option:hover {
  color: #8f203d;
  background: rgba(255, 232, 224, 0.78);
}

.provider-card.is-light .model-empty {
  color: #758079;
}
</style>
