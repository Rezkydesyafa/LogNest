import { describe, expect, it } from 'vitest';
import { parseProjectEvent, projectChannel, projectIdFromChannel } from './project-events';

describe('projectChannel', () => {
  it('namespaces the channel per project', () => {
    expect(projectChannel('project_1')).toBe('logmind:events:project_1');
  });

  it('round-trips back to the project id', () => {
    expect(projectIdFromChannel(projectChannel('project_1'))).toBe('project_1');
  });

  it('ignores a channel outside the namespace', () => {
    expect(projectIdFromChannel('other:channel')).toBeUndefined();
  });
});

describe('parseProjectEvent', () => {
  it('accepts a well formed event', () => {
    const event = {
      type: 'incident.created',
      projectId: 'project_1',
      at: '2026-07-26T10:00:00.000Z',
      payload: { incidentId: 'incident_1' },
    };

    expect(parseProjectEvent(JSON.stringify(event))).toEqual(event);
  });

  it.each(['not json', '"a string"', '{}', '{"type":"x"}', 'null'])(
    'rejects the malformed payload %j',
    (raw) => {
      expect(parseProjectEvent(raw)).toBeUndefined();
    },
  );
});
