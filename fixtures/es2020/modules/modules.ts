// modules
export const named = 1;
export default function def() {
  return named;
}

export { named as renamed };
export * from './modules-dep';
export { dep } from './modules-dep';

import { dep } from './modules-dep';
import def2, { named as n2 } from './modules-dep';

const meta = import.meta;
const dyn = import('./modules-dep');

void dep;
void def2;
void n2;
void meta;
void dyn;
