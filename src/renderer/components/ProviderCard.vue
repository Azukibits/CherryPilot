<script setup lang="ts">
defineProps({
  provider: {
    type: Object,
    required: true
  },
  local: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <section
    class="provider-card"
    :class="{ 'local-provider-card': local }"
    :data-provider="provider.providerIndex"
  >
    <div class="provider-head">
      <strong>{{ provider.title }}</strong>
      <span>{{ provider.meta }}</span>
    </div>
    <label class="field">
      <span>API Key</span>
      <input
        :id="provider.apiKeyId"
        type="password"
        spellcheck="false"
        autocomplete="off"
        :placeholder="provider.apiKeyPlaceholder"
      />
    </label>
    <div class="field-grid">
      <label class="field">
        <span>接口地址</span>
        <input
          :id="provider.baseUrlId"
          type="url"
          spellcheck="false"
          autocomplete="off"
          :placeholder="provider.baseUrlPlaceholder"
        />
      </label>
      <label class="field">
        <span>模型</span>
        <div class="model-picker">
          <div class="model-combo" :id="provider.modelComboId">
            <input
              :id="provider.modelId"
              type="text"
              spellcheck="false"
              autocomplete="off"
              :placeholder="provider.modelPlaceholder"
            />
            <button
              class="field-icon-button"
              :id="provider.modelMenuButtonId"
              :title="provider.modelMenuTitle"
              :aria-label="provider.modelMenuTitle"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div class="model-menu" :id="provider.modelMenuId">
              <div class="model-empty">{{ provider.modelEmpty }}</div>
            </div>
          </div>
          <button
            class="field-icon-button"
            :id="provider.refreshButtonId"
            :title="provider.refreshTitle"
            :aria-label="provider.refreshTitle"
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
