import { ApiKeyType } from '@prisma/client';

export type CurrentUserPayload = {
  id: string;
  email: string;
  name: string | null;
};

export type ApiKeyContext = {
  id: string;
  type: ApiKeyType;
  projectId: string;
};
