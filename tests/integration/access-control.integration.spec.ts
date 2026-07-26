import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServerKey, randomSuffix, seedUserWithProject, startApi, TestApi } from './harness';

let api: TestApi;
let owner: Awaited<ReturnType<typeof seedUserWithProject>>;
let outsider: Awaited<ReturnType<typeof seedUserWithProject>>;

beforeAll(async () => {
  api = await startApi();
  owner = await seedUserWithProject(api);
  outsider = await seedUserWithProject(api);
});

afterAll(async () => {
  await api?.close();
});

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function addMember(role: 'VIEWER' | 'MEMBER' | 'ADMIN') {
  const invited = await seedUserWithProject(api, randomSuffix());

  await api
    .http()
    .post(`/projects/${owner.project.id}/members`)
    .set(auth(owner.accessToken))
    .send({ email: invited.email, role })
    .expect(201);

  return invited;
}

describe('project isolation', () => {
  it('hides another user project as missing rather than forbidden', async () => {
    await api.http().get(`/projects/${owner.project.id}`).set(auth(outsider.accessToken)).expect(404);
  });

  it('never lists another user project', async () => {
    const response = await api.http().get('/projects').set(auth(outsider.accessToken)).expect(200);

    expect(response.body.data.map((p: { id: string }) => p.id)).not.toContain(owner.project.id);
  });

  it('does not leak logs across projects', async () => {
    const key = await createServerKey(api, owner.accessToken, owner.project.id);
    const marker = randomSuffix();

    await api
      .http()
      .post('/logs/ingest')
      .set('x-api-key', key)
      .send({
        sourceType: 'api',
        serviceName: 'private-service',
        environment: 'production',
        level: 'error',
        message: `secret marker ${marker}`,
      })
      .expect(201);

    const response = await api.http().get('/logs').set(auth(outsider.accessToken)).expect(200);

    expect(JSON.stringify(response.body.data.items)).not.toContain(marker);
  });
});

describe('role enforcement', () => {
  it('lets a viewer read but not write', async () => {
    const viewer = await addMember('VIEWER');
    const headers = auth(viewer.accessToken);

    await api.http().get(`/incidents?projectId=${owner.project.id}`).set(headers).expect(200);
    await api.http().get(`/projects/${owner.project.id}`).set(headers).expect(200);

    await api
      .http()
      .post(`/projects/${owner.project.id}/api-keys`)
      .set(headers)
      .send({ name: 'nope', type: 'SERVER' })
      .expect(403);
    await api
      .http()
      .patch(`/projects/${owner.project.id}`)
      .set(headers)
      .send({ name: 'renamed' })
      .expect(403);
  });

  it('lets a member act on incidents but not administer the project', async () => {
    const member = await addMember('MEMBER');
    const headers = auth(member.accessToken);

    await api
      .http()
      .post(`/projects/${owner.project.id}/alert-channels`)
      .set(headers)
      .send({ name: 'nope', type: 'SLACK', config: { webhookUrl: 'https://hooks.slack.com/x' } })
      .expect(403);
  });

  it('lets an admin manage keys and alerts but not delete the project', async () => {
    const admin = await addMember('ADMIN');
    const headers = auth(admin.accessToken);

    await api
      .http()
      .post(`/projects/${owner.project.id}/api-keys`)
      .set(headers)
      .send({ name: 'admin-key', type: 'SERVER' })
      .expect(201);

    await api.http().delete(`/projects/${owner.project.id}`).set(headers).expect(403);
  });

  it('refuses to remove the last owner', async () => {
    const members = await api
      .http()
      .get(`/projects/${owner.project.id}/members`)
      .set(auth(owner.accessToken))
      .expect(200);
    const ownerMembership = members.body.data.find((m: { role: string }) => m.role === 'OWNER') as {
      id: string;
    };

    await api
      .http()
      .delete(`/projects/members/${ownerMembership.id}`)
      .set(auth(owner.accessToken))
      .expect(400);
  });
});

describe('api key lifecycle', () => {
  it('returns the raw key once and stops accepting it after revocation', async () => {
    const created = await api
      .http()
      .post(`/projects/${owner.project.id}/api-keys`)
      .set(auth(owner.accessToken))
      .send({ name: 'revocable', type: 'SERVER' })
      .expect(201);
    const rawKey = created.body.data.key as string;

    const log = {
      sourceType: 'api',
      serviceName: 'svc',
      environment: 'production',
      level: 'info',
      message: 'still allowed',
    };
    await api.http().post('/logs/ingest').set('x-api-key', rawKey).send(log).expect(201);

    await api.http().delete(`/api-keys/${created.body.data.id}`).set(auth(owner.accessToken)).expect(200);

    // The cache must be invalidated on revoke, not left to expire.
    await api.http().post('/logs/ingest').set('x-api-key', rawKey).send(log).expect(401);
  });

  it('never returns the raw key again when listing', async () => {
    const response = await api
      .http()
      .get(`/projects/${owner.project.id}/api-keys`)
      .set(auth(owner.accessToken))
      .expect(200);

    expect(JSON.stringify(response.body.data)).not.toContain('"key"');
  });

  it('rejects a client key on the server ingestion endpoint', async () => {
    const created = await api
      .http()
      .post(`/projects/${owner.project.id}/api-keys`)
      .set(auth(owner.accessToken))
      .send({ name: 'browser', type: 'CLIENT' })
      .expect(201);

    await api
      .http()
      .post('/logs/ingest')
      .set('x-api-key', created.body.data.key)
      .send({
        sourceType: 'api',
        serviceName: 'svc',
        environment: 'production',
        level: 'info',
        message: 'wrong key type',
      })
      .expect(403);
  });
});

describe('alert channel secrets', () => {
  it('encrypts the channel config at rest and never returns it', async () => {
    const created = await api
      .http()
      .post(`/projects/${owner.project.id}/alert-channels`)
      .set(auth(owner.accessToken))
      .send({
        name: `ops-${randomSuffix()}`,
        type: 'SLACK',
        config: { webhookUrl: 'https://hooks.slack.com/services/T0/B0/supersecret' },
      })
      .expect(201);

    expect(JSON.stringify(created.body.data.config)).not.toContain('supersecret');

    const row = await api.prisma.alertChannel.findUnique({ where: { id: created.body.data.id } });
    expect(JSON.stringify(row?.config)).not.toContain('supersecret');
    expect(JSON.stringify(row?.config)).toContain('$enc');
  });

  it('rejects a channel config the dispatcher could not use', async () => {
    await api
      .http()
      .post(`/projects/${owner.project.id}/alert-channels`)
      .set(auth(owner.accessToken))
      .send({ name: `broken-${randomSuffix()}`, type: 'SLACK', config: {} })
      .expect(400);
  });
});
