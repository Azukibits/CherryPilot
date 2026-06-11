import { PROVIDERS, type ProviderEntity } from '@/renderer/entity';

/**
 * 模型供应商槽位的运行态。
 * ProviderEntity 保存静态元信息，这里补充用户配置和下拉菜单状态。
 */
export type ProviderState = ProviderEntity & {
  apiKey: string;
  baseUrl: string;
  model: string;
  menuOpen: boolean;
  isRefreshing: boolean;
};

export interface CompanionProvidersState {
  modelLists: string[][];
  providers: ProviderState[];
  activeProviderIndex: number;
}

/**
 * 为每个供应商槽位创建独立运行态。
 * 静态配置来自 entity，用户输入和菜单状态只存在于 renderer store。
 */
export function createProviderSlots(): ProviderState[] {
  return PROVIDERS.map((provider) => ({
    ...provider,
    apiKey: '',
    baseUrl: provider.defaultBaseUrl,
    model: provider.defaultModel,
    menuOpen: false,
    isRefreshing: false
  }));
}

/**
 * 创建模型供应商业务的默认状态。
 */
export function createCompanionProvidersState(): CompanionProvidersState {
  return {
    modelLists: PROVIDERS.map(() => []),
    providers: createProviderSlots(),
    activeProviderIndex: 0
  };
}

/**
 * 关闭模型供应商下拉菜单。
 * slotIndex 为空时关闭全部菜单，传入索引时只关闭指定槽位。
 */
export function closeProviderMenusState(
  state: CompanionProvidersState,
  slotIndex: number | null = null
) {
  state.providers.forEach((provider, index) => {
    if (slotIndex === null || index === slotIndex) {
      provider.menuOpen = false;
    }
  });
}
