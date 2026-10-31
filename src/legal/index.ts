import { Language } from '../application/types';
import { enLegal } from './en';
import { sqLegal } from './sq';
import { LegalDoc, LegalKind } from './types';

export const TERMS_VERSION = 2;
export type { LegalDoc, LegalKind, LegalSection } from './types';

const docs: Record<Language, Record<LegalKind, LegalDoc>> = {
  en: enLegal,
  sq: sqLegal,
};

export function legalDoc(language: Language, kind: LegalKind): LegalDoc {
  return docs[language][kind] ?? docs.en[kind];
}
