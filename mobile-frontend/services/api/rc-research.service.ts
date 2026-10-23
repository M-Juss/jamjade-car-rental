import { apiGet } from '@/services/http';

export async function checkRcResearchAccess() {
  await apiGet<null>('/mobile/rc-research');
}
