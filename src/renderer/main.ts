import { createApp } from 'vue';
import '@/styles.less';
import App from '@/renderer/App.vue';
import { pinia } from '@/renderer/stores/pinia';

createApp(App).use(pinia).mount('#app');
