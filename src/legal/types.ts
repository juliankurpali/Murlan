export type LegalKind = 'terms' | 'privacy';

export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalDoc = {
  title: string;
  updated: string;
  sections: LegalSection[];
};
