export type DevSectionKind = 'section' | 'container';

export interface DevSectionMetadata {
  name: string;
  path: string;
  kind?: DevSectionKind;
}

export function formatDevSectionCopyText(section: DevSectionMetadata) {
  return `${section.name} - ${section.path}`;
}
