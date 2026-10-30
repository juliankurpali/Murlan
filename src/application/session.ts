import { GameState } from '../domain';
import { AppScreen, AppSettings, DEFAULT_SETTINGS, SessionState } from './types';

export const initialSession = (overrides?: Partial<SessionState>): SessionState => ({
  screen: 'home',
  settings: DEFAULT_SETTINGS,
  match: null,
  selectedIds: [],
  lastError: null,
  confirmNewGame: false,
  ...overrides,
});

export type SessionAction =
  | { type: 'hydrate'; match: GameState | null; settings: AppSettings }
  | { type: 'navigate'; screen: AppScreen }
  | { type: 'setMatch'; match: GameState | null; error?: string | null }
  | { type: 'toggleCard'; cardId: string }
  | { type: 'clearSelection' }
  | { type: 'setError'; error: string | null }
  | { type: 'askConfirmNewGame'; value: boolean }
  | { type: 'setSettings'; settings: Partial<AppSettings> };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        match: action.match,
        settings: action.settings,
      };
    case 'navigate':
      return {
        ...state,
        screen: action.screen,
        lastError: null,
        confirmNewGame: false,
        selectedIds: action.screen === 'table' ? state.selectedIds : [],
      };
    case 'setMatch':
      return {
        ...state,
        match: action.match,
        lastError: action.error ?? null,
        selectedIds: [],
        confirmNewGame: false,
      };
    case 'toggleCard': {
      if (state.match?.phase === 'exchanging') {
        const selected = state.selectedIds.includes(action.cardId) ? [] : [action.cardId];
        return { ...state, selectedIds: selected, lastError: null };
      }
      const selected = state.selectedIds.includes(action.cardId)
        ? state.selectedIds.filter((id) => id !== action.cardId)
        : [...state.selectedIds, action.cardId];
      return { ...state, selectedIds: selected, lastError: null };
    }
    case 'clearSelection':
      return { ...state, selectedIds: [], lastError: null };
    case 'setError':
      return { ...state, lastError: action.error };
    case 'askConfirmNewGame':
      return { ...state, confirmNewGame: action.value };
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    default:
      return state;
  }
}
