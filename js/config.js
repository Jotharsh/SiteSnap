export const APP_VERSION = '1.0.0';

export const TAGS = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'fix', label: 'Needs Fix' },
  { id: 'done', label: 'Done' },
  { id: 'note', label: 'Note' },
];
export const tagLabel = (id) => TAGS.find((t) => t.id === id)?.label ?? '';

export const DEFAULT_SETTINGS = {
  preparedBy: '',
  designation: '',
  company: '',
  accent: '#c2410c',
  perPage: 2,        // observations per PDF page: 1, 2 or 4
  paper: 'a4',       // 'a4' | 'letter'
  logo: null,        // Blob
  signature: null,   // Blob
};
