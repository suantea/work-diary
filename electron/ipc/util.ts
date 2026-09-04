import type { Settings } from '../services/settings'

export function pickProviderCfg(s: Settings) {
  switch (s.provider) {
    case 'openrouter': return { baseUrl: s.openrouterBaseUrl, apiKey: s.openrouterApiKey }
    case 'siliconflow': return { baseUrl: s.siliconflowBaseUrl, apiKey: s.siliconflowApiKey }
    case 'doubao': return { baseUrl: s.doubaoBaseUrl, apiKey: s.doubaoApiKey }
    case 'custom': return { baseUrl: s.customBaseUrl, apiKey: s.customApiKey }
    default: return { baseUrl: s.openrouterBaseUrl, apiKey: s.openrouterApiKey }
  }
}
